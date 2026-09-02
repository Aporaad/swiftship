-- Migration: 202609020001_enforce_posted_status_filter_on_balances.sql
-- Description: Enforce strict posting_status = 'posted' requirement for recalculate_accounting_hierarchy (including Temp category entries when posted)

BEGIN;

CREATE OR REPLACE FUNCTION public.recalculate_accounting_hierarchy(p_account_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  resolved_sub_id text;
  resolved_main_id text;
  resolved_root_id text;
  normalized_balance numeric;
BEGIN
  IF p_account_id IS NULL OR btrim(p_account_id) = '' THEN
    RETURN;
  END IF;

  SELECT acc_sub_id INTO resolved_sub_id FROM public.accounts WHERE id = p_account_id;
  IF resolved_sub_id IS NULL THEN RETURN; END IF;

  -- حساب صافي رصيد الحركة من أسطر account_trans المشروطة بـ posting_status = 'posted' (استبعاد draft فقط)
  SELECT COALESCE(SUM(CASE WHEN tx.trans_type = 'Debit' THEN tx.amount ELSE -tx.amount END), 0)
  INTO normalized_balance
  FROM public.account_trans tx
  LEFT JOIN public.main_entry entry ON entry.id = tx.entry_id
  WHERE tx.account_id = p_account_id
    AND (
      tx.entry_id IS NULL
      OR (
        entry.id IS NOT NULL
        AND entry.posting_status = 'posted'
      )
    );

  UPDATE public.accounts account
  SET balance = CASE
      WHEN account.type IN ('Asset', 'Expense') THEN normalized_balance
      ELSE -normalized_balance
    END,
    "lastRecalculatedAt" = now()
  WHERE account.id = p_account_id;

  SELECT acc_main_id INTO resolved_main_id FROM public.acc_sub WHERE id = resolved_sub_id;
  SELECT account_id INTO resolved_root_id FROM public.acc_main WHERE id = resolved_main_id;

  UPDATE public.acc_sub_group group_node
  SET balance = COALESCE((
    SELECT SUM(public.accounting_to_system_currency(account.balance, account.cur_no))
    FROM public.accounts account
    WHERE account.group_id = group_node.id
  ), 0)
  WHERE group_node.acc_sub_id = resolved_sub_id;

  UPDATE public.acc_sub sub_node
  SET balance = COALESCE((
    SELECT SUM(public.accounting_to_system_currency(account.balance, account.cur_no))
    FROM public.accounts account
    WHERE account.acc_sub_id = sub_node.id
  ), 0)
  WHERE sub_node.id = resolved_sub_id;

  UPDATE public.acc_main main_node
  SET balance = COALESCE((
    SELECT SUM(public.accounting_to_system_currency(account.balance, account.cur_no))
    FROM public.accounts account
    JOIN public.acc_sub sub_node ON sub_node.id = account.acc_sub_id
    WHERE sub_node.acc_main_id = main_node.id
  ), 0)
  WHERE main_node.id = resolved_main_id;

  UPDATE public.account root_node
  SET balance = COALESCE((
    SELECT SUM(public.accounting_to_system_currency(account.balance, account.cur_no))
    FROM public.accounts account
    JOIN public.acc_sub sub_node ON sub_node.id = account.acc_sub_id
    JOIN public.acc_main main_node ON main_node.id = sub_node.acc_main_id
    WHERE main_node.account_id = root_node.id
  ), 0)
  WHERE root_node.id = resolved_root_id;
END;
$$;

COMMIT;
