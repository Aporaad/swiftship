import { describe, expect, it } from 'vitest';
import { ApplicationError, asyncState, createPaginationMeta, errorDetailsFromUnknown, runMutation, runQuery } from './ui.contracts';

describe('shared UI contracts', () => {
  it('clamps pagination and computes total pages safely', () => {
    expect(createPaginationMeta(0, 25, 51)).toEqual({ page: 1, pageSize: 25, totalItems: 51, totalPages: 3 });
    expect(createPaginationMeta(99, 25, 51).page).toBe(3);
    expect(createPaginationMeta(1, 0, -1)).toEqual({ page: 1, pageSize: 1, totalItems: 0, totalPages: 1 });
  });

  it('normalizes unknown errors into a stable error contract', () => {
    expect(errorDetailsFromUnknown(new Error('failed'), 'ORDER_LOAD_FAILED')).toEqual({ code: 'ORDER_LOAD_FAILED', message: 'failed' });
    expect(errorDetailsFromUnknown('failed')).toEqual({ code: 'UNKNOWN_ERROR', message: 'failed' });
    expect(errorDetailsFromUnknown({ reason: 'failed' })).toEqual({ code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred.' });
  });

  it('preserves the canonical error envelope and request correlation id', () => {
    const envelope = { success: false as const, error: { code: 'ORDER_STATUS_INVALID', message: 'Invalid transition', details: [], requestId: 'req-1' } };
    expect(errorDetailsFromUnknown(envelope)).toEqual(envelope.error);
    const error = new ApplicationError(envelope.error);
    expect(error.toEnvelope()).toEqual(envelope);
  });

  it('keeps query and mutation states distinct without retaining stale data', () => {
    expect(asyncState.idle()).toEqual({ status: 'idle' });
    expect(asyncState.loading()).toEqual({ status: 'loading' });
    expect(asyncState.success(['fresh'])).toEqual({ status: 'success', data: ['fresh'] });
    expect(asyncState.empty()).toEqual({ status: 'empty' });
    expect(asyncState.error(new Error('failed'), 'QUERY_FAILED')).toEqual({
      status: 'error', error: { code: 'QUERY_FAILED', message: 'failed' },
    });
    expect(asyncState.submitting()).toEqual({ status: 'submitting' });
    expect(asyncState.mutationSucceeded()).toEqual({ status: 'success-after-mutation' });
  });

  it('runs query transitions through loading, empty, success, and error states', async () => {
    const states: string[] = [];
    const onState = (state: { status: string }) => states.push(state.status);

    await expect(runQuery(async () => [], onState)).resolves.toEqual({ status: 'empty' });
    await expect(runQuery(async () => ['current'], onState)).resolves.toEqual({ status: 'success', data: ['current'] });
    await expect(runQuery(async () => { throw new Error('unavailable'); }, onState)).resolves.toEqual({
      status: 'error', error: { code: 'UNKNOWN_ERROR', message: 'unavailable' },
    });
    expect(states).toEqual(['loading', 'empty', 'loading', 'success', 'loading', 'error']);
  });

  it('runs mutation transitions through submitting and success/error states', async () => {
    const states: string[] = [];
    const onState = (state: { status: string }) => states.push(state.status);

    await expect(runMutation(async () => ({ id: 'created' }), onState)).resolves.toEqual({
      status: 'success-after-mutation', data: { id: 'created' },
    });
    await expect(runMutation(async () => { throw new Error('rejected'); }, onState)).resolves.toEqual({
      status: 'error', error: { code: 'UNKNOWN_ERROR', message: 'rejected' },
    });
    expect(states).toEqual(['submitting', 'success-after-mutation', 'submitting', 'error']);
  });
});
