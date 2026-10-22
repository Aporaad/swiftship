/**
 * DatePickerInput — مكون إدخال التاريخ والوقت المتقدم
 * Advanced date/time picker with calendar popup for all system interfaces
 *
 * يدعم ثلاثة أوضاع:
 * - "date"          → تحديد تاريخ فقط (يوم / شهر / سنة)
 * - "time"          → تحديد وقت فقط (ساعة / دقيقة)
 * - "datetime-local"→ تحديد تاريخ + وقت معًا
 *
 * الاستخدام:
 *   <DatePickerInput
 *     type="date"
 *     value={value}
 *     onChange={setValue}
 *     label="تاريخ الانطلاق"
 *     placeholder="اختر التاريخ"
 *   />
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";

// ─── أنواع الخصائص ────────────────────────────────────────────────────────────
export interface DatePickerInputProps {
  /** نمط الحقل: تاريخ أو وقت أو الاثنان معًا */
  type?: "date" | "time" | "datetime-local";

  /** القيمة الحالية (بتنسيق ISO: YYYY-MM-DD أو HH:mm أو YYYY-MM-DDTHH:mm) */
  value: string;

  /** دالة تُستدعى عند تغيير القيمة */
  onChange: (value: string) => void;

  /** تسمية الحقل (اختيارية) */
  label?: string;

  /** نص placeholder (اختياري) */
  placeholder?: string;

  /** CSS إضافي للحاوية الخارجية */
  className?: string;

  /** CSS إضافي لحقل الإدخال */
  inputClassName?: string;

  /** هل الحقل إلزامي */
  required?: boolean;

  /** هل الحقل معطل */
  disabled?: boolean;

  /** معرف فريد للحقل */
  id?: string;

  /** الحد الأدنى للتاريخ/الوقت */
  min?: string;

  /** الحد الأقصى للتاريخ/الوقت */
  max?: string;

  /** اسم الحقل (للنماذج) */
  name?: string;
}

// ─── دوال المساعدة ─────────────────────────────────────────────────────────────
/** تنسيق عرض التاريخ للمستخدم */
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-");
    if (!y || !m || !d) return dateStr;
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

/** تنسيق عرض الوقت للمستخدم */
function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0]!, 10);
  const m = parts[1];
  const ampm = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
}

/** تنسيق عرض التاريخ والوقت معًا */
function formatDateTimeDisplay(dtStr: string): string {
  if (!dtStr) return "";
  const [datePart, timePart] = dtStr.split("T");
  if (!datePart) return dtStr;
  const dateFormatted = formatDateDisplay(datePart);
  const timeFormatted = timePart ? formatTimeDisplay(timePart.slice(0, 5)) : "";
  return timeFormatted ? `${dateFormatted} — ${timeFormatted}` : dateFormatted;
}

/** استخراج جزء التاريخ */
function getDatePart(value: string): string {
  if (!value) return "";
  return value.split("T")[0] ?? "";
}

/** استخراج جزء الوقت */
function getTimePart(value: string): string {
  if (!value) return "";
  const parts = value.split("T");
  if (parts.length < 2) return "";
  return (parts[1] ?? "").slice(0, 5);
}

/** إنشاء قيمة datetime-local */
function buildDateTimeValue(date: string, time: string): string {
  if (!date) return "";
  if (!time) return `${date}T00:00`;
  return `${date}T${time}`;
}

// ─── مكون التقويم ──────────────────────────────────────────────────────────────
const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const DAYS_AR = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"];

interface CalendarPanelProps {
  selectedDate: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
  min?: string;
  max?: string;
}

function CalendarPanel({
  selectedDate,
  onSelect,
  min,
  max,
}: CalendarPanelProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate)
      return parseInt(
        selectedDate.split("-")[0] ?? String(today.getFullYear()),
        10
      );
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate)
      return (
        parseInt(
          selectedDate.split("-")[1] ?? String(today.getMonth() + 1),
          10
        ) - 1
      );
    return today.getMonth();
  });
  const [showYearGrid, setShowYearGrid] = useState(false);

  /** أيام الشهر الحالي مع فراغات للبداية */
  const calDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return [...blanks, ...days];
  }, [viewYear, viewMonth]);

  /** التحقق من تعطيل يوم */
  const isDayDisabled = useCallback(
    (day: number) => {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (min && dateStr < min) return true;
      if (max && dateStr > max) return true;
      return false;
    },
    [viewYear, viewMonth, min, max]
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else setViewMonth(m => m + 1);
  };

  const handleDayClick = (day: number | null) => {
    if (!day) return;
    if (isDayDisabled(day)) return;
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onSelect(dateStr);
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const currentStr = selectedDate || "";

  // نطاق السنوات للاختيار
  const yearRange = useMemo(() => {
    const base = viewYear - 6;
    return Array.from({ length: 14 }, (_, i) => base + i);
  }, [viewYear]);

  return (
    <div className="dpi-cal-panel" dir="rtl">
      {/* رأس التقويم */}
      <div className="dpi-cal-header">
        <button
          type="button"
          className="dpi-cal-nav-btn"
          onClick={prevMonth}
          aria-label="الشهر السابق"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="dpi-cal-title-btn"
          onClick={() => setShowYearGrid(v => !v)}
        >
          {MONTHS_AR[viewMonth]} {viewYear}
        </button>

        <button
          type="button"
          className="dpi-cal-nav-btn"
          onClick={nextMonth}
          aria-label="الشهر التالي"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {showYearGrid ? (
        /* شبكة اختيار السنة */
        <div className="dpi-year-grid">
          {yearRange.map(yr => (
            <button
              key={yr}
              type="button"
              className={`dpi-year-btn ${yr === viewYear ? "dpi-year-btn--active" : ""}`}
              onClick={() => {
                setViewYear(yr);
                setShowYearGrid(false);
              }}
            >
              {yr}
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* أسماء أيام الأسبوع */}
          <div className="dpi-weekdays">
            {DAYS_AR.map(d => (
              <div key={d} className="dpi-weekday">
                {d}
              </div>
            ))}
          </div>

          {/* أيام الشهر */}
          <div className="dpi-days-grid">
            {calDays.map((day, idx) => {
              if (!day) return <div key={`blank-${idx}`} />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === currentStr;
              const isDisabled = isDayDisabled(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDayClick(day)}
                  className={[
                    "dpi-day-btn",
                    isToday && !isSelected ? "dpi-day-btn--today" : "",
                    isSelected ? "dpi-day-btn--selected" : "",
                    isDisabled ? "dpi-day-btn--disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* زر اليوم */}
          <div className="dpi-cal-footer">
            <button
              type="button"
              className="dpi-today-btn"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                onSelect(todayStr);
              }}
            >
              اليوم
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── مكون اختيار الوقت ────────────────────────────────────────────────────────
interface TimePickerPanelProps {
  value: string; // HH:mm
  onChange: (time: string) => void;
}

function TimePickerPanel({ value, onChange }: TimePickerPanelProps) {
  const [hour, setHour] = useState(() => {
    if (!value) return 12;
    return parseInt(value.split(":")[0] ?? "12", 10) % 12 || 12;
  });
  const [minute, setMinute] = useState(() => {
    if (!value) return 0;
    return parseInt(value.split(":")[1] ?? "0", 10);
  });
  const [isPm, setIsPm] = useState(() => {
    if (!value) return false;
    return parseInt(value.split(":")[0] ?? "0", 10) >= 12;
  });

  // إرسال القيمة فقط عند نداء المستخدم الصريح — لا عند فتح اللوحة.
  // Publish only on explicit user interaction — never on panel mount.
  // (إصلاح: كان useEffect يطلق onChange افتراضيًا 00:00 بمجرد الفتح فيملأ الحقل قبل الاختيار)
  // (Fix: the mount useEffect used to emit a default 00:00 onChange, pre-filling the field before any pick)
  const publish = useCallback(
    (h: number, m: number, pm: boolean) => {
      const h24 = pm ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
      onChange(`${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    },
    [onChange]
  );

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className="dpi-time-panel" dir="rtl">
      <div className="dpi-time-label">
        <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
        <span>اختر الوقت</span>
      </div>
      <div className="dpi-time-row">
        {/* الساعات */}
        <div className="dpi-scroll-col">
          <div className="dpi-scroll-title">الساعة</div>
          <div className="dpi-scroll-list">
            {hours.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setHour(h);
                  publish(h, minute, isPm);
                }}
                className={`dpi-scroll-item ${h === hour ? "dpi-scroll-item--active" : ""}`}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>

        <div className="dpi-time-colon">:</div>

        {/* الدقائق */}
        <div className="dpi-scroll-col">
          <div className="dpi-scroll-title">الدقيقة</div>
          <div className="dpi-scroll-list">
            {minutes.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMinute(m);
                  publish(hour, m, isPm);
                }}
                className={`dpi-scroll-item ${m === minute ? "dpi-scroll-item--active" : ""}`}
              >
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>

        {/* AM / PM */}
        <div className="dpi-scroll-col">
          <div className="dpi-scroll-title">ص/م</div>
          <div className="dpi-ampm-col">
            <button
              type="button"
              onClick={() => {
                setIsPm(false);
                publish(hour, minute, false);
              }}
              className={`dpi-ampm-btn ${!isPm ? "dpi-ampm-btn--active" : ""}`}
            >
              ص
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPm(true);
                publish(hour, minute, true);
              }}
              className={`dpi-ampm-btn ${isPm ? "dpi-ampm-btn--active" : ""}`}
            >
              م
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── المكون الرئيسي ────────────────────────────────────────────────────────────
export function DatePickerInput({
  type = "date",
  value,
  onChange,
  label,
  placeholder,
  className = "",
  inputClassName = "",
  required = false,
  disabled = false,
  id: externalId,
  min,
  max,
  name,
}: DatePickerInputProps) {
  const generatedId = useId();
  const inputId = externalId ?? generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"date" | "time">("date");
  const containerRef = useRef<HTMLDivElement>(null);
  // مرجع النافذة المُبوَّبة خارج شجرة DOM للحقل (انظر updatePopupPosition أدناه).
  // Ref for the portaled popup (rendered on document.body, outside the field subtree).
  const popupRef = useRef<HTMLDivElement>(null);

  // مزامنة التبويب النشط مع نوع الحقل
  useEffect(() => {
    setActiveTab(type === "time" ? "time" : "date");
  }, [type]);

  // إغلاق عند النقر خارج المكون — النقر داخل النافذة المُبوَّبة لا يُعد "خارجًا".
  // Close on outside click — clicks inside the portaled popup must NOT count as outside.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // ─── وضع النافذة الثابت (portal) — إصلاح جذري ──────────────────────────────
  // Fixed-position portal popup — root-cause fix for two proven defects:
  // 1) قصّ البطاقات القابلة للتمرير (overflow-y-auto مثل FormModal) للنافذة المطلقة
  //    داخلها يجعل أزرار الأيام غير مرئية/غير قابلة للنقر (elementFromPoint = null).
  //    Scrollable modal cards (overflow-y-auto, e.g. FormModal) clipped the absolutely
  //    positioned popup, making day buttons unreachable.
  // 2) إعادة توجيه عناصر <label> المغلّفة للحقل للنقرة الأولى نحو أول زر داخل النافذة.
  //    Wrapping <label> elements re-dispatched field clicks onto the popup's first button.
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: -9999,
    left: -9999,
    visibility: "hidden",
  });

  const updatePopupPosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    // حجم ثابت مضغوط للنافذة — لا تتمدد لعرض الحقل (طلب المالك 2026-10-22: التصغير كثيرا).
    // Fixed compact popup width — it must NOT stretch to the field width (owner request).
    const popupW = 220;
    const popupH = popupRef.current?.offsetHeight || 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    // قلب لأعلى عند ضيق المسافة السفلية (سلوك قياسي لمنتقيات التاريخ).
    // Flip upward when there is not enough room below the field.
    const openUpward = spaceBelow < popupH + margin && rect.top > spaceBelow;
    const top = openUpward
      ? Math.max(margin, rect.top - popupH - margin)
      : rect.bottom + margin;
    // محاذاة الحافة اليمنى (واجهة RTL) مع تقييد داخل حدود الشاشة.
    // Right-edge alignment (RTL UI), clamped inside the viewport.
    const left = Math.min(
      Math.max(margin, rect.right - popupW),
      Math.max(margin, window.innerWidth - popupW - margin)
    );
    setPopupStyle({
      position: "fixed",
      top,
      left,
      // إلغاء right:0 من CSS — في الاتجاه RTL يتجاهل المتصفح left عند تعارض
      // left+right+width فتقفز النافذة لحافة الشاشة بدل مجاورة الحقل.
      // Neutralize the stylesheet's right:0 — in RTL browsers drop `left` when
      // left+right+width conflict, throwing the popup to the screen edge.
      right: "auto",
      bottom: "auto",
      width: popupW,
      minWidth: popupW,
      visibility: "visible",
    });
  }, []);

  // useLayoutEffect: القياس قبل الرسم؛ والتمرير/تغيير الحجم يحدّث الموضع فورًا.
  // Measure before paint; keep the popup glued to the field on scroll/resize.
  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePopupPosition();
    // تمرير ثانٍ بعد معرفة الارتفاع الفعلي للنافذة (كان مخفيًا في القياس الأول).
    // Second pass once the real popup height is measurable.
    const raf = requestAnimationFrame(updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    window.addEventListener("resize", updatePopupPosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePopupPosition, true);
      window.removeEventListener("resize", updatePopupPosition);
    };
  }, [isOpen, updatePopupPosition]);

  // ─── معالجات التغيير ─────────────────────────────────────────────────────────
  const handleDateSelect = useCallback(
    (date: string) => {
      if (type === "date") {
        onChange(date);
        setIsOpen(false);
      } else if (type === "datetime-local") {
        const timePart = getTimePart(value) || "00:00";
        onChange(buildDateTimeValue(date, timePart));
        setActiveTab("time");
      }
    },
    [type, value, onChange]
  );

  const handleTimeChange = useCallback(
    (time: string) => {
      if (type === "time") {
        onChange(time);
      } else if (type === "datetime-local") {
        const datePart =
          getDatePart(value) || new Date().toISOString().split("T")[0]!;
        onChange(buildDateTimeValue(datePart, time));
      }
    },
    [type, value, onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setIsOpen(false);
    },
    [onChange]
  );

  // ─── تنسيق عرض القيمة ────────────────────────────────────────────────────────
  const displayValue = useMemo(() => {
    if (!value) return "";
    if (type === "date") return formatDateDisplay(value);
    if (type === "time") return formatTimeDisplay(value);
    return formatDateTimeDisplay(value);
  }, [value, type]);

  const placeholderText = useMemo(() => {
    if (placeholder) return placeholder;
    if (type === "date") return "اختر التاريخ";
    if (type === "time") return "اختر الوقت";
    return "اختر التاريخ والوقت";
  }, [placeholder, type]);

  const IconComponent = type === "time" ? Clock : Calendar;

  return (
    <div ref={containerRef} className={`dpi-wrapper ${className}`}>
      {/* حقل الإدخال الظاهر للمستخدم */}
      <div
        className={`dpi-input-box ${disabled ? "dpi-input-box--disabled" : ""} ${isOpen ? "dpi-input-box--open" : ""} ${inputClassName}`}
        onClick={() => !disabled && setIsOpen(v => !v)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) setIsOpen(v => !v);
          }
          if (e.key === "Escape") setIsOpen(false);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        id={inputId}
      >
        {/* حقل مخفي للنماذج */}
        {name && (
          <input type="hidden" name={name} value={value} required={required} />
        )}

        {/* أيقونة التقويم/الوقت */}
        <IconComponent
          className={`dpi-input-icon ${isOpen ? "dpi-input-icon--active" : ""}`}
          aria-hidden="true"
        />

        {/* نص العرض */}
        <span
          className={`dpi-input-text ${!displayValue ? "dpi-input-placeholder" : ""}`}
        >
          {displayValue || placeholderText}
        </span>

        {/* زر المسح */}
        {value && !disabled && (
          <button
            type="button"
            className="dpi-clear-btn"
            onClick={handleClear}
            aria-label="مسح القيمة"
            tabIndex={-1}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* نافذة الاختيار — تُبث إلى document.body بوضع fixed لتفلت من أي قصّ/توجيه داخل النماذج المنبثقة */}
      {/* The picker popup is portaled to document.body with fixed positioning to escape clipping/label-forwarding */}
      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            className="dpi-popup"
            role="dialog"
            aria-label="اختيار التاريخ والوقت"
            style={popupStyle}
          >
            {/* التبويبات لوضع datetime-local */}
            {type === "datetime-local" && (
              <div className="dpi-tabs">
                <button
                  type="button"
                  className={`dpi-tab ${activeTab === "date" ? "dpi-tab--active" : ""}`}
                  onClick={() => setActiveTab("date")}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>التاريخ</span>
                  {getDatePart(value) && (
                    <span className="dpi-tab-badge">
                      {formatDateDisplay(getDatePart(value))}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`dpi-tab ${activeTab === "time" ? "dpi-tab--active" : ""}`}
                  onClick={() => setActiveTab("time")}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>الوقت</span>
                  {getTimePart(value) && (
                    <span className="dpi-tab-badge">
                      {formatTimeDisplay(getTimePart(value))}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* عرض التقويم أو الوقت */}
            {type === "time" ? (
              <TimePickerPanel value={value} onChange={handleTimeChange} />
            ) : type === "date" ? (
              <CalendarPanel
                selectedDate={value}
                onSelect={handleDateSelect}
                min={min}
                max={max}
              />
            ) : (
              <>
                {activeTab === "date" && (
                  <CalendarPanel
                    selectedDate={getDatePart(value)}
                    onSelect={handleDateSelect}
                    min={min ? min.split("T")[0] : undefined}
                    max={max ? max.split("T")[0] : undefined}
                  />
                )}
                {activeTab === "time" && (
                  <TimePickerPanel
                    value={getTimePart(value)}
                    onChange={handleTimeChange}
                  />
                )}
              </>
            )}

            {/* زر التأكيد */}
            <div className="dpi-popup-footer">
              <button
                type="button"
                className="dpi-confirm-btn"
                onClick={() => setIsOpen(false)}
              >
                ✓ تأكيد
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default DatePickerInput;
