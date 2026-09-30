/**
 * Convert between two currencies using rates relative to the configured base currency.
 * A missing or non-positive rate retains the legacy fallback rate of 1.
 */
export function convertToTargetCurrency(
  amount: number,
  fromCurrency: string,
  targetCurrency: string,
  exchangeRates: Record<string, number | undefined>,
): number {
  if (!fromCurrency || !targetCurrency || fromCurrency === targetCurrency) return amount;

  // rate[X] = كم وحدة أساس = 1 وحدة X
  const fromRate = typeof exchangeRates[fromCurrency] === 'number' && (exchangeRates[fromCurrency] as number) > 0
    ? (exchangeRates[fromCurrency] as number)
    : 1;
  const toRate = typeof exchangeRates[targetCurrency] === 'number' && (exchangeRates[targetCurrency] as number) > 0
    ? (exchangeRates[targetCurrency] as number)
    : 1;

  // تحويل: A → عملة أساس → B
  // amount_in_base = amount * fromRate
  // amount_in_B = amount_in_base / toRate
  return (amount * fromRate) / toRate;
}
