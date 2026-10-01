import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  doc: vi.fn((_: unknown, collection: string, id: string) => ({ collection, id })),
  getDoc: vi.fn(),
}));

vi.mock('../current-db/client', () => dbMocks);

import {
  createLocalSessionVerifier,
  createServerPermissionMiddleware,
  createServerAuthMiddleware,
  parseBearerToken,
} from './server-auth';

function response() {
  const value = {
    status: vi.fn(),
    json: vi.fn(),
    locals: { requestId: 'req-auth-1', principal: undefined as { id: string; roles: string[]; sessionId: string } | undefined },
  };
  value.status.mockReturnValue(value);
  value.json.mockReturnValue(value);
  return value;
}

describe('local server-auth middleware', () => {
  it.each([
    ['Bearer sess-user-1', 'sess-user-1'],
    ['bearer local-session', 'local-session'],
    ['Basic token', null],
    [undefined, null],
  ] as const)('parses local session header %s', (header, expected) => {
    expect(parseBearerToken(header)).toBe(expected);
  });

  it('rejects requests when the local database verifier is unavailable', async () => {
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

  it('verifies the sessions and users documents locally', async () => {
    dbMocks.getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ user_id: 'user-1', last_seen: new Date().toISOString(), force_logout: false, role: 'Admin' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 'user-1', email: 'admin@example.test', role: 'Admin', is_root: true, disabled: false }),
      });
    const verify = createLocalSessionVerifier({});
    const principal = await verify?.('sess-user-1');

    expect(principal).toEqual({
      id: 'user-1',
      email: 'admin@example.test',
      roles: ['Admin', 'customers:read', 'couriers:read'],
      sessionId: 'sess-user-1',
    });
    expect(dbMocks.doc).toHaveBeenNthCalledWith(1, {}, 'sessions', 'sess-user-1');
    expect(dbMocks.doc).toHaveBeenNthCalledWith(2, {}, 'users', 'user-1');
  });

  it('denies a principal without the required permission', () => {
    const res = response();
    const next = vi.fn();
    createServerPermissionMiddleware('customers:read')(
      {} as Request,
      res as unknown as Response,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
