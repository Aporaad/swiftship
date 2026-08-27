-- SwiftShip accounting hierarchy — account nature
-- The main account explicitly owns its accounting nature; descendants inherit it.

ALTER TABLE public.account
  ADD COLUMN IF NOT EXISTS account_type text;

UPDATE public.account
SET account_type = CASE account_code
  WHEN '1' THEN 'Asset'
  WHEN '2' THEN 'Liability'
  WHEN '3' THEN 'Equity'
  WHEN '4' THEN 'Revenue'
  WHEN '5' THEN 'Expense'
  ELSE account_type
END
WHERE account_type IS NULL;

ALTER TABLE public.account
  DROP CONSTRAINT IF EXISTS account_account_type_valid,
  ADD CONSTRAINT account_account_type_valid
    CHECK (account_type IS NULL OR account_type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense'));

COMMENT ON COLUMN public.account.account_type IS 'طبيعة الحساب الرئيسية؛ ترثها جميع الفروع والحسابات المالية التابعة.';
