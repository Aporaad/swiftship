# المرحلة 9 — تنظيم الصفحات الكبيرة

**الحالة:** مكتملة بالكامل ومُتحقَّق منها.
**التاريخ:** 2026-09-28
**AI Model:** Gemini 3.6 Flash (Medium) / Antigravity

## الملخص الإجمالي

تم تنظيم وتفكيك الصفحات الكبيرة في النظام ونقل مسؤولياتها وإدارتها إلى المودولات الخاصة بكل Feature تحت `src/features/<feature>/pages/`. أسفر ذلك عن التخلص من التركيز الأحدي للصفحات العريضة وتوفير بنية نظيفة وقابلة للصيانة تتطابق مع نمط Domain-Driven Design النظيف المعلن في خطة التهيئة قبل API (`system_pre_api_restructure_plan_ar.md`).

## الهيكل الجديد للصفحات داخل الـ Features

تم تنظيم كافة الصفحات في الوحدات المخصصة لها:

```text
src/features/
├── orders/pages/OrdersPage.tsx                 ← صفحة إدارة الطلبات المنظمة
├── customers/pages/CustomersPage.tsx           ← صفحة إدارة العملاء
├── couriers/pages/CouriersPage.tsx             ← صفحة إدارة المناديب
├── employees/pages/EmployeesPage.tsx           ← صفحة إدارة الموظفين
├── accounting/pages/AccountingPage.tsx         ← صفحة الحسابات والمالية
├── financeEntries/pages/FinanceEntriesPage.tsx ← صفحة القيود والسندات المالية
├── notifications/pages/NotificationsPage.tsx   ← صفحة الإشعارات والتنبيهات
├── reports/pages/ReportsPage.tsx               ← صفحة التقارير التحليلية
├── settings/pages/SettingsPage.tsx             ← صفحة إعدادات النظام
├── users/pages/UserManagementPage.tsx          ← صفحة إدارة المستخدمين والجلسات
├── users/pages/UsersPage.tsx                   ← صفحة المستخدمين
├── siteManagement/pages/WebsiteManagementPage.tsx ← صفحة إدارة موقع الشركة
├── browser/pages/BrowserViewerPage.tsx         ← صفحة المتصفح الداخلي
├── roles/pages/RolesPage.tsx                   ← صفحة الأدوار والصلاحيات
├── sources/pages/SourcesPage.tsx               ← صفحة مصادر التوريد والشراء
└── shipments/pages/TrackingPage.tsx            ← صفحة تتبع الشحنات
```

مع إبقاء ملفات `src/pages/*.tsx` كموجهات خفيفة ونظيفة (Forwarding Wrappers) لضمان عدم كسر أي استيراد خارجي أو مسار راوتر حالي.

## تفاصيل إعادة هيكلة صفحة الطلبات (`features/orders`)

تم تقسيم مسؤوليات صفحة الطلبات (`Orders.tsx`) وفق النمط المعتمد:
- `hooks/useOrderData.ts`: جلب بيانات الطلبات والعملاء والمناديب والمصادر والمستندات عبر Realtime Subscriptions.
- `hooks/useOrderFilters.ts`: إدارة التصفية والبحث والفرز والتبويبات.
- `hooks/useOrderFormState.ts`: إدارة حالة النماذج للإنشاء والتعديل والحذف وتغيير الحالات.
- `hooks/useOrderCalculations.ts`: منطق احتساب المبالغ، الخصومات، والعمولات وسعر الصرف.
- `pages/OrdersPage.tsx`: الصفحة الرئيسية المنظمة التي تجمع المكونات والـ Hooks.
- `components/`: النماذج والنوافذ المنفصلة (CreateOrderModal, EditOrderModal, UpdateStatusModal, PaymentModal, DeleteOrderModal, OrderDetailsModal, OrderHistoryModal, etc.).

## نتائج التحقق

1. **فحص الأنواع بواسطة TypeScript (`npx tsc --noEmit`)**:
   - نجاح تام بدون أي أخطاء (0 Errors).

2. **اختبارات الوحدة والأجهزة (`vitest`)**:
   - 174 اختبار وحدة ناجح في كافة وحدات النظام الخادمي والعميل والـ Mappers واختبارات عقود المالية.

3. **التجميع للإنتاج (`npm run build`)**:
   - نجاح تجميع الواجهة (Vite) وبناء الخادم (esbuild `dist/server.cjs`).

## الحدود والقيود
- تم الحفاظ على جميع السلوكيات والخصائص والمزايا الحالية دون حذف أي وظيفة.
- لم يتم إجراء أي تعديل على قاعدة البيانات أو RLS.
