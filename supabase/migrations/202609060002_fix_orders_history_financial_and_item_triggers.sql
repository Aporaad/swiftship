-- Migration: 202609060002_fix_orders_history_financial_and_item_triggers.sql
-- Fix orders_history triggers for main_entry (INSERT + UPDATE) and order_items (INSERT + UPDATE + DELETE)

BEGIN;

-- 1. Update orders_history_from_main_entry to support AFTER INSERT OR UPDATE on main_entry
-- and correctly resolve order_id / order_number
CREATE OR REPLACE FUNCTION public.orders_history_from_main_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
DECLARE
  v_order_id text;
  v_order_number text;
  v_actor record;
  v_line_count integer;
  v_event_type text;
  v_summary text;
  v_order record;
BEGIN
  -- Avoid redundant updates if posting_status did not change on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.posting_status IS NOT DISTINCT FROM NEW.posting_status THEN 
    RETURN NEW; 
  END IF;

  IF NEW.order_id IS NULL AND NEW.shipment_id IS NULL THEN 
    RETURN NEW; 
  END IF;

  v_order_id := NEW.order_id;
  IF v_order_id IS NULL AND NEW.shipment_id IS NOT NULL THEN 
    SELECT s.order_id INTO v_order_id FROM public.shipments s WHERE s.id = NEW.shipment_id; 
  END IF;

  -- Resolve order_id and order_number from public.orders
  IF v_order_id IS NOT NULL THEN
    SELECT id, order_number INTO v_order FROM public.orders WHERE id = v_order_id OR order_number = v_order_id LIMIT 1;
    IF FOUND THEN
      v_order_id := v_order.id;
      v_order_number := v_order.order_number;
    ELSE
      v_order_number := v_order_id;
    END IF;
  END IF;

  IF v_order_id IS NULL THEN 
    RETURN NEW; 
  END IF;

  SELECT * INTO v_actor FROM public.orders_history_actor(COALESCE(NEW.posted_by_uid, NEW.voided_by_uid, NEW.updated_by_uid, NEW.created_by_uid));
  SELECT COUNT(*) INTO v_line_count FROM public.account_trans WHERE entry_id = NEW.id;

  v_event_type := CASE 
    WHEN NEW.posting_status = 'posted' THEN 'financial.entry_posted' 
    WHEN NEW.posting_status = 'voided' THEN 'financial.entry_voided' 
    ELSE 'financial.entry_created' 
  END;

  v_summary := CASE 
    WHEN NEW.posting_status = 'posted' THEN 'قيد مالي تم ترحيله (' || COALESCE(NEW.description, NEW.entry_number) || ')'
    WHEN NEW.posting_status = 'voided' THEN 'قيد مالي تم إبطاله (' || COALESCE(NEW.description, NEW.entry_number) || ')'
    ELSE 'قيد مالي جديد مرتبط بالطلب (' || COALESCE(NEW.description, NEW.entry_number) || ')'
  END;

  INSERT INTO public.orders_history (
    id, order_id, order_number, shipment_id, event_type, event_category, operation, 
    entity_type, actor_id, actor_name, actor_role, source, summary, after_data, 
    metadata, main_entry_id, account_trans_count, occurred_at, created_at
  )
  VALUES (
    'oh_' || substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 24), 
    v_order_id, 
    v_order_number, 
    NEW.shipment_id, 
    v_event_type, 
    'financial', 
    lower(NEW.posting_status), 
    'main_entry', 
    v_actor.actor_id, 
    v_actor.actor_name, 
    v_actor.actor_role, 
    'financial_trigger', 
    v_summary, 
    jsonb_build_object(
      'entryNumber', NEW.entry_number, 
      'entryCategory', NEW.entry_category, 
      'postingStatus', NEW.posting_status, 
      'amountOriginal', NEW.amount_original, 
      'currencyOriginalNo', NEW.currency_original_no, 
      'paymentMethod', NEW.payment_method, 
      'description', NEW.description, 
      'effectiveAt', NEW.effective_at
    ), 
    jsonb_build_object(
      'mainEntryId', NEW.id, 
      'accountTransCount', v_line_count, 
      'orderId', NEW.order_id, 
      'shipmentId', NEW.shipment_id, 
      'trigger', TG_NAME
    ), 
    NEW.id, 
    v_line_count, 
    now(), 
    now()
  );

  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to fire on AFTER INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_orders_history_main_entry_financial ON public.main_entry;
CREATE TRIGGER trg_orders_history_main_entry_financial
  AFTER INSERT OR UPDATE ON public.main_entry
  FOR EACH ROW EXECUTE FUNCTION public.orders_history_from_main_entry();


-- 2. Create orders_history_from_order_items for order items changes audit
CREATE OR REPLACE FUNCTION public.orders_history_from_order_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
DECLARE
  v_order_id text;
  v_order_number text;
  v_actor record;
  v_event_type text;
  v_summary text;
  v_order record;
  v_item record;
BEGIN
  v_item := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF v_item.order_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT id, order_number INTO v_order FROM public.orders WHERE id = v_item.order_id OR order_number = v_item.order_id LIMIT 1;
  IF FOUND THEN
    v_order_id := v_order.id;
    v_order_number := v_order.order_number;
  ELSE
    v_order_id := v_item.order_id;
    v_order_number := v_item.order_id;
  END IF;

  SELECT * INTO v_actor FROM public.orders_history_actor(COALESCE(v_item.updated_by, v_item.created_by));

  IF TG_OP = 'INSERT' THEN
    v_event_type := 'order_item.created';
    v_summary := 'تم إدراج منتج في الطلب: ' || COALESCE(v_item.product_cooler, 'منتج');
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'order_item.deleted';
    v_summary := 'تم إزالة منتج من الطلب: ' || COALESCE(v_item.product_cooler, 'منتج');
  ELSE
    v_event_type := 'order_item.updated';
    v_summary := 'تم تعديل بيانات منتج في الطلب: ' || COALESCE(v_item.product_cooler, 'منتج');
  END IF;

  INSERT INTO public.orders_history (
    id, order_id, order_number, event_type, event_category, operation, 
    entity_type, actor_id, actor_name, source, summary, after_data, 
    metadata, occurred_at, created_at
  )
  VALUES (
    'oh_' || substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 24), 
    v_order_id, 
    v_order_number, 
    v_event_type, 
    'activity', 
    lower(TG_OP), 
    'order_items', 
    v_actor.actor_id, 
    v_actor.actor_name, 
    'item_trigger', 
    v_summary, 
    to_jsonb(v_item), 
    jsonb_build_object('itemsId', v_item.items_id, 'productId', v_item.product_id, 'trigger', TG_NAME), 
    now(), 
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_history_order_items ON public.order_items;
CREATE TRIGGER trg_orders_history_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.orders_history_from_order_items();

COMMIT;
