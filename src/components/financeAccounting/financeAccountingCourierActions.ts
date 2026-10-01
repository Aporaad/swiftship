import type { Transaction } from '../../types';

interface BatchHandle {
  update: (reference: DocReference, data: Record<string, unknown>) => void;
  commit: () => Promise<void>;
}
interface CourierAuditSheet {
  courier: CourierAuditRecord;
  custodies: CustodyRecord[];
  currentUnremittedCargoCash: CourierOrderRecord[];
  totalUnremittedCashValue: number;
}
interface DocReference { type: string; path: string; id: string; }
interface NotificationPayload { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error'; orderId?: string; userId?: string; associatedUserIds?: string[]; isPublic?: boolean; category?: 'order' | 'finance' | 'system'; }
interface FinanceAccountService {
  ensureSystemAccounts: (currency: string) => Promise<Record<string, string>>;
  convertToDefaultCurrency: (amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>) => number;
  recordTransaction: (payload: Transaction) => Promise<void>;
}
interface ActionDependencies {
  courierAuditSheet: CourierAuditSheet | null;
  currentUser?: { id?: string } | null;
  db: unknown; dbRates: Record<string, number>;
  doc: (...args: unknown[]) => DocReference;
  financialAccountService: FinanceAccountService; isAr: boolean;
  notificationService: { notify: (payload: NotificationPayload) => Promise<void> };
  setBulkReconciliationLoading: (value: boolean) => void;
  setCargoRemitLoading: (value: boolean) => void;
  settings: { currency?: string };
  updateDoc: (reference: DocReference, data: Record<string, unknown>) => Promise<void>;
  writeBatch: (db: unknown) => BatchHandle;
}

interface CourierAuditRecord {
  id?: string;
  fullName?: string;
  financialBalance?: number;
  accountId?: string | null;
  accountCode?: string;
  courierType?: string;
}

interface CustodyRecord {
  id?: string;
  status?: unknown;
  amountOriginal?: unknown;
  amount?: number | string;
  amountSettled?: unknown;
  amountOutstanding?: unknown;
  recipientAccountId?: unknown;
  currency?: string | null;
  expenseNumber?: unknown;
}

interface CourierOrderRecord {
  id: string;
  amountPaid?: number | string | null;
  amountRemaining?: number | string | null;
}

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export function createFinanceAccountingCourierActions(dependencies: ActionDependencies) {
  const { courierAuditSheet, currentUser, db, dbRates, doc, financialAccountService, isAr, notificationService, setBulkReconciliationLoading, setCargoRemitLoading, settings, updateDoc, writeBatch } = dependencies;

// Full reconciliation and balance clearance for courier
  const handleFullCourierReconciliation = async () => {
    if (!courierAuditSheet) return;
    const cour = courierAuditSheet.courier;
    const currentBalance = cour.financialBalance || 0;

    if (!window.confirm(isAr
      ? `تحذير: هل أنت متأكد من تصفية ذمة المندوب (${cour.fullName}) بالكامل؟
سيقوم هذا الإجراء بـ:
1. تصفير رصيد الحساب المالي الحالي (${currentBalance.toLocaleString()} YER) بقيد محاسبي تعويضي.
2. تصفية كافة العهد المالية المعلقة.
3. توريد وتصفير كافة تحصيلات الطرود النقدية المعلقة (${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER).
هل تريد الاستمرار؟`
      : `Warning: Confirm full audit reconciliation for ${cour.fullName}?
This will:
1. Zero out the financial account balance (${currentBalance.toLocaleString()} YER) with an offsetting main entry.
2. Reconcile all outstanding open custodies.
3. Settle and remit all unremitted COD cargo collections (${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER).
Continue?`
    )) return;

    setBulkReconciliationLoading(true);
    try {
      const batch = writeBatch(db);
      const timestamp = Date.now();
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const mainVoucherCode = `AUDIT-${randStr}`;

      const systemAccs = await financialAccountService.ensureSystemAccounts('YER');

      // 1. Reconcile current financial balance if not zero
      if (currentBalance !== 0) {
        const linkedAccountId = cour.accountId;
        const linkedAccountCode = cour.accountCode;

        if (linkedAccountId) {
          const type = currentBalance > 0 ? 'Credit' : 'Debit'; // Credit to reduce balance, Debit to increase it
          const amount = Math.abs(currentBalance);

          await financialAccountService.recordTransaction({
            date: timestamp,
            description: isAr
              ? `قيد تسوية لمطابقة وتصفير الحساب المالي للمندوب — قيد إقفال`
              : `Offsetting adjustment to zero out courier account balance`,
            module: 'adjustment',
            refNumber: mainVoucherCode,
            amount,
            currency: 'YER',
            debitAccount: type === 'Debit'
              ? { id: linkedAccountId, code: linkedAccountCode || '2120' }
              : { id: systemAccs['sys_cash_account'], code: '1111-0' },
            creditAccount: type === 'Credit'
              ? { id: linkedAccountId, code: linkedAccountCode || '2120' }
              : { id: systemAccs['sys_cash_account'], code: '1111-0' },
            createdByUid: currentUser?.id || 'system',
            createdByName: 'Finance Auditor'
          });
        }
      }

      // 2. Settle all pending open custodies
      const pendingCustodies = courierAuditSheet.custodies.filter((c: CustodyRecord) => c.status === 'Pending');
      for (const exp of pendingCustodies) {
        const docRef = doc(db, 'custody_advances', exp.id);
        batch.update(docRef, {
          status: 'settled',
          settledAt: new Date(timestamp).toISOString(),
          settledByUid: currentUser?.id || 'system',
          amountSettled: exp.amountOriginal ?? exp.amount ?? 0,
          amountOutstanding: 0,
        });

        if (exp.recipientAccountId) {
          const settledAmount = financialAccountService.convertToDefaultCurrency(
            parseFloat(String(exp.amount || 0)),
            exp.currency || 'YER',
            settings.currency || 'SAR',
            dbRates
          );
          await financialAccountService.recordTransaction({
            date: timestamp,
            description: isAr ? `تسوية عهدة تلقائية: ${exp.expenseNumber}` : `Auto custody settlement: ${exp.expenseNumber}`,
            module: 'custody',
            refNumber: `${String(exp.expenseNumber ?? exp.id ?? 'custody')}-SET`,
            amount: settledAmount,
            currency: 'YER',
            debitAccount: { id: String(exp.recipientAccountId), code: '2120' },
            creditAccount: { id: systemAccs['sys_cash_account'], code: '1111-0' },
            createdByUid: currentUser?.id || 'system',
            createdByName: 'Finance Auditor'
          });
        }
      }

      // 3. Remit all unremitted COD cargo cash
      courierAuditSheet.currentUnremittedCargoCash.forEach((ord: CourierOrderRecord) => {
        const orderRef = doc(db, 'orders', ord.id);
        const prevPaid = parseFloat(String(ord.amountPaid || 0));
        const rem = parseFloat(String(ord.amountRemaining || 0));

        batch.update(orderRef, {
          amountPaid: prevPaid + rem,
          amountRemaining: 0,
          paymentStatus: isAr ? 'خالص' : 'Fully Paid',
          courierRemittedAt: timestamp
        });
      });

      await batch.commit();

      notificationService.notify({
        title: isAr ? 'نجاح مطابقة الذمة بالكامل' : 'Full Audit Reconciled',
        message: isAr
          ? `تم تصفير رصيد المندوب وتصفية كافة العهد وتحصيلات الشحنات بنجاح!`
          : `Audit successful: All custodies, cargo collections, and balances resolved to 0 YER for ${cour.fullName}.`,
        type: 'success'
      });
    } catch (err: unknown) {
      console.error(err);
      notificationService.notify({
        title: 'Audit transaction failed',
        message: errorMessage(err, 'Error executing full courier reconciliation.'),
        type: 'error'
      });
    } finally {
      setBulkReconciliationLoading(false);
    }
  };

  const handleBulkRemitCourierCash = async () => {
    if (!courierAuditSheet || courierAuditSheet.currentUnremittedCargoCash.length === 0) return;

    const isSourcing = courierAuditSheet.courier.courierType === 'sourcing';
    const currency = isSourcing ? 'SAR' : 'YER';
    const amountLabel = isSourcing
      ? `${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} SAR`
      : `${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER`;

    if (!window.confirm(isAr
      ? `هل تريد تصفية كافة مستحقات الشحن المحصلة بذمة المندوب (${amountLabel}) وتوريدها للخزينة؟`
      : `Confirm remittance of ${amountLabel} held by ${courierAuditSheet.courier.fullName}?`
    )) return;

    setCargoRemitLoading(true);
    try {
      const batch = writeBatch(db);

      // Update each unremitted cargo invoice
      courierAuditSheet.currentUnremittedCargoCash.forEach((ord: CourierOrderRecord) => {
        const orderRef = doc(db, 'orders', ord.id);
        const prevPaid = parseFloat(String(ord.amountPaid || 0));
        const rem = parseFloat(String(ord.amountRemaining || 0));

        batch.update(orderRef, {
          amountPaid: prevPaid + rem,
          amountRemaining: 0,
          paymentStatus: isAr ? 'خ خالص' : 'Fully Paid',
          courierRemittedAt: Date.now()
        });
      });

      // Register the remittance as a proper double-entry voucher.
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const voucherCode = `REMIT-${randStr}`;
      const courierAccountId = courierAuditSheet.courier.accountId;
      if (courierAccountId) {
        const systemAccs = await financialAccountService.ensureSystemAccounts(currency);
        const amount = financialAccountService.convertToDefaultCurrency(
          courierAuditSheet.totalUnremittedCashValue,
          currency,
          settings.currency || 'YER',
          dbRates,
        );
        await financialAccountService.recordTransaction({
          date: Date.now(),
          description: isAr
            ? `توريد تحصيلات شحنات المندوب ${courierAuditSheet.courier.fullName}`
            : `Courier cargo remittance: ${courierAuditSheet.courier.fullName}`,
          module: 'payment',
          refNumber: voucherCode,
          amount,
          currency: settings.currency || 'YER',
          debitAccount: { id: systemAccs['sys_cash_account'], code: '1111-0' },
          creditAccount: { id: courierAccountId, code: '2120' },
          createdByUid: currentUser?.id || 'system',
          createdByName: 'Finance Auditor',
        });
      }
      await batch.commit();

      notificationService.notify({
        title: isAr ? 'تم توريد التحصيلات وتصفير الذمة' : 'Cargo Cash Remitted',
        message: isAr
          ? `تم تصفير ذمة المندوب وتوريد مبلغ ${amountLabel} للخزينة بنجاح!`
          : `Remittance logged: safely deposited ${amountLabel} from Courier collections.`,
        type: 'success'
      });
    } catch (err: unknown) {
      console.error(err);
      notificationService.notify({
        title: 'Fm transaction error',
        message: errorMessage(err, 'Remittance transaction failed.'),
        type: 'error'
      });
    } finally {
      setCargoRemitLoading(false);
    }
  };

// Live Settle specific Custody record from the interactive sheet
  const handleDirectSettleCustody = async (custodyDocId: string, recipientName: string) => {
    if (!window.confirm(isAr
      ? `هل أنت متأكد من مراجعة وتصفية هذا السند العهدة؟`
      : `Are you sure you want to discharge and settle this custody entry?`
    )) return;

    try {
      const docRef = doc(db, 'custody_advances', custodyDocId);
      await updateDoc(docRef, {
        status: 'settled',
        settledAt: new Date().toISOString(),
        settledByUid: currentUser?.id || 'system',
        amountOutstanding: 0,
      });

      notificationService.notify({
        title: isAr ? 'تم تسوية وتصفير العهدة' : 'Custody Discharged',
        message: isAr
          ? `تم إبراء المندوب ${recipientName} من العهدة وتسجيل الإرجاع.`
          : `Disgorged open trust for courier ${recipientName}. Safebox recalculated.`,
        type: 'success'
      });
    } catch (err: unknown) {
      console.error(err);
      notificationService.notify({
        title: 'Writeback fault',
        message: errorMessage(err, 'Could not discharge custody row in PostgreSQL.'),
        type: 'error'
      });
    }
  };

  return { handleFullCourierReconciliation, handleBulkRemitCourierCash, handleDirectSettleCustody };
}
