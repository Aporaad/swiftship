# التحليل العميق الشامل لـ SwiftShip وخطة الوصول إلى API-only بنسبة 100%

**تاريخ التحليل:** 2026-10-08 23:53 (+03:00)  
**المنفّذ:** Manus AI  
**المستودع محل التنفيذ:** `Aporaad/swiftship`، HEAD: `a5a930f0f9ea1469fa432dfb04dbda55693a7590`  
**آخر API تمت مطابقته:** `Aporaad/alx_api`، HEAD: `f20c771e7e19148c6299a4c0c5a2f79a073f7f9e`، commit: `اصلاح دفعه من البقايا`

## النتيجة الحاسمة

لا يمكن إعلان SwiftShip في حالة **API-only** الآن. الجرد الفعلي وجد **109 ملفًا** في طبقة `legacy-compat`/بوابات Supabase، و**147 ملفًا** إجمالًا في `src` تحمل ارتباطًا مباشرًا أو غير مباشرًا بـ Supabase أو `createClient` أو اختبارات هذا المسار. الرقم السابق 13 كان حصرًا جزئيًا لملفات بعينها، وليس جردًا كاملًا لمسارات الإنتاج.

المشكلة ليست في وجود gateway واحد فقط. المشكلة أن التطبيق يملك مسارين متوازيين: بوابات HTTP جديدة، وطبقة `legacy-compat` تُستخدم في صفحات ومكونات وخدمات وhooks كثيرة. عدد من الميزات يقرر المسار عبر flags منفصلة، وبعضها يعود إلى Supabase مباشرة عند غياب flag أو فشل API. هذا يمنع إثبات المصدر الوحيد للبيانات.

## حالة أحدث alx_api

الـ API الأحدث يضم وحدات auth، customers، operations، finance، reporting، users، roles، notifications، portal، وjob-applications. وفي العمليات توجد مسارات orders وshipments وproducts وcouriers وemployees، مع idempotency لإنشاء الطلب. كما أضيف في آخر commit مزود إشعارات البريد وtelemetry لنقاط الصحة، ورفعت حدود pagination إلى 1000.

لكن `alx_api` لا يعرّف في `src/app.ts` أو وحداته الحالية مسارات مستقلة لإعدادات النظام، اسم النظام، الشعار، العملات، أسعار الصرف، order options، order statuses، item categories، assets، returned products، WhatsApp settings، browser data، أو backup/restore. توجد بعض مسارات reporting للقراءة فقط، لكنها لا تعوض CRUD أو عقود الإعدادات والعملات. لذلك فإن `SettingsContext` لا يملك حاليًا API حقيقيًا يمكنه الاعتماد عليه.

## سبب تعطل اسم النظام والشعار والعملات

`src/context/SettingsContext.tsx` يقرأ الإعدادات العامة عبر `onSnapshot(doc(db, 'settings', 'general'))`، ويحفظها عبر `setDoc`، ويجلب العملات من `currencyService`. كما ينشئ Supabase realtime channel على جدولي `currency` و`cur_price`. هذه العمليات لا تمر عبر `ApiClient` أو alx_api.

يوجد DTO للإعدادات و`SettingsGateway` و`currentSupabaseSettingsGateway`، لكن gateway الحالي مجرد `createTableGateway` فوق Supabase، ولا يوجد `HttpSettingsGateway`. كذلك يوجد DTO واسع للعملات، لكن لا توجد routes API للعملات أو أسعار الصرف. النتيجة أن اسم النظام والشعار والعملات تعتمد على legacy path أو قيم default، ولا يمكن أن تعمل بطريقة API-only.

الإصلاح الصحيح ليس إضافة fallback جديد. المطلوب إنشاء وحدة API للإعدادات والعملات، ثم جعل `SettingsContext` يستهلك HTTP gateway واحدًا، مع فصل الإعدادات العامة عن إعدادات المستخدم، وإضافة cache/query وإعادة تحميل صريحة بدل realtime Supabase.

## نتائج الجرد حسب الطبقات

### 1. طبقة البيانات والبوابات

- `src/data/legacy/legacy-compat.ts`: نقطة التجميع الأكبر لكل الوصول القديم؛ يجب أن تصبح محظورة على الإنتاج بعد القطع.
- `src/data/current-supabase/supabase.client.ts`: يعيد تصدير عميل legacy؛ يجب حذفه بعد نقل آخر consumer.
- `src/data/current-supabase/tableGateway.ts` و`supabase.mapper.ts` و`supabase.client.ts`: طبقة تنفيذ Supabase؛ تُحفظ مؤقتًا فقط لاختبارات migration ثم تزال من build الإنتاجي.
- `src/data/current-supabase/gateways/*.gateway.ts`: بوابات Supabase للمجالات؛ لكل ملف بديل HTTP typed، وليس مجرد إعادة توجيه إلى `legacy-compat`.
- `src/data/contracts/gatewayRegistry.ts`: يسجل domains كثيرة، لكن لا يفرض اختيار HTTP ولا يمنع current-Supabase registry؛ يجب تحويله إلى HTTP registry وحيد وقت البناء.
- `src/data/http/api-client.ts`: أساس جيد، لكنه يحتاج سياسة API-only صريحة: رفض base URL الافتراضي في production، عدم وجود fallback data، وتوحيد refresh/401/timeout/request tracing.

### 2. المجالات التي لديها API جزئي

- العملاء: `customersApiDataGateway.ts` موجود، لكن صفحات العملاء ما زالت تستورد legacy وتقرر المسار بالـ flags.
- الطلبات والشحنات والمنتجات: `ordersApiDataGateway.ts` موجود، لكن `createOrderHandler.ts` يحتوي تعليقًا يترك legacy fallback حتى قبول smoke test.
- المندوبون والموظفون: بوابات كتابة موجودة، لكن القراءة في بعض الصفحات تستخدم legacy مباشرة.
- الأدوار والمستخدمون: HTTP routes موجودة، لكن `RolesPage.tsx` و`UsersPage.tsx` و`UserManagementPage.tsx` ما زالت تحتوي listeners وعمليات legacy.
- المالية: `FinanceApiDataGateway.ts` و`FinanceApiWriteGateway.ts` موجودان، لكنهما يبدآن fallback إلى `FinanceAccountingDataGateway.ts` عند غياب flag أو خطأ API. كما أن الخدمات المالية القديمة تستورد legacy.
- التقارير ولوحة المعلومات: توجد API gateways، لكن dashboard/report pages ما زالت تستخدم legacy أو fallback؛ ويجب تحويلها إلى read models ثابتة من API.

### 3. المجالات غير المغطاة أو غير المكتملة في alx_api

يجب إضافة وحدات وعقود ومسارات API قبل إزالة legacy للآتي:

1. `settings/general` و`settings/user` و`settings/logistics` و`settings/whatsapp`.
2. `currencies` و`currency-rates` مع العملة الافتراضية والتاريخ والـ active state.
3. `order-statuses` و`order-options` و`item-categories`.
4. `sources` و`shipping-companies` CRUD، لا الاكتفاء بمسارات reporting.
5. `assets` و`returned-products` و`portal approvals` عند استخدام الشاشة لها.
6. `activity-logs` كتابة/قراءة متسقة، لا مجرد reporting read endpoint.
7. `sessions` management بما يطابق وظائف إدارة المستخدمين.
8. `accounting hierarchy` وbalances وaccount purge إذا بقيت هذه العمليات ضمن النظام.
9. `dashboard summary` وglobal search كعقود API مركبة.
10. `browser/live tracking` وbackup/restore إذا بقيت هذه الوظائف في SwiftShip.

## Feature Flags وfallbacks

يوجد flag عام `VITE_USE_HTTP_API`، إضافة إلى flags لكل مجال مثل `VITE_ORDERS_API_READS` و`VITE_ORDERS_API_WRITES` و`VITE_FINANCE_API_READS`، لكن السياسة غير موحدة. بعض gateways تربط flag المجال بالعلم العام، وبعضها لا يفعل ذلك، مثل users/roles/finance/reports/staff. وفي حالات أخرى، fallback يبدأ عند فشل API، وليس فقط عند وضع migration مقصود.

هذا يجعل `VITE_USE_HTTP_API=true` غير كافٍ لإثبات API-only. الخطة الصحيحة هي تحويل الإعداد إلى ثلاث حالات صريحة: `api-only`، `shadow`، `legacy-migration`، مع رفض تشغيل `legacy-migration` في build الإنتاجي. في `api-only`، فشل API يجب أن يظهر كخطأ للمستخدم مع request ID، ولا يجوز فتح listener Supabase بديل.

يجب إزالة default URL `http://127.0.0.1:3001` من مسار production، وجعل غياب `VITE_ALX_API_URL` خطأ build/startup. كما يجب إنشاء اختبار static يمنع `legacy-compat` داخل `src/components`, `src/features`, `src/hooks`, `src/context`, و`src/services` بعد إكمال القطع.

## الجرد الملفي الكامل

القائمة التالية ناتجة من قراءة الملفات الفعلية في HEAD الحالي. كل ملف له إجراء مقترح. الاختبارات لا تُنقل إلى production، بل تُعاد كتابتها لتختبر عقود HTTP أو mocks.

### طبقة البيانات القديمة/بوابات Supabase (109 ملفًا)

- `src/components/AccountingHierarchyManagement.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/AssetsPortfolio.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/AutoVoucherRulesManager.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/ChartOfAccounts.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/ConfirmDeletePinModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/ExpenseCategoriesManager.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/FinanceAccounting.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/FinanceReports.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/GlobalEntityLedgerModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/GlobalSearchModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/JobApplicationsModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/Layout.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/OrderStatusManagementTab.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/PendingPortalApprovalsModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/entities/CourierCreateModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/entities/CustomerCreateModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/entities/EmployeeCreateModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/entities/ShippingCompanyCreateModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/entities/SourceCreateModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/finance/EntryForm.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/finance/forms/CompoundEntryForm.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/finance/forms/GeneralEntryForm.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/finance/forms/VoucherEntryForm.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/financeAccounting/FinanceAccountingDataGateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/financeAccounting/financeAccountingMainEntryActions.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/orders/EditOrderModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/orders/OrderDetailsModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/orders/ProductPickerModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/orders/ProductsManagementTab.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/components/shipments/ShipmentFormModal.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/context/SettingsContext.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/contracts/legacy-boundary.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

- `src/data/current-supabase/gateways/accounting.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/auth.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/browser.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/couriers.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/customers.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/employees.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/finance-entries.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/index.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/notifications.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/orders.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/products.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/registry.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/reports.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/roles.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/shipments.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/site-settings.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/sources.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/gateways/users.gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/supabase.client.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/supabase.mapper.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

- `src/data/current-supabase/supabase.mapper.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/data/current-supabase/tableGateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/accounting/pages/AccountingPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/browser/pages/BrowserViewerPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/couriers/pages/CouriersPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/customers/pages/CustomersPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/employees/pages/EmployeesPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/financeEntries/pages/FinanceEntriesPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/notifications/pages/NotificationsPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/orders/hooks/useOrderData.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/orders/pages/subcomponents/OrdersPageShell.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/orders/pages/subcomponents/returned-products/gateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/orders/services/legacyOrdersApi.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/orders/services/orderEntityHandlers.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/roles/pages/RolesPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/settings/pages/SettingsPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/shipments/pages/TrackingPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/siteManagement/pages/WebsiteManagementPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/siteManagement/services/siteManagementGateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/sources/pages/SourcesPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/users/components/UserSessionsTab.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/users/pages/UserManagementPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/features/users/pages/UsersPage.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/hooks/useAccountBalances.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/hooks/useAutoVoucherRules.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/hooks/useExchangeRates.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/hooks/useExpenseCategories.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/hooks/useItemCategories.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/hooks/useOrderOptions.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/hooks/useOrderStatuses.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/hooks/useRole.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/pages/SalaryHistory.tsx` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/pages/dashboard/subcomponents/services/dashboardGateway.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/accountingHierarchyService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/activityLogService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/activityService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/autoEntryService.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

- `src/services/autoEntryService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/currencyService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/financialAccountAccounts.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/financialAccountAutomation.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/financialAccountPurge.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/financialAccountService.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

- `src/services/financialAccountService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/financialEntryService.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

- `src/services/financialEntryService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/financialEntrySettingsService.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

- `src/services/financialEntrySettingsService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/notificationService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/orderDeletionService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/orderHistoryService.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

- `src/services/orderHistoryService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/orderPaymentDataService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/portalUserService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/productService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/returnedProductService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

- `src/services/whatsappService.ts` — تنفيذ بديل HTTP gateway مطابق لعقد API ثم إزالة طبقة Supabase بعد نجاح اختبارات القطع.

### اختبارات/متفرقات (5 ملفًا)

- `src/data/contracts/gatewayRegistry.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

- `src/data/http/alx-api-auth.gateway.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/data/index.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/data/legacy/legacy-compat.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/pages/Login.tsx` — مراجعة يدوية ضمن مرحلة القطع.

### ميزات وصفحات (23 ملفًا)

- `src/features/accounting/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/auth/AuthSessionProvider.tsx` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/auth/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/browser/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/couriers/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/customers/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/employees/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/financeEntries/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/notifications/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/orders/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/orders/types.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/products/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/reports/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/reports/pages/ReportsPage.tsx` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/settings/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/settings/pages/tabs/AdminSecuritySettingsTab.tsx` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/shipments/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/siteManagement/components/ApiIntegrationsTab.tsx` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/siteManagement/components/SiteAnalyticsTab.tsx` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/sources/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/users/api.ts` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/users/components/ChangePasswordModal.tsx` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

- `src/features/users/pages/tabs/UserManagementTabContent.tsx` — فصل القراءة/الكتابة إلى خدمة مجال أو gateway؛ منع أي import من legacy-compat داخل UI.

### Lib (9 ملفًا)

- `src/lib/alxAuthGateway.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/lib/alxDataGateway.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/lib/sanitizeConsole.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/lib/supabase-adapter-columns.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/lib/supabase-adapter-mappers.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/lib/supabase-adapter.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/lib/supabase-config.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/lib/supabase.ts` — مراجعة يدوية ضمن مرحلة القطع.

- `src/lib/supabaseAdapterFinancial.contract.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.

### الخدمات (1 ملفًا)

- `src/services/financialEntryMigrations.contract.test.ts` — اختبار حدود/تكامل؛ يُعاد بناؤه على API mocks/contract tests ثم يُحذف اعتماد Supabase.


## الملفات الحرجة ذات الأولوية العالية

| الأولوية | الملف | سبب الأولوية | الإجراء | معيار القبول |
|---|---|---|---|---|
| P0 | `src/context/SettingsContext.tsx` | مصدر اسم النظام والشعار والعملات ما زال legacy + realtime Supabase | استبدال listeners بـ `HttpSettingsGateway` و`HttpCurrencyGateway` | كل القراءة/الحفظ تمر عبر API، ولا يوجد `db` أو `supabase` في الملف |
| P0 | `src/services/currencyService.ts` | مصدر مركزي للعملات يعتمد Supabase وfallback rates | تحويله إلى خدمة pure تستهلك DTO API فقط | لا default rates إلا في اختبار، وكل سعر يأتي من API |
| P0 | `src/data/legacy/legacy-compat.ts` | يسمح بمرور كل الاستدعاءات القديمة | حظر imports تدريجيًا ثم حذف الملف من production graph | static boundary يرفض أي import جديد وصفر consumers إنتاجيين |
| P0 | `src/features/orders/services/createOrderHandler.ts` | يعلن بقاء legacy fallback صراحة | إزالة fallback وربط errors بعقد API | إنشاء الطلب يعمل API فقط مع idempotency |
| P0 | `src/components/financeAccounting/FinanceApiDataGateway.ts` | fallback إلى data gateway القديم عند فشل API | جعل الفشل خطأ typed وإضافة retry مركزي في ApiClient فقط | لا `fallback()` legacy في API-only |
| P0 | `src/features/users/pages/UsersPage.tsx` | listener legacy ومسار fallback إداري | نقل القراءة والكتابة والجلسات إلى users/auth API | page بلا `legacy-compat` ويجتاز CRUD contract tests |
| P0 | `src/features/settings/pages/SettingsPage.tsx` | قراءة settings وlogistics وcurrency مباشرة | استهلاك Settings/Currency gateways | حفظ الإعدادات والشعار والأسعار عبر API |
| P1 | `src/data/contracts/gatewayRegistry.ts` | registry لا يفرض HTTP | إنشاء `httpGatewayRegistry` وإزالة current Supabase من runtime | registry واحد مستعمل في App |
| P1 | `src/lib/alxApiClient.ts` | fallback storage/رسائل غير موحدة | دمجه مع ApiClient أو توحيد العقد | auth/refresh/errors/request ID موحدة |
| P1 | `src/services/financialEntryService.ts` | منطق مالي وSupabase مباشر وlegacy types | إبقاء الحسابات pure ونقل persistence إلى finance API | لا SQL/Supabase في الخدمة |
| P1 | `src/services/orderHistoryService.ts` و`orderDeletionService.ts` | history/delete عبر legacy | إضافة API endpoints ذرية ثم نقل الخدمة | history/delete E2E API ناجح |
| P1 | `src/components/orders/ProductsManagementTab.tsx` و`src/features/orders/pages/subcomponents/returned-products/gateway.ts` | products/returns legacy | إضافة products/returns API contracts | lifecycle كامل للمنتج والمرتجع عبر API |


## خطة التنفيذ المرحلية الإلزامية

### المرحلة 0 — تثبيت عقد القطع والقياس

- إضافة `API_MODE=api-only|shadow|legacy-migration` في SwiftShip بدل flags متفرقة.
- تعريف مصفوفة domains وعمليات read/write المطلوبة، وربط كل عملية بendpoint وعقد DTO.
- إضافة static boundary test يفشل إذا ظهر `legacy-compat` أو `@supabase/supabase-js` داخل مسارات الإنتاج المسموح بها.
- تعريف معايير النجاح: صفر direct Supabase production imports، صفر fallback data، وصفر listeners Supabase.

**مخرج المرحلة:** ملف contract matrix واختبارات boundary تفشل حاليًا وتوضح قائمة العمل.

### المرحلة 1 — إكمال alx_api قبل نقل العميل

- إنشاء modules للإعدادات والعملات وأسعار الصرف.
- تصميم routes مقترحة: `GET/PATCH /api/v1/settings/general`، `GET/PATCH /api/v1/settings/user`، `GET/PATCH /api/v1/settings/logistics`، `GET/PATCH /api/v1/settings/whatsapp`، `GET /api/v1/currencies`، `GET /api/v1/currencies/:id/rates`، وعمليات currency CRUD المحمية.
- إضافة routes للـ statuses/options/categories/sources/shipping-companies/assets/returns/activity حسب ما تحتاجه الواجهات.
- توحيد شكل envelope وpagination وerrors، وإضافة OpenAPI وZod contracts واختبارات route/repository.
- نقل منطق حفظ الإعدادات والعملات إلى repositories API مع صلاحيات RBAC وتدقيق actor.

**مخرج المرحلة:** API قادر على تغطية كل عمليات SwiftShip التي كانت تمر عبر Supabase، مع contract tests.

### المرحلة 2 — توحيد عميل HTTP والهوية

- جعل `ApiClient` العميل الوحيد.
- إضافة refresh token مرة واحدة عند 401، منع retry للـ mutations، وتوحيد request ID وerror codes وtimeout.
- إزالة URLs الافتراضية من production.
- جعل `AuthSessionProvider` مصدر session الوحيد، وربط كل gateway بـ access token نفسه.

**مخرج المرحلة:** جميع gateways تستعمل عميلًا واحدًا ولا يوجد مسار auth بديل.

### المرحلة 3 — نقل Settings/Currency أولًا

- إعادة كتابة `SettingsContext` ليقرأ general/user settings من HTTP.
- جعل `SettingsPage` يحفظ النظام والشعار والإعدادات اللوجستية عبر API.
- تحويل `currencyService` إلى adapter API، وإزالة `DEFAULT_RATES` من runtime.
- استبدال realtime Supabase بـ explicit refetch أو polling API مضبوط عند الحاجة.

**مخرج المرحلة:** اسم النظام والشعار والعملات تظهر وتحفظ بعد refresh وlogout/login، مع اختبار browser/contract.

### المرحلة 4 — نقل المجالات التشغيلية

- orders/shipments/products أولًا مع إزالة `legacyOrdersApi` وfallback من `createOrderHandler`.
- customers/couriers/employees/sources/shipping companies ثانيًا.
- statuses/options/categories/returns ثالثًا بعد إضافة endpoints.
- كل UI يستدعي service domain، والخدمة تستدعي gateway، ولا يحتوي UI على persistence calls.

**مخرج المرحلة:** smoke/E2E لكل create/read/update/delete مع network assertion يثبت عدم وجود Supabase.

### المرحلة 5 — نقل المالية والتقارير

- نقل accounts/entries/movements/auto rules/settings/history إلى finance API.
- فصل الحسابات والتحويلات كـ pure business logic عن persistence.
- حذف fallback من `FinanceApiDataGateway` و`FinanceApiWriteGateway`.
- توحيد dashboard/report read models من API.

**مخرج المرحلة:** اختبارات توازن القيود والعملات والتقارير تعمل عبر API فقط.

### المرحلة 6 — نقل الهوية والإدارة والتكاملات

- users/roles/sessions/password actions عبر API فقط.
- notifications/activity logs/job applications/browser/portal approvals عبر عقود مكتملة.
- نقل WhatsApp settings إلى API دون كشف الأسرار.

**مخرج المرحلة:** كل صفحات الإدارة بلا `legacy-compat` أو Supabase listeners.

### المرحلة 7 — إزالة الطبقة القديمة

- حذف imports من 109 ملفًا وفق المصفوفة أعلاه، ثم حذف البوابات current-Supabase و`supabase.client.ts` و`supabase.ts` و`legacy-compat.ts` بعد آخر consumer.
- إزالة `@supabase/supabase-js` من dependencies إذا لم يعد مطلوبًا في أي runtime أو test.
- إبقاء scripts/migrations المنفصلة في مجلد migration فقط، ومنع استيرادها من التطبيق.

**مخرج المرحلة:** `rg` production scan يساوي صفرًا للاستدعاءات المباشرة، مع استثناءات موثقة فقط لملفات migration غير المشمولة في bundle.

### المرحلة 8 — إثبات API-only والإطلاق

- بناء production مع `API_MODE=api-only` وغياب Supabase env keys.
- تشغيل unit/contract/integration/E2E.
- اعتراض network ومنع أي طلب إلى Supabase URLs.
- اختبار توقف API: يجب ظهور خطأ مفهوم، لا العودة إلى قاعدة البيانات القديمة.
- تشغيل load test، health/readiness، audit logs، rollback وbackup/restore.
- مراجعة Render deployment والـ logs والـ environment variables.

**مخرج المرحلة:** تقرير قبول موقع بالأدلة، وليس مجرد تفعيل flags.

## مصفوفة الاختبارات المطلوبة

- **Static:** صفر imports من `legacy-compat` في production paths، صفر `createClient`، صفر `supabase.from`، وصفر `onSnapshot/channel/postgres_changes`.
- **Contract:** كل gateway يطابق OpenAPI وZod، بما فيها settings/currencies الجديدة.
- **Unit:** mapping DTOs، feature services، currency calculations، error normalization.
- **Integration:** API repositories مع قاعدة الاختبار، RBAC، idempotency، settings/logo/currencies، history، returns، financial entries.
- **E2E:** login، settings، currencies، customer، product، order، shipment، return، finance، reports، roles/users، notifications.
- **Runtime:** network deny-list لـ Supabase، تشغيل بدون مفاتيح Supabase، فشل API متعمد، refresh token، rate limit، وrequest ID.

## المخاطر والقرارات

- لا يجوز حذف Supabase layer قبل اكتمال endpoints settings/currencies والعمليات الناقصة.
- لا يجوز اعتبار `VITE_USE_HTTP_API=true` دليل قطع. الدليل هو static scan + runtime network proof + E2E.
- لا يجوز وضع قيم مثل SAR/YER أو أسعار صرف ثابتة في production كحل لتعطل API. القيم الافتراضية تبقى فقط لتهيئة شاشة login أو اختبارات صريحة.
- يجب الحفاظ على migrations وscripts خارج bundle، مع توثيق أنها ليست runtime dependencies.
- فشل workflow الموازي بسبب حد الاعتمادات في الجلسة؛ لذلك هذا التقرير مبني على جرد محلي مباشر وقراءة الملفات الفعلية، وليس على نتائج وكلاء غير مكتملة.

## المهمة التالية الموصى بها

البدء بالمرحلة 0 ثم المرحلة 1 فقط: إنشاء contract matrix واختبارات boundary، وبعدها بناء وحدة `settings/currencies` في `alx_api` قبل تعديل بقية SwiftShip. لا ينبغي نقل 109 ملفًا دفعة واحدة قبل تثبيت عقود API الناقصة.
