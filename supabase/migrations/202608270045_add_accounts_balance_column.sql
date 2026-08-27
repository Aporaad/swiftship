-- SwiftShip accounting hierarchy — direct ledger balance
-- Keeps legacy JSON data intact while introducing the requested balance column.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.accounts.balance IS 'رصيد الحساب المالي بعملة الحساب؛ تمت مزامنته مبدئيًا من data.balance ثم يعاد احتسابه من القيود.';
