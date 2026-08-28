-- يحفظ تفاصيل الدفع لعهد الإصدار والتسوية ضمن المعاملة الذرية نفسها.
-- لا يغيّر RLS ولا السجلات التاريخية.
BEGIN;

CREATE OR REPLACE FUNCTION public.secure_create_custody_advance(p_custody jsonb, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id text;
  v_custody jsonb;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  v_actor_id := public.require_financial_permission('create_custody_advances');
  v_custody := jsonb_set(COALESCE(p_custody, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  v_result := public.create_custody_advance(v_custody, v_payload);
  PERFORM public.replace_financial_entry_payment_details(v_result->>'issuedEntryId', v_payload->'paymentDetails', v_actor_id);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_settle_custody_advance(p_custody_id text, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id text;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  v_actor_id := public.require_financial_permission('settle_custody_advances');
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  v_result := public.settle_custody_advance(p_custody_id, v_payload, v_actor_id);
  PERFORM public.replace_financial_entry_payment_details(v_result->>'settlementEntryId', v_payload->'paymentDetails', v_actor_id);
  RETURN v_result;
END;
$$;

COMMIT;
