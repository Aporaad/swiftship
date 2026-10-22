/**
 * featuresUi.ts
 * أدوات عرض قسم إدارة الميزات (P10) — منسّقات وخرائط انتقالات الحالة للواجهة فقط.
 * Features-management presentation helpers (P10): formatters and UI-level status-transition maps.
 *
 * ملاحظة: خرائط الانتقال هنا للاستدلال على الأزرار المعروضة فقط — الخادم هو من يملك
 * منطق الحالة النهائي ويرفض أي انتقال غير صالح (بوابة القبول: لا منطق أهلية نهائي في UI).
 * Note: the transition maps below only decide which buttons to render. The server owns the final
 * state machine and rejects any invalid move (acceptance gate: no final eligibility logic in the UI).
 */

/** يحوّل الطابع الزمني إلى نص تاريخ/وقت محلي مختصر. */
export function formatDateTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** يحوّل قيمة input[type=datetime-local] إلى صيغة ISO يرسلها العقد للخادم. */
export function toIso(localValue: string): string {
  if (!localValue) return "";
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** يحوّل datetime-local إلى ISO؛ يرمي خطأ واضح عند غياب التاريخ أو عدم ترتيبه. */
export function requiredIso(
  localValue: string,
  labelAr: string,
  labelEn: string,
  isAr: boolean
): string {
  const iso = toIso(localValue);
  if (!iso)
    throw new Error(isAr ? `${labelAr} غير صالح` : `${labelEn} is invalid`);
  return iso;
}

/** تنسيق مبلغ مالي مختصر مع الرمز إن وُجد. */
export function formatMoney(amount: number, currencyCode?: string): string {
  if (!Number.isFinite(amount)) return "—";
  const value = amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return currencyCode ? `${value} ${currencyCode}` : value;
}

export type ContestAction =
  "schedule" | "publish" | "activate" | "close" | "cancel" | "archive";

/** الأزرار المقترحة لكل حالة — الخادم يرفض ما يخالف آلته الفعلية. */
/** Suggested buttons per status — the server rejects anything outside its real machine. */
export const CONTEST_ACTIONS: Record<string, ContestAction[]> = {
  draft: ["schedule", "publish", "cancel"],
  scheduled: ["publish", "activate", "cancel"],
  published: ["activate", "close", "cancel"],
  active: ["close", "cancel"],
  closed: ["archive"],
  cancelled: ["archive"],
  archived: [],
};

export const CONTEST_ACTION_LABELS: Record<
  ContestAction,
  { ar: string; en: string }
> = {
  schedule: { ar: "جدولة", en: "Schedule" },
  publish: { ar: "نشر", en: "Publish" },
  activate: { ar: "تفعيل", en: "Activate" },
  close: { ar: "إغلاق", en: "Close" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  archive: { ar: "أرشفة", en: "Archive" },
};

export type CouponAction = "activate" | "disable" | "expire";

export const COUPON_ACTIONS: Record<string, CouponAction[]> = {
  draft: ["activate"],
  active: ["disable", "expire"],
  disabled: ["activate"],
  expired: [],
};

export const COUPON_ACTION_LABELS: Record<
  CouponAction,
  { ar: string; en: string }
> = {
  activate: { ar: "تفعيل", en: "Activate" },
  disable: { ar: "تعطيل", en: "Disable" },
  expire: { ar: "إتهاء", en: "Expire" },
};

// إجراءات تسليم الجوائز — الأزرار للعرض فقط والخادم يملك آلة الحالة (§11.1)
// Award fulfillment actions — buttons are suggestive only; the server owns the state machine.
export type AwardAction =
  "notify" | "fulfill" | "ship" | "deliver" | "expire" | "reject";

export const AWARD_ACTIONS: AwardAction[] = [
  "notify",
  "fulfill",
  "ship",
  "deliver",
  "expire",
  "reject",
];

export const AWARD_ACTION_LABELS: Record<
  AwardAction,
  { ar: string; en: string }
> = {
  notify: { ar: "إخطار الفائز", en: "Notify winner" },
  fulfill: { ar: "تجهيز للجائزة", en: "Pending fulfilment" },
  ship: { ar: "شحن", en: "Ship" },
  deliver: { ar: "تسليم", en: "Deliver" },
  expire: { ar: "انتهاء المهلة", en: "Expire" },
  reject: { ar: "رفض", en: "Reject" },
};

/** ألوان شارة الحالة — موحّدة بين كل تبويبات القسم (DRY). */
export function statusTone(status: string): string {
  switch (status) {
    case "active":
    case "published":
    case "eligible":
    case "delivered":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "draft":
    case "scheduled":
    case "submitted":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "closed":
    case "disabled":
    case "expired":
    case "ineligible":
    case "cancelled":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "archived":
    case "disqualified":
    case "rejected":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}

/** يولّد مفتاح تكرار ثابت للعمليات العابرة — الخادم يستخدمه لعدم التكرار. */
export function makeIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/** يقرأ رسالة الخطأ الآمنة من غلاف العقد، ويستخدم بديلًا عند غيابها. */
/** Reads the safe error message from the contract envelope, falling back when absent. */
export function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { message?: string })?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}
