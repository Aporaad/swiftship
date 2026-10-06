import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { sendFailure, sendSuccess } from '../../core/http/response';
import { portalChangePasswordInputSchema, portalLoginInputSchema, portalRefreshInputSchema } from './portal-auth.schemas';
import { PortalAuthService, PortalAuthServiceError } from './portal-auth.service';

function principal(response: Response) { return response.locals.portalPrincipal as { portalUserId: string; sessionId: string } | undefined; }
function handle(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof PortalAuthServiceError) return sendFailure(response, error.statusCode, error.code, error.safeMessage, String(response.locals.requestId));
  return next(error);
}

export function registerPortalAuthRoutes(app: Express, _environment: ApiEnvironment, service: PortalAuthService): void {
  const authenticate = async (request: Request, response: Response, next: NextFunction) => {
    const header = request.header('authorization') ?? '';
    if (!header.startsWith('Bearer ')) return sendFailure(response, 401, 'PORTAL_AUTH_REQUIRED', 'تسجيل الدخول إلى البوابة مطلوب.', String(response.locals.requestId));
    try { response.locals.portalPrincipal = service.authenticateAccessToken(header.slice(7)); return next(); }
    catch { return sendFailure(response, 401, 'PORTAL_AUTH_INVALID_TOKEN', 'جلسة البوابة غير صالحة أو منتهية.', String(response.locals.requestId)); }
  };
  app.post('/api/v1/portal/auth/login', async (request, response, next) => { const input = portalLoginInputSchema.safeParse(request.body); if (!input.success) return sendFailure(response, 400, 'INVALID_PORTAL_AUTH_INPUT', 'بيانات الدخول غير صالحة.', String(response.locals.requestId)); try { return sendSuccess(response, await service.login(input.data), String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.post('/api/v1/portal/auth/refresh', async (request, response, next) => { const input = portalRefreshInputSchema.safeParse(request.body); if (!input.success) return sendFailure(response, 400, 'INVALID_PORTAL_AUTH_INPUT', 'رمز التحديث غير صالح.', String(response.locals.requestId)); try { return sendSuccess(response, await service.refresh(input.data.refreshToken), String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.post('/api/v1/portal/auth/logout', async (request, response, next) => { const input = portalRefreshInputSchema.safeParse(request.body); if (!input.success) return sendFailure(response, 400, 'INVALID_PORTAL_AUTH_INPUT', 'رمز التحديث غير صالح.', String(response.locals.requestId)); try { await service.logout(input.data.refreshToken); return sendSuccess(response, { loggedOut: true }, String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.get('/api/v1/portal/auth/me', authenticate, async (_request, response, next) => { try { const p = principal(response); if (!p) return sendFailure(response, 401, 'PORTAL_AUTH_REQUIRED', 'تسجيل الدخول إلى البوابة مطلوب.', String(response.locals.requestId)); return sendSuccess(response, await service.profile(p.portalUserId), String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.patch('/api/v1/portal/auth/password', authenticate, async (request, response, next) => { const input = portalChangePasswordInputSchema.safeParse(request.body); const p = principal(response); if (!input.success || !p) return sendFailure(response, 400, 'INVALID_PORTAL_AUTH_INPUT', 'بيانات تغيير كلمة المرور غير صالحة.', String(response.locals.requestId)); try { await service.changePassword({ portalUserId: p.portalUserId, ...input.data }); return sendSuccess(response, { changed: true }, String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
}
