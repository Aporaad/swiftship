-- إصدار محسّن من الإنشاء الذري: يقبل مبالغ أصلية مستقلة للساقين/الأطراف في القيد المركب.
-- سعر التحويل الموثق قد يشير إلى عملة الرأس أو عملة الحساب عند كون عملة الرأس هي العملة الافتراضية.
-- لا يمس القيود القديمة أو RLS.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_financial_entry_v2(p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id text := COALESCE(NULLIF(btrim(p_entry->>'id'), ''), gen_random_uuid()::text);
  v_entry_number text := NULLIF(btrim(p_entry->>'entryNumber'), '');
  v_module_id text := NULLIF(btrim(p_entry->>'moduleId'), '');
  v_entry_type_id text := NULLIF(btrim(p_entry->>'entryTypeId'), '');
  v_entry_category text := COALESCE(NULLIF(btrim(p_entry->>'entryCategory'), ''), 'General');
  v_requested_status text := COALESCE(NULLIF(btrim(p_entry->>'postingStatus'), ''), 'draft');
  v_amount_original numeric;
  v_currency_original_no integer;
  v_description text := NULLIF(btrim(p_entry->>'description'), '');
  v_notes text := COALESCE(p_entry->>'notes', '');
  v_payment_method text := NULLIF(btrim(p_entry->>'paymentMethod'), '');
  v_order_id text := NULLIF(btrim(p_entry->>'orderId'), '');
  v_shipment_id text := NULLIF(btrim(p_entry->>'shipmentId'), '');
  v_custody_id text := NULLIF(btrim(p_entry->>'custodyId'), '');
  v_automation_key text := NULLIF(btrim(p_entry->>'automationKey'), '');
  v_auto_rule_id text := NULLIF(btrim(p_entry->>'autoRuleId'), '');
  v_is_automatic boolean := COALESCE((p_entry->>'isAutomatic')::boolean, false);
  v_effective_at timestamptz := COALESCE(NULLIF(p_entry->>'effectiveAt', '')::timestamptz, now());
  v_created_by_uid text := NULLIF(btrim(p_entry->>'createdByUid'), '');
  v_header_price_id integer;
  v_header_price_seq integer;
  v_line jsonb;
  v_line_no integer := 0;
  v_line_id text;
  v_line_account_id text;
  v_line_account_cur_no integer;
  v_line_type text;
  v_line_amount numeric;
  v_line_amount_original numeric;
  v_line_price_id integer;
  v_line_price_seq integer;
  v_line_payment_method text;
  v_line_description text;
  v_account_cur_no integer;
  v_debit_total numeric := 0;
  v_credit_total numeric := 0;
BEGIN
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'يجب تمرير بيانات رأس القيد ككائن JSON.';
  END IF;
  IF jsonb_typeof(COALESCE(p_entry->'lines', 'null'::jsonb)) <> 'array'
    OR jsonb_array_length(p_entry->'lines') < 2 THEN
    RAISE EXCEPTION 'يجب تمرير ساقين محاسبيتين على الأقل.';
  END IF;
  IF v_entry_number IS NULL OR v_module_id IS NULL OR v_entry_type_id IS NULL OR v_description IS NULL THEN
    RAISE EXCEPTION 'رقم القيد والفئة والنوع والبيان حقول إلزامية.';
  END IF;
  IF COALESCE(p_entry->>'amountOriginal', '') !~ '^[0-9]+(\.[0-9]+)?$'
    OR (p_entry->>'amountOriginal')::numeric <= 0 THEN
    RAISE EXCEPTION 'amountOriginal لرأس القيد يجب أن يكون موجبًا.';
  END IF;
  v_amount_original := (p_entry->>'amountOriginal')::numeric;
  IF COALESCE(p_entry->>'currencyOriginalNo', '') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'currencyOriginalNo لرأس القيد إلزامي.';
  END IF;
  v_currency_original_no := (p_entry->>'currencyOriginalNo')::integer;
  IF v_entry_category NOT IN ('General', 'Compound', 'Temp', 'Reversing')
    OR v_requested_status NOT IN ('draft', 'posted') THEN
    RAISE EXCEPTION 'فئة القيد أو حالة الإنشاء غير صالحة.';
  END IF;
  IF v_payment_method IS NOT NULL AND v_payment_method NOT IN ('cash', 'bank', 'mixed', 'deferred') THEN
    RAISE EXCEPTION 'طريقة الدفع غير صالحة.';
  END IF;
  IF v_is_automatic AND v_automation_key IS NULL THEN
    RAISE EXCEPTION 'القيد التلقائي يحتاج automationKey غير فارغ.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.entry_module m WHERE m.id = v_module_id AND m.is_active)
    OR NOT EXISTS (SELECT 1 FROM public.entry_type t WHERE t.id = v_entry_type_id AND t.module_id = v_module_id AND t.is_active)
    OR NOT EXISTS (SELECT 1 FROM public.currency c WHERE c.cur_id = v_currency_original_no) THEN
    RAISE EXCEPTION 'فئة القيد أو نوعه أو عملته الأصلية غير صالح.';
  END IF;
  IF (v_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_order_id))
    OR (v_shipment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shipments WHERE id = v_shipment_id))
    OR (v_custody_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.custody_advances WHERE id = v_custody_id)) THEN
    RAISE EXCEPTION 'أحد المراجع التجارية أو مرجع العهدة غير موجود.';
  END IF;
  IF v_created_by_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_created_by_uid) THEN
    v_created_by_uid := NULL;
  END IF;

  IF (NULLIF(p_entry->>'currencyPriceId', '') IS NULL) <> (NULLIF(p_entry->>'currencyPriceSeq', '') IS NULL) THEN
    RAISE EXCEPTION 'مرجع سعر الصرف لرأس القيد يجب أن يتضمن id وseq معًا أو يتركهما فارغين معًا.';
  END IF;
  IF NULLIF(p_entry->>'currencyPriceId', '') IS NOT NULL THEN
    v_header_price_id := (p_entry->>'currencyPriceId')::integer;
    v_header_price_seq := (p_entry->>'currencyPriceSeq')::integer;
    IF NOT EXISTS (SELECT 1 FROM public.cur_price WHERE id = v_header_price_id AND seq = v_header_price_seq) THEN
      RAISE EXCEPTION 'مرجع سعر الصرف لرأس القيد غير موجود.';
    END IF;
  END IF;

  INSERT INTO public.main_entry (
    id, entry_number, module_id, entry_type_id, entry_category, posting_status,
    amount_original, amount_text, currency_original_no, currency_price_id, currency_price_seq,
    description, notes, attachments, payment_method, order_id, shipment_id, custody_id,
    automation_key, auto_rule_id, is_automatic, effective_at, created_by_uid, updated_by_uid
  ) VALUES (
    v_entry_id, v_entry_number, v_module_id, v_entry_type_id, v_entry_category, 'draft',
    v_amount_original, COALESCE(p_entry->>'amountText', ''), v_currency_original_no, v_header_price_id, v_header_price_seq,
    v_description, v_notes,
    CASE WHEN jsonb_typeof(p_entry->'attachments') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p_entry->'attachments')) ELSE ARRAY[]::text[] END,
    v_payment_method, v_order_id, v_shipment_id, v_custody_id,
    v_automation_key, v_auto_rule_id, v_is_automatic, v_effective_at, v_created_by_uid, v_created_by_uid
  );

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_entry->'lines')
  LOOP
    v_line_no := v_line_no + 1;
    v_line_id := COALESCE(NULLIF(btrim(v_line->>'id'), ''), gen_random_uuid()::text);
    v_line_account_id := NULLIF(btrim(v_line->>'accountId'), '');
    v_line_type := NULLIF(btrim(v_line->>'transType'), '');
    IF v_line_account_id IS NULL OR v_line_type NOT IN ('Debit', 'Credit')
      OR COALESCE(v_line->>'amount', '') !~ '^[0-9]+(\.[0-9]+)?$'
      OR COALESCE(v_line->>'amountOriginal', '') !~ '^[0-9]+(\.[0-9]+)?$'
      OR COALESCE(v_line->>'accountCurNo', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'كل ساق تحتاج حسابًا ونوعًا ومبلغًا ومبلغًا أصليًا ومرجع عملة صالحين.';
    END IF;
    v_line_amount := (v_line->>'amount')::numeric;
    v_line_amount_original := (v_line->>'amountOriginal')::numeric;
    v_line_account_cur_no := (v_line->>'accountCurNo')::integer;
    IF v_line_amount <= 0 OR v_line_amount_original <= 0 THEN
      RAISE EXCEPTION 'مبالغ الساق يجب أن تكون موجبة.';
    END IF;
    SELECT cur_no INTO v_account_cur_no FROM public.accounts
    WHERE id = v_line_account_id AND is_active AND acc_sub_id IS NOT NULL;
    IF v_account_cur_no IS NULL OR v_account_cur_no <> v_line_account_cur_no THEN
      RAISE EXCEPTION 'الحساب المالي غير صالح أو لا تطابق عملته مرجع عملة الساق.';
    END IF;

    IF (NULLIF(v_line->>'currencyPriceId', '') IS NULL) <> (NULLIF(v_line->>'currencyPriceSeq', '') IS NULL) THEN
      RAISE EXCEPTION 'مرجع سعر الصرف في الساق يجب أن يتضمن id وseq معًا أو يتركهما فارغين معًا.';
    END IF;
    IF NULLIF(v_line->>'currencyPriceId', '') IS NULL THEN
      v_line_price_id := v_header_price_id;
      v_line_price_seq := v_header_price_seq;
    ELSE
      v_line_price_id := (v_line->>'currencyPriceId')::integer;
      v_line_price_seq := (v_line->>'currencyPriceSeq')::integer;
    END IF;
    IF v_line_account_cur_no <> v_currency_original_no THEN
      IF v_line_price_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.cur_price cp
        WHERE cp.id = v_line_price_id
          AND cp.seq = v_line_price_seq
          AND cp.cur_no IN (v_currency_original_no, v_line_account_cur_no)
      ) THEN
        RAISE EXCEPTION 'الساق متعددة العملات تحتاج مرجع سعر صرف موثق لعملة الرأس أو الحساب.';
      END IF;
    END IF;

    v_line_payment_method := COALESCE(NULLIF(btrim(v_line->>'paymentMethod'), ''), v_payment_method);
    IF v_line_payment_method IS NOT NULL AND v_line_payment_method NOT IN ('cash', 'bank', 'mixed', 'deferred') THEN
      RAISE EXCEPTION 'طريقة الدفع في الساق غير صالحة.';
    END IF;
    v_line_description := COALESCE(NULLIF(btrim(v_line->>'description'), ''), v_description);

    INSERT INTO public.account_trans (
      id, entry_id, line_no, trans_type, account_id, account_cur_no,
      amount, amount_original, currency_original_no, currency_price_id, currency_price_seq,
      entity_type, entity_id, payment_method, order_id, shipment_id, custody_id,
      auto_rule_id, automation_key, description, note, created_by_uid, updated_by_uid
    ) VALUES (
      v_line_id, v_entry_id, v_line_no, v_line_type, v_line_account_id, v_line_account_cur_no,
      v_line_amount, v_line_amount_original, v_currency_original_no, v_line_price_id, v_line_price_seq,
      COALESCE(v_line->>'entityType', ''), COALESCE(v_line->>'entityId', ''), v_line_payment_method,
      COALESCE(NULLIF(btrim(v_line->>'orderId'), ''), v_order_id),
      COALESCE(NULLIF(btrim(v_line->>'shipmentId'), ''), v_shipment_id),
      COALESCE(NULLIF(btrim(v_line->>'custodyId'), ''), v_custody_id),
      v_auto_rule_id, v_automation_key, v_line_description, COALESCE(v_line->>'note', ''), v_created_by_uid, v_created_by_uid
    );

    IF v_line_type = 'Debit' THEN v_debit_total := v_debit_total + v_line_amount_original;
    ELSE v_credit_total := v_credit_total + v_line_amount_original;
    END IF;
  END LOOP;

  IF v_entry_category = 'General' AND v_line_no <> 2 THEN
    RAISE EXCEPTION 'القيد العام يجب أن يحتوي على ساقين فقط.';
  END IF;
  IF v_entry_category = 'Compound' AND v_line_no < 3 THEN
    RAISE EXCEPTION 'القيد المركب يجب أن يحتوي على ثلاثة أسطر على الأقل.';
  END IF;
  IF v_debit_total <> v_credit_total OR v_debit_total <> v_amount_original THEN
    RAISE EXCEPTION 'القيد غير متوازن بمبالغه الأصلية أو لا يطابق مبلغ الرأس.';
  END IF;
  PERFORM public.validate_financial_entry_balance(v_entry_id);

  IF v_requested_status = 'posted' THEN
    UPDATE public.main_entry
    SET posting_status = 'posted', posted_at = now(), posted_by_uid = v_created_by_uid
    WHERE id = v_entry_id;
  END IF;

  RETURN jsonb_build_object('id', v_entry_id, 'entryNumber', v_entry_number, 'postingStatus', v_requested_status, 'lineCount', v_line_no);
END;
$$;

COMMIT;
