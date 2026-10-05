import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { AuthUseCases } from '../src/modules/auth/auth.contracts';
import type { FinanceRepository } from '../src/modules/finance/finance.contracts';

const environment = parseEnvironment({ NODE_ENV: 'test', CORS_ORIGINS: 'https://portal.example.test' });
const auth = (permissions: string[]): jest.Mocked<AuthUseCases> => ({
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  authenticateAccessToken: jest.fn().mockResolvedValue({ userId: 'u1', sessionId: 's1', role: 'accountant' }),
  listSessions: jest.fn(),
  revokeSession: jest.fn(),
  logoutAll: jest.fn(),
  changePassword: jest.fn(),
  adminResetPassword: jest.fn(),
  requestPasswordReset: jest.fn(),
  completePasswordReset: jest.fn(),
  listPermissions: jest.fn().mockResolvedValue(permissions),
});
const repository: FinanceRepository = {
  listAccounts: jest.fn().mockResolvedValue({ items: [{ accountId: 'a1', accountCode: '1110' }], total: 1 }),
  getAccount: jest.fn().mockResolvedValue({ accountId: 'a1' }),
  listAccountMovements: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  listAllAccountMovements: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  listEntryModules: jest.fn().mockResolvedValue([{ moduleId: 'module_accounting' }]),
  listEntryTypes: jest.fn().mockResolvedValue([{ entryTypeId: 'type_adjustment' }]),
  listEntries: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  getEntry: jest.fn().mockResolvedValue(null),
  createEntry: jest.fn().mockResolvedValue({ entryId: 'e1', postingStatus: 'draft' }),
  postEntry: jest.fn(),
  reverseEntry: jest.fn(),
  voidDraft: jest.fn(),
  listAutoEntryRules: jest.fn().mockResolvedValue({ items: [{ autoEntryId: 'order_charge' }], total: 1 }),
  getAutoEntryRule: jest.fn().mockResolvedValue(null),
  createAutoEntryRule: jest.fn(),
  updateAutoEntryRule: jest.fn(),
  deleteAutoEntryRule: jest.fn(),
  listCustodyAdvances: jest.fn().mockResolvedValue({ items: [], total: 0 }),
};
const balancedEntry = {
  entryNumber: 'JE-0001',
  moduleId: 'module_accounting',
  entryTypeId: 'type_adjustment',
  entryCategory: 'General',
  postingStatus: 'draft',
  description: 'تسوية اختبار',
  lines: [
    { accountId: 'a1', accountCurNo: 1, transType: 'Debit', amount: 100, amountOriginal: 100, currencyOriginalNo: 1 },
    { accountId: 'a2', accountCurNo: 1, transType: 'Credit', amount: 100, amountOriginal: 100, currencyOriginalNo: 1 },
  ],
};

describe('Finance API HTTP boundaries', () => {
  it('denies the account dictionary without finance permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth([]), finance: repository }))
      .get('/api/v1/finance/accounts')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(403);
  });
  it('lists accounts and automatic rules with their dedicated permissions', async () => {
    const app = createApiApp({
      environment,
      auth: auth(['view_financial_accounts', 'view_auto_entries']),
      finance: repository,
    });
    expect(
      (await request(app).get('/api/v1/finance/accounts').set('Authorization', 'Bearer token')).body.data[0].accountId,
    ).toBe('a1');
    expect(
      (await request(app).get('/api/v1/finance/auto-entry-rules').set('Authorization', 'Bearer token')).status,
    ).toBe(200);
  });
  it('rejects an unbalanced entry before repository/RPC execution', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['add_finance']), finance: repository }))
      .post('/api/v1/finance/entries')
      .set('Authorization', 'Bearer token')
      .send({ ...balancedEntry, lines: [{ ...balancedEntry.lines[0], amountOriginal: 101 }, balancedEntry.lines[1]] });
    expect(response.status).toBe(400);
    expect(repository.createEntry).not.toHaveBeenCalled();
  });
  it('accepts a balanced entry and passes the authenticated actor', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['add_finance']), finance: repository }))
      .post('/api/v1/finance/entries')
      .set('Authorization', 'Bearer token')
      .send(balancedEntry);
    expect(response.status).toBe(200);
    expect(repository.createEntry).toHaveBeenCalledWith(expect.objectContaining({ createdByUid: 'u1' }));
  });
});
