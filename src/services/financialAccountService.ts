import {
  collection, getDocs, query, where, doc, getDoc, writeBatch, increment, setDoc, updateDoc, DocumentReference, Query
} from 'firebase/firestore';
import { db } from '../lib/firebase';

type AccountEntityType = 'customer' | 'courier' | 'employee';

const ACCOUNT_PREFIXES: Record<AccountEntityType, string> = {
  customer: 'CUS',
  courier: 'COU',
  employee: 'EMP'
};

class FinancialAccountService {
  /**
   * Create a new financial account for an entity
   */
  async createAccount(
    entityType: AccountEntityType,
    entityId: string,
    entityName: string
  ): Promise<string> {
    const accountCode = await this.getNextAccountNumber(entityType);
    const prefix = ACCOUNT_PREFIXES[entityType];
    const fullCode = `${prefix}-${accountCode}`;

    const accountRef = doc(collection(db, 'accounts'));
    await setDoc(accountRef, {
      entityType,
      entityId,
      entityName,
      accountCode: fullCode,
      accountPrefix: prefix,
      accountNumber: accountCode,
      balance: 0,
      debitTotal: 0,
      creditTotal: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return fullCode;
  }

  /**
   * Get an account for an entity
   */
  async getAccount(entityType: AccountEntityType, entityId: string) {
    const q = query(
      collection(db, 'accounts'),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

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
   * Convert amount to default currency (YER)
   */
  convertToDefaultCurrency(
    amount: number,
    fromCurrency: string,
    defaultCurrency: string,
    exchangeRates: { USD: number; SAR: number }
  ): number {
    if (fromCurrency === defaultCurrency) return amount;
    if (fromCurrency === 'USD') return amount * exchangeRates.USD;
    if (fromCurrency === 'SAR') return amount * exchangeRates.SAR;
    return amount;
  }

  /**
   * Record a transaction for an account
   * Supports both debit and credit entries
   */
  async recordTransaction(
    accountId: string,
    transactionData: {
      entityType: AccountEntityType;
      entityId: string;
      entityName: string;
      accountCode: string;
      type: 'Debit' | 'Credit';
      amount: number;
      amountOriginal: number;
      currencyOriginal: string;
      description: string;
      refNumber: string;
      module: string;
      createdByUid: string;
      createdByName: string;
      createdAt?: number;
    }
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
  }

  /**
   * Get all transactions for an account
   */
  async getAccountTransactions(accountId: string) {
    const q = query(
      collection(db, 'account_transactions'),
      where('accountId', '==', accountId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get entity collection name based on entity type
   */
  private getEntityCollection(entityType: AccountEntityType): string {
    return entityType === 'courier' ? 'couriers' : entityType === 'customer' ? 'customers' : 'users';
  }
}

export const financialAccountService = new FinancialAccountService();
