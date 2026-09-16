# خطة إعادة التسمية الشاملة للنظام (Naming Convention Refactoring)

## نظرة عامة

المهمة تتطلب تطبيق قواعد تسمية موحدة على مستويين:
- **قاعدة البيانات (Supabase):** `snake_case` لكل الحقول، والـ Primary Key يكون `{table_singular}_id`
- **كود النظام (TypeScript/React):** `camelCase` لكل متغيرات وخصائص النظام

---

## ⚠️ تحذيرات مهمة قبل المراجعة

> [!CAUTION]
> هذا العمل يؤثر على **51 جدولاً** في قاعدة البيانات الحية، و**65+ دالة/trigger**، وأكثر من **40 ملف TypeScript** بحجم يصل إلى 74K سطر. أي خطأ يمكن أن يتسبب في فقدان بيانات أو توقف النظام.

> [!WARNING]
> الجداول التالية تحتوي على **Primary Keys غير قياسية** تستخدمها مئات من Foreign Keys:
> - `currency` → PK: `cur_id` (يُستخدم في 10+ جداول)
> - `products` → PK: `product_id` (صحيح بالفعل، لكن العلاقات تحتاج مراجعة)
> - `order_items` → PK: `items_id` (يحتاج إعادة تسمية إلى `order_item_id`)
> - `returned_products` → PK: `return_id` (يحتاج إعادة تسمية إلى `returned_product_id`)

> [!IMPORTANT]
> يوجد **65+ دالة PostgreSQL** معقدة مرتبطة بالحقول. إعادة تسمية الحقول تستلزم إعادة كتابة جسم هذه الدوال كاملاً، مما يستغرق وقتاً طويلاً جداً.

---

## مراجعة مطلوبة من المستخدم

> [!IMPORTANT]
> **قرار حاسم:** بسبب الحجم الهائل للعمل والمخاطر العالية، أحتاج موافقتك على أحد الخيارين:
>
> **الخيار A - تغيير شامل كامل (High Risk, High Effort)**
> - تعديل جميع الحقول في DB + كل الكود
> - الوقت المتوقع: 8-12 ساعة عمل
> - خطر توقف النظام أثناء الترحيل
>
> **الخيار B - تغيير تدريجي (Recommended)**
> - المرحلة 1: إصلاح فقط الحقول المخالفة (camelCase في DB)
> - المرحلة 2: تحديث الكود لمواكبة الأسماء الجديدة
> - أكثر أماناً وقابلاً للاختبار

---

## التحليل: الحقول المخالفة للقواعد

### في قاعدة البيانات (يجب تحويلها إلى snake_case)

| الجدول | الحقل الحالي | الاسم الجديد |
|--------|-------------|-------------|
| **acc_main** | `id` | `acc_main_id` |
| **acc_sub** | `id` | `acc_sub_id` |
| **acc_sub_group** | `id` | `acc_sub_group_id` |
| **account** | `id` | `account_id` |
| **account_id_migration_map** | `id` | `account_migration_id` |
| **account_trans** | `id` | `account_trans_id` |
| **accounts** | `id` | `account_id` ⚠️ (تعارض مع العمود الموجود!) |
| **accounts** | `createdAt` | `created_at` |
| **accounts** | `updatedAt` | `updated_at` |
| **accounts** | `lastRecalculatedAt` | `last_recalculated_at` |
| **activity_logs** | `id` | `activity_log_id` |
| **activity_logs** | `userId` | `user_id` |
| **activity_logs** | `createdAt` | `created_at` |
| **announcements** | `id` | `announcement_id` |
| **announcements** | `isActive` | `is_active` |
| **announcements** | `createdBy` | `created_by` |
| **announcements** | `createdAt` | `created_at` |
| **assets** | `id` | `asset_id` |
| **assets** | `assetCode` | `asset_code` |
| **auto_entries** | `id` | `auto_entry_id` |
| **browser_pages** | `id` | `browser_page_id` |
| **couriers** | `id` | `courier_id` |
| **cur_price** | `id` | `cur_price_id` ✅ (موجود كـ sequence) |
| **cur_price** | `updateBy` | `updated_by` |
| **cur_price** | `createdAt` | `created_at` |
| **currency** | `cur_id` | `currency_id` ⚠️ (مستخدم كـ PK ومصدر FK لـ 10+ جداول) |
| **currency** | `main_nameAR` | `main_name_ar` |
| **currency** | `sup_nameAR` | `sup_name_ar` |
| **currency** | `main_nameEn` | `main_name_en` |
| **currency** | `sup_nameEn` | `sup_name_en` |
| **currency** | `isDefault` | `is_default` |
| **currency** | `createdAt` | `created_at` |
| **currency** | `isActive` | `is_active` |
| **cust_details** | `id` | `cust_detail_id` |
| **custody_advances** | `id` | `custody_advance_id` |
| **customers** | `id` | `customer_id` |
| **default_accounts** | `id` | `default_account_id` |
| **employees** | `id` | `employee_id` |
| **employees** | `monthlySalary` | `monthly_salary` |
| **employees** | `jobsType` | `jobs_type` |
| **employees** | `createdAt` | `created_at` |
| **employees** | `createdBy` | `created_by` |
| **entry_module** | `id` | `entry_module_id` |
| **entry_payment_details** | `id` | `entry_payment_detail_id` |
| **entry_type** | `id` | `entry_type_id` |
| **expenses** | `id` | `expense_id` |
| **expenses** | `transactionsID` | `transaction_id` |
| **expenses** | `createdAt` | `created_at` |
| **items_category** | `id` | `items_category_id` |
| **items_category** | `createdAt` | `created_at` |
| **items_category** | `updatedAt` | `updated_at` |
| **jobs_req** | `id` | `jobs_req_id` |
| **jobs_req** | `refCode` | `ref_code` |
| **jobs_req** | `createdAt` | `created_at` |
| **main_entry** | `id` | `main_entry_id` |
| **notifications** | `id` | `notification_id` |
| **notifications** | `userId` | `user_id` |
| **notifications** | `isPublic` | `is_public` |
| **notifications** | `createdAt` | `created_at` |
| **order_items** | `items_id` | `order_item_id` |
| **order_option** | `id` | `order_option_id` |
| **order_option** | `createdAt` | `created_at` |
| **order_option** | `updatedAt` | `updated_at` |
| **order_status** | `id` | `order_status_id` |
| **orders** | `id` | `order_id` |
| **orders** | `createdAt` | `created_at` |
| **orders_history** | `id` | `orders_history_id` |
| **portal_tickets** | `id` | `portal_ticket_id` |
| **portal_tickets** | `userUid` | `user_uid` |
| **portal_tickets** | `createdAt` | `created_at` |
| **portal_users** | `id` | `portal_user_id` |
| **portal_users** | `linkedAccId` | `linked_acc_id` |
| **products** | `product_id` | ✅ (صحيح بالفعل) |
| **report_settings** | `id` | `report_setting_id` |
| **report_templates** | `id` | `report_template_id` |
| **returned_products** | `return_id` | `returned_product_id` |
| **roles** | `id` | `role_id` |
| **salary_history** | `id` | `salary_history_id` |
| **salary_history** | `transactionsID` | `transaction_id` |
| **salary_history** | `createdAt` | `created_at` |
| **sessions** | `id` | `session_id` |
| **sessions** | `createdAt` | `created_at` |
| **sessions** | `lastSeen` | `last_seen` |
| **sessions** | `forceLogout` | `force_logout` |
| **settings** | `id` | `setting_id` |
| **shipments** | `id` | `shipment_id` |
| **shipments** | `createdAt` | `created_at` |
| **shipping_companies** | `id` | `shipping_company_id` |
| **shipping_companies** | `trackingID_prefix` | `tracking_id_prefix` |
| **sources** | `id` | `source_id` |
| **user_settings** | `id` | `user_setting_id` |
| **user_settings** | `userid` | `user_id` |
| **users** | `id` | `user_id` |
| **users** | `linkedType` | `linked_type` |
| **users** | `linkedEntity` | `linked_entity` |
| **users** | `fullName` | `full_name` |
| **users** | `systemPin` | `system_pin` |
| **users** | `isRoot` | `is_root` |
| **users** | `createdAt` | `created_at` |
| **users** | `updatedAt` | `updated_at` |
| **users** | `lastSeen` | `last_seen` |
| **users** | `lastSeenAt` | `last_seen_at` |
| **whatsapp_logs** | `id` | `whatsapp_log_id` |

### تعارضات مهمة تحتاج قرار

> [!CAUTION]
> **جدول `accounts`:** يحتوي على حقل `id` (PK) وحقل `account_id` (FK → accounts.id) معاً! 
> عند تسمية الـ PK إلى `account_id`، سيحدث تعارض. الحل: إعادة تسمية حقل الـ FK أولاً.

> [!CAUTION]  
> **جدول `currency`:** الـ PK `cur_id` يُستخدم في FK constraints لـ 10+ جدول بأسماء `cur_no` و `currency_original_no` وغيرها. تغيير هذا الحقل يتطلب تحديث كل تلك الـ FKs.

> [!WARNING]
> **جدول `orders` مقابل `order_status`:** كلاهما سيصبح `id` → `order_id`. يجب الحذر في الـ FKs.

---

## خطة التنفيذ في قاعدة البيانات

### المرحلة 1: تحضير (DROP constraints مؤقتاً)
1. إزالة جميع Foreign Key constraints المرتبطة بالحقول المستهدفة
2. إزالة Triggers المرتبطة
3. حفظ نص كل constraint و trigger للإعادة

### المرحلة 2: تسمية PK الحقول
1. إعادة تسمية PK في كل جدول (مع الحذر من التعارضات)

### المرحلة 3: تسمية الحقول الأخرى
1. إعادة تسمية حقول `createdAt` → `created_at` وما شابهها
2. إعادة تسمية الحقول الأخرى المخالفة

### المرحلة 4: إعادة إنشاء Constraints
1. إعادة إنشاء FK constraints بالأسماء الجديدة
2. إعادة إنشاء Triggers

### المرحلة 5: تحديث الدوال
1. تحديث جسم كل function تستخدم الحقول المعاد تسميتها

---

## ملفات الكود التي ستتأثر

### الملفات الخدمية (Services)
- [financialAccountService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/financialAccountService.ts) (74K - الأكبر)
- [financialEntryService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/financialEntryService.ts) (30K)
- [autoEntryService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/autoEntryService.ts)
- [productService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/productService.ts)
- [returnedProductService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/returnedProductService.ts)
- [currencyService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/currencyService.ts)
- وغيرها (41 ملف في مجلد services)

### الملف المحوري
- [supabase-firebase-adapter.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/lib/supabase-firebase-adapter.ts)

---

## خطة تحديث الكود

1. تحديث interface/type definitions في TypeScript لاستخدام camelCase
2. تحديث queries في supabase للإشارة إلى أسماء الحقول الجديدة (snake_case في الـ query، camelCase في الـ TypeScript interface)
3. تحديث mapping في adapter

---

## التحقق

- [ ] تشغيل النظام بعد كل مرحلة من التغييرات
- [ ] التحقق من سلامة البيانات
- [ ] اختبار الدوال الرئيسية (إنشاء طلب، تسجيل مدفوعات، إدخال مالي)

---

## أسئلة مفتوحة

1. **هل تريد تغيير اسم جدول `accounts` مقابل تعارض PK؟** الحل المقترح: تسمية PK → `account_id` وتغيير FK column `account_id` في نفس الجدول إلى `acc_sub_group_account_id` أو حذفه إن كان مكرراً.

2. **`currency.cur_id`:** هل تقبل الاحتفاظ بـ `cur_id` كاسم مؤقت وإعادة تسميته تدريجياً لتجنب إعادة كتابة عشرات الـ FKs؟

3. **هل تريد تغيير محتوى حقل `data` (JSONB)** في الجداول التي تخزن بيانات بشكل camelCase داخله؟ هذا سيؤثر على البيانات التاريخية.
