import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CurrencySelect, toCurrencySelectOptions } from './CurrencySelect';

describe('CurrencySelect', () => {
  const currencies = [
    { id: 1, code: 'YER', nameAr: 'ريال يمني', nameEn: 'Yemeni Rial', symbol: '﷼', flag: '🇾🇪' },
    { id: 2, code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€' },
  ];

  it('renders an optional empty choice and localized currency labels', () => {
    const html = renderToStaticMarkup(
      <CurrencySelect
        isAr
        currencies={currencies}
        value=""
        onChange={() => undefined}
        includeEmptyOption
        emptyOptionLabel="عملة الطلب الافتراضية"
        label="العملة"
      />,
    );

    expect(html).toContain('عملة الطلب الافتراضية');
    expect(html).toContain('🇾🇪 YER — ريال يمني (﷼)');
    expect(html).toContain('EUR — يورو (€)');
    expect(html).toContain('value=""');
  });

  it('uses the English label when Arabic is disabled and preserves disabled state', () => {
    const html = renderToStaticMarkup(
      <CurrencySelect
        isAr={false}
        currencies={currencies}
        value="EUR"
        onChange={() => undefined}
        disabled
      />,
    );

    expect(html).toContain('value="EUR"');
    expect(html).toContain('EUR — Euro (€)');
    expect(html).toContain('disabled=""');
  });

  it('supports numeric option values and marks the default currency', () => {
    const html = renderToStaticMarkup(
      <CurrencySelect
        isAr={false}
        currencies={[{ id: 7, code: 'SAR', isDefault: true }]}
        optionValue="id"
        value="7"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('value="7"');
    expect(html).toContain('SAR (Default)');
  });

  it('never offers an inactive currency, even when the caller passes the full list', () => {
    const html = renderToStaticMarkup(
      <CurrencySelect
        isAr
        currencies={[
          { id: 1, code: 'YER', nameAr: 'ريال يمني', isActive: true },
          { id: 2, code: 'TRY', nameAr: 'ليرة', isActive: false },
        ]}
        value="YER"
        onChange={() => undefined}
      />,
    );

    expect(html).not.toContain('TRY');
    expect(html).toContain('YER — ريال يمني');
  });

  it('warns instead of keeping a stored currency that has since been disabled', () => {
    const html = renderToStaticMarkup(
      <CurrencySelect
        isAr={false}
        currencies={[{ id: 'EUR', code: 'EUR', isActive: false }, { id: 'USD', code: 'USD' }]}
        value="EUR"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('value=""');
    expect(html).toContain('Stored currency (EUR) is inactive');
    expect(html).toContain('USD');
  });
});

describe('toCurrencySelectOptions', () => {
  it('normalizes database and API shapes, then drops inactive rows', () => {
    const options = toCurrencySelectOptions([
      { cur_id: 140, code: 'SAR', main_name_ar: 'ريال سعودي', symbol: 'ر.س', is_default: true, is_active: true },
      { cur_id: 535, code: 'USD', main_nameAR: 'دولار أمريكي', isActive: false },
      { cur_id: 1, code: 'YER', main_name_en: 'Yemeni Rial' },
    ]);

    expect(options).toEqual([
      { id: 140, code: 'SAR', nameAr: 'ريال سعودي', nameEn: null, symbol: 'ر.س', flag: null, isDefault: true, isActive: true },
      { id: 1, code: 'YER', nameAr: null, nameEn: 'Yemeni Rial', symbol: null, flag: null, isDefault: false, isActive: true },
    ]);
  });
});
