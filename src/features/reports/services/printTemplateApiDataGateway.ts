import { ApiClient } from '../../../data/http/api-client';
import type { PrintTemplateSettings } from '../types/reports.types';

/**
 * قالب الطباعة صار جدولًا بأعمدة حقيقية في قاعدة البيانات: public.settings_print_template.
 * The print template is now a real-column table in the database: public.settings_print_template.
 *
 * الواجهة كانت تخزّن القالب في localStorage فقط، فلا يشاركه بقية المستخدمين ولا ينجو من إعادة التثبيت.
 * The UI used to keep the template in localStorage alone, so it was shared with no one and survived no reinstall.
 */
type ApiEnvelope<T> = { success: true; data: T };
type SettingsRecordDto = { settingId: string; category: string; settings: Partial<PrintTemplateSettings> };

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

export const printTemplateApiDataGateway = {
  /** تحميل القالب المحفوظ؛ null عند غياب الصف أو تعذر القراءة فتكمل الشاشة بقيمها الافتراضية.
   *  Loads the stored template; null when the row is missing or the read fails so the screen keeps its defaults. */
  async load(): Promise<Partial<PrintTemplateSettings> | null> {
    try {
      const response = await client.get<ApiEnvelope<SettingsRecordDto>>('/api/v1/settings/print_template');
      const settings = response.data?.settings;
      return settings && typeof settings === 'object' ? settings : null;
    } catch {
      return null;
    }
  },

  async save(settings: PrintTemplateSettings): Promise<void> {
    await client.patch<ApiEnvelope<SettingsRecordDto>>('/api/v1/settings/print_template', { settings });
  },
};
