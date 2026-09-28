-- Migration 202609270010
-- Complete only field normalizations that are provable from live values.
-- Keep compatibility columns whose application contract still requires them.

BEGIN;

-- Canonical person/entity names: classify Arabic values explicitly; do not duplicate into both languages.
UPDATE public.customers
SET name_ar = COALESCE(name_ar, CASE WHEN full_name ~ '[ء-ي]' THEN full_name END),
    name_en = COALESCE(name_en, CASE WHEN full_name !~ '[ء-ي]' AND full_name ~ '[A-Za-z]' THEN full_name END)
WHERE name_ar IS NULL OR name_en IS NULL;

UPDATE public.couriers
SET name_ar = COALESCE(name_ar, CASE WHEN full_name ~ '[ء-ي]' THEN full_name END),
    name_en = COALESCE(name_en, CASE WHEN full_name !~ '[ء-ي]' AND full_name ~ '[A-Za-z]' THEN full_name END)
WHERE name_ar IS NULL OR name_en IS NULL;

UPDATE public.employees
SET name_ar = COALESCE(name_ar, CASE WHEN full_name ~ '[ء-ي]' THEN full_name END),
    name_en = COALESCE(name_en, CASE WHEN full_name !~ '[ء-ي]' AND full_name ~ '[A-Za-z]' THEN full_name END)
WHERE name_ar IS NULL OR name_en IS NULL;

UPDATE public.portal_users
SET name_ar = COALESCE(name_ar, CASE WHEN full_name ~ '[ء-ي]' THEN full_name END),
    name_en = COALESCE(name_en, CASE WHEN full_name !~ '[ء-ي]' AND full_name ~ '[A-Za-z]' THEN full_name END)
WHERE name_ar IS NULL OR name_en IS NULL;

-- Canonical typed fields for values already present in direct columns.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_level text;
UPDATE public.customers SET customer_level = COALESCE(customer_level, levels) WHERE customer_level IS NULL AND levels IS NOT NULL;

ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS courier_type text,
  ADD COLUMN IF NOT EXISTS courier_level text,
  ADD COLUMN IF NOT EXISTS commission_rate numeric;
UPDATE public.couriers
SET courier_type = COALESCE(courier_type, type),
    courier_level = COALESCE(courier_level, levels)
WHERE courier_type IS NULL OR courier_level IS NULL;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS job_type text,
  ADD COLUMN IF NOT EXISTS commission_rate numeric;
UPDATE public.employees SET job_type = COALESCE(job_type, jobs_type) WHERE job_type IS NULL AND jobs_type IS NOT NULL;

-- Normalize existing names without guessing language: brands/Latin names go to name_en; Arabic source names go to name_ar.
UPDATE public.shipping_companies
SET name_ar = COALESCE(name_ar, CASE WHEN name ~ '[ء-ي]' THEN name END),
    name_en = COALESCE(name_en, CASE WHEN name !~ '[ء-ي]' THEN name END)
WHERE name_ar IS NULL OR name_en IS NULL;

UPDATE public.sources
SET name_ar = COALESCE(name_ar, CASE WHEN name ~ '[ء-ي]' THEN name END),
    name_en = COALESCE(name_en, CASE WHEN name !~ '[ء-ي]' THEN name END)
WHERE name_ar IS NULL OR name_en IS NULL;

-- Canonical user-settings FK column; all existing legacy userid values are NULL.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS user_id text;
UPDATE public.user_settings SET user_id = userid WHERE user_id IS NULL AND userid IS NOT NULL;

-- Remove only proven-empty legacy references after the new model and audit maps exist.
ALTER TABLE public.orders_history DROP COLUMN IF EXISTS journal_entry_id;
ALTER TABLE public.orders_history DROP COLUMN IF EXISTS account_transaction_id;
ALTER TABLE public.portal_users DROP COLUMN IF EXISTS linked_acc_id;
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS userid;

COMMIT;
