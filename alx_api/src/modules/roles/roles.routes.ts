import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import { entityIdSchema, pageQuerySchema } from '../operations/operations.schemas';
import type { RolesRepository } from './roles.contracts';
import { createRoleSchema, updateRoleSchema } from './roles.schemas';

const requestId = (response: Response): string => String(response.locals.requestId ?? '');
const actorId = (response: Response): string | undefined => (response.locals.authPrincipal as { userId?: string } | undefined)?.userId;
const guard = (permission: string, auth: AuthUseCases | undefined) => [requireAuthenticatedUser(auth), requirePermission(auth, permission)];

export function registerRolesRoutes(app: Express, _environment: ApiEnvironment, auth: AuthUseCases | undefined, repository: RolesRepository): void {
  app.get('/api/v1/roles', ...guard('view_roles', auth), async (request: Request, response: Response, next: NextFunction) => {
    const query = pageQuerySchema.safeParse(request.query);
    if (!query.success) return sendFailure(response, 400, 'INVALID_PAGE_QUERY', 'معاملات الصفحة غير صالحة.', requestId(response));
    try { const result = await repository.listRoles(query.data); return sendSuccess(response, result.items, requestId(response), { ...query.data, total: result.total }); } catch (error) { return next(error); }
  });
  app.get('/api/v1/roles/permissions', ...guard('view_roles', auth), async (_request: Request, response: Response, next: NextFunction) => {
    try { return sendSuccess(response, await repository.listPermissions(), requestId(response)); } catch (error) { return next(error); }
  });
  app.post('/api/v1/roles', ...guard('add_roles', auth), async (request: Request, response: Response, next: NextFunction) => {
    const body = createRoleSchema.safeParse(request.body as unknown);
    if (!body.success) return sendFailure(response, 400, 'INVALID_ROLE_INPUT', 'بيانات الدور غير صالحة.', requestId(response));
    try {
      const actor = actorId(response);
      const input = {
        code: body.data.code,
        name: body.data.name,
        permissionCodes: body.data.permissionCodes,
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
        ...(actor ? { actorId: actor } : {}),
      };
      return sendSuccess(response, await repository.createRole(input), requestId(response));
    } catch (error) { return next(error); }
  });
  app.patch('/api/v1/roles/:id', ...guard('edit_roles', auth), async (request: Request, response: Response, next: NextFunction) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = updateRoleSchema.safeParse(request.body as unknown);
    if (!id.success || !body.success) return sendFailure(response, 400, 'INVALID_ROLE_INPUT', 'بيانات الدور غير صالحة.', requestId(response));
    try {
      const actor = actorId(response);
      const role = await repository.updateRole({
        roleId: id.data,
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
        ...(body.data.permissionCodes !== undefined ? { permissionCodes: body.data.permissionCodes } : {}),
        ...(actor ? { actorId: actor } : {}),
      });
      return role ? sendSuccess(response, role, requestId(response)) : sendFailure(response, 404, 'ROLE_NOT_FOUND', 'الدور غير موجود أو محمي.', requestId(response));
    } catch (error) { return next(error); }
  });
  app.delete('/api/v1/roles/:id', ...guard('delete_roles', auth), async (request: Request, response: Response, next: NextFunction) => {
    const id = entityIdSchema.safeParse(request.params.id);
    if (!id.success) return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    try {
      const deleted = await repository.deleteRole(id.data, actorId(response));
      return deleted ? sendSuccess(response, { deleted: true, roleId: id.data }, requestId(response)) : sendFailure(response, 409, 'ROLE_NOT_DELETABLE', 'الدور غير موجود أو محمي أو مرتبط بمستخدمين.', requestId(response));
    } catch (error) { return next(error); }
  });
}
