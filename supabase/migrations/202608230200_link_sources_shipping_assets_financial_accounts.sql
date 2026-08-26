-- Financial sub-ledgers for order sources, shipping companies and assets.
-- This migration is idempotent and preserves the current chart-of-accounts model.

ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS account_id text;

ALTER TABLE public.shipping_companies
  ADD COLUMN IF NOT EXISTS account_id text;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS account_id text,
  ADD COLUMN IF NOT EXISTS account_code text;

CREATE OR REPLACE FUNCTION public.ensure_entity_financial_account(
  p_entity_id text,
  p_entity_type text,
  p_entity_name text,
  p_currency text,
  p_prefix text,
  p_account_type text,
  p_notes text
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id text;
  v_account_code text;
  v_account_number text;
  v_sequence integer;
BEGIN
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE entity_id = p_entity_id
    AND COALESCE(data->>'entityType', '') = p_entity_type
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  -- Serialize code allocation per accounting section so concurrent inserts cannot reuse a number.
  PERFORM pg_advisory_xact_lock(hashtext('swiftship_accounts_' || p_prefix));

  SELECT COALESCE(MAX((regexp_match(account_code, ('^' || p_prefix || '-([0-9]+)$')))[1]::integer), 0) + 1
  INTO v_sequence
  FROM public.accounts
  WHERE account_code LIKE p_prefix || '-%';

  LOOP
    v_account_number := lpad(v_sequence::text, 4, '0');
    v_account_code := p_prefix || '-' || v_account_number;
    v_account_id := 'acc_' || v_account_code;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = v_account_id OR account_code = v_account_code
    );
    v_sequence := v_sequence + 1;
  END LOOP;

  INSERT INTO public.accounts (id, account_code, currency, entity_id, type, data)
  VALUES (
    v_account_id,
    v_account_code,
    COALESCE(NULLIF(p_currency, ''), 'YER'),
    p_entity_id,
    p_account_type,
    jsonb_build_object(
      'id', v_account_id,
      'accountCode', v_account_code,
      'code', v_account_code,
      'accountPrefix', p_prefix,
      'parentCode', p_prefix,
      'accountNumber', v_account_number,
      'entityType', p_entity_type,
      'entityId', p_entity_id,
      'entityName', p_entity_name,
      'currency', COALESCE(NULLIF(p_currency, ''), 'YER'),
      'type', p_account_type,
      'balance', 0,
      'debitTotal', 0,
      'creditTotal', 0,
      'isActive', true,
      'notes', COALESCE(p_notes, ''),
      'createdAt', (extract(epoch FROM now()) * 1000)::bigint,
      'updatedAt', (extract(epoch FROM now()) * 1000)::bigint
    )
  );

  RETURN v_account_id;
END;
$$;

DO $$
DECLARE
  row_record record;
  generated_account_id text;
BEGIN
  -- 2140: Order sources and suppliers payables.
  FOR row_record IN
    SELECT id::text AS id, COALESCE(name, data->>'source_name', data->>'name', id::text) AS entity_name,
      COALESCE(NULLIF(data->>'financialCurrency', ''), NULLIF(data->>'currency', ''), 'YER') AS currency
    FROM public.sources
    WHERE NULLIF(trim(COALESCE(account_id, '')), '') IS NULL
  LOOP
    generated_account_id := public.ensure_entity_financial_account(
      row_record.id, 'source', row_record.entity_name, row_record.currency,
      '2140', 'Liability', 'حساب ذمم مصدر طلبات أو مورد'
    );
    UPDATE public.sources
    SET account_id = generated_account_id,
        data = jsonb_set(
          jsonb_set(COALESCE(data, '{}'::jsonb), '{financialAccountId}', to_jsonb(generated_account_id), true),
          '{financialAccountCode}', to_jsonb((SELECT account_code FROM public.accounts WHERE id = generated_account_id)), true
        )
    WHERE id::text = row_record.id;
  END LOOP;

  -- 2150: Shipping company and carrier payables.
  FOR row_record IN
    SELECT id::text AS id, COALESCE(name, data->>'name', id::text) AS entity_name,
      COALESCE(NULLIF(data->>'financialCurrency', ''), NULLIF(data->>'currency', ''), 'YER') AS currency
    FROM public.shipping_companies
    WHERE NULLIF(trim(COALESCE(account_id, '')), '') IS NULL
  LOOP
    generated_account_id := public.ensure_entity_financial_account(
      row_record.id, 'shipping_company', row_record.entity_name, row_record.currency,
      '2150', 'Liability', 'حساب ذمم شركة شحن أو ناقل'
    );
    UPDATE public.shipping_companies
    SET account_id = generated_account_id,
        data = jsonb_set(
          jsonb_set(COALESCE(data, '{}'::jsonb), '{financialAccountId}', to_jsonb(generated_account_id), true),
          '{financialAccountCode}', to_jsonb((SELECT account_code FROM public.accounts WHERE id = generated_account_id)), true
        )
    WHERE id::text = row_record.id;
  END LOOP;

  -- 12xx: Fixed asset sub-ledgers by operational category.
  FOR row_record IN
    SELECT
      id::text AS id,
      COALESCE(data->>'nameAr', data->>'nameEn', data->>'assetCode', id::text) AS entity_name,
      COALESCE(NULLIF(data->>'currency', ''), 'YER') AS currency,
      COALESCE(data->>'category', 'Other') AS category
    FROM public.assets
    WHERE NULLIF(trim(COALESCE(account_id, '')), '') IS NULL
  LOOP
    generated_account_id := public.ensure_entity_financial_account(
      row_record.id,
      'asset',
      row_record.entity_name,
      row_record.currency,
      CASE row_record.category
        WHEN 'Vehicles' THEN '1210'
        WHEN 'Inspection' THEN '1220'
        WHEN 'Office' THEN '1230'
        WHEN 'Computers' THEN '1240'
        ELSE '1250'
      END,
      'Asset',
      'حساب أصل ثابت أو معدات'
    );
    UPDATE public.assets
    SET account_id = generated_account_id,
        account_code = (SELECT account_code FROM public.accounts WHERE id = generated_account_id),
        data = jsonb_set(
          jsonb_set(COALESCE(data, '{}'::jsonb), '{financialAccountId}', to_jsonb(generated_account_id), true),
          '{financialAccountCode}', to_jsonb((SELECT account_code FROM public.accounts WHERE id = generated_account_id)), true
        )
    WHERE id::text = row_record.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_source_financial_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id text;
  v_account_code text;
  v_name text;
  v_currency text;
BEGIN
  v_name := COALESCE(NEW.name, NEW.data->>'source_name', NEW.data->>'name', NEW.id::text);
  v_currency := COALESCE(NULLIF(NEW.data->>'financialCurrency', ''), NULLIF(NEW.data->>'currency', ''), 'YER');
  v_account_id := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF v_account_id IS NULL THEN
    v_account_id := public.ensure_entity_financial_account(NEW.id::text, 'source', v_name, v_currency, '2140', 'Liability', 'حساب ذمم مصدر طلبات أو مورد');
  END IF;
  UPDATE public.accounts
  SET currency = v_currency,
      data = jsonb_set(COALESCE(data, '{}'::jsonb), '{entityName}', to_jsonb(v_name), true)
  WHERE id = v_account_id;
  SELECT account_code INTO v_account_code FROM public.accounts WHERE id = v_account_id;
  NEW.account_id := v_account_id;
  NEW.data := jsonb_set(
    jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{financialAccountId}', to_jsonb(v_account_id), true),
    '{financialAccountCode}', to_jsonb(v_account_code), true
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_shipping_company_financial_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id text;
  v_account_code text;
  v_name text;
  v_currency text;
BEGIN
  v_name := COALESCE(NEW.name, NEW.data->>'name', NEW.id::text);
  v_currency := COALESCE(NULLIF(NEW.data->>'financialCurrency', ''), NULLIF(NEW.data->>'currency', ''), 'YER');
  v_account_id := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF v_account_id IS NULL THEN
    v_account_id := public.ensure_entity_financial_account(NEW.id::text, 'shipping_company', v_name, v_currency, '2150', 'Liability', 'حساب ذمم شركة شحن أو ناقل');
  END IF;
  UPDATE public.accounts
  SET currency = v_currency,
      data = jsonb_set(COALESCE(data, '{}'::jsonb), '{entityName}', to_jsonb(v_name), true)
  WHERE id = v_account_id;
  SELECT account_code INTO v_account_code FROM public.accounts WHERE id = v_account_id;
  NEW.account_id := v_account_id;
  NEW.data := jsonb_set(
    jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{financialAccountId}', to_jsonb(v_account_id), true),
    '{financialAccountCode}', to_jsonb(v_account_code), true
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_asset_financial_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id text;
  v_account_code text;
  v_name text;
  v_currency text;
  v_prefix text;
BEGIN
  v_name := COALESCE(NEW.data->>'nameAr', NEW.data->>'nameEn', NEW.data->>'assetCode', NEW.id::text);
  v_currency := COALESCE(NULLIF(NEW.data->>'currency', ''), 'YER');
  v_prefix := CASE COALESCE(NEW.data->>'category', 'Other')
    WHEN 'Vehicles' THEN '1210'
    WHEN 'Inspection' THEN '1220'
    WHEN 'Office' THEN '1230'
    WHEN 'Computers' THEN '1240'
    ELSE '1250'
  END;
  v_account_id := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF v_account_id IS NULL THEN
    v_account_id := public.ensure_entity_financial_account(NEW.id::text, 'asset', v_name, v_currency, v_prefix, 'Asset', 'حساب أصل ثابت أو معدات');
  END IF;
  UPDATE public.accounts
  SET currency = v_currency,
      data = jsonb_set(COALESCE(data, '{}'::jsonb), '{entityName}', to_jsonb(v_name), true)
  WHERE id = v_account_id;
  SELECT account_code INTO v_account_code FROM public.accounts WHERE id = v_account_id;
  NEW.account_id := v_account_id;
  NEW.account_code := v_account_code;
  NEW.data := jsonb_set(
    jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{financialAccountId}', to_jsonb(v_account_id), true),
    '{financialAccountCode}', to_jsonb(v_account_code), true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sources_link_financial_account_trigger ON public.sources;
CREATE TRIGGER sources_link_financial_account_trigger
BEFORE INSERT OR UPDATE ON public.sources
FOR EACH ROW EXECUTE FUNCTION public.link_source_financial_account();

DROP TRIGGER IF EXISTS shipping_companies_link_financial_account_trigger ON public.shipping_companies;
CREATE TRIGGER shipping_companies_link_financial_account_trigger
BEFORE INSERT OR UPDATE ON public.shipping_companies
FOR EACH ROW EXECUTE FUNCTION public.link_shipping_company_financial_account();

DROP TRIGGER IF EXISTS assets_link_financial_account_trigger ON public.assets;
CREATE TRIGGER assets_link_financial_account_trigger
BEFORE INSERT OR UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.link_asset_financial_account();

ALTER TABLE public.sources
  DROP CONSTRAINT IF EXISTS sources_account_id_fkey,
  ADD CONSTRAINT sources_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.shipping_companies
  DROP CONSTRAINT IF EXISTS shipping_companies_account_id_fkey,
  ADD CONSTRAINT shipping_companies_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_account_id_fkey,
  ADD CONSTRAINT assets_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS sources_account_id_idx ON public.sources(account_id);
CREATE INDEX IF NOT EXISTS shipping_companies_account_id_idx ON public.shipping_companies(account_id);
CREATE INDEX IF NOT EXISTS assets_account_id_idx ON public.assets(account_id);
CREATE INDEX IF NOT EXISTS accounts_entity_type_entity_id_idx
  ON public.accounts ((data->>'entityType'), entity_id);
