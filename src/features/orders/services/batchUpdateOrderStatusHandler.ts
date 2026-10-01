import { activityLogService } from "../../../services/activityLogService";
import { autoEntryService } from "../../../services/autoEntryService";
import { financialAccountService } from "../../../services/financialAccountService";
import { notificationService } from "../../../services/notificationService";
import { whatsappService } from "../../../services/whatsappService";
import { findOrderParty } from "../../../services/orderPartyService";
import { ORDER_STATUS_FALLBACKS } from "../constants/orders.constants";
import type { OrderRecord, OrderStatusDescriptor } from "../types";

type LegacyPartyRecord = {
  id?: string; accountId?: string | null; financialAccountId?: string | null; fullName?: string | null;
  name?: string | null; phone?: string | null; address?: string | null; [key: string]: unknown;
};
type LegacyOrderRecord = OrderRecord;
type LegacyCourierRecord = LegacyPartyRecord & { courierType?: string; commissionRate?: string | number | null; financialAccountCode?: string | null };
type AuthContext = { currentUser?: { uid?: string; email?: string | null } | null };
type ProfileRecord = { fullName?: string };
type SettingsRecord = { currency?: string };
type AutoVoucherRule = { id?: string; isActive?: boolean };
type RateBuilder = (order: LegacyOrderRecord) => Record<string, number>;
type OrderMutation = (id: string, changes: Record<string, unknown>) => Promise<unknown>;
const toText = (value: unknown): string => typeof value === "string" ? value : value == null ? "" : String(value);
const toNumber = (value: unknown): number => typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) || 0 : 0;

export interface BatchUpdateOrderStatusDependencies {
  auth: AuthContext;
  autoVoucherRules: AutoVoucherRule[];
  buildOrderRates: RateBuilder;
  couriers: LegacyCourierRecord[];
  customers: LegacyPartyRecord[];
  dbRates: Record<string, number>;
  employees: LegacyPartyRecord[];
  isAr: boolean;
  orders: LegacyOrderRecord[];
  orderStatusesList: OrderStatusDescriptor[];
  profile: ProfileRecord | null;
  selectedOrderIds: string[];
  setIsBatchUpdating: (value: boolean) => void;
  setSelectedOrderIds: (ids: string[]) => void;
  settings: SettingsRecord;
  updateOrderRecord: OrderMutation;
}

export function createBatchUpdateOrderStatusHandler(
  dependencies: BatchUpdateOrderStatusDependencies
) {
  const {
    auth,
    autoVoucherRules,
    buildOrderRates,
    couriers,
    customers,
    dbRates,
    employees,
    isAr,
    orders,
    orderStatusesList,
    profile,
    selectedOrderIds,
    setIsBatchUpdating,
    setSelectedOrderIds,
    settings,
    updateOrderRecord,
  } = dependencies;

  return async (newStatus: string) => {
    if (selectedOrderIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const promises = selectedOrderIds.map(async orderId => {
        // مهم: يجب استبدال البيانات الثابته للحالات بالحالات الموجوده في جدول حالات الطلب order_status
        const defaultLocation =
          newStatus === "وصل مستودع السعودية"
            ? "مستودع السعودية للتعبئة"
            : newStatus === "وصل مركز التوزيع في اليمن"
              ? "مستودع صنعاء الرئيسي"
              : "قيد النقل";

        const ord = orders.find(o => o.id === orderId);
        if (!ord) return;

        const firedTriggers = ord.firedTriggers || [];
        const newFiredTriggers = [...firedTriggers];

        const ordStatus =
          ord.orderStatus ||
          "معلق"; /*مهم: هنا يجب جلب اسم المرحله من جدول المراحل بناء على رقم المرحله*/
        const currentStatusItem = orderStatusesList.find(
          s => s.nameAr === ordStatus || s.nameEn === ordStatus
        );
        const newStatusItem =
          orderStatusesList.find(
            s => s.nameAr === newStatus || s.nameEn === newStatus
          ) || orderStatusesList[0];

        const currentStageId =
          currentStatusItem?.id || ORDER_STATUS_FALLBACKS.individualUpdate;
        const newStageId =
          newStatusItem?.id || ORDER_STATUS_FALLBACKS.individualUpdate;

        const remainingVal = toNumber(ord.amountRemaining);
        const courierId = ord.deliveryCourierId;
        const shippingCourierId = ord.shippingCourierId;
        const orderParty = findOrderParty(ord, customers, employees, couriers);
        const orderPartyRaw = orderParty?.raw || null;
        const orderPartyAccountId =
          ord.orderPartyAccountId ||
          ord.order_party_account_id ||
          orderParty?.accountId ||
          orderPartyRaw?.financialAccountId ||
          orderPartyRaw?.accountId ||
          null;

        let extraUpdateFields: Record<string, unknown> = {};

        const getStageIdByName = (statusName: string) => {
          const item = orderStatusesList.find(
            s =>
              s.nameAr === statusName ||
              s.nameEn === statusName ||
              s.code === statusName
          );
          return item ? item.id : 0;
        };

        const shouldFire = (triggerId: string, minStatus: string) => {
          if (firedTriggers.includes(triggerId)) return false;
          if (newStatus === "ملغي" || newStatusItem?.code === "cancelled")
            return false;
          const minStageId = getStageIdByName(minStatus);
          return newStageId >= minStageId;
        };

        // 1. courier_commission trigger
        if (
          shouldFire("courier_commission", "وصل مركز التوزيع في اليمن") &&
          shippingCourierId
        ) {
          const courierRecord = couriers.find(c => c.id === shippingCourierId);
          if (courierRecord) {
            const isSourcing = courierRecord.courierType === "sourcing";
            const exchangeRate = toNumber(ord.exchangeRateYER) || dbRates.SAR || 1;
            const commissionProfitOriginal = toNumber(ord.profitSaudiSAR);
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
                  buildOrderRates(ord)
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
                    ? `عمولة شحن تلقائية (${courierRecord.commissionRate}%) للطلب رقم: ${toText(ord.orderNumber)}`
                    : `Auto-commission (${courierRecord.commissionRate}%) for order: ${toText(ord.orderNumber)}`,
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
                    ord,
                    {
                      courier: courierRecord,
                      orderParty,
                      isAr,
                      rawAmount: convertedCommission,
                      expenseNumber: commissionNumber,
                      profileName:
                        profile?.fullName || "System Auto-Commission",
                    }
                  );
                } catch (txErr) {
                  console.warn(
                    "[Orders] Could not record commission wage in batch:",
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
                USD: ord.exchangeRateUSD || dbRates.USD,
                SAR: ord.exchangeRateYER || dbRates.SAR,
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
                ? `عهدة تلقائية مرحلة من تسليم الطلب رقم: ${toText(ord.orderNumber)}`
                : `Auto-custody generated from delivery of order: ${toText(ord.orderNumber)}`,
              status: "Pending",
              createdByUid: auth.currentUser?.uid || "system",
              createdByEmail:
                auth.currentUser?.email || "admin@swiftship.system",
              createdByName: profile?.fullName || "System Auto-Custody",
              createdAt: Date.now(),
            };
          }

          const customerRecord = orderPartyRaw;
          if (linkedAccountId && orderPartyAccountId) {
            try {
              await financialAccountService.triggerAutomaticVoucher(
                "custody_payment",
                ord,
                {
                  courier: {
                    accountId: linkedAccountId,
                    accountCode: linkedAccountCode,
                  },
                  customer: customerRecord,
                  orderParty,
                  isAr,
                  rawAmount: convertedRemainingVal,
                  expenseNumber,
                  profileName: profile?.fullName || "System Auto-Custody",
                }
              );
            } catch (txErr) {
              console.warn(
                "[Orders] Could not record auto-custody/payment in batch:",
                txErr
              );
            }
          }

          extraUpdateFields = {
            ...extraUpdateFields,
            amountPaid: toNumber(ord.amountPaid) + remainingVal,
            amountRemaining: 0,
            paymentStatus: "Paid",
          };
          newFiredTriggers.push("custody_payment");
        }

        // 3. delivery_wage trigger
        const deliveryFee = toNumber(ord.deliveryCourierFee);
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
              USD: ord.exchangeRateUSD || dbRates.USD,
              SAR: ord.exchangeRateYER || dbRates.SAR,
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
                ? `أجور توصيل تلقائية لتسليم الطلب رقم: ${toText(ord.orderNumber)}`
                : `Auto-wage for delivery of order: ${toText(ord.orderNumber)}`,
              status: "Approved",
              createdByUid: auth.currentUser?.uid || "system",
              createdByEmail:
                auth.currentUser?.email || "admin@swiftship.system",
              createdByName: profile?.fullName || "System Auto-Wage",
              createdAt: Date.now(),
            };
          }

          if (linkedAccountId) {
            try {
              await financialAccountService.triggerAutomaticVoucher(
                "delivery_wage",
                ord,
                {
                  courier: {
                    accountId: linkedAccountId,
                    accountCode: linkedAccountCode,
                  },
                  orderParty,
                  isAr,
                  rawAmount: convertedFee,
                  expenseNumber: wageNumber,
                  profileName: profile?.fullName || "System Auto-Wage",
                }
              );
            } catch (txErr) {
              console.warn(
                "[Orders] Could not record delivery wage in batch:",
                txErr
              );
            }
          }
          newFiredTriggers.push("delivery_wage");
        }

        // 4. company_profit trigger
        if (
          shouldFire("company_profit", "تم التسليم") &&
          toNumber(ord.profitCompanySAR) > 0
        ) {
          try {
            const profitValSAR = toNumber(ord.profitCompanySAR);
            const profitConverted =
              financialAccountService.convertToDefaultCurrency(
                profitValSAR,
                "SAR",
                settings.currency || "YER",
                dbRates
              );

            await financialAccountService.triggerAutomaticVoucher(
              "company_profit",
              ord,
              {
                orderParty,
                isAr,
                rawAmount: profitConverted,
                profileName: profile?.fullName || "System Auto-Profit",
              }
            );
            newFiredTriggers.push("company_profit");
          } catch (e) {
            console.warn(
              "[Orders] Could not record company profit in batch:",
              e
            );
          }
        }

        const statusTriggerId = `status_notified_${newStatus}`;
        const isAlreadyNotified = firedTriggers.includes(statusTriggerId);

        if (isAlreadyNotified && newStatus !== "ملغي") {
          // Just skip firing but maybe log or notify once per batch if needed
          // For batch, we don't want to show 100 toasts, so we'll just handle it in the final notification message
        }

        if (!isAlreadyNotified && newStatus !== "ملغي") {
          newFiredTriggers.push(statusTriggerId);
        }

        if (newStatusItem?.id) {
          try {
            const courierRecord = couriers.find(
              c =>
                c.id === ord.deliveryCourierId || c.id === ord.shippingCourierId
            );
            const customerRecord = orderPartyRaw;
            await autoEntryService.executeAutoEntriesForStatus(
              newStatusItem.id,
              ord,
              {
                courier: courierRecord,
                customer: customerRecord,
                orderParty,
                isAr,
                profileName: profile?.fullName || "Batch Logistics Update",
              }
            );
          } catch (autoErr) {
            console.warn(
              "[Orders] Batch auto entry execution exception:",
              autoErr
            );
          }
        }

        await updateOrderRecord(orderId, {
          orderStatusId: String(
            newStatusItem?.id || ORDER_STATUS_FALLBACKS.batchUpdate
          ),
          order_status_id:
            newStatusItem?.id || ORDER_STATUS_FALLBACKS.batchUpdate,
          orderStatus: newStatus,
          locationYemen: defaultLocation,
          firedTriggers: newFiredTriggers,
          updatedAt: Date.now(),
          ...extraUpdateFields,
        });

        // Dispatch real WhatsApp notifications for each order status change in the batch
        if (!isAlreadyNotified && newStatus !== "ملغي") {
          try {
            const updatedOrderObj = {
              ...ord,
              orderStatus: newStatus,
              locationYemen: defaultLocation,
            };
            await whatsappService.triggerNotification(
              "onOrderStatusChanged",
              updatedOrderObj
            );
          } catch (whatsappErr) {
            console.error(
              "Failed to dispatch batch WhatsApp notification:",
              whatsappErr
            );
          }
        }
      });
      await Promise.all(promises);

      activityLogService.log("edit_order", `Batch update`, {
        orderIds: selectedOrderIds,
        newStatus: newStatus,
      });

      notificationService.notify({
        title: isAr ? "تم التحديث بنجاح" : "Batch Status Updated",
        message: isAr
          ? `تم تغيير حالة عدد ${selectedOrderIds.length} شحنات إلى: [ ${newStatus} ] (تم تجاوز الإشعارات للحالات المتكررة)`
          : `Updated status of ${selectedOrderIds.length} orders to: [ ${newStatus} ] (Duplicate notifications skipped)`,
        type: "success",
        category: "order",
      });
      setSelectedOrderIds([]);
    } catch (err: unknown) {
      console.error(err);
      notificationService.notify({
        title: isAr ? "خطأ في التحديث" : "Batch Update Error",
        message: err instanceof Error ? err.message : "Error executing batch action",
        type: "error",
        category: "order",
      });
    } finally {
      setIsBatchUpdating(false);
    }
  };
}
