# المراجعة الحية الشاملة لـ SwiftShip وALX — 2026-10-08

**وقت المراجعة:** 2026-10-08 22:50 (+03:00)
**المنفّذ:** Manus AI
**النطاق:** مستودعات `Aporaad/swiftship` و`Aporaad/alx_web` و`Aporaad/alx_api`، خدمة API المنشورة، بوابة الموقع، ومشروع Supabase المرتبط.
**الهدف:** قياس التنفيذ الفعلي لخطة إنشاء الـ API، والتحول الكامل من الوصول المباشر إلى Supabase، والجاهزية التشغيلية.

## الحكم الحالي

المشروع **ليس في حالة API-only كاملة بعد**. نسبة العزل في `alx_web` مثبتة عمليًا، لكن تطبيق `swiftship` الرئيسي ما زال يحتوي على طبقات وواجهات واستدعاءات Supabase مباشرة، كما أن عدة بوابات API تعتمد على feature flags منفصلة أو fallback قديم. لذلك لا يمكن اعتماد نسب التقارير السابقة التي أعلنت اكتمالًا كليًا للنظام.

التقدير المحافظ الحالي:

- **`alx_api`: 90% من البناء الوظيفي، و65% من الجاهزية الإنتاجية.** الوحدات الأساسية والمصادقة وRBAC والعقود موجودة، لكن الاختبار الكامل الحالي تعطل بـ segmentation fault في Jest، ولم يثبت اختبار حمل أو تشغيل مراقبة إنتاجية.
- **`alx_web`: 95% من عزل البوابة عن Supabase.** فحص `audit:portal-boundary` نجح بـ 0 مخالفات، مع بقاء اعتماد الحزمة `@supabase/supabase-js` وملف build فارغ باسم `supabase`، وهو ليس دليلًا وحده على وصول مباشر من المصدر.
- **`swiftship`: 60% تقريبًا من التحول الكامل.** توجد بوابات HTTP كثيرة وتكوين نموذجي يضع flags على `true`، لكن الكود ما زال يحتفظ بـ 13 ملفًا تشغيليًا/اختباريًا فيها `supabase.from` أو `createClient` أو استيراد Supabase مباشر، كما أن عددًا من البوابات لا يربط `VITE_USE_HTTP_API` تلقائيًا.
- **الإجمالي نحو 78%** عند الجمع بين بناء الـ API، قطع الاعتمادية، والتصليد التشغيلي. هذه نسبة تقديرية لاتخاذ القرار وليست قياسًا آليًا لعدد الأسطر.

## نسخ المستودعات التي تمت مراجعتها

| المستودع | الفرع | HEAD | آخر رسالة commit | الحالة |
|---|---|---|---|---|
| `swiftship` | `main` | `62cdaa9954d5d246c0035e4a88dab887216dbca5` | إصلاح خطاء ظهور الواجهه | نظيف محليًا بعد التثبيت والبناء |
| `alx_web` | `main` | `c7d11c0ad7518644ac2e21039ebcea7173a66d3f` | اكمال تنفيذ الاصلاح والتكامل مع ال API في الموقع المرحله 3 | نظيف محليًا بعد التحقق |
| `alx_api` | `main` | `e95fbc8c3cbbd4a2c5cc00451fffe26acadb11d6` | اكمال تنفيذ الاصلاح والتكامل مع ال API | التحقق البرمجي نجح حتى بدء Jest، ثم تعطل Jest بـ exit 139 |

## نتائج التحقق المحلي

### `swiftship`

- `pnpm run check`: نجح.
- Vitest: **76 ملف اختبار ناجح، 276 اختبارًا ناجحًا، 3 ملفات و8 اختبارات متخطاة**.
- `pnpm run build`: نجح للواجهة والخادم.
- تحذيرات البناء المهمة:
  - chunk رئيسي للواجهة بحجم يقارب **3.57 MB** قبل الضغط.
  - تحذير `import.meta` عند إخراج خادم CommonJS.
  - وجود legacy compatibility وطبقات Supabase ما زال ظاهرًا في dependency graph.
  - توليد chunk فارغ باسم `supabase`.

### `alx_web`

- `npm run check`: نجح.
- Vitest: **5 ملفات، 20 اختبارًا ناجحًا**.
- `npm run build`: نجح.
- `npm run audit:portal-boundary`: نجح بالنص: `API-only boundary clean: no direct Supabase dependencies in alx_web source.`
- الاعتماد على `@supabase/supabase-js` ما زال في package/تهيئة bundler، لكن لم يظهر وصول مباشر في مصدر البوابة بحسب أداة التدقيق.

### `alx_api`

- `npm run check`: نجح قبل تشغيل الاختبارات.
- `npm test -- --runInBand`: تعطل عند `tests/security.test.ts` بـ **Segmentation fault / exit 139**. إعادة تشغيل الاختبار الأمني منفردًا أعادت exit 139، كما انهار Jest عند تشغيل اختبار وحدة مختلف مع `--maxWorkers=1`؛ لذلك المؤشر الحالي هو عطل بيئي/تشغيلي عام في Jest أو Node/dependency وليس فشل assertion خاصًا بوحدة واحدة. لم يتم تسجيل نتيجة نجاح للاختبارات، ولا يجوز اعتماد أرقام التقارير السابقة دون إصلاح البيئة وإعادة الاختبار.
- لم يُعتمد `npm run build` في هذه الجولة بسبب توقف سلسلة الأمر عند فشل Jest.
- الإجراء التالي المطلوب: إعادة تشغيل Jest في بيئة Node مستقلة مع فحص الذاكرة/الـ worker، ثم تشغيل الاختبارات دون `--runInBand` وبحدود worker صريحة، وتحديد الاختبار أو dependency المسبب قبل الإطلاق.

## دليل بقاء الاعتماد المباشر في `swiftship`

خارج الوثائق وملفات build، وجد الفحص **13 ملفًا** تحتوي على استيراد Supabase مباشر أو `supabase.from` أو `createClient`، منها:

- `src/components/JobApplicationsModal.tsx`
- `src/components/Layout.tsx`
- `src/components/PendingPortalApprovalsModal.tsx`
- `src/features/siteManagement/pages/WebsiteManagementPage.tsx`
- `src/features/siteManagement/services/siteManagementGateway.ts`
- `src/services/portalUserService.ts`
- `src/lib/supabase-adapter.ts`
- بوابات `src/data/current-supabase/gateways/*`
- اختبارات وتكاملات Supabase في `server/` و`src/services/`
- `scripts/migrate-accounts-columns.mjs`

هذا لا يعني أن كل ملف مستخدم في كل مسار إنتاجي عند تفعيل HTTP، لكنه يثبت أن إزالة الاعتماد لم تكتمل على مستوى المستودع، وأن fallback القديم ما زال جزءًا من التصميم.

## حالة أعلام التحول

`.env.example` في `swiftship` يضع `VITE_USE_HTTP_API=true` ومعه عدة flags للقراءة والكتابة، لكن التنفيذ غير موحد:

- بوابات العملاء والمندوبين والمصادر تربط بعض flags بـ `VITE_USE_HTTP_API`.
- بوابات الطلبات والأدوار والمستخدمين والموظفين والتقارير والمالية تعتمد على flags منفصلة في مواضع مهمة.
- لذلك فإن وجود `VITE_USE_HTTP_API=true` في المثال لا يثبت أن كل العمليات تستخدم API في وقت التشغيل.
- يلزم اختبار E2E فعلي لكل نطاق، مع إيقاف مفاتيح Supabase ومراقبة network/server logs للتأكد من عدم وجود fallback صامت.

## حالة الخدمة المنشورة

تم فحص الخدمة العامة دون استخدام بيانات مستخدمين أو تنفيذ كتابة:

- `GET https://alx-api-79ip.onrender.com/api/v1/health/live` أعاد **200** و`status: alive`.
- `GET https://alx-api-79ip.onrender.com/api/v1/health/ready` أعاد **200**، وفحص قاعدة البيانات والمصادقة أعاد `true`.
- المسار العام `/api/v1/health` أعاد **404**، وهو متوافق مع كون مسارات الصحة الفعلية هي `live` و`ready`، لكنه يستحق توحيد التوثيق حتى لا يستخدم التشغيل مسارًا غير موجود.
- `https://alx-web.onrender.com` أعاد **200** وHTML عربيًا سليمًا.
- فحص Render MCP التفصيلي لم يُنفذ لأن مساحة Render تحتاج اختيارًا صريحًا من المستخدم قبل قراءة الخدمات؛ لذلك لا أعدّ حالة deploy/event/logs مفحوصة من Render API في هذه الجولة.

## حالة قاعدة البيانات الحية

مشروع Supabase المرتبط هو `ejrojwbbflzchasvgexr`، حالته `ACTIVE_HEALTHY`، ومحرك PostgreSQL 17.6.1.155. سجل المهاجرات يحتوي على مهاجرات API وPortal حتى `portal_payment_requests_0017`.

لم يتم تنفيذ DDL أو DML أو SQL خام في هذه المراجعة. تم استخدام قراءات metadata/advisors فقط، ولم تتم قراءة بيانات شخصية.

أهم النتائج الأمنية من advisors:

- **49 جدولًا عامًا بدون RLS مفعّل.**
- **27 حالة** فيها policies موجودة مع RLS معطّل.
- **44 دالة SECURITY DEFINER** قابلة للتنفيذ من `anon` بحسب advisor، وتحتاج مراجعة صلاحيات `EXECUTE` أو نقلها/تقييدها.
- **60 دالة** لديها `search_path` قابل للتغيير.
- تحذير أداء عن **57 foreign key** بلا index مناسب.
- **38 index** غير مستخدمة، وindex مكرر واحد على `employees`.
- تحذير `auth_rls_initplan` واحد في سياسة `cust_details`.

هذه النتائج لا تعني أن API المنشور مكشوف تلقائيًا، لكنها تعني أن طبقة Supabase القديمة لا تحقق معيار الإغلاق الأمني المطلوب قبل إزالة الوصول المباشر نهائيًا.

## قياس مراحل خطة إنشاء API

| المرحلة | التقدير الحالي | الحالة المثبتة |
|---|---:|---|
| 0 — تثبيت المتطلبات | 100% | القرارات المعمارية موثقة ومطبقة جزئيًا في المستودعات |
| 1 — Scaffold وTooling | 100% | TypeScript/Express/scripts/health/logging موجودة |
| 2 — PostgreSQL وDrizzle | 95% | schema ومهاجرات API موجودة؛ اختبار API الكامل تعطل بيئيًا |
| 3 — Auth Core | 95% | Argon2id/JWT/session/refresh موجودة؛ يلزم إعادة إثبات Jest |
| 4 — RBAC | 95% | modules وpermissions وmiddleware موجودة؛ يلزم E2E وصلاحيات تشغيلية |
| 5 — OpenAPI والعقود | 90% | OpenAPI وZod موجودان؛ SDK مولد تلقائيًا غير مثبت كمخرج مستهلك |
| 6 — العملاء | 85% | API وgateway موجودان؛ تحقق UI الكامل والملكية في التشغيل متبقٍ |
| 7 — الطلبات والشحنات | 80% | API وidempotency موجودان؛ cutover الكامل في النظام غير مثبت |
| 8 — المالية والمصروفات | 80% | API/قواعد مالية موجودة؛ E2E وmonitoring وfallback removal متبقية |
| 9 — الإشعارات والتكاملات | 70% | module موجود؛ مزود إنتاجي وretry/observability يحتاجان إثباتًا |
| 10 — نقل العملاء | 65% | `alx_web` ناجح؛ `swiftship` ما زال يحتوي legacy/direct paths |
| 11 — Hardening والإطلاق | 25% | runbook/threat docs موجودة، لكن load/restore/monitoring وإغلاق advisors متبقية |

## الفجوات المتبقية بترتيب التنفيذ

1. **إغلاق فشل `alx_api` الاختباري:** تحديد سبب segmentation fault في `tests/security.test.ts` وتشغيل check/test/build بنجاح موثق.
2. **إكمال قطع `swiftship`:** نقل الملفات الـ13 إلى gateways/API أو حصرها صراحة في أدوات migration/integration غير الإنتاجية، وإضافة boundary audit للنظام الرئيسي.
3. **توحيد feature flags:** جعل كل بوابة تعتمد مصدر قرار واحدًا، مع منع fallback الصامت عند تفعيل cutover، وإضافة اختبار يثبت كل read/write domain.
4. **تنفيذ E2E مصادق عليه:** auth، users/roles، customers، orders/shipments، couriers/staff، finance، reports/dashboard، notifications، settings، portal.
5. **إكمال API contract delivery:** توليد SDK مضبوط الإصدار من OpenAPI أو توثيق قرار عدم استخدامه، ثم استهلاكه في الواجهات بدل clients اليدوية.
6. **Hardening:** load test، rate-limit موزع عند الحاجة، مراقبة errors/latency، سجل تدقيق تشغيلي، وقياس connection pool.
7. **تأمين Supabase قبل إيقاف legacy:** مراجعة RLS و`SECURITY DEFINER` و`EXECUTE` و`search_path` وفق خطة إزالة الوصول المباشر، مع backup/restore drill وrollback موثق.
8. **إثبات التشغيل على Render:** بعد اختيار workspace الصحيح، مراجعة service/deploy/event/logs، ثم smoke test read-only ومصفوفة rollback.

## قرار الجاهزية

**لا أوصي بإعلان 100% API cutover أو Production Readiness الآن.** الخدمة الأساسية حية وتستجيب، و`alx_web` في وضع جيد، لكن `swiftship` الرئيسي ما زال يملك مسارات legacy حقيقية، و`alx_api` لم يثبت اختبار Jest الكامل في هذه الجولة، وقاعدة البيانات تحمل إنذارات أمنية جوهرية.

## المراجع

- [1]: https://github.com/Aporaad/swiftship "مستودع النظام الرئيسي"
- [2]: https://github.com/Aporaad/alx_web "مستودع بوابة الموقع"
- [3]: https://github.com/Aporaad/alx_api "مستودع خدمة API"
- [4]: https://alx-api-79ip.onrender.com/api/v1/health/live "نقطة الصحة الحية لخدمة API"
- [5]: https://alx-api-79ip.onrender.com/api/v1/health/ready "نقطة جاهزية خدمة API"
- [6]: https://supabase.com/docs/guides/database/database-linter "مرجع Supabase Database Advisors"
