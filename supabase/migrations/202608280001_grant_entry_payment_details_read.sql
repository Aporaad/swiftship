-- الواجهة تقرأ السجل من خلال محول Supabase الذي يستخدم مفتاح anon عند غياب جلسة Auth.
-- القراءة فقط؛ تبقى كل الكتابة محصورة في إجراءات SECURITY DEFINER المحمية، ولا يتغير RLS.
BEGIN;
GRANT SELECT ON TABLE public.entry_payment_details TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.entry_payment_details FROM anon, authenticated;
COMMIT;
