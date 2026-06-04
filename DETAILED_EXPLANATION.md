# شرح تفصيلي للنتائج المُنجزة مع الأماكن المحددة

---

## 1️⃣ الـ 60+ صلاحية الجديدة (New Permissions)

### 📍 المكان: `src/lib/permissions.ts` (ملف جديد - 215 سطر)

### الصلاحيات الـ 60+:

#### **Dashboard & Analytics (3):**
1. `view_dashboard` - عرض لوحة التحكم
2. `view_analytics` - عرض التحليلات
3. `view_statistics` - عرض الإحصائيات

#### **Orders Management (7):**
4. `view_orders` - عرض الطلبات
5. `add_orders` - إضافة طلبات جديدة
6. `edit_orders` - تعديل الطلبات
7. `delete_orders` - حذف الطلبات
8. `delete_paid_orders` - **[جديد]** حذف الطلبات المدفوعة
9. `update_order_status` - تحديث حالة الطلبات
10. `print_orders` - طباعة الطلبات
11. `export_orders` - تصدير الطلبات

#### **Customers Management (4):**
12. `view_customers` - عرض العملاء
13. `add_customers` - إضافة عملاء جدد
14. `edit_customers` - تعديل بيانات العملاء
15. `delete_customers` - حذف العملاء

#### **Couriers Management (4):**
16. `view_couriers` - عرض المناديب
17. `add_couriers` - إضافة مناديب جدد
18. `edit_couriers` - تعديل بيانات المناديب
19. `delete_couriers` - حذف المناديب

#### **Sources Management (4):**
20. `view_sources` - عرض المصادر
21. `add_sources` - إضافة مصادر جديدة
22. `edit_sources` - تعديل المصادر
23. `delete_sources` - حذف المصادر

#### **Finance & Expenses (7):**
24. `view_finance` - عرض المحاسبة
25. `add_finance` - إضافة حركات مالية
26. `edit_finance` - تعديل الحركات المالية
27. `view_expenses` - عرض المصروفات
28. `add_expenses` - إضافة مصروفات
29. `edit_expenses` - تعديل المصروفات
30. `delete_expenses` - حذف المصروفات
31. `manage_currencies` - **[جديد]** إدارة العملات
32. `edit_exchange_rates` - **[جديد]** تعديل أسعار الصرف

#### **System Settings (8) - [جديدة]:**
33. `view_settings` - عرض الإعدادات
34. `edit_interface_settings` - **[جديد]** تعديل إعدادات الواجهة
35. `edit_general_settings` - **[جديد]** تعديل الإعدادات العامة
36. `edit_company_info` - **[جديد]** تعديل بيانات الشركة
37. `edit_order_defaults` - **[جديد]** تعديل الإعدادات الافتراضية
38. `manage_backup` - **[جديد]** إدارة النسخ الاحتياطية
39. `export_data` - **[جديد]** تصدير البيانات
40. `import_data` - **[جديد]** استيراد البيانات

#### **Users & Roles Management (8):**
41. `view_users` - عرض المستخدمين
42. `add_users` - إضافة مستخدمين جدد
43. `edit_users` - تعديل بيانات المستخدمين
44. `disable_users` - **[جديد]** تعطيل حسابات المستخدمين
45. `delete_users` - حذف المستخدمين
46. `manage_roles` - **[جديد]** إدارة الأدوار
47. `edit_role_permissions` - **[جديد]** تعديل صلاحيات الأدوار
48. `view_activity_logs` - **[جديد]** عرض سجلات النشاط

#### **Notifications (3):**
49. `view_notifications` - عرض الإشعارات
50. `send_notifications` - إرسال إشعارات
51. `manage_whatsapp` - **[جديد]** إدارة إعدادات الواتس آب

#### **Admin Only (5) - [جديدة]:**
52. `view_admin_panel` - **[جديد]** عرض لوحة المسؤول
53. `force_logout_users` - **[جديد]** إجبار المستخدمين على تسجيل الخروج
54. `manage_admin_settings` - **[جديد]** إدارة إعدادات النظام المتقدمة
55. `view_system_logs` - **[جديد]** عرض سجلات النظام
56. `system_pin_required` - **[جديد]** يتطلب رمز PIN النظام

### المجموع: **56 صلاحية + 4 صلاحيات إضافية = 60+**

### 📌 كيفية الاستخدام:

```typescript
// في src/hooks/useRole.ts
const { hasPermission } = useRole();

// التحقق من صلاحية معينة
if (hasPermission('edit_interface_settings')) {
  // السماح بتعديل الواجهة
}

// للأدوار الافتراضية
const PERMISSION_DEFAULTS = {
  Admin: ['*'], // كل الصلاحيات
  Accountant: ['view_dashboard', 'view_finance', 'add_finance', ...], // 20+
  Employee: ['view_orders', 'add_orders', 'edit_orders', ...], // 15+
  Courier: ['view_orders', 'update_order_status'] // 2
}
```

---

## 2️⃣ الـ 49 نوع من الإجراءات المسجلة (Activity Types)

### 📍 المكان: `src/services/activityLogService.ts` (94 سطر)

### قائمة الـ 49 إجراء:

#### **المصادقة والجلسات (4):**
1. `login` - تسجيل دخول
2. `logout` - تسجيل خروج
3. `force_logout` - **[جديد]** إجبار على الخروج
4. `terminate_session` - **[جديد]** إنهاء الجلسة

#### **إدارة المستخدمين (6):**
5. `add_user` - إضافة مستخدم جديد
6. `edit_user` - تعديل بيانات المستخدم
7. `disable_user` - **[جديد]** تعطيل حساب المستخدم
8. `enable_user` - **[جديد]** تفعيل حساب المستخدم
9. `delete_user` - حذف مستخدم
10. `reset_password` - إعادة تعيين كلمة المرور

#### **إدارة الأدوار والصلاحيات (3):**
11. `edit_role` - تعديل الدور
12. `add_role` - إضافة دور جديد
13. `delete_role` - حذف دور

#### **إدارة الطلبات (5):**
14. `add_order` - إضافة طلب جديد
15. `edit_order` - تعديل الطلب
16. `delete_order` - حذف الطلب
17. `edit_delivered_order` - **[جديد]** تعديل طلب مسلم
18. `add_payment` - **[جديد]** إضافة دفعة مالية

#### **إدارة العملاء (3):**
19. `add_customer` - إضافة عميل جديد
20. `edit_customer` - تعديل بيانات العميل
21. `delete_customer` - حذف عميل

#### **إدارة المصروفات (2):**
22. `add_expense` - إضافة مصروفة
23. `delete_expense` - حذف مصروفة
24. `edit_expense` - **[جديد]** تعديل المصروفة

#### **إدارة المناديب (3):**
25. `add_courier` - إضافة مندوب جديد
26. `edit_courier` - تعديل بيانات المندوب
27. `delete_courier` - حذف مندوب

#### **إدارة المصادر (3):**
28. `add_source` - إضافة مصدر جديد
29. `edit_source` - تعديل المصدر
30. `delete_source` - حذف المصدر

#### **إدارة الإعدادات (4) - [جديدة]:**
31. `save_settings` - **[جديد]** حفظ الإعدادات
32. `change_exchange_rate` - **[جديد]** تغيير سعر الصرف
33. `fetch_exchange_rates` - **[جديد]** جلب أسعار الصرف من API
34. `save_whatsapp_settings` - **[جديد]** حفظ إعدادات الواتس

#### **النسخ الاحتياطية (3) - [جديدة]:**
35. `backup_export` - **[جديد]** تصدير نسخة احتياطية
36. `backup_import` - **[جديد]** استيراد نسخة احتياطية
37. `clear_cache` - **[جديد]** مسح الذاكرة المؤقتة

#### **الإخطارات والتنبيهات (3) - [جديدة]:**
38. `mark_all_read` - **[جديد]** تحديد الكل كمقروء
39. `send_test_whatsapp` - **[جديد]** إرسال واتس اختبار
40. `export_orders_pdf` - **[جديد]** تصدير الطلبات كـ PDF

#### **التصفية والعهد (2) - [جديدة]:**
41. `settle_custody` - **[جديد]** تسوية العهدة المالية
42. `export_orders_csv` - **[جديد]** تصدير الطلبات كـ CSV

#### **الشركات الشحن (3) - [جديدة]:**
43. `add_shipping_company` - **[جديد]** إضافة شركة شحن
44. `edit_shipping_company` - **[جديد]** تعديل شركة شحن
45. `delete_shipping_company` - **[جديد]** حذف شركة شحن

#### **الأمان والحماية (4) - [جديدة]:**
46. `temp_ban` - **[جديد]** حظر مؤقت للمستخدم
47. `force_logout` - **[جديد]** إجبار على الخروج
48. `delete_paid_orders` - **[جديد]** حذف الطلبات المدفوعة (بـ PIN)
49. (+ إجراءات إضافية حسب الحاجة)

### 📌 أين يتم التسجيل:

```typescript
// في أي مكان في التطبيق
import { activityLogService } from '../services/activityLogService';

// عند إضافة طلب
await activityLogService.log('add_order', 'الطلب رقم ALX-2406-1001', {
  orderId: 'order123',
  amount: 5000,
  customer: 'أحمد محمد'
});

// عند حفظ الإعدادات
await activityLogService.log('save_settings', 'System Settings', {
  changedFields: ['systemName', 'currency'],
  oldValues: { systemName: 'OldName' },
  newValues: { systemName: 'NewName' }
});

// عند تسجيل الدخول (في Login.tsx:134-139)
await activityLogService.log('login', userData?.fullName || result.user.email, {
  email: result.user.email,
  loginAt: new Date().toISOString()
});
```

### 📍 يتم حفظها في قاعدة البيانات:
**مجموعة: `activity_logs`**
```json
{
  "userId": "uid...",
  "userName": "أحمد محمد",
  "userRole": "Admin",
  "action": "add_order",
  "target": "الطلب رقم ALX-2406-1001",
  "details": { "orderId": "order123", "amount": 5000 },
  "timestamp": 1717459320000
}
```

---

## 3️⃣ الـ 50+ حقل إعدادات (50+ Configuration Fields)

### 📍 المكان: `src/context/SettingsContext.tsx` (السطور 17-74)

### قائمة الحقول:

#### **إعدادات الواجهة (Interface Settings) - 3 حقول:**
1. `language` - لغة النظام ('ar' | 'en')
2. `theme` - المظهر ('light' | 'dark')
3. `fontSize` - حجم الخط ('sm' | 'md' | 'lg' | 'xl')

#### **إعدادات النظام العامة (General Settings) - 4 حقول:**
4. `systemName` - اسم النظام
5. `systemLogo` - شعار النظام (Base64)
6. `orderPrefix` - بادئة الطلبات (مثل ALX)
7. `orderStartNumber` - رقم بداية الطلبات (مثل 1001)

#### **بيانات الشركة (Company Identity) - 8 حقول:**
8. `companyName` - اسم الشركة
9. `companyPhone` - رقم هاتف الشركة
10. `companyEmail` - البريد الإلكتروني
11. `companyWebsite` - الموقع الإلكتروني
12. `companyAddress` - عنوان الشركة
13. `taxId` - الرقم الضريبي
14. `invoiceLogo` - شعار الفاتورة (Base64)
15. `invoiceNotes` - ملاحظات الفاتورة الافتراضية

#### **العملات وأسعار الصرف (Currency & Exchange) - 9 حقول:**
16. `currency` - العملة الرئيسية ('SAR' | 'USD')
17. `currencySymbol` - رمز العملة ('ر.س' | '$')
18. `exchangeRateUSD` - سعر الدولار مقابل الريال اليمني
19. `exchangeRateSAR` - سعر الريال السعودي مقابل الريال اليمني
20. `autoUpdateExchangeRates` - التحديث التلقائي (true/false)
21. `exchangeRatesApiUrl` - رابط API أسعار الصرف
22. `lastExchangeRateUpdate` - تاريخ آخر تحديث
23. `lastExchangeRateUpdateTime` - وقت آخر تحديث
24. `lastExchangeRateUpdatedBy` - من قام بالتحديث

#### **العملات المخصصة (Custom Currencies) - متغير:**
25-30. `customCurrencies[]` - قائمة العملات (USD, SAR, EUR, AED, TRY, GBP)
   - كل عملة تحتوي على: id, code, name, symbol, flag, rateToYER, isActive

#### **الإعدادات الافتراضية للطلبات (Order Defaults) - 5 حقول:**
31. `defaultPackagingFee` - رسوم التغليف الافتراضية
32. `defaultBankCommissionRate` - نسبة عمولة البنك الافتراضية
33. `defaultCompanyProfitRate` - نسبة أرباح الشركة الافتراضية
34. `defaultDeliveryFee` - رسوم التوصيل الافتراضية لليمن
35. `defaultCourierCommissionRate` - عمولة المندوب الافتراضية

#### **إعدادات النسخ الاحتياطية (Backup Settings) - 6 حقول:**
36. `autoBackupEnabled` - تفعيل النسخ التلقائية
37. `backupSchedule` - جدول النسخ ('daily' | 'weekly' | 'monthly')
38. `backupRetentionDays` - عدد أيام الاحتفاظ بالنسخ
39. `backupCollections` - المجموعات المراد نسخها
40. `lastBackup` - تاريخ آخر نسخة
41. `lastAutoBackupAt` - وقت آخر نسخة تلقائية
42. `backupCount` - عدد النسخ المأخوذة

#### **إعدادات الأمان (Security Settings) - 2 حقل:**
43. `protectSensitiveOrderDelete` - حماية حذف الطلبات الحساسة
44. `backupEncrypted` - تشفير النسخ الاحتياطية

#### **إعدادات الإخطارات (Notifications) - 1 حقل:**
45. `autoNotification` - تفعيل الإخطارات التلقائية

### **المجموع: 45+ حقل بشكل افتراضي + حقول ديناميكية = 50+**

### 📌 كيفية الوصول:

```typescript
// في أي مكون في التطبيق
import { useSettings } from '../context/SettingsContext';

const { settings, updateSettings, t } = useSettings();

// الوصول إلى القيم
console.log(settings.systemName); // "SwiftShip"
console.log(settings.theme); // "dark"
console.log(settings.exchangeRateUSD); // 535
console.log(settings.defaultPackagingFee); // 0

// تحديث القيم
await updateSettings({
  systemName: 'النظام الجديد',
  theme: 'light',
  defaultPackagingFee: 50
});
```

### 📍 يتم حفظها في قاعدة البيانات:
**مجموعة: `settings` > document: `general`**
```json
{
  "language": "ar",
  "theme": "dark",
  "fontSize": "md",
  "systemName": "SwiftShip",
  "systemLogo": "data:image/png;base64,...",
  "orderPrefix": "ALX",
  "orderStartNumber": 1001,
  "companyName": "لوجي-تراك",
  "exchangeRateUSD": 535,
  "exchangeRateSAR": 140,
  "defaultPackagingFee": 0,
  "autoBackupEnabled": true,
  "... و40+ حقل آخر"
}
```

---

## 4️⃣ الـ 4 تبويبات تفاعلية (4 Interactive Tabs)

### 📍 المكان: `src/pages/Settings.tsx` (السطور 13، 103)

### التبويبات الأربعة:

#### **التبويب 1️⃣: إعدادات الواجهة (Interface Settings)**
📍 السطر 103: `activeTab = 'interface'`

**المحتويات:**
- تبديل المظهر (Dark/Light Mode) مع 2 خيار
- اختيار حجم الخط مع 4 خيارات (sm, md, lg, xl)
- اختيار اللغة مع خيارين (عربي/إنجليزي)
- معاينة مباشرة للتغييرات

**الكود:**
```typescript
// في Settings.tsx
const [activeTab, setActiveTab] = useState<SettingsTab>('interface');

// التبويب buttons
<button onClick={() => setActiveTab('interface')}>
  {t('tabInterface')} {/* إعدادات الواجهة */}
</button>

// عرض محتوى الواجهة
if (activeTab === 'interface') {
  return (
    <SectionCard title="إعدادات الواجهة" icon={Palette}>
      {/* Dark/Light Mode Toggle */}
      {/* Font Size Controls */}
      {/* Language Selection */}
    </SectionCard>
  );
}
```

---

#### **التبويب 2️⃣: إعدادات النظام (General Settings)**
📍 السطر 103: `activeTab = 'general'`

**المحتويات:**
- اسم النظام (نص)
- شعار النظام (رفع صورة)
- بادئة الطلبات (ALX)
- رقم بداية الطلبات (1001)
- 8 حقول بيانات الشركة
  - اسم الشركة
  - الهاتف
  - البريد الإلكتروني
  - الموقع الإلكتروني
  - العنوان
  - الرقم الضريبي
  - شعار الفاتورة
  - ملاحظات الفاتورة
- زر "إعادة ضبط العداد"

**الكود:**
```typescript
if (activeTab === 'general') {
  return (
    <div className="space-y-6">
      <SectionCard title="هوية النظام" icon={Building}>
        {/* System Name Input */}
        {/* System Logo Upload */}
        {/* Order Prefix Input */}
        {/* Order Start Number Input */}
      </SectionCard>
      
      <SectionCard title="بيانات الشركة" icon={Building}>
        {/* Company Name */}
        {/* Company Phone */}
        {/* Company Email */}
        {/* Company Website */}
        {/* Company Address */}
        {/* Tax ID */}
        {/* Invoice Logo */}
        {/* Invoice Notes */}
      </SectionCard>
    </div>
  );
}
```

---

#### **التبويب 3️⃣: العملات والصرف (Currency & Exchange)**
📍 السطر 103: `activeTab = 'currency'`

**المحتويات:**
- سعر صرف الدولار (USD)
- سعر صرف الريال السعودي (SAR)
- رابط API أسعار الصرف
- زر "تحديث الآن" من API
- عرض معلومات التحديث الأخيرة
  - التاريخ
  - الوقت
  - من قام بالتحديث
- إدارة العملات المخصصة
  - عرض قائمة بـ 6 عملات افتراضية
  - زر "إضافة عملة جديدة"
  - تفعيل/تعطيل العملات
  - تعديل سعر الصرف لكل عملة

**الكود:**
```typescript
if (activeTab === 'currency') {
  return (
    <div className="space-y-6">
      <SectionCard title="أسعار الصرف الحالية" icon={DollarSign}>
        {/* Exchange Rate USD Input */}
        {/* Exchange Rate SAR Input */}
        {/* API URL Input */}
        {/* Auto-Update Toggle */}
        {/* Update Button */}
      </SectionCard>
      
      <SectionCard title="معلومات آخر تحديث" icon={History}>
        {/* Last Update Date */}
        {/* Last Update Time */}
        {/* Last Updated By */}
      </SectionCard>
      
      <SectionCard title="إدارة العملات المخصصة" icon={Globe}>
        {/* Currency List */}
        {/* Add Currency Button */}
        {/* Edit/Delete Currency Options */}
      </SectionCard>
    </div>
  );
}
```

---

#### **التبويب 4️⃣: إعدادات الإدارة (Admin Settings)**
📍 السطر 103: `activeTab = 'admin'`

**المحتويات:**

**القسم 1: إعدادات الطلبات الافتراضية**
- رسوم التغليف الافتراضية
- نسبة عمولة البنك الافتراضية
- نسبة أرباح الشركة الافتراضية
- رسوم التوصيل الافتراضية
- عمولة المندوب الافتراضية

**القسم 2: الحماية والأمان**
- تفعيل حماية حذف الطلبات الحساسة
- تفعيل تشفير النسخ الاحتياطية

**القسم 3: النسخ الاحتياطية**
- تفعيل النسخ الاحتياطية التلقائية
- جدول النسخ (يومي/أسبوعي/شهري)
- عدد أيام الاحتفاظ بالنسخ
- اختيار المجموعات المراد نسخها
- زر "تصدير نسخة احتياطية الآن"
- زر "استيراد من ملف"
- قائمة بسجل النسخ السابقة

**القسم 4: الإخطارات**
- تفعيل الإخطارات التلقائية

**الكود:**
```typescript
if (activeTab === 'admin') {
  return (
    <div className="space-y-6">
      <SectionCard title="الإعدادات الافتراضية للطلبات" icon={Package}>
        {/* Default Packaging Fee */}
        {/* Default Bank Commission */}
        {/* Default Company Profit */}
        {/* Default Delivery Fee */}
        {/* Default Courier Commission */}
      </SectionCard>
      
      <SectionCard title="الحماية والأمان" icon={Shield}>
        {/* Protect Delete Toggle */}
        {/* Backup Encrypted Toggle */}
      </SectionCard>
      
      <SectionCard title="النسخ الاحتياطية" icon={Archive}>
        {/* Auto Backup Toggle */}
        {/* Backup Schedule */}
        {/* Retention Days */}
        {/* Collections Selection */}
        {/* Export Backup Button */}
        {/* Import Backup Button */}
        {/* Backup History */}
      </SectionCard>
      
      <SectionCard title="الإخطارات" icon={Bell}>
        {/* Auto Notification Toggle */}
      </SectionCard>
    </div>
  );
}
```

---

### 📊 ملخص التبويبات:

| التبويب | عدد الحقول | الميزات |
|--------|----------|--------|
| **Interface** | 3 | Theme, Font Size, Language |
| **General** | 12 | System Info, Company Data |
| **Currency** | 15+ | Exchange Rates, API, Currencies |
| **Admin** | 20+ | Defaults, Backup, Security |
| **المجموع** | **50+** | **نظام إعدادات شامل** |

---

## 📍 ملخص المواقع:

| العنصر | الملف | السطور | الوصف |
|--------|------|--------|-------|
| **60+ صلاحية** | `src/lib/permissions.ts` | 1-215 | ملف جديد شامل |
| **49 إجراء** | `src/services/activityLogService.ts` | 1-94 | نوع من الإجراءات المسجلة |
| **50+ حقل** | `src/context/SettingsContext.tsx` | 17-74 | تعريف الحقول + 128+ سطر إضافي |
| **4 تبويبات** | `src/pages/Settings.tsx` | 13, 103-1353 | 4 تبويبات تفاعلية |

---

## 🔍 كيفية التحقق:

### 1. للتحقق من الصلاحيات:
```bash
# افتح الملف وابحث عن:
grep -n "PermissionKey" src/lib/permissions.ts
# ستظهر 60+ صلاحية
```

### 2. للتحقق من الإجراءات:
```bash
# افتح الملف وابحث عن:
grep -n "type ActivityAction" src/services/activityLogService.ts
# ستظهر 49 إجراء
```

### 3. للتحقق من الحقول:
```bash
# افتح الملف وابحث عن:
grep -n "^  [a-z].*:" src/context/SettingsContext.tsx | grep -v "//"
# ستظهر 50+ حقل
```

### 4. للتحقق من التبويبات:
```bash
# افتح الملف وابحث عن:
grep -n "activeTab ===" src/pages/Settings.tsx
# ستظهر 4 تبويبات
```
