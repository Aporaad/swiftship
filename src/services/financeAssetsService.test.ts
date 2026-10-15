import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  readAllFinanceRows: vi.fn(),
  createAccountForEntity: vi.fn(),
}));

vi.mock('./financeApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./financeApi')>();
  return {
    ...actual,
    readAllFinanceRows: mocks.readAllFinanceRows,
    financeApiClient: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.delete },
  };
});

vi.mock('./financialAccountService', () => ({
  financialAccountService: { createAccountForEntity: mocks.createAccountForEntity },
}));

import { buildAssetId, createMaintenanceLog, financeAssetsService } from './financeAssetsService';

const assetRow = {
  assetId: 'assetAST-01',
  assetCode: 'AST-01',
  nameAr: 'شاحنة',
  nameEn: 'Truck',
  category: 'Vehicles',
  type: 'Fixed',
  cost: '1500000',
  currency: 'YER',
  purchaseDate: '2026-01-05',
  assignedCourierId: null,
  assignedCourierName: null,
  status: 'Active',
  notes: null,
  maintenanceLogs: [
    { logId: 'MNT-1', cost: 250, currency: 'USD', type: 'Repair', notes: 'n', doneBy: 'd', date: '2026-02-01', createdAt: 1 },
  ],
  accountId: 'acc-1',
  accountCode: '1210-0001',
  isActive: true,
};

const sampleAsset = {
  id: 'assetAST-01',
  assetCode: 'AST-01',
  nameAr: 'شاحنة',
  nameEn: 'Truck',
  category: 'Vehicles' as const,
  type: 'Fixed' as const,
  cost: 1500000,
  currency: 'YER',
  purchaseDate: '2026-01-05',
  assignedCourierId: null,
  assignedCourierName: null,
  status: 'Active' as const,
  notes: '',
  maintenanceLogs: [
    { logId: 'MNT-1', cost: 250, currency: 'USD', type: 'Repair' as const, notes: 'n', doneBy: 'd', date: '2026-02-01', createdAt: 1 },
  ],
  isActive: true,
  financialAccountId: 'acc-1',
  financialAccountCode: '1210-0001',
};

describe('خدمة الأصول المالية', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يقرأ الأصول من alx_api ويطبّع الحقول وسجلات الصيانة كصفوف ابنة', async () => {
    mocks.readAllFinanceRows.mockResolvedValue([assetRow, { assetCode: 'بلا معرف' }]);

    await expect(financeAssetsService.list()).resolves.toEqual([sampleAsset]);
    expect(mocks.readAllFinanceRows).toHaveBeenCalledWith('/api/v1/finance/assets');
  });

  it('يرفض سجلات الصيانة المخزّنة كنص أو jsonb فلا تتحول إلى صفوف', async () => {
    // لا حقول جامعة: السجل النصي ليس صف صيانة ولا يُقرأ مطلقًا.
    // A text/jsonb payload is not a child row and must never be parsed into the view model.
    mocks.readAllFinanceRows.mockResolvedValue([
      { ...assetRow, maintenanceLogs: '[{"logId":"MNT-9","cost":1}]' },
    ]);

    const [asset] = await financeAssetsService.list();
    expect(asset?.maintenanceLogs).toEqual([]);
  });

  it('يرفض التسجيل بلا رمز أو أسماء أو تكلفة موجبة', async () => {
    const base = {
      assetCode: 'AST-02',
      nameAr: 'جهاز',
      nameEn: 'Scanner',
      category: 'Inspection' as const,
      type: 'Fixed' as const,
      cost: '500',
      currency: 'YER',
      purchaseDate: '2026-03-01',
      status: 'Active' as const,
    };

    await expect(financeAssetsService.register({ ...base, assetCode: '   ' })).rejects.toThrow('رمز الأصل مطلوب');
    await expect(financeAssetsService.register({ ...base, nameEn: '' })).rejects.toThrow('اسم الأصل مطلوب');
    await expect(financeAssetsService.register({ ...base, cost: 0 })).rejects.toThrow('أكبر من صفر');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('ينشئ الحساب المالي للأصل قبل كتابة الصف ويربط مرجعه', async () => {
    mocks.createAccountForEntity.mockResolvedValue({ id: 'acc-9', accountCode: '1220-0007' });
    mocks.post.mockResolvedValue({ success: true, data: { ...assetRow, assetId: 'assetAST-02', accountCode: '1220-0007' } });

    const created = await financeAssetsService.register({
      assetCode: 'AST-02',
      nameAr: 'جهاز تفتيش',
      nameEn: 'Scanner',
      category: 'Inspection',
      type: 'Fixed',
      cost: '500',
      currency: 'USD',
      purchaseDate: '2026-03-01',
      assignedCourierId: 'c-1',
      assignedCourierName: 'مندوب',
      status: 'Active',
      notes: '',
    });

    expect(mocks.createAccountForEntity).toHaveBeenCalledWith(
      'asset',
      'assetAST-02',
      'AST-02 — جهاز تفتيش',
      'USD',
      undefined,
      expect.objectContaining({ accountPrefix: '1220', parentCode: '1220', accountType: 'Asset', updateEntity: false }),
    );
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/finance/assets', expect.objectContaining({
      assetId: 'assetAST-02',
      assetCode: 'AST-02',
      cost: 500,
      currency: 'USD',
      accountId: 'acc-9',
      accountCode: '1220-0007',
      maintenanceLogs: [],
      isActive: true,
    }));
    expect(created.id).toBe('assetAST-02');
  });

  it('يحذف الأصل عبر DELETE بمعرّف مرمّز', async () => {
    mocks.delete.mockResolvedValue({ success: true, data: { deleted: true } });

    await financeAssetsService.remove('asset AST/01');

    expect(mocks.delete).toHaveBeenCalledWith('/api/v1/finance/assets/asset%20AST%2F01');
    await expect(financeAssetsService.remove('  ')).rejects.toThrow('معرّف الأصل مطلوب');
  });

  it('يضيف سجل الصيانة إلى القائمة الحالية ولا يمسح السجلات السابقة', async () => {
    mocks.patch.mockResolvedValue({ success: true, data: assetRow });
    const log = createMaintenanceLog({ cost: '300', currency: 'YER', type: 'Preventive', date: '2026-04-01', doneBy: 'ورشة', notes: '' });

    await financeAssetsService.appendMaintenanceLog(sampleAsset, log);

    const [path, payload] = mocks.patch.mock.calls[0];
    expect(path).toBe('/api/v1/finance/assets/assetAST-01');
    expect(payload.maintenanceLogs).toHaveLength(2);
    expect(payload.maintenanceLogs[0].logId).toBe('MNT-1');
    expect(payload.maintenanceLogs[1]).toEqual(log);
    expect(log.logId.startsWith('MNT-')).toBe(true);
    expect(log.cost).toBe(300);
  });

  it('يرمي خطأ عند استجابة غير صالحة ولا يعيد أصلًا بلا معرّف', async () => {
    mocks.post.mockResolvedValue({ success: true, data: {} });
    mocks.createAccountForEntity.mockResolvedValue({ id: 'acc-9', accountCode: '1220-0007' });

    await expect(
      financeAssetsService.register({
        assetCode: 'AST-03',
        nameAr: 'أ',
        nameEn: 'A',
        category: 'Other',
        type: 'Fixed',
        cost: 10,
        currency: 'YER',
        purchaseDate: '2026-05-01',
        status: 'Active',
      }),
    ).rejects.toThrow('استجابة غير صالحة');
  });

  it('يبني معرّف الأصل من رمزه ليبقى متوافقًا مع الصفوف المخزّنة', () => {
    expect(buildAssetId(' AST-7 ')).toBe('assetAST-7');
  });
});
