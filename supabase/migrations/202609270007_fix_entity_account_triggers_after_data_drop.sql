-- Migration 202609270007
-- Fix account-link triggers after the six entity data columns were removed.
-- All trigger inputs now come from canonical columns only.

CREATE OR REPLACE FUNCTION public.link_courier_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text; entity_currency text;
BEGIN
  entity_name := COALESCE(NULLIF(NEW.full_name, ''), NULLIF(NEW.name_ar, ''), NULLIF(NEW.name_en, ''), NEW.courier_id::text);
  entity_currency := COALESCE(NULLIF(NEW.currency, ''), 'YER');
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.courier_id::text, 'courier', entity_name, entity_currency, '2120', 'Liability', 'حساب ذمم مندوب أو طرف طلب'); END IF;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_employee_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text; entity_currency text;
BEGIN
  entity_name := COALESCE(NULLIF(NEW.full_name, ''), NULLIF(NEW.name_ar, ''), NULLIF(NEW.name_en, ''), NEW.employee_id::text);
  entity_currency := COALESCE(NULLIF(NEW.currency, ''), 'YER');
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.employee_id::text, 'employee', entity_name, entity_currency, '2130', 'Liability', 'حساب ذمم موظف أو طرف طلب داخلي'); END IF;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_source_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text;
BEGIN
  entity_name := COALESCE(NULLIF(NEW.name, ''), NULLIF(NEW.name_ar, ''), NULLIF(NEW.name_en, ''), NEW.source_id::text);
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.source_id::text, 'source', entity_name, 'YER', '2140', 'Liability', 'حساب ذمم مصدر طلبات أو مورد'); END IF;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_shipping_company_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text;
BEGIN
  entity_name := COALESCE(NULLIF(NEW.name, ''), NULLIF(NEW.name_ar, ''), NULLIF(NEW.name_en, ''), NEW.shipping_company_id::text);
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.shipping_company_id::text, 'shipping_company', entity_name, 'YER', '2150', 'Liability', 'حساب ذمم شركة شحن أو ناقل'); END IF;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_asset_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text; entity_currency text;
BEGIN
  entity_name := COALESCE(NULLIF(NEW.name_ar, ''), NULLIF(NEW.name_en, ''), NULLIF(NEW.asset_code, ''), NEW.asset_id::text);
  entity_currency := COALESCE(NULLIF(NEW.currency, ''), 'YER');
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.asset_id::text, 'asset', entity_name, entity_currency, '1250', 'Asset', 'حساب أصل ثابت أو معدات'); END IF;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;
