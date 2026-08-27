-- SwiftShip accounting hierarchy — posting safeguards and hierarchy roll-up
-- The database remains the enforcement boundary. This migration does not enable or alter RLS.

ALTER TABLE public.account_transactions
  ADD COLUMN IF NOT EXISTS cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.salary_history
  ADD COLUMN IF NOT EXISTS cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.auto_entries
  ADD COLUMN IF NOT EXISTS cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT;

UPDATE public.account_transactions AS tx
SET cur_no = currency_row.cur_id
FROM public.currency AS currency_row
WHERE tx.cur_no IS NULL AND upper(tx.currency) = upper(currency_row.code);

UPDATE public.journal_entries AS entry
SET cur_no = currency_row.cur_id
FROM public.currency AS currency_row
WHERE entry.cur_no IS NULL AND upper(entry.data->>'currency') = upper(currency_row.code);

UPDATE public.expenses AS expense
SET cur_no = currency_row.cur_id
FROM public.currency AS currency_row
WHERE expense.cur_no IS NULL AND upper(expense.currency) = upper(currency_row.code);

UPDATE public.salary_history AS salary
SET cur_no = currency_row.cur_id
FROM public.currency AS currency_row
WHERE salary.cur_no IS NULL AND upper(salary.currency) = upper(currency_row.code);

UPDATE public.auto_entries AS rule
SET cur_no = currency_row.cur_id
FROM public.currency AS currency_row
WHERE rule.cur_no IS NULL AND NULLIF(rule.currency, '') IS NOT NULL AND upper(rule.currency) = upper(currency_row.code);

CREATE OR REPLACE FUNCTION public.accounting_system_currency_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT cur_id
  FROM public.currency
  WHERE "isDefault" = true AND "isActive" = true
  ORDER BY cur_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.accounting_to_system_currency(amount numeric, source_cur_no integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  system_cur_no integer := public.accounting_system_currency_id();
  rate numeric;
BEGIN
  IF system_cur_no IS NULL THEN
    RAISE EXCEPTION 'لا توجد عملة نظام افتراضية نشطة لتجميع أرصدة شجرة الحسابات.';
  END IF;
  IF source_cur_no IS NULL OR source_cur_no = system_cur_no THEN
    RETURN COALESCE(amount, 0);
  END IF;
  SELECT price INTO rate
  FROM public.cur_price
  WHERE cur_no = source_cur_no AND price > 0
  ORDER BY day_date DESC NULLS LAST, seq DESC NULLS LAST, id DESC
  LIMIT 1;
  IF rate IS NULL THEN
    RAISE EXCEPTION 'لا يوجد سعر صرف صالح للعملة % لتجميع أرصدة شجرة الحسابات.', source_cur_no;
  END IF;
  RETURN COALESCE(amount, 0) * rate;
END;
$$;

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
  IF resolved_sub_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN tx.type = 'Debit' THEN tx.amount ELSE -tx.amount END), 0)
  INTO normalized_balance
  FROM public.account_transactions tx
  JOIN public.accounts account ON account.id = p_account_id
  WHERE tx.account_id = p_account_id;

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

CREATE OR REPLACE FUNCTION public.enforce_account_transaction_posting_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account_record public.accounts%ROWTYPE;
  sub_allows_direct boolean;
  group_allows_direct boolean;
  current_normal_balance numeric;
  proposed_normal_balance numeric;
  normal_delta numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'لا يمكن ترحيل حركة مالية بمبلغ غير موجب.';
  END IF;
  IF NEW.type NOT IN ('Debit', 'Credit') THEN
    RAISE EXCEPTION 'نوع حركة الحساب يجب أن يكون Debit أو Credit.';
  END IF;

  SELECT * INTO account_record FROM public.accounts WHERE id = NEW.account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الحساب المالي % غير موجود.', NEW.account_id;
  END IF;
  IF account_record.is_active = false THEN
    RAISE EXCEPTION 'لا يمكن الترحيل إلى حساب مالي معطّل (%).', NEW.account_id;
  END IF;
  IF account_record.acc_sub_id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن الترحيل إلى عقد تنظيمي؛ اختر حسابًا ماليًا ورقيًا.';
  END IF;
  SELECT allows_direct_accounts INTO sub_allows_direct FROM public.acc_sub WHERE id = account_record.acc_sub_id;
  IF account_record.group_id IS NULL THEN
    IF COALESCE(sub_allows_direct, false) = false THEN
      RAISE EXCEPTION 'هذا الحساب لا يقع تحت مجموعة حسابات صالحة للترحيل.';
    END IF;
  ELSE
    SELECT allows_direct_accounts INTO group_allows_direct FROM public.acc_sub_group WHERE id = account_record.group_id;
    IF COALESCE(group_allows_direct, false) = false THEN
      RAISE EXCEPTION 'مجموعة الحساب غير مهيأة لقبول الحسابات المالية الورقية.';
    END IF;
  END IF;

  IF NEW.cur_no IS NULL THEN
    NEW.cur_no := account_record.cur_no;
  END IF;
  IF NEW.cur_no IS NULL OR NEW.cur_no <> account_record.cur_no THEN
    RAISE EXCEPTION 'مرجع عملة الحركة يجب أن يطابق عملة الحساب المالي.';
  END IF;

  IF account_record.limited_balance > 0 THEN
    SELECT COALESCE(SUM(CASE
      WHEN account_record.type IN ('Asset', 'Expense') AND tx.type = 'Debit' THEN tx.amount
      WHEN account_record.type IN ('Asset', 'Expense') AND tx.type = 'Credit' THEN -tx.amount
      WHEN account_record.type NOT IN ('Asset', 'Expense') AND tx.type = 'Credit' THEN tx.amount
      ELSE -tx.amount
    END), 0)
    INTO current_normal_balance
    FROM public.account_transactions tx
    WHERE tx.account_id = NEW.account_id
      AND (TG_OP <> 'UPDATE' OR tx.id <> OLD.id);

    normal_delta := CASE
      WHEN account_record.type IN ('Asset', 'Expense') AND NEW.type = 'Debit' THEN NEW.amount
      WHEN account_record.type IN ('Asset', 'Expense') AND NEW.type = 'Credit' THEN -NEW.amount
      WHEN account_record.type NOT IN ('Asset', 'Expense') AND NEW.type = 'Credit' THEN NEW.amount
      ELSE -NEW.amount
    END;
    proposed_normal_balance := current_normal_balance + normal_delta;
    IF proposed_normal_balance > account_record.limited_balance THEN
      RAISE EXCEPTION 'تجاوزت الحركة سقف الرصيد الطبيعي للحساب: % > %.', proposed_normal_balance, account_record.limited_balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_account_balance_after_transaction()
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

CREATE OR REPLACE FUNCTION public.enforce_default_account_posting_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account_record public.accounts%ROWTYPE;
BEGIN
  SELECT * INTO account_record FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND OR account_record.is_active = false OR account_record.acc_sub_id IS NULL THEN
    RAISE EXCEPTION 'الحساب الافتراضي يجب أن يشير إلى حساب مالي ورقي ونشط.';
  END IF;
  IF NEW.cur_no IS NULL THEN
    NEW.cur_no := account_record.cur_no;
  END IF;
  IF NEW.cur_no IS DISTINCT FROM account_record.cur_no THEN
    RAISE EXCEPTION 'عملة الحساب الافتراضي يجب أن تطابق عملة الحساب المالي المرتبط.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_transactions_before_posting ON public.account_transactions;
CREATE TRIGGER trg_account_transactions_before_posting
  BEFORE INSERT OR UPDATE OF account_id, type, amount, cur_no ON public.account_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_account_transaction_posting_rules();

DROP TRIGGER IF EXISTS trg_account_transactions_after_posting ON public.account_transactions;
CREATE TRIGGER trg_account_transactions_after_posting
  AFTER INSERT OR UPDATE OF account_id, type, amount, cur_no OR DELETE ON public.account_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance_after_transaction();

DROP TRIGGER IF EXISTS trg_default_accounts_posting_rules ON public.default_accounts;
CREATE TRIGGER trg_default_accounts_posting_rules
  BEFORE INSERT OR UPDATE OF account_id, cur_no ON public.default_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_default_account_posting_rules();

DO $$
DECLARE
  account_record record;
BEGIN
  FOR account_record IN SELECT id FROM public.accounts LOOP
    PERFORM public.recalculate_accounting_hierarchy(account_record.id);
  END LOOP;
END;
$$;
