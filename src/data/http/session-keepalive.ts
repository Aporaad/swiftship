import {
  clearTokens,
  getSessionExpiresAt,
  getSessionId,
  getStoredAccessToken,
  setSessionExpiresAt,
} from '../../lib/alxApiClient';
import { createAccessTokenRefresher } from './session-refresh';
import { announceSessionTermination } from './session-events';

/**
 * تجديد صامت طالما المستخدم نشط: لا تنتهي نافذة خمول الجلسة ولا يَنتهي رمز الوصول أمام مستخدم يعمل فعلاً،
 * فلا انقطاع ولا رسالة إعادة دخول. عند غياب النشاط نتوقف عن التجديد، فيُغلق السيرفر الجلسة بعد مهلة
 * الخمول المحددة في الإعدادات، ويُوجَّه المستخدم لصفحة الدخول دون انتظار تحديث الصفحة.
 * Silent renewal while the user is active: neither the session idle window nor the access token is allowed
 * to lapse in front of someone who is actually working, so there is no interruption and no re-login prompt.
 * Without activity we stop renewing; the server then ends the session once the configured idle timeout
 * lapses and the user is routed to the login page without a manual refresh.
 */

// سباقان مستقلان للوقت: يجدّد الرمز قبل انتهته بدقيقتين، ويمدّد نافذة الخمول قبل نهايتها بدقيقة.
// Two independent clocks: re-mint the token two minutes before its exp, extend the idle window a minute before it lapses.
const TOKEN_RENEW_LEAD_MS = 2 * 60_000;
const IDLE_RENEW_LEAD_MS = 60_000;
// إعادة الفحص الهادئة: نافذة أمان حتى لا يفوت الموعد إن تأخّر الجدول، ولا نشاط فيها يعني بلا استدعاء تجديد.
// The quiet re-check: a safety window so a missed schedule cannot lapse the session, and idle time never renews.
const RECHECK_MS = 30_000;
const MIN_DELAY_MS = 5_000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

let baseUrl: string | null = null;
let refresher: (() => Promise<string | null>) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let active = false;
let lastActivityAt = 0;
let lastRenewalAt = 0;

function markActivity(): void {
  lastActivityAt = Date.now();
}

/** يقرأ نهاية صلاحية الرمز من حمولة JWT دون التحقق منها: التحقق مسؤولية السيرفر.
 *  Reads exp from the JWT payload without verifying it — verification is the server's job. */
function accessTokenExpiryMs(accessToken: string): number | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** موعد انتهاء نافذة الخمول من زمن الخادم، أو null حين لا يعرفه العميل بعد.
 *  The server's idle deadline, or null until the client has learned it. */
function sessionIdleDeadlineMs(): number | null {
  const raw = getSessionExpiresAt();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** يحسب أقرب موعد بين الساعتين ويزيد عليه إعادة فحص دورية كسقف أمان.
 *  Picks the sooner of the two clocks and caps it with a periodic safety re-check. */
function scheduleNext(): void {
  const now = Date.now();
  const token = getStoredAccessToken();
  const tokenExpiry = token ? accessTokenExpiryMs(token) : null;
  const idleDeadline = sessionIdleDeadlineMs();
  const nextAt = Math.min(
    tokenExpiry !== null ? tokenExpiry - TOKEN_RENEW_LEAD_MS : Number.POSITIVE_INFINITY,
    idleDeadline !== null ? idleDeadline - IDLE_RENEW_LEAD_MS : Number.POSITIVE_INFINITY,
    now + RECHECK_MS,
  );
  schedule(nextAt - now);
}

function schedule(delayMs: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void tick(), Math.max(MIN_DELAY_MS, Number.isFinite(delayMs) ? delayMs : RECHECK_MS));
}

/** يرسل نبضة تمديد لنافذة الخمول مع رمز الوصول الحالي؛ يفرّق بين التمديد والفشل القاطع والعارض.
 *  Sends an idle-window heartbeat with the current access token; tells renewal, decisive failure and transient failure apart. */
async function renewIdleWindow(): Promise<boolean> {
  if (!baseUrl) return false;
  const token = getStoredAccessToken();
  const sessionId = getSessionId();
  if (!token || !sessionId) return false;
  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/session/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (response.ok) {
      const result = (await response.json()) as { data?: { sessionExpiresAt?: string } };
      if (result?.data?.sessionExpiresAt) setSessionExpiresAt(result.data.sessionExpiresAt);
      return true;
    }
    if (response.status === 401 || response.status === 403) {
      const code = await readErrorCode(response);
      // رفض قاطع: انتهت النافذة أو عُطّل الحساب، فتنهي الجلسة وتُوجَّه للدخول دون تحديث.
      // A decisive rejection: the window lapsed or the account is disabled, so end the session and route to login without a refresh.
      if (code === 'AUTH_SESSION_EXPIRED' || code === 'AUTH_ACCOUNT_DISABLED') {
        clearTokens();
        announceSessionTermination();
      }
      // رمز الوصول نفسه منقضٍ (AUTH_INVALID_CREDENTIALS): لا ننهي شيئًا، دورة الفحص تُعيد سكّه.
      // The access token itself is stale (AUTH_INVALID_CREDENTIALS): end nothing, the next tick re-mints it.
      return false;
    }
    return false; // عارض (429/5xx/الشبكة): نُبقي الجلسة ونعاود الفحص بهدوء. Transient: keep the session, re-check quietly.
  } catch {
    return false;
  }
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

async function tick(): Promise<void> {
  if (!active || typeof document === 'undefined') return;

  // التبويب المخفي أو انقطاع الشبكة لا يستحقان استدعاء تجديد: نعاود الفحص بهدوء.
  // A hidden tab or an offline browser earns a quiet re-check, not a renewal call.
  if (document.hidden || navigator.onLine === false) {
    schedule(RECHECK_MS);
    return;
  }

  // لا نشاط منذ آخر تجديد: نافذة الخمول تُترك لمهلة الإعدادات تقرّر، لا نمدّدها بلا سبب.
  // No activity since the last renewal: let the configured idle window decide instead of stretching it for nothing.
  if (lastActivityAt <= lastRenewalAt) {
    schedule(RECHECK_MS);
    return;
  }

  const now = Date.now();
  const token = getStoredAccessToken();
  const tokenExpiry = token ? accessTokenExpiryMs(token) : null;
  const idleDeadline = sessionIdleDeadlineMs();

  // 1) رمز الوصول على وشك الانتهاء: نعيد سكّه عبر /auth/refresh وهو يمدّد نافذة الخمول على السيرفر أيضًا.
  // The access token is about to lapse: re-mint via /auth/refresh, which also slides the idle window server-side.
  if (tokenExpiry !== null && tokenExpiry - now <= TOKEN_RENEW_LEAD_MS) {
    if (!(await runRefresher())) return;
    lastRenewalAt = Date.now();
    scheduleNext();
    return;
  }

  // 2) نافذة الخمول تسبق الرمز في انتهائها: نبضة تمديد بلا إعادة سكّ لأي رمز.
  // The idle window lapses before the token: a heartbeat extends it without re-minting anything.
  if (idleDeadline !== null && idleDeadline - now <= IDLE_RENEW_LEAD_MS) {
    const extended = await renewIdleWindow();
    if (!extended) {
      // فشل قاطع بثّ حالته وأزال الرموز: نتوقف. عارض: نعاود الفحص دون محو الجلسة.
      // A decisive failure broadcast its state and cleared tokens: stop. A transient one: re-check without wiping.
      if (!getStoredAccessToken()) {
        stopSilentSessionRenewal();
        return;
      }
      schedule(RECHECK_MS);
      return;
    }
    lastRenewalAt = Date.now();
    scheduleNext();
    return;
  }

  // 3) لا يعرف العميل موعد النافذة (جلسة أُنشئت قبل الترقية): يعيد سكّ الرمز ليصله الموعد من الخادم.
  // No known deadline (a session predating the upgrade): re-mint so the server's deadline reaches the client.
  if (idleDeadline === null) {
    if (!(await runRefresher())) return;
    lastRenewalAt = Date.now();
  }
  scheduleNext();
}

/** يشغّل مجدّد الرمز؛ يعيد false عند إنهاء الجلسة قاطعًا فيُوقف المؤقّتات.
 *  Runs the token refresher; returns false when the session was decisively ended, so timers stop. */
async function runRefresher(): Promise<boolean> {
  const refreshed = await (refresher?.() ?? Promise.resolve(null));
  if (refreshed) return true;
  // المجدد أنهى الجلسة عند الفشل القاطع وبثّ الحالة؛ حتى على عارضٍ نتوقف عن الإلحاح ونترك إعادة الدخول للمستخدم.
  // The refresher ends and broadcasts on a decisive failure; even on a transient one we stop nagging and let the user re-sign-in.
  stopSilentSessionRenewal();
  return false;
}

/** يبدأ التجديد الصامت بعد تسجيل الدخول. Starts silent renewal once signed in. */
export function startSilentSessionRenewal(apiBaseUrl: string | undefined): void {
  if (!apiBaseUrl || typeof window === 'undefined' || active) return;
  baseUrl = apiBaseUrl;
  refresher ??= createAccessTokenRefresher(apiBaseUrl);
  active = true;
  markActivity();
  lastRenewalAt = Date.now();
  ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));
  window.addEventListener('online', markActivity);
  void tick();
}

/** يوقف التجديد ويغفل المؤقتات. Stops silent renewal and clears its timers. */
export function stopSilentSessionRenewal(): void {
  active = false;
  if (timer) clearTimeout(timer);
  timer = null;
  if (typeof window === 'undefined') return;
  ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActivity));
  window.removeEventListener('online', markActivity);
}
