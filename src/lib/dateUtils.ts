// أدوات التاريخ: مصدر واحد لعرض التوقيت في كل الواجهة.
// Date utilities: the single place the UI renders timestamps.
//
// المشكلة القديمة: كل الدوال كانت تعود نص UTC (`toISOString`) فتظهر المواعيد متأخرة ساعات عن
// ساعة الموظف؛ والحل أن تمرّ كلها عبر `Intl.DateTimeFormat` بمنطقة العرض المعدّة إداريًا.
// The old helpers returned UTC text, so every timestamp was hours off the operator's clock. They now
// format through Intl.DateTimeFormat using the display zone chosen in General Settings.

/** منطقة العرض: من إعداد الإدارة، ولو غيّرت بقي زمن المتصفح — لا فرض UTC. */
let displayTimeZone: string | null = null;
let cachedFormatter: Intl.DateTimeFormat | null = null;
const localizedFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * ضبط منطقة العرض من الإعدادات — called once when settings load.
 * قيمة فارغة تعني «استخدم زمن الجهاز»، وهو السلوك الذي يتوقعه المستخدم.
 * An empty value means "use the device zone", which is what the operator expects.
 */
export function setDisplayTimeZone(timeZone: string | null | undefined): void {
  const next = typeof timeZone === 'string' ? timeZone.trim() : '';
  // منطقة غير معروفة تُتجاهَل بدل أن ترمي Intl استثناءً يُسقط كل شاشة تعرض موعدًا.
  // An unknown zone is dropped: Intl would throw and take down every timestamp on screen.
  if (next) {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: next });
    } catch {
      return;
    }
  }
  if (next === (displayTimeZone ?? '')) return;
  displayTimeZone = next || null;
  cachedFormatter = null;
  localizedFormatters.clear();
}

export function getDisplayTimeZone(): string {
  return displayTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatter(): Intl.DateTimeFormat {
  if (!cachedFormatter) {
    cachedFormatter = new Intl.DateTimeFormat('en-GB', {
      ...(displayTimeZone ? { timeZone: displayTimeZone } : {}),
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }
  return cachedFormatter;
}

interface DateTimeParts {
  date: string;
  time: string;
}

function readParts(value: Date | string | number): DateTimeParts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Map(formatter().formatToParts(date).map((part) => [part.type, part.value]));
  // '24' يظهر في بعض المناطق بدل '00' عند منتصف الليل — توحيد يمنع تواريخ غير قابلة للتحليل.
  // Some locales report '24' instead of '00' at midnight; normalising keeps parsed values valid.
  const hour = parts.get('hour') === '24' ? '00' : parts.get('hour') ?? '00';
  return {
    date: `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`,
    time: `${hour}:${parts.get('minute') ?? '00'}`,
  };
}

export const formatDateTime = (date: Date | string | number = new Date()): string => {
  const parts = readParts(date);
  return parts ? `${parts.date} ${parts.time}` : '';
};

export const formatDate = (date: Date | string | number = new Date()): string => readParts(date)?.date ?? '';

export const formatTime = (date: Date | string | number = new Date()): string => readParts(date)?.time ?? '';

/** قيمة حقل تاريخ (YYYY-MM-DD) بمنطقة العرض، بدل قطع سلسلة UTC. */
/** The value for a date input, taken in the display zone instead of slicing a UTC string. */
export const toDateInputValue = (date: Date | string | number = new Date()): string => formatDate(date);

/** قيمة حقل تاريخ ووقت (YYYY-MM-DDTHH:mm) بمنطقة العرض لحقول datetime-local. */
/** The value for a datetime-local input, in the display zone instead of a sliced UTC string. */
export const toDateTimeInputValue = (date: Date | string | number = new Date()): string => {
  const parts = readParts(date);
  return parts ? `${parts.date}T${parts.time}` : '';
};

/** الآن بصيغة ISO كاملة — للنقل إلى الـ API، لا للعرض. */
/** Full ISO timestamp for API payloads only — never for display. */export const toISOStringWithTimezone = (date: Date | string | number = new Date()): string => {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

export const now = (): string => formatDateTime(new Date());

/**
 * عرض مقروء بلغة الواجهة مع الالتزام بمنطقة الإدارة — `toLocaleString` المباشرة تتجاهلها.
 * Human-readable rendering in the UI language that still honours the admin's zone; a bare
 * `toLocaleString()` follows the browser clock and silently disagrees with the settings.
 */
function localizedFormatter(isArabic: boolean, withTime: boolean): Intl.DateTimeFormat {
  const key = `${isArabic ? 'ar' : 'en'}|${withTime ? 'dt' : 'd'}|${displayTimeZone ?? 'device'}`;
  let cached = localizedFormatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(isArabic ? 'ar-EG' : 'en-GB', {
      ...(displayTimeZone ? { timeZone: displayTimeZone } : {}),
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' } : {}),
    });
    localizedFormatters.set(key, cached);
  }
  return cached;
}

export const formatDateLocalized = (date: Date | string | number | null | undefined, isArabic: boolean): string => {
  if (date === null || date === undefined || date === '') return '';
  const value = date instanceof Date ? date : new Date(date);
  return Number.isNaN(value.getTime()) ? '' : localizedFormatter(isArabic, false).format(value);
};

export const formatDateTimeLocalized = (date: Date | string | number | null | undefined, isArabic: boolean): string => {
  if (date === null || date === undefined || date === '') return '';
  const value = date instanceof Date ? date : new Date(date);
  return Number.isNaN(value.getTime()) ? '' : localizedFormatter(isArabic, true).format(value);
};
