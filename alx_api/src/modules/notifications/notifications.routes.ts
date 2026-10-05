/**
 * notifications.routes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * المسارات والـ Endpoints الخاصة بوحدة الإشعارات (Notifications HTTP Routes).
 * Notifications module routes - follows standard Route/Controller pattern used across all modules.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import type { ApiEnvironment } from '../../config/env';
import type { AuthUseCases } from '../auth/auth.contracts';
import type { NotificationsRepository } from './notifications.contracts';
import { requirePermission } from '../../core/auth/require-permission';
import { sendFailure, sendSuccess } from '../../core/http/response';
import { requireAuthenticatedUser } from '../auth/auth.routes';
import {
  createNotificationSchema,
  pageQuerySchema,
  sendExternalNotificationSchema,
} from './notifications.schemas';

// دالة مساعدة لاستخراج requestId من الاستجابة
// Helper to extract requestId from response locals
function requestId(response: Response): string {
  return String(response.locals.requestId ?? '');
}

// دالة مساعدة لاستخراج userId من الـ principal المصادق عليه
// Helper to extract userId from authenticated principal
function principalId(response: Response): string | undefined {
  return (response.locals.authPrincipal as { userId?: string } | undefined)?.userId;
}

// دالة مساعدة لإنشاء middleware chain للمصادقة والصلاحية
// Helper to build authentication + permission middleware chain
function route(permission: string, auth: AuthUseCases | undefined) {
  return [requireAuthenticatedUser(auth), requirePermission(auth, permission)];
}

export function registerNotificationsRoutes(
  app: Express,
  _environment: ApiEnvironment,
  auth: AuthUseCases | undefined,
  repository: NotificationsRepository,
): void {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. GET /api/v1/notifications — قائمة الإشعارات (مع فلترة وترقيم)
  // List notifications with filtering by userId/isRead and pagination
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/v1/notifications', ...route('view_notifications', auth), async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parsed = pageQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendFailure(response, 400, 'INVALID_INPUT', 'المعاملات غير صحيحة.', requestId(response));
      }

      // إذا لم يحدد userId، نستخدم userId المصادق عليه
      // If no userId specified, use the authenticated user's ID
      const userId = parsed.data.userId ?? principalId(response);
      const result = await repository.listNotifications({
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        ...(userId !== undefined ? { userId } : {}),
        ...(parsed.data.isRead !== undefined ? { isRead: parsed.data.isRead } : {}),
      });

      return sendSuccess(response, result.items, requestId(response), {
        total: result.total,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
    } catch (error) {
      return next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. POST /api/v1/notifications — إنشاء إشعار داخلي للمستخدم
  // Create an in-app notification for a user
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/v1/notifications', ...route('manage_notifications', auth), async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parsed = createNotificationSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendFailure(response, 400, 'INVALID_INPUT', 'البيانات غير صحيحة.', requestId(response));
      }

      const actorId = principalId(response);
      const notification = await repository.createNotification({
        title: parsed.data.title,
        body: parsed.data.body,
        type: parsed.data.type,
        channel: parsed.data.channel,
        ...(parsed.data.userId !== undefined ? { userId: parsed.data.userId } : {}),
        ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
        ...(actorId !== undefined ? { actorId } : {}),
      });

      return sendSuccess(response, notification, requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PATCH /api/v1/notifications/:id/read — تعليم الإشعار كمقروء
  // Mark a specific notification as read
  // ─────────────────────────────────────────────────────────────────────────
  app.patch('/api/v1/notifications/:id/read', ...route('view_notifications', auth), async (request: Request, response: Response, next: NextFunction) => {
    try {
      const notificationId = String(request.params['id'] ?? '').trim();
      if (!notificationId) {
        return sendFailure(response, 400, 'INVALID_INPUT', 'معرف الإشعار مطلوب.', requestId(response));
      }

      const userId = principalId(response);
      const updated = await repository.markAsRead(notificationId, userId);
      if (!updated) {
        return sendFailure(response, 404, 'NOTIFICATION_NOT_FOUND', 'الإشعار غير موجود أو لا تملك صلاحية الوصول إليه.', requestId(response));
      }

      return sendSuccess(response, updated, requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. POST /api/v1/notifications/read-all — تعليم جميع إشعارات المستخدم كمقروءة
  // Mark all notifications for the authenticated user as read
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/v1/notifications/read-all', ...route('view_notifications', auth), async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const userId = principalId(response);
      if (!userId) {
        return sendFailure(response, 401, 'UNAUTHORIZED', 'غير مصرح.', requestId(response));
      }

      const count = await repository.markAllAsRead(userId);
      return sendSuccess(response, { updatedCount: count }, requestId(response));
    } catch (error) {
      return next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. POST /api/v1/notifications/send-external — إرسال إشعار خارجي عبر Outbox Pattern
  // Send an external notification (WhatsApp/Email/SMS) via transactional outbox
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/v1/notifications/send-external', ...route('manage_notifications', auth), async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parsed = sendExternalNotificationSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendFailure(response, 400, 'INVALID_INPUT', 'البيانات غير صحيحة.', requestId(response));
      }

      const result = await repository.recordOutboxEvent({
        recipient: parsed.data.recipient,
        channel: parsed.data.channel,
        message: parsed.data.message,
        ...(parsed.data.templateId !== undefined ? { templateId: parsed.data.templateId } : {}),
        ...(parsed.data.idempotencyKey !== undefined ? { idempotencyKey: parsed.data.idempotencyKey } : {}),
        ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
      });

      // 202 Accepted: الإشعار في قائمة الانتظار وليس مرسلاً فوراً
      // 202 Accepted: notification queued, not sent immediately
      response.status(202);
      return sendSuccess(response, result, requestId(response));
    } catch (error) {
      return next(error);
    }
  });
}
