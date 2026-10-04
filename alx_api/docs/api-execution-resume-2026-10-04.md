# تقرير استئناف تنفيذ `alx_api`

**تاريخ التحديث:** 2026-10-04 08:34 (+03:00)
**المستودع:** `Aporaad/swiftship` — الفرع `main`
**الخطة الحاكمة:** [`alx_api_creation_plan_ar.md`](../alx_api_creation_plan_ar.md)
**تقرير التقييم السابق:** [`api-creation-status-report-2026-10-04.md`](api-creation-status-report-2026-10-04.md)

## الحالة التنفيذية

بعد طلب المستخدم تشغيل API محلياً وإكمال Auth Core واختبار معاملات Repository ثم تثبيت أساس RBAC، اكتملت جولة الاختبارات والتشغيل المحلي. الخادم يستمع الآن على `127.0.0.1:3001` متصلاً بـPostgreSQL محلي وقاعدة `alx_api_test` فقط، باستخدام مفتاحي Ed25519 مولدين محلياً في ملف ignored بصلاحية `0600`. لم يقرأ الإعداد `.env` المرتبط بالاتصال البعيد.

**الخدمة API أصبحت عاملة محلياً على بيانات اصطناعية، لكنها ليست جاهزة للإنتاج.** تفعيل مزود reset/cutover وتوحيد صلاحيات الأدوار ما زال مطلوباً، كما لم يُنقل أي اعتماد حقيقي.

## التغييرات المنفذة

- أكملت طبقة Auth مسارات login/first-login Argon2id، bearer identity المرتبط بجلسة حية، profile، session listing/revocation/logout-all، refresh rotation/reuse detection، logout، lockout، Auth events، وتغيير/إعادة تعيين كلمة المرور بمفاتيح cutover آمنة.
- أضيفت migrations `0005_auth_core_passwords_and_events.sql` و`0006_rbac_foundation.sql`، وDrizzle schema/repository لدوال أقل صلاحية وأساس roles/permissions/user_roles/role_permissions. لا توجد seeds لأدوار الإنتاج. وُضع `requirePermission` deny-by-default؛ لا يقبل wildcard، ولا يمنح دوراً اعتماداً على JWT قديم.
- أضيفت تغطية OpenAPI للمسارات الجديدة، واختبارات middleware والصلاحيات، وsuite PostgreSQL محلية للتحقق من المعاملات والـrollback والسباقات وRLS والـgrants.
- أصلح اختبار التكامل ترتيب إدراج refresh child قبل ربط القديم ضمن transaction. كذلك عُزلت أخطاء DB بحيث لا تُكتب نصوص SQL أو معاملات حساسة في HTTP logs.
- أضيف `setup:local-env` لإنشاء إعداد local آمن يرفض أي قاعدة غير loopback واسم `alx_api_test`، و`dev:local` لتشغيل الخدمة من هذا الملف دون قراءة `.env` البعيد. دليل التشغيل: [`local-auth-development.md`](local-auth-development.md).

## نتيجة التشغيل HTTP الفعلية

| الفحص                                                       |                             النتيجة |
| ----------------------------------------------------------- | ----------------------------------: |
| `/api/v1/health/live` و`/api/v1/health/ready`               |                                 200 |
| تقديم PIN ككلمة مرور                                        |                         401 — مرفوض |
| أول login بكلمة legacy اصطناعية                             | 200؛ أنشأ Argon2id credential خاصاً |
| `/api/v1/auth/me` و`/permissions`                           |                                 200 |
| refresh rotation ثم logout                                  |                          200 ثم 200 |
| access token بعد logout                                     |                 401 — الجلسة أُبطلت |
| password change/reset مع legacy auth مفعّل وبدون قناة تسليم |             503 — بوابة آمنة مقصودة |

فحص metadata بعد HTTP login وجد صف Argon2id واحداً **للمستخدم الاصطناعي فقط**؛ لم تُقرأ قيمة hash. المحاولة تمت على مستمع `127.0.0.1`، ولم تُطبع أي access/refresh token.

## التحقق الآلي

- `npm run check`: نجاح.
- `npm run lint`: نجاح.
- `npm run format:check`: نجاح؛ ويتحقق الآن من المصادر والاختبارات والـOpenAPI والدليل المحلي المعدل.
- `npm test -- --runInBand`: **59 اختباراً ناجحاً، 11 suite**.
- `TEST_DATABASE_URL='postgresql://ubuntu@localhost/alx_api_test?host=/var/run/postgresql' npm run test:db`: نجاح migrations `0002`–`0006` وRLS/permissions/Auth/transactions/RBAC والـfixtures الاصطناعية.
- `npm run build`: نجاح.
- ما زال فحص GitHub Actions للتغييرات الحالية رهناً برفعها؛ آخر CI ناجح سابق هو run `37178380702` على النسخة السابقة `0d7cee8`.

## ما جرى وما لم يجرِ في قاعدة البيانات

**محلياً:** migrations `0005` و`0006` وتدفقات Auth/RBAC اختُبرت في `alx_api_test`. تركت suite fixture اصطناعياً واحداً لتجربة الخادم المحلي؛ بعد نجاح HTTP migration صار له credential واحد بـArgon2id.

**خارج المحلي:** لم ينفذ هذا العمل أي SQL أو تغيير بيانات على Supabase. Migration `0004` كانت قد طُبقت في مرحلة سابقة بموافقة المستخدم؛ وفي الحالة المسجلة لها كان عدد صفوف الاعتمادات الحقيقية صفراً. لم تُطبّق `0005/0006` على Supabase ولم تُنقل كلمة مرور حقيقية أو PIN في هذه الجولة. لم تتغير كلمة مرور `postgres`/المالك أو كلمة مرور التطوير الثابتة لدور `alx_api_runtime`.

تبقى كلمة المرور القديمة في مصدر legacy خلال فترة توافق العملاء. لا يُستخدم PIN ككلمة مرور، ولا يوجد bulk migration. تتحقق دالة DB من كلمة المرور القديمة وتعيد boolean فقط، بينما يحفظ API الهاش الجديد. إزالة قيم المصدر تتطلب cutover وخطة استعادة ومراجعة مستقلة.

## مطابقة مراحل الخطة

| المرحلة                   | الحالة                            | المتبقي                                                                                                                          |
| ------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0 — المتطلبات والقرارات   | جزئية                             | اعتماد مصفوفة RBAC، قناة reset، إعداد cutover وتخزين التوكن في العملاء، CORS الرسمي ومدة الاحتفاظ بالسجلات.                      |
| 1 — Scaffold وTooling     | مكتملة كأساس                      | —                                                                                                                                |
| 2 — PostgreSQL/Repository | مكتملة محلياً للاختبارات الحالية  | تشغيل الهجرات في بيئة اختبار مشتركة بعد اعتماد migration منفصل، وتأكيد runbook/backup؛ لا production apply.                      |
| 3 — Auth Core             | مكتمل محلياً، غير جاهز للقطع      | ربط مزود reset موثوق، توحيد legacy clients، ثم تفعيل flags بعد cutover.                                                          |
| 4 — RBAC                  | أساس محلي جاهز، دون matrix نهائية | حسم اختلاف permissions الافتراضية بين bootstrap شاشة Roles وواجهة إدارة المستخدمين، ثم seed واختبار كل role قبل ربط وحدات العمل. |
| 5 — OpenAPI والعقود       | موثق ومتحقق YAML                  | إضافة contract-drift test آلي بين Zod والـroutes وOpenAPI.                                                                       |
| 6 — العملاء               | غير مبدوء في API                  | يحتاج قاموس بيانات وواجهات العميل.                                                                                               |
| 7 — الطلبات والشحنات      | غير مبدوء في API                  | لا يبدأ قبل RBAC وقاموس الحالات والمعاملات.                                                                                      |
| 8 — المالية               | غير مبدوء في API                  | يحتاج mapping ومراجعة قواعد مالية خاصة.                                                                                          |
| 9 — الإشعارات/التكاملات   | غير مبدوء                         | اختيار adapters وoutbox/retry ومزود reset.                                                                                       |
| 10 — نقل العملاء          | لم يبدأ                           | خطة cutover تدريجية وإزالة direct client access.                                                                                 |
| 11 — Hardening/الإطلاق    | غير جاهز                          | TLS `verify-full` وCA، مفتاح JWT، security/load tests، backup/restore، مراقبة ونشر.                                              |

## الخطوات التالية الموصى بها

1. راجع/وحّد الـpermission catalog الافتراضي في الواجهة، ثم اعتمد role-permission matrix قبل seed.
2. اختر قناة موثوقة لتسليم reset (email أو بديل) وادمج adapter؛ لا تكشف reset tokens للمستخدم أو logs.
3. جهّز DB اختبار غير إنتاجية ومراجعة migrations `0005/0006` قبل أي تطبيق مشترك.
4. اختبر cutover لعميل Swiftship، ثم تُفعّل password-change/reset والانتقال التدريجي للمستخدمين الحقيقيين وفق سياسة Argon2id، من دون PIN أو bulk extraction.
5. بعدها تابع وحدات الخطة بالترتيب، لا تتجاوز RBAC والعقود قبل Customers/Orders/Finance.

## استئناف 2026-10-05 بعد فقدان الالتزام السابق

- تم التحقق من أن فرع `main` عاد إلى `ca27735663cdef281c198b6e874a4dc712c0fb41`، وأن الالتزام `8d1fd503` غير موجود في الفرع.
- استُعيدت إلى المستودع Migration `0007_portal_rbac_foundation.sql` وSeed `portal_rbac_seed_2026-10-04.sql` اللذان كانا مطبقين على القاعدة الحية لكن غير محفوظين في Git.
- تحقق حي من Supabase: `portal_roles=4`، `portal_permissions=21`، `portal_role_permissions=26`، `portal_user_roles=5`؛ التوزيع `customer=3` و`client=2`. كما أن جدول `expenses` غير موجود فعلاً.
- تحقق حي من مستخدمي النظام: 3 Admin root، و3 Courier، و2 Employee، و1 Customer؛ وتعيينات النظام الحالية: admin=3، courier=3، employee=2.
- أضيفت Migration `0008_customers_read_boundary.sql` لإنشاء View خاصة غير حساسة ومنح القراءة فقط إلى `alx_api_runtime`، وطُبقت بنجاح على قاعدة SwiftShip الحية.
- أضيفت Customers read API: `GET /api/v1/customers` و`GET /api/v1/customers/:customerId` خلف Auth وصلاحية `view_customers`، مع pagination/search/filter وparameterized SQL واختبارات HTTP.
- لا توجد قناة reset مفعّلة؛ يظل تغيير كلمة المرور والاستعادة معطلاً حتى قرار المستخدم، وفق التوجيه المعتمد.

### نتيجة التحقق الحالية

- `npm run check`: نجاح.
- `npm run lint`: نجاح.
- `npm run format:check`: نجاح.
- `npm test -- --runInBand`: **62 اختباراً ناجحاً، 12 suite**.

## بدء المرحلة 7 — Orders وShipments/Tracking وProducts

تمت مراجعة توافق الطبقة الجديدة مع النظام الحالي قبل التنفيذ. النظام القديم يستخدم `orders.order_status_id` و`orders.order_status1`، ويعتمد على `orders_history` لتسجيل انتقالات الحالة؛ كما يستخدم `shipments` و`order_items` وحقول الشحن snake_case بعد إعادة تسمية المفاتيح. لم يوجد جدول `shipment_events` في مخطط قاعدة SwiftShip الحية، لذلك يعتمد Tracking API في هذه الدفعة على الأحداث المرتبطة بالشحنة داخل `orders_history` بدلاً من اختراع جدول غير موجود.

أضيفت مسارات القراءة التالية، وكلها خلف Auth وRBAC:

| النطاق    | المسارات                                                                         | الصلاحية        |
| --------- | -------------------------------------------------------------------------------- | --------------- |
| Orders    | `GET /api/v1/orders`, `GET /api/v1/orders/:id`, `GET /api/v1/orders/:id/history` | `view_orders`   |
| Shipments | `GET /api/v1/shipments`, `GET /api/v1/shipments/:id`                             | `track_order`   |
| Tracking  | `GET /api/v1/shipments/:id/tracking`                                             | `track_order`   |
| Products  | `GET /api/v1/products`, `GET /api/v1/products/:id`                               | `view_products` |

القراءة تستخدم أعمدة صريحة من المخطط الحالي، ولا تعتمد على `SELECT *` في Orders أو Shipments أو Products الأساسية. تفاصيل Order تجمع `order_items` و`shipments`، وTracking يعيد `orders_history` المرتبط بـ`shipment_id`. أضيفت اختبارات HTTP للصلاحيات والاستجابات والمسارات، وأضيفت مسارات OpenAPI.

اكتملت عمليات الكتابة الأساسية للمرحلة 7 في هذه الدفعة. المتبقي هو مراجعة migration 0009 وتطبيقها على بيئة مشتركة بعد اعتماد منفصل، ثم استكمال courier assignment المتخصص وcontract-drift tests.

## استكمال المرحلة 7 — عمليات الكتابة — 2026-10-04 23:35:06 +0000

- أضيف `POST /api/v1/orders` مع `Idempotency-Key` ومخزن durable مقترح داخل `alx_api_private.operation_idempotency`، ويكتب Order/Items/Shipment/History داخل Transaction واحدة.
- أضيف `PATCH /api/v1/orders/:id/status` مع `SELECT ... FOR UPDATE` ورفض regression، وتسجيل الحالة السابقة والجديدة في `orders_history`.
- أضيف `PATCH /api/v1/shipments/:id` و`POST/PATCH /api/v1/products` خلف الصلاحيات المناسبة، مع Zod validation وOpenAPI.
- التحقق: `npm run check`, `npm run lint`, `npm test -- --runInBand` (69 tests / 13 suites), `npm run build` ناجحة.
- migration 0009 مصدرية فقط ولم تُطبق على قاعدة الإنتاج؛ تحتاج مراجعة واعتماداً منفصلاً قبل التطبيق.
