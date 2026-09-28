/**
 * وظيفة مزامنة التتبع الدوري (Tracking Sync Job) — Phase 8
 * Periodic Tracking Synchronisation — refactored into a structured background job
 * with Preconditions, Idempotency, Retries, Audit Logging, and Failure Handling.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
} from '../current-db/client';
import type { BackgroundJobDefinition, BackgroundJobContext, JobExecutionResult } from './types';
import { runBackgroundJob } from './job-runner';

// ── خريطة تحويل حالات التتبع إلى العربية ──────────────────────────
const STATUS_MAP_TO_AR: Record<string, string> = {
  InfoReceived:           'تم تسجيل الطلب',
  InTransit:              'جاري الشحن لليمن',
  OutForDelivery:         'مع المندوب للتوصيل',
  Delivered:              'تم التسليم',
  Exception:              'ملغي',
  Processing:             'تم تسجيل الطلب',
  Shipped:                'جاري الشحن لليمن',
  Arrived:                'وصل مركز التوزيع في اليمن',
  Held:                   'في التخليص الجمركي',
  Customs:                'في التخليص الجمركي',
  'Available for pickup': 'وصل مركز التوزيع في اليمن',
  Pending:                'تم تسجيل الطلب',
  Packed:                 'وصل مستودع السعودية',
  Received:               'تم تسجيل الطلب',
  Departed:               'جاري الشحن لليمن',
  'Picked Up':            'تم تسجيل الطلب',
  Collection:             'تم التسليم',
  Dispatched:             'جاري الشحن لليمن',
  Sorted:                 'وصل مستودع السعودية',
  'Out for delivery':     'مع المندوب للتوصيل',
  'Ready for collection': 'وصل مركز التوزيع في اليمن',
  archive:                'تم التسليم',
  active:                 'جاري الشحن لليمن',
  expired:                'ملغي',
  undelivered:            'ملغي',
  pickup:                 'وصل مركز التوزيع في اليمن',
  transit:                'جاري الشحن لليمن',
  delivered:              'تم التسليم',
  out_for_delivery:       'مع المندوب للتوصيل',
  info_received:          'تم تسجيل الطلب',
  alert:                  'ملغي',
  notfound:               'رقم تتبع غير معروف',
};

/**
 * تحويل حالة التتبع الخارجية إلى عربية.
 */
export function normalizeTrackingStatus(status: string | undefined): string {
  if (!status) return 'تم تسجيل الطلب';
  if (STATUS_MAP_TO_AR[status]) return STATUS_MAP_TO_AR[status];
  for (const key of Object.keys(STATUS_MAP_TO_AR)) {
    if (status.toLowerCase().includes(key.toLowerCase())) return STATUS_MAP_TO_AR[key];
  }
  return status;
}

export interface TrackingApiConfig {
  enabled: boolean;
  provider: 'aftership' | '17track' | 'trackingmore' | 'parcelsapp' | 'sandbox' | string;
  apiKey?: string;
  defaultDestinationCountry?: string;
}

export interface TrackingHistoryEntry {
  status: string;
  timestamp: number;
  location: string;
  notes: string;
  coordinates: [number, number] | null;
}

export interface ExternalTrackingResult {
  history: TrackingHistoryEntry[];
  status: string | null;
  location: string | null;
}

/**
 * جلب بيانات التتبع من API خارجي.
 */
export async function fetchExternalTracking(
  trackingNumber: string,
  apiConfig: TrackingApiConfig,
): Promise<ExternalTrackingResult | null> {
  if (!apiConfig?.enabled) return null;

  let externalHistory: TrackingHistoryEntry[] | null = null;
  let externalStatus: string | null = null;
  let externalLocation: string | null = null;

  try {
    // ── AfterShip ────────────────────────────────────────────────
    if (!externalHistory && apiConfig.provider === 'aftership' && apiConfig.apiKey) {
      const response = await fetch(`https://api.aftership.com/v4/trackings/${trackingNumber}`, {
        headers: {
          'aftership-api-key': apiConfig.apiKey,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const json = await response.json() as any;
        if (json.data?.tracking) {
          const t = json.data.tracking;
          externalHistory = t.checkpoints.map((c: any) => ({
            status: c.tag || 'Processing',
            timestamp: new Date(c.checkpoint_time).getTime(),
            location: [c.city, c.state, c.country_name].filter(Boolean).join(', ') || 'Global Transit Hub',
            notes: c.message,
            coordinates: c.coordinates || null,
          }));
          if (externalHistory?.length) {
            externalStatus = t.tag;
            externalLocation = externalHistory[externalHistory.length - 1].location;
          }
        }
      }
    }

    // ── 17TRACK ───────────────────────────────────────────────────
    if (!externalHistory && apiConfig.provider === '17track' && apiConfig.apiKey) {
      const headers = { '17token': apiConfig.apiKey, 'Content-Type': 'application/json' };
      const body = JSON.stringify([{ number: trackingNumber }]);
      const response = await fetch('https://api.17track.net/track/v2.2/gettrackinfo', {
        method: 'POST', headers, body,
      });
      const json = await response.json() as any;
      if (json?.data?.accepted?.[0]?.track?.z1?.length > 0) {
        const t = json.data.accepted[0].track;
        externalHistory = t.z1.map((c: any) => ({
          status: c.z || 'Processing',
          timestamp: c.a ? new Date(c.a.replace(' ', 'T') + ':00Z').getTime() : Date.now(),
          location: c.c || 'Global Transit Hub',
          notes: c.z || '',
          coordinates: null,
        })).sort((a: any, b: any) => a.timestamp - b.timestamp);
        externalStatus = t.e === 10 ? 'Delivered' : (t.e === 30 || t.e === 40 ? 'InTransit' : 'Processing');
        externalLocation = externalHistory.length > 0 ? externalHistory[externalHistory.length - 1].location : 'Unknown';
      }
    }

    // ── TrackingMore ──────────────────────────────────────────────
    if (!externalHistory && apiConfig.provider === 'trackingmore' && apiConfig.apiKey) {
      const response = await fetch(
        `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${trackingNumber}`,
        { headers: { 'Tracking-Api-Key': apiConfig.apiKey, 'Content-Type': 'application/json' } },
      );
      if (response.ok) {
        const json = await response.json() as any;
        const t = json.data?.[0];
        if (t?.tracking_detail?.length > 0) {
          externalHistory = t.tracking_detail.map((c: any) => ({
            status: c.sub_status_id || c.status || 'Processing',
            timestamp: new Date(c.checkpoint_date).getTime(),
            location: c.location || 'Global Transit Hub',
            notes: c.checkpoint_status || '',
            coordinates: null,
          })).sort((a: any, b: any) => a.timestamp - b.timestamp);
          externalStatus = t.delivery_status || 'InTransit';
          externalLocation = externalHistory.length > 0 ? externalHistory[externalHistory.length - 1].location : 'Unknown';
        }
      }
    }

    // ── ParcelsApp v3 ─────────────────────────────────────────────
    if (!externalHistory && apiConfig.provider === 'parcelsapp' && apiConfig.apiKey) {
      const destCountry = apiConfig.defaultDestinationCountry || 'Yemen';

      const initResponse = await fetch('https://parcelsapp.com/api/v3/shipments/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipments: [{ trackingId: trackingNumber, destinationCountry: destCountry }],
          language: 'en',
          apiKey: apiConfig.apiKey,
        }),
      });

      if (initResponse.ok) {
        let json = await initResponse.json() as any;
        let uuid = json.uuid;
        let attempts = 0;
        const maxAttempts = 6;

        while (!json.done && uuid && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1500));
          const pollRes = await fetch(`https://parcelsapp.com/api/v3/shipments/tracking?apiKey=${apiConfig.apiKey}&uuid=${uuid}`);
          if (pollRes.ok) {
            json = await pollRes.json();
          } else {
            break;
          }
          attempts++;
        }

        const shipment = json.shipments?.find((s: any) =>
          s.trackingId.toUpperCase() === trackingNumber.toUpperCase(),
        );

        if (shipment?.states?.length > 0) {
          externalHistory = shipment.states.map((s: any) => ({
            status: s.state || s.status || s.header || s.description || 'Processing',
            timestamp: s.date ? new Date(s.date).getTime() : Date.now(),
            location: s.location || 'Global Transit Hub',
            notes: s.info || s.header || s.description || '',
            coordinates: s.coordinates || null,
          })).sort((a: any, b: any) => a.timestamp - b.timestamp);

          externalStatus = shipment.status
            || (shipment.states.length > 0 ? (shipment.states[shipment.states.length - 1].state || shipment.states[shipment.states.length - 1].status) : 'InTransit');
          externalLocation = externalHistory.length > 0 ? externalHistory[externalHistory.length - 1].location : 'Unknown';
        }
      }
    }
  } catch (err: any) {
    console.error(`[TrackingSync] External tracking fetch error (${trackingNumber}):`, err.message);
  }

  if (externalHistory) {
    return { history: externalHistory, status: externalStatus, location: externalLocation };
  }
  return null;
}

// ── DTOs لمشغل مزامنة التتبع ─────────────────────────────────────
export interface TrackingSyncInput {
  targetStatuses?: string[];
}

export interface TrackingSyncOutput {
  syncedOrdersCount: number;
  updatedOrdersCount: number;
}

let dbInstance: any = null;

/**
 * تعريف وظيفة مزامنة التتبع الدوري بموجب معايير المرحلة الثامنة.
 */
export const trackingSyncJob: BackgroundJobDefinition<TrackingSyncInput, TrackingSyncOutput> = {
  name: 'tracking_sync',

  // 1. الشروط المسبقة / Preconditions
  preconditions: async (_input, _context) => {
    if (!dbInstance) {
      return { valid: false, reason: 'Database client is not initialized' };
    }
    const configSnap = await getDoc(doc(dbInstance, 'settings', 'logistics_api'));
    const apiConfig = configSnap.exists() ? configSnap.data() as TrackingApiConfig : null;

    if (!apiConfig || !apiConfig.enabled) {
      return { valid: false, reason: 'Logistics API is disabled in settings' };
    }
    return { valid: true };
  },

  // 2. الحد المعاملي والتنفيذ الفعلي / Transactional execution boundary
  execute: async (input, _context) => {
    const configSnap = await getDoc(doc(dbInstance, 'settings', 'logistics_api'));
    const apiConfig = configSnap.data() as TrackingApiConfig;

    const activeStatuses = input.targetStatuses || [
      'تم تسجيل الطلب',
      'جاري الشحن لليمن',
      'في التخليص الجمركي',
      'مع المندوب للتوصيل',
    ];

    const ordersSnap = await getDocs(
      query(collection(dbInstance, 'orders'), where('orderStatus', 'in', activeStatuses)),
    );

    if (ordersSnap.empty) {
      return { syncedOrdersCount: 0, updatedOrdersCount: 0 };
    }

    let syncedOrdersCount = 0;
    let updatedOrdersCount = 0;

    for (const orderDoc of ordersSnap.docs) {
      syncedOrdersCount++;
      const data = orderDoc.data();
      const trackingNumber = data.trackingNumber;
      if (!trackingNumber) continue;

      const result = await fetchExternalTracking(trackingNumber, apiConfig);
      if (result) {
        const normalizedStatus = normalizeTrackingStatus(result.status ?? undefined);
        const historyChanged = result.history.length > (data.history?.length || 0);
        const statusChanged = normalizedStatus !== data.orderStatus;

        if (historyChanged || statusChanged) {
          updatedOrdersCount++;
          const updatePayload: any = {
            history: result.history,
            orderStatus: normalizedStatus,
            updatedAt: Date.now(),
          };
          if (result.location) updatePayload.locationYemen = result.location;

          await updateDoc(doc(dbInstance, 'orders', orderDoc.id), updatePayload);

          const publicRef = doc(dbInstance, 'public_tracking', trackingNumber.toUpperCase());
          const publicSnap = await getDoc(publicRef);
          if (publicSnap.exists()) {
            await updateDoc(publicRef, {
              status: normalizedStatus,
              locationYemen: result.location || publicSnap.data().locationYemen,
              history: result.history,
              updatedAt: Date.now(),
            });
          }
        }
      }

      await new Promise(r => setTimeout(r, 400));
    }

    return { syncedOrdersCount, updatedOrdersCount };
  },

  defaultOptions: {
    audit: true,
    retryPolicy: {
      maxRetries: 2,
      initialDelayMs: 1000,
      backoffFactor: 2,
    },
  },
};

/**
 * تشغيل مزامنة التتبع كـ Background Job آمن مع IdempotencyKey.
 */
export async function syncActiveOrders(
  db: any,
  targetStatuses?: string[],
): Promise<JobExecutionResult<TrackingSyncOutput>> {
  dbInstance = db;
  const timeWindowKey = Math.floor(Date.now() / 60000); // مفتاح دقيقة واحدة
  const idempotencyKey = `tracking_sync_${timeWindowKey}`;

  const context: BackgroundJobContext = {
    jobName: 'tracking_sync',
    trigger: 'cron',
    idempotencyKey,
  };

  return runBackgroundJob(
    trackingSyncJob,
    { targetStatuses },
    context,
  );
}
