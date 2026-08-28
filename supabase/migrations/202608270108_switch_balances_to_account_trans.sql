-- التحويل التشغيلي للأرصدة إلى النموذج الجديد.
-- الرصيد مصدره account_trans.amount للقيود main_entry المرحّلة فقط، باستثناء Temp.
-- لا يحذف أو يعدل أي سجل تاريخي ولا يغير RLS.

BEGIN;

CREATE OR REPLACE FUNCTION public.recalculate_accounting_hierarchy(p_account_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_sub_id text;
  resolved_main_id text;
  resolved_root_id text;
  normalized_balance numeric;
BEGIN
  SELECT acc_sub_id INTO resolved_sub_id FROM public.accounts WHERE id = p_account_id;
  IF resolved_sub_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(CASE WHEN tx.trans_type = 'Debit' THEN tx.amount ELSE -tx.amount END), 0)
  INTO normalized_balance
  FROM public.account_trans tx
  JOIN public.main_entry entry ON entry.id = tx.entry_id
  WHERE tx.account_id = p_account_id
    AND entry.posting_status = 'posted'
    AND entry.entry_category <> 'Temp';

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

CREATE OR REPLACE FUNCTION public.validate_financial_entry_account_limits(p_entry_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  impacted_account record;
  current_normal_balance numeric;
  entry_normal_delta numeric;
BEGIN
  FOR impacted_account IN
    SELECT a.id, a.type, a.limited_balance
    FROM public.accounts a
    JOIN public.account_trans tx ON tx.account_id = a.id
    WHERE tx.entry_id = p_entry_id
      AND a.limited_balance > 0
    GROUP BY a.id, a.type, a.limited_balance
  LOOP
    SELECT COALESCE(SUM(CASE
      WHEN impacted_account.type IN ('Asset', 'Expense') AND tx.trans_type = 'Debit' THEN tx.amount
      WHEN impacted_account.type IN ('Asset', 'Expense') AND tx.trans_type = 'Credit' THEN -tx.amount
      WHEN impacted_account.type NOT IN ('Asset', 'Expense') AND tx.trans_type = 'Credit' THEN tx.amount
      ELSE -tx.amount
    END), 0)
    INTO current_normal_balance
    FROM public.account_trans tx
    JOIN public.main_entry entry ON entry.id = tx.entry_id
    WHERE tx.account_id = impacted_account.id
      AND entry.posting_status = 'posted'
      AND entry.entry_category <> 'Temp';

    SELECT COALESCE(SUM(CASE
      WHEN impacted_account.type IN ('Asset', 'Expense') AND tx.trans_type = 'Debit' THEN tx.amount
      WHEN impacted_account.type IN ('Asset', 'Expense') AND tx.trans_type = 'Credit' THEN -tx.amount
      WHEN impacted_account.type NOT IN ('Asset', 'Expense') AND tx.trans_type = 'Credit' THEN tx.amount
      ELSE -tx.amount
    END), 0)
    INTO entry_normal_delta
    FROM public.account_trans tx
    WHERE tx.entry_id = p_entry_id
      AND tx.account_id = impacted_account.id;

    IF current_normal_balance + entry_normal_delta > impacted_account.limited_balance THEN
      RAISE EXCEPTION
        'ترحيل القيد يتجاوز سقف الرصيد الطبيعي للحساب %: % > %.',
        impacted_account.id, current_normal_balance + entry_normal_delta, impacted_account.limited_balance;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_main_entry_posting_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.posting_status = 'voided' AND NEW.posting_status <> 'voided' THEN
    RAISE EXCEPTION 'لا يمكن إعادة تفعيل قيد مُبطل؛ أنشئ قيدًا جديدًا أو قيدًا عكسيًا.';
  END IF;
  IF OLD.posting_status = 'posted' AND NEW.posting_status = 'draft' THEN
    RAISE EXCEPTION 'لا يمكن إعادة القيد المُرحّل إلى مسودة.';
  END IF;
  IF NEW.posting_status = 'posted' AND OLD.posting_status <> 'posted' THEN
    PERFORM public.validate_financial_entry_balance(NEW.id);
    IF NEW.entry_category <> 'Temp' THEN
      PERFORM public.validate_financial_entry_account_limits(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_account_balance_after_financial_trans()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.recalculate_accounting_hierarchy(COALESCE(NEW.account_id, OLD.account_id));
  IF TG_OP = 'UPDATE' AND NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    PERFORM public.recalculate_accounting_hierarchy(OLD.account_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_account_balances_after_entry_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account_record record;
BEGIN
  IF NEW.posting_status IS DISTINCT FROM OLD.posting_status THEN
    FOR account_record IN SELECT DISTINCT account_id FROM public.account_trans WHERE entry_id = NEW.id
    LOOP
      PERFORM public.recalculate_accounting_hierarchy(account_record.account_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_transactions_after_posting ON public.account_transactions;
DROP TRIGGER IF EXISTS trg_account_trans_after_balance_sync ON public.account_trans;
CREATE TRIGGER trg_account_trans_after_balance_sync
  AFTER INSERT OR UPDATE OF account_id, amount, trans_type, entry_id OR DELETE ON public.account_trans
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance_after_financial_trans();

DROP TRIGGER IF EXISTS trg_main_entry_after_posting_balance_sync ON public.main_entry;
CREATE TRIGGER trg_main_entry_after_posting_balance_sync
  AFTER UPDATE OF posting_status ON public.main_entry
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_balances_after_entry_status_change();

DO $$
DECLARE account_record record;
BEGIN
  FOR account_record IN SELECT id FROM public.accounts WHERE acc_sub_id IS NOT NULL LOOP
    PERFORM public.recalculate_accounting_hierarchy(account_record.id);
  END LOOP;
END;
$$;

COMMIT;
