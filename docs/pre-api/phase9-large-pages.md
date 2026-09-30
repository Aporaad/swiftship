# المرحلة 9 — تنظيم الصفحات الكبيرة

**الحالة:** مُصحَّحة وظيفيًا؛ التفكيك الدقيق إلى Hooks/Components ما زال يحتاج مرحلة لاحقة.
**آخر تدقيق:** 2026-09-30
**AI Model:** Gemini 3.6 Flash (Medium) / Antigravity

## الملخص الإجمالي

تم نقل نقاط دخول الصفحات إلى الوحدات الخاصة بكل Feature تحت `src/features/<feature>/pages/` مع إبقاء `src/pages` كموجّهات توافقية. أثناء تدقيق المرحلة التاسعة تبيّن أن بعض النسخ المفككة حذفت عمليات حقيقية واستبدلتها بدوال فارغة، لذلك أُعيدت الصفحات إلى محتواها السابق الكامل داخل مسارات Features، مع تعديل مسارات الاستيراد فقط. هذا يحافظ على السلوك الأصلي ويمنع فقدان الوظائف، لكنه يعني أن التفكيك الدقيق لبعض الصفحات الكبيرة لم يكتمل بعد.

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

توجد مكونات وHooks مساعدة جاهزة لصفحة الطلبات (`features/orders`)، لكن النسخة التنفيذية الحالية تحتفظ بمحتوى الصفحة الأصلي كاملًا لضمان عدم فقدان العمليات الحساسة:
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
   - نجحت 169 حالة، مع تخطي 6 حالات معلّمة، من مجموعة 175 حالة قابلة للتنفيذ بعد استبعاد اختباري الاتصال الخارجي بـ Supabase.
   - اختبارات Supabase الثلاثة المتبقية في التشغيل الكامل تتطلب متغيرات حقيقية (`SUPABASE_URL` و`SUPABASE_ANON_KEY`) غير متاحة في بيئة التدقيق، ولذلك تعذر تنفيذ الاتصال الخارجي.

3. **التجميع للإنتاج (`npm run build`)**:
   - نجاح تجميع الواجهة (Vite) وبناء الخادم (esbuild `dist/server.cjs`).

## نتائج تدقيق 2026-09-30
- تم استرجاع handlers الخاصة بإنشاء الطلب، تحديث الحالة، التحصيل، الحذف الجماعي، سجل التدقيق، الفاتورة، المنتجات، وفئات المنتجات؛ وكانت النسخة المفككة السابقة تحتوي بدائل فارغة لبعضها.
- تم إصلاح استيراد `TrackingPage` بعد النقل إلى `features/shipments`.
- تم تحديث اختبارات wiring لتقرأ مسارات Features الجديدة بدل ملفات wrappers.
- لم يتم إجراء أي تعديل على قاعدة البيانات أو RLS.
- ما زال التفكيك الدقيق لبعض الصفحات الكبيرة (نقل كل منطقها إلى Hooks/Components مستقلة) عملًا لاحقًا؛ الأولوية الحالية هي الحفاظ على التكافؤ الوظيفي مع النسخة الأصلية.
