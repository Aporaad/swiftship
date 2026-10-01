import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MoneyDisplay } from './MoneyDisplay';

describe('MoneyDisplay', () => {
  it('renders a signed amount with its currency and currency class', () => {
    const html = renderToStaticMarkup(
      <MoneyDisplay amount={12500} prefix="+" currency="YER" currencyClassName="muted-currency" />,
    );

    expect(html).toContain('+12,500');
    expect(html).toContain('YER');
    expect(html).toContain('class="muted-currency"');
  });

  it('renders zero without a currency when no currency is supplied', () => {
    expect(renderToStaticMarkup(<MoneyDisplay amount={0} />)).toBe('0');
  });
});
