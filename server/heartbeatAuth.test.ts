import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { isAuthorizedHeartbeatRequest } from './heartbeatAuth';

function createSession(openId: string, secret: string, exp = Math.floor(Date.now() / 1000) + 60) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ openId, exp })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

describe('Heartbeat request authentication', () => {
  const secret = 'unit-test-heartbeat-secret';

  it('accepts a valid, unexpired cron session', () => {
    const token = createSession('cron_tracking_sync', secret);
    expect(isAuthorizedHeartbeatRequest({ cookie: `app_session_id=${token}` }, secret)).toBe(true);
  });

  it('rejects a non-cron, expired, or tampered session', () => {
    const regularToken = createSession('user_123', secret);
    const expiredToken = createSession('cron_tracking_sync', secret, 1);
    const validToken = createSession('cron_tracking_sync', secret);
    expect(isAuthorizedHeartbeatRequest({ cookie: `app_session_id=${regularToken}` }, secret)).toBe(false);
    expect(isAuthorizedHeartbeatRequest({ cookie: `app_session_id=${expiredToken}` }, secret)).toBe(false);
    expect(isAuthorizedHeartbeatRequest({ cookie: `app_session_id=${validToken}x` }, secret)).toBe(false);
  });
});
