import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import type { CustomerRepository } from './customers.contracts';
import { customerIdSchema, listCustomersQuerySchema } from './customers.schemas';
export function registerCustomersRoutes(
  app: Express,
  _environment: ApiEnvironment,
  auth: AuthUseCases | undefined,
  repository: CustomerRepository,
): void {
  const authenticate = requireAuthenticatedUser(auth);
  const authorize = requirePermission(auth, 'view_customers');
  app.get(
    '/api/v1/customers',
    authenticate,
    authorize,
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
  app.get('/api/v1/customers/:customerId', authenticate, authorize, async (request, response, next) => {
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
