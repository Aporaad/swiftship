# تنفيذ فجوات ما قبل API وبدء Scaffold — 2026-10-04

**النطاق:** SwiftShip (`Aporaad/swiftship`)، Portal (`Aporaad/alx_web`)، و`alx_api` ضمن مستودع SwiftShip.
**النموذج:** Manus.
**قاعدة التنفيذ:** شفرة/HTTP/اختبارات/توثيق فقط. بناءً على تعليمات المستخدم الأخيرة لم تُنفذ SQL ولم تتغير قاعدة البيانات أو RLS/Grants.
**النسخ الأساسية:** SwiftShip `7b4103c`؛ Portal `bffae17` قبل تغييرات هذه المهمة.

## ما أُنجز

### 1. تأسيس `alx_api`

أضيف Scaffold مستقل أولي: Node 22، Express 5، TypeScript صارم، إعداد بيئة typed بـZod، Request ID، logging عبر Pino مع redaction، Helmet، CORS allowlist، rate limiting، استجابات موحدة، factory لـPostgreSQL Pool/Drizzle، OpenAPI health contract، README، واختبارات HTTP تأسيسية وGitHub Actions. اتصال قاعدة البيانات **غير مفعّل**، readiness يبقى `503`، ولا توجد مصادقة أو business endpoints أو migrations؛ لذلك لا تمثل الخدمة API أعمالاً جاهزة أو منشورة.

### 2. بوابة Portal HTTP محدودة للقراءة العامة

أضيفت إلى خادم SwiftShip الحالي:

- `GET /api/v1/portal/announcements`: يعرض الإعلانات النشطة ضمن DTO محدود.
- `GET /api/v1/portal/tracking/:trackingToken`: يعرض الحالة والأحداث العامة فقط، مع حد أقصى 20 حدثاً.
- لا يعاد الاسم أو الهاتف أو العنوان أو الرصيد أو حقول سجل الطلب الخام.
- أضيفت اختبارات mapper/DTO لحالات PII وحقول غير صالحة.
- حُدّث عميل Portal ليفك envelope موحداً ويجري runtime validation، مع إبقاء تفعيل HTTP خلف `VITE_PORTAL_API_ENABLED` غير المفعّل افتراضياً.
- أضيفت CORS allowlist صريحة للمسارات في خادم النظام، وقالب `.env.example` محلي.

### 3. التحقق

- **SwiftShip:** `npm run check` ناجح؛ 74 ملف اختبار ناجحاً و3 متخطاة؛ 267 اختباراً ناجحاً و8 متخطاة؛ `npm run build` ناجح. بقيت تحذيرات bundle حجمه نحو 3.55 MB وتداخل legacy imports وتحذيرات `import.meta` مع CJS.
- **Portal:** `npm run check` ناجح؛ 5 اختبارات Gateway ناجحة؛ `npm run audit:portal-boundary` ناجح؛ `npm run build` ناجح.
- **alx_api:** `npm ci` و`npm run check` و`npm test` و`npm run build` ناجحة؛ 6 اختبارات تأسيسية ناجحة.
- نتائج portal tests تغطي العميل/envelopes وDTOs، ولا تشمل اتصالاً حياً بقاعدة البيانات أو smoke/E2E للنشر.

## فجوات لم تُغلق — لا يُعلن اكتمال خطة الإصلاح

1. لا يزال `legacy-adapter` مستورداً من **91 ملفاً** داخل `src`/`server`; لم ينفذ cutover كامل عنه.
2. ما زالت **64 مطابقة فعلية** لكلمة `any` (بعد استثناء ملفات الاختبار وتعليقات السطر فقط) ضمن نطاق Auth/Orders/Accounting/FinanceEntries وحدود `src/data` و`server/routes`؛ لم يحسم التدقيق المطلوب ولم تُحوّل هذه الأنواع في هذه الدفعة.
3. انتقل **مساران عامان للقراءة** فقط من Portal إلى HTTP. ما زال `PortalAuthContext` وبقية استعلامات/عمليات Portal تتعامل مباشرة مع Supabase/legacy؛ و`getCurrentSession` في HTTP client معلّم صراحة بأنه غير منفذ. بقيت 28 إشارة `.from/.rpc/supabase.auth` في Portal.
4. يستخدم 12 ملفاً من نطاقات الميزات المذكورة `AsyncState` حالياً، لكن الفحص لم يثبت تغطية/حسم كل Query وMutation والحالات الباقية؛ لذلك بقيت بوابة المرحلة 12 مفتوحة.
5. أُنشئ scaffold فقط. لم ينفذ Auth/RBAC ولا endpoints أعمال/مالية ولا توصيل PostgreSQL/Drizzle أو migrations.
6. لا يوجد اختبار Portal E2E/نشر، ولا تحقق route حي على بيانات فعلية. تم احترام طلب تجاوز بيئة اختبار منفصلة، لذلك لا توجد مصادقة staging.
7. بناءً على طلب المستخدم لم تُنفذ SQL، ولم يجر فحص جودة بيانات حي أو ownership/Grants أو RLS remediation. لم تُتغير أي بيانات.

## ملاحظة أمنية عن RLS

نتيجة metadata الخاصة بمخطط المشروع التي ظهرت في الجلسة أشارت إلى أن RLS معطل على 50 جدولاً عاماً. هذا **تحذير مسجل فقط**؛ بناءً على طلب المستخدم لم يُعدّل RLS/Grants ولم تُطبق أي SQL. يجب عدم تفسير هذا العمل على أنه إغلاق للمخاطر الأمنية أو جاهزية إنتاجية.

## قرار الإغلاق

**العمل المنفذ:** تم إنشاء أساس مستقل لـ`alx_api`، وربط قراءتي الإعلانات والتتبع عبر HTTP بشكل تدريجي وآمن من ناحية DTO، وإضافة اختبارات وتحقق البناء.

**القرار:** لا أُعلن اكتمال خطة الإصلاح ولا الجاهزية الإنتاجية في هذه الحالة؛ ما زالت فجوات legacy/any/AsyncState وPortal auth وبقية عمليات Portal مفتوحة. Scaffold غير مربوط بقاعدة البيانات ويظل غير جاهز (`readiness=503`) إلى حين تنفيذ مراحل API التالية واعتماد إعداداتها. تفاصيل الخطوة التالية موثقة في `todo.md`.
