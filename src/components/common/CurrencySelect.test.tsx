import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CurrencySelect } from './CurrencySelect';

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
});
