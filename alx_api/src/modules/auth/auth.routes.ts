import { rateLimit } from 'express-rate-limit';
import type { Express, NextFunction, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthUseCases } from './auth.contracts';
import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
} from './auth.schemas';
import { AuthServiceError } from './auth.use-cases';

function handleAuthError(error: unknown, response: Response, requestId: string, next: NextFunction): void {
  if (error instanceof AuthServiceError) {
    sendFailure(response, error.statusCode, error.code, error.safeMessage, requestId);
    return;
  }
  next(error);
}

export function registerAuthRoutes(
  app: Express,
  environment: ApiEnvironment,
  useCases?: AuthUseCases,
): void {
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
}
