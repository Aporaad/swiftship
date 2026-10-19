import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccessTokenRefresher } from './session-refresh';
import { SESSION_TERMINATED_EVENT } from './session-events';

// بيئة node بلا DOM: نُبثّ أدنى sessionStorage و window (EventTarget) كي تعمل طبقة التخزين والبثّ كما في المتصفح.
// A DOM-less node environment: install a minimal sessionStorage and window (EventTarget) so storage and broadcast behave as in a browser.
const REFRESH_KEY = 'alx_refresh_token';
const ACCESS_KEYS = ['alx_access_token', 'alx_api_access_token'];

function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

const storage = makeStorage();

describe('shared access-token refresher', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('window', new EventTarget());
    storage.clear();
    storage.setItem(REFRESH_KEY, 'valid-refresh-token');
    ACCESS_KEYS.forEach((key) => storage.setItem(key, 'old-access-token'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renews the token and stores the new pair on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {
      success: true,
      data: { accessToken: 'new-access', refreshToken: 'rotated', sessionId: 's-1', sessionExpiresAt: '2026-10-04T00:10:00.000Z' },
    })));

    const token = await createAccessTokenRefresher('http://api.test')();
    expect(token).toBe('new-access');
    expect(storage.getItem(REFRESH_KEY)).toBe('rotated');
  });

  it('keeps the session on a network fault so an active user is never cut off', async () => {
    // انقطاع شبكة عارض: لا نمحو الرموز ولا نُنهي الجلسة — نعيد null فقط ليُعاد الفحص لاحقًا.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const terminated = vi.fn();
    window.addEventListener(SESSION_TERMINATED_EVENT, terminated);

    const token = await createAccessTokenRefresher('http://api.test')();
    expect(token).toBeNull();
    expect(storage.getItem(REFRESH_KEY)).toBe('valid-refresh-token');
    expect(terminated).not.toHaveBeenCalled();
  });

  it('treats a 429 as transient and preserves the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, { error: { code: 'AUTH_RATE_LIMITED' } })));

    const token = await createAccessTokenRefresher('http://api.test')();
    expect(token).toBeNull();
    expect(storage.getItem(REFRESH_KEY)).toBe('valid-refresh-token');
  });

  it('ends the session and announces it when the server decisively rejects a lapsed session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'AUTH_SESSION_EXPIRED' } })));
    const terminated = vi.fn();
    window.addEventListener(SESSION_TERMINATED_EVENT, terminated);

    const token = await createAccessTokenRefresher('http://api.test')();
    expect(token).toBeNull();
    expect(storage.getItem(REFRESH_KEY)).toBeNull();
    expect(terminated).toHaveBeenCalledTimes(1);
  });
});
