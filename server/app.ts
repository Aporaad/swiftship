import express, { type Express, type RequestHandler } from 'express';

const DATABASE_UNAVAILABLE_MESSAGE =
  'خدمات قاعدة البيانات غير مهيأة أو غير متصلة بالإنترنت حالياً. يرجى التأكد من تهيئة Supabase بشكل صحيح عبر متغيرات البيئة.';

export function createApiAvailabilityMiddleware(
  isDatabaseReady: () => boolean,
): RequestHandler {
  return (req, res, next) => {
    if (req.path === '/api/health' || req.path === '/api/browser-proxy') {
      return next();
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ error: DATABASE_UNAVAILABLE_MESSAGE });
    }

    return next();
  };
}

export function createApp(isDatabaseReady: () => boolean): Express {
  const app = express();

  app.use(express.json());
  app.use('/api/*', createApiAvailabilityMiddleware(isDatabaseReady));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', project: 'supabase-backend' });
  });

  return app;
}
