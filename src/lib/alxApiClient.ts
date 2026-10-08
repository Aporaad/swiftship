/**
 * alxApiClient.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * عميل HTTP موحد للتواصل مع alx_api.
 * Unified HTTP client for communicating with alx_api.
 *
 * المبادئ:
 * - لا يعرف النظام تفاصيل قاعدة البيانات — كل شيء عبر alx_api.
 * - كل طلب يحمل requestId فريد للتتبع.
 * - إدارة تلقائية للـ Access Token و Refresh Token.
 * - Fallback آمن في حال عدم الاتصال.
 */

// ── الثوابت ──────────────────────────────────────────────────────────────────
const ALX_API_URL = (
  typeof window !== 'undefined'
    ? ((import.meta as any).env?.VITE_ALX_API_URL ?? '')
    : (typeof process !== 'undefined' ? process.env['ALX_API_URL'] ?? '' : '')
) as string;

const TOKEN_STORAGE_KEY = 'alx_access_token';
const ALT_TOKEN_STORAGE_KEY = 'alx_api_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'alx_refresh_token';
const SESSION_ID_KEY = 'alx_session_id';

// ── Token Management ──────────────────────────────────────────────────────────

/** الحصول على Access Token المخزن */
export function getStoredAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(ALT_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** الحصول على Refresh Token المخزن */
export function getStoredRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** تخزين Tokens بعد تسجيل الدخول أو تجديد التوكن */
export function storeTokens(accessToken: string, refreshToken: string, sessionId?: string): void {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    sessionStorage.setItem(ALT_TOKEN_STORAGE_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    if (sessionId) sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  } catch {
    // Safe fallback — session storage unavailable
  }
}

/** مسح جميع الـ Tokens عند تسجيل الخروج */
export function clearTokens(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(ALT_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // Safe fallback
  }
}

/** الحصول على معرف الجلسة */
export function getSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

// ── Request ID Generator ──────────────────────────────────────────────────────

/** توليد معرف طلب فريد للتتبع */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// ── نوع الاستجابة الموحدة ──────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown[];
  };
}

export type ApiResult<T = unknown> = ApiSuccess<T> | ApiError;

// ── أخطاء API ────────────────────────────────────────────────────────────────

export class AlxApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly requestId: string,
  ) {
    super(message);
    this.name = 'AlxApiError';
  }
}

// ── دالة التجديد التلقائي للـ Access Token ────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

/** تجديد Access Token تلقائيًا باستخدام Refresh Token */
async function refreshAccessToken(): Promise<string | null> {
  // منع التجديد المتعدد في نفس الوقت
  if (refreshPromise) return refreshPromise;

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken || !ALX_API_URL) return null;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${ALX_API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': generateRequestId(),
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh Token منتهي أو ملغى — مسح الجلسة
        clearTokens();
        return null;
      }

      const result = (await response.json()) as ApiResult<{
        accessToken: string;
        refreshToken: string;
        sessionId: string;
      }>;

      if (!result.success) {
        clearTokens();
        return null;
      }

      storeTokens(result.data.accessToken, result.data.refreshToken, result.data.sessionId);
      return result.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── دالة الطلب الرئيسية ───────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** هل يتطلب الطلب مصادقة؟ افتراضي: true */
  authenticated?: boolean;
  /** مفتاح لمنع التكرار — مطلوب عند إنشاء الطلبات */
  idempotencyKey?: string;
}

/**
 * تنفيذ طلب HTTP إلى alx_api مع إدارة التوكنات التلقائية.
 * Execute HTTP request to alx_api with automatic token management.
 */
export async function alxRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  if (!ALX_API_URL) {
    return {
      success: false,
      error: {
        code: 'ALX_API_NOT_CONFIGURED',
        message: 'alx_api URL غير مهيأ في بيئة التطوير.',
        requestId: '',
        details: [],
      },
    };
  }

  const requestId = generateRequestId();
  const { method = 'GET', body, authenticated = true, idempotencyKey } = options;

  // بناء Headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...options.headers,
  };

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  if (authenticated) {
    const token = getStoredAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // تنفيذ الطلب
  let response = await fetch(`${ALX_API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // تجديد تلقائي إذا انتهت صلاحية Access Token (401)
  if (response.status === 401 && authenticated) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${ALX_API_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }
  }

  const result = (await response.json()) as ApiResult<T>;
  return result;
}

// ── فحص إذا كان alx_api متاحًا ─────────────────────────────────────────────

let apiAvailable: boolean | null = null;

/**
 * التحقق من توفر alx_api — يُستخدم كـ feature flag ديناميكي.
 * Check if alx_api is available — used as a dynamic feature flag.
 */
export async function isAlxApiAvailable(): Promise<boolean> {
  if (!ALX_API_URL) return false;
  if (apiAvailable !== null) return apiAvailable;

  try {
    const response = await fetch(`${ALX_API_URL}/api/v1/health/live`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    apiAvailable = response.ok;
  } catch {
    apiAvailable = false;
  }
  return apiAvailable;
}

/** إعادة تعيين حالة توفر الـ API (للاختبار أو إعادة المحاولة) */
export function resetApiAvailabilityCache(): void {
  apiAvailable = null;
}

// ── تصدير الثابت للـ URL ─────────────────────────────────────────────────────

export { ALX_API_URL };
