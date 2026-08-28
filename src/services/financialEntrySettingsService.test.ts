import { describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase-firebase-adapter', () => ({ supabase: { rpc } }));

import { financialEntrySettingsService } from './financialEntrySettingsService';

describe('financialEntrySettingsService', () => {
  it('يفوض الحفظ إلى إجراء خلفي واحد بدل الكتابة المباشرة على الجداول', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'module_test', code: 'TEST', isActive: true }, error: null });
    await expect(financialEntrySettingsService.manage('create', 'module', 'module_test', {
      code: 'TEST', nameAr: 'فئة اختبار', isActive: true,
    })).resolves.toMatchObject({ id: 'module_test' });
    expect(rpc).toHaveBeenCalledWith('manage_financial_entry_setting', {
      p_action: 'create', p_kind: 'module', p_id: 'module_test',
      p_payload: { code: 'TEST', nameAr: 'فئة اختبار', isActive: true },
    });
  });

  it('يعرض خطأ الإجراء الخلفي ولا يخفي رفض الصلاحية', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'لا تملك صلاحية create_entry_settings' } });
    await expect(financialEntrySettingsService.manage('delete', 'type', 'type_test')).rejects.toThrow('لا تملك صلاحية');
  });
});
