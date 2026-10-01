import { describe, expect, it } from 'vitest';
import { amountOrNull, approvalStatusOrNull, currencyCodeOrNull, isoDateOrNull, orderStatusOrNull, paymentStatusOrNull, postingStatusOrNull, shipmentStatusOrNull, statusCodeOrNull } from './value-primitives';

describe('value primitives', () => {
  it('accepts only real calendar dates in date-only format', () => {
    expect(isoDateOrNull('2026-02-28')).toBe('2026-02-28');
    expect(isoDateOrNull('2026-02-30')).toBeNull();
    expect(isoDateOrNull('2026-02-28T00:00:00Z')).toBeNull();
  });

  it('normalizes valid currency codes without inventing a fallback', () => {
    expect(currencyCodeOrNull(' sar ')).toBe('SAR');
    expect(currencyCodeOrNull('usd-spot')).toBe('USD-SPOT');
    expect(currencyCodeOrNull('')).toBeNull();
    expect(currencyCodeOrNull('ريال')).toBeNull();
  });

  it('parses finite numeric amounts and rejects objects or invalid numbers', () => {
    expect(amountOrNull('12.50')).toBe(12.5);
    expect(amountOrNull(0)).toBe(0);
    expect(amountOrNull('NaN')).toBeNull();
    expect(amountOrNull(Infinity)).toBeNull();
    expect(amountOrNull({ value: 1 })).toBeNull();
  });

  it('trims status labels but preserves their legacy value and casing', () => {
    expect(statusCodeOrNull('  قيد الطلب ')).toBe('قيد الطلب');
    expect(statusCodeOrNull('Paid')).toBe('Paid');
    expect(statusCodeOrNull('')).toBeNull();
  });

  it('keeps approval statuses in their independent bounded domain', () => {
    expect(approvalStatusOrNull('approved')).toBe('approved');
    expect(approvalStatusOrNull('pending_approval')).toBe('pending_approval');
    expect(approvalStatusOrNull('suspended')).toBeNull();
  });

  it('keeps posting statuses bounded to the accounting lifecycle', () => {
    expect(postingStatusOrNull('draft')).toBe('draft');
    expect(postingStatusOrNull('posted')).toBe('posted');
    expect(postingStatusOrNull('voided')).toBe('voided');
    expect(postingStatusOrNull('approved')).toBeNull();
  });

  it('normalizes payment status aliases without mixing order status domains', () => {
    expect(paymentStatusOrNull('paid')).toBe('Paid');
    expect(paymentStatusOrNull('partial_paid')).toBe('Partial Paid');
    expect(paymentStatusOrNull('Unpaid')).toBe('Unpaid');
    expect(paymentStatusOrNull('posted')).toBeNull();
    expect(orderStatusOrNull(' طلب معلق ')).toBe('طلب معلق');
    expect(shipmentStatusOrNull('in_transit')).toBe('in_transit');
  });
});
