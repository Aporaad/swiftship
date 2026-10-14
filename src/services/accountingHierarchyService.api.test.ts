import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  getDefaultCurrency: vi.fn(),
  getAllCurrencies: vi.fn(),
}));

vi.mock('../data/http/api-client', () => ({
  ApiClient: class {
    get = mocks.get;
  },
}));

vi.mock('./currencyService', () => ({
  default: {
    getDefaultCurrency: mocks.getDefaultCurrency,
    getAllCurrencies: mocks.getAllCurrencies,
  },
}));

import { accountingHierarchyService } from './accountingHierarchyService';

/** يوجّه الاستجابة حسب المسار المطلوب مع غلاف {success,data} الحقيقي. */
const envelope = (data: unknown) => ({ success: true, data });
const routeResponses = (responses: Record<string, unknown>) => {
  mocks.get.mockImplementation(async (path: string) => {
    if (!(path in responses)) throw new Error(`unexpected API path: ${path}`);
    return envelope(responses[path]);
  });
};

describe('accountingHierarchyService عبر alx_api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يقرأ جذر الشجرة والحسابات الجزئية من مساري hierarchy ولا يعتمد على Firestore', async () => {
    routeResponses({
      '/api/v1/finance/hierarchy/account': [{ nodeId: 'ast_1', accountCode: '1' }],
      '/api/v1/finance/hierarchy/acc-sub': [],
    });

    expect(await accountingHierarchyService.hasHierarchyStructure()).toBe(false);
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/finance/hierarchy/account', { limit: 1 });
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/finance/hierarchy/acc-sub', { limit: 1 });
  });

  it('يحوّل أكواد العملات إلى أرقامها عبر خدمة العملات فقط', async () => {
    mocks.getAllCurrencies.mockResolvedValue([
      { cur_id: 1, code: 'YER' },
      { cur_id: 3, code: 'usd' },
    ]);
    mocks.getDefaultCurrency.mockResolvedValue({ cur_id: 1, code: 'YER' });

    expect(await accountingHierarchyService.getCurrencyIdByCode('USD')).toBe(3);
    expect(await accountingHierarchyService.getCurrencyIdByCode('')).toBe(1);
    expect(await accountingHierarchyService.getCurrencyIdByCode('EUR')).toBeUndefined();
  });

  it('يحدد مجموعة الترحيل الخاصة بالكيان ويتجاهل المجموعات المعطلة أو المانعة للحسابات المباشرة', async () => {
    routeResponses({
      '/api/v1/finance/hierarchy/acc-sub-group': [
        { nodeId: 'dacc_off', accountCode: '1131', accSubId: 'sub_113', entityType: 'customer', isActive: false, allowsDirectAccounts: true, curNo: 1 },
        { nodeId: 'dacc_locked', accountCode: '1132', accSubId: 'sub_113', entityType: 'customer', isActive: true, allowsDirectAccounts: false, curNo: 1 },
        { nodeId: 'dacc_ok', accountCode: '1133', accSubId: 'sub_113', entityType: 'customer', isActive: true, allowsDirectAccounts: true, curNo: 2 },
      ],
    });

    expect(await accountingHierarchyService.getEntityPostingLocation('customer')).toEqual({
      accSubId: 'sub_113',
      groupId: 'dacc_ok',
      accountCode: '1133',
      currencyId: 2,
    });

    routeResponses({ '/api/v1/finance/hierarchy/acc-sub-group': [] });
    expect(await accountingHierarchyService.getEntityPostingLocation('courier')).toBeNull();
  });

  it('يحسب التسلسل التالي من الحسابات الشقيقة داخل المجموعة نفسها', async () => {
    routeResponses({
      '/api/v1/finance/accounts': [
        { accountId: 'acc_1', accountCode: '1133-0004', accountSeq: 4, groupId: 'dacc_ok', subAccountId: 'sub_113' },
        { accountId: 'acc_2', accountCode: '1140-0009', accountSeq: 9, groupId: 'dacc_other', subAccountId: 'sub_114' },
      ],
    });

    expect(await accountingHierarchyService.getNextAccountSequence({
      accSubId: 'sub_113',
      groupId: 'dacc_ok',
      accountCode: '1133',
    })).toBe(5);
  });

  it('يتجاهل الربط الافتراضي المعطّل أو الفارغ ويعيد معرّف الحساب الافتراضي النشط', async () => {
    routeResponses({
      '/api/v1/finance/default-accounts': [
        { defaultAccountId: 'dacc_1', defaultKey: 'sys_profit_account', accountId: 'acc_9', isActive: false },
        { defaultAccountId: 'dacc_2', defaultKey: 'sys_delivery_cost', accountId: '', isActive: true },
        { defaultAccountId: 'dacc_3', defaultKey: 'sys_sourcing_cost', accountId: 'acc_7', accNameAr: 'تكلفة الشحن', accNameEn: 'Sourcing cost', curNo: 1, isActive: true },
      ],
    });

    expect(await accountingHierarchyService.getDefaultAccount('sys_profit_account')).toBeNull();
    expect(await accountingHierarchyService.getDefaultAccount('sys_delivery_cost')).toBeNull();
    expect(await accountingHierarchyService.getDefaultAccount('sys_sourcing_cost')).toEqual({
      id: 'dacc_3',
      defaultKey: 'sys_sourcing_cost',
      accountId: 'acc_7',
      accNameAr: 'تكلفة الشحن',
      accNameEn: 'Sourcing cost',
      curNo: 1,
      isActive: true,
    });
  });

  it('يحلّ الحساب الافتراضي إلى حساب قابل للقيد ويعيد null عند غيابه', async () => {
    routeResponses({
      '/api/v1/finance/default-accounts': [
        { defaultAccountId: 'dacc_3', defaultKey: 'sys_sourcing_cost', accountId: 'acc_7', isActive: true },
      ],
      '/api/v1/finance/accounts/acc_7': { accountId: 'acc_7', accountCode: '5110-0001', isActive: true },
    });

    expect(await accountingHierarchyService.resolveDefaultPostingAccount('sys_sourcing_cost')).toMatchObject({
      id: 'acc_7',
      accountCode: '5110-0001',
    });

    mocks.get.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/v1/finance/accounts/')) {
        throw Object.assign(new Error('missing'), { code: 'ENTITY_NOT_FOUND' });
      }
      return envelope([{ defaultAccountId: 'dacc_3', defaultKey: 'sys_sourcing_cost', accountId: 'acc_7', isActive: true }]);
    });
    expect(await accountingHierarchyService.resolveDefaultPostingAccount('sys_sourcing_cost')).toBeNull();
  });

  it('يعيد نشر أخطاء الـ API غير المتوقعة بدل إخفائها', async () => {
    mocks.get.mockRejectedValue(Object.assign(new Error('forbidden'), { code: 'AUTH_FORBIDDEN' }));
    await expect(accountingHierarchyService.hasHierarchyStructure()).rejects.toThrow('forbidden');
  });
});
