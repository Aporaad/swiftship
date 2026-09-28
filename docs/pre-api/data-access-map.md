# Data Access Map — خريطة الوصول إلى البيانات

**التاريخ:** 2026-09-28
**المرحلة:** جرد ما قبل Canonical Contracts
**مصدر الحالة:** ملفات النظام، أسماء الخدمات والاختبارات، المهاجرات حتى 2026-09-27، ونتائج baseline من Windows الأصلي.
**قاعدة:** هذا الملف يصف الوضع الحالي؛ لا يمثل التصميم المستهدف ولا يبرر استمرار الوصول المباشر.

## 1. Auth / Users / Roles

| Client/Page | Services/Modules | Data/Operations الحالية | الآثار | Gateway مرشح |
|---|---|---|---|---|
| `Login.tsx` | `supabase-adapter.ts`، Auth compatibility | جلسة، login/logout، current user | session state، auth listeners | `AuthGateway` |
| `Users.tsx`, `UserManagement.tsx` | adapter، `permissions.ts`، `activityLogService` | users، roles، sessions؛ CRUD وإدارة الحالة | activity/audit، force logout | `UsersGateway`, `RolesGateway` |
| `Roles.tsx` | permissions/adapter | roles وpermission definitions | UI permission visibility | `RolesGateway` |

**ملاحظة:** `users.password` و`users.system_pin` لا يدخلان DTO أو Storage. القرار النهائي للصلاحية يبقى في API.

## 2. Customers / Staff / Sources

| Feature | Files الظاهرة | Data الحالية | Operations | الآثار |
|---|---|---|---|---|
| Customers | `Customers.tsx`, entity modals | `customers`, account link، portal link | list/search/create/update/activate | account provisioning، portal mapping، activity |
| Employees | `Employees.tsx`, entity components | `employees`, `users`, `accounts` | CRUD وربط مستخدم وحساب | account provisioning، activity |
| Couriers | `Couriers.tsx`, entity components | `couriers`, `users`, `accounts` | CRUD وربط حساب/مستخدم | account provisioning، activity |
| Sources | `Sources.tsx` | `sources`, `accounts` | CRUD وربط حساب مصدر | financial account link، activity |
| Shipping companies | shipment/entity components | `shipping_companies`, `accounts` | CRUD وربط الحساب | financial account link، activity |

**Gateway candidates:** `CustomersGateway`, `EmployeesGateway`, `CouriersGateway`, `SourcesGateway`.

## 3. Orders

| العملية | الصفحات/الخدمات | الجداول/الإجراءات | الآثار الجانبية | Transaction need |
|---|---|---|---|---|
| قراءة الطلبات | `Orders.tsx`، order components | `orders`, `order_items`, `order_party`, `shipments` | cache/realtime/history enrichment | قراءة متعددة |
| إنشاء الطلب | `Orders.tsx`، `orderPartyService`، `productService`، currency services | `orders`, `order_items`, `order_party`، products، optional shipment | history، activity، notification، optional financial entry | نعم |
| تعديل الطلب | `Orders.tsx`، order services | orders/items/party | history diff، activity، financial recalculation حسب السياسة | غالباً نعم |
| تغيير الحالة | `orderLifecycleService` | orders، `order_status`، `orders_history` | automatic entries، notification، shipment effects | نعم |
| حذف الطلب | `orderDeletionService`، server wiring | atomic delete RPC وتوابع orders/items/shipments/history | cache invalidation، financial link cleanup | نعم/atomic RPC |
| سجل الطلب | `orderHistoryService`, `OrderHistoryModal` | `orders_history`, activity/financial links | عرض audit فقط | قراءة |
| الدفع | `orderPaymentDataService`, `financialEntryService` | payment details، `main_entry`, `account_trans` | order history، balance projection، idempotency | نعم/atomic RPC |

## 4. Products / Returns

| Feature | Services/Components | Data | Operations | ملاحظات |
|---|---|---|---|---|
| المنتجات الأساسية | `productService`، product management components | `products`, `items_category` | list/create/update/delete/filter | المنتج الأساسي لا يكرر لكل طلب |
| حركة المنتجات | order item components | `order_items`, orders، products | attach/update/status | مصدر الحركة وليس product master |
| المرتجعات | `returnedProductService` | `returned_products`, order/items/customer | create/update/status/refund | الإرجاع يحتاج سياسة مالية وidempotency |

## 5. Shipments / Tracking

| Feature | Files | Data | Operations | الآثار |
|---|---|---|---|---|
| Shipments | `Tracking.tsx`, `src/components/shipments`, order flows | `shipments`, orders، couriers، shipping companies | create/update/status/read | orders_history، notifications، activity |
| Public tracking | `alx_web` pages/context/lib | محدود من shipments/orders | read-only token/number | ممنوع PII والحسابات |

## 6. Accounting

| Feature | Files/Services | Data الحالية | Operations | حماية مطلوبة |
|---|---|---|---|---|
| Accounts/tree | `Accounting.tsx`, hierarchy components/services | `accounts`, `acc_main`, `acc_sub`, `acc_sub_group`, currency | read/create/update/classify | role + accounting permissions |
| Entries | `FinanceEntries.tsx`, finance forms | `main_entry`, `account_trans`, payment details | draft/post/reverse/void/replace | atomic RPC، balanced entry، idempotency |
| Account balances | `FinancialAccounting.tsx`, balance services | `account_trans` projection و`accounts.balance` | ledger/reconciliation | لا تعديل من UI مباشرة |
| Auto entries | `AutoVoucherRulesManager`, `autoEntryService` | `auto_entries`, entry types/modules، financial tables | execute/deduplicate | execution key + permissions |
| Custody | financial services | `custody_advances`, payment details، account_trans | create/settle | transaction + idempotency |

لا يستخدم العقد الجديد `journal_entries` أو `account_transactions` أو مفاتيح JSON المالية القديمة إن لم تكن موجودة في المخطط الحالي.

## 7. Notifications / Reports / Settings

- `notificationService` و`Notifications.tsx`: notifications/activity، قراءة وتحديث الحالة؛ المرشح `NotificationsGateway`.
- `Reports.tsx` و`FinanceReports.tsx`: قراءات مركبة من orders/shipments/accounts/transactions؛ المرشح `ReportsQueryGateway` منفصل عن mutation gateways.
- `Settings.tsx` و`WebsiteManagement.tsx`: settings/report settings/templates؛ تحتاج Admin permission وDTO محدود.
- `whatsappService`: side effect خارجي، يجب أن ينتقل إلى `Notification/WhatsApp Application Service` ولا ينفذ من UI مباشرة.

## 8. Server / Jobs / Realtime

`server.ts` يجمع Express، middleware، compatibility adapter، auth/bootstrap، Realtime، reconciliation، custody settlement، activity logs، proxy، وVite serving. يجب تسجيل كل وظيفة تحت Module مستقل قبل نقله إلى `alx_api`.

Realtime الحالي ليس مصدراً مستقلاً للـ business truth. يجب أن يكون كل listener موثقاً بــ trigger وactor وpreconditions وtransaction boundary وidempotency وretry وaudit.

## 9. مصفوفة الأولوية لبناء Gateway

1. `AuthGateway` و`Users/RolesGateway` بسبب الصلاحيات والأسرار.
2. `CustomersGateway` و`StaffGateway` لأنها أبسط من الطلبات والمالية.
3. `ShipmentsGateway` و`TrackingGateway`.
4. `OrdersGateway` بعد تثبيت order party/items/history.
5. `AccountingGateway` بعد توثيق RPCs والـ transaction boundaries.
6. `PortalGateway` بعد تثبيت Public Tracking DTO وحماية PII.

## 10. فجوات تحتاج إكمالاً قبل Contracts

- استخراج أسماء الجداول والـ RPCs من كل service سطرياً، لا من أسماء الملفات فقط.
- تحديد كل Permission لكل mutation.
- تحديد كل side effect لكل operation.
- مطابقة `orders` و`order_items` و`shipments` مع المخطط الحالي field-by-field.
- توثيق RPC المالي: المدخلات، المخرجات، الأخطاء، idempotency، والصلاحيات.
- إعادة اختبار `supabaseReadOnlyVerification` بعد معالجة timeout البيئي.
