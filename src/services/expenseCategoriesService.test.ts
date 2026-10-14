import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock('../data/http/app-api-client', () => ({
  appApiClient: { get: mocks.get, patch: mocks.patch },
}));

import { DEFAULT_EXPENSE_CATEGORIES, expenseCategoriesService } from './expenseCategoriesService';

/** يغلّف صفوف الإعدادات كما يعيدها alx_api — wraps rows in the API envelope shape. */
const settingsEnvelope = (data: unknown) => ({ success: true, data: { settingId: 'expense_categories', settings: { data } } });
const apiError = (code: string) => Object.assign(new Error('فشل'), { code });

describe('خدمة فئات المصروفات', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يقرأ الفئات المخزّنة ويسقط إلى الافتراضية عند غياب المستند', async () => {
    mocks.get.mockResolvedValue(settingsEnvelope([{ id: 'rent', labelAr: 'إيجار', labelEn: 'Rent' }]));
    await expect(expenseCategoriesService.list()).resolves.toEqual([{ id: 'rent', labelAr: 'إيجار', labelEn: 'Rent' }]);

    mocks.get.mockRejectedValue(apiError('SETTINGS_NOT_FOUND'));
    await expect(expenseCategoriesService.list()).resolves.toBe(DEFAULT_EXPENSE_CATEGORIES);
  });

  it('لا يبتلع أخطاء الخادم الأخرى ويتجاهل الصفوف غير الصالحة', async () => {
    mocks.get.mockRejectedValue(apiError('FORBIDDEN'));
    await expect(expenseCategoriesService.list()).rejects.toThrow('فشل');

    mocks.get.mockResolvedValue(settingsEnvelope([null, { labelAr: 'بلا معرف' }, { id: 'fuel' }]));
    await expect(expenseCategoriesService.list()).resolves.toEqual([{ id: 'fuel' }]);
  });

  it('يضيف فئة قراءةً فكتابةً دون مسح الفئات المخزّنة', async () => {
    mocks.get.mockResolvedValue(settingsEnvelope([{ id: 'rent', labelAr: 'إيجار', labelEn: 'Rent' }]));
    mocks.patch.mockResolvedValue({ success: true, data: {} });

    const result = await expenseCategoriesService.add({ id: ' equipment ', labelAr: 'معدات', labelEn: 'Equipment' });

    expect(mocks.patch).toHaveBeenCalledWith('/api/v1/settings/expense_categories', {
      settings: {
        data: [
          { id: 'rent', labelAr: 'إيجار', labelEn: 'Rent' },
          { id: 'equipment', labelAr: 'معدات', labelEn: 'Equipment', isSystem: false },
        ],
      },
    });
    expect(result).toHaveLength(2);
  });

  it('يرفض الإضافة المكررة ومعرّف الفئة الفارغ قبل أي كتابة', async () => {
    mocks.get.mockResolvedValue(settingsEnvelope([{ id: 'rent', labelAr: 'إيجار', labelEn: 'Rent' }]));
    await expect(expenseCategoriesService.add({ id: 'rent', labelAr: 'إيجار', labelEn: 'Rent' })).rejects.toThrow('موجودة مسبقًا');
    await expect(expenseCategoriesService.add({ id: '   ', labelAr: 'بلا', labelEn: 'None' })).rejects.toThrow('معرّف الفئة مطلوب');
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('يحدّث الفئة المطلوبة فقط ويرفض تعديل فئة غير موجودة', async () => {
    mocks.get.mockResolvedValue(
      settingsEnvelope([
        { id: 'rent', labelAr: 'إيجار', labelEn: 'Rent', isSystem: true },
        { id: 'fuel', labelAr: 'وقود', labelEn: 'Fuel' },
      ]),
    );
    mocks.patch.mockResolvedValue({ success: true, data: {} });

    await expenseCategoriesService.update('fuel', { labelAr: 'محروقات', accountCode: '5000-1' });

    const payload = mocks.patch.mock.calls[0][1].settings.data;
    expect(payload[0]).toEqual({ id: 'rent', labelAr: 'إيجار', labelEn: 'Rent', isSystem: true });
    expect(payload[1]).toEqual({ id: 'fuel', labelAr: 'محروقات', labelEn: 'Fuel', accountCode: '5000-1' });

    await expect(expenseCategoriesService.update('missing', { labelAr: '؟' })).rejects.toThrow('غير موجودة');
  });

  it('يحذف الفئات غير النظامية ويمنع حذف النظامية', async () => {
    mocks.get.mockResolvedValue(
      settingsEnvelope([
        { id: 'salary', labelAr: 'رواتب', labelEn: 'Salaries', isSystem: true },
        { id: 'other-extra', labelAr: 'إضافي', labelEn: 'Extra' },
      ]),
    );
    mocks.patch.mockResolvedValue({ success: true, data: {} });

    await expect(expenseCategoriesService.remove('salary')).rejects.toThrow('لا يمكن حذف فئة نظامية');
    expect(mocks.patch).not.toHaveBeenCalled();

    await expenseCategoriesService.remove('other-extra');
    expect(mocks.patch.mock.calls[0][1].settings.data).toEqual([
      { id: 'salary', labelAr: 'رواتب', labelEn: 'Salaries', isSystem: true },
    ]);

    await expect(expenseCategoriesService.remove('ghost')).rejects.toThrow('غير موجودة');
  });

  it('يعتمد القائمة الافتراضية كأساس للإضافة عندما لا يوجد تخزين', async () => {
    mocks.get.mockRejectedValue(apiError('SETTINGS_NOT_FOUND'));
    mocks.patch.mockResolvedValue({ success: true, data: {} });

    await expenseCategoriesService.add({ id: 'tools', labelAr: 'عدد', labelEn: 'Tools' });

    const payload = mocks.patch.mock.calls[0][1].settings.data;
    expect(payload).toHaveLength(DEFAULT_EXPENSE_CATEGORIES.length + 1);
    expect(payload[DEFAULT_EXPENSE_CATEGORIES.length]).toEqual({ id: 'tools', labelAr: 'عدد', labelEn: 'Tools', isSystem: false });
  });
});
