import { describe, expect, it } from 'vitest';
import { calculateShipmentCategoryFees } from './itemCategoryService';

describe('calculateShipmentCategoryFees', () => {
  it('computes shipment-only customs, tax and other fees by carton count', () => {
    const result = calculateShipmentCategoryFees({ customsPerCarton: 25, taxPerCarton: 10, otherFeesPerCarton: 5, feeCurrency: 'SAR' }, 3);
    expect(result).toEqual({ cartonCount: 3, customsFee: 75, taxFee: 30, otherCategoryFee: 15, total: 120, currency: 'SAR' });
  });

  it('returns zero fees safely when no category is selected', () => {
    expect(calculateShipmentCategoryFees(undefined, 8)).toEqual({ cartonCount: 8, customsFee: 0, taxFee: 0, otherCategoryFee: 0, total: 0, currency: 'SAR' });
  });
});
