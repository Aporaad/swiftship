-- يعيد هذا الترحيل فقط إسناد accounts.cur_no للحسابات الورقية من accounts.currency.
-- لا ينشئ أرصدة أو قيوداً أو أسعار صرف، ولا يغير RLS أو يحذف أي سجل.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.accounts a
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS currency_matches, MIN(c.cur_id) AS cur_id
      FROM public.currency c
      WHERE c.code = a.currency
    ) resolved_currency ON true
    WHERE a.acc_sub_id IS NOT NULL
      AND a.cur_no IS NULL
      AND resolved_currency.currency_matches <> 1
  ) THEN
    RAISE EXCEPTION 'تعذر إسناد cur_no بأمان: يوجد حساب ورقي بلا رمز عملة وحيد مطابق في currency.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounts a
    LEFT JOIN public.currency c ON c.code = a.currency
    WHERE a.acc_sub_id IS NOT NULL
      AND a.cur_no IS NOT NULL
      AND c.cur_id IS DISTINCT FROM a.cur_no
  ) THEN
    RAISE EXCEPTION 'تعذر إسناد cur_no بأمان: يوجد حساب ورقي يتعارض مرجع عملته الحالي مع رمز العملة الصريح.';
  END IF;
END;
$$;

UPDATE public.accounts a
SET cur_no = c.cur_id
FROM public.currency c
WHERE a.acc_sub_id IS NOT NULL
  AND a.cur_no IS NULL
  AND c.code = a.currency;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.accounts a
    LEFT JOIN public.currency c ON c.cur_id = a.cur_no
    WHERE a.acc_sub_id IS NOT NULL
      AND (a.cur_no IS NULL OR c.cur_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'فشل تحقق ترحيل عملات الحسابات الورقية.';
  END IF;
END;
$$;

COMMIT;
