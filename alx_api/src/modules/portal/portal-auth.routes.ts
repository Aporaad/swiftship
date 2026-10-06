import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { sendFailure, sendSuccess } from '../../core/http/response';
import { portalChangePasswordInputSchema, portalLoginInputSchema, portalProfileUpdateInputSchema, portalRefreshInputSchema, portalRegisterInputSchema } from './portal-auth.schemas';
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
  app.post('/api/v1/portal/auth/register', async (request, response, next) => {
    const input = portalRegisterInputSchema.safeParse(request.body);
    if (!input.success) {
      return sendFailure(response, 400, 'INVALID_PORTAL_REGISTER_INPUT', 'بيانات التسجيل غير صالحة.', String(response.locals.requestId));
    }
    try {
      const profile = input.data;
      const registration = {
        fullName: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        password: profile.password,
        role: profile.portalRole,
        ...(profile.username !== undefined ? { username: profile.username } : {}),
        ...(profile.address !== undefined ? { address: profile.address } : {}),
        ...(profile.joinBy !== undefined ? { joinBy: profile.joinBy } : {}),
        ...(profile.referrerId !== undefined ? { referrerId: profile.referrerId } : {}),
        ...(profile.companyName !== undefined ? { companyName: profile.companyName } : {}),
        ...(profile.commercialRegister !== undefined ? { commercialRegister: profile.commercialRegister } : {}),
        ...(profile.courierType !== undefined ? { courierType: profile.courierType } : {}),
        ...(profile.identityDocNote !== undefined ? { identityDocNote: profile.identityDocNote } : {}),
      };
      return sendSuccess(response, await service.register(registration), String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });
  app.post('/api/v1/portal/auth/login', async (request, response, next) => { const input = portalLoginInputSchema.safeParse(request.body); if (!input.success) return sendFailure(response, 400, 'INVALID_PORTAL_AUTH_INPUT', 'بيانات الدخول غير صالحة.', String(response.locals.requestId)); try { return sendSuccess(response, await service.login(input.data), String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.post('/api/v1/portal/auth/refresh', async (request, response, next) => { const input = portalRefreshInputSchema.safeParse(request.body); if (!input.success) return sendFailure(response, 400, 'INVALID_PORTAL_AUTH_INPUT', 'رمز التحديث غير صالح.', String(response.locals.requestId)); try { return sendSuccess(response, await service.refresh(input.data.refreshToken), String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.post('/api/v1/portal/auth/logout', async (request, response, next) => { const input = portalRefreshInputSchema.safeParse(request.body); if (!input.success) return sendFailure(response, 400, 'INVALID_PORTAL_AUTH_INPUT', 'رمز التحديث غير صالح.', String(response.locals.requestId)); try { await service.logout(input.data.refreshToken); return sendSuccess(response, { loggedOut: true }, String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.get('/api/v1/portal/auth/me', authenticate, async (_request, response, next) => { try { const p = principal(response); if (!p) return sendFailure(response, 401, 'PORTAL_AUTH_REQUIRED', 'تسجيل الدخول إلى البوابة مطلوب.', String(response.locals.requestId)); return sendSuccess(response, await service.profile(p.portalUserId), String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.patch('/api/v1/portal/auth/profile', authenticate, async (request, response, next) => { const input = portalProfileUpdateInputSchema.safeParse(request.body); const p = principal(response); if (!input.success || !p) return sendFailure(response, 400, 'INVALID_PORTAL_PROFILE_INPUT', 'بيانات الملف الشخصي غير صالحة.', String(response.locals.requestId)); try { const profile = { portalUserId: p.portalUserId, ...(input.data.fullName ? { fullName: input.data.fullName } : {}), ...(input.data.phone ? { phone: input.data.phone } : {}), ...(input.data.address !== undefined ? { address: input.data.address } : {}) }; return sendSuccess(response, await service.updateProfile(profile), String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
  app.patch('/api/v1/portal/auth/password', authenticate, async (request, response, next) => { const input = portalChangePasswordInputSchema.safeParse(request.body); const p = principal(response); if (!input.success || !p) return sendFailure(response, 400, 'INVALID_PORTAL_AUTH_INPUT', 'بيانات تغيير كلمة المرور غير صالحة.', String(response.locals.requestId)); try { await service.changePassword({ portalUserId: p.portalUserId, ...input.data }); return sendSuccess(response, { changed: true }, String(response.locals.requestId)); } catch (error) { return handle(error, response, next); } });
}
