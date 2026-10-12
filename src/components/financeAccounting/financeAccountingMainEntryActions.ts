import type * as React from 'react';
import {
  financialEntryService,
  type FinancialEntryCategory,
  type LegacyVoucherAccountTarget,
  type LegacyVoucherInput,
} from '../../services/financialEntryService';
import { financialAccountService } from '../../services/financialAccountService';
import { notificationService } from '../../services/notificationService';
import type { AccountEntityType } from '../../services/financialAccountTypes';

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

type EditMainEntryData = {
  amountOriginal: string;
  currencyOriginal: string;
  notes: string;
  createdAt: string;
  debitAccountId: string;
  creditAccountId: string;
};

type AdjustmentData = {
  type: string;
  amount: string;
  currency: string;
  title: string;
  recipientName: string;
  notes: string;
};

interface ActionDependencies {
  adjustData: AdjustmentData;
  adjustLoading: boolean;
  adjustSalaryMonth: string;
  auditedCustomerId: string;
  currentUser: { id?: string | null; email?: string | null } | null;
  customerLedgerDetails: { customer: { accountId?: string | null; accountCode?: string | null } } | null;
  dbRates: Record<string, number>;
  deletePin: string;
  editJournalData: EditMainEntryData;
  employees: EmployeeRecord[];
  entryToDelete: FinanceEntryRecord | null;
  financialAccountService: typeof financialAccountService;
  isAr: boolean;
  isSalaryPayment: boolean;
  notificationService: typeof notificationService;
  orders: CustomerOrderRecord[];
  payAmount: string;
  payLoading: boolean;
  payNotes: string;
  postingFinancialAccounts: PostingAccount[];
  selectedEditEntry: FinanceEntryRecord | null;
  settings: { currency?: string };
  sourceAccountId: string;
  targetAccountId: string;
  targetType: string;
  setAdjustData: StateSetter<AdjustmentData>;
  setAdjustLoading: StateSetter<boolean>;
  setDeleteLoading: StateSetter<boolean>;
  setDeletePin: StateSetter<string>;
  setDeletePinError: StateSetter<string>;
  setEditJournalLoading: StateSetter<boolean>;
  setEntryToDelete: StateSetter<FinanceEntryRecord | null>;
  setIsAdjustmentModalOpen: StateSetter<boolean>;
  setIsDeletePinModalOpen: StateSetter<boolean>;
  setIsEditJournalOpen: StateSetter<boolean>;
  setIsPayModalOpen: StateSetter<boolean>;
  setIsSalaryPayment: StateSetter<boolean>;
  setPayAmount: StateSetter<string>;
  setPayLoading: StateSetter<boolean>;
  setPayNotes: StateSetter<string>;
  setSelectedEditEntry: StateSetter<FinanceEntryRecord | null>;
  setSourceAccountId: StateSetter<string>;
  setTargetAccountId: StateSetter<string>;
  setTargetType: StateSetter<string>;
}

interface PostingAccount {
  id?: string;
  accountCode?: string;
  currency?: string;
  curNo?: number;
  currencyNo?: number;
  entityType?: AccountEntityType;
  entityId?: string;
  entityName?: string;
}

interface EmployeeRecord {
  id?: string;
  systemPin?: string;
}

interface EntryMeta {
  moduleId?: string;
  entryTypeId?: string;
  entryCategory?: string;
  entryNumber?: string;
  orderId?: string;
  shipmentId?: string;
}

interface LegRow {
  id?: string;
  accountId?: string;
  currency?: string;
  currencyOriginal?: string;
  entry?: EntryMeta;
}

interface FinanceEntryRecord {
  id?: string;
  mainEntryId?: string;
  refNumber?: string;
  title?: string;
  module?: string;
  debitAccountId?: string;
  creditAccountId?: string;
  debitLeg?: LegRow;
  creditLeg?: LegRow;
  allLegs?: LegRow[];
  [key: string]: unknown;
}

interface CustomerOrderRecord {
  id: string;
  customerId?: string | null;
  amountRemaining?: number | string | null;
  amountPaid?: number | string | null;
  createdAt?: number | string | { toDate: () => Date };
}

const getOrderTimestamp = (value: CustomerOrderRecord['createdAt']): number => {
  if (value && typeof value === 'object' && 'toDate' in value) return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
};

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export function createFinanceAccountingMainEntryActions(dependencies: ActionDependencies) {
  const { adjustData, adjustLoading, adjustSalaryMonth, auditedCustomerId, currentUser, customerLedgerDetails, dbRates, deletePin, editJournalData, employees, entryToDelete, financialAccountService, isAr, isSalaryPayment, notificationService, orders, payAmount, payLoading, payNotes, postingFinancialAccounts, selectedEditEntry, setAdjustData, setAdjustLoading, setDeleteLoading, setDeletePin, setDeletePinError, setEditJournalLoading, setEntryToDelete, setIsAdjustmentModalOpen, setIsDeletePinModalOpen, setIsEditJournalOpen, setIsPayModalOpen, setIsSalaryPayment, setPayAmount, setPayLoading, setPayNotes, setSelectedEditEntry, setSourceAccountId, setTargetAccountId, setTargetType, settings, sourceAccountId, targetAccountId, targetType } = dependencies;

  const actorUid = () => currentUser?.id || undefined;

  const toAccountTarget = (accountId?: string | null, fallback?: LegRow | null): LegacyVoucherAccountTarget | null => {
    const acc = postingFinancialAccounts.find((a: PostingAccount) => a.id === accountId);
    if (acc?.id) {
      const resolvedCurNo = Number(acc.curNo ?? acc.currencyNo ?? 0);
      return {
        id: acc.id,
        curNo: Number.isInteger(resolvedCurNo) && resolvedCurNo > 0 ? resolvedCurNo : undefined,
        currency: acc.currency || settings.currency || 'YER',
        entityType: acc.entityType,
        entityId: acc.entityId,
      };
    }
    if (fallback?.accountId) {
      return {
        id: fallback.accountId,
        currency: String(fallback.currencyOriginal || fallback.currency || settings.currency || 'YER'),
      };
    }
    return null;
  };

  // التعديل عبر دورة الـAPI المعتمدة: إلغاء ترحيل ← استبدال المسودة ← إعادة ترحيل
  // Edit goes through the sanctioned API cycle: unpost -> replace -> re-post.
  const handleEditJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditEntry) return;
    if (!editJournalData.amountOriginal || isNaN(parseFloat(editJournalData.amountOriginal))) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'قيمة المبلغ غير صالحة' : 'Invalid Amount',
        type: 'error'
      });
    }

    const mainEntryId = selectedEditEntry.mainEntryId || (selectedEditEntry.id && !String(selectedEditEntry.id).startsWith('EXP-UNLINKED-') ? selectedEditEntry.id : '');
    if (!mainEntryId) {
      return notificationService.notify({
        title: isAr ? 'تعذر التعديل' : 'Edit Blocked',
        message: isAr ? 'لا يوجد قيد رئيسي لهذا السطر؛ التعديل متاح عبر واجهة القيود فقط.' : 'This row has no main entry id; edits are only available through the entries workspace.',
        type: 'error'
      });
    }

    const entryMeta = selectedEditEntry.debitLeg?.entry || selectedEditEntry.creditLeg?.entry || selectedEditEntry.allLegs?.[0]?.entry;
    if (String(entryMeta?.entryCategory || '') === 'Compound') {
      return notificationService.notify({
        title: isAr ? 'تعذر التعديل' : 'Edit Blocked',
        message: isAr ? 'القيود المركبة تُعدَّل من مساحة عمل القيود ولا تقبل التعديل من محرر الدفتر.' : 'Compound entries must be edited from the entries workspace, not the ledger editor.',
        type: 'error'
      });
    }

    setEditJournalLoading(true);
    try {
      const rawAmt = parseFloat(editJournalData.amountOriginal);
      const parsedCreatedAt = editJournalData.createdAt ? new Date(editJournalData.createdAt).getTime() : Date.now();

      const debitTarget = toAccountTarget(
        editJournalData.debitAccountId || selectedEditEntry.debitAccountId,
        selectedEditEntry.debitLeg,
      );
      const creditTarget = toAccountTarget(
        editJournalData.creditAccountId || selectedEditEntry.creditAccountId,
        selectedEditEntry.creditLeg,
      );
      if (!debitTarget || !creditTarget) {
        throw new Error(isAr ? 'تعذر تحديد الحساب المدين أو الدائن من دفتر الحسابات.' : 'Debit or credit account could not be resolved from the ledger register.');
      }

      const voucher: LegacyVoucherInput = {
        entryNumber: String(selectedEditEntry.refNumber || entryMeta?.entryNumber || ''),
        createdAt: parsedCreatedAt,
        description: (editJournalData.notes || selectedEditEntry.title || String(selectedEditEntry.refNumber || '')).trim(),
        notes: editJournalData.notes,
        amount: rawAmt,
        currency: editJournalData.currencyOriginal,
        module: selectedEditEntry.module || 'adjustment',
        refNumber: String(selectedEditEntry.refNumber || ''),
        orderId: entryMeta?.orderId || undefined,
        shipmentId: entryMeta?.shipmentId || undefined,
        createdByUid: currentUser?.id || 'system',
      };

      await financialEntryService.replaceLedgerEntry(mainEntryId, voucher, debitTarget, creditTarget, actorUid(), {
        moduleId: entryMeta?.moduleId,
        entryTypeId: entryMeta?.entryTypeId,
        entryCategory: entryMeta?.entryCategory as FinancialEntryCategory | undefined,
      });

      notificationService.notify({
        title: isAr ? 'تم الحفظ' : 'Saved',
        message: isAr ? 'تم تعديل القيد المالي وإعادة ترحيله وتحديث كافة الأرصدة المرتبطة.' : 'Financial entry updated, re-posted, and all associated balances recalculated.',
        type: 'success'
      });

      setIsEditJournalOpen(false);
      setSelectedEditEntry(null);
    } catch (err: unknown) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: errorMessage(err, 'Could not update entry'),
        type: 'error'
      });
    } finally {
      setEditJournalLoading(false);
    }
  };

// Handle Delete Entry with User PIN confirmation
  const handleDeleteJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryToDelete) return;
    setDeletePinError('');

    const trimmedPin = deletePin.trim();
    if (!trimmedPin) {
      setDeletePinError(isAr ? 'يرجى إدخال رمز PIN' : 'Please enter PIN code');
      return;
    }

    // Check PIN against employee systemPins or master fallback PINs ('1234', '0000')
    const isValidPin = employees.some((emp: EmployeeRecord) => emp.systemPin && emp.systemPin.trim() === trimmedPin) ||
      trimmedPin === '1234' || trimmedPin === '0000';

    if (!isValidPin) {
      setDeletePinError(isAr ? 'رمز PIN غير صحيح. يرجى التثبت من الرمز وتكرار المحاولة.' : 'Invalid PIN code. Access denied.');
      return;
    }

    const mainEntryId = entryToDelete.mainEntryId || (entryToDelete.id && !String(entryToDelete.id).startsWith('EXP-UNLINKED-') ? entryToDelete.id : '');
    if (!mainEntryId) {
      setDeletePinError(isAr ? 'لا يمكن حذف قيد غير مرتبط بقيد رئيسي عبر الـAPI.' : 'This row is not linked to a main entry and cannot be deleted through the API.');
      return;
    }

    setDeleteLoading(true);
    try {
      await financialEntryService.deleteLedgerEntry(mainEntryId, actorUid());

      notificationService.notify({
        title: isAr ? 'تم الحذف' : 'Deleted',
        message: isAr ? 'تم حذف القيد المالي نهائياً وإلغاء كافة تأثيراته الحسابية.' : 'Financial entry permanently deleted and all ledger balances synced.',
        type: 'success'
      });

      setIsDeletePinModalOpen(false);
      setEntryToDelete(null);
      setDeletePin('');
    } catch (err: unknown) {
      console.error("Error deleting entry:", err);
      setDeletePinError(errorMessage(err, 'Failed to delete entry'));
    } finally {
      setDeleteLoading(false);
    }
  };

// Handle addition of quick accounting adjustment voucher
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustLoading) return;
    if (!adjustData.amount || parseFloat(adjustData.amount) <= 0 || (!adjustData.title && !isSalaryPayment)) {
      notificationService.notify({
        title: isAr ? 'خطأ بالبيانات' : 'Invalid Entry',
        message: isAr ? 'يرجى ملء تفاصيل القيد والمبلغ المالي الصحيح.' : 'Provide precise title and positive currency amount.',
        type: 'error'
      });
      return;
    }

    if (!sourceAccountId || !targetAccountId) {
      notificationService.notify({
        title: isAr ? 'الحسابات غير محددة' : 'Accounts Required',
        message: isAr ? 'يجب تحديد الحساب المصدر (الدائن) والحساب المستهدف (المدين) لإجراء القيد المزدوج.' : 'Please select both source and target accounts to complete the transaction.',
        type: 'error'
      });
      return;
    }

    if (sourceAccountId === targetAccountId) {
      notificationService.notify({
        title: isAr ? 'تطابق الحسابات' : 'Identical Accounts',
        message: isAr ? 'لا يمكن أن يكون الحساب المصدر والحساب المستهدف متطابقين.' : 'Source and target accounts cannot be the same.',
        type: 'error'
      });
      return;
    }

    setAdjustLoading(true);
    try {
      const amountVal = parseFloat(adjustData.amount);
      const convertedAmt = financialAccountService.convertToDefaultCurrency(
        amountVal,
        adjustData.currency,
        settings.currency || 'YER',
        dbRates
      );

      const timestamp = Date.now();
      const randStr = Math.floor(1000 + Math.random() * 9000);

      const srcAccount = postingFinancialAccounts.find((a: PostingAccount) => a.id === sourceAccountId || a.entityId === sourceAccountId);
      const trgAccount = postingFinancialAccounts.find((a: PostingAccount) => a.id === targetAccountId || a.entityId === targetAccountId);

      if (!srcAccount || !trgAccount) {
        throw new Error(isAr ? 'أحد الحسابات المحددة غير موجود في الدفاتر.' : 'Selected accounts not found.');
      }

      const voucherCode = `ADJ-${new Date().getFullYear().toString().slice(-2)}-${randStr}`;

      // 1. If it is a Salary Payment, invoke the atomic recordSalaryPayment service
      if (isSalaryPayment && targetType === 'employee') {
        if (!adjustSalaryMonth) {
          notificationService.notify({
            title: isAr ? 'الشهر غير محدد' : 'Month Required',
            message: isAr ? 'يرجى تحديد شهر صرف الراتب.' : 'Please select the salary month.',
            type: 'error'
          });
          setAdjustLoading(false);
          return;
        }

        await financialAccountService.recordSalaryPayment({
          employeeId: trgAccount.entityId || '',
          employeeName: trgAccount.entityName || '',
          accountId: targetAccountId,
          accountCode: trgAccount.accountCode || '',
          amount: convertedAmt,
          currency: adjustData.currency,
          salaryMonth: adjustSalaryMonth,
          notes: adjustData.notes || (isAr ? `صرف راتب شهر ${adjustSalaryMonth}` : `Salary payment for ${adjustSalaryMonth}`),
          createdByUid: currentUser?.id || 'system',
          createdByName: currentUser?.email?.split('@')[0] || 'Finance Auditor'
        });
      }

      // 2. Perform double-entry transaction posting (Debit trgAccount, Credit srcAccount)
      await financialAccountService.recordDoubleEntryTransaction(
        targetAccountId,
        sourceAccountId,
        {
          accountId: targetAccountId,
          accountCode: trgAccount.accountCode || '',
          entityType: trgAccount.entityType || 'system',
          entityId: trgAccount.entityId || '',
          entityName: trgAccount.entityName || '',
          amount: convertedAmt,
          amountOriginal: amountVal,
          currencyOriginal: adjustData.currency,
          description: adjustData.title || (isAr ? `قيد تسوية مزدوج: ${voucherCode}` : `Double-entry adjustment: ${voucherCode}`),
          refNumber: voucherCode,
          module: 'adjustment',
          createdAt: timestamp,
          createdByUid: currentUser?.id || 'system',
          createdByName: currentUser?.email?.split('@')[0] || 'Finance Auditor'
        }
      );

      notificationService.notify({
        title: isAr ? 'تم تقييد القيد بنجاح' : 'Adjustment Logged',
        message: isAr ? 'تم حفظ القيد المزدوج ترحيله إلى اليومية المساعدة بنجاح.' : 'Double-entry journal voucher registered successfully.',
        type: 'success'
      });

      setIsAdjustmentModalOpen(false);
      setAdjustData({
        type: 'Debit',
        amount: '',
        currency: 'YER',
        title: '',
        recipientName: '',
        notes: ''
      });
      setTargetType('general');
      setSourceAccountId('');
      setTargetAccountId('');
      setIsSalaryPayment(false);
    } catch (err: unknown) {
      console.error(err);
      notificationService.notify({
        title: 'Error write-back',
        message: errorMessage(err, 'Failed to persist manual voucher entry.'),
        type: 'error'
      });
    } finally {
      setAdjustLoading(false);
    }
  };

// FIFO Payment settlement for selected Customer outstanding debt
  const handleCustomerFIFOPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payLoading) return;
    const amountVal = parseFloat(payAmount);
    if (!customerLedgerDetails || isNaN(amountVal) || amountVal <= 0) {
      notificationService.notify({
        title: isAr ? 'مبلغ غير صالح' : 'Invalid Balance',
        message: isAr ? 'الرجاء إدخال مبلغ دفع إيجابي لتسويته.' : 'Please type a valid currency number.',
        type: 'error'
      });
      return;
    }

    setPayLoading(true);
    try {
      // Find customer orders with remaining debt
      const unpaidOrders = orders
        .filter((o: CustomerOrderRecord) => o.customerId === auditedCustomerId && parseFloat(String(o.amountRemaining || 0)) > 0)
        .sort((a: CustomerOrderRecord, b: CustomerOrderRecord) => {
          return getOrderTimestamp(a.createdAt) - getOrderTimestamp(b.createdAt);
        });

      if (unpaidOrders.length === 0) {
        notificationService.notify({
          title: isAr ? 'الحساب خالص' : 'No Debts Outstanding',
          message: isAr ? 'لا توجد مديونيات معلقة مسجلة على هذا العميل.' : 'This customer already holds a 0 YER outstanding balance.',
          type: 'warning'
        });
        setIsPayModalOpen(false);
        return;
      }

      const cashAccountId = (await financialAccountService.ensureSystemAccounts('YER'))['sys_cash_account'];
      const cashTarget = toAccountTarget(cashAccountId);
      const customerTarget = toAccountTarget(customerLedgerDetails.customer.accountId);
      if (!cashTarget || !customerTarget) {
        throw new Error(isAr ? 'حساب الصندوق النظامي أو الحساب المالي للعميل غير متاح في الدفتر النشط.' : 'The system cash account or the customer financial account is not available in the active register.');
      }

      let remainingPayment = amountVal;
      let appliedCount = 0;

      // Settle unpaid chronological invoices using chronological FIFO queue.
      // record_order_payment_v2 يحدّث بيانات الطلب ويترحّل سند القبض ذرياً معاً.
      // The RPC updates the order fields and posts the receipt voucher atomically.
      for (const ord of unpaidOrders) {
        if (remainingPayment <= 0) break;

        const ordRemaining = parseFloat(String(ord.amountRemaining || 0));
        const allocation = Math.min(remainingPayment, ordRemaining);
        if (allocation <= 0) continue;

        const voucherNum = `RCV-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const voucher: LegacyVoucherInput = {
          entryNumber: voucherNum,
          createdAt: Date.now(),
          description: (isAr
            ? `دفعة نقدية مستلمة على الحساب كشف حساب: ${payNotes || ''}`
            : `Cash payment received on account statement: ${payNotes || ''}`).trim(),
          amount: allocation,
          currency: 'YER',
          module: 'payment',
          refNumber: voucherNum,
          orderId: ord.id,
          paymentMethod: 'cash',
          postingStatus: 'posted',
          createdByUid: currentUser?.id || 'system',
        };
        const entry = await financialEntryService.buildLegacyVoucherInput(voucher, cashTarget, customerTarget);
        await financialEntryService.recordOrderPayment(ord.id, allocation, entry, actorUid());

        remainingPayment -= allocation;
        appliedCount += 1;
      }

      notificationService.notify({
        title: isAr ? 'تم استلام وتوريد المبلغ' : 'Payment Deposited',
        message: isAr
          ? `تم استلام وتحصيل ${amountVal.toLocaleString()} YER وتطبيقها على ${appliedCount} من أقدم الفواتير المستحقة.`
          : `FIFO accounting applied: Applied ${amountVal.toLocaleString()} YER across ${appliedCount} chronological outstanding invoices.`,
        type: 'success'
      });

      setIsPayModalOpen(false);
      setPayAmount('');
      setPayNotes('');
    } catch (err: unknown) {
      console.error(err);
      notificationService.notify({
        title: 'FIFO writeback error',
        message: errorMessage(err, 'Error executing balance clearance.'),
        type: 'error'
      });
    } finally {
      setPayLoading(false);
    }
  };

  return { handleEditJournalSubmit, handleDeleteJournalSubmit, handleAddAdjustment, handleCustomerFIFOPayment };
}
