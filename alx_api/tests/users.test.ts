import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { AuthUseCases } from '../src/modules/auth/auth.contracts';
import type { UsersRepository } from '../src/modules/users/users.contracts';

const environment = parseEnvironment({ NODE_ENV: 'test', CORS_ORIGINS: 'https://portal.example.test' });

const auth = (permissions: string[]): jest.Mocked<AuthUseCases> => ({
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  authenticateAccessToken: jest.fn().mockResolvedValue({ userId: 'u1', sessionId: 's1', role: 'admin' }),
  listSessions: jest.fn(),
  revokeSession: jest.fn(),
  logoutAll: jest.fn(),
  changePassword: jest.fn(),
  adminResetPassword: jest.fn(),
  requestPasswordReset: jest.fn(),
  completePasswordReset: jest.fn(),
  listPermissions: jest.fn().mockResolvedValue(permissions),
});

const repository: jest.Mocked<UsersRepository> = {
  listUsers: jest.fn().mockResolvedValue({ items: [{ userId: 'u1', username: 'admin' }], total: 1 }),
  getUser: jest.fn().mockResolvedValue({ userId: 'u1', username: 'admin' }),
  createUser: jest.fn().mockResolvedValue({ userId: 'u2', username: 'user2' }),
  updateUser: jest.fn().mockResolvedValue({ userId: 'u1', username: 'admin_updated' }),
  // حذف ناعم: تعطيل المستخدم بدلاً من حذفه
  deleteUser: jest.fn().mockResolvedValue(true),
  listUserRoles: jest.fn().mockResolvedValue(['admin']),
  setUserRoles: jest.fn().mockResolvedValue(['admin', 'finance']),
};

describe('Users HTTP API Boundaries', () => {
  it('denies access without view_users permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth([]), users: repository }))
      .get('/api/v1/users')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(403);
  });

  it('lists users with view_users permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['view_users']), users: repository }))
      .get('/api/v1/users')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(200);
    expect(response.body.data[0].userId).toBe('u1');
  });

  it('creates user with add_users permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['add_users']), users: repository }))
      .post('/api/v1/users')
      .set('Authorization', 'Bearer token')
      .send({ username: 'user2', email: 'user2@example.com' });
    expect(response.status).toBe(200);
    expect(repository.createUser).toHaveBeenCalled();
  });

  it('manages user roles with manage_user_roles permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['manage_user_roles']), users: repository }))
      .post('/api/v1/users/u1/roles')
      .set('Authorization', 'Bearer token')
      .send({ roles: ['admin', 'finance'] });
    expect(response.status).toBe(200);
    expect(repository.setUserRoles).toHaveBeenCalledWith('u1', ['admin', 'finance'], 'u1');
  });

  it('denies admin password reset without reset_passwords permission', async () => {
    const authUseCases = auth([]);
    const response = await request(createApiApp({ environment, auth: authUseCases, users: repository }))
      .post('/api/v1/users/u2/password')
      .set('Authorization', 'Bearer token')
      .send({ newPassword: 'CorrectHorseBatteryStaple!' });
    expect(response.status).toBe(403);
    expect(authUseCases.adminResetPassword).not.toHaveBeenCalled();
  });

  it('allows admin password reset with reset_passwords permission', async () => {
    const authUseCases = auth(['reset_passwords']);
    const response = await request(createApiApp({ environment, auth: authUseCases, users: repository }))
      .post('/api/v1/users/u2/password')
      .set('Authorization', 'Bearer token')
      .send({ newPassword: 'CorrectHorseBatteryStaple!' });
    expect(response.status).toBe(200);
    expect(authUseCases.adminResetPassword).toHaveBeenCalledWith({
      targetUserId: 'u2',
      newPassword: 'CorrectHorseBatteryStaple!',
      actorUserId: 'u1',
    });
  });

  it('disables user (soft delete) with delete_users permission', async () => {
    // اختبار تعطيل مستخدم آخر (ليس النفس) - Soft delete of another user
    const response = await request(createApiApp({ environment, auth: auth(['delete_users']), users: repository }))
      .delete('/api/v1/users/u2')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(200);
    expect(response.body.data.disabled).toBe(true);
    expect(repository.deleteUser).toHaveBeenCalledWith('u2', 'u1');
  });

  it('denies self-deletion via delete endpoint', async () => {
    // حماية: لا يجوز للمستخدم تعطيل نفسه
    const response = await request(createApiApp({ environment, auth: auth(['delete_users']), users: repository }))
      .delete('/api/v1/users/u1')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CANNOT_DELETE_SELF');
  });
});
