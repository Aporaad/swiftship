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
  couriers: any[];
  /** العملة الافتراضية للطلب */
  orderCurrency: string;
  /** العملة الافتراضية للنظام (تُستعمل قبل YER كـ fallback لرسوم التوصيل) */
  systemCurrency?: string;
}

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
      (sum, i) => sum + parseFloat(i.quantity as any || 0) * parseFloat(i.productPrice as any || 0),
      0,
    );

    // 2. حساب الوزن والحجم الإجمالي
    const totalWeight = items.reduce(
      (sum, i) => sum + parseFloat(i.quantity as any || 0) * parseFloat(i.weight as any || 0),
      0,
    );

    // حساب CBM تلقائياً إذا كانت الأبعاد متوفرة (مصادر المصانع)
    items.forEach((i) => {
      if (formData.orderSourceType === 'Factory') {
        const length = parseFloat(i.length as any || 0);
        const width = parseFloat(i.width as any || 0);
        const height = parseFloat(i.height as any || 0);
        if (length > 0 && width > 0 && height > 0) {
          (i as any).cbm = parseFloat(((length * width * height) / 1_000_000).toFixed(6));
        }
      }
    });

    const totalCBM = items.reduce(
      (sum, i) => sum + parseFloat(i.quantity as any || 0) * parseFloat(i.cbm as any || 0),
      0,
    );

    // 3. رسوم التأمين الإجمالية
    const itemsInsuranceSum = items.reduce(
      (sum: number, i: any) => sum + (i.isInsured ? parseFloat(i.insuranceFee) || 0 : 0),
      0,
    );

    // 4. حساب العمولة البنكية
    const bankCommValue = bankCommissionEnabled
      ? bankCommissionType === 'percentage'
        ? productsSum * (parseFloat(bankCommissionRate as any) / 100)
        : parseFloat(bankCommissionRate as any) || 0
      : 0;

    // 5. قيمة الكوبون (مبلغ ثابت)
    const couponValue = couponEnabled ? couponRate : 0;

    const totalProductsCostWithAdjustments = productsSum - couponValue;

    // 6. إجمالي تكلفة الشحن من صفوف الشحن + رسوم التغليف
    const shippingsCostSum = shippings.reduce(
      (sum, s) =>
        sum + parseFloat(s.shippingCost as any || 0) + parseFloat(s.packagingFees as any || 0),
      0,
    );
    const shippingPackagingFixed = packagingFeeEnabled
      ? parseFloat(packagingFeeRate as any) || 0
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
      const redPrice = parseFloat(formData.sheinRedPrice as any) || 0;
      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0;
      priceSAR = redPrice;
      shippingCostSAR = 0;
      totalOrderSAR = redPrice + generalPackagingFee + itemsInsuranceSum;

      const rawProfitSAR = redPrice - (productsSum + bankCommValue + generalPackagingFee);
      const saudiCourier = couriers.find((c) => c.id === formData.shippingCourierId);
      const saudiRate =
        saudiCourier?.commissionRate !== undefined
          ? parseFloat(saudiCourier.commissionRate)
          : 0;
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      profitCompanySAR = rawProfitSAR - profitSaudiSAR + couponValue;
    } else if (formData.orderSourceType === 'Factory') {
      // ── مصادر المصانع ──
      const rawProfitSAR = totalWeight * (parseFloat(profitPerKgRate as any) || 0);
      shippingCostSAR = totalShippingsCost;
      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0;
      totalOrderSAR = productsSum + rawProfitSAR + shippingCostSAR + generalPackagingFee + itemsInsuranceSum;

      const saudiCourier = couriers.find((c) => c.id === formData.shippingCourierId);
      const saudiRate =
        saudiCourier?.commissionRate !== undefined
          ? parseFloat(saudiCourier.commissionRate)
          : 0;
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      profitCompanySAR = rawProfitSAR - profitSaudiSAR + couponValue;
    } else {
      // ── التطبيقات (App) - الافتراضي ──
      const originalRawProfitSAR =
        productsSum * ((parseFloat(formData.companyProfitRate as any) || 12) / 100);
      let rawProfitSAR = originalRawProfitSAR - bankCommValue;

      shippingCostSAR = addShippingEnabled || shippings.length > 0 ? totalShippingsCost : 0;
      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0;

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
            ? parseFloat(formData.shippingCourierFeeRate as any) || 0
            : saudiCourier?.commissionRate !== undefined
            ? parseFloat(saudiCourier.commissionRate)
            : 30;
        profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      } else {
        profitSaudiSAR = 0;
      }

      profitCompanySAR = rawProfitSAR - profitSaudiSAR + couponValue;
    }

    // ── رسوم التوصيل اليمن (فقط إذا كان التوصيل للمنزل مفعّلاً) ──
    const deliveryFeeRaw = homeDeliveryEnabled
      ? parseFloat(formData.deliveryCourierFee as any) || 0
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

    const valPaid = parseFloat(formData.amountPaid as any) || 0;
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
