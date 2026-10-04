import express from 'express';
import request from 'supertest';
import { requirePermission } from '../../../src/core/auth/require-permission';
import type { AuthUseCases } from '../../../src/modules/auth/auth.contracts';

function createProtectedApp(permissions: readonly string[] | undefined, principal = true) {
  const app = express();
  const listPermissions = jest.fn().mockResolvedValue(permissions ?? []);
  const useCases = { listPermissions } as unknown as AuthUseCases;
  app.use((_request, response, next) => {
    response.locals.requestId = 'local-test-request';
    if (principal) response.locals.authPrincipal = { userId: 'synthetic-user', sessionId: 'session', role: 'employee' };
    next();
  });
  app.get('/protected', requirePermission(useCases, 'orders.read'), (_request, response) => {
    response.status(200).json({ success: true });
  });
  return { app, listPermissions };
}

describe('requirePermission', () => {
  it('allows only the explicitly assigned permission', async () => {
    const { app, listPermissions } = createProtectedApp(['orders.read']);
    const response = await request(app).get('/protected');
    expect(response.status).toBe(200);
    expect(listPermissions).toHaveBeenCalledWith({ userId: 'synthetic-user' });
  });

  it('denies by default and does not treat wildcard as a grant', async () => {
    const missing = await request(createProtectedApp([]).app).get('/protected');
    const wildcard = await request(createProtectedApp(['*']).app).get('/protected');
    expect(missing.status).toBe(403);
    expect(wildcard.status).toBe(403);
  });

  it('rejects missing verified principals and invalid configured permission codes', async () => {
    const noPrincipal = await request(createProtectedApp(['orders.read'], false).app).get('/protected');
    expect(noPrincipal.status).toBe(401);
    expect(() => requirePermission(undefined, 'orders.read')).not.toThrow();
    expect(() => requirePermission(undefined, '*')).toThrow('A canonical permission code is required.');
  });
});
