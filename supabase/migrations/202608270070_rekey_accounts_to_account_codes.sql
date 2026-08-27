-- SwiftShip accounting hierarchy — final account-ID rekey
-- Converts accounts.id to a normalized 4-digit-prefix + 4-digit-sequence accounting code.
-- A permanent mapping table preserves every old ID and code for compatibility and audit.
-- This migration is transactional: any failed verification rolls back all changes.

CREATE TABLE IF NOT EXISTS public.account_id_migration_map (
  id text PRIMARY KEY,
  old_account_id text NOT NULL UNIQUE,
  old_account_code text NOT NULL,
  new_account_id text NOT NULL UNIQUE,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.account_id_migration_map IS 'خريطة تدقيق وتوافق لمعرفات الحسابات قبل وبعد توحيد accounts.id مع الكود المحاسبي.';

CREATE OR REPLACE FUNCTION public.rewrite_account_reference_jsonb(source jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  pair record;
  rewritten jsonb := COALESCE(source, '{}'::jsonb);
  mapped_value text;
  key_name text;
BEGIN
  FOR pair IN SELECT key, value FROM jsonb_each(rewritten)
  LOOP
    key_name := lower(pair.key);
    IF jsonb_typeof(pair.value) = 'object' THEN
      rewritten := jsonb_set(rewritten, ARRAY[pair.key], public.rewrite_account_reference_jsonb(pair.value), true);
    ELSIF jsonb_typeof(pair.value) = 'array' THEN
      rewritten := jsonb_set(
        rewritten,
        ARRAY[pair.key],
        COALESCE((SELECT jsonb_agg(CASE WHEN jsonb_typeof(value) = 'object' THEN public.rewrite_account_reference_jsonb(value) ELSE value END) FROM jsonb_array_elements(pair.value)), '[]'::jsonb),
        true
      );
    ELSIF jsonb_typeof(pair.value) = 'string' THEN
      IF key_name = ANY (ARRAY['accountid', 'account_id', 'financialaccountid', 'financial_account_id', 'linkedaccountid', 'linked_account_id', 'orderpartyaccountid', 'order_party_account_id', 'debitaccountid', 'debit_account_id', 'creditaccountid', 'credit_account_id']) THEN
        SELECT new_account_id INTO mapped_value FROM public.account_id_migration_map WHERE old_account_id = trim(both '"' FROM pair.value::text) LIMIT 1;
      ELSIF key_name = ANY (ARRAY['accountcode', 'account_code', 'financialaccountcode', 'financial_account_code', 'linkedaccountcode', 'linked_account_code', 'debitaccountcode', 'debit_account_code', 'creditaccountcode', 'credit_account_code']) THEN
        SELECT new_account_id INTO mapped_value FROM public.account_id_migration_map WHERE old_account_code = trim(both '"' FROM pair.value::text) LIMIT 1;
      ELSE
        mapped_value := NULL;
      END IF;
      IF mapped_value IS NOT NULL THEN
        rewritten := jsonb_set(rewritten, ARRAY[pair.key], to_jsonb(mapped_value), true);
      END IF;
    END IF;
  END LOOP;
  RETURN rewritten;
END;
$$;

WITH base AS (
  SELECT
    a.id AS old_account_id,
    a.account_code AS old_account_code,
    CASE WHEN a.group_id IS NOT NULL THEN group_node.account_code ELSE rpad(a.acc_sub_id, 4, '0') END AS prefix,
    CASE WHEN a.account_code ~ '-[0-9]+$' THEN (regexp_match(a.account_code, '-([0-9]+)$'))[1]::integer ELSE NULL END AS legacy_sequence
  FROM public.accounts a
  LEFT JOIN public.acc_sub_group group_node ON group_node.id = a.group_id
), ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY prefix
      ORDER BY CASE WHEN legacy_sequence IS NULL OR legacy_sequence <= 0 THEN 1 ELSE 0 END, legacy_sequence NULLS LAST, old_account_id
    ) AS new_sequence
  FROM base
), proposed AS (
  SELECT old_account_id, old_account_code, prefix || '-' || lpad(new_sequence::text, 4, '0') AS new_account_id
  FROM ranked
)
INSERT INTO public.account_id_migration_map (id, old_account_id, old_account_code, new_account_id)
SELECT old_account_id, old_account_id, old_account_code, new_account_id
FROM proposed
ON CONFLICT (old_account_id) DO NOTHING;

DO $$
DECLARE
  mapped_count integer;
  account_count integer;
BEGIN
  SELECT count(*) INTO account_count FROM public.accounts;
  SELECT count(*) INTO mapped_count FROM public.account_id_migration_map;
  IF mapped_count <> account_count THEN
    RAISE EXCEPTION 'Account rekey aborted: mapping count % does not equal accounts count %', mapped_count, account_count;
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_id_migration_map WHERE new_account_id !~ '^\d{4}-\d{4}$') THEN
    RAISE EXCEPTION 'Account rekey aborted: a proposed account ID does not match the required code format.';
  END IF;
END;
$$;

-- Existing dependent rows are retained and rewritten through ON UPDATE CASCADE.
ALTER TABLE public.account_transactions DROP CONSTRAINT IF EXISTS account_transactions_account_id_fkey;
ALTER TABLE public.account_transactions ADD CONSTRAINT account_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_account_id_fkey;
ALTER TABLE public.assets ADD CONSTRAINT assets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS "assets_accounts_FK";
ALTER TABLE public.couriers DROP CONSTRAINT IF EXISTS couriers_account_id_fkey;
ALTER TABLE public.couriers ADD CONSTRAINT couriers_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_account_id_fkey;
ALTER TABLE public.customers ADD CONSTRAINT customers_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_account_id_fkey;
ALTER TABLE public.employees ADD CONSTRAINT employees_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_account_id_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS journal_entries_account_id_fkey;
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.salary_history DROP CONSTRAINT IF EXISTS salary_history_account_id_fkey;
ALTER TABLE public.salary_history ADD CONSTRAINT salary_history_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Avoid a transient account_code uniqueness conflict while rows exchange legacy code families.
UPDATE public.accounts AS account
SET account_code = '__rekey__' || account.id
FROM public.account_id_migration_map AS mapping
WHERE account.id = mapping.old_account_id
  AND account.id <> mapping.new_account_id;

UPDATE public.accounts AS account
SET
  id = mapping.new_account_id,
  account_code = mapping.new_account_id,
  account_seq = split_part(mapping.new_account_id, '-', 2)::integer
FROM public.account_id_migration_map AS mapping
WHERE account.id = mapping.old_account_id
  AND account.id <> mapping.new_account_id;

UPDATE public.assets AS asset
SET account_code = mapping.new_account_id
FROM public.account_id_migration_map AS mapping
WHERE asset.account_code = mapping.old_account_code;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['accounts', 'account_transactions', 'journal_entries', 'employees', 'couriers', 'customers', 'assets', 'sources', 'shipping_companies', 'orders', 'expenses', 'salary_history']
  LOOP
    EXECUTE format('UPDATE public.%I SET data = public.rewrite_account_reference_jsonb(data) WHERE data IS NOT NULL', target_table);
  END LOOP;
END;
$$;

UPDATE public.accounts
SET data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{accountCode}', to_jsonb(account_code), true),
    '{code}', to_jsonb(account_code), true
  ),
  '{accountPrefix}', to_jsonb(split_part(account_code, '-', 1)), true
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.accounts WHERE id !~ '^\d{4}-\d{4}$' OR id <> account_code) THEN
    RAISE EXCEPTION 'Account rekey verification failed: IDs and accounting codes were not fully normalized.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.account_id_migration_map mapping
    LEFT JOIN public.accounts account ON account.id = mapping.new_account_id
    WHERE account.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Account rekey verification failed: a mapped account is missing.';
  END IF;
END;
$$;
