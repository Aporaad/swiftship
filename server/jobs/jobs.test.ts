import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBackgroundJob, isIdempotencyKeyProcessed } from './job-runner';
import type { BackgroundJobDefinition, BackgroundJobContext } from './types';
import { accountReconciliationJob } from './account-reconciliation';
import { trackingSyncJob } from './tracking-sync';
import { custodySettlementJob } from './custody-settlement';

describe('Phase 8 — Background Jobs & JobRunner Framework', () => {
  const dummyContext: BackgroundJobContext = {
    jobName: 'test_job',
    trigger: 'manual',
    idempotencyKey: 'test_key_100',
  };

  it('should validate job preconditions before execution', async () => {
    const mockExecute = vi.fn();
    const testJob: BackgroundJobDefinition<{ id: string }, string> = {
      name: 'precondition_test',
      preconditions: async (input) => {
        if (!input.id) return { valid: false, reason: 'ID missing' };
        return { valid: true };
      },
      execute: mockExecute,
    };

    const result = await runBackgroundJob(testJob, { id: '' }, { ...dummyContext, idempotencyKey: 'key_pre_1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PRECONDITION_FAILED');
    expect(result.error?.message).toContain('ID missing');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should enforce idempotency key and return cached result on duplicate executions', async () => {
    let callCount = 0;
    const testJob: BackgroundJobDefinition<{ val: number }, number> = {
      name: 'idempotency_test',
      preconditions: async () => ({ valid: true }),
      execute: async (input) => {
        callCount++;
        return input.val * 2;
      },
    };

    const key = `idem_key_${Date.now()}_${Math.random()}`;

    const res1 = await runBackgroundJob(testJob, { val: 5 }, { ...dummyContext, idempotencyKey: key });
    expect(res1.success).toBe(true);
    expect(res1.data).toBe(10);
    expect(callCount).toBe(1);
    expect(isIdempotencyKeyProcessed(key)).toBe(true);

    // Call again with same idempotency key
    const res2 = await runBackgroundJob(testJob, { val: 5 }, { ...dummyContext, idempotencyKey: key });
    expect(res2.success).toBe(true);
    expect(res2.data).toBe(10);
    expect(callCount).toBe(1); // Not called again!
  });

  it('should coalesce concurrent executions that share an idempotency key', async () => {
    let callCount = 0;
    const testJob: BackgroundJobDefinition<{ val: number }, number> = {
      name: 'concurrent_idempotency_test',
      preconditions: async () => ({ valid: true }),
      execute: async (input) => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return input.val * 3;
      },
    };
    const key = `concurrent_key_${Date.now()}_${Math.random()}`;
    const [first, second] = await Promise.all([
      runBackgroundJob(testJob, { val: 4 }, { ...dummyContext, idempotencyKey: key }),
      runBackgroundJob(testJob, { val: 4 }, { ...dummyContext, idempotencyKey: key }),
    ]);
    expect(first.data).toBe(12);
    expect(second.data).toBe(12);
    expect(callCount).toBe(1);
  });

  it('should retry execution upon failure up to maxRetries', async () => {
    let attempts = 0;
    const testJob: BackgroundJobDefinition<{}, string> = {
      name: 'retry_test',
      preconditions: async () => ({ valid: true }),
      execute: async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient error');
        }
        return 'success';
      },
      defaultOptions: {
        retryPolicy: { maxRetries: 3, initialDelayMs: 10, backoffFactor: 1 },
      },
    };

    const key = `retry_key_${Date.now()}`;
    const result = await runBackgroundJob(testJob, {}, { ...dummyContext, idempotencyKey: key });

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(3);
  });

  it('should handle permanent failures gracefully without crashing', async () => {
    const testJob: BackgroundJobDefinition<{}, string> = {
      name: 'fail_test',
      preconditions: async () => ({ valid: true }),
      execute: async () => {
        throw new Error('Fatal database failure');
      },
      defaultOptions: {
        retryPolicy: { maxRetries: 2, initialDelayMs: 10, backoffFactor: 1 },
      },
    };

    const key = `fail_key_${Date.now()}`;
    const result = await runBackgroundJob(testJob, {}, { ...dummyContext, idempotencyKey: key });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('JOB_EXECUTION_FAILED');
    expect(result.error?.message).toContain('Fatal database failure');
    expect(result.attempts).toBe(2);
  });

  it('should validate accountReconciliationJob preconditions', async () => {
    const check = await accountReconciliationJob.preconditions({ accountId: '' }, dummyContext);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('Account ID is required');
  });

  it('should validate custodySettlementJob preconditions', async () => {
    const check1 = await custodySettlementJob.preconditions(
      { courierAccountId: '', transactionId: 'tx1', settlementAmount: 100 },
      dummyContext,
    );
    expect(check1.valid).toBe(false);

    const check2 = await custodySettlementJob.preconditions(
      { courierAccountId: 'acc1', transactionId: 'tx1', settlementAmount: -50 },
      dummyContext,
    );
    expect(check2.valid).toBe(false);
    expect(check2.reason).toContain('positive number');
  });
});
