-- Run after 202608230200_link_sources_shipping_assets_financial_accounts.sql.

-- 1) Review linked account counts by entity type.
SELECT
  COALESCE(data->>'entityType', 'unknown') AS entity_type,
  COUNT(*) AS linked_account_count,
  MIN(account_code) AS first_account_code,
  MAX(account_code) AS last_account_code
FROM public.accounts
WHERE COALESCE(data->>'entityType', '') IN ('source', 'shipping_company', 'asset')
GROUP BY COALESCE(data->>'entityType', 'unknown')
ORDER BY entity_type;

-- 2) Inspect the entity-to-account links. These result sets must contain no NULL account_id values.
SELECT id, name, account_id, data->>'financialAccountCode' AS account_code
FROM public.sources
ORDER BY name;

SELECT id, name, account_id, data->>'financialAccountCode' AS account_code
FROM public.shipping_companies
ORDER BY name;

SELECT id, data->>'assetCode' AS asset_code, data->>'nameAr' AS name_ar, account_id, account_code
FROM public.assets
ORDER BY data->>'assetCode';

-- 3) Confirm all three foreign keys and automatic-link triggers exist.
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN (
  'sources_account_id_fkey',
  'shipping_companies_account_id_fkey',
  'assets_account_id_fkey'
)
ORDER BY conname;

SELECT tgrelid::regclass AS table_name, tgname AS trigger_name
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN (
    'sources_link_financial_account_trigger',
    'shipping_companies_link_financial_account_trigger',
    'assets_link_financial_account_trigger'
  )
ORDER BY trigger_name;

-- 4) Safety checks: each query must return zero rows.
SELECT s.id, s.account_id
FROM public.sources AS s
LEFT JOIN public.accounts AS a ON a.id = s.account_id
WHERE s.account_id IS NULL OR a.id IS NULL;

SELECT sc.id, sc.account_id
FROM public.shipping_companies AS sc
LEFT JOIN public.accounts AS a ON a.id = sc.account_id
WHERE sc.account_id IS NULL OR a.id IS NULL;

SELECT ast.id, ast.account_id
FROM public.assets AS ast
LEFT JOIN public.accounts AS a ON a.id = ast.account_id
WHERE ast.account_id IS NULL OR a.id IS NULL;
