-- يثبت أن سند قبض الطلب بعملة الدفع وحساب طرف الطلب المسجلين في الطلب نفسه.
-- لا يغيّر RLS ولا يمس أرصدة أو قيودًا تاريخية.
BEGIN;

CREATE OR REPLACE FUNCTION public.record_order_payment_v2(p_order_id text, p_payment_amount numeric, p_entry jsonb, p_updated_by_uid text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  order_record public.orders%ROWTYPE;
  v_order_data jsonb;
  v_old_paid numeric;
  v_old_remaining numeric;
  v_total numeric;
  v_new_paid numeric;
  v_new_remaining numeric;
  v_payment_status text;
  v_entry_result jsonb;
  v_payment_currency_code text;
  v_payment_currency_no integer;
  v_party_account_id text;
BEGIN
  IF p_order_id IS NULL OR btrim(p_order_id) = '' THEN RAISE EXCEPTION 'معرف الطلب مطلوب.'; END IF;
  IF p_payment_amount IS NULL OR p_payment_amount <= 0 THEN RAISE EXCEPTION 'مبلغ الدفعة يجب أن يكون موجبًا.'; END IF;
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN RAISE EXCEPTION 'بيانات سند القبض مطلوبة.'; END IF;
  SELECT * INTO order_record FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود.'; END IF;

  v_order_data := COALESCE(order_record.data, '{}'::jsonb);
  v_old_paid := COALESCE(NULLIF(v_order_data->>'amountPaid', '')::numeric, 0);
  v_total := COALESCE(NULLIF(v_order_data->>'totalAmount', '')::numeric, NULLIF(v_order_data->>'totalCostYER', '')::numeric, 0);
  v_old_remaining := COALESCE(NULLIF(v_order_data->>'amountRemaining', '')::numeric, GREATEST(v_total - v_old_paid, 0));
  IF p_payment_amount > v_old_remaining THEN RAISE EXCEPTION 'مبلغ الدفعة يتجاوز المتبقي للطلب.'; END IF;
  IF COALESCE(p_entry->>'orderId', '') <> p_order_id THEN RAISE EXCEPTION 'مرجع الطلب في سند القبض غير مطابق.'; END IF;
  IF COALESCE(p_entry->>'amountOriginal', '')::numeric <> p_payment_amount THEN RAISE EXCEPTION 'مبلغ سند القبض يجب أن يطابق مبلغ الدفعة.'; END IF;
  IF COALESCE(p_entry->>'entryTypeId', '') <> 'type_order_payment' THEN RAISE EXCEPTION 'تحصيل الطلب يجب أن يستخدم نوع قيد دفعة الطلب.'; END IF;

  v_payment_currency_code := upper(btrim(COALESCE(NULLIF(v_order_data->>'paidCurrency', ''), NULLIF(v_order_data->>'currency', ''), NULLIF(v_order_data->>'orderCurrency', ''))));
  SELECT cur_id INTO v_payment_currency_no FROM public.currency WHERE upper(code) = v_payment_currency_code;
  IF v_payment_currency_no IS NULL THEN RAISE EXCEPTION 'عملة الدفع المسجلة للطلب غير موجودة أو غير صالحة.'; END IF;
  IF COALESCE(p_entry->>'currencyOriginalNo', '')::integer <> v_payment_currency_no THEN RAISE EXCEPTION 'عملة سند القبض لا تطابق عملة الدفع المسجلة للطلب.'; END IF;

  v_party_account_id := COALESCE(NULLIF(btrim(v_order_data->>'orderPartyAccountId'), ''), NULLIF(btrim(v_order_data->>'customerAccountId'), ''));
  IF v_party_account_id IS NULL THEN RAISE EXCEPTION 'الطلب لا يحمل حسابًا ماليًا لطرف التحصيل.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_entry->'lines', '[]'::jsonb)) AS line(value)
    WHERE line.value->>'transType' = 'Credit' AND line.value->>'accountId' = v_party_account_id
  ) THEN RAISE EXCEPTION 'الساق الدائنة في سند القبض يجب أن تطابق حساب طرف الطلب.'; END IF;
  IF p_updated_by_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_updated_by_uid) THEN p_updated_by_uid := NULL; END IF;

  v_entry_result := public.create_financial_entry_v2(p_entry);
  v_new_paid := v_old_paid + p_payment_amount;
  v_new_remaining := v_old_remaining - p_payment_amount;
  v_payment_status := CASE WHEN v_new_remaining = 0 THEN 'Paid' ELSE 'Partial Paid' END;
  UPDATE public.orders
  SET data = v_order_data || jsonb_build_object(
    'amountPaid', v_new_paid, 'amountRemaining', v_new_remaining, 'paymentStatus', v_payment_status,
    'updatedAt', floor(extract(epoch FROM now()) * 1000)::bigint
  )
  WHERE id = p_order_id;
  RETURN jsonb_build_object('orderId', p_order_id, 'entryId', v_entry_result->>'id', 'amountPaid', v_new_paid, 'amountRemaining', v_new_remaining, 'paymentStatus', v_payment_status);
END;
$$;

COMMIT;
