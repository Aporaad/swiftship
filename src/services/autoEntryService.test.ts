import { beforeEach, describe, expect, it, vi } from 'vitest';

// محاكاة عميل HTTP بدل واجهة Supabase القديمة — mock the API client instead of the legacy gateway.
const mocks = vi.hoisted(() => {
  const get = vi.fn();
  const post = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return { get, post, patch, del };
});

vi.mock('../data/http/api-client', () => ({
  ApiClient: vi.fn(() => ({
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.del,
  })),
}));

vi.mock('./financialAccountService', () => ({
  financialAccountService: {
    getExchangeRates: vi.fn(),
    convertToTargetCurrency: vi.fn(),
    triggerAutomaticVoucher: vi.fn(),
    getAccountById: vi.fn(),
  },
}));

vi.mock('./financialEntryService', () => ({
  financialEntryService: {
    createCompoundFromLegacyVoucher: vi.fn(),
  },
}));

import { DEFAULT_AUTO_ENTRIES, autoEntryService } from './autoEntryService';

describe('autoEntryService.saveAutoEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patch.mockResolvedValue({ success: true, data: {} });
    mocks.post.mockResolvedValue({ success: true, data: {} });
    mocks.del.mockResolvedValue({ success: true, data: {} });
  });

  it('clears a previously stored currency and saves no currency key for the order-default option', async () => {
    await autoEntryService.saveAutoEntry({
      id: 'rule-default-currency',
      statusId: 2,
      nameAr: 'قيد اختبار',
      nameEn: 'Test rule',
      isActive: true,
      amountSource: 'order_total',
      amountSources: ['order_total'],
      debitAccount: { id: 'customer_linked', code: '1130', name: 'Customer', type: 'dynamic' },
      creditAccount: { id: 'sys_profit_account', code: '4000', name: 'Profit', type: 'system' },
      descriptionTempAr: 'اختبار',
      descriptionTempEn: 'Test',
      currency: undefined,
    });

    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [path, payload] = mocks.patch.mock.calls[0];
    expect(path).toBe('/api/v1/finance/auto-entry-rules/rule-default-currency');
    // PATCH يستبدل الصف كاملًا؛ غياب مفتاح currency يعني مسحها في الخادم.
    expect(payload).not.toHaveProperty('currency');
    expect(payload).toMatchObject({ statusId: 2, amountSources: ['order_total'] });
    expect(payload.debitAccount).toBe(JSON.stringify({ id: 'customer_linked', code: '1130', name: 'Customer', type: 'dynamic' }));
  });

  it('falls back to create with the same id when the rule is not stored yet', async () => {
    mocks.patch.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENTITY_NOT_FOUND' }));
    await autoEntryService.saveAutoEntry({
      id: 'new-rule',
      statusId: 2,
      nameAr: 'قاعدة',
      nameEn: 'Rule',
      isActive: true,
      amountSource: 'order_total',
      debitAccount: { id: 'a', code: '', name: '', type: 'dynamic' },
      creditAccount: { id: 'b', code: '', name: '', type: 'dynamic' },
      descriptionTempAr: 'وصف',
      descriptionTempEn: 'desc',
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [path, payload] = mocks.post.mock.calls[0];
    expect(path).toBe('/api/v1/finance/auto-entry-rules');
    expect(payload).toMatchObject({ autoEntryId: 'new-rule' });
  });

  it('deletes through the API path', async () => {
    await autoEntryService.deleteAutoEntry('rule-1');
    expect(mocks.del).toHaveBeenCalledWith('/api/v1/finance/auto-entry-rules/rule-1');
  });
});

describe('autoEntryService.ensureAutoEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ success: true, data: {} });
  });

  it('seeds the default rules with stable ids when the table is empty', async () => {
    mocks.get
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: [] });
    await autoEntryService.ensureAutoEntries();
    expect(mocks.post).toHaveBeenCalledTimes(DEFAULT_AUTO_ENTRIES.length);
    const seededIds = mocks.post.mock.calls.map(([, payload]) => payload.autoEntryId);
    expect(seededIds).toEqual(DEFAULT_AUTO_ENTRIES.map((rule) => rule.id));
  });

  it('returns stored rules without seeding when the table is populated', async () => {
    mocks.get.mockResolvedValueOnce({
      success: true,
      data: [{
        autoEntryId: 'order_charge',
        statusId: 2,
        nameAr: 'قيد',
        nameEn: 'Charge',
        isActive: true,
        amountSource: 'order_total',
        amountSources: ['order_total'],
        debitAccount: JSON.stringify({ id: 'customer_linked', code: '1130', name: 'Customer', type: 'dynamic' }),
        creditAccount: JSON.stringify({ id: 'sys_profit_account', code: '4000', name: 'Profit', type: 'system' }),
        descriptionTemplateAr: 'وصف',
        descriptionTemplateEn: 'desc',
      }],
    });
    const rules = await autoEntryService.ensureAutoEntries();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('order_charge');
    expect(rules[0].debitAccount).toMatchObject({ id: 'customer_linked', type: 'dynamic' });
    expect(rules[0].descriptionTempAr).toBe('وصف');
  });
});
