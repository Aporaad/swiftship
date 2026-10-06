import type { PortalOrderPricingSettings } from './portal-owned.contracts';

export interface PortalOrderPricingItem {
  quantity: number;
  productPrice: number;
  weight?: number | undefined;
  cbm?: number | undefined;
}

export interface PortalOrderPricingInput {
  items: readonly PortalOrderPricingItem[];
  packagingType: 'normal' | 'gift' | 'vip';
  isUrgent: boolean;
  sourceType: string;
}

export interface PortalOrderPricingResult {
  productsSum: number;
  totalWeight: number;
  totalCBM: number;
  packagingFeeSAR: number;
  shippingCostSAR: number;
  companyProfitSAR: number;
  totalCostSAR: number;
  exchangeRateYER: number;
  deliveryCourierFeeYER: number;
  totalCostYER: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePortalOrderPricing(
  input: PortalOrderPricingInput,
  settings: PortalOrderPricingSettings,
): PortalOrderPricingResult {
  const productsSum = money(input.items.reduce((total, item) => total + item.quantity * item.productPrice, 0));
  const totalWeight = input.items.reduce((total, item) => total + item.quantity * (item.weight ?? 0), 0);
  const totalCBM = input.items.reduce((total, item) => total + item.quantity * (item.cbm ?? 0), 0);
  const packagingFeeSAR = input.packagingType === 'gift'
    ? 15
    : input.packagingType === 'vip'
      ? 30
      : settings.defaultPackagingFeeSAR;

  const shippingRatePerKg = input.sourceType === 'Factory' ? 19 : 18;
  let shippingCostSAR = totalWeight > 0 ? totalWeight * shippingRatePerKg : 15;
  if (input.isUrgent) shippingCostSAR += 25;
  shippingCostSAR = money(shippingCostSAR);

  const companyProfitSAR = money(productsSum * (settings.defaultCompanyProfitRate / 100));
  const totalCostSAR = money(productsSum + packagingFeeSAR + shippingCostSAR + companyProfitSAR);
  const totalCostYER = money(totalCostSAR * settings.exchangeRateYER + settings.defaultDeliveryFeeYER);

  return {
    productsSum,
    totalWeight,
    totalCBM,
    packagingFeeSAR,
    shippingCostSAR,
    companyProfitSAR,
    totalCostSAR,
    exchangeRateYER: settings.exchangeRateYER,
    deliveryCourierFeeYER: settings.defaultDeliveryFeeYER,
    totalCostYER,
  };
}
