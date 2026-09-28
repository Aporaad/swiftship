-- Migration: standardize_audit_timestamps_and_roles
-- Prepared: 2026-09-28
-- Scope: roles normalization, bigint epoch-ms timestamps, audit columns
-- Backfill of newly-added audit timestamps is intentionally omitted to avoid legacy trigger execution.

BEGIN;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_by text;

UPDATE public.roles
SET
  title = COALESCE(data ->> 'title', title),
  is_default = CASE lower(COALESCE(data ->> 'isDefault', CASE WHEN is_default THEN 'true' ELSE 'false' END)) WHEN 'true' THEN true ELSE false END,
  permissions = CASE
    WHEN jsonb_typeof(data -> 'permissions') = 'array' THEN (
      SELECT COALESCE(jsonb_agg(permission_value ORDER BY permission_value), '[]'::jsonb)
      FROM (SELECT DISTINCT value AS permission_value FROM jsonb_array_elements(data -> 'permissions') WHERE jsonb_typeof(value) = 'string') AS distinct_permissions
    )
    ELSE COALESCE(permissions, '[]'::jsonb)
  END,
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.roles DROP COLUMN IF EXISTS data;

ALTER TABLE public.users
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT,
  ALTER COLUMN last_seen DROP DEFAULT,
  ALTER COLUMN created_at TYPE timestamptz USING CASE WHEN created_at IS NULL THEN NULL ELSE to_timestamp(created_at / 1000.0) END,
  ALTER COLUMN updated_at TYPE timestamptz USING CASE WHEN updated_at IS NULL THEN NULL ELSE to_timestamp(updated_at / 1000.0) END,
  ALTER COLUMN last_seen TYPE timestamptz USING CASE WHEN last_seen IS NULL THEN NULL ELSE to_timestamp(last_seen / 1000.0) END;

ALTER TABLE public.cust_details
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT,
  ALTER COLUMN created_at TYPE timestamptz USING CASE WHEN created_at IS NULL THEN NULL ELSE to_timestamp(created_at / 1000.0) END,
  ALTER COLUMN updated_at TYPE timestamptz USING CASE WHEN updated_at IS NULL THEN NULL ELSE to_timestamp(updated_at / 1000.0) END;

ALTER TABLE public.items_category
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT,
  ALTER COLUMN created_at TYPE timestamptz USING CASE WHEN created_at IS NULL THEN NULL ELSE to_timestamp(created_at / 1000.0) END,
  ALTER COLUMN updated_at TYPE timestamptz USING CASE WHEN updated_at IS NULL THEN NULL ELSE to_timestamp(updated_at / 1000.0) END;

ALTER TABLE public.order_option
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT,
  ALTER COLUMN created_at TYPE timestamptz USING CASE WHEN created_at IS NULL THEN NULL ELSE to_timestamp(created_at / 1000.0) END,
  ALTER COLUMN updated_at TYPE timestamptz USING CASE WHEN updated_at IS NULL THEN NULL ELSE to_timestamp(updated_at / 1000.0) END;

ALTER TABLE public.report_templates DROP CONSTRAINT IF EXISTS report_templates_created_by_fkey;
ALTER TABLE public.report_templates ALTER COLUMN created_by TYPE text USING created_by::text;

DO $$
DECLARE table_record record;
BEGIN
  FOR table_record IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_at timestamptz', table_record.tablename);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz', table_record.tablename);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by text', table_record.tablename);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by text', table_record.tablename);
  END LOOP;
END $$;

COMMENT ON COLUMN public.orders.order_status_id IS 'Canonical order status identifier. order_status1 is retained temporarily only for compatibility and must not be used by new code.';

COMMIT;
