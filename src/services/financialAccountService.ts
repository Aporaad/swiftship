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

export type AccountEntityType = 'customer' | 'courier' | 'employee';

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
  module: 'expense' | 'order' | 'adjustment' | 'custody' | 'payment';
  createdAt: number;
  createdByUid?: string;
  createdByName?: string;
}

// Account prefix ranges per entity type
const ACCOUNT_PREFIXES: Record<AccountEntityType, string> = {
  customer: '1130',
  courier: '2120',
  employee: '2130'
};

class FinancialAccountService {
  
  /**
   * Generate next sequential account number for a given entity type
   * Searches for the highest existing number to prevent duplicates even after deletions
   */
  private async getNextAccountNumber(entityType: AccountEntityType): Promise<string> {
    const prefix = ACCOUNT_PREFIXES[entityType];
    const q = query(
      collection(db, 'accounts'),
      where('accountPrefix', '==', prefix),
      orderBy('accountNumber', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);

    let nextNum = 1;
    if (!snap.empty) {
      const lastNumber = parseInt(snap.docs[0].data().accountNumber || '0');
      nextNum = lastNumber + 1;
    }

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
    currency: string
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
        notes: ''
      };

      const ref = await addDoc(collection(db, 'accounts'), accountData);
      
      // Update the entity's document with the account code reference
      const entityCollection = this.getEntityCollection(entityType);
      await updateDoc(doc(db, entityCollection, entityId), {
        financialAccountId: ref.id,
        financialAccountCode: accountCode,
        financialBalance: 0,
        financialCurrency: currency,
        updatedAt: now
      });

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
   * Record a financial transaction on an account (Debit or Credit)
   * Uses writeBatch to ensure atomicity: updates both account balance and transaction log
   */
  async recordTransaction(
    accountId: string,
    transactionData: Omit<AccountTransaction, 'id'>
  ): Promise<void> {
    const batch = writeBatch(db);
    const now = Date.now();

    const accountRef = doc(db, 'accounts', accountId);
    const balanceDelta = transactionData.type === 'Debit'
      ? transactionData.amount
      : -transactionData.amount;
    
    // Fetch current balance to calculate balanceAfter
    const accountSnap = await getDoc(accountRef);
    const currentBalance = accountSnap.exists() ? (accountSnap.data().balance || 0) : 0;
    const balanceAfter = currentBalance + balanceDelta;

    // 1. Create transaction record with balanceAfter
    const txRef = doc(collection(db, 'account_transactions'));
    batch.set(txRef, { ...transactionData, balanceAfter, createdAt: now });

    // 2. Update account balance
    batch.update(accountRef, {
      balance: increment(balanceDelta),
      debitTotal: transactionData.type === 'Debit' ? increment(transactionData.amount) : increment(0),
      creditTotal: transactionData.type === 'Credit' ? increment(transactionData.amount) : increment(0),
      updatedAt: now
    });

    // 3. Update the entity's financial balance directly
    const entityCollection = this.getEntityCollection(transactionData.entityType);
    const entityRef = doc(db, entityCollection, transactionData.entityId);

    const entityUpdate: any = {
      financialBalance: increment(balanceDelta),
      updatedAt: now
    };

    // Also sync walletBalance for couriers for backward compatibility in some views
    if (transactionData.entityType === 'courier') {
      entityUpdate.walletBalance = increment(balanceDelta);
    }

    batch.update(entityRef, entityUpdate);

    await batch.commit();

    activityLogService.log(
      'financial_transaction' as any,
      transactionData.entityName,
      {
        accountCode: transactionData.accountCode,
        type: transactionData.type,
        amount: transactionData.amount,
        currency: transactionData.currencyOriginal,
        description: transactionData.description,
        refNumber: transactionData.refNumber
      }
    );
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
    if (fromCurrency === defaultCurrency) return amount;

    // Convert to YER first as base
    let amtInYER = amount;
    if (fromCurrency === 'USD') amtInYER = amount * (exchangeRates.USD || 535);
    else if (fromCurrency === 'SAR') amtInYER = amount * (exchangeRates.SAR || 140);

    // Then convert from YER to defaultCurrency if needed
    if (defaultCurrency === 'USD') return amtInYER / (exchangeRates.USD || 535);
    if (defaultCurrency === 'SAR') return amtInYER / (exchangeRates.SAR || 140);

    return amtInYER;
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
   * Get the Firestore collection name for an entity type
   */
  private getEntityCollection(entityType: AccountEntityType): string {
    switch (entityType) {
      case 'customer': return 'customers';
      case 'courier': return 'couriers';
      case 'employee': return 'users';
      default: return 'customers';
    }
  }
}

export const financialAccountService = new FinancialAccountService();
