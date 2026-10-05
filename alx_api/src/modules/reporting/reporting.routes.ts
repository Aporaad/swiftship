import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import type { ReportingRepository, ReportingResource } from './reporting.contracts';
import { pageQuerySchema } from '../operations/operations.schemas';

const resources: Record<string, { resource: ReportingResource; permission: string }> = {
  expenses: { resource: 'expenses', permission: 'view_expenses' },
  couriers: { resource: 'couriers', permission: 'view_couriers' },
  employees: { resource: 'employees', permission: 'view_employees' },
  sources: { resource: 'sources', permission: 'view_sources' },
  'shipping-companies': { resource: 'shippingCompanies', permission: 'view_shipping_companies' },
  users: { resource: 'users', permission: 'view_users' },
  'activity-logs': { resource: 'activityLogs', permission: 'view_dashboard' },
  'report-templates': { resource: 'reportTemplates', permission: 'view_reports' },
};

export function registerReportingRoutes(
  app: Express,
  _environment: ApiEnvironment,
  auth: AuthUseCases | undefined,
  repository: ReportingRepository,
): void {
  for (const [path, definition] of Object.entries(resources)) {
    app.get(
      `/api/v1/reporting/${path}`,
      requireAuthenticatedUser(auth),
      requirePermission(auth, definition.permission),
      async (request: Request, response: Response, next: NextFunction) => {
        const requestId = String(response.locals.requestId);
        const parsed = pageQuerySchema.safeParse(request.query);
        if (!parsed.success)
          return sendFailure(response, 400, 'INVALID_REPORTING_QUERY', 'معاملات التقرير غير صالحة.', requestId);
        try {
          const result = await repository.list(definition.resource, parsed.data);
          return sendSuccess(response, result.items, requestId, { ...parsed.data, total: result.total });
        } catch (error) {
          return next(error);
        }
      },
    );
  }
}
