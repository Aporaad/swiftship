-- Migration 202609270005
-- Stop account-link triggers from recreating legacy JSON keys.
-- Canonical reference remains account_id; no account_code assignment is made
-- because the entity tables do not share an account_code column.

CREATE OR REPLACE FUNCTION public.link_courier_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text; entity_currency text;
BEGIN
  entity_name := COALESCE(NEW.data->>'fullName', NEW.data->>'name', NEW.data->>'email', NEW.courier_id::text);
  entity_currency := COALESCE(NULLIF(NEW.data->>'financialCurrency', ''), NULLIF(NEW.data->>'currency', ''), NEW.currency, 'YER');
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
  entity_name := COALESCE(NEW.data->>'fullName', NEW.data->>'username', NEW.data->>'email', NEW.employee_id::text);
  entity_currency := COALESCE(NULLIF(NEW.data->>'currency', ''), NEW.currency, 'YER');
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.employee_id::text, 'employee', entity_name, entity_currency, '2130', 'Liability', 'حساب ذمم موظف أو طرف طلب داخلي'); END IF;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_source_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text; entity_currency text;
BEGIN
  entity_name := COALESCE(NEW.name, NEW.data->>'source_name', NEW.data->>'name', NEW.source_id::text);
  entity_currency := COALESCE(NULLIF(NEW.data->>'financialCurrency', ''), NULLIF(NEW.data->>'currency', ''), 'YER');
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.source_id::text, 'source', entity_name, entity_currency, '2140', 'Liability', 'حساب ذمم مصدر طلبات أو مورد'); END IF;
  UPDATE public.accounts SET currency = entity_currency WHERE account_id = account_value;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_shipping_company_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text; entity_currency text;
BEGIN
  entity_name := COALESCE(NEW.name, NEW.data->>'name', NEW.shipping_company_id::text);
  entity_currency := COALESCE(NULLIF(NEW.data->>'financialCurrency', ''), NULLIF(NEW.data->>'currency', ''), 'YER');
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.shipping_company_id::text, 'shipping_company', entity_name, entity_currency, '2150', 'Liability', 'حساب ذمم شركة شحن أو ناقل'); END IF;
  UPDATE public.accounts SET currency = entity_currency WHERE account_id = account_value;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_asset_financial_account()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE account_value text; entity_name text; entity_currency text; account_prefix text;
BEGIN
  entity_name := COALESCE(NEW.data->>'nameAr', NEW.data->>'nameEn', NEW.data->>'assetCode', NEW.asset_id::text);
  entity_currency := COALESCE(NULLIF(NEW.data->>'currency', ''), 'YER');
  account_prefix := CASE COALESCE(NEW.data->>'category', 'Other') WHEN 'Vehicles' THEN '1210' WHEN 'Inspection' THEN '1220' WHEN 'Office' THEN '1230' WHEN 'Computers' THEN '1240' ELSE '1250' END;
  account_value := NULLIF(trim(COALESCE(NEW.account_id, '')), '');
  IF account_value IS NULL THEN account_value := public.ensure_entity_financial_account(NEW.asset_id::text, 'asset', entity_name, entity_currency, account_prefix, 'Asset', 'حساب أصل ثابت أو معدات'); END IF;
  UPDATE public.accounts SET currency = entity_currency WHERE account_id = account_value;
  NEW.account_id := account_value;
  RETURN NEW;
END;
$function$;

UPDATE public.customers SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance' WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];
UPDATE public.couriers SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance' WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];
UPDATE public.employees SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance' WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];
UPDATE public.sources SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance' WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];
UPDATE public.shipping_companies SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance' WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];
UPDATE public.assets SET data = COALESCE(data, '{}'::jsonb) - 'financialAccountId' - 'financialAccountCode' - 'financialBalance' WHERE data ?| ARRAY['financialAccountId', 'financialAccountCode', 'financialBalance'];
