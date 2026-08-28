-- يحفظ عامل التحويل الفعلي لكل ساق بعملة الحساب.
-- هذا الحقل صريح ويعتمد فقط على amount وamount_original المسجلين تاريخيًا؛ لا ينشئ سعر صرف أو قيدًا أو رصيدًا.

BEGIN;

ALTER TABLE public.account_trans
  ADD COLUMN IF NOT EXISTS conversion_rate numeric(18,8) NOT NULL DEFAULT 1;

UPDATE public.account_trans
SET conversion_rate = round(amount / amount_original, 8)
WHERE amount_original > 0
  AND conversion_rate IS DISTINCT FROM round(amount / amount_original, 8);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.account_trans
    WHERE conversion_rate IS NULL OR conversion_rate <= 0
  ) THEN
    RAISE EXCEPTION 'لا يمكن تثبيت conversion_rate: توجد ساق بلا مبالغ صالحة.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_trans_conversion_rate_positive'
      AND conrelid = 'public.account_trans'::regclass
  ) THEN
    ALTER TABLE public.account_trans
      ADD CONSTRAINT account_trans_conversion_rate_positive CHECK (conversion_rate > 0);
  END IF;
END;
$$;

COMMIT;
