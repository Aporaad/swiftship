-- Migration 202609270011
-- Drop direct columns only after canonical columns are populated and adapter mappings are updated.
BEGIN;
ALTER TABLE public.customers DROP COLUMN IF EXISTS levels;
ALTER TABLE public.couriers DROP COLUMN IF EXISTS levels;
ALTER TABLE public.couriers DROP COLUMN IF EXISTS type;
ALTER TABLE public.employees DROP COLUMN IF EXISTS jobs_type;
COMMIT;
