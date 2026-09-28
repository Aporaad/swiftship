-- Migration 202609270006
-- Confirmed destructive scope: remove only data columns from six entity tables.
-- No rows are deleted. Financial tables are intentionally untouched.

ALTER TABLE public.customers DROP COLUMN IF EXISTS data;
ALTER TABLE public.couriers DROP COLUMN IF EXISTS data;
ALTER TABLE public.employees DROP COLUMN IF EXISTS data;
ALTER TABLE public.sources DROP COLUMN IF EXISTS data;
ALTER TABLE public.shipping_companies DROP COLUMN IF EXISTS data;
ALTER TABLE public.assets DROP COLUMN IF EXISTS data;
