CREATE OR REPLACE FUNCTION public.orders_history_change_details(p_before jsonb, p_after jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, auth
AS $$
  WITH base_changes AS (
    SELECT
      COALESCE(before_row.key, after_row.key) AS key,
      before_row.value AS before_value,
      after_row.value AS after_value
    FROM jsonb_each(COALESCE(p_before, '{}'::jsonb)) AS before_row
    FULL OUTER JOIN jsonb_each(COALESCE(p_after, '{}'::jsonb)) AS after_row
      ON before_row.key = after_row.key
    WHERE COALESCE(before_row.key, after_row.key) <> 'data'
      AND before_row.value IS DISTINCT FROM after_row.value
  ),
  data_changes AS (
    SELECT
      'data.' || COALESCE(before_row.key, after_row.key) AS key,
      before_row.value AS before_value,
      after_row.value AS after_value
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(p_before->'data') = 'object' THEN p_before->'data' ELSE '{}'::jsonb END
    ) AS before_row
    FULL OUTER JOIN jsonb_each(
      CASE WHEN jsonb_typeof(p_after->'data') = 'object' THEN p_after->'data' ELSE '{}'::jsonb END
    ) AS after_row
      ON before_row.key = after_row.key
    WHERE before_row.value IS DISTINCT FROM after_row.value
  ),
  combined AS (
    SELECT * FROM base_changes
    UNION ALL
    SELECT * FROM data_changes
  )
  SELECT COALESCE(
    jsonb_object_agg(
      key,
      jsonb_build_object('before', before_value, 'after', after_value)
      ORDER BY key
    ),
    '{}'::jsonb
  )
  FROM combined;
$$;

UPDATE public.orders_history
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{changes}',
  public.orders_history_change_details(before_data, after_data),
  true
)
WHERE metadata IS NULL OR NOT (metadata ? 'changes');
