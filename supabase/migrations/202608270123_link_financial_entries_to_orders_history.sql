-- يسجل حدثًا ماليًا واحدًا للقيود المرتبطة بالطلب ويحفظ مرجع main_entry صراحة.
-- لا يغيّر RLS ولا يحذف سجل نشاط أو قيدًا تاريخيًا.
BEGIN;

ALTER TABLE public.orders_history
  ADD COLUMN IF NOT EXISTS main_entry_id text REFERENCES public.main_entry(id) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_trans_count integer NOT NULL DEFAULT 0 CHECK (account_trans_count >= 0);
CREATE INDEX IF NOT EXISTS orders_history_main_entry_idx ON public.orders_history(main_entry_id, occurred_at DESC) WHERE main_entry_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.orders_history_from_orders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  changed_fields text[] := public.orders_history_changed_fields(before_row, after_row);
  event_name text;
  event_summary text;
  order_ref text;
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('swiftship.suppress_order_update_history', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(array_length(changed_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;
  order_ref := COALESCE(NEW.id, OLD.id);
  IF TG_OP = 'INSERT' THEN event_name := 'order.created'; event_summary := 'تم إنشاء الطلب';
  ELSIF TG_OP = 'DELETE' THEN event_name := 'order.deleted'; event_summary := 'تم حذف الطلب';
  ELSIF OLD.order_status IS DISTINCT FROM NEW.order_status OR OLD.order_status_id IS DISTINCT FROM NEW.order_status_id THEN event_name := 'order.status_changed'; event_summary := 'تم تحديث حالة الطلب';
  ELSE event_name := 'order.updated'; event_summary := 'تم تعديل بيانات الطلب';
  END IF;
  PERFORM public.orders_history_write(order_ref, COALESCE(NEW.order_number, OLD.order_number), NULL, NULL, NULL, NULL, event_name, 'order', lower(TG_OP), 'order', 'database_trigger', event_summary, before_row, after_row, jsonb_build_object('changedFields', changed_fields, 'changes', public.orders_history_change_details(before_row, after_row), 'trigger', TG_NAME));
  RETURN COALESCE(NEW, OLD);
END;
$$;

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
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.posting_status IS NOT DISTINCT FROM NEW.posting_status THEN RETURN NEW; END IF;
  IF NEW.order_id IS NULL AND NEW.shipment_id IS NULL THEN RETURN NEW; END IF;
  v_order_id := NEW.order_id;
  IF v_order_id IS NULL AND NEW.shipment_id IS NOT NULL THEN SELECT s.order_id INTO v_order_id FROM public.shipments s WHERE s.id = NEW.shipment_id; END IF;
  SELECT o.order_number INTO v_order_number FROM public.orders o WHERE o.id = v_order_id;
  IF v_order_id IS NULL OR v_order_number IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_actor FROM public.orders_history_actor(COALESCE(NEW.posted_by_uid, NEW.voided_by_uid, NEW.updated_by_uid, NEW.created_by_uid));
  SELECT COUNT(*) INTO v_line_count FROM public.account_trans WHERE entry_id = NEW.id;
  v_event_type := CASE WHEN NEW.posting_status = 'posted' THEN 'financial.entry_posted' WHEN NEW.posting_status = 'voided' THEN 'financial.entry_voided' ELSE 'financial.entry_status_changed' END;
  v_summary := CASE WHEN NEW.posting_status = 'posted' THEN 'تم ترحيل قيد مالي مرتبط بالطلب' WHEN NEW.posting_status = 'voided' THEN 'تم إبطال قيد مالي مرتبط بالطلب' ELSE 'تم تغيير حالة قيد مالي مرتبط بالطلب' END;
  INSERT INTO public.orders_history (id, order_id, order_number, shipment_id, event_type, event_category, operation, entity_type, actor_id, actor_name, actor_role, source, summary, after_data, metadata, main_entry_id, account_trans_count, occurred_at, created_at)
  VALUES ('oh_' || substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 24), v_order_id, v_order_number, NEW.shipment_id, v_event_type, 'financial', lower(NEW.posting_status), 'main_entry', v_actor.actor_id, v_actor.actor_name, v_actor.actor_role, 'financial_trigger', v_summary, jsonb_build_object('entryNumber', NEW.entry_number, 'entryCategory', NEW.entry_category, 'postingStatus', NEW.posting_status, 'amountOriginal', NEW.amount_original, 'currencyOriginalNo', NEW.currency_original_no, 'paymentMethod', NEW.payment_method, 'description', NEW.description, 'effectiveAt', NEW.effective_at), jsonb_build_object('mainEntryId', NEW.id, 'accountTransCount', v_line_count, 'orderId', NEW.order_id, 'shipmentId', NEW.shipment_id, 'trigger', TG_NAME), NEW.id, v_line_count, now(), now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_history_main_entry_financial ON public.main_entry;
CREATE TRIGGER trg_orders_history_main_entry_financial
  AFTER UPDATE OF posting_status ON public.main_entry
  FOR EACH ROW EXECUTE FUNCTION public.orders_history_from_main_entry();

CREATE OR REPLACE FUNCTION public.secure_record_order_payment(p_order_id text, p_payment_amount numeric, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor_id text; v_payload jsonb; v_result jsonb;
BEGIN
  v_actor_id := public.require_financial_permission('create_receipt_vouchers');
  v_payload := jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{createdByUid}', to_jsonb(v_actor_id), true);
  PERFORM set_config('swiftship.suppress_order_update_history', 'on', true);
  v_result := public.record_order_payment_v2(p_order_id, p_payment_amount, v_payload, v_actor_id);
  PERFORM public.replace_financial_entry_payment_details(v_result->>'entryId', v_payload->'paymentDetails', v_actor_id);
  RETURN v_result;
END;
$$;

COMMIT;
