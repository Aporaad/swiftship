import type { Express, NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../core/auth/require-permission';
import type { PortalAuthService } from './portal-auth.service';
import { PortalAuthServiceError } from './portal-auth.service';
import { PortalOwnedService, PortalOwnedServiceError } from './portal-owned.service';
import type { AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import {
  portalCustomerDetailsUpdateSchema,
  portalOrderCreateSchema,
  portalPaymentRequestCreateSchema,
  portalPaymentRequestIdSchema,
  portalPaymentRequestRejectSchema,
  portalPaymentRequestSettleSchema,
  portalTicketCreateSchema,
} from './portal-owned.schemas';
import { sendFailure, sendSuccess } from '../../core/http/response';

function principal(response: Response): { portalUserId: string; sessionId: string } | undefined {
  return response.locals.portalPrincipal as { portalUserId: string; sessionId: string } | undefined;
}

function staffUserId(response: Response): string | undefined {
  return (response.locals.authPrincipal as { userId?: string } | undefined)?.userId;
}

function handle(error: unknown, response: Response, next: NextFunction) {
  const requestId = String(response.locals.requestId);
  if (error instanceof PortalOwnedServiceError || error instanceof PortalAuthServiceError) {
    return sendFailure(response, error.statusCode, error.code, error.safeMessage, requestId);
  }
  if (error instanceof Error && error.message === 'IDEMPOTENCY_KEY_CONFLICT') {
    return sendFailure(response, 409, 'IDEMPOTENCY_KEY_CONFLICT', 'أُعيد استخدام مفتاح الطلب لعملية أخرى.', requestId);
  }
  if (error instanceof Error && error.message === 'PORTAL_ORDER_SOURCE_NOT_ACTIVE') {
    return sendFailure(response, 409, 'PORTAL_ORDER_SOURCE_NOT_ACTIVE', 'مصدر الطلب المحدد لم يعد متاحاً.', requestId);
  }
  return next(error);
}

const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
}).strict();

export function registerPortalOwnedRoutes(
  app: Express,
  authService: PortalAuthService,
  service: PortalOwnedService,
  systemAuth?: AuthUseCases,
): void {
  const authenticate = (request: Request, response: Response, next: NextFunction) => {
    const authorization = request.header('authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) {
      return sendFailure(response, 401, 'PORTAL_AUTH_REQUIRED', 'تسجيل الدخول إلى البوابة مطلوب.', String(response.locals.requestId));
    }
    try {
      response.locals.portalPrincipal = authService.authenticateAccessToken(authorization.slice(7));
      return next();
    } catch {
      return sendFailure(response, 401, 'PORTAL_AUTH_INVALID_TOKEN', 'جلسة البوابة غير صالحة أو منتهية.', String(response.locals.requestId));
    }
  };
  const requireFinanceReviewer = requireAuthenticatedUser(systemAuth);
  const canViewFinance = requirePermission(systemAuth, 'view_finance');
  const canPostFinancialEntries = requirePermission(systemAuth, 'post_financial_entries');

  app.get('/api/v1/portal/tickets', authenticate, async (request, response, next) => {
    const parsedQuery = pageQuerySchema.safeParse(request.query);
    const authenticated = principal(response);
    if (!parsedQuery.success || !authenticated) {
      return sendFailure(response, 400, 'INVALID_PORTAL_TICKET_QUERY', 'معاملات التصفح غير صالحة.', String(response.locals.requestId));
    }
    try {
      const tickets = await service.listTickets({
        portalUserId: authenticated.portalUserId,
        ...parsedQuery.data,
      });
      return sendSuccess(response, tickets, String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });

  app.post('/api/v1/portal/tickets', authenticate, async (request, response, next) => {
    const parsedBody = portalTicketCreateSchema.safeParse(request.body);
    const authenticated = principal(response);
    if (!parsedBody.success || !authenticated) {
      return sendFailure(response, 400, 'INVALID_PORTAL_TICKET_INPUT', 'بيانات التذكرة غير صالحة.', String(response.locals.requestId));
    }
    try {
      const ticket = await service.createTicket({ portalUserId: authenticated.portalUserId, ticket: parsedBody.data });
      response.status(201);
      return sendSuccess(response, ticket, String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });

  app.get('/api/v1/portal/customer-details', authenticate, async (_request, response, next) => {
    const authenticated = principal(response);
    if (!authenticated) {
      return sendFailure(response, 401, 'PORTAL_AUTH_REQUIRED', 'تسجيل الدخول إلى البوابة مطلوب.', String(response.locals.requestId));
    }
    try {
      const details = await service.getCustomerDetails(authenticated.portalUserId);
      return sendSuccess(response, details, String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });

  app.put('/api/v1/portal/customer-details', authenticate, async (request, response, next) => {
    const parsedBody = portalCustomerDetailsUpdateSchema.safeParse(request.body);
    const authenticated = principal(response);
    if (!parsedBody.success || !authenticated) {
      return sendFailure(response, 400, 'INVALID_PORTAL_CUSTOMER_DETAILS', 'بيانات ملف العميل غير صالحة.', String(response.locals.requestId));
    }
    try {
      const details = await service.saveCustomerDetails({
        portalUserId: authenticated.portalUserId,
        details: parsedBody.data,
      });
      return sendSuccess(response, details, String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });

  app.get('/api/v1/portal/orders', authenticate, async (request, response, next) => {
    const parsedQuery = pageQuerySchema.safeParse(request.query);
    const authenticated = principal(response);
    if (!parsedQuery.success || !authenticated) {
      return sendFailure(response, 400, 'INVALID_PORTAL_ORDER_QUERY', 'معاملات التصفح غير صالحة.', String(response.locals.requestId));
    }
    try {
      const orders = await service.listCustomerOrders({
        portalUserId: authenticated.portalUserId,
        ...parsedQuery.data,
      });
      return sendSuccess(response, orders, String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });

  app.post('/api/v1/portal/orders', authenticate, async (request, response, next) => {
    const parsedBody = portalOrderCreateSchema.safeParse(request.body);
    const authenticated = principal(response);
    const idempotencyKey = request.header('Idempotency-Key');
    if (!parsedBody.success || !authenticated || !idempotencyKey) {
      return sendFailure(response, 400, 'INVALID_PORTAL_ORDER_INPUT', 'بيانات الطلب أو مفتاح منع التكرار غير صالح.', String(response.locals.requestId));
    }
    try {
      const order = await service.createCustomerOrder({
        portalUserId: authenticated.portalUserId,
        idempotencyKey,
        order: parsedBody.data,
      });
      response.status(201);
      return sendSuccess(response, order, String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });

  app.get('/api/v1/portal/payment-requests', authenticate, async (request, response, next) => {
    const parsedQuery = pageQuerySchema.safeParse(request.query);
    const authenticated = principal(response);
    if (!parsedQuery.success || !authenticated) {
      return sendFailure(response, 400, 'INVALID_PORTAL_PAYMENT_REQUEST_QUERY', 'معاملات التصفح غير صالحة.', String(response.locals.requestId));
    }
    try {
      const requests = await service.listPaymentRequests({ portalUserId: authenticated.portalUserId, ...parsedQuery.data });
      return sendSuccess(response, requests, String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });

  app.post('/api/v1/portal/payment-requests', authenticate, async (request, response, next) => {
    const parsedBody = portalPaymentRequestCreateSchema.safeParse(request.body as unknown);
    const authenticated = principal(response);
    const idempotencyKey = request.header('Idempotency-Key');
    if (!parsedBody.success || !authenticated || !idempotencyKey) {
      return sendFailure(response, 400, 'INVALID_PORTAL_PAYMENT_REQUEST', 'بيانات طلب السداد أو مفتاح منع التكرار غير صالح.', String(response.locals.requestId));
    }
    try {
      const paymentRequest = await service.createPaymentRequest({
        portalUserId: authenticated.portalUserId,
        idempotencyKey,
        request: parsedBody.data,
      });
      response.status(201);
      return sendSuccess(response, paymentRequest, String(response.locals.requestId));
    } catch (error) {
      return handle(error, response, next);
    }
  });

  app.get(
    '/api/v1/finance/portal-payment-requests',
    requireFinanceReviewer,
    canViewFinance,
    async (request, response, next) => {
      const parsedQuery = pageQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return sendFailure(response, 400, 'INVALID_PORTAL_PAYMENT_REVIEW_QUERY', 'معاملات التصفح غير صالحة.', String(response.locals.requestId));
      }
      try {
        const requests = await service.listPaymentRequestsForReview(parsedQuery.data);
        return sendSuccess(response, requests, String(response.locals.requestId));
      } catch (error) {
        return handle(error, response, next);
      }
    },
  );

  app.post(
    '/api/v1/finance/portal-payment-requests/:id/settle',
    requireFinanceReviewer,
    canPostFinancialEntries,
    async (request, response, next) => {
      const paymentRequestId = portalPaymentRequestIdSchema.safeParse(request.params.id);
      const body = portalPaymentRequestSettleSchema.safeParse(request.body as unknown);
      const reviewerId = staffUserId(response);
      if (!paymentRequestId.success || !body.success || !reviewerId) {
        return sendFailure(response, 400, 'INVALID_PORTAL_PAYMENT_SETTLEMENT', 'بيانات تسوية طلب السداد غير صالحة.', String(response.locals.requestId));
      }
      try {
        const settled = await service.settlePaymentRequest({
          paymentRequestId: paymentRequestId.data,
          financeEntryId: body.data.financeEntryId,
          reviewerId,
        });
        return sendSuccess(response, settled, String(response.locals.requestId));
      } catch (error) {
        return handle(error, response, next);
      }
    },
  );

  app.post(
    '/api/v1/finance/portal-payment-requests/:id/reject',
    requireFinanceReviewer,
    canPostFinancialEntries,
    async (request, response, next) => {
      const paymentRequestId = portalPaymentRequestIdSchema.safeParse(request.params.id);
      const body = portalPaymentRequestRejectSchema.safeParse(request.body as unknown);
      const reviewerId = staffUserId(response);
      if (!paymentRequestId.success || !body.success || !reviewerId) {
        return sendFailure(response, 400, 'INVALID_PORTAL_PAYMENT_REJECTION', 'سبب رفض طلب السداد غير صالح.', String(response.locals.requestId));
      }
      try {
        const rejected = await service.rejectPaymentRequest({
          paymentRequestId: paymentRequestId.data,
          reviewerId,
          reviewNote: body.data.reviewNote,
        });
        return sendSuccess(response, rejected, String(response.locals.requestId));
      } catch (error) {
        return handle(error, response, next);
      }
    },
  );
}
