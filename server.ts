/**
 * نقطة دخول الخادم الرئيسية — SwiftShip System
 * Main Server Entry Point — orchestrates all server modules.
 *
 * تم إعادة هيكلة هذا الملف في المرحلة السابعة من خطة ما قبل API.
 * Refactored in Phase 7 of the pre-API restructure plan.
 *
 * البنية الجديدة / New structure:
 * ┌─ server.ts              ← نقطة التنسيق فقط / orchestrator only
 * ├─ server/app.ts          ← Express app + Health + Middleware
 * ├─ server/current-db/
 * │   └─ client.ts          ← تهيئة قاعدة البيانات / DB client init
 * ├─ server/jobs/
 * │   ├─ account-reconciliation.ts ← Realtime listener للحسابات
 * │   └─ tracking-sync.ts          ← مزامنة التتبع الدوري
 * ├─ server/routes/
 * │   ├─ auth.ts            ← مسارات المصادقة
 * │   ├─ whatsapp.ts        ← مسارات WhatsApp
 * │   └─ tracking.ts        ← مسارات التتبع
 * ├─ server/browser-proxy/
 * │   └─ route.ts           ← Browser proxy route
 * ├─ server/dev-server.ts   ← Vite dev + Production static files
 * ├─ server/heartbeatAuth.ts ← تحقق Heartbeat cron
 * └─ server/legacy-compat.ts ← توثيق العيوب الحرجة القديمة
 */

import './loadEnv';
import path from 'path';
import { fileURLToPath } from 'url';

// ── تحديد المسار الحالي / Resolve current directory ─────────────
const currentFilePath = (typeof import.meta !== 'undefined' && typeof import.meta.url === 'string')
  ? fileURLToPath(import.meta.url)
  : (typeof __filename !== 'undefined' ? __filename : '');

const currentDirPath = currentFilePath
  ? path.dirname(currentFilePath)
  : (typeof __dirname !== 'undefined' ? __dirname : process.cwd());

// ── استيراد وحدات الخادم / Import server modules ─────────────────
import { createApiErrorHandler, createApp } from './server/app';
import { createSupabaseSessionVerifier } from './server/auth/server-auth';
import { createDbClient, authenticateServerSession } from './server/current-db/client';
import { startAccountReconciliationListener } from './server/jobs/account-reconciliation';
import { registerAuthRoutes } from './server/routes/auth';
import { registerWhatsAppRoutes } from './server/routes/whatsapp';
import { registerTrackingRoutes } from './server/routes/tracking';
import { createCustomersGateway, registerCustomersRoutes } from './server/routes/customers';
import { createCouriersGateway, registerCouriersRoutes } from './server/routes/couriers';
import { registerBrowserProxyRoute } from './server/browser-proxy/route';
import { attachViteDevMiddleware, attachProductionStaticFiles } from './server/dev-server';
import { supabase } from './src/lib/supabase-adapter';

async function startServer(): Promise<void> {
  // 1. إنشاء عميل قاعدة البيانات / Create database client
  const { db, auth, ready } = await createDbClient();

  // 2. إنشاء تطبيق Express / Create Express app
  const app = createApp(() => ready);

  // 3. مصادقة الخادم بالحساب الإداري / Authenticate server session
  await authenticateServerSession(auth, db);

  // 4. بدء Realtime listeners للوظائف الخلفية / Start Realtime background jobs
  if (db) {
    try {
      startAccountReconciliationListener(db);
      console.log('[Server] Account reconciliation listener started');
    } catch (triggerErr: any) {
      console.error('[Server] Could not start Realtime listeners:', triggerErr.message);
    }
  }

  // 5. تسجيل مسارات API / Register API routes
  registerBrowserProxyRoute(app);
  registerAuthRoutes(app, db, auth);
  registerWhatsAppRoutes(app, db);
  registerTrackingRoutes(app, db);
  registerCustomersRoutes(
    app,
    createCustomersGateway(db),
    createSupabaseSessionVerifier(supabase),
  );
  registerCouriersRoutes(
    app,
    createCouriersGateway(db),
    createSupabaseSessionVerifier(supabase),
  );
  app.use('/api', createApiErrorHandler());

  // 6. مسار احتياطي لـ API / API fallback
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // 7. تكوين واجهة المستخدم / Configure UI serving
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RESOURCES_PATH;

  if (!isProduction) {
    await attachViteDevMiddleware(app);
  } else {
    attachProductionStaticFiles(app, currentDirPath);
  }

  // 8. تشغيل الخادم / Start listening
  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Running on port ${PORT}`);
  });
}

startServer();
