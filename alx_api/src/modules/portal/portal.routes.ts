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

export function registerPortalRoutes(
  app: Express,
  _environment: ApiEnvironment,
  repository?: PortalRepository,
): void {
  if (!repository) return;

  // 1. GET /api/v1/portal/tracking/:trackingToken — التتبع العام للشحنات والطلبات
  app.get('/api/v1/portal/tracking/:trackingToken', async (request, response, next) => {
    try {
      const trackingToken = request.params['trackingToken'];
      if (!trackingToken) {
        return sendFailure(response, 400, 'INVALID_INPUT', 'رمز التتبع مطلوب.', String(response.locals.requestId));
      }

      const trackingData = await repository.getPublicTracking(trackingToken);
      if (!trackingData) {
        return sendFailure(response, 404, 'TRACKING_NOT_FOUND', 'لم يتم العثور على شحنة أو طلب بهذا الرمز.', String(response.locals.requestId));
      }

      return sendSuccess(response, trackingData, String(response.locals.requestId));
    } catch (error) {
      return next(error);
    }
  });

  // 2. GET /api/v1/portal/announcements — الإعلانات العامة للعملاء بالموقع
  app.get('/api/v1/portal/announcements', async (_request, response, next) => {
    try {
      const announcements = await repository.getAnnouncements();
      return sendSuccess(response, announcements, String(response.locals.requestId));
    } catch (error) {
      return next(error);
    }
  });
}
