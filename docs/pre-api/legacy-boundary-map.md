# Legacy Boundary Map — إغلاق المرحلة 2

**التاريخ:** 2026-09-28
**الحالة:** مكتمل كحدود انتقالية؛ لا يتم حذف Legacy أو نقل الصفحات قبل تنفيذ المرحلة التالية وفق الخطة.

## 1. قاعدة الانتقال

الصفحات الحالية تبقى Legacy مؤقتاً. Feature boundaries الجديدة هي مالك الأعمال المستقبلي، بينما يتم النقل Feature-by-Feature. لا توجد Supabase imports أو SQL داخل ملفات `src/features/*` الجديدة.

## 2. خريطة الملكية

| Legacy source | Feature owner | نطاق الأعمال | الحالة الانتقالية | API candidate لاحقاً |
|---|---|---|---|---|
| `src/pages/Login.tsx`, auth adapter | `auth` | تسجيل الدخول والجلسة | Legacy يعمل؛ لا نقل الآن | `/v1/auth/session` |
| `src/pages/BrowserViewer.tsx` | `browser` | المتصفح الداخلي والـproxy UI | Feature مستقل؛ لا يقرأ بيانات الأعمال مباشرة | `/v1/browser/*` |
| `src/pages/Users.tsx`, `UserManagement.tsx`, `permissions.ts` | `users`, `roles` | المستخدمون والأدوار والصلاحيات | `roles` أول عينة؛ users لاحقاً | `/v1/users`, `/v1/roles` |
| `src/pages/Customers.tsx`, customer components | `customers` | العملاء والحسابات المرتبطة | Legacy يعمل | `/v1/customers` |
| `src/pages/Orders.tsx`, `src/components/orders` | `orders` | الطلبات، الأطراف، السجل، وربط البنود | لا نقل قبل تثبيت side effects | `/v1/orders` |
| product components/services | `products` | المنتجات الرئيسية، التصنيفات، وحركة البنود | Feature مستقل؛ لا يملك إنشاء القيود | `/v1/products` |
| return components/services | `products` مع تنسيق `orders` | المرتجعات وتغيير حالة بند الطلب والأثر المالي | لا Feature مستقل للمرتجعات حالياً | `/v1/products/returns` |
| source/shipping/asset components and services | `sources` | مصادر الطلب، شركات الشحن، والأصول المرتبطة | الحساب المالي مرجعي من Accounting | `/v1/sources`, `/v1/shipping-companies` |
| `src/pages/Tracking.tsx`, shipment components | `shipments` | الشحنات والتتبع | Legacy يعمل | `/v1/shipments`, `/v1/tracking` |
| courier components/services | `couriers` | المناديب والربط بالطلبات | Legacy يعمل | `/v1/couriers` |
| employee components/services | `employees` | الموظفون والحساب المالي المرجعي | Legacy يعمل | `/v1/employees` |
| `Accounting.tsx`, chart/account services | `accounting` | دليل الحسابات، العملات، الأرصدة، العهد | لا ينفذ قيوداً أو سندات | `/v1/accounting` |
| expense screens/services | `accounting/expenses` | المصروفات | جزء من accounting؛ لا `src/features/expenses` | `/v1/accounting/expenses` |
| `FinanceEntries.tsx`, financial entry services | `financeEntries` | القيود والسندات، الترحيل، العكس، الإلغاء، إعدادات القيد | Feature مستقل؛ لا يدمج داخل accounting | `/v1/finance-entries` |
| `Notifications.tsx`, notification/WhatsApp services | `notifications` | الإشعارات والآثار الجانبية | Legacy يعمل | `/v1/notifications` |
| `Dashboard.tsx`, `Reports.tsx`, report services | `reports` | read models والتقارير | لا يقرأ صفوفاً خاماً في Feature الجديد | `/v1/reports` |
| `src/pages/WebsiteManagement.tsx` | `siteManagement` | إدارة موقع الشركة والمحتوى والقوالب | Feature مستقل عن Settings | `/v1/site-management/*` |
| `Settings.tsx` | `settings` | إعدادات النظام والواجهة | Legacy يعمل | `/v1/settings` |
| `alx_web/src/pages`, portal services | `auth`, `customers`, `shipments` | بوابة العملاء والتتبع العام | لا نقل دفعي | `/v1/portal/*` |
| `server.ts`, `server/` | application/server boundary لاحقاً | jobs, proxy, reconciliation | خارج نقل المرحلة 2 | endpoints/jobs منفصلة لاحقاً |

## 3. Legacy files التي لا تحذف

الملفات ذات الامتداد `.bak` و`.firebase-cleanup-backup/` تبقى مرجعاً غير تشغيلي ولا تستخدم في runtime. لا تحذف في هذه المرحلة، ولا يعتمد عليها تصميم Feature.

## 4. معيار إغلاق المرحلة 2

تم إنشاء حدود Features لكل الوحدات المطلوبة، وفصل `accounting/expenses` عن `financeEntries`, وتحديد مالك كل نطاق ومقترح API وLegacy source. لا يتم تنفيذ Data Gateway أو نقل صفحات الإنتاج حتى يعتمد هذا المستند وينتقل التنفيذ رسمياً إلى المرحلة 3.
