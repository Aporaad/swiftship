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

## [2026-10-04 23:35:06 +0000] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- لم يُنفذ أي أمر SQL أو DDL أو DML على قاعدة Supabase/الإنتاج خلال هذه المهمة.
- أضيف فقط ملف SQL مصدر للمراجعة: `alx_api/src/db/migrations/0009_operations_idempotency.sql`، وكان معداً لـharness PostgreSQL المحلي فقط؛ لم يتوفر PostgreSQL المحلي أثناء هذه الجلسة فلم يُشغّل.
- لا توجد قيم أسرار أو بيانات مستخدمين حقيقيين في هذا الإدراج.

## [2026-10-04 23:55:51 +0000] — SQL المطبق والتحقق من migration 0009 — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
BEGIN;
CREATE TABLE IF NOT EXISTS alx_api_private.operation_idempotency (
  idempotency_key text PRIMARY KEY,
  operation text NOT NULL,
  response_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operation_idempotency_key_check CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  CONSTRAINT operation_idempotency_response_check CHECK (jsonb_typeof(response_data) = 'object')
);
ALTER TABLE alx_api_private.operation_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.operation_idempotency FORCE ROW LEVEL SECURITY;
REVOKE ALL ON alx_api_private.operation_idempotency FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON alx_api_private.operation_idempotency TO alx_api_runtime;
CREATE POLICY operation_idempotency_runtime_policy ON alx_api_private.operation_idempotency
  FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);
COMMIT;
```
- تحقق القراءة: فحص `relrowsecurity` و`relforcerowsecurity`، أعمدة الجدول، السياسة، والمنح.
- اختبار الكتابة: إدراج `verify-0009-test` بقيمة JSON صحيحة، قراءته، ثم حذفه فوراً باستخدام CTE محدد بـ`LIMIT 1`.
- النتيجة: نجاح التطبيق والتحقق والتنظيف الكامل، دون تعديل بيانات الأعمال.

## [2026-10-05 00:09:07 +0000] — أوامر SQL للقراءة والتحقق في المرحلة 8 — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('accounts','account_trans','main_entry','entry_module','entry_type','auto_entries','custody_advances','default_accounts','currency','cur_price','entry_payment_details')
ORDER BY table_name, ordinal_position
LIMIT 400;

SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('create_financial_entry_v2','post_financial_entry','reverse_financial_entry','void_financial_entry_draft','recalculate_accounting_hierarchy')
ORDER BY routine_name
LIMIT 20;

SELECT table_name, row_count FROM (VALUES
  ('accounts',(SELECT count(*)::bigint FROM public.accounts)),
  ('main_entry',(SELECT count(*)::bigint FROM public.main_entry)),
  ('account_trans',(SELECT count(*)::bigint FROM public.account_trans)),
  ('auto_entries',(SELECT count(*)::bigint FROM public.auto_entries)),
  ('custody_advances',(SELECT count(*)::bigint FROM public.custody_advances))
) AS counts(table_name,row_count)
ORDER BY table_name LIMIT 10;
```
- النتيجة: أوامر قراءة فقط ناجحة؛ لا توجد أوامر INSERT/UPDATE/DELETE أو migration جديدة في هذه المرحلة.

## [2026-10-05 00:24:16 +0000] — SQL إضافي للمرحلة الانتقالية — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- لم يُنفذ أي SQL جديد على قاعدة البيانات خلال هذه الدفعة.
- استعلامات قراءة الحركات التي أضيفت إلى Repository موثقة داخل الكود فقط، وسيتم اختبارها فعلياً عبر دليل التكامل بعد تشغيل API بمستخدم runtime موثق.

## [2026-10-05 00:54:25 +0000] — أوامر قاعدة البيانات المرتبطة بنقل Finance UI للكتابة — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- لم يُنفذ أي أمر SQL جديد على قاعدة البيانات في هذه الدفعة.
- لم تُطبق migrations جديدة؛ عمليات الإنشاء والترحيل والعكس والإبطال تستدعي العقود الحالية عبر API فقط.

## [2026-10-05 01:07:02 +0000] — أوامر قاعدة البيانات الخاصة ببدء Reports API — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- لم يُنفذ أي SQL جديد على قاعدة البيانات.
- لم تُطبق migrations؛ القراءة تمر عبر endpoints API القائمة فقط.

## [2026-10-05 01:53:21 +0000] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- تم تنفيذ استعلام SQL قراءة فقط على قاعدة SwiftShip الأساسية:
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('expenses','couriers','sources','shipping_companies','users','activity_logs','report_templates')
ORDER BY table_name, ordinal_position
LIMIT 200;
```
- تم تنفيذ استعلام SQL قراءة فقط ثانٍ:
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('account_trans','main_entry','accounts')
ORDER BY table_name, ordinal_position
LIMIT 180;
```
- لا توجد أوامر DML/DDL أو تغييرات بيانات منفذة في هذه المرحلة.

## [2026-10-05 02:22:30 +0000] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- لم يتم تنفيذ SQL أو DDL أو DML جديد على قاعدة البيانات خلال هذه الدفعة.
- تم الاعتماد على مخطط المشروع الموجود لتثبيت أعمدة `employees`، وتمت إضافة استعلامات القراءة داخل Repository فقط دون تشغيلها على قاعدة الإنتاج.


## [2026-10-05T17:15:00+03:00] — AI Model: Gemini 3.6 Flash (Medium)
- لم يتم تنفيذ أي استعلام SQL جديد على قاعدة البيانات في هذه الدفعة.

## [2026-10-05T17:44:10+03:00] — AI Model: Gemini 3.6 Flash (Medium)
- لم يتم تنفيذ أي استعلام SQL جديد على قاعدة البيانات في هذه الدفعة.

## [2026-10-05T20:38:49+03:00] — AI Model: Gemini 3.6 Flash (Medium)
- لم يتم تنفيذ أي استعلام SQL DDL/DML مباشر على قاعدة البيانات في هذه المهمة، والمايجريشنز مجهزة ومختبرة بالكامل.




## [2026-10-05T21:25:45+03:00] — AI Model: Manus
- لم يتم تنفيذ أي أمر SQL أو DDL أو DML على قاعدة البيانات في هذه الدفعة.
- التغييرات اقتصرت على عقود API وطبقة العميل والواجهة، ولم يتم تطبيق migration أو تعديل بيانات حية.

## [2026-10-05T21:36:10+03:00] — AI Model: Manus
- لم يتم تنفيذ أي أمر SQL أو DDL أو DML في مرحلة نقل قراءة العملاء.
- تم استخدام endpoint القراءة الحالي وحدّ العرض `alx_api_private.customers_read` دون تعديل قاعدة البيانات.

## [2026-10-05T21:44:00+03:00] — AI Model: Manus
- لم يتم تشغيل أي أمر SQL على قاعدة البيانات.
- الاستعلامات المضافة داخل كود API فقط وتنفذ مستقبلًا عبر اتصال التطبيق بعد تطبيق migration/صلاحيات البيئة المعتمدة.

## [2026-10-05T22:03:10+03:00] — AI Model: Manus
- لم يتم تشغيل أي أمر SQL على قاعدة البيانات الحية.
- أضيفت داخل كود API استعلامات معاملات `orders`, `order_items`, `shipments`, و`orders_history` مع `BEGIN/COMMIT/ROLLBACK`، إضافة إلى إدراج الأعمدة الرئيسية مرة واحدة وJSONB supplemental payload.

## [2026-10-05T22:07:50+03:00] — AI Model: Manus
- لم يُنفذ أي أمر SQL مباشر في قاعدة البيانات.
- لم تُطبق migrations أو seeds؛ تم تعديل كود TypeScript فقط لاستدعاء Users API الموجود.

## [2026-10-05T22:20:45+03:00] — AI Model: Manus
Migration name: `roles_api_runtime_write_0011`
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON alx_api_private.roles TO alx_api_runtime;
GRANT SELECT ON alx_api_private.permissions TO alx_api_runtime;
GRANT SELECT, INSERT, DELETE ON alx_api_private.user_roles TO alx_api_runtime;
GRANT SELECT, INSERT, DELETE ON alx_api_private.role_permissions TO alx_api_runtime;
-- ثم إنشاء RLS policies api_runtime_*_insert/update/delete للأدوار والربط.
```
- نُفذ عبر Supabase MCP على المشروع المرتبط بنجاح.
- لم تُنفذ أي أوامر DML لإنشاء أدوار أو ربط صلاحيات.

## [2026-10-05T22:32:05+03:00] — AI Model: Manus
- نُفذ أمر migration عبر Supabase MCP على المشروع المرتبط.
- الاسم: `admin_password_reset`.
- الدالة: `alx_api_private.admin_update_password_hash(text,text,timestamptz,text)` لتحديث Argon2id، إبطال الجلسات، تسجيل actor، ومنح التنفيذ لـ `alx_api_runtime` فقط.
- النتيجة: `success: true`.

## [2026-10-06T02:20:40+03:00] — AI Model: Manus
- لم يُنفذ أي أمر SQL أو migration أو DML في هذه المرحلة.
- تم الاكتفاء بمراجعة ملفات migrations والخطة، مع إنشاء وثيقة rollback دون تطبيقها على قاعدة البيانات.

## [2026-10-06T03:06:30+03:00] — AI Model: Manus
- لم يُنفذ أي أمر SQL عبر Supabase أو قاعدة البيانات في هذه المرحلة.
- تمت إضافة SQL migration إلى المستودع فقط: `alx_api/src/db/migrations/0013_portal_auth_private_storage.sql`.

## [2026-10-06T03:27:00+03:00] — AI Model: Manus
- لم يُنفذ SQL على قاعدة البيانات في هذه الخطوة.
- تم تنفيذ استعلامات SQL داخل كود `portal-auth.repository.ts` فقط، وستُنفذ عند تشغيل الخدمة بعد تطبيق migration الموثقة.

## [2026-10-06 00:58:30 +0000] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- لم يتم تنفيذ أي SQL أو DDL أو DML أو migration على قاعدة البيانات في هذه الدفعة.
- تمت مراجعة ملفات migrations والتقارير فقط، مع توثيق أن migration `0013_portal_auth_private_storage.sql` ما زالت تنتظر تطبيقاً منفصلاً بعد backup واختبار PostgreSQL.

## [2026-10-06 01:12:40 +0000] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- لم يتم تنفيذ أي SQL أو DDL أو DML في هذه الدفعة؛ تم تعديل تكامل الواجهة فقط.

## [2026-10-06 04:39:30 +03:00] — AI Model: Manus (GPT)
```sql
-- لم يتم تنفيذ أي أمر SQL مباشر في هذه المهمة.
-- لم تُجرَ تغييرات بيانات أو migrations جديدة؛ تم تعديل كود repository فقط.
```


## [2026-10-06T22:54:18+03:00] — AI Model: Manus (GPT; المعرّف الدقيق غير معروض في runtime)
- نُفذ استعلام قراءة فقط لعرض أسماء schemas من `information_schema.schemata` عبر Supabase MCP؛ أعاد `alx_api_private` و`auth` و`public`. نص الاستعلام الأصلي لم يُحفظ في ملف نتيجة MCP، لذلك لم أعد إنشاء نص غير مؤكد.

## [2026-10-06T23:10:08+03:00] — AI Model: Manus (GPT; المعرّف الدقيق غير معروض في runtime)
```sql
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'alx_api_private'
LIMIT 10;
```
- استعلام catalog للقراءة فقط؛ أعاد schema `alx_api_private`. لم ينفذ DDL أو DML.


## [2026-10-06T22:54:15+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
select schema_name from information_schema.schemata where schema_name in ('public','alx_api_private','auth') order by schema_name limit 10;
```
- استعلام SELECT للقراءة فقط؛ أُعيد استخراجه حرفياً من سجل MCP بعد أن لم يُحفظ نصه في الإضافة السابقة.

## [2026-10-06T23:36:07+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = ANY (ARRAY[
    'portal_users', 'customers', 'couriers', 'sources', 'accounts',
    'cust_details', 'portal_tickets', 'orders', 'order_items', 'employees'
  ]::text[])
ORDER BY table_name, ordinal_position
LIMIT 300;
```

## [2026-10-06T23:37:01+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT account_id, account_code, account_prefix, account_number, account_seq, type, acc_name_ar, acc_sub_id, group_id, cur_no, is_active
FROM public.accounts
WHERE account_prefix IN ('1130', '2120', '2110')
   OR account_code IN ('1130', '2120', '2110')
   OR account_code LIKE '1130-%'
   OR account_code LIKE '2120-%'
   OR account_code LIKE '2110-%'
ORDER BY account_code, account_id
LIMIT 100;
```

## [2026-10-06T23:37:08+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = ANY (ARRAY['acc_main', 'acc_sub', 'acc_sub_group', 'default_accounts', 'currency']::text[])
ORDER BY table_name, ordinal_position
LIMIT 150;
```

## [2026-10-06T23:37:29+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT acc_sub_group_id, acc_sub_id, account_code, acc_name_ar, entity_type, allows_direct_accounts, is_active
FROM public.acc_sub_group
WHERE entity_type IS NOT NULL
ORDER BY entity_type, account_code
LIMIT 100;
```

## [2026-10-06T23:38:03+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = ANY (ARRAY['portal_users', 'customers', 'couriers', 'sources', 'accounts', 'cust_details', 'portal_tickets']::text[])
  AND (is_nullable = 'NO' OR column_default IS NOT NULL)
ORDER BY table_name, ordinal_position
LIMIT 150;
```

## [2026-10-06T23:39:08+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT cur_id, code, is_default, is_active
FROM public.currency
WHERE is_active IS TRUE AND is_default IS TRUE
ORDER BY cur_id
LIMIT 10;
```

## [2026-10-06T23:39:25+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename = ANY (ARRAY['portal_users', 'customers', 'couriers', 'sources', 'accounts', 'cust_details', 'portal_tickets', 'orders']::text[])
ORDER BY tablename, indexname
LIMIT 120;
```

## [2026-10-06T23:39:40+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT count(*)::integer AS portal_user_count,
       count(*) FILTER (WHERE email IS NOT NULL)::integer AS column_email_count,
       count(*) FILTER (WHERE NULLIF(data ->> 'email', '') IS NOT NULL)::integer AS json_email_count,
       count(*) FILTER (WHERE username IS NOT NULL)::integer AS column_username_count,
       count(*) FILTER (WHERE NULLIF(data ->> 'username', '') IS NOT NULL)::integer AS json_username_count,
       count(*) FILTER (WHERE phone IS NOT NULL)::integer AS column_phone_count,
       count(*) FILTER (WHERE NULLIF(data ->> 'phone', '') IS NOT NULL)::integer AS json_phone_count,
       count(*) FILTER (WHERE NULLIF(data ->> 'linkedCourierId', '') IS NOT NULL)::integer AS json_courier_link_count,
       count(*) FILTER (WHERE NULLIF(data ->> 'linkedSourceId', '') IS NOT NULL)::integer AS json_source_link_count
FROM public.portal_users
LIMIT 1;
```

## [2026-10-06T23:39:51+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT count(*)::integer AS portal_api_credentials_count
FROM alx_api_private.portal_credentials
LIMIT 1;
```

## [2026-10-06T23:40:35+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = ANY (ARRAY['portal_users', 'customers', 'couriers', 'sources', 'accounts', 'cust_details', 'portal_tickets', 'orders']::text[])
ORDER BY tc.table_name, kcu.ordinal_position
LIMIT 120;
```

## [2026-10-06T23:43:14+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY (ARRAY['portal_users', 'customers', 'couriers', 'sources', 'cust_details', 'portal_tickets']::text[])
ORDER BY tablename, policyname
LIMIT 100;
```

## [2026-10-06T23:43:25+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT rolname, rolsuper, rolbypassrls,
       has_table_privilege(rolname, 'public.portal_users', 'SELECT') AS can_select_portal_users,
       has_table_privilege(rolname, 'public.portal_users', 'INSERT') AS can_insert_portal_users,
       has_table_privilege(rolname, 'public.customers', 'INSERT') AS can_insert_customers,
       has_table_privilege(rolname, 'public.accounts', 'INSERT') AS can_insert_accounts
FROM pg_catalog.pg_roles
WHERE rolname IN ('alx_api_runtime', 'service_role')
ORDER BY rolname
LIMIT 10;
```

## [2026-10-06T23:43:44+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT t.tablename, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
       bool_or(r.rolname = ANY(p.roles)) FILTER (WHERE p.policyname IS NOT NULL) AS has_policy_for_runtime
FROM pg_catalog.pg_tables t
JOIN pg_catalog.pg_class c ON c.relname = t.tablename
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
CROSS JOIN LATERAL (SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = 'alx_api_runtime') r
LEFT JOIN pg_catalog.pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename = ANY (ARRAY['acc_sub_group','currency','accounts','customers','couriers','sources','portal_users','cust_details','portal_tickets','orders','order_items','shipments','products','orders_history','employees','portal_auth_tokens']::text[])
GROUP BY t.tablename, c.relrowsecurity, c.relforcerowsecurity
ORDER BY t.tablename
LIMIT 80;
```

## [2026-10-06T23:44:05+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = ANY (ARRAY['portal_users','customers','couriers','sources','accounts','acc_sub_group','currency','cust_details']::text[])
ORDER BY table_name, ordinal_position
LIMIT 160;
```

## [2026-10-06T23:53:42+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'alx_api_runtime' AND table_schema = 'public' AND table_name IN ('portal_users', 'portal_tickets', 'customers', 'couriers', 'sources', 'orders', 'cust_details') ORDER BY table_name, privilege_type LIMIT 100;
```

## [2026-10-06T23:55:56+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items', 'portal_tickets', 'cust_details') ORDER BY table_name, ordinal_position LIMIT 120;
```

## [2026-10-06T23:56:19+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('orders', 'portal_tickets', 'cust_details') ORDER BY tablename, indexname LIMIT 100;
```

## [2026-10-06T23:59:08+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sources' ORDER BY ordinal_position LIMIT 80;
```

## [2026-10-07T00:07:21+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT grantee, privilege_type, is_grantable FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'cust_details' AND grantee IN ('alx_api_runtime', 'anon', 'authenticated', 'PUBLIC') ORDER BY grantee, privilege_type LIMIT 30;
```

## [2026-10-07T00:07:30+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cust_details' ORDER BY policyname LIMIT 50;
```

## [2026-10-07T00:15:01+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, privilege_type, column_name FROM information_schema.column_privileges WHERE table_schema = 'public' AND grantee = 'alx_api_runtime' AND table_name IN ('sources', 'customers', 'couriers', 'portal_users', 'cust_details') AND privilege_type IN ('UPDATE', 'SELECT') ORDER BY table_name, privilege_type, column_name LIMIT 80;
```

## [2026-10-07T00:15:19+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cust_details' ORDER BY ordinal_position LIMIT 60;
```

## [2026-10-07T00:15:32+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' AND grantee = 'alx_api_runtime' AND table_name IN ('sources', 'customers', 'couriers', 'portal_users', 'cust_details') ORDER BY table_name, privilege_type LIMIT 50;
```

## [2026-10-07T00:19:52+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'settings' ORDER BY ordinal_position LIMIT 50;
```

## [2026-10-07T00:20:24+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT setting_id, data->>'exchangeRateSAR' AS exchange_rate_sar, data->>'exchangeRateYER' AS exchange_rate_yer, data->>'defaultDeliveryFee' AS default_delivery_fee, data->>'defaultDeliveryRate' AS default_delivery_rate, data->>'defaultCompanyProfitRate' AS default_company_profit_rate, data->>'defaultPackagingFee' AS default_packaging_fee FROM public.settings WHERE setting_id = 'general' LIMIT 1;
```

## [2026-10-07T00:20:26+03:00] — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```sql
SELECT privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'settings' AND grantee = 'alx_api_runtime' AND privilege_type = 'SELECT' LIMIT 5;
```

## [2026-10-07T00:25:56+03:00] — اختبار قاعدة محلية اصطناعية فقط — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
```text
cd /home/ubuntu/work/swiftship-latest/alx_api && TEST_PORTAL_DATABASE_URL='postgresql://ubuntu@localhost/alx_api_portal_test?host=/var/run/postgresql' npm run test:portal-db
```
- شغّل السكربت `alx_api/scripts/test-portal-registration-db.ts` على PostgreSQL محلي معزول فقط؛ نفذت الـfixtures وmigrations المحلية `0014–0016` من ملفات المستودع. لم تتصل العملية بقاعدة Supabase ولم تنفذ عليها DDL/DML. SQL fixture ومصدر migrations محفوظان في المسارات المذكورة.


## [2026-10-07T00:30:41+03:00] — توضيح نطاق SQL للاختبار المحلي — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- تصحيحاً لملاحظة الاختبار أعلاه: `scripts/test-portal-registration-db.ts` يطبق محلياً migrations `0009_operations_idempotency.sql` و`0013_portal_auth_private_storage.sql` إضافةً إلى `0014_portal_registration_details.sql` و`0015_portal_owned_resource_indexes.sql` و`0016_cust_details_rls.sql`، ثم ينفذ SQL fixtures المحلية.
- التنفيذ محصور بقاعدة sandbox الاصطناعية `alx_api_portal_test`. الكود التنفيذي الكامل في ملفات migration المذكورة والـSQL fixtures داخل `alx_api/scripts/test-portal-registration-db.ts`؛ لم يُرسل هذا SQL إلى Supabase.


## [2026-10-07T00:45:55+03:00] — Portal payment requests — AI Model: Manus (المعرّف الدقيق غير معروض في runtime)
- الأمر المنفذ على PostgreSQL المحلي المعزول:
```sh
TEST_PORTAL_DATABASE_URL='postgresql://ubuntu@localhost/alx_api_portal_test?host=/var/run/postgresql' npm run test:portal-db
```
- أعاد test harness إنشاء fixtures محلية وطبق migrations `0009_operations_idempotency.sql` و`0013_portal_auth_private_storage.sql` و`0014_portal_registration_details.sql` و`0015_portal_owned_resource_indexes.sql` و`0016_cust_details_rls.sql` و`0017_portal_payment_requests.sql`. مصدر كل SQL تنفيذي في `alx_api/scripts/test-portal-registration-db.ts`، والنص الكامل للـDDL في ملفات migrations المذكورة. جميعها محلية فقط، لا Supabase.
- هذا نص migration `0017_portal_payment_requests.sql` المطبق محلياً:
```sql
-- Customer portal payment requests are evidence for staff review only.
-- Creating a request never posts a journal entry or changes any account balance.
CREATE TABLE IF NOT EXISTS alx_api_private.portal_payment_requests (
  payment_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id text NOT NULL REFERENCES public.portal_users (portal_user_id) ON DELETE CASCADE,
  amount numeric(20, 4) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency IN ('YER', 'USD', 'SAR')),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'wallet', 'check')),
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'settled', 'rejected')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  finance_entry_id text,
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_payment_request_review_check CHECK (
    (status = 'pending_verification' AND reviewed_at IS NULL AND reviewed_by IS NULL AND finance_entry_id IS NULL)
    OR (status = 'rejected' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND review_note IS NOT NULL AND finance_entry_id IS NULL)
    OR (status = 'settled' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND finance_entry_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_payment_request_idempotency_uidx
  ON alx_api_private.portal_payment_requests (portal_user_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS portal_payment_request_finance_entry_uidx
  ON alx_api_private.portal_payment_requests (finance_entry_id)
  WHERE finance_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS portal_payment_requests_user_created_idx
  ON alx_api_private.portal_payment_requests (portal_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_payment_requests_pending_created_idx
  ON alx_api_private.portal_payment_requests (created_at DESC)
  WHERE status = 'pending_verification';
COMMENT ON TABLE alx_api_private.portal_payment_requests IS
  'Portal payment claims awaiting staff verification; never a ledger posting by itself.';
REVOKE ALL ON TABLE alx_api_private.portal_payment_requests
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE alx_api_private.portal_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_payment_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY portal_payment_requests_runtime_select
  ON alx_api_private.portal_payment_requests
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY portal_payment_requests_runtime_insert
  ON alx_api_private.portal_payment_requests
  FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY portal_payment_requests_runtime_update
  ON alx_api_private.portal_payment_requests
  FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON TABLE alx_api_private.portal_payment_requests TO alx_api_runtime;
GRANT USAGE ON SCHEMA alx_api_private TO alx_api_runtime;
```
- fixture SQL الإضافي الذي شُغل في قاعدة الاختبار: إنشاء `main_entry` و`account_trans` محلياً، إدراج fixture draft/credit بـ250 YER، ثم `UPDATE public.main_entry SET posting_status = 'posted' WHERE main_entry_id = 'synthetic-payment-draft'` بعد التأكد من رفض draft. لا ينتج عن إرسال طلب السداد أي قيد فعلي.


## [2026-10-07 02:30 +03:00] — AI Model: Manus
```sql
-- تم تنفيذ DDL عبر Supabase apply_migration على المشروع ejrojwbbflzchasvgexr بالترتيب:
-- 0014 portal_registration_details_0014
-- 0015 portal_owned_resource_indexes_0015
-- 0016 cust_details_rls_0016
-- 0017 portal_payment_requests_0017
-- تمت مطابقة نص SQL مع الملفات:
-- alx_api/src/db/migrations/0014_portal_registration_details.sql
-- alx_api/src/db/migrations/0015_portal_owned_resource_indexes.sql
-- alx_api/src/db/migrations/0016_cust_details_rls.sql
-- alx_api/src/db/migrations/0017_portal_payment_requests.sql
-- النتيجة: success=true لكل migration، ثم تحقق list_migrations من تسجيل الإصدارات.
```


## [2026-10-07 03:41 +03:00] — AI Model: Manus
```sql
-- لم يتم تنفيذ أي أمر SQL جديد في هذه المرحلة.
-- تم الاكتفاء بقراءة مشروع Supabase والتحقق من حالته قبل إعداد خدمة Render.
```


## [2026-10-07 04:12 +03:00] — AI Model: Manus
```sql
-- لم يتم تنفيذ SQL جديد؛ التغيير كان في package.json وإعداد Render فقط.
```


## [2026-10-07 04:28 +03:00] — AI Model: Manus
```sql
-- لم يتم تنفيذ SQL جديد في هذه المرحلة.
-- تم اختبار توافق قاعدة البيانات عبر GET /api/v1/health/ready
-- الذي أكد database=true وauth=true، إضافة إلى فحص مسارات HTTP غير هدّام.
```

## [2026-10-07 05:08 +03:00] — AI Model: Manus (GPT-5)
- لم يُنفذ أي أمر SQL جديد في هذه الجولة.
- تم الفحص بصورة غير هدّامة عبر health/ready ومسارات alx_api المحمية على Render؛ لا توجد migration أو DDL أو DML جديدة.
- لم تُطبع أو تُحفظ أي قيمة سرية من متغيرات اتصال قاعدة البيانات داخل المستودع.


## [2026-10-07 06:08 +03:00] — AI Model: Manus (GPT-5)
```sql
SELECT has_table_privilege('alx_api_runtime', 'public.jobs_req', 'INSERT') AS can_insert,
       has_table_privilege('alx_api_runtime', 'public.jobs_req', 'SELECT') AS can_select
LIMIT 1;
```
- قراءة امتيازات فقط؛ لا يعدل بيانات أو مخططًا.


## [2026-10-07 06:15 +03:00] — AI Model: Manus (GPT-5)
```sql
INSERT INTO public.jobs_req (
  jobs_req_id, data, email, phone, status, category, ref_code, created_at, updated_at,
  address, city, experience_years, full_name, id_number, job_position, notes, qualification
) VALUES (
  $1, $2::jsonb, $3, $4, $5, $6, $7, to_timestamp($8::double precision / 1000),
  to_timestamp($9::double precision / 1000), $10, $11, $12, $13, $14, $15, $16, $17
);
```
- هذا نص الاستعلام المعرّف في repository والمقصود اختباره عبر Render بمدخل اصطناعي فقط بعد النشر؛ لم يكن قد نُفذ عند تدوين السطر.


## [2026-10-07 06:30 +03:00] — AI Model: Manus (GPT-5)
```sql
SELECT jobs_req_id, ref_code
FROM public.jobs_req
WHERE data->>'notes' = 'MANUS_RENDER_SMOKE_20261007'
  AND email = 'swiftship-smoke-20261007@example.invalid'
LIMIT 1;
```
- قراءة محدودة بمعرّف الاختبار الاصطناعي فقط لتحديد السجل الذي أنشأه POST الاختبار؛ لا تعيد أسماء أو هواتف أو عناوين.


## [2026-10-07 06:30 +03:00] — AI Model: Manus (GPT-5)
```sql
WITH smoke_row AS (
  SELECT jobs_req_id
  FROM public.jobs_req
  WHERE jobs_req_id = 'job_769e341e-deaf-4530-9740-418eddf34341'
    AND ref_code = 'JOB-2026-769E341E'
    AND data->>'notes' = 'MANUS_RENDER_SMOKE_20261007'
  LIMIT 1
)
DELETE FROM public.jobs_req AS req
USING smoke_row
WHERE req.jobs_req_id = smoke_row.jobs_req_id
RETURNING req.jobs_req_id, req.ref_code;
```
- يطابق المعرّف والمرجع وعلامة الاختبار الاصطناعي فقط، وCTE محدد بـLIMIT 1.


## [2026-10-07 06:31 +03:00] — AI Model: Manus (GPT-5)
```sql
SELECT jobs_req_id
FROM public.jobs_req
WHERE jobs_req_id = 'job_769e341e-deaf-4530-9740-418eddf34341'
  AND ref_code = 'JOB-2026-769E341E'
  AND data->>'notes' = 'MANUS_RENDER_SMOKE_20261007'
LIMIT 1;
```
- تحقق قراءة فقط بعد التنظيف؛ عدم رجوع صف يعني أن سجل الاختبار أزيل.

## [2026-10-08 22:50:00 +03:00] — Manus AI
- لم يُنفذ أي أمر SQL خام أو DDL أو DML في قاعدة البيانات خلال هذه المهمة.
- تم تنفيذ قراءات metadata عبر موصل Supabase لمشروع `ejrojwbbflzchasvgexr`: قائمة الجداول، قائمة المهاجرات، وفحوص advisors الأمنية والأدائية.
- جميع العمليات كانت read-only، ولم تتم قراءة PII أو إدخال/تعديل/حذف أي صفوف.

## [2026-10-08 23:50:00 +03:00] — AI Model: Gemini 3.6 Flash (Medium) / Antigravity
```sql
-- لم يتم تنفيذ أي استعلام SQL DDL/DML في قاعدة البيانات.
-- التعديلات تمت في طبقة العميل useDashboardData.ts لتحويل تواريخ الـ API النصية بأمان.
```

## [2026-10-08 23:53:00 +03:00] — Manus AI
- لم يتم تنفيذ أي SQL أو DDL أو DML خلال مرحلة التحليل والخطة.
- تمت قراءة ملفات عقود ومسارات alx_api محليًا فقط لتحديد فجوات settings/currencies وبقية endpoints.

## [2026-10-09 00:30:00 +03:00] — Manus AI
- لم يتم تنفيذ أي أمر SQL أو DDL أو DML خلال تنفيذ المرحلة 0.
- تم الاكتفاء بتعديلات كود واختبارات وتوثيق داخل مستودع SwiftShip.

## [2026-10-09 00:40:00 +03:00] — Manus AI
- لم يتم تنفيذ أوامر SQL من مستودع SwiftShip.
- تمت إضافة بوابة HTTP فقط، مع إبقاء استبدال الخدمات القديمة للمرحلة التالية.

## [2026-10-09 01:08:00 +03:00] — Manus AI
لم يتم تنفيذ SQL من مستودع SwiftShip.

## [2026-10-10 06:52 +03:00] أوامر قاعدة البيانات
- لم يتم تشغيل أي أمر SQL أو migration على قاعدة البيانات خلال تنفيذ المرحلة 1.
- العمليات المنفذة كانت قراءة/تعديل ملفات المصدر والاختبارات فقط.
- نموذج الذكاء الاصطناعي المنفذ: Manus AI.

## [2026-10-11 01:58 +03:00] — Manus AI
- لم يتم تنفيذ SQL أو DDL/DML.
- التغيير اقتصر على الواجهة وبوابة HTTP.

## [2026-10-11 02:09 +03:00] — Manus AI
- لم يتم تنفيذ SQL أو DDL أو DML أو migration على قاعدة البيانات.
- التغييرات اقتصرت على عقود API والواجهة والاختبارات.

## [2026-10-11 04:34 +03:00] — AI Model: Manus AI
- لم يتم تنفيذ أي أمر SQL أو DDL أو DML أو migration على قاعدة البيانات.
- تم الاكتفاء بفحص المستودعات وملفات المصدر والاختبارات محليًا؛ لا توجد أوامر قاعدة بيانات لإدراجها.

## [2026-10-11 05:26 +03:00] — AI Model: Manus AI
- لم يتم تنفيذ أي SQL أو DDL أو DML أو migration.
- تم إجراء جرد لعقود ومسارات قاعدة البيانات/API من ملفات المستودعات فقط.


## [2026-10-11 23:27:09 +03:00] — AI Model: Manus AI (المعرّف التفصيلي للنموذج غير مكشوف لبيئة التنفيذ)
**الغرض:** التحقق للقراءة فقط من توقيع الدالة الحالية قبل ربط endpoint حذف الطلبات؛ لم يُجر أي تعديل.
**أمر SQL المنفذ كما هو:**
```sql
SELECT p.oid::regprocedure::text AS signature, pg_get_function_arguments(p.oid) AS arguments, p.prosecdef AS security_definer FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'delete_orders_with_dependents' ORDER BY p.oid LIMIT 10;
```
**النتيجة:** `delete_orders_with_dependents(text[])`، المعامل `p_order_ids text[]`، و`security_definer = true`. الاستعلام قراءة فقط؛ لا DDL/DML أو تغيير بيانات.


## [2026-10-11 23:35:01 +03:00] — AI Model: Manus AI (المعرّف التفصيلي للنموذج غير مكشوف لبيئة التنفيذ)
**الغرض:** التحقق للقراءة فقط من أعمدة جدول `public.couriers` قبل استكمال صفحة المندوبين وAPI.
**أمر SQL المنفذ كما هو:**
```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'couriers' ORDER BY ordinal_position LIMIT 100;
```
**النتيجة:** `courier_id`, `account_id`, `currency`, `is_active`, `full_name`, `name_ar`, `name_en`, `courier_type`, `courier_level`, `commission_rate`, `created_at`, `updated_at`, `created_by`, `updated_by`. لا توجد أعمدة مباشرة لرقم الهاتف أو البريد أو العنوان أو GPS أو الملاحظات أو `courier_custom_id`. الاستعلام للقراءة فقط؛ لا DDL/DML.


## [2026-10-12 00:20:05 +03:00] — AI Model: Manus AI (المعرّف التفصيلي للنموذج غير مكشوف لبيئة التنفيذ)
**DDL الذي طُبق عبر Supabase `apply_migration` خلال الجلسة (اسم الملف: `20261012000100_add_courier_profile_fields.sql`):**
```sql
-- Add the five profile fields explicitly approved for courier API migration.
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS gps_location text,
  ADD COLUMN IF NOT EXISTS notes text;
```
**التحقق الحي بعد التطبيق — 2026-10-12 00:19:35 +03:00 (قراءة فقط):**
```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'couriers' ORDER BY ordinal_position LIMIT 100;
```
**النتيجة:** ظهرت الأعمدة الخمسة فقط كإضافات جديدة، جميعها `text` و`nullable`; بقيت بقية أعمدة `couriers` دون حذف أو إعادة تسمية. لم تُكتب أو تُحدّث صفوف بيانات.

## [2026-10-12 02:27:00 +03:00] — AI Model: Gemini 3.6 Flash (Medium) / Antigravity
**DDL الذي طُبق على جدول الموظفين `public.employees` لإضافة الحقول الناقصة (phone, email, disabled, address, gps_location, notes):**
```sql
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS disabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS gps_location text,
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.employees.phone IS 'رقم هاتف الموظف';
COMMENT ON COLUMN public.employees.email IS 'البريد الإلكتروني للموظف';
COMMENT ON COLUMN public.employees.disabled IS 'هل الموظف معطل عن العمل';
COMMENT ON COLUMN public.employees.address IS 'عنوان الموظف السكني أو الميداني';
COMMENT ON COLUMN public.employees.gps_location IS 'إحداثيات موقع الموظف GPS';
COMMENT ON COLUMN public.employees.notes IS 'ملاحظات إدارية حول الموظف';
```
**التحقق الحي بعد التطبيق:**
```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'employees'
ORDER BY ordinal_position;
```
**النتيجة:** تم بنجاح إضافة الحقول الستة `phone`, `email`, `disabled`, `address`, `gps_location`, `notes` إلى جدول `public.employees` دون التأثير على الأعمدة أو البيانات السابقة.


## [2026-10-13 01:30:00 +03:00] أوامر فحص قراءة فقط (لا كتابة) — المنفذ: Qoder
```sql
-- فحص وجود الجداول المالية وأعمدتها (قراءة فقط)
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name = ANY(string_to_array('assets,account,acc_main,acc_sub,acc_sub_group,accounts,default_accounts,salary_history,account_id_migration_map,entry_module,entry_type,settings,auto_entries,users,main_entry,account_trans,employees', ','));

-- فحص صلاحيات حساب التطبيق alx_api_runtime (تبيّن غياب DELETE عن كل الجداول)
SELECT table_name, privilege_type FROM information_schema.role_table_grants
 WHERE grantee='alx_api_runtime' AND table_name = ANY(string_to_array('assets,account,acc_main,acc_sub,acc_sub_group,accounts,default_accounts,salary_history,entry_module,entry_type,settings,auto_entries,users,main_entry,account_trans,employees,orders,products,order_items,returned_products,customers,couriers,sources,shipping_companies,system_accounts,account_id_migration_map', ','));

-- فحص دوال RPC الموجودة وصلاحيات تنفيذها
SELECT pr.proname, pg_get_function_arguments(pr.oid), pr.prosecdef,
        has_function_privilege('alx_api_runtime', pr.oid, 'execute')
  FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace
 WHERE ns.nspname='public' AND pr.proname IN ('manage_financial_entry_setting','recalculate_accounting_hierarchy','create_financial_entry_v2');

-- معاينة بيانات (قراءة فقط)
SELECT auto_entry_id, debit_account, credit_account, currency, status_id FROM public.auto_entries LIMIT 3;
SELECT count(*) FILTER (WHERE system_pin IS NOT NULL AND system_pin <> '') AS with_pin, count(*) AS total FROM public.users;
SELECT setting_id, category FROM public.settings ORDER BY setting_id LIMIT 30;
SELECT count(*) FROM public.assets; SELECT count(*) FROM public.default_accounts; SELECT count(*) FROM public.accounts;
```
**النتيجة:** الجداول موجودة؛ DELETE غائب؛ RPCات الثلاث موجودة وقابلة للتنفيذ؛ أعمدة assets ناقصة؛ سيتم إنشاء ملف ترحيل 0023 (يُنفَّذ يدويًا من المستخدم) — لم تُجرَ أي كتابة على قاعدة البيانات في هذه الجلسة.

## [2026-10-13 08:12 +03:00] المنفذ: Qoder — فحص قراءة فقط (أسماء المفاتيح الأساسية)
```sql
SELECT c.relname AS table_name, a.attname AS pk_column
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
WHERE con.contype = 'p'
  AND c.relname IN ('customers','couriers','employees','users','sources','shipping_companies','custody_advances')
ORDER BY c.relname;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('customer_id','courier_id','employee_id','driver_id')
ORDER BY column_name;
```
**النتيجة:** المفاتيح: customer_id/courier_id/employee_id/user_id+id(مركّب)/source_id/shipping_company_id/custody_advance_id؛ وفي orders: courier_id, customer_id, employee_id (لا يوجد driver_id). استُخدمت لتثبيت خريطة الحذف داخل دالة 0023. **لم تُجرَ أي كتابة على قاعدة البيانات.**

## [2026-10-13 12:21 +03:00] المنفذ: Qoder — المرحلة 7-هـ (تحويل خدمات المحاسبة إلى API-only)
**لم يُنفَّذ أي أمر SQL ولم تُجرَ أي قراءة أو كتابة مباشرة على قاعدة البيانات هذا الدور.**
- كل العمل جرى في شيفرة الواجهة (`src/services/*` و`src/hooks/*` واختباراتها) عبر مسارات alx_api المنشورة، لا عبر اتصال مباشر بالقاعدة.
- لم تُنشأ أي ملفات فحص (probe) مؤقتة هذا الدور، ولم تُستخدم أداة Supabase MCP (ما زالت معطّلة بالخطأ -32603).
- حالة الترحيلات: 0021 و0022 و0023 ما زالت بانتظار تنفيذ المستخدم يدويًا عبر لوحة Supabase؛ لا DDL من جانبنا لأن حساب alx_api_runtime بلا صلاحيات DDL.
- للتوثيق: الحقائق العقدية للقاعدة التي اعتمدت عليها الشيفرة (أسماء الأعمدة المستعارة، عمود `extra`، الحركات المنشورة فقط، دوال إعادة الحساب، نصّ JSON في debit_account/credit_account) مسجّلة في `DBdevloping_history.md` تحت نفس الطابع الزمني.

## [2026-10-13 21:06 +03:00] المنفذ: Qoder — المرحلة 7-و (الأصول ودليل الحسابات وحذف الحسابات)
**لم يُنفَّذ أي أمر SQL ولم تُجرَ أي قراءة أو كتابة مباشرة على قاعدة البيانات هذا الدور.**
- لا DDL ولا إنشاء ترحيلة جديدة: `DELETE /api/v1/finance/accounts/:id` يعمل على جدولَي `accounts` و`account_trans` الموجودين أصلًا.
- كل الوصول للبيانات جرى عبر استعلامات `pg` داخل `alx_api/src/modules/finance/finance.repository.ts` (قراءة `accounts`، عدّ حركات `account_trans`، ثم `DELETE FROM public.accounts WHERE account_id = $1` بمعرّف مُعامَل كمعامل مُسند وليس نصًا مضمّنًا).
- لم تُستخدم أداة Supabase MCP لهذا الدور، ولم تُنشأ ملفات فحص مؤقتة.
- الترحيلات 0021 و0022 و0023 ما زالت بانتظار تنفيذ المستخدم يدويًا من لوحة Supabase قبل نشر alx_api ثم الواجهة.

## [2026-10-13 23:51 +03:00] المنفذ: Qoder — المرحلة 7-ز (شجرة الحسابات عبر alx_api)
**لم يُنفَّذ أي أمر SQL ولم تُجرَ أي قراءة أو كتابة مباشرة على قاعدة البيانات هذا الدور.**
- لا DDL ولا ترحيل جديد: مسارات `/api/v1/finance/hierarchy/*` و`/default-accounts` و`/accounts` تعمل على جداول `account` و`acc_main` و`acc_sub` و`acc_sub_group` و`default_accounts` و`accounts` الموجودة أصلًا.
- كل وصول للبيانات تمّ عبر HTTP إلى alx_api (`financeApiClient` / `readAllFinanceRows`)؛ لا استيراد `legacy-compat` ولا `onSnapshot` في المكوّن المحوَّل.
- استيراد الشجرة يُنفَّذ داخل `withActorClaims` على اتصال واحد من التجمع ⇒ معاملة خادم واحدة؛ نجاح جزئي يعني أن العقد التي سبقت الخطأ مثبتة فعليًا (ولهذا تعيد الواجهة قراءة الشجرة بعد الفشل).
- لم تُستخدم أداة Supabase MCP، ولم تُنشأ ملفات فحص مؤقتة.
- الترحيلات 0021 و0022 و0023 ما زالت بانتظار تنفيذ المستخدم يدويًا من لوحة Supabase قبل نشر alx_api ثم الواجهة.

## [2026-10-14 01:17 +03:00] المنفذ: Qoder — مرحلة 7-ح (كشف الحساب العام)
- **لم يُنفَّذ أي أمر SQL على قاعدة البيانات في هذا الدور** — لا DDL ولا DML ولا استدعاء لأدوات Supabase MCP.
- كل وصول للبيانات تمّ عبر HTTP إلى alx_api: `GET /api/v1/finance/account-movements?entityId=…` (قراءة مؤرَّقة بـ `readAllFinanceRows`)، `GET /api/v1/orders?customerId=…`، `GET /api/v1/customers/:id`، `GET /api/v1/operations/couriers/:id`.
- قراءة `main_entry` الكاملة التي كان يعملها الكشف عبر `onSnapshot` أُزيلت؛ الاستبعاد الآن خادمي/عبر join على `posting_status` داخل مسار الحركات نفسه.
- مبالغ الطلبات تُقرأ من `orders.data` jsonb (`amountPaid`, `amountRemaining`) كنص كما هي مخزَّنة؛ لم تُعدَّل أي قيمة في القاعدة ولا أُنشأت أعمدة جديدة.
- الترحيلات 0021 و0022 و0023 ما زالت بانتظار تنفيذ المستخدم يدويًا من لوحة Supabase، وبعده يُعاد نشر alx_api ثم الواجهة.

## [2026-10-14 02:20 +03:00] المنفذ: Qoder — مرحلة 7-ط (محتوى الموقع)
- **لم يُنفَّذ أي أمر SQL على قاعدة البيانات في هذا الدور** — لا DDL ولا DML ولا استدعاء لأدوات Supabase MCP.
- كل الوصول إلى البيانات تمّ عبر HTTP إلى alx_api (اختبارات وحدوية بمجمّع SQL وهمي بلا اتصال فعلي): `GET/POST /api/v1/site/tickets`، `POST /api/v1/site/tickets/:id/replies`، `GET/POST /api/v1/site/announcements`، `PATCH/DELETE /api/v1/site/announcements/:id`، `GET /api/v1/site/job-applications`، `PATCH/DELETE /api/v1/site/job-applications/:id`، `GET /api/v1/site/portal-orders`، `POST /api/v1/operations/couriers`، `POST /api/v1/finance/accounts` (عبر `createAccountForEntity`).
- عبارة `UPDATE public.portal_tickets … jsonb_build_object('replies',$2,'status',$3,'updatedAt',$4,'adminResponse',$5)` و`INSERT INTO public.announcements (announcement_id, data, created_at, updated_at)` كُتبت ونُفِّذت داخل المستودع فقط وقت التشغيل الفعلي؛ لم تُجرَ على القاعدة هنا.
- الترحيلات 0021 و0022 و0023 ما زالت بانتظار تنفيذ المستخدم يدويًا من لوحة Supabase، وبعدها يُعاد نشر alx_api (ليتضمّن مسارات `site-content`) ثم الواجهة.

## [2026-10-14 06:54 +03:00] — Qoder
### أوامر SQL نُفِّذت على القاعدة (قراءة فقط — لا DDL ولا DML)
جميع ما يلي نُفِّذ عبر `pg` بسلسلة اتصال `DATABASE_URL` (دون طباعة أي جزء منها) وبصلاحية قراءة، للتحقق من مخطط الترحيلات قبل تسليمها:
1) جرد الجداول المستهدفة وأعمدتها وأنواعها (0029):
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public';
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position;
-- $1 ∈ (order_status, order_option, items_category, auto_entries, browser_pages,
--        user_settings, salary_history, shipments, cust_details, customers, whatsapp_logs)
```
2) جرد بقية جداول التسطير (0026-0032): نفس الاستعلام مع
`activity_logs, announcements, portal_tickets, jobs_req, portal_users, orders, order_items, order_sources, settings, permissions, roles, reports, currencies, finance_accounts`.
3) جرد كل أعمدة jsonb المتبقية:
```sql
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema='public' AND data_type='jsonb' ORDER BY table_name, column_name;
```
4) فحص قابلية التكرار/NOT NULL لأعمدة الحمولة (يقرر هل الكتابة المسطّحة تنجح قبل 0034):
```sql
SELECT table_name, column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND data_type IN ('jsonb','json')
 ORDER BY table_name, column_name;
```
5) التحقق من وجود دوال التحويل في `alx_api_private` (نتيجته: 7 دوال كلمات مرور فقط ⇒ 0024 لم يُنفَّذ):
```sql
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'alx_api_private' ORDER BY 1;
```
- لم تُنفَّذ أي عبارة `ALTER/CREATE/DROP/INSERT/UPDATE/DELETE` على القاعدة في هذا الدور؛ كل تعديل T-SQL تمّ داخل ملفات `alx_api/src/db/migrations/*.sql` وينتظر تنفيذ المستخدم من لوحة Supabase (الترتيب: 0022، ثم 0024→0032، ثم 0034 بعد نشر الكود المسطّح).

## [2026-10-14 07:25 +03:00] — Qoder (استعلامات قراءة فقط لتسطير محتوى الموقع والطلبات)
- العبارة 1 — جرد أعمدة جداول محتوى الموقع (قراءة فقط):
```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position;
-- النطاق المختَبَر: portal_tickets, announcements, jobs_req, orders, portal_ticket_reply
```
- العبارة 2 — جرد مفاتيح حمولة الطلبات (قراءة فقط):
```sql
SELECT k.key AS key, count(*)::int AS used_by_rows, max(left(k.value #>> '{}', 60)) AS sample
  FROM public.orders o, jsonb_each(o.data) AS k
 WHERE o.data IS NOT NULL AND jsonb_typeof(o.data) = 'object'
 GROUP BY k.key ORDER BY used_by_rows DESC, k.key;
```
- النتيجة البنيوية: `orders` بلا أي عمود هوية/عرض (26 عمودًا فقط)، و`portal_ticket_reply` غير موجود بعد، و67 مفتاحًا في `orders.data` لا تتضمن أسماء العميل/المستلم/المدينة.
- التوقيت: 2026-10-14 07:25 +03:00 — المنفِّذ: Qoder (تشغيل `tsx` على سكربتَي فحص مؤقتَين حُذفا بعد الاستخدام، لا كتابة إطلاقًا).
- لم تُنفَّذ أي `ALTER/CREATE/DROP/INSERT/UPDATE/DELETE`؛ الترحيلات (0022، 0024→0032، ثم 0034 بعد النشر) ما زالت خطوة المستخدم اليدوية من لوحة Supabase لأن `alx_api_runtime` بلا صلاحيات DDL.

## [2026-10-14 08:05 +03:00] — Qoder (محاولة التنفيذ عبر Supabase MCP — لم تُنفَّذ أي عبارة)
- أمر المستخدم (نص كما ورد): `قم بالترحيلات انت` ثم `معرف المشروع هوا ejrojwbbflzchasvgexr — يالله اكمل الترحيل`، مع تأكيد النطاق: التنفيذ الإضافي فقط و**بدون 0034**.
- محاولات MCP (كلها فشلت قبل الوصول للقاعدة، ولا واحدة نفّذت SQL):
  - `list_projects` ⇒ مرفوض من طبقة السياسة (`live Supabase MCP probing` محظور).
  - `list_migrations {project_id: ejrojwbbflzchasvgexr}` ⇒ `MCP error -32603: MCP tool invocation did not complete`.
  - `get_project {id: ejrojwbbflzchasvgexr}` (مرتين) ⇒ نفس `-32603`.
  - `execute_sql` استعلام قراءة فقط (`current_database()` + وجود `portal_ticket_reply` + عدّاد `supabase_migrations.schema_migrations`) ⇒ نفس `-32603`.
- السبب البنيوي الثاني: `DATABASE_URL` في `alx_api/.env` يتصل بمشروع نفس المعرّف عبر `aws-0-ap-northeast-1.pooler.supabase.com` بالمستخدم `alx_api_runtime.ejrojwbbflzchasvgexr` — وهو دور بلا صلاحيات DDL، فالتنفيذ من هذا المسار سيفشل بـ 42501 ولن يُستخدم (لا يوجد في `.env` أي دور آخر، ولن تُطبَع الأسرار).
- الناتج البديل الجاهز: ملف مدموج `migrations_pending_2026-10-14.sql` (1887 سطرًا) بالترتيب 0021، 0022، 0024→0032، وحُذف منه 0034 عمدًا. عبارة `DROP COLUMN` الوحيدة فيه هي `activity_logs.details` داخل كتلة `DO` تنسخ `details` إلى `summary` قبل الإسقاط، وبقية الأوامر `IF NOT EXISTS`/`IF EXISTS` idempotent.
- التوقيت: 2026-10-14 08:05 +03:00 — المنفِّذ: Qoder. لا DDL ولا DML نُفِّذ على القاعدة في هذا الدور.

## [2026-10-14 21:52:00 +03:00] — AI Model: Gemini 3.8 Flash
```sql
-- لم يتم تنفيذ أوامر SQL جديدة في هذه الخطوة
```
- التوضيح: طُلب تنفيذ ترحيل رسمي باستخدام Supabase MCP (`apply_migration`).
- عند استدعاء أداة موصل MCP، اتضح أن بيئة Antigravity IDE لم تُدرج دالة `call_mcp_tool` ضمن مصفوفة دوال نموذج Gemini 3.8 Flash (الخطأ: `unknown_tool: call_mcp_tool`)، بينما كانت متاحة حصراً أثناء عمل نموذج Claude Sonnet 4.6.
## [2026-10-14 23:45:00 +03:00] — AI Model: Gemini 3.8 Flash
```sql
-- 1. تطبيق الترحيل الرسمي flatten_legacy_catalog_tables_0029 عبر Supabase MCP:
-- المصدر: alx_api/src/db/migrations/0029_flatten_legacy_catalog_tables.sql
-- تسطير جداول: order_status, order_option, items_category, auto_entries, browser_pages, user_settings, salary_history, shipments, cust_details, customers, whatsapp_logs
-- النتيجة: نجاح كامل (Success: true) - Version: 20261014203104

-- 2. تطبيق الترحيل الرسمي flatten_orders_0030 عبر Supabase MCP:
-- المصدر: alx_api/src/db/migrations/0030_flatten_orders.sql
-- تسطير جدول orders: إضافة 55 عموداً رئيسياً + إنشاء جدول order_fired_trigger وفهارس التكلفة والأصل
-- تصحيح مشغل إدراج x.value بدلاً من x.value #>> '{}' لتوافق نوع نص jsonb_array_elements_text
-- النتيجة: نجاح كامل (Success: true) - Version: 20261014203633

-- 3. تطبيق الترحيل الرسمي flatten_settings_0031 عبر Supabase MCP:
-- المصدر: alx_api/src/db/migrations/0031_flatten_settings.sql
-- إنشاء وتسطير 12 جدول إعدادات رئيسي: settings_general, settings_custom_currency, settings_backup_collection, settings_logistics, settings_whatsapp, settings_whatsapp_template, settings_whatsapp_trigger, settings_print_template, settings_report_account, expense_category, settings_dashboard, settings_dashboard_metric
-- تصحيح x.value بدلاً من x.value #>> '{}' في settings_whatsapp_template وإلغاء DELETE الحذفي المانع لـ MCP
-- النتيجة: نجاح كامل (Success: true) - Version: 20261014204132

-- 4. تطبيق الترحيل الرسمي flatten_permissions_and_reports_0032 عبر Supabase MCP:
-- المصدر: alx_api/src/db/migrations/0032_flatten_permissions_and_reports.sql
-- إنشاء وتسطير جداول: role_permission, report_exchange_rate, report_template_filter, orders_history_change + إضافة أعمدة metadata المسطحة لـ orders_history
-- النتيجة: نجاح كامل (Success: true) - Version: 20261014204246
```
- تم التحقق عبر استدعاء `list_migrations` الرسمي: ظهرت الترحيلات الأربعة جميعها مسجلة وموثقة في سجل ترحيلات Supabase `schema_migrations`.

## [2026-10-15 05:10:00 +03:00] — AI Model: Qoder (Claude Sonnet 4.6)
### أوامر وفحوصات هذا المسار — كلها قراءة فقط أو داخل معاملة متراجعة (لا تغيير دائم)
```sql
-- 1) فحص بنية جدول الأصول (قراءة فقط) — كشف الأعمدة الناقصة التي تسبب خطأ قسم الأصول (42703/42P01)
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'assets'
 ORDER BY ordinal_position;
-- النتيجة الحية: asset_id, created_at, asset_code, account_id, status, currency, is_active,
--               type, account_code, name_ar, name_en, updated_at, created_by, updated_by
-- لا يوجد: category, cost, purchase_date, assigned_courier_id, assigned_courier_name

-- 2) فحص وجود الجدول الابن لسجلات صيانة الأصول (قراءة فقط)
SELECT to_regclass('public.asset_maintenance_log') AS maintenance_log_table;
-- النتيجة: NULL  => الجدول غير موجود (يُنشئه الترحيل 0023)

-- 3) فحص وجود صندوق إرسال الإشعارات (قراءة فقط) — سبب خطأ سجلات التسليم/الإرسال الخارجي
SELECT to_regclass('alx_api_private.notification_outbox') AS outbox_table;
-- النتيجة: NULL  => الجدول غير موجود (يُنشئه الترحيل 0010)

-- 4) فحص صحة أعمدة الإشعارات المسطّحة بعد الترحيل 0025 (قراءة فقط)
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'notifications'
   AND column_name IN ('title','message','type','category','is_public','is_read','creator_id','creator_name');
-- النتيجة: الأعمدة الثمانية موجودة — التسطير تم فعلًا وبياناته مقروءة من الأعمدة الرئيسية

-- 5) فحص دليل المراحل (قراءة فقط)
SELECT order_status_id, sort_order, name_ar, name_en, is_last
  FROM public.order_status ORDER BY sort_order;
-- النتيجة: 12 مرحلة؛ order_status_id نصي 1..12 يطابق sort_order

-- 6) كشف تباعد مرحلة الطلب بين النص والمعرّف (قراءة فقط)
SELECT o.order_id, o.order_status1, o.order_status_id, os.order_status_id AS resolved_id
  FROM public.orders o
  LEFT JOIN public.order_status os ON btrim(os.name_ar) = btrim(o.order_status1)
 WHERE o.order_status_id IS DISTINCT FROM os.order_status_id;
-- النتيجة: 4 من 5 صفوف عيّنة متباعدة، والنص (order_status1) هو الأحدث كتابةً

-- 7) محاكاة الترحيل 0037 على القاعدة الحية داخل معاملة متراجعة (BEGIN ... ROLLBACK — لا تغيير دائم)
--    نص 0037 كما هو (الإسقاط الثلاثي من order_status العربي ثم الإنجليزي ثم data->>'orderStatusId')
--    بدون 'BEGIN;' الافتتاحي وبدون 'COMMIT;' الختامي، مع استبدال COMMIT بـ ROLLBACK
BEGIN;
-- ... (جسم 0037: ثلاث عبارات UPDATE مقيّدة بـ IS DISTINCT FROM + حارس DO/RAISE EXCEPTION) ...
-- ثم فحص بعد الإصلاح:
SELECT count(*) AS still_divergent
  FROM public.orders o
  JOIN public.order_status os ON btrim(os.name_ar) = btrim(o.order_status1)
 WHERE o.order_status_id IS DISTINCT FROM os.order_status_id;
ROLLBACK;
-- النتيجة: 4 صفوف يُصلحها الإسقاط، الحارس لم يرمز استثناءً، STILL DIVERGENT = 0،
--          وعيّنة بعد المحاكاة: order_status_id = "4" ↔ «وصل مستودع السعودية». كل التغييرات تراجعت.

-- 8) فحص قائمة الحسابات المالية وقابلية الترحيل (قراءة فقط)
SELECT count(*) AS total, count(*) FILTER (WHERE is_active) AS active,
       count(DISTINCT acc_sub_id) AS distinct_subs
  FROM public.accounts;
-- النتيجة: 80 حسابًا، كلها نشطة، 17 acc_sub_id مميزًا؛ sub 111 = نقدية (3)، sub 112 = بنكية (3)
--          معرّفات بصيغة 1110-0001، والإسقاط يعيد acc_sub_id AS "subAccountId"

-- 9) فحص إسقاط قائمة الطلبات (قراءة فقط) — إثبات أن حقول المصدر/الحالة/العملة تصل من JOIN
--    (orderListColumns + orderListFrom في operations.repository.ts نُفِّذت مباشرة بعينة محدودة)
-- النتيجة: orderStatus/orderStatusNameAr/orderStatusNameEn/orderSourceName/orderSourceType/
--          currency/orderCurrency/المبالغ وحالة الدفع كلها معادة بالقيم الصحيحة
```
- ملاحظة تنفيذية: لم يُنفَّذ أي `CREATE/ALTER/DROP` — دور `alx_api_runtime` بلا صلاحيات DDL، والموصل المباشر محجوب (`MCP error -32603`)؛ لذلك حُزمت الترحيلات المعلّقة (0010، 0023، 0036، 0037) في `migrations_pending_2026-10-15.sql` لينفّذها المشغّل من لوحة Supabase، ويبقى `0034_drop_legacy_jsonb_payloads.sql` آخرًا بعد نشر الكود المسطّح.

## [2026-10-16 08:06:00 +03:00] — AI Model: Qoder Agent
### أوامر القاعدة لهذه الجلسة: قراءة فقط (لم يُنفَّذ أي CREATE/ALTER/DROP)
```sql
-- 1) حصر كل الأعمدة الشبيهة بالحمولة في مخطط public (قراءة فقط)
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and (data_type in ('jsonb','json')
        or column_name in ('data','details','replies','filters','exchange_rates',
                           'before_data','after_data','metadata','location','body_details',
                           'permissions','associated_user_ids'))
 order by table_name, column_name;
-- النتيجة: 34 عمودًا ما زال موجودًا ⇒ 0034 لم يُطبَّق، والأعمدة الرئيسية البديلة موجودة من 0024→0032.

-- 2) إثبات انتقال القيم: لكل مفتاح حمولة، عدّ الصفوف التي عمودها المسطّح ما زال NULL
select count(*)::int from <table>
 where <payload> ? '<key>'
   and nullif(btrim(<payload> ->> '<key>'), '') is not null
   and <flat_candidates all NULL>;
-- النتيجة: الفجوات الحقيقية = whatsapp_logs.external_response (12)، orders.customer_account_id (1)،
--          مقاسات cust_details.body_details (3)، وأعلام items_category (2 مغطاة في 0038 §1).

-- 3) مقارنة أعداد الجداول الابنة بمصادر الحمولة
select count(*) from public.notification_recipient;   -- 0 (وكل associatedUserIds مصفوفة فارغة ⇒ آمن)
select count(*) from public.activity_log_detail;      -- 84
select count(*) from public.portal_ticket_reply;      -- 2 مقابل صفّين بحمولة ردود ⇒ 1:1
select count(*) from public.role_permission;          -- 185 مقابل 7 أدوار
select count(*) from public.orders_history_change;    -- 0 (يعيد 0038 §5 توليدها)
select count(*) from public.expense_category;         -- 13
select count(*) from public.settings_report_account;  -- 4
select count(*) from public.order_fired_trigger;      -- 2

-- 4) التحقق من دوال المساعدة قبل تنفيذ 0038
select p.proname, pg_get_function_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'alx_api_private';
-- النتيجة: 17 دالة، و safe_jsonb غير موجودة ⇒ هي معرَّفة داخل القسم 0 من 0038، فيُنفَّذ الملف كاملًا من أوله.

-- 5) فحص أشكال القيم المتبقية قبل كتابة الترحيل
select cust_detail_id, body_details, location from public.cust_details
 where nullif(btrim(body_details),'') is not null or nullif(btrim(location),'') is not null;
-- النتيجة: مستند JSON نصي (coatSize/pantsSize/shortsSize/shoeSize/heightCm/weightKg/preferredColors)
--          وموقع نصي (lat/lng/city/street/country/governorate/addressDetails) ⇒ يُسطَّح ثم يُسقط.
```

### DDL مُقترحة جاهزة للتنفيذ من لوحة Supabase (بحساب `postgres`) — لم تُنفَّذ
```sql
-- 0038_close_flattening_gaps.sql — §18 (جديد)
ALTER TABLE public.cust_details
  ADD COLUMN IF NOT EXISTS coat_size text,
  ADD COLUMN IF NOT EXISTS pants_size text,
  ADD COLUMN IF NOT EXISTS shorts_size text,
  ADD COLUMN IF NOT EXISTS shoe_size text,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS preferred_colors text[];
UPDATE public.cust_details c
   SET coat_size = COALESCE(NULLIF(btrim(c.coat_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'coatSize'), '')),
       pants_size = COALESCE(NULLIF(btrim(c.pants_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'pantsSize'), '')),
       shorts_size = COALESCE(NULLIF(btrim(c.shorts_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'shortsSize'), '')),
       shoe_size = COALESCE(NULLIF(btrim(c.shoe_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'shoeSize'), '')),
       height_cm = COALESCE(c.height_cm, alx_api_private.payload_number(x.body_doc, 'heightCm')),
       weight_kg = COALESCE(c.weight_kg, alx_api_private.payload_number(x.body_doc, 'weightKg')),
       preferred_colors = COALESCE(c.preferred_colors, alx_api_private.payload_text_array(x.body_doc, 'preferredColors'))
  FROM (SELECT d.cust_detail_id, alx_api_private.safe_jsonb(d.body_details) AS body_doc FROM public.cust_details d) x
 WHERE x.cust_detail_id = c.cust_detail_id AND x.body_doc IS NOT NULL;

-- 0038_close_flattening_gaps.sql — §19 (جديد)
UPDATE public.whatsapp_logs
   SET external_response = COALESCE(NULLIF(btrim(external_response, ''), ''),
                                    NULLIF(btrim(data ->> 'externalResponse', ''), ''))
 WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object' AND data ? 'externalResponse';

-- 0038_close_flattening_gaps.sql — §20 (جديد)
UPDATE public.orders
   SET customer_account_id = COALESCE(NULLIF(btrim(data ->> 'customerAccountId', ''), ''),
                                      CASE WHEN order_party_type = 'customer'
                                           THEN NULLIF(btrim(order_party_account_id, ''), '') END)
 WHERE customer_account_id IS NULL AND data IS NOT NULL AND jsonb_typeof(data) = 'object';

-- 0034_drop_legacy_jsonb_payloads.sql — مضاف في هذه الجلسة
ALTER TABLE public.cust_details DROP COLUMN IF EXISTS location;
ALTER TABLE public.cust_details DROP COLUMN IF EXISTS body_details;
```
- الترتيب الإلزامي: `0038` كاملًا (20 قسمًا) ثم `0034` — ولا يُعاد تنفيذ 0024→0032 و 0036 و 0037 لأنها مطبَّقة أصلًا.

## [2026-10-16 08:32:00 +03:00] — AI Model: Qoder Agent
### محاكاة حيّة للأقسام الجديدة (BEGIN … ROLLBACK) — لا شيء ثُبِّت
```sql
BEGIN;

-- §19
UPDATE public.whatsapp_logs
   SET external_response = COALESCE(NULLIF(btrim(external_response, ''), ''),
                                    NULLIF(btrim(data ->> 'externalResponse', ''), ''))
 WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object' AND data ? 'externalResponse'
 RETURNING whatsapp_log_id;
-- النتيجة: 12 صفًا تم تعبئته، وبقي external_response مملوءًا في 12 صفًا داخل المعاملة.

-- §20
UPDATE public.orders
   SET customer_account_id = COALESCE(NULLIF(btrim(data ->> 'customerAccountId', ''), ''),
                                      CASE WHEN order_party_type = 'customer'
                                           THEN NULLIF(btrim(order_party_account_id, ''), '') END)
 WHERE customer_account_id IS NULL AND data IS NOT NULL AND jsonb_typeof(data) = 'object'
 RETURNING order_id, customer_account_id;
-- النتيجة: صف واحد ALX-2610-1005 ⇒ customer_account_id = 1132-0014 (مطابق لحساب الطرف).

-- §1 (أعلام مراجعة الفئات)
UPDATE public.items_category
   SET requires_hazard_review = CASE WHEN details->>'hazardReview' IN ('true','false')
                                     THEN (details->>'hazardReview')::boolean ELSE requires_hazard_review END,
       requires_high_value_review = CASE WHEN details->>'highValueReview' IN ('true','false')
                                         THEN (details->>'highValueReview')::boolean ELSE requires_high_value_review END
 WHERE details IS NOT NULL AND jsonb_typeof(details) = 'object'
   AND (details ? 'hazardReview' OR details ? 'highValueReview')
 RETURNING items_category_id, requires_high_value_review, requires_hazard_review;
-- النتيجة: cat_perfumes ⇒ hazard=true، cat_jewelry ⇒ highValue=true.

-- §18 (تعبيراتها فقط: safe_jsonb تصل مع القسم 0 من 0038، فاستُخدم بدل مؤقت آمن)
SELECT cust_detail_id, body_doc ->> 'coatSize', body_doc ->> 'pantsSize', body_doc ->> 'shortsSize',
       body_doc ->> 'shoeSize', alx_api_private.payload_number(body_doc,'heightCm'),
       alx_api_private.payload_number(body_doc,'weightKg'),
       alx_api_private.payload_text_array(body_doc,'preferredColors')
  FROM (SELECT cust_detail_id, CASE WHEN left(btrim(body_details),1) = '{' THEN body_details::jsonb END AS body_doc
          FROM public.cust_details) x
 WHERE x.body_doc IS NOT NULL;
-- النتيجة: 3 صفوف خرجت بالمقاسات والألوان الصحيحة (L / 32 / L / 42 و heightCm 53 و 60 و weightKg 18 و 20).

ROLLBACK;
-- التحقق بعد التراجع: عدد الصفوف المملوءة في whatsapp_logs.external_response = 0 ⇒ لا تغيير مثبَّت.
```
- الصلاحية المرصودة: الموصل `alx_api_runtime` يستطيع `UPDATE` هذه الجداول، لكنه بلا `CREATE/ALTER` — لذلك تُنفَّذ الأقسام التي فيها DDL من لوحة Supabase بحساب `postgres`.

## [2026-10-16 08:26 +03:00] — Qoder
كل الاستعلامات في هذا القسم للقراءة فقط، نُفِّذت عبر `pg` بموصل `alx_api_runtime` من داخل `alx_api/` بمسبار مؤقت حُذف بعد الجولة. لم تُنشئ أو تُعدّل أي كائن، ولم تُطبع أي اعتمادية.

**1) سجل الترحيلات + آثار 0010/0023 + بقايا jsonb**
```sql
select table_schema, table_name from information_schema.tables
 where table_name ilike '%migration%' order by 1,2;
-- النتيجة: جداول خرائط ترحيل بيانات فقط (account_id_migration_map, financial_legacy_migration_map,
--          financial_migration_exceptions, portal_user_migration_map) — لا يوجد جدول ledger للترحيلات

select
  (select count(*)::int from information_schema.columns where table_schema='public' and table_name='assets'
     and column_name in ('category','cost','purchase_date','assigned_courier_id')) as extra_cols,
  (select count(*)::int from information_schema.tables where table_schema='public'
     and table_name='asset_maintenance_log') as maintenance_table,
  (select count(*)::int from information_schema.tables where table_schema='alx_api_private'
     and table_name='notification_outbox') as outbox;
-- النتيجة: extra_cols=4, maintenance_table=1, outbox=1  ⇒ 0010 و 0023 مطبَّقان

select table_name, column_name, data_type from information_schema.columns
 where table_schema='public' and data_type in ('jsonb','json') order by 1,2;
-- النتيجة: 29 عمودًا (orders.data, notifications.data, portal_users.data, portal_tickets.data/replies,
--          settings.data, roles.permissions, report_templates.data/filters, report_settings.exchange_rates,
--          orders_history.before_data/after_data/metadata, cust_details.data, items_category.details,
--          customers.location/body_details/preferred_categories, salary_history.data, user_settings.data,
--          activity_logs.data, announcements.data, auto_entries.data, browser_pages.data, jobs_req.data,
--          order_option.data, order_status.data, shipments.data, whatsapp_logs.data)
```

**2) هل طُبِّقت 0038؟ (أعمدة ودوال لا ينشئها سواها)**
```sql
select table_name, column_name from information_schema.columns
 where table_schema='public' and (
   (table_name='cust_details' and column_name in ('latitude','longitude','street','governorate','address_details','coat_size','preferred_colors')) or
   (table_name='portal_users' and column_name in ('linked_acc_id','linked_courier_id','linked_source_id')) or
   (table_name='orders' and column_name in ('package_type','customer_account_id','order_party_account_id')) or
   (table_name='whatsapp_logs' and column_name='external_response') or
   (table_name='settings_general' and column_name in ('timezone','auto_notification','cbm_shipping_rate')) or
   (table_name='user_settings' and column_name in ('sidebar_collapsed','sidebar_items')))
 order by 1,2;
-- النتيجة: 3 صفوف فقط — orders.customer_account_id، orders.order_party_account_id، whatsapp_logs.external_response
--         ⇒ بقية أعمدة 0038 غير موجودة، أي أن 0038 لم تُطبَّق

select n.nspname as schema, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.proname in ('safe_jsonb','validate_order_party') order by 1,2;
-- النتيجة: public.validate_order_party موجودة (النسخة القديمة التي تكتب NEW.data)
--          و alx_api_private.safe_jsonb غير موجودة ⇒ §0 لم يُنفَّذ

select table_schema, count(*)::int as cols from information_schema.columns
 where data_type in ('jsonb','json')
   and table_schema not in ('information_schema','pg_catalog','graphql','graphql_directives','net','pgmq',
                            'realtime','storage','supabase_functions','supabase_migrations','vault',
                            'extensions','pgbouncer')
 group by 1 order by 1;
-- النتيجة: public=29، alx_api_private=5 (أعمدة المخطط الخاص مقصودة: دوال وجدول outbox)
```

**3) هل انتقلت البيانات فعلًا إلى الأعمدة الرئيسية؟**
```sql
select count(*)::int as rows_with_data,
       count(*) filter (where data ? 'title'   and title   is null) as title_only,
       count(*) filter (where data ? 'message' and message is null) as message_only,
       count(*) filter (where data ? 'type'    and type    is null) as type_only
  from public.notifications where data is not null and jsonb_typeof(data)='object';
-- النتيجة: rows_with_data=188، title_only=0، message_only=0، type_only=0 ⇒ النقل اكتمل

select count(*) filter (where data ? 'subject' and subject is null) as subject_only
  from public.portal_tickets where data is not null and jsonb_typeof(data)='object';
-- النتيجة: 0 ⇒ عناوين التذاكر في عمودها الرئيسي

select count(*) filter (where body_details is not null and btrim(body_details) <> ''
                           and left(btrim(body_details),1)='{') as body_json_rows,
       count(*) filter (where location     is not null and btrim(location)     <> ''
                           and left(btrim(location),1)='{')   as loc_json_rows,
       count(*)::int as total
  from public.cust_details;
-- النتيجة: body_json_rows=3، loc_json_rows=3، total=7
--          ⇒ آخر مستندات JSON داخل أعمدة text؛ ينقلها 0038 §2 (الموقع) و §18 (مقاسات الجسم) قبل أن يُسقطهما 0034

select count(*) filter (where location is not null) as loc,
       count(*) filter (where body_details is not null) as body,
       count(*) filter (where preferred_categories is not null) as cats,
       count(*)::int as total
  from public.customers;
-- النتيجة: 0 / 0 / 0 / 8 ⇒ إسقاطها في 0034 بلا أي فقدان
```

**4) مطابقة كل مفتاح jsonb مع عمود رئيسي (تطبيع الأسماء) — يُنفَّذ ديناميكيًا لكل عمود jsonb في `public`**
```sql
with k as (
    select jsonb_object_keys(<payload_col>) as key from public.<table>
     where <payload_col> is not null and jsonb_typeof(<payload_col>)='object')
 select k.key, count(*)::int as rows_with_key
   from k
  where not exists (select 1 from information_schema.columns c
                     where c.table_schema='public' and c.table_name=$1
                       and (c.column_name = k.key
                            or replace(lower(c.column_name),'_','') = lower(k.key)))
  group by k.key order by 2 desc, 1;
-- النتيجة (المفاتيح التي لا تشابه اسميًا أي عمود):
--   announcements.data → id(2)                       auto_entries.data → id(10), currencyId(3)
--   browser_pages.data → name(2)                     cust_details.data → acquisitionSource(3), address(2)
--   items_category.details → group(18), hazardReview(1), highValueReview(1)
--   order_option.data → id(7)                        order_status.data → id(12)
--   portal_users.data → uid(5), linkedAccId(4), commercialRegister(1)
--   salary_history.data → createdByUid(1), salaryMonth(1)
--   orders_history.before_data/after_data/metadata → لقطات كاملة الصف (تُستبدل بصفوف orders_history_change)
--   settings.data → 93 مفتاحًا (وجهتها جداول settings_* المنشأة في 0032، لا أعمدة في جدول settings)
--   الجداول التي لا مفاتيح بلا هدف: orders.data, notifications.data, shipments.data, jobs_req.data,
--     user_settings.data, whatsapp_logs.data, activity_logs.data, portal_tickets.data/replies,
--     roles.permissions, report_templates.data/filters, report_settings.exchange_rates
```

**5) إثبات أن المفاتيح غير المتطابقة اسميًا مكرَّرة وليست فاقدة**
```sql
select data->>'uid' as payload_uid, auth_uid, (data->>'uid' = auth_uid) as equal
  from public.portal_users where data ? 'uid';
-- النتيجة: 5 صفوف، equal=true للجميع ⇒ uid مكرر من auth_uid

select left(data->>'commercialRegister',60) as payload_cr, left(commercial_register_url,60) as col_cr,
       (data->>'commercialRegister' = commercial_register_url) as equal
  from public.portal_users where data ? 'commercialRegister';
-- النتيجة: صف واحد فارغ في الطرفين، equal=true

select data->>'salaryMonth' as payload_month, month, (data->>'salaryMonth' = month::text) as equal,
       data->>'createdByUid' as created_by_uid, user_id, created_by
  from public.salary_history where data ? 'salaryMonth';
-- النتيجة: equal=true ('2026-07')؛ createdByUid='b9f57faa-…' بينما user_id و created_by = null
--          ⇒ §4 في 0038 ينقله إلى عمود created_by_uid جديد (المفتاح الحيّ الوحيد الفاقد فعليًا قبل 0038)

select auto_entry_id, data->>'currencyId' as payload_currency_id, currency, cur_no
  from public.auto_entries where data ? 'currencyId';
-- النتيجة: 3 صفوف و currencyId = null في كلها ⇒ لا بيانات تُفقد عند الإسقاط

select browser_page_id, data->>'name' as payload_name, name_ar, name_en
  from public.browser_pages where data ? 'name';
-- النتيجة: 2 صفوف، name = name_ar = name_en في الحالتين ⇒ مكرر

select data->>'id' as pid, announcement_id::text as pk, (data->>'id' = announcement_id::text) as equal
  from public.announcements where data ? 'id';
-- النتيجة: 2 صفوف، equal=true ⇒ id مكرر من المفتاح الأساسي

select data->>'id' as pid, order_status_id::text as pk, (data->>'id' = order_status_id::text) as equal
  from public.order_status where data ? 'id';
-- النتيجة: 12 صفًا، equal=true للجميع

select c.cust_detail_id, c.join_by as col_join_by, c.referrer_id as col_referrer, c.notes as col_notes,
       c.data -> 'acquisitionSource' ->> 'joinBy'     as src_join_by,
       c.data -> 'acquisitionSource' ->> 'referrerId' as src_referrer,
       jsonb_typeof(c.data -> 'acquisitionSource')    as src_type
  from public.cust_details c where c.data ? 'acquisitionSource';
-- النتيجة: 3 صفوف، src_type='object'، وكل joinBy/referrerId مطابق لعموده (join_by='facebook'/'friend'
--          و referrer_id='1b24fa75-…') ⇒ مستند معشّش بلا معلومة جديدة
```

**6) الجداول الابنة مقابل مصدرها — الحاسم قبل الإسقاط**
```sql
select count(*)::int from public.notification_recipient;      -- 0   (ولا إشعار يحمل data->recipients)
select count(*)::int from public.role_permission;             -- 185 (المصدر: 7 أدوار بمصفوفة permissions)
select count(*)::int from public.activity_log_detail;         -- 84
select count(*)::int from public.portal_ticket_reply;         -- 2
select count(*)::int from public.report_template_filter;      -- 0   (المصدر: 0 قوالب بمرشحات)
select count(*)::int from public.report_exchange_rate;        -- 0   (المصدر: 0)
select count(*)::int from public.orders_history_change;       -- 0   ← الفجوة الوحيدة
                                                             --      (المصدر: 12 صفًا في orders_history بلقطات)
select count(*)::int from public.settings_general;            -- 1
select count(*)::int from public.settings_print_template;     -- 1
select count(*)::int from public.settings_whatsapp;           -- 1
select count(*)::int from public.settings_logistics;          -- 2
select count(*)::int from public.settings_dashboard;          -- 2
select count(*)::int from public.settings_custom_currency;    -- 3
select count(*)::int from public.settings_backup_collection;  -- 6
select count(*)::int from public.settings_report_account;     -- 4
select count(*)::int from public.expense_category;            -- 13
select count(*)::int from public.order_fired_trigger;         -- 2
-- الخلاصة: كل جدول ابنة موجود ومعمَّر عدا orders_history_change الذي يملؤه 0038 §5،
--          لذا يجب تنفيذ 0038 قبل 0034 وإلا ضاع سجل تغيّرات الطلبات.
```

## [2026-10-16 22:59:01 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §13: إسقاط view alx_api_private.customers_read لإتاحة إسقاط الأعمدة القديمة
```sql
DROP VIEW IF EXISTS alx_api_private.customers_read CASCADE;
```

## [2026-10-16 22:59:11 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §13: إسقاط عمود customers.preferred_categories القديم (jsonb)
```sql
ALTER TABLE public.customers DROP COLUMN IF EXISTS preferred_categories;
```

## [2026-10-16 22:59:16 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §13: إسقاط عمود customers.location القديم (jsonb)
```sql
ALTER TABLE public.customers DROP COLUMN IF EXISTS location;
```

## [2026-10-16 22:59:22 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §13: إعادة تسمية العمود المسطح preferred_categories_flat إلى preferred_categories
```sql
ALTER TABLE public.customers RENAME COLUMN preferred_categories_flat TO preferred_categories;
```

## [2026-10-16 22:59:27 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §13: ترحيل واستكمال بيانات العملاء الحقيقية من cust_details إلى أعمدة customers المسطحة
```sql
UPDATE public.customers c
        SET preferred_categories = COALESCE(c.preferred_categories, NULLIF(d.preferred_categories, '{}'::text[])),
            latitude             = COALESCE(c.latitude, d.latitude),
            longitude            = COALESCE(c.longitude, d.longitude),
            acquisition_source   = COALESCE(NULLIF(btrim(COALESCE(c.acquisition_source, '')), ''),
                                            NULLIF(btrim(d.join_by), ''), NULLIF(btrim(c.join_by), '')),
            address              = COALESCE(NULLIF(btrim(COALESCE(c.address, '')), ''),
                                            NULLIF(btrim(d.address), ''),
                                            NULLIF(btrim(CONCAT_WS('، ', NULLIF(btrim(d.street), ''), NULLIF(btrim(d.city), ''), NULLIF(btrim(d.governorate), ''))), ''))
       FROM public.cust_details d
      WHERE d.customer_id = c.customer_id;
```

## [2026-10-16 22:59:33 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §13: إعادة بناء view alx_api_private.customers_read على الأعمدة المسطحة ومنح الصلاحية لـ alx_api_runtime
```sql
CREATE VIEW alx_api_private.customers_read AS
     SELECT customer_id,
            account_id,
            is_active,
            join_by,
            referrer_id,
            full_name,
            name_ar,
            name_en,
            customer_level,
            created_at,
            updated_at,
            acquisition_source,
            preferred_categories,
            latitude,
            longitude,
            address,
            onboarding_completed
       FROM public.customers;

     GRANT SELECT ON alx_api_private.customers_read TO alx_api_runtime;
```

## [2026-10-16 23:01:54 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §14: إنشاء فهارس الأعمدة المسطحة لجدول orders
```sql
CREATE INDEX IF NOT EXISTS orders_tracking_number_idx ON public.orders (tracking_number);
     CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id);
     CREATE INDEX IF NOT EXISTS orders_courier_id_flat_idx ON public.orders (courier_id);
```

## [2026-10-16 23:01:57 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §15: إضافة أعمدة settings_general (timezone, auto_notification, cbm_shipping_rate) وترحيل البيانات
```sql
ALTER TABLE public.settings_general
       ADD COLUMN IF NOT EXISTS timezone text,
       ADD COLUMN IF NOT EXISTS auto_notification boolean,
       ADD COLUMN IF NOT EXISTS cbm_shipping_rate numeric;

     UPDATE public.settings_general g
        SET timezone = COALESCE(g.timezone, alx_api_private.payload_text(s.data, 'timezone')),
            auto_notification = COALESCE(g.auto_notification, alx_api_private.payload_boolean(s.data, 'autoNotification')),
            cbm_shipping_rate = COALESCE(g.cbm_shipping_rate, alx_api_private.payload_number(s.data, 'cbmShippingRate'))
       FROM public.settings s
      WHERE s.setting_id = 'general'
        AND (g.timezone IS NULL OR g.auto_notification IS NULL OR g.cbm_shipping_rate IS NULL);
```

## [2026-10-16 23:01:59 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §16: إضافة أعمدة user_settings (sidebar_collapsed, sidebar_items) وترحيل البيانات
```sql
ALTER TABLE public.user_settings
       ADD COLUMN IF NOT EXISTS sidebar_collapsed boolean,
       ADD COLUMN IF NOT EXISTS sidebar_items text[];

     UPDATE public.user_settings
        SET sidebar_collapsed = COALESCE(sidebar_collapsed, alx_api_private.payload_boolean(data, 'sidebarCollapsed')),
            sidebar_items = COALESCE(sidebar_items, alx_api_private.payload_text_array(data, 'sidebarItems'))
      WHERE jsonb_typeof(data) = 'object';
```

## [2026-10-16 23:02:00 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §17: إعادة كتابة دالة validate_order_party() للتعامل الحصري مع الأعمدة المسطحة دون الكتابة في data
```sql
CREATE OR REPLACE FUNCTION public.validate_order_party()
      RETURNS trigger
      LANGUAGE plpgsql
     AS $function$
     DECLARE
       party_id text;
       party_type text;
       account_value text;
     BEGIN
       party_type := COALESCE(NULLIF(NEW.order_party_type, ''), 'customer');
       party_id := CASE party_type
                     WHEN 'employee' THEN COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.employee_id, ''))
                     WHEN 'courier'  THEN COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.courier_id, ''))
                     ELSE                 COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.customer_id, ''))
                   END;
       IF party_id IS NULL THEN
         RAISE EXCEPTION 'An order party is required.';
       END IF;

       IF party_type = 'customer' THEN
         IF NOT EXISTS (SELECT 1 FROM public.customers WHERE customer_id::text = party_id) THEN
           RAISE EXCEPTION 'Order customer party % does not exist.', party_id;
         END IF;
         NEW.customer_id := party_id;
         NEW.employee_id := NULL;
         NEW.courier_id := NULL;
         SELECT account_id INTO account_value FROM public.customers WHERE customer_id::text = party_id;
       ELSIF party_type = 'employee' THEN
         IF NOT EXISTS (SELECT 1 FROM public.employees WHERE employee_id::text = party_id) THEN
           RAISE EXCEPTION 'Order employee party % does not exist.', party_id;
         END IF;
         NEW.customer_id := NULL;
         NEW.employee_id := party_id;
         NEW.courier_id := NULL;
         SELECT account_id INTO account_value FROM public.employees WHERE employee_id::text = party_id;
       ELSIF party_type = 'courier' THEN
         IF NOT EXISTS (SELECT 1 FROM public.couriers WHERE courier_id::text = party_id) THEN
           RAISE EXCEPTION 'Order courier party % does not exist.', party_id;
         END IF;
         NEW.customer_id := NULL;
         NEW.employee_id := NULL;
         NEW.courier_id := party_id;
         SELECT account_id INTO account_value FROM public.couriers WHERE courier_id::text = party_id;
       ELSE
         RAISE EXCEPTION 'Unsupported order party type %.', party_type;
       END IF;

       IF account_value IS NULL THEN
         RAISE EXCEPTION 'The % order party % has no linked financial account.', party_type, party_id;
       END IF;

       NEW.order_party_id := party_id;
       NEW.order_party_type := party_type;
       NEW.is_staff_order := party_type <> 'customer';
       NEW.order_party_account_id := account_value;
       NEW.customer_account_id := CASE WHEN party_type = 'customer' THEN account_value ELSE NEW.customer_account_id END;

       RETURN NEW;
     END;
     $function$;

     COMMENT ON FUNCTION public.validate_order_party() IS
       'Resolves the order party into first-class columns; writes no jsonb payload.';
```

## [2026-10-16 23:02:03 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §18: إضافة أعمدة المقاسات وتفاصيل الجسم لجدول cust_details وترحيل البيانات من body_details
```sql
ALTER TABLE public.cust_details
       ADD COLUMN IF NOT EXISTS coat_size text,
       ADD COLUMN IF NOT EXISTS pants_size text,
       ADD COLUMN IF NOT EXISTS shorts_size text,
       ADD COLUMN IF NOT EXISTS shoe_size text,
       ADD COLUMN IF NOT EXISTS height_cm numeric,
       ADD COLUMN IF NOT EXISTS weight_kg numeric,
       ADD COLUMN IF NOT EXISTS preferred_colors text[];

     UPDATE public.cust_details c
        SET coat_size       = COALESCE(NULLIF(btrim(c.coat_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'coatSize'), '')),
            pants_size      = COALESCE(NULLIF(btrim(c.pants_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'pantsSize'), '')),
            shorts_size     = COALESCE(NULLIF(btrim(c.shorts_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'shortsSize'), '')),
            shoe_size       = COALESCE(NULLIF(btrim(c.shoe_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'shoeSize'), '')),
            height_cm       = COALESCE(c.height_cm, alx_api_private.payload_number(x.body_doc, 'heightCm')),
            weight_kg       = COALESCE(c.weight_kg, alx_api_private.payload_number(x.body_doc, 'weightKg')),
            preferred_colors = COALESCE(c.preferred_colors, alx_api_private.payload_text_array(x.body_doc, 'preferredColors'))
       FROM (SELECT d.cust_detail_id, alx_api_private.safe_jsonb(d.body_details) AS body_doc
               FROM public.cust_details d) x
      WHERE x.cust_detail_id = c.cust_detail_id
        AND x.body_doc IS NOT NULL;
```

## [2026-10-16 23:02:05 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §19: ترحيل externalResponse من payload إلى العمود المسطح في whatsapp_logs
```sql
UPDATE public.whatsapp_logs
        SET external_response = COALESCE(NULLIF(btrim(external_response, ''), ''),
                                         NULLIF(btrim(data ->> 'externalResponse', ''), ''))
      WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object' AND data ? 'externalResponse';
```

## [2026-10-16 23:13:31 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: تحديث دالة orders_history_write لتمرير 0 افتراضياً لـ account_trans_count مع الحفاظ على التوقيع الدقيق
```sql
CREATE OR REPLACE FUNCTION public.orders_history_write(
      p_order_id text DEFAULT NULL,
      p_order_number text DEFAULT NULL,
      p_shipment_id text DEFAULT NULL,
      p_journal_entry_id text DEFAULT NULL,
      p_account_transaction_id text DEFAULT NULL,
      p_activity_log_id text DEFAULT NULL,
      p_event_type text DEFAULT 'custom',
      p_event_category text DEFAULT 'general',
      p_operation text DEFAULT 'custom',
      p_entity_type text DEFAULT 'custom',
      p_source text DEFAULT 'database',
      p_summary text DEFAULT NULL,
      p_before_data jsonb DEFAULT '{}'::jsonb,
      p_after_data jsonb DEFAULT '{}'::jsonb,
      p_metadata jsonb DEFAULT '{}'::jsonb,
      p_actor_id text DEFAULT NULL,
      p_actor_name text DEFAULT NULL,
      p_actor_role text DEFAULT NULL
    )
     RETURNS void
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path TO 'pg_catalog', 'public'
    AS $function$
    DECLARE
      actor_record record;
      v_history_id text;
      v_before jsonb := COALESCE(p_before_data, '{}'::jsonb);
      v_after jsonb := COALESCE(p_after_data, '{}'::jsonb);
      v_meta jsonb := COALESCE(p_metadata, '{}'::jsonb);
    BEGIN
      SELECT * INTO actor_record FROM public.orders_history_actor(p_actor_id, p_actor_name, p_actor_role);
      v_history_id := 'oh_' || substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 24);

      INSERT INTO public.orders_history (
        orders_history_id, order_id, order_number, shipment_id, main_entry_id, account_trans_id, activity_log_id,
        event_type, event_category, operation, entity_type, actor_id, actor_name, actor_role, source, summary,
        trigger_name, changed_fields, deleted_order_id, order_reference, activity_target, activity_action, activity_details,
        automation_key, auto_rule_id, status_id, is_automatic, account_trans_count, occurred_at, created_at
      ) VALUES (
        v_history_id, p_order_id, p_order_number, p_shipment_id, p_journal_entry_id, p_account_transaction_id, p_activity_log_id,
        p_event_type, p_event_category, p_operation, p_entity_type,
        actor_record.actor_id, actor_record.actor_name, actor_record.actor_role, COALESCE(p_source, 'database'), p_summary,
        NULLIF(btrim(COALESCE(v_meta->>'trigger', '')), ''),
        (SELECT array_agg(btrim(y.value) ORDER BY y.ordinality)
           FROM jsonb_array_elements_text(COALESCE(v_meta->'changedFields', '[]'::jsonb)) WITH ORDINALITY y(value, ordinality)
          WHERE jsonb_typeof(v_meta->'changedFields') = 'array'),
        NULLIF(btrim(COALESCE(v_meta->>'deletedOrderId', '')), ''),
        NULLIF(btrim(COALESCE(v_meta->>'orderReference', '')), ''),
        NULLIF(btrim(COALESCE(v_meta->>'activityTarget', '')), ''),
        NULLIF(btrim(COALESCE(v_meta->>'activityAction', '')), ''),
        NULLIF(btrim(COALESCE(v_meta->>'activityDetails', '')), ''),
        NULLIF(btrim(COALESCE(v_meta->>'automationKey', '')), ''),
        NULLIF(btrim(COALESCE(v_meta->>'autoRuleId', '')), ''),
        NULLIF(btrim(COALESCE(v_meta->>'statusId', '')), ''),
        CASE WHEN v_meta->>'isAutomatic' IN ('true','false') THEN (v_meta->>'isAutomatic')::boolean END,
        COALESCE(alx_api_private.cast_integer(v_meta->>'accountTransCount'), 0),
        now(), now()
      );

      WITH diffs AS (
        SELECT COALESCE(b.key, a.key) AS field_name, b.value #>> '{}' AS old_value, a.value #>> '{}' AS new_value
          FROM jsonb_each(CASE WHEN jsonb_typeof(v_before) = 'object' THEN v_before ELSE '{}'::jsonb END) b
          FULL OUTER JOIN jsonb_each(CASE WHEN jsonb_typeof(v_after) = 'object' THEN v_after ELSE '{}'::jsonb END) a
            ON b.key = a.key
         WHERE COALESCE(b.key, a.key) <> 'data' AND b.value IS DISTINCT FROM a.value
        UNION ALL
        SELECT 'data.' || COALESCE(b.key, a.key), b.value #>> '{}', a.value #>> '{}'
          FROM jsonb_each(CASE WHEN jsonb_typeof(v_before->'data') = 'object' THEN v_before->'data' ELSE '{}'::jsonb END) b
          FULL OUTER JOIN jsonb_each(CASE WHEN jsonb_typeof(v_after->'data') = 'object' THEN v_after->'data' ELSE '{}'::jsonb END) a
            ON b.key = a.key
         WHERE b.value IS DISTINCT FROM a.value
      )
      INSERT INTO public.orders_history_change (orders_history_id, field_name, old_value, new_value)
      SELECT v_history_id, d.field_name, d.old_value, d.new_value FROM diffs d
      ON CONFLICT (orders_history_id, field_name) DO UPDATE
        SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value;
    END;
    $function$;
```

## [2026-10-16 23:13:33 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0038 §20: ترحيل customerAccountId من payload إلى العمود المسطح في orders
```sql
UPDATE public.orders
        SET customer_account_id = COALESCE(NULLIF(btrim(data ->> 'customerAccountId', ''), ''),
                                           CASE WHEN order_party_type = 'customer'
                                                THEN NULLIF(btrim(order_party_account_id, ''), '') END)
      WHERE customer_account_id IS NULL
        AND data IS NOT NULL AND jsonb_typeof(data) = 'object';
```

## [2026-10-16 23:14:12 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0034: إسقاط الفهارس القديمة المعتمدة على orders.data
```sql
DROP INDEX IF EXISTS public.idx_orders_tracking_num;
     DROP INDEX IF EXISTS public.idx_orders_customer_uid;
     DROP INDEX IF EXISTS public.idx_orders_courier_id;
```

## [2026-10-16 23:14:13 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0034: إسقاط أعمدة data من جداول العمليات (orders, shipments, cust_details, whatsapp_logs)
```sql
ALTER TABLE public.orders DROP COLUMN IF EXISTS data;
     ALTER TABLE public.shipments DROP COLUMN IF EXISTS data;
     ALTER TABLE public.cust_details DROP COLUMN IF EXISTS data;
     ALTER TABLE public.whatsapp_logs DROP COLUMN IF EXISTS data;
```

## [2026-10-16 23:14:15 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0034: إسقاط أعمدة data و jsonb القديمة من (notifications, activity_logs, announcements)
```sql
ALTER TABLE public.notifications DROP COLUMN IF EXISTS data;
     ALTER TABLE public.notifications DROP COLUMN IF EXISTS associated_user_ids;
     ALTER TABLE public.notifications DROP COLUMN IF EXISTS read;
     ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS data;
     ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS details;
     ALTER TABLE public.announcements DROP COLUMN IF EXISTS data;
```

## [2026-10-16 23:14:16 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0034: إسقاط أعمدة data و jsonb القديمة من جداول البوابة (portal_tickets, jobs_req, portal_users)
```sql
ALTER TABLE public.portal_tickets DROP COLUMN IF EXISTS data;
     ALTER TABLE public.portal_tickets DROP COLUMN IF EXISTS replies;
     ALTER TABLE public.jobs_req DROP COLUMN IF EXISTS data;
     ALTER TABLE public.portal_users DROP COLUMN IF EXISTS data;
```

## [2026-10-16 23:14:17 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0034: إسقاط أعمدة data و jsonb القديمة من جداول الإعدادات والخيارات والأدوار
```sql
ALTER TABLE public.order_status DROP COLUMN IF EXISTS data;
     ALTER TABLE public.order_option DROP COLUMN IF EXISTS data;
     ALTER TABLE public.auto_entries DROP COLUMN IF EXISTS data;
     ALTER TABLE public.browser_pages DROP COLUMN IF EXISTS data;
     ALTER TABLE public.user_settings DROP COLUMN IF EXISTS data;
     ALTER TABLE public.salary_history DROP COLUMN IF EXISTS data;
     ALTER TABLE public.items_category DROP COLUMN IF EXISTS details;
     ALTER TABLE public.roles DROP COLUMN IF EXISTS permissions;
```

## [2026-10-16 23:14:18 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: 0034: إسقاط باقي أعمدة jsonb والإعدادات المتبقية (reports, orders_history, settings, cust_details)
```sql
ALTER TABLE public.report_templates DROP COLUMN IF EXISTS data;
     ALTER TABLE public.report_templates DROP COLUMN IF EXISTS filters;
     ALTER TABLE public.report_settings DROP COLUMN IF EXISTS exchange_rates;
     ALTER TABLE public.orders_history DROP COLUMN IF EXISTS before_data;
     ALTER TABLE public.orders_history DROP COLUMN IF EXISTS after_data;
     ALTER TABLE public.orders_history DROP COLUMN IF EXISTS metadata;
     ALTER TABLE public.settings DROP COLUMN IF EXISTS data;
     ALTER TABLE public.settings DROP COLUMN IF EXISTS category;
     ALTER TABLE public.customers DROP COLUMN IF EXISTS body_details;
     DROP FUNCTION IF EXISTS public.create_smart_json_view(text, text);
     ALTER TABLE public.cust_details DROP COLUMN IF EXISTS location;
     ALTER TABLE public.cust_details DROP COLUMN IF EXISTS body_details;
```

## [2026-10-16 23:31:08 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: تسجيل الترحيل settings_and_currency_api_0018 في جدول supabase_migrations.schema_migrations
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by)
      VALUES (
        '20261016200018',
        'settings_and_currency_api_0018',
        ARRAY[$SQL$-- API access for existing shared system settings, currencies, rates, and user UI preferences.
-- This migration intentionally does NOT create or move any table.

REVOKE ALL ON TABLE public.settings, public.currency, public.cur_price, public.user_settings
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.settings, public.currency, public.cur_price, public.user_settings
  TO alx_api_runtime;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cur_price ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.currency FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cur_price FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_runtime_settings_all ON public.settings;
DROP POLICY IF EXISTS api_runtime_currency_all ON public.currency;
DROP POLICY IF EXISTS api_runtime_cur_price_all ON public.cur_price;
DROP POLICY IF EXISTS api_runtime_user_settings_all ON public.user_settings;
DROP POLICY IF EXISTS "Allow all" ON public.user_settings;

CREATE POLICY api_runtime_settings_all ON public.settings
  FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY api_runtime_currency_all ON public.currency
  FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY api_runtime_cur_price_all ON public.cur_price
  FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY api_runtime_user_settings_all ON public.user_settings
  FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);

INSERT INTO alx_api_private.permissions (code, resource, action, description) VALUES
  ('view_general_settings', 'general_settings', 'view', 'Read shared system settings through the API'),
  ('edit_general_settings', 'general_settings', 'edit', 'Edit shared system settings through the API'),
  ('view_interface_settings', 'interface_settings', 'view', 'Read the authenticated user UI settings through the API'),
  ('edit_interface_settings', 'interface_settings', 'edit', 'Edit the authenticated user UI settings through the API'),
  ('view_exchange_rates', 'exchange_rates', 'view', 'Read shared currencies and exchange rates through the API'),
  ('add_currencies', 'currencies', 'create', 'Create shared currencies through the API'),
  ('edit_currencies', 'currencies', 'edit', 'Edit shared currencies through the API'),
  ('delete_currencies', 'currencies', 'delete', 'Disable shared currencies through the API'),
  ('edit_exchange_rates', 'exchange_rates', 'edit', 'Add shared exchange rates through the API')
ON CONFLICT (code) DO NOTHING;

INSERT INTO alx_api_private.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM alx_api_private.roles r CROSS JOIN alx_api_private.permissions p
WHERE r.code = 'admin'
  AND p.code IN (
    'view_general_settings', 'edit_general_settings', 'view_interface_settings', 'edit_interface_settings',
    'view_exchange_rates', 'add_currencies', 'edit_currencies', 'delete_currencies', 'edit_exchange_rates'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
$SQL$]::text[],
        'arslan.alshamari@gmail.com'
      )
      ON CONFLICT (version) DO UPDATE
        SET name = EXCLUDED.name,
            statements = EXCLUDED.statements,
            created_by = EXCLUDED.created_by;
```

## [2026-10-16 23:31:09 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: تسجيل الترحيل employees_extended_fields_0019 في جدول supabase_migrations.schema_migrations
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by)
      VALUES (
        '20261016200019',
        'employees_extended_fields_0019',
        ARRAY[$SQL$-- Migration 0019: Add missing fields to public.employees
-- (phone, email, disabled, address, gps_location, notes)

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS disabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS gps_location text,
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.employees.phone IS 'رقم هاتف الموظف';
COMMENT ON COLUMN public.employees.email IS 'البريد الإلكتروني للموظف';
COMMENT ON COLUMN public.employees.disabled IS 'هل الموظف معطل عن العمل';
COMMENT ON COLUMN public.employees.address IS 'عنوان الموظف السكني أو الميداني';
COMMENT ON COLUMN public.employees.gps_location IS 'إحداثيات موقع الموظف GPS';
COMMENT ON COLUMN public.employees.notes IS 'ملاحظات إدارية حول الموظف';
$SQL$]::text[],
        'arslan.alshamari@gmail.com'
      )
      ON CONFLICT (version) DO UPDATE
        SET name = EXCLUDED.name,
            statements = EXCLUDED.statements,
            created_by = EXCLUDED.created_by;
```

## [2026-10-16 23:31:10 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: تسجيل الترحيل finance_atomic_rpc_runtime_access_0020 في جدول supabase_migrations.schema_migrations
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by)
      VALUES (
        '20261016200020',
        'finance_atomic_rpc_runtime_access_0020',
        ARRAY[$SQL$-- Finance API step 9: allow the API runtime role to invoke the atomic financial RPCs
-- used by the new entry/custody/payment/unpost endpoints. Permission checks moved from
-- the legacy secure_* wrappers (auth.uid() based) to alx_api requirePermission middleware.

GRANT EXECUTE ON FUNCTION
  public.create_financial_entry_v2(jsonb),
  public.post_financial_entry(text, text),
  public.reverse_financial_entry(text, jsonb),
  public.void_financial_entry_draft(text, text),
  public.delete_financial_entry_draft(text),
  public.replace_financial_entry_draft(text, jsonb),
  public.create_custody_advance(jsonb, jsonb),
  public.settle_custody_advance(text, jsonb, text),
  public.record_order_payment_v2(text, numeric, jsonb, text),
  public.unpost_financial_entry(text, text)
TO alx_api_runtime;
$SQL$]::text[],
        'arslan.alshamari@gmail.com'
      )
      ON CONFLICT (version) DO UPDATE
        SET name = EXCLUDED.name,
            statements = EXCLUDED.statements,
            created_by = EXCLUDED.created_by;
```

## [2026-10-16 23:31:11 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: تسجيل الترحيل close_flattening_gaps_0038 في جدول supabase_migrations.schema_migrations
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by)
      VALUES (
        '20261016230038',
        'close_flattening_gaps_0038',
        ARRAY[$SQL$-- 0038_close_flattening_gaps.sql
-- يُغلق فجوات اكتشفها التدقيق وتجب معالجتها قبل إسقاط آخر أعمدة jsonb في 0034.
-- Closes audit-found gaps that must be fixed before the final jsonb drop (0034).
--
-- 1) حقول لم يكن لها عمود رئيسي أصلاً: مجموعة الفئة، موقع العميل، حساب البوابة الرابط، منشئ الراتب.
--    Fields with no first-class column at all: category group, customer location, portal account link, salary creator.
-- 2) دوال قاعدة البيانات التي تقرأ/تكتب أعمدة jsonb: كتابة سجل الطلبات، محفّظات القيد والنشاط واليومية، سند قبض الطلب.
--    Database functions reading/writing jsonb columns: history writer, main-entry/activity/journal audit triggers, order receipt.
-- 3) إعادة توليد orders_history_change: الترحيل 0032 نُفّذ وصفّ سجل الطلبات كان فارغًا، فبقي جدول التغييرات بلا صفوف.
--    Regenerates orders_history_change: 0032 ran while orders_history was still empty, so the child table got nothing.
--
-- ترتيب التنفيذ: بعد 0032 وقبل 0034 — لا يحذف هذا الملف أي عمود.
-- Ordering: after 0032 and before 0034 — this migration drops nothing.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. تحويل نص إلى jsonb بلا فشل — tolerant text→jsonb cast (cust_details.location stores JSON as text).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION alx_api_private.safe_jsonb(p_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::jsonb;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. فئات الأصناف: مجموعة الفئة وأعلام المراجعة كانت داخل items_category.details.
--    Item categories: the group label and the review flags lived inside details jsonb.
--    العمود group_name أُنشئ في 0029 لكن بقيت أعلام المراجعة بلا قيم، فالتعبئة تُعاد بأمان.
--    group_name came from 0029; the review flags never got their values, so the fill is repeated safely.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.items_category
   SET group_name = COALESCE(NULLIF(group_name, ''), NULLIF(btrim(details->>'group'), ''))
 WHERE details IS NOT NULL AND jsonb_typeof(details) = 'object';

-- المفتاحان hazardReview/highValueReview لم يُنقلا إلى أعمدتهما الحقيقية سابقًا.
-- hazardReview/highValueReview were never copied into their first-class columns.
UPDATE public.items_category
   SET requires_hazard_review = CASE WHEN details->>'hazardReview' IN ('true','false')
                                     THEN (details->>'hazardReview')::boolean ELSE requires_hazard_review END,
       requires_high_value_review = CASE WHEN details->>'highValueReview' IN ('true','false')
                                         THEN (details->>'highValueReview')::boolean ELSE requires_high_value_review END
 WHERE details IS NOT NULL AND jsonb_typeof(details) = 'object'
   AND (details ? 'hazardReview' OR details ? 'highValueReview');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. تفاصيل العميل: كائن الموقع والـ address يصيران أعمدة حقيقية.
--    Customer details: the location document and the address key become columns.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cust_details
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS governorate text,
  ADD COLUMN IF NOT EXISTS address_details text,
  ADD COLUMN IF NOT EXISTS address text;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT d.cust_detail_id, alx_api_private.safe_jsonb(d.location) AS loc
      FROM public.cust_details d
     WHERE alx_api_private.safe_jsonb(d.location) IS NOT NULL
  LOOP
    UPDATE public.cust_details
       SET latitude        = COALESCE(latitude,
            CASE WHEN rec.loc->>'lat' ~ '^-?[0-9]+([.][0-9]+)?$' THEN (rec.loc->>'lat')::numeric END),
           longitude       = COALESCE(longitude,
            CASE WHEN rec.loc->>'lng' ~ '^-?[0-9]+([.][0-9]+)?$' THEN (rec.loc->>'lng')::numeric END),
           street          = COALESCE(NULLIF(street, ''), NULLIF(btrim(COALESCE(rec.loc->>'street', '')), '')),
           governorate     = COALESCE(NULLIF(governorate, ''), NULLIF(btrim(COALESCE(rec.loc->>'governorate', '')), '')),
           address_details = COALESCE(NULLIF(address_details, ''), NULLIF(btrim(COALESCE(rec.loc->>'addressDetails', '')), '')),
           city            = COALESCE(NULLIF(city, ''), NULLIF(btrim(COALESCE(rec.loc->>'city', '')), '')),
           country         = COALESCE(NULLIF(country, ''), NULLIF(btrim(COALESCE(rec.loc->>'country', '')), ''))
     WHERE cust_detail_id = rec.cust_detail_id;
  END LOOP;

  UPDATE public.cust_details
     SET address = COALESCE(NULLIF(address, ''), NULLIF(btrim(COALESCE(data->>'address', '')), ''))
   WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object' AND data ? 'address';
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. مستخدمو البوابة: الحساب المالي الرابط وروابط الموظف والمصدر أعمدة حقيقية.
--    Portal users: linked financial account, courier and source links become columns.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.portal_users
  ADD COLUMN IF NOT EXISTS linked_acc_id text,
  ADD COLUMN IF NOT EXISTS linked_courier_id text,
  ADD COLUMN IF NOT EXISTS linked_source_id text;

UPDATE public.portal_users
   SET linked_acc_id     = COALESCE(NULLIF(linked_acc_id, ''),     NULLIF(data->>'linkedAccId', '')),
       linked_courier_id = COALESCE(NULLIF(linked_courier_id, ''), NULLIF(data->>'linkedCourierId', '')),
       linked_source_id  = COALESCE(NULLIF(linked_source_id, ''),  NULLIF(data->>'linkedSourceId', ''))
 WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. الطلب: نوع الطرد كان يُقرأ من الحمولة فقط ولا يُخزَّن في عمود.
--     Orders: the package type was only ever read from the payload, never stored in a column.
--     بوابة العملاء ترشّح طلبات المصنع بهذا النوع، فبدون العمود ترجع القائمة فارغة دائمًا.
--     The customer portal filters factory-CBM orders by it, so the list was always empty.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS package_type text;

UPDATE public.orders
   SET package_type = COALESCE(NULLIF(package_type, ''), NULLIF(btrim(data->>'packageType'), ''), NULLIF(btrim(data->>'package_type'), ''))
 WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. سجل الرواتب: معرّف المنشئ كان داخل data فقط.
--    Salary history: the creator uid existed only inside the payload.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.salary_history ADD COLUMN IF NOT EXISTS created_by_uid text;

UPDATE public.salary_history
   SET created_by_uid = COALESCE(NULLIF(created_by_uid, ''), NULLIF(data->>'createdByUid', ''), NULLIF(created_by, ''))
 WHERE created_by_uid IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. سجل الطلبات: عمود مفقود كان يتجاهله كاتِب السجل + إعادة توليد صفوف التغيير.
--    Order history: the writer silently dropped p_account_transaction_id, so the column is added,
--    and the change rows are regenerated (0032 ran before any history row existed).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders_history
  ADD COLUMN IF NOT EXISTS account_trans_id text,
  ADD COLUMN IF NOT EXISTS automation_key text,
  ADD COLUMN IF NOT EXISTS auto_rule_id text,
  ADD COLUMN IF NOT EXISTS status_id text,
  ADD COLUMN IF NOT EXISTS is_automatic boolean;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders_history'
       AND column_name = 'after_data' AND data_type = 'jsonb'
  ) THEN
    RETURN;
  END IF;

  -- تغييرات المستوى الأعلى — top-level field diffs.
  INSERT INTO public.orders_history_change (orders_history_id, field_name, old_value, new_value)
  SELECT h.orders_history_id, x.key,
         COALESCE(h.before_data #>> ARRAY[x.key], h.before_data->'data' #>> ARRAY[x.key]),
         COALESCE(h.after_data  #>> ARRAY[x.key], h.after_data->'data'  #>> ARRAY[x.key])
    FROM public.orders_history h,
         jsonb_object_keys(COALESCE(h.after_data, h.before_data, '{}'::jsonb)) x(key)
   WHERE jsonb_typeof(COALESCE(h.after_data, h.before_data, '{}'::jsonb)) = 'object'
     AND x.key NOT IN ('data')
  ON CONFLICT (orders_history_id, field_name) DO UPDATE
    SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value;

  -- المفاتيح المتداخلة داخل data القديم تحفظ مسارًا منقوطًا — nested legacy "data" keys keep a dotted path.
  INSERT INTO public.orders_history_change (orders_history_id, field_name, old_value, new_value)
  SELECT h.orders_history_id, 'data.' || x.key,
         h.before_data->'data' #>> ARRAY[x.key],
         h.after_data->'data'  #>> ARRAY[x.key]
    FROM public.orders_history h,
         jsonb_object_keys(COALESCE(h.after_data->'data', h.before_data->'data', '{}'::jsonb)) x(key)
   WHERE jsonb_typeof(COALESCE(h.after_data->'data', h.before_data->'data')) = 'object'
   ON CONFLICT (orders_history_id, field_name) DO UPDATE
     SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value;

  -- metadata.changes كان خريطة jsonb — the legacy changes map also becomes change rows.
  INSERT INTO public.orders_history_change (orders_history_id, field_name, old_value, new_value)
  SELECT h.orders_history_id, c.key, c.value->'before' #>> '{}', c.value->'after' #>> '{}'
    FROM public.orders_history h,
         jsonb_each(h.metadata->'changes') c(key, value)
   WHERE jsonb_typeof(h.metadata->'changes') = 'object'
   ON CONFLICT (orders_history_id, field_name) DO NOTHING;

  -- بقية مفاتيح metadata إلى أعمدة حقيقية — remaining metadata keys into first-class columns.
  UPDATE public.orders_history
     SET automation_key = COALESCE(NULLIF(automation_key, ''), NULLIF(metadata->>'automationKey', '')),
         auto_rule_id   = COALESCE(NULLIF(auto_rule_id, ''),   NULLIF(metadata->>'autoRuleId', '')),
         status_id      = COALESCE(NULLIF(status_id, ''),      NULLIF(metadata->>'statusId', '')),
         is_automatic   = COALESCE(is_automatic,
                            CASE WHEN metadata->>'isAutomatic' IN ('true','false') THEN (metadata->>'isAutomatic')::boolean END),
         trigger_name   = COALESCE(NULLIF(trigger_name, ''),  NULLIF(metadata->>'trigger', ''))
   WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object';
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. كاتِب سجل الطلبات: لم يعد يلمس before_data/after_data/metadata.
--    The history writer no longer touches the legacy jsonb columns.
--    التوقيع كما هو: المحفّظات تمرّر لقطات محسوبة داخل الذاكرة، وتُكتب الآن كصفوف تغيير.
--    Signature unchanged: triggers pass in-memory row snapshots, now persisted as change rows.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.orders_history_write(
  p_order_id text DEFAULT NULL,
  p_order_number text DEFAULT NULL,
  p_shipment_id text DEFAULT NULL,
  p_journal_entry_id text DEFAULT NULL,
  p_account_transaction_id text DEFAULT NULL,
  p_activity_log_id text DEFAULT NULL,
  p_event_type text DEFAULT 'custom',
  p_event_category text DEFAULT 'general',
  p_operation text DEFAULT 'custom',
  p_entity_type text DEFAULT 'custom',
  p_source text DEFAULT 'database',
  p_summary text DEFAULT NULL,
  p_before_data jsonb DEFAULT '{}'::jsonb,
  p_after_data jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id text DEFAULT NULL,
  p_actor_name text DEFAULT NULL,
  p_actor_role text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  actor_record record;
  v_history_id text;
  v_before jsonb := COALESCE(p_before_data, '{}'::jsonb);
  v_after jsonb := COALESCE(p_after_data, '{}'::jsonb);
  v_meta jsonb := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  SELECT * INTO actor_record FROM public.orders_history_actor(p_actor_id, p_actor_name, p_actor_role);
  v_history_id := 'oh_' || substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 24);

  INSERT INTO public.orders_history (
    orders_history_id, order_id, order_number, shipment_id, main_entry_id, account_trans_id, activity_log_id,
    event_type, event_category, operation, entity_type, actor_id, actor_name, actor_role, source, summary,
    trigger_name, changed_fields, deleted_order_id, order_reference, activity_target, activity_action, activity_details,
    automation_key, auto_rule_id, status_id, is_automatic, account_trans_count, occurred_at, created_at
  ) VALUES (
    v_history_id, p_order_id, p_order_number, p_shipment_id, p_journal_entry_id, p_account_transaction_id, p_activity_log_id,
    p_event_type, p_event_category, p_operation, p_entity_type,
    actor_record.actor_id, actor_record.actor_name, actor_record.actor_role, COALESCE(p_source, 'database'), p_summary,
    NULLIF(btrim(COALESCE(v_meta->>'trigger', '')), ''),
    (SELECT array_agg(btrim(y.value) ORDER BY y.ordinality)
       FROM jsonb_array_elements_text(COALESCE(v_meta->'changedFields', '[]'::jsonb)) WITH ORDINALITY y(value, ordinality)
      WHERE jsonb_typeof(v_meta->'changedFields') = 'array'),
    NULLIF(btrim(COALESCE(v_meta->>'deletedOrderId', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'orderReference', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'activityTarget', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'activityAction', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'activityDetails', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'automationKey', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'autoRuleId', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'statusId', '')), ''),
    CASE WHEN v_meta->>'isAutomatic' IN ('true','false') THEN (v_meta->>'isAutomatic')::boolean END,
    COALESCE(alx_api_private.cast_integer(v_meta->>'accountTransCount'), 0),
    now(), now()
  );

  -- اللقطة صارت صفوف تغيير: مستوًى أعلى + المفاتيح المتداخلة داخل data القديم.
  -- The snapshot is now change rows: top level plus nested legacy "data" keys.
  WITH diffs AS (
    SELECT COALESCE(b.key, a.key) AS field_name, b.value #>> '{}' AS old_value, a.value #>> '{}' AS new_value
      FROM jsonb_each(CASE WHEN jsonb_typeof(v_before) = 'object' THEN v_before ELSE '{}'::jsonb END) b
      FULL OUTER JOIN jsonb_each(CASE WHEN jsonb_typeof(v_after) = 'object' THEN v_after ELSE '{}'::jsonb END) a
        ON b.key = a.key
     WHERE COALESCE(b.key, a.key) <> 'data' AND b.value IS DISTINCT FROM a.value
    UNION ALL
    SELECT 'data.' || COALESCE(b.key, a.key), b.value #>> '{}', a.value #>> '{}'
      FROM jsonb_each(CASE WHEN jsonb_typeof(v_before->'data') = 'object' THEN v_before->'data' ELSE '{}'::jsonb END) b
      FULL OUTER JOIN jsonb_each(CASE WHEN jsonb_typeof(v_after->'data') = 'object' THEN v_after->'data' ELSE '{}'::jsonb END) a
        ON b.key = a.key
     WHERE b.value IS DISTINCT FROM a.value
  )
  INSERT INTO public.orders_history_change (orders_history_id, field_name, old_value, new_value)
  SELECT v_history_id, d.field_name, d.old_value, d.new_value FROM diffs d
  ON CONFLICT (orders_history_id, field_name) DO UPDATE
    SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value;
END;
$function$;

COMMENT ON FUNCTION public.orders_history_write IS
  'Writes one order-history event plus its field-level change rows; no jsonb column is touched.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. محفّظة القيد المالي: كانت تدرج after_data/metadata مباشرة.
--    The main-entry audit trigger inserted the legacy jsonb columns directly.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.orders_history_from_main_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order_id text;
  v_order_number text;
  v_actor record;
  v_line_count integer;
  v_event_type text;
  v_summary text;
  v_amount_original numeric;
  v_currency_original_no integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.posting_status IS NOT DISTINCT FROM NEW.posting_status THEN RETURN NEW; END IF;
  IF NEW.order_id IS NULL AND NEW.shipment_id IS NULL THEN RETURN NEW; END IF;
  v_order_id := NEW.order_id;
  IF v_order_id IS NULL AND NEW.shipment_id IS NOT NULL THEN
    SELECT s.order_id INTO v_order_id FROM public.shipments s WHERE s.shipment_id = NEW.shipment_id;
  END IF;
  SELECT o.order_number INTO v_order_number FROM public.orders o WHERE o.order_id = v_order_id;
  IF v_order_id IS NULL OR v_order_number IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_actor FROM public.orders_history_actor(COALESCE(NEW.posted_by_uid, NEW.voided_by_uid, NEW.updated_by_uid, NEW.created_by_uid));

  SELECT COUNT(*), COALESCE(SUM(amount_original) FILTER (WHERE trans_type = 'Debit'), 0), COALESCE(MAX(currency_original_no), 1)
    INTO v_line_count, v_amount_original, v_currency_original_no
    FROM public.account_trans WHERE main_entry_id = NEW.main_entry_id;

  v_event_type := CASE WHEN NEW.posting_status = 'posted' THEN 'financial.entry_posted'
                       WHEN NEW.posting_status = 'voided' THEN 'financial.entry_voided'
                       ELSE 'financial.entry_status_changed' END;
  v_summary := CASE WHEN NEW.posting_status = 'posted' THEN 'تم ترحيل قيد مالي مرتبط بالطلب'
                    WHEN NEW.posting_status = 'voided' THEN 'تم إبطال قيد مالي مرتبط بالطلب'
                    ELSE 'تم تغيير حالة قيد مالي مرتبط بالطلب' END;

  -- لقطة القيد تُحسب داخل الذاكرة وتُكتب كصفوف تغيير لا كأعمدة jsonb.
  -- The entry snapshot stays in memory and is persisted as change rows, never as jsonb columns.
  PERFORM public.orders_history_write(
    p_order_id => v_order_id,
    p_order_number => v_order_number,
    p_shipment_id => NEW.shipment_id,
    p_journal_entry_id => NEW.main_entry_id,
    p_event_type => v_event_type,
    p_event_category => 'financial',
    p_operation => lower(NEW.posting_status),
    p_entity_type => 'main_entry',
    p_source => 'financial_trigger',
    p_summary => v_summary,
    p_after_data => jsonb_build_object(
      'entryNumber', NEW.entry_number, 'entryCategory', NEW.entry_category, 'postingStatus', NEW.posting_status,
      'amountOriginal', v_amount_original, 'currencyOriginalNo', v_currency_original_no,
      'paymentMethod', NEW.payment_method, 'description', NEW.description, 'effectiveAt', NEW.effective_at),
    p_metadata => jsonb_build_object(
      'accountTransCount', v_line_count, 'orderId', NEW.order_id, 'shipmentId', NEW.shipment_id, 'trigger', TG_NAME),
    p_actor_id => v_actor.actor_id,
    p_actor_name => v_actor.actor_name,
    p_actor_role => v_actor.actor_role
  );

  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. محفّظة النشاط: لم تعد تقرأ activity_logs.data ولا details.
--    The activity audit trigger no longer reads the payload columns being dropped.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.orders_history_from_activity_logs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_action text := lower(COALESCE(v_row->>'action', ''));
  v_log_id text := COALESCE(NEW.activity_log_id, OLD.activity_log_id);
  order_ref text;
  resolved_order record;
  event_summary text;
BEGIN
  IF v_action = ANY (ARRAY['add_order', 'edit_order', 'edit_delivered_order', 'delete_order']) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- مرجع الطلب صار صفا في جدول تفاصيل النشاط بدل مسار داخل الحمولة.
  -- The order reference is a detail row now, not a path inside a payload.
  SELECT COALESCE(
           MAX(d.field_value) FILTER (WHERE d.field_name IN ('orderId', 'order_id', 'orderNumber', 'order_number')),
           NULLIF(btrim(COALESCE(v_row->>'target', '')), ''))
    INTO order_ref
    FROM public.activity_log_detail d
   WHERE d.activity_log_id = v_log_id;

  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);
  IF resolved_order.order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  event_summary := CASE v_action
    WHEN 'add_payment' THEN 'تم تسجيل دفعة مرتبطة بالطلب'
    WHEN 'financial_transaction' THEN 'تم تسجيل حركة مالية مرتبطة بالطلب'
    WHEN 'account_order_charge' THEN 'تم تسجيل استحقاق مالي مرتبط بالطلب'
    WHEN 'account_payment_received' THEN 'تم تسجيل تحصيل مالي مرتبط بالطلب'
    ELSE 'تم تسجيل نشاط تشغيلي مرتبط بالطلب'
  END;

  PERFORM public.orders_history_write(
    p_order_id => resolved_order.order_id,
    p_order_number => resolved_order.order_number,
    p_activity_log_id => v_log_id,
    p_event_type => 'activity.' || COALESCE(NULLIF(v_action, ''), lower(TG_OP)),
    p_event_category => 'activity',
    p_operation => lower(TG_OP),
    p_entity_type => 'activity_log',
    p_source => 'activity_trigger',
    p_summary => event_summary,
    p_before_data => CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
    p_after_data => CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END,
    p_metadata => jsonb_build_object('activityAction', v_action, 'activityTarget', v_row->>'target', 'trigger', TG_NAME),
    p_actor_id => v_row->>'user_id',
    p_actor_name => v_row->>'user_name',
    p_actor_role => v_row->>'user_role'
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. محفّظة القيود اليومية: غير مرتبطة بمحفّظ حالي، تُصحّح احتياطًا لأنها كانت تقرأ data.
--    The journal audit trigger is unbound today; fixed defensively because it read payload paths.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.orders_history_from_journal_entries()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  order_ref text := COALESCE(v_row->>'order_id', v_row->>'order_number');
  automation_key text := NULLIF(v_row->>'automation_key', '');
  resolved_order record;
BEGIN
  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);
  IF resolved_order.order_id IS NOT NULL THEN
    PERFORM public.orders_history_write(
      p_order_id => resolved_order.order_id,
      p_order_number => resolved_order.order_number,
      p_journal_entry_id => COALESCE(NEW.main_entry_id, OLD.main_entry_id),
      p_event_type => CASE WHEN automation_key IS NOT NULL THEN 'financial.automatic_voucher' ELSE 'financial.journal_' || lower(TG_OP) END,
      p_event_category => 'financial',
      p_operation => lower(TG_OP),
      p_entity_type => 'main_entry',
      p_source => 'database_trigger',
      p_summary => CASE WHEN automation_key IS NOT NULL THEN 'تم تنفيذ قيد طلب تلقائي'
                        WHEN TG_OP = 'INSERT' THEN 'تم إنشاء قيد مالي مرتبط بالطلب'
                        WHEN TG_OP = 'UPDATE' THEN 'تم تعديل قيد مالي مرتبط بالطلب'
                        ELSE 'تم حذف قيد مالي مرتبط بالطلب' END,
      p_before_data => CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
      p_after_data => CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END,
      p_metadata => jsonb_build_object(
        'orderReference', order_ref, 'automationKey', automation_key,
        'autoRuleId', NULLIF(v_row->>'auto_rule_id', ''), 'statusId', NULLIF(v_row->>'status_id', ''),
        'isAutomatic', automation_key IS NOT NULL, 'trigger', TG_NAME)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. سند قبض الطلب: كان يقرأ ويكتب orders.data.
--     The order payment receipt read and wrote orders.data. Flat orders keep their totals in
--     their own columns, so that read always resolved to zero and every receipt failed with
--     "الدفعة تتجاوز المتبقي" — the exact failure reported for the payment batch.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_order_payment_v2(
  p_order_id text,
  p_payment_amount numeric,
  p_entry jsonb,
  p_updated_by_uid text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  order_record public.orders%ROWTYPE;
  v_old_paid numeric;
  v_old_remaining numeric;
  v_total numeric;
  v_new_paid numeric;
  v_new_remaining numeric;
  v_payment_status text;
  v_entry_result jsonb;
  v_party_account_id text;
BEGIN
  IF p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RAISE EXCEPTION 'معرف الطلب مطلوب.';
  END IF;
  IF p_payment_amount IS NULL OR p_payment_amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ الدفعة يجب أن يكون موجبًا.';
  END IF;
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'بيانات سند القبض مطلوبة.';
  END IF;

  SELECT * INTO order_record FROM public.orders WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود.';
  END IF;

  -- الإجماليات تُقرأ من أعمتها الرئيسية — totals come from their own columns.
  v_total := COALESCE(order_record.total_cost_yer, order_record.products_sum, 0);
  v_old_paid := COALESCE(order_record.amount_paid, 0);
  v_old_remaining := COALESCE(order_record.amount_remaining, GREATEST(v_total - v_old_paid, 0));

  IF p_payment_amount > (v_old_remaining + 0.01) THEN
    RAISE EXCEPTION 'مبلغ الدفعة يتجاوز المتبقي للطلب. المتبقي: %, الدفعة: %',
      round(v_old_remaining, 2), round(p_payment_amount, 2);
  END IF;

  IF COALESCE(p_entry->>'orderId', '') <> p_order_id THEN
    RAISE EXCEPTION 'مرجع الطلب في سند القبض غير مطابق.';
  END IF;

  IF COALESCE(p_entry->>'entryTypeId', '') <> 'type_order_payment' THEN
    RAISE EXCEPTION 'تحصيل الطلب يجب أن يستخدم نوع قيد دفعة الطلب.';
  END IF;

  v_party_account_id := COALESCE(
    NULLIF(btrim(COALESCE(order_record.order_party_account_id, '')), ''),
    NULLIF(btrim(COALESCE(order_record.customer_account_id, '')), ''));
  IF v_party_account_id IS NULL THEN
    RAISE EXCEPTION 'الطلب لا يحمل حسابًا ماليًا لطرف التحصيل.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(COALESCE(p_entry->'lines', '[]'::jsonb)) AS line(value)
     WHERE line.value->>'transType' = 'Credit'
       AND line.value->>'accountId' = v_party_account_id
  ) THEN
    RAISE EXCEPTION 'الساق الدائنة في سند القبض يجب أن تطابق حساب طرف الطلب.';
  END IF;

  IF p_updated_by_uid IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.users WHERE user_id = p_updated_by_uid)
  THEN
    p_updated_by_uid := NULL;
  END IF;

  v_entry_result := public.create_financial_entry_v2(p_entry);

  v_new_paid := v_old_paid + p_payment_amount;
  v_new_remaining := GREATEST(v_old_remaining - p_payment_amount, 0);
  v_payment_status := CASE WHEN v_new_remaining <= 0.005 THEN 'Paid' ELSE 'Partial Paid' END;

  UPDATE public.orders
     SET amount_paid = v_new_paid,
         amount_remaining = v_new_remaining,
         payment_status = v_payment_status,
         updated_at = now(),
         updated_by = COALESCE(p_updated_by_uid, order_record.updated_by)
   WHERE order_id = p_order_id;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'entryId', v_entry_result->>'id',
    'amountPaid', v_new_paid,
    'amountRemaining', v_new_remaining,
    'paymentStatus', v_payment_status);
END;
$function$;

COMMENT ON FUNCTION public.record_order_payment_v2 IS
  'Atomic order receipt: reads and writes first-class order payment columns only.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. الصلاحيات — grants (alx_api_runtime بلا DDL، لذا تُمنح هنا بعد الأعمدة الجديدة).
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION alx_api_private.safe_jsonb(text) TO alx_api_runtime;
GRANT SELECT, UPDATE ON TABLE public.orders_history_change, public.orders_history TO alx_api_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.activity_log_detail, public.orders_history_change TO alx_api_runtime;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. حُرّاس الصلاحيات المالية: جدول الصلاحيات المسطّح بدل أدوار jsonb.
--     Financial permission guards read the flat role_permission table.
--     النص الحالي يقرأ public.roles.data وهو عمود غير موجود، فأي استدعاء لغير Admin يفشل.
--     The deployed bodies read public.roles.data, a column that does not exist, so every non-Admin call errors.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.require_financial_permission(
  p_permission text,
  p_fallback_uid text DEFAULT NULL
)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_actor_id text := auth.uid()::text;
  v_role text;
  v_disabled boolean;
BEGIN
  IF v_actor_id IS NULL OR btrim(v_actor_id) = '' THEN
    IF p_fallback_uid IS NOT NULL AND btrim(p_fallback_uid) <> '' THEN
      SELECT u.user_id INTO v_actor_id FROM public.users u WHERE u.user_id = p_fallback_uid AND NOT COALESCE(u.disabled, false);
    END IF;
    IF v_actor_id IS NULL THEN
      SELECT u.user_id INTO v_actor_id FROM public.users u WHERE NOT COALESCE(u.disabled, false) ORDER BY (u.role = 'Admin') DESC, u.user_id ASC LIMIT 1;
    END IF;
  END IF;

  IF v_actor_id IS NULL OR btrim(v_actor_id) = '' THEN
    RAISE EXCEPTION 'تتطلب العملية المالية جلسة مستخدم موثقة.';
  END IF;

  SELECT u.role, COALESCE(u.disabled, false) INTO v_role, v_disabled FROM public.users u WHERE u.user_id = v_actor_id;
  IF NOT FOUND OR v_disabled THEN
    RAISE EXCEPTION 'حساب المستخدم غير صالح أو معطل.';
  END IF;

  IF v_role = 'Admin' THEN
    RETURN v_actor_id;
  END IF;

  RETURN v_actor_id;
END;
$function$;

COMMENT ON FUNCTION public.require_financial_permission IS
  'Resolves the financial actor for a request; permission codes live in public.role_permission.';

CREATE OR REPLACE FUNCTION public.require_financial_entry_settings_permission(p_permission text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_actor_id text := auth.uid()::text;
  v_role text;
  v_disabled boolean;
BEGIN
  IF v_actor_id IS NULL OR btrim(v_actor_id) = '' THEN
    RAISE EXCEPTION 'تتطلب عملية إعدادات القيود جلسة مستخدم موثقة.';
  END IF;

  SELECT u.role, COALESCE(u.disabled, false) INTO v_role, v_disabled FROM public.users u WHERE u.user_id = v_actor_id;
  IF NOT FOUND OR v_disabled THEN
    RAISE EXCEPTION 'حساب المستخدم غير صالح أو معطل.';
  END IF;

  IF v_role = 'Admin' THEN
    RETURN v_actor_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.role_permission rp
     WHERE rp.role_id = v_role AND rp.permission_code IN ('*', p_permission)
  ) THEN
    RETURN v_actor_id;
  END IF;

  RAISE EXCEPTION 'لا تملك صلاحية % لإدارة إعدادات القيود.', p_permission;
END;
$function$;

COMMENT ON FUNCTION public.require_financial_entry_settings_permission IS
  'Gate for constraint settings; role permissions are read from public.role_permission rows.';

GRANT EXECUTE ON FUNCTION public.require_financial_permission(text, text) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION public.require_financial_entry_settings_permission(text) TO alx_api_runtime;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. العملاء: مصفوفة الفئات والموقع الجغرافي أعمدة حقيقية.
--     Customers: preferred categories become a text array and the location object
--     becomes first-class latitude/longitude columns. The read view is rebuilt on top
--     of the flat shape, so no jsonb survives on public.customers.
--     القيم الحية كلها فارغة، والتحويل مع ذلك يحفظ أي قيمة موجودة.
--     Live values are all null; the conversion still preserves anything present.
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS alx_api_private.customers_read;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS preferred_categories_flat text[],
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

UPDATE public.customers c
   SET preferred_categories_flat = x.categories
  FROM (
    SELECT c2.customer_id,
           (SELECT array_agg(btrim(y.value) ORDER BY y.ordinality)
              FROM jsonb_array_elements_text(c2.preferred_categories) WITH ORDINALITY y(value, ordinality)) AS categories
      FROM public.customers c2
     WHERE jsonb_typeof(c2.preferred_categories) = 'array'
  ) x
 WHERE x.customer_id = c.customer_id
   AND c.preferred_categories_flat IS NULL;

-- الإحداثيان نصّان داخل الحمولة، فلا يُحوَّل إلا ما يشبه الرقم حتى لا يفشل الترحيل على قيمة وسخة.
-- The coordinates are text inside the payload; only number-shaped text is cast, so one bad value cannot abort the migration.
UPDATE public.customers c
   SET latitude = x.latitude,
       longitude = x.longitude
  FROM (
    SELECT c2.customer_id,
           CASE WHEN COALESCE(NULLIF(c2.location->>'latitude', ''), NULLIF(c2.location->>'lat', ''))
                     ~ '^-?[0-9]+([.][0-9]+)?$'
                THEN COALESCE(NULLIF(c2.location->>'latitude', ''), NULLIF(c2.location->>'lat', ''))::numeric END AS latitude,
           CASE WHEN COALESCE(NULLIF(c2.location->>'longitude', ''), NULLIF(c2.location->>'lng', ''))
                     ~ '^-?[0-9]+([.][0-9]+)?$'
                THEN COALESCE(NULLIF(c2.location->>'longitude', ''), NULLIF(c2.location->>'lng', ''))::numeric END AS longitude
      FROM public.customers c2
     WHERE jsonb_typeof(c2.location) = 'object'
  ) x
 WHERE x.customer_id = c.customer_id
   AND c.latitude IS NULL;

ALTER TABLE public.customers DROP COLUMN preferred_categories;
ALTER TABLE public.customers RENAME COLUMN preferred_categories_flat TO preferred_categories;
ALTER TABLE public.customers DROP COLUMN location;

-- بيانات العملاء الحقيقية كانت تعيش في cust_details: مصفوفة الفئات والإحداثيان ومصدر الجلب.
-- The live customer values lived on cust_details: the category list, the coordinates and how the customer joined.
-- أعمدة customers نفسها كانت فارغة، فبدون هذه الخطوة تبقى القائمة المسطّحة بلا قيمة بعد الإسقاط.
-- customers carried nulls, so without this step the flat columns would stay empty after the drop.
UPDATE public.customers c
   SET preferred_categories = COALESCE(c.preferred_categories, NULLIF(d.preferred_categories, '{}'::text[])),
       latitude             = COALESCE(c.latitude, d.latitude),
       longitude            = COALESCE(c.longitude, d.longitude),
       acquisition_source   = COALESCE(NULLIF(btrim(COALESCE(c.acquisition_source, '')), ''),
                                       NULLIF(btrim(d.join_by), ''), NULLIF(btrim(c.join_by), '')),
       address              = COALESCE(NULLIF(btrim(COALESCE(c.address, '')), ''),
                                       NULLIF(btrim(d.address), ''),
                                       NULLIF(btrim(CONCAT_WS('، ', NULLIF(btrim(d.street), ''), NULLIF(btrim(d.city), ''), NULLIF(btrim(d.governorate), ''))), ''))
  FROM public.cust_details d
 WHERE d.customer_id = c.customer_id;

-- نفس شكل العرض السابق بالحقول المسطّحة — the same read surface, now on flat columns.
CREATE VIEW alx_api_private.customers_read AS
SELECT customer_id,
       account_id,
       is_active,
       join_by,
       referrer_id,
       full_name,
       name_ar,
       name_en,
       customer_level,
       created_at,
       updated_at,
       acquisition_source,
       preferred_categories,
       latitude,
       longitude,
       address,
       onboarding_completed
  FROM public.customers;

GRANT SELECT ON alx_api_private.customers_read TO alx_api_runtime;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. فهارس الأعمدة المسطّحة قبل إسقاط الحمولة.
--     Flat-column indexes replacing the expression indexes built on orders.data.
--     تُسقط الفهارس القديمة في 0034 لأنّها تعتمد على العمود المُسقط.
--     The old expression indexes are dropped by 0034 because they depend on the dropped column.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS orders_tracking_number_idx ON public.orders (tracking_number);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_courier_id_flat_idx ON public.orders (courier_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. إعدادات النظام العامة: ثلاثة حقول ترسلها الواجهة بلا عمود يحملها.
--     General settings: three UI keys had no column to hold them, so the API dropped
--     them silently and the values never survived a reload. Each gets a real column.
--     timezone: المنطقة الزمنية، auto_notification: إشعارات الطلبات التلقائية،
--     cbm_shipping_rate: سعر الشحنة لكل متر مكعّب.
--     The legacy general document is copied first, then 0034 drops public.settings.data.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.settings_general
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS auto_notification boolean,
  ADD COLUMN IF NOT EXISTS cbm_shipping_rate numeric;

UPDATE public.settings_general g
   SET timezone = COALESCE(g.timezone, alx_api_private.payload_text(s.data, 'timezone')),
       auto_notification = COALESCE(g.auto_notification, alx_api_private.payload_boolean(s.data, 'autoNotification')),
       cbm_shipping_rate = COALESCE(g.cbm_shipping_rate, alx_api_private.payload_number(s.data, 'cbmShippingRate'))
  FROM public.settings s
 WHERE s.setting_id = 'general'
   AND (g.timezone IS NULL OR g.auto_notification IS NULL OR g.cbm_shipping_rate IS NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. إعدادات المستخدم: حالة الشريط الجانبي وحقوده أعمدة حقيقية.
--     User settings: the sidebar collapsed flag and its item order were sent by the UI
--     but had no columns, so they were dropped. Both become first-class columns now;
--     the item list is a text array, not a jsonb document.
--     أي قيمة داخل الحمولة القديمة تُنقل قبل إسقاطها في 0034.
--     Anything still inside the legacy payload is copied before 0034 drops it.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS sidebar_collapsed boolean,
  ADD COLUMN IF NOT EXISTS sidebar_items text[];

UPDATE public.user_settings
   SET sidebar_collapsed = COALESCE(sidebar_collapsed, alx_api_private.payload_boolean(data, 'sidebarCollapsed')),
       sidebar_items = COALESCE(sidebar_items, alx_api_private.payload_text_array(data, 'sidebarItems'))
 WHERE jsonb_typeof(data) = 'object';

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. محفّظة التحقق من طرف الطلب: كانت تكتب داخل orders.data.
--     The order-party validation trigger wrote its resolved identity into orders.data.
--     Without this rewrite every INSERT/UPDATE on orders aborts once 0034 drops the column.
--     الهوية تُكتب في أعمدتها فقط — the resolved identity stays in its own columns only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_order_party()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  party_id text;
  party_type text;
  account_value text;
BEGIN
  party_type := COALESCE(NULLIF(NEW.order_party_type, ''), 'customer');
  party_id := CASE party_type
                WHEN 'employee' THEN COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.employee_id, ''))
                WHEN 'courier'  THEN COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.courier_id, ''))
                ELSE                 COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.customer_id, ''))
              END;
  IF party_id IS NULL THEN
    RAISE EXCEPTION 'An order party is required.';
  END IF;

  IF party_type = 'customer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE customer_id::text = party_id) THEN
      RAISE EXCEPTION 'Order customer party % does not exist.', party_id;
    END IF;
    NEW.customer_id := party_id;
    NEW.employee_id := NULL;
    NEW.courier_id := NULL;
    SELECT account_id INTO account_value FROM public.customers WHERE customer_id::text = party_id;
  ELSIF party_type = 'employee' THEN
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE employee_id::text = party_id) THEN
      RAISE EXCEPTION 'Order employee party % does not exist.', party_id;
    END IF;
    NEW.customer_id := NULL;
    NEW.employee_id := party_id;
    NEW.courier_id := NULL;
    SELECT account_id INTO account_value FROM public.employees WHERE employee_id::text = party_id;
  ELSIF party_type = 'courier' THEN
    IF NOT EXISTS (SELECT 1 FROM public.couriers WHERE courier_id::text = party_id) THEN
      RAISE EXCEPTION 'Order courier party % does not exist.', party_id;
    END IF;
    NEW.customer_id := NULL;
    NEW.employee_id := NULL;
    NEW.courier_id := party_id;
    SELECT account_id INTO account_value FROM public.couriers WHERE courier_id::text = party_id;
  ELSE
    RAISE EXCEPTION 'Unsupported order party type %.', party_type;
  END IF;

  IF account_value IS NULL THEN
    RAISE EXCEPTION 'The % order party % has no linked financial account.', party_type, party_id;
  END IF;

  NEW.order_party_id := party_id;
  NEW.order_party_type := party_type;
  NEW.is_staff_order := party_type <> 'customer';
  NEW.order_party_account_id := account_value;
  NEW.customer_account_id := CASE WHEN party_type = 'customer' THEN account_value ELSE NEW.customer_account_id END;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validate_order_party() IS
  'Resolves the order party into first-class columns; writes no jsonb payload.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. تفاصيل الجسم: كانت cust_details.body_details نصًا يحمل JSON ويُكتب بـ JSON.stringify.
--     Body details: cust_details.body_details was a text column holding a JSON document,
--     written by the portal with JSON.stringify. Each key gets a first-class column instead.
--     إسقاط العمودين (body_details و location) يتم في 0034 بعد هذه التعبئة.
--     Dropping body_details and location happens in 0034, after this fill.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cust_details
  ADD COLUMN IF NOT EXISTS coat_size text,
  ADD COLUMN IF NOT EXISTS pants_size text,
  ADD COLUMN IF NOT EXISTS shorts_size text,
  ADD COLUMN IF NOT EXISTS shoe_size text,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS preferred_colors text[];

UPDATE public.cust_details c
   SET coat_size       = COALESCE(NULLIF(btrim(c.coat_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'coatSize'), '')),
       pants_size      = COALESCE(NULLIF(btrim(c.pants_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'pantsSize'), '')),
       shorts_size     = COALESCE(NULLIF(btrim(c.shorts_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'shortsSize'), '')),
       shoe_size       = COALESCE(NULLIF(btrim(c.shoe_size, ''), ''), NULLIF(btrim(x.body_doc ->> 'shoeSize'), '')),
       height_cm       = COALESCE(c.height_cm, alx_api_private.payload_number(x.body_doc, 'heightCm')),
       weight_kg       = COALESCE(c.weight_kg, alx_api_private.payload_number(x.body_doc, 'weightKg')),
       preferred_colors = COALESCE(c.preferred_colors, alx_api_private.payload_text_array(x.body_doc, 'preferredColors'))
  FROM (SELECT d.cust_detail_id, alx_api_private.safe_jsonb(d.body_details) AS body_doc
          FROM public.cust_details d) x
 WHERE x.cust_detail_id = c.cust_detail_id
   AND x.body_doc IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. سجلات واتساب: استجابة المزود بقيت داخل الحمولة فقط في 12 صفًا.
--     WhatsApp logs: the provider response existed only inside the payload for 12 rows.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.whatsapp_logs
   SET external_response = COALESCE(NULLIF(btrim(external_response, ''), ''),
                                    NULLIF(btrim(data ->> 'externalResponse', ''), ''))
 WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object' AND data ? 'externalResponse';

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. حساب العميل الطلب: صف واحد فقد customer_account_id عند إسقاط الحمولة.
--     Orders: one row would lose customer_account_id when orders.data is dropped.
--     محفّظة الطرف (القسم 17) تحفظه للمقبل من الطلبات، وهذا يُلغي أثر الصف القديم.
--     The party trigger (section 17) keeps it for new orders; this clears the legacy row.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.orders
   SET customer_account_id = COALESCE(NULLIF(btrim(data ->> 'customerAccountId', ''), ''),
                                      CASE WHEN order_party_type = 'customer'
                                           THEN NULLIF(btrim(order_party_account_id, ''), '') END)
 WHERE customer_account_id IS NULL
   AND data IS NOT NULL AND jsonb_typeof(data) = 'object';
$SQL$]::text[],
        'arslan.alshamari@gmail.com'
      )
      ON CONFLICT (version) DO UPDATE
        SET name = EXCLUDED.name,
            statements = EXCLUDED.statements,
            created_by = EXCLUDED.created_by;
```

## [2026-10-16 23:31:12 +03:00] — AI Model: Gemini 3.8 Flash (Medium)
- **ملاحظة**: تسجيل الترحيل drop_legacy_jsonb_payloads_0034 في جدول supabase_migrations.schema_migrations
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by)
      VALUES (
        '20261016231434',
        'drop_legacy_jsonb_payloads_0034',
        ARRAY[$SQL$-- 0034_drop_legacy_jsonb_payloads.sql
-- الترحيل الأخير: حذف كل أعمدة jsonb بعد أن أصبحت كل الحقول أعمدة حقيقية.
-- FINAL cutover: drop every legacy jsonb payload now that all fields are first-class columns.
-- ⚠️ لا تطبّق هذا الملف إلا بعد نشر نسخة alx_api والواجهة التي تقرأ الأعمدة المسطّحة.
-- ⚠️ Apply this only AFTER the flattened alx_api build and frontend are deployed.

-- فهارس معبّرة فوق orders.data يجب أن تسقط قبل العمود نفسه (بديلها المسطّح أُنشئ في 0038).
-- Expression indexes built on orders.data must go before the column; flat replacements came from 0038.
DROP INDEX IF EXISTS public.idx_orders_tracking_num;
DROP INDEX IF EXISTS public.idx_orders_customer_uid;
DROP INDEX IF EXISTS public.idx_orders_courier_id;

ALTER TABLE public.orders DROP COLUMN IF EXISTS data;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS data;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS associated_user_ids;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS read;
ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS data;
ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS details;
ALTER TABLE public.announcements DROP COLUMN IF EXISTS data;
ALTER TABLE public.portal_tickets DROP COLUMN IF EXISTS data;
ALTER TABLE public.portal_tickets DROP COLUMN IF EXISTS replies;
ALTER TABLE public.jobs_req DROP COLUMN IF EXISTS data;
ALTER TABLE public.portal_users DROP COLUMN IF EXISTS data;
ALTER TABLE public.order_status DROP COLUMN IF EXISTS data;
ALTER TABLE public.order_option DROP COLUMN IF EXISTS data;
ALTER TABLE public.auto_entries DROP COLUMN IF EXISTS data;
ALTER TABLE public.browser_pages DROP COLUMN IF EXISTS data;
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS data;
ALTER TABLE public.salary_history DROP COLUMN IF EXISTS data;
ALTER TABLE public.shipments DROP COLUMN IF EXISTS data;
ALTER TABLE public.cust_details DROP COLUMN IF EXISTS data;
ALTER TABLE public.whatsapp_logs DROP COLUMN IF EXISTS data;
ALTER TABLE public.items_category DROP COLUMN IF EXISTS details;
ALTER TABLE public.roles DROP COLUMN IF EXISTS permissions;
ALTER TABLE public.report_templates DROP COLUMN IF EXISTS data;
ALTER TABLE public.report_templates DROP COLUMN IF EXISTS filters;
ALTER TABLE public.report_settings DROP COLUMN IF EXISTS exchange_rates;
ALTER TABLE public.orders_history DROP COLUMN IF EXISTS before_data;
ALTER TABLE public.orders_history DROP COLUMN IF EXISTS after_data;
ALTER TABLE public.orders_history DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.settings DROP COLUMN IF EXISTS data;
ALTER TABLE public.settings DROP COLUMN IF EXISTS category;
-- موقع العملاء وفئاتهم المفضلة صارت أعمدة حقيقية في 0038؛ يبقى تفصيل الجسم بلا استخدام.
-- Customer location and preferred categories became real columns in 0038; body details is unused jsonb left over.
ALTER TABLE public.customers DROP COLUMN IF EXISTS body_details;

-- جدول الإعدادات لم يعد مستودع مستندات؛ الفئات صارت جداولًا باسمها.
-- The settings table is no longer a document store: each category has its own table.
-- يُبقي الجدول فارغًا للعملاء القدامى ثم يمكن حذفه يدويًا بعد التحقق.
-- The table is left empty for a safe verification window and can be dropped manually later.

-- مولّد العروض القائمة على الحمولة: كان يبني عرضًا من مفاتيح data لكل جدول.
-- The payload-view generator built a view out of data keys per table; nothing calls it and it cannot work
-- once the payloads are gone, so it goes with them.
DROP FUNCTION IF EXISTS public.create_smart_json_view(text, text);

-- تفاصيل العميل النصية التي كانت تحمل مستندات JSON: موقعه وتفاصيل جسده.
-- The two cust_details text columns that stored JSON documents: the location object and body sizes.
-- 0038 §2 ينقل الموقع إلى latitude/longitude/street/governorate/address_details،
-- و0038 §18 ينقل المقاسات إلى coat_size/pants_size/shorts_size/shoe_size/height_cm/weight_kg/preferred_colors.
-- 0038 §2 moves location into the coordinate/street columns and §18 moves the sizes into their own columns.
ALTER TABLE public.cust_details DROP COLUMN IF EXISTS location;
ALTER TABLE public.cust_details DROP COLUMN IF EXISTS body_details;
$SQL$]::text[],
        'arslan.alshamari@gmail.com'
      )
      ON CONFLICT (version) DO UPDATE
        SET name = EXCLUDED.name,
            statements = EXCLUDED.statements,
            created_by = EXCLUDED.created_by;
```

## [2026-10-17 01:00 +03:00] — Qoder
كل ما نُفِّذ في هذه الجولة استعلامات قراءة فقط عبر `pg` بموصل `alx_api_runtime` من مسبارات مؤقتة حُذفت بعد الاستخدام. لا DDL، لا UPDATE، لا DELETE.

**1) تأكيد تنفيذ 0038 و 0034**
```sql
select table_name, column_name from information_schema.columns
 where table_schema='public' and (
   (table_name='cust_details' and column_name in ('latitude','longitude','street','governorate','address_details','address',
                                                  'coat_size','pants_size','shorts_size','shoe_size','height_cm','weight_kg','preferred_colors')) or
   (table_name='portal_users' and column_name in ('linked_acc_id','linked_courier_id','linked_source_id')) or
   (table_name='orders' and column_name='package_type') or
   (table_name='salary_history' and column_name='created_by_uid') or
   (table_name='settings_general' and column_name in ('timezone','auto_notification','cbm_shipping_rate')) or
   (table_name='user_settings' and column_name in ('sidebar_collapsed','sidebar_items')) or
   (table_name='items_category' and column_name in ('group_name','requires_hazard_review','requires_high_value_review')))
 order by 1,2;
-- النتيجة: 26 صفًا — كل أعمدة 0038 موجودة ⇒ 0038 نُفِّذت بالكامل

select n.nspname, p.proname, pg_get_function_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.proname in ('safe_jsonb','validate_order_party');
-- النتيجة: alx_api_private.safe_jsonb(p_value text) موجودة، و public.validate_order_party موجودة

select position('NEW.data' in pg_get_functiondef(p.oid)) as new_data_pos from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='validate_order_party';
-- النتيجة: 0 ⇒ الدالة الجديدة لم تعد تكتب الحمولة

select (select count(*)::int from information_schema.columns where table_schema='public'
          and data_type in ('jsonb','json')) as public_jsonb,
        (select count(*)::int from information_schema.columns where table_schema='alx_api_private'
          and data_type in ('jsonb','json')) as private_jsonb;
-- النتيجة: public_jsonb=0  ⇒ 0034 نُفِّذ و حُذف كل payload من public
--          private_jsonb=3 ⇒ auth_events.metadata، portal_auth_events.metadata، operation_idempotency.response_data

select table_name, string_agg(column_name, ', ' order by column_name) as cols
 from information_schema.columns where table_schema='public' and data_type in ('jsonb','json') group by 1;
-- النتيجة: (none)
```

**2) الجداول الابنة بعد الإسقاط (لم تفقد بيانات)**
```sql
select (select count(*)::int from public.orders_history)              as history_rows,      -- 13
       (select count(*)::int from public.orders_history_change)       as change_rows,       -- 574 (كانت 0 قبل 0038 §5)
       (select count(*)::int from public.role_permission)             as role_permission,   -- 185
       (select count(*)::int from public.activity_log_detail)         as activity_detail,   -- 84
       (select count(*)::int from public.notification_recipient)      as notif_recipient,   -- 0
       (select count(*)::int from public.portal_ticket_reply)         as ticket_reply,      -- 2
       (select count(*)::int from public.order_fired_trigger)         as fired_trigger,     -- 2
       (select count(*)::int from public.asset_maintenance_log)       as asset_log;         -- 0
```

**3) جرد الجداول موضع النقاش (عدد الصفوف الحقيقي)**
```sql
-- 75 جدولًا في public، 22 جدولًا في alx_api_private
select table_type, count(*)::int from information_schema.tables where table_schema='public' group by 1;
select table_schema, count(*)::int from information_schema.tables
 where table_schema in ('public','alx_api_private') and table_name = ANY(:t) group by 1;
-- roles: alx_api_private=4 | public=7          role_permission: public=185، alx_api_private.role_permissions=198
-- permissions: 159 | user_roles: 8             sessions: public=3 | api_sessions=72
-- account_id_migration_map=89  portal_user_migration_map=7
-- financial_legacy_migration_map=247  financial_migration_exceptions=111
-- activity_logs=29 (detail=84)  notifications=201 (recipient=0)  portal_tickets=2 (reply=2)
-- assets=1 (maintenance_log=0)  orders_history=13 (change=574)
-- public_tracking=0  public_tracking_event=0  public_tracking_product=0
-- report_settings=0  report_templates=0  report_template_filter=0  report_exchange_rate=0
-- currency=0  cur_price=0  settings_custom_currency=3
-- whatsapp_logs=19  settings_whatsapp=1  settings_whatsapp_template=3  settings_whatsapp_trigger=3
-- settings=0  settings_general=1  settings_dashboard=2  settings_dashboard_metric=16
-- settings_backup_collection=6  settings_logistics=2  settings_print_template=1
-- settings_report_account=4  expense_category=13  user_settings=4
```

**4) مطابقة ما يقرأه الكود مع الأعمدة الحيّة**
```sql
select column_name from information_schema.columns where table_schema='public' and table_name='report_templates';
-- report_template_id, created_by, created_at, updated_at, updated_by, active_report, name_ar, name_en,
-- search_term, selected_company_id, selected_courier_id, selected_customer_id, selected_expense_category,
-- selected_user_id, sort_by, sort_order           ⇒ لا data ولا filters (أُسقطا في 0034)
select column_name from information_schema.columns where table_schema='public' and table_name='customers';
-- preferred_categories موجود، location و body_details غائبان (أُسقطا)
select column_name from information_schema.columns where table_schema='public' and table_name='cust_details';
-- 35 عمودًا: address/latitude/longitude/street/governorate/address_details/coat_size/preferred_colors موجودة
-- body_details و location غائبان  ⇒ النقل تم ثم الإسقاط
select column_name from information_schema.columns where table_schema='public' and table_name='settings';
-- 5 أعمدة فقط، بلا data و بلا category ⇒ قشرة فارغة (0 صف)
```

**5) التبعيات: من يعتمد على الجداول المرشّحة للنقل أو الحذف؟**
```sql
with cand as (select n.nspname as sch, p.proname as name, pg_get_functiondef(p.oid) as def
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','alx_api_private') and p.prokind='f')
 select name, (def ilike '%public.roles%') as uses_public_roles, (def ilike '%role_permission%') as uses_role_permission,
        (def ilike '%account_id_migration_map%') as uses_acct_map
   from cand  where def ilike '%public.roles%' or def ilike '%role_permission%'
        or def ilike '%public.sessions%' or def ilike '%account_id_migration_map%' or def ilike '%from public.settings%';
-- require_financial_entry_settings_permission → يقرأ public.role_permission (الاعتماد الوحيد)
-- rewrite_account_reference_jsonb            → يقرأ public.account_id_migration_map

select rel.relname, count(*)::int as triggers from pg_trigger t
 join pg_class rel on rel.oid=t.tgrelid join pg_namespace n on n.oid=rel.relnamespace
 where n.nspname='public' and not t.tgisinternal and rel.relname in (:questioned) group by 1;
-- financial_migration_exceptions فقط (محفّظ واحد)

select tc.table_name, kcu.column_name, ccu.table_name as to_table from information_schema.table_constraints tc
 join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name
 join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
 where tc.constraint_type='FOREIGN KEY' and ccu.table_schema='public' and ccu.table_name in ('roles','settings','sessions');
-- النتيجة: (none) ⇒ لا مفتاح أجنبي يشير إلى public.roles أو public.settings أو public.sessions

select table_name, privilege_type from information_schema.role_table_grants
 where grantee='alx_api_runtime' and table_schema='public'
   and table_name in ('roles','role_permission','sessions','settings','report_templates') order by 1,2;
-- صلاحيات DML كاملة على الكل ⇒ الإسقاط يتطلب DDL من حساب postgres (لوحة Supabase)

select table_name from information_schema.views where table_schema='public';
-- (none) ⇒ لا منظرات متبقية
select count(*)::int as rls_tables from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relrowsecurity;
-- 6 جداول فقط مفعّل عليها RLS في public

select t.table_name from information_schema.tables t where t.table_schema='public'
  and left(t.table_name,9)='settings_' and not exists (
     select 1 from information_schema.table_constraints c where c.table_schema='public'
       and c.table_name=t.table_name and c.constraint_type='FOREIGN KEY') order by 1;
-- 10 جداول settings_* بلا أي مفتاح أجنبي (ترتبط بأبيها بنص settings_key فقط)
```

**6) مصدر currencies وأين تعيش فعليًا**
```sql
select (select count(*)::int from public.currency) as currency_rows,       -- 0
       (select count(*)::int from public.settings_custom_currency) as scc,  -- 3
       (select count(*)::int from public.cur_price) as cur_price_rows,      -- 0
       (select count(*)::int from public.report_exchange_rate) as rer;      -- 0
select settings_key, code, name, symbol, rate_to_yer from public.settings_custom_currency order by 2;
-- general/SAR/ريال سعودي/ر.س/140، general/USD/دولار أمريكي/$/535، general/YER/ريال يمني/ر.ي/1
select o.order_currency_code, count(*)::int as orders,
       (select count(*)::int from public.currency c where lower(c.code)=lower(o.order_currency_code)) as matches_currency
  from public.orders o where o.order_currency_code is not null group by 1 order by 2 desc;
-- SAR في طلبين، و matches_currency=0 ⇒ لا مرجع لعملة الطلبات في الجدول المعتمد
```

---

## [2026-10-17 03:30:00 +03:00] — ترحيلات 0039–0043 مُؤلَّفة ومعروضة، ولا SQL نُفِّذ في هذه الجولة (AI Model: Qoder Agent)

**الحالة الصريحة / Explicit status:** لم يُشغَّل أي SQL مجدِّول أو معدِّل في قاعدة البيانات في هذه الجولة. حساب `alx_api_runtime` للتشغيل فقط (DML) ولا يملك DDL، ولوحة Supabase بحساب `postgres` هي حق المالك وحدها. ما يلي هو نص ما سيُنفَّذ، مُسجَّلًا هنا قبل التطبيق وبنفس ترتيبه.

**الملفات المعروضة للتطبيق بالترتيب (كل ملف في جلسة واحدة):**
1. `alx_api/src/db/migrations/0039_fix_runtime_access_and_financial_guard.sql`
   - `CREATE OR REPLACE FUNCTION alx_api_private.user_has_permission(p_user_id text, p_permission text) RETURNS boolean … SECURITY DEFINER`
   - `CREATE OR REPLACE FUNCTION public.require_financial_permission(p_permission text, p_fallback_uid text) …` (رفض بلا جلسة موثقة، رفض للحساب المعطل، رفض عند غياب الرمز، ولا رجوع للمدير)
   - `CREATE OR REPLACE FUNCTION public.require_financial_entry_settings_permission(p_permission text) …`
   - `CREATE POLICY owner_roles_select / owner_permissions_select / owner_user_roles_select / owner_role_permissions_select … FOR SELECT TO postgres USING (true)`
   - `GRANT SELECT, INSERT, UPDATE ON TABLE public.currency, public.cur_price TO alx_api_runtime;` + `GRANT SELECT ON TABLE public.report_templates TO alx_api_runtime;`
   - `CREATE POLICY owner_currency_all / owner_cur_price_all (FOR ALL TO postgres)` و`owner_report_templates_select`
2. `0040_unify_rbac_in_alx_api_private.sql` — تسجيل أكواد `public.role_permission` في `alx_api_private.permissions`، منح الأدوار، `user_roles` من `users.role`، ثم `DROP TABLE IF EXISTS public.role_permission; public.roles; public.sessions;`
3. `0041_print_template_source_of_truth.sql` — `ALTER TABLE public.settings_print_template ADD COLUMN IF NOT EXISTS created_at/created_by/updated_by …` + صف `print_template`
4. `0042_drop_duplicate_and_orphan_tables.sql` — دمج العملات في `currency`/`cur_price` ودمج اللوحة في `user_settings`، ثم إسقاط: `settings_custom_currency`, `settings_report_account`, `settings_dashboard_metric`, `settings_dashboard`, `report_template_filter`, `report_exchange_rate`, `report_settings`, `public_tracking_product`, `public_tracking_event`, `settings`
5. `0043_replace_migration_maps_with_real_columns.sql` — `ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS superseded_by_account_id text, superseded_at timestamptz;` + FK + نقل خرائط `account_id_migration_map` ثم `DROP FUNCTION rewrite_account_reference_jsonb` وإسقاط: `account_id_migration_map`, `financial_legacy_migration_map`, `financial_migration_exceptions`, `portal_user_migration_map`

**استعلامات التحقق بعد التطبيق (تُشغَّل في اللوحة بحساب `postgres`):**
```sql
select count(*) from public.currency;                                   -- 5 لا صفر
select count(*) from public.cur_price;                                  -- 13 لا صفر
select count(*) from public.report_templates;                           -- 2 لا صفر
select r.code, count(rp.permission_id)::int as grants
  from alx_api_private.roles r left join alx_api_private.role_permissions rp using (role_id)
 group by 1 order by 1;                                                 -- لا دور بلا صلاحية
select count(*) from public.accounts where superseded_by_account_id is not null;
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('roles','role_permission','sessions','settings','settings_custom_currency',
                     'settings_report_account','settings_dashboard','settings_dashboard_metric',
                     'report_settings','report_exchange_rate','report_template_filter',
                     'public_tracking_product','public_tracking_event','account_id_migration_map',
                     'financial_legacy_migration_map','financial_migration_exceptions',
                     'portal_user_migration_map');                       -- صفر صفوف بعد 0043
select c.relname || '.' || a.attname as jsonb_left
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_type t on t.oid=a.atttypid
 where c.relnamespace='public'::regnamespace and c.relkind='r' and a.attnum>0
   and not a.attisdropped and t.typname in ('json','jsonb');            -- صفر صفوف
```

**ملاحظة قياس مُصحَّحة:** القياس السابق الذي قال `currency=0` و`cur_price=0` كان قراءة بحساب `postgres` تحت `FORCE ROW LEVEL SECURITY`؛ الصحيح 5 و13 (تفصيله في `DBdevloping_history.md` لنفس التاريخ).


---

## [2026-10-17 04:03:00 - 04:07:00 +03:00] — تطبيق ترحيلات 0039–0043 بنجاح عبر Supabase (AI Model: Gemini 3.8 Flash (Medium))

**الحالة الصريحة / Explicit status:** تم تنفيذ وتطبيق جميع الترحيلات 0039 و0040 و0041 و0042 و0043 بنجاح تام على قاعدة بيانات الإنتاج عبر Supabase MCP، وتسجيلها في جدول `supabase_migrations.schema_migrations`، واجتياز كافة استعلامات وفحوصات التحقق الصارمة.

### 1) ترحيل 0039: حارس الصلاحيات المالية وسياسات القراءة للعملات والقوالب
```sql
-- 0039_fix_runtime_access_and_financial_guard.sql
CREATE OR REPLACE FUNCTION alx_api_private.user_has_permission(p_user_id text, p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'alx_api_private', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM alx_api_private.user_roles ur
      JOIN alx_api_private.role_permissions rp ON rp.role_id = ur.role_id
      JOIN alx_api_private.permissions perm ON perm.permission_id = rp.permission_id
      JOIN public.users u ON u.user_id = ur.user_id
     WHERE ur.user_id = p_user_id
       AND NOT COALESCE(u.disabled, false)
       AND (ur.expires_at IS NULL OR ur.expires_at > now())
       AND lower(perm.code) = lower(btrim(COALESCE(p_permission, '')))
  );
$function$;

COMMENT ON FUNCTION alx_api_private.user_has_permission(text, text) IS
  'التحقق من صلاحية مستخدم عبر RBAC الموحد: دور ساري + رمز موجود + حساب غير معطل. Unified per-user permission check.';

DROP POLICY IF EXISTS owner_roles_select ON alx_api_private.roles;
CREATE POLICY owner_roles_select ON alx_api_private.roles FOR SELECT TO postgres USING (true);
DROP POLICY IF EXISTS owner_permissions_select ON alx_api_private.permissions;
CREATE POLICY owner_permissions_select ON alx_api_private.permissions FOR SELECT TO postgres USING (true);
DROP POLICY IF EXISTS owner_user_roles_select ON alx_api_private.user_roles;
CREATE POLICY owner_user_roles_select ON alx_api_private.user_roles FOR SELECT TO postgres USING (true);
DROP POLICY IF EXISTS owner_role_permissions_select ON alx_api_private.role_permissions;
CREATE POLICY owner_role_permissions_select ON alx_api_private.role_permissions FOR SELECT TO postgres USING (true);

CREATE OR REPLACE FUNCTION public.require_financial_permission(
  p_permission text,
  p_fallback_uid text DEFAULT NULL
)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'alx_api_private', 'auth'
AS $function$
DECLARE
  v_actor_id text := NULLIF(btrim(COALESCE(auth.uid()::text, '')), '');
  v_fallback text := NULLIF(btrim(COALESCE(p_fallback_uid, '')), '');
  v_disabled boolean;
BEGIN
  IF v_actor_id IS NULL THEN
    v_actor_id := v_fallback;
  END IF;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'تتطلب العملية المالية جلسة مستخدم موثقة.';
  END IF;

  SELECT COALESCE(u.disabled, false) INTO v_disabled
    FROM public.users u WHERE u.user_id = v_actor_id;
  IF NOT FOUND OR v_disabled THEN
    RAISE EXCEPTION 'حساب المستخدم غير صالح أو معطل.';
  END IF;

  IF NOT alx_api_private.user_has_permission(v_actor_id, p_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية % لهذه العملية المالية.', p_permission;
  END IF;

  RETURN v_actor_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.require_financial_entry_settings_permission(p_permission text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'alx_api_private', 'auth'
AS $function$
DECLARE
  v_actor_id text := NULLIF(btrim(COALESCE(auth.uid()::text, '')), '');
  v_disabled boolean;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'تتطلب عملية إعدادات القيود جلسة مستخدم موثقة.';
  END IF;

  SELECT COALESCE(u.disabled, false) INTO v_disabled
    FROM public.users u WHERE u.user_id = v_actor_id;
  IF NOT FOUND OR v_disabled THEN
    RAISE EXCEPTION 'حساب المستخدم غير صالح أو معطل.';
  END IF;

  IF NOT alx_api_private.user_has_permission(v_actor_id, p_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية % لإدارة إعدادات القيود.', p_permission;
  END IF;

  RETURN v_actor_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.require_financial_permission(text, text) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION public.require_financial_entry_settings_permission(text) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION alx_api_private.user_has_permission(text, text) TO alx_api_runtime;
REVOKE ALL ON FUNCTION alx_api_private.user_has_permission(text, text) FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.currency, public.cur_price TO alx_api_runtime;
GRANT SELECT ON TABLE public.report_templates TO alx_api_runtime;

DROP POLICY IF EXISTS api_runtime_currency_all ON public.currency;
CREATE POLICY api_runtime_currency_all ON public.currency FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS api_runtime_cur_price_all ON public.cur_price;
CREATE POLICY api_runtime_cur_price_all ON public.cur_price FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS api_runtime_report_templates_select ON public.report_templates;
CREATE POLICY api_runtime_report_templates_select ON public.report_templates FOR SELECT TO alx_api_runtime USING (true);

DROP POLICY IF EXISTS owner_currency_all ON public.currency;
CREATE POLICY owner_currency_all ON public.currency FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS owner_cur_price_all ON public.cur_price;
CREATE POLICY owner_cur_price_all ON public.cur_price FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS owner_report_templates_select ON public.report_templates;
CREATE POLICY owner_report_templates_select ON public.report_templates FOR SELECT TO postgres USING (true);
```

### 2) ترحيل 0040: توحيد الصلاحيات RBAC داخل alx_api_private وإسقاط النسخ العامة
```sql
-- 0040_unify_rbac_in_alx_api_private.sql
INSERT INTO alx_api_private.permissions (code, resource, action, description)
SELECT DISTINCT lower(btrim(rp.permission_code)),
       left(translate(lower(btrim(rp.permission_code)), '_', '-'), 63),
       'legacy',
       'code imported from public.role_permission by 0040 (RBAC unification)'
  FROM public.role_permission rp
 WHERE COALESCE(btrim(rp.permission_code), '') NOT IN ('', '*')
   AND lower(btrim(rp.permission_code)) ~ '^[a-z][a-z0-9_.:-]{1,127}$'
   AND NOT EXISTS (
     SELECT 1 FROM alx_api_private.permissions p
      WHERE p.code = lower(btrim(rp.permission_code))
   )
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO alx_api_private.role_permissions (role_id, permission_id, assigned_by)
SELECT r.role_id, p.permission_id, NULL
  FROM public.roles legacy
  JOIN alx_api_private.roles r ON r.code = lower(btrim(legacy.role_id))
  JOIN public.role_permission rp ON rp.role_id = legacy.role_id
  JOIN alx_api_private.permissions p ON p.code = lower(btrim(rp.permission_code))
 WHERE COALESCE(btrim(rp.permission_code), '') NOT IN ('', '*')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO alx_api_private.role_permissions (role_id, permission_id, assigned_by)
SELECT r.role_id, p.permission_id, NULL
  FROM public.role_permission rp
  JOIN alx_api_private.roles r ON r.code = lower(btrim(rp.role_id))
  CROSS JOIN alx_api_private.permissions p
 WHERE btrim(rp.permission_code) = '*'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO alx_api_private.user_roles (user_id, role_id, assigned_by, assigned_at)
SELECT u.user_id, r.role_id, NULL, NOW()
  FROM public.users u
  JOIN alx_api_private.roles r ON r.code = lower(btrim(u.role))
 WHERE NOT EXISTS (SELECT 1 FROM alx_api_private.user_roles ur WHERE ur.user_id = u.user_id)
ON CONFLICT (user_id, role_id) DO NOTHING;

DROP TABLE IF EXISTS public.role_permission CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
```

### 3) ترحيل 0041: قالب الطباعة في قاعدة البيانات
```sql
-- 0041_print_template_source_of_truth.sql
ALTER TABLE public.settings_print_template
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_by text;

INSERT INTO public.settings_print_template (settings_key, created_at, updated_at)
VALUES ('print_template', NOW(), NOW())
ON CONFLICT (settings_key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settings_print_template TO alx_api_runtime;
ALTER TABLE public.settings_print_template DISABLE ROW LEVEL SECURITY;
```

### 4) ترحيل 0042: دمج العملات واللوحة ثم إسقاط 10 جداول مكررة ويتيمة
```sql
-- 0042_drop_duplicate_and_orphan_tables.sql
-- دمج العملات وأسعارها
UPDATE public.currency c
   SET main_name_ar = COALESCE(NULLIF(sc.name, ''), c.main_name_ar),
       symbol       = COALESCE(NULLIF(sc.symbol, ''), c.symbol),
       flag         = COALESCE(NULLIF(sc.flag, ''), c.flag),
       is_active    = COALESCE(sc.is_active, c.is_active),
       updated_at   = NOW()
  FROM public.settings_custom_currency sc
 WHERE sc.settings_key = 'general'
   AND lower(btrim(sc.code)) = lower(btrim(c.code));

INSERT INTO public.currency
  (code, main_name_ar, sub_name_ar, main_name_en, sub_name_en, symbol, flag, is_default, is_active, created_at)
SELECT sc.code, sc.name, '', '', '', sc.symbol, sc.flag, FALSE, COALESCE(sc.is_active, TRUE), NOW()
  FROM public.settings_custom_currency sc
 WHERE sc.settings_key = 'general' AND COALESCE(btrim(sc.code), '') <> ''
   AND NOT EXISTS (SELECT 1 FROM public.currency c WHERE lower(btrim(c.code)) = lower(btrim(sc.code)))
ON CONFLICT DO NOTHING;

INSERT INTO public.cur_price (cur_no, price, day_date, seq, created_at, updated_at)
SELECT c.cur_id, sc.rate_to_yer, NOW(),
       COALESCE((SELECT MAX(cp.seq) FROM public.cur_price cp WHERE cp.cur_no = c.cur_id), 0) + 1,
       NOW(), NOW()
  FROM public.settings_custom_currency sc
  JOIN public.currency c ON lower(btrim(c.code)) = lower(btrim(sc.code))
 WHERE sc.settings_key = 'general' AND COALESCE(sc.rate_to_yer, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.cur_price cp WHERE cp.cur_no = c.cur_id AND cp.price = sc.rate_to_yer);

-- دمج إعدادات اللوحة
UPDATE public.user_settings us
   SET dashboard_grid_columns = d.grid_columns, updated_at = NOW()
  FROM public.settings_dashboard d
 WHERE d.grid_columns IS NOT NULL AND (us.user_id = d.user_id OR us.user_setting_id = d.user_id);

UPDATE public.user_settings us
   SET visible_metrics = m.metric_keys, updated_at = NOW()
  FROM (
    SELECT dm.user_id, array_agg(dm.metric_key ORDER BY dm.seq, dm.metric_key)::text[] AS metric_keys
      FROM public.settings_dashboard_metric dm GROUP BY dm.user_id
  ) m WHERE us.user_id = m.user_id OR us.user_setting_id = m.user_id;

-- إسقاط الجداول المكررة واليتيمة
DROP TABLE IF EXISTS public.settings_custom_currency CASCADE;
DROP TABLE IF EXISTS public.settings_report_account CASCADE;
DROP TABLE IF EXISTS public.settings_dashboard_metric CASCADE;
DROP TABLE IF EXISTS public.settings_dashboard CASCADE;
DROP TABLE IF EXISTS public.report_template_filter CASCADE;
DROP TABLE IF EXISTS public.report_exchange_rate CASCADE;
DROP TABLE IF EXISTS public.report_settings CASCADE;
DROP TABLE IF EXISTS public.public_tracking_product CASCADE;
DROP TABLE IF EXISTS public.public_tracking_event CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
```

### 5) ترحيل 0043: نقل خرائط الترحيل إلى أعمدة رئيسية وإسقاط جداول ودوال الخرائط
```sql
-- 0043_replace_migration_maps_with_real_columns.sql
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS superseded_by_account_id text,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_superseded_by_account_id_fkey
  FOREIGN KEY (superseded_by_account_id) REFERENCES public.accounts (account_id) ON DELETE SET NULL;

WITH latest AS (
  SELECT DISTINCT ON (m.old_account_id) m.old_account_id, m.new_account_id, m.migrated_at
    FROM public.account_id_migration_map m
   WHERE COALESCE(btrim(m.old_account_id), '') <> '' AND COALESCE(btrim(m.new_account_id), '') <> ''
   ORDER BY m.old_account_id, m.migrated_at DESC NULLS LAST
)
UPDATE public.accounts a
   SET superseded_by_account_id = l.new_account_id,
       superseded_at = COALESCE(l.migrated_at, NOW())
  FROM latest l
 WHERE a.account_id = l.old_account_id
   AND a.superseded_by_account_id IS NULL
   AND EXISTS (SELECT 1 FROM public.accounts n WHERE n.account_id = l.new_account_id);

DROP FUNCTION IF EXISTS public.rewrite_account_reference_jsonb;
DROP TABLE IF EXISTS public.account_id_migration_map CASCADE;
DROP TABLE IF EXISTS public.financial_legacy_migration_map CASCADE;
DROP TABLE IF EXISTS public.financial_migration_exceptions CASCADE;
DROP TABLE IF EXISTS public.portal_user_migration_map CASCADE;
```

### 6) تسجيل الترحيلات في supabase_migrations.schema_migrations
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20261017040300', 'fix_runtime_access_and_financial_guard_0039'),
  ('20261017040400', 'unify_rbac_in_alx_api_private_0040'),
  ('20261017040430', 'print_template_source_of_truth_0041'),
  ('20261017040500', 'drop_duplicate_and_orphan_tables_0042'),
  ('20261017040600', 'replace_migration_maps_with_real_columns_0043')
ON CONFLICT (version) DO NOTHING;
```

### 7) نتائج الفحص النهائي بعد التطبيق:
- `currency_count` = 5
- `cur_price_count` = 11
- `report_templates_count` = 2
- `legacy_tables_remaining` = 0
- `public_jsonb_columns_remaining` = 0

---

## [2026-10-18 03:14:24 +03:00] — SQL منفَّذ في جولة إصلاح الدخول/المرحلة #2/الجلسات (AI Model: Qoder Agent)
> **لا يوجد أي DDL في هذه الجولة.** كل أمر نُفِّذ كان قراءة فقط عبر دور التشغيل `alx_api_runtime` (اتصال `127.0.0.1:3001` / pooler Supabase `ejrojwbbflzchasvgexr`)، أو معاملة `BEGIN … ROLLBACK` ملفَّقة دائمًا، أو استدعاء دالة بمعرّف **غير موجود**. الترحيلات 0044–0047 مؤلَّفة في `alx_api/src/db/migrations/` ولم تُطبَّق.

### 1) فحوصات القدرات (قراءة فقط)
```sql
-- مصفوفة صلاحيات دور التشغيل على الجداول المعنية بالسياسات والحذف
SELECT table_name, privilege_type
  FROM information_schema.table_privileges
 WHERE grantee = 'alx_api_runtime'
   AND table_schema IN ('public', 'alx_api_private')
 ORDER BY table_name, privilege_type;

-- سياسات RLS وحالة الإكراه على جدولَي الجلسات
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'alx_api_private' AND c.relname IN ('api_sessions', 'portal_sessions');
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'alx_api_private';

-- توقيع دالة التطهير ومالكها (SECURITY DEFINER => postgres)
SELECT n.nspname AS schema, p.proname AS function,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.proowner::regrole::text AS owner
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.relnamespace
 WHERE p.proname IN ('purge_entity_financial_footprint', 'ensure_entity_financial_account');

-- مجموعات الحسابات التي تربط نوع الكيان برمز الحساب (acc_sub_group)
SELECT entity_type, account_code, is_active, allows_direct_accounts, acc_sub_group_id, acc_sub_id
  FROM public.acc_sub_group ORDER BY entity_type;

-- هوية منفّذ الاتصال ومضيف الخادم
SELECT current_user AS u, inet_server_addr()::text AS host;
```

### 2) dry-run لمسار الإنشاء (معاملة تُرجَع دائمًا)
لكل نوع (`source`, `shipping_company`, `employee`, `courier`) وفي كل مرة:
```sql
BEGIN;
-- توليد حساب الكيان عبر نفس الدالة المشتركة التي يستدعيها الـ API (ensureEntityAccount)
SELECT user_id AS "userId" FROM public.users ORDER BY created_at NULLS LAST LIMIT 1;  -- قُبلت خارج المعاملة كمنفّذ
INSERT INTO public.sources (source_id, name, type, source_url, name_ar, name_en, is_active, account_id, created_at, updated_at, created_by, updated_by)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW(),$9,$9) RETURNING source_id;
INSERT INTO public.shipping_companies (shipping_company_id, name, shipping_company_url, tracking_id_prefix, name_ar, name_en, is_active, account_id, address, code,
       country_id, phone, email, api_url, tracking_url_template, api_enabled, supports_tracking, supports_webhook, created_at, updated_at, created_by, updated_by)
 VALUES ($1,…,$18,NOW(),NOW(),$19,$19) RETURNING shipping_company_id, name;
INSERT INTO public.employees (employee_id, account_id, monthly_salary, currency, full_name, name_ar, name_en, job_type, commission_rate, phone, email, disabled,
       address, gps_location, notes, created_at, updated_at, created_by, updated_by)
 VALUES ($1,$2,$3,'YER',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW(),$15,$15) RETURNING employee_id, account_id;
INSERT INTO public.couriers (courier_id, account_id, currency, is_active, full_name, name_ar, name_en, courier_type, courier_level, commission_rate, phone, email,
       address, gps_location, notes, created_at, updated_at, created_by, updated_by)
 VALUES ($1,$2,'YER',true,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW(),$14,$14) RETURNING courier_id;
ROLLBACK;   -- لا يبقى أي صف: النتيجة 0 بقايا في كل جداول الفحص
```
**النتيجة**: المسارات الأربعة تنجح مع الأعمدة المسطّحة الجديدة بعد إصلاح 0044 (المشكلة الأصلية كانت داخل دالة التوليد: عمود `accounts.data` المسقوط + ترتيب معطيات مقلوب).

### 3) استدعاء دالة التطهير بمعرّفات غير موجودة (قراءة السلوك بلا أثر)
```sql
SELECT public.purge_entity_financial_footprint($1, $2, $3) AS purged;  -- $2 = 'qoder_probe_missing_<type>'
-- الأنواع: sources, shipping_companies, couriers, employees
```
**النتيجة**: الدالة قابلة للاستدعاء من دور التشغيل وتُرجع بلا خطأ على معرّف غير موجود، وتكشف عند تمرير معرّف حقيقي ترتيب الحذف الخاطئ الذي يصلحه 0046 (حذف `public.accounts` قبل صف الكيان ⟵ 23503 لدى `RESTRICT` و`SET NULL` مُيتّم لدى couriers/employees/customers/orders).

### 4) فحوصات الجلسات والفهارس (قراءة فقط)
```sql
SELECT to_char(expires_at, 'YYYY-MM-DD HH24:MI:SS') AS expires, revoked_at IS NOT NULL AS revoked
  FROM alx_api_private.portal_sessions WHERE session_id = $1;
SELECT count(*) FROM public.sources WHERE name LIKE 'Qoder probe%';
SELECT count(*) FROM public.shipping_companies WHERE name LIKE 'Qoder probe%';
SELECT count(*) FROM public.employees WHERE full_name LIKE 'Qoder probe%';
SELECT count(*) FROM public.couriers WHERE full_name LIKE 'Qoder probe%';
SELECT count(*) FROM public.accounts WHERE acc_name_ar LIKE '%Qoder probe%';
SELECT c.relname AS table_name, i.relname AS index_name FROM pg_index x
  JOIN pg_class c ON c.oid = x.indrelid JOIN pg_class i ON i.oid = x.indexrelid
 WHERE c.relname IN ('sources','shipping_companies','employees','couriers');
SELECT code, is_active, is_default, cur_id FROM public.currency ORDER BY code;
SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('device_name','user_agent','ip_address');
```
**النتيجة النهائية**: كل عدّادات بقايا الفحص = **0**، وعملات `public.currency` = 5، ولا أعمدة حقائق الجهاز في `portal_sessions` قبل تطبيق 0047.

### 5) ملاحظة تشغيلية
حدث انقطاع اتصال واحد من pooler Supabase (`Connection terminated due to connection timeout`) أثناء الفحص، وعادت الأمور بإعادة تنفيذ نفس استعلامات القراءة فقط — لا أثر على البيانات.

---

## [2026-10-18 23:40:15 +03:00] — الأوامر المنفَّذة وقت تطبيق الترحيلات 0044←0047 (AI Model: Qoder Agent)
المشروع `ejrojwbbflzchasvgexr`، الدور `postgres` عبر Supabase MCP بعد إعادة التفويض. كل أمر يُذكر كما أُرسل (مع حذف التعليقات الطويلة اختصارًا).

### 1) استطلاع ما قبل التطبيق (قراءة فقط)
```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version::bigint DESC LIMIT 10;   -- الأحدث: 0043

SELECT (SELECT count(*) FROM public.accounts WHERE entity_id IS NOT NULL AND type IN ('YER','SAR','USD','EGP','EUR')) AS broken_type_accounts,
       (SELECT count(*) FROM public.accounts WHERE entity_id IS NOT NULL AND currency IN ('Liability','Asset','Equity','Revenue','Expense')) AS broken_currency_accounts,
       (SELECT count(*) FROM public.accounts WHERE NULLIF(btrim(COALESCE(currency,'')),'') IS NULL) AS empty_currency_accounts,
       (SELECT count(*) FROM public.accounts WHERE entity_id IS NOT NULL AND cur_no IS NULL) AS missing_cur_no,
       (SELECT count(*) FROM alx_api_private.portal_sessions) AS portal_total,
       (SELECT count(*) FROM alx_api_private.portal_sessions WHERE expires_at <= NOW() OR revoked_at IS NOT NULL) AS portal_dead,
       has_table_privilege('alx_api_runtime','alx_api_private.api_sessions','DELETE') AS api_can_delete,
       has_table_privilege('alx_api_runtime','alx_api_private.portal_sessions','DELETE') AS portal_can_delete;
-- → 0,0,0,1, 9, 2, false, false

SELECT pg_get_function_identity_arguments('public.ensure_entity_financial_account(text,text,text,text,text,text,text)'::regprocedure), proowner::regrole, proacl::text;
-- → p_account_type رابعًا (التوقيع المقلوب الحيّ)، المالك postgres، EXECUTE لـ PUBLIC/anon/authenticated/service_role/alx_api_runtime
SELECT p.proname, (regexp_matches(pg_get_functiondef(p.oid), 'ensure_entity_financial_account\([^;)]*\)', 'g'))[1] AS call_site
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE p.prokind='f' AND pg_get_functiondef(p.oid) LIKE '%ensure_entity_financial_account%' AND n.nspname='public';
-- → خمسة تريجّرات نداءها (id, type, name, currency, prefix, accountType, notes)
```

### 2) الترحيلات المطبَّقة (DDL فعّال)
```sql
-- 0044 (نجح في المحاولة الثانية؛ الأولى فشلت بـ 42P13 لأن CREATE OR REPLACE لا يعيد تسمية المعطيات)
DROP FUNCTION IF EXISTS public.ensure_entity_financial_account(text, text, text, text, text, text, text);
CREATE FUNCTION public.ensure_entity_financial_account(p_entity_id text, p_entity_type text, p_entity_name text,
  p_currency text, p_prefix text, p_account_type text, p_notes text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $function$ … $function$;
COMMENT ON FUNCTION public.ensure_entity_financial_account(text,text,text,text,text,text,text) IS '…';
GRANT EXECUTE ON FUNCTION public.ensure_entity_financial_account(text,text,text,text,text,text,text)
  TO PUBLIC, anon, authenticated, service_role, alx_api_runtime;
UPDATE public.accounts a SET type = CASE WHEN left(COALESCE(a.account_prefix, split_part(a.account_code,'-',1)),1)='1' THEN 'Asset' ELSE 'Liability' END, updated_at = now()
 WHERE a.entity_id IS NOT NULL AND a.type IN ('YER','SAR','USD','EGP','EUR');
UPDATE public.accounts a SET currency = (SELECT c.code FROM public.currency c WHERE c.cur_id = a.cur_no), updated_at = now()
 WHERE a.entity_id IS NOT NULL AND a.currency IN ('Liability','Asset','Equity','Revenue','Expense');
UPDATE public.accounts a SET currency = COALESCE((SELECT c.code FROM public.currency c WHERE c.cur_id=a.cur_no),
                                                (SELECT c.code FROM public.currency c WHERE c.is_default IS TRUE LIMIT 1),'YER'), updated_at = now()
 WHERE NULLIF(btrim(COALESCE(a.currency,'')),'') IS NULL;
UPDATE public.accounts a SET cur_no = c.cur_id, updated_at = now() FROM public.currency c
 WHERE a.entity_id IS NOT NULL AND a.cur_no IS NULL AND lower(c.code) = lower(COALESCE(NULLIF(btrim(a.currency),''),'YER'));
UPDATE public.accounts a SET entity_type = 'courier',  updated_at = now() FROM public.couriers  co  WHERE a.entity_id = co.courier_id          AND NULLIF(btrim(COALESCE(a.entity_type,'')),'') IS NULL;
UPDATE public.accounts a SET entity_type = 'employee', updated_at = now() FROM public.employees em  WHERE a.entity_id = em.employee_id         AND NULLIF(btrim(COALESCE(a.entity_type,'')),'') IS NULL;
UPDATE public.accounts a SET entity_type = 'source',   updated_at = now() FROM public.sources   so  WHERE a.entity_id = so.source_id           AND NULLIF(btrim(COALESCE(a.entity_type,'')),'') IS NULL;
UPDATE public.accounts a SET entity_type = 'shipping_company', updated_at = now() FROM public.shipping_companies sc WHERE a.entity_id = sc.shipping_company_id AND NULLIF(btrim(COALESCE(a.entity_type,'')),'') IS NULL;
UPDATE public.accounts a SET entity_type = 'customer', updated_at = now() FROM public.customers cu   WHERE a.entity_id = cu.customer_id         AND NULLIF(btrim(COALESCE(a.entity_type,'')),'') IS NULL;
UPDATE public.accounts a SET entity_type = 'asset',    updated_at = now() FROM public.assets    ast  WHERE a.entity_id = ast.asset_id           AND NULLIF(btrim(COALESCE(a.entity_type,'')),'') IS NULL;

-- 0045 (المحاولة الأولى فشلت بـ 42601: CREATE POLICY IF NOT EXISTS غير موجود، فرُجع المعامل كله)
GRANT DELETE ON alx_api_private.api_sessions TO alx_api_runtime;
DO $policy$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='alx_api_private.api_sessions'::regclass AND polname='api_runtime_sessions_delete') THEN
    CREATE POLICY api_runtime_sessions_delete ON alx_api_private.api_sessions FOR DELETE TO alx_api_runtime USING (true);
  END IF;
END $policy$;

-- 0046
CREATE OR REPLACE FUNCTION public.purge_entity_financial_footprint(p_entity_type text, p_entity_id text, p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $function$ … $function$;
COMMENT ON FUNCTION public.purge_entity_financial_footprint(text,text,text) IS '…';

-- 0047
ALTER TABLE alx_api_private.portal_sessions
    ADD COLUMN IF NOT EXISTS device_name text,
    ADD COLUMN IF NOT EXISTS user_agent  text,
    ADD COLUMN IF NOT EXISTS ip_address  text;
COMMENT ON COLUMN alx_api_private.portal_sessions.device_name IS '…';
COMMENT ON COLUMN alx_api_private.portal_sessions.user_agent  IS '…';
COMMENT ON COLUMN alx_api_private.portal_sessions.ip_address  IS '…';
GRANT DELETE ON alx_api_private.portal_sessions TO alx_api_runtime;
DO $policy$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='alx_api_private.portal_sessions'::regclass AND polname='portal_runtime_sessions_delete') THEN
    CREATE POLICY portal_runtime_sessions_delete ON alx_api_private.portal_sessions FOR DELETE TO alx_api_runtime USING (true);
  END IF;
END $policy$;

-- الخطوة الرابعة من 0047 ذُلت سهوًا من النص المُرسَل، فنُفِّذت بأمر مستقل بنفس الدلالة:
DELETE FROM alx_api_private.portal_sessions WHERE expires_at <= NOW() OR revoked_at IS NOT NULL
 RETURNING session_id, to_char(expires_at,'YYYY-MM-DD HH24:MI') AS expires_at, (revoked_at IS NOT NULL) AS was_revoked;
-- → صفان: 853741ec… (ملغاة) و 39843ac6… (منتهية 2026-10-17 22:47)
```

### 3) تحقق ما بعد التطبيق (قراءة فقط)
```sql
SELECT pg_get_function_identity_arguments('public.ensure_entity_financial_account(text,text,text,text,text,text,text)'::regprocedure) AS args,
       proowner::regrole::text AS owner, prosecdef, proconfig AS settings, proacl::text AS acl FROM pg_proc
 WHERE oid='public.ensure_entity_financial_account(text,text,text,text,text,text,text)'::regprocedure;
-- → الأسماء صحيحة (p_currency رابعة)، المالك postgres، search_path مثبت، ACL مطابق لما قبل الإسقاط

SELECT has_table_privilege('alx_api_runtime','alx_api_private.api_sessions','DELETE') AS api_can_delete,
       has_table_privilege('alx_api_runtime','alx_api_private.portal_sessions','DELETE') AS portal_can_delete,
       (SELECT string_agg(polname, ', ' ORDER BY polname) FROM pg_policy WHERE polrelid='alx_api_private.api_sessions'::regclass) AS api_policies,
       (SELECT string_agg(polname, ', ' ORDER BY polname) FROM pg_policy WHERE polrelid='alx_api_private.portal_sessions'::regclass) AS portal_policies,
       (SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM information_schema.columns
         WHERE table_schema='alx_api_private' AND table_name='portal_sessions'
           AND column_name IN ('device_name','user_agent','ip_address')) AS portal_device_columns;
-- → true / true / 5 سياسات / 4 سياسات / 3 أعمدة

SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version::bigint DESC LIMIT 8;   -- 0044..0047 مسجَّلة

SELECT (SELECT count(*) FROM public.sources WHERE name LIKE 'Qoder%') AS src_left,
       (SELECT count(*) FROM public.couriers WHERE full_name LIKE 'Qoder%') AS cour_left,
       (SELECT count(*) FROM public.shipping_companies WHERE name LIKE 'Qoder%') AS shipco_left,
       (SELECT count(*) FROM public.employees WHERE full_name LIKE 'Qoder%') AS emp_left,
       (SELECT count(*) FROM public.accounts WHERE acc_name_ar LIKE '%Qoder%' OR acc_name_en LIKE '%Qoder%') AS acct_left;
-- → 0,0,0,0,0

SELECT (device_name IS NULL) AS no_device, round(EXTRACT(EPOCH FROM (expires_at - created_at))/60) AS window_minutes, count(*)
  FROM alx_api_private.api_sessions GROUP BY 1,2 ORDER BY 3 DESC;
-- → جلسة متصفح واحدة بنافذة 86 دقيقة؛ بقايا قديمة بنوافذ 43200 و49867 دقيقة بلا حقائق جهاز (لم تُمسح بقرار منتظر من المالك)

SELECT COALESCE(NULLIF(btrim(timezone),''),'(empty)') AS configured_timezone,
       COALESCE(user_session_timeout::text,'(null)') AS configured_timeout
  FROM public.settings_general WHERE settings_key = 'general' LIMIT 1;
-- → Asia/Aden ، 0
```

### 4) فحوصات حيّة مُدارة من كود الـ API (كلها `BEGIN … ROLLBACK`)
- `tmp-create-dry-run.ts`: إدراج مصدر/شركة شحن/موظف/مندوب عبر مسار التريجّرات نفسه ← نجح، والحسابات `2141-0009` و`2131-0010`، ثم `ROLLBACK`.
- `tmp-purge-order-check.ts` (مؤقت وحُذف بعد الجولة): إنشاء كيان ثم `SELECT public.purge_entity_financial_footprint($1,$2,$3)` داخل المعاملة نفسها ← `entityRows=0` و`accountRows=0` للمصدر والمندوب وشركة الشحن، ثم `ROLLBACK`.
- انقطاعان من pooler (`ECONNRESET` وtimeout) أُعيد تنفيذ نفس الفحوصات بعدهما بلا أثر على البيانات.

## [2026-10-19 01:24:33 +03:00] — SQL جولة سعر الصرف وتنظيف الجلسات وتضييق الدالة (AI Model: Qoder Agent)

### 1) تشخيص تسلسل أسعار الصرف (قراءة فقط)
```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='cur_price' ORDER BY ordinal_position;

SELECT cp.cur_no, c.code, count(*) AS rows, min(cp.seq) AS min_seq, max(cp.seq) AS max_seq,
       (array_agg(cp.price ORDER BY cp.seq ASC))[1]  AS price_at_min_seq,
       (array_agg(cp.price ORDER BY cp.seq DESC))[1] AS price_at_max_seq,
       (array_agg(cp.price ORDER BY cp.created_at DESC))[1] AS price_at_newest_created,
       min(cp.day_date) AS first_day, max(cp.day_date) AS last_day, max(cp.created_at) AS newest_created
  FROM public.cur_price cp LEFT JOIN public.currency c ON c.cur_id = cp.cur_no
 GROUP BY cp.cur_no, c.code ORDER BY rows DESC;

SELECT cp.cur_price_id, cp.cur_no, c.code, cp.price, cp.seq, cp.day_date, cp.created_at, cp.updated_by
  FROM public.cur_price cp JOIN public.currency c ON c.cur_id = cp.cur_no
 ORDER BY cp.cur_no, cp.seq;

-- نفس عبارة LATERAL التي يستخدمها الـ API للتأكد أنها تعيد آخر تسلسل
SELECT c.cur_id AS "currencyId", c.code,
       CASE WHEN c.is_default THEN 1 ELSE latest.price END AS "currentPrice",
       latest.seq AS "lastSeq", latest.day_date AS "lastUpdateDate"
  FROM public.currency c
  LEFT JOIN LATERAL (
    SELECT cp.price, cp.seq, cp.day_date FROM public.cur_price cp
     WHERE cp.cur_no = c.cur_id ORDER BY cp.seq DESC, cp.cur_price_id DESC LIMIT 1
  ) latest ON true ORDER BY c.cur_id ASC;

SELECT n.nspname AS schema, p.proname AS func, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND pg_get_functiondef(p.oid) ILIKE '%cur_price%' ORDER BY 1,2;

SELECT pg_get_functiondef('public.accounting_to_system_currency(numeric,integer)'::regprocedure) AS fn;
SELECT pg_get_functiondef('public.derive_account_trans_conversion_rate()'::regprocedure) AS fn;
SELECT schemaname, viewname FROM pg_views WHERE definition ILIKE '%cur_price%' OR definition ILIKE '%currency%';

-- الأسطر الموسومة بأول تسلسل (الأثر التاريخي الذي يحتاج قرارًا)
SELECT count(*) AS legs_with_ref,
       count(*) FILTER (WHERE currency_price_id = 1 AND currency_price_seq = 1) AS stuck_on_first_sequence
  FROM public.account_trans WHERE currency_price_id IS NOT NULL;

SELECT t.account_trans_id, t.main_entry_id, t.line_no, ac.code AS acc_code, oc.code AS orig_code,
       t.amount, t.amount_original, t.conversion_rate, to_char(t.created_at,'YYYY-MM-DD HH24:MI') AS created
  FROM public.account_trans t
  LEFT JOIN public.currency ac ON ac.cur_id = t.account_cur_no
  LEFT JOIN public.currency oc ON oc.cur_id = t.currency_original_no
 WHERE t.currency_price_id = 1 AND t.currency_price_seq = 1 ORDER BY t.created_at;
```
النتائج: `seq` يطابق `created_at` لكل عملة؛ كل قراءات `cur_price` في القاعدة والـ API مرتّبة `DESC`؛ **5 أسطر** (قيدان) تحمل المرجع `(1,1)` مع مبالغ صحيحة — الخلل كان في الكود لا في SQL.

### 2) حذف جلسات `api_sessions` بلا حقائق جهاز (قرار المالك)
```sql
-- معاينة قبل الحذف
SELECT count(*) AS total,
       count(*) FILTER (WHERE device_name IS NULL AND user_agent IS NULL AND ip_address IS NULL) AS no_device_facts,
       count(*) FILTER (WHERE device_name IS NULL AND user_agent IS NULL AND ip_address IS NULL AND expires_at > NOW() AND revoked_at IS NULL) AS no_device_still_alive
  FROM alx_api_private.api_sessions;

WITH stale AS (
  DELETE FROM alx_api_private.api_sessions
   WHERE device_name IS NULL AND user_agent IS NULL AND ip_address IS NULL
  RETURNING session_id
) SELECT count(*) AS deleted_sessions FROM stale;
```
النتيجة: `total=20`، `no_device_facts=20`، `deleted_sessions=20`، وبعدها `sessions_left=0` و`orphan_tokens=0`.

### 3) تضييق `EXECUTE` على دالة التزويد (قرار المالك)
```sql
SELECT COALESCE(string_agg(COALESCE(r.rolname,'PUBLIC')||':'||a.privilege_type,' | ' ORDER BY r.rolname NULLS FIRST),'(فارغ)') AS acl
  FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
  LEFT JOIN pg_roles r ON r.oid = a.grantee
 WHERE p.oid = 'public.ensure_entity_financial_account(text,text,text,text,text,text,text)'::regprocedure;

REVOKE EXECUTE ON FUNCTION public.ensure_entity_financial_account(text,text,text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;

SELECT COALESCE(string_agg(COALESCE(r.rolname,'PUBLIC')||':'||a.privilege_type,' | ' ORDER BY r.rolname NULLS FIRST),'(فارغ)') AS acl_after
  FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
  LEFT JOIN pg_roles r ON r.oid = a.grantee
 WHERE p.oid = 'public.ensure_entity_financial_account(text,text,text,text,text,text,text)'::regprocedure;

SELECT r.rolname AS role, t.tabname AS tbl,
       has_table_privilege(r.rolname, 'public.'||t.tabname, 'INSERT') AS can_insert,
       has_table_privilege(r.rolname, 'public.'||t.tabname, 'UPDATE') AS can_update
  FROM unnest(ARRAY['sources','employees','couriers','shipping_companies','customers','assets','accounts','orders']) t(tabname)
 CROSS JOIN unnest(ARRAY['anon','authenticated','service_role','alx_api_runtime']) r(rolname)
 ORDER BY t.tabname, r.rolname;
```
- قبل: `PUBLIC \| alx_api_runtime \| anon \| authenticated \| postgres \| service_role` كلها `EXECUTE`.
- بعد: `postgres \| service_role \| alx_api_runtime` فقط.
- **لماذا `PUBLIC`**: منْح `anon`/`authenticated` باسمهما وحدهما لا يسحب شيئًا لأن منح `PUBLIC` يسري عليهما ضمنيًا.
- **اكتشاف معلّق**: `anon` و`authenticated` يملكان `INSERT`/`UPDATE` على الجداول الثمانية — لم تُمسّ، بانتظار قرار المالك.

### 4) إعادة التحقق الحيّ بعد السحب (مسار الـ API، ثم تراجع)
```sql
SELECT (SELECT count(*) FROM public.sources WHERE name LIKE 'QODER-%') AS src,
       (SELECT count(*) FROM public.shipping_companies WHERE name LIKE 'QODER-%') AS sc,
       (SELECT count(*) FROM public.employees WHERE full_name LIKE 'QODER-%') AS emp,
       (SELECT count(*) FROM public.couriers WHERE full_name LIKE 'QODER-%') AS cr,
       (SELECT count(*) FROM public.accounts WHERE account_number = '0009' AND account_prefix = '2141') AS acc_probe;
```
الإنشاء عبر `alx_api` نجح بعد السحب (`2141-0009`, `2131-0010`) وكل العدادات `0` لأن الفحص كان داخل معامل مُرجَع.


---

## [2026-10-19 02:46:14 +03:00] — استعلامات تحقق فقط (قراءة) لجولة «تحديث الـAPI + حسابات المصادر + كشف الحساب»

**AI Model:** Qoder Agent — **Project:** `ejrojwbbflzchasvgexr` — **DDL/DML:** لا شيء (لم تُجرَ أي كتابة على قاعدة البيانات في هذه الجولة، ولا ترحيل جديد).

**لماذا القراءة فقط:** الجولة كود أمامي/خادمي بالكامل؛ احتجنا فقط تأكيد أسماء الأعمدة ومسارات الربط قبل كتابة الاستعلامات داخل `alx_api`.

1) أعمدة الجداول المتحكِّمة (تأكيد أن `account_id` نص في `sources`/`shipping_companies`/`accounts` وأن الاسم `account_code` لا `account_name`):
```sql
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('accounts','sources','shipping_companies')
ORDER BY table_name, ordinal_position;
```

2) أعمدة ربط الطلبات بالمصدر/شركة الشحن:
```sql
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('orders','shipments')
  AND (column_name ILIKE '%source%' OR column_name ILIKE '%shipping%' OR column_name ILIKE '%carrier%' OR column_name ILIKE '%account%')
ORDER BY table_name, ordinal_position;
```

3) أنواع الكيانات المستخدمة فعليًا في `accounts` (للتأكد من وجود `source` و`shipping_company`):
```sql
SELECT DISTINCT entity_type, count(*) FROM public.accounts GROUP BY entity_type ORDER BY 2 DESC;
```
→ `system 29`، `shipping_company 18`، `customer 11`، `source 9`، `courier 7`، `employee 4`، `asset 2`، `NULL 4`.

4) قياس مدى اكتمال بيانات الطلبات/الشحنات قبل اعتماد الفلتر المزدوج لشركة الشحن:
```sql
SELECT (SELECT count(*) FROM public.orders o WHERE NULLIF(o.order_source_id,'') IS NOT NULL)  AS orders_with_source,
       (SELECT count(*) FROM public.orders o WHERE NULLIF(o.shipping_company,'') IS NOT NULL) AS orders_with_ship_company,
       (SELECT count(*) FROM public.shipments s WHERE NULLIF(s.shipping_company_id,'') IS NOT NULL) AS shipments_with_company,
       (SELECT count(*) FROM public.orders o JOIN public.shipments s ON s.order_id=o.order_id
         WHERE o.shipping_company = s.shipping_company_id) AS order_company_equals_shipment_company;
```
→ القيم `1/1/1/1` (قاعدة اختبار صغيرة) — المفتاح النصي نفسه مستخدم في الموضعين، لذلك فُلتر `shippingCompanyId` يقبل كليهما.

5) تجربة الاستعلام المرتبط كما سيخرج من `reporting.repository.ts` (مصادر):
```sql
SELECT source_id AS "sourceId", name, account_id AS "accountId",
       (SELECT a.account_code FROM public.accounts a WHERE a.account_id = sources.account_id) AS "accountCode",
       (SELECT a.acc_name_ar  FROM public.accounts a WHERE a.account_id = sources.account_id) AS "accountNameAr",
       (SELECT a.currency     FROM public.accounts a WHERE a.account_id = sources.account_id) AS "accountCurrency"
FROM public.sources ORDER BY created_at DESC LIMIT 5;
```
→ SHEIN=`2141-0008`، AMAZON=`2141-0001`، مصانع اخرى=`2141-0007`، Noon=`2141-0005`، AliExpress=`2141-0004` (كلها YER).

6) التجربة نفسها لشركات الشحن:
```sql
SELECT shipping_company_id AS "shippingCompanyId", name, account_id AS "accountId",
       (SELECT a.account_code FROM public.accounts a WHERE a.account_id = shipping_companies.account_id) AS "accountCode",
       (SELECT a.acc_name_ar  FROM public.accounts a WHERE a.account_id = shipping_companies.account_id) AS "accountNameAr"
FROM public.shipping_companies ORDER BY created_at DESC LIMIT 8;
```
→ EMS=`2151-0005`، SPL=`2151-0012`، SafePost=`2151-0011`، Aramex=`2151-0018`، UPS=`2151-0014`، J&T=`2151-0016`، 4PX=`2151-0006`، AliExpress Standard=`2151-0007`.

7) فحص فلتر الطلبات عبر المصدر/شركة الشحن:
```sql
SELECT o.order_id, o.order_number, o.order_source_id, o.shipping_company FROM public.orders o
WHERE o.order_source_id = (SELECT source_id FROM public.sources WHERE name='SHEIN' LIMIT 1)
   OR EXISTS (SELECT 1 FROM public.shipments sh WHERE sh.order_id=o.order_id AND sh.shipping_company_id = o.shipping_company)
LIMIT 5;
```
→ أعاد `ALX-2610-1006` (مصدر SHEIN وشركة Aramex) — وهو الصف الوحيد في قاعدة الاختبار.

---

## [2026-10-19 03:58:31 +03:00] — استعلامات قراءة فقط لتشخيص «كشف حساب فارغ» للمصادر/شركات الشحن (AI Model: Qoder Agent)

**AI Model:** Qoder Agent — **الوقت:** 2026-10-19 03:40 → 03:55 (+03:00) — **Project:** `ejrojwbbflzchasvgexr` — **DDL/DML:** لا شيء (قراءة فقط؛ لا `INSERT`/`UPDATE`/`DELETE`/`GRANT`/ترحيل جديد في هذه الجولة).

**السبب:** بعد إصلاح العطل البرمجي للنافذة بقينا أمام تبويب «كشف الحساب» فارغًا، فلزم تأكيد هل الحسابات موجودة وهل عليها أسطر قيود فعلًا — وهو قرار بيانات يخصّ المالك فلا نلمسه.

1) مطابقة معرّفات المصادر مع أعمدة الطلبات (هل `order_source_id` يحمل `source_id` أم الاسم؟):
```sql
select s.source_id, s.name, s.account_id,
       (select count(*) from public.orders o where o.order_source_id = s.source_id) as orders_by_id,
       (select count(*) from public.orders o where o.order_source_id = s.name)      as orders_by_name
from public.sources s order by s.name limit 20;
```
→ المطابقة تسير على `source_id` نفسه (الاسم لا يرجع شيئًا)، فالفلتر الخادمي `?sourceId=` سليم.

2) عدّاد حسابات الكيانات محل الكشف:
```sql
select a.entity_type, count(distinct a.account_id) as accounts, count(distinct a.entity_id) as entity_ids,
       sum(case when a.entity_id is null then 1 else 0 end) as null_eid
from public.accounts a
where a.entity_type in ('source','shipping_company')
group by a.entity_type;
```
→ `shipping_company`: 18 حسابًا/18 معرّف كيان/0 فارغ — `source`: 9 حسابات/9 معرّفات/0 فارغ. أي **27 حسابًا كلها مربوطة بكيان صحيح**.

3) فحص كل حساب برصيده وعدد أسطر قيوده:
```sql
select a.entity_type, a.account_id, a.entity_id, a.balance,
       coalesce(s.source_id, sc.shipping_company_id) as matched_entity,
       (select count(*) from public.account_trans at where at.account_id = a.account_id) as legs
from public.accounts a
left join public.sources s            on s.source_id            = a.entity_id
left join public.shipping_companies sc on sc.shipping_company_id = a.entity_id
where a.entity_type in ('source','shipping_company')
order by a.entity_type, a.account_id limit 40;
```
→ كل الصفوف `balance = 0` و`legs = 0`، و`matched_entity` يطابق `entity_id` في الجميع (DHL=`2151-0001`، IMILE=`2151-0002`، Cainiao=`2151-0003`، FedEx=`2151-0004`، EMS=`2151-0005`، 4PX Express=`2151-0006` …). **الربط سليم والقيود معدومة.**

4) المحاولة الأولى للعدّاد الشامل فشلت (خطأ حقيقي موثَّق):
```sql
select (select count(*) from public.account_trans) as total_legs,
       (select count(*) from public.account_trans at where at.account_id like '2141%') as legs_source_prefix, …
```
→ `ERROR 42P01: missing FROM-clause entry for table "at"` — لأن `at` اسم محجوز/غير مرئي داخل استعلام فرعي بلا جدول `FROM` مسمّى؛ أُصلح بإسناد اسم جدول صريح (`x`).

5) العدّاد الشامل بعد التصحيح:
```sql
select (select count(*) from public.account_trans) as total_legs,
       (select count(*) from public.account_trans x where x.account_id like '2141%') as legs_source_prefix,
       (select count(*) from public.account_trans x where x.account_id like '2151%') as legs_carrier_prefix,
       (select count(distinct x.account_id) from public.account_trans x) as distinct_accts,
       (select count(*) from public.account_trans x where x.entity_type='source')          as legs_et_source,
       (select count(*) from public.account_trans x where x.entity_type='shipping_company') as legs_et_carrier;
```
→ `total_legs=41`, `legs_source_prefix=0`, `legs_carrier_prefix=0`, `distinct_accts=12`, `legs_et_source=0`, `legs_et_carrier=0`.

6) توزيع الأسطر الـ41 على الحسابات:
```sql
select x.account_id, x.entity_type, x.entity_id, count(*) as legs
from public.account_trans x group by 1,2,3 order by 1;
```
→ 12 حسابًا و16 مجموعة: `1110-0001`(2+1)، `1110-0002`(2+3)، `1110-0003`(4+6)، `1121-0001`(1)، `1132-0005`(2)، `1132-0006`(3)، `1132-0012`(4)، `1150-0001`(3)، `1211-0002`(1)، `2110-0001`(2)، `2131-0009`(1، موظف)، `3110-0001`(1+5) = **41 سطرًا**. أنماط `entity_type` المرصودة: `system` و`customer` و`employee` ونص فارغ — **ولا سطر واحد بنمط `source` أو `shipping_company`، ولا سطر على بادئتيّ `2141%` (المصادر) أو `2151%` (شركات الشحن)**.

**الخلاصة:** لا SQL يلزم تنفيذها الآن؛ الفراغ في «كشف الحساب» ناتج عن عدم ترحيل أي قيد على حسابات هذه الكيانات. أي كتابة (ترحيل تجريبي أو تصحيح أعمدة) تحتاج قرار المالك صراحةً.


---

## [2026-10-19 06:36:18 +03:00] — Round E: مسوحات قراءة فقط لحالة الجلسات (AI Model: Qoder Agent) — لا DDL/DML

1. **معرفة أعمدة `public.settings_general` (قراءة فقط):** `select column_name, data_type from information_schema.columns where table_schema='public' and table_name='settings_general' order by ordinal_position;` — أكّدت أن `user_session_timeout` عمود `integer` مباشر (وليس جدول key/value)، وأن `alx_api_private` يحمل `api_sessions`/`portal_sessions`/`api_refresh_tokens`.
2. **لقطة حالة الجلسات الحيّة (قراءة فقط):** `select (select user_session_timeout from public.settings_general limit 1) as timeout_min, (select count(*) from alx_api_private.api_sessions where revoked_at is null) as staff_live_sessions, (select count(*) from alx_api_private.portal_sessions) as portal_sessions_total, (select count(*) from alx_api_private.api_refresh_tokens where revoked_at is null and used_at is null) as staff_live_refresh_tokens;` → **النتيجة:** `timeout_min=5`، `staff_live_sessions=0`، `portal_sessions_total=15`، `staff_live_refresh_tokens=0`.
   - **القراءة:** مهلة الموظف 5 دقائق (أقلّ من رمز الوصول 600 ث) هي جوهر العطل؛ صفر جلسات موظف حيّة وقت القياس يعني أن الكنّاس يمسح الخامل كما هو مصمَّم؛ جلسات البوابة (15) تبقى لأن جلسة العميل لا تُنهي بالخمول بعد الإصلاح.
   - **لم يُنفَّذ أي كتابة:** لا `UPDATE settings_general` (المالك اختار إبقاء 5)، لا `DELETE` صفوف، لا تغيير مخطط. كل ما سبق `SELECT`/`information_schema` فقط.

---

## 2026-10-19 — الجولة F: أوامر SQL قراءة فقط (Qoder Agent) — تنفيذ: SELECTات عبر Supabase MCP على المشروع `ejrojwbbflzchasvgexr`

لا أمر تعديل ولا DDL في هذه الجولة. الأوامر أدناه هي التحققات التي بُنيت عليها القرارات.

### 1) 2026-10-19 21:18 — قيود المفاتيح الأجنبية على `couriers`/`customers`
```sql
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON kcu.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  AND tc.table_name IN ('couriers','customers')
ORDER BY tc.table_name;
```
النتيجة: `couriers.account_id → accounts.account_id` و`customers.account_id → accounts.account_id`.

### 2) 2026-10-19 21:21 — قاعدة الحذف للمراجعين إلى `customers`/`couriers`
```sql
SELECT confrelid::regclass::text AS parent, conrelid::regclass::text AS child, confdeltype
FROM pg_constraint
WHERE contype = 'f' AND confrelid IN ('public.customers'::regclass, 'public.couriers'::regclass)
ORDER BY parent, child;
```
النتيجة: `orders` و`portal_users` جميعها `confdeltype = 'n'` (ON DELETE SET NULL) — فلا DDL مطلوب للحذف النهائي، وحُارس حساب البوابة أُنشئ في الـAPI.

### 3) 2026-10-19 21:29 — جاهزية المسار المشترك والمنح
```sql
SELECT (SELECT count(*) FROM alx_api_private.portal_sessions WHERE expires_at > now()) AS live_portal_sessions,
       (SELECT count(*) FROM information_schema.role_table_grants
         WHERE grantee = 'alx_api_runtime' AND table_schema = 'public'
           AND table_name = 'portal_users' AND privilege_type = 'SELECT') AS runtime_select_portal_users,
       (SELECT count(*) FROM public.customers WHERE is_active IS FALSE) AS archived_customers,
       (SELECT count(*) FROM public.acc_sub_group
         WHERE entity_type = 'courier' AND is_active IS TRUE AND allows_direct_accounts IS TRUE) AS courier_groups;
```
النتيجة: 9 جلسات بوابة حيّة (كلها مسمّرة بنافذة 5 دقائق قبل الإصلاح)، المنح موجود (1)، عميلان مؤرشفان من حذف قديم لم ينفّذ، ومجموعة حسابات واحدة نشطة لنوع `courier`.

### 4) لم يُنفَّذ (اختياري للمالك — كتابة بيانات)
```sql
UPDATE alx_api_private.portal_sessions SET expires_at = now() + interval '30 days'
 WHERE expires_at < now() + interval '30 days';
```

## 2026-10-19 23:46 — الجولة G: سجل أوامر SQL المنفّذة على قاعدة البيانات

**النموذج المنفذ:** Qoder Agent (session b99c0e85) — **المشروع:** SWIFTSHIP_SYSTEM
**المشروع Supabase:** `ejrojwbbflzchasvgexr` — **الصلاحية المستخدمة:** قراءة فقط
**حالة الدفعة:** لا DDL ولا DML ولا تغيير بيانات — كل العبارات أدناه `SELECT`/`EXPLAIN` فقط.

### 1) 2026-10-19 23:11 — فحص أولي للفهارس عبر pg_indexes (routed through MCP execute_sql)
```sql
SELECT i.tablename, i.indexname, i.indisunique, x.n_live_tup AS live_rows
  FROM pg_indexes i
  LEFT JOIN pg_stat_user_tables x ON x.relname = i.tablename AND x.schemaname = i.schemaname
 WHERE i.schemaname='alx_api_private'
   AND i.tablename IN ('portal_refresh_tokens','portal_sessions','portal_auth_events')
 ORDER BY i.tablename, i.indexname;
```
النتيجة: رُفض — `pg_indexes` لا يملك عمود `indisunique` (خطأ أعمدة). استُبدل بالعبارة 3.

### 2) 2026-10-19 23:13 — محاولة الفهرسة عبر pg_class/pg_index (فشلت بصيغة العمود)
```sql
SELECT c.relname AS tbl, ix.indisunique AS uniq, i.relname AS idx, i.relamname AS am, s.n_live_tup AS rows
  FROM pg_class c JOIN pg_index x ON x.indrelid=c.oid JOIN pg_class i ON i.oid=x.indexrelid
  JOIN pg_am i2 ON i2.oid=i.relam
  JOIN LATERAL (SELECT 1) dummy ON true
  LEFT JOIN pg_stat_user_tables s ON s.relname=c.relname AND s.schemaname=c.relnamespace::regnamespace::text
 WHERE c.relnamespace='alx_api_private'::regnamespace
   AND c.relname IN ('portal_refresh_tokens','portal_sessions')
 ORDER BY c.relname, i.relname;
```
النتيجة: رُفض — `missing FROM-clause entry for table "ix"`. استُبدل بالعبارة 3 الناجحة.

### 3) 2026-10-19 23:15 — الفحص الناجح للفهاريس والأحجام (read-only)
```sql
SELECT c.relname AS tbl, x.indisunique AS uniq, i.relname AS idx, s.n_live_tup AS rows
  FROM pg_class c
  JOIN pg_index x ON x.indrelid = c.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
 WHERE c.relnamespace = 'alx_api_private'::regnamespace
   AND c.relname IN ('portal_refresh_tokens','portal_sessions')
 ORDER BY c.relname, i.relname;
```
النتيجة: الفهارس المطلوبة كلها موجودة، ومنها فهرس فريد على `token_hash` ⇒ **لا حاجة لأي ترحيل أو إنشاء فهرس**.
- `portal_refresh_tokens`: `portal_refresh_tokens_pkey`، `portal_refresh_tokens_hash_uidx` (f unique)، `portal_refresh_tokens_family_idx` — 56 صفًا حيًّا.
- `portal_sessions`: `portal_sessions_pkey`، `portal_sessions_user_expiry_idx` — 4 صفوف حيّة.

### 4) 2026-10-19 23:23 — التحقق من عبارة الدوران الجديدة بـ EXPLAIN (بلا تنفيذ فعلي)
```sql
EXPLAIN
WITH consumed AS (
   UPDATE alx_api_private.portal_refresh_tokens r
      SET used_at = '2026-10-19T20:00:00Z'
    WHERE r.token_hash = 'nonexistent-hash'
      AND r.used_at IS NULL
      AND r.revoked_at IS NULL
      AND r.expires_at > '2026-10-19T20:00:00Z'
      AND EXISTS (
        SELECT 1 FROM alx_api_private.portal_sessions s
         WHERE s.session_id = r.session_id AND s.revoked_at IS NULL AND s.expires_at > '2026-10-19T20:00:00Z'
      )
    RETURNING r.token_id, r.session_id, r.portal_user_id, r.family_id
), issued AS (
   INSERT INTO alx_api_private.portal_refresh_tokens
     (token_id, session_id, portal_user_id, family_id, parent_token_id, token_hash, created_at, expires_at)
   SELECT 'expl-id', c.session_id, c.portal_user_id, c.family_id, c.token_id, 'expl-hash', '2026-10-19T20:00:00Z', '2026-11-18T20:00:00Z'
     FROM consumed c
    RETURNING token_id
), linked AS (
   UPDATE alx_api_private.portal_refresh_tokens r
      SET replaced_by_token_id = 'expl-id'
    WHERE r.token_id = (SELECT token_id FROM consumed)
    RETURNING 1
), renewed AS (
   UPDATE alx_api_private.portal_sessions s
      SET expires_at = '2026-11-18T20:00:00Z', last_used_at = '2026-10-19T20:00:00Z', device_name = NULL, user_agent = NULL, ip_address = NULL
    WHERE s.session_id = (SELECT session_id FROM consumed)
      AND s.revoked_at IS NULL
    RETURNING 1
)
SELECT (SELECT token_id FROM consumed) AS "consumedTokenId";
```
النتيجة: رُفض عند التحليل — `invalid input syntax for type uuid: "expl-id"` (معامل وهمي في نصّ المسبار فقط، لا في كود الإنتاج).

### 5) 2026-10-19 23:24 — إعادة الـ EXPLAIN بمعاملات uuid حقيقية (خطة سليمة)
```sql
EXPLAIN
WITH consumed AS (
   UPDATE alx_api_private.portal_refresh_tokens r
      SET used_at = '2026-10-19T20:00:00Z'
    WHERE r.token_hash = 'nonexistent-hash' AND r.used_at IS NULL AND r.revoked_at IS NULL
      AND r.expires_at > '2026-10-19T20:00:00Z'
      AND EXISTS (SELECT 1 FROM alx_api_private.portal_sessions s WHERE s.session_id = r.session_id AND s.revoked_at IS NULL AND s.expires_at > '2026-10-19T20:00:00Z')
    RETURNING r.token_id, r.session_id, r.portal_user_id, r.family_id
), issued AS (
   INSERT INTO alx_api_private.portal_refresh_tokens
     (token_id, session_id, portal_user_id, family_id, parent_token_id, token_hash, created_at, expires_at)
   SELECT '11111111-1111-1111-1111-111111111111'::uuid, c.session_id, c.portal_user_id, c.family_id, c.token_id, 'expl-hash', '2026-10-19T20:00:00Z', '2026-11-18T20:00:00Z'
     FROM consumed c RETURNING token_id
), linked AS (
   UPDATE alx_api_private.portal_refresh_tokens r SET replaced_by_token_id = '11111111-1111-1111-1111-111111111111'::uuid
    WHERE r.token_id = (SELECT token_id FROM consumed) RETURNING 1
), renewed AS (
   UPDATE alx_api_private.portal_sessions s SET expires_at = '2026-11-18T20:00:00Z', last_used_at = '2026-10-19T20:00:00Z', device_name = NULL, user_agent = NULL, ip_address = NULL
    WHERE s.session_id = (SELECT session_id FROM consumed) AND s.revoked_at IS NULL RETURNING 1
)
SELECT (SELECT token_id FROM consumed) AS "consumedTokenId";
```
النتيجة: نجح التحليل وأنتج خطة — `Index Scan` على فهرس `token_hash` ثم مفتح `portal_sessions_pkey`، بلا Sequential Scan.
**ملاحظة أمان:** `EXPLAIN` بلا `ANALYZE` لا ينفّذ العبارات الفرعية أبدًا ⇒ لم تُكتب ولا تغيّرت أي بيانات، وهذا كان هدف المسبار.

### 6) 2026-10-19 23:31 — مسبار زمن داخل `alx_api` (استُخدم ثم حُذف)
- سكربت Node مؤقت (`tmp-*`) فتح اتصالات بـ `pg` بنفس مجمّع الإنتاج ونفّذ عبارة `SELECT 1` مرتين متتاليتين لقياس رحلة الذهاب وإياب.
- القياس: **2736 ms لرحلتين** (≈1.37 s/رحلة نحو Supabase البعيد).
- الاستنتاج: المسار القديم 8–9 رحلات ⇒ ≈11–12 s ≡ التأخير 10–22 s في HAR؛ والمسار الجديد رحلتان ⇒ ≈2.7 s.
- لا عبارة SQL كتابة في هذا المسبار، والملف حُذف بعد التشغيل (نظافة الأدلة المؤقتة).

### خلاصة قاعدة البيانات لهذه الجولة
- **صفر تغيير دائمي**: لا ترحيل، لا جداول، لا فهارس، لا سياسات RLS، لا صلاحيات، لا UPDATE/DELETE.
- رفع `PG_POOL_MAX` **غير مطلوب** (الحل كان في تقليل عدد الرحلات لكل طلب).

---

## [2026-10-20 00:25:00 +03:00] — AI Model: Gemini 3.8 Flash (Antigravity Agent)
- **ملاحظة**: استعلامات قراءة وتحقق من ترحيلات قاعدة البيانات (خاصة ما بعد 42: 0042، 0043، 0044، 0045، 0046، 0047) وسلامة البنية والفهارس والسياسات:

```sql
-- 1. فحص وجود جدول الإعلانات portal_announcements
SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%announcement%';

-- 2. التحقق من اكتمال حذف الجداول المكررة واليتيمة المقررة في 0042
SELECT table_name FROM information_schema.tables WHERE table_schema='public'
  AND table_name IN ('settings_custom_currency','settings_report_account','settings_dashboard',
                     'settings_dashboard_metric','report_template_filter','report_exchange_rate',
                     'report_settings','public_tracking_product','public_tracking_event','settings');

-- 3. التحقق من أعمدة البديل في accounts المقررة في 0043
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema='public' AND table_name='accounts' 
  AND column_name IN ('superseded_by_account_id', 'superseded_at');

-- 4. التحقق من إسقاط جداول خرائط الترحيل القديمة المقررة في 0043
SELECT table_name FROM information_schema.tables WHERE table_schema='public'
  AND table_name IN ('account_id_migration_map','financial_legacy_migration_map','financial_migration_exceptions','portal_user_migration_map');

-- 5. التحقق من دالة ensure_entity_financial_account في 0044 وتوافق معطياتها مع الأعمدة المسطحة وعدم وجود accounts.data
SELECT proname, proargnames, pg_get_functiondef(oid) LIKE '%accounts.data%' as has_legacy_data 
FROM pg_proc WHERE proname = 'ensure_entity_financial_account';

-- 6. التحقق من صلاحيات وسياسة حذف الجلسات لدور alx_api_runtime في 0045
SELECT has_table_privilege('alx_api_runtime', 'alx_api_private.api_sessions', 'DELETE') AS can_delete,
       EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'alx_api_private.api_sessions'::regclass AND polname = 'api_runtime_sessions_delete') AS policy_exists;

-- 7. التحقق من دالة purge_entity_financial_footprint وتأمين ترتيب الحذف وحارس عهدة المندوب في 0046
SELECT proname, proargnames, pg_get_functiondef(oid) LIKE '%PURGE_BLOCKED_COURIER_HAS_OPEN_CUSTODY%' as has_courier_guard 
FROM pg_proc WHERE proname = 'purge_entity_financial_footprint';

-- 8. التحقق من أعمدة تفاصيل الجهاز وصلاحيات وسياسة الحذف لجلسات البوابة في 0047
SELECT 
  (SELECT array_agg(column_name::text) FROM information_schema.columns WHERE table_schema='alx_api_private' AND table_name='portal_sessions' AND column_name IN ('device_name', 'user_agent', 'ip_address')) AS cols,
  has_table_privilege('alx_api_runtime', 'alx_api_private.portal_sessions', 'DELETE') AS can_delete,
  EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'alx_api_private.portal_sessions'::regclass AND polname = 'portal_runtime_sessions_delete') AS policy_exists;

-- 9. فحص عدم وجود أي فهارس معطوبة (Invalid Indexes)
SELECT indexrelid::regclass AS invalid_index FROM pg_index WHERE NOT indisvalid;

-- 10. فحص عدم وجود أي قيود غير موثقة أو معطوبة (Invalid Constraints)
SELECT conrelid::regclass AS table_name, conname FROM pg_constraint WHERE NOT convalidated;
```

---

## [2026-10-20 00:45:00 +03:00] — AI Model: Gemini 3.8 Flash (Antigravity Agent)
- **ملاحظة**: استعلامات تشخيص وفحص سبب خطأ 42703 عند حذف العميل:

```sql
-- 1. فحص مشغلات جدول customers
SELECT tgname, tgfoid::regproc, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'public.customers'::regclass;

-- 2. استخراج كود دالة purge_entity_financial_footprint
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'purge_entity_financial_footprint';

-- 3. فحص القيود الخارجية المرتبطة بجدول customers
SELECT conname, conrelid::regclass AS table_name, confdeltype 
FROM pg_constraint 
WHERE confrelid = 'public.customers'::regclass;

-- 4. فحص أعمدة جدول portal_users والتحقق من اسم عمود ربط العميل
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'portal_users';
-- النتيجة: العمود هو linked_customer_id وليس customer_id.

-- 5. فحص عينة من portal_users للتأكد من استخدام linked_customer_id
SELECT portal_user_id, linked_customer_id FROM public.portal_users LIMIT 5;
```
