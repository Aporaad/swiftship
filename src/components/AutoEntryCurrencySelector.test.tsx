import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AutoEntryCurrencySelector, ORDER_DEFAULT_CURRENCY_VALUE } from './AutoEntryCurrencySelector';

describe('AutoEntryCurrencySelector', () => {
  it('renders the order-default option with an empty stored value and every database currency supplied to it', () => {
    const html = renderToStaticMarkup(
      <AutoEntryCurrencySelector
        isAr
        value={undefined}
        onChange={() => undefined}
        currencies={[
          { cur_id: 1, code: 'YER', main_nameAR: 'ريال يمني', sup_nameAR: '', main_nameEn: 'Yemeni Rial', sup_nameEn: '', symbol: '﷼', flag: '🇾🇪', isDefault: true, isActive: true, createdAt: '' },
          { cur_id: 2, code: 'EUR', main_nameAR: 'يورو', sup_nameAR: '', main_nameEn: 'Euro', sup_nameEn: '', symbol: '€', flag: '🇪🇺', isDefault: false, isActive: true, createdAt: '' },
        ]}
      />,
    );

    expect(ORDER_DEFAULT_CURRENCY_VALUE).toBe('');
    expect(html).toContain('عملة الطلب الافتراضية (لا تحفظ عملة)');
    expect(html).toContain('value=""');
    expect(html).toContain('YER — ريال يمني');
    expect(html).toContain('EUR — يورو');
    expect(html).toContain('الخيارات المتاحة تُجلب من جدول العملات النشطة.');
  });
});
