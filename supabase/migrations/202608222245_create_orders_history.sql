-- سجل تدقيق تشغيلي ومالي دائم للطلبات والشحنات.
-- يحتفظ المعرّفات كنصوص من دون قيود خارجية كي تبقى السجلات مرئية حتى بعد حذف الكيان الأصلي.

CREATE TABLE IF NOT EXISTS public.orders_history (
  id text PRIMARY KEY,
  order_id text,
  order_number text,
  shipment_id text,
  journal_entry_id text,
  account_transaction_id text,
  activity_log_id text,
  event_type text NOT NULL,
  event_category text NOT NULL,
  operation text NOT NULL,
  entity_type text NOT NULL,
  actor_id text,
  actor_name text,
  actor_role text,
  source text NOT NULL DEFAULT 'database',
  summary text,
  before_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_history_order_occurred_idx
  ON public.orders_history (order_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS orders_history_shipment_occurred_idx
  ON public.orders_history (shipment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS orders_history_event_type_idx
  ON public.orders_history (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS orders_history_actor_idx
  ON public.orders_history (actor_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.orders_history_resolve_order(p_reference text)
RETURNS TABLE(order_id text, order_number text)
LANGUAGE sql
STABLE
AS $$
  SELECT o.id, o.order_number
  FROM public.orders o
  WHERE p_reference IS NOT NULL
    AND (o.id = p_reference OR o.order_number = p_reference)
  ORDER BY CASE WHEN o.id = p_reference THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.orders_history_changed_fields(p_before jsonb, p_after jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
  FROM (
    SELECT COALESCE(before_row.key, after_row.key) AS key
    FROM jsonb_each(COALESCE(p_before, '{}'::jsonb)) AS before_row
    FULL OUTER JOIN jsonb_each(COALESCE(p_after, '{}'::jsonb)) AS after_row
      ON before_row.key = after_row.key
    WHERE before_row.value IS DISTINCT FROM after_row.value
  ) AS changes;
$$;

CREATE OR REPLACE FUNCTION public.orders_history_actor(
  p_actor_id text DEFAULT NULL,
  p_actor_name text DEFAULT NULL,
  p_actor_role text DEFAULT NULL
)
RETURNS TABLE(actor_id text, actor_name text, actor_role text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  resolved_actor_id text := COALESCE(p_actor_id, auth.uid()::text);
  jwt_email text := auth.jwt() ->> 'email';
BEGIN
  RETURN QUERY
  SELECT
    resolved_actor_id,
    COALESCE(
      p_actor_name,
      NULLIF(u.username, ''),
      NULLIF(u.email, ''),
      jwt_email,
      'النظام'
    ),
    COALESCE(p_actor_role, NULLIF(u.role, ''), CASE WHEN resolved_actor_id IS NULL THEN 'system' ELSE NULL END)
  FROM (SELECT 1) AS seed
  LEFT JOIN public.users u ON u.id = resolved_actor_id
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_history_write(
  p_order_id text,
  p_order_number text,
  p_shipment_id text,
  p_journal_entry_id text,
  p_account_transaction_id text,
  p_activity_log_id text,
  p_event_type text,
  p_event_category text,
  p_operation text,
  p_entity_type text,
  p_source text,
  p_summary text,
  p_before_data jsonb DEFAULT '{}'::jsonb,
  p_after_data jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id text DEFAULT NULL,
  p_actor_name text DEFAULT NULL,
  p_actor_role text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  actor_record record;
BEGIN
  SELECT * INTO actor_record
  FROM public.orders_history_actor(p_actor_id, p_actor_name, p_actor_role);

  INSERT INTO public.orders_history (
    id, order_id, order_number, shipment_id, journal_entry_id, account_transaction_id,
    activity_log_id, event_type, event_category, operation, entity_type,
    actor_id, actor_name, actor_role, source, summary,
    before_data, after_data, metadata, occurred_at, created_at
  ) VALUES (
    'oh_' || substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 24),
    p_order_id, p_order_number, p_shipment_id, p_journal_entry_id, p_account_transaction_id,
    p_activity_log_id, p_event_type, p_event_category, p_operation, p_entity_type,
    actor_record.actor_id, actor_record.actor_name, actor_record.actor_role, COALESCE(p_source, 'database'), p_summary,
    COALESCE(p_before_data, '{}'::jsonb), COALESCE(p_after_data, '{}'::jsonb), COALESCE(p_metadata, '{}'::jsonb), now(), now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_history_from_orders()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  changed_fields text[] := public.orders_history_changed_fields(before_row, after_row);
  event_name text;
  event_summary text;
  order_ref text;
BEGIN
  order_ref := COALESCE(NEW.id, OLD.id);

  IF TG_OP = 'INSERT' THEN
    event_name := 'order.created';
    event_summary := 'تم إنشاء الطلب';
  ELSIF TG_OP = 'DELETE' THEN
    event_name := 'order.deleted';
    event_summary := 'تم حذف الطلب';
  ELSIF OLD.order_status IS DISTINCT FROM NEW.order_status OR OLD.order_status_id IS DISTINCT FROM NEW.order_status_id THEN
    event_name := 'order.status_changed';
    event_summary := 'تم تحديث حالة الطلب';
  ELSE
    event_name := 'order.updated';
    event_summary := 'تم تعديل بيانات الطلب';
  END IF;

  PERFORM public.orders_history_write(
    order_ref,
    COALESCE(NEW.order_number, OLD.order_number),
    NULL, NULL, NULL, NULL,
    event_name, 'order', lower(TG_OP), 'order', 'database_trigger', event_summary,
    before_row, after_row,
    jsonb_build_object('changedFields', changed_fields, 'trigger', TG_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS orders_history_orders_audit ON public.orders;
CREATE TRIGGER orders_history_orders_audit
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_history_from_orders();

CREATE OR REPLACE FUNCTION public.orders_history_from_shipments()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  changed_fields text[] := public.orders_history_changed_fields(before_row, after_row);
  resolved_order record;
  order_ref text := COALESCE(NEW.order_id, OLD.order_id);
  shipment_ref text := COALESCE(NEW.id, OLD.id);
  event_name text;
  event_summary text;
BEGIN
  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);

  IF TG_OP = 'INSERT' THEN
    event_name := 'shipment.created';
    event_summary := 'تم إنشاء شحنة مرتبطة بالطلب';
  ELSIF TG_OP = 'DELETE' THEN
    event_name := 'shipment.deleted';
    event_summary := 'تم حذف الشحنة';
  ELSIF OLD.shipment_status IS DISTINCT FROM NEW.shipment_status THEN
    event_name := 'shipment.status_changed';
    event_summary := 'تم تحديث حالة الشحنة';
  ELSE
    event_name := 'shipment.updated';
    event_summary := 'تم تعديل بيانات الشحنة';
  END IF;

  PERFORM public.orders_history_write(
    resolved_order.order_id,
    resolved_order.order_number,
    shipment_ref, NULL, NULL, NULL,
    event_name, 'shipment', lower(TG_OP), 'shipment', 'database_trigger', event_summary,
    before_row, after_row,
    jsonb_build_object('changedFields', changed_fields, 'orderReference', order_ref, 'trigger', TG_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS orders_history_shipments_audit ON public.shipments;
CREATE TRIGGER orders_history_shipments_audit
AFTER INSERT OR UPDATE OR DELETE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.orders_history_from_shipments();

CREATE OR REPLACE FUNCTION public.orders_history_from_journal_entries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  journal_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  order_ref text := COALESCE(journal_row->'data'->>'orderId', journal_row->'data'->>'order_id', journal_row->'data'->>'orderNumber', journal_row->'data'->>'refNumber');
  resolved_order record;
BEGIN
  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);
  IF resolved_order.order_id IS NOT NULL THEN
    PERFORM public.orders_history_write(
      resolved_order.order_id, resolved_order.order_number, NULL, COALESCE(NEW.id, OLD.id), NULL, NULL,
      'financial.journal_' || lower(TG_OP), 'financial', lower(TG_OP), 'journal_entry', 'database_trigger',
      CASE WHEN TG_OP = 'INSERT' THEN 'تم إنشاء قيد مالي مرتبط بالطلب' WHEN TG_OP = 'UPDATE' THEN 'تم تعديل قيد مالي مرتبط بالطلب' ELSE 'تم حذف قيد مالي مرتبط بالطلب' END,
      CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
      CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END,
      jsonb_build_object('orderReference', order_ref, 'trigger', TG_NAME)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS orders_history_journal_entries_audit ON public.journal_entries;
CREATE TRIGGER orders_history_journal_entries_audit
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.orders_history_from_journal_entries();

CREATE OR REPLACE FUNCTION public.orders_history_from_activity_logs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  activity_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  order_ref text := COALESCE(activity_row->'data'->>'orderId', activity_row->'data'->>'order_id', activity_row->'data'->>'orderNumber', activity_row->>'target');
  resolved_order record;
BEGIN
  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);
  IF resolved_order.order_id IS NOT NULL THEN
    PERFORM public.orders_history_write(
      resolved_order.order_id, resolved_order.order_number, NULL, NULL, NULL, COALESCE(NEW.id, OLD.id),
      'activity.' || COALESCE(activity_row->>'action', lower(TG_OP)), 'activity', lower(TG_OP), 'activity_log', 'activity_log',
      COALESCE(activity_row->>'action', 'تم تسجيل نشاط مرتبط بالطلب'),
      CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
      CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END,
      jsonb_build_object('target', activity_row->>'target', 'details', activity_row->'data', 'trigger', TG_NAME),
      activity_row->>'userId', NULL, NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS orders_history_activity_logs_audit ON public.activity_logs;
CREATE TRIGGER orders_history_activity_logs_audit
AFTER INSERT OR UPDATE OR DELETE ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION public.orders_history_from_activity_logs();
