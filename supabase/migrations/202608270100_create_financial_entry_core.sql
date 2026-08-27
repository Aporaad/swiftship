-- SwiftShip financial entries v2 — المرحلة الأولى: المخطط المرجعي فقط.
-- لا ينقل هذا الترحيل أو يحذف أي سجل من journal_entries أو account_transactions أو expenses.
-- الجداول المالية الجديدة لا تحتوي على حقل data؛ جميع الحقول المالية الأساسية أعمدة صريحة.

BEGIN;

CREATE TABLE IF NOT EXISTS public.entry_module (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT entry_module_code_nonempty CHECK (btrim(code) <> ''),
  CONSTRAINT entry_module_name_ar_nonempty CHECK (btrim(name_ar) <> ''),
  CONSTRAINT entry_module_name_en_nonempty CHECK (btrim(name_en) <> '')
);

CREATE TABLE IF NOT EXISTS public.entry_type (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  module_id text NOT NULL REFERENCES public.entry_module(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT entry_type_code_nonempty CHECK (btrim(code) <> ''),
  CONSTRAINT entry_type_name_ar_nonempty CHECK (btrim(name_ar) <> ''),
  CONSTRAINT entry_type_name_en_nonempty CHECK (btrim(name_en) <> '')
);

CREATE TABLE IF NOT EXISTS public.main_entry (
  id text PRIMARY KEY,
  entry_number text NOT NULL UNIQUE,
  module_id text NOT NULL REFERENCES public.entry_module(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  entry_type_id text NOT NULL REFERENCES public.entry_type(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  entry_category text NOT NULL CHECK (entry_category IN ('General', 'Compound', 'Temp', 'Reversing')),
  posting_status text NOT NULL DEFAULT 'draft' CHECK (posting_status IN ('draft', 'posted', 'voided')),
  amount_original numeric(18,4) NOT NULL CHECK (amount_original > 0),
  amount_text text NOT NULL DEFAULT '',
  currency_original_no integer NOT NULL REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  currency_price_id integer REFERENCES public.cur_price(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  description text NOT NULL CHECK (btrim(description) <> ''),
  notes text NOT NULL DEFAULT '',
  attachments text[] NOT NULL DEFAULT ARRAY[]::text[],
  payment_method text CHECK (payment_method IN ('cash', 'bank', 'mixed', 'deferred')),
  order_id text REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  shipment_id text REFERENCES public.shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  custody_id text,
  automation_key text,
  auto_rule_id text,
  is_automatic boolean NOT NULL DEFAULT false,
  reverses_entry_id text REFERENCES public.main_entry(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  effective_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  posted_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  voided_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT main_entry_number_nonempty CHECK (btrim(entry_number) <> ''),
  CONSTRAINT main_entry_reversal_not_self CHECK (reverses_entry_id IS NULL OR reverses_entry_id <> id),
  CONSTRAINT main_entry_posted_metadata CHECK (
    (posting_status <> 'posted') OR (posted_at IS NOT NULL)
  ),
  CONSTRAINT main_entry_voided_metadata CHECK (
    (posting_status <> 'voided') OR (voided_at IS NOT NULL)
  ),
  CONSTRAINT main_entry_automatic_key CHECK (
    (is_automatic = false) OR (automation_key IS NOT NULL AND btrim(automation_key) <> '')
  )
);

CREATE TABLE IF NOT EXISTS public.account_trans (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES public.main_entry(id) ON UPDATE CASCADE ON DELETE CASCADE,
  line_no integer NOT NULL CHECK (line_no > 0),
  trans_type text NOT NULL CHECK (trans_type IN ('Debit', 'Credit')),
  account_id text NOT NULL REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  account_cur_no integer NOT NULL REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  amount_original numeric(18,4) NOT NULL CHECK (amount_original > 0),
  currency_original_no integer NOT NULL REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  currency_price_id integer REFERENCES public.cur_price(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  payment_method text CHECK (payment_method IN ('cash', 'bank', 'mixed', 'deferred')),
  order_id text REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  shipment_id text REFERENCES public.shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  custody_id text,
  auto_rule_id text,
  automation_key text,
  description text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT account_trans_entry_line_unique UNIQUE (entry_id, line_no)
);

CREATE TABLE IF NOT EXISTS public.custody_advances (
  id text PRIMARY KEY,
  custody_number text NOT NULL UNIQUE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('employee', 'courier', 'customer', 'supplier', 'other')),
  recipient_id text NOT NULL,
  recipient_name text NOT NULL,
  recipient_account_id text NOT NULL REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount_original numeric(18,4) NOT NULL CHECK (amount_original > 0),
  currency_original_no integer NOT NULL REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  currency_price_id integer REFERENCES public.cur_price(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount_settled numeric(18,4) NOT NULL DEFAULT 0 CHECK (amount_settled >= 0),
  amount_outstanding numeric(18,4) NOT NULL CHECK (amount_outstanding >= 0),
  status text NOT NULL CHECK (status IN ('open', 'partial', 'settled', 'cancelled')),
  issued_entry_id text REFERENCES public.main_entry(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  settlement_entry_id text REFERENCES public.main_entry(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  note text NOT NULL DEFAULT '',
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  settled_at timestamptz,
  settled_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT custody_number_nonempty CHECK (btrim(custody_number) <> ''),
  CONSTRAINT custody_amounts_valid CHECK (amount_settled + amount_outstanding = amount_original),
  CONSTRAINT custody_status_amounts_valid CHECK (
    (status = 'open' AND amount_settled = 0 AND amount_outstanding = amount_original)
    OR (status = 'partial' AND amount_settled > 0 AND amount_outstanding > 0)
    OR (status = 'settled' AND amount_outstanding = 0 AND amount_settled = amount_original)
    OR (status = 'cancelled')
  )
);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_custody_id_fkey
  FOREIGN KEY (custody_id) REFERENCES public.custody_advances(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.account_trans
  ADD CONSTRAINT account_trans_custody_id_fkey
  FOREIGN KEY (custody_id) REFERENCES public.custody_advances(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.financial_legacy_migration_map (
  legacy_table text NOT NULL,
  legacy_id text NOT NULL,
  target_table text NOT NULL,
  target_id text NOT NULL,
  migration_status text NOT NULL CHECK (migration_status IN ('staged', 'migrated', 'exception', 'verified')),
  migrated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  PRIMARY KEY (legacy_table, legacy_id),
  CONSTRAINT migration_map_legacy_table_nonempty CHECK (btrim(legacy_table) <> ''),
  CONSTRAINT migration_map_target_table_nonempty CHECK (btrim(target_table) <> '')
);

CREATE TABLE IF NOT EXISTS public.financial_migration_exceptions (
  id text PRIMARY KEY,
  legacy_table text NOT NULL,
  legacy_id text NOT NULL,
  exception_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'blocking')),
  description text NOT NULL,
  resolution_status text NOT NULL DEFAULT 'open' CHECK (resolution_status IN ('open', 'resolved', 'ignored')),
  resolved_by_uid text REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT migration_exception_unique UNIQUE (legacy_table, legacy_id, exception_code),
  CONSTRAINT migration_exception_table_nonempty CHECK (btrim(legacy_table) <> ''),
  CONSTRAINT migration_exception_code_nonempty CHECK (btrim(exception_code) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS main_entry_automation_key_unique_idx
  ON public.main_entry (automation_key)
  WHERE automation_key IS NOT NULL AND btrim(automation_key) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS main_entry_reversal_unique_idx
  ON public.main_entry (reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS entry_type_module_idx ON public.entry_type (module_id, is_active);
CREATE INDEX IF NOT EXISTS main_entry_filter_idx ON public.main_entry (module_id, entry_type_id, posting_status, effective_at DESC);
CREATE INDEX IF NOT EXISTS main_entry_order_idx ON public.main_entry (order_id, effective_at DESC) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS main_entry_shipment_idx ON public.main_entry (shipment_id, effective_at DESC) WHERE shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS account_trans_account_idx ON public.account_trans (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS account_trans_entry_idx ON public.account_trans (entry_id, line_no);
CREATE INDEX IF NOT EXISTS account_trans_order_idx ON public.account_trans (order_id, created_at DESC) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS account_trans_shipment_idx ON public.account_trans (shipment_id, created_at DESC) WHERE shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS custody_advances_recipient_idx ON public.custody_advances (recipient_type, recipient_id, status);

CREATE OR REPLACE FUNCTION public.financial_entry_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_main_entry_type_module()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  type_module_id text;
BEGIN
  SELECT module_id INTO type_module_id FROM public.entry_type WHERE id = NEW.entry_type_id;
  IF type_module_id IS NULL OR type_module_id <> NEW.module_id THEN
    RAISE EXCEPTION 'نوع القيد المحدد لا ينتمي إلى فئة القيد المحددة.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_account_trans_posting_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account_record public.accounts%ROWTYPE;
BEGIN
  SELECT * INTO account_record FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND OR account_record.is_active = false OR account_record.acc_sub_id IS NULL THEN
    RAISE EXCEPTION 'يمكن الترحيل فقط إلى حساب مالي ورقي ونشط.';
  END IF;
  IF account_record.cur_no IS NULL OR NEW.account_cur_no <> account_record.cur_no THEN
    RAISE EXCEPTION 'مرجع عملة سطر القيد يجب أن يطابق عملة الحساب المالي.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entry_module_updated_at ON public.entry_module;
CREATE TRIGGER trg_entry_module_updated_at BEFORE UPDATE ON public.entry_module
FOR EACH ROW EXECUTE FUNCTION public.financial_entry_set_updated_at();
DROP TRIGGER IF EXISTS trg_entry_type_updated_at ON public.entry_type;
CREATE TRIGGER trg_entry_type_updated_at BEFORE UPDATE ON public.entry_type
FOR EACH ROW EXECUTE FUNCTION public.financial_entry_set_updated_at();
DROP TRIGGER IF EXISTS trg_main_entry_updated_at ON public.main_entry;
CREATE TRIGGER trg_main_entry_updated_at BEFORE UPDATE ON public.main_entry
FOR EACH ROW EXECUTE FUNCTION public.financial_entry_set_updated_at();
DROP TRIGGER IF EXISTS trg_account_trans_updated_at ON public.account_trans;
CREATE TRIGGER trg_account_trans_updated_at BEFORE UPDATE ON public.account_trans
FOR EACH ROW EXECUTE FUNCTION public.financial_entry_set_updated_at();
DROP TRIGGER IF EXISTS trg_custody_advances_updated_at ON public.custody_advances;
CREATE TRIGGER trg_custody_advances_updated_at BEFORE UPDATE ON public.custody_advances
FOR EACH ROW EXECUTE FUNCTION public.financial_entry_set_updated_at();
DROP TRIGGER IF EXISTS trg_financial_migration_exceptions_updated_at ON public.financial_migration_exceptions;
CREATE TRIGGER trg_financial_migration_exceptions_updated_at BEFORE UPDATE ON public.financial_migration_exceptions
FOR EACH ROW EXECUTE FUNCTION public.financial_entry_set_updated_at();
DROP TRIGGER IF EXISTS trg_main_entry_type_module ON public.main_entry;
CREATE TRIGGER trg_main_entry_type_module BEFORE INSERT OR UPDATE OF module_id, entry_type_id ON public.main_entry
FOR EACH ROW EXECUTE FUNCTION public.validate_main_entry_type_module();
DROP TRIGGER IF EXISTS trg_account_trans_posting_target ON public.account_trans;
CREATE TRIGGER trg_account_trans_posting_target BEFORE INSERT OR UPDATE OF account_id, account_cur_no ON public.account_trans
FOR EACH ROW EXECUTE FUNCTION public.validate_account_trans_posting_target();

INSERT INTO public.entry_module (id, code, name_ar, name_en, note) VALUES
  ('module_accounting', 'ACCOUNTING', 'المحاسبة', 'Accounting', 'القيود المحاسبية العامة والتعديلات.'),
  ('module_settlements', 'SETTLEMENTS', 'التسويات', 'Settlements', 'تسويات الأطراف والحسابات.'),
  ('module_receipts', 'RECEIPTS', 'المقبوضات', 'Receipts', 'سندات قبض المبالغ.'),
  ('module_payments', 'PAYMENTS', 'الصرف', 'Payments', 'سندات صرف المبالغ.'),
  ('module_exchange', 'EXCHANGE', 'الصرافة', 'Currency exchange', 'عمليات الصرف وتحويل العملات.'),
  ('module_orders', 'ORDERS', 'الطلبات', 'Orders', 'قيود قيمة الطلبات ودفعاتها.'),
  ('module_order_returns', 'ORDER_RETURNS', 'مردودات الطلبات', 'Order returns', 'قيود مردودات الطلبات.'),
  ('module_purchases', 'PURCHASES', 'المشتريات', 'Purchases', 'قيود المشتريات.'),
  ('module_purchase_returns', 'PURCHASE_RETURNS', 'مردودات المشتريات', 'Purchase returns', 'قيود مردودات المشتريات.'),
  ('module_shipping', 'SHIPPING', 'الشحن', 'Shipping', 'قيمة الشحن ومصاريفه ومرتجعاته.'),
  ('module_salaries', 'SALARIES', 'الرواتب', 'Salaries', 'استحقاق وصرف الرواتب.'),
  ('module_custody', 'CUSTODY', 'العهد', 'Custody', 'العهد والسلف وتسوياتها.'),
  ('module_expenses', 'EXPENSES', 'المصروفات', 'Expenses', 'المصروفات التشغيلية.'),
  ('module_production', 'PRODUCTION', 'الإنتاج', 'Production', 'تكاليف وعمليات الإنتاج.'),
  ('module_services', 'SERVICES', 'الخدمات', 'Services', 'الخدمات والرسوم ذات الصلة.')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code, name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en, note = EXCLUDED.note;

INSERT INTO public.entry_type (id, code, module_id, name_ar, name_en, note) VALUES
  ('type_daily_journal', 'DAILY_JOURNAL', 'module_accounting', 'قيد يومية', 'Daily journal entry', 'قيد محاسبي عام.'),
  ('type_adjustment', 'ADJUSTMENT', 'module_accounting', 'قيد تعديل', 'Adjustment entry', 'تصحيح أو تعديل محاسبي.'),
  ('type_reversing', 'REVERSING', 'module_accounting', 'قيد عكسي', 'Reversing entry', 'عكس قيد مرحل.'),
  ('type_settlement', 'SETTLEMENT', 'module_settlements', 'قيد تسوية', 'Settlement entry', 'تسوية رصيد طرف أو حساب.'),
  ('type_receipt', 'RECEIPT_VOUCHER', 'module_receipts', 'سند قبض', 'Receipt voucher', 'استلام نقد أو بنك أو دفعة مختلطة.'),
  ('type_payment', 'PAYMENT_VOUCHER', 'module_payments', 'سند صرف', 'Payment voucher', 'صرف نقد أو بنك أو دفعة مختلطة.'),
  ('type_exchange', 'CURRENCY_EXCHANGE', 'module_exchange', 'قيد صرافة', 'Currency exchange entry', 'تحويل بين عملتين أو حسابي عملة.'),
  ('type_order_value', 'ORDER_VALUE', 'module_orders', 'قيد قيمة طلب', 'Order value entry', 'إثبات قيمة الطلب.'),
  ('type_order_payment', 'ORDER_PAYMENT', 'module_orders', 'دفعة طلب', 'Order payment entry', 'إثبات دفعة مرتبطة بطلب.'),
  ('type_order_return', 'ORDER_RETURN', 'module_order_returns', 'قيد مرتجع طلب', 'Order return entry', 'إثبات مردود طلب.'),
  ('type_purchase', 'PURCHASE', 'module_purchases', 'قيد شراء', 'Purchase entry', 'إثبات شراء.'),
  ('type_purchase_return', 'PURCHASE_RETURN', 'module_purchase_returns', 'قيد مرتجع شراء', 'Purchase return entry', 'إثبات مردود شراء.'),
  ('type_shipment_value', 'SHIPMENT_VALUE', 'module_shipping', 'قيد قيمة شحنة', 'Shipment value entry', 'إثبات قيمة شحنة.'),
  ('type_shipment_return', 'SHIPMENT_RETURN', 'module_shipping', 'قيد مرتجع شحنة', 'Shipment return entry', 'إثبات مرتجع شحنة.'),
  ('type_shipping_expense', 'SHIPPING_EXPENSE', 'module_shipping', 'قيد مصاريف شحن', 'Shipping expense entry', 'إثبات مصاريف الشحن.'),
  ('type_salary_accrual', 'SALARY_ACCRUAL', 'module_salaries', 'استحقاق راتب', 'Salary accrual entry', 'إثبات استحقاق راتب.'),
  ('type_salary_payment', 'SALARY_PAYMENT', 'module_salaries', 'صرف راتب', 'Salary payment entry', 'إثبات صرف راتب.'),
  ('type_custody_issue', 'CUSTODY_ISSUE', 'module_custody', 'إنشاء عهدة أو سلفة', 'Custody issue entry', 'إصدار عهدة أو سلفة.'),
  ('type_custody_settlement', 'CUSTODY_SETTLEMENT', 'module_custody', 'تسوية عهدة أو سلفة', 'Custody settlement entry', 'تسوية عهدة أو سلفة.'),
  ('type_expense', 'OPERATING_EXPENSE', 'module_expenses', 'قيد مصروف', 'Operating expense entry', 'إثبات مصروف تشغيلي.'),
  ('type_production_cost', 'PRODUCTION_COST', 'module_production', 'قيد تكلفة إنتاج', 'Production cost entry', 'إثبات تكلفة إنتاج.'),
  ('type_service_charge', 'SERVICE_CHARGE', 'module_services', 'قيد خدمة', 'Service charge entry', 'إثبات رسوم خدمة.')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code, module_id = EXCLUDED.module_id, name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en, note = EXCLUDED.note;

COMMIT;
