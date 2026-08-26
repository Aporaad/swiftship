import { createHmac, timingSafeEqual } from 'crypto';

type HeaderSource = { cookie?: string | string[] };

function getHeartbeatSessionToken(headers: HeaderSource): string | null {
  const header = Array.isArray(headers.cookie) ? headers.cookie.join(';') : headers.cookie ?? '';
  const cookie = header.split(';').find(part => part.trim().startsWith('app_session_id='));
  return cookie ? decodeURIComponent(cookie.trim().slice('app_session_id='.length)) : null;
}

export function isAuthorizedHeartbeatRequest(headers: HeaderSource, secret = process.env.JWT_SECRET): boolean {
  const token = getHeartbeatSessionToken(headers);
  if (!token || !secret) return false;

  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) return false;

  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      openId?: string;
      exp?: number;
    };
    return (!payload.exp || payload.exp > Math.floor(Date.now() / 1000))
      && typeof payload.openId === 'string'
      && payload.openId.startsWith('cron_');
  } catch {
    return false;
  }
}
