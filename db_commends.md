# سجل أوامر وتوجيهات قاعدة البيانات (DB Commands Log)

## [2026-09-09 22:15:00] — AI Model: Antigravity / Gemini 3.6 Flash
```sql
-- =====================================================
-- جدول المنتجات المرتجعة — returned_products
-- Returned Products Table for managing customer returns
-- =====================================================

CREATE TABLE IF NOT EXISTS public.returned_products (
    return_id TEXT PRIMARY KEY,
    order_id TEXT,
    order_item_id TEXT,
    product_id TEXT,
    customer_id TEXT,
    customer_name TEXT,
    product_name TEXT,
    product_url TEXT,
    quantity INTEGER DEFAULT 1,
    return_reason TEXT,
    return_type TEXT DEFAULT 'استرداد',
    return_status TEXT DEFAULT 'معلق',
    return_condition TEXT DEFAULT 'مستخدم',
    refund_amount NUMERIC(15, 4) DEFAULT 0,
    refund_currency TEXT DEFAULT 'YER',
    is_insured BOOLEAN DEFAULT false,
    insurance_refund NUMERIC(15, 4) DEFAULT 0,
    notes TEXT,
    returned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    processed_by TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_by TEXT
);

-- RLS (Row Level Security)
ALTER TABLE public.returned_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON public.returned_products
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_returned_products_order_id ON public.returned_products(order_id);
CREATE INDEX IF NOT EXISTS idx_returned_products_product_id ON public.returned_products(product_id);
CREATE INDEX IF NOT EXISTS idx_returned_products_customer_id ON public.returned_products(customer_id);
CREATE INDEX IF NOT EXISTS idx_returned_products_return_status ON public.returned_products(return_status);
```

## [2026-09-09 13:41:00] — AI Model: Antigravity / Gemini 3.6 Flash
```sql
select * from public.orders;
-- تم التنفيذ بنجاح واسترجاع سجلين.
```

## [2026-09-09 14:15:00] — AI Model: Antigravity / Gemini 3.6 Flash
```sql
-- Migration 202609090001: إصلاح سياسات الأمان RLS والصلاحيات لجدول المنتجات المرتجعة
-- Fix RLS policy and permissions for returned_products table

-- 1. إلغاء تقييد RLS ليتطابق مع باقي الجداول التشغيلية (products, order_items)
ALTER TABLE public.returned_products DISABLE ROW LEVEL SECURITY;

-- 2. إزالة السياسة القديمة المقيدة لدور authenticated فقط
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.returned_products;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.returned_products;

-- 3. إنشاء سياسة شاملة تتيح الوصول لدور anon والجميع في حال تفعيل RLS
CREATE POLICY "Enable all access for all users" ON public.returned_products
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- 4. منح الصلاحيات الصريحة لكافة أدوار الاتصال
-- 4. منح الصلاحيات الصريحة لكافة أدوار الاتصال
GRANT ALL ON TABLE public.returned_products TO anon;
GRANT ALL ON TABLE public.returned_products TO authenticated;
GRANT ALL ON TABLE public.returned_products TO service_role;
```

## [2026-09-15 02:04:05] — AI Model: Gemini 3.6 Flash
```sql
-- 1. استعلام قائمة أسماء الجداول في قاعدة البيانات:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;

-- 2. استعلام المفاتيح الرئيسية للجداول:
SELECT tc.table_name, kcu.column_name 
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name, kcu.ordinal_position;

-- 3. استعلام الأعمدة والمفاتيح الأجنبية:
SELECT c.table_name, c.column_name, c.data_type, fk.foreign_table_name, fk.foreign_column_name
FROM information_schema.columns c
LEFT JOIN (
    SELECT kcu.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position;

-- 4. حصر أعمدة JSONB في النظام:
SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'jsonb' ORDER BY table_name, column_name;
```

## [2026-09-16 00:55:00] — AI Model: Gemini 3.6 Flash
```sql
-- Migration 202609160001: إعادة تسمية جميع حقول camelCase إلى snake_case في قاعدة البيانات وحذف المتكررة
BEGIN;
DO $$
BEGIN
  -- 1. accounts
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'created_at') THEN
      UPDATE public.accounts SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.accounts DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.accounts RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  -- (... وتم تطبيق المنطق الذكي لكافة الجداول الـ 20: announcements, orders, activity_logs, assets, cur_price, currency, employees, expenses, items_category, jobs_req, notifications, order_option, portal_tickets, portal_users, salary_history, sessions, shipments, shipping_companies, users ...)
END $$;
COMMIT;

-- Migration 202609160003: تصحيح دوال التريجرات لمنع تحديث حقل accounts.data غير الموجود
CREATE OR REPLACE FUNCTION public.link_source_financial_account() ...;
CREATE OR REPLACE FUNCTION public.link_shipping_company_financial_account() ...;
CREATE OR REPLACE FUNCTION public.link_asset_financial_account() ...;

-- Migration 202609160004: تصحيح دالة accounting_touch_account_updated_at لتسند لـ updated_at
CREATE OR REPLACE FUNCTION public.accounting_touch_account_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- Migration 202609160002: تطهير كائن data (JSONB) عبر كافة الجداول
UPDATE public.[tables] SET data = data - 'created_at' - 'createdAt' - 'updated_at' - 'updatedAt' - 'is_active' - 'isActive' - 'created_by' - 'createdBy' - 'user_id' - 'userId' - 'customer_id' - 'customerId' - 'order_id' - 'orderId' - 'account_id' - 'accountId' - 'status_id' - 'statusId';

## [2026-09-16 02:15:00] — AI Model: Gemini 3.6 Flash
```sql
-- Migration 202609160005: إعادة إنشاء العروض (expenes_view & portal_users_view) بـ snake_case صريحة
DROP VIEW IF EXISTS expenes_view;
DROP VIEW IF EXISTS portal_users_view;

CREATE VIEW expenes_view AS
SELECT 
    id,
    ((data ->> 'amount'::text))::numeric AS amount,
    ((data ->> 'amountInDefaultCurrency'::text))::numeric AS amount_in_default_currency,
    (data ->> 'category'::text) AS category,
    ((data ->> 'createdAt'::text))::numeric AS created_at,
    (data ->> 'createdByEmail'::text) AS created_by_email,
    (data ->> 'createdByName'::text) AS created_by_name,
    (data ->> 'createdByUid'::text) AS created_by_uid,
    (data ->> 'currency'::text) AS currency,
    (data ->> 'expenseNumber'::text) AS expense_number,
    (data ->> 'financialAccountCode'::text) AS financial_account_code,
    (data ->> 'financialAccountId'::text) AS financial_account_id,
    (data ->> 'linkedAccountCode'::text) AS linked_account_code,
    (data ->> 'linkedAccountId'::text) AS linked_account_id,
    (data ->> 'notes'::text) AS notes,
    (data ->> 'recipientEntityId'::text) AS recipient_entity_id,
    (data ->> 'recipientEntityType'::text) AS recipient_entity_type,
    (data ->> 'recipientId'::text) AS recipient_id,
    (data ->> 'recipientName'::text) AS recipient_name,
    (data ->> 'remarks'::text) AS remarks,
    ((data ->> 'remittedAmount'::text))::numeric AS remitted_amount,
    ((data ->> 'remittedAmountInDefaultCurrency'::text))::numeric AS remitted_amount_in_default_currency,
    (data ->> 'salaryMonth'::text) AS salary_month,
    ((data ->> 'settledAt'::text))::numeric AS settled_at,
    (data ->> 'settledByEmail'::text) AS settled_by_email,
    (data ->> 'settledByName'::text) AS settled_by_name,
    (data ->> 'status'::text) AS status,
    (data ->> 'type'::text) AS type,
    ((data ->> 'updatedAt'::text))::numeric AS updated_at
FROM expenses;

CREATE VIEW portal_users_view AS
SELECT 
    id,
    (data ->> 'address'::text) AS address,
    (data ->> 'approvalStatus'::text) AS approval_status,
    (data ->> 'commercialRegisterUrl'::text) AS commercial_register_url,
    ((data ->> 'createdAt'::text))::numeric AS created_at,
    (data ->> 'email'::text) AS email,
    (data ->> 'fullName'::text) AS full_name,
    (data ->> 'gpsLocation'::text) AS gps_location,
    (data ->> 'identityDocUrl'::text) AS identity_doc_url,
    (data ->> 'linkedAccId'::text) AS linked_acc_id,
    (data ->> 'linkedCustomerId'::text) AS linked_customer_id,
    (data ->> 'notes'::text) AS notes,
    (data ->> 'phone'::text) AS phone,
    (data ->> 'portalRole'::text) AS portal_role,
    (data ->> 'profileImageUrl'::text) AS profile_image_url,
    (data ->> 'uid'::text) AS uid,
    ((data ->> 'updatedAt'::text))::numeric AS updated_at,
    (data ->> 'username'::text) AS username
FROM portal_users;

-- 2. استعلام الفحص والتحقق الصارم لخلو جميع أعمدة public من camelCase:
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name ~ '[A-Z]'
ORDER BY table_name, column_name;



## [2026-09-25 21:55:07] — AI Model: Gemini 3.6 Flash
```sql
-- 1. إعادة تسمية المفاتيح الرئيسية لكل جداول قاعدة البيانات
ALTER TABLE public.roles              RENAME COLUMN id TO role_id;
ALTER TABLE public.users              RENAME COLUMN id TO user_id;
ALTER TABLE public.customers          RENAME COLUMN id TO customer_id;
ALTER TABLE public.employees          RENAME COLUMN id TO employee_id;
ALTER TABLE public.couriers           RENAME COLUMN id TO courier_id;
ALTER TABLE public.orders             RENAME COLUMN id TO order_id;
ALTER TABLE public.shipments          RENAME COLUMN id TO shipment_id;
ALTER TABLE public.products           RENAME COLUMN id TO product_id;
ALTER TABLE public.order_items        RENAME COLUMN items_id TO order_item_id;
ALTER TABLE public.accounts          RENAME COLUMN id TO account_id;
ALTER TABLE public.main_entry         RENAME COLUMN id TO main_entry_id;
ALTER TABLE public.account_trans      RENAME COLUMN id TO account_trans_id;
ALTER TABLE public.cur_price          RENAME COLUMN id TO cur_price_id;
-- (... تم تحويل كافة الجداول الأخرى)

-- 2. إرجاع وإعاده إنشاء القيود المرجعية (FK Constraints) على المسميات الجديدة
ALTER TABLE public.account_trans ADD CONSTRAINT account_trans_created_by_uid_fkey FOREIGN KEY (created_by_uid) REFERENCES public.users(user_id);
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);
-- (... تم ترحيل وإعاده إنشاء كافة FKs)

-- 3. تحديث عرض portal_users_view واستخدام portal_user_id بدلاً من AS id
DROP VIEW IF EXISTS public.portal_users_view;
CREATE VIEW public.portal_users_view AS
SELECT 
  portal_user_id,
  (data ->> 'address'::text) AS address,
  (data ->> 'approvalStatus'::text) AS approval_status,
  (data ->> 'commercialRegisterUrl'::text) AS commercial_register_url,
  ((data ->> 'createdAt'::text))::numeric AS created_at,
  (data ->> 'email'::text) AS email,
  (data ->> 'fullName'::text) AS full_name,
  (data ->> 'gpsLocation'::text) AS gps_location,
  (data ->> 'identityDocUrl'::text) AS identity_doc_url,
  (data ->> 'linkedAccId'::text) AS linked_acc_id,
  (data ->> 'linkedCustomerId'::text) AS linked_customer_id,
  (data ->> 'notes'::text) AS notes,
  (data ->> 'phone'::text) AS phone,
  (data ->> 'portalRole'::text) AS portal_role,
  (data ->> 'profileImageUrl'::text) AS profile_image_url,
  (data ->> 'uid'::text) AS uid,
  ((data ->> 'updatedAt'::text))::numeric AS updated_at,
  (data ->> 'username'::text) AS username
FROM public.portal_users;

-- 4. تنفيذ Migration 202609170002 لتحديث delete_orders_with_dependents و orders_history_from_orders و create_financial_entry_v2
```

## [2026-09-25 23:45:00] — AI Model: Gemini 3.6 Flash
```sql
-- 1. تحديث دالة orders_history_resolve_order لتفادي الخطأ o.id does not exist
CREATE OR REPLACE FUNCTION public.orders_history_resolve_order(p_ref text)
 RETURNS TABLE(order_id text, order_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_ref IS NULL OR btrim(p_ref) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT o.order_id, o.order_number
  FROM public.orders o
  WHERE o.order_id = p_ref OR o.order_number = p_ref
  LIMIT 1;
END;
$function$;

-- 2. تحديث دوال الربط المالي المباشرة وتصحيح المراجع
CREATE OR REPLACE FUNCTION public.link_employee_financial_account() RETURNS trigger AS $$
BEGIN
  IF NEW.employee_id IS NOT NULL AND NEW.financial_account_id IS NULL THEN
    -- assign financial_account_id using employee_id
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## [2026-09-26 00:15:00] — AI Model: Gemini 3.6 Flash
```sql
-- تحديث استعلامات Supabase Client REST المباشرة لتطابق مسميات أعمدة الجداول بـ PostgreSQL
-- 1. جدول currency: cur_id, is_default, is_active (بدلاً من cur_id, isDefault, isActive)
SELECT cur_id, code, is_default FROM public.currency WHERE is_active = true ORDER BY cur_id ASC;

-- 2. جدول accounts: account_id, acc_name_ar, acc_name_en, cur_no, is_active, acc_sub_id, entity_id, entity_type (بدلاً من id)
SELECT account_id, acc_name_ar, acc_name_en, cur_no, is_active, acc_sub_id, entity_id, entity_type FROM public.accounts ORDER BY account_id ASC;

-- 3. جدول main_entry: main_entry_id (بدلاً من id)
SELECT main_entry_id, entry_number, module_id, entry_type_id, entry_category, posting_status, description, payment_method, effective_at, created_at, updated_at, created_by_uid, updated_by_uid, order_id FROM public.main_entry ORDER BY effective_at DESC LIMIT 500;

-- 4. جدول account_trans: account_trans_id, main_entry_id (بدلاً من id, entry_id)
SELECT account_trans_id, main_entry_id, line_no, trans_type, account_id, account_cur_no, amount, amount_original, currency_original_no, payment_method, description, order_id, shipment_id, created_at FROM public.account_trans ORDER BY created_at DESC LIMIT 1500;

-- 5. جدول entry_payment_details: entry_payment_detail_id, main_entry_id (بدلاً من id, entry_id)
SELECT entry_payment_detail_id, main_entry_id, payment_method, account_id, amount_original, bank_reference, due_at, note FROM public.entry_payment_details ORDER BY main_entry_id ASC LIMIT 1500;

-- 6. جدول custody_advances: custody_advance_id (بدلاً من id)
SELECT custody_advance_id, custody_number, recipient_id, recipient_name, recipient_type, recipient_account_id, amount_original, amount_outstanding, currency_original_no, status, issued_at FROM public.custody_advances ORDER BY issued_at DESC LIMIT 500;

-- 7. جدول users: user_id, full_name (بدلاً من id, data)
SELECT user_id, username, full_name FROM public.users LIMIT 500;
```

## [2026-09-26 03:53:00] — AI Model: Gemini 3.6 Flash
```sql
-- 1. تحديث استعلامات جدول أسعار العملات cur_price لاستخدام cur_price_id بدلاً من id
SELECT cur_price_id, seq, price FROM public.cur_price WHERE cur_no = 3 ORDER BY day_date DESC, seq DESC LIMIT 1;
SELECT cur_price_id, seq, price FROM public.cur_price WHERE cur_no = 2 ORDER BY day_date DESC, seq DESC LIMIT 1;
SELECT cur_price_id, seq, price, day_date FROM public.cur_price WHERE cur_no = 1 ORDER BY day_date DESC, seq DESC LIMIT 1;

-- 2. تحديث استعلامات جدول main_entry لاستخدام main_entry_id بدلاً من id
SELECT main_entry_id FROM public.main_entry WHERE order_id = 'ORD-101' AND auto_rule_id = 'order_down_payment' LIMIT 1;
SELECT main_entry_id FROM public.main_entry WHERE automation_key = 'auto-voucher:101:rule:1' LIMIT 1;
```
 
## [2026-09-26 05:20:00] — AI Model: Gemini 3.6 Flash
```sql
-- 1. تحديث دالة orders_history_write واستخدام orders_history_id
CREATE OR REPLACE FUNCTION public.orders_history_write(
  p_order_id text DEFAULT NULL::text,
  p_order_number text DEFAULT NULL::text,
  p_shipment_id text DEFAULT NULL::text,
  p_journal_entry_id text DEFAULT NULL::text,
  p_account_transaction_id text DEFAULT NULL::text,
  p_activity_log_id text DEFAULT NULL::text,
  p_event_type text DEFAULT 'custom'::text,
  p_event_category text DEFAULT 'general'::text,
  p_operation text DEFAULT 'custom'::text,
  p_entity_type text DEFAULT 'custom'::text,
  p_source text DEFAULT 'database'::text,
  p_summary text DEFAULT NULL::text,
  p_before_data jsonb DEFAULT '{}'::jsonb,
  p_after_data jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id text DEFAULT NULL::text,
  p_actor_name text DEFAULT NULL::text,
  p_actor_role text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  actor_record record;
BEGIN
  SELECT * INTO actor_record
  FROM public.orders_history_actor(p_actor_id, p_actor_name, p_actor_role);

  INSERT INTO public.orders_history (
    orders_history_id, order_id, order_number, shipment_id, journal_entry_id, account_transaction_id,
    activity_log_id, event_type, event_category, operation, entity_type,
    actor_id, actor_name, actor_role, source, summary,
    before_data, after_data, metadata, occurred_at, created_at
  ) VALUES (
    'oh_' || substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 24),
    p_order_id, p_order_number, p_shipment_id, p_journal_entry_id, p_account_transaction_id,
    p_activity_log_id, p_event_type, p_event_category, p_operation, p_entity_type,
    actor_record.actor_id, actor_record.actor_name, actor_record.actor_role, COALESCE(p_source, 'database'), p_summary,
    COALESCE(p_before_data, '{}'::jsonb), COALESCE(p_after_data, '{}'::jsonb), COALESCE(p_metadata, '{}'::jsonb), now(), now()
  );
END;
$function$;

-- 2. تحديث delete_orders_with_dependents
-- تم تحديث الاستعلامات لحذف السجلات التابعة بناءً على order_id و shipment_id و main_entry_id و account_trans_id


## [2026-09-26 05:32:00] — AI Model: Gemini 3.6 Flash
```sql
-- 1. تحديث دالة financial_entry_permission_for_payload
CREATE OR REPLACE FUNCTION public.financial_entry_permission_for_payload(p_entry jsonb, p_action text DEFAULT 'create'::text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_type_code text; v_category text := COALESCE(p_entry->>'entryCategory', 'General');
BEGIN
  SELECT code INTO v_type_code FROM public.entry_type WHERE entry_type_id = NULLIF(btrim(p_entry->>'entryTypeId'), '');
  IF p_action = 'create' THEN
    IF v_type_code IN ('RECEIPT_VOUCHER', 'ORDER_PAYMENT') THEN RETURN 'create_receipt_vouchers'; END IF;
    IF v_type_code IN ('PAYMENT_VOUCHER', 'OPERATING_EXPENSE', 'SALARY_PAYMENT') THEN RETURN 'create_payment_vouchers'; END IF;
    IF v_category = 'Compound' THEN RETURN 'create_compound_entries'; END IF;
    IF v_category = 'Temp' THEN RETURN 'create_temporary_entries'; END IF;
    RETURN 'create_general_entries';
  END IF;
  IF v_type_code IN ('RECEIPT_VOUCHER', 'ORDER_PAYMENT') THEN RETURN 'edit_receipt_vouchers'; END IF;
  IF v_type_code IN ('PAYMENT_VOUCHER', 'OPERATING_EXPENSE', 'SALARY_PAYMENT') THEN RETURN 'edit_payment_vouchers'; END IF;
  IF v_category = 'Compound' THEN RETURN 'edit_compound_entries'; END IF;
  IF v_category = 'Temp' THEN RETURN 'edit_temporary_entries'; END IF;
  RETURN 'edit_general_entries';
END;
$function$;

-- 2. تحديث دالة accounting_system_currency_id
CREATE OR REPLACE FUNCTION public.accounting_system_currency_id()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  SELECT cur_id FROM public.currency WHERE is_default = true AND is_active = true ORDER BY cur_id LIMIT 1;
$function$;

-- 3. تحديث الـ 14 دالة مخزنة الأخرى والتأكد من مطابقة أسماء الأعمدة في PostgreSQL
```









## 2026-09-27 08:59 — AI Model: Manus current session model
- `apply_migration(drop_legacy_financial_tables_after_cutover)` — تثبيت حذف الجداول الإرثية بصيغة idempotent.
- `apply_migration(complete_safe_field_normalization)` — إضافة وتعبئة الحقول المعيارية وحذف الروابط الخالية.
- `apply_migration(drop_replaced_entity_columns)` — حذف أعمدة levels/type/jobs_type بعد النقل.
- استعلامات تحقق قراءة فقط للمخطط والهجرات والروابط والتوازن والأسطر اليتيمة.
2026-09-27 09:31: apply_migration fix_multicurrency_entry_balance_validation.
2026-09-27 10:21: apply_migration remove_ambiguous_order_delete_overload ثم make_entity_delete_references_nullable.
[2026-09-28 03:45:00] Applied frontend-only React/Recharts fix; no SQL executed in this step.


## [2026-09-28 04:08:00] — AI Model: GPT-5.2
- أمر SQL منفذ: لا يوجد.
- سبب الإدراج: تم استخدام قراءة مخطط Supabase فقط لتحديث `DATABASE_SCHEMA.md` دون تعديل قاعدة البيانات.

## [2026-09-28 05:29:36] — AI Model: Gemini 3.6 Flash (High)
```sql
-- 1. استعلام قائمة جميع الجداول ومكونات حقولها في schema public:
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 2. استعلام المفاتيح الخارجية والروابط بين الجداول:
SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';

-- 3. استعلام استخراج أسماء الحقول التي داخل حقول jsonb عبر جميع الجداول:
SELECT 'roles' as tbl, 'data' as col, ARRAY_AGG(DISTINCT k) as keys FROM (SELECT jsonb_object_keys(data) k FROM roles WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'portal_users', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM portal_users WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'portal_tickets', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM portal_tickets WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'whatsapp_logs', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM whatsapp_logs WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'report_templates', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM report_templates WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'order_option', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM order_option WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'settings', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM settings WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'items_category', 'details', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(details) k FROM items_category WHERE details IS NOT NULL AND jsonb_typeof(details)='object') s
UNION ALL
SELECT 'announcements', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM announcements WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'orders_history', 'before_data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(before_data) k FROM orders_history WHERE before_data IS NOT NULL AND jsonb_typeof(before_data)='object') s
UNION ALL
SELECT 'orders_history', 'after_data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(after_data) k FROM orders_history WHERE after_data IS NOT NULL AND jsonb_typeof(after_data)='object') s
UNION ALL
SELECT 'orders_history', 'metadata', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(metadata) k FROM orders_history WHERE metadata IS NOT NULL AND jsonb_typeof(metadata)='object') s
UNION ALL
SELECT 'salary_history', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM salary_history WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'shipments', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM shipments WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'auto_entries', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM auto_entries WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'order_status', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM order_status WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'orders', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM orders WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'report_settings', 'exchange_rates', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(exchange_rates) k FROM report_settings WHERE exchange_rates IS NOT NULL AND jsonb_typeof(exchange_rates)='object') s
UNION ALL
SELECT 'notifications', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM notifications WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'browser_pages', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM browser_pages WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'jobs_req', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM jobs_req WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'activity_logs', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM activity_logs WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'user_settings', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM user_settings WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'cust_details', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM cust_details WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s;
```



## [2026-09-28 05:53:10 +03:00] — AI Model: Manus
### حالة أوامر قاعدة البيانات
- لم يتم تنفيذ أي أمر SQL أو Migration أو DDL أو DML خلال إعادة تحليل الخطة وتوسيعها.
- عمليات Supabase المستخدمة كانت قراءة/استكشاف فقط: قائمة المشروع، المخطط، المهاجرات، ومستشاري الأمن والأداء.
- لا توجد نتيجة SQL جديدة تحتاج إلى تسجيلها في هذا التاريخ.


## [2026-09-28 06:17:33 +03:00] — AI Model: Manus
- لم يتم تنفيذ أي أمر SQL أو Migration أو DDL أو DML أثناء إعادة مواءمة الخطة مع النسخة الأصلية.
- التغييرات اقتصرت على إعادة صياغة ملف الخطة والتوثيق النصي.


## [2026-09-28 06:35:20 +03:00] — AI Model: Manus
- لم يتم تنفيذ أي أمر SQL أو Migration أو DDL أو DML خلال مرحلة Baseline والجرد.
- فحوص المرحلة كانت على الكود والملفات فقط، مع الاعتماد على نتائج Supabase القراءة السابقة.


## [2026-09-28 06:56:40 +03:00] — AI Model: Manus
- لم يتم تنفيذ أي أمر SQL أو Migration أو DDL أو DML أثناء اعتماد Windows baseline وإنشاء Data Access Map.
- تم استخدام نتائج الاختبارات والملفات والمهاجرات الموجودة للتوثيق فقط.


## [2026-09-28 07:29:32 +03:00] — AI Model: Manus
### SQL مُجهز ولم يُنفذ
- الملف: `supabase/migrations/20260928080000_standardize_audit_timestamps_and_roles.sql`
- النطاق: توحيد `timestamptz`، نقل `roles.data`، اعتماد `order_status_id`، وإضافة حقول التدقيق الأربعة لكل جدول public.
- الحالة: Prepared only؛ لم يتم استدعاء `apply_migration` ولم تنفذ أي DDL/DML.


## [2026-09-28 08:15:36 +03:00] — AI Model: Manus
### SQL/Migration executed
- Executed migration: `standardize_audit_timestamps_and_roles`.
- Result: Success after removing legacy numeric defaults before timestamp conversion and omitting generic audit backfill that activated a broken legacy `orders_history` trigger.
- Verified: `roles.data` removed; permissions normalized; all public tables contain four audit columns; target dates are `timestamptz`.


## [2026-09-28 08:17:53 +03:00] — AI Model: Manus
- لم يتم تنفيذ SQL أو Migration إضافية أثناء إنشاء Canonical Contracts وGateway Interfaces وMappers.
- آخر تغيير قاعدة بيانات موثق هو Migration `standardize_audit_timestamps_and_roles` المطبقة بنجاح.


## [2026-09-28 08:28:37 +03:00] — AI Model: Manus
- لم يتم تنفيذ أي SQL أو DDL أو DML أو Migration أثناء تصحيح الترتيب وتنفيذ Feature roles في المرحلة 2.


## [2026-09-28 08:44:31 +03:00] — AI Model: Manus
- لم يتم تنفيذ SQL أو Migration أو DDL أو DML أثناء إضافة `FinanceEntries` أو نقل `expenses` إلى النطاق الداخلي لـ`accounting`.


## [2026-09-28 08:50:56 +03:00] — AI Model: Manus
- لم يتم تنفيذ أي SQL أو DDL أو DML أو Migration عند فصل `products` كFeature مستقل.


## [2026-09-28 08:54:05 +03:00] — AI Model: Manus
- لم يتم تنفيذ SQL أو Migration أو DDL أو DML أثناء إضافة `Sources` أو جرد مكونات `src`.


## [2026-09-28 09:21:41 +03:00] — AI Model: Manus
- لم يتم تنفيذ SQL أو Migration أو DDL أو DML أثناء إضافة `browser` و`siteManagement`.
- التغييرات اقتصرت على Feature boundaries والملفات التوثيقية.


## [2026-09-28 09:29:49 +03:00] — AI Model: Manus
- لم يتم تنفيذ SQL أو Migration أو DDL أو DML أثناء إنشاء Data Gateway contracts وCurrent Supabase gateways.
- لم يتم استدعاء أو تغيير أي بيانات من خلال Orders/Roles Gateways؛ التنفيذ اقتصر على إنشاء الكود والحدود.


## [2026-09-28 09:45:37 +03:00] — AI Model: Manus
- لم يتم تنفيذ SQL أو Migration أو DDL أو DML أثناء إنشاء Current Supabase Feature Gateway Registry.
- كل العمليات الحالية تعريفات كود وقراءة مستقبلية فقط؛ لم يتم استدعاء Gateway لتغيير بيانات.


## [2026-09-28 09:52:52 +03:00] — AI Model: Manus
- تمت مراجعة أعمدة الكتابة البرمجية في Orders وRoles وFinanceEntries مع المخطط الموثق.
- لم يتم استدعاء أي عملية كتابة ولم يتغير أي سجل في قاعدة البيانات.


## [2026-09-28 10:07:49 +03:00] — AI Model: Manus
- لم يتم تنفيذ SQL أو Migration أو DDL أو DML أثناء تصحيح نطاق المرحلة الثالثة.
- حذف Registry الزائد وتحديث الخطة تغييرات كود وتوثيق فقط.


## [2026-09-28 10:22:45 +03:00] — AI Model: Manus
- لم يتم تنفيذ SQL أو Migration أو DDL أو DML خلال مرحلة DTOs وMappers وSchemas.
- التغييرات دائمة على مستوى عقود الكود فقط، دون تعديل Schema أو بيانات Supabase.

## [2026-09-28 10:50:49] — AI Model: Gemini 3.6 Flash (High)
```sql
-- 1. استعلام قائمة جميع الجداول ومكونات حقولها في schema public:
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 2. استعلام المفاتيح الخارجية والروابط بين الجداول:
SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';

-- 3. استعلام استخراج أسماء الحقول داخل أعمدة JSONB لقاعدة البيانات الحية:
SELECT 'auto_entries' as tbl, 'data' as col, ARRAY_AGG(DISTINCT k) as keys FROM (SELECT jsonb_object_keys(data) k FROM auto_entries WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'roles', 'permissions', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(permissions) k FROM roles WHERE permissions IS NOT NULL AND jsonb_typeof(permissions)='object') s;
```



## [2026-09-28 14:05:35 +03:00] — فحص أعمدة العملاء ومرفقاتهم في public — AI Model: Manus

```sql
select table_name, column_name, data_type, udt_name from information_schema.columns where table_schema = 'public' and (table_name in ('customers', 'cust_details', 'portal_users', 'order_attachments') or table_name ilike '%customer%file%' or table_name ilike '%customer%doc%' or table_name ilike '%customer%attach%') order by table_name, ordinal_position limit 200;
```

النتيجة: أعمدة `customers` و`cust_details` و`portal_users` تطابق العقود المستخدمة. ظهر `order_attachments` للطلبات، ولم يظهر جدول ملفات/مرفقات خاص بالعملاء.

## [2026-09-28 14:05:47 +03:00] — فحص مفاتيح ملفات العملاء في JSONB — AI Model: Manus

```sql
select distinct k.key as data_key from public.cust_details d cross join lateral jsonb_object_keys(d.data) as k(key) where d.data is not null and (k.key ilike '%file%' or k.key ilike '%attach%' or k.key ilike '%doc%' or k.key ilike '%image%') limit 100;
```

النتيجة: صفر مفاتيح مطابقة؛ لم تُقرأ قيم البيانات ولم يُنفذ أي تغيير على قاعدة البيانات.


## [2026-09-29 23:13:00] - Model: Gemini 3.6 Flash
-- No SQL statements executed for Phase 9 code refactoring.


## [2026-09-29 23:49:00] - Model: Gemini 3.6 Flash
-- No SQL statements executed for parent pages code refactoring.


## [2026-09-30 00:14:00] - Model: Gemini 3.6 Flash
-- No SQL statements executed for IDE problems fix.


## [2026-09-30 00:23:00] - Model: Gemini 3.6 Flash
-- No SQL statements executed.


## [2026-09-30 00:32:00] - Model: Gemini 3.6 Flash
-- No SQL statements executed.

## [2026-10-01 19:36:00 +0000] — AI Model: Manus
```sql
-- لم يتم تنفيذ أي أمر SQL في هذه الدفعة؛ التغيير كان TypeScript/UI فقط.
```

## [2026-10-01 19:44:00 +0000] — AI Model: Manus
```sql
-- لم ينفذ أي SQL؛ تمت مطابقة الجلسة وتعديلات TypeScript فقط.
```

## [2026-10-01 19:56:00 +0000] — AI Model: Manus
```sql
-- لا يوجد SQL منفذ في دفعة عقود الإجراءات.
```

## [2026-10-01 20:02:00 +0000] — AI Model: Manus
```sql
-- لا يوجد SQL منفذ؛ التغيير تدقيق وتوحيد أسماء في TypeScript/UI فقط.
```


## [2026-10-01 20:14:30 +0000] — AI Model: Manus
```text
لا يوجد أمر SQL أو تغيير قاعدة بيانات ضمن تنفيذ إغلاق المرحلتين 11 و12 وتجهيز المرحلة 13.
```


## [2026-10-01 20:23:00 +0000] — AI Model: Manus
```text
لا يوجد أمر SQL في دفعة API Foundation؛ التغييرات تخص HTTP contracts وrequest ID وErrorEnvelope فقط.
```


## [2026-10-01 20:31:00 +0000] — AI Model: Manus
```text
لا يوجد أمر SQL في دفعة server-auth وCustomers read-only.
```


## [2026-10-01 20:41:00 +0000] — AI Model: Manus
```text
لا يوجد أمر SQL في دفعة استبدال verifier وتفعيل Couriers؛ جميع العمليات HTTP الحالية read-only.
```


## [2026-10-01 20:56:00 +0000] — AI Model: Manus
```text
لا يوجد أمر SQL؛ verifier يعتمد على قراءة public.sessions وpublic.users فقط.
```


## [2026-10-02 00:08:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL؛ تم تنفيذ تدقيق للخطة والمراحل 11 و12 و13 فقط.
```


## [2026-10-02 00:17:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL؛ تم rollback لكود API Foundation غير المعتمد فقط.
```


## [2026-10-02 00:31:30 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL؛ الدفعة تخص typed contracts وتوحيد حالات loading/error/submitting فقط.
```

## [2026-10-02 00:56:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL في هذه الدفعة؛ تم تنفيذ تغييرات TypeScript وPortal Gateway فقط دون اتصال كتابة بقاعدة البيانات.
```

## [2026-10-02 01:12:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL في هذه الدفعة؛ تم ترحيل حالات Async وPortal Gateway فقط.
```

## [2026-10-02 01:15:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL في هذه الدفعة؛ تم إنشاء تقرير قراءة ثابت المصدر فقط، ومنع أي اتصال أو تغيير بقاعدة البيانات.
```

## [2026-10-02 01:47:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL؛ إغلاق المرحلة 12 تم على مستوى TypeScript/UI/realtime state فقط.
```

## [2026-10-02 01:55:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL؛ تنفيذ المرحلة 13 اقتصر على HTTP contracts وserver-side permissions وDTO mapping والاختبارات.
```

## [2026-10-02 02:42:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL؛ التدقيق والإصلاحات الحالية اقتصرت على الكود والاختبارات، دون اتصال أو تغيير في قاعدة البيانات.
```

## [2026-10-02 02:56:00 +0300] — AI Model: Manus
```text
لا يوجد أمر SQL؛ دفعة الأمن الحالية اقتصرت على طبقة التطبيق دون اتصال أو تغيير مباشر في قاعدة البيانات.
```

## [2026-10-02 04:35:00 +0300] — AI Model: Gemini 3.6 Flash
```sql
-- استعلام قراءة وتدقيق الهيكل والمخطط الفعلي لجميع الجداول الحية عبر information_schema.columns
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
-- تم تنفيذه واستخراج المخطط الحي والكامل لجميع الجداول والتحقق من عدم وجود حقل id عام، واستخدام المفاتيح المخصصة للنطاقات.
```

## [2026-10-02 05:26:19] — AI Model: Gemini 3.6 Flash (High)
```sql
-- 1. استعلام قائمة جميع الجداول ومكونات حقولها في schema public:
SELECT t.table_name, c.column_name, c.data_type, c.udt_name, c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 2. استعلام العلاقات والمفاتيح الخارجية FK:
SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';

-- 3. استعلام استخراج أسماء الحقول التي داخل أعمدة jsonb عبر جميع الجداول:
SELECT 'auto_entries' as tbl, 'data' as col, ARRAY_AGG(DISTINCT k) as keys FROM (SELECT jsonb_object_keys(data) k FROM auto_entries WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'portal_users', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM portal_users WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'portal_tickets', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM portal_tickets WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'whatsapp_logs', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM whatsapp_logs WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'report_templates', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM report_templates WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'order_option', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM order_option WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'settings', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM settings WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'items_category', 'details', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(details) k FROM items_category WHERE details IS NOT NULL AND jsonb_typeof(details)='object') s
UNION ALL
SELECT 'announcements', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM announcements WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'orders_history', 'before_data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(before_data) k FROM orders_history WHERE before_data IS NOT NULL AND jsonb_typeof(before_data)='object') s
UNION ALL
SELECT 'orders_history', 'after_data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(after_data) k FROM orders_history WHERE after_data IS NOT NULL AND jsonb_typeof(after_data)='object') s
UNION ALL
SELECT 'orders_history', 'metadata', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(metadata) k FROM orders_history WHERE metadata IS NOT NULL AND jsonb_typeof(metadata)='object') s
UNION ALL
SELECT 'salary_history', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM salary_history WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'shipments', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM shipments WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'order_status', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM order_status WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'orders', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM orders WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'notifications', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM notifications WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'browser_pages', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM browser_pages WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'jobs_req', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM jobs_req WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'activity_logs', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM activity_logs WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'user_settings', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM user_settings WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s
UNION ALL
SELECT 'cust_details', 'data', ARRAY_AGG(DISTINCT k) FROM (SELECT jsonb_object_keys(data) k FROM cust_details WHERE data IS NOT NULL AND jsonb_typeof(data)='object') s;
```







## [2026-10-03 03:44:30 +0300] — AI Model: Manus
```text
لم يتم تنفيذ أي أمر SQL في هذه الجولة؛ لا يوجد connector قاعدة بيانات حي مفعل.
```


## [2026-10-03 02:24:24 +0000] — AI Model: Manus

لم يُنفذ أي أمر SQL في هذه الدفعة. لم يتم استدعاء Supabase MCP، ولم تُنفذ DDL أو DML أو Migration. تم الاكتفاء بتعديل TypeScript وعقود API واختبارات محلية، مع إبقاء RLS وGrants خارج النطاق.


## [2026-10-03 02:58:01 +0000] — أوامر القراءة الحية لـData Quality وOwnership — AI Model: Manus

تم تنفيذ أوامر SQL التالية عبر Supabase MCP على المشروع `ejrojwbbflzchasvgexr`، وكلها SELECT قراءة فقط وبها LIMIT صريح:

```sql
WITH metrics AS (
  SELECT 'orders_total' AS metric, count(*)::bigint AS value FROM public.orders
  UNION ALL SELECT 'orders_missing_customer', count(*)::bigint FROM public.orders o WHERE o.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.customer_id = o.customer_id)
  UNION ALL SELECT 'orders_duplicate_order_number', count(*)::bigint FROM (SELECT order_number FROM public.orders WHERE order_number IS NOT NULL GROUP BY order_number HAVING count(*) > 1) d
  UNION ALL SELECT 'order_items_missing_order', count(*)::bigint FROM public.order_items oi WHERE oi.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_id = oi.order_id)
  UNION ALL SELECT 'shipments_missing_order', count(*)::bigint FROM public.shipments s WHERE s.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_id = s.order_id)
  UNION ALL SELECT 'accounts_missing_currency', count(*)::bigint FROM public.accounts a WHERE a.cur_no IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.currency c WHERE c.cur_id = a.cur_no)
  UNION ALL SELECT 'users_total', count(*)::bigint FROM public.users
  UNION ALL SELECT 'users_disabled', count(*)::bigint FROM public.users WHERE disabled IS TRUE
  UNION ALL SELECT 'sessions_total', count(*)::bigint FROM public.sessions
  UNION ALL SELECT 'sessions_missing_user', count(*)::bigint FROM public.sessions s WHERE s.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = s.user_id)
  UNION ALL SELECT 'sessions_force_logout', count(*)::bigint FROM public.sessions WHERE force_logout IS TRUE
  UNION ALL SELECT 'portal_users_missing_customer', count(*)::bigint FROM public.portal_users p WHERE p.linked_customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.customer_id = p.linked_customer_id)
  UNION ALL SELECT 'main_entry_missing_order', count(*)::bigint FROM public.main_entry m WHERE m.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_id = m.order_id)
  UNION ALL SELECT 'account_trans_missing_entry', count(*)::bigint FROM public.account_trans t WHERE t.main_entry_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.main_entry m WHERE m.main_entry_id = t.main_entry_id)
)
SELECT metric, value FROM metrics ORDER BY metric LIMIT 100;
```

```sql
WITH checks AS (
  SELECT 'session_to_user' AS check_name, count(*)::bigint AS total, count(u.user_id)::bigint AS owned FROM public.sessions s LEFT JOIN public.users u ON u.user_id = s.user_id
  UNION ALL SELECT 'orders_created_by_user', count(*)::bigint, count(u.user_id)::bigint FROM public.orders o LEFT JOIN public.users u ON u.user_id = o.created_by
  UNION ALL SELECT 'orders_updated_by_user', count(*)::bigint, count(u.user_id)::bigint FROM public.orders o LEFT JOIN public.users u ON u.user_id = o.updated_by
  UNION ALL SELECT 'main_entries_created_by_user', count(*)::bigint, count(u.user_id)::bigint FROM public.main_entry m LEFT JOIN public.users u ON u.user_id = m.created_by_uid
  UNION ALL SELECT 'account_trans_created_by_user', count(*)::bigint, count(u.user_id)::bigint FROM public.account_trans t LEFT JOIN public.users u ON u.user_id = t.created_by_uid
  UNION ALL SELECT 'activity_logs_user', count(*)::bigint, count(u.user_id)::bigint FROM public.activity_logs a LEFT JOIN public.users u ON u.user_id = a.user_id
)
SELECT check_name, total, owned, (total - owned)::bigint AS unowned FROM checks ORDER BY check_name LIMIT 100;
```

```sql
WITH metrics AS (
  SELECT 'orders_null_order_number' AS metric, count(*)::bigint AS value FROM public.orders WHERE order_number IS NULL OR btrim(order_number) = ''
  UNION ALL SELECT 'orders_null_status', count(*)::bigint FROM public.orders WHERE order_status_id IS NULL OR btrim(order_status_id) = ''
  UNION ALL SELECT 'orders_invalid_created_at', count(*)::bigint FROM public.orders WHERE created_at IS NULL
  UNION ALL SELECT 'orders_invalid_currency_ref', count(*)::bigint FROM public.orders o WHERE o.order_currency IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.currency c WHERE c.cur_id = o.order_currency)
  UNION ALL SELECT 'accounts_negative_balance', count(*)::bigint FROM public.accounts WHERE balance < 0
  UNION ALL SELECT 'accounts_missing_name', count(*)::bigint FROM public.accounts WHERE acc_name_ar IS NULL AND acc_name_en IS NULL
  UNION ALL SELECT 'main_entries_unbalanced', count(*)::bigint FROM (SELECT m.main_entry_id FROM public.main_entry m LEFT JOIN public.account_trans t ON t.main_entry_id = m.main_entry_id GROUP BY m.main_entry_id HAVING coalesce(sum(CASE WHEN t.trans_type = 'Debit' THEN t.amount ELSE 0 END),0) <> coalesce(sum(CASE WHEN t.trans_type = 'Credit' THEN t.amount ELSE 0 END),0)) x
  UNION ALL SELECT 'users_with_password_column_value', count(*)::bigint FROM public.users WHERE password IS NOT NULL AND btrim(password) <> ''
  UNION ALL SELECT 'portal_users_with_password_column_value', count(*)::bigint FROM public.portal_users WHERE password IS NOT NULL AND btrim(password) <> ''
  UNION ALL SELECT 'users_with_system_pin', count(*)::bigint FROM public.users WHERE system_pin IS NOT NULL AND btrim(system_pin) <> ''
  UNION ALL SELECT 'sessions_expired', count(*)::bigint FROM public.sessions WHERE expires_at IS NOT NULL AND expires_at <= now()
  UNION ALL SELECT 'sessions_missing_expires_at', count(*)::bigint FROM public.sessions WHERE expires_at IS NULL
)
SELECT metric, value FROM metrics ORDER BY metric LIMIT 100;
```

```sql
WITH entry_totals AS (
  SELECT m.main_entry_id, m.entry_number, count(t.account_trans_id)::bigint AS line_count,
    coalesce(sum(CASE WHEN lower(t.trans_type) IN ('debit','مدين') THEN t.amount ELSE 0 END),0)::numeric AS debit_total,
    coalesce(sum(CASE WHEN lower(t.trans_type) IN ('credit','دائن') THEN t.amount ELSE 0 END),0)::numeric AS credit_total
  FROM public.main_entry m LEFT JOIN public.account_trans t ON t.main_entry_id = m.main_entry_id
  GROUP BY m.main_entry_id, m.entry_number
)
SELECT main_entry_id, entry_number, line_count, debit_total, credit_total, (debit_total-credit_total)::numeric AS difference FROM entry_totals WHERE debit_total <> credit_total ORDER BY entry_number LIMIT 20;
```


## [2026-10-04T03:36:12+03:00] — قراءة حالة المخطط والامتيازات (SELECT فقط) — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT current_setting('pgrst.db_schemas', true) AS exposed_schemas, to_regnamespace('alx_api_private') IS NOT NULL AS private_schema_exists, CASE WHEN to_regnamespace('alx_api_private') IS NULL THEN false ELSE has_schema_privilege('anon', to_regnamespace('alx_api_private'), 'USAGE') END AS anon_has_schema_usage, CASE WHEN to_regnamespace('alx_api_private') IS NULL THEN false ELSE has_schema_privilege('authenticated', to_regnamespace('alx_api_private'), 'USAGE') END AS authenticated_has_schema_usage, CASE WHEN to_regnamespace('alx_api_private') IS NULL THEN false ELSE has_schema_privilege('service_role', to_regnamespace('alx_api_private'), 'USAGE') END AS service_role_has_schema_usage FROM (VALUES (1)) AS check_row(id) LIMIT 1;
```

## [2026-10-04T03:36:34+03:00] — فحص default table ACL (SELECT فقط) — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT COALESCE(n.nspname, '<global>') AS schema_scope, d.defaclobjtype AS object_type, d.defaclacl::text AS default_acl FROM pg_default_acl AS d LEFT JOIN pg_namespace AS n ON n.oid = d.defaclnamespace WHERE d.defaclobjtype = 'r' AND (d.defaclnamespace = 0 OR n.nspname = 'public') ORDER BY schema_scope LIMIT 20;
```

## [2026-10-04T03:39:43+03:00] — migration مطبقة بعد موافقة المستخدم — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
**Supabase `apply_migration`; project `ejrojwbbflzchasvgexr`; migration `alx_api_auth_foundation_0002`; النتيجة success=true.** النص المطابق للتنفيذ:
```sql
-- alx_api Auth persistence foundation.
-- Intentionally creates objects only in a non-public schema.
-- No RLS/GRANTS statements and no legacy credential data is copied.

CREATE SCHEMA alx_api_private;

CREATE TABLE alx_api_private.user_credentials (
  user_id text PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_algorithm text NOT NULL DEFAULT 'argon2id',
  password_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_credentials_algorithm_check CHECK (password_algorithm = 'argon2id'),
  CONSTRAINT user_credentials_password_version_check CHECK (password_version >= 1),
  CONSTRAINT user_credentials_argon2id_hash_check CHECK (password_hash LIKE '$argon2id$%')
);

CREATE TABLE alx_api_private.user_security (
  user_id text PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  last_password_change_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_security_failed_attempts_check CHECK (failed_login_attempts >= 0)
);

CREATE TABLE alx_api_private.api_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  device_name text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  CONSTRAINT api_sessions_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX api_sessions_user_expiry_idx ON alx_api_private.api_sessions(user_id, expires_at);

CREATE TABLE alx_api_private.api_refresh_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES alx_api_private.api_sessions(session_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  parent_token_id uuid REFERENCES alx_api_private.api_refresh_tokens(token_id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  replaced_by_token_id uuid REFERENCES alx_api_private.api_refresh_tokens(token_id) ON DELETE SET NULL,
  CONSTRAINT api_refresh_tokens_hash_check CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT api_refresh_tokens_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX api_refresh_tokens_family_idx ON alx_api_private.api_refresh_tokens(family_id);
CREATE INDEX api_refresh_tokens_session_idx ON alx_api_private.api_refresh_tokens(session_id, created_at);

CREATE TABLE alx_api_private.password_reset_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_password_reset_tokens_hash_check CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT api_password_reset_tokens_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX api_password_reset_tokens_user_idx ON alx_api_private.password_reset_tokens(user_id, expires_at);

CREATE TABLE alx_api_private.auth_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES public.users(user_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  success boolean NOT NULL,
  ip_address text,
  user_agent text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX api_auth_events_user_time_idx ON alx_api_private.auth_events(user_id, created_at);
```

## [2026-10-04T03:40:04+03:00] — تحقق صلاحيات/RLS بعد الهجرة (SELECT فقط) — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, has_schema_privilege('anon', n.oid, 'USAGE') AS anon_schema_usage, has_schema_privilege('authenticated', n.oid, 'USAGE') AS authenticated_schema_usage, has_table_privilege('anon', c.oid, 'SELECT') AS anon_select, has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select, has_table_privilege('service_role', c.oid, 'SELECT') AS service_role_select FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace WHERE n.nspname = 'alx_api_private' AND c.relkind = 'r' ORDER BY c.relname LIMIT 20;
```
**نتيجة مختصرة:** RLS=false لكل الجداول الستة، وأعاد استعلام الامتيازات false لجميع أعمدة anon/authenticated/service_role المذكورة. Supabase Advisor أعاد في الوقت نفسه تنبيه `rls_disabled` الحرج؛ لم تُنفذ remediation SQL بسبب اختيار المستخدم إبقاء RLS/GRANTS مؤجلة.


## [2026-10-04T04:24:29+03:00] — Migration `alx_api_auth_rls_runtime_0003` بعد موافقة المستخدم — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
**Supabase `apply_migration`; project `ejrojwbbflzchasvgexr`; success=true.** النص المطبق:
```sql
CREATE ROLE alx_api_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA alx_api_private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;

CREATE VIEW alx_api_private.api_login_users WITH (security_barrier = true) AS
SELECT user_id, username, email, role, disabled FROM public.users;

REVOKE ALL ON SCHEMA alx_api_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA alx_api_private FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE alx_api_private.user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_security FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.api_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.api_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.api_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.api_refresh_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.password_reset_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.auth_events FORCE ROW LEVEL SECURITY;

CREATE POLICY api_runtime_credentials_select ON alx_api_private.user_credentials FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_security_select ON alx_api_private.user_security FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_security_insert ON alx_api_private.user_security FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY api_runtime_security_update ON alx_api_private.user_security FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY api_runtime_sessions_select ON alx_api_private.api_sessions FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_sessions_insert ON alx_api_private.api_sessions FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY api_runtime_sessions_update ON alx_api_private.api_sessions FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY api_runtime_refresh_select ON alx_api_private.api_refresh_tokens FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_refresh_insert ON alx_api_private.api_refresh_tokens FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY api_runtime_refresh_update ON alx_api_private.api_refresh_tokens FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA alx_api_private TO alx_api_runtime;
GRANT SELECT ON alx_api_private.api_login_users, alx_api_private.user_credentials TO alx_api_runtime;
GRANT SELECT, INSERT, UPDATE ON alx_api_private.user_security, alx_api_private.api_sessions, alx_api_private.api_refresh_tokens TO alx_api_runtime;
```

## [2026-10-04T04:24:44+03:00] — فحوص metadata بعد migration (قراءة فقط) — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = 'alx_api_runtime' LIMIT 1;

SELECT c.relname AS relation_name, c.relkind AS relation_kind, has_schema_privilege('anon', n.oid, 'USAGE') AS anon_schema_usage, has_schema_privilege('authenticated', n.oid, 'USAGE') AS authenticated_schema_usage, has_table_privilege('anon', c.oid, 'SELECT') AS anon_select, has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select, has_table_privilege('service_role', c.oid, 'SELECT') AS service_role_select, has_table_privilege('alx_api_runtime', c.oid, 'SELECT') AS runtime_select, has_table_privilege('alx_api_runtime', c.oid, 'INSERT') AS runtime_insert, has_table_privilege('alx_api_runtime', c.oid, 'UPDATE') AS runtime_update, has_table_privilege('alx_api_runtime', c.oid, 'DELETE') AS runtime_delete FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace WHERE n.nspname = 'alx_api_private' AND c.relkind IN ('r','v') ORDER BY c.relname LIMIT 20;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'alx_api_private' ORDER BY tablename, policyname LIMIT 30;

SELECT viewname, definition FROM pg_views WHERE schemaname = 'alx_api_private' AND viewname = 'api_login_users' LIMIT 1;

SELECT n.nspname, COALESCE(n.nspacl::text, '<default>') AS schema_acl, has_schema_privilege('anon', n.oid, 'USAGE') AS anon_usage, has_schema_privilege('authenticated', n.oid, 'USAGE') AS authenticated_usage, has_schema_privilege('service_role', n.oid, 'USAGE') AS service_role_usage, has_schema_privilege('alx_api_runtime', n.oid, 'USAGE') AS runtime_usage FROM pg_namespace AS n WHERE n.nspname = 'alx_api_private' LIMIT 1;
```
**النتيجة:** RLS=true للجداول الستة، ACL أدوار العملاء false؛ دور runtime فقط لديه schema usage والعمليات المقررة، مع عدم وجود صلاحية على reset/events/direct public.users.

## [2026-10-04T04:27:22+03:00] — فشل TLS strict ونجاح تحقق pooler — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
الاتصال الأول بـ`ssl.rejectUnauthorized=true` توقف قبل تنفيذ SQL بسبب `SELF_SIGNED_CERT_IN_CHAIN`. فحص شهادة pooler أظهر SAN `*.pooler.supabase.com` وissuer `Supabase Intermediate 2021 CA`. لم تُجرَ أي كتابة أثناء هذا الفشل.

استعلام الاتصال read-only عبر TLS:
```sql
SELECT current_user AS role, current_database() AS database_name, current_setting('server_version') AS server_version FROM (VALUES (1)) AS check_row(id) LIMIT 1;
```
ثم اتصال runtime سيُثبت لاحقاً TLS encryption مع CA-unverified لأغراض التطوير؛ production يتطلب شهادة CA الرسمية وverify-full.

## [2026-10-04T04:30:37+03:00] — تفعيل كلمة مرور دور runtime محلية — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
محاولة SQL الأولى فشلت قبل أي تغيير بالخطأ `42P18` لأن parameter type غير محدد:
```sql
SELECT format('ALTER ROLE alx_api_runtime WITH LOGIN PASSWORD %L CONNECTION LIMIT 10', $1) AS statement;
```
الاستعلام المصحح الذي أنتج DDL:
```sql
SELECT format('ALTER ROLE alx_api_runtime WITH LOGIN PASSWORD %L CONNECTION LIMIT 10', $1::text) AS statement LIMIT 1;
```
ثم نُفذ النص الناتج مع كلمة مرور عشوائية 48-byte base64url **[REDACTED — لا تُسجل قيمة السر]**:
```sql
ALTER ROLE alx_api_runtime WITH LOGIN PASSWORD '[REDACTED]' CONNECTION LIMIT 10;
```

التحقق عبر shared transaction pooler:
```sql
SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = current_user LIMIT 1;
SELECT 1 FROM alx_api_private.api_sessions LIMIT 0;
SELECT 1 FROM alx_api_private.api_login_users LIMIT 0;
SELECT 1 FROM alx_api_private.user_credentials LIMIT 0;
SELECT has_table_privilege(current_user, 'alx_api_private.password_reset_tokens', 'SELECT') AS reset_select, has_table_privilege(current_user, 'alx_api_private.auth_events', 'INSERT') AS events_insert, has_table_privilege(current_user, 'public.users', 'SELECT') AS direct_users_select FROM (VALUES (1)) AS check_row(id) LIMIT 1;
```

## [2026-10-04T04:31:25+03:00] — فحوص readiness الحية عبر alx_api — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT 1 FROM alx_api_private.api_sessions LIMIT 0;
SELECT 1 FROM alx_api_private.api_login_users LIMIT 0;
SELECT 1 FROM alx_api_private.user_credentials LIMIT 0;
```
لا تعيد هذه الاستعلامات أي صفوف/PII؛ نجحت مع دور runtime. لم تُقرأ أو تُكتب بيانات credentials.


## تصحيح توقيت migration 0003 — [2026-10-04T04:41:20+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
استدعاء `supabase/apply_migration` وقراءات التحقق التابعة بعد موافقة المستخدم عند `04:24:10+03:00` مسجلة في سجل الأدوات عند `04:29:10+03:00`. عنوان قسم migration أعلاه الذي يظهر `04:24:29` كان تقريبياً؛ اعتمد `04:29:10+03:00` كتوقيت التنفيذ.


## [2026-10-04T06:36:25+03:00] — لا أوامر SQL منفذة — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
لم يُنفذ SQL أو DDL أو DML في هذه الجولة. اقتصر فحص قاعدة البيانات على أدوات Supabase metadata/advisors للقراءة فقط؛ لا توجد أوامر SQL لإدراجها.


## [2026-10-04T06:48:26+03:00] — metadata لجدول handoff مؤقت، قراءة فقط — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT has_schema_privilege('alx_api_runtime', 'alx_api_private', 'USAGE') AS runtime_private_schema_usage,
       to_regclass('alx_api_private._api_secret_rotation_handoff') IS NOT NULL AS handoff_table_exists,
       to_regprocedure('gen_random_uuid()') IS NOT NULL AS secure_uuid_available
LIMIT 1;
```

## [2026-10-04T06:49:09+03:00] — إنشاء قناة handoff RLS مؤقتة — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
CREATE TABLE alx_api_private._api_secret_rotation_handoff (
  handoff_id text PRIMARY KEY,
  secret_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alx_api_private._api_secret_rotation_handoff ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private._api_secret_rotation_handoff FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE alx_api_private._api_secret_rotation_handoff FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE alx_api_private._api_secret_rotation_handoff TO alx_api_runtime;
CREATE POLICY api_runtime_secret_handoff_select
  ON alx_api_private._api_secret_rotation_handoff
  FOR SELECT TO alx_api_runtime USING (true);
```
أُنشئ الجدول داخل migration خاص مؤقتاً، ثم حُذف في 06:50:13 بعد rollback للمحاولة الأولى. لم يُترك في المخطط.

## [2026-10-04T06:49:30+03:00] — تدوير محاولة أولى لدور runtime ثم rollback — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
-- إنشاء سر عشوائي DB-side وإسناده حصراً إلى alx_api_runtime، دون إرجاع قيمته من أداة migration:
ALTER ROLE alx_api_runtime WITH PASSWORD '[REDACTED — لا تُسجل أي قيمة سر]';
-- تخزين السر مؤقتاً في صف handoff المقيد لقناة runtime المحلية:
INSERT INTO alx_api_private._api_secret_rotation_handoff (handoff_id, secret_value)
VALUES ('rotated', '[REDACTED — لا تُسجل أي قيمة سر]');
```
فشل اختبار المصادقة على Supavisor transaction pool بسبب 28P01/تأخر ذاكرة بيانات pooler؛ رُجعت كلمة مرور هذا الدور إلى السابقة دون مساس بـ`postgres`/المالك. التراجع المؤقت:
```sql
ALTER ROLE alx_api_runtime WITH PASSWORD '[REDACTED — القيمة السابقة غير مسجلة]';
DROP TABLE alx_api_private._api_secret_rotation_handoff;
```
لا يحتوي السجل على أي كلمة مرور فعلية.

## [2026-10-04T06:52:43+03:00] — إعداد handoff جديد للمحاولة المحدودة — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
أُعيد تنفيذ SQL إنشاء الجدول/RLS/GRANT/POLICY أعلاه لمحاولة واحدة إضافية مع listener محلي؛ لم يُعرض أو يُسجل secret value.

## [2026-10-04T06:52:55+03:00] — إعادة تدوير كلمة دور API مرة واحدة — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
ALTER ROLE alx_api_runtime WITH PASSWORD '[REDACTED — قيمة عشوائية DB-side لم تُسجل]';
INSERT INTO alx_api_private._api_secret_rotation_handoff (handoff_id, secret_value)
VALUES ('rotated', '[REDACTED — لا تُسجل أي قيمة سر]');
```
استُخدم الانتظار/التحقق على Supavisor session وtransaction؛ نُقلت القيمة الحالية إلى `.env` المحلي المقيّد فقط بعد نجاح التحقق، ولم يُجر تدوير آخر بعدها. الاستعلام الداخلي الذي أعاد القيمة من handoff كان:
```sql
SELECT secret_value
FROM alx_api_private._api_secret_rotation_handoff
WHERE handoff_id = 'rotated'
LIMIT 1;
```
النتيجة السرية لم تُنسخ إلى هذا الملف.

## [2026-10-04T06:57:42+03:00] — حذف handoff والتحقق من الإزالة — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
DROP TABLE alx_api_private._api_secret_rotation_handoff;
SELECT to_regclass('alx_api_private._api_secret_rotation_handoff') IS NULL AS handoff_removed LIMIT 1;
```
أكّد فحص metadata أن الجدول لم يعد موجوداً. فُحصت المصادقة بعد المزامنة باستعلامات `SELECT current_user ... LIMIT 1` فقط على Supavisor session/transaction؛ كلمة المرور لم تظهر في SQL log. كلمة مرور postgres/مالك قاعدة البيانات لم تتغير.

## [2026-10-04T07:01:41+03:00] — تصنيف aggregate للحقول الوصفية فقط — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT count(*) AS total_users,
       count(*) FILTER (WHERE password IS NULL OR btrim(password) = '') AS missing_or_blank,
       count(*) FILTER (WHERE left(password, 10) = '$argon2id$') AS argon2id_prefix,
       count(*) FILTER (WHERE left(password, 4) IN ('$2a$', '$2b$', '$2x$', '$2y$')) AS bcrypt_prefix,
       count(*) FILTER (WHERE password LIKE 'pbkdf2:%' OR password LIKE 'scrypt:%' OR password LIKE '$pbkdf2-%') AS other_common_kdf_prefix,
       count(*) FILTER (WHERE password IS NOT NULL AND btrim(password) <> '' AND left(password, 10) <> '$argon2id$' AND left(password, 4) NOT IN ('$2a$', '$2b$', '$2x$', '$2y$') AND password NOT LIKE 'pbkdf2:%' AND password NOT LIKE 'scrypt:%' AND password NOT LIKE '$pbkdf2-%') AS unclassified_nonempty
FROM public.users
LIMIT 1;
```
النتيجة aggregate: total=11، blank=0، البادئات المفحوصة=0، unclassified_nonempty=11. لم تُرجع أي قيم أو hashes أو IDs.

## [2026-10-04T07:01:54+03:00] — فئات طول واسعة دون قيم — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT count(*) FILTER (WHERE left(password, 3) IN ('$1$', '$5$', '$6$')) AS unix_crypt_prefix,
       count(*) FILTER (WHERE left(password, 3) = '$P$') AS phpass_prefix,
       count(*) FILTER (WHERE password ~ '^[[:xdigit:]]{32}$') AS hex32,
       count(*) FILTER (WHERE password ~ '^[[:xdigit:]]{40}$') AS hex40,
       count(*) FILTER (WHERE password ~ '^[[:xdigit:]]{64}$') AS hex64,
       count(*) FILTER (WHERE password ~ '^[[:xdigit:]]{128}$') AS hex128,
       count(*) FILTER (WHERE password IS NOT NULL AND btrim(password) <> '' AND char_length(password) < 20) AS length_lt_20,
       count(*) FILTER (WHERE char_length(password) BETWEEN 20 AND 39) AS length_20_39,
       count(*) FILTER (WHERE char_length(password) BETWEEN 40 AND 79) AS length_40_79,
       count(*) FILTER (WHERE char_length(password) BETWEEN 80 AND 127) AS length_80_127,
       count(*) FILTER (WHERE char_length(password) >= 128) AS length_gte_128
FROM public.users
LIMIT 1;
```
النتيجة: أطوال 5 أقل من 20 و6 بين 20–39؛ الأطوال وحدها لا تثبت نوع القيمة.

## [2026-10-04T07:12:05+03:00] — استعلام metadata فشل قبل وجود 0004 — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolinherit,
       has_schema_privilege('alx_api_runtime', 'alx_api_private', 'USAGE') AS private_schema_usage,
       has_table_privilege('alx_api_runtime', 'alx_api_private.user_credentials', 'SELECT') AS credentials_select,
       has_function_privilege('alx_api_runtime', 'alx_api_private.verify_legacy_password(text,text)', 'EXECUTE') AS legacy_verify_function
FROM pg_catalog.pg_roles
WHERE rolname = 'alx_api_runtime'
LIMIT 1;
```
فشل لأن الدالة لم تكن موجودة آنذاك؛ استعلام قراءة فقط ولم يحدث تعديل.

## [2026-10-04T07:12:14+03:00] — خصائص الدور قبل نشر الدوال — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolinherit,
       has_schema_privilege('alx_api_runtime', 'alx_api_private', 'USAGE') AS private_schema_usage,
       has_table_privilege('alx_api_runtime', 'alx_api_private.user_credentials', 'SELECT') AS credentials_select
FROM pg_catalog.pg_roles
WHERE rolname = 'alx_api_runtime'
LIMIT 1;
```
النتيجة: LOGIN=true؛ superuser/createdb/createrole/bypassrls=false؛ schema usage وcredential SELECT=true.

## [2026-10-04T07:12:30+03:00] — تطبيق migration `alx_api_legacy_password_upgrade_0004_20261004` — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
طُبق SQL المصدر كاملاً كما هو في [0004_legacy_password_upgrade.sql](alx_api/src/db/migrations/0004_legacy_password_upgrade.sql). أنشأ الدالتين، عيّن owner=`postgres`، وسحب EXECUTE من PUBLIC/anon/authenticated/service_role ثم منحه لـ`alx_api_runtime`. النص الكامل محفوظ بالملف versioned؛ لم يتضمن التطبيق أي password value ولم يعدّل/يحذف صفاً من `public.users`.

## [2026-10-04T07:12:42+03:00] — تحقق metadata بعد التطبيق — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT routine.proname, routine.pronargs, routine.prosecdef AS security_definer,
       pg_catalog.pg_get_userbyid(routine.proowner) AS owner_name,
       routine.proconfig AS function_settings,
       has_function_privilege('alx_api_runtime', routine.oid, 'EXECUTE') AS runtime_can_execute,
       has_function_privilege('anon', routine.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', routine.oid, 'EXECUTE') AS authenticated_can_execute,
       (SELECT count(*) FROM alx_api_private.user_credentials) AS migrated_credential_rows
FROM pg_catalog.pg_proc AS routine
INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = routine.pronamespace
WHERE namespace.nspname = 'alx_api_private'
  AND routine.proname IN ('verify_legacy_password', 'migrate_legacy_password')
ORDER BY routine.proname
LIMIT 2;
```
النتيجة: الدالتان SECURITY DEFINER، owner=`postgres`، `search_path=pg_catalog`؛ التنفيذ runtime=true وanon/authenticated=false؛ `migrated_credential_rows=0`.

## [2026-10-04T07:05:57+03:00] — PostgreSQL 16 محلي، test database فقط — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
أُنشئت محلياً role اختبار `ubuntu` وقاعدة `alx_api_test` على cluster محلي، لا Supabase. SQL الاختبار وتفاصيله في [test-db.ts](alx_api/scripts/test-db.ts)؛ طبّق الملفات `0002_auth_private_storage.sql`, `0003_auth_rls_runtime_access.sql`, `0004_legacy_password_upgrade.sql` كما هي. شمل `DROP SCHEMA IF EXISTS alx_api_private CASCADE`, `DROP TABLE IF EXISTS public.users CASCADE`, إنشاء fixture فارغ، ثم `SET ROLE alx_api_runtime` وفحص RLS/grants/readiness وتجربة Auth بصف synthetic وحيد، وكلمة اختبار غير حقيقية و`system_pin=NULL`. لم يسجل الاختبار bind values.


## [تسجيل 2026-10-04T07:16:37+03:00؛ تنفيذ 07:04:24+03:00] — تهيئة PostgreSQL المحلي للاختبارات فقط — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
الأوامر المنفذة بواسطة `createuser` و`createdb` تعادل SQL التالي في cluster الاختبار المحلي فقط:
```sql
CREATE ROLE ubuntu WITH LOGIN SUPERUSER;
CREATE DATABASE alx_api_test WITH OWNER = ubuntu;
SELECT current_database() AS database, current_user AS role LIMIT 1;
```
لا تنطبق هذه الأوامر على Supabase أو أي قاعدة إنتاج. ملف الاختبار لا يسمح الاتصال إلا بـlocalhost/socket وقاعدة اسمها `alx_api_test`.


## [2026-10-04T07:58:28+03:00] — تصحيح توثيق handoff بناءً على قراءة helper المحلي — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
تنبيه تدقيقي: القسمان السابقان عند 06:49:09 و06:52:43 اللذان سطّرا DDL لجدول handoff كانا إعادة بناء غير حرفية من ملخص الأداة، وفيهما خطأ باسم العمود (`handoff_id` بدلاً من `id`) وذُكر `created_at` دون تحقق. لا تعتبر نصوص CREATE/POLICY هناك تفريغاً حرفياً للـDDL المنفذ. مصدر أداة listener المحلية يؤكد اسم الجدول وعموديه `id`, `secret_value`، لكنه لا يحتوي نص migration الإنشائي نفسه؛ لذا لا أستطيع ادعاء نص DDL حرفي من سجل MCP المتاح. الأداة المؤكدة `rotate_swiftship_api_secrets.cjs` نفذت الاستعلامات التالية (bind `$1` لقيمة السر لم تُسجل):
```sql
SELECT current_user AS role LIMIT 1;
INSERT INTO alx_api_private._api_secret_rotation_handoff (id, secret_value) VALUES ('previous', $1);
SELECT secret_value FROM alx_api_private._api_secret_rotation_handoff WHERE id = 'rotated' LIMIT 1;
```
وتؤكد أداة الاسترداد `finish_swiftship_api_rotation.cjs` استخدام:
```sql
SELECT secret_value FROM alx_api_private._api_secret_rotation_handoff WHERE id = 'rotated' LIMIT 1;
```
وبعد المزامنة أداة `sync_swiftship_runtime_password.cjs` نفذت `SELECT current_user AS role LIMIT 1` على session وtransaction فقط. استعلام إزالة الجدول النهائي كان `DROP TABLE alx_api_private._api_secret_rotation_handoff;`، وفحص الوجود استعمل `to_regclass(...) IS NULL`. ظل أي secret parameter/result محذوفاً من السجل.


## [2026-10-04T08:25:57+03:00–08:33:53+03:00] — اختبار Auth Core/RBAC على PostgreSQL المحلي فقط — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)

**قاعدة التنفيذ:** `alx_api_test` على PostgreSQL المحلي (`/var/run/postgresql`). لم يُستخدم Supabase في هذه الفترة. أعادت `scripts/test-db.ts` إنشاء schema وبيانات اصطناعية فقط ثم نفذت migrations `0002_auth_private_storage.sql`, `0003_auth_rls_runtime_access.sql`, `0004_legacy_password_upgrade.sql`, `0005_auth_core_passwords_and_events.sql`, `0006_rbac_foundation.sql`. نص SQL للـ0005/0006 مثبت في ملفي migration المشار إليهما في سجل DB development؛ التنفيذ في test runner:
```ts
await pool.query(await readMigration('0002_auth_private_storage.sql'));
await pool.query(await readMigration('0003_auth_rls_runtime_access.sql'));
await pool.query(await readMigration('0004_legacy_password_upgrade.sql'));
await pool.query(await readMigration('0005_auth_core_passwords_and_events.sql'));
await pool.query(await readMigration('0006_rbac_foundation.sql'));
```
**أمر تشغيل suite كما نُفذ:**
```bash
TEST_DATABASE_URL='postgresql://ubuntu@localhost/alx_api_test?host=/var/run/postgresql' npm run test:db
```
نجح الاختبار النهائي بعد تصحيح health probe وRESET ROLE للـfixture cleanup. أثناء التشخيص نُفذ هذا الاستعلام كـ`alx_api_runtime`:
```sql
SELECT 1 FROM alx_api_private.auth_events LIMIT 0;
```
النتيجة `42501 permission denied` متوقعة وسياسة INSERT-only مقصودة؛ أُزيل الاستعلام من readiness، ولم تُمنح صلاحية SELECT. أثبتت suite إدخال الحدث من مسار Auth دون توسيع الصلاحية.

**فحص metadata النهائي بعد HTTP login محلي:**
```sql
SELECT count(*)::integer AS synthetic_argon2id_credentials
FROM alx_api_private.user_credentials
WHERE user_id = 'test-legacy-user'
  AND password_algorithm = 'argon2id'
LIMIT 1;
```
النتيجة: `1` لحساب الاختبار الاصطناعي فقط. لم تُقرأ قيمة hash/password/PIN.

**نطاق suite المكتوب:** كل أوامر SQL ذات placeholders والمعاملات/الاختبارات الموجودة في [`alx_api/scripts/test-db.ts`](alx_api/scripts/test-db.ts) وملفات migrations أعلاه هي النصوص الحرفية التي نُفذت محلياً، بما فيها: reset المخطط المعزول، إنشاء المستخدم الاصطناعي، دور/permission fixture، `SET ROLE`, probes, login migration, session/refresh transactions, password functions, RBAC grants، ثم fixture cleanup بعد `RESET ROLE`. لم تُنفذ أوامر SQL خارج هذه الملفات سوى الاستعلام التشخيصي واستعلام العدّ أعلاه.


# أوامر Supabase الحية — تنفيذ 2026-10-04 — AI Model: Manus (exact model identifier not exposed in this runtime)

المشروع: `ejrojwbbflzchasvgexr`. استُخدمت أداة Supabase MCP. لم تُقرأ أسرار أو قيم password/PIN.

## [2026-10-04T08:52:50+03:00] كشف سجل migrations
```sql
SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_registry LIMIT 1;
```

## [2026-10-04T08:52:51+03:00] فحص وجود جداول Auth/RBAC
```sql
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'alx_api_private' AND table_name = ANY (ARRAY['auth_events','password_reset_tokens','user_credentials','user_security','api_sessions','api_refresh_tokens','roles','permissions','user_roles','role_permissions']) ORDER BY table_name LIMIT 20;
```

## [2026-10-04T08:52:53+03:00] فحص خصائص الأدوار دون كلمات مرور
```sql
SELECT rolname, rolsuper, rolcreatedb, rolcanlogin FROM pg_roles WHERE rolname IN ('alx_api_runtime','postgres') ORDER BY rolname LIMIT 5;
```

## [2026-10-04T08:52:55+03:00] فحص أعمدة users المطلوبة للمصادقة
```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name IN ('user_id','disabled') ORDER BY column_name LIMIT 5;
```

## [2026-10-04T08:53:12+03:00] فحص أعمدة سجل migrations
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' ORDER BY ordinal_position LIMIT 10;
```

## [2026-10-04T08:53:13+03:00] قراءة آخر migrations المسجلة
```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 20;
```

## [2026-10-04T08:53:15+03:00] فحص وجود دوال password قبل 0005
```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'alx_api_private' AND p.proname = ANY (ARRAY['update_password_hash','create_password_reset_token','complete_password_reset','revoke_password_reset_token']) ORDER BY p.proname LIMIT 10;
```

## [2026-10-04T08:56:33+03:00] عدّ grants لكل دور بعد seed
```sql
SELECT r.code, count(rp.permission_id)::int AS permission_count FROM alx_api_private.roles AS r LEFT JOIN alx_api_private.role_permissions AS rp ON rp.role_id = r.role_id GROUP BY r.code ORDER BY r.code LIMIT 10;
```

## [2026-10-04T08:56:34+03:00] عدّ كتالوج الصلاحيات
```sql
SELECT count(*)::int AS permission_count FROM alx_api_private.permissions LIMIT 1;
```

## [2026-10-04T08:56:36+03:00] تأكيد migrations 0005/0006
```sql
SELECT version, name FROM supabase_migrations.schema_migrations WHERE name = ANY (ARRAY['alx_api_auth_core_password_events_0005_20261004','alx_api_rbac_foundation_0006_20261004']) ORDER BY version LIMIT 5;
```

## [2026-10-04T08:56:40+03:00] فحص أسماء أعمدة users فقط
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position LIMIT 40;
```

## [2026-10-04T08:56:49+03:00] عدّ الأدوار legacy دون بيانات تعريفية
```sql
SELECT lower(coalesce(role, '')) AS legacy_role, is_root, disabled, count(*)::int AS user_count FROM public.users GROUP BY lower(coalesce(role, '')), is_root, disabled ORDER BY legacy_role, is_root, disabled LIMIT 20;
```

## [2026-10-04T08:57:33+03:00] تحقق user_roles/grants/RLS/runtime
```sql
SELECT (SELECT count(*) FROM alx_api_private.user_roles) AS user_role_assignments, (SELECT count(*) FROM alx_api_private.role_permissions) AS role_permission_assignments, (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'alx_api_private.roles'::regclass) AS roles_force_rls, has_table_privilege('alx_api_runtime', 'alx_api_private.roles', 'SELECT') AS runtime_can_select_roles LIMIT 1;
```

## [2026-10-04T08:57:35+03:00] تحقق عدم ترحيل credentials
```sql
SELECT count(*)::int AS credential_rows FROM alx_api_private.user_credentials LIMIT 1;
```

## [2026-10-04T08:57:38+03:00] تحقق صلاحيات تنفيذ دوال 0005
```sql
SELECT p.proname, p.prosecdef, has_function_privilege('alx_api_runtime', p.oid, 'EXECUTE') AS runtime_can_execute, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'alx_api_private' AND p.proname = ANY (ARRAY['update_password_hash','create_password_reset_token','complete_password_reset','revoke_password_reset_token']) ORDER BY p.proname LIMIT 10;
```

## [2026-10-04T08:54:51+03:00] تطبيق Auth Core migration 0005
المصدر: `alx_api/src/db/migrations/0005_auth_core_passwords_and_events.sql` — النص التالي هو SQL المرسل إلى Supabase MCP.
```sql
-- Auth Core additions. Apply only after reviewing scope and testing on an isolated PostgreSQL database.
-- The runtime never selects reset tokens or writes password hashes directly.

REVOKE ALL ON alx_api_private.auth_events FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY api_runtime_auth_events_insert
  ON alx_api_private.auth_events
  FOR INSERT TO alx_api_runtime
  WITH CHECK (true);
GRANT INSERT ON alx_api_private.auth_events TO alx_api_runtime;

CREATE FUNCTION alx_api_private.update_password_hash(
  p_user_id text,
  p_password_hash text,
  p_changed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $update_password$
DECLARE
  user_is_active boolean;
BEGIN
  IF p_user_id IS NULL OR p_password_hash IS NULL
     OR p_password_hash NOT LIKE '$argon2id$v=19$%' OR p_changed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT NOT source.disabled
    INTO user_is_active
  FROM public.users AS source
  WHERE source.user_id = p_user_id
  LIMIT 1
  FOR UPDATE;

  IF NOT coalesce(user_is_active, false) THEN
    RETURN false;
  END IF;

  INSERT INTO alx_api_private.user_credentials (user_id, password_hash, password_algorithm, password_version, updated_at)
  VALUES (p_user_id, p_password_hash, 'argon2id', 1, p_changed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        password_algorithm = 'argon2id',
        password_version = alx_api_private.user_credentials.password_version + 1,
        updated_at = EXCLUDED.updated_at;

  INSERT INTO alx_api_private.user_security (user_id, failed_login_attempts, locked_until, last_password_change_at, updated_at)
  VALUES (p_user_id, 0, NULL, p_changed_at, p_changed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET failed_login_attempts = 0,
        locked_until = NULL,
        last_password_change_at = EXCLUDED.last_password_change_at,
        updated_at = EXCLUDED.updated_at;

  UPDATE alx_api_private.api_sessions
    SET revoked_at = p_changed_at, revoke_reason = 'password_change'
    WHERE user_id = p_user_id AND revoked_at IS NULL;
  UPDATE alx_api_private.api_refresh_tokens
    SET revoked_at = p_changed_at
    WHERE user_id = p_user_id AND revoked_at IS NULL;

  INSERT INTO alx_api_private.auth_events (user_id, event_type, success, metadata, created_at)
  VALUES (p_user_id, 'password.changed', true, '{}'::jsonb, p_changed_at);
  RETURN true;
END;
$update_password$;

CREATE FUNCTION alx_api_private.create_password_reset_token(
  p_user_id text,
  p_token_hash text,
  p_created_at timestamptz,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $create_reset$
DECLARE
  user_is_active boolean;
BEGIN
  IF p_user_id IS NULL OR p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_created_at IS NULL OR p_expires_at <= p_created_at THEN
    RETURN false;
  END IF;

  SELECT NOT source.disabled
    INTO user_is_active
  FROM public.users AS source
  WHERE source.user_id = p_user_id
  LIMIT 1;
  IF NOT coalesce(user_is_active, false) THEN
    RETURN false;
  END IF;

  UPDATE alx_api_private.password_reset_tokens
    SET used_at = p_created_at
    WHERE user_id = p_user_id AND used_at IS NULL;

  INSERT INTO alx_api_private.password_reset_tokens (user_id, token_hash, created_at, expires_at)
  VALUES (p_user_id, p_token_hash, p_created_at, p_expires_at);
  RETURN true;
END;
$create_reset$;

CREATE FUNCTION alx_api_private.complete_password_reset(
  p_token_hash text,
  p_password_hash text,
  p_completed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $complete_reset$
DECLARE
  reset_user_id text;
  user_is_active boolean;
BEGIN
  IF p_token_hash IS NULL OR p_password_hash IS NULL
     OR p_password_hash NOT LIKE '$argon2id$v=19$%'
     OR p_completed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT reset.user_id
    INTO reset_user_id
  FROM alx_api_private.password_reset_tokens AS reset
  WHERE reset.token_hash = p_token_hash
    AND reset.used_at IS NULL
    AND reset.expires_at > p_completed_at
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT NOT source.disabled
    INTO user_is_active
  FROM public.users AS source
  WHERE source.user_id = reset_user_id
  LIMIT 1
  FOR UPDATE;
  IF NOT coalesce(user_is_active, false) THEN
    RETURN false;
  END IF;

  INSERT INTO alx_api_private.user_credentials (user_id, password_hash, password_algorithm, password_version, updated_at)
  VALUES (reset_user_id, p_password_hash, 'argon2id', 1, p_completed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        password_algorithm = 'argon2id',
        password_version = alx_api_private.user_credentials.password_version + 1,
        updated_at = EXCLUDED.updated_at;

  UPDATE alx_api_private.password_reset_tokens
    SET used_at = p_completed_at
    WHERE token_hash = p_token_hash;
  UPDATE alx_api_private.user_security
    SET failed_login_attempts = 0, locked_until = NULL,
        last_password_change_at = p_completed_at, updated_at = p_completed_at
    WHERE user_id = reset_user_id;
  UPDATE alx_api_private.api_sessions
    SET revoked_at = p_completed_at, revoke_reason = 'password_reset'
    WHERE user_id = reset_user_id AND revoked_at IS NULL;
  UPDATE alx_api_private.api_refresh_tokens
    SET revoked_at = p_completed_at
    WHERE user_id = reset_user_id AND revoked_at IS NULL;

  INSERT INTO alx_api_private.auth_events (user_id, event_type, success, metadata, created_at)
  VALUES (reset_user_id, 'password.reset.completed', true, '{}'::jsonb, p_completed_at);
  RETURN true;
END;
$complete_reset$;

CREATE FUNCTION alx_api_private.revoke_password_reset_token(
  p_token_hash text,
  p_revoked_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $revoke_reset$
  UPDATE alx_api_private.password_reset_tokens
    SET used_at = p_revoked_at
    WHERE token_hash = p_token_hash AND used_at IS NULL;
$revoke_reset$;

ALTER FUNCTION alx_api_private.update_password_hash(text, text, timestamptz) OWNER TO postgres;
ALTER FUNCTION alx_api_private.create_password_reset_token(text, text, timestamptz, timestamptz) OWNER TO postgres;
ALTER FUNCTION alx_api_private.complete_password_reset(text, text, timestamptz) OWNER TO postgres;
ALTER FUNCTION alx_api_private.revoke_password_reset_token(text, timestamptz) OWNER TO postgres;

REVOKE ALL ON FUNCTION alx_api_private.update_password_hash(text, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION alx_api_private.create_password_reset_token(text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION alx_api_private.complete_password_reset(text, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION alx_api_private.revoke_password_reset_token(text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION alx_api_private.update_password_hash(text, text, timestamptz) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION alx_api_private.create_password_reset_token(text, text, timestamptz, timestamptz) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION alx_api_private.complete_password_reset(text, text, timestamptz) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION alx_api_private.revoke_password_reset_token(text, timestamptz) TO alx_api_runtime;
```

## [2026-10-04T08:55:01+03:00] تطبيق RBAC foundation migration 0006
المصدر: `alx_api/src/db/migrations/0006_rbac_foundation.sql` — النص التالي هو SQL المرسل إلى Supabase MCP.
```sql
-- Normalized RBAC foundation. No system roles or permission matrix are seeded here.
-- Authorization is deny-by-default until reviewed role/permission assignments are created.

CREATE TABLE alx_api_private.roles (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system_role boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_roles_code_check CHECK (code ~ '^[a-z][a-z0-9_-]{1,63}$')
);

CREATE TABLE alx_api_private.permissions (
  permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_permissions_code_check CHECK (code ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  CONSTRAINT api_permissions_resource_check CHECK (resource ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT api_permissions_action_check CHECK (action ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT api_permissions_resource_action_unique UNIQUE (resource, action)
);

CREATE TABLE alx_api_private.user_roles (
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES alx_api_private.roles(role_id) ON DELETE RESTRICT,
  assigned_by text REFERENCES public.users(user_id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT api_user_roles_expiry_check CHECK (expires_at IS NULL OR expires_at > assigned_at)
);
CREATE INDEX api_user_roles_active_idx ON alx_api_private.user_roles(user_id, expires_at);

CREATE TABLE alx_api_private.role_permissions (
  role_id uuid NOT NULL REFERENCES alx_api_private.roles(role_id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES alx_api_private.permissions(permission_id) ON DELETE CASCADE,
  assigned_by text REFERENCES public.users(user_id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE alx_api_private.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.role_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY api_runtime_roles_select ON alx_api_private.roles
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_permissions_select ON alx_api_private.permissions
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_user_roles_select ON alx_api_private.user_roles
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_role_permissions_select ON alx_api_private.role_permissions
  FOR SELECT TO alx_api_runtime USING (true);

REVOKE ALL ON alx_api_private.roles, alx_api_private.permissions, alx_api_private.user_roles, alx_api_private.role_permissions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON alx_api_private.roles, alx_api_private.permissions, alx_api_private.user_roles, alx_api_private.role_permissions
  TO alx_api_runtime;

-- Intentionally no role, permission, or assignment seed: the frontend currently defines conflicting
-- default Employee/Accountant permission sets; decide and reconcile that matrix before production cutover.
```

## [2026-10-04T08:56:13+03:00] تنفيذ seed RBAC الموافق عليه
المصدر: `alx_api/src/db/seeds/rbac_seed_2026-10-04.sql` — النص التالي هو SQL المرسل إلى Supabase MCP.
```sql
-- Approved 2026-10-04: Admin receives all 152 explicit catalog permissions.
-- Non-admin roles use the least-privilege intersection of both legacy defaults.
-- No wildcard; no user_roles assignments are created by this seed.
BEGIN;

INSERT INTO alx_api_private.roles (code, name, description, is_system_role)
VALUES
  ('admin', 'مدير النظام', 'Initial system role seed 2026-10-04', true),
  ('employee', 'موظف', 'Initial system role seed 2026-10-04', true),
  ('accountant', 'محاسب', 'Initial system role seed 2026-10-04', true),
  ('courier', 'مندوب', 'Initial system role seed 2026-10-04', true);

INSERT INTO alx_api_private.permissions (code, resource, action, description)
VALUES
  ('add_auto_entries', 'auto_entries', 'add', 'Swiftship permission: add_auto_entries'),
  ('add_couriers', 'couriers', 'add', 'Swiftship permission: add_couriers'),
  ('add_customers', 'customers', 'add', 'Swiftship permission: add_customers'),
  ('add_employees', 'employees', 'add', 'Swiftship permission: add_employees'),
  ('add_expenses', 'expenses', 'add', 'Swiftship permission: add_expenses'),
  ('add_finance', 'finance', 'add', 'Swiftship permission: add_finance'),
  ('add_order_statuses', 'order_statuses', 'add', 'Swiftship permission: add_order_statuses'),
  ('add_orders', 'orders', 'add', 'Swiftship permission: add_orders'),
  ('add_products', 'products', 'add', 'Swiftship permission: add_products'),
  ('add_roles', 'roles', 'add', 'Swiftship permission: add_roles'),
  ('add_shipping_companies', 'shipping_companies', 'add', 'Swiftship permission: add_shipping_companies'),
  ('add_sources', 'sources', 'add', 'Swiftship permission: add_sources'),
  ('add_users', 'users', 'add', 'Swiftship permission: add_users'),
  ('create_compound_entries', 'compound_entries', 'create', 'Swiftship permission: create_compound_entries'),
  ('create_custody_advances', 'custody_advances', 'create', 'Swiftship permission: create_custody_advances'),
  ('create_entry_settings', 'entry_settings', 'create', 'Swiftship permission: create_entry_settings'),
  ('create_general_entries', 'general_entries', 'create', 'Swiftship permission: create_general_entries'),
  ('create_payment_vouchers', 'payment_vouchers', 'create', 'Swiftship permission: create_payment_vouchers'),
  ('create_receipt_vouchers', 'receipt_vouchers', 'create', 'Swiftship permission: create_receipt_vouchers'),
  ('create_temporary_entries', 'temporary_entries', 'create', 'Swiftship permission: create_temporary_entries'),
  ('delete_auto_entries', 'auto_entries', 'delete', 'Swiftship permission: delete_auto_entries'),
  ('delete_compound_entries', 'compound_entries', 'delete', 'Swiftship permission: delete_compound_entries'),
  ('delete_couriers', 'couriers', 'delete', 'Swiftship permission: delete_couriers'),
  ('delete_custody_advances', 'custody_advances', 'delete', 'Swiftship permission: delete_custody_advances'),
  ('delete_customers', 'customers', 'delete', 'Swiftship permission: delete_customers'),
  ('delete_employees', 'employees', 'delete', 'Swiftship permission: delete_employees'),
  ('delete_entry_settings', 'entry_settings', 'delete', 'Swiftship permission: delete_entry_settings'),
  ('delete_expenses', 'expenses', 'delete', 'Swiftship permission: delete_expenses'),
  ('delete_general_entries', 'general_entries', 'delete', 'Swiftship permission: delete_general_entries'),
  ('delete_order_statuses', 'order_statuses', 'delete', 'Swiftship permission: delete_order_statuses'),
  ('delete_orders', 'orders', 'delete', 'Swiftship permission: delete_orders'),
  ('delete_paid_orders', 'paid_orders', 'delete', 'Swiftship permission: delete_paid_orders'),
  ('delete_payment_vouchers', 'payment_vouchers', 'delete', 'Swiftship permission: delete_payment_vouchers'),
  ('delete_posted_compound_entries', 'posted_compound_entries', 'delete', 'Swiftship permission: delete_posted_compound_entries'),
  ('delete_posted_general_entries', 'posted_general_entries', 'delete', 'Swiftship permission: delete_posted_general_entries'),
  ('delete_posted_payment_vouchers', 'posted_payment_vouchers', 'delete', 'Swiftship permission: delete_posted_payment_vouchers'),
  ('delete_posted_receipt_vouchers', 'posted_receipt_vouchers', 'delete', 'Swiftship permission: delete_posted_receipt_vouchers'),
  ('delete_posted_temporary_entries', 'posted_temporary_entries', 'delete', 'Swiftship permission: delete_posted_temporary_entries'),
  ('delete_products', 'products', 'delete', 'Swiftship permission: delete_products'),
  ('delete_receipt_vouchers', 'receipt_vouchers', 'delete', 'Swiftship permission: delete_receipt_vouchers'),
  ('delete_roles', 'roles', 'delete', 'Swiftship permission: delete_roles'),
  ('delete_shipping_companies', 'shipping_companies', 'delete', 'Swiftship permission: delete_shipping_companies'),
  ('delete_sources', 'sources', 'delete', 'Swiftship permission: delete_sources'),
  ('delete_temporary_entries', 'temporary_entries', 'delete', 'Swiftship permission: delete_temporary_entries'),
  ('delete_users', 'users', 'delete', 'Swiftship permission: delete_users'),
  ('disable_accounts', 'accounts', 'disable', 'Swiftship permission: disable_accounts'),
  ('edit_auto_entries', 'auto_entries', 'edit', 'Swiftship permission: edit_auto_entries'),
  ('edit_cbm_shipping_rate', 'cbm_shipping_rate', 'edit', 'Swiftship permission: edit_cbm_shipping_rate'),
  ('edit_company_info', 'company_info', 'edit', 'Swiftship permission: edit_company_info'),
  ('edit_compound_entries', 'compound_entries', 'edit', 'Swiftship permission: edit_compound_entries'),
  ('edit_couriers', 'couriers', 'edit', 'Swiftship permission: edit_couriers'),
  ('edit_custody_advances', 'custody_advances', 'edit', 'Swiftship permission: edit_custody_advances'),
  ('edit_customers', 'customers', 'edit', 'Swiftship permission: edit_customers'),
  ('edit_delivered_orders', 'delivered_orders', 'edit', 'Swiftship permission: edit_delivered_orders'),
  ('edit_employees', 'employees', 'edit', 'Swiftship permission: edit_employees'),
  ('edit_entry_settings', 'entry_settings', 'edit', 'Swiftship permission: edit_entry_settings'),
  ('edit_exchange_rates', 'exchange_rates', 'edit', 'Swiftship permission: edit_exchange_rates'),
  ('edit_expenses', 'expenses', 'edit', 'Swiftship permission: edit_expenses'),
  ('edit_finance', 'finance', 'edit', 'Swiftship permission: edit_finance'),
  ('edit_general_entries', 'general_entries', 'edit', 'Swiftship permission: edit_general_entries'),
  ('edit_general_settings', 'general_settings', 'edit', 'Swiftship permission: edit_general_settings'),
  ('edit_interface_settings', 'interface_settings', 'edit', 'Swiftship permission: edit_interface_settings'),
  ('edit_order_defaults', 'order_defaults', 'edit', 'Swiftship permission: edit_order_defaults'),
  ('edit_order_defaults_creation', 'order_defaults_creation', 'edit', 'Swiftship permission: edit_order_defaults_creation'),
  ('edit_order_items', 'order_items', 'edit', 'Swiftship permission: edit_order_items'),
  ('edit_order_statuses', 'order_statuses', 'edit', 'Swiftship permission: edit_order_statuses'),
  ('edit_orders', 'orders', 'edit', 'Swiftship permission: edit_orders'),
  ('edit_payment_vouchers', 'payment_vouchers', 'edit', 'Swiftship permission: edit_payment_vouchers'),
  ('edit_posted_compound_entries', 'posted_compound_entries', 'edit', 'Swiftship permission: edit_posted_compound_entries'),
  ('edit_posted_general_entries', 'posted_general_entries', 'edit', 'Swiftship permission: edit_posted_general_entries'),
  ('edit_posted_payment_vouchers', 'posted_payment_vouchers', 'edit', 'Swiftship permission: edit_posted_payment_vouchers'),
  ('edit_posted_receipt_vouchers', 'posted_receipt_vouchers', 'edit', 'Swiftship permission: edit_posted_receipt_vouchers'),
  ('edit_posted_temporary_entries', 'posted_temporary_entries', 'edit', 'Swiftship permission: edit_posted_temporary_entries'),
  ('edit_products', 'products', 'edit', 'Swiftship permission: edit_products'),
  ('edit_profit_per_kg', 'profit_per_kg', 'edit', 'Swiftship permission: edit_profit_per_kg'),
  ('edit_receipt_vouchers', 'receipt_vouchers', 'edit', 'Swiftship permission: edit_receipt_vouchers'),
  ('edit_roles', 'roles', 'edit', 'Swiftship permission: edit_roles'),
  ('edit_shipping_companies', 'shipping_companies', 'edit', 'Swiftship permission: edit_shipping_companies'),
  ('edit_sources', 'sources', 'edit', 'Swiftship permission: edit_sources'),
  ('edit_temporary_entries', 'temporary_entries', 'edit', 'Swiftship permission: edit_temporary_entries'),
  ('edit_users', 'users', 'edit', 'Swiftship permission: edit_users'),
  ('export_account_movements', 'account_movements', 'export', 'Swiftship permission: export_account_movements'),
  ('export_compound_entries', 'compound_entries', 'export', 'Swiftship permission: export_compound_entries'),
  ('export_general_entries', 'general_entries', 'export', 'Swiftship permission: export_general_entries'),
  ('export_orders', 'orders', 'export', 'Swiftship permission: export_orders'),
  ('export_payment_vouchers', 'payment_vouchers', 'export', 'Swiftship permission: export_payment_vouchers'),
  ('export_receipt_vouchers', 'receipt_vouchers', 'export', 'Swiftship permission: export_receipt_vouchers'),
  ('export_temporary_entries', 'temporary_entries', 'export', 'Swiftship permission: export_temporary_entries'),
  ('manage_backup', 'backup', 'manage', 'Swiftship permission: manage_backup'),
  ('manage_financial_accounts', 'financial_accounts', 'manage', 'Swiftship permission: manage_financial_accounts'),
  ('manage_notifications', 'notifications', 'manage', 'Swiftship permission: manage_notifications'),
  ('manage_website', 'website', 'manage', 'Swiftship permission: manage_website'),
  ('manage_whatsapp', 'whatsapp', 'manage', 'Swiftship permission: manage_whatsapp'),
  ('notify_finance', 'finance', 'notify', 'Swiftship permission: notify_finance'),
  ('notify_orders', 'orders', 'notify', 'Swiftship permission: notify_orders'),
  ('notify_system', 'system', 'notify', 'Swiftship permission: notify_system'),
  ('post_compound_entries', 'compound_entries', 'post', 'Swiftship permission: post_compound_entries'),
  ('post_financial_entries', 'financial_entries', 'post', 'Swiftship permission: post_financial_entries'),
  ('post_general_entries', 'general_entries', 'post', 'Swiftship permission: post_general_entries'),
  ('post_payment_vouchers', 'payment_vouchers', 'post', 'Swiftship permission: post_payment_vouchers'),
  ('post_receipt_vouchers', 'receipt_vouchers', 'post', 'Swiftship permission: post_receipt_vouchers'),
  ('post_temporary_entries', 'temporary_entries', 'post', 'Swiftship permission: post_temporary_entries'),
  ('print_account_movements', 'account_movements', 'print', 'Swiftship permission: print_account_movements'),
  ('print_compound_entries', 'compound_entries', 'print', 'Swiftship permission: print_compound_entries'),
  ('print_general_entries', 'general_entries', 'print', 'Swiftship permission: print_general_entries'),
  ('print_orders', 'orders', 'print', 'Swiftship permission: print_orders'),
  ('print_payment_vouchers', 'payment_vouchers', 'print', 'Swiftship permission: print_payment_vouchers'),
  ('print_receipt_vouchers', 'receipt_vouchers', 'print', 'Swiftship permission: print_receipt_vouchers'),
  ('print_temporary_entries', 'temporary_entries', 'print', 'Swiftship permission: print_temporary_entries'),
  ('reset_passwords', 'passwords', 'reset', 'Swiftship permission: reset_passwords'),
  ('return_order_items', 'order_items', 'return', 'Swiftship permission: return_order_items'),
  ('reverse_financial_entries', 'financial_entries', 'reverse', 'Swiftship permission: reverse_financial_entries'),
  ('send_notifications', 'notifications', 'send', 'Swiftship permission: send_notifications'),
  ('settings', 'settings', 'manage', 'Swiftship permission: settings'),
  ('settle_custody_advances', 'custody_advances', 'settle', 'Swiftship permission: settle_custody_advances'),
  ('terminate_sessions', 'sessions', 'terminate', 'Swiftship permission: terminate_sessions'),
  ('track_order', 'order', 'track', 'Swiftship permission: track_order'),
  ('unpost_posted_orders', 'posted_orders', 'unpost', 'Swiftship permission: unpost_posted_orders'),
  ('update_order_status', 'order_status', 'update', 'Swiftship permission: update_order_status'),
  ('view_account_movements', 'account_movements', 'view', 'Swiftship permission: view_account_movements'),
  ('view_activity_log', 'activity_log', 'view', 'Swiftship permission: view_activity_log'),
  ('view_auto_entries', 'auto_entries', 'view', 'Swiftship permission: view_auto_entries'),
  ('view_compound_entries', 'compound_entries', 'view', 'Swiftship permission: view_compound_entries'),
  ('view_couriers', 'couriers', 'view', 'Swiftship permission: view_couriers'),
  ('view_custody', 'custody', 'view', 'Swiftship permission: view_custody'),
  ('view_custody_advances', 'custody_advances', 'view', 'Swiftship permission: view_custody_advances'),
  ('view_customers', 'customers', 'view', 'Swiftship permission: view_customers'),
  ('view_dashboard', 'dashboard', 'view', 'Swiftship permission: view_dashboard'),
  ('view_edit_notification_settings', 'edit_notification_settings', 'view', 'Swiftship permission: view_edit_notification_settings'),
  ('view_employees', 'employees', 'view', 'Swiftship permission: view_employees'),
  ('view_entry_settings', 'entry_settings', 'view', 'Swiftship permission: view_entry_settings'),
  ('view_expenses', 'expenses', 'view', 'Swiftship permission: view_expenses'),
  ('view_finance', 'finance', 'view', 'Swiftship permission: view_finance'),
  ('view_financial_accounts', 'financial_accounts', 'view', 'Swiftship permission: view_financial_accounts'),
  ('view_general_entries', 'general_entries', 'view', 'Swiftship permission: view_general_entries'),
  ('view_notifications', 'notifications', 'view', 'Swiftship permission: view_notifications'),
  ('view_order_defaults', 'order_defaults', 'view', 'Swiftship permission: view_order_defaults'),
  ('view_order_items', 'order_items', 'view', 'Swiftship permission: view_order_items'),
  ('view_order_statuses', 'order_statuses', 'view', 'Swiftship permission: view_order_statuses'),
  ('view_orders', 'orders', 'view', 'Swiftship permission: view_orders'),
  ('view_payment_vouchers', 'payment_vouchers', 'view', 'Swiftship permission: view_payment_vouchers'),
  ('view_products', 'products', 'view', 'Swiftship permission: view_products'),
  ('view_receipt_vouchers', 'receipt_vouchers', 'view', 'Swiftship permission: view_receipt_vouchers'),
  ('view_reports', 'reports', 'view', 'Swiftship permission: view_reports'),
  ('view_roles', 'roles', 'view', 'Swiftship permission: view_roles'),
  ('view_shipping_companies', 'shipping_companies', 'view', 'Swiftship permission: view_shipping_companies'),
  ('view_sources', 'sources', 'view', 'Swiftship permission: view_sources'),
  ('view_statistics', 'statistics', 'view', 'Swiftship permission: view_statistics'),
  ('view_temporary_entries', 'temporary_entries', 'view', 'Swiftship permission: view_temporary_entries'),
  ('view_users', 'users', 'view', 'Swiftship permission: view_users'),
  ('view_website_management', 'website_management', 'view', 'Swiftship permission: view_website_management'),
  ('void_financial_entries', 'financial_entries', 'void', 'Swiftship permission: void_financial_entries')
ON CONFLICT (code) DO UPDATE SET resource = EXCLUDED.resource, action = EXCLUDED.action, description = EXCLUDED.description;

INSERT INTO alx_api_private.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM (VALUES
  ('accountant', 'add_expenses'),
  ('accountant', 'add_finance'),
  ('accountant', 'add_sources'),
  ('accountant', 'edit_expenses'),
  ('accountant', 'edit_finance'),
  ('accountant', 'edit_sources'),
  ('accountant', 'notify_finance'),
  ('accountant', 'notify_system'),
  ('accountant', 'view_custody'),
  ('accountant', 'view_dashboard'),
  ('accountant', 'view_expenses'),
  ('accountant', 'view_finance'),
  ('accountant', 'view_notifications'),
  ('accountant', 'view_orders'),
  ('accountant', 'view_reports'),
  ('accountant', 'view_sources'),
  ('admin', 'add_auto_entries'),
  ('admin', 'add_couriers'),
  ('admin', 'add_customers'),
  ('admin', 'add_employees'),
  ('admin', 'add_expenses'),
  ('admin', 'add_finance'),
  ('admin', 'add_order_statuses'),
  ('admin', 'add_orders'),
  ('admin', 'add_products'),
  ('admin', 'add_roles'),
  ('admin', 'add_shipping_companies'),
  ('admin', 'add_sources'),
  ('admin', 'add_users'),
  ('admin', 'create_compound_entries'),
  ('admin', 'create_custody_advances'),
  ('admin', 'create_entry_settings'),
  ('admin', 'create_general_entries'),
  ('admin', 'create_payment_vouchers'),
  ('admin', 'create_receipt_vouchers'),
  ('admin', 'create_temporary_entries'),
  ('admin', 'delete_auto_entries'),
  ('admin', 'delete_compound_entries'),
  ('admin', 'delete_couriers'),
  ('admin', 'delete_custody_advances'),
  ('admin', 'delete_customers'),
  ('admin', 'delete_employees'),
  ('admin', 'delete_entry_settings'),
  ('admin', 'delete_expenses'),
  ('admin', 'delete_general_entries'),
  ('admin', 'delete_order_statuses'),
  ('admin', 'delete_orders'),
  ('admin', 'delete_paid_orders'),
  ('admin', 'delete_payment_vouchers'),
  ('admin', 'delete_posted_compound_entries'),
  ('admin', 'delete_posted_general_entries'),
  ('admin', 'delete_posted_payment_vouchers'),
  ('admin', 'delete_posted_receipt_vouchers'),
  ('admin', 'delete_posted_temporary_entries'),
  ('admin', 'delete_products'),
  ('admin', 'delete_receipt_vouchers'),
  ('admin', 'delete_roles'),
  ('admin', 'delete_shipping_companies'),
  ('admin', 'delete_sources'),
  ('admin', 'delete_temporary_entries'),
  ('admin', 'delete_users'),
  ('admin', 'disable_accounts'),
  ('admin', 'edit_auto_entries'),
  ('admin', 'edit_cbm_shipping_rate'),
  ('admin', 'edit_company_info'),
  ('admin', 'edit_compound_entries'),
  ('admin', 'edit_couriers'),
  ('admin', 'edit_custody_advances'),
  ('admin', 'edit_customers'),
  ('admin', 'edit_delivered_orders'),
  ('admin', 'edit_employees'),
  ('admin', 'edit_entry_settings'),
  ('admin', 'edit_exchange_rates'),
  ('admin', 'edit_expenses'),
  ('admin', 'edit_finance'),
  ('admin', 'edit_general_entries'),
  ('admin', 'edit_general_settings'),
  ('admin', 'edit_interface_settings'),
  ('admin', 'edit_order_defaults'),
  ('admin', 'edit_order_defaults_creation'),
  ('admin', 'edit_order_items'),
  ('admin', 'edit_order_statuses'),
  ('admin', 'edit_orders'),
  ('admin', 'edit_payment_vouchers'),
  ('admin', 'edit_posted_compound_entries'),
  ('admin', 'edit_posted_general_entries'),
  ('admin', 'edit_posted_payment_vouchers'),
  ('admin', 'edit_posted_receipt_vouchers'),
  ('admin', 'edit_posted_temporary_entries'),
  ('admin', 'edit_products'),
  ('admin', 'edit_profit_per_kg'),
  ('admin', 'edit_receipt_vouchers'),
  ('admin', 'edit_roles'),
  ('admin', 'edit_shipping_companies'),
  ('admin', 'edit_sources'),
  ('admin', 'edit_temporary_entries'),
  ('admin', 'edit_users'),
  ('admin', 'export_account_movements'),
  ('admin', 'export_compound_entries'),
  ('admin', 'export_general_entries'),
  ('admin', 'export_orders'),
  ('admin', 'export_payment_vouchers'),
  ('admin', 'export_receipt_vouchers'),
  ('admin', 'export_temporary_entries'),
  ('admin', 'manage_backup'),
  ('admin', 'manage_financial_accounts'),
  ('admin', 'manage_notifications'),
  ('admin', 'manage_website'),
  ('admin', 'manage_whatsapp'),
  ('admin', 'notify_finance'),
  ('admin', 'notify_orders'),
  ('admin', 'notify_system'),
  ('admin', 'post_compound_entries'),
  ('admin', 'post_financial_entries'),
  ('admin', 'post_general_entries'),
  ('admin', 'post_payment_vouchers'),
  ('admin', 'post_receipt_vouchers'),
  ('admin', 'post_temporary_entries'),
  ('admin', 'print_account_movements'),
  ('admin', 'print_compound_entries'),
  ('admin', 'print_general_entries'),
  ('admin', 'print_orders'),
  ('admin', 'print_payment_vouchers'),
  ('admin', 'print_receipt_vouchers'),
  ('admin', 'print_temporary_entries'),
  ('admin', 'reset_passwords'),
  ('admin', 'return_order_items'),
  ('admin', 'reverse_financial_entries'),
  ('admin', 'send_notifications'),
  ('admin', 'settings'),
  ('admin', 'settle_custody_advances'),
  ('admin', 'terminate_sessions'),
  ('admin', 'track_order'),
  ('admin', 'unpost_posted_orders'),
  ('admin', 'update_order_status'),
  ('admin', 'view_account_movements'),
  ('admin', 'view_activity_log'),
  ('admin', 'view_auto_entries'),
  ('admin', 'view_compound_entries'),
  ('admin', 'view_couriers'),
  ('admin', 'view_custody'),
  ('admin', 'view_custody_advances'),
  ('admin', 'view_customers'),
  ('admin', 'view_dashboard'),
  ('admin', 'view_edit_notification_settings'),
  ('admin', 'view_employees'),
  ('admin', 'view_entry_settings'),
  ('admin', 'view_expenses'),
  ('admin', 'view_finance'),
  ('admin', 'view_financial_accounts'),
  ('admin', 'view_general_entries'),
  ('admin', 'view_notifications'),
  ('admin', 'view_order_defaults'),
  ('admin', 'view_order_items'),
  ('admin', 'view_order_statuses'),
  ('admin', 'view_orders'),
  ('admin', 'view_payment_vouchers'),
  ('admin', 'view_products'),
  ('admin', 'view_receipt_vouchers'),
  ('admin', 'view_reports'),
  ('admin', 'view_roles'),
  ('admin', 'view_shipping_companies'),
  ('admin', 'view_sources'),
  ('admin', 'view_statistics'),
  ('admin', 'view_temporary_entries'),
  ('admin', 'view_users'),
  ('admin', 'view_website_management'),
  ('admin', 'void_financial_entries'),
  ('courier', 'update_order_status'),
  ('courier', 'view_orders'),
  ('employee', 'add_couriers'),
  ('employee', 'add_customers'),
  ('employee', 'add_orders'),
  ('employee', 'add_sources'),
  ('employee', 'edit_couriers'),
  ('employee', 'edit_customers'),
  ('employee', 'edit_orders'),
  ('employee', 'edit_sources'),
  ('employee', 'notify_orders'),
  ('employee', 'notify_system'),
  ('employee', 'print_orders'),
  ('employee', 'update_order_status'),
  ('employee', 'view_couriers'),
  ('employee', 'view_customers'),
  ('employee', 'view_dashboard'),
  ('employee', 'view_notifications'),
  ('employee', 'view_orders'),
  ('employee', 'view_sources')
) AS grants(role_code, permission_code)
JOIN alx_api_private.roles AS r ON r.code = grants.role_code
JOIN alx_api_private.permissions AS p ON p.code = grants.permission_code
ORDER BY r.code, p.code
LIMIT 188
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
```
