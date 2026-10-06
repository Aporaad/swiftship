import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import pino, { type Logger } from 'pino';
import pinoHttp from 'pino-http';
import type { ApiEnvironment } from './config/env';
import { sendFailure, sendSuccess } from './core/http/response';
import { requestIdMiddleware } from './middleware/request-id';
import { registerAuthRoutes } from './modules/auth/auth.routes';
import type { AuthUseCases } from './modules/auth/auth.contracts';
import { registerCustomersRoutes } from './modules/customers/customers.routes';
import type { CustomerRepository } from './modules/customers/customers.contracts';
import { registerOperationsRoutes } from './modules/operations/operations.routes';
import type { OperationsRepository } from './modules/operations/operations.contracts';
import { registerFinanceRoutes } from './modules/finance/finance.routes';
import type { FinanceRepository } from './modules/finance/finance.contracts';
import { registerReportingRoutes } from './modules/reporting/reporting.routes';
import type { ReportingRepository } from './modules/reporting/reporting.contracts';
import { registerUsersRoutes } from './modules/users/users.routes';
import type { UsersRepository } from './modules/users/users.contracts';
import { registerRolesRoutes } from './modules/roles/roles.routes';
import type { RolesRepository } from './modules/roles/roles.contracts';
import { registerNotificationsRoutes } from './modules/notifications/notifications.routes';
import type { NotificationsRepository } from './modules/notifications/notifications.contracts';
import { registerPortalRoutes } from './modules/portal/portal.routes';
import type { PortalRepository } from './modules/portal/portal.contracts';
import { registerPortalAuthRoutes } from './modules/portal/portal-auth.routes';
import type { PortalAuthService } from './modules/portal/portal-auth.service';

export interface ApiReadiness {
  database: boolean;
}

export interface AppOptions {
  environment: ApiEnvironment;
  readiness?: () => ApiReadiness | Promise<ApiReadiness>;
  logger?: Logger;
  auth?: AuthUseCases;
  customers?: CustomerRepository;
  operations?: OperationsRepository;
  finance?: FinanceRepository;
  reporting?: ReportingRepository;
  users?: UsersRepository;
  roles?: RolesRepository;
  notifications?: NotificationsRepository;
  portal?: PortalRepository;
  portalAuth?: PortalAuthService;
}

export function createApiApp(options: AppOptions): Express {
  const { environment } = options;
  const logger = options.logger ?? pino({ level: environment.nodeEnv === 'test' ? 'silent' : environment.logLevel });
  const readiness = options.readiness ?? (() => ({ database: false }));
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', environment.nodeEnv === 'production' ? 1 : false);
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId(_request, response) {
        return String(response.locals.requestId);
      },
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      serializers: {
        req(request) {
          return { id: request.id, method: request.method, url: request.url };
        },
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
      origin(origin, callback) {
        if (origin === undefined || environment.corsOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('CORS_ORIGIN_DENIED'));
      },
    }),
  );
  app.use(express.json({ limit: environment.jsonBodyLimit, strict: true }));
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: environment.rateLimitWindowMs,
      limit: environment.rateLimitMax,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler(_request, response) {
        sendFailure(response, 429, 'RATE_LIMITED', 'تم تجاوز حد الطلبات المسموح.', String(response.locals.requestId));
      },
    }),
  );

  app.get('/api/v1/health/live', (_request, response) => {
    sendSuccess(response, { status: 'alive' }, String(response.locals.requestId));
  });

  app.get('/api/v1/health/ready', async (_request, response) => {
    const databaseChecks = await readiness();
    const checks = { database: databaseChecks.database, auth: Boolean(options.auth) };
    if (!checks.database || !checks.auth) {
      return sendFailure(
        response,
        503,
        'SERVICE_NOT_READY',
        'الخدمة غير جاهزة بعد.',
        String(response.locals.requestId),
      );
    }
    return sendSuccess(response, { status: 'ready', checks }, String(response.locals.requestId));
  });

  registerAuthRoutes(app, environment, options.auth);
  if (options.customers) registerCustomersRoutes(app, environment, options.auth, options.customers);
  if (options.operations) registerOperationsRoutes(app, environment, options.auth, options.operations);
  if (options.finance) registerFinanceRoutes(app, environment, options.auth, options.finance);
  if (options.reporting) registerReportingRoutes(app, environment, options.auth, options.reporting);
  if (options.users) registerUsersRoutes(app, environment, options.auth, options.users);
  if (options.roles) registerRolesRoutes(app, environment, options.auth, options.roles);
  // تفعيل وحدة الإشعارات — Activate notifications module
  if (options.notifications) registerNotificationsRoutes(app, environment, options.auth, options.notifications);
  // تفعيل وحدة البوابة العامة — Activate public portal module
  if (options.portal) registerPortalRoutes(app, environment, options.portal);
  if (options.portalAuth) registerPortalAuthRoutes(app, environment, options.portalAuth);

  app.use('/api/v1', (_request, response) => {
    sendFailure(response, 404, 'ROUTE_NOT_FOUND', 'المسار المطلوب غير موجود.', String(response.locals.requestId));
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
    const requestId = String(response.locals.requestId);
    if (error instanceof Error && error.message === 'CORS_ORIGIN_DENIED') {
      return sendFailure(response, 403, 'CORS_ORIGIN_DENIED', 'مصدر الطلب غير مسموح.', requestId);
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return sendFailure(response, 400, 'INVALID_JSON', 'تعذر تحليل جسم الطلب.', requestId);
    }
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    // تسجيل تفاصيل الخطأ في التطوير لأغراض التشخيص - لا تُضمَّن في إجابة العميل
    // Log full error details in dev only - never returned to client
    const devDetail = environment.nodeEnv !== 'production' && error instanceof Error
      ? { errorName, errorMessage: error.message, requestId }
      : { errorName, requestId };
    request.log?.error(devDetail, 'Unhandled HTTP error');
    return sendFailure(response, 500, 'INTERNAL_ERROR', 'حدث خطأ داخلي.', requestId);
  };
  app.use(errorHandler);

  return app;
}
