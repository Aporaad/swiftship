import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import type { AuthUseCases } from '../auth/auth.contracts';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import type { FinanceRepository } from './finance.contracts';
import {
  autoEntryRuleSchema,
  createEntrySchema,
  entityIdSchema,
  pageQuerySchema,
  reverseEntrySchema,
} from './finance.schemas';

function requestId(response: Response): string {
  return String(response.locals.requestId ?? '');
}
function principalId(response: Response): string | undefined {
  return (response.locals.authPrincipal as { userId?: string } | undefined)?.userId;
}
function route(permission: string, auth: AuthUseCases | undefined) {
  return [requireAuthenticatedUser(auth), requirePermission(auth, permission)];
}
function pageHandler(
  load: (query: {
    limit: number;
    offset: number;
    search?: string | undefined;
  }) => Promise<{ items: readonly Record<string, unknown>[]; total: number }>,
) {
  return async (request: Request, response: Response, next: NextFunction) => {
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
}
function idParam(request: Request, response: Response): string | undefined {
  const parsed = entityIdSchema.safeParse(request.params.id);
  if (!parsed.success) {
    sendFailure(response, 400, 'INVALID_ENTITY_ID', 'المعرف غير صالح.', requestId(response));
    return undefined;
  }
  return parsed.data;
}
function writeError(error: unknown, response: Response, next: NextFunction): void {
  if (error instanceof Error && /غير متوازن|balance|balanced/i.test(error.message)) {
    sendFailure(response, 422, 'FINANCIAL_ENTRY_NOT_BALANCED', 'لا يمكن إنشاء قيد غير متوازن.', requestId(response));
    return;
  }
  next(error);
}

export function registerFinanceRoutes(
  app: Express,
  _environment: ApiEnvironment,
  auth: AuthUseCases | undefined,
  repository: FinanceRepository,
): void {
  app.get('/api/v1/finance/accounts', ...route('view_financial_accounts', auth), pageHandler(repository.listAccounts));
  app.get(
    '/api/v1/finance/accounts/:id',
    ...route('view_financial_accounts', auth),
    async (request, response, next) => {
      const id = idParam(request, response);
      if (!id) return;
      try {
        const result = await repository.getAccount(id);
        return result
          ? sendSuccess(response, result, requestId(response))
          : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'الحساب غير موجود.', requestId(response));
      } catch (error) {
        return next(error);
      }
    },
  );
  app.get(
    '/api/v1/finance/accounts/:id/movements',
    ...route('view_account_movements', auth),
    async (request, response, next) => {
      const id = idParam(request, response);
      if (!id) return;
      const query = pageQuerySchema.safeParse(request.query);
      if (!query.success)
        return sendFailure(response, 400, 'INVALID_PAGE_QUERY', 'معاملات الصفحة غير صالحة.', requestId(response));
      try {
        const result = await repository.listAccountMovements(id, query.data);
        return sendSuccess(response, result.items, requestId(response), { ...query.data, total: result.total });
      } catch (error) {
        return next(error);
      }
    },
  );
  app.get('/api/v1/finance/account-movements', ...route('view_account_movements', auth), pageHandler(repository.listAllAccountMovements));
  app.get('/api/v1/finance/entry-modules', ...route('view_entry_settings', auth), async (_request, response, next) => {
    try {
      return sendSuccess(response, await repository.listEntryModules(), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.get('/api/v1/finance/entry-types', ...route('view_entry_settings', auth), async (request, response, next) => {
    const moduleId = typeof request.query.moduleId === 'string' ? request.query.moduleId : undefined;
    try {
      return sendSuccess(response, await repository.listEntryTypes(moduleId), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.get('/api/v1/finance/entries', ...route('view_finance', auth), pageHandler(repository.listEntries));
  app.get('/api/v1/finance/entries/:id', ...route('view_finance', auth), async (request, response, next) => {
    const id = idParam(request, response);
    if (!id) return;
    try {
      const result = await repository.getEntry(id);
      return result
        ? sendSuccess(response, result, requestId(response))
        : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'القيد غير موجود.', requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.post('/api/v1/finance/entries', ...route('add_finance', auth), async (request, response, next) => {
    const body = createEntrySchema.safeParse(request.body as unknown);
    const actorId = principalId(response);
    if (!body.success || !actorId)
      return sendFailure(
        response,
        400,
        'INVALID_FINANCIAL_ENTRY',
        'بيانات القيد المالي غير صالحة أو غير مكتملة.',
        requestId(response),
      );
    try {
      const { notes, attachments, ...entry } = body.data;
      return sendSuccess(
        response,
        await repository.createEntry({
          ...entry,
          ...(notes !== undefined ? { notes } : {}),
          ...(attachments !== undefined ? { attachments } : {}),
          createdByUid: actorId,
        }),
        requestId(response),
      );
    } catch (error) {
      return writeError(error, response, next);
    }
  });
  app.post(
    '/api/v1/finance/entries/:id/post',
    ...route('post_financial_entries', auth),
    async (request, response, next) => {
      const id = idParam(request, response);
      if (!id) return;
      try {
        return sendSuccess(response, await repository.postEntry(id), requestId(response));
      } catch (error) {
        return writeError(error, response, next);
      }
    },
  );
  app.post(
    '/api/v1/finance/entries/:id/reverse',
    ...route('reverse_financial_entries', auth),
    async (request, response, next) => {
      const id = idParam(request, response);
      if (!id) return;
      const body = reverseEntrySchema.safeParse(request.body as unknown);
      const actorId = principalId(response);
      if (!body.success || !actorId)
        return sendFailure(response, 400, 'INVALID_REVERSAL', 'بيانات القيد العكسي غير صالحة.', requestId(response));
      try {
        const { effectiveAt, ...reversal } = body.data;
        return sendSuccess(
          response,
          await repository.reverseEntry({
            ...reversal,
            ...(effectiveAt !== undefined ? { effectiveAt } : {}),
            entryId: id,
            createdByUid: actorId,
          }),
          requestId(response),
        );
      } catch (error) {
        return writeError(error, response, next);
      }
    },
  );
  app.post(
    '/api/v1/finance/entries/:id/void',
    ...route('void_financial_entries', auth),
    async (request, response, next) => {
      const id = idParam(request, response);
      if (!id) return;
      try {
        return sendSuccess(response, await repository.voidDraft(id), requestId(response));
      } catch (error) {
        return writeError(error, response, next);
      }
    },
  );
  app.get(
    '/api/v1/finance/auto-entry-rules',
    ...route('view_auto_entries', auth),
    pageHandler(repository.listAutoEntryRules),
  );
  app.get(
    '/api/v1/finance/auto-entry-rules/:id',
    ...route('view_auto_entries', auth),
    async (request, response, next) => {
      const id = idParam(request, response);
      if (!id) return;
      try {
        const result = await repository.getAutoEntryRule(id);
        return result
          ? sendSuccess(response, result, requestId(response))
          : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'قاعدة القيد التلقائي غير موجودة.', requestId(response));
      } catch (error) {
        return next(error);
      }
    },
  );
  app.post('/api/v1/finance/auto-entry-rules', ...route('add_auto_entries', auth), async (request, response, next) => {
    const body = autoEntryRuleSchema.safeParse(request.body as unknown);
    if (!body.success)
      return sendFailure(
        response,
        400,
        'INVALID_AUTO_ENTRY_RULE',
        'بيانات قاعدة القيد التلقائي غير صالحة.',
        requestId(response),
      );
    try {
      return sendSuccess(response, await repository.createAutoEntryRule(body.data), requestId(response));
    } catch (error) {
      return next(error);
    }
  });
  app.patch(
    '/api/v1/finance/auto-entry-rules/:id',
    ...route('edit_auto_entries', auth),
    async (request, response, next) => {
      const id = idParam(request, response);
      if (!id) return;
      const body = autoEntryRuleSchema.safeParse(request.body as unknown);
      if (!body.success)
        return sendFailure(
          response,
          400,
          'INVALID_AUTO_ENTRY_RULE',
          'بيانات قاعدة القيد التلقائي غير صالحة.',
          requestId(response),
        );
      try {
        const result = await repository.updateAutoEntryRule({ ...body.data, autoEntryId: id });
        return result
          ? sendSuccess(response, result, requestId(response))
          : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'قاعدة القيد التلقائي غير موجودة.', requestId(response));
      } catch (error) {
        return next(error);
      }
    },
  );
  app.delete(
    '/api/v1/finance/auto-entry-rules/:id',
    ...route('delete_auto_entries', auth),
    async (request, response, next) => {
      const id = idParam(request, response);
      if (!id) return;
      try {
        const deleted = await repository.deleteAutoEntryRule(id);
        return deleted
          ? sendSuccess(response, { deleted: true }, requestId(response))
          : sendFailure(response, 404, 'ENTITY_NOT_FOUND', 'قاعدة القيد التلقائي غير موجودة.', requestId(response));
      } catch (error) {
        return next(error);
      }
    },
  );
  app.get(
    '/api/v1/finance/custody-advances',
    ...route('view_custody_advances', auth),
    pageHandler(repository.listCustodyAdvances),
  );
}
