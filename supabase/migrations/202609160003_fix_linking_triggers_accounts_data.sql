-- =============================================================================
-- Migration 202609160003: تصحيح دوال التريجرات لمنع تحديث حقل accounts.data غير الموجود
-- Fix trigger functions to remove UPDATE public.accounts SET data = ...
-- =============================================================================

BEGIN;

-- 1. link_source_financial_account
CREATE OR REPLACE FUNCTION public.link_source_financial_account()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_account_id text;
  v_account_code text;
  v_name text;
  v_currency text;
BEGIN
  v_name := COALESCE(NEW.name, NEW.data->>'source_name', NEW.data->>'name', NEW.id::text);
  v_currency := COALESCE(NULLIF(NEW.data->>'financialCurrency', ''), NULLIF(NEW.data->>'currency', ''), 'YER');
  v_account_id := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF v_account_id IS NULL THEN
    v_account_id := public.ensure_entity_financial_account(NEW.id::text, 'source', v_name, v_currency, '2140', 'Liability', 'حساب ذمم مصدر طلبات أو مورد');
  END IF;
  UPDATE public.accounts
  SET currency = v_currency
  WHERE id = v_account_id;
  SELECT account_code INTO v_account_code FROM public.accounts WHERE id = v_account_id;
  NEW.account_id := v_account_id;
  NEW.data := jsonb_set(
    jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{financialAccountId}', to_jsonb(v_account_id), true),
    '{financialAccountCode}', to_jsonb(v_account_code), true
  );
  RETURN NEW;
END;
$function$;

-- 2. link_shipping_company_financial_account
CREATE OR REPLACE FUNCTION public.link_shipping_company_financial_account()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_account_id text;
  v_account_code text;
  v_name text;
  v_currency text;
BEGIN
  v_name := COALESCE(NEW.name, NEW.data->>'name', NEW.id::text);
  v_currency := COALESCE(NULLIF(NEW.data->>'financialCurrency', ''), NULLIF(NEW.data->>'currency', ''), 'YER');
  v_account_id := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF v_account_id IS NULL THEN
    v_account_id := public.ensure_entity_financial_account(NEW.id::text, 'shipping_company', v_name, v_currency, '2150', 'Liability', 'حساب ذمم شركة شحن أو ناقل');
  END IF;
  UPDATE public.accounts
  SET currency = v_currency
  WHERE id = v_account_id;
  SELECT account_code INTO v_account_code FROM public.accounts WHERE id = v_account_id;
  NEW.account_id := v_account_id;
  NEW.data := jsonb_set(
    jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{financialAccountId}', to_jsonb(v_account_id), true),
    '{financialAccountCode}', to_jsonb(v_account_code), true
  );
  RETURN NEW;
END;
$function$;

-- 3. link_asset_financial_account
CREATE OR REPLACE FUNCTION public.link_asset_financial_account()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_account_id text;
  v_account_code text;
  v_name text;
  v_currency text;
  v_prefix text;
BEGIN
  v_name := COALESCE(NEW.data->>'nameAr', NEW.data->>'nameEn', NEW.data->>'assetCode', NEW.id::text);
  v_currency := COALESCE(NULLIF(NEW.data->>'currency', ''), 'YER');
  v_prefix := CASE COALESCE(NEW.data->>'category', 'Other')
    WHEN 'Vehicles' THEN '1210'
    WHEN 'Inspection' THEN '1220'
    WHEN 'Office' THEN '1230'
    WHEN 'Computers' THEN '1240'
    ELSE '1250'
  END;
  v_account_id := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF v_account_id IS NULL THEN
    v_account_id := public.ensure_entity_financial_account(NEW.id::text, 'asset', v_name, v_currency, v_prefix, 'Asset', 'حساب أصل ثابت أو معدات');
  END IF;
  UPDATE public.accounts
  SET currency = v_currency
  WHERE id = v_account_id;
  SELECT account_code INTO v_account_code FROM public.accounts WHERE id = v_account_id;
  NEW.account_id := v_account_id;
  NEW.account_code := v_account_code;
  NEW.data := jsonb_set(
    jsonb_set(COALESCE(NEW.data, '{}'::jsonb), '{financialAccountId}', to_jsonb(v_account_id), true),
    '{financialAccountCode}', to_jsonb(v_account_code), true
  );
  RETURN NEW;
END;
$function$;

COMMIT;
