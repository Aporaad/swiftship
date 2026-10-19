/**
 * polling-channel.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * قناة جلب دورية مشتركة: كل شاشة تشترك في نفس المفتاح تأكل من نفس الطلب الواحد بدل أن تفتح مؤقّتًا
 * خاصًا بها. تُعاد آخر نتائج معروفة للمشترك الجديد فورًا حتى لا تنتظر دورة الجلب القادمة.
 * One shared polling channel per key: every screen that subscribes to the same key is fed by a single
 * request instead of opening its own timer, and a new subscriber is replayed the last known rows at once
 * so it never waits for the next cycle.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const DEFAULT_POLL_INTERVAL_MS = 30_000;

export type PollUnload<T> = () => Promise<T>;

interface PollChannel<T> {
  listeners: Set<(rows: T) => void>;
  errors: Set<(error: unknown) => void>;
  last: T | undefined;
  timer: ReturnType<typeof setInterval> | null;
  loading: boolean;
  refresh: (() => Promise<void>) | null;
}

const channels = new Map<string, PollChannel<unknown>>();

/**
 * يجلب الآن كل القنوات الحيّة — زر التحديث في الشريط العلوي يناديه بدل إعادة تحميل الصفحة.
 * Polls every live channel immediately; the top-bar refresh button calls this instead of
 * reloading the page, so the user keeps their scroll, filters and open screens.
 * القنوات الخاملة (بلا مشتركين) لا تُلمس لأنها حُذفت أصلًا من السجل.
 * Idle channels are untouched because they no longer exist in the registry.
 */
export async function refreshAllPollingChannels(): Promise<void> {
  await Promise.allSettled(
    [...channels.values()].map((channel) => channel.refresh?.() ?? Promise.resolve()),
  );
}

/** يوقف كل الجلب الدوري فورًا عند انتهاء الجلسة: بلا جلسة لا معنى لإزعاج السيرفر بمحاولات فاشلة كل 30 ثانية.
 *  Stops every polling channel at once on session end: without a session there is no point hammering the server with failing 30s fetches. */
export function stopAllPollingChannels(): void {
  for (const channel of channels.values()) {
    if (channel.timer) clearInterval(channel.timer);
    channel.timer = null;
  }
  channels.clear();
}

/** يوحّد الاشتراكات على مفتاح واحد؛ يرجع دالة إلغاء تُغلق المؤقّت حين لا يبقى مشترٍ.
 *  Merges subscriptions on one key and returns an unsubscribe that stops the timer once nobody is left. */
export function subscribePollingChannel<T>(
  key: string,
  load: PollUnload<T>,
  onData: (rows: T) => void,
  onError: (error: unknown) => void,
  intervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): () => void {
  const existing = channels.get(key) as PollChannel<T> | undefined;
  const channel: PollChannel<T> = existing ?? {
    listeners: new Set(),
    errors: new Set(),
    last: undefined,
    timer: null,
    loading: false,
    refresh: null,
  };
  channels.set(key, channel as PollChannel<unknown>);

  const refresh = async () => {
    if (channel.loading) return;
    channel.loading = true;
    try {
      const rows = await load();
      channel.last = rows;
      channel.listeners.forEach((listener) => listener(rows));
    } catch (error) {
      channel.errors.forEach((handler) => handler(error));
    } finally {
      channel.loading = false;
    }
  };
  // آخر دالة تحميل هي التي يناديها زر التحديث، لأن آخر مشترك هو مالك الطلب الأحدث.
  // The newest loader wins, because the latest subscriber owns the live request for this key.
  channel.refresh = refresh;

  channel.listeners.add(onData);
  channel.errors.add(onError);
  if (channel.last !== undefined) onData(channel.last);
  if (!channel.timer) {
    channel.timer = setInterval(() => void refresh(), intervalMs);
    void refresh();
  }

  return () => {
    channel.listeners.delete(onData);
    channel.errors.delete(onError);
    if (channel.listeners.size === 0 && channel.timer) {
      clearInterval(channel.timer);
      channel.timer = null;
      channels.delete(key);
    }
  };
}
