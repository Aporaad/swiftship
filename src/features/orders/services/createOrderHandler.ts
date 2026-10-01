import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { OrderParty } from "../../../services/orderPartyService";
import { activityLogService } from "../../../services/activityLogService";
import { autoEntryService } from "../../../services/autoEntryService";
import { financialAccountService } from "../../../services/financialAccountService";
import { notificationService } from "../../../services/notificationService";
import { whatsappService } from "../../../services/whatsappService";
import { ORDER_STATUS_FALLBACKS } from "../constants/orders.constants";
import type { OrderMutations } from "../hooks/useOrderMutations";
import type {
  ItemRow,
  OrderCalculations,
  OrderFormData,
  OrderStatusDescriptor,
  ShippingRow,
} from "../types";

interface RelatedRecord {
  id?: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  financialAccountId?: string | null;
  accountId?: string | null;
  financialAccountCode?: string | null;
  accountCode?: string | null;
}

interface CurrencyRecord {
  code?: string;
  cur_id?: string | number;
}

interface OrderSettings {
  currency?: string;
}

interface UserProfile {
  fullName?: string;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readStringField(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined;
  const field = Reflect.get(value, key);
  return typeof field === "string" ? field : undefined;
}

function readRelatedRecord(value: unknown): RelatedRecord | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return {
    id: readStringField(value, "id"),
    name: readStringField(value, "name"),
    nameAr: readStringField(value, "nameAr"),
    nameEn: readStringField(value, "nameEn"),
    financialAccountId: readStringField(value, "financialAccountId"),
    accountId: readStringField(value, "accountId"),
    financialAccountCode: readStringField(value, "financialAccountCode"),
    accountCode: readStringField(value, "accountCode"),
  };
}

type CreateOrderMutationSet = Pick<
  OrderMutations,
  | "createOrderRecord"
  | "createProductRecord"
  | "createOrderItem"
  | "createShipmentRecord"
>;

export interface CreateOrderHandlerDependencies {
  isSubmitting: boolean;
  isAr: boolean;
  formData: OrderFormData;
  settings: OrderSettings;
  profile: UserProfile | null;
  customers: RelatedRecord[];
  couriers: RelatedRecord[];
  orderStatusesList: OrderStatusDescriptor[];
  activeCurrencies: CurrencyRecord[];
  selectedOrderParty: OrderParty | null;
  items: ItemRow[];
  shippings: ShippingRow[];
  orderCurrency: string;
  bankCommissionType: "percentage" | "fixed";
  cartShareCode: string;
  bankCommissionEnabled: boolean;
  packagingFeeEnabled: boolean;
  packagingFeeRate: number;
  addShippingEnabled: boolean;
  couponEnabled: boolean;
  couponRate: number;
  cbmShippingRateValue: number;
  profitPerKgRate: number;
  directApprove: boolean;
  homeDeliveryEnabled: boolean;
  payLater: boolean;
  viaShippingAgent: boolean;
  mutations: CreateOrderMutationSet;
  computeCalculations: () => OrderCalculations;
  generateSmartOrderCode: () => Promise<string>;
  resetCreateForm: () => void;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setIsAddModalOpen: Dispatch<SetStateAction<boolean>>;
}

export function createOrderHandler(
  dependencies: CreateOrderHandlerDependencies
) {
  const {
    isSubmitting,
    isAr,
    formData,
    settings,
    profile,
    customers,
    couriers,
    orderStatusesList,
    activeCurrencies,
    selectedOrderParty,
    items,
    shippings,
    orderCurrency,
    bankCommissionType,
    cartShareCode,
    bankCommissionEnabled,
    packagingFeeEnabled,
    packagingFeeRate,
    addShippingEnabled,
    couponEnabled,
    couponRate,
    cbmShippingRateValue,
    profitPerKgRate,
    directApprove,
    homeDeliveryEnabled,
    payLater,
    viaShippingAgent,
    computeCalculations,
    generateSmartOrderCode,
    resetCreateForm,
    setIsSubmitting,
    setIsAddModalOpen,
  } = dependencies;
  const {
    createOrderRecord,
    createProductRecord,
    createOrderItem,
    createShipmentRecord,
  } = dependencies.mutations;

  return async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.orderPartyId) {
      return notificationService.notify({
        title: isAr ? "خطأ" : "Error",
        message: isAr
          ? "الرجاء اختيار طرف الطلب أولاً"
          : "Please select an order party first",
        type: "error",
        category: "order",
      });
    }

    const currentCalcs = computeCalculations();
    const paidAmount = toNumber(formData.amountPaid) || 0;

    // First requirement: Deleted the condition that cash paid amount cannot be less than original products cost. All amounts are allowed.
    if (formData.orderSourceType === "SHEIN") {
      const redPrice = toNumber(formData.sheinRedPrice) || 0;
      const productsSum = items.reduce(
        (sum, i) =>
          sum + toNumber(i.quantity || 0) * toNumber(i.productPrice || 0),
        0
      );
      const couponValue = couponEnabled ? couponRate : 0;
      if (redPrice < productsSum - couponValue) {
        return notificationService.notify({
          title: isAr ? "خطأ في التحقق" : "Validation Error",
          message: isAr
            ? "السعر الأحمر لـ SHEIN يجب ألا يقل عن إجمالي تكلفة المنتجات الأصلي بعد الخصم"
            : "SHEIN Red Price cannot be less than the total products cost after discount",
          type: "error",
          category: "order",
        });
      }
    }

    setIsSubmitting(true);
    try {
      const orderNumber = await generateSmartOrderCode();
      const currentCalcs = computeCalculations();

      // ====== تحديد حالة الدفع بناءً على خيار "الدفع لاحقاً" أو المبلغ المدفوع ======
      // Determine payment status based on payLater toggle or paid amount
      let payStatus: string;
      if (payLater) {
        // الدفع لاحقاً: حالة الدفع دائماً "لم يتم الدفع"
        // Pay later: always set payment status to Unpaid
        payStatus = "Unpaid";
      } else if (currentCalcs.remainingYER <= 0) {
        payStatus = "Paid"; // دفع كامل
      } else if (toNumber(formData.amountPaid) > 0) {
        payStatus = "Partial Paid"; // دفع جزئي
      } else {
        payStatus = "Unpaid"; // لم يتم الدفع
      }

      // ====== تحديد ID حالة الطلب بناءً على الخيارات الثلاثة ======
      // Determine order status ID based on payLater, directApprove and paid amount
      // المنطق: directApprove => حالة 3 | payLater => حالة 1 | دفع موجود => حالة 2 | بدون دفع => حالة 1
      // Logic: directApprove => stage 3 | payLater => stage 1 | paid > 0 => stage 2 | else => stage 1
      const computedOrderStatusId = (() => {
        // ترتيب الأولوية: الاعتماد المباشر > الدفع لاحقاً > مدفوع/غير مدفوع
        // Priority: direct approve > pay later > paid/unpaid
        if (directApprove) {
          // البحث عن الحالة ذات الترتيب 3 من جدول حالات الطلب
          // Find status with sortOrder/id = 3 from order statuses table
          const stage3 = orderStatusesList.find(
            s => s.id === 3 || s.sortOrder === 3
          );
          return stage3 ? String(stage3.id) : "3";
        }
        if (payLater) {
          // حالة البداية (الأولى) من جدول حالات الطلب
          // First stage from order statuses table
          const stage1 = orderStatusesList.find(
            s => s.id === 1 || s.isFirst === true || s.sortOrder === 1
          );
          return stage1 ? String(stage1.id) : "1";
        }
        // المنطق الافتراضي: إذا تم الدفع => الحالة الثانية، وإلا => الأولى
        // Default: paid amount present => stage 2 else stage 1
        if (toNumber(formData.amountPaid) > 0) {
          const stage2 = orderStatusesList.find(
            s => s.id === 2 || s.sortOrder === 2
          );
          return stage2 ? String(stage2.id) : "2";
        }
        const stage1 = orderStatusesList.find(
          s => s.id === 1 || s.isFirst === true || s.sortOrder === 1
        );
        return stage1 ? String(stage1.id) : "1";
      })();

      const initialFiredTriggers = [""];
      if (toNumber(formData.amountPaid) > 0 && !payLater) {
        initialFiredTriggers.push("order_down_payment"); //مهم:هذا قيد دفعه من العميل
      }

      // ====== نص حالة الطلب (نصي) بناءً على الخيارات ======
      // Order status text based on options
      const orderStatusText = (() => {
        if (directApprove) return isAr ? "معتمد" : "Approved";
        if (payLater) return isAr ? "طلب معلق" : "Pending Order";
        if (toNumber(formData.amountPaid) > 0) {
          const stage2 = orderStatusesList.find(
            s => s.id === 2 || s.sortOrder === 2
          );
          return stage2
            ? isAr
              ? stage2.nameAr
              : stage2.nameEn
            : isAr
              ? "تم الدفع ولم يتسجل"
              : "Paid Not Registered";
        }
        return isAr ? "طلب معلق" : "Pending Order";
      })();

      const payload = {
        // أعمدة مباشرة - ترتبط بـ DIRECT_COLUMNS_MAP لتُكتب في الأعمدة الأساسية وتُحذف من data
        // Direct columns - mapped via DIRECT_COLUMNS_MAP to base columns, excluded from data
        orderNumber,
        trackingNumber: formData.trackingNumber || orderNumber,
        customerId: formData.customerId || "",
        orderPartyId: formData.orderPartyId || formData.customerId || "",
        orderPartyType: formData.orderPartyType || "customer",
        isStaffOrder: Boolean(formData.isStaffOrder),
        employeeId: formData.employeeId || null,
        courierId: formData.courierId || null,
        orderPartyAccountId: formData.orderPartyAccountId || null,
        // تحديد ID حالة الطلب ديناميكياً بناءً على payLater و directApprove
        // Dynamic order status ID based on payLater & directApprove options
        orderStatusId: computedOrderStatusId,
        order_status_id: computedOrderStatusId,
        orderSourceId: formData.orderSourceId || null,
        orderSourceType: formData.orderSourceType || null,
        deliveryCourierId: homeDeliveryEnabled
          ? formData.deliveryCourierId || null
          : null,
        delivery_courier_id: homeDeliveryEnabled
          ? formData.deliveryCourierId || null
          : null,
        shippingCourierId: viaShippingAgent
          ? formData.shippingCourierId || null
          : null,
        shipping_courier_id: viaShippingAgent
          ? formData.shippingCourierId || null
          : null,
        createdByName: profile?.fullName || "Root Admin",
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.fullName || "Root Admin",

        // بيانات مالية وحسابية - تُخزَّن في data لأنها ليست أعمدة مباشرة
        // Financial & calculation data - stored in data column (no direct column)
        currency: orderCurrency,
        orderCurrency,
        paidCurrency: formData.currency,
        exchangeRate: currentCalcs.paymentExchangeRate,
        exchangeRateYER: formData.exchangeRateYER,
        exchangeRateUSD: formData.exchangeRateUSD,
        bankCommissionRate: formData.bankCommissionRate,
        bankCommissionType,
        companyProfitRate: formData.companyProfitRate,
        packagingFee: toNumber(formData.packagingFee) || 0,
        sheinRedPrice: toNumber(formData.sheinRedPrice) || 0,
        cartShareCode,
        bankCommissionEnabled,
        couponEnabled,
        couponRate,
        couponValue: currentCalcs.couponValue,
        productsSum: currentCalcs.productsSum,
        packagingFeeEnabled,
        packagingFeeRate,
        totalWeight: currentCalcs.totalWeight,
        totalCBM: currentCalcs.totalCBM,
        totalCostSAR: currentCalcs.totalOrderSAR,
        totalCostYER: currentCalcs.totalOrderYER,
        amountPaid: toNumber(formData.amountPaid) || 0,
        amountRemaining: currentCalcs.remainingYER,
        paymentStatus: payStatus,
        // حفظ خيارات الحفظ الإضافية في سجل الطلب
        // Save extra order creation options in the order record
        homeDeliveryEnabled: homeDeliveryEnabled,
        viaShippingAgent: viaShippingAgent,
        payLater: payLater,
        directApprove: directApprove,
        paymentMethod: payLater
          ? "Deferred"
          : formData.paymentMethod || "Cash",
        cashAccountId: formData.cashAccountId || null,
        bankAccountId: formData.bankAccountId || null,
        bankReference: formData.bankReference || "",
        cashAmount: toNumber(formData.cashAmount) || 0,
        bankAmount: toNumber(formData.bankAmount) || 0,
        profitPerKgRate: toNumber(profitPerKgRate) || 19,
        cbmShippingRateValue: toNumber(cbmShippingRateValue) || 1400,
        addShippingEnabled,
        shippingCostSAR: currentCalcs.shippingCostSAR,
        shippingCourierFeeRate: viaShippingAgent
          ? toNumber(formData.shippingCourierFeeRate) || 0
          : 0,
        profitSaudiSAR: viaShippingAgent ? currentCalcs.profitSaudiSAR : 0,
        profitCompanySAR: currentCalcs.profitCompanySAR,
        deductSourcingCostFromCourier: viaShippingAgent
          ? Boolean(formData.deductSourcingCostFromCourier)
          : false,
        sourcing_cost:
          viaShippingAgent && formData.deductSourcingCostFromCourier
            ? "courier"
            : "system",
        sourcingCostAmount: currentCalcs.sourcingCostAmount,
        // نص حالة الطلب يأخذ بعين الاعتبار الاعتماد المباشر والدفع لاحقاً
        // Order status text respects directApprove and payLater
        orderStatus: orderStatusText,
        deliveryStatus: "في الانتظار",
        locationYemen: "في الانتظار",
        firedTriggers: initialFiredTriggers,
        shippingCompany: formData.shippingCompany,
        externalOrderNumber: formData.externalOrderNumber,
        deliveryCourierFee: homeDeliveryEnabled
          ? toNumber(formData.deliveryCourierFee) || 0
          : 0,
        deliveryCourierFeeCurrency: currentCalcs.deliveryCourierFeeCurrency,
        deliveryCourierFeeOrderCurrency:
          currentCalcs.deliveryCourierFeeOrderCurrency,
        productInsuranceFee: currentCalcs.itemsInsuranceSum,
        product_insurance_fee: currentCalcs.itemsInsuranceSum,
        createdAt: Date.now(),
      };
      //حفظ الطلب في جدول الطلب
      await createOrderRecord(payload.orderNumber, payload);

      // ─── حفظ المنتجات الرئيسية في products ثم بنود الطلب في order_items ───
      // Save master products in 'products' table (only if brand new item with no product_id),
      // then save each order line item in 'order_items' referencing the master product.
      if (items && items.length > 0) {
        // إيجاد cur_id لعملة الطلب الافتراضية من جدول currency لاستخدامه في product_price_currency
        // Look up cur_id for the default order currency to use as product_price_currency FK
        const orderCurrencyRecord = activeCurrencies?.find(
          c =>
            String(c.code || "").toUpperCase() ===
            String(orderCurrency || "").toUpperCase()
        );
        const orderCurrencyId =
          orderCurrencyRecord?.cur_id || orderCurrencyRecord?.code || null;

        for (const item of items) {
          const qty = toNumber(item.quantity || 1);
          const unitPrice = toNumber(
            item.productPrice || item.price || item.unitPrice || 0
          );
          const weight = toNumber(item.weight || 0);
          const cbm = toNumber(item.cbm || 0);
          const isInsured = Boolean(item.isInsured);
          const insuranceFee = isInsured
            ? toNumber(item.insuranceFee) || 0
            : 0;

          // ── التحقق من معرف المنتج: إذا كان المنتج موجود مسبقاً (product_id مملوء) فلا تنشئه مجدداً ──
          // Check if item has an existing master product_id - if yes, skip creating new master product
          let masterProductId = item.product_id || item.productId || null;
          // تنظيف المعرف الفارغ أو غير الصالح
          // Sanitize empty or invalid product_id
          if (masterProductId && typeof masterProductId === "string") {
            masterProductId = masterProductId.trim() || null;
          }

          if (!masterProductId) {
            // ── منتج جديد: أنشئه في products مع تعبئة جميع الحقول والعملة الافتراضية ──
            // Brand new product: create in products table with all fields and order currency FK
            masterProductId =
              "prod_" + Math.random().toString(36).substring(2, 11);
            await createProductRecord(masterProductId, {
              product_id: masterProductId,
              product_name_ar: item.productName || item.name || "منتج",
              product_name_en:
                item.productNameEn ||
                item.productName ||
                item.name ||
                "Product",
              product_url: item.productUrl || "",
              // تعبئة مرجع عملة السعر بـ cur_id من جدول العملات
              // Populate currency FK with cur_id from currency table matching order default currency
              product_price_currency: orderCurrencyId,
              unit_price: unitPrice,
              item_category_id:
                item.itemCategoryId || item.item_category_id || null,
              is_allowed: true,
              cbm: cbm,
              width: toNumber(item.width || 0),
              height: toNumber(item.height || 0),
              length: toNumber(item.length || 0),
              weight: weight,
              created_at: new Date().toISOString(),
              created_by: profile?.fullName || "system",
              updated_at: new Date().toISOString(),
              updated_by: profile?.fullName || "system",
            });
          }
          // إذا كان masterProductId موجوداً مسبقاً → لا يتم إنشاء أي سجل جديد في products
          // If masterProductId already exists → skip inserting into products, use existing reference

          // ── حفظ بند الطلب في order_items مرتبطاً بالطلب والمنتج الرئيسي ──
          // Save order line item in 'order_items' linked to order & master product
          const itemId = "item_" + Math.random().toString(36).substring(2, 11);
          await createOrderItem(itemId, {
            items_id: itemId,
            order_id: payload.orderNumber,
            product_id: masterProductId,
            product_price: unitPrice,
            product_url: item.productUrl || "",
            tracking_number: item.trackingNumber || "",
            produc_source_id: formData.orderSourceId || null,
            produc_source_url: item.productUrl || "",
            product_cooler: item.productName || item.name || "منتج",
            nota: item.notes || item.description || "",
            quantity: qty,
            total_price: qty * unitPrice,
            total__weight: weight * qty,
            total_cbm: cbm * qty,
            packaging_option_id: item.packagingOptionId || null,
            packaging_option_price: toNumber(item.packagingOptionPrice || 0),
            is_insured: isInsured,
            insurance_fee: insuranceFee,
            items_status: "قيد الطلب",
            created_at: new Date().toISOString(),
            created_by: profile?.fullName || "system",
            updated_at: new Date().toISOString(),
            updated_by: profile?.fullName || "system",
          });
        }
      }

      // حفظ شحنات الطلب في جدول الشحنات
      // Save order shipments to dedicated shipments table - always save if shippings exist
      const shippingsToSave = (shippings || []).filter(
        s =>
          s && (s.shippingCompany || s.trackingNumber || s.shippingCost)
      );
      for (const ship of shippingsToSave) {
        const shipId =
          ship.id || "sh_" + Math.random().toString(36).substring(2, 11);
        await createShipmentRecord(shipId, {
          id: shipId,
          // ربط الشحنة بالطلب عبر رقم الطلب (المفتاح الأجنبي)
          order_id: payload.orderNumber,
          orderId: payload.orderNumber,
          tracking_number:
            ship.trackingNumber ||
            payload.trackingNumber ||
            payload.orderNumber,
          trackingNumber:
            ship.trackingNumber ||
            payload.trackingNumber ||
            payload.orderNumber,
          shipping_company_id:
            ship.shippingCompany || payload.shippingCompany || "Aramex",
          shippingCompanyId:
            ship.shippingCompany || payload.shippingCompany || "Aramex",
          courier_id:
            formData.deliveryCourierId || formData.shippingCourierId || null,
          courierId:
            formData.deliveryCourierId || formData.shippingCourierId || null,
          shipment_status: ship.shipmentStatus || "طلب معلق",
          shipmentStatus: ship.shipmentStatus || "طلب معلق",
          shipping_cost: toNumber(ship.shippingCost || 0),
          shippingCost: toNumber(ship.shippingCost || 0),
          weight: toNumber(ship.weight || 0),
          shipping_category_id:
            ship.shippingCategoryId || ship.shipping_category_id || null,
          shippingCategoryId:
            ship.shippingCategoryId || ship.shipping_category_id || null,
          content_category_id:
            ship.contentCategoryId || ship.content_category_id || null,
          contentCategoryId:
            ship.contentCategoryId || ship.content_category_id || null,
          content_category_name:
            ship.contentCategoryName || ship.content_category_name || "",
          contentCategoryName:
            ship.contentCategoryName || ship.content_category_name || "",
          carton_count: toNumber(ship.cartonCount || 0),
          cartonCount: toNumber(ship.cartonCount || 0),
          customs_fee: toNumber(ship.customsFee || 0),
          customsFee: toNumber(ship.customsFee || 0),
          tax_fee: toNumber(ship.taxFee || 0),
          taxFee: toNumber(ship.taxFee || 0),
          other_category_fee: toNumber(ship.otherCategoryFee || 0),
          otherCategoryFee: toNumber(ship.otherCategoryFee || 0),
          category_fees_total: toNumber(ship.categoryFeesTotal || 0),
          categoryFeesTotal: toNumber(ship.categoryFeesTotal || 0),
          category_fee_currency: ship.categoryFeeCurrency || "",
          categoryFeeCurrency: ship.categoryFeeCurrency || "",
          createdAt: Date.now(),
        });
      }

      // Ensure system accounts exist
      let systemAccs: Record<string, string> = {};
      try {
        systemAccs = await financialAccountService.ensureSystemAccounts(
          settings.currency || "SAR"
        );
      } catch (err) {
        console.error("Could not ensure system accounts:", err);
      }

      // --- Financial Account Impact ---
      const customerRecord =
        readRelatedRecord(selectedOrderParty?.raw) ||
        customers.find(c => c.id === formData.customerId);
      const courierRecord = couriers.find(
        c => c.id === formData.shippingCourierId
      );
      const linkedAccountId =
        formData.orderPartyAccountId ||
        customerRecord?.financialAccountId ||
        customerRecord?.accountId;
      const linkedAccountCode =
        customerRecord?.financialAccountCode || customerRecord?.accountCode;

      if (linkedAccountId) {
        try {
          const accountExists =
            await financialAccountService.getAccountById(linkedAccountId);
          if (!accountExists) {
            console.error(
              "[Orders] Financial account missing in DB, skipping transaction:",
              linkedAccountId
            );
            return;
          }

          const totalBilledOriginal = currentCalcs.totalOrderYER;
          const convertedOrderAmount =
            financialAccountService.convertToDefaultCurrency(
              totalBilledOriginal,
              "YER",
              settings.currency || "YER",
              { USD: formData.exchangeRateUSD, SAR: formData.exchangeRateYER }
            );

          //const customerRecord = customers.find(c => c.id === payload.customerId);
          /*await autoEntryService.executeAutoEntriesForStatus(
            payload.orderStatusId || ORDER_STATUS_FALLBACKS.create,
            payload, {
            customer: customerRecord,
            courier: courierRecord,
            sourcing_cost: payload.sourcing_cost,
            isAr,
            rawAmountOverride: convertedOrderAmount,
            profileName: profile?.fullName || 'Root Admin'
          }
          );*/

          const paidVal = toNumber(formData.amountPaid) || 0;
          const paidCurrency = formData.currency;
          if (paidVal > 0) {
            const convertedPaid =
              financialAccountService.convertToDefaultCurrency(
                paidVal,
                "YER",
                settings.currency || "YER",
                {
                  paidCurrency: formData.exchangeRateUSD,
                  SAR: formData.exchangeRateYER,
                }
              );

            //const customerRecord = customers.find(c => c.id === payload.customerId);
            await autoEntryService.executeAutoEntriesForStatus(
              payload.orderStatusId || ORDER_STATUS_FALLBACKS.create,
              payload,
              {
                customer: customerRecord,
                orderParty: customerRecord,
                sourcing_cost: payload.sourcing_cost,
                courier: courierRecord,
                isAr,
                profileName: profile?.fullName || "Root Admin",
              }
            );
          }
        } catch (txErr) {
          console.error(
            "[Orders] Error registering financial account transactions:",
            txErr
          );
        }
      }

      // For App and Factory orders with shipping: sourcing cost = products cost + shipping cost - coupon discount
      const sourcingCostAmount =
        formData.orderSourceType === "App" ||
        formData.orderSourceType === "Factory"
          ? currentCalcs.totalProductsCostWithAdjustments +
            currentCalcs.shippingCostSAR
          : currentCalcs.totalProductsCostWithAdjustments;
      //  financialAccountService.convertToDefaultCurrency(
      //   sourcingCostAmount,
      //   'SAR',
      //   settings.currency || 'YER',
      //   dbRates
      // );

      // شرط خصم تكلفه المنتجات و الشحن من حساب المندوب في حاله التكاليف عليه  وخصمها من الشركه في حاله الشحن الداخلي
      /*if (formData.deductSourcingCostFromCourier && formData.shippingCourierId) {
        const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId);
        if (saudiCourier && saudiCourier.financialAccountId) {
          try {
            const isSourcing = saudiCourier.courierType === 'sourcing';
            const courierCurrency = saudiCourier.financialCurrency || 'YER';

            const amountInCourierCurrency = financialAccountService.convertToDefaultCurrency(
              sourcingCostAmount,
              'SAR',
              courierCurrency,
              dbRates
            );

            await autoEntryService.executeAutoEntriesForStatus(
              payload.orderStatusId || ORDER_STATUS_FALLBACKS.create,
              payload, {
              customer: customerRecord,
              sourcing_cost: payload.sourcing_cost,
              courier: courierRecord,
              isAr,
              rawAmountOverride: amountInCourierCurrency,
              amountOriginal: sourcingCostAmount,
              currencyOriginal: 'SAR',
              profileName: profile?.fullName || 'Root Admin'
            }
            );

          } catch (e) {
            console.error('Failed to deduct sourcing from courier', e);
          }
        }
      } else if (systemAccs['sys_sourcing_cost']) {
        // Debit Sourcing Costs Account (Instead of Courier)
        try {
          await autoEntryService.executeAutoEntriesForStatus(
            payload.orderStatusId || ORDER_STATUS_FALLBACKS.create,
            payload, {
            customer: customerRecord,
            sourcing_cost: payload.sourcing_cost,
            courier: courierRecord,
            isAr,
            rawAmountOverride:sourcingCostAmount,
            amountOriginal: sourcingCostAmount,
            currencyOriginal: 'SAR',
            profileName: profile?.fullName || 'Root Admin'
          }
          );
        } catch (e) {
          console.error('Failed to deduct sourcing from system account', e);
        }
      }*/

      // Record Packaging Fees Credit
      const shippingsCostSum = shippings.reduce(
        (sum, s) =>
          sum +
          toNumber(s.shippingCost || 0) +
          toNumber(s.packagingFees || 0),
        0
      );
      // packagingFeeRate is now a fixed SAR amount (not percentage)
      /*const shippingPackagingFixed = packagingFeeEnabled ? (toNumber(packagingFeeRate) || 0) : 0;
      const packagingFeeSAR = toNumber(formData.packagingFee || 0);


      if (packagingFeeSAR > 0 && systemAccs['sys_packaging_fees']) {
        try {
          const pkgConverted = financialAccountService.convertToDefaultCurrency(
            packagingFeeSAR,
            'SAR',
            settings.currency || 'YER',
            dbRates
          );
          await autoEntryService.executeAutoEntriesForStatus(
            payload.orderStatusId || ORDER_STATUS_FALLBACKS.create,
            payload, {
            customer: customerRecord,
            courier: courierRecord,
            sourcing_cost: payload.sourcing_cost,
            isAr,
            rawAmountOverride: pkgConverted,
            amountOriginal: packagingFeeSAR,
            currencyOriginal: 'SAR',
            profileName: profile?.fullName || 'Root Admin'
          }
          );
        } catch (e) {
          console.error('Failed to log packaging fee', e);
        }
      }*/

      // Record Shipping Cost Debit (for every order type with shipping cost)
      // Only apply if deduction on courier is not set, and shipping costs are not merged with product costs
      // قيد تنفيذ الشحن على الشركه عند الشحن من التطبيق ويزيد مصاريف الشركه
      /*if (
        currentCalcs.shippingCostSAR > 0 &&
        systemAccs['sys_shipping_costs'] &&
        !formData.deductSourcingCostFromCourier &&
        formData.orderSourceType !== 'SHEIN' &&
        formData.orderSourceType !== 'App' &&
        formData.orderSourceType !== 'Factory'
      ) {
        try {
          const shipCostConverted = financialAccountService.convertToDefaultCurrency(
            currentCalcs.shippingCostSAR,
            'SAR',
            settings.currency || 'YER',
            dbRates
          );
          await autoEntryService.executeAutoEntriesForStatus(
            payload.orderStatusId || ORDER_STATUS_FALLBACKS.create,
            payload, {
            isAr,
            rawAmountOverride: shipCostConverted,
            amountOriginal: currentCalcs.shippingCostSAR,
            currencyOriginal: 'SAR',
            profileName: profile?.fullName || 'Root Admin'
          }
          );
        } catch (e) {
          console.error('Failed to log shipping cost', e);
        }
      }*/

      // Record Company Profit and Saudi Partner Profit will be recorded upon designated logistics statuses (handled in Update Status).
      // Removed direct ledger creation for couriers and company profit from here to prevent duplicates.
      // Removed Yemen delivery driver wage creation here to prevent duplicates (handled on "تم التسليم").

      const selectedCustomer = customers.find(
        c => c.id === payload.customerId || c.id === payload.orderPartyId
      );
      const customerDisplayName = selectedCustomer
        ? selectedCustomer.name ||
          selectedCustomer.nameAr ||
          selectedCustomer.nameEn ||
          "عميل"
        : formData.customerName || "عميل";

      // Log the order creation to activity log
      activityLogService.log("add_order", payload.orderNumber || "New Order", {
        orderId: payload.orderNumber,
        orderNumber: payload.orderNumber,
        customer: customerDisplayName,
        total: payload.totalCostYER,
        status: payload.orderStatus,
      });

      // Trigger automatic receipt alerts/notifications
      await notificationService.notify({
        title: isAr ? "نجاح التسجيل الفاتورة" : "Registered Successfully",
        message: isAr
          ? `تم تسجيل الفاتورة برقم موحد: ${orderNumber}`
          : `Saved order with code: ${orderNumber}`,
        type: "success",
        category: "order",
        orderId: orderNumber,
      });

      // Automatically dispatch real WhatsApp message based on active templates and config
      try {
        await whatsappService.triggerNotification("onOrderCreated", {
          ...payload,
          customerName: customerDisplayName,
        });
      } catch (whatsappErr) {
        console.error(
          "Failed to trigger real WhatsApp on order creation:",
          whatsappErr
        );
      }

      // Automatically dispatch simulated API dispatch status for WhatsApp + SMS in logs/panel
      const remainingVal = toNumber(payload.amountRemaining || "0");
      const totalCostYERVal =
        toNumber(payload.amountPaid || "0") +
        toNumber(payload.amountRemaining || "0");
      const smsMessage = isAr
        ? `عزيزنا العميل ${customerDisplayName}، تم تأكيد طلبك رقم: (${orderNumber}) بنجاح. حالة الشحنة: (${payload.orderStatus}). تتبع مع: ${payload.shippingCompany}، تتبع رقم: ${payload.trackingNumber || "قيد الرفع"}. القيمة الإجمالية: ${totalCostYERVal.toLocaleString()} YER، المتبقي: ${remainingVal.toLocaleString()} YER.`
        : `Dear ${customerDisplayName}, your order ${orderNumber} has been confirmed. Status: ${payload.orderStatus}. Track with ${payload.shippingCompany}: ${payload.trackingNumber || "Pending"}. Total: ${totalCostYERVal.toLocaleString()} YER, Remaining: ${remainingVal.toLocaleString()} YER.`;

      await notificationService.notify({
        title: isAr
          ? "📲 إرسال تلقائي (WhatsApp + SMS)"
          : "📲 Automatic WhatsApp / SMS Dispatcher",
        message: smsMessage,
        type: "success",
        orderId: orderNumber,
        category: "order",
      });

      setIsAddModalOpen(false);
      resetCreateForm();
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: "Error",
        message: "Could not create order document due to a write blocker.",
        type: "error",
        category: "order",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
}
