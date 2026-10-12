import type { Transaction } from '../../types';
import {
  financialEntryService,
  type LegacyVoucherAccountTarget,
  type LegacyVoucherInput,
} from '../../services/financialEntryService';
import { settingsCurrenciesApiGateway } from '../../data/http/settings-currencies-api.gateway';

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
interface PostingAccountLike {
  id?: string;
  currency?: string;
  curNo?: number;
  currencyNo?: number;
  entityType?: string;
  entityId?: string;
}
interface ActionDependencies {
  courierAuditSheet: CourierAuditSheet | null;
  currentUser?: { id?: string } | null;
  db: unknown; dbRates: Record<string, number>;
  doc: (...args: unknown[]) => DocReference;
  financialAccountService: FinanceAccountService; isAr: boolean;
  notificationService: { notify: (payload: NotificationPayload) => Promise<void> };
  postingFinancialAccounts: PostingAccountLike[];
  setBulkReconciliationLoading: (value: boolean) => void;
  setCargoRemitLoading: (value: boolean) => void;
  settings: { currency?: string };
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
  currencyOriginalNo?: unknown;
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
  const { courierAuditSheet, currentUser, db, dbRates, doc, financialAccountService, isAr, notificationService, postingFinancialAccounts, setBulkReconciliationLoading, setCargoRemitLoading, settings, writeBatch } = dependencies;

  const toAccountTarget = (accountId?: string | null): LegacyVoucherAccountTarget | null => {
    const acc = postingFinancialAccounts.find((a: PostingAccountLike) => a.id === accountId);
    if (!acc?.id) return null;
    const resolvedCurNo = Number(acc.curNo ?? acc.currencyNo ?? 0);
    return {
      id: acc.id,
      curNo: Number.isInteger(resolvedCurNo) && resolvedCurNo > 0 ? resolvedCurNo : undefined,
      currency: acc.currency || settings.currency || 'YER',
      entityType: acc.entityType,
      entityId: acc.entityId,
    };
  };

  // تسوية العهدة عبر الـAPI: settle_custody_advance يحدّث العهدة ويترحّل قيد التسوية ذرياً
  // Custody settlement via the API: the RPC updates the custody row and posts the settlement voucher atomically.
  const settleCustodyViaApi = async (custody: CustodyRecord): Promise<void> => {
    if (!custody.id) throw new Error(isAr ? 'معرف العهدة غير متاح.' : 'Custody id is unavailable.');
    const outstanding = Number(custody.amountOutstanding ?? 0) || Number(custody.amountOriginal ?? custody.amount ?? 0);
    if (!Number.isFinite(outstanding) || outstanding <= 0) {
      throw new Error(isAr ? 'لا يوجد مبلغ معلق لهذه العهدة لتسويته.' : 'This custody has no outstanding amount to settle.');
    }

    const curNo = Number(custody.currencyOriginalNo ?? 0);
    let currencyCode = String(custody.currency || settings.currency || 'YER');
    if (Number.isInteger(curNo) && curNo > 0) {
      const currencies = await settingsCurrenciesApiGateway.listCurrencies(false);
      const match = currencies.find((c: { currencyId?: number }) => Number(c.currencyId) === curNo);
      if (match?.code) currencyCode = String(match.code);
    }

    const cashAccountId = (await financialAccountService.ensureSystemAccounts(currencyCode))['sys_cash_account'];
    const debitTarget = toAccountTarget(String(custody.recipientAccountId ?? ''));
    const creditTarget = toAccountTarget(cashAccountId);
    if (!debitTarget || !creditTarget) {
      throw new Error(isAr ? 'حساب العهدة أو حساب الصندوق غير متوفر في الدفتر النشط.' : 'The custody recipient account or the system cash account is missing from the active register.');
    }

    const voucherNum = `${String(custody.expenseNumber ?? custody.id ?? 'custody')}-SET`;
    const voucher: LegacyVoucherInput = {
      entryNumber: voucherNum,
      createdAt: Date.now(),
      description: (isAr
        ? `تسوية عهدة تلقائية: ${custody.expenseNumber ?? custody.id ?? ''}`
        : `Auto custody settlement: ${custody.expenseNumber ?? custody.id ?? ''}`).trim(),
      amount: outstanding,
      currency: currencyCode,
      module: 'custody',
      refNumber: voucherNum,
      createdByUid: currentUser?.id || 'system',
      postingStatus: 'posted',
    };
    const entry = await financialEntryService.buildLegacyVoucherInput(voucher, debitTarget, creditTarget);
    await financialEntryService.settleCustodyAdvance(String(custody.id), entry, currentUser?.id || undefined);
  };

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

      // 2. Settle all pending open custodies — تسوية ذرية عبر settle_custody_advance
      const pendingCustodies = courierAuditSheet.custodies.filter((c: CustodyRecord) => c.status === 'Pending');
      for (const exp of pendingCustodies) {
        await settleCustodyViaApi(exp);
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

// Live Settle specific Custody record from the interactive sheet — عبر settle_custody_advance
  const handleDirectSettleCustody = async (custodyDocId: string, recipientName: string) => {
    const custody = courierAuditSheet?.custodies.find((c: CustodyRecord) => c.id === custodyDocId) || null;
    if (!custody) {
      await notificationService.notify({
        title: isAr ? 'تعذرت التسوية' : 'Settlement Blocked',
        message: isAr ? 'بيانات العهدة غير متاحة في ورقة التدقيق؛ لا يمكن التسوية عبر الـAPI.' : 'Custody data is unavailable in the audit sheet; API settlement cannot proceed.',
        type: 'error'
      });
      return;
    }

    if (!window.confirm(isAr
      ? `هل أنت متأكد من مراجعة وتصفية هذا السند العهدة؟`
      : `Are you sure you want to discharge and settle this custody entry?`
    )) return;

    try {
      await settleCustodyViaApi(custody);

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
        message: errorMessage(err, 'Could not discharge custody row through the finance API.'),
        type: 'error'
      });
    }
  };

  return { handleFullCourierReconciliation, handleBulkRemitCourierCash, handleDirectSettleCustody };
}
