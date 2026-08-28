-- إصلاح إجراءات حساسة في النموذج المالي الجديد فقط.
-- لا يغيّر RLS ولا يحذف أو يعدّل أي قيد أو جدول legacy.
BEGIN;

CREATE OR REPLACE FUNCTION public.reverse_financial_entry(p_entry_id text, p_reversal jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE entry_record public.main_entry%ROWTYPE;
DECLARE line_record record;
DECLARE reversal_payload jsonb;
DECLARE reversal_lines jsonb := '[]'::jsonb;
DECLARE result jsonb;
BEGIN
  SELECT * INTO entry_record FROM public.main_entry WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'القيد المطلوب عكسه غير موجود.'; END IF;
  IF entry_record.posting_status <> 'posted' THEN RAISE EXCEPTION 'يمكن عكس قيد مرحّل فقط.'; END IF;
  IF EXISTS (SELECT 1 FROM public.main_entry WHERE reverses_entry_id = p_entry_id) THEN
    RAISE EXCEPTION 'يوجد قيد عكسي مرتبط بهذا القيد بالفعل.';
  END IF;

  FOR line_record IN SELECT * FROM public.account_trans WHERE entry_id = p_entry_id ORDER BY line_no LOOP
    reversal_lines := reversal_lines || jsonb_build_array(jsonb_build_object(
      'accountId', line_record.account_id,
      'accountCurNo', line_record.account_cur_no,
      'transType', CASE WHEN line_record.trans_type = 'Debit' THEN 'Credit' ELSE 'Debit' END,
      'amount', line_record.amount,
      'amountOriginal', line_record.amount_original,
      'currencyPriceId', line_record.currency_price_id,
      'currencyPriceSeq', line_record.currency_price_seq,
      'entityType', line_record.entity_type,
      'entityId', line_record.entity_id,
      'paymentMethod', line_record.payment_method,
      'orderId', line_record.order_id,
      'shipmentId', line_record.shipment_id,
      'custodyId', line_record.custody_id,
      'description', COALESCE(NULLIF(p_reversal->>'description', ''), 'قيد عكسي لـ ' || entry_record.entry_number),
      'note', COALESCE(p_reversal->>'notes', '')
    ));
  END LOOP;

  reversal_payload := jsonb_build_object(
    'entryNumber', NULLIF(btrim(p_reversal->>'entryNumber'), ''),
    'moduleId', entry_record.module_id,
    'entryTypeId', entry_record.entry_type_id,
    'entryCategory', 'Reversing',
    'postingStatus', 'posted',
    'amountOriginal', entry_record.amount_original,
    'currencyOriginalNo', entry_record.currency_original_no,
    'currencyPriceId', entry_record.currency_price_id,
    'currencyPriceSeq', entry_record.currency_price_seq,
    'description', COALESCE(NULLIF(p_reversal->>'description', ''), 'قيد عكسي لـ ' || entry_record.entry_number),
    'notes', COALESCE(p_reversal->>'notes', ''),
    'paymentMethod', entry_record.payment_method,
    'orderId', entry_record.order_id,
    'shipmentId', entry_record.shipment_id,
    'custodyId', entry_record.custody_id,
    'createdByUid', COALESCE(p_reversal->>'createdByUid', ''),
    'lines', reversal_lines
  );
  IF reversal_payload->>'entryNumber' IS NULL THEN RAISE EXCEPTION 'رقم القيد العكسي مطلوب.'; END IF;
  result := public.create_financial_entry_v2(reversal_payload);
  UPDATE public.main_entry SET reverses_entry_id = p_entry_id WHERE id = result->>'id';
  RETURN result || jsonb_build_object('reversesEntryId', p_entry_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.void_financial_entry_draft(p_entry_id text, p_voided_by_uid text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE entry_record public.main_entry%ROWTYPE;
BEGIN
  SELECT * INTO entry_record FROM public.main_entry WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'القيد غير موجود.'; END IF;
  IF entry_record.posting_status <> 'draft' THEN RAISE EXCEPTION 'لا يُبطل القيد المرحّل مباشرة؛ أنشئ قيدًا عكسيًا أولًا.'; END IF;
  IF p_voided_by_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_voided_by_uid) THEN p_voided_by_uid := NULL; END IF;
  UPDATE public.main_entry
  SET posting_status = 'voided', voided_at = now(), voided_by_uid = p_voided_by_uid, updated_by_uid = p_voided_by_uid
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('id', p_entry_id, 'postingStatus', 'voided');
END;
$$;

COMMIT;
