import type { Express, NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { registerCouriersRoutes, type CourierApiDto } from './couriers';

function response() {
  const value = { status: vi.fn(), json: vi.fn(), locals: { requestId: 'req-courier-1' } };
  value.status.mockReturnValue(value);
  value.json.mockReturnValue(value);
  return value;
}

describe('Couriers API route', () => {
  it('returns a paged safe DTO list for an authenticated principal with permission', async () => {
    const app = { get: vi.fn() } as unknown as Express;
    const items: CourierApiDto[] = [{
      id: 'courier-1', name: 'Courier One', email: 'courier@example.test', phone: '555-0200', disabled: false,
    }];
    const gateway = { list: vi.fn().mockResolvedValue({ items, limit: 10, offset: 0, hasMore: false }) };
    registerCouriersRoutes(app, gateway, async (token) => token === 'valid'
      ? { id: 'admin-1', roles: ['couriers:read'] }
      : null);
    const [, authenticate, authorize, handler] = (app.get as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const req = { header: () => 'Bearer valid', query: { limit: '10', offset: '0' } };
    const res = response();
    const next = vi.fn();

    await authenticate(req as unknown as Request, res as unknown as Response, async () => {
      await authorize(req, res, async () => handler(req, res, next));
    });

    expect(gateway.list).toHaveBeenCalledWith({ limit: 10, offset: 0, search: undefined });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: items, page: { limit: 10, offset: 0, hasMore: false } });
  });

  it('returns permission denied for an authenticated principal without courier access', async () => {
    const app = { get: vi.fn() } as unknown as Express;
    const gateway = { list: vi.fn() };
    registerCouriersRoutes(app, gateway, async () => ({ id: 'user-1', roles: [] }));
    const [, authenticate, authorize] = (app.get as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const req = { header: () => 'Bearer valid', query: {} };
    const res = response();

    await authenticate(req as unknown as Request, res as unknown as Response, async () => {
      await authorize(req, res, vi.fn() as NextFunction);
    });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(gateway.list).not.toHaveBeenCalled();
  });
});
