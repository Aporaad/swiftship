import type { Currency } from '../services/currencyService';

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
  return (
    <label className="space-y-1" data-testid="auto-entry-currency-selector">
      <span className="block text-[10px] font-black text-slate-400 uppercase">
        {isAr ? 'عملة القيد والنتيجة' : 'Voucher target currency'}
      </span>
      <select
        value={value || ORDER_DEFAULT_CURRENCY_VALUE}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold"
        aria-label={isAr ? 'عملة القيد التلقائي' : 'Automatic voucher currency'}
      >
        <option value={ORDER_DEFAULT_CURRENCY_VALUE}>
          {isAr ? 'عملة الطلب الافتراضية (لا تحفظ عملة)' : 'Order default currency (do not store a currency)'}
        </option>
        {currencies.map((currency) => (
          <option key={currency.cur_id} value={currency.code}>
            {currency.flag ? `${currency.flag} ` : ''}{currency.code} — {isAr ? currency.main_nameAR : currency.main_nameEn}
          </option>
        ))}
      </select>
      <span className="block text-[9px] text-slate-500">
        {loading
          ? (isAr ? 'جارٍ تحميل العملات من قاعدة البيانات…' : 'Loading currencies from the database…')
          : (isAr ? 'الخيارات المتاحة تُجلب من جدول العملات النشطة.' : 'Available options are loaded from active currency records.')}
      </span>
    </label>
  );
}
