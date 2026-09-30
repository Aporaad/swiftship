import type { Dispatch, FormEvent, SetStateAction } from "react";
import toast from "react-hot-toast";
import { activityLogService } from "../../../services/activityLogService";
import { autoEntryService } from "../../../services/autoEntryService";
import { financialAccountService } from "../../../services/financialAccountService";
import { notificationService } from "../../../services/notificationService";
import { orderHistoryService } from "../../../services/orderHistoryService";
import { whatsappService } from "../../../services/whatsappService";
import { findOrderParty } from "../../../services/orderPartyService";
import {
  getProcessedStatusIds,
  planOrderStatusTransition,
} from "../../../services/orderLifecycleService";
import { ORDER_STATUS_FALLBACKS } from "../constants/orders.constants";
import type { OrderStatusDescriptor, UpdateFormData } from "../types";

type LegacyShipmentRecord = Record<string, any>;

export interface UpdateOrderStatusHandlerDependencies {
  isSubmitting: boolean;
  isAr: boolean;
  auth: any;
  autoVoucherRules: any[];
  buildOrderRates: (...args: any[]) => any;
  couriers: any[];
  customers: any[];
  dbRates: Record<string, number>;
  employees: any[];
  getStatusByAny: (status: any) => any;
  orderStatusesList: OrderStatusDescriptor[];
  profile: any;
  selectedOrder: any;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setIsUpdateModalOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedOrder: Dispatch<SetStateAction<any>>;
  settings: any;
  shippingCompanies: any[];
  sources: any[];
  updateFormData: UpdateFormData;
  updateOrderRecord: (...args: any[]) => Promise<any>;
  updateShippings: LegacyShipmentRecord[];
  upsertShipment: (...args: any[]) => Promise<any>;
}

export function createUpdateOrderStatusHandler(
  dependencies: UpdateOrderStatusHandlerDependencies
) {
  const {
    isSubmitting,
    isAr,
    auth,
    autoVoucherRules,
    buildOrderRates,
    couriers,
    customers,
    dbRates,
    employees,
    getStatusByAny,
    orderStatusesList,
    profile,
    selectedOrder,
    setIsSubmitting,
    setIsUpdateModalOpen,
    setSelectedOrder,
    settings,
    shippingCompanies,
    sources,
    updateFormData,
    updateOrderRecord,
    updateShippings,
    upsertShipment,
  } = dependencies;

  return async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedOrder) return;

    setIsSubmitting(true);
    try {
      const currentStatus = selectedOrder.orderStatus || "طلب معلق";
      const newStatus = updateFormData.orderStatus;
      const firedTriggers = selectedOrder.firedTriggers || [];
      const newFiredTriggers = [...firedTriggers];

      const currentStatusItem =
        getStatusByAny(
          selectedOrder.order_status_id ||
            selectedOrder.orderStatusId ||
            currentStatus
        ) || orderStatusesList[0];
      const newStatusItem = getStatusByAny(newStatus) || orderStatusesList[0];

      const currentStageId =
        currentStatusItem?.id || ORDER_STATUS_FALLBACKS.individualUpdate;
      const newStageId =
        newStatusItem?.id || ORDER_STATUS_FALLBACKS.individualUpdate;
      const statusHistory = await orderHistoryService.listForContext({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        entityType: "order",
        label: selectedOrder.orderNumber || selectedOrder.id,
      });
      const transitionPlan = planOrderStatusTransition(
        orderStatusesList,
        currentStageId,
        newStageId,
        getProcessedStatusIds(statusHistory)
      );
      if (!transitionPlan.allowed) {
        const messages: Record<string, string> = {
          same_status: isAr
            ? "هذه الحالة مسجلة للطلب بالفعل؛ لن يعاد تنفيذ التحديث أو القيود."
            : "This status is already recorded for the order.",
          backward_transition: isAr
            ? "لا يمكن إرجاع الطلب إلى مرحلة سابقة بعد تنفيذ مرحلة لاحقة."
            : "An order cannot move back to a previously passed stage.",
          status_previously_processed: isAr
            ? "سبق تنفيذ هذه المرحلة للطلب وفق سجل التدقيق؛ تم منع التكرار."
            : "This stage was already processed according to the audit history.",
          unknown_status: isAr
            ? "تعذر التحقق من ترتيب الحالة. يرجى مراجعة إعدادات المراحل."
            : "Unable to validate the status sequence. Please review stage settings.",
        };
        toast.error(messages[transitionPlan.reason || "unknown_status"]);
        return;
      }

      const remainingVal = parseFloat(selectedOrder.amountRemaining || "0");
      const courierId =
        updateFormData.deliveryCourierId || selectedOrder.deliveryCourierId;
      const shippingCourierId =
        updateFormData.shippingCourierId || selectedOrder.shippingCourierId;

      let extraUpdateFields: any = {};

      //مهم: استدعاء مرحله الطلب  بال id وليس الاسم
      const getStageIdByName = (statusName: string) => {
        const item = orderStatusesList.find(
          s =>
            s.nameAr === statusName ||
            s.nameEn === statusName ||
            s.code === statusName
        );
        return item ? item.id : 0;
      };

      // Helper to check if a trigger should fire based on stage sequence
      //داله للتحقق من مرحله الطلب هل هي مطلوبه لترسيل الاشعار ام لا
      const shouldFire = (triggerId: string, minStatus: string) => {
        if (firedTriggers.includes(triggerId)) return false;
        if (newStatus === "ملغي" || newStatusItem?.code === "cancelled")
          return false;

        const minStageId = getStageIdByName(minStatus);
        return newStageId >= minStageId;
      };
      //مهم: يجب استدعاء حاله او مرحله الطلب بواسطه ال id مثل1 الاسم pending وليس "معلق"
      // Status change trigger - to prevent duplicate notifications
      const statusTriggerId = `status_notified_${newStatus}`;
      const isAlreadyNotified = firedTriggers.includes(statusTriggerId);
      const selectedOrderParty = findOrderParty(
        selectedOrder,
        customers,
        employees,
        couriers
      );
      const selectedOrderPartyRaw = selectedOrderParty?.raw || null;
      const selectedOrderAccountId =
        selectedOrder.orderPartyAccountId ||
        selectedOrder.order_party_account_id ||
        selectedOrderParty?.accountId ||
        selectedOrderPartyRaw?.financialAccountId ||
        selectedOrderPartyRaw?.accountId ||
        null;

      // Pending Portal Order Approval Trigger (order_charge & order_down_payment)
      if (
        (currentStatus === "معلق" || selectedOrder.status === "pending") &&
        newStatus !== "معلق" &&
        newStatus !== "ملغي"
      ) {
        const customerRecord = selectedOrderPartyRaw;
        if (customerRecord && selectedOrderAccountId) {
          try {
            if (!firedTriggers.includes("order_charge")) {
              const totalBilledOriginal = parseFloat(
                selectedOrder.totalCostYER || selectedOrder.totalOrderYER || "0"
              );
              const convertedOrderAmount =
                financialAccountService.convertToDefaultCurrency(
                  totalBilledOriginal,
                  "YER",
                  settings.currency || "YER",
                  dbRates
                );

              await financialAccountService.triggerAutomaticVoucher(
                "order_charge",
                selectedOrder,
                {
                  customer: customerRecord,
                  orderParty: selectedOrderParty,
                  isAr,
                  rawAmount: convertedOrderAmount,
                  profileName: profile?.fullName || "Admin Approval",
                }
              );
              newFiredTriggers.push("order_charge");
            }

            const paidVal = parseFloat(selectedOrder.amountPaid || "0");
            if (paidVal > 0 && !firedTriggers.includes("order_down_payment")) {
              const convertedPaid =
                financialAccountService.convertToDefaultCurrency(
                  paidVal,
                  "YER",
                  settings.currency || "YER",
                  dbRates
                );

              await financialAccountService.triggerAutomaticVoucher(
                "order_down_payment",
                selectedOrder,
                {
                  customer: customerRecord,
                  orderParty: selectedOrderParty,
                  isAr,
                  rawAmount: convertedPaid,
                  profileName: profile?.fullName || "Admin Approval",
                }
              );
              newFiredTriggers.push("order_down_payment");
            }
          } catch (txErr) {
            console.error(
              "[Orders] Error posting financial transactions on portal order approval:",
              txErr
            );
          }
        }
        extraUpdateFields.status = "accepted";
      }

      if (
        isAlreadyNotified &&
        newStatus !== "ملغي" &&
        newStatus !== currentStatus
      ) {
        toast.error(
          isAr
            ? `تنبيه: تم إرسال إشعار بهذه الحالة (${newStatus}) للعميل مسبقاً. لن يتم تكرار الإرسال.`
            : `Warning: A notification for this status (${newStatus}) has already been sent. WhatsApp will not be resent.`
        );
      }

      // 1. courier_commission trigger
      if (
        shouldFire("courier_commission", "وصل مركز التوزيع في اليمن") &&
        shippingCourierId
      ) {
        const courierRecord = couriers.find(c => c.id === shippingCourierId);
        if (courierRecord) {
          const isSourcing = courierRecord.courierType === "sourcing";
          const exchangeRate = parseFloat(
            selectedOrder.exchangeRateYER || dbRates.SAR || 1
          );
          const commissionProfitOriginal = parseFloat(
            selectedOrder.profitSaudiSAR || "0"
          );
          const commissionProfit = isSourcing
            ? commissionProfitOriginal
            : commissionProfitOriginal * exchangeRate;
          const finalCurrency = isSourcing ? "SAR" : "YER";

          if (commissionProfit > 0) {
            const YY = String(new Date().getFullYear()).slice(-2);
            const MM = String(new Date().getMonth() + 1).padStart(2, "0");
            const commissionNumber = `COM-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;
            const courierName = courierRecord.fullName;
            const linkedAccountId = courierRecord.financialAccountId || null;
            const linkedAccountCode =
              courierRecord.financialAccountCode || null;

            const convertedCommission =
              financialAccountService.convertToDefaultCurrency(
                commissionProfit,
                finalCurrency,
                settings.currency || "YER",
                buildOrderRates(selectedOrder)
              );

            const commissionRule = autoVoucherRules.find(
              r => r.id === "courier_commission"
            );
            if (!commissionRule || commissionRule.isActive !== false) {
              const commissionPayload = {
                expenseNumber: commissionNumber,
                category: "wage",
                type: "Wage",
                amount: commissionProfit,
                currency: finalCurrency,
                amountInDefaultCurrency: convertedCommission,
                recipientId: shippingCourierId,
                recipientEntityId: shippingCourierId,
                recipientEntityType: "courier",
                recipientName: courierName,
                linkedAccountId,
                linkedAccountCode,
                notes: isAr
                  ? `عمولة شحن تلقائية (${courierRecord.commissionRate}%) للطلب رقم: ${selectedOrder.orderNumber}`
                  : `Auto-commission (${courierRecord.commissionRate}%) for order: ${selectedOrder.orderNumber}`,
                status: "Approved",
                createdByUid: auth.currentUser?.uid || "system",
                createdByEmail:
                  auth.currentUser?.email || "admin@swiftship.system",
                createdByName: profile?.fullName || "System Auto-Commission",
                createdAt: Date.now(),
              };
            }

            if (linkedAccountId) {
              try {
                await financialAccountService.triggerAutomaticVoucher(
                  "courier_commission",
                  selectedOrder,
                  {
                    courier: courierRecord,
                    orderParty: selectedOrderParty,
                    isAr,
                    rawAmount: convertedCommission,
                    amountOriginal: commissionProfit,
                    currencyOriginal: finalCurrency,
                    expenseNumber: commissionNumber,
                    profileName: profile?.fullName || "System Auto-Commission",
                  }
                );
              } catch (txErr) {
                console.warn(
                  "[Orders] Could not record commission wage:",
                  txErr
                );
              }
            }
            newFiredTriggers.push("courier_commission");
          }
        }
      }

      // 2. custody_payment trigger
      if (
        shouldFire("custody_payment", "مع المندوب للتوصيل") &&
        remainingVal > 0 &&
        courierId
      ) {
        const YY = String(new Date().getFullYear()).slice(-2);
        const MM = String(new Date().getMonth() + 1).padStart(2, "0");
        const expenseNumber = `EXP-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;

        const courierRecord = couriers.find(c => c.id === courierId);
        const courierName = courierRecord
          ? courierRecord.fullName
          : isAr
            ? "مندوب توصيل"
            : "Delivery Courier";
        const linkedAccountId = courierRecord?.financialAccountId || null;
        const linkedAccountCode = courierRecord?.financialAccountCode || null;

        const convertedRemainingVal =
          financialAccountService.convertToDefaultCurrency(
            remainingVal,
            "YER",
            settings.currency || "YER",
            {
              USD: selectedOrder.exchangeRateUSD || dbRates.USD,
              SAR: selectedOrder.exchangeRateYER || dbRates.SAR,
            }
          );

        const custodyRule = autoVoucherRules.find(
          r => r.id === "custody_payment"
        );
        if (!custodyRule || custodyRule.isActive !== false) {
          const custodyPayload = {
            expenseNumber,
            category: "custody",
            type: "Custody",
            amount: remainingVal,
            currency: "YER",
            amountInDefaultCurrency: convertedRemainingVal,
            recipientId: courierId,
            recipientEntityId: courierId,
            recipientEntityType: "courier",
            recipientName: courierName,
            linkedAccountId,
            linkedAccountCode,
            notes: isAr
              ? `عهدة تلقائية مرحلة من تسليم الطلب رقم: ${selectedOrder.orderNumber}`
              : `Auto-custody generated from delivery of order: ${selectedOrder.orderNumber}`,
            status: "Pending",
            createdByUid: auth.currentUser?.uid || "system",
            createdByEmail: auth.currentUser?.email || "admin@swiftship.system",
            createdByName: profile?.fullName || "System Auto-Custody",
            createdAt: Date.now(),
          };
        }

        const customerRecord = selectedOrderPartyRaw;
        if (linkedAccountId && selectedOrderAccountId) {
          try {
            await financialAccountService.triggerAutomaticVoucher(
              "custody_payment",
              selectedOrder,
              {
                courier: {
                  accountId: linkedAccountId,
                  accountCode: linkedAccountCode,
                },
                customer: customerRecord,
                orderParty: selectedOrderParty,
                isAr,
                rawAmount: convertedRemainingVal,
                amountOriginal: remainingVal,
                currencyOriginal: "YER",
                expenseNumber,
                profileName: profile?.fullName || "System Auto-Custody",
              }
            );
          } catch (txErr) {
            console.warn(
              "[Orders] Could not record auto-custody/payment:",
              txErr
            );
          }
        }

        extraUpdateFields = {
          ...extraUpdateFields,
          amountPaid:
            parseFloat(selectedOrder.amountPaid || "0") + remainingVal,
          amountRemaining: 0,
          paymentStatus: "Paid",
        };
        newFiredTriggers.push("custody_payment");
      }

      // 3. delivery_wage trigger
      const deliveryFee = parseFloat(selectedOrder.deliveryCourierFee || "0");
      if (
        shouldFire("delivery_wage", "تم التسليم") &&
        courierId &&
        deliveryFee > 0
      ) {
        const YY = String(new Date().getFullYear()).slice(-2);
        const MM = String(new Date().getMonth() + 1).padStart(2, "0");
        const wageNumber = `WGE-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;

        const courierRecord = couriers.find(c => c.id === courierId);
        const courierName = courierRecord
          ? courierRecord.fullName
          : isAr
            ? "مندوب توصيل"
            : "Delivery Courier";
        const linkedAccountId = courierRecord?.financialAccountId || null;
        const linkedAccountCode = courierRecord?.financialAccountCode || null;

        const convertedFee = financialAccountService.convertToDefaultCurrency(
          deliveryFee,
          "YER",
          settings.currency || "YER",
          {
            USD: selectedOrder.exchangeRateUSD || dbRates.USD,
            SAR: selectedOrder.exchangeRateYER || dbRates.SAR,
          }
        );

        const wageRule = autoVoucherRules.find(r => r.id === "delivery_wage");
        if (!wageRule || wageRule.isActive !== false) {
          const wagePayload = {
            expenseNumber: wageNumber,
            category: "wage",
            type: "Wage",
            amount: deliveryFee,
            currency: "YER",
            amountInDefaultCurrency: convertedFee,
            recipientId: courierId,
            recipientEntityId: courierId,
            recipientEntityType: "courier",
            recipientName: courierName,
            linkedAccountId,
            linkedAccountCode,
            notes: isAr
              ? `أجور توصيل تلقائية لتسليم الطلب رقم: ${selectedOrder.orderNumber}`
              : `Auto-wage for delivery of order: ${selectedOrder.orderNumber}`,
            status: "Approved",
            createdByUid: auth.currentUser?.uid || "system",
            createdByEmail: auth.currentUser?.email || "admin@swiftship.system",
            createdByName: profile?.fullName || "System Auto-Wage",
            createdAt: Date.now(),
          };
        }

        if (linkedAccountId) {
          try {
            await financialAccountService.triggerAutomaticVoucher(
              "delivery_wage",
              selectedOrder,
              {
                courier: {
                  accountId: linkedAccountId,
                  accountCode: linkedAccountCode,
                },
                orderParty: selectedOrderParty,
                isAr,
                rawAmount: convertedFee,
                amountOriginal: deliveryFee,
                currencyOriginal: "YER",
                expenseNumber: wageNumber,
                profileName: profile?.fullName || "System Auto-Wage",
              }
            );
          } catch (txErr) {
            console.warn("[Orders] Could not record delivery wage:", txErr);
          }
        }
        newFiredTriggers.push("delivery_wage");
      }

      // 4. company_profit trigger
      if (
        shouldFire("company_profit", "تم التسليم") &&
        parseFloat(selectedOrder.profitCompanySAR || "0") > 0
      ) {
        try {
          const profitValSAR = parseFloat(
            selectedOrder.profitCompanySAR || "0"
          );
          const profitConverted =
            financialAccountService.convertToDefaultCurrency(
              profitValSAR,
              "SAR",
              settings.currency || "YER",
              dbRates
            );

          await financialAccountService.triggerAutomaticVoucher(
            "company_profit",
            selectedOrder,
            {
              orderParty: selectedOrderParty,
              isAr,
              rawAmount: profitConverted,
              amountOriginal: profitValSAR,
              currencyOriginal: "SAR",
              profileName: profile?.fullName || "System Auto-Profit",
            }
          );
          newFiredTriggers.push("company_profit");
        } catch (e) {
          console.warn("[Orders] Could not record company profit:", e);
        }
      }

      if (!isAlreadyNotified && newStatus !== "ملغي") {
        newFiredTriggers.push(statusTriggerId);
      }

      // Execute automatic entries for every missed stage in order, not only the final stage.
      if (transitionPlan.stagesToProcess.length > 0) {
        try {
          const deliveryCourierRecord = couriers.find(c => c.id === courierId);
          const shippingCourierRecord = couriers.find(
            c => c.id === shippingCourierId
          );
          const courierRecord = deliveryCourierRecord || shippingCourierRecord;
          const customerRecord = selectedOrderPartyRaw;
          const purchaseSource = sources.find(
            source =>
              source.id === selectedOrder.orderSourceId ||
              source.id === selectedOrder.order_source_id
          );
          const shippingCompany = shippingCompanies.find(
            company =>
              company.id === selectedOrder.shippingCompanyId ||
              company.id === selectedOrder.shipping_company_id ||
              company.name === selectedOrder.shippingCompany
          );
          for (const stage of transitionPlan.stagesToProcess) {
            await autoEntryService.executeAutoEntriesForStatus(
              stage.id,
              selectedOrder,
              {
                courier: courierRecord,
                deliveryCourier: deliveryCourierRecord,
                shippingCourier: shippingCourierRecord,
                customer: customerRecord,
                orderParty: selectedOrderParty,
                purchaseSource,
                shippingCompany,
                sourcing_cost: selectedOrder.sourcing_cost,
                isAr,
                profileName: profile?.fullName || "User Logistics Update",
              }
            );
          }
        } catch (autoErr) {
          console.warn(
            "[Orders] Auto entry execution exception on status update:",
            autoErr
          );
        }
      }

      await updateOrderRecord(selectedOrder.id, {
        orderStatusId: String(
          newStatusItem?.id || ORDER_STATUS_FALLBACKS.individualUpdate
        ),
        order_status_id:
          newStatusItem?.id || ORDER_STATUS_FALLBACKS.individualUpdate,
        orderStatus: updateFormData.orderStatus,
        deliveryStatus: updateFormData.deliveryStatus,
        locationYemen: updateFormData.locationYemen,
        internalNotes: updateFormData.internalNotes,
        shippingCourierId: updateFormData.shippingCourierId || "",
        deliveryCourierId: updateFormData.deliveryCourierId || "",
        shippingDetails: updateShippings || [],
        firedTriggers: newFiredTriggers,
        updatedAt: Date.now(),
        ...extraUpdateFields,
      });

      // Sync updateShippings to shipments collection
      if (updateShippings && updateShippings.length > 0) {
        for (const ship of updateShippings) {
          const shipId =
            ship.id || "sh_" + Math.random().toString(36).substring(2, 11);
          await upsertShipment(shipId, {
            id: shipId,
            orderId: selectedOrder.id,
            trackingNumber:
              ship.trackingNumber ||
              selectedOrder.trackingNumber ||
              selectedOrder.id,
            shippingCompanyId:
              ship.shippingCompany || selectedOrder.shippingCompany || "Aramex",
            shippingCompany:
              ship.shippingCompany || selectedOrder.shippingCompany || "Aramex",
            courierId:
              updateFormData.deliveryCourierId ||
              updateFormData.shippingCourierId ||
              selectedOrder.deliveryCourierId ||
              "",
            shipmentStatus:
              updateFormData.orderStatus || ship.shipmentStatus || "معلق  ",
            shippingCost: parseFloat(ship.shippingCost || 0),
            weight: parseFloat(ship.weight || 0),
            shippingCategoryId: ship.shippingCategoryId || "",
            shippingCategoryName: ship.shippingCategoryName || "",
            shippingCategoryPrice: parseFloat(ship.shippingCategoryPrice || 0),
            contentCategoryId: ship.contentCategoryId || "",
            contentCategoryName: ship.contentCategoryName || "",
            cartonCount: Math.max(0, parseFloat(ship.cartonCount || 0)),
            customsFee: Math.max(0, parseFloat(ship.customsFee || 0)),
            taxFee: Math.max(0, parseFloat(ship.taxFee || 0)),
            otherCategoryFee: Math.max(
              0,
              parseFloat(ship.otherCategoryFee || 0)
            ),
            categoryFeesTotal: Math.max(
              0,
              parseFloat(ship.categoryFeesTotal || 0)
            ),
            categoryFeeCurrency: ship.categoryFeeCurrency || "SAR",
            shippingType: ship.shippingType || "بري",
            shippingSource: ship.shippingSource || "",
            shippingDestination: ship.shippingDestination || "",
            shippingDate: ship.shippingDate || "",
            shippingDuration: ship.shippingDuration || "",
            expectedArrival: ship.expectedArrival || "",
            deliveryDate: ship.deliveryDate || "",
            packagingFees: parseFloat(ship.packagingFees || 0),
            updatedAt: Date.now(),
          });
        }
      }

      activityLogService.log(
        "edit_order",
        selectedOrder.orderNumber || selectedOrder.id,
        {
          orderId: selectedOrder.id,
          orderNumber: selectedOrder.orderNumber || selectedOrder.id,
          previousStatus: selectedOrder.orderStatus,
          newStatus: updateFormData.orderStatus,
          deliveryStatus: updateFormData.deliveryStatus,
          locationYemen: updateFormData.locationYemen,
        }
      );

      if (!isAlreadyNotified && newStatus !== "ملغي") {
        await notificationService.notify({
          title: isAr ? "حالة التحديث" : "Status Updated",
          message: isAr
            ? "تم تحديث البيانات اللوجيستية للشحنة وترحيلها"
            : "Logistic parameters recorded",
          type: "info",
          category: "order",
          orderId: selectedOrder.orderNumber || selectedOrder.id,
        });

        // Automatically dispatch real WhatsApp status update message
        try {
          const payloadObject = {
            ...selectedOrder,
            orderStatus: updateFormData.orderStatus,
            locationYemen: updateFormData.locationYemen,
          };
          await whatsappService.triggerNotification(
            "onOrderStatusChanged",
            payloadObject
          );
        } catch (whatsappErr) {
          console.error(
            "Failed to trigger real WhatsApp status update:",
            whatsappErr
          );
        }

        // Automatically dispatch simulated status update notification via WhatsApp + SMS
        const smsMessage = isAr
          ? `عزيزنا العميل ${selectedOrder.customerName}، تم تحديث حالة شحنتك رقم: (${selectedOrder.orderNumber || selectedOrder.id}) إلى: *${updateFormData.orderStatus}*. وموقع الشحنة حالياً: *${updateFormData.locationYemen || "قيد النقل"}*. المتبقي عليك: ${remainingVal.toLocaleString()} YER. شكراً لتعاملك معنا.`
          : `Dear ${selectedOrder.customerName}, the status of your order (${selectedOrder.orderNumber || selectedOrder.id}) update to: *${updateFormData.orderStatus}*. Current position: *${updateFormData.locationYemen || "In-transit"}*. Bal: ${remainingVal.toLocaleString()} YER. Thank you for choosing us!`;

        await notificationService.notify({
          title: isAr
            ? "📲 تحديث تلقائي (WhatsApp + SMS)"
            : "📲 Auto Status WhatsApp / SMS Sent",
          message: smsMessage,
          type: "success",
          orderId: selectedOrder.orderNumber || selectedOrder.id,
          category: "order",
        });
      } else if (newStatus !== "ملغي") {
        // Just a simple local notification for the admin that it was updated but no messages sent
        await notificationService.notify({
          title: isAr ? "تحديث صامت" : "Silent Update",
          message: isAr
            ? "تم تحديث البيانات (بدون إرسال إشعارات للعميل لتكرار الحالة)"
            : "Data updated (no customer notifications sent for repeated status)",
          type: "info",
          category: "system",
        });
      }

      setIsUpdateModalOpen(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };
}
