# Schema Field Map — القرارات المعتمدة قبل Canonical DTOs

**التاريخ:** 2026-09-28 | **آخر تحديث:** 2026-10-03
**المشروع:** `ejrojwbbflzchasvgexr`
**PostgreSQL:** 17.6.1
**الحالة:** محدّث بعد تطبيق migration 20261002023000_extract_columns_from_data_in_shipments_table

## 1. القرارات الملزمة

1. جميع حقول التاريخ في قاعدة البيانات تستخدم `timestamptz` فقط.
2. أي قيمة تاريخ قديمة من نوع `bigint` تحول من Epoch milliseconds باستخدام `to_timestamp(value / 1000.0)`.
3. يمنع استخدام `bigint` لأي `created_at` أو `updated_at` أو `last_seen` مستقبلاً.
4. المصدر المعتمد لحالة الطلب هو `orders.order_status_id`. يبقى `order_status1` توافقياً مؤقتاً ولا يستخدم في كود جديد.
5. جدول `roles` لا يحتفظ بـ`data`؛ تنقل بياناته إلى حقول صريحة موحدة:
   - `role_id text`
   - `title text`
   - `is_default boolean`
   - `permissions jsonb`
   - `created_at timestamptz`
   - `updated_at timestamptz`
   - `created_by text`
   - `updated_by text`
6. تتم إزالة تكرار عناصر `permissions` أثناء النقل.
7. كل جدول في `public` يجب أن يحتوي على:
   - `created_at timestamptz`
   - `updated_at timestamptz`
   - `created_by text`
   - `updated_by text`
8. `data jsonb` لا يخرج إلى DTO، ويزال من `roles` فقط في هذه Migration. إزالة `data` من جداول أخرى تحتاج جرداً مستقلاً.

## 2. تحويلات التاريخ المطلوبة

| الجدول | الحقول القديمة | التحويل |
|---|---|---|
| `users` | `created_at`, `updated_at`, `last_seen` bigint | Epoch milliseconds إلى `timestamptz` |
| `cust_details` | `created_at`, `updated_at` bigint | Epoch milliseconds إلى `timestamptz` |
| `items_category` | `created_at`, `updated_at` bigint | Epoch milliseconds إلى `timestamptz` |
| `order_option` | `created_at`, `updated_at` bigint | Epoch milliseconds إلى `timestamptz` |
| أي جدول آخر | أي حقل تاريخ bigint يكتشف لاحقاً | يجب رفضه وإضافته إلى Migration منفصلة قبل API |

## 3. ملاحظات التدقيق

الأعمدة الموجودة مسبقاً تبقى مع أنواعها الموحدة، والأعمدة الناقصة تضاف كـ`text` للفاعل و`timestamptz` للزمن. يتم ملء `created_at` و`updated_at` المضافة للسجلات الحالية بقيم آمنة (`now()` و`created_at`) عند عدم وجود قيمة تاريخية. تبقى أعمدة التدقيق قابلة لـNULL للبيانات التاريخية، ولا يفرض `NOT NULL` قبل مراجعة كل مسارات الإدخال.

`report_templates.created_by` يتحول من `uuid` إلى `text` بعد إسقاط FK إلى `auth.users` حتى يتوافق مع نموذج الهوية الموحد؛ يجب أن تعيد API ربطه بهوية التطبيق وليس بصف `auth.users` مباشرة.

## 4. حالة التنفيذ

Migrations المطبقة:

- `supabase/migrations/20260928080000_standardize_audit_timestamps_and_roles.sql`
- `supabase/migrations/20261002023000_extract_columns_from_data_in_shipments_table.sql`

تم تطبيقها بنجاح. تم حذف `roles.data` بعد استخراج `title` و`is_default` و`permissions`، والتحقق من وجود حقول التدقيق الأربعة في جميع جداول `public`.

## 4.1 تأثيرات Migration 20261002023000

هذه المايجريشن استخرجت حقولاً من `data JSONB` إلى أعمدة مستقلة في الجداول التالية:

| الجدول | الحقول المضافة/المغيّرة |
|---|---|
| `shipments` | `shipping_type`, `shipping_source`, `shipping_destination`, `shipping_date`, `shipping_duration`, `expected_arrival`, `delivery_date`, `packaging_fees`, `shipping_category_price` |
| `shipping_companies` | `address`, `is_active`, `code`, `country_id`, `phone`, `email`, `api_url`, `tracking_url_template`, `api_enabled`, `api_credentials_reference`, `supports_tracking`, `supports_webhook` |
| `sources` | `is_active` |
| `portal_users` | حُذف `account_id`، أُضيف: `type`, `phone`, `notes`, `profile_image_url`, `commercial_register_url`, `identity_doc_url`, `onboarding_completed`, `password` |
| `auto_entries` | `auto_post`, `credit_account`, `debit_account`, `description_temp_ar`, `description_temp_en`, `status_name_ar` |
| `browser_pages` | `auto_login`, `username`, `password`, `category`, `is_pinned`, `name_ar`, `name_en`, `sort_order`, `tab_color`, `url`, `view_mode` |
| `cust_details` | `age`, `body_details`, `city`, `company_name`, `country`, `gender`, `gps_location`, `id_number`, `max_debt`, `notes`, `privacy_policy_agreed`, `privacy_policy_agreed_at` |
| `customers` | `acquisition_source`, `preferred_categories`, `body_details`, `location`, `address` |
| `jobs_req` | `address`, `city`, `email`, `experience_years`, `full_name`, `id_number`, `job_position`, `notes`, `phone`, `qualification`, `ref_code`, `status` |
| `notifications` | `associated_user_ids`, `category`, `creator_id`, `creator_name`, `is_public`, `message`, `is_read`, `title`, `type` |
| `order_status` | `description` |
| `portal_tickets` | `message`, `replies`, `status`, `subject`, `type` |
| `salary_history` | `employee_id`, `notes`, `paid_at`, `status`, `voucher_code` |
| `user_settings` | `dashboard_grid_columns`, `font_size`, `language`, `theme`, `visible_metrics` |
| `whatsapp_logs` | `error_msg`, `event_type`, `external_response`, `message`, `message_type`, `phone`, `status` |
| `sessions` | `ip_address`, `user_agent`, `login_at`, `expires_at` |
| `report_templates` | `active_report`, `filters`, `name_ar`, `name_en`, `search_term`, `selected_company_id`, `selected_courier_id`, `selected_customer_id`, `selected_expense_category`, `selected_user_id`, `sort_by`, `sort_order` |
| `report_settings` | `report_title`, `show_logo`, `show_header`, `show_footer` |
| `order_items` | أعيدت تسمية `product_cooler` إلى `product_color`؛ أُضيف: `shipment_id`, `product_name`, `sku`, `internal_note`, `customer_note`, `unit__weight`, `unit_cbm`, `total_packaging_price` |
| `orders` | `currency`, `order_currency`, `order_currency_price`, `external_order_number` |
| `products` | حُذف `is_allowed` |

## 5. خريطة المفاتيح الرئيسية والحقول المعتمدة لجميع جداول قاعدة البيانات (تأكيد 100% من Supabase Live DB)

> **ملاحظة حاسمة ومؤكدة:** لا يوجد أي جدول في قاعدة البيانات يحتوي على حقل عام باسم `id`. جميع المفاتيح الرئيسية محددة حسب المجال (Domain-Specific Primary Keys).

| اسم الجدول (`Table`) | المفتاح الرئيسي المؤكد (`Primary Key`) | الحقول التفصيلية المستخرجة من Supabase |
|---|---|---|
| `orders` | `order_id` | `order_id`, `data`, `order_number`, `tracking_number`, `customer_id`, `order_status1`, `order_status_id`, `order_source_id`, `order_source_type`, `delivery_courier_id`, `shipping_courier_id`, `order_party_id`, `order_party_type`, `is_staff_order`, `employee_id`, `courier_id`, `order_party_account_id`, `created_by_name`, `currency` ✨, `order_currency` ✨, `order_currency_price` ✨, `external_order_number` ✨, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `shipments` | `shipment_id` | `shipment_id`, `order_id`, `tracking_number`, `shipping_company_id`, `courier_id`, `shipment_status`, `shipping_cost`, `weight`, `data` (legacy), `shipping_category_id`, `shipping_category_name`, `content_category_id`, `content_category_name`, `carton_count`, `customs_fee`, `tax_fee`, `other_category_fee`, `category_fees_total`, `category_fee_currency`, `shipping_type` ✨, `shipping_source` ✨, `shipping_destination` ✨, `shipping_date` ✨, `shipping_duration` ✨, `expected_arrival` ✨, `delivery_date` ✨, `packaging_fees` ✨, `shipping_category_price` ✨, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `customers` | `customer_id` | `customer_id`, `account_id`, `is_active`, `join_by`, `referrer_id`, `full_name`, `name_ar`, `name_en`, `customer_level`, `acquisition_source` ✨, `preferred_categories` ✨, `body_details` ✨, `location` ✨, `address` ✨, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `couriers` | `courier_id` | `courier_id`, `account_id`, `currency`, `is_active`, `full_name`, `name_ar`, `name_en`, `courier_type`, `courier_level`, `commission_rate`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `products` | `product_id` | `product_id`, `product_name_ar`, `product_name_en`, `product_url`, `product_price_currency`, `unit_price`, `item_category_id`, `cbm`, `width`, `height`, `length`, `weight`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `accounts` | `account_id` | `account_id`, `account_code`, `currency`, `entity_id`, `type`, `acc_sub_id`, `group_id`, `entity_type`, `account_seq`, `acc_name_ar`, `acc_name_en`, `limited_balance`, `cur_no`, `is_active`, `last_recalculated_at`, `balance`, `account_number`, `account_prefix`, `entity_name`, `debit_total`, `credit_total`, `parent_code`, `notes`, `monthly_salary`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `account_trans` | `account_trans_id` | `account_trans_id`, `main_entry_id`, `line_no`, `trans_type`, `account_id`, `account_cur_no`, `amount`, `amount_original`, `currency_original_no`, `currency_price_id`, `currency_price_seq`, `entity_type`, `entity_id`, `payment_method`, `order_id`, `shipment_id`, `custody_id`, `auto_rule_id`, `automation_key`, `description`, `note`, `conversion_rate`, `amount_original_text`, `account_currency_price_id`, `account_currency_price_seq`, `amount_text`, `created_at`, `updated_at`, `created_by_uid`, `updated_by_uid`, `created_by`, `updated_by` |
| `main_entry` | `main_entry_id` | `main_entry_id`, `entry_number`, `module_id`, `entry_type_id`, `entry_category`, `posting_status`, `description`, `notes`, `attachments`, `payment_method`, `order_id`, `shipment_id`, `custody_id`, `automation_key`, `auto_rule_id`, `is_automatic`, `reverses_entry_id`, `effective_at`, `posted_at`, `voided_at`, `created_at`, `updated_at`, `created_by_uid`, `updated_by_uid`, `posted_by_uid`, `voided_by_uid`, `created_by`, `updated_by` |
| `users` | `user_id` | `user_id`, `role`, `username`, `email`, `disabled`, `linked_type`, `linked_entity`, `full_name`, `password`, `system_pin`, `is_root`, `phone`, `address`, `last_seen`, `last_seen_at`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `sessions` | `session_id` | `session_id`, `user_id`, `last_seen`, `force_logout`, `device_info`, `role`, `full_name`, `email`, `ip_address` ✨, `user_agent` ✨, `login_at` ✨, `expires_at` ✨, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `portal_users` | `portal_user_id` | `portal_user_id`, `data` (legacy), `portal_role`, `username`, `email`, `disabled`, `approval_status`, `join_by`, `referrer_id`, `full_name`, `name_ar`, `name_en`, `linked_customer_id`, `is_disabled`, `type` ✨, `phone` ✨, `notes` ✨, `profile_image_url` ✨, `commercial_register_url` ✨, `identity_doc_url` ✨, `onboarding_completed` ✨, `password` ✨, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `employees` | `employee_id` | `employee_id`, `account_id`, `monthly_salary`, `currency`, `full_name`, `name_ar`, `name_en`, `job_type`, `commission_rate`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `custody_advances` | `custody_advance_id` | `custody_advance_id`, `custody_number`, `recipient_type`, `recipient_id`, `recipient_name`, `recipient_account_id`, `amount_original`, `currency_original_no`, `currency_price_id`, `currency_price_seq`, `amount_settled`, `amount_outstanding`, `status`, `issued_entry_id`, `settlement_entry_id`, `note`, `issued_at`, `issued_by_uid`, `settled_at`, `settled_by_uid`, `created_at`, `updated_at`, `created_by_uid`, `updated_by_uid`, `created_by`, `updated_by` |
| `returned_products` | `return_id` | `return_id`, `order_id`, `order_item_id`, `product_id`, `customer_id`, `customer_name`, `product_name`, `product_url`, `quantity`, `return_reason`, `return_type`, `return_status`, `return_condition`, `refund_amount`, `refund_currency`, `is_insured`, `insurance_refund`, `notes`, `returned_at`, `processed_by`, `processed_at`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `items_category` | `items_category_id` | `items_category_id`, `code`, `name_ar`, `name_en`, `description`, `hs_code_hint`, `customs_per_carton`, `tax_per_carton`, `other_fees_per_carton`, `customs_rate`, `tax_rate`, `fee_currency`, `requires_review`, `is_active`, `details`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `sources` | `source_id` | `source_id`, `name`, `type`, `source_url`, `account_id`, `name_ar`, `name_en`, `is_active` ✨, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `shipping_companies` | `shipping_company_id` | `shipping_company_id`, `name`, `shipping_company_url`, `tracking_id_prefix`, `account_id`, `name_ar`, `name_en`, `address` ✨, `is_active` ✨, `code` ✨, `country_id` ✨, `phone` ✨, `email` ✨, `api_url` ✨, `tracking_url_template` ✨, `api_enabled` ✨, `api_credentials_reference` ✨, `supports_tracking` ✨, `supports_webhook` ✨, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `roles` | `role_id` | `role_id`, `title`, `is_default`, `permissions`, `code`, `description`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `orders_history` | `orders_history_id` | `orders_history_id`, `order_id`, `order_number`, `shipment_id`, `activity_log_id`, `event_type`, `event_category`, `operation`, `entity_type`, `actor_id`, `actor_name`, `actor_role`, `source`, `summary`, `before_data`, `after_data`, `metadata`, `occurred_at`, `main_entry_id`, `account_trans_count`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `order_items` | `order_item_id` | `order_item_id`, `order_id`, `product_id`, `shipment_id` ✨, `product_price`, `product_url`, `tracking_number`, `produc_source_id`, `produc_source_url`, `product_color` ✨ (كان cooler), `nota`, `product_name` ✨, `sku` ✨, `internal_note` ✨, `customer_note` ✨, `quantity`, `total_price`, `total__weight`, `unit__weight` ✨, `total_cbm`, `unit_cbm` ✨, `total_packaging_price` ✨, `packaging_option_id`, `packaging_option_price`, `is_insured`, `insurance_fee`, `items_status`, `created_at`, `updated_at`, `created_by`, `updated_by` |

> ✨ = حقول مضافة أو محدثة في migration 20261002023000

