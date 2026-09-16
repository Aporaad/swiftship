-- =============================================================================
-- Migration 202609160004: تصحيح دالة accounting_touch_account_updated_at لتستخدم updated_at
-- Fix trigger function accounting_touch_account_updated_at to use snake_case column
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.accounting_touch_account_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

COMMIT;
