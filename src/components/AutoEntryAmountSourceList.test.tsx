import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS } from '../services/autoEntryRules';
import { AutoEntryAmountSourceList } from './AutoEntryAmountSourceList';

describe('AutoEntryAmountSourceList', () => {
  it('renders the Arabic label of every supported amount source', () => {
    const html = renderToStaticMarkup(
      <AutoEntryAmountSourceList isAr selectedSources={['order_total']} onToggle={() => undefined} />,
    );

    expect(html).toContain('data-testid="auto-entry-amount-sources"');
    expect((html.match(/type="checkbox"/g) || [])).toHaveLength(AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS.length);
    for (const option of AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS) {
      expect(html).toContain(option.labelAr);
    }
  });
});
