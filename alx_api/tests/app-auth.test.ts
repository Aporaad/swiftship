import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { AuthTokenPairDto, AuthUseCases } from '../src/modules/auth/auth.contracts';
import { AuthServiceError } from '../src/modules/auth/auth.use-cases';

const environment = parseEnvironment({
  NODE_ENV: 'test',
  CORS_ORIGINS: 'https://portal.example.test',
  AUTH_RATE_LIMIT_MAX: '5',
});

const tokenPair: AuthTokenPairDto = {
  accessToken: 'access-token-value',
  refreshToken: 'refresh-token-value-12345678901234567890',
  tokenType: 'Bearer',
  expiresInSeconds: 600,
};

function createAuthUseCases(): jest.Mocked<AuthUseCases> {
  return {
    login: jest.fn().mockResolvedValue(tokenPair),
    refresh: jest.fn().mockResolvedValue(tokenPair),
    logout: jest.fn().mockResolvedValue(undefined),
    authenticateAccessToken: jest.fn().mockResolvedValue({
      userId: 'user-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'employee',
    }),
    listSessions: jest.fn().mockResolvedValue([
      {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        lastUsedAt: null,
        expiresAt: new Date('2026-11-01T00:00:00Z'),
        isCurrent: true,
      },
    ]),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    logoutAll: jest.fn().mockResolvedValue(undefined),
    changePassword: jest.fn().mockResolvedValue(undefined),
    requestPasswordReset: jest
      .fn()
      .mockResolvedValue({ message: 'إذا كان الحساب موجوداً، فسيصل رابط إعادة التعيين إلى وسيلة التواصل المسجلة.' }),
    completePasswordReset: jest.fn().mockResolvedValue(undefined),
    listPermissions: jest.fn().mockResolvedValue(['orders.read']),
  };
}

describe('versioned auth HTTP boundary', () => {
  it('validates credentials and returns a non-sensitive 503 until use cases are configured', async () => {
    const response = await request(createApiApp({ environment }))
      .post('/api/v1/auth/login')
      .send({ identifier: 'user@example.test', password: 'password-value' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AUTH_NOT_CONFIGURED');
    expect(JSON.stringify(response.body)).not.toContain('password-value');
  });

  it('rejects malformed login input and unknown privileged fields before delegation', async () => {
    const auth = createAuthUseCases();
    const app = createApiApp({ environment, auth });
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'user', password: 'secret', isAdmin: true });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_AUTH_INPUT');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('delegates login, refresh and logout through the AuthUseCases port', async () => {
    const auth = createAuthUseCases();
    const app = createApiApp({ environment, auth });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '  user@example.test  ', password: 'secret' });
    expect(login.status).toBe(200);
    expect(login.body.data).toEqual(tokenPair);
    expect(auth.login).toHaveBeenCalledWith({ identifier: 'user@example.test', password: 'secret' });

    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: tokenPair.refreshToken });
    expect(refresh.status).toBe(200);
    expect(auth.refresh).toHaveBeenCalledWith({ refreshToken: tokenPair.refreshToken });

    const logout = await request(app).post('/api/v1/auth/logout').send({ refreshToken: tokenPair.refreshToken });
    expect(logout.status).toBe(200);
    expect(logout.body.data.loggedOut).toBe(true);
    expect(auth.logout).toHaveBeenCalledWith({ refreshToken: tokenPair.refreshToken });
  });

  it('maps safe use-case failures to the common HTTP envelope', async () => {
    const auth = createAuthUseCases();
    auth.login.mockRejectedValue(new AuthServiceError(401, 'AUTH_INVALID_CREDENTIALS', 'بيانات المصادقة غير صحيحة.'));
    const response = await request(createApiApp({ environment, auth }))
      .post('/api/v1/auth/login')
      .send({ identifier: 'user@example.test', password: 'wrong' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(JSON.stringify(response.body)).not.toContain('wrong');
  });

  it('rejects missing bearer credentials before delegating to the Auth service', async () => {
    const auth = createAuthUseCases();
    const response = await request(createApiApp({ environment, auth })).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(auth.authenticateAccessToken).not.toHaveBeenCalled();
  });

  it('exposes only the authenticated user profile and user-scoped session operations', async () => {
    const auth = createAuthUseCases();
    const app = createApiApp({ environment, auth });
    const authorization = 'Bearer a.valid-shaped-access-token';
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', authorization);
    expect(me.status).toBe(200);
    expect(me.body.data).toEqual({ userId: 'user-1', sessionId, role: 'employee' });

    const sessions = await request(app).get('/api/v1/auth/sessions').set('Authorization', authorization);
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.sessions[0].isCurrent).toBe(true);
    expect(JSON.stringify(sessions.body)).not.toContain('refreshToken');

    const revoke = await request(app).delete(`/api/v1/auth/sessions/${sessionId}`).set('Authorization', authorization);
    expect(revoke.status).toBe(200);
    expect(auth.revokeSession).toHaveBeenCalledWith({ userId: 'user-1', sessionId });

    const logoutAll = await request(app).post('/api/v1/auth/logout-all').set('Authorization', authorization);
    expect(logoutAll.status).toBe(200);
    expect(auth.logoutAll).toHaveBeenCalledWith({ userId: 'user-1' });

    const permissions = await request(app).get('/api/v1/auth/permissions').set('Authorization', authorization);
    expect(permissions.status).toBe(200);
    expect(permissions.body.data.permissions).toEqual(['orders.read']);

    const changedPassword = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', authorization)
      .send({ currentPassword: 'old-password', newPassword: 'New-test-password-123' });
    expect(changedPassword.status).toBe(200);
    expect(auth.changePassword).toHaveBeenCalledWith({
      userId: 'user-1',
      currentPassword: 'old-password',
      newPassword: 'New-test-password-123',
    });

    const resetRequest = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ identifier: 'user@example.test' });
    expect(resetRequest.status).toBe(200);
    expect(resetRequest.body.data.message).not.toContain('user@example.test');
    expect(auth.requestPasswordReset).toHaveBeenCalledWith({ identifier: 'user@example.test' });
  });

  it('applies the dedicated authentication rate limit', async () => {
    const limitedEnvironment = parseEnvironment({
      NODE_ENV: 'test',
      CORS_ORIGINS: 'https://portal.example.test',
      AUTH_RATE_LIMIT_MAX: '1',
    });
    const app = createApiApp({ environment: limitedEnvironment });
    const payload = { identifier: 'user', password: 'secret' };

    const first = await request(app).post('/api/v1/auth/login').send(payload);
    const second = await request(app).post('/api/v1/auth/login').send(payload);

    expect(first.status).toBe(503);
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('AUTH_RATE_LIMITED');
  });
});
