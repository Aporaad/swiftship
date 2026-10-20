# P2 — تقرير تدقيق قاعدة البيانات الحية قراءةً فقط

- **التاريخ والوقت:** 2026-10-20 04:11 (+03:00)
- **النموذج المنفذ:** Manus
- **المشروع الحي:** Supabase `ejrojwbbflzchasvgexr`
- **حالة المشروع وقت الفحص:** `ACTIVE_HEALTHY`
- **محرك قاعدة البيانات:** PostgreSQL 17.6.1.155
- **الخطة المرجعية:** `خطة_تنفيذ_المسابقات_والجوائز_والكوبونات.md`، P2
- **طبيعة الفحص:** قراءة فقط؛ لم ينفذ DDL أو DML أو migration أو تغيير صلاحيات.

## 1. ملخص النتيجة

تمت مطابقة الوضع العام للترحيلات المحلية والبيئة الحية، وتأكد وجود العلاقات اللازمة مبدئيًا للهوية والعميل والطلب والعملات وRBAC وoutbox. لا توجد جداول للمسابقات أو الجوائز أو كوبونات العملاء في القاعدة الحية حتى وقت الفحص.

**حالة P2:** مكتملة من ناحية جمع الأدلة والتقرير، لكنها تحمل مانعًا أمنيًا حرجًا يجب معالجته في P4 قبل أي DDL للمميزات أو إتاحة واجهات عميل مباشرة على هذه الجداول: جداول `public` الحساسة التي فُحصت (`portal_users`, `customers`, `orders`, `notifications`) ظهر لها `RLS=false`، مع منح مباشرة واسعة للأدوار `anon` و`authenticated`. لا يجوز اعتبار هذا إعدادًا آمنًا لميزة customer-scoped دون مراجعة/إصلاح مستقل معتمد.

## 2. مقارنة الترحيلات

### المحلي

- آخر ملف محلي هو `0047_portal_session_device_facts_and_delete.sql`.
- توجد سلسلة محلية من ترحيلات API/RBAC والبوابة والتسطيح حتى 0047.

### الحي

- سجل Supabase يحتوي على ترحيلات مؤرخة زمنيًا، ويصل إلى `20261018202521_portal_session_device_facts_and_delete_0047`.
- توجد ترحيلات حية إضافية/اختبارية مسجلة، منها `test_migration_quick`, `test_plpgsql_func`, `test_grant_delete`, `test_revoke`, `test_dynamic_delete`, `cleanup_test_funcs`، إضافة إلى ترحيلات تسوية API/RBAC و`notifications_outbox` و`settings_and_currency_api`.
- النتيجة: وجود migration محلي باسم 0047 لا يساوي تطابقًا حرفيًا مع سجل البيئة الحية؛ السجل الحي هو مصدر الحقيقة للتاريخ المطبق. يجب عدم إعادة تطبيق أي رقم محلي، ويجب أن تعتمد P4 على diff بالاسم/التوقيت/الأثر لا على الرقم فقط.

## 3. الهوية والربط

تم إثبات العلاقات الحية الآتية:

- `public.portal_users.portal_user_id` هو المفتاح الأساسي.
- `public.portal_users.linked_customer_id` مفتاح خارجي إلى `public.customers.customer_id`.
- `public.customers.customer_id` هو المفتاح الأساسي.
- `public.orders.customer_id` مفتاح خارجي إلى `public.customers.customer_id`.
- `portal_users` تحتوي `portal_role`, `disabled`, و`approval_status`.
- التجميع الحي لحسابات البوابة أظهر أدوارًا `customer` و`client`، وحالات `approved` و`pending_approval`؛ لذلك لا يكفي فحص الدور وحده، ويجب أن يفرض API الدور المقبول والحساب المعتمد وغير المعطل والربط غير الفارغ.

**قاعدة التكامل المعتمدة:** يستنتج API `portalUserId` و`customerId` من principal والجداول/الخدمة، ولا يقبل أيًا منهما من body أو query كحقيقة ملكية.

## 4. الطلبات وحالة الاستهلاك

- `public.orders.order_id` هو المفتاح الأساسي.
- `orders.customer_id` و`orders.order_status_id` موجودان، لكن `order_status_id` قابل لـ NULL.
- `orders.order_status1` ما زال غير قابل لـ NULL ويستخدمه مسار إنشاء طلب البوابة الحالي.
- جدول `public.order_status` الحي يتضمن على الأقل:
  - `1 / Pending / معلق`
  - `3 / Order Registered / تم تسجيل الطلب`
  - `10 / Cancelled / ملغي`
  - `11 / Returned / مرتجع`
- فحص `portal-owned.repository.ts` أكد أن إنشاء الطلب الحالي يكتب `order_status1 = 'معلق'` ولا يكتب `order_status_id` في INSERT.
- حقول `orders.coupon_enabled`, `orders.coupon_rate`, `orders.coupon_value` موجودة، وتبقى كوبون شراء الشركة الداخلي وفق قرار P1؛ لا تستخدم لتخزين نظام كوبونات العملاء.

**أثر P3/P9:** عقد الميزة الجديدة يرسل `couponCode` فقط. يحجز الاستحقاق عند إنشاء الطلب المعلّق، ثم يحوله إلى `redeemed` عند انتقال الطلب إلى حالة القبول التشغيلية التي يثبتها service transition؛ لا يُخمن ذلك من `order_status1` النصي. الإلغاء/المرتجع يعالجان بعكس idempotent وفق سياسة P1 دون إعادة كتابة التاريخ.

## 5. العملات والتسعير

جدول `public.currency` حي ومرجعه:

| cur_id | code | الحالة | الافتراضي | الرمز |
| --- | --- | --- | --- | --- |
| 1 | YER | فعال | نعم | ر.ي |
| 2 | SAR | فعال | لا | ر.س |
| 3 | USD | فعال | لا | $ |
| 4 | EUR | غير فعال | لا | # |
| 5 | EGP | فعال | لا | ج,م |

- `orders.order_currency_code` موجود، كما توجد أعمدة صرف تاريخية/تشغيلية أخرى.
- لا توجد دقة عملة مستقلة مثبتة في الاستعلام الحالي؛ لذلك يستخدم نظام الميزة خدمة تسعير الطلب المركزية ولا ينشئ rounding policy موازيًا.
- كوبون المبلغ الثابت يقبل فقط عند تطابق كود العملة، ولا يطبق تحويل عملات للكوبون في v1.

## 6. RBAC والصلاحيات

- توجد جداول `alx_api_private.roles`, `permissions`, `role_permissions`, `user_roles` مع RLS مفعّل وإجباري.
- الأدوار النظامية الحية التي ظهرت: `admin`, `accountant`, `employee`, `courier`.
- الصلاحيات الحالية تستخدم نمط `resource/action` وأكوادًا مثل `view_orders`, `manage_website`, `view_notifications`، ولا توجد أكواد `features.*` الجديدة حتى الآن.
- `alx_api_runtime` لديه وصول إلى جداول RBAC وفق سياسات RLS الحالية، لكن إنشاء صلاحيات المميزات وإسنادها للأدوار مؤجل إلى migration مراجعة في P4، وليس ضمن P2 القراءة فقط.

## 7. الإشعارات والتدقيق

- توجد `public.notifications` للإشعارات الداخلية المسطحة.
- توجد `public.notification_recipient` لربط المستلمين.
- توجد `alx_api_private.notification_outbox` بأعمدة `idempotency_key`, `channel`, `recipient`, `status`, `attempt_count`, `max_attempts`, `sent_at` وغيرها.
- `notification_outbox` عليها RLS مفعّل ومجبَر وسياسة runtime، مع unique على `idempotency_key`.
- يوجد `public.activity_logs`، لكنه ليس بديلًا تلقائيًا عن سجل domain append-only المطلوب للأحداث الحساسة للمميزات؛ يجب تقييم الامتداد أو جدول سجل متخصص في P4.

## 8. ملاحظات RLS والمنح — مانع أمني

نتيجة الفحص الحي أظهرت:

- `alx_api_private` لجداول auth/RBAC/outbox المهمة يستخدم RLS مفعّلًا ومجبَرًا بسياسات runtime.
- `public.currency` يستخدم RLS مفعّلًا ومجبَرًا.
- `public.portal_users`, `public.customers`, `public.orders`, `public.notifications` ظهرت بـ `RLS=false`.
- منح `anon` و`authenticated` على هذه الجداول تضمنت SELECT وINSERT وUPDATE وDELETE وغيرها حسب الجدول، في حين أن سياسة `service_role_access` ظاهرة في وصف بعض الجداول ولا تعوض وحدها عن إلغاء المنح المباشرة.

**الإجراء الإلزامي قبل P4/DDL:** فتح مراجعة أمنية منفصلة لتحديد هل هذه المنح مقصودة بسبب طبقة API/إعداد PostgREST أم أنها اتساع غير مقصود، ثم تقليلها/تفعيل RLS بسياسة متوافقة دون كسر النظام القائم. لا ينفذ هذا التقرير أي إصلاح تلقائيًا.

## 9. فجوات ومخاطر التنفيذ

1. لا توجد كيانات `featuresManagement` في القاعدة الحية؛ P4 يحتاج تصميمًا جديدًا كاملًا.
2. migration history الحي ليس نسخة حرفية من أسماء الملفات المحلية، ويضم migrations اختبارية يجب تصنيفها.
3. `order_status_id` nullable ومسار إنشاء البوابة يعتمد `order_status1`; يلزم transition service موحد قبل redeem.
4. `couponRate` الحالي يقبل من عقد العميل ويصل إلى quote/create؛ P3 يقفل استبداله بـ`couponCode` قبل P9.
5. عدم تفعيل RLS والمنح الواسعة على public الحساسة مانع إطلاق أمني.
6. لا يجوز الاعتماد على `activity_logs` وحده لإثبات قرارات السحب وتخصيص الجائزة واسترداد الكوبون.

## 10. بوابة قبول P2

- [x] تحديد مشروع وحالة القاعدة الحية قراءةً فقط.
- [x] قراءة سجل الترحيلات الحي ومقارنته بآخر migration محلي 0047.
- [x] إثبات علاقات `portal_users`/`customers`/`orders` والعملات وحالة الطلب وحقول الكوبون التاريخية.
- [x] فحص RBAC وoutbox وRLS والمنح.
- [x] توثيق الفجوات والمخاطر وخطة التعامل معها.
- [x] عدم تنفيذ DDL أو DML أو تعديل صلاحيات.

**قرار الانتقال:** يسمح التقرير بالانتقال إلى P3 التعاقدي والتصميمي، لكنه يمنع P4/DDL والإطلاق حتى معالجة مانع RLS/grants ضمن مراجعة أمنية معتمدة.
