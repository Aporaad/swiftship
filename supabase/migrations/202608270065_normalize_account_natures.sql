-- SwiftShip accounting hierarchy — normalize posting-account nature
-- Aligns legacy accounts.type with their classified root, without altering account balances or transactions.

UPDATE public.accounts
SET type = CASE
  WHEN acc_sub_id IN ('111', '112', '113', '114', '115', '121', '122') THEN 'Asset'
  WHEN acc_sub_id IN ('211', '212', '213', '214', '215') THEN 'Liability'
  WHEN acc_sub_id IN ('311', '312') THEN 'Equity'
  WHEN acc_sub_id IN ('411', '412') THEN 'Revenue'
  WHEN acc_sub_id IN ('511', '512', '513', '514', '515', '516') THEN 'Expense'
  ELSE type
END
WHERE acc_sub_id IS NOT NULL;

COMMENT ON COLUMN public.accounts.type IS 'طبيعة الحساب المالي، موحّدة مع الحساب الرئيسي في الشجرة لا مع تصنيف تاريخي مستقل.';
