import crypto from 'node:crypto';
import express, { type Express, type RequestHandler } from 'express';
import { errorDetailsFromUnknown } from '../src/shared/contracts/error.contracts';

const API_CONTRACT_VERSION = '1.0';

export interface ApiFoundationContract {
  version: string;
  requestIdHeader: 'x-request-id';
  errorEnvelope: 'ErrorEnvelope';
  routes: Array<{
    method: 'GET';
    path: string;
    auth: 'public' | 'server-auth-required' | 'not-enabled';
    mutation: false;
  }>;
}

export function apiFoundationContract(): ApiFoundationContract {
  return {
    version: API_CONTRACT_VERSION,
    requestIdHeader: 'x-request-id',
    errorEnvelope: 'ErrorEnvelope',
    routes: [
      { method: 'GET', path: '/api/health', auth: 'public', mutation: false },
      { method: 'GET', path: '/api/readiness', auth: 'public', mutation: false },
      { method: 'GET', path: '/api/v1/contract', auth: 'public', mutation: false },
      { method: 'GET', path: '/api/v1/auth/current-user', auth: 'not-enabled', mutation: false },
      { method: 'GET', path: '/api/v1/customers', auth: 'server-auth-required', mutation: false },
      { method: 'GET', path: '/api/v1/couriers', auth: 'server-auth-required', mutation: false },
    ],
  };
}

function requestIdFromHeader(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 128 ? normalized : null;
}

export function createRequestIdMiddleware(): RequestHandler {
  return (req, res, next) => {
    const requestId = requestIdFromHeader(req.header('x-request-id')) ?? crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    res.locals.requestId = requestId;
    next();
  };
}

export function createApiErrorHandler(): express.ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const requestId = res.locals.requestId ?? req.header('x-request-id') ?? crypto.randomUUID();
    const details = errorDetailsFromUnknown(error, 'INTERNAL_API_ERROR');
    res.setHeader('x-request-id', requestId);
    return res.status(500).json({
      success: false,
      error: { ...details, code: 'INTERNAL_API_ERROR', message: 'An internal API error occurred.', requestId },
    });
  };
}

export function createApiAvailabilityMiddleware(
  isDatabaseReady: () => boolean,
): RequestHandler {
  return (req, res, next) => {
    if (req.path === '/api/health' || req.path === '/api/browser-proxy') {
      return next();
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_NOT_READY',
          message: 'Database service is not ready.',
          requestId: res.locals.requestId,
        },
      });
    }

    return next();
  };
}

export function readinessResponse(isDatabaseReady: boolean): {
  status: 'ready' | 'not_ready';
  checks: { database: boolean };
} {
  return {
    status: isDatabaseReady ? 'ready' : 'not_ready',
    checks: { database: isDatabaseReady },
  };
}

export function createApp(isDatabaseReady: () => boolean): Express {
  const app = express();

  app.use(express.json());
  app.use('/api', createRequestIdMiddleware());
  app.use('/api/*', createApiAvailabilityMiddleware(isDatabaseReady));
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', project: 'supabase-backend' });
  });
  app.get('/api/readiness', (_req, res) => {
    const ready = isDatabaseReady();
    res.status(ready ? 200 : 503).json(readinessResponse(ready));
  });
  app.get('/api/v1/contract', (_req, res) => {
    res.status(200).json(apiFoundationContract());
  });

  return app;
}
