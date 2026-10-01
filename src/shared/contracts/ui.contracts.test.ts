import { describe, expect, it } from 'vitest';
import { createPaginationMeta, errorDetailsFromUnknown } from './ui.contracts';

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
});
