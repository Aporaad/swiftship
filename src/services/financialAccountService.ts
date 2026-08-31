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
} from "../lib/supabase-firebase-adapter";
import { currencyService } from "./currencyService";
import { db, auth, supabase } from "../lib/supabase-firebase-adapter";
import { activityLogService } from "./activityLogService";
import { accountingHierarchyService, hierarchyCodeRules, naturalBalanceDelta } from "./accountingHierarchyService";
import { financialEntryService } from './financialEntryService';
import { Transaction } from "../types";
//import { Settings } from "../contexts/SettingsContext";

export type AccountEntityType = "customer" | "courier" | "employee" | "source" | "shipping_company" | "asset" | "system";

export interface FinancialAccount {
  id?: string;
  accountCode: string; // e.g. '1130-0001'
  accountPrefix: string; // e.g. '1130'
  accountNumber: string; // e.g. '0001'
  entityType: AccountEntityType;
  entityId: string; // Firestore document ID of customer/courier/employee
  entityName: string; // Display name
  currency: string; // Default currency from settings
  balance: number; // Current balance in default currency
  debitTotal: number; // Total debits
  creditTotal: number; // Total credits
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  notes?: string;
  monthlySalary?: number; // Default monthly salary (for employees)
  type?: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  parentCode?: string;
  accSubId?: string;
  groupId?: string;
  accountSeq?: number;
  accNameAr?: string;
  accNameEn?: string;
  limitedBalance?: number;
  curNo?: number;
  lastRecalculatedAt?: number | string;
}

export interface AccountTransaction {
  id?: string;
  accountId: string; // Financial account ID
  accountCode: string; // Account code for display
  entityType: AccountEntityType;
  entityId: string;
  entityName: string;
  type: "Debit" | "Credit";
  amount: number; // Amount in target account currency
  currency: string; // Account currency (YER, USD, SAR)
  curNo?: number; // Reference to currency.cur_id
  amountOriginal: number; // Amount in original voucher currency
  currencyOriginal: string; // Original voucher currency
  description: string; // Transaction description
  refNumber: string; // Reference number (expense/order/adjustment)
  module://مهم:يجب اضافه العديد من التصنيفات
  | "expense"
  | "order"
  | "adjustment"
  | "custody"
  | "payment"
  | "salary"
  | string;
  salaryMonth?: string; // e.g. '2026-06' for salary payments
  createdAt: number;
  createdByUid?: string;
  createdByName?: string;
  journalEntryId?: string;
  journalEntryNumber?: string;
  orderId?: string;
  orderNumber?: string;
  shipmentId?: string;
  automationKey?: string;
  autoRuleId?: string;
}

export interface JournalEntry {
  id?: string;
  entryNumber: string; // رقم القيد (reference sequence)
  createdAt: number; // التاريخ (timestamp)
  description: string; // البيان
  attachments?: string[]; // المستندات الداعمة
  notes?: string; // ملاحظة أخرى

  // الطرف المدين (3 حقول: الاسم، الكود، المعرف)
  debitAccountId: string;
  debitAccountName: string;
  debitAccountCode: string;

  // الطرف الدائن (3 حقول: الاسم، الكود، المعرف)
  creditAccountId: string;
  creditAccountName: string;
  creditAccountCode: string;

  amount: number; // المبلغ الأصلي
  currency: string; // العملة الأصلية
  curNo?: number; // Reference to currency.cur_id
  amountDebitCurrency: number; // المبلغ بعملة المدين
  amountCreditCurrency: number; // المبلغ بعملة الدائن

  module: string; // فئة القيد (طلبات / مصروفات / قيد يومي / إلخ)
  refNumber: string; // المعني من الفئة (رقم الطلب / نوع المصروف / إلخ)
  orderId?: string;
  orderNumber?: string;
  shipmentId?: string;
  automationKey?: string;
  autoRuleId?: string;
  statusId?: number;
  isAutomatic?: boolean;
  amountSources?: string[];
  amountBreakdown?: Array<{ source: string; amount: number; currency: string; convertedAmount: number }>;

  createdByUid: string; // المعرف للمستخدم المدخل للعملية
  createdByName: string; // الاسم للمستخدم المدخل للعملية
}

export interface AutomaticVoucherEntities {
  courier?: any;
  deliveryCourier?: any;
  shippingCourier?: any;
  customer?: any;
  orderParty?: any;
  purchaseSource?: any;
  shippingCompany?: any;
  sourcing_cost?: any;
  isAr?: boolean;
  rawAmount?: number;
  amountOriginal?: number;
  currencyOriginal?: string;
  expenseNumber?: string;
  profileName?: string;
  statusId?: number | string;
  automationKey?: string;
  autoRuleId?: string;
  amountSources?: string[];
  amountBreakdown?: any[];
}

// Account prefix ranges per entity type
// Customer accounts are ASSETS (owed to us)    → 1130
// Courier accounts are LIABILITIES (we owe or they hold custody) → 2120
// Employee accounts are LIABILITIES (salary obligations) → 2130
// Order sources are LIABILITIES (supplier payables) → 2140
// Shipping companies are LIABILITIES (carrier payables) → 2150
// Assets are ASSETS; a category-specific prefix can override the default 1200.
// System utility accounts                         → varies, default 5000
/** توافق مرحلي للحسابات التي سبقت زرع الشجرة فقط؛ لا يستعمل عند جاهزية الشجرة. */
const LEGACY_ACCOUNT_PREFIXES: Record<AccountEntityType, string> = {
  customer: "1130",
  courier: "2120",
  employee: "2130",
  source: "2140",
  shipping_company: "2150",
  asset: "1240",
  system: "5000",
};

class FinancialAccountService {
  private resolveAutomaticVoucherAccount(
    accountConfig: any,
    systemAccounts: Record<string, string>,
    order: any,
    entities: AutomaticVoucherEntities,
  ): { id: string; code: string } {
    if (!accountConfig?.id) {
      throw new Error('Automatic voucher account configuration is incomplete.');
    }

    const linkedAccount = (entity: any) => {
      if (!entity || typeof entity !== 'object') return null;
      const id = entity.financialAccountId || entity.accountId || entity.linkedAccountId || entity.account_id;
      if (!id) return null;
      return {
        id: String(id),
        code: String(entity.financialAccountCode || entity.accountCode || entity.linkedAccountCode || accountConfig.code || ''),
      };
    };

    const sourceKey = String(order?.sourcing_cost || order?.sourcsystemAccountsingCostSource || '').trim().toLowerCase();
    const costOnCourier = Boolean(order?.deductSourcingCostFromCourier)
      || ['courier', 'delivery_courier', 'courier_linked', 'مندوب'].includes(sourceKey);
    const defaultKey = String(accountConfig.defaultKey || accountConfig.id || '').trim();
    const fallbackOrderCost = () => ({
      id: String(systemAccounts.sys_orders_cost || systemAccounts.sys_sourcing_cost || 'sys_orders_cost'),
      code: String(accountConfig.code || ''),
    });

    let candidate: { id: string; code: string } | null = null;
    switch (accountConfig.id) {
      case 'customer_linked':
        candidate = linkedAccount(entities.orderParty || entities.customer);
        break;
      case 'delivery_courier_linked':
        candidate = linkedAccount(entities.deliveryCourier || entities.courier);
        break;
      case 'shipping_courier_linked':
        candidate = linkedAccount(entities.shippingCourier || entities.courier);
        break;
      case 'courier_linked':
        candidate = linkedAccount(entities.courier || entities.deliveryCourier || entities.shippingCourier);
        break;
      case 'purchase_source_linked':
        candidate = linkedAccount(entities.purchaseSource);
        break;
      case 'shipping_company_linked':
        candidate = linkedAccount(entities.shippingCompany);
        break;
      case 'product_cost_source':
      case 'sourcing_cost':
        candidate = costOnCourier
          ? linkedAccount(entities.courier || entities.deliveryCourier || entities.shippingCourier || entities.sourcing_cost)
          : linkedAccount(entities.sourcing_cost);
        return candidate || fallbackOrderCost();
      case 'order_cost_account':
        return fallbackOrderCost();
      default:
        return {
          id: String(systemAccounts[defaultKey] || systemAccounts[accountConfig.id] || accountConfig.id),
          code: String(accountConfig.code || ''),
        };
    }

    if (!candidate?.id) {
      throw new Error(`Unable to resolve linked account for automatic voucher target: ${accountConfig.id}`);
    }
    return candidate;
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
    const hierarchyLocation = await accountingHierarchyService.getEntityPostingLocation(entityType);
    const hierarchyReady = await accountingHierarchyService.hasHierarchyStructure();
    if (hierarchyReady && !hierarchyLocation) {
      throw new Error(`لا توجد مجموعة حسابات نشطة مرتبطة بنوع الكيان «${entityType}». أنشئ المجموعة أو فعّلها من شجرة الحسابات أولاً.`);
    }
    const prefix = hierarchyLocation
      ? hierarchyCodeRules.postingPrefix(hierarchyLocation.accountCode)
      : (prefixOverride || LEGACY_ACCOUNT_PREFIXES[entityType] || "5000");

    let allAccounts: any[] = [];
    try {
      const snap = await getDocs(collection(db, "accounts"));
      allAccounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("[FinancialAccountService] Error fetching existing accounts for uniqueness check:", e);
    }

    const existingIds = new Set<string>();
    const existingCodes = new Set<string>();
    const existingNumbersForPrefix = new Set<string>();

    let maxSeq = 0;

    for (const acc of allAccounts) {
      if (acc.id) existingIds.add(String(acc.id));

      const accCode = String(acc.accountCode || acc.code || '').trim();
      if (accCode) existingCodes.add(accCode);

      const rawCode = String(acc.code || '').trim();
      if (rawCode) existingCodes.add(rawCode);

      const accNum = String(acc.accountNumber || '').trim();
      const accPrefix = String(acc.accountPrefix || acc.parentCode || '').trim();

      if (accPrefix === prefix || accCode.startsWith(`${prefix}-`)) {
        if (accNum) existingNumbersForPrefix.add(accNum);

        const parts = accCode.split("-");
        if (parts.length >= 2) {
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
        if (accNum) {
          const num = parseInt(accNum, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }

    let candidateSeq = hierarchyLocation
      ? await accountingHierarchyService.getNextAccountSequence({ ...hierarchyLocation, accountCode: prefix })
      : Math.max(maxSeq + 1, allAccounts.length + 1, 1);

    while (true) {
      const seqStr = String(candidateSeq).padStart(4, "0");
      const candidateCode = hierarchyCodeRules.formatPostingCode(prefix, candidateSeq);
      // الحساب المالي الورقي يُعرّف بالكود المحاسبي نفسه؛ لا تستخدم بادئة acc_.
      const candidateId = candidateCode;

      const isCodeTaken = existingCodes.has(candidateCode);
      const isIdTaken = existingIds.has(candidateId);
      const isNumTaken = existingNumbersForPrefix.has(seqStr);

      if (!isCodeTaken && !isIdTaken && !isNumTaken) {
        return {
          prefix,
          accountNumber: seqStr,
          accountCode: candidateCode,
          code: candidateCode,
          accountId: candidateId,
        };
      }
      candidateSeq++;
    }
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
    try {
      // 1. Prevent duplicate account creation for the same entityId
      const existing = await this.getAccountByEntityId(entityId, entityType);
      if (existing && existing.id) {
        const now = Date.now();
        const existingUpdate = {
          entityName,
          currency: currency || existing.currency,
          type: options?.accountType || existing.type,
          parentCode: options?.parentCode || existing.parentCode,
          updatedAt: now,
        };
        await updateDoc(doc(db, "accounts", existing.id), existingUpdate);
        if (entityType !== "system" && options?.updateEntity !== false) {
          await updateDoc(doc(db, this.getEntityCollection(entityType), entityId), {
            accountId: existing.id,
            financialAccountId: existing.id,
            financialAccountCode: existing.accountCode,
            updatedAt: now,
          });
        }
        return { ...existing, ...existingUpdate };
      }

      // 2. Generate guaranteed unique account identifiers
      const hierarchyLocation = await accountingHierarchyService.getEntityPostingLocation(entityType);
      if (!hierarchyLocation && await accountingHierarchyService.hasHierarchyStructure()) {
        throw new Error(`لا يمكن إنشاء حساب «${entityName}»: لا توجد مجموعة نشطة لنوع الكيان «${entityType}» في شجرة الحسابات.`);
      }
      const hierarchyPrefix = hierarchyLocation?.accountCode;
      const { prefix, accountNumber, accountCode, code, accountId } =
        await this.getNextAccountIdentifiers(entityType, options?.accountPrefix || hierarchyPrefix);
      let currencyId: number | undefined;
      try {
        currencyId = await accountingHierarchyService.getCurrencyIdByCode(currency);
      } catch (currencyError) {
        console.warn('[FinancialAccountService] Currency reference lookup deferred:', currencyError);
      }
      // تستخدم عملة عقدة الشجرة فقط عندما لا يحدد الحساب المالي عملة صريحة.
      currencyId ??= hierarchyLocation?.currencyId;

      const now = Date.now();
      const accountData: FinancialAccount = {
        id: accountId,
        accountCode,
        code,
        accountPrefix: prefix,
        accountNumber,
        entityType,
        entityId,
        entityName,
        currency,
        balance: 0,
        debitTotal: 0,
        creditTotal: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        notes: options?.notes || "",
        type:
          options?.accountType ||
          (([
            "courier",
            "employee",
            "source",
            "shipping_company",
          ] as AccountEntityType[]).includes(entityType)
            ? "Liability"
            : "Asset"),
        parentCode: options?.parentCode || prefix,
        accSubId: hierarchyLocation?.accSubId,
        groupId: hierarchyLocation?.groupId,
        accountSeq: Number(accountNumber),
        accNameAr: entityName,
        accNameEn: entityName,
        limitedBalance: 0,
        lastRecalculatedAt: now.toString(),
        curNo: currencyId,
        ...(monthlySalary !== undefined && { monthlySalary }),
      } as any;

      // Save document with explicit unique ID
      await setDoc(doc(db, "accounts", accountId), accountData);

      // Update the entity's document with the account code reference
      if (entityType !== "system" && options?.updateEntity !== false) {
        try {
          const entityCollection = this.getEntityCollection(entityType);
          const entityUpdateData: any = {
            accountId: accountId,
            financialAccountId: accountId,
            financialAccountCode: accountCode,
            updatedAt: now,
          };
          if (monthlySalary !== undefined) {
            entityUpdateData.monthlySalary = monthlySalary;
          }
          await updateDoc(
            doc(db, entityCollection, entityId),
            entityUpdateData,
          );
        } catch (e) {
          console.warn("Could not update entity doc with financial id", e);
        }
      }

      activityLogService.log("create_financial_account" as any, entityName, {
        accountCode,
        entityType,
        entityId,
      });

      return { id: accountId, ...accountData };
    } catch (error) {
      console.error("[FinancialAccountService] Error creating account:", error);
      throw error;
    }
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
        transaction.refNumber ||
        `JV-${transaction.date}-${Math.floor(1000 + Math.random() * 9000)}`,
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
      const account = await this.getAccountByEntityId(employeeId);
      if (!account || !account.id) return;
      await updateDoc(doc(db, "accounts", account.id), {
        monthlySalary,
        updatedAt: Date.now(),
      });
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
    if (!fromCurrency || !targetCurrency || fromCurrency === targetCurrency) return amount;

    // rate[X] = كم وحدة أساس = 1 وحدة X
    const fromRate = typeof exchangeRates[fromCurrency] === 'number' && (exchangeRates[fromCurrency] as number) > 0
      ? (exchangeRates[fromCurrency] as number)
      : 1;
    const toRate = typeof exchangeRates[targetCurrency] === 'number' && (exchangeRates[targetCurrency] as number) > 0
      ? (exchangeRates[targetCurrency] as number)
      : 1;

    // تحويل: A → عملة أساس → B
    // amount_in_base = amount * fromRate
    // amount_in_B = amount_in_base / toRate
    return (amount * fromRate) / toRate;
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
   * Settle pending custodies for a courier
   */
  async settlePendingCustodies(
    courierId: string,
    amountToSettle: number,
    currency: string,
  ): Promise<void> {
    try {
      const exchangeRates = await this.getExchangeRates();
      const q = query(
        collection(db, "expenses"),
        where("recipientEntityId", "==", courierId),
        where("status", "==", "Pending"),
      );
      const snap = await getDocs(q);

      const pending = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((e: any) => e.type === "Custody")
        .sort((a: any, b: any) => a.createdAt - b.createdAt);

      let remainingToSettle = amountToSettle;
      const batch = writeBatch(db);
      let settled = false;

      for (const expense of pending) {
        if (remainingToSettle <= 0) break;

        const expenseCurrency = expense.currency || "YER";
        const currentRemitted = parseFloat(expense.remittedAmount) || 0;
        const totalAmount = parseFloat(expense.amount) || 0;
        const availableToSettleExpenseCurrency = totalAmount - currentRemitted;

        if (availableToSettleExpenseCurrency <= 0) continue;

        // Convert available to settle back to our budget currency for comparison
        const availableToSettleBudgetCurrency = this.convertToTargetCurrency(
          availableToSettleExpenseCurrency,
          expenseCurrency,
          currency,
          exchangeRates,
        );

        const settleAmountBudgetCurrency = Math.min(
          remainingToSettle,
          availableToSettleBudgetCurrency,
        );

        // Convert settle amount to expense currency to update the expense record
        const settleAmountExpenseCurrency = this.convertToTargetCurrency(
          settleAmountBudgetCurrency,
          currency,
          expenseCurrency,
          exchangeRates,
        );

        const newRemitted = currentRemitted + settleAmountExpenseCurrency;
        const isFullySettled = newRemitted >= totalAmount - 0.01; // Avoid floating point issues

        batch.update(doc(db, "expenses", expense.id), {
          status: isFullySettled ? "Settled" : "Pending",
          remittedAmount: newRemitted,
          updatedAt: Date.now(),
        });

        remainingToSettle -= settleAmountBudgetCurrency;
        settled = true;

        // Log this settlement
        activityLogService.log("settle_custody", expense.id, {
          amount: settleAmountBudgetCurrency,
          currency,
        });
      }

      if (settled) {
        await batch.commit();
      }
    } catch (error) {
      console.error(
        "[FinancialAccountService] Error settling pending custodies:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get the Firestore collection name for an entity type
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
    const defaultRules = [
      {
        id: "order_charge",
        nameAr: "قيد قيمة الطلب على العميل",
        nameEn: "Charge order value to customer",
        isActive: false,
        debitAccount: {
          id: "customer_linked",
          code: "1130",
          name: "حساب العميل المرتبط بالطلب (ديناميكي)",
          type: "dynamic",
        },
        creditAccount: {
          id: "sys_profit_account",
          code: "4000-0001",
          name: "حساب أرباح الشركة (نظامي)",
          type: "system",
        },
        descriptionTempAr: "قيد قيمة الطلب رقم: {orderNumber}",
        descriptionTempEn: "Charge for order: {orderNumber}",
      },
      {
        id: "order_down_payment",
        nameAr: "الدفعة المقدمة للطلب المستلمة نقدًا",
        nameEn: "Order down payment received in cash",
        isActive: true,
        debitAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "customer_linked",
          code: "1130",
          name: "حساب العميل المرتبط بالطلب (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr: "دفعة مقدمة للطلب رقم: {orderNumber}",
        descriptionTempEn: "Down payment for order: {orderNumber}",
      },
      {
        id: "sourcing_cost_courier",
        nameAr: "تكاليف المنتجات الأصلية المضافة لعهدة المندوب",
        nameEn: "Adding sourcing cost to courier custody",
        isActive: false,
        debitAccount: {
          id: "sys_sourcing_cost",
          code: "5100-4483",
          name: "حساب تكلفة الشراء/السورسينج (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "courier_linked",
          code: "2120",
          name: "حساب المندوب المرتبط بالطلب (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr:
          "إضافة تكاليف المنتجات الأصلية والشحن للطلب للمندوب: {orderNumber}",
        descriptionTempEn:
          "Adding sourcing products and shipping cost to courier: {orderNumber}",
      },
      {
        id: "sourcing_cost_system",
        nameAr: "تكلفة شراء منتجات الطلب المدفوعة نقدًا",
        nameEn: "Sourcing products cost paid from cash",
        isActive: false,
        debitAccount: {
          id: "sys_sourcing_cost",
          code: "5100-4483",
          name: "حساب تكلفة الشراء/السورسينج (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        descriptionTempAr: "تكلفة شراء منتجات الطلب وشحنه: {orderNumber}",
        descriptionTempEn: "Sourcing products and shipping cost for order: {orderNumber}",
      },
      {
        id: "packaging_fee",
        nameAr: "رسوم التغليف التلقائية",
        nameEn: "Auto packaging fee",
        isActive: false,
        debitAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "sys_packaging_fees",
          code: "5100-7355",
          name: "حساب رسوم التغليف (نظامي)",
          type: "system",
        },
        descriptionTempAr: "رسوم تغليف للطلب: {orderNumber}",
        descriptionTempEn: "Packaging fee for order: {orderNumber}",
      },
      {
        id: "international_shipping",
        nameAr: "تكلفة الشحن الدولي للطلب المدفوعة نقدًا",
        nameEn: "International shipping cost paid from cash",
        isActive: false,
        debitAccount: {
          id: "sys_shipping_costs",
          code: "5300-7118",
          name: "حساب تكلفة الشحن (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        descriptionTempAr: "تكلفة الشحن الدولي للطلب: {orderNumber}",
        descriptionTempEn:
          "International shipping cost for order: {orderNumber}",
      },
      {
        id: "order_payment",
        nameAr: "دفعة مسددة للطلب نقدًا/تحويل",
        nameEn: "Order payment received",
        isActive: false,
        debitAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "customer_linked",
          code: "1130",
          name: "حساب العميل المرتبط بالطلب (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr: "دفعة سداد للطلب رقم: {orderNumber}",
        descriptionTempEn: "Payment for order: {orderNumber}",
      },
      {
        id: "delivery_wage",
        nameAr: "أجور التوصيل التلقائية للمندوب",
        nameEn: "Auto-wage for courier delivery",
        isActive: false,
        debitAccount: {
          id: "sys_delivery_cost",
          code: "5000-2788",
          name: "حساب مصروفات التوصيل (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "courier_linked",
          code: "2120",
          name: "حساب المندوب المرتبط بالشحنة (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr: "أجور توصيل تلقائية لتسليم الطلب رقم: {orderNumber}",
        descriptionTempEn: "Auto-wage for delivery of order: {orderNumber}",
      },
      {
        id: "custody_payment",
        nameAr: "العهدة وتصفية دفعة العميل التلقائية",
        nameEn: "Auto-custody and payment settlement",
        isActive: false,
        debitAccount: {
          id: "courier_linked",
          code: "2120",
          name: "حساب المندوب المرتبط بالشحنة (ديناميكي)",
          type: "dynamic",
        },
        creditAccount: {
          id: "customer_linked",
          code: "1130",
          name: "حساب العميل المرتبط بالشحنة (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr:
          "عهدة تلقائية مرحلة من تسليم الطلب رقم: {orderNumber}",
        descriptionTempEn:
          "Auto-custody generated from delivery of order: {orderNumber}",
      },
      {
        id: "courier_commission",
        nameAr: "عمولة الشحن التلقائية للوكلاء/المناديب",
        nameEn: "Auto shipping courier commission",
        isActive: false,
        debitAccount: {
          id: "sys_sourcing_cost",
          code: "5100-4483",
          name: "حساب تكلفة الشحن والعمولات (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "courier_linked",
          code: "2120",
          name: "حساب المندوب المرتبط بالشحنة (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr: "عمولة شحن تلقائية للطلب رقم: {orderNumber}",
        descriptionTempEn: "Auto-commission for order: {orderNumber}",
      },
      {
        id: "company_profit",
        nameAr: "صافي أرباح الشركة للطلب التلقائي",
        nameEn: "Company net profit",
        isActive: false,
        debitAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "sys_profit_account",
          code: "4000-0001",
          name: "حساب أرباح الشركة (نظامي)",
          type: "system",
        },
        descriptionTempAr: "صافي أرباح الشركة للطلب: {orderNumber}",
        descriptionTempEn: "Company profit for order: {orderNumber}",
      },
    ];
    const normalizedDefaultRules = defaultRules.map((rule) => {
      const normalizeAccount = (account: any) => account?.type === 'system'
        ? { ...account, defaultKey: account.defaultKey || account.id, code: '' }
        : account;
      return {
        ...rule,
        debitAccount: normalizeAccount(rule.debitAccount),
        creditAccount: normalizeAccount(rule.creditAccount),
      };
    });

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
    try {
      const isAr = entities.isAr ?? true;
      const orderIdentifier = String(order?.id || order?.orderNumber || order?.order_number || 'unknown-order');
      const automationKey = entities.automationKey || `auto-voucher:${orderIdentifier}:rule:${ruleId}`;

      const previousExecutions = await (supabase as any)
        .from('main_entry')
        .select('id')
        .eq('automation_key', automationKey)
        .limit(1);
      if (previousExecutions.error) {
        throw new Error(`تعذر التحقق من تكرار القيد التلقائي: ${previousExecutions.error.message || previousExecutions.error}`);
      }
      if ((previousExecutions.data || []).length > 0) {
        console.info('[AutomaticVouchers] Duplicate execution prevented.', { automationKey, ruleId, orderIdentifier });
        return false;
      }
      let rule = null;

      // 1. Try to load from dedicated auto_entries table first
      try {
        const autoEntryDoc = await getDoc(doc(db, "auto_entries", ruleId));
        if (autoEntryDoc.exists()) {
          rule = { id: autoEntryDoc.id, ...autoEntryDoc.data() };
        } else {
          // Check query by id field in auto_entries
          const qAuto = query(collection(db, "auto_entries"), where("id", "==", ruleId));
          const autoSnap = await getDocs(qAuto);
          if (!autoSnap.empty) {
            const first = autoSnap.docs[0];
            rule = { id: first.id, ...first.data() };
          }
        }
      } catch (err) {
        console.warn(`[AutomaticVouchers] Error reading auto_entries for ${ruleId}:`, err);
      }

      // 2. Fallback to settings/automatic_voucher_rules for backwards compatibility
      // العوده لفيود الاعدادت في حاله لم يجد في جدول القيود التلفائيه
      /*if (!rule) {
        const ruleDoc = await getDoc(doc(db, "settings", "automatic_voucher_rules"));
        if (ruleDoc.exists()) {
          const d = ruleDoc.data();
          if (d && d.data && Array.isArray(d.data)) {
            rule = d.data.find((r) => r.id === ruleId) || null;
          }
        }
      }*/

      if (!rule) {
        const rules = await this.ensureAutomaticVoucherRules();
        rule = rules.find((r) => r.id === ruleId);
      }

      if (!rule) {
        console.warn(
          `[AutomaticVouchers] Rule ${ruleId} not found in database or fallback. Execution skipped.`,
        );
        return false;
      }

      if (!rule.isActive) {
        console.log(
          `[AutomaticVouchers] Rule ${ruleId} is deactivated. Voucher execution bypassed.`,
        );
        return false;
      }

      // Use a consistent default currency if not specified, but prefer settings if available
      const systemAccs = await this.ensureSystemAccounts("YER");

      const debitAccount = this.resolveAutomaticVoucherAccount(rule.debitAccount, systemAccs, order, entities);
      const creditAccount = this.resolveAutomaticVoucherAccount(rule.creditAccount, systemAccs, order, entities);
      const debitId = debitAccount.id;
      const debitCode = debitAccount.code;
      const creditId = creditAccount.id;
      const creditCode = creditAccount.code;

      let description = isAr
        ? rule.descriptionTempAr || rule.nameAr
        : rule.descriptionTempEn || rule.nameEn;

      description = description
        .replace("{orderNumber}", order.orderNumber || "")
        .replace("{customerName}", entities.customer?.profileName || "")
        .replace("{courierName}", entities.courier?.profileName || "")
        .replace(
          "{commissionRate}",
          String(entities.courier?.commissionRate || 0),
        );

      const refNumber = entities.expenseNumber || order.orderNumber || "";
      const amount = entities.amountOriginal !== undefined ? entities.amountOriginal : (entities.rawAmount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        console.info('[AutomaticVouchers] Zero-value automatic voucher skipped.', { automationKey, ruleId, amount });
        return false;
      }

      let moduleAssign = "order";
      if (
        ruleId.includes("cost") ||
        ruleId.includes("fee") ||
        ruleId.includes("shipping") ||
        ruleId.includes("wage") ||
        ruleId.includes("commission")
      ) {
        moduleAssign = "expense";
      } else if (ruleId.includes("payment")) {
        moduleAssign = "payment";
      }

      await this.recordTransaction({
        date: Date.now(),
        description,
        module: moduleAssign,
        refNumber,
        amount,
        currency: entities.currencyOriginal || "YER",
        debitAccount: { id: debitId, code: debitCode },
        creditAccount: { id: creditId, code: creditCode },
        createdByUid: auth.currentUser?.uid || "system",
        createdByName: entities.profileName || "System Auto",
        orderId: order.id,
        orderNumber: order.orderNumber,
        automationKey,
        autoRuleId: entities.autoRuleId || ruleId,
        statusId: Number(entities.statusId) || undefined,
        isAutomatic: true,
        amountSources: entities.amountSources,
        amountBreakdown: entities.amountBreakdown,
      });
      console.log('automatic voucher fired successfully', { automationKey, amount, currency: entities.currencyOriginal || "YER", debitAccount: { id: debitId, code: debitCode }, creditAccount: { id: creditId, code: creditCode }, createdByUid: auth.currentUser?.uid || "system", createdByName: entities.profileName || "System Auto", amountSources: entities.amountSources, amountBreakdown: entities.amountBreakdown });
      return true;

    } catch (err) {
      console.error(
        `[AutomaticVouchers] Failed to fire automatic voucher rule: ${ruleId}`,
        err,
      );
      return false;
    }
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
   *    - Deletes any `expenses` documents linked to this transaction refNumber or accountId.
   * 4. Deletes the `accounts` document.
   * 5. Deletes the core entity document (from `customers`, `couriers`, or `users`).
   * 6. Recalculates and synces balances for all opposite accounts affected by the deletions.
   */
  async purgeEntityAndFinancialFootprint(
    entityType: 'customer' | 'courier' | 'user' | 'employee',
    entityId: string
  ): Promise<void> {
    try {
      // Step 0: Check if entity is linked to any orders in 'orders' collection
      const ordersSnap = await getDocs(collection(db, "orders"));
      const isLinkedToOrders = ordersSnap.docs.some(doc => {
        const o = doc.data();
        if (entityType === 'customer') {
          return o.customerId === entityId || o.customer?.id === entityId;
        } else if (entityType === 'courier') {
          return (
            o.courierId === entityId ||
            o.driverId === entityId ||
            o.courier?.id === entityId ||
            o.deliveryCourierId === entityId ||
            o.delivery_courier_id === entityId ||
            o.shippingCourierId === entityId ||
            o.shipping_courier_id === entityId
          );
        } else if (entityType === 'employee') {
          return o.employeeId === entityId;
        }
        return false;
      });

      if (isLinkedToOrders) {
        const label = entityType === 'customer' ? 'العميل' : (entityType === 'courier' ? 'المندوب' : entityType === 'user' ? 'المستخدم' : 'الموظف');
        throw new Error(`تعذر الحذف: هذا الـ (${label}) مرتبط بطلبات مسجلة في جدول الطلبات. يرجى فك ارتباط الطلبات أو حذفها أولاً والمحاولة مرة أخرى.`);
      }

      const batch = writeBatch(db);
      const affectedAccountIds = new Set<string>();

      // 1. Find the associated financial account
      const accountQuery = query(
        collection(db, "accounts"),
        where("entityId", "==", entityId)
      );
      const accountSnap = await getDocs(accountQuery);
      let accountId = "";

      if (!accountSnap.empty) {
        const accountDoc = accountSnap.docs[0];
        accountId = accountDoc.id;

        // 2. Find all account_trans legs linked to this account
        // استعلام أسطر الحسابات من جدول account_trans الجديد
        const txQuery = query(
          collection(db, "account_trans"),
          where("accountId", "==", accountId)
        );
        const txSnap = await getDocs(txQuery);

        const refNumbers = new Set<string>();
        const journalEntryIds = new Set<string>();

        txSnap.docs.forEach((d) => {
          const tx = d.data();
          const entryId = tx.entryId || tx.journalEntryId;
          if (entryId) {
            journalEntryIds.add(entryId);
          }
          if (tx.refNumber) {
            refNumbers.add(tx.refNumber);
          }
        });


        // 3. Fetch and delete all related transaction double-entry legs
        const allTxDocsToDelete = new Map<string, any>(); // docId -> docRef

        if (journalEntryIds.size > 0) {
          const jvIdsArray = Array.from(journalEntryIds);
          for (const jvId of jvIdsArray) {
            const q = query(collection(db, "account_trans"), where("entryId", "==", jvId));
            const snap = await getDocs(q);
            snap.docs.forEach(docItem => {
              allTxDocsToDelete.set(docItem.id, docItem.ref);
              const txData = docItem.data();
              if (txData.accountId && txData.accountId !== accountId) {
                affectedAccountIds.add(txData.accountId);
              }
            });
            // حذف رأس القيد من main_entry
            batch.delete(doc(db, "main_entry", jvId));
          }
        }

        if (refNumbers.size > 0) {
          const refsArray = Array.from(refNumbers);
          for (const refNo of refsArray) {
            const q = query(collection(db, "account_trans"), where("refNumber", "==", refNo));
            const snap = await getDocs(q);
            snap.docs.forEach(docItem => {
              allTxDocsToDelete.set(docItem.id, docItem.ref);
              const txData = docItem.data();
              if (txData.accountId && txData.accountId !== accountId) {
                affectedAccountIds.add(txData.accountId);
              }
            });

            // Delete associated expenses document if matches refNumber
            const expQ = query(collection(db, "expenses"), where("expenseNumber", "==", refNo));
            const expSnap = await getDocs(expQ);
            expSnap.docs.forEach(d => {
              batch.delete(d.ref);
            });
          }
        }

        // Add direct legs linked to this account
        txSnap.docs.forEach(d => {
          allTxDocsToDelete.set(d.id, d.ref);
        });

        // Delete all collected transaction leg documents using direct refs
        allTxDocsToDelete.forEach(ref => {
          batch.delete(ref);
        });


        // Delete any expenses directly linked to this account ID or entity ID
        const expAccountQ = query(collection(db, "expenses"), where("linkedAccountId", "==", accountId));
        const expAccountSnap = await getDocs(expAccountQ);
        expAccountSnap.docs.forEach(d => {
          batch.delete(d.ref);
        });

        const expFinancialQ = query(collection(db, "expenses"), where("financialAccountId", "==", accountId));
        const expFinancialSnap = await getDocs(expFinancialQ);
        expFinancialSnap.docs.forEach(d => {
          batch.delete(d.ref);
        });

        const expRecipientQ = query(collection(db, "expenses"), where("recipientEntityId", "==", entityId));
        const expRecipientSnap = await getDocs(expRecipientQ);
        expRecipientSnap.docs.forEach(d => {
          batch.delete(d.ref);
        });

        // Delete the main accounts document
        batch.delete(accountDoc.ref);
      }

      // 4. Delete the core entity document
      const collectionName = entityType === 'user' ? 'users' : (entityType === 'employee' ? 'employees' : (entityType === 'courier' ? 'couriers' : 'customers'));
      batch.delete(doc(db, collectionName, entityId));

      // 5. Commit all deletions
      await batch.commit();

      // 6. Recalculate & sync all financial balances system-wide
      await this.recalculateAllBalances();
    } catch (err) {
      console.error(`[purgeEntityAndFinancialFootprint] Purge failed:`, err);
      throw err;
    }
  }
}

export const financialAccountService = new FinancialAccountService();
