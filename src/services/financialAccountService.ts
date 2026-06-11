/**
 * Financial Account Service
 * خدمة الحسابات المالية المركزية
 * 
 * Manages creation and management of financial sub-accounts
 * for customers (1130-xxxx), couriers (2120-xxxx), employees (2130-xxxx)
 */

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  increment,
  serverTimestamp,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { activityLogService } from './activityLogService';

export type AccountEntityType = 'customer' | 'courier' | 'employee' | 'system';

export interface FinancialAccount {
  id?: string;
  accountCode: string;          // e.g. '1130-0001'
  accountPrefix: string;        // e.g. '1130'
  accountNumber: string;        // e.g. '0001'
  entityType: AccountEntityType;
  entityId: string;             // Firestore document ID of customer/courier/employee
  entityName: string;           // Display name
  currency: string;             // Default currency from settings
  balance: number;              // Current balance in default currency
  debitTotal: number;           // Total debits
  creditTotal: number;          // Total credits
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  notes?: string;
  monthlySalary?: number;       // Default monthly salary (for employees)
}

export interface AccountTransaction {
  id?: string;
  accountId: string;            // Financial account ID
  accountCode: string;          // Account code for display
  entityType: AccountEntityType;
  entityId: string;
  entityName: string;
  type: 'Debit' | 'Credit';
  amount: number;               // Amount in default currency
  amountOriginal: number;       // Amount in original currency
  currencyOriginal: string;     // Original currency (YER, USD, SAR)
  description: string;          // Transaction description
  refNumber: string;            // Reference number (expense/order/adjustment)
  module: 'expense' | 'order' | 'adjustment' | 'custody' | 'payment' | 'salary';
  salaryMonth?: string;         // e.g. '2026-06' for salary payments
  createdAt: number;
  createdByUid?: string;
  createdByName?: string;
}

// Account prefix ranges per entity type
const ACCOUNT_PREFIXES: Record<AccountEntityType, string> = {
  customer: '1130',
  courier: '2120',
  employee: '2130',
  system: '4000'
};

class FinancialAccountService {
  
  /**
   * Generate next sequential account number for a given entity type
   */
  private async getNextAccountNumber(entityType: AccountEntityType): Promise<string> {
    const prefix = ACCOUNT_PREFIXES[entityType];
    const q = query(
      collection(db, 'accounts'),
      where('accountPrefix', '==', prefix)
    );
    const snap = await getDocs(q);
    const nextNum = snap.size + 1;
    return String(nextNum).padStart(4, '0');
  }

  /**
   * Create a new financial account for an entity (customer/courier/employee)
   * Called automatically when creating a new entity
   */
  async createAccountForEntity(
    entityType: AccountEntityType,
    entityId: string,
    entityName: string,
    currency: string,
    monthlySalary?: number
  ): Promise<FinancialAccount> {
    try {
      const prefix = ACCOUNT_PREFIXES[entityType];
      const accountNumber = await this.getNextAccountNumber(entityType);
      const accountCode = `${prefix}-${accountNumber}`;

      const now = Date.now();
      const accountData: FinancialAccount = {
        accountCode,
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
        notes: '',
        ...(monthlySalary !== undefined && { monthlySalary })
      };
      console.log('DEBUG: Creating account in database with currency:', currency);

      const ref = await addDoc(collection(db, 'accounts'), accountData);
      
      // Update the entity's document with the account code reference
      if (entityType !== 'system') {
        try {
          const entityCollection = this.getEntityCollection(entityType);
          const entityUpdateData: any = {
            financialAccountId: ref.id,
            financialAccountCode: accountCode,
            updatedAt: now
          };
          if (monthlySalary !== undefined) {
            entityUpdateData.monthlySalary = monthlySalary;
          }
          await updateDoc(doc(db, entityCollection, entityId), entityUpdateData);
        } catch (e) {
          console.warn('Could not update entity doc with financial id', e);
        }
      }

      activityLogService.log(
        'create_financial_account' as any,
        entityName,
        { accountCode, entityType, entityId }
      );

      return { id: ref.id, ...accountData };
    } catch (error) {
      console.error('[FinancialAccountService] Error creating account:', error);
      throw error;
    }
  }

  /**
   * Get financial account by entity ID
   */
  async getAccountByEntityId(entityId: string): Promise<FinancialAccount | null> {
    try {
      const q = query(
        collection(db, 'accounts'),
        where('entityId', '==', entityId)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docData = snap.docs[0];
      return { id: docData.id, ...docData.data() } as FinancialAccount;
    } catch (error) {
      console.error('[FinancialAccountService] Error fetching account:', error);
      return null;
    }
  }

  /**
   * Get account by account ID directly
   */
  async getAccountById(accountId: string): Promise<FinancialAccount | null> {
    try {
      const docRef = await getDoc(doc(db, 'accounts', accountId));
      if (!docRef.exists()) return null;
      return { id: docRef.id, ...docRef.data() } as FinancialAccount;
    } catch (error) {
      console.error('[FinancialAccountService] Error fetching account by ID:', error);
      return null;
    }
  }

  /**
   * Record a true double-entry transaction (Debit one account, Credit another)
   */
  async recordDoubleEntryTransaction(
    debitAccountId: string,
    creditAccountId: string,
    transactionData: Omit<AccountTransaction, 'id' | 'type'>,
    providedRates?: { USD?: number; SAR?: number; YER?: number }
  ): Promise<void> {
    const batch = writeBatch(db);
    const now = Date.now();
    const exchangeRates = providedRates || (await this.getExchangeRates());

    const debitAccount = await this.getAccountById(debitAccountId);
    const creditAccount = await this.getAccountById(creditAccountId);

    if (!debitAccount || !creditAccount) throw new Error('One or more accounts not found');

    const debitAmount = this.convertToTargetCurrency(transactionData.amountOriginal, transactionData.currencyOriginal, debitAccount.currency, exchangeRates);
    const creditAmount = this.convertToTargetCurrency(transactionData.amountOriginal, transactionData.currencyOriginal, creditAccount.currency, exchangeRates);

    // --- DEBIT LEG ---
    const debitTxRef = doc(collection(db, 'account_transactions'));
    const debitData = { 
      ...transactionData, 
      type: 'Debit', 
      accountId: debitAccountId, 
      entityType: 'system',
      entityId: 'system',
      amount: debitAmount,
      createdAt: now 
    };
    batch.set(debitTxRef, debitData);

    const debitAccountRef = doc(db, 'accounts', debitAccountId);
    batch.update(debitAccountRef, {
      balance: increment(debitAmount),
      debitTotal: increment(debitAmount),
      updatedAt: now
    });

    // --- CREDIT LEG ---
    const creditTxRef = doc(collection(db, 'account_transactions'));
    const creditData = { ...transactionData, type: 'Credit', accountId: creditAccountId, amount: creditAmount, createdAt: now };
    batch.set(creditTxRef, creditData);

    const creditAccountRef = doc(db, 'accounts', creditAccountId);
    batch.update(creditAccountRef, {
      balance: increment(-creditAmount),
      creditTotal: increment(creditAmount),
      updatedAt: now
    });

    await batch.commit();

    activityLogService.log(
      'financial_transaction' as any,
      transactionData.entityName,
      {
        type: 'Double-Entry',
        amount: transactionData.amount,
        currency: transactionData.currencyOriginal,
        description: transactionData.description,
        refNumber: transactionData.refNumber
      }
    );
  }

  /**
   * Record a financial transaction on an account (Debit or Credit)
   * Uses writeBatch to ensure atomicity: updates both account balance and transaction log
   */
  async recordTransaction(
    accountId: string,
    transactionData: Omit<AccountTransaction, 'id'>,
    providedRates?: { USD?: number; SAR?: number; YER?: number }
  ): Promise<void> {
    const batch = writeBatch(db);
    const now = Date.now();
    const exchangeRates = providedRates || (await this.getExchangeRates());

    const account = await this.getAccountById(accountId);
    if (!account) throw new Error('Account not found');
    
    const baseAmount = this.convertToTargetCurrency(
      transactionData.amountOriginal, 
      transactionData.currencyOriginal, 
      account.currency, 
      exchangeRates
    );

    // 1. Create transaction record
    const txRef = doc(collection(db, 'account_transactions'));
    batch.set(txRef, { 
        ...transactionData, 
        amount: baseAmount,
        createdAt: now 
    });

    // 2. Update account balance
    const accountRef = doc(db, 'accounts', accountId);
    const balanceDelta = transactionData.type === 'Debit'
      ? baseAmount
      : -baseAmount;
    
    batch.update(accountRef, {
      balance: increment(balanceDelta),
      debitTotal: transactionData.type === 'Debit' ? increment(baseAmount) : increment(0),
      creditTotal: transactionData.type === 'Credit' ? increment(baseAmount) : increment(0),
      updatedAt: now
    });

    await batch.commit();

    activityLogService.log(
      'financial_transaction' as any,
      transactionData.entityName,
      {
        accountCode: transactionData.accountCode,
        type: transactionData.type,
        amount: baseAmount,
        currency: account.currency, // Store currency of the account
        description: transactionData.description,
        refNumber: transactionData.refNumber
      }
    );
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
    salaryMonth: string;        // Format: 'YYYY-MM'
    notes?: string;
    createdByUid?: string;
    createdByName?: string;
  }): Promise<string> {
    const now = Date.now();
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const voucherCode = `SAL-${params.salaryMonth.replace('-', '')}-${randStr}`;

    // 1. (REMOVED) We no longer record Salary in account_transactions
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
    await addDoc(collection(db, 'salary_history'), {
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      accountId: params.accountId,
      accountCode: params.accountCode,
      amount: params.amount,
      currency: params.currency,
      salaryMonth: params.salaryMonth,
      voucherCode,
      notes: params.notes || '',
      status: 'Paid',
      paidAt: now,
      createdByUid: params.createdByUid || 'system',
      createdByName: params.createdByName || 'Admin',
      createdAt: now
    });

    activityLogService.log(
      'salary_payment' as any,
      params.employeeName,
      {
        salaryMonth: params.salaryMonth,
        amount: params.amount,
        currency: params.currency,
        voucherCode
      }
    );

    return voucherCode;
  }

  /**
   * Get salary history for a specific employee or all
   */
  async getSalaryHistory(employeeId?: string): Promise<any[]> {
    try {
      const q = employeeId 
        ? query(collection(db, 'salary_history'), where('employeeId', '==', employeeId), orderBy('createdAt', 'desc'))
        : query(collection(db, 'salary_history'), orderBy('createdAt', 'desc'));
        
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('[FinancialAccountService] Error fetching salary history:', error);
      return [];
    }
  }

  /**
   * Update monthly salary for an employee account
   */
  async updateMonthlySalary(employeeId: string, monthlySalary: number): Promise<void> {
    try {
      const account = await this.getAccountByEntityId(employeeId);
      if (!account || !account.id) return;
      await updateDoc(doc(db, 'accounts', account.id), {
        monthlySalary,
        updatedAt: Date.now()
      });
      await updateDoc(doc(db, 'users', employeeId), {
        monthlySalary,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('[FinancialAccountService] Error updating monthly salary:', error);
    }
  }

  /**
   * Fetches current exchange rates from settings collection
   */
  async getExchangeRates(): Promise<{ USD: number; SAR: number; YER: number }> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'general'));
      if (snap.exists()) {
        const data = snap.data();
        return {
          USD: data.exchangeRateUSD || 535,
          SAR: data.exchangeRateSAR || 140,
          YER: 1
        };
      }
    } catch (e) {
      console.warn('Could not fetch exchange rates, using defaults', e);
    }
    return { USD: 535, SAR: 140, YER: 1 };
  }

  /**
   * Universal Currency Converter
   * Converts an amount from one currency to another using provided rates.
   */
  convertToTargetCurrency(
    amount: number,
    fromCurrency: string,
    targetCurrency: string,
    exchangeRates: { USD?: number; SAR?: number; YER?: number }
  ): number {
    if (fromCurrency === targetCurrency) return amount;

    // Convert everything to YER as base
    let baseAmountYER = amount;
    if (fromCurrency === 'USD') baseAmountYER = amount * (exchangeRates.USD || 535);
    else if (fromCurrency === 'SAR') baseAmountYER = amount * (exchangeRates.SAR || 140);
    else if (fromCurrency === 'YER') baseAmountYER = amount;

    // Convert from YER to targetCurrency
    if (targetCurrency === 'USD') return baseAmountYER / (exchangeRates.USD || 535);
    if (targetCurrency === 'SAR') return baseAmountYER / (exchangeRates.SAR || 140);
    if (targetCurrency === 'YER') return baseAmountYER;

    return baseAmountYER;
  }

  /**
   * Convert amount to default currency (YER by default or system currency)
   */
  convertToDefaultCurrency(
    amount: number,
    fromCurrency: string,
    defaultCurrency: string,
    exchangeRates: { USD?: number; SAR?: number; [key: string]: number | undefined }
  ): number {
    return this.convertToTargetCurrency(amount, fromCurrency, defaultCurrency, exchangeRates as any);
  }

  /**
   * Get all accounts with optional filtering by entity type
   */
  async getAllAccounts(entityType?: AccountEntityType): Promise<FinancialAccount[]> {
    try {
      let q;
      if (entityType) {
        q = query(
          collection(db, 'accounts'),
          where('entityType', '==', entityType),
          orderBy('accountCode')
        );
      } else {
        q = query(collection(db, 'accounts'), orderBy('accountCode'));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as FinancialAccount));
    } catch (error) {
      console.error('[FinancialAccountService] Error fetching accounts:', error);
      return [];
    }
  }

  /**
   * Update account entity name (when entity is renamed)
   */
  async updateAccountEntityName(entityId: string, newName: string): Promise<void> {
    try {
      const account = await this.getAccountByEntityId(entityId);
      if (!account || !account.id) return;
      await updateDoc(doc(db, 'accounts', account.id), {
        entityName: newName,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('[FinancialAccountService] Error updating account name:', error);
    }
  }

  /**
   * Settle pending custodies for a courier
   */
  async settlePendingCustodies(
    courierId: string,
    amountToSettle: number,
    currency: string
  ): Promise<void> {
    try {
      const exchangeRates = await this.getExchangeRates();
      const q = query(
        collection(db, 'expenses'),
        where('recipientEntityId', '==', courierId),
        where('status', '==', 'Pending')
      );
      const snap = await getDocs(q);

      const pending = snap.docs
        .map(d => ({id: d.id, ...(d.data() as any)}))
        .filter((e: any) => e.type === 'Custody')
        .sort((a: any, b: any) => a.createdAt - b.createdAt);
      
      console.log(`[FinancialAccountService] Found ${snap.size} pending expenses for courier ${courierId}.`);
      console.log(`[FinancialAccountService] Found ${pending.length} pending custodies for courier ${courierId}. Amount to settle: ${amountToSettle} ${currency}`);

      let remainingToSettle = amountToSettle;
      const batch = writeBatch(db);
      let settled = false;

      for (const expense of pending) {
        if (remainingToSettle <= 0) break;

        const expenseCurrency = expense.currency || 'YER';
        const currentRemitted = parseFloat(expense.remittedAmount) || 0;
        const totalAmount = parseFloat(expense.amount) || 0;
        const availableToSettleExpenseCurrency = totalAmount - currentRemitted;
        
        if (availableToSettleExpenseCurrency <= 0) continue;

        // Convert available to settle back to our budget currency for comparison
        const availableToSettleBudgetCurrency = this.convertToTargetCurrency(
            availableToSettleExpenseCurrency,
            expenseCurrency,
            currency,
            exchangeRates
        );

        const settleAmountBudgetCurrency = Math.min(remainingToSettle, availableToSettleBudgetCurrency);
        
        // Convert settle amount to expense currency to update the expense record
        const settleAmountExpenseCurrency = this.convertToTargetCurrency(
            settleAmountBudgetCurrency,
            currency,
            expenseCurrency,
            exchangeRates
        );
        
        const newRemitted = currentRemitted + settleAmountExpenseCurrency;
        const isFullySettled = newRemitted >= totalAmount - 0.01; // Avoid floating point issues

        console.log(`[FinancialAccountService] Settling ${settleAmountBudgetCurrency} ${currency} (${settleAmountExpenseCurrency} ${expenseCurrency}) on expense ${expense.id}. New remitted: ${newRemitted}. Fully settled: ${isFullySettled}`);

        batch.update(doc(db, 'expenses', expense.id), {
          status: isFullySettled ? 'Settled' : 'Pending',
          remittedAmount: newRemitted,
          updatedAt: Date.now()
        });

        remainingToSettle -= settleAmountBudgetCurrency;
        settled = true;
        
        // Log this settlement
        activityLogService.log('settle_custody', expense.id, { amount: settleAmountBudgetCurrency, currency });
      }

      if (settled) {
        await batch.commit();
        console.log(`[FinancialAccountService] Settlement batch committed.`);
      } else {
        console.log(`[FinancialAccountService] No settlements needed.`);
      }

    } catch (error) {
      console.error('[FinancialAccountService] Error settling pending custodies:', error);
      throw error;
    }
  }

  /**
   * Get the Firestore collection name for an entity type
   */
  public getEntityCollection(entityType: AccountEntityType): string {
    switch (entityType) {
      case 'customer': return 'customers';
      case 'courier': return 'couriers';
      case 'employee': return 'users';
      case 'system': return 'system_accounts';
      default: return 'customers';
    }
  }
  /**
   * Ensures essential system accounts exist and returns their IDs
   */
  async ensureSystemAccounts(currency: string = 'SAR'): Promise<Record<string, string>> {
    const sysAccounts = [
      { id: 'sys_profit_account',   name: 'حساب أرباح الشركة',                      prefix: '4000' },
      { id: 'sys_delivery_cost',    name: 'حساب مصروفات التوصيل',                   prefix: '5000' },
      { id: 'sys_sourcing_cost',    name: 'حساب تكاليف الاستيراد التشغيلية',        prefix: '5100' },
      { id: 'sys_packaging_fees',   name: 'حساب رسوم التغليف والتعبئة',            prefix: '5200' },
      { id: 'sys_shipping_costs',   name: 'حساب تكاليف الشحن الدولي',              prefix: '5300' },
      { id: 'sys_cash_account',     name: 'حساب الصندوق العام (كاش)',               prefix: '1000' },
    ];

    const sysIds: Record<string, string> = {};

    for (const acc of sysAccounts) {
      const existing = await this.getAccountByEntityId(acc.id);
      if (existing && existing.id) {
        sysIds[acc.id] = existing.id;
      } else {
        const accountNumber = Math.floor(1000 + Math.random() * 9000).toString();
        const accountData: FinancialAccount = {
          accountCode: `${acc.prefix}-${accountNumber}`,
          accountPrefix: acc.prefix,
          accountNumber: accountNumber,
          entityType: 'system',
          entityId: acc.id,
          entityName: acc.name,
          currency,
          balance: 0,
          debitTotal: 0,
          creditTotal: 0,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        const ref = await addDoc(collection(db, 'accounts'), accountData);
        sysIds[acc.id] = ref.id;
      }
    }
    return sysIds;
  }
}

export const financialAccountService = new FinancialAccountService();
