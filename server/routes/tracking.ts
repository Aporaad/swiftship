/**
 * مسارات التتبع اللوجستي
 * Tracking Routes — live order tracking and webhook receiver endpoints.
 *
 * هذه المسارات مُستخرجة من server.ts لعزل منطق التتبع.
 * Extracted from server.ts to isolate logistics tracking logic.
 */

import type { Express } from 'express';
import { isAuthorizedHeartbeatRequest } from '../heartbeatAuth';
import {
  fetchExternalTracking,
  normalizeTrackingStatus,
  syncActiveOrders,
} from '../jobs/tracking-sync';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  limit,
} from '../current-db/client';

// ── خريطة إحداثيات المواقع اليمنية والسعودية ─────────────────────
// Geocoding coordinate map for common shipping hubs
const LOCATION_COORDINATES: Record<string, [number, number]> = {
  'جدة':                                         [21.4858, 39.1925],
  'مستودع السعودية':                              [21.4858, 39.1925],
  'مستودع الشحن الرئيسي (جدة - الرياض)':         [24.7136, 46.6753],
  'أوتوستراد حرض':                                [16.4026, 43.1099],
  'في التخليص الجمركي':                           [16.4820, 42.9230],
  'صنعاء':                                        [15.3694, 44.1910],
  'مركز التوزيع في اليمن':                        [15.3694, 44.1910],
  'مستودع الفرز والترحيل':                        [15.4000, 44.2000],
  'تم التسليم':                                   [15.3500, 44.2000],
};

const DEFAULT_COORDINATES: [number, number] = [15.3694, 44.1910]; // صنعاء / Sanaa

/**
 * يُلحق إحداثيات الموقع بعناصر سجل التتبع.
 * Attaches location coordinates to tracking history entries.
 */
function attachCoordinates(history: any[]): { augmented: any[]; lastCoords: [number, number] } {
  let lastCoords: [number, number] = DEFAULT_COORDINATES;
  const augmented = history.map((h: any) => {
    let coords = h.coordinates || null;
    if (!coords) {
      const locText = `${h.location || ''} ${h.status || ''} ${h.notes || ''}`.toLowerCase();
      for (const key of Object.keys(LOCATION_COORDINATES)) {
        if (locText.includes(key.toLowerCase())) {
          coords = LOCATION_COORDINATES[key];
          break;
        }
      }
    }
    if (coords) lastCoords = coords;
    return { ...h, coordinates: coords };
  });
  return { augmented, lastCoords };
}

/**
 * تسجيل مسارات التتبع اللوجستي.
 * Registers logistics tracking routes on the Express app.
 *
 * @param app - تطبيق Express / Express application
 * @param db - عميل قاعدة البيانات / Database client
 */
export function registerTrackingRoutes(app: Express, db: any): void {
  // ── مزامنة الطلبات النشطة (Heartbeat Job) ─────────────────────
  // Heartbeat-triggered route: called every 6 hours by the managed cron job
  app.post('/api/scheduled/sync-active-orders', async (req, res) => {
    if (!isAuthorizedHeartbeatRequest(req.headers)) {
      return res.status(403).json({ error: 'cron-only' });
    }
    try {
      await syncActiveOrders(db);
      return res.json({ ok: true });
    } catch (error: any) {
      return res.status(500).json({
        error: error?.message ?? 'Tracking synchronisation failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ── جلب بيانات التتبع المباشر ────────────────────────────────
  // Real-time tracking resolution — proxies third-party shipping APIs
  app.get('/api/tracking/live/:trackingId', async (req, res) => {
    const { trackingId } = req.params;
    if (!trackingId) return res.status(400).json({ error: 'Tracking number is required.' });

    try {
      const trackingNumber = trackingId.toUpperCase();

      // 1. البحث عن بيانات داخلية / Fetch internal document
      let internalDocData: any = null;
      const publicRef = await getDoc(doc(db, 'public_tracking', trackingNumber));
      if (publicRef.exists()) {
        internalDocData = publicRef.data();
      } else {
        const ordersSnap = await getDocs(
          query(
            collection(db, 'orders'),
            where('trackingNumber', 'in', [trackingId, trackingNumber]),
            limit(1),
          ),
        );
        if (!ordersSnap.empty) internalDocData = ordersSnap.docs[0].data();
      }

      // 2. جلب بيانات خارجية / Fetch external data
      const configSnap = await getDoc(doc(db, 'settings', 'logistics_api'));
      const apiConfig = configSnap.exists()
        ? configSnap.data() as any
        : { enabled: false, provider: 'none' };

      const externalResult = await fetchExternalTracking(trackingNumber, apiConfig);

      // 3. دمج البيانات / Synthesise internal + external
      let trackingData: any = null;
        if (internalDocData) {
        const statusToUse = normalizeTrackingStatus(
          externalResult?.status ?? internalDocData?.status ?? internalDocData?.orderStatus,
        );
        const historyToUse = externalResult?.history || internalDocData?.history || [];

        trackingData = {
          status: statusToUse,
          currentLocation: externalResult?.location || internalDocData?.locationYemen || internalDocData?.location || 'مستودع الفرز والتبريد',
          history: historyToUse,
          isLiveApi: !!externalResult,
          docData: internalDocData || null,
        };

        // مزامنة تلقائية للبيانات الخارجية / Auto-sync external updates back to DB
        if (externalResult && internalDocData) {
          try {
            const historyChanged = externalResult.history.length > (internalDocData.history?.length || 0);
            const statusChanged = statusToUse !== (internalDocData.status || internalDocData.orderStatus);

            if (historyChanged || statusChanged) {
              const updatePayload: Record<string, unknown> = {
                history: externalResult.history,
                orderStatus: statusToUse,
                updatedAt: Date.now(),
              };
              if (externalResult.location) updatePayload.locationYemen = externalResult.location;

              const ordersSnap = await getDocs(
                query(collection(db, 'orders'), where('trackingNumber', '==', trackingNumber), limit(1)),
              );
              if (!ordersSnap.empty) {
                await updateDoc(doc(db, 'orders', ordersSnap.docs[0].id), updatePayload);
              }

              const pubDocRef = doc(db, 'public_tracking', trackingNumber);
              const pubData = await getDoc(pubDocRef);
              if (pubData.exists()) {
                await updateDoc(pubDocRef, { ...updatePayload, status: statusToUse });
              }
              console.log(`[TrackingRoutes] Auto-sync persisted for ${trackingNumber}`);
            }
          } catch (persistenceErr: unknown) {
            const message = persistenceErr instanceof Error ? persistenceErr.message : String(persistenceErr);
            console.error('[TrackingRoutes] Auto-sync failed:', message);
          }
        }
      } else if (externalResult) {
        trackingData = {
          status: externalResult.status || 'Processing',
          currentLocation: externalResult.location || 'Unknown',
          history: externalResult.history,
          isLiveApi: true,
        };
      }

      if (!trackingData) {
        return res.status(404).json({ error: 'Tracking not found neither externally nor internally.' });
      }

      // إلحاق الإحداثيات بسجل التتبع / Attach coordinates to history
      if (trackingData.history?.length > 0) {
        const { augmented, lastCoords } = attachCoordinates(trackingData.history);
        trackingData.history = augmented;
        trackingData.currentCoordinates = lastCoords;
      } else {
        trackingData.currentCoordinates = DEFAULT_COORDINATES;
      }

      return res.json({ success: true, tracking: trackingData });
    } catch (e: any) {
      console.error('[TrackingRoutes] Tracking Read Error:', e.message);
      return res.status(500).json({ error: 'Failed to fetch live logistics payload.' });
    }
  });

  // ── مستقبل Webhook للتحديثات التلقائية ─────────────────────────
  // Webhook receiver for automatic third-party tracking status push updates
  app.post('/api/tracking/webhook', async (req, res) => {
    // إرجاع 200 فوراً لتأكيد الاستلام / Return 200 immediately to acknowledge receipt
    res.status(200).json({ received: true });

    // معالجة غير متزامنة لتجنب المهلة / Process asynchronously to avoid timeout
    (async () => {
      try {
        const payload = req.body;
        if (!payload?.msg?.tracking_number) return;

        const trackingNumber = payload.msg.tracking_number;
        const newTag = payload.msg.tag;
        const locationStr = payload.msg.checkpoint?.location || 'Unknown Checkpoint';

        const ordersSnap = await getDocs(
          query(collection(db, 'orders'), where('trackingNumber', '==', trackingNumber), limit(1)),
        );
        if (ordersSnap.empty) return;

        const orderDoc = ordersSnap.docs[0];
        const orderData = orderDoc.data();

        // ترجمة حالة التتبع الواردة / Translate incoming tracking tag
        const webhookStatusMap: Record<string, string> = {
          InfoReceived:    'تم تسجيل الطلب',
          InTransit:       'جاري الشحن لليمن',
          OutForDelivery:  'مع المندوب للتوصيل',
          Delivered:       'تم التسليم',
          Exception:       'ملغي',
        };
        const newStatus = webhookStatusMap[newTag] || 'جاري الشحن لليمن';

        const newHistoryEntry = {
          status: newStatus,
          location: locationStr,
          timestamp: Date.now(),
          notes: payload.msg.checkpoint?.message || 'Automatic third-party checkpoint update',
          createdBy: 'API_WEBHOOK',
        };

        const updatedHistory = [...(orderData.history || []), newHistoryEntry];

        await updateDoc(doc(db, 'orders', orderDoc.id), {
          orderStatus: newStatus,
          locationYemen: locationStr,
          history: updatedHistory,
          updatedAt: Date.now(),
        });

        const publicRef = doc(db, 'public_tracking', trackingNumber.toUpperCase());
        const publicSnap = await getDoc(publicRef);
        if (publicSnap.exists()) {
          await updateDoc(publicRef, {
            status: newStatus,
            locationYemen: locationStr,
            history: updatedHistory,
            updatedAt: Date.now(),
          });
        }
        console.log(`[TrackingRoutes] Webhook: ${trackingNumber} advanced to ${newStatus}`);
      } catch (err: any) {
        console.error('[TrackingRoutes] Webhook processing failed:', err.message);
      }
    })();
  });

  // ── اختبار اتصال API التتبع ──────────────────────────────────
  // Secure logistics credentials test-connection endpoint
  app.post('/api/tracking/test-connection', async (req, res) => {
    const { provider, apiKey, defaultDestinationCountry } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API Key are required' });
    }

    try {
      if (provider === 'parcelsapp') {
        const response = await fetch('https://parcelsapp.com/api/v3/shipments/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipments: [{ trackingId: 'PING_TEST_AUTH_CHECK', destinationCountry: defaultDestinationCountry || 'Yemen' }],
            language: 'en',
            apiKey,
          }),
        });
        const json = await response.json() as any;
        if (response.ok && !json.error) {
          return res.json({ success: true, message: 'ParcelsApp v3 authenticated successfully!' });
        }
        throw new Error(json.error || 'ParcelsApp authentication failed');

      } else if (provider === 'aftership') {
        const response = await fetch('https://api.aftership.com/v4/couriers', {
          headers: { 'aftership-api-key': apiKey, 'Content-Type': 'application/json' },
        });
        const json = await response.json() as any;
        if (response.ok && json.meta?.code === 200) {
          return res.json({ success: true, message: 'AfterShip API key is valid!' });
        }
        throw new Error(json.meta?.message || 'AfterShip authentication failed');

      } else if (provider === 'sandbox') {
        return res.json({ success: true, message: 'Sandbox mode is virtualised and always ready.' });

      } else {
        return res.status(400).json({ error: 'Provider test not yet implemented' });
      }
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
}
