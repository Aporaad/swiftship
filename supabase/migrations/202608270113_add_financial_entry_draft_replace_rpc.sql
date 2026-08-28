-- تعديل المسودات الجديدة فقط؛ القيود المرحلة لا تُعدّل وتستخدم العكس أو الإبطال.
BEGIN;

CREATE OR REPLACE FUNCTION public.replace_financial_entry_draft(p_entry_id text, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE entry_record public.main_entry%ROWTYPE;
DECLARE replacement jsonb;
BEGIN
  SELECT * INTO entry_record FROM public.main_entry WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسودة القيد غير موجودة.'; END IF;
  IF entry_record.posting_status <> 'draft' THEN RAISE EXCEPTION 'لا يمكن تعديل قيد مرحّل أو مبطل؛ استخدم العكس أو أنشئ مسودة جديدة.'; END IF;
  replacement := jsonb_set(jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{id}', to_jsonb(p_entry_id), true), '{postingStatus}', '"draft"'::jsonb, true);
  DELETE FROM public.account_trans WHERE entry_id = p_entry_id;
  DELETE FROM public.main_entry WHERE id = p_entry_id;
  RETURN public.create_financial_entry_v2(replacement);
END;
$$;

COMMIT;
