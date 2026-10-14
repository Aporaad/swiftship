import { beforeEach, describe, expect, it, vi } from 'vitest';

// محاكاة عميل HTTP بدل واجهة Supabase القديمة — mock the API client instead of the legacy gateway.
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  activityLog: vi.fn(),
  createFinancialEntry: vi.fn(),
}));

vi.mock('../data/http/api-client', () => ({
  ApiClient: vi.fn(() => ({
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.del,
  })),
}));

vi.mock('./currencyService', () => {
  const currencyService = {
    getDefaultCurrency: vi.fn(async () => ({ cur_id: 1, code: 'YER', is_default: true })),
    getAllCurrencies: vi.fn(async () => []),
    getActiveCurrencies: vi.fn(async () => []),
    getLatestExchangeRates: vi.fn(async () => ({ YER: 1 })),
  };
  return { currencyService, default: currencyService, DEFAULT_RATES: { YER: 1 } };
});

vi.mock('./activityLogService', () => ({ activityLogService: { log: mocks.activityLog } }));
vi.mock('./financialEntryService', () => ({ financialEntryService: { createFromLegacyVoucher: mocks.createFinancialEntry } }));

import { financialAccountService } from './financialAccountService';
import { buildDefaultAutomaticVoucherRules } from './financialAccountVoucherRules';

const envelope = (data: unknown, meta?: { total: number }) => ({ success: true, data, ...(meta ? { meta } : {}) });
const notFoundError = () => Object.assign(new Error('غير موجود'), { code: 'ENTITY_NOT_FOUND' });

/**
 * يوجّه استجابات GET حسب بداية المسار — الأطول أولاً حتى لا يبتلع /accounts المسار /accounts/by-entity.
 * Routes GET responses by path prefix, longest first.
 */
function routeResponses(routes: Array<[string, unknown]>) {
  mocks.get.mockImplementation(async (path: string) => {
    const matched = routes.find(([prefix]) => String(path).startsWith(prefix));
    if (!matched) return envelope([]);
    if (matched[1] instanceof Error) throw matched[1];
    return matched[1];
  });
}

/** يحاكي استجابة الخادم للإنشاء: يعيد الصف نفسه مع أعمدة التدقيق. */
function echoCreatedRow() {
  mocks.post.mockImplementation(async (_path: string, body: any) =>
    envelope({ ...body, balance: 0, debitTotal: 0, creditTotal: 0, isActive: true, createdAt: 0, updatedAt: 0 }),
  );
}

describe('إنشاء الحسابات التابعة', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeResponses([
      ['/api/v1/finance/accounts/by-entity', envelope([])],
      ['/api/v1/finance/hierarchy/', envelope([])],
      ['/api/v1/finance/accounts', envelope([], { total: 0 })],
    ]);
    echoCreatedRow();
    mocks.patch.mockResolvedValue(envelope({}));
  });

  it.each([
    ['source', 'src-1', 'Noon', '2140', 'Liability'],
    ['shipping_company', 'carrier-1', 'DHL', '2150', 'Liability'],
    ['asset', 'asset-1', 'Van 01', '1210', 'Asset'],
  ] as const)('ينشئ حساب %s في القسم %s عبر API', async (entityType, entityId, entityName, prefix, type) => {
    const account = await financialAccountService.createAccountForEntity(
      entityType, entityId, entityName, 'YER', undefined,
      { accountPrefix: prefix, parentCode: prefix, accountType: type, updateEntity: false },
    );

    expect(account).toMatchObject({
      id: `${prefix}-0001`, accountCode: `${prefix}-0001`, accountPrefix: prefix,
      entityType, entityId, entityName, type, balance: 0,
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [path, body] = mocks.post.mock.calls[0];
    expect(path).toBe('/api/v1/finance/accounts');
    // المخطط الخلفي strict: لا تُرسل مفاتيح لا يعرفها (code/createdAt/lastRecalculatedAt).
    expect(body).toMatchObject({ accountId: `${prefix}-0001`, accountCode: `${prefix}-0001`, accountSeq: 1 });
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('createdAt');
    expect(body).not.toHaveProperty('lastRecalculatedAt');
    // updateEntity=false → لا محاولة لربط الحساب بسجل الكيان.
    expect(mocks.patch).not.toHaveBeenCalled();
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

  it('يربط الحساب بسجل الكيان عندما يُطلب ذلك', async () => {
    mocks.patch.mockResolvedValue(envelope({ customerId: 'cust-9' }));
    await financialAccountService.createAccountForEntity('customer', 'cust-9', 'عميل جديد', 'YER', undefined);

    const [path, body] = mocks.patch.mock.calls[0];
    expect(path).toBe('/api/v1/customers/cust-9');
    expect(body).toEqual({ accountId: '1130-0001' });
  });

  it('يحدّث الحساب القائم بدل إنشاء حساب مكرر للكيان نفسه', async () => {
    routeResponses([
      ['/api/v1/finance/accounts/by-entity', envelope([{ accountId: '2120-0004', accountCode: '2120-0004', entityType: 'courier', entityId: 'cour-4', currency: 'YER' }])],
      ['/api/v1/finance/hierarchy/', envelope([])],
      ['/api/v1/finance/accounts', envelope([], { total: 0 })],
    ]);
    mocks.patch.mockResolvedValue(envelope({ accountId: '2120-0004', accountCode: '2120-0004', entityName: 'الاسم الجديد', currency: 'USD', type: 'Liability' }));

    const account = await financialAccountService.createAccountForEntity(
      'courier', 'cour-4', 'الاسم الجديد', 'USD', undefined, { accountType: 'Liability', updateEntity: false },
    );

    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.patch).toHaveBeenCalledWith('/api/v1/finance/accounts/2120-0004', {
      entityName: 'الاسم الجديد', currency: 'USD', type: 'Liability',
    });
    expect(account).toMatchObject({ id: '2120-0004', entityName: 'الاسم الجديد' });
  });

  it('لا يعيد استعمال كود حساب معطّل عند توليد المعرفات', async () => {
    routeResponses([
      ['/api/v1/finance/accounts/by-entity', envelope([])],
      ['/api/v1/finance/hierarchy/', envelope([])],
      ['/api/v1/finance/accounts', envelope([
        { accountId: '2120-0001', accountCode: '2120-0001', accountPrefix: '2120', accountNumber: '0001', isActive: false },
      ], { total: 1 })],
    ]);

    const identifiers = await financialAccountService.getNextAccountIdentifiers('courier');

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/finance/accounts', expect.objectContaining({ includeInactive: true }));
    expect(identifiers.accountCode).toBe('2120-0002');
    expect(identifiers.accountNumber).toBe('0002');
  });
});

describe('قراءة الحسابات', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يوحّد أسماء الأعمدة القادمة من API إلى شكل النظام', async () => {
    routeResponses([
      ['/api/v1/finance/accounts/1130-0007', envelope({
        accountId: '1130-0007', accountCode: '1130-0007', accountNameAr: 'عميل', accountNameEn: 'Customer',
        currencyNo: 3, subAccountId: 'sub-113', entityType: 'customer', entityId: 'cust-7',
        balance: '150.5', isActive: true,
      })],
    ]);

    const account = await financialAccountService.getAccountById('1130-0007');

    expect(account).toMatchObject({
      id: '1130-0007', accNameAr: 'عميل', accNameEn: 'Customer', curNo: 3, accSubId: 'sub-113', balance: 150.5,
    });
  });

  it('يجسر المعرفات التاريخية المكتوبة بصيغة acc_ إلى الكود المحاسبي', async () => {
    routeResponses([
      ['/api/v1/finance/accounts/acc_1130_0007', notFoundError()],
      ['/api/v1/finance/accounts?search', envelope([{ accountId: '1130-0007', accountCode: '1130-0007' }], { total: 1 })],
      ['/api/v1/finance/accounts', envelope([{ accountId: '1130-0007', accountCode: '1130-0007' }], { total: 1 })],
    ]);

    const account = await financialAccountService.getAccountById('acc_1130_0007');

    expect(account?.id).toBe('1130-0007');
  });

  it('يتبع خريطة ترحيل المعرفات ثم يعيد null عند غياب الحساب', async () => {
    routeResponses([
      ['/api/v1/finance/accounts/old-1', notFoundError()],
      ['/api/v1/finance/account-id-map', envelope({ oldAccountId: 'old-1', newAccountId: '1130-0007' })],
      ['/api/v1/finance/accounts/1130-0007', envelope({ accountId: '1130-0007', accountCode: '1130-0007' })],
      ['/api/v1/finance/accounts/by-entity', envelope([])],
    ]);

    expect((await financialAccountService.getAccountById('old-1'))?.id).toBe('1130-0007');

    routeResponses([
      ['/api/v1/finance/accounts/missing-9', notFoundError()],
      ['/api/v1/finance/account-id-map', notFoundError()],
      ['/api/v1/finance/accounts', envelope([], { total: 0 })],
      ['/api/v1/finance/accounts/by-entity', envelope([])],
    ]);
    expect(await financialAccountService.getAccountById('missing-9')).toBeNull();
  });

  it('يصفّي حسابات الكيان حسب النوع', async () => {
    routeResponses([
      ['/api/v1/finance/accounts/by-entity', envelope([
        { accountId: '2120-0001', accountCode: '2120-0001', entityType: 'courier', entityId: 'cour-1' },
        { accountId: '1130-0001', accountCode: '1130-0001', entityType: 'customer', entityId: 'cour-1' },
      ])],
    ]);

    const account = await financialAccountService.getAccountByEntityId('cour-1', 'customer');

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/finance/accounts/by-entity', { entityId: 'cour-1' });
    expect(account?.id).toBe('1130-0001');
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
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.activityLog).toHaveBeenCalledWith('financial_transaction', 'الصندوق / عميل', expect.any(Object));
  });
});

describe('إعادة احتساب الأرصدة', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يفوض إعادة الاحتساب إلى قاعدة البيانات ويعيد الرصيد المحدَّث', async () => {
    mocks.get
      .mockResolvedValueOnce(envelope({ accountId: '1110-0003', accountCode: '1110-0003', balance: 10 }))
      .mockResolvedValueOnce(envelope({ accountId: '1110-0003', accountCode: '1110-0003', balance: 75 }));
    mocks.post.mockResolvedValue(envelope({ result: { success: true, recalculatedCount: 1 } }));

    await expect(financialAccountService.recalculateAndSyncBalance('1110-0003')).resolves.toBe(75);
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/finance/accounts/recalculate', { accountIds: ['1110-0003'] });
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('يعيد صفر عند غياب الحساب بدل إنشاء رصيد وهمي', async () => {
    mocks.get.mockRejectedValueOnce(notFoundError());

    await expect(financialAccountService.recalculateAndSyncBalance('missing-1')).resolves.toBe(0);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('يحتسب كل الأرصدة بنداء واحد ويعيد ملخص قاعدة البيانات', async () => {
    mocks.post.mockResolvedValue(envelope({ result: { success: true, recalculatedCount: 42 } }));

    await expect(financialAccountService.recalculateAllBalances()).resolves.toEqual({ processed: 42, errors: 0 });
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/finance/accounts/recalculate', {});
  });
});

describe('سجل الرواتب', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue(envelope({ salaryHistoryId: 'sal-1' }));
  });

  it('يرسل الشهر نصاً وتاريخ الصرف ISO دون مفاتيح يرفضها المخطط الصارم', async () => {
    const voucherCode = await financialAccountService.recordSalaryPayment({
      employeeId: 'emp-1', employeeName: 'موظف', accountId: '2130-0001', accountCode: '2130-0001',
      amount: 50000, currency: 'YER', salaryMonth: '2026-10', notes: 'راتب أكتوبر', createdByName: 'Admin',
    });

    expect(voucherCode.startsWith('SAL-202610-')).toBe(true);
    const [path, body] = mocks.post.mock.calls[0];
    expect(path).toBe('/api/v1/finance/salary-history');
    expect(body).toMatchObject({ employeeId: 'emp-1', amount: 50000, month: '2026-10', status: 'Paid' });
    expect(body.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body).not.toHaveProperty('salaryMonth');
    expect(body).not.toHaveProperty('createdByUid');
    expect(body).not.toHaveProperty('createdAt');
    expect(mocks.activityLog).toHaveBeenCalledWith('salary_payment', 'موظف', expect.objectContaining({ salaryMonth: '2026-10' }));
  });

  it('يفك الحقول الوصفية المخزنة في extra ويعيد salaryMonth للواجهة', async () => {
    routeResponses([
      ['/api/v1/finance/salary-history', envelope([{
        salaryHistoryId: 'sal-1', employeeId: 'emp-1', amount: 50000, currency: 'YER', month: '2026-10',
        voucherCode: 'SAL-202610-1234', status: 'Paid', paidAt: '2026-10-05T10:00:00Z',
        extra: { employeeName: 'موظف', accountCode: '2130-0001', createdByName: 'Admin' },
      }], { total: 1 })],
    ]);

    const [row] = await financialAccountService.getSalaryHistory('emp-1');

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/finance/salary-history', expect.objectContaining({ employeeId: 'emp-1' }));
    expect(row).toMatchObject({ id: 'sal-1', employeeName: 'موظف', salaryMonth: '2026-10', accountCode: '2130-0001' });
    expect(row).not.toHaveProperty('extra');
  });

  it('يحدّث الراتب الشهري عبر مسار الموظفين في API', async () => {
    mocks.patch.mockResolvedValue(envelope({ employeeId: 'emp-1' }));

    await financialAccountService.updateMonthlySalary('emp-1', 75000);

    expect(mocks.patch).toHaveBeenCalledWith('/api/v1/operations/employees/emp-1', { monthlySalary: 75000 });
  });
});

describe('قواعد القيود التلقائية في الإعدادات', () => {
  const defaultRules = buildDefaultAutomaticVoucherRules();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patch.mockResolvedValue(envelope({ settingId: 'automatic_voucher_rules' }));
  });

  it('يبذر القواعد الناقصة فقط ويحفظها في وثيقة الإعدادات', async () => {
    routeResponses([
      ['/api/v1/settings/automatic_voucher_rules', envelope({
        settingId: 'automatic_voucher_rules',
        category: 'automatic_voucher_rules',
        settings: { data: [{ id: 'order_charge', isActive: true, nameAr: 'قيد محفوظ' }] },
      })],
    ]);

    const rules = await financialAccountService.ensureAutomaticVoucherRules();

    expect(rules[0]).toMatchObject({ id: 'order_charge', nameAr: 'قيد محفوظ' });
    expect(rules).toHaveLength(defaultRules.length);
    const [path, body] = mocks.patch.mock.calls[0];
    expect(path).toBe('/api/v1/settings/automatic_voucher_rules');
    expect(body.settings.data).toHaveLength(defaultRules.length);
  });

  it('لا يكتب شيئاً عندما تكون كل القواعد مخزنة', async () => {
    routeResponses([
      ['/api/v1/settings/automatic_voucher_rules', envelope({
        settingId: 'automatic_voucher_rules',
        settings: { data: defaultRules.map((rule: any) => ({ ...rule, isActive: false })) },
      })],
    ]);

    const rules = await financialAccountService.ensureAutomaticVoucherRules();

    expect(rules.every((rule: any) => rule.isActive === false)).toBe(true);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('يتابع العمل بالقواعد المدموجة عندما يرفض الخادم الحفظ لعدم وجود صلاحية', async () => {
    routeResponses([['/api/v1/settings/automatic_voucher_rules', envelope({ settings: { data: [] } })]]);
    mocks.patch.mockRejectedValue(Object.assign(new Error('لا تملك صلاحية'), { code: 'FORBIDDEN' }));

    await expect(financialAccountService.ensureAutomaticVoucherRules()).resolves.toHaveLength(defaultRules.length);
  });
});
