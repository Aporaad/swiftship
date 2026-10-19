import { describe, expect, it } from 'vitest';
import { currencyOptionLabel, toCurrencySelectOptions } from './CurrencySelect';
import { toFinanceCurrencies } from '../../shared/contracts/finance.contracts';

/** صفوف عملات كما تعيدها /api/v1/currencies بأسماء DB القديمة (snake_case). */
const apiRows = [
  { currencyId: 1, code: 'YER', mainNameAr: 'ريال يمني', mainNameEn: 'Yemeni Rial', symbol: '﷼', flag: '🇾🇪', isDefault: true, isActive: true },
  { currencyId: 2, code: 'SAR', main_name_ar: 'ريال سعودي', main_name_en: 'Saudi Riyal', symbol: 'ر.س', is_active: true },
  { currencyId: 3, code: 'TRY', mainNameAr: 'ليرة تركية', symbol: '₺', isActive: false },
];

describe('toFinanceCurrencies — قراءة العملة الموحّدة', () => {
  it('يحمل الأسماء والرمز وحالة التفعيل من أي شكل صفوف بدل إسقاطها', () => {
    const currencies = toFinanceCurrencies(apiRows);

    expect(currencies[0]).toMatchObject({ id: 1, code: 'YER', nameAr: 'ريال يمني', symbol: '﷼', isDefault: true, isActive: true });
    expect(currencies[1]).toMatchObject({ id: 2, code: 'SAR', nameAr: 'ريال سعودي', isActive: true });
    expect(currencies[2]).toMatchObject({ code: 'TRY', isActive: false });
  });
});

describe('قائمة اختيار العملة — قاعدة العرض الموحّدة', () => {
  it('يستبعد المعطّلة ويعرض الرمز مع الاسم ويوسم الافتراضية', () => {
    const options = toCurrencySelectOptions(toFinanceCurrencies(apiRows));

    expect(options.map((option) => option.code)).toEqual(['YER', 'SAR']);
    expect(currencyOptionLabel(options[0], true)).toBe('🇾🇪 YER — ريال يمني (﷼) — افتراضية');
    expect(currencyOptionLabel(options[1], true)).toContain('(ر.س)');
  });
});
