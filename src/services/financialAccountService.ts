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

import {
  collection,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  increment,
  getDoc,
  writeBatch,
} from "../data/legacy/legacy-compat.ts";
import { currencyService } from "./currencyService";
import { db, supabase } from "../data/legacy/legacy-compat.ts";
import { currentSupabaseAuthGateway } from '../data/current-supabase/gateways/auth.gateway';
import { activityLogService } from "./activityLogService";
import { accountingHierarchyService, hierarchyCodeRules, naturalBalanceDelta } from "./accountingHierarchyService";
import { financialEntryService } from './financialEntryService';
import { Transaction } from "../types";
//import { Settings } from "../contexts/SettingsContext";

import { LEGACY_ACCOUNT_PREFIXES } from './financialAccountTypes';
import type { AccountEntityType, AccountTransaction, AutomaticVoucherEntities, FinancialAccount, JournalEntry } from './financialAccountTypes';
export type { AccountEntityType, AccountTransaction, AutomaticVoucherEntities, FinancialAccount, JournalEntry } from './financialAccountTypes';
import { resolveAutomaticVoucherAccount } from './financialAccountAutomaticVoucher';
import { convertToTargetCurrency as convertToTargetCurrencyValue } from './financialAccountCurrency';
import { buildDefaultAutomaticVoucherRules } from './financialAccountVoucherRules';
import { executeAutomaticVoucher } from './financialAccountAutomation';
import { purgeEntityAndFinancialFootprint } from './financialAccountPurge';
import { createFinancialEntityAccount, generateFinancialAccountIdentifiers } from './financialAccountAccounts';
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
    return generateFinancialAccountIdentifiers(this, entityType, prefixOverride);
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
    try {
      const constraints = [where("entityId", "==", entityId)];
      if (entityType) constraints.push(where("entityType", "==", entityType));
      const q = query(collection(db, "accounts"), ...constraints);
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docData = snap.docs[0];
      return { id: docData.id, ...docData.data() } as FinancialAccount;
    } catch (error) {
      console.error("[FinancialAccountService] Error fetching account:", error);
      return null;
    }
  }

  /**
   * Get account by account ID directly
   */
  async getAccountById(accountId: string): Promise<FinancialAccount | null> {
    try {
      const docRef = await getDoc(doc(db, "accounts", accountId));
      if (docRef.exists()) {
        return { id: docRef.id, ...docRef.data() } as FinancialAccount;
      }
      // جسر قراءة مؤقت للمراجع التاريخية فقط إلى حين ترحيل المعرفات النهائي.
      const legacyCode = String(accountId || '').replace(/^acc_/, '').replace(/_/g, '-');
      if (legacyCode && legacyCode !== accountId) {
        const byCode = await getDocs(query(collection(db, "accounts"), where("accountCode", "==", legacyCode)));
        if (!byCode.empty) {
          const matched = byCode.docs[0];
          return { id: matched.id, ...matched.data() } as FinancialAccount;
        }
      }
      const mappedLegacyId = await getDocs(query(collection(db, "account_id_migration_map"), where("oldAccountId", "==", accountId)));
      if (!mappedLegacyId.empty) {
        const mapping = mappedLegacyId.docs[0].data();
        const mappedAccountId = String(mapping.newAccountId || mapping.new_account_id || '').trim();
        if (mappedAccountId) {
          const mappedAccount = await getDoc(doc(db, "accounts", mappedAccountId));
          if (mappedAccount.exists()) return { id: mappedAccount.id, ...mappedAccount.data() } as FinancialAccount;
        }
      }
      // Fallback: search by entityId if not found by primary doc ID
      return this.getAccountByEntityId(accountId);
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error fetching account by ID:",
        error,
      );
      return null;
    }
  }

  private getAccountTypeByCode(code: string): string {
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.startsWith("REV")) return "Revenue";
    if (cleanCode.startsWith("EXP")) return "Expense";
    if (cleanCode.startsWith("AST") || cleanCode.startsWith("ASS"))
      return "Asset";
    if (cleanCode.startsWith("LIAB")) return "Liability";
    if (cleanCode.startsWith("EQU")) return "Equity";

    const firstChar = cleanCode.charAt(0);
    switch (firstChar) {
      case "1":
        return "Asset";
      case "2":
        return "Liability";
      case "3":
        return "Equity";
      case "4":
        return "Revenue";
      case "5":
        return "Expense";
      default:
        return "Asset";
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
        `JV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(100000 + Math.random() * 900000)}`,
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
   * Creates an account_transaction + salary_history record atomically
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
    createdByUid?: string;
    createdByName?: string;
  }): Promise<string> {
    const now = Date.now();
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const voucherCode = `SAL-${params.salaryMonth.replace("-", "")}-${randStr}`;

    // 1. (REMOVED) We no longer record Salary in account_trans
    // as per the new requirement: it should only deduct from company profits
    // (handled via Expenses) and not affect the employee's account balance.
    /*
    await this.recordTransaction(params.accountId, {
      accountId: params.accountId,
      accountCode: params.accountCode,
      entityType: 'employee',
      entityId: params.employeeId,
      entityName: params.employeeName,
      type: 'Credit',  // Credit = money paid out to employee
      amount: params.amount,
      amountOriginal: params.amount,
      currencyOriginal: params.currency,
      description: `صرف راتب شهر ${params.salaryMonth} — ${params.employeeName}`,
      refNumber: voucherCode,
      module: 'salary',
      salaryMonth: params.salaryMonth,
      createdAt: now,
      createdByUid: params.createdByUid || 'system',
      createdByName: params.createdByName || 'Admin'
    });
    */

    // 2. Record in salary_history collection for the dedicated salary history page
    const newId = `salary_${params.employeeId}_${params.salaryMonth.replace("-", "")}_${randStr}`;
    await addDoc(newId,
      collection(db, "salary_history"), {
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      accountId: params.accountId,
      accountCode: params.accountCode,
      amount: params.amount,
      currency: params.currency,
      salaryMonth: params.salaryMonth,
      voucherCode,
      notes: params.notes || "",
      status: "Paid",
      paidAt: now,
      createdByUid: params.createdByUid || "system",
      createdByName: params.createdByName || "Admin",
      createdAt: now,
    }
    );

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
      const q = employeeId
        ? query(
          collection(db, "salary_history"),
          where("employeeId", "==", employeeId),
          orderBy("createdAt", "desc"),
        )
        : query(collection(db, "salary_history"), orderBy("createdAt", "desc"));

      const snap = await getDocs(q);
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    try {
      await updateDoc(doc(db, "employees", employeeId), {
        monthlySalary,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error updating monthly salary:",
        error,
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
   */
  async getAllAccounts(
    entityType?: AccountEntityType,
  ): Promise<FinancialAccount[]> {
    try {
      let q;
      if (entityType) {
        q = query(
          collection(db, "accounts"),
          where("entityType", "==", entityType),
          orderBy("accountCode"),
        );
      } else {
        q = query(collection(db, "accounts"), orderBy("accountCode"));
      }
      const snap = await getDocs(q);
      return snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as any) }) as FinancialAccount,
      );
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error fetching accounts:",
        error,
      );
      return [];
    }
  }

  /**
   * Update account entity name (when entity is renamed)
   */
  async updateAccountEntityName(
    entityId: string,
    newName: string,
  ): Promise<void> {
    try {
      const account = await this.getAccountByEntityId(entityId);
      if (!account || !account.id) return;
      await updateDoc(doc(db, "accounts", account.id), {
        entityName: newName,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error updating account name:",
        error,
      );
    }
  }

  /**
   * Get the PostgreSQL collection name for an entity type
   */
  public getEntityCollection(entityType: AccountEntityType): string {
    switch (entityType) {
      case "customer":
        return "customers";
      case "courier":
        return "couriers";
      case "employee":
        return "employees";
      case "source":
        return "sources";
      case "shipping_company":
        return "shipping_companies";
      case "asset":
        return "assets";
      case "system":
        return "system_accounts";
      default:
        return "customers";
    }
  }
  /**
   * Compute a ledger summary for a given account (total debit, credit, net balance)
   * by summing all account_trans for that account.
   * Useful for reconciliation and audit reports.
   */
  async getLedgerSummary(
    accountId: string,
  ): Promise<{ debit: number; credit: number; net: number; count: number }> {
    try {
      // الاعتماد الكامل على جدول أسطر الحسابات الجديد account_trans
      // Relying fully on new ledger lines table account_trans
      const q = query(
        collection(db, "account_trans"),
        where("accountId", "==", accountId),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      let debit = 0,
        credit = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        const type = data.transType || data.trans_type || data.type;
        if (type === "Debit") debit += parseFloat(data.amount || 0);
        else credit += parseFloat(data.amount || 0);
      });
      return { debit, credit, net: debit - credit, count: snap.size };
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
   */
  // Debounce map: prevents cascade recalculations within 2 seconds for same account
  private _recalcDebounce: Map<string, ReturnType<typeof setTimeout>> = new Map();
  async recalculateAndSyncBalance(accountId: string): Promise<number> {
    try {
      const accountDoc = await getDoc(doc(db, "accounts", accountId));
      if (!accountDoc.exists()) {
        console.warn(`[recalculateAndSyncBalance] Account ${accountId} not found.`);
        return 0;
      }
      const { error } = await (supabase as any).rpc('recalculate_accounting_hierarchy', {
        p_account_id: accountId,
      });
      if (error) {
        throw new Error(error.message || String(error));
      }
      const refreshedAccount = await this.getAccountById(accountId);
      return Number(refreshedAccount?.balance || 0);
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
   * Returns a summary of accounts processed and any errors encountered.
   * Useful for migration / reconciliation runs.
   */
  async recalculateAllBalances(): Promise<{
    processed: number;
    errors: number;
    results: Array<{ accountId: string; accountCode: string; oldBalance: number; newBalance: number }>;
  }> {
    const results: Array<{ accountId: string; accountCode: string; oldBalance: number; newBalance: number }> = [];
    let errors = 0;

    try {
      const snap = await getDocs(collection(db, "accounts"));
      const docs = snap.docs;

      // Process in parallel batches of 5 to avoid overwhelming the DB while still being fast
      const BATCH_SIZE = 5;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (d) => {
          const data = d.data() as FinancialAccount;
          const oldBalance = data.balance || 0;
          try {
            const newBalance = await this.recalculateAndSyncBalance(d.id);
            results.push({
              accountId: d.id,
              accountCode: data.accountCode || d.id,
              oldBalance,
              newBalance,
            });
          } catch (err) {
            errors++;
            console.error(`[recalculateAllBalances] Error on account ${d.id}:`, err);
          }
        }));
      }
    } catch (err) {
      console.error("[recalculateAllBalances] Fatal error loading accounts:", err);
    }

    return { processed: results.length, errors, results };
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
   * Safe seed or retrieve automatic voucher rules from automatic_voucher_rules collection
   */
  async ensureAutomaticVoucherRules(): Promise<any[]> {
    const normalizedDefaultRules = buildDefaultAutomaticVoucherRules();

    try {
      const snap = await getDoc(doc(db, "settings", "automatic_voucher_rules"));
      let currentRules: any[] = [];
      if (snap.exists()) {
        const d = snap.data();
        if (d && d.data && Array.isArray(d.data)) {
          currentRules = d.data;
        }
      }

      const existingRulesIds = new Set(currentRules.map((r) => r.id));
      let modified = false;

      for (const rule of normalizedDefaultRules) {
        if (!existingRulesIds.has(rule.id)) {
          currentRules.push(rule);
          modified = true;
        }
      }

      if (modified || !snap.exists()) {
        await setDoc(doc(db, "settings", "automatic_voucher_rules"), { data: currentRules });
      }

      return currentRules;
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
    entityType: 'customer' | 'courier' | 'user' | 'employee',
    entityId: string
  ): Promise<void> {
    return purgeEntityAndFinancialFootprint(this, entityType, entityId);
  }
}

export const financialAccountService = new FinancialAccountService();
