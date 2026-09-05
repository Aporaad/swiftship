import { describe, expect, it } from 'vitest';
import { AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS, buildAutomaticVoucherKey, calculateAutoEntryAmount, getRuleAmountSources, normalizeOptionalAutoEntryCurrency } from './autoEntryRules';

describe('autoEntryRules', () => {
  it('يجمع المصادر المختارة بعد تحويل كل مصدر إلى عملة القيد', () => {
    const result = calculateAutoEntryAmount(
      { totalCostYER: 1_000, shippingCostSAR: 5, amountPaid: 250, paidCurrency: 'YER' },
      { amountSources: ['total_cost_yer', 'shipping_cost', 'amount_paid'], currency: 'YER' },
      (amount, from, to) => from === to ? amount : amount * 200,
    );

    expect(result.currency).toBe('YER');
    expect(result.amount).toBe(2_250);
    expect(result.breakdown).toEqual([
      expect.objectContaining({ source: 'total_cost_yer', convertedAmount: 1_000 }),
      expect.objectContaining({ source: 'shipping_cost', convertedAmount: 1_000 }),
      expect.objectContaining({ source: 'amount_paid', convertedAmount: 250 }),
    ]);
  });

  it('يحافظ على توافق مصدر واحد ويمنع تكرار المصدر في القاعدة', () => {
    expect(getRuleAmountSources({ amountSource: 'amount_paid' })).toEqual(['amount_paid']);
    expect(getRuleAmountSources({ amountSources: ['amount_paid', 'amount_paid', 'unknown' as any] })).toEqual(['amount_paid']);
  });

  it('يحسب مصادر المعدلات المالية الخاصة بالحجم والوزن والخصم والتغليف والربح', () => {
    const result = calculateAutoEntryAmount(
      {
        totalCostYER: 1_000,
        totalCBM: 3,
        cbmShippingRateValue: 50,
        totalWeight: 4,
        profitPerKgRate: 25,
        couponRate: 10,
        packagingFeeEnabled: true,
        packagingFeeRate: 5,
        companyProfitRate: 20,
      },
      {
        amountSources: ['cbm_shipping_cost', 'profit_by_weight', 'coupon_discount', 'packaging_fee_by_rate', 'company_profit_by_rate'],
        currency: 'YER',
      },
      (amount) => amount,
    );

    expect(result.amount).toBe(600);
    expect(result.breakdown.map(part => part.convertedAmount)).toEqual([150, 100, 100, 50, 200]);
  });

  it('يغطي كل مصدر مبلغ معرف بقيمة مستقلة قابلة للمراجعة', () => {
    const order = {
      totalCostYER: 1_000,
      totalCostSAR: 9,
      amountPaid: 100,
      amountRemaining: 200,
      sourcingCostAmount: 50,
      shippingCostSAR: 5,
      deliveryCourierFee: 25,
      profitSaudiSAR: 30,
      profitCompanySAR: 40,
      packagingFee: 15,
      bankCommissionEnabled: true,
      bankCommissionRate: 5,
      couponRate: 10,
      packagingFeeEnabled: true,
      packagingFeeRate: 5,
      totalCBM: 3,
      cbmShippingRateValue: 50,
      totalWeight: 4,
      profitPerKgRate: 25,
      companyProfitRate: 20,
      sheinRedPrice: 12,
      productInsuranceFee: 35,
    };
    const expected: Record<string, number> = {
      order_total: 1_000,
      total_cost_yer: 1_000,
      total_cost_sar: 9,
      amount_paid: 100,
      amount_remaining: 200,
      sourcing_cost: 50,
      shipping_cost: 5,
      delivery_wage: 25,
      courier_commission: 30,
      company_profit: 40,
      packaging_fee: 15,
      bank_commission: 5,
      coupon_discount: 100,
      packaging_fee_by_rate: 15,
      cbm_shipping_cost: 150,
      profit_by_weight: 100,
      company_profit_by_rate: 200,
      shein_red_price: 12,
      profit_saudi: 30,
      product_insurance_fee: 35,
      custom: 7,
    };

    expect(Object.keys(expected).sort()).toEqual(AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS.map(option => option.id).sort());
    for (const source of AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS.map(option => option.id)) {
      const result = calculateAutoEntryAmount(order, { amountSources: [source], currency: 'YER', customAmount: 7 }, (amount) => amount);
      expect(result.breakdown).toEqual([expect.objectContaining({ source })]);
      expect(result.amount).toBe(expected[source]);
    }
  });

  it('ينشئ مفتاحًا واحدًا للقاعدة والطلب مهما كانت مرحلة الوصول إليها', () => {
    expect(buildAutomaticVoucherKey('order-1', 'order_charge', 2))
      .toBe(buildAutomaticVoucherKey('order-1', 'order_charge', 6));
  });

  it('يعتمد عملة الطلب عند عدم تضمين عملة في قاعدة القيد التلقائي', () => {
    const result = calculateAutoEntryAmount(
      { orderCurrency: 'USD', totalCostYER: 300 },
      { amountSources: ['total_cost_yer'] },
      (amount, from, to) => from === to ? amount : amount / 3,
    );

    expect(result.currency).toBe('USD');
    expect(result.amount).toBe(100);
    expect(result.breakdown[0]).toEqual(expect.objectContaining({ currency: 'YER', convertedAmount: 100 }));
  });

  it('يخزن العملة الصريحة فقط ويعيد undefined لخيار عملة الطلب الافتراضية', () => {
    expect(normalizeOptionalAutoEntryCurrency(undefined)).toBeUndefined();
    expect(normalizeOptionalAutoEntryCurrency('   ')).toBeUndefined();
    expect(normalizeOptionalAutoEntryCurrency('sar')).toBe('SAR');
  });
});
