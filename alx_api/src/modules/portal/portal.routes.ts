/**
 * portal.routes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * المسارات والـ Endpoints العامة للبوابة بالموقع (Public Portal Routes).
 * Publicly accessible endpoints for shipment tracking & announcements.
 */

import type { Express } from 'express';
import type { ApiEnvironment } from '../../config/env';
import type { PortalRepository } from './portal.contracts';
import { sendFailure, sendSuccess } from '../../core/http/response';
import { trackingTokenParamSchema } from './portal.schemas';

export function registerPortalRoutes(
  app: Express,
  _environment: ApiEnvironment,
  repository?: PortalRepository,
): void {
  if (!repository) return;

  // ─────────────────────────────────────────────────────────────────────────
  // 1. GET /api/v1/portal/tracking/:trackingToken — التتبع العام للشحنات والطلبات
  // Public shipment/order tracking by tracking number, order number, or shipment ID.
  // Intentionally public — no authentication required.
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/v1/portal/tracking/:trackingToken', async (request, response, next) => {
    try {
      // التحقق من صحة رمز التتبع باستخدام Zod
      // Validate tracking token with Zod schema
      const parsed = trackingTokenParamSchema.safeParse(request.params['trackingToken']);
      if (!parsed.success) {
        return sendFailure(
          response,
          400,
          'INVALID_TRACKING_TOKEN',
          'رمز التتبع غير صالح أو يحتوي على أحرف غير مسموحة.',
          String(response.locals.requestId),
        );
      }

      const trackingData = await repository.getPublicTracking(parsed.data);
      if (!trackingData) {
        return sendFailure(
          response,
          404,
          'TRACKING_NOT_FOUND',
          'لم يتم العثور على شحنة أو طلب بهذا الرمز.',
          String(response.locals.requestId),
        );
      }

      return sendSuccess(response, trackingData, String(response.locals.requestId));
    } catch (error) {
      return next(error);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. GET /api/v1/portal/announcements — الإعلانات العامة للعملاء بالموقع
  // Returns active announcements sorted by priority then creation date.
  // Intentionally public — no authentication required.
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/v1/portal/announcements', async (_request, response, next) => {
    try {
      const announcements = await repository.getAnnouncements();
      return sendSuccess(response, announcements, String(response.locals.requestId));
    } catch (error) {
      return next(error);
    }
  });
}

