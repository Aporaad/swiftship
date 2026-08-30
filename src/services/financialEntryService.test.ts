import { describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase-firebase-adapter', () => ({
  supabase: { rpc },
}));

import { buildFinancialEntryPayload, financialEntryService } from './financialEntryService';

const baseEntry = {
  entryNumber: 'JV-20260827-001',
  moduleId: 'module_accounting',
  entryTypeId: 'type_daily_journal',
  entryCategory: 'General' as const,
  description: 'قيد اختبار',
  lines: [
    { accountId: '1110-0003', accountCurNo: 1, currencyOriginalNo: 1, transType: 'Debit' as const, amount: 100, amountOriginal: 100 },
    { accountId: '1132-0005', accountCurNo: 1, currencyOriginalNo: 1, transType: 'Credit' as const, amount: 100, amountOriginal: 100 },
  ],
};

describe('financialEntryService', () => {
  it('يبني حمولة صريحة ومتوازنة للإجراء الذري دون استخدام data', () => {
    const payload = buildFinancialEntryPayload(baseEntry);
    expect(payload).toMatchObject({
      entryNumber: 'JV-20260827-001',
      postingStatus: 'draft',
    });
    expect((payload.lines as Array<Record<string, unknown>>)[0]).toMatchObject({
      transType: 'Debit', amount: '100', amountOriginal: '100', accountCurNo: '1', currencyOriginalNo: '1',
    });
    expect(payload).not.toHaveProperty('data');
  });

  it('يسلسل تفاصيل الدفع الصريحة مع مرجع البنك دون حقل بيانات عام', () => {
    const payload = buildFinancialEntryPayload({
      ...baseEntry,
      paymentMethod: 'bank',
      paymentDetails: [{ paymentMethod: 'bank', accountId: '1120-0001', amountOriginal: 100, bankReference: 'TRX-100' }],
    });
    expect(payload).toMatchObject({ paymentMethod: 'bank', paymentDetails: [{ paymentMethod: 'bank', accountId: '1120-0001', amountOriginal: '100', bankReference: 'TRX-100' }] });
    expect(payload).not.toHaveProperty('data');
  });

  it('يرفض القيد غير المتوازن قبل أي اتصال بقاعدة البيانات', () => {
    expect(() => buildFinancialEntryPayload({
      ...baseEntry,
      lines: [baseEntry.lines[0], { ...baseEntry.lines[1], amountOriginal: 99, amount: 99 }],
    })).toThrow('القيد غير متوازن');
  });

  it('يستدعي إجراء إنشاء واحدًا ذريًا ولا يكتب رؤوسًا وأسطرًا منفصلة', async () => {
    rpc.mockResolvedValueOnce({
      data: { id: 'entry-1', entryNumber: baseEntry.entryNumber, postingStatus: 'posted', lineCount: 2 },
      error: null,
    });

    await expect(financialEntryService.create({ ...baseEntry, postingStatus: 'posted' })).resolves.toMatchObject({ id: 'entry-1' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('secure_create_financial_entry', expect.objectContaining({ p_entry: expect.any(Object) }));
  });

  it('يرفض التحويل المباشر بين عملتين غير افتراضيتين بدل اختراع أساس سعر غير محفوظ', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: (_field: string, code: string) => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: code === 'SAR' ? { cur_id: 2, isDefault: false } : { cur_id: 3, isDefault: false },
              error: null,
            }),
          }),
        }),
      }),
    }));
    (await import('../lib/supabase-firebase-adapter')).supabase.from = from;

    await expect(financialEntryService.createFromLegacyVoucher({
      entryNumber: 'FX-001', createdAt: Date.now(), description: 'قيد صرف', amount: 10, currency: 'SAR', module: 'exchange', refNumber: 'FX-001',
    }, {
      id: '1110-0003', curNo: 3, currency: 'USD',
    }, {
      id: '1132-0005', curNo: 3, currency: 'USD',
    })).rejects.toThrow('التحويل المباشر بين عملتين غير افتراضيتين');
  });

  it('ينشئ العهدة وقيد إصدارها عبر إجراء ذري واحد', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'custody-1', custodyNumber: 'CUS-1', issuedEntryId: 'entry-1', status: 'open' }, error: null });
    await expect(financialEntryService.createCustodyAdvance({
      custodyNumber: 'CUS-1', recipientType: 'courier', recipientId: 'courier-1', recipientName: 'مندوب', recipientAccountId: '2121-0001', amountOriginal: 100, currencyOriginalNo: 1,
    }, baseEntry)).resolves.toMatchObject({ id: 'custody-1', status: 'open' });
    expect(rpc).toHaveBeenCalledWith('secure_create_custody_advance', expect.objectContaining({ p_custody: expect.any(Object), p_entry: expect.any(Object) }));
  });

  it('يرسل دفعة الطلب وسند القبض معًا إلى إجراء ذري واحد', async () => {
    rpc.mockResolvedValueOnce({ data: { orderId: 'order-1', entryId: 'entry-1', amountPaid: 100, amountRemaining: 0, paymentStatus: 'Paid' }, error: null });
    await expect(financialEntryService.recordOrderPayment('order-1', 100, { ...baseEntry, orderId: 'order-1' })).resolves.toMatchObject({ entryId: 'entry-1', paymentStatus: 'Paid' });
    expect(rpc).toHaveBeenCalledWith('secure_record_order_payment', expect.objectContaining({ p_order_id: 'order-1', p_payment_amount: 100, p_entry: expect.any(Object) }));
  });

  it('يفوض حذف المسودة والعكس والإبطال إلى إجراءات ذرية حساسة مستقلة', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'entry-1', deleted: true }, error: null });
    await expect(financialEntryService.deleteDraft('entry-1')).resolves.toMatchObject({ deleted: true });
    expect(rpc).toHaveBeenLastCalledWith('secure_delete_financial_entry_draft', { p_entry_id: 'entry-1' });

    rpc.mockResolvedValueOnce({ data: { id: 'entry-1', postingStatus: 'voided' }, error: null });
    await expect(financialEntryService.voidDraft('entry-1', 'user-1')).resolves.toMatchObject({ postingStatus: 'voided' });
    expect(rpc).toHaveBeenLastCalledWith('secure_void_financial_entry_draft', { p_entry_id: 'entry-1' });

    rpc.mockResolvedValueOnce({ data: { id: 'entry-2', entryNumber: 'REV-1', postingStatus: 'posted', lineCount: 2, reversesEntryId: 'entry-1' }, error: null });
    await expect(financialEntryService.reverse('entry-1', 'REV-1', 'user-1')).resolves.toMatchObject({ reversesEntryId: 'entry-1' });
    expect(rpc).toHaveBeenLastCalledWith('secure_reverse_financial_entry', expect.objectContaining({ p_entry_id: 'entry-1', p_reversal: expect.objectContaining({ entryNumber: 'REV-1' }) }));
  });

  it('يستبدل مسودة القيد من خلال إجراء ذري واحد', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'entry-1', entryNumber: 'JV-1', postingStatus: 'draft', lineCount: 2 }, error: null });
    await expect(financialEntryService.replaceDraft('entry-1', baseEntry)).resolves.toMatchObject({ id: 'entry-1', postingStatus: 'draft' });
    expect(rpc).toHaveBeenLastCalledWith('secure_replace_financial_entry_draft', expect.objectContaining({ p_entry_id: 'entry-1', p_entry: expect.any(Object) }));
  });
});
