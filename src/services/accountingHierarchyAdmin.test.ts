import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  readAllFinanceRows: vi.fn(),
  createFinancialAccount: vi.fn(),
}));

vi.mock('./financeApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./financeApi')>();
  return {
    ...actual,
    readAllFinanceRows: mocks.readAllFinanceRows,
    financeApiClient: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.delete },
  };
});

vi.mock('./financialAccountAdmin', () => ({
  createFinancialAccount: mocks.createFinancialAccount,
}));

import {
  createDefaultAccount,
  createHierarchyNode,
  deleteDefaultAccount,
  deleteHierarchyNode,
  importAccountingTree,
  listDefaultAccountRecords,
  listHierarchyNodes,
  updateHierarchyNode,
} from './accountingHierarchyAdmin';
import type { ImportKnownNode, ImportedTreeRow } from './accountingTreeFileService';

const HIERARCHY_PATH = '/api/v1/finance/hierarchy';

/** يبني صف استيراد بأقل الحقول المطلوبة — minimal valid import row. */
const importRow = (overrides: Partial<ImportedTreeRow> & { level: ImportedTreeRow['level']; id: string }): ImportedTreeRow => ({
  accountCode: '1',
  accNameAr: 'اسم',
  accNameEn: 'Name',
  parentId: null,
  currency: 'YER',
  curNo: 1,
  isActive: true,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listHierarchyNodes', () => {
  it('reads the kebab-case level path and normalises nodeId into id', async () => {
    mocks.readAllFinanceRows.mockResolvedValue([
      { nodeId: 'tree_1', accountCode: '11', accNameAr: 'أ' },
      { accountCode: ' orphan ' },
    ]);

    const nodes = await listHierarchyNodes('main');

    expect(mocks.readAllFinanceRows).toHaveBeenCalledWith(`${HIERARCHY_PATH}/acc-main`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: 'tree_1', accountCode: '11' });
  });
});

describe('hierarchy node writes', () => {
  it('creates a node with an explicit id and drops undefined fields', async () => {
    await createHierarchyNode('group', '1101', {
      accountCode: '1101',
      accNameAr: 'مجموعة',
      accNameEn: undefined,
      curNo: null,
      isActive: true,
      accSubId: 'tree_sub',
      entityType: null,
      allowsDirectAccounts: true,
    });

    expect(mocks.post).toHaveBeenCalledWith(`${HIERARCHY_PATH}/acc-sub-group`, {
      accountCode: '1101',
      accNameAr: 'مجموعة',
      curNo: null,
      isActive: true,
      accSubId: 'tree_sub',
      entityType: null,
      allowsDirectAccounts: true,
      nodeId: '1101',
    });
  });

  it('patches an existing node on the encoded path', async () => {
    await updateHierarchyNode('sub', 'tree 7', { accountCode: '111', accMainId: 'tree_6' });

    expect(mocks.patch).toHaveBeenCalledWith(`${HIERARCHY_PATH}/acc-sub/tree%207`, {
      accountCode: '111',
      accMainId: 'tree_6',
    });
  });

  it('deletes a node and refuses a blank id', async () => {
    await deleteHierarchyNode('account', '1');
    expect(mocks.delete).toHaveBeenCalledWith(`${HIERARCHY_PATH}/account/1`);
    await expect(deleteHierarchyNode('account', '  ')).rejects.toThrow('معرّف العقدة مطلوب.');
    expect(mocks.delete).toHaveBeenCalledTimes(1);
  });
});

describe('default account records', () => {
  it('keeps inactive bindings visible to the administration screen', async () => {
    mocks.readAllFinanceRows.mockResolvedValue([
      { defaultAccountId: 'dacc_cash', defaultKey: 'sys_cash_account', accountId: 'a1', isActive: true },
      { defaultAccountId: 'dacc_old', defaultKey: 'sys_profit_account', accountId: 'a2', isActive: false },
    ]);

    const records = await listDefaultAccountRecords();

    expect(mocks.readAllFinanceRows).toHaveBeenCalledWith('/api/v1/finance/default-accounts');
    expect(records.map((record) => record.id)).toEqual(['dacc_cash', 'dacc_old']);
  });

  it('creates a binding keyed by its system key', async () => {
    await createDefaultAccount('sys_cash_account', { defaultKey: 'sys_cash_account', accountId: 'a1', curNo: 2, isActive: true });

    expect(mocks.post).toHaveBeenCalledWith('/api/v1/finance/default-accounts', {
      defaultKey: 'sys_cash_account',
      accountId: 'a1',
      curNo: 2,
      isActive: true,
      defaultAccountId: 'sys_cash_account',
    });
  });

  it('deletes a binding and refuses a blank key', async () => {
    await deleteDefaultAccount('dacc_1');
    expect(mocks.delete).toHaveBeenCalledWith('/api/v1/finance/default-accounts/dacc_1');
    await expect(deleteDefaultAccount('')).rejects.toThrow('مفتاح الحساب الافتراضي مطلوب.');
  });
});

describe('importAccountingTree', () => {
  it('sends hierarchy levels in one batch ordered parents-first, then creates posting accounts', async () => {
    mocks.post.mockResolvedValue({ success: true, data: { imported: 2 } });
    const rows: ImportedTreeRow[] = [
      importRow({ level: 'ledger', id: '1101-0003', accountCode: '1101-0003', parentId: 'grp', accountSeq: 3, accSubId: 'sub' }),
      importRow({ level: 'group', id: 'grp', accountCode: '1101', parentId: 'sub' }),
      importRow({ level: 'account', id: 'root', accountCode: '1', accountType: 'Asset' }),
      importRow({ level: 'sub', id: 'sub', accountCode: '11', parentId: 'root' }),
    ];
    const known = new Map<string, ImportKnownNode>();

    const result = await importAccountingTree(rows, known);

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [path, body] = mocks.post.mock.calls[0] as [string, { rows: Array<{ level: string; nodeId: string; payload: Record<string, unknown> }> }];
    expect(path).toBe(`${HIERARCHY_PATH}/import`);
    expect(body.rows.map((row) => row.level)).toEqual(['account', 'accSub', 'accSubGroup']);
    expect(body.rows[1].payload.accMainId).toBe('root');
    expect(result).toEqual({ nodes: 2, accounts: 1 });

    expect(mocks.createFinancialAccount).toHaveBeenCalledWith('1101-0003', expect.objectContaining({
      accountCode: '1101-0003',
      accountPrefix: '1101',
      accountNumber: '0003',
      accountSeq: 3,
      entityName: 'اسم',
      currency: 'YER',
      curNo: 1,
    }));
  });

  it('resolves posting accounts whose parent subgroup is imported in the same file', async () => {
    mocks.post.mockResolvedValue({ success: true, data: { imported: 1 } });
    const rows: ImportedTreeRow[] = [
      importRow({ level: 'sub', id: 'sub-new', accountCode: '11', parentId: null }),
      importRow({ level: 'group', id: 'grp-new', accountCode: '1101', parentId: 'sub-new' }),
      importRow({ level: 'ledger', id: '1101-0007', accountCode: '1101-0007', parentId: 'grp-new' }),
    ];

    await importAccountingTree(rows, new Map());

    const ledgerInput = mocks.createFinancialAccount.mock.calls[0][1];
    expect(ledgerInput).toMatchObject({ groupId: 'grp-new', accSubId: 'sub-new' });
  });

  it('skips the batch call when the file has no hierarchy rows', async () => {
    const rows: ImportedTreeRow[] = [importRow({ level: 'ledger', id: '1101-0001', accountCode: '1101-0001', parentId: 'sub' })];

    const result = await importAccountingTree(rows, new Map([['sub', { id: 'sub', level: 'sub', parentId: null }]]));

    expect(mocks.post).not.toHaveBeenCalled();
    expect(result).toEqual({ nodes: 0, accounts: 1 });
  });

  it('propagates a server rejection instead of reporting a silent success', async () => {
    mocks.post.mockRejectedValue(Object.assign(new Error('بيانات استيراد الشجرة غير صالحة.'), { code: 'INVALID_HIERARCHY_IMPORT' }));

    await expect(importAccountingTree([importRow({ level: 'account', id: '2', accountCode: '2' })], new Map()))
      .rejects.toThrow('بيانات استيراد الشجرة غير صالحة.');
    expect(mocks.createFinancialAccount).not.toHaveBeenCalled();
  });
});
