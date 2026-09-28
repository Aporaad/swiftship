/**
 * خدمة تسوية عهد المناديب (Custody Settlement Job) — Phase 8
 * Courier Custody Settlement Job — structured background job with Preconditions,
 * Idempotency, Retries, Audit Trail, and Transactional Execution.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  addDoc,
  query,
  where,
} from '../current-db/client';
import type { BackgroundJobDefinition, BackgroundJobContext, JobExecutionResult } from './types';
import { runBackgroundJob } from './job-runner';

export interface CustodySettlementInput {
  courierAccountId: string;
  transactionId: string;
  settlementAmount: number;
  notes?: string;
}

export interface CustodySettlementOutput {
  courierAccountId: string;
  settledAmount: number;
  remainingCustody: number;
  settlementEntryId: string;
}

let dbClientRef: any = null;

export const custodySettlementJob: BackgroundJobDefinition<
  CustodySettlementInput,
  CustodySettlementOutput
> = {
  name: 'custody_settlement',

  // 1. الشروط المسبقة / Preconditions
  preconditions: async (input, _context) => {
    if (!input.courierAccountId || input.courierAccountId.trim() === '') {
      return { valid: false, reason: 'Courier account ID is required for custody settlement' };
    }
    if (!input.transactionId || input.transactionId.trim() === '') {
      return { valid: false, reason: 'Transaction ID is required for custody settlement' };
    }
    if (typeof input.settlementAmount !== 'number' || input.settlementAmount <= 0) {
      return { valid: false, reason: 'Settlement amount must be a positive number' };
    }
    if (!dbClientRef) {
      return { valid: false, reason: 'Database client reference is missing' };
    }
    return { valid: true };
  },

  // 2. الحد المعاملي والتنفيذ الفعلي / Transactional execution boundary
  execute: async (input, context) => {
    const { courierAccountId, transactionId, settlementAmount, notes } = input;

    // جلب ملف الحساب المالي للمندوب / Fetch courier account document
    const accountRef = doc(dbClientRef, 'accounts', courierAccountId);
    const accountSnap = await getDoc(accountRef);

    if (!accountSnap.exists()) {
      throw new Error(`Courier account not found for ID: ${courierAccountId}`);
    }

    const accountData = accountSnap.data();
    const currentBalance = parseFloat(accountData.balance) || 0;

    // تسجيل قيد التسوية في account_trans / Record settlement transaction entry
    const entryData = {
      accountId: courierAccountId,
      transType: 'Credit',
      amount: settlementAmount,
      currencyOriginalNo: accountData.curNo || 'YER',
      notes: notes || `تسوية عهدة مندوب للمقبوض برقم ${transactionId}`,
      createdAt: Date.now(),
      createdByUid: context.actorId || 'system_job',
      settlementTxId: transactionId,
    };

    const entryDocRef = await addDoc('', collection(dbClientRef, 'account_trans'), entryData);

    // تحديث رصيد العهدة الجديد / Update remaining custody balance
    const remainingCustody = Math.max(0, currentBalance - settlementAmount);
    await updateDoc(accountRef, {
      balance: remainingCustody,
      updatedAt: Date.now(),
    });

    // تسجيل سجل تدقيق العملية / Record audit activity log
    await addDoc('', collection(dbClientRef, 'activity_logs'), {
      action: 'custody_settlement_completed',
      entityId: courierAccountId,
      entityType: 'courier_custody',
      details: {
        transactionId,
        settlementAmount,
        remainingCustody,
        settlementEntryId: entryDocRef.id,
      },
      createdAt: Date.now(),
      createdByUid: context.actorId || 'system_job',
    });

    return {
      courierAccountId,
      settledAmount: settlementAmount,
      remainingCustody,
      settlementEntryId: entryDocRef.id,
    };
  },

  defaultOptions: {
    audit: true,
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 250,
      backoffFactor: 2,
    },
  },
};

/**
 * تنفيذ تسوية عهدة المندوب كـ Background Job مع مفتاح IdempotencyKey فريد.
 */
export async function executeCustodySettlement(
  input: CustodySettlementInput,
  dbClient: any,
  actorId?: string,
): Promise<JobExecutionResult<CustodySettlementOutput>> {
  dbClientRef = dbClient;

  const idempotencyKey = `custody_settle_${input.transactionId}`;

  const context: BackgroundJobContext = {
    jobName: 'custody_settlement',
    trigger: 'event',
    idempotencyKey,
    actorId,
  };

  return runBackgroundJob(
    custodySettlementJob,
    input,
    context,
  );
}
