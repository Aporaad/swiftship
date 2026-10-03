import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';

const environment = parseEnvironment({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3001',
  CORS_ORIGINS: 'https://portal.example.test',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX: '100',
});

function createApp(databaseReady = false) {
  return createApiApp({ environment, readiness: () => ({ database: databaseReady }) });
}

describe('ALX API scaffold HTTP boundary', () => {
  it('returns a versioned liveness envelope and echoes a valid request id', async () => {
    const response = await request(createApp()).get('/api/v1/health/live').set('x-request-id', 'test:req-01');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('test:req-01');
    expect(response.body).toEqual({
      success: true,
      data: { status: 'alive' },
      requestId: 'test:req-01',
    });
  });

  it('replaces malformed request ids with a generated bounded value', async () => {
    const response = await request(createApp()).get('/api/v1/health/live').set('x-request-id', 'bad id');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('does not report readiness until the database dependency is explicitly available', async () => {
    const response = await request(createApp()).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('SERVICE_NOT_READY');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('reports readiness only when its injected dependency check passes', async () => {
    const response = await request(createApp(true)).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.data.checks.database).toBe(true);
  });

  it('rejects an unapproved browser origin without exposing internals', async () => {
    const response = await request(createApp()).get('/api/v1/health/live').set('Origin', 'https://attacker.example');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CORS_ORIGIN_DENIED');
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('uses the common error envelope for unknown versioned routes', async () => {
    const response = await request(createApp()).get('/api/v1/not-yet-implemented');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});
