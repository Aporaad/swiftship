import express, { type Express, type RequestHandler } from 'express';

const DATABASE_UNAVAILABLE_MESSAGE =
  'خدمات قاعدة البيانات غير مهيأة أو غير متصلة بالإنترنت حالياً. يرجى التأكد من تهيئة Supabase بشكل صحيح عبر متغيرات البيئة.';

export function createApiAvailabilityMiddleware(
  isDatabaseReady: () => boolean,
): RequestHandler {
  return (req, res, next) => {
    const mountedPath = req.path.startsWith('/api/') ? req.path : `${req.baseUrl}${req.path}`;
    if (mountedPath === '/api/health' || mountedPath === '/api/browser-proxy') {
      return next();
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ error: DATABASE_UNAVAILABLE_MESSAGE });
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

export function createApiCorsMiddleware(allowedOrigins: ReadonlySet<string>): RequestHandler {
  return (request, response, next) => {
    const origin = request.header('origin');
    if (!origin) return next();
    if (!allowedOrigins.has(origin)) {
      return response.status(403).json({ error: 'CORS_ORIGIN_DENIED' });
    }

    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, Idempotency-Key');
    response.setHeader('Vary', 'Origin');
    if (request.method === 'OPTIONS') return response.status(204).end();
    return next();
  };
}

export function createApp(isDatabaseReady: () => boolean): Express {
  const app = express();

  app.use(express.json());
  const corsOrigins = new Set((process.env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean));
  app.use('/api', createApiCorsMiddleware(corsOrigins));
  app.use('/api/*', createApiAvailabilityMiddleware(isDatabaseReady));
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', project: 'supabase-backend' });
  });
  app.get('/api/readiness', (_req, res) => {
    const ready = isDatabaseReady();
    res.status(ready ? 200 : 503).json(readinessResponse(ready));
  });

  return app;
}
