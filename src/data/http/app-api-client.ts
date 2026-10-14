/**
 * app-api-client.ts
 * عميل HTTP واحد للتطبيق كله — مصدر وحيد لعنوان الخادم ومصنع رمز الوصول وإعدادات إعادة المحاولة.
 * One shared ApiClient for the whole app: a single source of truth for the base URL,
 * the access-token factory and the read-retry policy (DRY).
 */
import { ApiClient } from './api-client';

/** عنوان alx_api — يمكن تجاوزه بمتغيرات البيئة. API base URL, overridable per environment. */
export const APP_API_BASE_URL: string =
  import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001';

/**
 * قراءة رمز الوصول من جلسة المتصفح فقط — لا يُخزَّن الرمز في أي وحدة أو ذاكرة تخزين دائمة.
 * The access token is read from the browser session on every request; it is never cached in module state.
 */
function readAccessToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token');
}

/** لا إعادة محاولة للقراءة: الأخطاء يجب أن تظهر للواجهة فوراً بدل إخفائها بمحاولة ثانية. */
export const appApiClient = new ApiClient({
  baseUrl: APP_API_BASE_URL,
  accessTokenFactory: readAccessToken,
  maxReadRetries: 0,
});

/** غلاف الاستجابة الموحّد لكل مسارات alx_api — Unified response envelope of every alx_api route. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: { total?: number };
}
