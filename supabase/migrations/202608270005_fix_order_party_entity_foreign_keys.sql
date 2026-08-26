-- Store each order party in its own constrained entity column.
-- customer_id remains reserved for customers; staff parties use employee_id or courier_id.

CREATE OR REPLACE FUNCTION public.validate_order_party()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  party_id text;
  party_type text;
  account_value text;
BEGIN
  party_type := COALESCE(NULLIF(NEW.order_party_type, ''), 'customer');
  party_id := CASE party_type
    WHEN 'employee' THEN COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.employee_id, ''))
    WHEN 'courier' THEN COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.courier_id, ''))
    ELSE COALESCE(NULLIF(NEW.order_party_id, ''), NULLIF(NEW.customer_id, ''))
  END;

  IF party_id IS NULL THEN RAISE EXCEPTION 'An order party is required.'; END IF;

  IF party_type = 'customer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id::text = party_id) THEN RAISE EXCEPTION 'Order customer party % does not exist.', party_id; END IF;
    NEW.customer_id := party_id; NEW.employee_id := NULL; NEW.courier_id := NULL;
    SELECT account_id INTO account_value FROM public.customers WHERE id::text = party_id;
  ELSIF party_type = 'employee' THEN
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id::text = party_id) THEN RAISE EXCEPTION 'Order employee party % does not exist.', party_id; END IF;
    NEW.customer_id := NULL; NEW.employee_id := party_id; NEW.courier_id := NULL;
    SELECT account_id INTO account_value FROM public.employees WHERE id::text = party_id;
  ELSIF party_type = 'courier' THEN
    IF NOT EXISTS (SELECT 1 FROM public.couriers WHERE id::text = party_id) THEN RAISE EXCEPTION 'Order courier party % does not exist.', party_id; END IF;
    NEW.customer_id := NULL; NEW.employee_id := NULL; NEW.courier_id := party_id;
    SELECT account_id INTO account_value FROM public.couriers WHERE id::text = party_id;
  ELSE
    RAISE EXCEPTION 'Unsupported order party type %.', party_type;
  END IF;

  IF account_value IS NULL THEN RAISE EXCEPTION 'The % order party % has no linked financial account.', party_type, party_id; END IF;
  NEW.order_party_id := party_id;
  NEW.order_party_type := party_type;
  NEW.is_staff_order := party_type <> 'customer';
  NEW.order_party_account_id := account_value;
  NEW.data := COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object(
    'orderPartyId', party_id, 'orderPartyType', party_type, 'isStaffOrder', party_type <> 'customer',
    'customerId', COALESCE(NEW.customer_id, ''), 'employeeId', COALESCE(NEW.employee_id, ''),
    'courierId', COALESCE(NEW.courier_id, ''), 'customerAccountId', account_value,
    'orderPartyAccountId', account_value
  );
  RETURN NEW;
END;
$$;
