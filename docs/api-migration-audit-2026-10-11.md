# خلاصة جرد API Migration — 2026-10-11

## النطاق
تم جرد نطاقات `CouriersPage`, `CustomersPage`, `EmployeesPage`, `SourcesPage`, `UsersPage`, `UserManagementPage`, `SettingsPage`, الخدمات المالية، و`portalUserService/cust_details` قبل تنفيذ التحويلات.

## النتائج

| النطاق | الحالة | الخلاصة التنفيذية |
|---|---|---|
| Sources | قابل للتحويل تدريجيًا | توجد reporting وCRUD routes في `alx_api`; تم تحويل الصفحة في هذه الدفعة إلى `sourcesApiDataGateway` مع إبقاء ربط الحساب المالي عبر `financialAccountService` دون imports مباشرة من legacy. |
| Couriers | جزئي | توجد CRUD/reporting routes، لكن تفاصيل الحساب، orders، account_trans، provisioning وحقول profile تحتاج عقودًا إضافية؛ لا يجوز حذف fallback الكامل قبل تغطيتها. |
| Customers | جزئي | توجد routes CRUD في `alx_api`، لكن DTO الأساسي لا يغطي دفتر العميل، الحسابات، GPS، وside effects المالية. يلزم تحويل core CRUD ثم عقود statement/account. |
| Employees | جزئي | توجد CRUD routes، لكن حقول profile، users provisioning، disabled، الحساب المالي، وstatement غير مكتملة في العقد الحالي. |
| Users | جزئي قابل للتدرج | توجد routes list/create/update/delete/password/roles في `alx_api`؛ يلزم فصل الحقول الحساسة وعمليات sessions/activity/financial purge قبل إزالة imports من `UserManagementPage`. تم توحيد flags لتقبل `VITE_USE_HTTP_API`. |
| Settings/Currencies | backend موجود في `alx_api` | توجد routes settings وcurrencies وhistory/CRUD، لكن `SettingsPage` ما زالت تحتوي backup/legacy operations؛ يلزم إنشاء gateway للـbackup قبل إزالة imports. |
| Finance | جزئي | توجد عقود finance في `alx_api`، لكن `financeAccountingMainEntryActions` ما زال ينفذ تعديل/حذف/FIFO مباشرة؛ لا يجوز تحويله إلى void أو حذف API غير ذري. |
| Portal/cust_details | جزئي | توجد portal auth/owned services ومigrations لـ`cust_details`، لكن لا يوجد gateway مركب مكافئ لـ`portalUserService` لإدارة portal users/details بشكل ذري. |

## معالجة الاختبارات
- تبين أن المشروع يستخدم Vitest وليس Jest.
- تم تثبيت Vitest على `pool=forks` مع `singleFork=true` لتقليل احتمال Segmentation fault الناتج عن تعدد العمال.
- بعض اختبارات wiring القديمة كانت تتحقق من نصوص legacy بعد نقل المكونات إلى بوابات API؛ سيتم تحديثها إلى عقود API بدل إخفاء الفشل.

## تغييرات بدأت بعد الجرد
- تحويل `SourcesPage` إلى API-only في القراءة وCRUD مع الحفاظ على ربط الحساب المالي.
- إضافة تطبيع DTO للمصادر وشركات الشحن.
- تصحيح pagination من `limit/offset` إلى `page/pageSize` في بوابات الكيانات.
- توسيع `GatewayQuery` لدعم نمط pagination الخاص بـ`alx_api`.
- تفعيل `VITE_USE_HTTP_API` لبوابة المستخدمين.

## القيود
لم يتم تنفيذ أي SQL أو تعديل قاعدة البيانات في هذه المرحلة. أي تغيير schema أو RLS سيحتاج مرحلة مستقلة موثقة ومراجعة عقودها.


## تحديث الجلسة — 2026-10-11 23:27 +03:00
- أضيف endpoint `POST /api/v1/orders/batch-delete` محمي بـ`delete_orders`، وتم ربطه بدالة الحذف الحالية. جرى فحص توقيع الإنتاج للقراءة فقط وتصحيح الاستدعاء إلى `delete_orders_with_dependents(text[])` قبل النشر.
- لم تُجر تغييرات قاعدة بيانات. فحص Supabase يعرض حالة المشروع `ACTIVE_HEALTHY`، وآخر migration المسجلة `20261006232928 portal_payment_requests_0017`.
- تنبيه أمني مرتفع قائم في قاعدة الإنتاج: 49 جدولًا عامًا مع RLS معطل، منها 27 لديها سياسات غير مفعلة، و44 دالة `SECURITY DEFINER` متاحة لـ`anon`، ومن بينها وظيفة حذف الطلبات. لم نغير RLS/GRANT لأن ذلك خارج تغيير API الحالي وقد يؤثر على النظام الحي؛ يلزم بند أمني مستقل.
- تحقق alx_api ناجح: TypeScript/build و30 suite/165 test. تحقق SwiftShip: TypeScript/build والاختبارات الموجهة ناجحة؛ بقي فشل كامل واحد في `defaultAccountsVoucherWiring.test.ts` لأن `useAutoVoucherRules` يعيد بيانات فارغة. لا ينبغي تحديث assertion أو إخفاء الفشل بدل استكمال API الخاص بقواعد القيود التلقائية.
- لم يتم بعد توثيق نتيجة نشر Render في هذا التقرير؛ سيُتحقق منها بعد رفع التغييرات.
