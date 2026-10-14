import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  readAllFinanceRows: vi.fn(),
}));

vi.mock('./financeApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./financeApi')>();
  return {
    ...actual,
    readAllFinanceRows: mocks.readAllFinanceRows,
    financeApiClient: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.delete },
  };
});

import {
  accountNumberFromCode,
  createFinancialAccount,
  deactivateFinancialAccount,
  deleteFinancialAccount,
  listAccountMovements,
  updateFinancialAccount,
} from './financialAccountAdmin';

/** صف حساب كما يعيده API — the shape the strict schema stores. */
const accountRow = {
  accountId: 'acc-1101',
  accountCode: '1101',
  accountPrefix: '1100',
  accountNumber: '1101',
  entityType: 'system',
  entityId: null,
  entityName: 'النقدية',
  currency: 'YER',
  balance: 25000,
  isActive: true,
  type: 'Asset',
};

const envelope = <T>(data: T) => ({ success: true, data });

beforeEach(() => {
  vi.clearAllMocks();
});

/** خطأ API يحمل رمز الخادم — mirrors ApiClientError. */
const apiError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('accountNumberFromCode', () => {
  it('takes the last dash segment and tolerates codes without one', () => {
    expect(accountNumberFromCode('1210-0007')).toBe('0007');
    expect(accountNumberFromCode(' 1130-0012 ')).toBe('0012');
    expect(accountNumberFromCode('1101')).toBe('1101');
    expect(accountNumberFromCode('')).toBe('');
  });
});

describe('createFinancialAccount', () => {
  it('posts the explicit account id together with the writable fields', async () => {
    mocks.post.mockResolvedValue(envelope(accountRow));

    const account = await createFinancialAccount('acc-1101', {
      accountCode: '1101',
      accountNumber: '1101',
      accNameAr: 'النقدية',
      entityName: 'النقدية',
      type: 'Asset',
      entityType: 'system',
      isActive: true,
      accountPrefix: '1100',
      balance: 25000,
      currency: 'YER',
    });

    expect(mocks.post).toHaveBeenCalledWith('/api/v1/finance/accounts', expect.objectContaining({
      accountId: 'acc-1101',
      accountCode: '1101',
      accountPrefix: '1100',
    }));
    expect(account.id).toBe('acc-1101');
    expect(account.balance).toBe(25000);
  });

  it('refuses a missing account id without touching the API', async () => {
    await expect(createFinancialAccount('   ', { accountCode: '1101' })).rejects.toThrow('معرّف الحساب مطلوب.');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('throws when the response carries no account id', async () => {
    mocks.post.mockResolvedValue(envelope({ accountCode: '1101' }));
    await expect(createFinancialAccount('acc-1', { accountCode: '1101' }))
      .rejects.toThrow('استجابة غير صالحة من خدمة الحسابات.');
  });
});

describe('updateFinancialAccount', () => {
  it('patches only the provided fields on the encoded path', async () => {
    mocks.patch.mockResolvedValue(envelope({ ...accountRow, entityName: 'الصندوق الرئيسي' }));

    const account = await updateFinancialAccount('acc 1101', { entityName: 'الصندوق الرئيسي' });

    expect(mocks.patch).toHaveBeenCalledWith('/api/v1/finance/accounts/acc%201101', { entityName: 'الصندوق الرئيسي' });
    expect(account.entityName).toBe('الصندوق الرئيسي');
  });

  it('deactivates through the same PATCH contract', async () => {
    mocks.patch.mockResolvedValue(envelope({ ...accountRow, isActive: false }));

    const account = await deactivateFinancialAccount('acc-1101');

    expect(mocks.patch).toHaveBeenCalledWith('/api/v1/finance/accounts/acc-1101', { isActive: false });
    expect(account.isActive).toBe(false);
  });
});

describe('deleteFinancialAccount', () => {
  it('reports success when the API deletes an unused account', async () => {
    mocks.delete.mockResolvedValue(envelope({ accountId: 'acc-1101', deleted: true }));

    await expect(deleteFinancialAccount('acc/1101')).resolves.toEqual({
      status: 'deleted',
      accountId: 'acc/1101',
    });
    expect(mocks.delete).toHaveBeenCalledWith('/api/v1/finance/accounts/acc%2F1101');
  });

  it('maps a ledger-history conflict to in_use instead of throwing', async () => {
    mocks.delete.mockRejectedValue(apiError('FINANCE_ACCOUNT_IN_USE', 'لا يمكن حذف الحساب لوجود 4 حركات.'));

    await expect(deleteFinancialAccount('acc-1101')).resolves.toEqual({
      status: 'in_use',
      accountId: 'acc-1101',
      message: 'لا يمكن حذف الحساب لوجود 4 حركات.',
    });
  });

  it('maps a missing account to not_found', async () => {
    mocks.delete.mockRejectedValue(apiError('ENTITY_NOT_FOUND', 'الحساب المالي غير موجود.'));

    await expect(deleteFinancialAccount('acc-9')).resolves.toEqual({
      status: 'not_found',
      accountId: 'acc-9',
      message: 'الحساب المالي غير موجود.',
    });
  });

  it('rethrows any other failure so the UI shows the real error', async () => {
    const forbidden = apiError('FORBIDDEN', 'لا تملك صلاحية الحذف.');
    mocks.delete.mockRejectedValue(forbidden);

    await expect(deleteFinancialAccount('acc-1101')).rejects.toBe(forbidden);
  });

  it('refuses a blank id without calling the API', async () => {
    await expect(deleteFinancialAccount('')).rejects.toThrow('معرّف الحساب مطلوب.');
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});

describe('listAccountMovements', () => {
  it('reads posted movements from the account movements path', async () => {
    mocks.readAllFinanceRows.mockResolvedValue([
      { transactionId: 'tr_1', entryNumber: 'JE-1', transType: 'Debit', amount: 500, module: 'orders' },
    ]);

    const movements = await listAccountMovements('acc-1101');

    expect(mocks.readAllFinanceRows).toHaveBeenCalledWith('/api/v1/finance/accounts/acc-1101/movements');
    expect(movements).toHaveLength(1);
    expect(movements[0]?.transType).toBe('Debit');
  });

  it('returns an empty report for an account without an id', async () => {
    await expect(listAccountMovements('')).resolves.toEqual([]);
    expect(mocks.readAllFinanceRows).not.toHaveBeenCalled();
  });
});
