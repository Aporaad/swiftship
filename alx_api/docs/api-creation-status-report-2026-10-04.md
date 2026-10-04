# تقرير حالة إنشاء `alx_api`

**تاريخ التقرير:** 2026-10-04 (UTC+03:00)
**المستودع الأساسي:** `Aporaad/swiftship` — الفرع `main`
**نقطة Git التي بدأ منها إعداد التقرير:** `e91a69431c81a1a9b12a34bee834aed77c46f6fd`
**المستودع المقابل للموقع:** `Aporaad/alx_web` — `main@23cf870`
**النطاق:** تلخيص التنفيذ ومطابقته مع `alx_api_creation_plan_ar.md`، وتسجيل ما لم يكتمل. لم تُنفذ أي أوامر SQL أو تغييرات قاعدة بيانات أثناء إعداد هذا التقرير.

> **الحكم التنفيذي:** أُنجزت بنية API وطبقة Auth الأساسية، وأُنشئت جداول Auth، وفُرضت عليها RLS وصلاحيات محدودة، ووُصل Repository والخدمة بالخادم عند توافر الإعدادات. لكن هذا **ليس اكتمالاً لخطة API ولا جاهزية إنتاجية**: جداول الاعتمادات فارغة، ولا يستطيع المستخدمون الحاليون تسجيل الدخول عبر API، وRBAC ووحدات الأعمال ونقل العملاء والاختبارات التكاملية والإطلاق لم تكتمل.
>
> **تنبيه أمني عاجل:** ملف `alx_api/.env` الذي يحتوي أسرار تشغيلية ومفتاح توقيع أُدرج في مستودع GitHub عام بناءً على طلب المستخدم وتأكيده الصريح. هذا يجعل القيم مكشوفة عملياً؛ يلزم تدويرها وتنظيف تاريخ Git قبل أي استخدام إنتاجي. لا يعرض هذا التقرير أي قيمة سرية.

## 1. ملخص ما أُنجز

### 1.1 تأسيس الخدمة وطبقة HTTP

- إنشاء خدمة مستقلة داخل `alx_api` باستخدام TypeScript strict وExpress 5 وPostgreSQL (`pg`) وDrizzle ORM وZod.
- اعتماد بادئة المسارات `/api/v1`، مع استجابات نجاح/خطأ موحدة و`requestId`.
- إضافة `Helmet`، وCORS allowlist، وحدود لحجم JSON، وrate limits عامة وخاصة بالمصادقة، ومعالجة أخطاء لا تكشف SQL أو stack trace، وتسجيل HTTP من خلال Pino مع حجب Authorization/Cookie.
- توفير `/api/v1/health/live` و`/api/v1/health/ready`؛ readiness يفحص أذونات الجداول والـview المطلوبة، لا مجرد نجاح `SELECT 1`.
- إعداد أوامر `check` و`test` و`build`، وإضافة workflow في `.github/workflows/alx-api.yml` يشغل `npm ci` ثم الأنواع والاختبارات والبناء.

### 1.2 نواة المصادقة المنفذة

- خدمة `AuthService` مفصولة عن HTTP عبر منفذ `AuthUseCases` ومستودع `AuthRepository`.
- تجزئة كلمات المرور والتحقق منها بـArgon2id، مع salts فريدة؛ وإجراء تحقق وهمي لتقليل كشف وجود المستخدم عند فشل الدخول.
- إصدار/تحقق JWT بتوقيع Ed25519، مع إعدادات مفاتيح ومدد صلاحية تمر من تحقق البيئة.
- إنشاء جلسة وrefresh token عشوائي؛ تخزين hash فقط؛ تدوير token؛ كشف إعادة استخدام token قديم وإبطال عائلة الجلسة؛ ودعم logout للـrefresh token.
- تطبيع المعرّف والتحقق من حالة المستخدم ومدة القفل وزيادة/مسح عداد فشل الدخول.
- المسارات المنفذة: `POST /api/v1/auth/login` و`POST /api/v1/auth/refresh` و`POST /api/v1/auth/logout`.

**غير موجود بعد ضمن Auth:** تغيير كلمة المرور، إرسال/استهلاك password-reset tokens، عرض/إبطال جلسات المستخدم، `/auth/me` وmiddleware للمصادقة على الموارد، أحداث Auth/Audit مكتملة، ومسار نقل الاعتمادات القديمة. لا تمنح صلاحيات التشغيل الحالية وصولاً إلى `password_reset_tokens` أو `auth_events`.

### 1.3 قاعدة البيانات والأمن

طُبقت سابقاً هجرتان بموافقة المستخدم على مشروع Supabase المتصل:

1. `alx_api_auth_foundation_0002`: إنشاء `alx_api_private` وستة جداول فارغة:
   - `user_credentials`
   - `user_security`
   - `api_sessions`
   - `api_refresh_tokens`
   - `password_reset_tokens`
   - `auth_events`
2. `alx_api_auth_rls_runtime_0003`: إنشاء دور تشغيل محدود وتفعيل وفرض RLS على الجداول الستة، وسحب الوصول من `PUBLIC` و`anon` و`authenticated` و`service_role`.

تفاصيل أقل الصلاحيات:

- الدور `alx_api_runtime` غير مميز، ولا يملك `SUPERUSER` أو إنشاء قواعد/أدوار أو `BYPASSRLS`.
- أضيفت `alx_api_private.api_login_users` كـview ضيقة تعرض `user_id`, `username`, `email`, `role`, `disabled` فقط، ويستخدمها Auth Repository بدلاً من قراءة `public.users` مباشرة.
- يمتلك الدور `SELECT` على الـview و`user_credentials`، و`SELECT/INSERT/UPDATE` على `user_security` و`api_sessions` و`api_refresh_tokens` فقط. لا يملك صلاحيات على `password_reset_tokens` أو `auth_events` أو قراءة مباشرة من `public.users`.
- بيانات `public.users.password` و`public.users.system_pin` لم تُقرأ ولم تُنسخ ولم تُحذف. الجداول الجديدة ظلت فارغة في آخر توثيق التحقق؛ لا يوجد مسار ترحيل بيانات اعتماد.
- لم تتغير RLS/Grants على بقية مخطط `public` ضمن هاتين الهجرتين.

### 1.4 ربط الخادم والتشغيل المحلي

- إنشاء Drizzle Auth Repository وfactory وحقنهما في الخادم عند اكتمال الإعدادات.
- دعم `.env` المحلي اختيارياً عبر Node 22، وضبط Pool واحد، وفحوص readiness على مخطط Auth وlogin view.
- الاتصال التطويري يستخدم TLS مشفراً بوضع `DATABASE_SSL_MODE=require` لكنه لا يتحقق من CA/اسم المضيف. وضع الإنتاج يتطلب `verify-full` وشهادة CA موثوقة؛ لا يُعد إعداد التطوير صالحاً للإنتاج.
- اختبار HTTP موثق محلياً: readiness أعاد `200`، وطلب login بهوية اصطناعية غير موجودة أعاد `401` برسالة عامة. هذا اختبار wiring/رفض آمن؛ **ليس** دليلاً على نجاح دخول حساب حقيقي.

## 2. مطابقة مراحل خطة إنشاء API

| المرحلة في `alx_api_creation_plan_ar.md` | الحالة | الدليل/المتبقي |
|---|---|---|
| 0 — تثبيت المتطلبات والقرارات | **جزئية** | التقنية والمصادقة الأساسية محددة. ما زالت قرارات العملاء/نقل access token، قائمة الأدوار والصلاحيات، CORS الرسمية، قناة reset/MFA، الاحتفاظ بالتدقيق، وبيئات DB المنفصلة بحاجة اعتماد. |
| 1 — Scaffold وTooling | **منجزة كأساس** | TypeScript strict وExpress 5 وscripts وCI وhealth وHTTP middleware والاختبارات موجودة. لا يوجد lint script مستقل داخل `alx_api`، ولا تكامل CI مع قاعدة اختبار حتى الآن. |
| 2 — PostgreSQL وDrizzle | **جزئية متقدمة** | Pool وschema وRepository وهجرتان مطبقتان. المتبقي اختبار migrations/transactions على PostgreSQL اختبارية معتمدة، مراجعة rollback، واختبارات تكامل حقيقية؛ الاختبارات الحالية محلية/وحدات ولا تغطي تشغيل الاختبارات على DB معزولة. |
| 3 — Auth Core | **جزئية** | login/refresh/logout وArgon2id وEd25519 والجلسات وتدوير refresh مبرمجة ومختبرة. المتبقي ترحيل/إعادة تعيين الاعتمادات، تغيير/reset كلمة المرور، إدارة الجلسات، Auth events/audit، وإكمال سياسات القفل والتشغيل. |
| 4 — RBAC | **غير مبدوءة** | لا توجد بعد منظومة API كاملة لجداول roles/permissions وresolver وmiddleware واختبارات permission matrix وواجهات إدارة المستخدمين/الأدوار. الدور المخبري/التشغيلي في PostgreSQL ليس بديلاً عن RBAC الخاص بالمستخدمين. |
| 5 — OpenAPI والعقود | **جزئية** | جرى في هذه المهمة تصحيح `docs/openapi.yaml` ليصف المسارات والاستجابات الفعلية والغلاف الموحد. يلزم بعد ذلك توليد/مراجعة العقود آلياً أو إضافة اختبار يمنع اختلاف OpenAPI وZod، وتوثيق بقية الوحدات عند بنائها. |
| 6 — Customers | **غير مبدوءة** | لا يوجد Customers module مكتمل end-to-end ولا عميل تجريبي يستهلكه عبر HTTP. |
| 7 — Orders/Shipments/Tracking | **غير مبدوءة داخل API** | لا توجد repositories/services/endpoints أو state transitions وtransactions وidempotency متكاملة لهذه النطاقات. |
| 8 — Accounting/Expenses | **غير مبدوءة داخل API** | لا توجد وحدات مالية بالـAPI أو ضمانات قيود متوازنة/عكس/Audit/transactions. يجب عدم البدء قبل تثبيت Auth/RBAC وقاموس البيانات. |
| 9 — Notifications/Integrations | **غير مبدوءة** | لا يوجد adapter مستقل أو outbox/retry/idempotency للموفرين الخارجيين. |
| 10 — نقل العملاء | **تهيئة سابقة فقط؛ النقل النهائي غير مبدوء** | توجد بوابات وعقود انتقالية سابقة، لكن النظام والموقع لم يتحولا بعد إلى استهلاك API لكل النطاقات، ولا يزال الوصول المباشر/التوافق القديم قائماً. |
| 11 — Hardening والإطلاق | **جزئية/غير جاهزة** | توجد بعض ضوابط HTTP وRLS، وCI basic، لكن لم يُنجز threat model نهائي وdependency audit وsecurity/load tests وbackup/restore drill وrunbooks ومراقبة/نشر وTLS CA للإنتاج. كما أن أسرار `.env` مكشوفة في مستودع عام. |

## 3. متطلبات ما قبل API التي بقيت مفتوحة

هذه الأعمال تتبع خطة `system_pre_api_restructure_plan_ar.md`، وهي منفصلة عن اكتمال scaffold الخاص بالـAPI:

- جرد حالي للمستودع الأساسي وجد **91 ملف مصدر** ما زال يشير إلى `legacy-compat` أو `legacy-adapter`. طبقة التوافق أصبحت مركزية في `src/data/legacy/legacy-compat.ts`، لكن وجودها في نقطة مركزية لا يعني إزالة مستهلكيها. ينبغي نقل كل مجال إلى Feature Gateway بعقد typed واختبارات، ثم حذف الحدود القديمة بعد وصول عدد المستهلكين إلى صفر.
- تدقيق TypeScript AST في النطاقات الحرجة `auth`, `orders`, `accounting`, `financeEntries`, `server/routes`, `server/current-db` وجد **صفر أنواع `any` فعلية**. ظهرت 12 مطابقة نصية لكلمة `any` في الفحص النصي الأوسع، لكن AST لم يصنفها كأنواع `any` في هذه النطاقات.
- مستودع الموقع المنفصل عند التدقيق `main@23cf870` ما زال يحوي 4 ملفات ذات مراجع Supabase مباشرة: `src/lib/legacy-supabase/supabase.ts`, `src/lib/custDetailsHelper.ts`, `src/context/PortalAuthContext.tsx`, `src/pages/auth/ForgotPasswordPage.tsx`. هذا يعني أن وجود Portal HTTP Gateway لا يثبت اكتمال إزالة الاستدعاءات المباشرة؛ يلزم تدقيق الملفات ونقلها واختبارها. لم تُجر تغييرات على مستودع الموقع في مهمة التقرير.
- يلزم إكمال Canonical DTO/Data Dictionary للهوية والعملاء والطلبات والشحنات والمالية، مع حسم أسماء الحالات والمعرفات والحقول القديمة وJSONB والعلاقات. تقرير التحقق الحي موجود، لكنه لا يغني عن اعتماد قاموس البيانات قبل نقل وحدات الأعمال.

## 4. الخطوات المتبقية حسب الأولوية

### P0 — احتواء انكشاف الأسرار قبل أي نشر أو استخدام فعلي

1. تدوير كلمة مرور الدور `alx_api_runtime` ومفتاح JWT الخاص اللذين ظهرا داخل `.env` المنشور في مستودع عام؛ تحديثهما في مدير أسرار خاص ثم إبطال القيم القديمة.
2. تدوير كلمة مرور مالك قاعدة البيانات التي أُرسلت في المحادثة، ثم التأكد أن الخدمة لا تستخدمها وأن الاتصال مقتصر على دور runtime.
3. إزالة `.env` من النسخة الحالية للمستودع وعدم إعادة إضافته، ثم التخطيط لتنظيف تاريخ Git العام وإزالة القيم من commits السابقة. تنظيف التاريخ يتطلب إعادة كتابة تاريخ/force-push وتنسيقاً مع أي clones؛ لم يُنفّذ ضمن هذا التقرير.
4. بعد التدوير والتنظيف، تشغيل secret scanning على الشجرة والتاريخ، وتأكيد عدم بقاء المفاتيح/كلمات المرور صالحة.

### P0 — TLS وبيئة التشغيل

5. الحصول على CA الرسمية من إعدادات Supabase وضبط `DATABASE_SSL_MODE=verify-full` و`DATABASE_SSL_CA_PEM` في secret manager، ثم اختبار الاتصال والشهادة. لا تستخدم `require` في الإنتاج.
6. فصل `local`, `test`, `staging`, `production` فعلياً ببيانات اعتماد وقواعد منفصلة. لا تُجر اختبارات migrations على قاعدة الإنتاج.
7. اعتماد طريقة تشغيل/إيقاف الخدمة، graceful shutdown، إدارة secrets، وسجلات/مراقبة خالية من credentials.

### P0 — خطة بيانات الاعتماد وتفعيل Auth الحقيقي

8. اعتماد سياسة موثقة لكيفية التعامل مع `public.users.password` و`system_pin` بعد تحديد التنسيقات بأوصاف/إحصاءات لا تكشف القيم: Argon2id متوافق، أو bcrypt/غيره، أو plaintext مؤكد، أو فارغ/ملتبس. لم يُفترض أي تنسيق حتى الآن.
9. اختيار مسار التحويل: إعادة تجزئة داخل مهاجر محمية إذا ثبت plaintext؛ نقل hash المتوافق فقط؛ أو تحقق legacy مؤقت يعيد التجزئة عند نجاح الدخول/فرض reset للتنسيقات غير القابلة للتحويل. الـPIN ليس كلمة مرور ولا يُنقل كبديل لها.
10. تنفيذ migration قابلة للإعادة ومحدودة الصلاحيات، مع backup مشفر، أعداد قبل/بعد فقط، اختبار اصطناعي، وخطة rollback/استعادة. لا تطبع كلمة مرور أو PIN أو hash في logs أو التقرير.
11. لا تفتح تسجيل الدخول الفعلي حتى يثبت اكتمال credentials، واختبارات DB، وقواعد التكرار، ورسائل الفشل العامة، والقفل، وإبطال الجلسات.

### P1 — استكمال Auth وRBAC

12. إضافة password change/reset مع tokens أحادية الاستخدام، وتحديد قناة إرسال reset، وربطها بمخزن tokens بسياسات وصول مخصصة.
13. إضافة Auth audit events/سياسة الاحتفاظ، وتوسيع الصلاحيات المطلوبة فقط لـ`alx_api_runtime` بعد اعتماد كل use case.
14. إضافة session listing/revocation، logout-all، access-token authentication middleware، `/auth/me`، وتحديث OpenAPI والاختبارات.
15. بناء RBAC: roles/permissions/user_roles/role_permissions، seeds معتمدة، deny-by-default middleware وpermission/resource ownership tests. لا تعتمد على role نصي داخل JWT وحده.

### P1/P2 — وحدات الأعمال والعقود

16. تثبيت قاموس البيانات وعقود DTO/error/pagination وstate machine قبل كتابة endpoints.
17. تنفيذ Customers end-to-end أولاً، ثم Orders/Order Items/History وShipments/Tracking/Couriers مع transactions وidempotency.
18. بعد تثبيت Auth/RBAC والقيود المالية، تنفيذ Accounting/Expenses/Finance Entries مع numeric، قيود متوازنة، عكس القيود، وعدم الحذف المباشر، وAudit.
19. تنفيذ Notifications/integrations خلف adapters وoutbox/retry عند الحاجة.

### P2/P3 — ترحيل العملاء والتشغيل الإنتاجي

20. نقل Auth ثم Users/Roles ثم Customers/Orders/Shipments/Finance إلى HTTP clients في النظام والموقع؛ إزالة كل direct Supabase client access تدريجياً.
21. استكمال Gateway migration في النظام الأساسي وإزالة الـ91 مستهلكاً من `legacy-compat` على دفعات، ثم حذف adapter عند خلو المستهلكين.
22. معالجة ملفات Portal الأربعة المبينة أعلاه، والتأكد من أن Public Tracking لا يكشف PII.
23. استكمال Contract/Integration/Security/Authorization tests على PostgreSQL اختبارية، واختبار migrations/rollback، وdependency audit، وload test، وbackup/restore drill، وincident/runbooks، والنشر والمراقبة.
24. خفض حجم bundle وإزالة تحذيرات build القائمة: الحزمة الرئيسية تقارب 3.55 MB غير مضغوطة، كما يظهر تحذير `import.meta` عند بناء الخادم بصيغة CJS. لا تمنع هذه التحذيرات build، لكنها دين تقني مفتوح.

## 5. نتائج التحقق في إعداد التقرير

| الفحص | النتيجة |
|---|---|
| `alx_api`: `npm run check` | ناجح |
| `alx_api`: `npm test -- --runInBand` | 10 suites ناجحة، 44 اختباراً ناجحاً |
| `alx_api`: `npm run build` | ناجح |
| OpenAPI YAML | صالح؛ 5 paths و8 schemas، وبعدها يجب الحفاظ على مزامنته مع Zod والـroutes |
| النظام الأساسي: `npm run check` | ناجح |
| النظام الأساسي: `npm test -- --run` | 76 ملفاً ناجحاً، 3 متخطاة؛ 274 اختباراً ناجحاً و8 متخطاة |
| النظام الأساسي: `npm run build` | ناجح مع تحذير bundle كبير وتحذيرات `import.meta` عند إخراج CJS |
| AST للـ`any` في النطاقات الحرجة المحددة | 0 نوع `any` فعلي |
| مراجع التوافق في النظام الأساسي | 91 ملف مصدر حسب فحص الملفات الحالي |
| مراجع Supabase في Portal | 4 ملفات في checkout `main@23cf870`؛ لم تُعدل أو تختبر في مهمة التقرير |
| HTTP smoke سابق موثق | readiness `200` وlogin اصطناعي غير موجود `401`؛ ليس اختبار اعتماد مستخدم حقيقي |
| قاعدة البيانات أثناء إعداد التقرير | لا SQL ولا تغييرات DB؛ التقرير اعتمد على migrations والسجلات المتحققة سابقاً |

## 6. معيار الانتقال إلى المرحلة التالية

الأولوية المنطقية ليست إضافة وحدات Orders أو Finance فوراً. الترتيب المقترح:

1. **احتواء الأسرار المكشوفة** وتثبيت TLS صحيح للإنتاج.
2. اعتماد وتنفيذ credential migration بأمان، ثم PostgreSQL integration tests لطبقة Auth.
3. إكمال دورة Auth وإضافة middleware وRBAC.
4. تثبيت Canonical DTOs وقاموس البيانات.
5. بدء Customers كأول module تجريبي عبر HTTP، ثم Orders/Shipments، ثم Finance.
6. نقل العملاء وإغلاق legacy imports، ثم اختبارات hardening والإطلاق.

يُعد Auth API جاهزاً للاستخدام مع مستخدمين حقيقيين فقط بعد نجاح الترحيل والـintegration/security checks. وتُعد **خطة إنشاء API كاملة** منجزة فقط بعد تنفيذ المراحل 0–11 ومعايير القبول في الخطة الأصلية، لا بمجرد نجاح scaffold أو جاهزية health endpoint.

## 7. مراجع الحالة

- [خطة إنشاء alx_api](../alx_api_creation_plan_ar.md)
- [خطة إعادة الهيكلة قبل API](../../system_pre_api_restructure_plan_ar.md)
- [README الخاص بـalx_api](../README.md)
- [خطة حماية Auth وترحيل الاعتمادات](auth-storage-security-and-credential-migration.md)
- [تقرير التحقق من المخطط الحي](../../docs/pre-api/database-schema-verification-2026-10-04.md)
- [سجل تنفيذ التأسيس المؤجل تاريخياً](auth-database-foundation-deferred.md)
- [OpenAPI الحالي](openapi.yaml)

**ملاحظة توثيقية:** أُضيف التقرير بعد الحفاظ على كل الإدخالات السابقة في سجلات المشروع append-only. لم يُنفذ SQL ولم تُعدّل قاعدة البيانات في مهمة إعداد التقرير.
