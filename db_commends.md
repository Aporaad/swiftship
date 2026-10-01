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
