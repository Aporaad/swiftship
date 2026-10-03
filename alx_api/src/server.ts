import pino from 'pino';
import { createApiApp } from './app';
import { parseEnvironment } from './config/env';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

function startServer(): void {
  const environment = parseEnvironment();
  if (environment.databaseUrl) {
    logger.warn('DATABASE_URL is set, but the database adapter is not wired in this scaffold; readiness remains disabled.');
  }

  const app = createApiApp({ environment, readiness: () => ({ database: false }), logger });
  const server = app.listen(environment.port, environment.host, () => {
    logger.info({ host: environment.host, port: environment.port }, 'alx_api scaffold listening');
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'alx_api scaffold shutting down');
    server.close((error) => {
      if (error) {
        logger.error({ name: error.name }, 'HTTP server failed to close cleanly');
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

try {
  startServer();
} catch (error) {
  const summary = error instanceof Error ? { name: error.name, message: error.message } : { message: 'Unknown startup error' };
  logger.fatal(summary, 'alx_api startup failed');
  process.exitCode = 1;
}
