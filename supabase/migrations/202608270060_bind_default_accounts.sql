-- SwiftShip accounting hierarchy — default account bindings
-- Binds existing active system posting accounts by their stable entity_id values.
-- Does not create financial accounts, balances, rates, or transactions.

INSERT INTO public.default_accounts (id, default_key, account_id, acc_name_ar, acc_name_en, cur_no, is_active)
SELECT
  defaults.default_key,
  defaults.default_key,
  accounts.id,
  COALESCE(NULLIF(accounts.acc_name_ar, ''), NULLIF(accounts.data->>'entityName', ''), defaults.acc_name_ar),
  COALESCE(NULLIF(accounts.acc_name_en, ''), NULLIF(accounts.data->>'nameEn', ''), defaults.acc_name_en),
  accounts.cur_no,
  accounts.is_active
FROM (VALUES
  ('sys_cash_account', 'حساب الصندوق الرئيسي', 'Main cash account'),
  ('sys_orders_cost', 'حساب تكاليف الطلبات والشحن', 'Order and shipment cost account'),
  ('sys_profit_account', 'حساب أرباح الشركة', 'Company profit account'),
  ('sys_delivery_cost', 'حساب مصروفات التوصيل', 'Delivery expense account'),
  ('sys_sourcing_cost', 'حساب تكاليف التوريد والاستيراد', 'Sourcing and import cost account'),
  ('sys_packaging_fees', 'حساب رسوم التغليف والتعبئة', 'Packaging fees account'),
  ('sys_shipping_costs', 'حساب تكاليف الشحن الدولي', 'International shipping cost account'),
  ('sys_local_shipping', 'حساب تكاليف الشحن المحلي', 'Local shipping cost account')
) AS defaults(default_key, acc_name_ar, acc_name_en)
INNER JOIN public.accounts ON accounts.entity_id = defaults.default_key
  AND accounts.entity_type = 'system'
  AND accounts.is_active = true
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.default_accounts IS 'ربط حسابات النظام الورقية بمفاتيح قابلة للإدارة. لا تعتمد خدمات القيود على كود ثابت بعد إكمال الترحيل.';
