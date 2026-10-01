import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createApiAvailabilityMiddleware, readinessResponse } from './app';

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe('API availability middleware', () => {
  it('returns the existing 503 response when database services are unavailable', () => {
    const middleware = createApiAvailabilityMiddleware(() => false);
    const response = createResponse();
    const next = vi.fn();

    middleware(
      { path: '/api/orders' } as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      error: 'خدمات قاعدة البيانات غير مهيأة أو غير متصلة بالإنترنت حالياً. يرجى التأكد من تهيئة Supabase بشكل صحيح عبر متغيرات البيئة.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['/api/health', '/api/browser-proxy'])(
    'keeps %s available when database services are unavailable',
    (path) => {
      const middleware = createApiAvailabilityMiddleware(() => false);
      const response = createResponse();
      const next = vi.fn();

      middleware(
        { path } as Request,
        response as unknown as Response,
        next as NextFunction,
      );

      expect(next).toHaveBeenCalledOnce();
      expect(response.status).not.toHaveBeenCalled();
    },
  );

  it.each(['/health', '/browser-proxy'])(
    'keeps mounted %s available when database services are unavailable',
    (path) => {
      const middleware = createApiAvailabilityMiddleware(() => false);
      const response = createResponse();
      const next = vi.fn();

      middleware(
        { baseUrl: '/api', path } as Request,
        response as unknown as Response,
        next as NextFunction,
      );

      expect(next).toHaveBeenCalledOnce();
      expect(response.status).not.toHaveBeenCalled();
    },
  );

  it('continues when database services are ready', () => {
    const middleware = createApiAvailabilityMiddleware(() => true);
    const response = createResponse();
    const next = vi.fn();

    middleware(
      { path: '/api/orders' } as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'ready', 200],
    [false, 'not_ready', 503],
  ] as const)('returns the readiness contract for database=%s', (databaseReady, status, httpStatus) => {
    expect(readinessResponse(databaseReady)).toEqual({
      status,
      checks: { database: databaseReady },
    });
    expect(httpStatus).toBe(databaseReady ? 200 : 503);
  });
});
