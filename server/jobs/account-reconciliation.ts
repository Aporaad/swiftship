/**
 * خدمة مطابقة أرصدة الحسابات (Account Reconciliation Job) — Phase 8
 * Account Reconciliation Job — refactored into a structured background job with
 * Preconditions, Idempotency, Retries, Audit Logging, and Controlled Listener debouncing.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from '../current-db/client';
import type { BackgroundJobDefinition, BackgroundJobContext, JobExecutionResult } from './types';
import { runBackgroundJob } from './job-runner';

// ── واجهة المدخلات / Input DTO ─────────────────────────────────────
export interface AccountReconciliationInput {
  accountId: string;
}

// ── واجهة المخرجات / Output DTO ────────────────────────────────────
export interface AccountReconciliationOutput {
  accountId: string;
  accountCode: string;
  entityName: string;
  balance: number;
  debitTotal: number;
  creditTotal: number;
}

/**
 * تعريف وظيفة مطابقة الحساب المحاسبي مع العناصر الأربعة عشر المعتمدة.
 * Background Job definition for Account Reconciliation.
 */
export const accountReconciliationJob: BackgroundJobDefinition<
  AccountReconciliationInput,
  AccountReconciliationOutput
> = {
  name: 'account_reconciliation',

  // 1. الشروط المسبقة / Preconditions
  preconditions: async (input, _context) => {
    if (!input.accountId || input.accountId.trim() === '') {
      return { valid: false, reason: 'Account ID is required for reconciliation' };
    }
    return { valid: true };
  },

  // 2. الحد المعاملي والتنفيذ الفعلي / Transactional execution boundary
  execute: async (input, _context) => {
    const { accountId } = input;

    // جلب كل حركات الحساب / Fetch all ledger transactions for account
    const txsQuery = query(
      collection(dbClientInstance, 'account_trans'),
      where('accountId', '==', accountId),
    );
    const txsSnap = await getDocs(txsQuery);

    let debitTotal = 0;
    let creditTotal = 0;

    txsSnap.forEach((txDoc: any) => {
      const tx = txDoc.data();
      const amt = parseFloat(tx.amount) || 0;
      if (tx.transType === 'Debit') {
        debitTotal += amt;
      } else if (tx.transType === 'Credit') {
        creditTotal += amt;
      }
    });

    // قراءة معلومات الحساب المالي / Read financial account document
    const accountRef = doc(dbClientInstance, 'accounts', accountId);
    const accountSnap = await getDoc(accountRef);

    if (!accountSnap.exists()) {
      throw new Error(`Account document not found for ID: ${accountId}`);
    }

    const accountData = accountSnap.data();
    const prefix = accountData.accountPrefix || '';

    // حسابات الأصول مدين طبيعي / Asset accounts (prefix '1') have natural debit balance
    const isAsset = prefix.startsWith('1');
    const balance = isAsset
      ? (debitTotal - creditTotal)
      : (creditTotal - debitTotal);

    // تحديث السجل المالي بالحساب الإجمالي / Persist calculated ledger balances
    await updateDoc(accountRef, {
      balance,
      debitTotal,
      creditTotal,
      updatedAt: Date.now(),
    });

    return {
      accountId,
      accountCode: accountData.accountCode || '',
      entityName: accountData.entityName || '',
      balance,
      debitTotal,
      creditTotal,
    };
  },

  defaultOptions: {
    audit: true,
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 200,
      backoffFactor: 2,
    },
  },
};

let dbClientInstance: any = null;

/**
 * تشغيل عملية مطابقة حساب فردي كـ Background Job.
 * Executes reconciliation for a single account as a background job.
 */
export async function executeAccountReconciliation(
  accountId: string,
  trigger: 'realtime_listener' | 'manual' | 'cron' = 'manual',
  dbClient?: any,
  actorId?: string,
): Promise<JobExecutionResult<AccountReconciliationOutput>> {
  if (dbClient) {
    dbClientInstance = dbClient;
  }

  // إنشاء مفتاح IdempotencyKey يمنع تكرار نفس الحساب في إطار 2 ثانية
  const timeBucket = Math.floor(Date.now() / 2000);
  const idempotencyKey = `reconcile_${accountId}_${timeBucket}`;

  const context: BackgroundJobContext = {
    jobName: 'account_reconciliation',
    trigger,
    idempotencyKey,
    actorId,
  };

  return runBackgroundJob(
    accountReconciliationJob,
    { accountId },
    context,
  );
}

// ── مؤقت إلغاء الارتداد (Debounce timer map) ──────────────────────
const pendingAccountReconciliations = new Map<string, NodeJS.Timeout>();

/**
 * يبدأ مستمع Realtime المُنظَّم والمُتحكَّم به لمطابقة أرصدة الحسابات.
 * Starts a controlled, debounced Realtime listener for account reconciliation.
 */
export function startAccountReconciliationListener(db: any): () => void {
  dbClientInstance = db;
  console.log('[Reconciliation] Starting controlled account_trans Realtime listener...');

  const unsubscribe = onSnapshot(collection(db, 'account_trans'), (snapshot: any) => {
    const changes = snapshot.docChanges();
    if (changes.length === 0) return;

    // جمع معرفات الحسابات المتأثرة / Collect affected account IDs
    const affectedAccountIds = new Set<string>();
    for (const change of changes) {
      const data = change.doc.data();
      if (data?.accountId) {
        affectedAccountIds.add(data.accountId);
      }
    }

    // تطبيق إلغاء الارتداد (Debounce) لكل حساب لمدة 500 ملي ثانية
    for (const accountId of affectedAccountIds) {
      if (pendingAccountReconciliations.has(accountId)) {
        clearTimeout(pendingAccountReconciliations.get(accountId)!);
      }

      const timer = setTimeout(async () => {
        pendingAccountReconciliations.delete(accountId);
        try {
          const result = await executeAccountReconciliation(accountId, 'realtime_listener', db);
          if (!result.success) {
            console.error(`[Reconciliation] Account '${accountId}' failed after retries:`, result.error?.code);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown reconciliation failure';
          console.error(`[Reconciliation] Account '${accountId}' listener error:`, message);
        }
      }, 500);

      pendingAccountReconciliations.set(accountId, timer);
    }
  });

  return unsubscribe;
}
