/**
 * وظيفة مزامنة التتبع الدوري (Tracking Sync Job)
 * Periodic Tracking Synchronisation — fetches external tracking data and persists updates.
 *
 * هذا الملف مُستخرج من server.ts لعزل منطق مزامنة الشحن عن بقية الخادم.
 * Extracted from server.ts to isolate shipping-sync logic.
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

// ── خريطة تحويل حالات التتبع إلى العربية ──────────────────────────
// Status translation map — English tracking statuses to Arabic UI labels
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
 * Normalises an external tracking status to an Arabic UI label.
 */
export function normalizeTrackingStatus(status: string | undefined): string {
  if (!status) return 'تم تسجيل الطلب';
  if (STATUS_MAP_TO_AR[status]) return STATUS_MAP_TO_AR[status];
  // فحص جزئي غير حساس لحالة الأحرف / Case-insensitive partial match
  for (const key of Object.keys(STATUS_MAP_TO_AR)) {
    if (status.toLowerCase().includes(key.toLowerCase())) return STATUS_MAP_TO_AR[key];
  }
  return status;
}

// ── نوع إعداد API التتبع ─────────────────────────────────────────
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
 * Fetches tracking data from an external API provider.
 *
 * @param trackingNumber - رقم التتبع / Tracking number
 * @param apiConfig - إعداد API التتبع / Tracking API configuration
 * @returns نتيجة التتبع الخارجي أو null / External tracking result or null
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

        // استطلاع حتى اكتمال التتبع / Poll until tracking is done
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

/**
 * تزامن دوري للطلبات النشطة مع بيانات التتبع الخارجية.
 * Periodic sync of active orders with external tracking data.
 *
 * @param db - كائن قاعدة البيانات / Database client object
 */
export async function syncActiveOrders(db: any): Promise<void> {
  console.log('[TrackingSync] Starting periodic tracking synchronisation...');

  try {
    const configSnap = await getDoc(doc(db, 'settings', 'logistics_api'));
    const apiConfig = configSnap.exists() ? configSnap.data() as TrackingApiConfig : null;
    if (!apiConfig?.enabled) return;

    const activeStatuses = [
      'تم تسجيل الطلب',
      'جاري الشحن لليمن',
      'في التخليص الجمركي',
      'مع المندوب للتوصيل',
    ];

    const ordersSnap = await getDocs(
      query(collection(db, 'orders'), where('orderStatus', 'in', activeStatuses)),
    );
    if (ordersSnap.empty) return;

    for (const orderDoc of ordersSnap.docs) {
      const data = orderDoc.data();
      const trackingNumber = data.trackingNumber;
      if (!trackingNumber) continue;

      const result = await fetchExternalTracking(trackingNumber, apiConfig);
      if (result) {
        const normalizedStatus = normalizeTrackingStatus(result.status ?? undefined);
        const historyChanged = result.history.length > (data.history?.length || 0);
        const statusChanged = normalizedStatus !== data.orderStatus;

        if (historyChanged || statusChanged) {
          const updatePayload: any = {
            history: result.history,
            orderStatus: normalizedStatus,
            updatedAt: Date.now(),
          };
          if (result.location) updatePayload.locationYemen = result.location;

          await updateDoc(doc(db, 'orders', orderDoc.id), updatePayload);

          // تحديث سجل التتبع العام / Update public tracking record
          const publicRef = doc(db, 'public_tracking', trackingNumber.toUpperCase());
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

      // تأخير بسيط لتجنب ضغط الطلبات / Small delay to avoid API flooding
      await new Promise(r => setTimeout(r, 500));
    }

    console.log('[TrackingSync] Synchronisation cycle completed.');
  } catch (err: any) {
    console.error('[TrackingSync] Background synchronisation failed:', err.message);
    throw err;
  }
}
