import { supabase } from '../lib/supabase-firebase-adapter';

export type FinancialEntrySettingKind = 'module' | 'type';
export type FinancialEntrySettingAction = 'create' | 'update' | 'delete';

export interface FinancialEntrySettingPayload {
  code: string;
  nameAr: string;
  nameEn?: string;
  note?: string;
  moduleId?: string;
  isActive?: boolean;
}

export const financialEntrySettingsService = {
  async manage(
    action: FinancialEntrySettingAction,
    kind: FinancialEntrySettingKind,
    id: string,
    payload: FinancialEntrySettingPayload = { code: '', nameAr: '' },
  ) {
    const { data, error } = await (supabase as any).rpc('manage_financial_entry_setting', {
      p_action: action,
      p_kind: kind,
      p_id: id,
      p_payload: payload,
    });
    if (error) throw new Error(error.message || String(error));
    return data;
  },
};
