import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthPrincipalDto, AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import type { CustomerRepository } from './customers.contracts';
import {
  createCustomerSchema,
  customerIdSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from './customers.schemas';

function principal(response: Response): AuthPrincipalDto | undefined {
  return response.locals.authPrincipal as AuthPrincipalDto | undefined;
}

export function registerCustomersRoutes(
  app: Express,
  _environment: ApiEnvironment,
  auth: AuthUseCases | undefined,
  repository: CustomerRepository,
): void {
  const authenticate = requireAuthenticatedUser(auth);
  const viewCustomers = requirePermission(auth, 'view_customers');
  const createCustomers = requirePermission(auth, 'add_customers');
  const editCustomers = requirePermission(auth, 'edit_customers');
  const deleteCustomers = requirePermission(auth, 'delete_customers');

  app.get(
    '/api/v1/customers',
    authenticate,
    viewCustomers,
    async (request: Request, response: Response, next: NextFunction) => {
      const id = String(response.locals.requestId);
      const parsed = listCustomersQuerySchema.safeParse(request.query);
      if (!parsed.success) return sendFailure(response, 400, 'INVALID_CUSTOMERS_QUERY', 'معاملات البحث غير صالحة.', id);
      try {
        const result = await repository.list(parsed.data);
        return sendSuccess(response, result.items, id, {
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          total: result.total,
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  app.post(
    '/api/v1/customers',
    authenticate,
    createCustomers,
    async (request: Request, response: Response, next: NextFunction) => {
      const id = String(response.locals.requestId);
      const actor = principal(response);
      const parsed = createCustomerSchema.safeParse(request.body as unknown);
      if (!parsed.success || !actor) {
        return sendFailure(response, 400, 'INVALID_CUSTOMER_INPUT', 'بيانات العميل غير صالحة.', id);
      }
      try {
        const customer = await repository.create(parsed.data, actor.userId);
        return sendSuccess(response, customer, id);
      } catch (error) {
        return next(error);
      }
    },
  );

  app.patch(
    '/api/v1/customers/:customerId',
    authenticate,
    editCustomers,
    async (request: Request, response: Response, next: NextFunction) => {
      const id = String(response.locals.requestId);
      const actor = principal(response);
      const customerId = customerIdSchema.safeParse(request.params.customerId);
      const parsed = updateCustomerSchema.safeParse(request.body as unknown);
      if (!customerId.success || !parsed.success || !actor) {
        return sendFailure(response, 400, 'INVALID_CUSTOMER_INPUT', 'بيانات تعديل العميل غير صالحة.', id);
      }
      try {
        const customer = await repository.update(customerId.data, parsed.data, actor.userId);
        if (!customer) return sendFailure(response, 404, 'CUSTOMER_NOT_FOUND', 'العميل غير موجود.', id);
        return sendSuccess(response, customer, id);
      } catch (error) {
        return next(error);
      }
    },
  );

  app.delete(
    '/api/v1/customers/:customerId',
    authenticate,
    deleteCustomers,
    async (request: Request, response: Response, next: NextFunction) => {
      const id = String(response.locals.requestId);
      const actor = principal(response);
      const customerId = customerIdSchema.safeParse(request.params.customerId);
      if (!customerId.success || !actor) {
        return sendFailure(response, 400, 'INVALID_CUSTOMER_ID', 'معرف العميل غير صالح.', id);
      }
      try {
        const customer = await repository.archive(customerId.data, actor.userId);
        if (!customer) return sendFailure(response, 404, 'CUSTOMER_NOT_FOUND', 'العميل غير موجود.', id);
        return sendSuccess(response, customer, id);
      } catch (error) {
        return next(error);
      }
    },
  );

  app.get('/api/v1/customers/:customerId', authenticate, viewCustomers, async (request, response, next) => {
    const id = String(response.locals.requestId);
    const parsed = customerIdSchema.safeParse(request.params.customerId);
    if (!parsed.success) return sendFailure(response, 400, 'INVALID_CUSTOMER_ID', 'معرف العميل غير صالح.', id);
    try {
      const customer = await repository.findById(parsed.data);
      if (!customer) return sendFailure(response, 404, 'CUSTOMER_NOT_FOUND', 'العميل غير موجود.', id);
      return sendSuccess(response, customer, id);
    } catch (error) {
      return next(error);
    }
  });
}
