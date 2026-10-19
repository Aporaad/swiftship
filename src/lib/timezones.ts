/**
 * timezones.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * منطق مناطق التوقيت — Business logic for the display time zone setting.
 *
 * List of zones offered in General Settings + helpers to validate a value and
 * print its live UTC offset. Kept out of the component so the tab only renders.
 * قائمة المناطق المعروضة في الإعدادات مع دوال التحقق وعرض الفارق، خارج المكوّن
 * حتى تبقى واجهة الإعدادات رسمًا فقط.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface TimeZoneOption {
  /** IANA identifier stored in public.settings_general.timezone. */
  value: string;
  labelAr: string;
  labelEn: string;
}

/** قيمة فارغة = «زمن جهاز الموظف» — لا نُخزّن UTC كافتراضي. */
/** An empty value means "the operator's device zone"; we never default to UTC. */
export const DEVICE_TIME_ZONE = '';

export const TIME_ZONE_OPTIONS: TimeZoneOption[] = [
  { value: 'Asia/Aden', labelAr: 'اليمن (عدن)', labelEn: 'Yemen (Aden)' },
  { value: 'Asia/Riyadh', labelAr: 'السعودية (الرياض)', labelEn: 'Saudi Arabia (Riyadh)' },
  { value: 'Asia/Qatar', labelAr: 'قطر (الدوحة)', labelEn: 'Qatar (Doha)' },
  { value: 'Asia/Dubai', labelAr: 'الإمارات (دبي)', labelEn: 'UAE (Dubai)' },
  { value: 'Asia/Kuwait', labelAr: 'الكويت', labelEn: 'Kuwait' },
  { value: 'Africa/Cairo', labelAr: 'مصر (القاهرة)', labelEn: 'Egypt (Cairo)' },
  { value: 'Europe/Istanbul', labelAr: 'تركيا (إسطنبول)', labelEn: 'Türkiye (Istanbul)' },
  { value: 'UTC', labelAr: 'التوقيت العالمي المنسّق UTC', labelEn: 'Coordinated Universal Time' },
];

const supportedZoneCache = new Map<string, boolean>();

/** رفض أي نص غير صالح قبل إرساله — متصفحات قديمة لا تعرف بعض المناطق. */
/** Invalid ids are rejected before they reach the API; some browsers lack certain zones. */
export function isSupportedTimeZone(timeZone: string): boolean {
  if (timeZone === DEVICE_TIME_ZONE) return true;
  const cached = supportedZoneCache.get(timeZone);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    ok = true;
  } catch {
    ok = false;
  }
  supportedZoneCache.set(timeZone, ok);
  return ok;
}

/** المنطقة الفعّالة الآن: إعداد الإدارة أو زمن الجهاز. */
/** The zone actually in effect: the admin's choice, else the device zone. */
export function resolveTimeZone(timeZone?: string | null): string {
  const value = (timeZone ?? '').trim();
  return value && isSupportedTimeZone(value) ? value : Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * فارق المنطقة عن UTC مع مؤشر «+ ساعة» حتى يرى المدير الأثر قبل الحفظ.
 * Live UTC offset, e.g. "UTC+03:00", so the admin sees the effect before saving.
 */
export function timeZoneOffsetLabel(timeZone?: string | null): string {
  const zone = resolveTimeZone(timeZone);
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour') % 24, read('minute'), read('second'));
  // القسمة على 60000 ثم التقريب لأقرب ربع ساعة تتجنّب انحراف ثواني التنفيذ.
  // Rounding the millisecond delta avoids jitter from the seconds between the two reads.
  const offsetMinutes = Math.round((asUtc - now.getTime()) / 60000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}
