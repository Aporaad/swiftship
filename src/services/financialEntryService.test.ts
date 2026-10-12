import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({
  isEnabled: () => true,
  createEntry: vi.fn(),
  replaceDraft: vi.fn(),
  deleteEntry: vi.fn(),
  postEntry: vi.fn(),
  unpostEntry: vi.fn(),
  reverseEntry: vi.fn(),
  voidDraft: vi.fn(),
  createCustodyAdvance: vi.fn(),
  settleCustodyAdvance: vi.fn(),
  recordOrderPayment: vi.fn(),
}));

const currenciesGateway = vi.hoisted(() => ({
  listCurrencies: vi.fn(),
}));

const currencyServiceMock = vi.hoisted(() => ({
  getPriceReferenceAt: vi.fn(),
  getLatestPriceReference: vi.fn(),
}));

vi.mock('../components/financeAccounting/FinanceApiWriteGateway', () => ({
  financeApiWriteGateway: gateway,
}));

vi.mock('../data/http/settings-currencies-api.gateway', () => ({
  settingsCurrenciesApiGateway: currenciesGateway,
}));

vi.mock('./currencyService', () => ({
  default: currencyServiceMock,
  currencyService: currencyServiceMock,
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
  beforeEach(() => {
    vi.clearAllMocks();
    currenciesGateway.listCurrencies.mockResolvedValue([
      { currencyId: 1, code: 'YER', isDefault: true },
      { currencyId: 2, code: 'SAR', isDefault: false },
      { currencyId: 3, code: 'USD', isDefault: false },
    ]);
  });

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

  it('يستدعي endpoint إنشاء واحدًا عبر بوابه الـHTTP ولا يكتب رؤوسًا وأسطرًا منفصلة', async () => {
    gateway.createEntry.mockResolvedValueOnce({
      id: 'entry-1', entryNumber: baseEntry.entryNumber, postingStatus: 'posted', lineCount: 2,
    });

    await expect(financialEntryService.create({ ...baseEntry, postingStatus: 'posted' })).resolves.toMatchObject({ id: 'entry-1' });
    expect(gateway.createEntry).toHaveBeenCalledTimes(1);
    expect(gateway.createEntry).toHaveBeenCalledWith(expect.objectContaining({ entryNumber: baseEntry.entryNumber, postingStatus: 'posted' }));
  });

  it('يحول تلقائياً بين عملتين غير افتراضيتين بناءً على أسعار صرف العملتين مقابل العملة الافتراضية', async () => {
    currencyServiceMock.getPriceReferenceAt.mockImplementation(async (curNo: number) =>
      curNo === 2
        ? { price: 140, reference: { id: 1, seq: 10 } }
        : { price: 530, reference: { id: 2, seq: 20 } });
    gateway.createEntry.mockResolvedValueOnce({ id: 'entry-fx-1' });

    const result = await financialEntryService.createFromLegacyVoucher({
      entryNumber: 'FX-001', createdAt: Date.now(), description: 'قيد صرف', amount: 100, currency: 'SAR', module: 'exchange', refNumber: 'FX-001',
    }, {
      id: '1110-0003', curNo: 3, currency: 'USD',
    }, {
      id: '1132-0005', curNo: 2, currency: 'SAR',
    });

    expect(result).toMatchObject({ id: 'entry-fx-1' });
    expect(gateway.createEntry).toHaveBeenLastCalledWith(expect.objectContaining({
      moduleId: 'module_exchange',
      entryTypeId: 'type_exchange',
      lines: expect.arrayContaining([
        expect.objectContaining({
          accountId: '1110-0003',
          accountCurNo: '3',
          currencyOriginalNo: '2',
          currencyPriceId: '1',
          currencyPriceSeq: '10',
          accountCurrencyPriceId: '2',
          accountCurrencyPriceSeq: '20',
        }),
      ]),
    }));
  });

  it('ينشئ العهدة وقيد إصدارها عبر endpoint ذري واحد', async () => {
    gateway.createCustodyAdvance.mockResolvedValueOnce({ id: 'custody-1', custodyNumber: 'CUS-1', issuedEntryId: 'entry-1', status: 'open' });
    await expect(financialEntryService.createCustodyAdvance({
      custodyNumber: 'CUS-1', recipientType: 'courier', recipientId: 'courier-1', recipientName: 'مندوب', recipientAccountId: '2121-0001', amountOriginal: 100, currencyOriginalNo: 1,
    }, baseEntry)).resolves.toMatchObject({ id: 'custody-1', status: 'open' });
    expect(gateway.createCustodyAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ custodyNumber: 'CUS-1', recipientAccountId: '2121-0001' }),
      expect.objectContaining({ entryNumber: baseEntry.entryNumber }),
    );
  });

  it('يرسل دفعة الطلب وسند القبض معًا إلى endpoint ذري واحد', async () => {
    gateway.recordOrderPayment.mockResolvedValueOnce({ orderId: 'order-1', entryId: 'entry-1', amountPaid: 100, amountRemaining: 0, paymentStatus: 'Paid' });
    await expect(financialEntryService.recordOrderPayment('order-1', 100, { ...baseEntry, orderId: 'order-1' })).resolves.toMatchObject({ entryId: 'entry-1', paymentStatus: 'Paid' });
    expect(gateway.recordOrderPayment).toHaveBeenCalledWith('order-1', 100, expect.objectContaining({ orderId: 'order-1' }));
  });

  it('يفوض حذف المسودة والعكس والإبطال إلى endpoints حساسة مستقلة', async () => {
    gateway.deleteEntry.mockResolvedValueOnce({ id: 'entry-1', deleted: true });
    await expect(financialEntryService.deleteDraft('entry-1')).resolves.toMatchObject({ deleted: true });
    expect(gateway.deleteEntry).toHaveBeenLastCalledWith('entry-1');

    gateway.voidDraft.mockResolvedValueOnce({ id: 'entry-1', postingStatus: 'voided' });
    await expect(financialEntryService.voidDraft('entry-1', 'user-1')).resolves.toMatchObject({ postingStatus: 'voided' });
    expect(gateway.voidDraft).toHaveBeenLastCalledWith('entry-1');

    gateway.reverseEntry.mockResolvedValueOnce({ id: 'entry-2', entryNumber: 'REV-1', postingStatus: 'posted', lineCount: 2, reversesEntryId: 'entry-1' });
    await expect(financialEntryService.reverse('entry-1', 'REV-1', 'user-1')).resolves.toMatchObject({ reversesEntryId: 'entry-1' });
    expect(gateway.reverseEntry).toHaveBeenLastCalledWith('entry-1', expect.any(String));
  });

  it('يستبدل مسودة القيد عبر بوابه الـHTTP', async () => {
    gateway.replaceDraft.mockResolvedValueOnce({ id: 'entry-1', entryNumber: 'JV-1', postingStatus: 'draft', lineCount: 2 });
    await expect(financialEntryService.replaceDraft('entry-1', baseEntry)).resolves.toMatchObject({ id: 'entry-1', postingStatus: 'draft' });
    expect(gateway.replaceDraft).toHaveBeenLastCalledWith('entry-1', expect.objectContaining({ postingStatus: 'draft', entryNumber: 'JV-20260827-001' }));
  });

  it('يعدل قيدًا مرحّلًا عبر دورة إلغاء الترحيل ثم الاستبدال ثم إعادة الترحيل', async () => {
    gateway.unpostEntry.mockResolvedValueOnce({ id: 'entry-1', postingStatus: 'draft', unposted: true });
    gateway.replaceDraft.mockResolvedValueOnce({ id: 'entry-1', entryNumber: 'JV-20260827-001', postingStatus: 'draft', lineCount: 2 });
    gateway.postEntry.mockResolvedValueOnce({ id: 'entry-1', postingStatus: 'posted' });

    const result = await financialEntryService.replaceLedgerEntry('entry-1', {
      entryNumber: 'JV-20260827-001', createdAt: Date.now(), description: 'قيد معدل', amount: 100, currency: 'YER', module: 'adjustment', refNumber: 'JV-20260827-001',
    }, { id: '1110-0003', curNo: 1, currency: 'YER' }, { id: '1132-0005', curNo: 1, currency: 'YER' }, 'user-1', {
      moduleId: 'module_accounting', entryTypeId: 'type_adjustment', entryCategory: 'General',
    });

    expect(result).toMatchObject({ id: 'entry-1', postingStatus: 'posted' });
    expect(gateway.unpostEntry).toHaveBeenCalledWith('entry-1');
    expect(gateway.replaceDraft).toHaveBeenCalledWith('entry-1', expect.objectContaining({ postingStatus: 'draft', entryTypeId: 'type_adjustment' }));
    expect(gateway.postEntry).toHaveBeenCalledWith('entry-1');
  });

  it('يحذف قيدًا مرحّلًا عبر إلغاء الترحيل ثم حذف المسودة', async () => {
    gateway.unpostEntry.mockResolvedValueOnce({ id: 'entry-1', postingStatus: 'draft', unposted: true });
    gateway.deleteEntry.mockResolvedValueOnce({ id: 'entry-1', deleted: true });

    await expect(financialEntryService.deleteLedgerEntry('entry-1', 'user-1')).resolves.toMatchObject({ deleted: true });
    expect(gateway.unpostEntry).toHaveBeenCalledWith('entry-1');
    expect(gateway.deleteEntry).toHaveBeenCalledWith('entry-1');
  });

  it('ترفض تسوية العهدة عبر الـAPI بلا معرف عهدة صالح', async () => {
    await expect(financialEntryService.settleCustodyAdvance('', baseEntry)).rejects.toThrow('معرف العهدة مطلوب للتسوية.');
  });
});
