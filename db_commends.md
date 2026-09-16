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
-- النتيجة: [] (0 أعمدة مخالفة بنسبة 100%).
```

```



