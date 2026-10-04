import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import type { OperationsRepository } from './operations.contracts';
import { entityIdSchema, pageQuerySchema } from './operations.schemas';
function id(value: unknown): string {
  return String(value ?? '');
}
export function registerOperationsRoutes(
  app: Express,
  _environment: ApiEnvironment,
  auth: AuthUseCases | undefined,
  repository: OperationsRepository,
): void {
  const authenticate = requireAuthenticatedUser(auth);
  const route = (permission: string) => [authenticate, requirePermission(auth, permission)];
  const list =
    (
      load: (query: {
        limit: number;
        offset: number;
        search?: string | undefined;
      }) => Promise<{ items: readonly Record<string, unknown>[]; total: number }>,
    ) =>
    async (request: Request, response: Response, next: NextFunction) => {
      const requestId = id(response.locals.requestId);
      const query = pageQuerySchema.safeParse(request.query);
      if (!query.success)
        return sendFailure(response, 400, 'INVALID_PAGE_QUERY', 'معاملات الصفحة غير صالحة.', requestId);
      try {
        const result = await load(query.data);
        return sendSuccess(response, result.items, requestId, {
          limit: query.data.limit,
          offset: query.data.offset,
          total: result.total,
        });
      } catch (error) {
        return next(error);
      }
    };
  const single =
    (load: (key: string) => Promise<Record<string, unknown> | null>) =>
    async (request: Request, response: Response, next: NextFunction) => {
      const requestId = id(response.locals.requestId);
      const parsed = entityIdSchema.safeParse(request.params.id);
      if (!parsed.success) return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId);
      try {
        const result = await load(parsed.data);
        return result
          ? sendSuccess(response, result, requestId)
          : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'السجل غير موجود.', requestId);
      } catch (error) {
        return next(error);
      }
    };
  app.get('/api/v1/orders', route('view_orders'), list(repository.listOrders));
  app.get('/api/v1/orders/:id', route('view_orders'), single(repository.getOrder));
  app.get(
    '/api/v1/orders/:id/history',
    route('view_orders'),
    async (request: Request, response: Response, next: NextFunction) => {
      const requestId = id(response.locals.requestId);
      const parsed = entityIdSchema.safeParse(request.params.id);
      if (!parsed.success) return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId);
      try {
        return sendSuccess(response, await repository.listOrderHistory(parsed.data), requestId);
      } catch (error) {
        return next(error);
      }
    },
  );
  app.get('/api/v1/shipments', route('track_order'), list(repository.listShipments));
  app.get('/api/v1/shipments/:id', route('track_order'), single(repository.getShipment));
  app.get(
    '/api/v1/shipments/:id/tracking',
    route('track_order'),
    async (request: Request, response: Response, next: NextFunction) => {
      const requestId = id(response.locals.requestId);
      const parsed = entityIdSchema.safeParse(request.params.id);
      if (!parsed.success) return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId);
      try {
        return sendSuccess(response, await repository.listTracking(parsed.data), requestId);
      } catch (error) {
        return next(error);
      }
    },
  );
  app.get('/api/v1/products', route('view_products'), list(repository.listProducts));
  app.get('/api/v1/products/:id', route('view_products'), single(repository.getProduct));
}
