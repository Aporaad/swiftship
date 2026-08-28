-- إجراءات العهد والسلف الذرية: لا تُنشأ العهدة أو تسويتها بسلسلة عمليات واجهة منفصلة.
-- لا تغير RLS ولا تحذف بيانات.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_custody_advance_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE target_account public.accounts%ROWTYPE;
BEGIN
  SELECT * INTO target_account FROM public.accounts WHERE id = NEW.recipient_account_id;
  IF NOT FOUND OR target_account.is_active = false OR target_account.acc_sub_id IS NULL OR target_account.cur_no IS NULL THEN
    RAISE EXCEPTION 'حساب مستلم العهدة يجب أن يكون حسابًا ماليًا ورقيًا ونشطًا بعملة محددة.';
  END IF;
  IF (NEW.currency_price_id IS NULL) <> (NEW.currency_price_seq IS NULL) THEN
    RAISE EXCEPTION 'مرجع سعر صرف العهدة يجب أن يتضمن id وseq معًا أو يتركهما فارغين معًا.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custody_advances_target ON public.custody_advances;
CREATE TRIGGER trg_custody_advances_target
  BEFORE INSERT OR UPDATE OF recipient_account_id, currency_price_id, currency_price_seq
  ON public.custody_advances
  FOR EACH ROW EXECUTE FUNCTION public.validate_custody_advance_target();

CREATE OR REPLACE FUNCTION public.create_custody_advance(p_custody jsonb, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_id text := COALESCE(NULLIF(btrim(p_custody->>'id'), ''), gen_random_uuid()::text);
  v_number text := NULLIF(btrim(p_custody->>'custodyNumber'), '');
  v_recipient_type text := NULLIF(btrim(p_custody->>'recipientType'), '');
  v_recipient_id text := NULLIF(btrim(p_custody->>'recipientId'), '');
  v_recipient_name text := NULLIF(btrim(p_custody->>'recipientName'), '');
  v_recipient_account_id text := NULLIF(btrim(p_custody->>'recipientAccountId'), '');
  v_amount numeric;
  v_currency_no integer;
  v_created_by_uid text := NULLIF(btrim(p_custody->>'createdByUid'), '');
  v_price_id integer;
  v_price_seq integer;
  v_entry_result jsonb;
  v_issued_at timestamptz := COALESCE(NULLIF(p_custody->>'issuedAt', '')::timestamptz, now());
BEGIN
  IF p_custody IS NULL OR p_entry IS NULL THEN RAISE EXCEPTION 'بيانات العهدة والقيد مطلوبة.'; END IF;
  IF v_number IS NULL OR v_recipient_type NOT IN ('employee', 'courier', 'customer', 'supplier', 'other')
    OR v_recipient_id IS NULL OR v_recipient_name IS NULL OR v_recipient_account_id IS NULL THEN
    RAISE EXCEPTION 'رقم العهدة وطرفها وحسابها المالي حقول إلزامية.';
  END IF;
  IF COALESCE(p_custody->>'amountOriginal', '') !~ '^[0-9]+(\.[0-9]+)?$' OR (p_custody->>'amountOriginal')::numeric <= 0 THEN
    RAISE EXCEPTION 'مبلغ العهدة يجب أن يكون موجبًا.';
  END IF;
  IF COALESCE(p_custody->>'currencyOriginalNo', '') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'عملة العهدة مطلوبة.'; END IF;
  v_amount := (p_custody->>'amountOriginal')::numeric;
  v_currency_no := (p_custody->>'currencyOriginalNo')::integer;
  IF v_created_by_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_created_by_uid) THEN v_created_by_uid := NULL; END IF;
  IF (NULLIF(p_custody->>'currencyPriceId', '') IS NULL) <> (NULLIF(p_custody->>'currencyPriceSeq', '') IS NULL) THEN
    RAISE EXCEPTION 'مرجع سعر صرف العهدة يجب أن يتضمن id وseq معًا أو يتركهما فارغين معًا.';
  END IF;
  IF NULLIF(p_custody->>'currencyPriceId', '') IS NOT NULL THEN
    v_price_id := (p_custody->>'currencyPriceId')::integer; v_price_seq := (p_custody->>'currencyPriceSeq')::integer;
  END IF;

  INSERT INTO public.custody_advances (
    id, custody_number, recipient_type, recipient_id, recipient_name, recipient_account_id,
    amount_original, currency_original_no, currency_price_id, currency_price_seq,
    amount_settled, amount_outstanding, status, note, issued_at, issued_by_uid, created_by_uid, updated_by_uid
  ) VALUES (
    v_id, v_number, v_recipient_type, v_recipient_id, v_recipient_name, v_recipient_account_id,
    v_amount, v_currency_no, v_price_id, v_price_seq,
    0, v_amount, 'open', COALESCE(p_custody->>'note', ''), v_issued_at, v_created_by_uid, v_created_by_uid, v_created_by_uid
  );

  v_entry_result := public.create_financial_entry_v2(jsonb_set(p_entry, '{custodyId}', to_jsonb(v_id), true));
  UPDATE public.custody_advances
  SET issued_entry_id = v_entry_result->>'id', updated_by_uid = v_created_by_uid
  WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'custodyNumber', v_number, 'issuedEntryId', v_entry_result->>'id', 'status', 'open');
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_custody_advance(p_custody_id text, p_entry jsonb, p_settled_by_uid text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  custody_record public.custody_advances%ROWTYPE;
  v_amount numeric;
  v_entry_result jsonb;
  v_new_settled numeric;
  v_new_outstanding numeric;
  v_new_status text;
BEGIN
  SELECT * INTO custody_record FROM public.custody_advances WHERE id = p_custody_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العهدة غير موجودة.'; END IF;
  IF custody_record.status IN ('settled', 'cancelled') THEN RAISE EXCEPTION 'لا يمكن تسوية عهدة مغلقة.'; END IF;
  IF COALESCE(p_entry->>'amountOriginal', '') !~ '^[0-9]+(\.[0-9]+)?$' OR (p_entry->>'amountOriginal')::numeric <= 0 THEN
    RAISE EXCEPTION 'مبلغ قيد التسوية يجب أن يكون موجبًا.';
  END IF;
  v_amount := (p_entry->>'amountOriginal')::numeric;
  IF v_amount > custody_record.amount_outstanding THEN RAISE EXCEPTION 'مبلغ التسوية يتجاوز المتبقي من العهدة.'; END IF;
  IF COALESCE(p_entry->>'currencyOriginalNo', '')::integer <> custody_record.currency_original_no THEN
    RAISE EXCEPTION 'عملة قيد التسوية يجب أن تطابق عملة العهدة.';
  END IF;
  IF p_settled_by_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_settled_by_uid) THEN p_settled_by_uid := NULL; END IF;

  v_entry_result := public.create_financial_entry_v2(jsonb_set(p_entry, '{custodyId}', to_jsonb(p_custody_id), true));
  v_new_settled := custody_record.amount_settled + v_amount;
  v_new_outstanding := custody_record.amount_original - v_new_settled;
  v_new_status := CASE WHEN v_new_outstanding = 0 THEN 'settled' ELSE 'partial' END;
  UPDATE public.custody_advances
  SET amount_settled = v_new_settled, amount_outstanding = v_new_outstanding, status = v_new_status,
      settlement_entry_id = v_entry_result->>'id', settled_at = CASE WHEN v_new_status = 'settled' THEN now() ELSE NULL END,
      settled_by_uid = CASE WHEN v_new_status = 'settled' THEN p_settled_by_uid ELSE NULL END,
      updated_by_uid = p_settled_by_uid
  WHERE id = p_custody_id;
  RETURN jsonb_build_object('id', p_custody_id, 'settlementEntryId', v_entry_result->>'id', 'status', v_new_status, 'amountOutstanding', v_new_outstanding);
END;
$$;

COMMIT;
