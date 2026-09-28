# Complete `src/` Inventory — المرحلة 2

**التاريخ:** 2026-09-28
**الحالة:** جرد موثق للمناطق الرئيسية والفرعية تحت `src`; لا يوجد نقل أو حذف لمكونات Legacy.

## 1. مناطق src

| المنطقة | الملفات/المكونات المرصودة | Feature owner |
|---|---|---|
| `src/pages` | `Accounting.tsx`, `BrowserViewer.tsx`, `Couriers.tsx`, `Customers.tsx`, `Dashboard.tsx`, `Employees.tsx`, `FinanceEntries.tsx`, `Login.tsx`, `Notifications.tsx`, `Orders.tsx`, `Reports.tsx`, `Roles.tsx`, `SalaryHistory.tsx`, `Settings.tsx`, `Sources.tsx`, `Tracking.tsx`, `UserManagement.tsx`, `Users.tsx`, `WebsiteManagement.tsx` | `BrowserViewer` يملكها `browser`، و`WebsiteManagement` يملكها `siteManagement`، بينما `SalaryHistory` تبقى Legacy حتى تصنيفها النهائي |
| `src/components` | `AccountingHierarchyManagement`, `AssetsPortfolio`, `AutoEntry*`, `ChartOfAccounts`, `ExpenseCategoriesManager`, `FinanceAccounting`, `FinanceReports`, `GlobalEntityLedgerModal`, `OrderStatusManagementTab`, `Layout`, modals العامة، ومجلدات `common`, `entities`, `finance`, `orders`, `shipments` | `accounting`, `financeEntries`, `products`, `orders`, `shipments`, `sources` |
| `src/services` | accounting hierarchy/tree/currency/financial services، `financialEntry*`، `itemCategoryService`, notification/WhatsApp، order lifecycle/party/history/payment/deletion، portal، product/returned product | يوزع حسب Feature؛ لا تنقل خدمة إلى Feature قبل تثبيت حدودها وآثارها |
| `src/hooks` | `useAccountBalances`, `useAutoVoucherRules`, `useExchangeRates`, `useExpenseCategories`, `useItemCategories`, `useOrderOptions`, `useOrderStatuses`, `useRole` | `accounting`, `financeEntries`, `products`, `orders`, `roles` |
| `src/lib` | `dateUtils`, `numberToWords`, `permissions`, `printUtils`, `sanitizeConsole`, `supabase-adapter`, `supabase` واختبارات العقود | shared/legacy data access؛ لا تنقل إلى Feature component |
| `src/context` | `SettingsContext.tsx` | `settings` |
| `src/reports` | `OrderInvoicePrint`, `OrdersExport`, `index` | `reports` |
| `src/utils` | `passwordUtils.ts` | `auth`/security؛ يبقى خارج UI |
| `src/features` | `auth`, `browser`, `users`, `roles`, `customers`, `orders`, `products`, `sources`, `shipments`, `couriers`, `employees`, `accounting`, `financeEntries`, `notifications`, `reports`, `siteManagement`, `settings` | Feature boundaries الجديدة |

## 2. التفاصيل الفرعية المهمة

### FinanceEntries

المكونات `CompoundEntriesTab`, `GeneralEntriesTab`, `TemporaryEntriesTab`, `PaymentVouchersTab`, `ReceiptVouchersTab`, `EntryForm`, `EntryDetailsModal`, `EntrySettingsTab`, `EntryWorkspaceTab`, `AccountMovementTab`, و`CustodyAdvancesTab` مملوكة لـ`financeEntries`. لا تدمج داخل `accounting`.

### Accounting

`AccountingHierarchyManagement`, `ChartOfAccounts`, `FinanceAccounting`, `ExpenseCategoriesManager`, `useAccountBalances`, `useExchangeRates`, `useExpenseCategories` مملوكة لـ`accounting`. المصروفات تحت `accounting/expenses` وليست Feature مستقلاً.

### Products وSources

`ProductsManagementTab`, `ProductPickerModal`, `ItemCategoriesManagementTab`, `productService`, `returnedProductService`, و`useItemCategories` مملوكة لـ`products`. أما `Sources.tsx` وواجهات شركات الشحن والأصول ومصادر الطلب فمملوكة لـ`sources`، مع مرجع الحساب المالي من `accounting`.

### Orders وShipments

`CreateOrderModal`, `EditOrderModal`, `OrderDetailsModal`, `OrderHistoryModal`, `OrderPartyPicker`, `PaymentModal`, `UpdateStatusModal`, `orderLifecycleService`, `orderPartyService`, `orderHistoryService`, `orderPaymentDataService` مملوكة لـ`orders`. `ShipmentFormModal`, `Tracking.tsx` ومسارات التتبع مملوكة لـ`shipments`.

## 3. Legacy والنسخ الاحتياطية

الملفات المرصودة مثل `Orders.tsx.bak`, `ChartOfAccounts.tsx.bak`, `CreateOrderModal.tsx.bak`, `autoEntryRules.ts.bak`, `financialAccountService.ts.bak` تبقى غير تشغيلية ولا تحذف ضمن المرحلة 2. `supabase-adapter.ts` و`supabase.ts` يبقيان في طبقة Legacy/Data الحالية إلى أن تبدأ المرحلة 3 رسمياً.

## 4. قاعدة المراحل التالية

كل خطوة لاحقة يجب أن تبدأ بإعادة فحص هذا الجرد ومقارنة أي ملف جديد أو متغير تحت `src/` مع Feature owner. يمنع اعتماد الجرد على الأقسام الأساسية فقط، ويمنع نقل أو حذف أي مكوّن غير مصنف. لا يوجد `src/features/expenses`; يوجد فقط `src/features/accounting/expenses`.
