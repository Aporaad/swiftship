import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  createServerAuthMiddleware,
  createStaticTokenVerifier,
  parseBearerToken,
} from './server-auth';

function response() {
  const value = {
    status: vi.fn(),
    json: vi.fn(),
    locals: { requestId: 'req-auth-1', principal: undefined as { id: string; email?: string; roles: string[] } | undefined },
  };
  value.status.mockReturnValue(value);
  value.json.mockReturnValue(value);
  return value;
}

describe('server-auth middleware', () => {
  it.each([
    ['Bearer abc-123', 'abc-123'],
    ['bearer token', 'token'],
    ['Basic token', null],
    [undefined, null],
  ] as const)('parses bearer header %s', (header, expected) => {
    expect(parseBearerToken(header)).toBe(expected);
  });

  it('rejects requests when authentication is not configured', async () => {
    const res = response();
    await createServerAuthMiddleware(null)(
      { header: () => undefined } as unknown as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'AUTH_NOT_CONFIGURED', requestId: 'req-auth-1' }),
    }));
  });

  it('accepts a valid configured token and exposes a server principal', async () => {
    const res = response();
    const next = vi.fn();
    const principal = { id: 'service-1', email: 'service@example.test', roles: ['customers:read'] };
    const verify = createStaticTokenVerifier('secret-token', principal);

    await createServerAuthMiddleware(verify)(
      { header: () => 'Bearer secret-token' } as unknown as Request,
      res as unknown as Response,
      next as NextFunction,
    );

    expect(res.locals.principal).toEqual(principal);
    expect(next).toHaveBeenCalledOnce();
  });
});
