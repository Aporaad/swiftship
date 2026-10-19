import type { ChangeEvent } from 'react';

/**
 * CurrencySelect.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * قائمة اختيار العملة الموحّدة لكل أقسام النظام.
 * The single currency picker used across the whole app.
 *
 * القواعد التي يفرضها هذا المكوّن وحده (ولا يُترك كل شاشة تخترعها):
 *   ١) يُظهر الرمز والاسم والعلم وقيمة العملة، ويكتب «افتراضية» بجانب العملة الافتراضية.
 *   ٢) يستبعد العملات المعطّلة من العرض، فلا يمكن اختيارها أصلًا.
 *   ٣) إذا كانت المحفوظة لدى الحقل معطّلة، تُعرض تنبيهًا ويُجبر الاختيار على عملة نشطة.
 *
 * These rules live here once instead of being re-invented per screen:
 *   1) show code + localized name + flag + symbol, and mark the default currency.
 *   2) inactive currencies are never rendered, so they cannot be picked.
 *   3) a stored-but-inactive value is surfaced as a warning, not silently kept selected.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CurrencySelectOption {
  id: string | number;
  code: string;
  nameAr?: string | null;
  nameEn?: string | null;
  symbol?: string | null;
  flag?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

/** الأشكال المختلفة التي تصل بها العملة من الخدمات (camelCase و snake_case وأسماء DB القديمة).
 *  The shapes currencies arrive in: API camelCase, DB snake_case, and legacy column aliases. */
export interface CurrencySelectSource {
  id?: string | number;
  cur_id?: string | number;
  code?: string | null;
  currencyCode?: string | null;
  nameAr?: string | null;
  main_name_ar?: string | null;
  main_nameAR?: string | null;
  mainNameAr?: string | null;
  sub_name_ar?: string | null;
  sup_nameAR?: string | null;
  nameEn?: string | null;
  main_name_en?: string | null;
  main_nameEn?: string | null;
  mainNameEn?: string | null;
  symbol?: string | null;
  flag?: string | null;
  isDefault?: boolean;
  is_default?: boolean;
  isActive?: boolean;
  is_active?: boolean;
}

const firstText = (...values: (string | null | undefined)[]): string | null =>
  values.find(value => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null;

const readId = (currency: CurrencySelectSource, code: string): string | number =>
  currency.cur_id ?? currency.id ?? code;

const readActive = (currency: CurrencySelectSource): boolean =>
  (currency.is_active ?? currency.isActive ?? true) !== false;

/** تحويل سجل عملة (أي مصدر) إلى خيار موحّد للعرض.
 *  Map one currency record of any shape onto the shared display option. */
export function toCurrencySelectOption(currency: CurrencySelectSource): CurrencySelectOption {
  const code = firstText(currency.code, currency.currencyCode) ?? '';
  return {
    id: readId(currency, code),
    code,
    nameAr: firstText(currency.nameAr, currency.main_name_ar, currency.main_nameAR, currency.mainNameAr, currency.sub_name_ar, currency.sup_nameAR),
    nameEn: firstText(currency.nameEn, currency.main_name_en, currency.main_nameEn, currency.mainNameEn),
    symbol: currency.symbol ?? null,
    flag: currency.flag ?? null,
    isDefault: currency.isDefault ?? currency.is_default ?? false,
    isActive: readActive(currency),
  };
}

/** يُسقط المعطّلة قبل الوصول للقائمة حتى لو مرّرها المستدعي كاملة.
 *  Drops inactive rows before the list is built, even when the caller passes everything. */
export function toCurrencySelectOptions(currencies: readonly CurrencySelectSource[]): CurrencySelectOption[] {
  return currencies.map(toCurrencySelectOption).filter(option => option.code && option.isActive !== false);
}

/** نص الخيار الموحّد: العلم + الكود — الاسم (الرمز) + وسم «افتراضية».
 *  One label format for every currency list in the app: flag, code, localized name, symbol, default marker. */
export function currencyOptionLabel(currency: CurrencySelectOption, isAr: boolean): string {
  const name = isAr ? (currency.nameAr || currency.nameEn) : (currency.nameEn || currency.nameAr);
  const marker = currency.isDefault ? (isAr ? '— افتراضية' : '(Default)') : '';
  return [
    `${currency.flag ? `${currency.flag} ` : ''}${currency.code}`,
    name ? `— ${name}` : '',
    currency.symbol ? `(${currency.symbol})` : '',
    marker,
  ].filter(Boolean).join(' ');
}

interface CurrencySelectProps {
  isAr: boolean;
  currencies: CurrencySelectOption[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  includeEmptyOption?: boolean;
  emptyOptionLabel?: string;
  label?: string;
  loading?: boolean;
  helperText?: string;
  className?: string;
  'data-testid'?: string;
  optionValue?: 'code' | 'id';
}

const defaultClassName = 'w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-[#d4af37] disabled:opacity-65 cursor-pointer font-mono';

export function CurrencySelect({
  isAr,
  currencies,
  value = '',
  onChange,
  disabled = false,
  includeEmptyOption = false,
  emptyOptionLabel,
  label,
  loading = false,
  helperText,
  className = defaultClassName,
  'data-testid': testId,
  optionValue = 'code',
}: CurrencySelectProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value);

  // مصدر واحد للحقيقة: المعطّلة لا تصل للخيارات مهما مرّرها المستدعي.
  // Single source of truth: an inactive currency never reaches the option list.
  const options = currencies.filter(currency => currency.isActive !== false);
  const optionKey = (currency: CurrencySelectOption) => (optionValue === 'id' ? String(currency.id) : currency.code);
  const optionNames = options.map(optionKey);
  const selectedKey = value === '' ? '' : (optionValue === 'id' ? String(value) : value);

  // عملة محفوظة معطّلة: نُظهر القائمة فارغة مع تنبيه، لأن إبقاءها مختارة يخالف القاعدة.
  // A stored currency that is now inactive: render the select empty with a warning — keeping it selected breaks the rule.
  const staleSelection = value !== '' && !optionNames.includes(selectedKey);
  const staleCode = staleSelection
    ? (currencies.find(currency => optionKey(currency) === selectedKey)?.code || value)
    : '';
  const shownValue = staleSelection ? '' : value;

  const warning = isAr
    ? `العملة المحفوظة (${staleCode}) معطّلة — اختر عملة نشطة`
    : `Stored currency (${staleCode}) is inactive — pick an active one`;
  const visibleHelper = staleSelection ? warning : helperText;

  return (
    <div className="block space-y-1" data-testid={testId}>
      {label && <span className="block text-[10px] font-black text-slate-400 uppercase">{label}</span>}
      <select disabled={disabled || loading} value={shownValue} onChange={handleChange} className={className}>
        {(includeEmptyOption || staleSelection) && (
          <option value="">
            {emptyOptionLabel || (isAr ? 'اختر العملة' : 'Select currency')}
          </option>
        )}
        {options.map((currency) => (
          <option key={`${currency.id}-${currency.code}`} value={optionKey(currency)}>
            {currencyOptionLabel(currency, isAr)}
          </option>
        ))}
      </select>
      {(loading || visibleHelper) && (
        <span className={`block text-[9px] ${staleSelection ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
          {loading ? (isAr ? 'جارٍ تحميل العملات…' : 'Loading currencies…') : visibleHelper}
        </span>
      )}
    </div>
  );
}
