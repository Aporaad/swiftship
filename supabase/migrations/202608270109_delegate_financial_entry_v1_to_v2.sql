-- توحيد اسم الإجراء المبكر مع قواعد v2 المحسنة.
-- لا يحذف بيانات ولا يغير RLS؛ يحافظ على توافق العملاء الذين يستدعون الاسم السابق.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_financial_entry(p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.create_financial_entry_v2(p_entry);
END;
$$;

COMMIT;
