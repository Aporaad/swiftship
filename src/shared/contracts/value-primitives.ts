/** Shared value primitives used at external-data and DTO boundaries. */
export type IsoDateString = string & { readonly __brand: 'IsoDateString' };
export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };
export type Amount = number & { readonly __brand: 'Amount' };
export type OriginalAmount = number & { readonly __brand: 'OriginalAmount' };
export type ConvertedAmount = number & { readonly __brand: 'ConvertedAmount' };
export type ExchangeRate = number & { readonly __brand: 'ExchangeRate' };
export type StatusCode = string & { readonly __brand: 'StatusCode' };
export type ApprovalStatus = 'approved' | 'pending_approval' | 'rejected';
export type PostingStatus = 'draft' | 'posted' | 'voided';
export type PaymentStatus = 'Paid' | 'Partial Paid' | 'Unpaid';
export type OrderStatus = string & { readonly __brand: 'OrderStatus' };
export type ShipmentStatus = string & { readonly __brand: 'ShipmentStatus' };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,9}$/;

export function isoDateOrNull(value: unknown): IsoDateString | null {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : (value as IsoDateString);
}

export function currencyCodeOrNull(value: unknown): CurrencyCode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return CURRENCY_PATTERN.test(normalized) ? (normalized as CurrencyCode) : null;
}

export function amountOrNull(value: unknown): Amount | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? (parsed as Amount) : null;
}

function finiteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function originalAmountOrNull(value: unknown): OriginalAmount | null {
  const parsed = finiteNumberOrNull(value);
  return parsed === null ? null : (parsed as OriginalAmount);
}

export function convertedAmountOrNull(value: unknown): ConvertedAmount | null {
  const parsed = finiteNumberOrNull(value);
  return parsed === null ? null : (parsed as ConvertedAmount);
}

export function exchangeRateOrNull(value: unknown): ExchangeRate | null {
  const parsed = finiteNumberOrNull(value);
  return parsed === null || parsed <= 0 ? null : (parsed as ExchangeRate);
}

export function statusCodeOrNull(value: unknown): StatusCode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? (normalized as StatusCode) : null;
}

export function approvalStatusOrNull(value: unknown): ApprovalStatus | null {
  return value === 'approved' || value === 'pending_approval' || value === 'rejected' ? value : null;
}

export function postingStatusOrNull(value: unknown): PostingStatus | null {
  return value === 'draft' || value === 'posted' || value === 'voided' ? value : null;
}

export function paymentStatusOrNull(value: unknown): PaymentStatus | null {
  if (value === 'Paid' || value === 'paid') return 'Paid';
  if (value === 'Partial Paid' || value === 'partial_paid' || value === 'partial') return 'Partial Paid';
  if (value === 'Unpaid' || value === 'unpaid') return 'Unpaid';
  return null;
}

export function orderStatusOrNull(value: unknown): OrderStatus | null {
  const status = statusCodeOrNull(value);
  return status ? (status as unknown as OrderStatus) : null;
}

export function shipmentStatusOrNull(value: unknown): ShipmentStatus | null {
  const status = statusCodeOrNull(value);
  return status ? (status as unknown as ShipmentStatus) : null;
}
