# المرحلة 7 — تفكيك `server.ts`

**الحالة:** مكتملة بالكامل ومُتحقَّق منها.
**التاريخ:** 2026-09-28
**AI Model:** Gemini 3.6 Flash (Medium) / Antigravity

## الملخص الإجمالي

تم إعادة هيكلة ملف `server.ts` الرئيسي وتقسيمه من كائن موحد ضخم إلى وحدات مستقلة ومفصلة تحت المجلد `server/` دون أي تغيير في السلوك الخارجي للنظام.

## الهيكل الجديد لملفات الخادم

```text
server/
├── app.ts                         ← إنشاء تطبيق Express، وHealth endpoint، وMiddleware الجاهزية
├── current-db/
│   └── client.ts                  ← تهيئة عميل Supabase Adapter وتوثيق المصادقة المؤقتة
├── jobs/
│   ├── account-reconciliation.ts  ← Realtime listener للتسوية المالية وإعادة احتساب الرصيد
│   └── tracking-sync.ts           ← مزامنة التتبع الدوري
├── routes/
│   ├─ auth.ts                     ← مسارات المصادقة والتأكد من بيانات الدخول
│   ├─ whatsapp.ts                 ← مسارات إرسال واتساب
│   └─ tracking.ts                 ← مسارات التتبع والمزامنة
├── browser-proxy/
│   └─ route.ts                    ← مسار Proxy الخاص بالمتصفح الداخلي
├── dev-server.ts                  ← تكوين Vite Dev Middleware والملفات الثابتة في الإنتاج
├── heartbeatAuth.ts               ← فحص Heartbeat الدائم
└── legacy-compat.ts               ← توثيق العيوب الحرجة في المحول القديم

server.ts                          ← نقطة دخول التنسيق فقط (Orchestrator, 98 سطر بدلاً من المئات)
```

## تفاصيل التقسيم والتنفيذ

1. **`server/app.ts`**:
   - ينشئ تطبيق Express الرئيسي.
   - يضيف `createApiAvailabilityMiddleware` للتحقق من جاهزية قاعدة البيانات قبل تمرير الطلبات (مع استثناء `/api/health` و `/api/browser-proxy`).
   - يقدم المسار `/api/health`.

2. **`server/current-db/client.ts`**:
   - يعزل تهيئة Admin SDK و Client SDK الخاصة بالمحول.
   - يوفر دالة `authenticateServerSession` لمصادقة الخادم بالحساب الإداري.
   - يعيد تصدير الدوان والمحولات الأساسية لتفادي الاستيراد المباشر للـ Adapter من مسارات API.

3. **`server/jobs/`**:
   - `account-reconciliation.ts`: يعزل المستمع اللحظي Realtime لإعادة احتساب الرصيد وتسوية العهد.
   - `tracking-sync.ts`: يعزل وظائف المزامنة وتأكيد الشحنات الدوري.

4. **`server/routes/`**:
   - `auth.ts`: يعزل المسار `/api/auth/verify-login` والمسار `/api/auth/admin-change-password`.
   - `whatsapp.ts`: يعزل مسارات إرسال وتتبع إشعارات الواتساب.
   - `tracking.ts`: يعزل مسارات التتبع الخارجية وبوابة التتبع.

5. **`server/browser-proxy/route.ts`**:
   - يعزل مسار البروكسي الداخلي للمتصفح.

6. **`server/dev-server.ts`**:
   - يعزل تكوين Vite Dev Server في وضع التطوير وتوزيع static files في وضع Production.

7. **`server.ts` (نقطة الدخول)**:
   - أصبح ملف تنسيق محين يربط الوحدات المذكورة أعلاه تسلسلياً فقط.

## العيوب والمخاطر الحرجة الموثقة (DO NOT MIGRATE TO alx_api)

تم توثيق العيوب الحرجة الآتية داخل الترويسات والتعليقات الخاصة بكل وحدة:
1. **كلمات المرور بالنص الصريح (Plain-text passwords)**: لا تزال مخزنة في `public.users` ومقارنتها صريحة في `/api/auth/verify-login`.
2. **بيانات الاعتماد الثابتة (Hardcoded admin credentials)**: الحساب `admin@swiftship.system` بكلمة مرور ثابتة داخل `client.ts`.
3. **قائمة ROOT_EMAILS الثابتة**: قائمة الإيميلات الجذرية معرفة كـ array ثابت داخل `routes/auth.ts`.
4. **CORS واسع وحسابات admin تلائم البيئة المؤقتة**: موثقة في `legacy-compat.ts`.

## نتائج التحقق

1. **TypeScript Typecheck**:
   - تم تشغيل `npx tsc --noEmit` بنجاح كامل بدون أي خطأ (0 errors).
2. **Unit / Integration Tests**:
   - `server/app.test.ts`: 4/4 tests passed.
   - `server/browser-proxy/route.test.ts`: 2/2 tests passed.
   - جميع اختبارات الـ wiring في `server/`: ناجحة.

## القيود والحدود
- لم يتم نقل قاعدة البيانات إلى `alx_api`.
- لم تتغير واجهات Supabase Adapter المؤقتة.
- جميع مسارات Express حافظت على نفس العقود المدخلة والمخرجة.
