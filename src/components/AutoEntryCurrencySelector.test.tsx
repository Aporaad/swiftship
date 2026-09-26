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
          {
            cur_id: 1, code: 'YER',
            // snake_case (DB columns)
            main_name_ar: 'ريال يمني', sub_name_ar: '', main_name_en: 'Yemeni Rial', sub_name_en: '',
            is_default: true, is_active: true, created_at: '',
            // camelCase aliases (backward compat)
            main_nameAR: 'ريال يمني', sup_nameAR: '', main_nameEn: 'Yemeni Rial', sup_nameEn: '',
            isDefault: true, isActive: true, createdAt: '',
            symbol: '﷼', flag: '🇾🇪',
          },
          {
            cur_id: 2, code: 'EUR',
            // snake_case (DB columns)
            main_name_ar: 'يورو', sub_name_ar: '', main_name_en: 'Euro', sub_name_en: '',
            is_default: false, is_active: true, created_at: '',
            // camelCase aliases (backward compat)
            main_nameAR: 'يورو', sup_nameAR: '', main_nameEn: 'Euro', sup_nameEn: '',
            isDefault: false, isActive: true, createdAt: '',
            symbol: '€', flag: '🇪🇺',
          },
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
