import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  setDoc: vi.fn(async () => undefined),
  updateDoc: vi.fn(async () => undefined),
  activityLog: vi.fn(),
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
  getDoc: vi.fn(),
  writeBatch: vi.fn(),
  db: {},
  auth: {},
}));

vi.mock('./currencyService', () => ({
  currencyService: { getLatestExchangeRates: vi.fn() },
  DEFAULT_RATES: { YER: 1 },
}));

vi.mock('./activityLogService', () => ({ activityLogService: { log: mocks.activityLog } }));

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
      id: `acc_${prefix}-0001`, accountCode: `${prefix}-0001`, accountPrefix: prefix,
      parentCode: prefix, entityType, entityId, entityName, type, balance: 0,
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
