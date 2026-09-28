-- Migration 202609270002
-- Phase 5: safe, non-destructive backfill of unambiguous names only.
-- Never fills language columns from an unclassified generic name.

BEGIN;

UPDATE public.customers
SET full_name = NULLIF(btrim(data->>'fullName'), '')
WHERE full_name IS NULL
  AND data IS NOT NULL
  AND NULLIF(btrim(data->>'fullName'), '') IS NOT NULL;

UPDATE public.couriers
SET full_name = NULLIF(btrim(data->>'fullName'), '')
WHERE full_name IS NULL
  AND data IS NOT NULL
  AND NULLIF(btrim(data->>'fullName'), '') IS NOT NULL;

UPDATE public.employees
SET full_name = NULLIF(btrim(data->>'fullName'), '')
WHERE full_name IS NULL
  AND data IS NOT NULL
  AND NULLIF(btrim(data->>'fullName'), '') IS NOT NULL;

UPDATE public.assets
SET name_ar = NULLIF(btrim(data->>'nameAr'), ''),
    name_en = NULLIF(btrim(data->>'nameEn'), '')
WHERE data IS NOT NULL
  AND (name_ar IS NULL OR name_en IS NULL)
  AND (NULLIF(btrim(data->>'nameAr'), '') IS NOT NULL OR NULLIF(btrim(data->>'nameEn'), '') IS NOT NULL);

COMMIT;
