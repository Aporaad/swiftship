import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import { AuthServiceError } from '../auth/auth.use-cases';
import { entityIdSchema, pageQuerySchema } from '../operations/operations.schemas';
import type { UsersRepository } from './users.contracts';
import { adminResetPasswordSchema, createUserSchema, provisionUserSchema, setUserRolesSchema, updateUserSchema } from './users.schemas';

function requestId(response: Response): string {
  return String(response.locals.requestId ?? '');
}
function principalId(response: Response): string | undefined {
  return (response.locals.authPrincipal as { userId?: string } | undefined)?.userId;
}
function route(permission: string, auth: AuthUseCases | undefined) {
  return [requireAuthenticatedUser(auth), requirePermission(auth, permission)];
}

export function registerUsersRoutes(
  app: Express,
  _environment: ApiEnvironment,
  auth: AuthUseCases | undefined,
  repository: UsersRepository,
): void {
  app.get('/api/v1/users', ...route('view_users', auth), async (request: Request, response: Response, next: NextFunction) => {
    const query = pageQuerySchema.safeParse(request.query);
    if (!query.success)
      return sendFailure(response, 400, 'INVALID_PAGE_QUERY', 'معاملات الصفحة غير صالحة.', requestId(response));
    try {
      const result = await repository.listUsers(query.data);
      return sendSuccess(response, result.items, requestId(response), { ...query.data, total: result.total });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/v1/users/:id', ...route('view_users', auth), async (request: Request, response: Response, next: NextFunction) => {
    const parsed = entityIdSchema.safeParse(request.params.id);
    if (!parsed.success)
      return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    try {
      const result = await repository.getUser(parsed.data);
      return result
        ? sendSuccess(response, result, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'المستخدم غير موجود.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  /** Creates a profile only; the password is established by a one-time reset link. */
  app.post('/api/v1/users/provision', ...route('add_users', auth), async (request: Request, response: Response, next: NextFunction) => {
    const body = provisionUserSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!body.success || !auth)
      return sendFailure(response, 400, 'INVALID_PROVISIONING_INPUT', 'بيانات إنشاء المستخدم الآمن غير صالحة.', requestId(response));
    const { roleCodes, ...profile } = body.data;
    let created: Record<string, unknown> | undefined;
    try {
      created = await repository.createUser({ ...profile, disabled: false, actorId });
      if (roleCodes) await repository.setUserRoles(String(created.userId), roleCodes, actorId);
      await auth.requestPasswordReset({ identifier: profile.email });
      return sendSuccess(response, { user: created, invitationDispatched: true }, requestId(response));
    } catch (error) {
      if (created?.userId) {
        await repository.updateUser({ userId: String(created.userId), disabled: true, actorId }).catch(() => undefined);
      }
      if (error instanceof AuthServiceError) {
        return sendFailure(response, error.statusCode, error.code, error.safeMessage, requestId(response));
      }
      return next(error);
    }
  });

  app.post('/api/v1/users/:id/password', ...route('reset_passwords', auth), async (request: Request, response: Response, next: NextFunction) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = adminResetPasswordSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!id.success || !body.success || !auth || !actorId)
      return sendFailure(response, 400, 'INVALID_PASSWORD_INPUT', 'بيانات كلمة المرور غير صالحة.', requestId(response));
    try {
      await auth.adminResetPassword({ targetUserId: id.data, newPassword: body.data.newPassword, actorUserId: actorId });
      return sendSuccess(response, { changed: true, sessionsRevoked: true }, requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/v1/users', ...route('add_users', auth), async (request: Request, response: Response, next: NextFunction) => {
    const body = createUserSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!body.success)
      return sendFailure(response, 400, 'INVALID_USER_INPUT', 'بيانات المستخدم غير صالحة.', requestId(response));
    try {
      return sendSuccess(response, await repository.createUser({ ...body.data, actorId }), requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/api/v1/users/:id', ...route('edit_users', auth), async (request: Request, response: Response, next: NextFunction) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = updateUserSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!id.success || !body.success)
      return sendFailure(response, 400, 'INVALID_USER_INPUT', 'بيانات المستخدم غير صالحة.', requestId(response));
    try {
      const result = await repository.updateUser({ ...body.data, userId: id.data, ...(actorId ? { actorId } : {}) });
      return result
        ? sendSuccess(response, result, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'المستخدم غير موجود.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/v1/users/:id/roles', ...route('view_users', auth), async (request: Request, response: Response, next: NextFunction) => {
    const id = entityIdSchema.safeParse(request.params.id);
    if (!id.success)
      return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    try {
      const roles = await repository.listUserRoles(id.data);
      return sendSuccess(response, roles, requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/v1/users/:id/roles', ...route('manage_user_roles', auth), async (request: Request, response: Response, next: NextFunction) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = setUserRolesSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!id.success || !body.success)
      return sendFailure(response, 400, 'INVALID_USER_ROLES_INPUT', 'بيانات الأدوار غير صالحة.', requestId(response));
    try {
      const assigned = await repository.setUserRoles(id.data, body.data.roles, actorId);
      return sendSuccess(response, { userId: id.data, roles: assigned }, requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  /**
   * DELETE /api/v1/users/:id - حذف ناعم: تعطيل المستخدم بدلاً من حذفه نهائياً.
   * Root users محمية ولا يمكن تعطيلها عبر هذا endpoint.
   * Soft delete: disables user account; root users are protected.
   */
  app.delete('/api/v1/users/:id', ...route('delete_users', auth), async (request: Request, response: Response, next: NextFunction) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const actorId = principalId(response);
    if (!id.success)
      return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    // حماية: لا يمكن حذف النفس
    if (actorId && id.data === actorId)
      return sendFailure(response, 409, 'CANNOT_DELETE_SELF', 'لا يمكن تعطيل حسابك الخاص.', requestId(response));
    try {
      const deleted = await repository.deleteUser(id.data, actorId);
      return deleted
        ? sendSuccess(response, { disabled: true, userId: id.data }, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'المستخدم غير موجود أو هو مستخدم جذر.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });
}
