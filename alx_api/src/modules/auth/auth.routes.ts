import { rateLimit } from 'express-rate-limit';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthPrincipalDto, AuthUseCases } from './auth.contracts';
import {
  changePasswordInputSchema,
  completePasswordResetInputSchema,
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  requestPasswordResetInputSchema,
  sessionIdParamSchema,
} from './auth.schemas';
import { AuthServiceError } from './auth.use-cases';

function handleAuthError(error: unknown, response: Response, requestId: string, next: NextFunction): void {
  if (error instanceof AuthServiceError) {
    sendFailure(response, error.statusCode, error.code, error.safeMessage, requestId);
    return;
  }
  next(error);
}

export function requireAuthenticatedUser(useCases?: AuthUseCases): RequestHandler {
  return async (request, response, next) => {
    const requestId = String(response.locals.requestId);
    if (!useCases) {
      sendFailure(response, 503, 'AUTH_NOT_CONFIGURED', 'خدمة المصادقة غير مهيأة بعد.', requestId);
      return;
    }

    const authorization = request.get('authorization') ?? '';
    const token = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authorization)?.[1];
    if (!token) {
      sendFailure(response, 401, 'AUTH_INVALID_CREDENTIALS', 'بيانات المصادقة غير صحيحة.', requestId);
      return;
    }

    try {
      response.locals.authPrincipal = await useCases.authenticateAccessToken({ accessToken: token });
      next();
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  };
}

function authenticatedPrincipal(response: Response): AuthPrincipalDto | undefined {
  return response.locals.authPrincipal as AuthPrincipalDto | undefined;
}

export function registerAuthRoutes(app: Express, environment: ApiEnvironment, useCases?: AuthUseCases): void {
  const authLimiter = rateLimit({
    windowMs: environment.rateLimitWindowMs,
    limit: environment.authRateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(_request, response) {
      sendFailure(
        response,
        429,
        'AUTH_RATE_LIMITED',
        'تم تجاوز عدد محاولات المصادقة المسموح.',
        String(response.locals.requestId),
      );
    },
  });
  const authenticate = requireAuthenticatedUser(useCases);

  app.post('/api/v1/auth/login', authLimiter, async (request, response, next) => {
    const input = loginInputSchema.safeParse(request.body as unknown);
    const requestId = String(response.locals.requestId);
    if (!input.success) {
      return sendFailure(response, 400, 'INVALID_AUTH_INPUT', 'بيانات المصادقة غير صالحة.', requestId);
    }
    if (!useCases) {
      return sendFailure(response, 503, 'AUTH_NOT_CONFIGURED', 'خدمة المصادقة غير مهيأة بعد.', requestId);
    }

    try {
      const result = await useCases.login(input.data);
      return sendSuccess(response, result, requestId);
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  });

  app.post('/api/v1/auth/refresh', authLimiter, async (request, response, next) => {
    const input = refreshInputSchema.safeParse(request.body as unknown);
    const requestId = String(response.locals.requestId);
    if (!input.success) {
      return sendFailure(response, 400, 'INVALID_AUTH_INPUT', 'بيانات المصادقة غير صالحة.', requestId);
    }
    if (!useCases) {
      return sendFailure(response, 503, 'AUTH_NOT_CONFIGURED', 'خدمة المصادقة غير مهيأة بعد.', requestId);
    }

    try {
      const result = await useCases.refresh(input.data);
      return sendSuccess(response, result, requestId);
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  });

  app.post('/api/v1/auth/logout', authLimiter, async (request, response, next) => {
    const input = logoutInputSchema.safeParse(request.body as unknown);
    const requestId = String(response.locals.requestId);
    if (!input.success) {
      return sendFailure(response, 400, 'INVALID_AUTH_INPUT', 'بيانات المصادقة غير صالحة.', requestId);
    }
    if (!useCases) {
      return sendFailure(response, 503, 'AUTH_NOT_CONFIGURED', 'خدمة المصادقة غير مهيأة بعد.', requestId);
    }

    try {
      await useCases.logout(input.data);
      return sendSuccess(response, { loggedOut: true }, requestId);
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  });

  app.get('/api/v1/auth/me', authenticate, (_request: Request, response: Response) => {
    const requestId = String(response.locals.requestId);
    const principal = authenticatedPrincipal(response);
    if (!principal)
      return sendFailure(response, 401, 'AUTH_INVALID_CREDENTIALS', 'بيانات المصادقة غير صحيحة.', requestId);
    return sendSuccess(response, principal, requestId);
  });

  app.get('/api/v1/auth/sessions', authenticate, async (_request: Request, response: Response, next: NextFunction) => {
    const requestId = String(response.locals.requestId);
    const principal = authenticatedPrincipal(response);
    if (!principal || !useCases) {
      return sendFailure(response, 401, 'AUTH_INVALID_CREDENTIALS', 'بيانات المصادقة غير صحيحة.', requestId);
    }
    try {
      const sessions = await useCases.listSessions({
        userId: principal.userId,
        currentSessionId: principal.sessionId,
      });
      return sendSuccess(response, { sessions }, requestId);
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  });

  app.delete('/api/v1/auth/sessions/:sessionId', authenticate, async (request, response, next) => {
    const requestId = String(response.locals.requestId);
    const principal = authenticatedPrincipal(response);
    const sessionId = sessionIdParamSchema.safeParse(request.params.sessionId);
    if (!principal || !sessionId.success || !useCases) {
      return sendFailure(response, 400, 'INVALID_AUTH_INPUT', 'معرف الجلسة غير صالح.', requestId);
    }
    try {
      await useCases.revokeSession({ userId: principal.userId, sessionId: sessionId.data });
      return sendSuccess(response, { revoked: true }, requestId);
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  });

  app.post(
    '/api/v1/auth/logout-all',
    authenticate,
    async (_request: Request, response: Response, next: NextFunction) => {
      const requestId = String(response.locals.requestId);
      const principal = authenticatedPrincipal(response);
      if (!principal || !useCases) {
        return sendFailure(response, 401, 'AUTH_INVALID_CREDENTIALS', 'بيانات المصادقة غير صحيحة.', requestId);
      }
      try {
        await useCases.logoutAll({ userId: principal.userId });
        return sendSuccess(response, { loggedOut: true }, requestId);
      } catch (error) {
        handleAuthError(error, response, requestId, next);
      }
    },
  );

  app.patch('/api/v1/auth/password', authenticate, async (request, response, next) => {
    const requestId = String(response.locals.requestId);
    const principal = authenticatedPrincipal(response);
    const input = changePasswordInputSchema.safeParse(request.body as unknown);
    if (!principal || !input.success || !useCases) {
      return sendFailure(response, 400, 'INVALID_AUTH_INPUT', 'بيانات تغيير كلمة المرور غير صالحة.', requestId);
    }
    try {
      await useCases.changePassword({ userId: principal.userId, ...input.data });
      return sendSuccess(response, { changed: true }, requestId);
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  });

  app.post('/api/v1/auth/password/reset', authLimiter, async (request, response, next) => {
    const requestId = String(response.locals.requestId);
    const input = requestPasswordResetInputSchema.safeParse(request.body as unknown);
    if (!input.success) {
      return sendFailure(response, 400, 'INVALID_AUTH_INPUT', 'بيانات طلب إعادة التعيين غير صالحة.', requestId);
    }
    if (!useCases) {
      return sendFailure(response, 503, 'AUTH_NOT_CONFIGURED', 'خدمة المصادقة غير مهيأة بعد.', requestId);
    }
    try {
      return sendSuccess(response, await useCases.requestPasswordReset(input.data), requestId);
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  });

  app.post('/api/v1/auth/password/reset/complete', authLimiter, async (request, response, next) => {
    const requestId = String(response.locals.requestId);
    const input = completePasswordResetInputSchema.safeParse(request.body as unknown);
    if (!input.success) {
      return sendFailure(response, 400, 'INVALID_AUTH_INPUT', 'بيانات إكمال إعادة التعيين غير صالحة.', requestId);
    }
    if (!useCases) {
      return sendFailure(response, 503, 'AUTH_NOT_CONFIGURED', 'خدمة المصادقة غير مهيأة بعد.', requestId);
    }
    try {
      await useCases.completePasswordReset(input.data);
      return sendSuccess(response, { changed: true }, requestId);
    } catch (error) {
      handleAuthError(error, response, requestId, next);
    }
  });

  app.get(
    '/api/v1/auth/permissions',
    authenticate,
    async (_request: Request, response: Response, next: NextFunction) => {
      const requestId = String(response.locals.requestId);
      const principal = authenticatedPrincipal(response);
      if (!principal || !useCases) {
        return sendFailure(response, 401, 'AUTH_INVALID_CREDENTIALS', 'بيانات المصادقة غير صحيحة.', requestId);
      }
      try {
        const permissions = await useCases.listPermissions({ userId: principal.userId });
        return sendSuccess(response, { permissions }, requestId);
      } catch (error) {
        handleAuthError(error, response, requestId, next);
      }
    },
  );
}
