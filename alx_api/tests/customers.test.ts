import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { AuthUseCases } from '../src/modules/auth/auth.contracts';
import type { CustomerRepository } from '../src/modules/customers/customers.contracts';

const environment = parseEnvironment({ NODE_ENV: 'test', CORS_ORIGINS: 'https://portal.example.test' });
const auth = (): jest.Mocked<AuthUseCases> => ({
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  authenticateAccessToken: jest.fn().mockResolvedValue({ userId: 'u1', sessionId: 's1', role: 'admin' }),
  listSessions: jest.fn(),
  revokeSession: jest.fn(),
  logoutAll: jest.fn(),
  changePassword: jest.fn(),
  requestPasswordReset: jest.fn(),
  completePasswordReset: jest.fn(),
  listPermissions: jest.fn().mockResolvedValue(['view_customers']),
});
const adminAuth = (): jest.Mocked<AuthUseCases> => ({
  ...auth(),
  listPermissions: jest.fn().mockResolvedValue([
    'view_customers',
    'add_customers',
    'edit_customers',
    'delete_customers',
  ]),
});
const repository: CustomerRepository = {
  list: jest.fn().mockResolvedValue({
    items: [
      {
        customerId: 'c1',
        accountId: null,
        isActive: true,
        joinBy: null,
        referrerId: null,
        fullName: 'Test',
        nameAr: null,
        nameEn: 'Test',
        customerLevel: null,
        createdAt: null,
        updatedAt: null,
        acquisitionSource: null,
        preferredCategories: null,
        location: null,
        address: null,
        onboardingCompleted: null,
      },
    ],
    total: 1,
  }),
  findById: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue(null),
  archive: jest.fn().mockResolvedValue(null),
};

describe('Customers HTTP boundary', () => {
  it('requires authentication', async () => {
    const response = await request(createApiApp({ environment, auth: auth(), customers: repository })).get(
      '/api/v1/customers',
    );
    expect(response.status).toBe(401);
  });
  it('lists customers with the declared permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth(), customers: repository }))
      .get('/api/v1/customers?limit=10')
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(200);
    expect(response.body.data[0].customerId).toBe('c1');
    expect(response.body.meta.total).toBe(1);
  });
  it('returns 404 without revealing database details', async () => {
    const response = await request(createApiApp({ environment, auth: auth(), customers: repository }))
      .get('/api/v1/customers/missing')
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_NOT_FOUND');
  });

  it('rejects customer creation without add_customers permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth(), customers: repository }))
      .post('/api/v1/customers')
      .set('Authorization', 'Bearer valid-token')
      .send({ fullName: 'Forbidden' });
    expect(response.status).toBe(403);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('allows customer creation with add_customers permission and forwards actor identity', async () => {
    const created = { customerId: 'c2' } as never;
    (repository.create as jest.Mock).mockResolvedValueOnce(created);
    const response = await request(createApiApp({ environment, auth: adminAuth(), customers: repository }))
      .post('/api/v1/customers')
      .set('Authorization', 'Bearer valid-token')
      .send({ customerId: 'c2', fullName: 'Allowed' });
    expect(response.status).toBe(200);
    expect(repository.create).toHaveBeenCalledWith({ customerId: 'c2', fullName: 'Allowed' }, 'u1');
  });

  it('rejects archive without delete_customers permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth(), customers: repository }))
      .delete('/api/v1/customers/c1')
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(403);
    expect(repository.archive).not.toHaveBeenCalled();
  });
});
