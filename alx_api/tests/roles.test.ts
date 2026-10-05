import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { AuthUseCases } from '../src/modules/auth/auth.contracts';
import type { RolesRepository } from '../src/modules/roles/roles.contracts';

const environment = parseEnvironment({ NODE_ENV: 'test', CORS_ORIGINS: 'https://portal.example.test' });
const auth = (permissions: string[]): jest.Mocked<AuthUseCases> => ({
  login: jest.fn(), refresh: jest.fn(), logout: jest.fn(),
  authenticateAccessToken: jest.fn().mockResolvedValue({ userId: 'u1', sessionId: 's1', role: 'admin' }),
  listSessions: jest.fn(), revokeSession: jest.fn(), logoutAll: jest.fn(), changePassword: jest.fn(),
  requestPasswordReset: jest.fn(), completePasswordReset: jest.fn(), listPermissions: jest.fn().mockResolvedValue(permissions),
});
const role = { roleId: 'role-1', code: 'warehouse', name: 'Warehouse', description: null, isSystemRole: false, permissions: ['view_orders'], createdAt: new Date(), updatedAt: new Date() };
const repository: jest.Mocked<RolesRepository> = {
  listRoles: jest.fn().mockResolvedValue({ items: [role], total: 1 }),
  listPermissions: jest.fn().mockResolvedValue([{ code: 'view_orders', resource: 'orders', action: 'view', description: null }]),
  createRole: jest.fn().mockResolvedValue(role),
  updateRole: jest.fn().mockResolvedValue(role),
  deleteRole: jest.fn().mockResolvedValue(true),
};

describe('Roles HTTP API boundaries', () => {
  it('denies role listing without permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth([]), roles: repository }))
      .get('/api/v1/roles').set('Authorization', 'Bearer token');
    expect(response.status).toBe(403);
  });
  it('lists roles with view_roles permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['view_roles']), roles: repository }))
      .get('/api/v1/roles').set('Authorization', 'Bearer token');
    expect(response.status).toBe(200);
    expect(response.body.data[0].code).toBe('warehouse');
  });
  it('creates and updates roles only with dedicated permissions', async () => {
    const app = createApiApp({ environment, auth: auth(['add_roles', 'edit_roles']), roles: repository });
    const created = await request(app).post('/api/v1/roles').set('Authorization', 'Bearer token')
      .send({ code: 'warehouse', name: 'Warehouse', permissionCodes: ['view_orders'] });
    expect(created.status).toBe(200);
    expect(repository.createRole).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u1' }));
    const updated = await request(app).patch('/api/v1/roles/role-1').set('Authorization', 'Bearer token')
      .send({ name: 'Warehouse 2', permissionCodes: ['view_orders'] });
    expect(updated.status).toBe(200);
    expect(repository.updateRole).toHaveBeenCalledWith(expect.objectContaining({ roleId: 'role-1', actorId: 'u1' }));
  });
  it('deletes only through the delete_roles permission', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['delete_roles']), roles: repository }))
      .delete('/api/v1/roles/role-1').set('Authorization', 'Bearer token');
    expect(response.status).toBe(200);
    expect(repository.deleteRole).toHaveBeenCalledWith('role-1', 'u1');
  });
});
