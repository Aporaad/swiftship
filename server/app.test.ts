import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createApiAvailabilityMiddleware, createApiCorsMiddleware, readinessResponse } from './app';

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

describe('API CORS allowlist', () => {
  function corsResponse() {
    const response = {
      setHeader: vi.fn(),
      status: vi.fn(),
      json: vi.fn(),
      end: vi.fn(),
    };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    response.end.mockReturnValue(response);
    return response;
  }

  it('allows and reflects a configured origin with credentials', () => {
    const response = corsResponse();
    const next = vi.fn();
    createApiCorsMiddleware(new Set(['https://portal.example.test']))(
      { header: () => 'https://portal.example.test', method: 'GET' } as unknown as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(response.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://portal.example.test');
    expect(response.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects an origin that is not on the allowlist', () => {
    const response = corsResponse();
    const next = vi.fn();
    createApiCorsMiddleware(new Set(['https://portal.example.test']))(
      { header: () => 'https://attacker.example', method: 'GET' } as unknown as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: 'CORS_ORIGIN_DENIED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers preflight requests for approved origins', () => {
    const response = corsResponse();
    const next = vi.fn();
    createApiCorsMiddleware(new Set(['https://portal.example.test']))(
      { header: () => 'https://portal.example.test', method: 'OPTIONS' } as unknown as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.end).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });
});
