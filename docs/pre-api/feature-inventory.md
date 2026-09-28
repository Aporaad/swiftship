# Feature Inventory — الجرد الأولي قبل API

**التاريخ:** 2026-09-28
**الحالة:** محدث للمرحلة 2؛ يحتاج الجرد السطري التفصيلي للصفحات Legacy قبل المرحلة 3

## 1. مصادر الجرد

- `src/pages`
- `src/components`
- `src/services`
- `src/lib`
- `server.ts` و`server/`
- `supabase/migrations/`
- `alx_web/src`
- `alx_api/alx_api_creation_plan_ar.md`

## 2. مصفوفة الميزات الأولية

| Feature | صفحات/مكونات ظاهرة | خدمات مرتبطة ظاهرياً | نطاق البيانات | مستوى الخطر | الإجراء التالي |
|---|---|---|---|---:|---|
| Auth/Users/Roles | `Login.tsx`, `Users.tsx`, `UserManagement.tsx`, `Roles.tsx` | `permissions.ts`, adapter auth | users, roles, sessions | حرج | تثبيت AuthSession وPermission contracts |
| Browser | `BrowserViewer.tsx` | browser/proxy flows | proxy configuration, browsing session state | مرتفع | فصل التصفح الداخلي عن بيانات الأعمال |
| Customers | `Customers.tsx`, entity components | customer flows داخل adapter/services | customers, accounts, portal links | مرتفع | استخراج Customer DTO/Gateway |
| Orders | `Orders.tsx`, `src/components/orders` | `orderLifecycleService`, `orderPartyService`, `orderDeletionService`, `orderHistoryService`, `orderPaymentDataService` | orders, order_items, order_party, history, products | حرج | رسم Data Access وSide Effects قبل النقل |
| Products | مكونات المنتجات والتصنيفات | `productService` | products, items_category, order_items | مرتفع | تثبيت مصدر الحقيقة وعقود الحركة |
| Returns | مكونات المرتجعات | `returnedProductService` | returned_products, order_items, orders | مرتفع | تنسيقها عبر Products وOrders دون Feature مستقل |
| Sources | مكونات مصادر الطلب والشحن والأصول | source/shipping/asset services | sources, shipping_companies, assets, accounts | مرتفع | تثبيت الحساب المرتبط وعقود المصدر |
| Shipments/Tracking | `Tracking.tsx`, `src/components/shipments` | shipping/tracking flows | shipments, couriers, shipping companies | مرتفع | Portal/Public Tracking DTO |
| Accounting | `Accounting.tsx`, `FinanceAccounting.tsx` | `financialAccountService`, accounting hierarchy/currency/custody/expense services | accounts, account hierarchy, currency, custody, expense data | حرج | تحديد read models وحدود الحسابات والمصروفات |
| FinanceEntries | `FinanceEntries.tsx`, finance entry components | `financialEntryService`, entry/payment/voucher services | main_entry, account_trans, entry_payment_details, auto_entries, orders_history | حرج | لا نقل قبل RPC/transaction/idempotency map |
| Dashboard/Reports | `Dashboard.tsx`, `Reports.tsx`, finance reports | balance/report services | projections, ledger, reports | مرتفع | فصل read models عن mutations |
| Notifications/WhatsApp | `Notifications.tsx` | `notificationService`, `whatsappService` | notifications, whatsapp logs, activity | متوسط | Event/side-effect contract |
| Settings | `Settings.tsx`, `WebsiteManagement.tsx` | settings-related services | settings, report settings, templates | متوسط | تحديد admin permissions |
| SiteManagement | `WebsiteManagement.tsx` | website management services | website settings, content, templates | مرتفع | فصل إدارة موقع الشركة عن Settings العامة |
| Portal | `alx_web/src/pages`, `alx_web/src/components` | portal context/lib | portal_users, tickets, public tracking | حرج | إزالة القراءة المباشرة تدريجياً |
| Server Jobs/Proxy | `server.ts`, `server/` tests | heartbeat, reconciliation, wiring | realtime, accounting, logs, proxy | حرج | تفكيك server.ts بعد تثبيت العقود |

## 3. الملفات Legacy المؤكدة مبدئياً

- `src/pages/Orders.tsx.bak`
- `src/components/ChartOfAccounts.tsx.bak`
- `src/services/autoEntryRules.ts.bak`
- `src/services/financialAccountService.ts.bak`
- `vite.config.ts.bak`
- `.firebase-cleanup-backup/`
- أي Adapter أو import Firebase-like يجب تصنيفه قبل حذفه، ولا يحذف في هذه المرحلة.

## 4. مصفوفة العمليات التي تحتاج تدقيقاً سطرياً

| العملية | الآثار المحتملة التي يجب إثباتها |
|---|---|
| إنشاء طلب | order، items، order party، history، shipment اختياري، payment اختياري، activity/notification |
| تعديل حالة الطلب | transition، history، automatic financial entry، notification، shipment effects |
| حذف الطلب | dependents، history، financial links، atomic RPC، cache invalidation |
| تسجيل دفعة | payment details، main entry، account trans، order projection، history، idempotency |
| إنشاء/تسوية عهدة | custody advance، payment details، account trans، reconciliation، audit |
| إنشاء شحنة/تحديثها | shipment، tracking، history، courier/shipping company، notifications |
| إرجاع منتج | returned_products، order item status، refund/insurance policy، history، financial effect |
| إدارة المستخدمين | users، roles، sessions، permissions، audit، portal mapping |

## 5. الحقول المطلوبة لكل سجل نهائي

يستكمل الجرد التالي لكل Page/Service قبل بداية المرحلة التالية: Feature، Client، Page، Components، Services، Tables، Operations، Auth requirement، Permission، Side effects، Transaction need، API endpoint candidate، والاختبارات الحالية.
