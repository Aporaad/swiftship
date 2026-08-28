-- يحفظ تفاصيل طريقة تحصيل الطلب بعد إنشاء سند القبض داخل المعاملة نفسها.
-- لا يغيّر RLS ولا يمس القيود التاريخية.
BEGIN;

CREATE OR REPLACE FUNCTION public.secure_record_order_payment(p_order_id text, p_payment_amount numeric, p_entry jsonb)
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
  v_actor_id := public.require_financial_permission('create_receipt_vouchers');
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  v_result := public.record_order_payment_v2(p_order_id, p_payment_amount, v_payload, v_actor_id);
  PERFORM public.replace_financial_entry_payment_details(v_result->>'entryId', v_payload->'paymentDetails', v_actor_id);
  RETURN v_result;
END;
$$;

COMMIT;
