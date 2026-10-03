import { describe, expect, it } from 'vitest';
import { computeAccountBalance, isTransactionPostable } from './useAccountBalances';

describe('account balance calculations', () => {
  it('uses the normal debit/credit side for each account type', () => {
    expect(computeAccountBalance(100, 35, 'Asset')).toBe(65);
    expect(computeAccountBalance(100, 35, 'Expense')).toBe(65);
    expect(computeAccountBalance(100, 35, 'Liability')).toBe(-65);
    expect(computeAccountBalance(100, 35, 'Equity')).toBe(-65);
    expect(computeAccountBalance(100, 35, 'Revenue')).toBe(-65);
  });

  it('includes unlinked historical transactions and posted entries only', () => {
    const entries = new Map([
      ['posted-id', { postingStatus: 'posted' }],
      ['draft-id', { posting_status: 'draft' }],
    ]);

    expect(isTransactionPostable({ accountId: 'a1' }, entries)).toBe(true);
    expect(isTransactionPostable({ entryId: 'posted-id' }, entries)).toBe(true);
    expect(isTransactionPostable({ entry_id: 'draft-id' }, entries)).toBe(false);
    expect(isTransactionPostable({ entryId: 'missing-id' }, entries)).toBe(false);
  });
});
