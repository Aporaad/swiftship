-- حذف دائم ومؤكد من المستخدم للنطاق المحدد فقط.
-- يحذف 44 سطر account_transactions مرتبطاً مباشرة بـ expenses عبر refNumber، ثم 31 صفاً من expenses.
-- لا يحذف journal_entries أو main_entry أو account_trans أو activity_logs، ولا يغير RLS.

BEGIN;

CREATE TEMP TABLE confirmed_expense_delete_scope ON COMMIT DROP AS
SELECT id, expense_number
FROM public.expenses;

CREATE TEMP TABLE confirmed_legacy_transaction_delete_scope ON COMMIT DROP AS
SELECT DISTINCT at.id
FROM public.account_transactions at
JOIN confirmed_expense_delete_scope e
  ON e.expense_number IS NOT NULL
  AND e.expense_number = NULLIF(btrim(at.data->>'refNumber'), '');

DO $$
DECLARE
  expense_count integer;
  transaction_count integer;
BEGIN
  SELECT COUNT(*) INTO expense_count FROM confirmed_expense_delete_scope;
  SELECT COUNT(*) INTO transaction_count FROM confirmed_legacy_transaction_delete_scope;

  IF expense_count <> 31 OR transaction_count <> 44 THEN
    RAISE EXCEPTION
      'أوقف الحذف: النطاق تغيّر منذ تأكيد المستخدم (expenses: %، account_transactions: %).',
      expense_count, transaction_count;
  END IF;
END;
$$;

DELETE FROM public.account_transactions at
USING confirmed_legacy_transaction_delete_scope scope
WHERE at.id = scope.id;

DELETE FROM public.expenses e
USING confirmed_expense_delete_scope scope
WHERE e.id = scope.id;

DO $$
DECLARE
  remaining_expenses integer;
  remaining_transactions integer;
BEGIN
  SELECT COUNT(*) INTO remaining_expenses FROM public.expenses;
  SELECT COUNT(*) INTO remaining_transactions
  FROM public.account_transactions at
  JOIN confirmed_legacy_transaction_delete_scope scope ON scope.id = at.id;

  IF remaining_expenses <> 0 OR remaining_transactions <> 0 THEN
    RAISE EXCEPTION
      'فشل تحقق الحذف: بقي % من expenses و% من أسطر account_transactions في النطاق.',
      remaining_expenses, remaining_transactions;
  END IF;
END;
$$;

COMMIT;
