import pino from 'pino';
import { createApiApp } from './app';
import { parseEnvironment } from './config/env';
import { isDatabaseReady } from './db/health';
import { createDatabaseConnection } from './db/pool';
import { createAuthUseCases } from './modules/auth/auth.factory';
import { createCustomersRepository } from './modules/customers/customers.repository';
import { createOperationsRepository } from './modules/operations/operations.repository';
import { createFinanceRepository } from './modules/finance/finance.repository';
import { createReportingRepository } from './modules/reporting/reporting.repository';
import { createUsersRepository } from './modules/users/users.repository';
import { createRolesRepository } from './modules/roles/roles.repository';
import { createNotificationsRepository } from './modules/notifications/notifications.repository';
import { createPortalRepository } from './modules/portal/portal.repository';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

function startServer(): void {
  const environment = parseEnvironment();
  const database = environment.databaseUrl
    ? createDatabaseConnection({
        connectionString: environment.databaseUrl,
        nodeEnv: environment.nodeEnv,
        sslMode: environment.databaseSslMode,
        ...(environment.databaseRuntimeRole ? { runtimeRole: environment.databaseRuntimeRole } : {}),
        ...(environment.databaseSslCaPem ? { sslCaPem: environment.databaseSslCaPem } : {}),
      })
    : undefined;
  const auth =
    database && environment.jwtPrivateKeyPem && environment.authDummyPasswordHash
      ? createAuthUseCases(database, environment)
      : undefined;
  const appOptions = {
    environment,
    readiness: async () => ({ database: await isDatabaseReady(database?.pool) }),
    logger,
    ...(database ? { customers: createCustomersRepository(database.pool) } : {}),
    ...(database ? { operations: createOperationsRepository(database.pool) } : {}),
    ...(database ? { finance: createFinanceRepository(database.pool) } : {}),
    ...(database ? { reporting: createReportingRepository(database.pool) } : {}),
    ...(database ? { users: createUsersRepository(database.pool) } : {}),
    ...(database ? { roles: createRolesRepository(database.pool) } : {}),
    // إشعارات وبوابة الموقع — Notifications & Portal repositories
    ...(database ? { notifications: createNotificationsRepository(database.pool) } : {}),
    ...(database ? { portal: createPortalRepository(database.pool) } : {}),
  };
  const app = auth ? createApiApp({ ...appOptions, auth }) : createApiApp(appOptions);
  const server = app.listen(environment.port, environment.host, () => {
    logger.info(
      {
        host: environment.host,
        port: environment.port,
        databaseConfigured: Boolean(database),
        authConfigured: Boolean(auth),
      },
      'alx_api listening',
    );
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'alx_api shutting down');
    server.close((error) => {
      if (error) {
        logger.error({ name: error.name }, 'HTTP server failed to close cleanly');
        process.exitCode = 1;
      }
      if (database) {
        void database.pool.end().catch((closeError: unknown) => {
          const summary = closeError instanceof Error ? { name: closeError.name } : { name: 'UnknownError' };
          logger.error(summary, 'PostgreSQL pool failed to close cleanly');
          process.exitCode = 1;
        });
      }
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

try {
  startServer();
} catch (error) {
  const summary =
    error instanceof Error ? { name: error.name, message: error.message } : { message: 'Unknown startup error' };
  logger.fatal(summary, 'alx_api startup failed');
  process.exitCode = 1;
}
