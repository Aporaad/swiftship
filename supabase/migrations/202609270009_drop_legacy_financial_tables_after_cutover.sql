-- Migration 202609270009
-- The legacy tables were already removed by the prior cutover migration.
-- Keep this idempotent migration as an auditable final guard.
DROP TABLE IF EXISTS public.journal_entries;
DROP TABLE IF EXISTS public.account_transactions;
