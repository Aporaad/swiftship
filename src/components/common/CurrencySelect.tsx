import type { ChangeEvent } from 'react';

export interface CurrencySelectOption {
  id: string | number;
  code: string;
  nameAr?: string | null;
  nameEn?: string | null;
  symbol?: string | null;
  flag?: string | null;
  isDefault?: boolean;
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
  showDefaultMarker?: boolean;
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
  showDefaultMarker = false,
}: CurrencySelectProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value);

  return (
    <div className="block space-y-1" data-testid={testId}>
      {label && <span className="block text-[10px] font-black text-slate-400 uppercase">{label}</span>}
      <select disabled={disabled || loading} value={value} onChange={handleChange} className={className}>
        {includeEmptyOption && (
          <option value="">
            {emptyOptionLabel || (isAr ? 'اختر العملة' : 'Select currency')}
          </option>
        )}
        {currencies.map((currency) => (
          <option key={currency.id} value={optionValue === 'id' ? String(currency.id) : currency.code}>
            {currency.flag ? `${currency.flag} ` : ''}
            {currency.code}
            {(isAr ? currency.nameAr || currency.nameEn : currency.nameEn || currency.nameAr) &&
              ` — ${isAr ? currency.nameAr || currency.nameEn : currency.nameEn || currency.nameAr}`}
            {currency.symbol ? ` (${currency.symbol})` : ''}
            {showDefaultMarker && currency.isDefault ? (isAr ? ' — افتراضية' : ' (Default)') : ''}
          </option>
        ))}
      </select>
      {(loading || helperText) && <span className="block text-[9px] text-slate-500">{loading ? (isAr ? 'جارٍ تحميل العملات…' : 'Loading currencies…') : helperText}</span>}
    </div>
  );
}
