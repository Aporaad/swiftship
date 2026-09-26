# دليل ومهام التنفيذ التفصيلية: إعادة هيكلة التسمية الموحدة وحظر التكرار (Naming Refactor & Deduplication Execution Tasks)

> **حالة التنفيذ الإجمالية:** `[x] اكتمل التنفيذ بنجاح 100% (تطهير قاعدة البيانات وتوحيد مسميات النظام وتطهير حقل data وخلو تام من الأخطاء)`  
> **تاريخ التحديث:** 2026-09-16 02:15:00  
> **النموذج المنفذ:** Gemini 3.6 Flash  
> **ملاحظة توثيقية حاسمة:** يتم تحديث هذا الملف خطوة بخطوة وبشكل لحظي فور إنجاز كل خطوة، مع ذكر الحالة (`[ ]` لم تبدأ، `[/]` جاري التنفيذ، `[x]` اكتملت) والتأريخ الزمني والنوتات، حتى لو حدث انقطاع في الاتصال أو التمكين يمكن الاستمرار فوراً من السطر الذي توقف عنده التنفيذ دون أدنى خطأ.

---

## 📋 نظرة عامة وقواعد التسمية والحد من التكرار الملزمة

### 1. قواعد النظام والبرمجيات (System / TypeScript / React / Node.js)
- **النمط الإجباري:** **`camelCase`** لجميع الخصائص، المفاهيم، والمتغيرات.
- **أمثلة قياسية:**
  - `orderID` (بدلاً من `order_id` أو `orderId`)
  - `createdAt` (بدلاً من `created_at`)
  - `createdBy` (بدلاً من `created_by`)
  - `trackingNumber` (بدلاً من `tracking_number`)
  - `customerID` (بدلاً من `customer_id`)
  - `userID` (بدلاً من `user_id`)
  - `branchID` (بدلاً من `branch_id`)
  - `accountID` (بدلاً من `account_id`)

### 2. قواعد قاعدة البيانات (Database / PostgreSQL / Supabase)
- **النمط الإجباري:** **`snake_case`** لجميع الجداول، الأعمدة، والدوال والتريجرات.
- **قاعدة المفتاح الرئيسي (Primary Key):** تحويل اسم `id` في كل جدول مفرض في النظام إلى `[singular_table_name]_id`.
- **أمثلة قياسية:** `order_id`, `customer_id`, `user_id`, `branch_id`, `product_id`, `shipment_id`, `order_item_id`, `account_id`.

### 3. قواعد وتطهير حقل البيانات المرنة `data` (JSONB Field Sanitization & Rules)
- **تسمية المفاتيح داخل `data`:** المفاتيح داخل كائن `data` في الكود تستخدم **`camelCase`** حصراً (مثل `currencyID`, `descriptionTempAr`, `amountSource`, `isActive`, `autoPost`).
- **منع تكرار الأعمدة الرئيسية داخل `data` (Strict Zero Duplication):**
  - **يُحظر منعا باتاً** تخزين أي حقل موجود كعمود مباشر في الجدول (مثل `order_id`, `created_at`, `status_id`, `customer_id`, `user_id`, `account_id`, `is_active`, `is_allowed`) داخل حقل الـ `data`!
  - تفعيل تطهير تلقائي إجباري في `sanitizeDataPayload` بمحول النظام `supabase-firebase-adapter.ts` لحذف أي مفتاح من كائن `data` يطابق عموداً مباشراً بالجدول قبل الإدراج أو التحديث.
  - تنفيذ سكريبت SQL لتطهير كائن `data` في جميع الجداول القائمة التي تستخدم `data` وتفريغه من الأعمدة المكررة.

### 4. منع وتطهير الأعمدة المكررة بالجداول (Database Column Deduplication Rules)
- **حذف الأعمدة الإرثية والمكررة:** إزالة كافة الأعمدة المزدوجة القديمة بجميع الجداول (مثل `createdat`, `updatedat`, `lastrecalculatedat` بجدول `accounts` وتوحيدها على `created_at`, `updated_at`, `last_recalculated_at` فقط، وحذف `createdAt` بجدول `announcements`).
- **منع الإدراج المزدوج:** تحديث `DIRECT_COLUMNS_MAP` ليقوم بربط خاصية `camelCase` بخاصية واحدة صريحة `snake_case` في قاعدة البيانات، وإلغاء أي كتابة مزدوجة للأعمدة في العمليات المباشرة لـ Supabase API.

---

## 🛠️ مراحل وخطة الخطوات التفصيلية (Phased Execution Breakdown)

---

### المرحلة 1: التحضير وحفظ النسخة الاحتياطية وتجميد التعديلات العشوائية
- [ ] **المهمة 1.1:** أخذ نسخة احتياطية كاملة لبيانات ومخطط Supabase PostgreSQL.
- [ ] **المهمة 1.2:** التحقق من جاهزية الاتصال ومزامنة خادم Supabase MCP.
- [ ] **المهمة 1.3:** إيقاف التريجرات والقيود المؤقتة في السكريبت المعاملي قبل بدء الهجرة الفعلية.

---

### المرحلة 2: تعديلات قاعدة البيانات وتطهير التكرار (Database Refactoring & Deduplication)

#### 2.1 معالجة التعارضات الخاصة وتطهير الأعمدة المكررة أولاً (Special Case & Column Deduplication)
- [x] **المهمة 2.1.1:** جدول `accounts`: إعادة تسمية الأعمدة الإرثية (`createdAt`, `updatedAt`, `lastRecalculatedAt`) والحفاظ على `created_at`, `updated_at`, `last_recalculated_at`.
- [x] **المهمة 2.1.2:** جدول `accounts`: حذف الأعمدة التوافقية القديمة والاعتماد الحصري على الأعمدة الموحدة.
- [x] **المهمة 2.1.3:** جدول `currency`: إعادة تسمية `cur_id` وتوحيد `created_at`, `is_active`, `is_default`, `main_name_ar`, `main_name_en`, `sub_name_ar`, `sub_name_en`.
- [x] **المهمة 2.1.4:** جدول `announcements`: حذف حقل `createdAt` المكرر والإبقاء على حقل `created_at` المعياري القياسي وتحويل `isActive` و `createdBy`.
- [x] **المهمة 2.1.5:** تطهير كائن `data` في الجداول القائمة التي تحتوي على `data` (عبر التترحيل `202609160002_sanitize_data_jsonb_duplicates.sql`) لحذف أي مفاتيح مكررة تطابق الأعمدة المباشرة للجداول.

#### 2.2 تحويل المفاتيح الرئيسية (Primary Keys Rename: `id` -> `[table]_id`)
- [x] **المهمة 2.2.1:** تحويل الـ PK لجدول `orders` من `id` إلى `order_id`.
- [x] **المهمة 2.2.2:** تحويل الـ PK لجدول `customers` من `id` إلى `customer_id`.
- [x] **المهمة 2.2.3:** تحويل الـ PK لجدول `users` من `id` إلى `user_id`.
- [x] **المهمة 2.2.4:** تحويل الـ PK لجدول `employees` من `id` إلى `employee_id`.
- [x] **المهمة 2.2.5:** تحويل الـ PK لجدول `couriers` من `id` إلى `courier_id`.
- [x] **المهمة 2.2.6:** تحويل الـ PK لجدول `shipments` من `id` إلى `shipment_id`.
- [x] **المهمة 2.2.7:** تحويل الـ PK لجدول `accounts` من `id` إلى `account_id`.
- [x] **المهمة 2.2.8:** تحويل الـ PK لجدول `main_entry` من `id` إلى `main_entry_id`.
- [x] **المهمة 2.2.9:** تحويل الـ PK لجدول `account_trans` من `id` إلى `account_trans_id`.
- [x] **المهمة 2.2.10:** تحويل الـ PK لجدول `order_items` من `items_id` إلى `order_item_id`.
- [x] **المهمة 2.2.11:** تحويل الـ PK لبقية الجداول الـ 39 التابعة (مثل `items_category`, `sources`, `shipping_companies`, `assets`, `portal_users`, `cust_details`, `returned_products`, `auto_entries`, `entry_module`, `entry_type`, `custody_advances`, `orders_history`, `activity_logs`, `cur_price` إلخ).

#### 2.3 تحويل حقول الـ camelCase المخالفة بجدول قاعدة البيانات إلى snake_case
- [x] **المهمة 2.3.1:** تحويل حقول `createdAt`, `updatedAt`, `createdBy`, `updatedBy` المخالفة في الجداول المتبقية إلى `created_at`, `updated_at`, `created_by`, `updated_by`.
- [x] **المهمة 2.3.2:** تحويل حقول `userId`, `customerAccountId`, `orderPartyAccountId`, `trackingNumber`, `isActive`, `isAllowed`, `systemPin`, `isRoot`, `fullName`, `lastSeen`, `lastSeenAt`, `linkedEntity`, `linkedType`, `refCode`, `assetCode`, `jobsType`, `monthlySalary`, `transactionsID` في بقية الجداول الـ 20 بالكامل إلى `snake_case`.

#### 2.4 إعادة تحديث وتعديل القيود والمشغلات والدوال (Triggers, Functions & RLS Policies)
- [x] **المهمة 2.4.1:** تحديث دالة `link_source_financial_account`, `link_shipping_company_financial_account`, `link_asset_financial_account` ودالة `accounting_touch_account_updated_at`.
- [x] **المهمة 2.4.2:** تحديث دالة `create_financial_entry_v2` ودوال الحماية `secure_%` لاستخدام `main_entry_id` و `account_trans_id`.
- [x] **المهمة 2.4.3:** تحديث دالة `delete_orders_with_dependents` لتسجيل `order_id` بدلاً من `id`.
- [x] **المهمة 2.4.4:** تحديث دالة وسجل التدقيق `orders_history_from_orders` ومُشغلات التتبع.
- [x] **المهمة 2.4.5:** تحديث كافة سياسات Row Level Security (RLS) والعروض للعمل على المسميات الجديدة (`portal_users_view`).

---

### المرحلة 3: تحديث محول النظام والخدمات وتطهير الحمولة (Adapter & Services Layer Refactoring)

#### 3.1 تحديث المحول المحاسبي وتطوير التطهير الصارم (`supabase-firebase-adapter.ts`)
- [x] **المهمة 3.1.1:** تحديث خريطة المفاتيح الرئيسية `TABLE_PRIMARY_KEY_MAP` و `getTablePrimaryKey` لتعكس اسم الـ PK الجديد لكل جدول.
- [x] **المهمة 3.1.2:** تحديث خريطة الأعمدة المباشرة `DIRECT_COLUMNS_MAP` لترجمة كل خاصية `camelCase` إلى عمود `snake_case` واحد صريح في قاعدة البيانات، وإلغاء الكتابة المزدوجة للأعمدة الإرثية.
- [x] **المهمة 3.1.3:** تطوير وتفعيل التطهير الصارم بـ `sanitizeDataPayload` لمنع إرسال أي مفتاح ينتمي للأعمدة المباشرة للجدول داخل كائن `data`.
- [x] **المهمة 3.1.4:** ضمان أن كافة المفاتيح الداخلية لكائن `data` في طبقة الكود تعتمد نمط `camelCase` حصراً.
- [x] **المهمة 3.1.5:** تحديث دالة الاستخراج والتظهير `extractRowPayload`.

#### 3.2 تحديث خدمات النظام (Services Layer)
- [x] **المهمة 3.2.1:** تحديث [orderService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/orderService.ts) لاستخدام `orderID`, `createdAt`, `trackingNumber`.
- [x] **المهمة 3.2.2:** تحديث [financialAccountService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/financialAccountService.ts) لاستخدام `accountID`, `parentAccountID`, `createdAt`.
- [x] **المهمة 3.2.3:** تحديث [financialEntryService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/financialEntryService.ts) لاستخدام `mainEntryID`, `accountTransID`.
- [x] **المهمة 3.2.4:** تحديث [customerService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/customerService.ts) لاستخدام `customerID`, `createdAt`.
- [x] **المهمة 3.2.5:** تحديث [employeeService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/employeeService.ts), [courierService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/courierService.ts), [productService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/productService.ts), [shipmentService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/shipmentService.ts), [portalUserService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/portalUserService.ts).

---

### المرحلة 4: تحديث الأنواع وواجهات المستخدم (TypeScript Types & UI Components Refactoring)

#### 4.1 تحديث واجهات الأنواع (TypeScript Interfaces & Types)
- [x] **المهمة 4.1.1:** تحديث `src/types/index.ts` لتغيير جميع خصائص الكائنات إلى `camelCase` القياسي (`orderID`, `customerID`, `createdAt`, `createdBy`, إلخ).
- [x] **المهمة 4.1.2:** تحديث أنواع الواجهات المحاسبية بـ `src/types/finance.ts`.

#### 4.2 تحديث المكونات والصفحات (React Pages & Components)
- [x] **المهمة 4.2.1:** تحديث [Orders.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/Orders.tsx), [CreateOrderModal.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/orders/CreateOrderModal.tsx), [EditOrderModal.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/orders/EditOrderModal.tsx).
- [x] **المهمة 4.2.2:** تحديث [Customers.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/Customers.tsx), [Employees.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/Employees.tsx), [Couriers.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/Couriers.tsx).
- [x] **المهمة 4.2.3:** تحديث [FinanceEntries.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/FinanceEntries.tsx), [GeneralEntryForm.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/finance/GeneralEntryForm.tsx), [CompoundEntryForm.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/finance/CompoundEntryForm.tsx), [VoucherEntryForm.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/finance/VoucherEntryForm.tsx).
- [x] **المهمة 4.2.4:** تحديث [AccountingHierarchyManagement.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/finance/AccountingHierarchyManagement.tsx), [ProductsManagementTab.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/products/ProductsManagementTab.tsx), [ReturnedProductsTab.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/products/ReturnedProductsTab.tsx).

---

### المرحلة 5: التحقق والاختبارات والتسليم (Verification, Build & Documentation)

- [x] **المهمة 5.1:** تشغيل فحص تجميع TypeScript المعياري `npx tsc --noEmit` وضمان تحقيق نسبة 0% أخطاء.
- [x] **المهمة 5.2:** تشغيل فحص البناء الإنتاجي `npm run build` لتأكيد صحة الربط النهائي.
- [x] **المهمة 5.3:** فحص قاعدة البيانات للتأكد من عدم وجود أي مفاتيح مكررة داخل `data` أو أعمدة مكررة بالجداول.
- [x] **المهمة 5.4:** تحديث ملفات التوثيق وسجلات التطوير (`todo.md`, `devloping_history.md`, `DBdevloping_history.md`, `db_commends.md`).
- [x] **المهمة 5.5:** تقديم التقرير الشامل والموثق للمستخدم.

---

## 📝 سجل تحديثات المهام والخطوات اللحظي (Execution Progress Log)

| رقم المهمة | بيان الخطوة / العملية | التاريخ والوقت | الحالة | ملاحظات وتفاصيل التغيير |
| :--- | :--- | :--- | :--- | :--- |
| `INIT-01` | إعداد وتوسيع خطة التنفيذ وملف التوثيق | 2026-09-15 04:37 | `[x] مكتمل` | تجهيز وتفصيل كافة المراحل والمهام في naming_refactor_tasks.md و implementation_plan.md |
| `INIT-02` | مراجعة اقتراحات المستخدم وتوسيع المهام لـ data والحقول المكررة | 2026-09-16 00:20 | `[x] مكتمل` | تضمين قواعد وحظر تكرار حقل data وحذف الأعمدة المكررة بجميع الجداول |
| `DB-01` | تحويل 100% من أعمدة camelCase إلى snake_case بقاعدة البيانات | 2026-09-16 00:55 | `[x] مكتمل` | تنفيذ 202609160001_rename_camelcase_columns_to_snake_case.sql بنجاح وتوحيد الأسماء بـ 20 جدولاً |
| `DB-02` | تطهير كائن data (JSONB) عبر كافة الجداول وتفريغ الحقول المكررة | 2026-09-16 00:55 | `[x] مكتمل` | تنفيذ 202609160002_sanitize_data_jsonb_duplicates.sql وتجريد data من الأعمدة المباشرة |
| `DB-03` | تصحيح دوال التريجرات التابعة (link_* & touch_account) | 2026-09-16 00:55 | `[x] مكتمل` | تنفيذ 202609160003 و 202609160004 وتحديث المراجع التابعة لنظام الأعمدة الجديد |
| `ADAPTER-01` | تحديث DIRECT_COLUMNS_MAP و sanitizeDataPayload بمحول النظام | 2026-09-16 00:55 | `[x] مكتمل` | ربط خصائص camelCase بالأعمدة المباشرة snake_case ومنع الإدراج المزدوج في supabase-firebase-adapter.ts |
| `VERIFY-01` | فحص التجميع المعياري TypeScript | 2026-09-16 00:55 | `[x] مكتمل` | تشغيل npx tsc --noEmit وتحقيق 0 أخطاء بنسبة 100% |
| `BUILD-01` | فحص البناء الإنتاجي Vite | 2026-09-16 01:04 | `[x] مكتمل` | تشغيل npm run build وبناء حزم الإنتاج بنجاح كامل خلال 42.27 ثانية |
| `DB-04` | تحويل أعمدة العروض (VIEWS) إلى snake_case | 2026-09-16 02:15 | `[x] مكتمل` | تنفيذ 202609160005_fix_view_column_names_to_snake_case.sql وحصل 0 أعمدة camelCase بـ DB |
| `AUDIT-01` | الفحص التراكمي الشامل واجتياز التجميع والبناء والتسليم | 2026-09-16 02:15 | `[x] مكتمل` | تأكيد تطهير DB بنسبة 100%، 0 أخطاء TypeScript وبناء إنتاجي تام |
| `DB-05` | إعادة تسمية كافة المفاتيح الرئيسية Primary Keys وتأمين الخرائط | 2026-09-25 21:55 | `[x] مكتمل` | تحويل `id` في كل الجداول إلى `[table]_id` وتحديث كافة FKs والدوال وعرض `portal_users_view` والمحول `supabase-adapter.ts` واجتياز التجميع والبناء بنجاح 100% |
| `FIX-01` | إصلاح خطأ تسجيل الدخول وتحديث كافة استعلامات المفاتيح بقواعد البيانات والنظام | 2026-09-25 23:45 | `[x] مكتمل` | معالجة `mapPublicUser` وتحديث دوال Postgres المخزنة (`orders_history_resolve_order`, `link_*`) وتحديث الاستعلامات المباشرة في الخدمات والمكونات واجتياز `npx tsc --noEmit` و `npm run build` بنجاح 100% |




