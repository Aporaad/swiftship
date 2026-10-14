import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../data/http/api-client', () => ({
  ApiClient: class {
    post = mocks.post;
    patch = mocks.patch;
    delete = mocks.del;
  },
}));

import { ENTRY_SETTING_CODE_PATTERN, financialEntrySettingsService } from './financialEntrySettingsService';

describe('financialEntrySettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ينشئ فئة القيد عبر POST ويسقط المفاتيح غير المعروفة من الجسم', async () => {
    mocks.post.mockResolvedValueOnce({ success: true, data: { result: { id: 'em_1', code: 'TEST' } } });

    const result = await financialEntrySettingsService.manage('create', 'module', 'ignored_by_api', {
      code: 'TEST', nameAr: 'فئة اختبار', nameEn: undefined, moduleId: undefined, isActive: true,
    });

    expect(mocks.post).toHaveBeenCalledWith('/api/v1/finance/entry-modules', {
      code: 'TEST', nameAr: 'فئة اختبار', isActive: true,
    });
    expect(result).toMatchObject({ result: { id: 'em_1' } });
  });

  it('يحدّث نوع القيد عبر PATCH مع الفئة المرتبطة ولا يرسل moduleId للفئات', async () => {
    mocks.patch.mockResolvedValueOnce({ success: true, data: { result: { id: 'et_1' } } });

    await financialEntrySettingsService.manage('update', 'type', 'et_1', {
      code: 'SALARY', nameAr: 'رواتب', moduleId: 'em_9', isActive: false,
    });
    expect(mocks.patch).toHaveBeenCalledWith('/api/v1/finance/entry-types/et_1', {
      code: 'SALARY', nameAr: 'رواتب', isActive: false, moduleId: 'em_9',
    });

    await financialEntrySettingsService.manage('update', 'module', 'em_1', { code: 'TEST', nameAr: 'فئة', moduleId: 'em_9' });
    expect(mocks.patch).toHaveBeenLastCalledWith('/api/v1/finance/entry-modules/em_1', { code: 'TEST', nameAr: 'فئة' });
  });

  it('يحذف عبر DELETE دون جسم طلب', async () => {
    mocks.del.mockResolvedValueOnce({ success: true, data: { result: { deleted: 'et_2' } } });

    await expect(financialEntrySettingsService.manage('delete', 'type', 'et_2'))
      .resolves.toMatchObject({ result: { deleted: 'et_2' } });
    expect(mocks.del).toHaveBeenCalledWith('/api/v1/finance/entry-types/et_2');
  });

  it('يعرض خطأ الـ API ولا يخفي رفض الصلاحية', async () => {
    mocks.del.mockRejectedValueOnce(Object.assign(new Error('لا تملك صلاحية delete_entry_settings'), { code: 'FINANCE_RPC_FORBIDDEN' }));

    await expect(financialEntrySettingsService.manage('delete', 'module', 'em_3')).rejects.toThrow('لا تملك صلاحية');
  });

  it('يطابق قالب الرمز المفروض في الخادم', () => {
    expect(ENTRY_SETTING_CODE_PATTERN.test('ORDER_CHARGE')).toBe(true);
    expect(ENTRY_SETTING_CODE_PATTERN.test('order_charge')).toBe(false);
    expect(ENTRY_SETTING_CODE_PATTERN.test('1ORDER')).toBe(false);
  });
});
