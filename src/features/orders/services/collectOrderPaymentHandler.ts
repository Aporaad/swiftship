import type { Dispatch, FormEvent, SetStateAction } from "react";
import toast from "react-hot-toast";
import { financialAccountService } from "../../../services/financialAccountService";
import {
  financialEntryService,
  type FinancialPaymentMethod,
} from "../../../services/financialEntryService";
import { findOrderParty } from "../../../services/orderPartyService";
import type { OrderRecord, PaymentFormData } from "../types";

type LegacyPartyRecord = {
  id?: string; accountId?: string | null; financialAccountId?: string | null; fullName?: string | null;
  name?: string | null; phone?: string | null; address?: string | null; [key: string]: unknown;
};
type LegacyOrderRecord = OrderRecord;
type CurrencyRecord = { cur_id?: string | number; code?: string };
type FinancialAccountRecord = { id: string; accSubId?: string | null; curNo?: string | number | null; currency?: string | null };
type ProfileRecord = { id?: string; uid?: string };
const toText = (value: unknown): string => typeof value === "string" ? value : value == null ? "" : String(value);

export interface CollectOrderPaymentDependencies<T extends LegacyOrderRecord = LegacyOrderRecord> {
  activeCurrencies: CurrencyRecord[];
  couriers: LegacyPartyRecord[];
  customers: LegacyPartyRecord[];
  dbRates: Record<string, number>;
  employees: LegacyPartyRecord[];
  financialAccounts: FinancialAccountRecord[];
  isAr: boolean;
  orderCurrency: string;
  paymentFormData: PaymentFormData;
  profile: ProfileRecord | null;
  selectedOrder: T | null;
  setIsPaymentModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setPaymentFormData: Dispatch<SetStateAction<PaymentFormData>>;
  setSelectedOrder: Dispatch<SetStateAction<T | null>>;
}

export function createCollectOrderPaymentHandler<T extends LegacyOrderRecord>(
  dependencies: CollectOrderPaymentDependencies<T>
) {
  const {
    activeCurrencies,
    couriers,
    customers,
    dbRates,
    employees,
    financialAccounts,
    isAr,
    orderCurrency,
    paymentFormData,
    profile,
    selectedOrder,
    setIsPaymentModalOpen,
    setIsSubmitting,
    setPaymentFormData,
    setSelectedOrder,
  } = dependencies;

  return async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsSubmitting(true);
    try {
      const amountNum = parseFloat(paymentFormData.amount) || 0;
      if (amountNum <= 0) {
        toast.error(
          isAr ? "يرجى إدخال مبلغ صحيح" : "Please enter valid amount"
        );
        return;
      }
      const paymentCurrency = (
        paymentFormData.paymentCurrency ||
        selectedOrder.paidCurrency ||
        selectedOrder.currency ||
        selectedOrder.orderCurrency ||
        orderCurrency ||
        "YER"
      ).toUpperCase();
      const defaultOrderCurrency = String(
        selectedOrder.paidCurrency ||
          selectedOrder.currency ||
          selectedOrder.orderCurrency ||
          "YER"
      ).toUpperCase();

      // تحويل مبلغ الدفعة من عملة الدفع إلى عملة الطلب الأساسية لمقارنتها وتحديث أرصدة الطلب في قاعدة البيانات
      const orderPaymentAmountInOrderCurrency =
        paymentCurrency === defaultOrderCurrency
          ? amountNum
          : financialAccountService.convertToTargetCurrency(
              amountNum,
              paymentCurrency,
              defaultOrderCurrency,
              dbRates
            );

      // التحقق من أن مبلغ الدفعة بعملة الدفع لا يتجاوز المتبقي للطلب بعملة الدفع
      const remainingBeforePayment = typeof selectedOrder.amountRemaining === "number" ? selectedOrder.amountRemaining : Number.parseFloat(selectedOrder.amountRemaining || "0") || 0;
      const orderRemainingInPaymentCurrency =
        paymentCurrency === defaultOrderCurrency
          ? remainingBeforePayment
          : financialAccountService.convertToTargetCurrency(
              remainingBeforePayment,
              defaultOrderCurrency,
              paymentCurrency,
              dbRates
            );

      if (amountNum > orderRemainingInPaymentCurrency + 0.05) {
        toast.error(
          isAr
            ? `المبلغ يتجاوز المتبقي للطلب (${orderRemainingInPaymentCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${paymentCurrency})`
            : `Amount exceeds remaining order balance (${orderRemainingInPaymentCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${paymentCurrency})`
        );
        return;
      }

      const currencyRecord = activeCurrencies.find(
        (c: CurrencyRecord) => String(c.code).toUpperCase() === paymentCurrency
      ) || { cur_id: 1, code: paymentCurrency };
      const orderParty = findOrderParty(
        selectedOrder,
        customers,
        employees,
        couriers
      );
      const rawPartyAccountId = orderParty?.raw.financialAccountId ?? orderParty?.raw.accountId;
      const rawPartyAccountIdText = typeof rawPartyAccountId === 'string' || typeof rawPartyAccountId === 'number'
        ? String(rawPartyAccountId)
        : '';
      const partyAccountId =
        selectedOrder.orderPartyAccountId ||
        selectedOrder.order_party_account_id ||
        orderParty?.accountId ||
        rawPartyAccountIdText;
      const partyAccount = financialAccounts.find(
        (account: FinancialAccountRecord) => account.id === partyAccountId
      );
      if (paymentFormData.method === "Deferred") {
        toast.error(
          isAr
            ? "الدفع الآجل ليس قبضًا فعليًا؛ أنشئ سندًا آجلًا مستقلًا ثم سجل التحصيل عند الاستلام."
            : "Deferred payment is not a collection; record it in a separate deferred voucher."
        );
        return;
      }
      const rawAllocations =
        paymentFormData.method === "Mixed"
          ? paymentFormData.allocations
          : [
              {
                id: "single",
                method: paymentFormData.method as "Cash" | "Bank",
                amount: String(amountNum),
                receivingAccountId: paymentFormData.receivingAccountId,
                bankReference: paymentFormData.bankReference,
              },
            ];
      if (!currencyRecord || !partyAccount || !rawAllocations.length) {
        toast.error(
          isAr
            ? "حدد حساب الطرف وحساب أو حسابات التحصيل وعملة الدفع قبل التحصيل"
            : "Select the party, collection account(s), and payment currency first"
        );
        return;
      }
      const allocations = rawAllocations.map(allocation => ({
        ...allocation,
        amount: Number(allocation.amount || 0),
        account: financialAccounts.find(
          (account: FinancialAccountRecord) => account.id === allocation.receivingAccountId
        ),
        paymentMethod:
          allocation.method === "Bank"
            ? ("bank" as FinancialPaymentMethod)
            : ("cash" as FinancialPaymentMethod),
      }));
      if (
        allocations.some(
          allocation => !allocation.account || allocation.amount <= 0
        )
      ) {
        toast.error(
          isAr
            ? "أكمل حساب ومبلغ كل توزيع تحصيل."
            : "Complete a positive amount and account for each allocation."
        );
        return;
      }
      if (
        paymentFormData.method === "Mixed" &&
        (allocations.length < 2 ||
          Math.abs(
            allocations.reduce(
              (sum, allocation) => sum + allocation.amount,
              0
            ) - amountNum
          ) > 0.01)
      ) {
        toast.error(
          isAr
            ? "يجب أن يحتوي القبض المختلط على توزيعين على الأقل وأن يساوي مجموعهما مبلغ التحصيل."
            : "Mixed collection needs at least two allocations totaling the collection amount."
        );
        return;
      }
      if (
        allocations.some(
          allocation =>
            allocation.paymentMethod === "bank" &&
            !allocation.bankReference?.trim()
        )
      ) {
        toast.error(
          isAr
            ? "أدخل مرجع كل حوالة بنكية."
            : "Enter a reference for each bank transfer."
        );
        return;
      }
      if (
        allocations.some(
          allocation =>
            allocation.paymentMethod === "cash" &&
            allocation.account?.accSubId !== "111"
        ) ||
        allocations.some(
          allocation =>
            allocation.paymentMethod === "bank" &&
            allocation.account?.accSubId !== "112"
        )
      ) {
        toast.error(
          isAr
            ? "يتطلب النقد حساب صندوق ويتطلب البنك حسابًا بنكيًا وفق شجرة الحسابات."
            : "Cash requires a cash-box account and bank requires a bank account."
        );
        return;
      }
      const validAllocations = allocations.filter(
        (allocation): allocation is typeof allocation & { account: FinancialAccountRecord } => Boolean(allocation.account)
      );
      const paymentMethod: FinancialPaymentMethod =
        paymentFormData.method === "Mixed"
          ? "mixed"
          : validAllocations[0].paymentMethod;

      const lines = [
        ...validAllocations.map(allocation => {
          const isSameCur =
            Number(allocation.account.curNo) === Number(currencyRecord.cur_id);
          const lineAmount = isSameCur
            ? Number(allocation.amount || 0)
            : financialAccountService.convertToTargetCurrency(
                Number(allocation.amount || 0),
                paymentCurrency,
                allocation.account.currency || "YER",
                dbRates
              );
          return {
            accountId: allocation.account.id,
            accountCurNo: Number(allocation.account.curNo),
            currencyOriginalNo: Number(currencyRecord.cur_id),
            transType: "Debit" as const,
            amount: lineAmount,
            amountOriginal: Number(allocation.amount || 0),
            paymentMethod: allocation.paymentMethod,
          };
        }),
        {
          accountId: partyAccount.id,
          accountCurNo: Number(partyAccount.curNo),
          currencyOriginalNo: Number(currencyRecord.cur_id),
          transType: "Credit" as const,
          amount:
            Number(partyAccount.curNo) === Number(currencyRecord.cur_id)
              ? Number(amountNum)
              : financialAccountService.convertToTargetCurrency(
                  Number(amountNum),
                  paymentCurrency,
                  partyAccount.currency || "YER",
                  dbRates
                ),
          amountOriginal: Number(amountNum),
          entityType: toText(selectedOrder.orderPartyType) || "customer",
          entityId: selectedOrder.customerId || undefined,
        },
      ];

      await financialEntryService.recordOrderPayment(
        selectedOrder.id,
        orderPaymentAmountInOrderCurrency,
        {
          entryNumber: `RCPT-${toText(selectedOrder.orderNumber) || selectedOrder.id}-${Date.now().toString().slice(-6)}`,
          moduleId: "module_orders",
          entryTypeId: "type_order_payment",
          entryCategory: paymentMethod === "mixed" ? "Compound" : "General",
          postingStatus: "posted",
          description: `${isAr ? "تحصيل دفعة للطلب" : "Order payment collection"} ${toText(selectedOrder.orderNumber) || selectedOrder.id}`,
          notes: paymentFormData.notes || "",
          paymentMethod,
          orderId: selectedOrder.id,
          createdByUid: profile?.id || profile?.uid,
          lines,
          paymentDetails: validAllocations.map(allocation => ({
            paymentMethod:
              allocation.paymentMethod === "bank"
                ? ("bank" as const)
                : ("cash" as const),
            accountId: allocation.account.id,
            amountOriginal: Number(allocation.amount || 0),
            bankReference: allocation.bankReference || "",
          })),
        },
        profile?.id || profile?.uid
      );

      toast.success(
        isAr ? "تم تحصيل الدفعة بنجاح" : "Payment collected successfully"
      );
      setIsPaymentModalOpen(false);
      setSelectedOrder(null);
      setPaymentFormData({
        amount: "",
        method: "Cash",
        receivingAccountId: "",
        bankReference: "",
        allocations: [],
        notes: "",
        pin: "",
        paymentCurrency: "YER",
      });
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error collecting payment");
    } finally {
      setIsSubmitting(false);
    }
  };
}
