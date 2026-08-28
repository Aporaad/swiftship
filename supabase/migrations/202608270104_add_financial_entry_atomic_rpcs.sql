-- إجراءات ذرية لمسار القيود الجديد.
-- لا تعيد احتساب accounts.balance بعد لأن الاستثناءات التاريخية ما زالت معزولة قيد المراجعة.
-- لا تغير RLS ولا تمس الجداول القديمة.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'main_entry_currency_price_pair_check'
      AND conrelid = 'public.main_entry'::regclass
  ) THEN
    ALTER TABLE public.main_entry
      ADD CONSTRAINT main_entry_currency_price_pair_check CHECK (
        (currency_price_id IS NULL AND currency_price_seq IS NULL)
        OR (currency_price_id IS NOT NULL AND currency_price_seq IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_trans_currency_price_pair_check'
      AND conrelid = 'public.account_trans'::regclass
  ) THEN
    ALTER TABLE public.account_trans
      ADD CONSTRAINT account_trans_currency_price_pair_check CHECK (
        (currency_price_id IS NULL AND currency_price_seq IS NULL)
        OR (currency_price_id IS NOT NULL AND currency_price_seq IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custody_advances_currency_price_pair_check'
      AND conrelid = 'public.custody_advances'::regclass
  ) THEN
    ALTER TABLE public.custody_advances
      ADD CONSTRAINT custody_advances_currency_price_pair_check CHECK (
        (currency_price_id IS NULL AND currency_price_seq IS NULL)
        OR (currency_price_id IS NOT NULL AND currency_price_seq IS NOT NULL)
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_financial_entry_balance(p_entry_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  entry_record public.main_entry%ROWTYPE;
  line_count integer;
  debit_total numeric;
  credit_total numeric;
BEGIN
  SELECT * INTO entry_record
  FROM public.main_entry
  WHERE id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'رأس القيد % غير موجود.', p_entry_id;
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM(amount_original) FILTER (WHERE trans_type = 'Debit'), 0),
    COALESCE(SUM(amount_original) FILTER (WHERE trans_type = 'Credit'), 0)
  INTO line_count, debit_total, credit_total
  FROM public.account_trans
  WHERE entry_id = p_entry_id;

  IF line_count < 2 THEN
    RAISE EXCEPTION 'لا يمكن حفظ أو ترحيل قيد بأقل من ساقين.';
  END IF;

  IF entry_record.entry_category = 'General' AND line_count <> 2 THEN
    RAISE EXCEPTION 'القيد العام يجب أن يحتوي على ساق مدين واحدة وساق دائن واحدة.';
  END IF;

  IF entry_record.entry_category = 'Compound' AND line_count < 3 THEN
    RAISE EXCEPTION 'القيد المركب يجب أن يحتوي على ثلاثة أسطر على الأقل.';
  END IF;

  IF debit_total <> credit_total THEN
    RAISE EXCEPTION
      'القيد غير متوازن: المدين amount_original = % والدائن amount_original = % بعملة الرأس.',
      debit_total, credit_total;
  END IF;

  IF entry_record.amount_original <> debit_total THEN
    RAISE EXCEPTION
      'مبلغ رأس القيد لا يطابق مجموع الساقين: الرأس = % والمدين = %.',
      entry_record.amount_original, debit_total;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_main_entry_posting_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.posting_status = 'voided' AND NEW.posting_status <> 'voided' THEN
    RAISE EXCEPTION 'لا يمكن إعادة تفعيل قيد مُبطل؛ أنشئ قيدًا جديدًا أو قيدًا عكسيًا.';
  END IF;

  IF OLD.posting_status = 'posted' AND NEW.posting_status = 'draft' THEN
    RAISE EXCEPTION 'لا يمكن إعادة القيد المُرحّل إلى مسودة.';
  END IF;

  IF NEW.posting_status = 'posted' AND OLD.posting_status <> 'posted' THEN
    PERFORM public.validate_financial_entry_balance(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_main_entry_posting_transition ON public.main_entry;
CREATE TRIGGER trg_main_entry_posting_transition
  BEFORE UPDATE OF posting_status ON public.main_entry
  FOR EACH ROW EXECUTE FUNCTION public.validate_main_entry_posting_transition();

CREATE OR REPLACE FUNCTION public.create_financial_entry(p_entry jsonb)
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
  v_currency_price_id integer;
  v_currency_price_seq integer;
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
  v_line jsonb;
  v_line_no integer := 0;
  v_line_id text;
  v_line_amount numeric;
  v_line_amount_original numeric;
  v_line_account_id text;
  v_line_account_cur_no integer;
  v_line_type text;
  v_line_payment_method text;
  v_line_price_id integer;
  v_line_price_seq integer;
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

  IF (NULLIF(p_entry->>'currencyPriceId', '') IS NULL)
    <> (NULLIF(p_entry->>'currencyPriceSeq', '') IS NULL) THEN
    RAISE EXCEPTION 'مرجع سعر الصرف يجب أن يتضمن id وseq معًا أو يتركهما فارغين معًا.';
  END IF;
  IF NULLIF(p_entry->>'currencyPriceId', '') IS NOT NULL THEN
    v_currency_price_id := (p_entry->>'currencyPriceId')::integer;
    v_currency_price_seq := (p_entry->>'currencyPriceSeq')::integer;
    IF NOT EXISTS (
      SELECT 1 FROM public.cur_price cp
      WHERE cp.id = v_currency_price_id
        AND cp.seq = v_currency_price_seq
        AND cp.cur_no = v_currency_original_no
    ) THEN
      RAISE EXCEPTION 'مرجع سعر الصرف لا يطابق عملة رأس القيد.';
    END IF;
  END IF;

  IF v_entry_category NOT IN ('General', 'Compound', 'Temp', 'Reversing') THEN
    RAISE EXCEPTION 'فئة القيد غير صالحة.';
  END IF;
  IF v_requested_status NOT IN ('draft', 'posted') THEN
    RAISE EXCEPTION 'حالة القيد عند الإنشاء يجب أن تكون draft أو posted.';
  END IF;
  IF v_payment_method IS NOT NULL AND v_payment_method NOT IN ('cash', 'bank', 'mixed', 'deferred') THEN
    RAISE EXCEPTION 'طريقة الدفع غير صالحة.';
  END IF;
  IF v_is_automatic AND v_automation_key IS NULL THEN
    RAISE EXCEPTION 'القيد التلقائي يحتاج automationKey غير فارغ.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.entry_module m WHERE m.id = v_module_id AND m.is_active IS TRUE) THEN
    RAISE EXCEPTION 'فئة القيد غير موجودة أو معطلة.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.entry_type t
    WHERE t.id = v_entry_type_id
      AND t.module_id = v_module_id
      AND t.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'نوع القيد غير موجود أو معطل أو لا ينتمي إلى الفئة المحددة.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.currency c WHERE c.cur_id = v_currency_original_no) THEN
    RAISE EXCEPTION 'عملة رأس القيد غير موجودة.';
  END IF;
  IF v_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = v_order_id) THEN
    RAISE EXCEPTION 'الطلب المرتبط غير موجود.';
  END IF;
  IF v_shipment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = v_shipment_id) THEN
    RAISE EXCEPTION 'الشحنة المرتبطة غير موجودة.';
  END IF;
  IF v_custody_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.custody_advances ca WHERE ca.id = v_custody_id) THEN
    RAISE EXCEPTION 'العهدة المرتبطة غير موجودة.';
  END IF;

  IF v_created_by_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_created_by_uid) THEN
    v_created_by_uid := NULL;
  END IF;

  INSERT INTO public.main_entry (
    id, entry_number, module_id, entry_type_id, entry_category, posting_status,
    amount_original, amount_text, currency_original_no, currency_price_id, currency_price_seq,
    description, notes, payment_method, order_id, shipment_id, custody_id,
    automation_key, auto_rule_id, is_automatic, effective_at,
    created_by_uid, updated_by_uid
  ) VALUES (
    v_entry_id, v_entry_number, v_module_id, v_entry_type_id, v_entry_category, 'draft',
    v_amount_original, COALESCE(p_entry->>'amountText', ''), v_currency_original_no, v_currency_price_id, v_currency_price_seq,
    v_description, v_notes, v_payment_method, v_order_id, v_shipment_id, v_custody_id,
    v_automation_key, v_auto_rule_id, v_is_automatic, v_effective_at,
    v_created_by_uid, v_created_by_uid
  );

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_entry->'lines')
  LOOP
    v_line_no := v_line_no + 1;
    v_line_id := COALESCE(NULLIF(btrim(v_line->>'id'), ''), gen_random_uuid()::text);
    v_line_account_id := NULLIF(btrim(v_line->>'accountId'), '');
    v_line_type := NULLIF(btrim(v_line->>'transType'), '');

    IF v_line_account_id IS NULL OR v_line_type NOT IN ('Debit', 'Credit') THEN
      RAISE EXCEPTION 'كل ساق تحتاج accountId ونوع Debit أو Credit.';
    END IF;
    IF COALESCE(v_line->>'amount', '') !~ '^[0-9]+(\.[0-9]+)?$'
      OR (v_line->>'amount')::numeric <= 0
      OR COALESCE(v_line->>'amountOriginal', '') !~ '^[0-9]+(\.[0-9]+)?$'
      OR (v_line->>'amountOriginal')::numeric <= 0 THEN
      RAISE EXCEPTION 'مبالغ الساق يجب أن تكون موجبة.';
    END IF;
    IF COALESCE(v_line->>'accountCurNo', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'accountCurNo إلزامي لكل ساق.';
    END IF;

    v_line_amount := (v_line->>'amount')::numeric;
    v_line_amount_original := (v_line->>'amountOriginal')::numeric;
    v_line_account_cur_no := (v_line->>'accountCurNo')::integer;
    v_line_payment_method := COALESCE(NULLIF(btrim(v_line->>'paymentMethod'), ''), v_payment_method);

    IF v_line_payment_method IS NOT NULL AND v_line_payment_method NOT IN ('cash', 'bank', 'mixed', 'deferred') THEN
      RAISE EXCEPTION 'طريقة الدفع في الساق غير صالحة.';
    END IF;
    IF v_line_amount_original <> v_amount_original THEN
      RAISE EXCEPTION 'amountOriginal لكل ساق يجب أن يساوي مبلغ رأس القيد.';
    END IF;

    IF (NULLIF(v_line->>'currencyPriceId', '') IS NULL)
      <> (NULLIF(v_line->>'currencyPriceSeq', '') IS NULL) THEN
      RAISE EXCEPTION 'مرجع سعر الصرف في الساق يجب أن يتضمن id وseq معًا أو يتركهما فارغين معًا.';
    END IF;
    IF NULLIF(v_line->>'currencyPriceId', '') IS NULL THEN
      v_line_price_id := v_currency_price_id;
      v_line_price_seq := v_currency_price_seq;
    ELSE
      v_line_price_id := (v_line->>'currencyPriceId')::integer;
      v_line_price_seq := (v_line->>'currencyPriceSeq')::integer;
    END IF;

    IF v_line_account_cur_no <> v_currency_original_no AND (v_line_price_id IS NULL OR v_line_price_seq IS NULL) THEN
      RAISE EXCEPTION 'كل ساق تختلف عملتها عن عملة الرأس تحتاج مرجع سعر صرف مثبت.';
    END IF;
    IF v_line_price_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cur_price cp
      WHERE cp.id = v_line_price_id
        AND cp.seq = v_line_price_seq
        AND cp.cur_no = v_currency_original_no
    ) THEN
      RAISE EXCEPTION 'مرجع سعر الصرف في الساق لا يطابق عملة رأس القيد.';
    END IF;

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
      v_auto_rule_id, v_automation_key, COALESCE(NULLIF(btrim(v_line->>'description'), ''), v_description),
      COALESCE(v_line->>'note', ''), v_created_by_uid, v_created_by_uid
    );
  END LOOP;

  PERFORM public.validate_financial_entry_balance(v_entry_id);

  IF v_requested_status = 'posted' THEN
    UPDATE public.main_entry
    SET posting_status = 'posted', posted_at = now(), posted_by_uid = v_created_by_uid
    WHERE id = v_entry_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entryNumber', v_entry_number,
    'postingStatus', v_requested_status,
    'lineCount', v_line_no
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_financial_entry(p_entry_id text, p_posted_by_uid text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_posted_by_uid text := NULLIF(btrim(p_posted_by_uid), '');
BEGIN
  IF v_posted_by_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_posted_by_uid) THEN
    v_posted_by_uid := NULL;
  END IF;

  PERFORM public.validate_financial_entry_balance(p_entry_id);

  UPDATE public.main_entry
  SET posting_status = 'posted', posted_at = now(), posted_by_uid = v_posted_by_uid
  WHERE id = p_entry_id AND posting_status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا يمكن ترحيل القيد: يجب أن يكون موجودًا وفي حالة مسودة.';
  END IF;

  RETURN jsonb_build_object('id', p_entry_id, 'postingStatus', 'posted');
END;
$$;

COMMIT;
