import { clearTokens, getStoredAccessToken, getStoredRefreshToken, storeTokens } from "../../lib/alxApiClient";
import { announceSessionTermination } from "./session-events";

// تجديد رمز الوصول في مكان واحد: كل عملاء HTTP يستخدمونه بدل تكرار المنطق.
// One access-token refresher shared by every HTTP client instead of per-client duplicates.
let inFlight: Promise<string | null> | null = null;

/** ينهي الجلسة محليًا ويُبقي بقية المزوّدين يسمعون ذلك: يمسح الرموز ويعلن الانتهاء القاطع.
 *  Ends the session locally and tells every provider: clears the tokens and announces the decisive end. */
function terminateSession(): void {
  clearTokens();
  announceSessionTermination();
}

async function requestRefresh(baseUrl: string, refreshToken: string): Promise<string | null> {
  const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  // فشل قاطع (جلسة منتهية أو حساب معطّل أو رمز تجديد معاد استخدامه) ينهي الجلسة؛ أما 429/5xx/الشبكة فعارض.
  // A definitive failure (lapsed session, disabled account, reused refresh token) ends the session; 429/5xx/network is transient.
  if (response.status === 401 || response.status === 403) {
    // لا نمحو الجلسة عند أي 401: نتحقق من الرمز الدالّ أولًا حتى لا يقطع عارضٌ اتصال مستخدمٍ نشط.
    // Do not wipe the session on any 401: confirm the decisive code first so a transient error cannot cut an active user off.
    const code = await readErrorCode(response);
    if (code === null || isDecisiveAuthFailure(code)) terminateSession();
    return null;
  }
  if (!response.ok) return null;

  const result = (await response.json()) as {
    success?: boolean;
    data?: { accessToken?: string; refreshToken?: string; sessionId?: string; sessionExpiresAt?: string };
  };
  if (!result?.success || !result.data?.accessToken || !result.data.refreshToken) {
    terminateSession();
    return null;
  }
  storeTokens(
    result.data.accessToken,
    result.data.refreshToken,
    result.data.sessionId,
    result.data.sessionExpiresAt,
  );
  return result.data.accessToken;
}

/** يقرأ رمز الخطأ من جسم الاستجابة دون رمي استثناء إن لم يكن JSON.
 *  Reads the error code from the response body, never throwing when the payload is not JSON. */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { code?: string } };
    return body?.error?.code ?? null;
  } catch {
    return null;
  }
}

/** الرموز التي تعني أن الجلسة انتهت لا محالة، فلا معنى لإعادة المحاولة.
 *  Codes that mean the session is definitively over, so retrying is pointless. */
function isDecisiveAuthFailure(code: string): boolean {
  return (
    code === 'AUTH_SESSION_EXPIRED' ||
    code === 'AUTH_ACCOUNT_DISABLED' ||
    code === 'AUTH_INVALID_CREDENTIALS'
  );
}

/**
 * يعيد مصنعًا يجدد رمز الوصول ويخزنه، ثم يعيد الرمز الجديد أو null إن تعذر ذلك.
 * Returns a factory that refreshes and stores the access token, resolving to the new token or null.
 */
export function createAccessTokenRefresher(baseUrl: string): () => Promise<string | null> {
  return async () => {
    if (typeof sessionStorage === "undefined") return null;
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken || !baseUrl) return null;
    // الطلبات المتزامنة تنتظر نفس عملية التجديد — لا عاصفة طلبات على /auth/refresh.
    // Concurrent requests await the same refresh call: no stampede on /auth/refresh.
    if (inFlight) return inFlight;
    inFlight = refreshUnderCrossTabLock(baseUrl, refreshToken)
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}

/**
 * قفل بين التبويبات: تبويب واحد يدير رمز التجديد، والبقية تنتظر ثم تعيد استخدامه، فلا دوران مزدوج يُثير كشف إعادة الاستخدام.
 * A cross-tab lock: one tab rotates the refresh token while the others wait and reuse the result, so a double
 * rotation can never trip the server's refresh-token reuse detection and revoke the whole family.
 */
async function refreshUnderCrossTabLock(baseUrl: string, refreshToken: string): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return requestRefresh(baseUrl, refreshToken);
  }
  return navigator.locks.request("swiftship:auth-refresh", () => {
    // سبقنا تبويبٌ أثناء الانتظار فيرمّم برمزٍ جديد: نستخدم المخزّن ولا نعيد الدوران.
    // Another tab rotated while we waited: reuse what it stored instead of rotating a second time.
    if (getStoredRefreshToken() !== refreshToken) return getStoredAccessToken();
    return requestRefresh(baseUrl, refreshToken);
  });
}
