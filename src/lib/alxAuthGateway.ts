/**
 * alxAuthGateway.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * بوابة المصادقة عبر alx_api.
 * Authentication gateway through alx_api.
 *
 * هذا الملف هو بديل تدريجي لـ signInWithPassword في supabase-adapter.ts.
 * This file is a progressive replacement for signInWithPassword in supabase-adapter.ts.
 *
 * استخدام:
 *  - عند تعيين VITE_ALX_API_URL يتم التوجيه التلقائي عبر alx_api.
 *  - عند غيابه يُبقى النظام يعمل بالطريقة القديمة.
 */

import {
  alxRequest,
  storeTokens,
  clearTokens,
  getSessionId,
  isAlxApiAvailable,
  type ApiResult,
} from './alxApiClient';

// ── أنواع البيانات ───────────────────────────────────────────────────────────

export interface AlxLoginResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: {
    userId: string;
    username: string;
    email: string | null;
    fullName: string | null;
    role: string | null;
    isRoot: boolean;
    disabled: boolean;
  };
}

export interface AlxUserProfile {
  userId: string;
  username: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
  isRoot: boolean;
  disabled: boolean;
  createdAt?: string;
}

// ── مصادقة alx_api ──────────────────────────────────────────────────────────

/**
 * تسجيل الدخول عبر alx_api.
 * Login through alx_api with Argon2id verification.
 */
export async function alxLogin(
  identifier: string,
  password: string,
): Promise<AlxLoginResult> {
  const result = await alxRequest<AlxLoginResult>('/api/v1/auth/login', {
    method: 'POST',
    authenticated: false,
    body: { identifier, password },
  });

  if (!result.success) {
    const err = new Error(result.error.message) as any;
    err.code = result.error.code;
    throw err;
  }

  // تخزين الـ Tokens آمناً في sessionStorage
  storeTokens(result.data.accessToken, result.data.refreshToken, result.data.sessionId);

  return result.data;
}

/**
 * تسجيل الخروج من الجلسة الحالية.
 * Logout from the current session.
 */
export async function alxLogout(): Promise<void> {
  const sessionId = getSessionId();

  if (sessionId) {
    // إبطال الجلسة على السيرفر (best-effort — لا نتوقف إذا فشل)
    await alxRequest(`/api/v1/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      authenticated: true,
    }).catch(() => {
      // تجاهل أخطاء الشبكة عند تسجيل الخروج
    });
  }

  // مسح Tokens محليًا دائمًا
  clearTokens();
}

/**
 * الحصول على بيانات المستخدم الحالي من alx_api.
 * Get current user profile from alx_api.
 */
export async function alxGetCurrentUser(): Promise<AlxUserProfile | null> {
  const result = await alxRequest<AlxUserProfile>('/api/v1/auth/me', {
    authenticated: true,
  });

  if (!result.success) return null;
  return result.data;
}

/**
 * الحصول على صلاحيات المستخدم الحالي.
 * Get current user permissions.
 */
export async function alxGetPermissions(): Promise<string[]> {
  const result = await alxRequest<string[]>('/api/v1/auth/permissions', {
    authenticated: true,
  });

  if (!result.success) return [];
  return result.data;
}

// ── إدارة الجلسات ────────────────────────────────────────────────────────────

/**
 * الحصول على قائمة الجلسات النشطة.
 * List active sessions.
 */
export async function alxListSessions(): Promise<readonly Record<string, unknown>[]> {
  const result = await alxRequest<readonly Record<string, unknown>[]>('/api/v1/auth/sessions', {
    authenticated: true,
  });

  if (!result.success) return [];
  return result.data;
}

/**
 * إبطال جلسة محددة بمعرفها.
 * Revoke a specific session by ID.
 */
export async function alxRevokeSession(sessionId: string): Promise<boolean> {
  const result = await alxRequest(`/api/v1/auth/sessions/${sessionId}`, {
    method: 'DELETE',
    authenticated: true,
  });
  return result.success;
}

/**
 * تسجيل الخروج من جميع الأجهزة.
 * Logout from all devices.
 */
export async function alxLogoutAll(): Promise<void> {
  await alxRequest('/api/v1/auth/logout-all', {
    method: 'POST',
    authenticated: true,
  });
  clearTokens();
}

// ── التحقق من توفر alx_api كـ Feature Flag ──────────────────────────────────

/**
 * هل يجب استخدام alx_api للمصادقة؟
 * Should we use alx_api for authentication?
 */
export async function shouldUseAlxAuth(): Promise<boolean> {
  return isAlxApiAvailable();
}
