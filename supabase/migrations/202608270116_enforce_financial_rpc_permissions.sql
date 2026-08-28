-- إحكام التفويض الخلفي على عمليات القيود الحساسة.
-- لا تغيّر RLS ولا تمس بيانات legacy أو تضيف عمود data.
BEGIN;

CREATE OR REPLACE FUNCTION public.require_financial_permission(p_permission text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id text := auth.uid()::text;
  v_role text;
  v_disabled boolean;
  v_permissions jsonb;
BEGIN
  IF v_actor_id IS NULL OR btrim(v_actor_id) = '' THEN
    RAISE EXCEPTION 'تتطلب العملية المالية جلسة مستخدم موثقة.';
  END IF;
  SELECT u.role, COALESCE(u.disabled, false) INTO v_role, v_disabled
  FROM public.users u WHERE u.id = v_actor_id;
  IF NOT FOUND OR v_disabled THEN RAISE EXCEPTION 'حساب المستخدم غير صالح أو معطل.'; END IF;
  IF v_role = 'Admin' THEN RETURN v_actor_id; END IF;
  SELECT r.data->'permissions' INTO v_permissions FROM public.roles r WHERE r.id = v_role;
  IF COALESCE(v_permissions, '[]'::jsonb) ? '*' OR COALESCE(v_permissions, '[]'::jsonb) ? p_permission THEN RETURN v_actor_id; END IF;
  RAISE EXCEPTION 'لا تملك صلاحية العملية المالية %.', p_permission;
END;
$$;

CREATE OR REPLACE FUNCTION public.financial_entry_permission_for_payload(p_entry jsonb, p_action text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
  v_type_code text;
  v_category text := COALESCE(p_entry->>'entryCategory', 'General');
BEGIN
  SELECT code INTO v_type_code FROM public.entry_type WHERE id = NULLIF(btrim(p_entry->>'entryTypeId'), '');
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
$$;

CREATE OR REPLACE FUNCTION public.secure_create_financial_entry(p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor_id text; v_permission text; v_payload jsonb;
BEGIN
  v_permission := public.financial_entry_permission_for_payload(p_entry, 'create');
  v_actor_id := public.require_financial_permission(v_permission);
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  RETURN public.create_financial_entry_v2(v_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_replace_financial_entry_draft(p_entry_id text, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_permission text; v_actor_id text; v_payload jsonb;
BEGIN
  SELECT public.financial_entry_permission_for_payload(jsonb_build_object('entryTypeId', entry_type_id, 'entryCategory', entry_category), 'edit') INTO v_permission
  FROM public.main_entry WHERE id = p_entry_id;
  IF v_permission IS NULL THEN RAISE EXCEPTION 'القيد غير موجود.'; END IF;
  v_actor_id := public.require_financial_permission(v_permission);
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  RETURN public.replace_financial_entry_draft(p_entry_id, v_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_post_financial_entry(p_entry_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_category text; v_actor_id text;
BEGIN
  SELECT entry_category INTO v_category FROM public.main_entry WHERE id = p_entry_id;
  IF v_category IS NULL THEN RAISE EXCEPTION 'القيد غير موجود.'; END IF;
  v_actor_id := public.require_financial_permission(CASE WHEN v_category = 'Temp' THEN 'post_temporary_entries' ELSE 'post_financial_entries' END);
  RETURN public.post_financial_entry(p_entry_id, v_actor_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_delete_financial_entry_draft(p_entry_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_permission text;
BEGIN
  SELECT CASE WHEN t.code IN ('RECEIPT_VOUCHER', 'ORDER_PAYMENT') THEN 'delete_receipt_vouchers' WHEN t.code IN ('PAYMENT_VOUCHER', 'OPERATING_EXPENSE', 'SALARY_PAYMENT') THEN 'delete_payment_vouchers' WHEN e.entry_category = 'Compound' THEN 'delete_compound_entries' WHEN e.entry_category = 'Temp' THEN 'delete_temporary_entries' ELSE 'delete_general_entries' END INTO v_permission
  FROM public.main_entry e JOIN public.entry_type t ON t.id = e.entry_type_id WHERE e.id = p_entry_id;
  IF v_permission IS NULL THEN RAISE EXCEPTION 'القيد غير موجود.'; END IF;
  PERFORM public.require_financial_permission(v_permission);
  RETURN public.delete_financial_entry_draft(p_entry_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_void_financial_entry_draft(p_entry_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor_id text;
BEGIN
  v_actor_id := public.require_financial_permission('void_financial_entries');
  RETURN public.void_financial_entry_draft(p_entry_id, v_actor_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_reverse_financial_entry(p_entry_id text, p_reversal jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor_id text; v_payload jsonb;
BEGIN
  v_actor_id := public.require_financial_permission('reverse_financial_entries');
  v_payload := jsonb_set(COALESCE(p_reversal, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  RETURN public.reverse_financial_entry(p_entry_id, v_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_create_custody_advance(p_custody jsonb, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor_id text; v_custody jsonb; v_payload jsonb;
BEGIN
  v_actor_id := public.require_financial_permission('create_custody_advances');
  v_custody := jsonb_set(COALESCE(p_custody, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  RETURN public.create_custody_advance(v_custody, v_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_settle_custody_advance(p_custody_id text, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor_id text; v_payload jsonb;
BEGIN
  v_actor_id := public.require_financial_permission('settle_custody_advances');
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  RETURN public.settle_custody_advance(p_custody_id, v_payload, v_actor_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_record_order_payment(p_order_id text, p_payment_amount numeric, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor_id text; v_payload jsonb;
BEGIN
  v_actor_id := public.require_financial_permission('create_receipt_vouchers');
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  RETURN public.record_order_payment_v2(p_order_id, p_payment_amount, v_payload, v_actor_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_financial_entry_v2(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.replace_financial_entry_draft(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_financial_entry(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_financial_entry_draft(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.void_financial_entry_draft(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_financial_entry(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_custody_advance(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_custody_advance(text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_order_payment_v2(text, numeric, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.secure_create_financial_entry(jsonb), public.secure_replace_financial_entry_draft(text, jsonb), public.secure_post_financial_entry(text), public.secure_delete_financial_entry_draft(text), public.secure_void_financial_entry_draft(text), public.secure_reverse_financial_entry(text, jsonb), public.secure_create_custody_advance(jsonb, jsonb), public.secure_settle_custody_advance(text, jsonb), public.secure_record_order_payment(text, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secure_create_financial_entry(jsonb), public.secure_replace_financial_entry_draft(text, jsonb), public.secure_post_financial_entry(text), public.secure_delete_financial_entry_draft(text), public.secure_void_financial_entry_draft(text), public.secure_reverse_financial_entry(text, jsonb), public.secure_create_custody_advance(jsonb, jsonb), public.secure_settle_custody_advance(text, jsonb), public.secure_record_order_payment(text, numeric, jsonb) TO authenticated;

COMMIT;
