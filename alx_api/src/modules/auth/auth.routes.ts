import { rateLimit } from 'express-rate-limit';
import type { Express } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { sendFailure, sendSuccess } from '../../core/http/response';
import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
} from './auth.schemas';

export interface AuthTokenPairDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

/** Application port; production implementation must be backed by the approved PostgreSQL schema. */
export interface AuthUseCases {
  login(input: { identifier: string; password: string }): Promise<AuthTokenPairDto>;
  refresh(input: { refreshToken: string }): Promise<AuthTokenPairDto>;
  logout(input: { refreshToken: string }): Promise<void>;
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
      next(error);
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
      next(error);
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
      next(error);
    }
  });
}
