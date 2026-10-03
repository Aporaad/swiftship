import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { AuthTokenPairDto, AuthUseCases } from '../src/modules/auth/auth.routes';

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

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokenPair.refreshToken });
    expect(refresh.status).toBe(200);
    expect(auth.refresh).toHaveBeenCalledWith({ refreshToken: tokenPair.refreshToken });

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: tokenPair.refreshToken });
    expect(logout.status).toBe(200);
    expect(logout.body.data.loggedOut).toBe(true);
    expect(auth.logout).toHaveBeenCalledWith({ refreshToken: tokenPair.refreshToken });
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
