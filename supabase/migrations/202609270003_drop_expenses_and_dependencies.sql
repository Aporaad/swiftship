-- Migration 202609270003
-- Approved destructive scope: remove public.expenses and its direct view/function dependencies.
-- Do not alter or delete main_entry, account_trans, custody_advances, or their constraints.

BEGIN;

-- The historical local migration referred to this view, but the live database
-- currently has no such view. Keep this idempotent and narrowly scoped.
DROP VIEW IF EXISTS public.expenes_view;

-- Preserve order deletion behavior while removing its obsolete expenses branch.
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
  deleted_order_items integer := 0;
  deleted_main_entries integer := 0;
  deleted_account_trans integer := 0;
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
  WHERE order_id = ANY(target_ids);

  IF actual_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected orders no longer exist; no deletion was performed.';
  END IF;

  SELECT COALESCE(array_agg(shipment_id::text), ARRAY[]::text[]) INTO shipment_ids
  FROM public.shipments WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(main_entry_id::text), ARRAY[]::text[]) INTO main_entry_ids
  FROM public.main_entry WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(account_trans_id::text), ARRAY[]::text[]),
         COALESCE(array_agg(DISTINCT account_id::text), ARRAY[]::text[])
    INTO account_trans_ids, affected_accounts
  FROM public.account_trans
  WHERE order_id = ANY(target_ids)
     OR shipment_id = ANY(shipment_ids)
     OR main_entry_id = ANY(main_entry_ids);

  DELETE FROM public.notifications
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

  DELETE FROM public.whatsapp_logs
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_whatsapp_logs = ROW_COUNT;

  IF cardinality(main_entry_ids) > 0 THEN
    DELETE FROM public.entry_payment_details WHERE main_entry_id = ANY(main_entry_ids);
  END IF;

  DELETE FROM public.account_trans
  WHERE account_trans_id = ANY(account_trans_ids)
     OR main_entry_id = ANY(main_entry_ids)
     OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_account_trans = ROW_COUNT;

  DELETE FROM public.main_entry
  WHERE main_entry_id = ANY(main_entry_ids)
     OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_main_entries = ROW_COUNT;

  DELETE FROM public.shipments WHERE shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_shipments = ROW_COUNT;

  DELETE FROM public.order_items WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_order_items = ROW_COUNT;

  DELETE FROM public.orders_history
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_orders_history = ROW_COUNT;

  PERFORM set_config('swiftship.suppress_order_delete_history', 'on', true);
  DELETE FROM public.orders WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_orders = ROW_COUNT;
  PERFORM set_config('swiftship.suppress_order_delete_history', 'off', true);

  IF affected_accounts IS NOT NULL AND cardinality(affected_accounts) > 0 THEN
    PERFORM public.recalculate_accounting_hierarchy(affected_accounts);
  END IF;

  RETURN jsonb_build_object(
    'orderIds', target_ids,
    'orders', deleted_orders,
    'shipments', deleted_shipments,
    'products', deleted_order_items,
    'mainEntries', deleted_main_entries,
    'accountTrans', deleted_account_trans,
    'notifications', deleted_notifications,
    'whatsappLogs', deleted_whatsapp_logs,
    'ordersHistory', deleted_orders_history,
    'activityLogsDeleted', 0
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_orders_with_dependents(p_order_ids text[], p_deleted_by_uid text DEFAULT NULL)
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
  deleted_order_items integer := 0;
  deleted_main_entries integer := 0;
  deleted_account_trans integer := 0;
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
  FROM public.orders WHERE order_id = ANY(target_ids);

  IF actual_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected orders no longer exist; no deletion was performed.';
  END IF;

  SELECT COALESCE(array_agg(shipment_id::text), ARRAY[]::text[]) INTO shipment_ids
  FROM public.shipments WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(main_entry_id::text), ARRAY[]::text[]) INTO main_entry_ids
  FROM public.main_entry WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(account_trans_id::text), ARRAY[]::text[]),
         COALESCE(array_agg(DISTINCT account_id::text), ARRAY[]::text[])
    INTO account_trans_ids, affected_accounts
  FROM public.account_trans
  WHERE order_id = ANY(target_ids)
     OR shipment_id = ANY(shipment_ids)
     OR entry_id = ANY(main_entry_ids);

  DELETE FROM public.notifications
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

  DELETE FROM public.whatsapp_logs
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_whatsapp_logs = ROW_COUNT;

  IF cardinality(main_entry_ids) > 0 THEN
    DELETE FROM public.entry_payment_details WHERE entry_id = ANY(main_entry_ids);
  END IF;

  DELETE FROM public.account_trans
  WHERE account_trans_id = ANY(account_trans_ids)
     OR entry_id = ANY(main_entry_ids)
     OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_account_trans = ROW_COUNT;

  DELETE FROM public.main_entry
  WHERE main_entry_id = ANY(main_entry_ids)
     OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_main_entries = ROW_COUNT;

  DELETE FROM public.shipments WHERE shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_shipments = ROW_COUNT;

  DELETE FROM public.order_items WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_order_items = ROW_COUNT;

  DELETE FROM public.orders_history
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_orders_history = ROW_COUNT;

  PERFORM set_config('swiftship.suppress_order_delete_history', 'on', true);
  DELETE FROM public.orders WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_orders = ROW_COUNT;
  PERFORM set_config('swiftship.suppress_order_delete_history', 'off', true);

  IF affected_accounts IS NOT NULL AND cardinality(affected_accounts) > 0 THEN
    PERFORM public.recalculate_accounting_hierarchy(affected_accounts);
  END IF;

  RETURN jsonb_build_object(
    'orderIds', target_ids,
    'orders', deleted_orders,
    'shipments', deleted_shipments,
    'products', deleted_order_items,
    'mainEntries', deleted_main_entries,
    'accountTrans', deleted_account_trans,
    'notifications', deleted_notifications,
    'whatsappLogs', deleted_whatsapp_logs,
    'ordersHistory', deleted_orders_history,
    'activityLogsDeleted', 0
  );
END;
$function$;

-- RESTRICT is intentional: no unrelated dependent object may be removed.
DROP TABLE public.expenses;

COMMIT;
