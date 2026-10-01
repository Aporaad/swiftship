import { describe, expect, it } from 'vitest';
import { buildDownPaymentAllocations, validateOrderPaymentInput } from './orderPaymentDataService';

describe('order payment data service', () => {
  const accounts = [
    { id: 'cash-1', accSubId: '1100-01', name: 'الصندوق' },
    { id: 'bank-1', account_code: '1200-01', acc_name_ar: 'البنك' },
  ];

  it('builds a cash allocation and enriches it with its receiving account', () => {
    expect(buildDownPaymentAllocations({
      paymentMethod: 'Cash',
      amountPaid: '125.5',
      cashAccountId: 'cash-1',
    }, accounts)).toEqual([{
      method: 'cash',
      accountId: 'cash-1',
      amount: 125.5,
      accountCode: '1100-01',
      accountName: 'الصندوق',
    }]);
  });

  it('preserves the cash and bank split for mixed payments', () => {
    expect(buildDownPaymentAllocations({
      paymentMethod: 'Mixed',
      amountPaid: 75,
      cashAmount: 25,
      bankAmount: '50',
      cashAccountId: 'cash-1',
      bankAccountId: 'bank-1',
      bankReference: 'REF-1',
    }, accounts)).toEqual([
      {
        method: 'cash',
        accountId: 'cash-1',
        amount: 25,
        accountCode: '1100-01',
        accountName: 'الصندوق',
      },
      {
        method: 'bank',
        accountId: 'bank-1',
        amount: 50,
        bankReference: 'REF-1',
        accountCode: '1200-01',
        accountName: 'البنك',
      },
    ]);
  });

  it('does not produce allocations for an unsupported method or malformed account row', () => {
    expect(buildDownPaymentAllocations({
      paymentMethod: 'Unsupported',
      amountPaid: 20,
      cashAccountId: 'cash-1',
    }, accounts)).toEqual([]);
    expect(buildDownPaymentAllocations({
      paymentMethod: 'Cash',
      amountPaid: 20,
      cashAccountId: 'cash-1',
    }, [null, 'invalid'])).toEqual([{
      method: 'cash',
      accountId: 'cash-1',
      amount: 20,
      accountCode: '',
      accountName: 'cash-1',
    }]);
  });

  it('validates deferred and mixed payment rules', () => {
    expect(validateOrderPaymentInput({ paymentMethod: 'Deferred', amountPaid: 1 }, 100, true))
      .toContain('الدفع آجل');
    expect(validateOrderPaymentInput({
      paymentMethod: 'Mixed',
      amountPaid: 70,
      cashAmount: 20,
      bankAmount: 40,
      cashAccountId: 'cash-1',
      bankAccountId: 'bank-1',
      bankReference: 'REF-1',
    }, 100, false)).toContain('Split total');
  });
});
