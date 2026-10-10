# خطة التنفيذ الدقيقة — اكمال API Migration لـ SwiftShip
**التاريخ:** 2026-10-10  
**المنفذ:** Claude Sonnet 4.6 (Thinking) / Antigravity

---

## الوضع الراهن (من جرد المحادثة السابقة)

### ما تم إنجازه ✅
1. **Settings/Currency API** → تم نقل `SettingsContext.tsx` و`currencyService.ts` إلى HTTP Gateway
2. **طبقة `legacy-compat.ts`** → تم تطهير عدة hooks وservices (useOrderStatuses, useItemCategories, useAccountBalances, useRole, orderDeletionService, productService, etc.)
3. **بوابات HTTP** → couriers, customers, sources, users, finance, orders

### ما لا يزال باقياً ❌

#### ملفات `.tsx` تستورد `legacy-compat` (44 ملفاً)
أولوية تنفيذية P0:
- `src/features/orders/services/legacyOrdersApi.ts` — يستورد legacy-compat مباشرة  
- `src/components/financeAccounting/FinanceAccountingDataGateway.ts` — fallback للـ legacy
- `src/components/financeAccounting/financeAccountingMainEntryActions.ts`

أولوية P1 (مكونات الطلبات والكيانات):
- `src/components/orders/EditOrderModal.tsx`
- `src/components/orders/OrderDetailsModal.tsx`  
- `src/components/orders/ProductsManagementTab.tsx`
- `src/components/orders/ProductPickerModal.tsx`
- `src/components/shipments/ShipmentFormModal.tsx`
- `src/components/entities/CourierCreateModal.tsx`
- `src/components/entities/CustomerCreateModal.tsx`
- `src/components/entities/EmployeeCreateModal.tsx`
- `src/components/entities/ShippingCompanyCreateModal.tsx`
- `src/components/entities/SourceCreateModal.tsx`

أولوية P1 (صفحات الميزات):
- `src/features/orders/pages/subcomponents/OrdersPageShell.tsx`
- `src/features/orders/hooks/useOrderData.ts` ← يعتمد على legacyOrdersApi
- `src/features/couriers/pages/CouriersPage.tsx`
- `src/features/customers/pages/CustomersPage.tsx`
- `src/features/employees/pages/EmployeesPage.tsx`
- `src/features/roles/pages/RolesPage.tsx`
- `src/features/sources/pages/SourcesPage.tsx`
- `src/features/users/pages/UsersPage.tsx`
- `src/features/users/pages/UserManagementPage.tsx`
- `src/features/settings/pages/SettingsPage.tsx`

أولوية P2 (تحسينات وإزالة fallback):
- تطهير باقي المكونات
- إزالة fallback من FinanceApiDataGateway

---

## خطة التنفيذ المرحلية

### المرحلة الأولى: تطهير طبقة Orders (أولوية P0)
1. استبدال `legacyOrdersApi.ts` بـ HTTP API implementation
2. تحديث `useOrderData.ts` لاستخدام الـ HTTP API implementation الجديد
3. تطهير `OrdersPageShell.tsx` من legacy-compat imports

### المرحلة الثانية: تطهير مكونات الكيانات (P1)
4. تطهير `CourierCreateModal.tsx`, `CustomerCreateModal.tsx`, `EmployeeCreateModal.tsx`
5. تطهير `ShippingCompanyCreateModal.tsx`, `SourceCreateModal.tsx`
6. تطهير `EditOrderModal.tsx`, `OrderDetailsModal.tsx`
7. تطهير `ProductsManagementTab.tsx`, `ProductPickerModal.tsx`, `ShipmentFormModal.tsx`

### المرحلة الثالثة: تطهير صفحات الميزات (P1)
8. تطهير باقي الصفحات من legacy-compat imports
9. إزالة fallback من FinanceApiDataGateway
10. تشغيل `npx tsc --noEmit` وإصلاح أي أخطاء
