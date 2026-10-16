import { clearTokens, getStoredRefreshToken, storeTokens } from "../../lib/alxApiClient";

// تجديد رمز الوصول في مكان واحد: كل عملاء HTTP يستخدمونه بدل تكرار المنطق.
// One access-token refresher shared by every HTTP client instead of per-client duplicates.
let inFlight: Promise<string | null> | null = null;

async function requestRefresh(baseUrl: string, refreshToken: string): Promise<string | null> {
  const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  // فشل قاطع (رمز تجديد منتهي أو ملغى) ينهي الجلسة؛ أما 429/5xx فعارض ويجب ألا يمحوها.
  // A definitive refresh failure (expired or revoked token) ends the session; 429/5xx is transient and must not wipe it.
  if (response.status === 401 || response.status === 403) {
    clearTokens();
    return null;
  }
  if (!response.ok) return null;

  const result = (await response.json()) as {
    success?: boolean;
    data?: { accessToken?: string; refreshToken?: string; sessionId?: string };
  };
  if (!result?.success || !result.data?.accessToken || !result.data.refreshToken) {
    clearTokens();
    return null;
  }
  storeTokens(result.data.accessToken, result.data.refreshToken, result.data.sessionId);
  return result.data.accessToken;
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
    inFlight = requestRefresh(baseUrl, refreshToken)
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}
