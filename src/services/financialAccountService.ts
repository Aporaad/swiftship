/**
 * Financial Account Service
 * خدمة الحسابات المالية المركزية
 *
 * Manages creation and management of financial sub-accounts:
 *   Customers  → prefix 1130  (Asset — Accounts Receivable)
 *   Couriers   → prefix 2120  (Liability — Courier Ledger)
 *   Employees  → prefix 2130  (Liability — Employee Ledger)
 *
 * Every transaction that touches an account is written through the atomic
 * financial-entry procedure. Database safeguards maintain the authoritative
 * posting balance and its hierarchy roll-up from account_trans.
 *
 * Use recalculateAndSyncBalance(accountId) to reconcile the stored balance
 * against the live transaction history.
 */

import { toDateInputValue } from '../lib/dateUtils';
import { currencyService } from './currencyService';
import { activityLogService } from './activityLogService';
import { accountingHierarchyService } from './accountingHierarchyService';
import { financialEntryService } from './financialEntryService';
import { Transaction } from '../types';
import {
  financeApiClient,
  linkEntityAccount,
  mapAccountRow,
  readAllFinanceRows,
  readFinanceRecord,
  readFinanceRows,
  recalculateAccountBalances,
  type ApiEnvelope,
} from './financeApi';

import type { AccountEntityType, AccountTransaction, AutomaticVoucherEntities, FinancialAccount, JournalEntry } from './financialAccountTypes';
export type { AccountEntityType, AccountTransaction, AutomaticVoucherEntities, FinancialAccount, JournalEntry } from './financialAccountTypes';
import { resolveAutomaticVoucherAccount } from './financialAccountAutomaticVoucher';
import { convertToTargetCurrency as convertToTargetCurrencyValue } from './financialAccountCurrency';
import { buildDefaultAutomaticVoucherRules } from './financialAccountVoucherRules';
import { executeAutomaticVoucher } from './financialAccountAutomation';
import { purgeEntityAndFinancialFootprint, type PurgeableEntityType } from './financialAccountPurge';
import { createFinancialEntityAccount, generateFinancialAccountIdentifiers } from './financialAccountAccounts';

const ACCOUNTS_PATH = '/api/v1/finance/accounts';

/**
 * يبحث عن حساب بكوده المحاسبي — يستعمل للمراجع التاريخية المكتوبة بصيغة قديمة.
 * Looks an account up by its code; used for historical references written in the legacy id format.
 */
async function findAccountByCode(accountCode: string): Promise<FinancialAccount | null> {
  const code = String(accountCode || '').trim();
  if (!code) return null;
  const rows = await readAllFinanceRows(ACCOUNTS_PATH, { search: code, includeInactive: true });
  const matched = rows.find((row) => String(row?.accountCode ?? '') === code);
  return matched ? mapAccountRow(matched) : null;
}

/** صف سجل راتب كما يعيده API (الحقول الوصفية داخل extra jsonb). */
interface SalaryHistoryRow {
  salaryHistoryId: string;
  employeeId?: string;
  accountId?: string;
  amount?: number;
  currency?: string;
  month?: string;
  voucherCode?: string;
  notes?: string;
  status?: string;
  paidAt?: string | number;
  createdAt?: string | number;
  extra?: Record<string, unknown>;
}

/** يعيد صفوف الرواتب بالشكل الذي تعرفه واجهات الرواتب (salaryMonth + الحقول الوصفية). */
function mapSalaryHistoryRow(row: SalaryHistoryRow) {
  const { extra, ...fields } = row;
  return {
    ...fields,
    ...(extra ?? {}),
    id: row.salaryHistoryId,
    salaryMonth: row.month ?? (extra?.salaryMonth as string | undefined),
  };
}

/**
 * يقرأ وثيقة إعدادات ويعيد null عندما لا توجد بعد.
 * Reads a settings document, treating "not stored yet" as null instead of an error.
 */
async function readSettingsRecord(category: string): Promise<{ settings?: unknown } | null> {
  try {
    const res = await financeApiClient.get<ApiEnvelope<{ settings?: unknown }>>(`/api/v1/settings/${category}`);
    return res?.data ?? null;
  } catch (error) {
    if ((error as { code?: string })?.code === 'SETTINGS_NOT_FOUND') return null;
    throw error;
  }
}

class FinancialAccountService {
    private resolveAutomaticVoucherAccount(
    accountConfig: any,
    systemAccounts: Record<string, string>,
    order: any,
    entities: AutomaticVoucherEntities,
  ): { id: string; code: string } {
    return resolveAutomaticVoucherAccount(accountConfig, systemAccounts, order, entities);
  }
  /**
   * Generates strictly unique, non-colliding account identifiers:
   * accountNumber, accountCode, code, and accountId.
   * Checks ALL existing accounts in database to ensure zero collisions.
   */
  async getNextAccountIdentifiers(
    entityType: AccountEntityType,
    prefixOverride?: string,
  ): Promise<{ prefix: string; accountNumber: string; accountCode: string; code: string; accountId: string }> {
    return generateFinancialAccountIdentifiers(entityType, prefixOverride);
  }

  /**
   * Create a new financial account for an entity (customer/courier/employee)
   * Called automatically when creating a new entity.
   * Guarantees strict uniqueness for id, accountCode, code, and accountNumber.
   */
  async createAccountForEntity(
    entityType: AccountEntityType,
    entityId: string,
    entityName: string,
    currency: string,
    monthlySalary?: number,
    options?: {
      accountPrefix?: string;
      accountType?: FinancialAccount["type"];
      parentCode?: string;
      notes?: string;
      updateEntity?: boolean;
    },
  ): Promise<FinancialAccount> {
    return createFinancialEntityAccount(this, entityType, entityId, entityName, currency, monthlySalary, options);
  }

  /**
   * Get financial account by entity ID
   */
  async getAccountByEntityId(
    entityId: string,
    entityType?: AccountEntityType,
  ): Promise<FinancialAccount | null> {
    const id = String(entityId || '').trim();
    if (!id) return null;
    try {
      const rows = await readFinanceRows(`${ACCOUNTS_PATH}/by-entity`, { entityId: id });
      const matched = entityType ? rows.find((row) => row?.entityType === entityType) : rows[0];
      return matched ? mapAccountRow(matched) : null;
    } catch (error) {
      console.error("[FinancialAccountService] Error fetching account:", error);
      return null;
    }
  }

  /**
   * Get account by account ID directly
   */
  async getAccountById(accountId: string): Promise<FinancialAccount | null> {
    const id = String(accountId || '').trim();
    if (!id) return null;
    try {
      const direct = await readFinanceRecord(`${ACCOUNTS_PATH}/${encodeURIComponent(id)}`);
      if (direct) return mapAccountRow(direct);

      // جسر قراءة للمراجع التاريخية فقط: «acc_1130_0001» → «1130-0001».
      // Read bridge for historical references written in the legacy underscore format.
      const legacyCode = id.replace(/^acc_/, '').replace(/_/g, '-');
      if (legacyCode && legacyCode !== id) {
        const byCode = await findAccountByCode(legacyCode);
        if (byCode) return byCode;
      }

      // الحساب الحديث الذي حلّ محل القديم: أعمدة accounts الحقيقية، لا خرائط ترحيل.
      // The modern account that superseded this one: real accounts columns, no migration map.
      const mapping = await readFinanceRecord(
        `/api/v1/finance/account-id-map?oldAccountId=${encodeURIComponent(id)}`,
      );
      const mappedAccountId = String((mapping as { newAccountId?: string } | null)?.newAccountId ?? '').trim();
      if (mappedAccountId) {
        const mappedAccount = await readFinanceRecord(`${ACCOUNTS_PATH}/${encodeURIComponent(mappedAccountId)}`);
        if (mappedAccount) return mapAccountRow(mappedAccount);
      }

      // Fallback: search by entityId if not found by primary account id
      return this.getAccountByEntityId(id);
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error fetching account by ID:",
        error,
      );
      return null;
    }
  }

  /**
   * Complete unified double-entry journal voucher posting system.
   * Creates a master entry in the `main_entry` collection,
   * leg entries in `account_trans`, updates both balances,
   * and updates corresponding parent entities, entirely atomically.
   */
  async recordJournalEntry(
    entry: Omit<JournalEntry, "id">,
    providedRates?: { USD?: number; SAR?: number; YER?: number },//مهم:يجب تغييرها من ثابته الى جلب من قاعده البيانات
  ): Promise<string> {
    if (providedRates) {
      console.warn('[FinancialAccountService] تم تجاهل أسعار التحويل الممررة؛ يعتمد المسار الذري على مراجع سعر صرف مثبتة من قاعدة البيانات فقط.');
    }
    const debitAccount = await this.getAccountById(entry.debitAccountId);
    const creditAccount = await this.getAccountById(entry.creditAccountId);
    if (!debitAccount || !creditAccount) {
      throw new Error('One or more financial accounts not found in ledger register.');
    }
    if (!accountingHierarchyService.isPostingAccount(debitAccount) || !accountingHierarchyService.isPostingAccount(creditAccount)) {
      throw new Error('Journal entries may only use active financial posting accounts.');
    }

    const result = await financialEntryService.createFromLegacyVoucher({
      entryNumber: entry.entryNumber,
      createdAt: entry.createdAt || Date.now(),
      description: entry.description,
      attachments: entry.attachments,
      notes: entry.notes,
      amount: entry.amount,
      currency: entry.currency,
      amountDebitCurrency: entry.amountDebitCurrency,
      amountCreditCurrency: entry.amountCreditCurrency,
      module: entry.module,
      refNumber: entry.refNumber,
      orderId: entry.orderId,
      shipmentId: entry.shipmentId,
      automationKey: entry.automationKey,
      autoRuleId: entry.autoRuleId,
      isAutomatic: entry.isAutomatic,
      createdByUid: entry.createdByUid,
      paymentMethod: (entry as any).paymentMethod,
      // تمرير postingStatus من القيد — forward postingStatus from main entry for autoPost support
      postingStatus: entry.postingStatus || 'posted',
    }, {
      id: debitAccount.id!, curNo: debitAccount.curNo, currency: debitAccount.currency,
      entityType: debitAccount.entityType, entityId: debitAccount.entityId,
    }, {
      id: creditAccount.id!, curNo: creditAccount.curNo, currency: creditAccount.currency,
      entityType: creditAccount.entityType, entityId: creditAccount.entityId,
    });

    activityLogService.log(
      "financial_transaction" as any,
      debitAccount.entityName + " / " + creditAccount.entityName,
      {
        type: "Double-Entry-Unified",
        amount: entry.amount,
        currency: entry.currency,
        refNumber: entry.refNumber,
        entryNumber: entry.entryNumber,
      },
    );

    return result.id;
  }

  /**
   * Record a true double-entry transaction (Debit one account, Credit another)
   */
  async recordDoubleEntryTransaction(
    debitAccountId: string,
    creditAccountId: string,
    transactionData: Omit<AccountTransaction, "id" | "type" | "currency">,
    providedRates?: { USD?: number; SAR?: number; YER?: number },
  ): Promise<void> {
    const debitAccount = await this.getAccountById(debitAccountId);
    const creditAccount = await this.getAccountById(creditAccountId);

    if (!debitAccount || !creditAccount) {
      throw new Error(
        "Debit or Credit account does not exist in chart registry.",
      );
    }

    const now = transactionData.createdAt || Date.now();
    const entryNumber =
      transactionData.refNumber ||
      `JV-${now}-${Math.floor(1000 + Math.random() * 9000)}`;

    const journalEntry: Omit<JournalEntry, "id"> = {
      entryNumber,
      createdAt: now,
      description: transactionData.description || "",
      attachments: (transactionData as any).attachments || [],
      notes:
        (transactionData as any).notes || transactionData.description || "",

      debitAccountId,
      debitAccountName: debitAccount.entityName,
      debitAccountCode: debitAccount.accountCode,

      creditAccountId,
      creditAccountName: creditAccount.entityName,
      creditAccountCode: creditAccount.accountCode,

      amount: transactionData.amountOriginal,
      currency: transactionData.currencyOriginal,
      amountDebitCurrency: 0, // Computed dynamically in recordJournalEntry
      amountCreditCurrency: 0, // Computed dynamically in recordJournalEntry

      module: transactionData.module || "adjustment",
      refNumber: transactionData.refNumber || "",
      createdByUid: transactionData.createdByUid || "system",
      createdByName: transactionData.createdByName || "Finance System Admin",
    };

    await this.recordJournalEntry(journalEntry, providedRates);
  }

  /**
   * Centralized, unified and strict recordTransaction method.
   * Enforces that every transaction defines a source (Credit) and destination (Debit) account,
   * checks that the transaction amounts are fully balanced,
   * and registers the unified transaction accordingly.
   */
  async recordTransaction(
    transaction: Transaction,
    providedRates?: { USD?: number; SAR?: number; YER?: number },
  ): Promise<void> {
    // 1. Enforce strict requirement: Must explicitly define source (Credit) and destination (Debit)
    if (!transaction.debitAccount?.id || !transaction.creditAccount?.id) {
      throw new Error(
        "Transaction submission rejected: A source (Credit) and destination (Debit) account are explicitly required.",
      );
    }

    // 2. Prevent any transaction submission where totalDebit !== totalCredit
    // On the single value amount double entry form, the debit and credit totals are inherently equal to this amount.
    const debitTotal = transaction.amount;
    const creditTotal = transaction.amount;
    if (debitTotal !== creditTotal) {
      throw new Error(
        "Transaction submission rejected: Sum of Debits must equal Sum of Credits (totalDebit == totalCredit). debitTotal=" + debitTotal + "creditTotal=" + creditTotal,
      );
    } else if (debitTotal <= 0) {
      throw new Error(
        "Transaction submission rejected: Debit Amount must be greater than zero.",
      );
    } else if (creditTotal <= 0) {
      throw new Error(
        "Transaction submission rejected: Credit Amount must be greater than zero.",
      );
    }



    const debitAccount = await this.getAccountById(transaction.debitAccount.id);
    const creditAccount = await this.getAccountById(
      transaction.creditAccount.id,
    );

    if (!debitAccount || !creditAccount) {
      throw new Error(
        "Transaction submission rejected: Specified accounts do not exist.",
      );
    }

    const journalEntry: Omit<JournalEntry, "id"> = {
      entryNumber:
        (transaction as any).entryNumber ||
        transaction.automationKey ||
        `JV-${toDateInputValue().replaceAll('-', '')}-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: transaction.date || Date.now(),
      description: transaction.description || "",
      attachments: transaction.attachments || [],
      notes: transaction.notes || transaction.description || "",

      debitAccountId: transaction.debitAccount.id,
      debitAccountName: debitAccount.entityName,
      debitAccountCode: debitAccount.accountCode,

      creditAccountId: transaction.creditAccount.id,
      creditAccountName: creditAccount.entityName,
      creditAccountCode: creditAccount.accountCode,

      amount: transaction.amount,
      currency: transaction.currency || debitAccount.currency || "YER",
      amountDebitCurrency: 0,
      amountCreditCurrency: 0,

      module: transaction.module || "adjustment",
      refNumber: transaction.refNumber || "",
      orderId: transaction.orderId,
      orderNumber: transaction.orderNumber,
      shipmentId: transaction.shipmentId,
      automationKey: transaction.automationKey,
      autoRuleId: transaction.autoRuleId,
      statusId: transaction.statusId,
      isAutomatic: transaction.isAutomatic,
      amountSources: transaction.amountSources,
      amountBreakdown: transaction.amountBreakdown,
      // تمرير postingStatus إذا مُرِّر من القيد التلقائي — forward postingStatus if provided (for autoPost support)
      postingStatus: (transaction as any).postingStatus || 'posted',
      createdByUid: transaction.createdByUid || "system",
      createdByName: transaction.createdByName || "Audit Engine",
    };

    await this.recordJournalEntry(journalEntry, providedRates);
  }

  /**
   * Record a salary payment for an employee
   * يسجل الراتب في سجل الرواتب فقط؛ لا يمس حساب الموظف (يُخصم من الأرباح عبر المصروفات).
   * Records the salary in salary_history only — the employee account is untouched (cost is handled via expenses).
   */
  async recordSalaryPayment(params: {
    employeeId: string;
    employeeName: string;
    accountId: string;
    accountCode: string;
    amount: number;
    currency: string;
    salaryMonth: string; // Format: 'YYYY-MM'
    notes?: string;
    createdByName?: string;
  }): Promise<string> {
    const now = Date.now();
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const voucherCode = `SAL-${params.salaryMonth.replace("-", "")}-${randStr}`;
    const salaryHistoryId = `salary_${params.employeeId}_${params.salaryMonth.replace("-", "")}_${randStr}`;

    // paid_at عمود timestamptz فيرسل كنص ISO، والشهر نص «YYYY-MM».
    // paid_at is timestamptz (ISO string) while month is plain text.
    await financeApiClient.post<ApiEnvelope<unknown>>('/api/v1/finance/salary-history', {
      salaryHistoryId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      accountId: params.accountId,
      accountCode: params.accountCode,
      amount: params.amount,
      currency: params.currency,
      month: params.salaryMonth,
      voucherCode,
      notes: params.notes || "",
      status: "Paid",
      paidAt: new Date(now).toISOString(),
      createdByName: params.createdByName || "Admin",
    });

    activityLogService.log("salary_payment" as any, params.employeeName, {
      salaryMonth: params.salaryMonth,
      amount: params.amount,
      currency: params.currency,
      voucherCode,
    });

    return voucherCode;
  }

  /**
   * Get salary history for a specific employee or all
   */
  async getSalaryHistory(employeeId?: string): Promise<any[]> {
    try {
      const rows = await readAllFinanceRows('/api/v1/finance/salary-history', {
        ...(employeeId ? { employeeId } : {}),
      });
      return (rows as SalaryHistoryRow[]).map(mapSalaryHistoryRow);
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error fetching salary history:",
        error,
      );
      return [];
    }
  }

  /**
   * Update monthly salary for an employee account
   */
  async updateMonthlySalary(
    employeeId: string,
    monthlySalary: number,
  ): Promise<void> {
    const updated = await linkEntityAccount('employee', employeeId, { monthlySalary });
    if (!updated) {
      console.error(
        "[FinancialAccountService] Error updating monthly salary:",
        `تعذر تحديث الراتب الشهري للموظف ${employeeId}.`,
      );
    }
  }

  /**
   * Fetches current exchange rates from the `cur_price` table in Supabase via currencyService.
   * الأسعار ديناميكية كاملاً من جداول currency + cur_price — لا أسعار ثابتة.
   */
  async getExchangeRates(): Promise<Record<string, number>> {
    try {
      const activeCurrencies = await currencyService.getActiveCurrencies();
      if (!activeCurrencies.length) {
        throw new Error('لا توجد عملات نشطة يمكن التحقق من أسعارها.');
      }
      const rates: Record<string, number> = {};
      for (const currency of activeCurrencies) {
        const code = String(currency.code || '').trim().toUpperCase();
        const price = currency.isDefault ? 1 : Number(currency.currentPrice);
        if (!code || !Number.isFinite(price) || price <= 0) {
          throw new Error(`لا يوجد سعر صرف موثق للعملة ${code || '[unknown]'}.`);
        }
        rates[code] = price;
      }
      return rates;
    } catch (e) {
      console.error('[FinancialAccountService] تعذر تحميل أسعار الصرف الموثقة؛ أُوقف إنشاء القيد بدل استخدام سعر احتياطي.', e);
      throw e;
    }
  }

  /**
   * Validates if a currency is active (isActive = true).
   * Throws an error if the currency is disabled to prevent voucher/transaction creation.
   */
  async validateCurrencyActive(currencyCode: string): Promise<boolean> {
    if (!currencyCode) return true;
    const activeCurrencies = await currencyService.getActiveCurrencies();
    const isAvailable = activeCurrencies.some(
      (c) => c.code.toUpperCase() === currencyCode.toUpperCase()
    );
    if (!isAvailable) {
      throw new Error(`العملة (${currencyCode}) معطلة حالياً في النظام ولا يمكن إنشاء قيد بها.`);
    }
    return true;
  }

  /**
   * Universal Currency Converter
   * تحويل مبلغ من عملة إلى أخرى باستخدام خريطة أسعار الصرف.
   *
   * المنطق:
   *   rates[X] = كم وحدة من العملة الأساس تساوي 1 وحدة من X
   *   العملة الأساس (isDefault=true) لها rate=1
   *   تحويل A → B = amount * rates[A] / rates[B]
   *
   * لا يوجد افتراض بأن YER هي العملة الأساس — العملة الأساس هي التي rate=1
   */
    convertToTargetCurrency(
    amount: number,
    fromCurrency: string,
    targetCurrency: string,
    exchangeRates: Record<string, number | undefined>,
  ): number {
    return convertToTargetCurrencyValue(amount, fromCurrency, targetCurrency, exchangeRates);
  }

  /**
   * Convert amount to default currency (YER by default or system currency)
   */
  convertToDefaultCurrency(
    amount: number,
    fromCurrency: string,
    defaultCurrency: string,
    exchangeRates: {
      USD?: number;
      SAR?: number;
      [key: string]: number | undefined;
    },
  ): number {
    return this.convertToTargetCurrency(
      amount,
      fromCurrency,
      defaultCurrency,
      exchangeRates as any,
    );
  }

  /**
   * Get all accounts with optional filtering by entity type
   * الفشل يصل إلى المستدعي بدل إرجاع قائمة فارغة تُظهر واجهة بلا حسابات.
   * Read failures propagate to the caller instead of masquerading as "no accounts".
   */
  async getAllAccounts(
    entityType?: AccountEntityType,
  ): Promise<FinancialAccount[]> {
    const rows = await readAllFinanceRows(ACCOUNTS_PATH, { includeInactive: true });
    return rows
      .filter((row) => !entityType || row?.entityType === entityType)
      .map(mapAccountRow)
      .filter((account): account is FinancialAccount => account !== null)
      .sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode)));
  }

  /**
   * Update account entity name (when entity is renamed)
   */
  async updateAccountEntityName(
    entityId: string,
    newName: string,
    currency?: string,
  ): Promise<void> {
    try {
      const account = await this.getAccountByEntityId(entityId);
      if (!account?.id) return;
      await financeApiClient.patch<ApiEnvelope<unknown>>(
        `${ACCOUNTS_PATH}/${encodeURIComponent(account.id)}`,
        {
          entityName: newName,
          ...(currency ? { currency } : {}),
        },
      );
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error updating account name:",
        error,
      );
    }
  }

  /**
   * Compute a ledger summary for a given account (total debit, credit, net balance)
   * by summing all account_trans for that account.
   * Useful for reconciliation and audit reports.
   * الملخص يعتمد أسطر القيود المرحّلة فقط (posting_status='posted') كما يعيدها API.
   */
  async getLedgerSummary(
    accountId: string,
  ): Promise<{ debit: number; credit: number; net: number; count: number }> {
    try {
      const movements = await readAllFinanceRows(
        `${ACCOUNTS_PATH}/${encodeURIComponent(accountId)}/movements`,
      );
      let debit = 0;
      let credit = 0;
      for (const movement of movements) {
        const amount = Number(movement?.amount ?? 0);
        if (movement?.transType === 'Debit') debit += amount;
        else credit += amount;
      }
      return { debit, credit, net: debit - credit, count: movements.length };
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error computing ledger summary:",
        error,
      );
      return { debit: 0, credit: 0, net: 0, count: 0 };
    }
  }

  /**
   * يطلب من قاعدة البيانات إعادة احتساب رصيد الحساب من account_trans فقط.
   * لا يسمح هذا المسار للواجهة بإعادة بناء الرصيد من جداول ملغاة.
   * Asks the database to rebuild the balance from posted ledger lines only.
   */
  // Debounce map: prevents cascade recalculations within 2 seconds for same account
  private _recalcDebounce: Map<string, ReturnType<typeof setTimeout>> = new Map();
  async recalculateAndSyncBalance(accountId: string): Promise<number> {
    try {
      const accountPath = `${ACCOUNTS_PATH}/${encodeURIComponent(accountId)}`;
      const account = await readFinanceRecord(accountPath);
      if (!account) {
        console.warn(`[recalculateAndSyncBalance] Account ${accountId} not found.`);
        return 0;
      }
      await recalculateAccountBalances([accountId]);
      const refreshedAccount = await readFinanceRecord(accountPath);
      return Number(mapAccountRow(refreshedAccount)?.balance ?? 0);
    } catch (error) {
      console.error("[recalculateAndSyncBalance] Error:", error);
      return 0;
    }
  }

  /**
   * Debounced recalculateAndSyncBalance — safe to call many times quickly.
   * Only executes once per accountId within a 2-second window.
   */
  recalculateAndSyncBalanceDebounced(accountId: string, delayMs = 2000): void {
    if (this._recalcDebounce.has(accountId)) {
      clearTimeout(this._recalcDebounce.get(accountId)!);
    }
    const timer = setTimeout(() => {
      this._recalcDebounce.delete(accountId);
      this.recalculateAndSyncBalance(accountId).catch(console.error);
    }, delayMs);
    this._recalcDebounce.set(accountId, timer);
  }

  /**
   * Recalculate and sync ALL accounts in the system.
   * تعمل دالة قاعدة البيانات على كل الحسابات دفعة واحدة وتعيد عدد ما احتُسب.
   * The database function processes every account in one call and reports how many were recalculated.
   */
  async recalculateAllBalances(): Promise<{ processed: number; errors: number }> {
    try {
      const summary = await recalculateAccountBalances();
      return { processed: summary.recalculatedCount, errors: summary.success ? 0 : 1 };
    } catch (error) {
      console.error("[recalculateAllBalances] Fatal error recalculating balances:", error);
      return { processed: 0, errors: 1 };
    }
  }

  /**
   * Ensures essential system accounts exist and returns their IDs.
   *
   * Each system account uses the EXACT code from the chart of accounts:
   *   sys_profit_account  → 4000-0001  (Revenue — Company Profit)
   *   sys_delivery_cost   → 5000-2788  (Expense — Delivery Costs)
   *   sys_sourcing_cost   → 5100-4483  (Expense — Import/Sourcing Costs)
   *   sys_local_shipping  → 5100-7119  (Expense — Local Shipping)
   *   sys_packaging_fees  → 5100-7355  (Expense — Packaging Fees)
   *   sys_shipping_costs  → 5300-7118  (Expense — International Shipping)
   *   sys_cash_account    → 1111-0     (Asset — General Cash Box)
   */

  async ensureSystemAccounts(
    _currency: string = 'YER',
  ): Promise<Record<string, string>> {
    const sysAccounts = [
      { id: "sys_profit_account" },
      { id: "sys_delivery_cost" },
      { id: "sys_sourcing_cost" },
      { id: "sys_orders_cost" },
      { id: "sys_local_shipping" },
      { id: "sys_packaging_fees" },
      { id: "sys_shipping_costs" },
      { id: "sys_cash_account" },
    ];

    const sysIds: Record<string, string> = {};

    for (const acc of sysAccounts) {
      const configuredDefault = await accountingHierarchyService.getDefaultAccount(acc.id);
      if (configuredDefault) {
        sysIds[acc.id] = configuredDefault.accountId;
        continue;
      }
      throw new Error(`الحساب الافتراضي «${acc.id}» غير مربوط أو معطّل في جدول default_accounts.`);
    }
    return sysIds;
  }

  /**
   * Safe seed or retrieve automatic voucher rules from the settings document
   * يقرأ قواعد القيود التلقائية من وثيقة الإعدادات ويبذر الناقص منها.
   */
  async ensureAutomaticVoucherRules(): Promise<any[]> {
    const normalizedDefaultRules = buildDefaultAutomaticVoucherRules();

    try {
      const record = await readSettingsRecord('automatic_voucher_rules');
      const storedRules = (record?.settings as { data?: unknown } | undefined)?.data;
      const currentRules: any[] = Array.isArray(storedRules) ? storedRules : [];

      const existingRulesIds = new Set(currentRules.map((rule) => rule?.id));
      const missingRules = normalizedDefaultRules.filter((rule: any) => !existingRulesIds.has(rule.id));
      if (record && missingRules.length === 0) return currentRules;

      const mergedRules = [...currentRules, ...missingRules];
      try {
        await financeApiClient.patch<ApiEnvelope<unknown>>('/api/v1/settings/automatic_voucher_rules', {
          settings: { data: mergedRules },
        });
      } catch (writeError) {
        // الحفظ يحتاج edit_general_settings؛ القارئ بلا صلاحية يستعمل القواعد المدموجة محلياً.
        // Seeding needs edit_general_settings; a read-only user still gets the merged rules locally.
        console.warn('[FinancialAccountService] تعذر حفظ قواعد القيود التلقائية في الإعدادات:', writeError);
      }

      return mergedRules;
    } catch (e) {
      console.error(
        "[FinancialAccountService] Failed to seed automatic voucher rules:",
        e,
      );
      return normalizedDefaultRules;
    }
  }
  /**
   * Safe execution of dynamic automatic voucher postings based on rule configuration
   */
  async triggerAutomaticVoucher(
    ruleId: string,
    order: any,
    entities: AutomaticVoucherEntities,
  ): Promise<boolean> {
    return executeAutomaticVoucher(this, ruleId, order, entities);
  }

  /**
   * Completely purges a financial entity (customer, courier, or user) and all its financial footprint.
   * Steps:
   * 1. Finds the associated account in `accounts` table.
   * 2. If account exists, finds all `account_trans` legs linked to this account.
   * 3. For each transaction leg:
   *    - Collects the opposite account ID (if it's a double-entry with another account).
   *    - Deletes both legs of the double entry.
   *    - Deletes the associated master `main_entry` document.
   * 4. Deletes the `accounts` document.
   * 5. Deletes the core entity document (from `customers`, `couriers`, or `users`).
   * 6. Recalculates and synces balances for all opposite accounts affected by the deletions.
   */
  async purgeEntityAndFinancialFootprint(
    entityType: PurgeableEntityType,
    entityId: string
  ): Promise<Record<string, unknown> | null> {
    return purgeEntityAndFinancialFootprint(this, entityType, entityId);
  }
}

export const financialAccountService = new FinancialAccountService();
