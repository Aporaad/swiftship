-- Migration 202609270004
-- Phase 8: remove only legacy financial keys from entity data JSONB.
-- Confirmed scope: no row deletion, no protected financial table changes,
-- no data column removal, no primary/foreign key renames.

UPDATE public.customers
SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance'
WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];

UPDATE public.couriers
SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance'
WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];

UPDATE public.employees
SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance'
WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];

UPDATE public.sources
SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance'
WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];

UPDATE public.shipping_companies
SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance'
WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];

UPDATE public.assets
SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance'
WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];
