export type CurrencyRates = Record<string, number | undefined>;

const DEFAULT_RATES: Record<string, number> = { YER: 1, SAR: 140, USD: 535 };

export function getOrderCurrencyRate(currency: string | undefined, rates: CurrencyRates): number {
  const code = String(currency || 'YER').toUpperCase();
  const configuredRate = Number(rates[code]);
  if (Number.isFinite(configuredRate) && configuredRate > 0) return configuredRate;
  return DEFAULT_RATES[code] || 1;
}

export function convertOrderCurrencyAmount(
  amount: number,
  fromCurrency: string | undefined,
  toCurrency: string | undefined,
  rates: CurrencyRates,
): number {
  const value = Number(amount) || 0;
  const from = String(fromCurrency || 'YER').toUpperCase();
  const to = String(toCurrency || 'YER').toUpperCase();
  if (from === to) return value;
  return value * (getOrderCurrencyRate(from, rates) / getOrderCurrencyRate(to, rates));
}

export function calculateOrderPaymentTotals({
  orderSubtotal,
  deliveryFeeOriginal,
  deliveryFeeCurrency,
  orderCurrency,
  paymentCurrency,
  rates,
}: {
  orderSubtotal: number;
  deliveryFeeOriginal: number;
  deliveryFeeCurrency: string;
  orderCurrency: string;
  paymentCurrency: string;
  rates: CurrencyRates;
}) {
  const deliveryFeeOrderCurrency = convertOrderCurrencyAmount(
    deliveryFeeOriginal,
    deliveryFeeCurrency,
    orderCurrency,
    rates,
  );
  const totalOrderCurrency = (Number(orderSubtotal) || 0) + deliveryFeeOrderCurrency;
  const paymentExchangeRate = getOrderCurrencyRate(orderCurrency, rates) / getOrderCurrencyRate(paymentCurrency, rates);
  const totalPaymentCurrency = convertOrderCurrencyAmount(
    totalOrderCurrency,
    orderCurrency,
    paymentCurrency,
    rates,
  );

  return {
    deliveryFeeOrderCurrency,
    totalOrderCurrency,
    totalPaymentCurrency,
    paymentExchangeRate,
  };
}
