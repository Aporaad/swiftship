-- SwiftShip accounting hierarchy — classify legacy accounts
-- This migration deliberately preserves accounts.id and account_code. Rekeying occurs only in a later, verified migration.
-- No new accounts, opening balances, exchange rates, or journal entries are created.

UPDATE public.acc_sub
SET allows_direct_accounts = true
WHERE allows_direct_accounts = false;

WITH classification AS (
  SELECT
    a.id,
    a.account_code,
    COALESCE(NULLIF(a.entity_type, ''), NULLIF(a.data->>'entityType', ''), 'system') AS resolved_entity_type,
    UPPER(COALESCE(NULLIF(a.currency, ''), NULLIF(a.data->>'currency', ''))) AS currency_code,
    CASE
      WHEN a.account_code LIKE '1101%' THEN '112'
      WHEN a.account_code LIKE '1110%' OR a.account_code LIKE '1111%' THEN '111'
      WHEN a.account_code LIKE '1130%' THEN '113'
      WHEN a.account_code LIKE '1150%' THEN '115'
      WHEN a.account_code LIKE '1210%' THEN '121'
      WHEN a.account_code LIKE '2100%' THEN '211'
      WHEN a.account_code LIKE '2120%' THEN '212'
      WHEN a.account_code LIKE '2130%' THEN '213'
      WHEN a.account_code LIKE '2140%' THEN '214'
      WHEN a.account_code LIKE '2150%' THEN '215'
      WHEN a.account_code LIKE '3100%' THEN '311'
      WHEN a.account_code LIKE '3200%' THEN '312'
      WHEN a.account_code LIKE '4100%' THEN '411'
      WHEN a.account_code LIKE '4110%' THEN '412'
      WHEN a.account_code LIKE '5100%' THEN '511'
      WHEN a.account_code LIKE '5300%' THEN '513'
      ELSE NULL
    END AS resolved_acc_sub_id,
    CASE
      WHEN NULLIF(a.data->>'balance', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (a.data->>'balance')::numeric
      ELSE a.balance
    END AS legacy_balance,
    CASE
      WHEN a.account_code ~ '-[0-9]+$' THEN (regexp_match(a.account_code, '-([0-9]+)$'))[1]::integer
      ELSE NULL
    END AS legacy_sequence
  FROM public.accounts a
)
UPDATE public.accounts AS target
SET
  acc_sub_id = classification.resolved_acc_sub_id,
  group_id = CASE
    WHEN classification.resolved_acc_sub_id = '113' AND classification.resolved_entity_type = 'customer' THEN '1132'
    WHEN classification.resolved_acc_sub_id = '121' AND classification.resolved_entity_type = 'asset' THEN '1211'
    WHEN classification.resolved_acc_sub_id = '212' AND classification.resolved_entity_type = 'courier' THEN '2121'
    WHEN classification.resolved_acc_sub_id = '213' AND classification.resolved_entity_type = 'employee' THEN '2131'
    WHEN classification.resolved_acc_sub_id = '214' AND classification.resolved_entity_type = 'source' THEN '2141'
    WHEN classification.resolved_acc_sub_id = '215' AND classification.resolved_entity_type = 'shipping_company' THEN '2151'
    ELSE NULL
  END,
  entity_type = classification.resolved_entity_type,
  account_seq = classification.legacy_sequence,
  acc_name_ar = COALESCE(NULLIF(target.acc_name_ar, ''), NULLIF(target.data->>'entityName', ''), NULLIF(target.data->>'nameAr', ''), target.account_code),
  acc_name_en = COALESCE(NULLIF(target.acc_name_en, ''), NULLIF(target.data->>'nameEn', ''), NULLIF(target.data->>'entityName', ''), ''),
  balance = classification.legacy_balance,
  cur_no = currency_reference.cur_id,
  is_active = CASE
    WHEN LOWER(COALESCE(target.data->>'isActive', 'true')) IN ('false', '0', 'no') THEN false
    ELSE target.is_active
  END
FROM classification
LEFT JOIN public.currency AS currency_reference ON currency_reference.code = classification.currency_code
WHERE target.id = classification.id;

COMMENT ON COLUMN public.accounts.account_code IS 'يبقى كود الحساب التاريخي في هذه المرحلة؛ يعاد توحيده ومعرف الحساب في ترحيل مستقل بعد تحديث جميع المراجع.';
