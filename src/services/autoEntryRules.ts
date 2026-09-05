export const AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS = [
  { id: 'order_total', labelAr: 'إجمالي الطلب', labelEn: 'Order total' },
  { id: 'total_cost_yer', labelAr: 'إجمالي الطلب بالعملةالافتراضية', labelEn: 'Order total (base)' },
  { id: 'total_cost_sar', labelAr: 'إجمالي الطلب بعملة الطلب', labelEn: 'Order total (order currancy)' },
  { id: 'amount_paid', labelAr: 'المبلغ المدفوع', labelEn: 'Amount paid' },
  { id: 'amount_remaining', labelAr: 'المبلغ المتبقي', labelEn: 'Outstanding balance' },
  { id: 'sourcing_cost', labelAr: 'تكلفة المنتجات/الشراء', labelEn: 'Product sourcing cost' },
  { id: 'shipping_cost', labelAr: 'تكلفة الشحن', labelEn: 'Shipping cost' },
  { id: 'delivery_wage', labelAr: 'أجر مندوب التوصيل', labelEn: 'Delivery courier wage' },
  { id: 'courier_commission', labelAr: 'عمولة مندوب/وكيل الشحن', labelEn: 'Courier commission' },
  { id: 'company_profit', labelAr: 'صافي ربح الشركة', labelEn: 'Company net profit' },
  { id: 'packaging_fee', labelAr: 'رسوم التغليف', labelEn: 'Packaging fee' },
  { id: 'bank_commission', labelAr: 'عمولة البنك المحسوبة', labelEn: 'Calculated bank commission' },
  { id: 'coupon_discount', labelAr: 'خصم الكوبون المحسوب', labelEn: 'Calculated coupon discount' },
  { id: 'packaging_fee_by_rate', labelAr: 'رسوم التغليف المحسوبة بالمعدل', labelEn: 'Packaging fee calculated by rate' },
  { id: 'cbm_shipping_cost', labelAr: 'تكلفة الشحن المحسوبة بالحجم (CBM)', labelEn: 'CBM-based shipping cost' },
  { id: 'profit_by_weight', labelAr: 'الربح المحسوب بالوزن', labelEn: 'Weight-based profit' },
  { id: 'company_profit_by_rate', labelAr: 'ربح الشركة المحسوب بالمعدل', labelEn: 'Company profit calculated by rate' },
  { id: 'shein_red_price', labelAr: 'قيمة سعر شي إن الأحمر', labelEn: 'SHEIN red price' },
  { id: 'profit_saudi', labelAr: 'ربح السوق السعودي', labelEn: 'Saudi-market profit' },
  { id: 'product_insurance_fee', labelAr: 'رسوم تأمين المنتجات', labelEn: 'Products insurance fee' },
  { id: 'custom', labelAr: 'مبلغ ثابت مخصص', labelEn: 'Custom fixed amount' },
] as const;

export type AutoEntryAmountSource = (typeof AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS)[number]['id'];

export interface AmountSourcePart {
  source: AutoEntryAmountSource;
  amount: number;
  currency: string;
  convertedAmount: number;
}

export interface AutoEntryAmountRule {
  amountSource?: AutoEntryAmountSource;
  amountSources?: AutoEntryAmountSource[];
  customAmount?: number;
  currency?: string;
}

const asAmount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const orderCurrency = (order: Record<string, any>, fallback = 'SAR') =>
  String(order.orderCurrency || order.order_currency || order.currency || fallback).toUpperCase();

export function getRuleAmountSources(rule: AutoEntryAmountRule): AutoEntryAmountSource[] {
  const sources = Array.isArray(rule.amountSources) && rule.amountSources.length > 0
    ? rule.amountSources
    : rule.amountSource
      ? [rule.amountSource]
      : ['total_cost_sar'];

  return [...new Set(sources.filter((source): source is AutoEntryAmountSource =>
    AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS.some((option) => option.id === source),
  ))];
}

export function calculateAutoEntryAmount(
  order: Record<string, any>,
  rule: AutoEntryAmountRule,
  convert: (amount: number, fromCurrency: string, toCurrency: string) => number,
): { amount: number; currency: string; sources: AutoEntryAmountSource[]; breakdown: AmountSourcePart[] } {
  const defaultCurrency = orderCurrency(order, 'SAR');
  const targetCurrency = String(rule.currency || defaultCurrency).toUpperCase();
  const paidCurrency = String(order.paidCurrency || defaultCurrency).toUpperCase();
  const sources = getRuleAmountSources(rule);

  const values: Record<AutoEntryAmountSource, { amount: number; currency: string }> = {
    order_total: { amount: asAmount(order.totalCostYER) || asAmount(order.totalCostSAR), currency: asAmount(order.totalCostYER) ? (order.currancy || 'YER') : (order.orderCurrency || 'SAR') },
    total_cost_yer: { amount: asAmount(order.totalCostYER), currency: order.currancy || 'YER' },
    total_cost_sar: { amount: asAmount(order.totalCostSAR), currency: order.orderCurrency || 'SAR' },
    amount_paid: { amount: asAmount(order.amountPaid), currency: paidCurrency },
    amount_remaining: { amount: asAmount(order.amountRemaining), currency: paidCurrency },
    sourcing_cost: {
      amount: asAmount(order.sourcingCostAmount) || asAmount(order.sourcing_cost),
      currency: defaultCurrency,
    },
    shipping_cost: {
      amount: asAmount(order.shippingCostSAR) || asAmount(order.shippingCostAmount),
      currency: asAmount(order.shippingCostSAR) ? 'SAR' : defaultCurrency,
    },
    delivery_wage: { amount: asAmount(order.deliveryCourierFee), currency:order.order_currency || defaultCurrency },
    courier_commission: { amount: asAmount(order.profitSaudiSAR), currency: 'SAR' },
    company_profit: { amount: asAmount(order.profitCompanySAR), currency: 'SAR' },
    packaging_fee: { amount: asAmount(order.packagingFee), currency: defaultCurrency },
    bank_commission: {
      amount: order.bankCommissionEnabled
        ? asAmount(order.amountPaid) * asAmount(order.bankCommissionRate) / 100
        : 0,
      currency: paidCurrency,
    },
    coupon_discount: {
      amount: (asAmount(order.totalCostYER) || asAmount(order.totalCostSAR)) * asAmount(order.couponRate) / 100,
      currency: asAmount(order.totalCostYER) ? 'YER' : defaultCurrency,
    },
    packaging_fee_by_rate: {
      amount: order.packagingFeeEnabled
        ? (asAmount(order.packagingFee) || ((asAmount(order.totalCostYER) || asAmount(order.totalCostSAR)) * asAmount(order.packagingFeeRate) / 100))
        : 0,
      currency: defaultCurrency,
    },
    cbm_shipping_cost: {
      amount: asAmount(order.totalCBM) * asAmount(order.cbmShippingRateValue),
      currency: defaultCurrency,
    },
    profit_by_weight: {
      amount: asAmount(order.totalWeight) * asAmount(order.profitPerKgRate),
      currency: defaultCurrency,
    },
    company_profit_by_rate: {
      amount: (asAmount(order.totalCostYER) || asAmount(order.totalCostSAR)) * asAmount(order.companyProfitRate) / 100,
      currency: asAmount(order.totalCostYER) ? 'YER' : defaultCurrency,
    },
    shein_red_price: { amount: asAmount(order.sheinRedPrice), currency: defaultCurrency },
    profit_saudi: { amount: asAmount(order.profitSaudiSAR), currency: 'SAR' },
    product_insurance_fee: {
      amount: asAmount(order.productInsuranceFee) || asAmount(order.product_insurance_fee),
      currency: defaultCurrency,
    },
    custom: { amount: asAmount(rule.customAmount), currency: targetCurrency },
  };

  const breakdown = sources.map((source) => {
    const value = values[source];
    return {
      source,
      amount: value.amount,
      currency: value.currency,
      convertedAmount: value.currency === targetCurrency
        ? value.amount
        : convert(value.amount, value.currency, targetCurrency),
    };
  });

  return {
    amount: breakdown.reduce((total, part) => total + part.convertedAmount, 0),
    currency: targetCurrency,
    sources,
    breakdown,
  };
}

export function buildAutomaticVoucherKey(orderId: string, ruleId: string, _statusId: number | string): string {
  return `auto-voucher:${orderId}:rule:${ruleId}`;
}

export function normalizeOptionalAutoEntryCurrency(currency?: string): string | undefined {
  const normalized = currency?.trim().toUpperCase();
  return normalized || undefined;
}
