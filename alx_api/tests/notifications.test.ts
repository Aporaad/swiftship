/**
 * notifications.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * اختبارات وحدة الإشعارات (Notifications Module Tests).
 * Tests notification listing, creation, marking as read, and outbox events.
 */

import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { AuthUseCases } from '../src/modules/auth/auth.contracts';
import type { NotificationsRepository } from '../src/modules/notifications/notifications.contracts';

const environment = parseEnvironment({
  NODE_ENV: 'test',
  CORS_ORIGINS: 'https://portal.example.test',
});

// إنشاء Auth mock يقبل الطلبات ويعيد مستخدماً بصلاحيات محددة
// Creates Auth mock that accepts requests with specified permissions
function createAuthWithPermissions(permissions: string[]): jest.Mocked<AuthUseCases> {
  return {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    authenticateAccessToken: jest.fn().mockResolvedValue({
      userId: 'user-notify-1',
      sessionId: '00000000-0000-0000-0000-000000000002',
      role: 'admin',
    }),
    listSessions: jest.fn().mockResolvedValue([]),
    revokeSession: jest.fn(),
    logoutAll: jest.fn(),
    changePassword: jest.fn(),
    requestPasswordReset: jest.fn(),
    completePasswordReset: jest.fn(),
    listPermissions: jest.fn().mockResolvedValue(permissions),
  };
}

// إنشاء Notifications Repository mock
// Creates a Notifications Repository mock
function createNotificationsRepo(): jest.Mocked<NotificationsRepository> {
  const sampleNotification = {
    notificationId: 'notif_test-1',
    userId: 'user-notify-1',
    title: 'اختبار إشعار',
    body: 'هذا إشعار اختباري.',
    type: 'system',
    isRead: false,
    channel: 'in_app',
    metadata: null,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  return {
    listNotifications: jest.fn().mockResolvedValue({ items: [sampleNotification], total: 1 }),
    getNotification: jest.fn().mockResolvedValue(sampleNotification),
    createNotification: jest.fn().mockResolvedValue(sampleNotification),
    markAsRead: jest.fn().mockResolvedValue({ ...sampleNotification, isRead: true, readAt: new Date().toISOString() }),
    markAllAsRead: jest.fn().mockResolvedValue(3),
    recordOutboxEvent: jest.fn().mockResolvedValue({ outboxId: 'outbox-1', status: 'queued' }),
  };
}

describe('Notifications Module', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. قائمة الإشعارات
  // List notifications
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/notifications', () => {
    it('يُرجع قائمة الإشعارات للمستخدم المصادق عليه', async () => {
      const auth = createAuthWithPermissions(['view_notifications']);
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].notificationId).toBe('notif_test-1');
      expect(notifications.listNotifications).toHaveBeenCalled();
    });

    it('يرفض الطلب بدون صلاحية view_notifications', async () => {
      const auth = createAuthWithPermissions([]); // لا صلاحيات
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', 'Bearer valid.token');

      expect([401, 403]).toContain(response.status);
      expect(notifications.listNotifications).not.toHaveBeenCalled();
    });

    it('يقبل query params للفلترة والترقيم', async () => {
      const auth = createAuthWithPermissions(['view_notifications']);
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .get('/api/v1/notifications?limit=10&offset=0&isRead=false')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. إنشاء إشعار
  // Create notification
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/notifications', () => {
    it('ينشئ إشعاراً داخلياً ناجحاً', async () => {
      const auth = createAuthWithPermissions(['manage_notifications']);
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', 'Bearer valid.token')
        .send({
          title: 'إشعار جديد',
          body: 'تم إنشاء طلب جديد.',
          type: 'order',
          channel: 'in_app',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(notifications.createNotification).toHaveBeenCalled();
    });

    it('يرفض إشعاراً بعنوان فارغ', async () => {
      const auth = createAuthWithPermissions(['manage_notifications']);
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', 'Bearer valid.token')
        .send({ title: '', body: 'نص الإشعار', type: 'system' });

      expect(response.status).toBe(400);
      expect(notifications.createNotification).not.toHaveBeenCalled();
    });

    it('يرفض نوع إشعار غير معروف', async () => {
      const auth = createAuthWithPermissions(['manage_notifications']);
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', 'Bearer valid.token')
        .send({ title: 'عنوان', body: 'نص', type: 'invalid_type' });

      expect(response.status).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. تعليم الإشعار كمقروء
  // Mark notification as read
  // ───────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('يعلّم الإشعار كمقروء', async () => {
      const auth = createAuthWithPermissions(['view_notifications']);
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .patch('/api/v1/notifications/notif_test-1/read')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.data.isRead).toBe(true);
    });

    it('يُرجع 404 للإشعار غير الموجود', async () => {
      const auth = createAuthWithPermissions(['view_notifications']);
      const notifications = createNotificationsRepo();
      notifications.markAsRead.mockResolvedValue(null);
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .patch('/api/v1/notifications/notif_nonexistent/read')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. إرسال إشعار خارجي عبر Outbox
  // Send external notification via outbox
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/notifications/send-external', () => {
    it('يُسجّل حدث Outbox بنجاح ويُرجع 202 Accepted', async () => {
      const auth = createAuthWithPermissions(['manage_notifications']);
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .post('/api/v1/notifications/send-external')
        .set('Authorization', 'Bearer valid.token')
        .send({
          recipient: '+96712345678',
          channel: 'whatsapp',
          message: 'تم استلام طلبكم رقم ORD-001.',
        });

      expect(response.status).toBe(202);
      expect(response.body.data.status).toBe('queued');
      expect(notifications.recordOutboxEvent).toHaveBeenCalled();
    });

    it('يرفض قناة غير مدعومة', async () => {
      const auth = createAuthWithPermissions(['manage_notifications']);
      const notifications = createNotificationsRepo();
      const app = createApiApp({ environment, auth, notifications });

      const response = await request(app)
        .post('/api/v1/notifications/send-external')
        .set('Authorization', 'Bearer valid.token')
        .send({
          recipient: '+96712345678',
          channel: 'telegram', // قناة غير مدعومة
          message: 'رسالة اختبار.',
        });

      expect(response.status).toBe(400);
      expect(notifications.recordOutboxEvent).not.toHaveBeenCalled();
    });
  });
});
