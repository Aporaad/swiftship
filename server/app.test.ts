import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  apiFoundationContract,
  createApiAvailabilityMiddleware,
  createRequestIdMiddleware,
  readinessResponse,
} from './app';

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    locals: {},
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
      success: false,
      error: {
        code: 'DATABASE_NOT_READY',
        message: 'Database service is not ready.',
        requestId: undefined,
      },
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

  it('describes the versioned API foundation without enabling unsafe data routes', () => {
    expect(apiFoundationContract()).toMatchObject({
      version: '1.0',
      requestIdHeader: 'x-request-id',
      errorEnvelope: 'ErrorEnvelope',
    });
    expect(apiFoundationContract().routes).toContainEqual({
      method: 'GET',
      path: '/api/v1/customers',
      auth: 'server-auth-required',
      mutation: false,
    });
  });

  it('preserves a valid request ID and generates one when absent', () => {
    const middleware = createRequestIdMiddleware();
    const response: { setHeader: ReturnType<typeof vi.fn>; locals: { requestId?: string } } = {
      setHeader: vi.fn(),
      locals: {},
    };
    const next = vi.fn();

    middleware(
      { header: () => 'client-request-42' } as unknown as Request,
      response as unknown as Response,
      next,
    );

    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'client-request-42');
    expect(response.locals.requestId).toBe('client-request-42');
    expect(next).toHaveBeenCalledOnce();
  });
});
