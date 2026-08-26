ALTER TABLE public.auto_entries
  ADD COLUMN IF NOT EXISTS amount_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS amount_strategy text NOT NULL DEFAULT 'sum',
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS skip_when_zero boolean NOT NULL DEFAULT true;

UPDATE public.auto_entries
SET amount_sources = jsonb_build_array(amount_source)
WHERE jsonb_array_length(amount_sources) = 0
  AND amount_source IS NOT NULL
  AND btrim(amount_source) <> '';

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS shipment_id text,
  ADD COLUMN IF NOT EXISTS automation_key text,
  ADD COLUMN IF NOT EXISTS auto_rule_id text,
  ADD COLUMN IF NOT EXISTS status_id integer,
  ADD COLUMN IF NOT EXISTS is_automatic boolean NOT NULL DEFAULT false;

ALTER TABLE public.account_transactions
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS shipment_id text,
  ADD COLUMN IF NOT EXISTS automation_key text,
  ADD COLUMN IF NOT EXISTS auto_rule_id text;

ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_order_id_fkey,
  ADD CONSTRAINT journal_entries_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.account_transactions
  DROP CONSTRAINT IF EXISTS account_transactions_order_id_fkey,
  ADD CONSTRAINT account_transactions_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_automation_key_unique_idx
  ON public.journal_entries (automation_key)
  WHERE automation_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS journal_entries_order_automation_idx
  ON public.journal_entries (order_id, auto_rule_id, status_id);

CREATE INDEX IF NOT EXISTS account_transactions_order_automation_idx
  ON public.account_transactions (order_id, auto_rule_id, "createdAt" DESC);

CREATE OR REPLACE FUNCTION public.orders_history_from_journal_entries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
DECLARE
  journal_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  order_ref text := COALESCE(
    journal_row->>'order_id',
    journal_row->'data'->>'orderId',
    journal_row->'data'->>'order_id',
    journal_row->>'order_number',
    journal_row->'data'->>'orderNumber',
    journal_row->'data'->>'refNumber'
  );
  automation_key text := COALESCE(journal_row->>'automation_key', journal_row->'data'->>'automationKey');
  rule_id text := COALESCE(journal_row->>'auto_rule_id', journal_row->'data'->>'autoRuleId');
  stage_id text := COALESCE(journal_row->>'status_id', journal_row->'data'->>'statusId');
  resolved_order record;
  event_name text;
  event_summary text;
BEGIN
  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);
  IF resolved_order.order_id IS NOT NULL THEN
    event_name := CASE WHEN automation_key IS NOT NULL THEN 'financial.automatic_voucher' ELSE 'financial.journal_' || lower(TG_OP) END;
    event_summary := CASE
      WHEN automation_key IS NOT NULL THEN 'تم تنفيذ قيد طلب تلقائي'
      WHEN TG_OP = 'INSERT' THEN 'تم إنشاء قيد مالي مرتبط بالطلب'
      WHEN TG_OP = 'UPDATE' THEN 'تم تعديل قيد مالي مرتبط بالطلب'
      ELSE 'تم حذف قيد مالي مرتبط بالطلب'
    END;

    PERFORM public.orders_history_write(
      resolved_order.order_id, resolved_order.order_number, NULL, COALESCE(NEW.id, OLD.id), NULL, NULL,
      event_name, 'financial', lower(TG_OP), 'journal_entry', 'database_trigger', event_summary,
      CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
      CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END,
      jsonb_build_object(
        'orderReference', order_ref,
        'automationKey', automation_key,
        'autoRuleId', rule_id,
        'statusId', stage_id,
        'isAutomatic', automation_key IS NOT NULL,
        'trigger', TG_NAME
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_history_automatic_voucher_key_unique_idx
  ON public.orders_history (order_id, (metadata ->> 'automationKey'))
  WHERE metadata ? 'automationKey'
    AND COALESCE(metadata ->> 'automationKey', '') <> '';
