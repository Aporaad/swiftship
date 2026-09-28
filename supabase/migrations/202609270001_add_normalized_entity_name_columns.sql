-- Migration 202609270001
-- Phase 4: add nullable normalized name columns only.
-- No backfill, no deletion, no financial_* columns, no PK/FK changes.

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.shipping_companies
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text;

COMMENT ON COLUMN public.customers.full_name IS 'Normalized full name; populated only by an approved backfill rule.';
COMMENT ON COLUMN public.couriers.full_name IS 'Normalized full name; populated only by an approved backfill rule.';
COMMENT ON COLUMN public.employees.full_name IS 'Normalized full name; populated only by an approved backfill rule.';

COMMIT;
