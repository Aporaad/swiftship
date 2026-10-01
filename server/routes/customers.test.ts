import type { Express, NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { registerCustomersRoutes, type CustomerApiDto } from './customers';

function response() {
  const value = { status: vi.fn(), json: vi.fn(), locals: { requestId: 'req-customer-1' } };
  value.status.mockReturnValue(value);
  value.json.mockReturnValue(value);
  return value;
}

describe('Customers API route', () => {
  it('requires authentication before reading customer data', async () => {
    const app = { get: vi.fn() } as unknown as Express;
    const gateway = { list: vi.fn() };
    registerCustomersRoutes(app, gateway, null);
    const [, authenticate] = (app.get as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const res = response();

    await authenticate(
      { header: () => undefined } as unknown as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(gateway.list).not.toHaveBeenCalled();
  });

  it('returns a paged safe DTO list for an authenticated read', async () => {
    const app = { get: vi.fn() } as unknown as Express;
    const items: CustomerApiDto[] = [{
      id: 'customer-1',
      name: 'Customer One',
      email: 'one@example.test',
      phone: '555-0100',
      disabled: false,
    }];
    const gateway = { list: vi.fn().mockResolvedValue({ items, limit: 20, offset: 0, hasMore: false }) };
    registerCustomersRoutes(app, gateway, async (token) => token === 'valid'
      ? { id: 'service-1', roles: ['customers:read'] }
      : null);
    const [, authenticate, authorize, handler] = (app.get as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const req = {
      header: () => 'Bearer valid',
      query: { limit: '20', offset: '0', search: 'one' },
    };
    const res = response();
    const next = vi.fn();

    await authenticate(req as unknown as Request, res as unknown as Response, async () => {
      await authorize(req, res, async () => {
        await handler(req, res, next);
      });
    });

    expect(gateway.list).toHaveBeenCalledWith({ limit: 20, offset: 0, search: 'one' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: items, page: { limit: 20, offset: 0, hasMore: false } });
    expect(next).not.toHaveBeenCalled();
  });
});
