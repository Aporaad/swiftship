/**
 * مشغل الوظائف الخلفية الآمن (Job Runner) — Phase 8
 * Safe Background Job Runner — enforces Preconditions, Idempotency, Retry Policy, Audit Logging, and Failure Behavior.
 */

import type {
  BackgroundJobDefinition,
  BackgroundJobContext,
  JobExecutionResult,
  JobOptions,
} from './types';

// ── سجل مفاتيح التكرار المنفذة في الذاكرة ────────────────────────────
// In-memory registry of recently executed idempotency keys (TTL: 1 hour)
const processedKeys = new Map<string, { timestamp: number; result: JobExecutionResult }>();
const inFlightJobs = new Map<string, Promise<JobExecutionResult>>();
const KEY_TTL_MS = 60 * 60 * 1000;

function cleanupExpiredKeys(): void {
  const now = Date.now();
  for (const [key, entry] of processedKeys.entries()) {
    if (now - entry.timestamp > KEY_TTL_MS) {
      processedKeys.delete(key);
    }
  }
}

/**
 * دالة مساعدة للتأخير الزمني.
 * Helper function for sleeping between retries.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * يمنع تكرار تنفيذ العملية بناءً على مفتاح IdempotencyKey.
 * Checks if an idempotency key was already executed.
 */
export function isIdempotencyKeyProcessed(key: string): boolean {
  cleanupExpiredKeys();
  return processedKeys.has(key);
}

/**
 * جلب نتيجة العملية المنفذة سابقاً.
 * Gets previously cached result for an idempotency key.
 */
export function getProcessedKeyResult(key: string): JobExecutionResult | undefined {
  return processedKeys.get(key)?.result;
}

/**
 * يُشغّل أي وظيفة خلفية مع تطبيق كافة معايير المرحلة الثامنة:
 * 1. Preconditions check
 * 2. Idempotency Key check
 * 3. Transaction boundary execution
 * 4. Retry Policy with Exponential Backoff
 * 5. Audit Logging
 * 6. Graceful Failure Behavior
 */
async function executeBackgroundJob<TInput, TOutput>(
  definition: BackgroundJobDefinition<TInput, TOutput>,
  input: TInput,
  context: BackgroundJobContext,
  options?: JobOptions,
): Promise<JobExecutionResult<TOutput>> {
  const startTime = Date.now();
  cleanupExpiredKeys();

  const effectiveOptions: JobOptions = {
    audit: true,
    retryPolicy: {
      maxRetries: 2,
      initialDelayMs: 300,
      backoffFactor: 2,
    },
    ...definition.defaultOptions,
    ...options,
  };

  const { idempotencyKey, jobName } = context;

  // 1. التحقق من التكرار عبر مفتاح IdempotencyKey
  if (isIdempotencyKeyProcessed(idempotencyKey)) {
    const cachedResult = getProcessedKeyResult(idempotencyKey)!;
    console.log(`[JobRunner] Idempotency key '${idempotencyKey}' already processed for job '${jobName}'. Returning cached result.`);
    return cachedResult;
  }

  // 2. التحقق من الشروط المسبقة (Preconditions)
  try {
    const preconditionResult = await definition.preconditions(input, context);
    if (!preconditionResult.valid) {
      const failedResult: JobExecutionResult<TOutput> = {
        success: false,
        error: {
          code: 'PRECONDITION_FAILED',
          message: preconditionResult.reason || 'Job preconditions failed',
        },
        attempts: 0,
        durationMs: Date.now() - startTime,
        idempotencyKey,
      };
      console.warn(`[JobRunner] Job '${jobName}' preconditions failed: ${preconditionResult.reason}`);
      return failedResult;
    }
  } catch (preErr: any) {
    const errorResult: JobExecutionResult<TOutput> = {
      success: false,
      error: {
        code: 'PRECONDITION_ERROR',
        message: preErr.message || 'Error checking preconditions',
      },
      attempts: 0,
      durationMs: Date.now() - startTime,
      idempotencyKey,
    };
    console.error(`[JobRunner] Exception during job '${jobName}' preconditions:`, preErr.message);
    return errorResult;
  }

  // 3. التنفيذ مع سياسة إعادة المحاولة (Retry Policy) والحد المعاملي (Transaction Boundary)
  const maxRetries = effectiveOptions.retryPolicy?.maxRetries ?? 1;
  let currentDelay = effectiveOptions.retryPolicy?.initialDelayMs ?? 200;
  const backoff = effectiveOptions.retryPolicy?.backoffFactor ?? 2;

  let attempt = 0;
  let lastError: any = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`[JobRunner] Executing job '${jobName}' (Attempt ${attempt}/${maxRetries})...`);
      const output = await definition.execute(input, context);

      const successResult: JobExecutionResult<TOutput> = {
        success: true,
        data: output,
        attempts: attempt,
        durationMs: Date.now() - startTime,
        idempotencyKey,
      };

      // حفظ مفتاح IdempotencyKey لمنع التكرار
      processedKeys.set(idempotencyKey, {
        timestamp: Date.now(),
        result: successResult,
      });

      if (effectiveOptions.audit) {
        console.log(`[JobRunner] Job '${jobName}' completed successfully in ${successResult.durationMs}ms [Audit: OK]`);
      }

      return successResult;
    } catch (err: any) {
      lastError = err;
      console.error(`[JobRunner] Job '${jobName}' attempt ${attempt} failed:`, err.message);

      if (attempt < maxRetries) {
        console.log(`[JobRunner] Retrying job '${jobName}' in ${currentDelay}ms...`);
        await sleep(currentDelay);
        currentDelay *= backoff;
      }
    }
  }

  // 4. سلوك الفشل المستقر (Failure Behavior)
  const failureResult: JobExecutionResult<TOutput> = {
    success: false,
    error: {
      code: 'JOB_EXECUTION_FAILED',
      message: lastError?.message || 'Job execution failed after maximum retries',
      details: lastError?.stack,
    },
    attempts: attempt,
    durationMs: Date.now() - startTime,
    idempotencyKey,
  };

  console.error(`[JobRunner] Job '${jobName}' permanently failed after ${attempt} attempt(s).`);

  return failureResult;
}

/**
 * يمنع السباق داخل نفس العملية: الطلب الثاني ينتظر نتيجة التنفيذ الأول.
 * Cross-process durability still belongs to the database transaction/RPC layer.
 */
export async function runBackgroundJob<TInput, TOutput>(
  definition: BackgroundJobDefinition<TInput, TOutput>,
  input: TInput,
  context: BackgroundJobContext,
  options?: JobOptions,
): Promise<JobExecutionResult<TOutput>> {
  const existing = inFlightJobs.get(context.idempotencyKey);
  if (existing) return existing as Promise<JobExecutionResult<TOutput>>;

  const execution = executeBackgroundJob(definition, input, context, options);
  inFlightJobs.set(context.idempotencyKey, execution);
  try {
    return await execution;
  } finally {
    if (inFlightJobs.get(context.idempotencyKey) === execution) {
      inFlightJobs.delete(context.idempotencyKey);
    }
  }
}
