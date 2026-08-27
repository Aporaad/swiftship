-- SwiftShip accounting hierarchy — operating seed
-- Idempotent structure only: no financial accounts, opening balances, or journal entries are created here.
-- All seeded nodes remain editable from the accounting hierarchy UI.

WITH default_currency AS (
  SELECT cur_id FROM public.currency WHERE "isDefault" = true AND "isActive" = true ORDER BY cur_id LIMIT 1
)
INSERT INTO public.account (id, account_code, acc_name_ar, acc_name_en, cur_no, is_active)
SELECT seed.id, seed.account_code, seed.acc_name_ar, seed.acc_name_en, default_currency.cur_id, true
FROM default_currency
CROSS JOIN (VALUES
  ('1', '1', 'الأصول', 'Assets'),
  ('2', '2', 'الخصوم', 'Liabilities'),
  ('3', '3', 'حقوق الملكية', 'Equity'),
  ('4', '4', 'الإيرادات', 'Revenue'),
  ('5', '5', 'المصروفات', 'Expenses')
) AS seed(id, account_code, acc_name_ar, acc_name_en)
ON CONFLICT (id) DO NOTHING;

UPDATE public.account
SET account_type = CASE account_code
  WHEN '1' THEN 'Asset'
  WHEN '2' THEN 'Liability'
  WHEN '3' THEN 'Equity'
  WHEN '4' THEN 'Revenue'
  WHEN '5' THEN 'Expense'
  ELSE account_type
END
WHERE account_code IN ('1', '2', '3', '4', '5');

WITH default_currency AS (
  SELECT cur_id FROM public.currency WHERE "isDefault" = true AND "isActive" = true ORDER BY cur_id LIMIT 1
)
INSERT INTO public.acc_main (id, account_id, account_code, acc_name_ar, acc_name_en, cur_no, is_active)
SELECT seed.id, seed.account_id, seed.account_code, seed.acc_name_ar, seed.acc_name_en, default_currency.cur_id, true
FROM default_currency
CROSS JOIN (VALUES
  ('11', '1', '11', 'الأصول المتداولة والسيولة', 'Current assets and liquidity'),
  ('12', '1', '12', 'الأصول الثابتة والعهد العينية', 'Fixed assets and tangible custody'),
  ('21', '2', '21', 'الالتزامات التشغيلية المتداولة', 'Current operating liabilities'),
  ('31', '3', '31', 'رأس المال والأرباح المحتجزة', 'Capital and retained earnings'),
  ('41', '4', '41', 'إيرادات التشغيل والطلبات', 'Operating and order revenue'),
  ('51', '5', '51', 'تكاليف ومصروفات التشغيل', 'Operating costs and expenses')
) AS seed(id, account_id, account_code, acc_name_ar, acc_name_en)
ON CONFLICT (id) DO NOTHING;

WITH default_currency AS (
  SELECT cur_id FROM public.currency WHERE "isDefault" = true AND "isActive" = true ORDER BY cur_id LIMIT 1
)
INSERT INTO public.acc_sub (id, acc_main_id, account_code, acc_name_ar, acc_name_en, cur_no, is_active, allows_direct_accounts)
SELECT seed.id, seed.acc_main_id, seed.account_code, seed.acc_name_ar, seed.acc_name_en, default_currency.cur_id, true, false
FROM default_currency
CROSS JOIN (VALUES
  ('111', '11', '111', 'الصناديق النقدية', 'Cash boxes'),
  ('112', '11', '112', 'الحسابات البنكية', 'Bank accounts'),
  ('113', '11', '113', 'العملاء والذمم المدينة', 'Customers and receivables'),
  ('114', '11', '114', 'السلف والذمم التشغيلية', 'Operating advances and receivables'),
  ('115', '11', '115', 'تسويات وتكاليف الطلبات', 'Order settlements and costs'),
  ('121', '12', '121', 'الأصول الثابتة', 'Fixed assets'),
  ('122', '12', '122', 'إهلاك وتسويات الأصول', 'Asset depreciation and adjustments'),
  ('211', '21', '211', 'التزامات وتسويات تشغيلية', 'Operating liabilities and settlements'),
  ('212', '21', '212', 'حسابات المناديب', 'Courier accounts'),
  ('213', '21', '213', 'حسابات الموظفين', 'Employee accounts'),
  ('214', '21', '214', 'مصادر الطلبات والموردون', 'Order sources and suppliers'),
  ('215', '21', '215', 'شركات الشحن', 'Shipping companies'),
  ('311', '31', '311', 'رأس المال', 'Capital'),
  ('312', '31', '312', 'الأرباح والخسائر المحتجزة', 'Retained earnings and losses'),
  ('411', '41', '411', 'إيرادات الطلبات والشحن', 'Order and shipping revenue'),
  ('412', '41', '412', 'إيرادات ورسوم أخرى', 'Other revenue and fees'),
  ('511', '51', '511', 'مصروفات التشغيل العامة', 'General operating expenses'),
  ('512', '51', '512', 'الرواتب والمكافآت', 'Salaries and benefits'),
  ('513', '51', '513', 'تكاليف الشحن والتوصيل', 'Shipping and delivery costs'),
  ('514', '51', '514', 'تكاليف التوريد والاستيراد', 'Sourcing and import costs'),
  ('515', '51', '515', 'تكاليف التغليف والتعبئة', 'Packaging costs'),
  ('516', '51', '516', 'مصروفات إدارية متنوعة', 'Miscellaneous administrative expenses')
) AS seed(id, acc_main_id, account_code, acc_name_ar, acc_name_en)
ON CONFLICT (id) DO NOTHING;

WITH default_currency AS (
  SELECT cur_id FROM public.currency WHERE "isDefault" = true AND "isActive" = true ORDER BY cur_id LIMIT 1
)
INSERT INTO public.acc_sub_group (id, acc_sub_id, account_code, acc_name_ar, acc_name_en, cur_no, is_active, entity_type, allows_direct_accounts)
SELECT seed.id, seed.acc_sub_id, seed.account_code, seed.acc_name_ar, seed.acc_name_en, default_currency.cur_id, true, seed.entity_type, true
FROM default_currency
CROSS JOIN (VALUES
  ('1111', '111', '1111', 'الصناديق والخزائن', 'Cash boxes and safes', NULL::text),
  ('1121', '112', '1121', 'الحسابات البنكية', 'Bank accounts', NULL::text),
  ('1132', '113', '1132', 'العملاء', 'Customers', 'customer'),
  ('1141', '114', '1141', 'السلف والذمم الأخرى', 'Advances and other receivables', NULL::text),
  ('1151', '115', '1151', 'تسويات الطلبات', 'Order settlements', NULL::text),
  ('1211', '121', '1211', 'الأصول الثابتة', 'Fixed assets', 'asset'),
  ('1221', '122', '1221', 'إهلاك وتسويات الأصول', 'Asset depreciation and adjustments', NULL::text),
  ('2111', '211', '2111', 'التزامات تشغيلية عامة', 'General operating liabilities', NULL::text),
  ('2121', '212', '2121', 'المناديب', 'Couriers', 'courier'),
  ('2131', '213', '2131', 'الموظفون', 'Employees', 'employee'),
  ('2141', '214', '2141', 'مصادر الطلبات', 'Order sources', 'source'),
  ('2151', '215', '2151', 'شركات الشحن', 'Shipping companies', 'shipping_company'),
  ('3111', '311', '3111', 'رأس المال', 'Capital', NULL::text),
  ('3121', '312', '3121', 'الأرباح والخسائر المحتجزة', 'Retained earnings and losses', NULL::text),
  ('4111', '411', '4111', 'إيرادات الطلبات والشحن', 'Order and shipping revenue', NULL::text),
  ('4121', '412', '4121', 'إيرادات ورسوم أخرى', 'Other revenue and fees', NULL::text),
  ('5111', '511', '5111', 'مصروفات التشغيل العامة', 'General operating expenses', NULL::text),
  ('5121', '512', '5121', 'الرواتب والمكافآت', 'Salaries and benefits', NULL::text),
  ('5131', '513', '5131', 'تكاليف الشحن والتوصيل', 'Shipping and delivery costs', NULL::text),
  ('5141', '514', '5141', 'تكاليف التوريد والاستيراد', 'Sourcing and import costs', NULL::text),
  ('5151', '515', '5151', 'تكاليف التغليف والتعبئة', 'Packaging costs', NULL::text),
  ('5161', '516', '5161', 'مصروفات إدارية متنوعة', 'Miscellaneous administrative expenses', NULL::text)
) AS seed(id, acc_sub_id, account_code, acc_name_ar, acc_name_en, entity_type)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.account IS 'تضم البذور الهيكل التشغيلي الأولي فقط؛ يجوز للإدارة إضافة العقد أو تعديلها من الواجهة دون حذف الحسابات المرتبطة.';
