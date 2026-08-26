import { describe, expect, it } from 'vitest';
import { calculateOrderPaymentTotals, convertOrderCurrencyAmount } from './orderCurrencyService';

describe('order currency totals', () => {
  const rates = { YER: 1, SAR: 140, USD: 535 };

  it('adds the delivery fee after converting it from its original local currency to the order currency', () => {
    const totals = calculateOrderPaymentTotals({
      orderSubtotal: 100,
      deliveryFeeOriginal: 1400,
      deliveryFeeCurrency: 'YER',
      orderCurrency: 'SAR',
      paymentCurrency: 'SAR',
      rates,
    });

    expect(totals.deliveryFeeOrderCurrency).toBe(10);
    expect(totals.totalOrderCurrency).toBe(110);
    expect(totals.totalPaymentCurrency).toBe(110);
    expect(totals.paymentExchangeRate).toBe(1);
  });

  it('converts the completed order total to the selected payment currency using the payment/order rate', () => {
    const totals = calculateOrderPaymentTotals({
      orderSubtotal: 100,
      deliveryFeeOriginal: 1400,
      deliveryFeeCurrency: 'YER',
      orderCurrency: 'SAR',
      paymentCurrency: 'YER',
      rates,
    });

    expect(totals.totalOrderCurrency).toBe(110);
    expect(totals.totalPaymentCurrency).toBe(15400);
    expect(totals.paymentExchangeRate).toBe(140);
    expect(convertOrderCurrencyAmount(110, 'SAR', 'YER', rates)).toBe(15400);
  });
});
