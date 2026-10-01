/**
 * useOrderCalculations.ts
 * -----------------------
 * Hook مسؤول عن حساب جميع القيم المالية للطلب قيد الإنشاء.
 * Responsible for computing all financial values of the order being created.
 *
 * مبدأ الفصل: لا يوجد هنا أي منطق UI أو استدعاءات DB.
 * Separation: No UI logic or DB calls here.
 */

import { useMemo } from 'react';
import { calculateOrderPaymentTotals } from '../../../services/orderCurrencyService';
import type { OrderFormData, ItemRow, ShippingRow, OrderCalculations } from '../types';

interface UseOrderCalculationsInput {
  /** بيانات نموذج الطلب */
  formData: OrderFormData;
  /** صفوف المنتجات */
  items: ItemRow[];
  /** صفوف الشحن */
  shippings: ShippingRow[];
  /** معدل عمولة البنك بالريال السعودي أو نسبة */
  bankCommissionRate: number;
  /** نوع العمولة البنكية: نسبة مئوية أو مبلغ ثابت */
  bankCommissionType: 'percentage' | 'fixed';
  /** هل العمولة البنكية مفعّلة؟ */
  bankCommissionEnabled: boolean;
  /** هل الكوبون مفعّل؟ */
  couponEnabled: boolean;
  /** قيمة الكوبون (مبلغ ثابت) */
  couponRate: number;
  /** هل رسوم التغليف مفعّلة؟ */
  packagingFeeEnabled: boolean;
  /** قيمة رسوم التغليف */
  packagingFeeRate: number;
  /** هل خيار التوصيل للمنزل مفعّل؟ */
  homeDeliveryEnabled: boolean;
  /** هل الشحن عبر مندوب مفعّل؟ */
  viaShippingAgent: boolean;
  /** هل تم تفعيل إضافة الشحن؟ */
  addShippingEnabled: boolean;
  /** معدل الربح لكل كيلو (مصادر المصانع) */
  profitPerKgRate: number;
  /** معدل الشحن لكل CBM (مصادر المصانع) */
  cbmShippingRateValue: number;
  /** أسعار الصرف من DB */
  dbRates: Record<string, number>;
  /** قائمة المناديب لحساب العمولة */
  couriers: Array<Record<string, unknown>>;
  /** العملة الافتراضية للطلب */
  orderCurrency: string;
  /** العملة الافتراضية للنظام (تُستعمل قبل YER كـ fallback لرسوم التوصيل) */
  systemCurrency?: string;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/**
 * useOrderCalculations
 * Hook لحساب التكاليف الكاملة للطلب بناءً على مدخلات النموذج.
 * Computes full order cost breakdown based on form inputs.
 */
export function useOrderCalculations(input: UseOrderCalculationsInput): OrderCalculations {
  const {
    formData,
    items,
    shippings,
    bankCommissionRate,
    bankCommissionType,
    bankCommissionEnabled,
    couponEnabled,
    couponRate,
    packagingFeeEnabled,
    packagingFeeRate,
    homeDeliveryEnabled,
    viaShippingAgent,
    addShippingEnabled,
    profitPerKgRate,
    cbmShippingRateValue,
    dbRates,
    couriers,
    orderCurrency,
    systemCurrency,
  } = input;

  return useMemo<OrderCalculations>(() => {
    // 1. حساب إجمالي سعر المنتجات
    const productsSum = items.reduce(
      (sum, i) => sum + toNumber(i.quantity) * toNumber(i.productPrice),
      0,
    );

    // 2. حساب الوزن والحجم الإجمالي
    const totalWeight = items.reduce(
      (sum, i) => sum + toNumber(i.quantity) * toNumber(i.weight),
      0,
    );

    // حساب CBM تلقائياً إذا كانت الأبعاد متوفرة (مصادر المصانع)
    items.forEach((i) => {
      if (formData.orderSourceType === 'Factory') {
        const length = toNumber(i.length);
        const width = toNumber(i.width);
        const height = toNumber(i.height);
        if (length > 0 && width > 0 && height > 0) {
          i.cbm = parseFloat(((length * width * height) / 1_000_000).toFixed(6));
        }
      }
    });

    const totalCBM = items.reduce(
      (sum, i) => sum + toNumber(i.quantity) * toNumber(i.cbm),
      0,
    );

    // 3. رسوم التأمين الإجمالية
    const itemsInsuranceSum = items.reduce(
      (sum, i) => sum + (i.isInsured ? toNumber(i.insuranceFee) : 0),
      0,
    );

    // 4. حساب العمولة البنكية
    const bankCommValue = bankCommissionEnabled
      ? bankCommissionType === 'percentage'
        ? productsSum * (toNumber(bankCommissionRate) / 100)
        : toNumber(bankCommissionRate)
      : 0;

    // 5. قيمة الكوبون (مبلغ ثابت)
    const couponValue = couponEnabled ? couponRate : 0;

    const totalProductsCostWithAdjustments = productsSum - couponValue;

    // 6. إجمالي تكلفة الشحن من صفوف الشحن + رسوم التغليف
    const shippingsCostSum = shippings.reduce(
      (sum, s) =>
        sum + toNumber(s.shippingCost) + toNumber(s.packagingFees),
      0,
    );
    const shippingPackagingFixed = packagingFeeEnabled
      ? toNumber(packagingFeeRate)
      : 0;
    const totalShippingsCost = shippingsCostSum + shippingPackagingFixed;

    let priceSAR = totalProductsCostWithAdjustments;
    let shippingCostSAR = 0;
    let profitCompanySAR = 0;
    let profitSaudiSAR = 0;
    let totalOrderSAR = 0;

    // ── حساب حسب نوع مصدر الطلب ──

    if (formData.orderSourceType === 'SHEIN') {
      // ── مصدر شي ان ──
      const redPrice = toNumber(formData.sheinRedPrice);
      const generalPackagingFee = toNumber(formData.packagingFee);
      priceSAR = redPrice;
      shippingCostSAR = 0;
      totalOrderSAR = redPrice + generalPackagingFee + itemsInsuranceSum;

      const rawProfitSAR = redPrice - (productsSum + bankCommValue + generalPackagingFee);
      const saudiCourier = couriers.find((c) => c.id === formData.shippingCourierId);
      const saudiRate =
        saudiCourier?.commissionRate !== undefined
          ? toNumber(saudiCourier.commissionRate)
          : 0;
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      profitCompanySAR = rawProfitSAR - profitSaudiSAR + couponValue;
    } else if (formData.orderSourceType === 'Factory') {
      // ── مصادر المصانع ──
      const rawProfitSAR = totalWeight * (toNumber(profitPerKgRate));
      shippingCostSAR = totalShippingsCost;
      const generalPackagingFee = toNumber(formData.packagingFee);
      totalOrderSAR = productsSum + rawProfitSAR + shippingCostSAR + generalPackagingFee + itemsInsuranceSum;

      const saudiCourier = couriers.find((c) => c.id === formData.shippingCourierId);
      const saudiRate =
        saudiCourier?.commissionRate !== undefined
          ? toNumber(saudiCourier.commissionRate)
          : 0;
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      profitCompanySAR = rawProfitSAR - profitSaudiSAR + couponValue;
    } else {
      // ── التطبيقات (App) - الافتراضي ──
      const originalRawProfitSAR =
        productsSum * ((toNumber(formData.companyProfitRate) || 12) / 100);
      let rawProfitSAR = originalRawProfitSAR - bankCommValue;

      shippingCostSAR = addShippingEnabled || shippings.length > 0 ? totalShippingsCost : 0;
      const generalPackagingFee = toNumber(formData.packagingFee);

      totalOrderSAR =
        productsSum +
        originalRawProfitSAR +
        shippingCostSAR +
        generalPackagingFee +
        couponValue +
        itemsInsuranceSum;

      // ربح المندوب السعودي فقط إذا كان "عبر مندوب شحن" مفعّلاً
      if (viaShippingAgent && formData.shippingCourierId) {
        const saudiCourier = couriers.find((c) => c.id === formData.shippingCourierId);
        const saudiRate =
          formData.shippingCourierFeeRate !== undefined && formData.shippingCourierFeeRate !== null
            ? toNumber(formData.shippingCourierFeeRate)
            : saudiCourier?.commissionRate !== undefined
            ? toNumber(saudiCourier.commissionRate)
            : 30;
        profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      } else {
        profitSaudiSAR = 0;
      }

      profitCompanySAR = rawProfitSAR - profitSaudiSAR + couponValue;
    }

    // ── رسوم التوصيل اليمن (فقط إذا كان التوصيل للمنزل مفعّلاً) ──
    const deliveryFeeRaw = homeDeliveryEnabled
      ? toNumber(formData.deliveryCourierFee)
      : 0;
    const paymentCurrency = formData.currency || orderCurrency;
    const deliveryFeeCurrency = formData.deliveryCourierFeeCurrency || systemCurrency || 'YER';

    const currencyTotals = calculateOrderPaymentTotals({
      orderSubtotal: totalOrderSAR,
      deliveryFeeOriginal: deliveryFeeRaw,
      deliveryFeeCurrency,
      orderCurrency,
      paymentCurrency,
      rates: dbRates,
    });

    const totalOrderYER = currencyTotals.totalPaymentCurrency;
    const sourcingCostAmount =
      formData.orderSourceType === 'App' || formData.orderSourceType === 'Factory'
        ? totalProductsCostWithAdjustments + shippingCostSAR
        : totalProductsCostWithAdjustments;

    const valPaid = toNumber(formData.amountPaid);
    const remainingYER = totalOrderYER - valPaid;

    return {
      productsSum,
      itemsInsuranceSum,
      totalProductsCostWithAdjustments,
      totalWeight,
      totalCBM,
      priceSAR,
      shippingCostSAR,
      bankCommissionSAR: bankCommValue,
      couponValue,
      totalOrderSAR: currencyTotals.totalOrderCurrency,
      totalOrderYER,
      remainingYER,
      deliveryCourierFeeOrderCurrency: currencyTotals.deliveryFeeOrderCurrency,
      deliveryCourierFeeCurrency: deliveryFeeCurrency,
      paymentExchangeRate: currencyTotals.paymentExchangeRate,
      profitSaudiSAR,
      profitCompanySAR,
      sourcingCostAmount,
    };
  }, [
    formData,
    items,
    shippings,
    bankCommissionRate,
    bankCommissionType,
    bankCommissionEnabled,
    couponEnabled,
    couponRate,
    packagingFeeEnabled,
    packagingFeeRate,
    homeDeliveryEnabled,
    viaShippingAgent,
    addShippingEnabled,
    profitPerKgRate,
    cbmShippingRateValue,
    dbRates,
    couriers,
    orderCurrency,
    systemCurrency,
  ]);
}
