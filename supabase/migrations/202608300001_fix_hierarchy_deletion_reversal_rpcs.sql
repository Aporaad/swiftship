-- Migration 202608300001: Fix recalculate_accounting_hierarchy array overload, delete_orders_with_dependents main_entry data column reference, and reverse_financial_entry currencyOriginalNo missing line field.

-- 1. Overload recalculate_accounting_hierarchy for array parameters
CREATE OR REPLACE FUNCTION public.recalculate_accounting_hierarchy(p_account_ids text[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  acc_id text;
BEGIN
  IF p_account_ids IS NULL OR cardinality(p_account_ids) = 0 THEN
    RETURN;
  END IF;
  
  FOR acc_id IN SELECT DISTINCT unnest(p_account_ids)
  LOOP
    IF acc_id IS NOT NULL AND btrim(acc_id) <> '' THEN
      PERFORM public.recalculate_accounting_hierarchy(acc_id);
    END IF;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.recalculate_accounting_hierarchy(text[]) TO anon, authenticated, service_role, public;

-- 2. Fix delete_orders_with_dependents main_entry order_id lookup
CREATE OR REPLACE FUNCTION public.delete_orders_with_dependents(p_order_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  target_ids text[];
  target_numbers text[];
  shipment_ids text[];
  main_entry_ids text[];
  account_trans_ids text[];
  affected_accounts text[];
  requested_count integer;
  actual_count integer;
  deleted_shipments integer := 0;
  deleted_products integer := 0;
  deleted_main_entries integer := 0;
  deleted_account_trans integer := 0;
  deleted_expenses integer := 0;
  deleted_notifications integer := 0;
  deleted_whatsapp_logs integer := 0;
  deleted_orders_history integer := 0;
  deleted_orders integer := 0;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT trimmed_id ORDER BY trimmed_id), ARRAY[]::text[])
    INTO target_ids
  FROM (
    SELECT NULLIF(btrim(order_id), '') AS trimmed_id
    FROM unnest(COALESCE(p_order_ids, ARRAY[]::text[])) AS order_id
  ) AS cleaned
  WHERE trimmed_id IS NOT NULL;

  requested_count := cardinality(target_ids);
  IF requested_count = 0 THEN
    RAISE EXCEPTION 'At least one order ID is required for deletion.';
  END IF;

  SELECT count(*), COALESCE(array_agg(order_number), ARRAY[]::text[])
    INTO actual_count, target_numbers
  FROM public.orders
  WHERE id = ANY(target_ids);

  IF actual_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected orders no longer exist; no deletion was performed.';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO shipment_ids
  FROM public.shipments
  WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO main_entry_ids
  FROM public.main_entry
  WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]), COALESCE(array_agg(DISTINCT account_id), ARRAY[]::text[])
    INTO account_trans_ids, affected_accounts
  FROM public.account_trans
  WHERE order_id = ANY(target_ids)
     OR shipment_id = ANY(shipment_ids)
     OR entry_id = ANY(main_entry_ids);

  DELETE FROM public.notifications
  WHERE data ->> 'orderId' = ANY(target_ids)
     OR data ->> 'order_id' = ANY(target_ids)
     OR data ->> 'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

  DELETE FROM public.whatsapp_logs
  WHERE data ->> 'orderId' = ANY(target_ids)
     OR data ->> 'order_id' = ANY(target_ids)
     OR data ->> 'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_whatsapp_logs = ROW_COUNT;

  DELETE FROM public.expenses
  WHERE data ->> 'orderId' = ANY(target_ids)
     OR data ->> 'order_id' = ANY(target_ids)
     OR data ->> 'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_expenses = ROW_COUNT;

  IF cardinality(main_entry_ids) > 0 THEN
    DELETE FROM public.entry_payment_details WHERE entry_id = ANY(main_entry_ids);
  END IF;

  DELETE FROM public.account_trans WHERE id = ANY(account_trans_ids) OR entry_id = ANY(main_entry_ids) OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_account_trans = ROW_COUNT;

  DELETE FROM public.main_entry WHERE id = ANY(main_entry_ids) OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_main_entries = ROW_COUNT;

  DELETE FROM public.shipments WHERE id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_shipments = ROW_COUNT;

  DELETE FROM public.products WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_products = ROW_COUNT;

  DELETE FROM public.orders_history
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_orders_history = ROW_COUNT;

  DELETE FROM public.orders WHERE id = ANY(target_ids);
  GET DIAGNOSTICS deleted_orders = ROW_COUNT;

  IF affected_accounts IS NOT NULL AND cardinality(affected_accounts) > 0 THEN
    PERFORM public.recalculate_accounting_hierarchy(affected_accounts);
  END IF;

  RETURN jsonb_build_object(
    'orderIds', target_ids,
    'orders', deleted_orders,
    'shipments', deleted_shipments,
    'products', deleted_products,
    'mainEntries', deleted_main_entries,
    'accountTrans', deleted_account_trans,
    'expenses', deleted_expenses,
    'notifications', deleted_notifications,
    'whatsappLogs', deleted_whatsapp_logs,
    'ordersHistory', deleted_orders_history,
    'activityLogsDeleted', 0
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_orders_with_dependents(text[]) TO anon, authenticated, service_role, public;

-- 3. Fix reverse_financial_entry currencyOriginalNo line mapping
CREATE OR REPLACE FUNCTION public.reverse_financial_entry(p_entry_id text, p_reversal jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE entry_record public.main_entry%ROWTYPE;
DECLARE line_record record;
DECLARE reversal_payload jsonb;
DECLARE reversal_lines jsonb := '[]'::jsonb;
DECLARE result jsonb;
DECLARE v_amount_original numeric;
DECLARE v_currency_original_no integer;
BEGIN
  SELECT * INTO entry_record FROM public.main_entry WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'القيد المطلوب عكسه غير موجود.'; END IF;
  IF entry_record.posting_status <> 'posted' THEN RAISE EXCEPTION 'يمكن عكس قيد مرحّل فقط.'; END IF;
  IF EXISTS (SELECT 1 FROM public.main_entry WHERE reverses_entry_id = p_entry_id) THEN RAISE EXCEPTION 'يوجد قيد عكسي مرتبط بهذا القيد بالفعل.'; END IF;

  SELECT COALESCE(SUM(amount_original) FILTER (WHERE trans_type = 'Debit'), 0), COALESCE(MAX(currency_original_no), 1)
  INTO v_amount_original, v_currency_original_no
  FROM public.account_trans WHERE entry_id = p_entry_id;

  FOR line_record IN SELECT * FROM public.account_trans WHERE entry_id = p_entry_id ORDER BY line_no LOOP
    reversal_lines := reversal_lines || jsonb_build_array(jsonb_build_object(
      'accountId', line_record.account_id, 'accountCurNo', line_record.account_cur_no,
      'currencyOriginalNo', COALESCE(line_record.currency_original_no, v_currency_original_no, 1),
      'transType', CASE WHEN line_record.trans_type = 'Debit' THEN 'Credit' ELSE 'Debit' END,
      'amount', line_record.amount, 'amountOriginal', line_record.amount_original,
      'currencyPriceId', line_record.currency_price_id, 'currencyPriceSeq', line_record.currency_price_seq,
      'entityType', line_record.entity_type, 'entityId', line_record.entity_id,
      'paymentMethod', line_record.payment_method, 'orderId', line_record.order_id,
      'shipmentId', line_record.shipment_id, 'custodyId', line_record.custody_id,
      'description', COALESCE(NULLIF(p_reversal->>'description', ''), 'قيد عكسي لـ ' || entry_record.entry_number),
      'note', COALESCE(p_reversal->>'notes', '')
    ));
  END LOOP;

  reversal_payload := jsonb_build_object(
    'entryNumber', NULLIF(btrim(p_reversal->>'entryNumber'), ''), 'moduleId', entry_record.module_id,
    'entryTypeId', entry_record.entry_type_id, 'entryCategory', 'Reversing', 'postingStatus', 'posted',
    'amountOriginal', v_amount_original, 'currencyOriginalNo', v_currency_original_no,
    'description', COALESCE(NULLIF(p_reversal->>'description', ''), 'قيد عكسي لـ ' || entry_record.entry_number),
    'notes', COALESCE(p_reversal->>'notes', ''), 'paymentMethod', entry_record.payment_method,
    'orderId', entry_record.order_id, 'shipmentId', entry_record.shipment_id, 'custodyId', entry_record.custody_id,
    'createdByUid', COALESCE(p_reversal->>'createdByUid', ''), 'lines', reversal_lines
  );
  IF reversal_payload->>'entryNumber' IS NULL THEN RAISE EXCEPTION 'رقم القيد العكسي مطلوب.'; END IF;
  result := public.create_financial_entry_v2(reversal_payload);
  UPDATE public.main_entry SET reverses_entry_id = p_entry_id WHERE id = result->>'id';
  RETURN result || jsonb_build_object('reversesEntryId', p_entry_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reverse_financial_entry(text, jsonb) TO anon, authenticated, service_role, public;
