-- SwiftShip accounting hierarchy — repair legacy account metadata
-- This migration never changes accounts.id, accounts.account_code, balances, journal entries,
-- transaction rows, or Row Level Security. It only restores hierarchy metadata derived from
-- the already-normalized account code and the existing account / acc_main / acc_sub / group tree.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.accounts AS a
    LEFT JOIN public.acc_sub_group AS g ON g.id = split_part(a.id, '-', 1)
    LEFT JOIN public.acc_sub AS s ON s.id = left(split_part(a.id, '-', 1), 3)
    WHERE a.id !~ '^\d{4}-\d{4}$'
       OR a.account_code IS DISTINCT FROM a.id
       OR (g.id IS NULL AND s.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Account hierarchy repair aborted: an account code cannot be resolved to an existing subgroup or detail account.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounts AS a
    LEFT JOIN public.currency AS c ON c.code = upper(COALESCE(NULLIF(a.currency, ''), a.data->>'currency'))
    WHERE c.cur_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Account hierarchy repair aborted: an account currency has no matching currency reference.';
  END IF;
END;
$$;

WITH resolved AS (
  SELECT
    a.id,
    a.data,
    a.currency,
    a.is_active,
    a.acc_name_ar,
    a.acc_name_en,
    COALESCE(group_node.acc_sub_id, direct_sub.id) AS resolved_acc_sub_id,
    group_node.id AS resolved_group_id,
    root_node.account_type AS resolved_type,
    currency_reference.cur_id AS resolved_cur_no,
    split_part(a.id, '-', 1) AS resolved_prefix,
    split_part(a.id, '-', 2)::integer AS resolved_sequence
  FROM public.accounts AS a
  LEFT JOIN public.acc_sub_group AS group_node ON group_node.id = split_part(a.id, '-', 1)
  LEFT JOIN public.acc_sub AS direct_sub ON direct_sub.id = left(split_part(a.id, '-', 1), 3)
  LEFT JOIN public.acc_sub AS sub_node ON sub_node.id = COALESCE(group_node.acc_sub_id, direct_sub.id)
  LEFT JOIN public.acc_main AS resolved_main_node ON resolved_main_node.id = sub_node.acc_main_id
  LEFT JOIN public.account AS root_node ON root_node.id = resolved_main_node.account_id
  LEFT JOIN public.currency AS currency_reference ON currency_reference.code = upper(COALESCE(NULLIF(a.currency, ''), a.data->>'currency'))
)
UPDATE public.accounts AS target
SET
  acc_sub_id = resolved.resolved_acc_sub_id,
  group_id = resolved.resolved_group_id,
  account_seq = resolved.resolved_sequence,
  cur_no = resolved.resolved_cur_no,
  type = resolved.resolved_type,
  acc_name_ar = COALESCE(NULLIF(target.acc_name_ar, ''), NULLIF(resolved.data->>'accNameAr', ''), NULLIF(resolved.data->>'entityName', ''), target.id),
  acc_name_en = COALESCE(NULLIF(target.acc_name_en, ''), NULLIF(resolved.data->>'accNameEn', ''), NULLIF(resolved.data->>'entityName', ''), ''),
  data = COALESCE(resolved.data, '{}'::jsonb) || jsonb_build_object(
    'id', target.id,
    'accountCode', target.account_code,
    'code', target.account_code,
    'accountPrefix', resolved.resolved_prefix,
    'accountNumber', lpad(resolved.resolved_sequence::text, 4, '0'),
    'accountSeq', resolved.resolved_sequence,
    'accSubId', resolved.resolved_acc_sub_id,
    'groupId', resolved.resolved_group_id,
    'parentCode', COALESCE(resolved.resolved_group_id, resolved.resolved_acc_sub_id),
    'curNo', resolved.resolved_cur_no,
    'currency', target.currency,
    'type', resolved.resolved_type,
    'isActive', target.is_active,
    'accNameAr', COALESCE(NULLIF(target.acc_name_ar, ''), NULLIF(resolved.data->>'accNameAr', ''), NULLIF(resolved.data->>'entityName', ''), target.id),
    'accNameEn', COALESCE(NULLIF(target.acc_name_en, ''), NULLIF(resolved.data->>'accNameEn', ''), NULLIF(resolved.data->>'entityName', ''), '')
  )
FROM resolved
WHERE target.id = resolved.id
  AND (
    target.acc_sub_id IS DISTINCT FROM resolved.resolved_acc_sub_id
    OR target.group_id IS DISTINCT FROM resolved.resolved_group_id
    OR target.account_seq IS DISTINCT FROM resolved.resolved_sequence
    OR target.cur_no IS DISTINCT FROM resolved.resolved_cur_no
    OR target.type IS DISTINCT FROM resolved.resolved_type
    OR target.data->>'accSubId' IS DISTINCT FROM resolved.resolved_acc_sub_id
    OR target.data->>'groupId' IS DISTINCT FROM resolved.resolved_group_id
    OR target.data->>'accountSeq' IS DISTINCT FROM resolved.resolved_sequence::text
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.accounts AS a
    LEFT JOIN public.acc_sub AS s ON s.id = a.acc_sub_id
    LEFT JOIN public.acc_sub_group AS g ON g.id = a.group_id
    LEFT JOIN public.currency AS c ON c.cur_id = a.cur_no
    LEFT JOIN public.acc_main AS m ON m.id = s.acc_main_id
    LEFT JOIN public.account AS r ON r.id = m.account_id
    WHERE s.id IS NULL
       OR (a.group_id IS NOT NULL AND g.acc_sub_id IS DISTINCT FROM a.acc_sub_id)
       OR c.cur_id IS NULL
       OR r.account_type IS DISTINCT FROM a.type
       OR a.account_seq IS DISTINCT FROM split_part(a.id, '-', 2)::integer
       OR a.data->>'accSubId' IS DISTINCT FROM a.acc_sub_id
       OR a.data->>'groupId' IS DISTINCT FROM a.group_id
       OR a.data->>'accountSeq' IS DISTINCT FROM a.account_seq::text
  ) THEN
    RAISE EXCEPTION 'Account hierarchy repair verification failed: at least one account still has inconsistent hierarchy metadata.';
  END IF;
END;
$$;

COMMIT;
