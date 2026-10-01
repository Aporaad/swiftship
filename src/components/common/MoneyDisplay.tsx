import type { ReactNode } from 'react';

export interface MoneyDisplayProps {
  amount: number;
  currency?: string | null;
  prefix?: string;
  currencyClassName?: string;
}

export function MoneyDisplay({ amount, currency, prefix = '', currencyClassName }: MoneyDisplayProps): ReactNode {
  return (
    <>
      {prefix}{amount.toLocaleString()}
      {currency && <span className={currencyClassName}>{` ${currency}`}</span>}
    </>
  );
}
