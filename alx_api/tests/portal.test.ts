/**
 * portal.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * اختبارات البوابة العامة (Portal Module Tests).
 * Tests public tracking and announcements endpoints (no auth required).
 */

import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { PortalRepository } from '../src/modules/portal/portal.contracts';

const environment = parseEnvironment({
  NODE_ENV: 'test',
  CORS_ORIGINS: 'https://portal.example.test',
});

// إنشاء Portal Repository mock
// Creates a Portal Repository mock
function createPortalRepo(): jest.Mocked<PortalRepository> {
  return {
    getPublicTracking: jest.fn().mockResolvedValue({
      trackingToken: 'TRACK-001',
      status: 'in_transit',
      updatedAt: Date.now(),
      events: [
        { status: 'pending', occurredAt: Date.now() - 86400000 },
        { status: 'in_transit', occurredAt: Date.now() },
      ],
    }),
    getAnnouncements: jest.fn().mockResolvedValue([
      {
        id: 'announce-1',
        title: 'إعلان اختباري',
        content: 'هذا إعلان اختباري للعملاء.',
        priority: 'normal',
        createdAt: Date.now(),
      },
    ]),
  };
}

describe('Portal Module (Public - No Auth Required)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. تتبع الشحنة العام
  // Public shipment tracking
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/portal/tracking/:trackingToken', () => {
    it('يُرجع بيانات التتبع لرمز صالح', async () => {
      const portal = createPortalRepo();
      const app = createApiApp({ environment, portal });

      // بدون Authorization header (endpoint عام)
      const response = await request(app)
        .get('/api/v1/portal/tracking/TRACK-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.trackingToken).toBe('TRACK-001');
      expect(response.body.data.status).toBe('in_transit');
      expect(Array.isArray(response.body.data.events)).toBe(true);
      expect(portal.getPublicTracking).toHaveBeenCalledWith('TRACK-001');
    });

    it('يُرجع 404 لرمز تتبع غير موجود', async () => {
      const portal = createPortalRepo();
      portal.getPublicTracking.mockResolvedValue(null);
      const app = createApiApp({ environment, portal });

      const response = await request(app)
        .get('/api/v1/portal/tracking/NONEXISTENT-99');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('TRACKING_NOT_FOUND');
    });

    it('يرفض رمز تتبع قصير جداً', async () => {
      const portal = createPortalRepo();
      const app = createApiApp({ environment, portal });

      const response = await request(app)
        .get('/api/v1/portal/tracking/AB'); // أقل من 3 أحرف

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TRACKING_TOKEN');
      expect(portal.getPublicTracking).not.toHaveBeenCalled();
    });

    it('يرفض رمز تتبع يحتوي على أحرف خاصة', async () => {
      const portal = createPortalRepo();
      const app = createApiApp({ environment, portal });

      // رمز يحتوي على مسافة وأحرف HTML
      const response = await request(app)
        .get('/api/v1/portal/tracking/TRACK%20%3Cscript%3E');

      expect([400, 404]).toContain(response.status);
    });

    it('لا يتطلب Authentication', async () => {
      const portal = createPortalRepo();
      const app = createApiApp({ environment, portal });

      // بدون أي Authorization header
      const response = await request(app)
        .get('/api/v1/portal/tracking/TRACK-001');

      // يجب أن يُرجع 200 وليس 401
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(401);
    });

    it('لا يكشف بيانات PII في استجابة التتبع العام', async () => {
      const portal = createPortalRepo();
      portal.getPublicTracking.mockResolvedValue({
        trackingToken: 'TRACK-001',
        status: 'delivered',
        updatedAt: Date.now(),
        events: [{ status: 'delivered', occurredAt: Date.now() }],
      });
      const app = createApiApp({ environment, portal });

      const response = await request(app)
        .get('/api/v1/portal/tracking/TRACK-001');

      const bodyStr = JSON.stringify(response.body);
      // التحقق من عدم وجود بيانات حساسة في الاستجابة
      expect(bodyStr).not.toContain('phone');
      expect(bodyStr).not.toContain('email');
      expect(bodyStr).not.toContain('address');
      expect(bodyStr).not.toContain('customer_id');
      expect(bodyStr).not.toContain('userId');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. الإعلانات العامة
  // Public announcements
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/portal/announcements', () => {
    it('يُرجع قائمة الإعلانات النشطة', async () => {
      const portal = createPortalRepo();
      const app = createApiApp({ environment, portal });

      const response = await request(app)
        .get('/api/v1/portal/announcements');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('announce-1');
      expect(portal.getAnnouncements).toHaveBeenCalled();
    });

    it('يُرجع مصفوفة فارغة بدون خطأ إذا لا توجد إعلانات', async () => {
      const portal = createPortalRepo();
      portal.getAnnouncements.mockResolvedValue([]);
      const app = createApiApp({ environment, portal });

      const response = await request(app)
        .get('/api/v1/portal/announcements');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('لا يتطلب Authentication', async () => {
      const portal = createPortalRepo();
      const app = createApiApp({ environment, portal });

      // بدون Authorization header
      const response = await request(app)
        .get('/api/v1/portal/announcements');

      expect(response.status).toBe(200);
      expect(response.status).not.toBe(401);
    });

    it('يُرجع 404 إذا لم تكن وحدة Portal مُفعَّلة', async () => {
      // بدون تمرير portal repository
      const app = createApiApp({ environment });

      const response = await request(app)
        .get('/api/v1/portal/announcements');

      expect(response.status).toBe(404);
    });
  });
});
