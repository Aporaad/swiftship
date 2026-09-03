import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  setDoc: vi.fn(async () => undefined),
  updateDoc: vi.fn(async () => undefined),
  activityLog: vi.fn(),
  createFinancialEntry: vi.fn(),
  getDoc: vi.fn(),
  recalculateHierarchy: vi.fn(),
}));

vi.mock('../lib/supabase-firebase-adapter', () => ({
  collection: vi.fn((_: unknown, name: string) => ({ name })),
  getDocs: mocks.getDocs,
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  doc: vi.fn((_: unknown, collectionName: string, id: string) => ({ collectionName, id })),
  query: vi.fn((...constraints: unknown[]) => ({ constraints })),
  where: vi.fn((...constraint: unknown[]) => ({ constraint })),
  orderBy: vi.fn(),
  increment: vi.fn(),
  getDoc: mocks.getDoc,
  writeBatch: vi.fn(),
  db: {},
  auth: {},
  supabase: { from: vi.fn(), rpc: mocks.recalculateHierarchy },
}));

vi.mock('./currencyService', () => ({
  currencyService: { getLatestExchangeRates: vi.fn() },
  DEFAULT_RATES: { YER: 1 },
}));

vi.mock('./activityLogService', () => ({ activityLogService: { log: mocks.activityLog } }));
vi.mock('./financialEntryService', () => ({ financialEntryService: { createFromLegacyVoucher: mocks.createFinancialEntry } }));

import { financialAccountService } from './financialAccountService';

describe('إنشاء الحسابات التابعة', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocs.mockResolvedValue({ empty: true, docs: [] });
  });

  it.each([
    ['source', 'src-1', 'Noon', '2140', 'Liability'],
    ['shipping_company', 'carrier-1', 'DHL', '2150', 'Liability'],
    ['asset', 'asset-1', 'Van 01', '1210', 'Asset'],
  ] as const)('ينشئ حساب %s في القسم %s', async (entityType, entityId, entityName, prefix, type) => {
    const account = await financialAccountService.createAccountForEntity(
      entityType, entityId, entityName, 'YER', undefined,
      { accountPrefix: prefix, parentCode: prefix, accountType: type, updateEntity: false },
    );

    expect(account).toMatchObject({
      id: `${prefix}-0001`, accountCode: `${prefix}-0001`, accountPrefix: prefix,
      entityType, entityId, entityName, type, balance: 0,
    });
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it.each([
    ['employee', 'emp-1', 'موظف تجريبي', 'Liability'],
    ['courier', 'courier-1', 'مندوب تجريبي', 'Liability'],
    ['asset', 'asset-2', 'مركبة تجريبية', 'Asset'],
  ] as const)('يستخدم النوع الافتراضي الصحيح لحساب %s', async (entityType, entityId, entityName, type) => {
    const account = await financialAccountService.createAccountForEntity(
      entityType,
      entityId,
      entityName,
      'YER',
      undefined,
      { updateEntity: false },
    );

    expect(account?.type).toBe(type);
  });
});

describe('تسجيل القيد الذري', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يمرر القيد إلى إجراء واحد ذري ولا يكتب الجداول القديمة مباشرة', async () => {
    vi.spyOn(financialAccountService, 'getAccountById')
      .mockResolvedValueOnce({ id: '1110-0003', accountCode: '1110-0003', accountNumber: '0003', accountPrefix: '1110', entityType: 'system', entityId: 'cash', entityName: 'الصندوق', currency: 'YER', curNo: 1, balance: 0, debitTotal: 0, creditTotal: 0, isActive: true, createdAt: 0, updatedAt: 0, accSubId: '111', type: 'Asset' })
      .mockResolvedValueOnce({ id: '1132-0005', accountCode: '1132-0005', accountNumber: '0005', accountPrefix: '1132', entityType: 'customer', entityId: 'customer-1', entityName: 'عميل', currency: 'YER', curNo: 1, balance: 0, debitTotal: 0, creditTotal: 0, isActive: true, createdAt: 0, updatedAt: 0, accSubId: '113', type: 'Asset' });
    mocks.createFinancialEntry.mockResolvedValue({ id: 'entry-v2-1' });

    await expect(financialAccountService.recordJournalEntry({
      entryNumber: 'JV-1', createdAt: Date.now(), description: 'قيد اختبار',
      debitAccountId: '1110-0003', debitAccountName: 'الصندوق', debitAccountCode: '1110-0003',
      creditAccountId: '1132-0005', creditAccountName: 'عميل', creditAccountCode: '1132-0005',
      amount: 100, currency: 'YER', amountDebitCurrency: 100, amountCreditCurrency: 100,
      module: 'adjustment', refNumber: 'JV-1', createdByUid: 'user-1', createdByName: 'Admin',
    })).resolves.toBe('entry-v2-1');

    expect(mocks.createFinancialEntry).toHaveBeenCalledTimes(1);
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.activityLog).toHaveBeenCalledWith('financial_transaction', 'الصندوق / عميل', expect.any(Object));
  });
});

describe('إعادة احتساب الأرصدة', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يسوي الحساب الديناميكي القابض المختار للدفع بشكل صحيح', () => {
    const resolveAccount = (financialAccountService as any).resolveAutomaticVoucherAccount.bind(financialAccountService);

    const resolved = resolveAccount(
      { id: 'payment_account_selected', code: '1110', type: 'dynamic' },
      { sys_cash_account: '1110-0003' },
      { cashAccountId: '1110-0005' },
      {}
    );

    expect(resolved).toEqual({ id: '1110-0005', code: '' });
  });

  it('يفوض إعادة الاحتساب إلى قاعدة البيانات ولا يقرأ account_transactions في المتصفح', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ id: '1110-0003' }) });
    mocks.recalculateHierarchy.mockResolvedValue({ error: null });
    vi.spyOn(financialAccountService, 'getAccountById').mockResolvedValue({
      id: '1110-0003', accountCode: '1110-0003', accountNumber: '0003', accountPrefix: '1110',
      entityType: 'system', entityId: 'cash', entityName: 'الصندوق', currency: 'YER', curNo: 1,
      balance: 75, debitTotal: 0, creditTotal: 0, isActive: true, createdAt: 0, updatedAt: 0, accSubId: '111', type: 'Asset',
    });

    await expect(financialAccountService.recalculateAndSyncBalance('1110-0003')).resolves.toBe(75);
    expect(mocks.recalculateHierarchy).toHaveBeenCalledWith('recalculate_accounting_hierarchy', { p_account_id: '1110-0003' });
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
});
