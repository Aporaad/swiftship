import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import type { OperationsRepository } from './operations.contracts';
import {
  createCourierSchema,
  createEmployeeSchema,
  createOrderInputSchema,
  entityIdSchema,
  pageQuerySchema,
  productInputSchema,
  shipmentInputSchema,
  updateCourierSchema,
  updateEmployeeSchema,
  updateOrderStatusInputSchema,
} from './operations.schemas';

function requestId(response: Response): string {
  return String(response.locals.requestId ?? '');
}
function principalId(response: Response): string | undefined {
  return (response.locals.authPrincipal as { userId?: string } | undefined)?.userId;
}
function route(permission: string, auth: AuthUseCases | undefined) {
  return [requireAuthenticatedUser(auth), requirePermission(auth, permission)];
}
function handleWriteError(error: unknown, response: Response, next: NextFunction): void {
  if (error instanceof Error && error.message === 'ORDER_STATUS_REGRESSION') {
    sendFailure(response, 409, 'ORDER_STATUS_REGRESSION', 'لا يمكن إرجاع حالة الطلب إلى الخلف.', requestId(response));
    return;
  }
  next(error);
}

export function registerOperationsRoutes(
  app: Express,
  _environment: ApiEnvironment,
  auth: AuthUseCases | undefined,
  repository: OperationsRepository,
): void {
  const list =
    (
      load: (query: {
        limit: number;
        offset: number;
        search?: string | undefined;
      }) => Promise<{ items: readonly Record<string, unknown>[]; total: number }>,
    ) =>
    async (request: Request, response: Response, next: NextFunction) => {
      const query = pageQuerySchema.safeParse(request.query);
      if (!query.success)
        return sendFailure(response, 400, 'INVALID_PAGE_QUERY', 'معاملات الصفحة غير صالحة.', requestId(response));
      try {
        const result = await load(query.data);
        return sendSuccess(response, result.items, requestId(response), { ...query.data, total: result.total });
      } catch (error) {
        return next(error);
      }
    };
  const single =
    (load: (key: string) => Promise<Record<string, unknown> | null>) =>
    async (request: Request, response: Response, next: NextFunction) => {
      const parsed = entityIdSchema.safeParse(request.params.id);
      if (!parsed.success)
        return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
      try {
        const result = await load(parsed.data);
        return result
          ? sendSuccess(response, result, requestId(response))
          : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'السجل غير موجود.', requestId(response));
      } catch (error) {
        return next(error);
      }
    };

  app.get('/api/v1/orders', ...route('view_orders', auth), list(repository.listOrders));
  app.get('/api/v1/orders/:id', ...route('view_orders', auth), single(repository.getOrder));
  app.get('/api/v1/orders/:id/history', ...route('view_orders', auth), async (request, response, next) => {
    const parsed = entityIdSchema.safeParse(request.params.id);
    if (!parsed.success)
      return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    try {
      return sendSuccess(response, await repository.listOrderHistory(parsed.data), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.post('/api/v1/orders', ...route('add_orders', auth), async (request, response, next) => {
    const parsed = createOrderInputSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    const key = request.get('Idempotency-Key')?.trim();
    if (!parsed.success || !actorId || !key || key.length > 200)
      return sendFailure(
        response,
        400,
        'INVALID_ORDER_INPUT',
        'بيانات الطلب أو مفتاح منع التكرار غير صالح.',
        requestId(response),
      );
    try {
      return sendSuccess(
        response,
        await repository.createOrder({ ...parsed.data, actorId, idempotencyKey: key }),
        requestId(response),
      );
    } catch (error) {
      return handleWriteError(error, response, next);
    }
  });
  app.patch('/api/v1/orders/:id/status', ...route('update_order_status', auth), async (request, response, next) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = updateOrderStatusInputSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!id.success || !body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_STATUS_INPUT', 'بيانات حالة الطلب غير صالحة.', requestId(response));
    try {
      const result = await repository.updateOrderStatus({ orderId: id.data, ...body.data, actorId });
      return 'notFound' in result
        ? sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'الطلب غير موجود.', requestId(response))
        : sendSuccess(response, result, requestId(response));
    } catch (error) {
      return handleWriteError(error, response, next);
    }
  });

  app.get('/api/v1/shipments', ...route('track_order', auth), list(repository.listShipments));
  app.get('/api/v1/shipments/:id', ...route('track_order', auth), single(repository.getShipment));
  app.get('/api/v1/shipments/:id/tracking', ...route('track_order', auth), async (request, response, next) => {
    const parsed = entityIdSchema.safeParse(request.params.id);
    if (!parsed.success)
      return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    try {
      return sendSuccess(response, await repository.listTracking(parsed.data), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.post('/api/v1/shipments', ...route('edit_orders', auth), async (request, response, next) => {
    const body = shipmentInputSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_SHIPMENT_INPUT', 'بيانات الشحنة غير صالحة.', requestId(response));
    try {
      const shipmentId = body.data.shipmentId ?? `sh_${crypto.randomUUID()}`;
      return sendSuccess(response, await repository.createShipment({ ...body.data, shipmentId, actorId }), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.patch('/api/v1/shipments/:id', ...route('edit_orders', auth), async (request, response, next) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = shipmentInputSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!id.success || !body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_SHIPMENT_INPUT', 'بيانات الشحنة غير صالحة.', requestId(response));
    try {
      const result = await repository.updateShipment({ ...body.data, shipmentId: id.data, actorId });
      return result
        ? sendSuccess(response, result, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'الشحنة غير موجودة.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/v1/products', ...route('view_products', auth), list(repository.listProducts));
  app.get('/api/v1/products/:id', ...route('view_products', auth), single(repository.getProduct));
  app.post('/api/v1/products', ...route('add_products', auth), async (request, response, next) => {
    const body = productInputSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_PRODUCT_INPUT', 'بيانات المنتج غير صالحة.', requestId(response));
    try {
      return sendSuccess(response, await repository.createProduct({ ...body.data, actorId }), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.patch('/api/v1/products/:id', ...route('edit_products', auth), async (request, response, next) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = productInputSchema.omit({ productId: true }).safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!id.success || !body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_PRODUCT_INPUT', 'بيانات المنتج غير صالحة.', requestId(response));
    try {
      const result = await repository.updateProduct({ productId: id.data, ...body.data, actorId });
      return result
        ? sendSuccess(response, result, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'المنتج غير موجود.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  // --- Couriers CRUD ---
  app.post('/api/v1/operations/couriers', ...route('add_couriers', auth), async (request, response, next) => {
    const body = createCourierSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_COURIER_INPUT', 'بيانات المندوب غير صالحة.', requestId(response));
    try {
      return sendSuccess(response, await repository.createCourier({ ...body.data, actorId }), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.patch('/api/v1/operations/couriers/:id', ...route('edit_couriers', auth), async (request, response, next) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = updateCourierSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!id.success || !body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_COURIER_INPUT', 'بيانات المندوب غير صالحة.', requestId(response));
    try {
      const courierChanges = {
        fullName: body.data.fullName,
        nameAr: body.data.nameAr,
        nameEn: body.data.nameEn,
        courierType: body.data.courierType,
        courierLevel: body.data.courierLevel,
        commissionRate: body.data.commissionRate,
        currency: body.data.currency,
        isActive: body.data.isActive,
        accountId: body.data.accountId,
      };
      const result = await repository.updateCourier({ courierId: id.data, ...courierChanges, actorId });
      return result
        ? sendSuccess(response, result, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'المندوب غير موجود.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.delete('/api/v1/operations/couriers/:id', ...route('delete_couriers', auth), async (request, response, next) => {
    const id = entityIdSchema.safeParse(request.params.id);
    if (!id.success)
      return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    try {
      const deleted = await repository.deleteCourier(id.data);
      return deleted
        ? sendSuccess(response, { deleted: true }, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'المندوب غير موجود.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  // --- Employees CRUD ---
  app.post('/api/v1/operations/employees', ...route('add_employees', auth), async (request, response, next) => {
    const body = createEmployeeSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_EMPLOYEE_INPUT', 'بيانات الموظف غير صالحة.', requestId(response));
    try {
      return sendSuccess(response, await repository.createEmployee({ ...body.data, actorId }), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.patch('/api/v1/operations/employees/:id', ...route('edit_employees', auth), async (request, response, next) => {
    const id = entityIdSchema.safeParse(request.params.id);
    const body = updateEmployeeSchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!id.success || !body.success || !actorId)
      return sendFailure(response, 400, 'INVALID_EMPLOYEE_INPUT', 'بيانات الموظف غير صالحة.', requestId(response));
    try {
      const employeeChanges = {
        fullName: body.data.fullName,
        nameAr: body.data.nameAr,
        nameEn: body.data.nameEn,
        jobType: body.data.jobType,
        monthlySalary: body.data.monthlySalary,
        commissionRate: body.data.commissionRate,
        currency: body.data.currency,
        accountId: body.data.accountId,
      };
      const result = await repository.updateEmployee({ employeeId: id.data, ...employeeChanges, actorId });
      return result
        ? sendSuccess(response, result, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'الموظف غير موجود.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.delete('/api/v1/operations/employees/:id', ...route('delete_employees', auth), async (request, response, next) => {
    const id = entityIdSchema.safeParse(request.params.id);
    if (!id.success)
      return sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    try {
      const deleted = await repository.deleteEmployee(id.data);
      return deleted
        ? sendSuccess(response, { deleted: true }, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'الموظف غير موجود.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });
}
