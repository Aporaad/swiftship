import type { Currency } from '../services/currencyService';
import { CurrencySelect } from './common/CurrencySelect';

export const ORDER_DEFAULT_CURRENCY_VALUE = '';

export function AutoEntryCurrencySelector({
  isAr,
  currencies,
  loading,
  value,
  onChange,
}: {
  isAr: boolean;
  currencies: Currency[];
  loading?: boolean;
  value?: string;
  onChange: (currency?: string) => void;
}) {
  return <CurrencySelect
    isAr={isAr}
    currencies={currencies.map((currency) => ({
      id: currency.cur_id,
      code: currency.code,
      nameAr: currency.main_nameAR || currency.main_name_ar,
      nameEn: currency.main_nameEn || currency.main_name_en,
      symbol: currency.symbol,
      flag: currency.flag,
    }))}
    value={value || ORDER_DEFAULT_CURRENCY_VALUE}
    onChange={(selected) => onChange(selected || undefined)}
    includeEmptyOption
    emptyOptionLabel={isAr ? 'عملة الطلب الافتراضية (لا تحفظ عملة)' : 'Order default currency (do not store a currency)'}
    label={isAr ? 'عملة القيد والنتيجة' : 'Voucher target currency'}
    loading={loading}
    helperText={isAr ? 'الخيارات المتاحة تُجلب من جدول العملات النشطة.' : 'Available options are loaded from active currency records.'}
    className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold"
    data-testid="auto-entry-currency-selector"
  />;
}
