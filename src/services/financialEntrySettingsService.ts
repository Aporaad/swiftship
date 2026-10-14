/**
 * financialEntrySettingsService.ts
 * خدمة فئات وأنواع القيود المالية — API-only عبر alx_api.
 * Financial entry modules/types settings service — API-only through alx_api (no legacy Supabase RPC access).
 */
import { financeApiClient, readAllFinanceRows, type ApiEnvelope } from './financeApi';

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

/** قالب الرمز المفروض خلفياً — يُستخدم للتحقق المبكر في الواجهة قبل رفض الخادم. */
export const ENTRY_SETTING_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

const basePath = (kind: FinancialEntrySettingKind) =>
  kind === 'module' ? '/api/v1/finance/entry-modules' : '/api/v1/finance/entry-types';

/**
 * المسارات الخلفية strict: أي مفتاح undefined أو غير معروف يسبب رفض 400.
 * Backend schemas are strict, so undefined/unknown keys are dropped before sending.
 */
function toRequestBody(kind: FinancialEntrySettingKind, payload: FinancialEntrySettingPayload): Record<string, unknown> {
  const body: Record<string, unknown> = { code: payload.code, nameAr: payload.nameAr };
  if (payload.nameEn !== undefined) body.nameEn = payload.nameEn;
  if (payload.note !== undefined) body.note = payload.note;
  if (payload.isActive !== undefined) body.isActive = payload.isActive;
  if (kind === 'type' && payload.moduleId) body.moduleId = payload.moduleId;
  return body;
}

export const financialEntrySettingsService = {
  /** قراءة وحدات القيود لتسميتها في الكشوف — entry modules read for labelling statements. */
  async listModules(): Promise<any[]> {
    return readAllFinanceRows('/api/v1/finance/entry-modules');
  },

  async manage(
    action: FinancialEntrySettingAction,
    kind: FinancialEntrySettingKind,
    id: string,
    payload: FinancialEntrySettingPayload = { code: '', nameAr: '' },
  ) {
    const path = basePath(kind);
    if (action === 'delete') {
      const res = await financeApiClient.delete<ApiEnvelope<unknown>>(`${path}/${encodeURIComponent(id)}`);
      return res?.data ?? null;
    }

    const body = toRequestBody(kind, payload);
    const res = action === 'create'
      ? await financeApiClient.post<ApiEnvelope<unknown>>(path, body)
      : await financeApiClient.patch<ApiEnvelope<unknown>>(`${path}/${encodeURIComponent(id)}`, body);
    return res?.data ?? null;
  },
};
