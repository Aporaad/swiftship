-- يسجل تفاصيل وسائط الدفع صراحة ولا يضيف data إلى أي جدول مالي.
-- لا يغير RLS ولا يعدل القيود أو السجلات التاريخية القائمة.
BEGIN;

CREATE TABLE IF NOT EXISTS public.entry_payment_details (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES public.main_entry(id) ON UPDATE CASCADE ON DELETE CASCADE,
  allocation_no integer NOT NULL CHECK (allocation_no > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank', 'deferred')),
  account_id text NOT NULL REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount_original numeric(18,4) NOT NULL CHECK (amount_original > 0),
  currency_original_no integer NOT NULL REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  bank_reference text NOT NULL DEFAULT '',
  due_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT entry_payment_details_allocation_unique UNIQUE (entry_id, allocation_no),
  CONSTRAINT entry_payment_details_bank_reference CHECK (payment_method <> 'bank' OR btrim(bank_reference) <> ''),
  CONSTRAINT entry_payment_details_due_at CHECK (payment_method <> 'deferred' OR due_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS entry_payment_details_entry_idx ON public.entry_payment_details(entry_id, allocation_no);

CREATE OR REPLACE FUNCTION public.validate_entry_payment_detail()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry public.main_entry%ROWTYPE;
  v_account public.accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM public.main_entry WHERE id = NEW.entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'رأس القيد المرتبط بتفصيل الدفع غير موجود.'; END IF;
  SELECT * INTO v_account FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND OR v_account.is_active = false OR v_account.acc_sub_id IS NULL THEN
    RAISE EXCEPTION 'حساب تفصيل الدفع يجب أن يكون حسابًا ماليًا نشطًا.';
  END IF;
  IF NEW.currency_original_no <> v_entry.currency_original_no THEN
    RAISE EXCEPTION 'عملة تفصيل الدفع يجب أن تطابق عملة رأس القيد.';
  END IF;
  IF NEW.payment_method = 'cash' AND v_account.acc_sub_id <> '111' THEN
    RAISE EXCEPTION 'طريقة النقد تحتاج حسابًا من قسم الصناديق النقدية.';
  END IF;
  IF NEW.payment_method = 'bank' AND v_account.acc_sub_id <> '112' THEN
    RAISE EXCEPTION 'طريقة البنك تحتاج حسابًا من قسم الحسابات البنكية.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.account_trans t WHERE t.entry_id = NEW.entry_id AND t.account_id = NEW.account_id) THEN
    RAISE EXCEPTION 'حساب تفصيل الدفع يجب أن يظهر في أحد أسطر القيد نفسه.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entry_payment_details_validate ON public.entry_payment_details;
CREATE TRIGGER trg_entry_payment_details_validate
  BEFORE INSERT OR UPDATE OF entry_id, payment_method, account_id, amount_original, currency_original_no, bank_reference, due_at
  ON public.entry_payment_details FOR EACH ROW EXECUTE FUNCTION public.validate_entry_payment_detail();

CREATE OR REPLACE FUNCTION public.replace_financial_entry_payment_details(p_entry_id text, p_details jsonb, p_actor_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry public.main_entry%ROWTYPE;
  v_detail jsonb;
  v_no integer := 0;
  v_amount numeric;
  v_total numeric := 0;
  v_method text;
  v_account_id text;
BEGIN
  SELECT * INTO v_entry FROM public.main_entry WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'رأس القيد غير موجود.'; END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details) = 'null' THEN
    IF v_entry.payment_method = 'mixed' THEN RAISE EXCEPTION 'طريقة الدفع المختلطة تحتاج تفاصيل توزيع صريحة.'; END IF;
    RETURN jsonb_build_object('entryId', p_entry_id, 'count', 0);
  END IF;
  IF jsonb_typeof(p_details) <> 'array' THEN RAISE EXCEPTION 'تفاصيل الدفع يجب أن تكون قائمة.'; END IF;
  IF v_entry.payment_method = 'mixed' AND jsonb_array_length(p_details) < 2 THEN
    RAISE EXCEPTION 'طريقة الدفع المختلطة تحتاج توزيعين أو أكثر.';
  END IF;

  DELETE FROM public.entry_payment_details WHERE entry_id = p_entry_id;
  FOR v_detail IN SELECT value FROM jsonb_array_elements(p_details)
  LOOP
    v_no := v_no + 1;
    v_method := NULLIF(btrim(v_detail->>'paymentMethod'), '');
    v_account_id := NULLIF(btrim(v_detail->>'accountId'), '');
    IF v_method NOT IN ('cash', 'bank', 'deferred') OR v_account_id IS NULL
      OR COALESCE(v_detail->>'amountOriginal', '') !~ '^[0-9]+(\.[0-9]+)?$'
      OR (v_detail->>'amountOriginal')::numeric <= 0 THEN
      RAISE EXCEPTION 'كل تفصيل دفع يحتاج طريقة وحسابًا ومبلغًا موجبًا.';
    END IF;
    v_amount := (v_detail->>'amountOriginal')::numeric;
    v_total := v_total + v_amount;
    INSERT INTO public.entry_payment_details (
      id, entry_id, allocation_no, payment_method, account_id, amount_original, currency_original_no,
      bank_reference, due_at, note, created_by_uid, updated_by_uid
    ) VALUES (
      COALESCE(NULLIF(btrim(v_detail->>'id'), ''), gen_random_uuid()::text), p_entry_id, v_no, v_method, v_account_id, v_amount, v_entry.currency_original_no,
      COALESCE(v_detail->>'bankReference', ''), NULLIF(v_detail->>'dueAt', '')::timestamptz, COALESCE(v_detail->>'note', ''), p_actor_id, p_actor_id
    );
  END LOOP;
  IF v_no > 0 AND v_total <> v_entry.amount_original THEN
    RAISE EXCEPTION 'مجموع تفاصيل الدفع يجب أن يساوي مبلغ رأس القيد بعملته الأصلية.';
  END IF;
  IF v_entry.payment_method = 'mixed' AND v_no = 0 THEN RAISE EXCEPTION 'طريقة الدفع المختلطة تحتاج تفاصيل توزيع صريحة.'; END IF;
  RETURN jsonb_build_object('entryId', p_entry_id, 'count', v_no, 'amountOriginal', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_create_financial_entry(p_entry jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor_id text; v_permission text; v_payload jsonb; v_result jsonb;
BEGIN
  v_permission := public.financial_entry_permission_for_payload(p_entry, 'create');
  v_actor_id := public.require_financial_permission(v_permission);
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  v_result := public.create_financial_entry_v2(v_payload);
  PERFORM public.replace_financial_entry_payment_details(v_result->>'id', v_payload->'paymentDetails', v_actor_id);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_replace_financial_entry_draft(p_entry_id text, p_entry jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_permission text; v_actor_id text; v_payload jsonb; v_result jsonb;
BEGIN
  SELECT public.financial_entry_permission_for_payload(jsonb_build_object('entryTypeId', entry_type_id, 'entryCategory', entry_category), 'edit') INTO v_permission FROM public.main_entry WHERE id = p_entry_id;
  IF v_permission IS NULL THEN RAISE EXCEPTION 'القيد غير موجود.'; END IF;
  v_actor_id := public.require_financial_permission(v_permission);
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  DELETE FROM public.entry_payment_details WHERE entry_id = p_entry_id;
  v_result := public.replace_financial_entry_draft(p_entry_id, v_payload);
  PERFORM public.replace_financial_entry_payment_details(p_entry_id, v_payload->'paymentDetails', v_actor_id);
  RETURN v_result;
END;
$$;

REVOKE ALL ON TABLE public.entry_payment_details FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.replace_financial_entry_payment_details(text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.entry_payment_details TO authenticated;

COMMIT;
