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
GRANT ALL ON TABLE public.returned_products TO anon;
GRANT ALL ON TABLE public.returned_products TO authenticated;
GRANT ALL ON TABLE public.returned_products TO service_role;
```

