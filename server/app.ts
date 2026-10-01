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

export function createApp(isDatabaseReady: () => boolean): Express {
  const app = express();

  app.use(express.json());
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
