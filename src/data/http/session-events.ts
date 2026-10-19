/**
 * جلسة التطبيق عبر أحداث الـ window.
 * App-session events broadcast to every provider that needs to know the session changed.
 * يُستخدم بدل ربط السياقات ببعضها: من يُصدر الحالة لا يعرف من يستمع إليها.
 * Emitted by the auth provider so consumers stay decoupled from it.
 */

export const SESSION_STATUS_EVENT = 'swiftship:session-status';

// حدث إنهاء قاطع تصدره طبقة البيانات وحدها حين يرفض السيرفر الجلسة رفضًا لا رجعة فيه.
// A decisive termination event emitted only by the data layer when the server rejects the session irrevocably.
// يفصله عن SESSION_STATUS_EVENT لأن المزوّد يبثّ ذلك الأخير بنفسه، فيجنّب حلقة التغذية الراجعة.
// Kept separate from SESSION_STATUS_EVENT because the provider broadcasts that one itself, avoiding a feedback loop.
export const SESSION_TERMINATED_EVENT = 'swiftship:session-terminated';

export type SessionStatusName = 'loading' | 'authenticated' | 'unauthenticated' | 'expired' | 'locked';

export function emitSessionStatus(status: SessionStatusName): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ status: SessionStatusName }>(SESSION_STATUS_EVENT, { detail: { status } }));
}

/** يعلن أن الجلسة انتهت انتهاءً قاطعًا: يسمعه المزوّد فيُنهي الحالة ويوقف الجلب ويوجّه للدخول دون تحديث الصفحة.
 *  Announces an irrevocable session end: the provider hears it, drops the auth state, halts polling and routes to login without a refresh. */
export function announceSessionTermination(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_TERMINATED_EVENT));
  emitSessionStatus('expired');
}
