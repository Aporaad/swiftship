/**
 * portal.repository.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * مستودع قاعدة البيانات للبوابة العامة (Public Portal Repository).
 * Provides safe public queries for tracking and announcements without exposing PII or internal IDs.
 */

import type { Pool } from 'pg';
import type { PortalAnnouncementDto, PortalRepository, PublicTrackingDto } from './portal.contracts';

export function createPortalRepository(pool: Pool): PortalRepository {
  return {
    async getPublicTracking(trackingToken: string): Promise<PublicTrackingDto | null> {
      const cleanToken = trackingToken.trim();
      if (!cleanToken) return null;

      try {
        // البحث عن الطلب أولاً بواسطة tracking_number أو order_number
        const orderRes = await pool.query<Record<string, unknown>>(
          `SELECT order_id AS "orderId", order_number AS "orderNumber", tracking_number AS "trackingNumber", order_status1 AS "status", updated_at AS "updatedAt"
           FROM public.orders
           WHERE tracking_number = $1 OR order_number = $1 OR external_order_number = $1
           LIMIT 1`,
          [cleanToken],
        );

        let order = orderRes.rows[0];
        let shipmentId: string | null = null;

        // إذا لم يُعثر عليه في الطلبات، نبحث في الشحنات
        if (!order) {
          const shipRes = await pool.query<Record<string, unknown>>(
            `SELECT shipment_id AS "shipmentId", order_id AS "orderId", tracking_number AS "trackingNumber", shipment_status AS "status", updated_at AS "updatedAt"
             FROM public.shipments
             WHERE tracking_number = $1 OR shipment_id = $1
             LIMIT 1`,
            [cleanToken],
          );

          if (shipRes.rows[0]) {
            const shipRow = shipRes.rows[0];
            shipmentId = String(shipRow['shipmentId']);
            const parentOrder = await pool.query<Record<string, unknown>>(
              `SELECT order_id AS "orderId", order_number AS "orderNumber", tracking_number AS "trackingNumber", order_status1 AS "status", updated_at AS "updatedAt"
               FROM public.orders WHERE order_id = $1 LIMIT 1`,
              [shipRow['orderId']],
            );
            order = parentOrder.rows[0] ?? {
              orderId: shipRow['orderId'],
              status: shipRow['status'],
              updatedAt: shipRow['updatedAt'],
            };
          }
        }

        if (!order) return null;

        const orderId = String(order['orderId']);
        const currentStatus = String(order['status'] ?? 'pending');
        const updatedAtDate = order['updatedAt'] ? new Date(String(order['updatedAt'])) : null;
        const updatedAt = updatedAtDate && !isNaN(updatedAtDate.getTime()) ? updatedAtDate.getTime() : Date.now();

        // جلب الأحداث التاريخية دون كشف أسماء الأطراف أو البيانات الحساسة
        const historyRes = await pool.query<Record<string, unknown>>(
          `SELECT event_type AS "eventType", summary, occurred_at AS "occurredAt"
           FROM public.orders_history
           WHERE order_id = $1 ${shipmentId ? 'OR shipment_id = $2' : ''}
           ORDER BY occurred_at ASC`,
          shipmentId ? [orderId, shipmentId] : [orderId],
        );

        const events = historyRes.rows.map((row) => {
          const dt = row['occurredAt'] ? new Date(String(row['occurredAt'])) : null;
          return {
            status: String(row['summary'] ?? row['eventType'] ?? 'حدث'),
            occurredAt: dt && !isNaN(dt.getTime()) ? dt.getTime() : null,
          };
        });

        // إدراج الحدث الحالي إذا لم توجد أحداث تاريخية
        if (events.length === 0) {
          events.push({
            status: currentStatus,
            occurredAt: updatedAt,
          });
        }

        return {
          trackingToken: cleanToken,
          status: currentStatus,
          updatedAt,
          events,
        };
      } catch {
        return null;
      }
    },

    async getAnnouncements(): Promise<PortalAnnouncementDto[]> {
      try {
        const result = await pool.query<Record<string, unknown>>(
          `SELECT announcement_id AS id, title, content, priority, created_at AS "createdAt"
           FROM public.announcements
           WHERE is_active = true
           ORDER BY priority DESC, created_at DESC
           LIMIT 20`,
        );

        return result.rows.map((row) => {
          const dt = row['createdAt'] ? new Date(String(row['createdAt'])) : null;
          const prio = String(row['priority'] ?? 'normal');
          return {
            id: String(row['id']),
            title: String(row['title'] ?? ''),
            content: String(row['content'] ?? ''),
            priority: prio === 'urgent' || prio === 'high' ? prio : 'normal',
            createdAt: dt && !isNaN(dt.getTime()) ? dt.getTime() : Date.now(),
          };
        });
      } catch {
        // Fallback array if table not present in dev
        return [];
      }
    },
  };
}
