-- A polymorphic order party with referential integrity.
-- `customer_id` remains the stable legacy/UI identifier. For staff orders it equals
-- the selected users.id or couriers.id, while the type-specific FK column carries
-- the database relationship that a single cross-table FK cannot represent.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_party_id text,
  ADD COLUMN IF NOT EXISTS order_party_type text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS is_staff_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS courier_id text,
  ADD COLUMN IF NOT EXISTS order_party_account_id text;

-- The application manages staff profiles in users and financial employee rows
-- in employees. Seed the latter for existing non-courier users before the FK.
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

-- Existing orders are customer orders unless a later explicit staff migration changes them.
UPDATE public.orders
SET order_party_id = COALESCE(order_party_id, customer_id),
    order_party_type = COALESCE(NULLIF(order_party_type, ''), 'customer'),
    is_staff_order = COALESCE(is_staff_order, false)
WHERE order_party_id IS NULL OR order_party_type IS NULL OR is_staff_order IS NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_party_type_check,
  ADD CONSTRAINT orders_order_party_type_check
    CHECK (order_party_type IN ('customer', 'employee', 'courier'));

-- A legacy customer_id FK cannot model employee/courier IDs. The trigger below
-- enforces the conditional relationship and the specific columns retain real FKs.
DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%(customer_id)%REFERENCES public.customers%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', constraint_name);
  END IF;
END;
$$;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_employee_id_fkey,
  ADD CONSTRAINT orders_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.employees(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS orders_courier_id_fkey,
  ADD CONSTRAINT orders_courier_id_fkey
    FOREIGN KEY (courier_id) REFERENCES public.couriers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS orders_order_party_account_id_fkey,
  ADD CONSTRAINT orders_order_party_account_id_fkey
    FOREIGN KEY (order_party_account_id) REFERENCES public.accounts(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.validate_order_party()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  party_id text;
  party_type text;
  account_id_value text;
BEGIN
  party_type := COALESCE(NULLIF(NEW.order_party_type, ''), 'customer');
  party_id := COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.customer_id, ''));
  IF party_id IS NULL THEN
    RAISE EXCEPTION 'An order party is required.';
  END IF;

  IF party_type = 'customer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id::text = party_id) THEN
      RAISE EXCEPTION 'Order customer party % does not exist.', party_id;
    END IF;
    NEW.employee_id := NULL;
    NEW.courier_id := NULL;
  ELSIF party_type = 'employee' THEN
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id::text = party_id) THEN
      RAISE EXCEPTION 'Order employee party % does not exist.', party_id;
    END IF;
    NEW.employee_id := party_id;
    NEW.courier_id := NULL;
  ELSIF party_type = 'courier' THEN
    IF NOT EXISTS (SELECT 1 FROM public.couriers WHERE id::text = party_id) THEN
      RAISE EXCEPTION 'Order courier party % does not exist.', party_id;
    END IF;
    NEW.employee_id := NULL;
    NEW.courier_id := party_id;
  ELSE
    RAISE EXCEPTION 'Unsupported order party type %.', party_type;
  END IF;

  IF party_type = 'customer' THEN
    SELECT account_id INTO account_id_value FROM public.customers WHERE id::text = party_id;
  ELSIF party_type = 'employee' THEN
    SELECT account_id INTO account_id_value FROM public.employees WHERE id::text = party_id;
  ELSE
    SELECT account_id INTO account_id_value FROM public.couriers WHERE id::text = party_id;
  END IF;

  IF account_id_value IS NULL THEN
    SELECT id INTO account_id_value
    FROM public.accounts
    WHERE entity_id = party_id
      AND COALESCE(data->>'entityType', '') = party_type
    LIMIT 1;
  END IF;

  IF account_id_value IS NULL THEN
    RAISE EXCEPTION 'The % order party % has no linked financial account.', party_type, party_id;
  END IF;

  NEW.customer_id := party_id;
  NEW.order_party_id := party_id;
  NEW.order_party_type := party_type;
  NEW.is_staff_order := party_type <> 'customer';
  NEW.order_party_account_id := account_id_value;
  NEW.data := jsonb_set(
    jsonb_set(
      jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{orderPartyId}', to_jsonb(party_id), true),
      '{orderPartyType}', to_jsonb(party_type), true
    ),
    '{customerAccountId}', to_jsonb(account_id_value), true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_validate_order_party_trigger ON public.orders;
CREATE TRIGGER orders_validate_order_party_trigger
BEFORE INSERT OR UPDATE OF customer_id, order_party_id, order_party_type, employee_id, courier_id
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_party();

CREATE INDEX IF NOT EXISTS orders_order_party_type_id_idx
  ON public.orders(order_party_type, order_party_id);
CREATE INDEX IF NOT EXISTS orders_employee_id_idx ON public.orders(employee_id);
CREATE INDEX IF NOT EXISTS orders_courier_id_idx ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS orders_order_party_account_id_idx ON public.orders(order_party_account_id);
