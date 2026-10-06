import { describe, expect, it } from '@jest/globals';
import { calculatePortalOrderPricing } from '../src/modules/portal/portal-order-pricing';
import type { PortalOrderPricingSettings } from '../src/modules/portal/portal-owned.contracts';

const settings: PortalOrderPricingSettings = {
  exchangeRateYER: 139,
  defaultDeliveryFeeYER: 4_000,
  defaultCompanyProfitRate: 12,
  defaultPackagingFeeSAR: 3,
};

describe('calculatePortalOrderPricing', () => {
  it('calculates an App order from item details and authoritative settings', () => {
    const result = calculatePortalOrderPricing({
      items: [{ quantity: 2, productPrice: 15, weight: 1, cbm: 0.01 }],
      packagingType: 'normal',
      isUrgent: false,
      sourceType: 'App',
    }, settings);

    expect(result).toEqual({
      productsSum: 30,
      totalWeight: 2,
      totalCBM: 0.02,
      packagingFeeSAR: 3,
      shippingCostSAR: 36,
      companyProfitSAR: 3.6,
      totalCostSAR: 72.6,
      exchangeRateYER: 139,
      deliveryCourierFeeYER: 4_000,
      totalCostYER: 14_091.4,
    });
  });

  it('uses the canonical Factory rate, selected packaging, and urgent surcharge', () => {
    const result = calculatePortalOrderPricing({
      items: [{ quantity: 1, productPrice: 100, weight: 2, cbm: 0.5 }],
      packagingType: 'gift',
      isUrgent: true,
      sourceType: 'Factory',
    }, settings);

    expect(result).toMatchObject({
      productsSum: 100,
      totalWeight: 2,
      totalCBM: 0.5,
      packagingFeeSAR: 15,
      shippingCostSAR: 63,
      companyProfitSAR: 12,
      totalCostSAR: 190,
      totalCostYER: 30_410,
    });
  });
});
