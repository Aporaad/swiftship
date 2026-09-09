-- =============================================================================
-- Migration 202609090001: إصلاح سياسات الأمان RLS والصلاحيات لجدول المنتجات المرتجعة
-- Fix RLS policy and permissions for returned_products table
-- =============================================================================

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
