-- Reconcile the first order-party rollout with the actual financial employee
-- ledger table and guarantee that every selectable staff party has an account.

INSERT INTO public.employees (id, data)
SELECT u.id, jsonb_build_object(
  'id', u.id,
  'fullName', COALESCE(u.data->>'fullName', u.data->>'username', u.email, u.id),
  'email', u.email,
  'role', u.role,
  'userId', u.id,
  'disabled', COALESCE((u.data->>'disabled')::boolean, false)
)
FROM public.users u
WHERE COALESCE(u.role, u.data->>'role', '') NOT IN ('Courier', 'courier')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  row_record record;
  account_value text;
BEGIN
  FOR row_record IN
    SELECT id::text AS id,
      COALESCE(data->>'fullName', data->>'username', data->>'email', id::text) AS entity_name,
      COALESCE(NULLIF(data->>'currency', ''), currency, 'YER') AS currency
    FROM public.employees
    WHERE NULLIF(trim(COALESCE(account_id, '')), '') IS NULL
  LOOP
    account_value := public.ensure_entity_financial_account(
      row_record.id, 'employee', row_record.entity_name, row_record.currency,
      '2130', 'Liability', 'حساب ذمم موظف أو طرف طلب داخلي'
    );
    UPDATE public.employees
    SET account_id = account_value,
        data = jsonb_set(
          jsonb_set(COALESCE(data, '{}'::jsonb), '{financialAccountId}', to_jsonb(account_value), true),
          '{financialAccountCode}', to_jsonb((SELECT account_code FROM public.accounts WHERE id = account_value)), true
        )
    WHERE id::text = row_record.id;
  END LOOP;

  FOR row_record IN
    SELECT id::text AS id,
      COALESCE(data->>'fullName', data->>'name', data->>'email', id::text) AS entity_name,
      COALESCE(NULLIF(data->>'financialCurrency', ''), NULLIF(data->>'currency', ''), currency, 'YER') AS currency
    FROM public.couriers
    WHERE NULLIF(trim(COALESCE(account_id, '')), '') IS NULL
  LOOP
    account_value := public.ensure_entity_financial_account(
      row_record.id, 'courier', row_record.entity_name, row_record.currency,
      '2120', 'Liability', 'حساب ذمم مندوب أو طرف طلب'
    );
    UPDATE public.couriers
    SET account_id = account_value,
        data = jsonb_set(
          jsonb_set(COALESCE(data, '{}'::jsonb), '{financialAccountId}', to_jsonb(account_value), true),
          '{financialAccountCode}', to_jsonb((SELECT account_code FROM public.accounts WHERE id = account_value)), true
        )
    WHERE id::text = row_record.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_employee_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_value text; account_code_value text; entity_name text; entity_currency text;
BEGIN
  entity_name := COALESCE(NEW.data->>'fullName', NEW.data->>'username', NEW.data->>'email', NEW.id::text);
  entity_currency := COALESCE(NULLIF(NEW.data->>'currency', ''), NEW.currency, 'YER');
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN
    account_value := public.ensure_entity_financial_account(NEW.id::text, 'employee', entity_name, entity_currency, '2130', 'Liability', 'حساب ذمم موظف أو طرف طلب داخلي');
  END IF;
  SELECT account_code INTO account_code_value FROM public.accounts WHERE id = account_value;
  NEW.account_id := account_value;
  NEW.data := jsonb_set(jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{financialAccountId}', to_jsonb(account_value), true), '{financialAccountCode}', to_jsonb(account_code_value), true);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_courier_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_value text; account_code_value text; entity_name text; entity_currency text;
BEGIN
  entity_name := COALESCE(NEW.data->>'fullName', NEW.data->>'name', NEW.data->>'email', NEW.id::text);
  entity_currency := COALESCE(NULLIF(NEW.data->>'financialCurrency', ''), NULLIF(NEW.data->>'currency', ''), NEW.currency, 'YER');
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN
    account_value := public.ensure_entity_financial_account(NEW.id::text, 'courier', entity_name, entity_currency, '2120', 'Liability', 'حساب ذمم مندوب أو طرف طلب');
  END IF;
  SELECT account_code INTO account_code_value FROM public.accounts WHERE id = account_value;
  NEW.account_id := account_value;
  NEW.data := jsonb_set(jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{financialAccountId}', to_jsonb(account_value), true), '{financialAccountCode}', to_jsonb(account_code_value), true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_link_financial_account_trigger ON public.employees;
CREATE TRIGGER employees_link_financial_account_trigger
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.link_employee_financial_account();

DROP TRIGGER IF EXISTS couriers_link_financial_account_trigger ON public.couriers;
CREATE TRIGGER couriers_link_financial_account_trigger
BEFORE INSERT OR UPDATE ON public.couriers
FOR EACH ROW EXECUTE FUNCTION public.link_courier_financial_account();

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_employee_id_fkey,
  ADD CONSTRAINT orders_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.employees(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.validate_order_party()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE party_id text; party_type text; account_value text;
BEGIN
  party_type := COALESCE(NULLIF(NEW.order_party_type, ''), 'customer');
  party_id := COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.customer_id, ''));
  IF party_id IS NULL THEN RAISE EXCEPTION 'An order party is required.'; END IF;

  IF party_type = 'customer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id::text = party_id) THEN RAISE EXCEPTION 'Order customer party % does not exist.', party_id; END IF;
    NEW.employee_id := NULL; NEW.courier_id := NULL;
    SELECT account_id INTO account_value FROM public.customers WHERE id::text = party_id;
  ELSIF party_type = 'employee' THEN
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id::text = party_id) THEN RAISE EXCEPTION 'Order employee party % does not exist.', party_id; END IF;
    NEW.employee_id := party_id; NEW.courier_id := NULL;
    SELECT account_id INTO account_value FROM public.employees WHERE id::text = party_id;
  ELSIF party_type = 'courier' THEN
    IF NOT EXISTS (SELECT 1 FROM public.couriers WHERE id::text = party_id) THEN RAISE EXCEPTION 'Order courier party % does not exist.', party_id; END IF;
    NEW.employee_id := NULL; NEW.courier_id := party_id;
    SELECT account_id INTO account_value FROM public.couriers WHERE id::text = party_id;
  ELSE
    RAISE EXCEPTION 'Unsupported order party type %.', party_type;
  END IF;

  IF account_value IS NULL THEN RAISE EXCEPTION 'The % order party % has no linked financial account.', party_type, party_id; END IF;
  NEW.customer_id := party_id; NEW.order_party_id := party_id; NEW.order_party_type := party_type;
  NEW.is_staff_order := party_type <> 'customer'; NEW.order_party_account_id := account_value;
  NEW.data := jsonb_set(jsonb_set(jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{orderPartyId}', to_jsonb(party_id), true), '{orderPartyType}', to_jsonb(party_type), true), '{customerAccountId}', to_jsonb(account_value), true);
  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS employees_account_id_idx ON public.employees(account_id);
CREATE INDEX IF NOT EXISTS couriers_account_id_idx ON public.couriers(account_id);
