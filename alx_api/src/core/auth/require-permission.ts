import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { sendFailure } from '../http/response';
import type { AuthPrincipalDto, AuthUseCases } from '../../modules/auth/auth.contracts';

const PERMISSION_CODE_PATTERN = /^[a-z][a-z0-9_.:-]{1,127}$/;

export function requirePermission(useCases: AuthUseCases | undefined, permissionCode: string): RequestHandler {
  if (!PERMISSION_CODE_PATTERN.test(permissionCode)) {
    throw new TypeError('A canonical permission code is required.');
  }

  return async (_request: Request, response: Response, next: NextFunction) => {
    const requestId = String(response.locals.requestId ?? '');
    const principal = response.locals.authPrincipal as AuthPrincipalDto | undefined;
    if (!useCases || !principal?.userId) {
      sendFailure(response, 401, 'AUTH_INVALID_CREDENTIALS', 'بيانات المصادقة غير صحيحة.', requestId);
      return;
    }

    try {
      const permissions = await useCases.listPermissions({ userId: principal.userId });
      if (!permissions.includes(permissionCode)) {
        sendFailure(response, 403, 'AUTH_FORBIDDEN', 'لا تملك الصلاحية المطلوبة.', requestId);
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
