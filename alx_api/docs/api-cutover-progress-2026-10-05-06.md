# تقرير حالة استكمال خطة SwiftShip API

**التاريخ:** 2026-10-05 21:25 (+03:00)  
**النموذج المنفذ:** Manus  
**المستودع:** `Aporaad/swiftship`  
**النطاق:** `alx_api` وربط واجهة SwiftShip تدريجيًا

## خلاصة الحالة

تم استكمال الدفعة الأولى من المرحلة 10 الخاصة بنقل كتابات الموظفين والمندوبين. أصبح لدى الواجهة بوابة كتابة مستقلة خلف العلم `VITE_STAFF_API_WRITES`، بينما بقيت القيمة الافتراضية `false` حتى لا يحدث cutover إنتاجي غير مقصود.

## ما تم تنفيذه

1. تحديث عقود ومخططات عمليات إنشاء الموظفين والمندوبين لقبول معرّفات صريحة انتقالية.
2. ضمان تسجيل المنفذ `actorId` في مسارات API، مع الحفاظ على المعرّف المرسل من الواجهة.
3. إضافة `PATCH` و`DELETE` إلى `ApiClient` مع التوكن، المهلة، `x-request-id`، وعقد الأخطاء الموحد.
4. إضافة عمليات إنشاء وتعديل وحذف الموظفين والمندوبين إلى `staffApiDataGateway`.
5. ربط إنشاء وتعديل الموظفين والمندوبين وتفعيل/تعطيل المندوب بالـAPI عند تفعيل العلم، مع Legacy fallback.
6. إضافة توثيق المهمة والتطوير وقاعدة البيانات وأوامر المستخدم إلى ملفات المشروع دون حذف السجلات السابقة.

## ما لم يُنفذ بعد

- حذف الموظف أو المندوب لم يُنقل بعد؛ يلزم endpoint ذري ينظف الحساب المالي وسجل التدقيق قبل تفعيله.
- إنشاء وتعديل المستخدم المرتبط بالموظف أو المندوب ما زال في المسار القديم؛ يلزم استكمال Users API.
- لم يُنفذ smoke test حي لأن ذلك يتطلب حساب API موثق وبيئة PostgreSQL اختبارية حسب runbook.
- لم يبدأ نقل Customers ثم Orders/Shipments في هذه الدفعة.
- لم يُنفذ أي SQL أو migration أو DML على قاعدة البيانات الحية.

## التحقق

- `npm run check` داخل `alx_api`: ناجح.
- `npm run build` داخل `alx_api`: ناجح.
- `eslint` على ملفات operations المعدلة: ناجح.
- `git diff --check`: ناجح.
- اختبار Jest الكامل تعرّض لـ`Segmentation fault` في `tests/security.test.ts` بعد محاولتين؛ لا توجد دلالة على فشل assertion من التغييرات الحالية.
- فحص TypeScript للنظام الرئيسي لم يكتمل بسبب اعتماديات الجذر غير المثبتة وإعداد TypeScript قديم؛ لم تتم إضافة اعتماديات جديدة أو تعديل إعدادات خارج نطاق المرحلة.

## قرار التشغيل

لا يتم تفعيل `VITE_STAFF_API_WRITES` في الإنتاج قبل اكتمال حذف آمن، Users API، smoke test حي، ومراجعة صلاحيات `add/edit/delete_couriers` و`add/edit/delete_employees`.

## [2026-10-05T21:36:10+03:00] — الدفعة الثانية: قراءة العملاء

بدأت المرحلة التالية من Client Cutover بنقل قراءة العملاء فقط عبر `GET /api/v1/customers` خلف العلم `VITE_CUSTOMERS_API_READS=false`.

### المنفذ

- إنشاء `customersApiDataGateway` مستقل عن واجهة المستخدم.
- استخدام `ApiClient` المشترك والتوكن الموجود في `sessionStorage`.
- ربط `CustomersPage` بالبوابة عند تفعيل العلم.
- إبقاء قراءة الحسابات المالية وطلبات العميل في Legacy مؤقتًا حتى اكتمال Finance/Orders API.
- إبقاء fallback القديم عند تعطيل العلم.

### التحقق والقيود

- `alx_api`: `npm run check` ناجح.
- `alx_api`: `npm run build` ناجح.
- lint لوحدة Customers ناجح.
- اختبار `tests/customers.test.ts` أعاد `Segmentation fault` من Jest.
- اختبار ApiClient لم يُنفذ لأن `vitest` غير مثبت في اعتماديات الجذر؛ أُلغي طلب تثبيت تفاعلي ولم تُضف اعتماديات.
- لم يتم تنفيذ SQL أو migration أو تعديل بيانات حية.

### الخطوة التالية المعتمدة

توسيع Customer API بعقود كتابة ذرية تشمل إنشاء/تعديل العميل وربطه بالحساب المالي وسجل التدقيق، ثم إضافة اختبارات صلاحيات وsmoke test قبل تفعيل أي علم كتابة.

## [2026-10-05T21:44:00+03:00] — Customer API للكتابة

أُضيفت عمليات إنشاء وتعديل وأرشفة العملاء بصلاحيات RBAC مستقلة (`add_customers`, `edit_customers`, `delete_customers`). كل عملية تستخدم معاملة PostgreSQL واحدة تشمل تحديث الكيان وسجل `activity_logs`، مع rollback عند الفشل. الأرشفة ناعمة حتى لا تُمسح الحسابات أو الحركات المالية.

التحقق البرمجي (`npm run check`, `npm run build`, وlint لوحدة Customers) ناجح. اختبار Jest يعاني من `Segmentation fault` في بيئة الجلسة، ولم يتم تنفيذ SQL حي.

بعد ذلك تمت مراجعة المرحلة التالية: Orders/Shipments API موجودة بالفعل مع إنشاء طلب ذري، سجل تاريخ، ومفتاح `Idempotency-Key`، ولذلك ستكون الخطوة التالية نقل عميل الطلبات إلى هذه المسارات بعد مواءمة payload والحقول المالية، دون تفعيل العلم قبل smoke test.

## [2026-10-05T22:03:10+03:00] — نقل Orders/Shipments/Products

تم إنشاء `ordersApiDataGateway` خلف `VITE_ORDERS_API_READS` و`VITE_ORDERS_API_WRITES`. عند تفعيل الكتابة، يرسل handler الطلب aggregate واحدًا إلى Orders API مع `Idempotency-Key`، ويضم جميع عناصر الطلب والشحنات في معاملة واحدة. جرى حذف الأعمدة الرئيسية المكررة من `orderData` قبل الإرسال، بينما تبقى الحقول الحسابية غير الرئيسية داخل JSONB.

تمت إضافة `POST /api/v1/shipments` للإنشاء المنفرد، وتوجيه إنشاء/تعديل الشحنات والمنتجات إلى API عند تفعيل العلم. أعلام البيئة ما زالت `false` افتراضيًا. فحوصات `npm run check` و`npm run build` وlint لملفات Operations API ناجحة. لم يتم تنفيذ SQL حي، ولم يُنفذ smoke test متصل بقاعدة اختبار بعد.

## [2026-10-05T22:08:45+03:00] — Users API Client Cutover
- أُضيفت بوابة `src/features/users/services/usersApiDataGateway.ts` مع أعلام `VITE_USERS_API_READS` و`VITE_USERS_API_WRITES`.
- عند تفعيل القراءة: تُجلب قائمة مستخدمي لوحة التحكم من `GET /api/v1/users` مع تحديث دوري، مع إبقاء roles وorder statistics على مصادرها الحالية.
- عند تفعيل الكتابة: يُستخدم `PATCH /api/v1/users/:id` لتعديل الحقول غير الحساسة، و`DELETE /api/v1/users/:id` للحذف الناعم؛ إعادة التفعيل تستخدم PATCH.
- بقي إنشاء حساب Auth/provisioning وتعديل PIN على Legacy لحين وجود عقد API آمن لا يمرر كلمات المرور أو الأسرار الحساسة عبر هذا المسار.
- التحقق: `npm run check` و`npm run build` في `alx_api` نجحا. اختبارات Jest (`tests/users.test.ts` و`tests/security.test.ts`، ثم Users منفردًا) انتهت بـ `Segmentation fault` من بيئة Jest قبل إخراج نتائج الاختبارات؛ لم تُخف هذه النتيجة.
- لا يوجد تنفيذ SQL مباشر أو تغيير حي في قاعدة البيانات.

## [2026-10-05T22:21:20+03:00] — Roles API + Secure User Provisioning
- أُضيفت وحدة Roles API مع عقود منفصلة وZod validation وrepository PostgreSQL ومعاملات ذرية لـ role_permissions.
- المسارات المحمية: `GET /roles`, `GET /roles/permissions`, `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id` باستخدام `view_roles`, `add_roles`, `edit_roles`, `delete_roles`.
- رُبطت RolesPage ببوابة HTTP خلف `VITE_ROLES_API_READS` و`VITE_ROLES_API_WRITES` مع fallback Legacy قابل للتراجع.
- أُضيف `POST /api/v1/users/provision`: يقبل بيانات الملف فقط، ويرفض password/PIN بسبب strict schema. ينشئ الحساب ثم يرسل reset invitation أحادي الاستخدام عبر `PasswordResetDelivery`; لا يعيد الرمز أو كلمة المرور إلى الواجهة. عند فشل التسليم يُعطّل الحساب المنشأ.
- تطبيق provisioning يتطلب تشغيل `AUTH_PASSWORD_CHANGES_ENABLED=true` مع `LEGACY_PASSWORD_AUTH_ENABLED=false` وتوصيل PasswordResetDelivery فعلي؛ بدون ذلك يرفض API العملية بأمان ولا يضع credential مؤقتًا.
- طُبقت migration `roles_api_runtime_write_0011` لمنح أقل صلاحيات Runtime اللازمة للكتابة مع RLS policies.
- التحقق: TypeScript check وbuild وESLint للوحدات المعدلة نجحت. اختبار Jest `tests/roles.test.ts` اصطدم بـ `Segmentation fault` من بيئة Jest قبل إظهار النتائج، كما حدث في جولات سابقة.

## [2026-10-05T22:22:05+03:00] — Provisioning Error Hardening
- أصبحت أخطاء `AuthServiceError` في provisioning تُعاد كـ HTTP status آمن (مثل 503) بدل تحويلها إلى 500، مع عدم إرجاع password أو PIN أو reset token.
