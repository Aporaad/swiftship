-- SwiftShip accounting hierarchy — phase 1
-- This migration is additive only. It creates the normalized hierarchy and
-- compatibility columns without rekeying accounts or changing any financial data.

CREATE TABLE IF NOT EXISTS public.account (
  id text PRIMARY KEY,
  account_code text NOT NULL UNIQUE,
  acc_name_ar text NOT NULL,
  acc_name_en text NOT NULL DEFAULT '',
  balance numeric NOT NULL DEFAULT 0,
  cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_balance_nonnegative_or_negative_allowed CHECK (balance IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.acc_main (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES public.account(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  account_code text NOT NULL UNIQUE,
  acc_name_ar text NOT NULL,
  acc_name_en text NOT NULL DEFAULT '',
  balance numeric NOT NULL DEFAULT 0,
  cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.acc_sub (
  id text PRIMARY KEY,
  acc_main_id text NOT NULL REFERENCES public.acc_main(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  account_code text NOT NULL UNIQUE,
  acc_name_ar text NOT NULL,
  acc_name_en text NOT NULL DEFAULT '',
  balance numeric NOT NULL DEFAULT 0,
  cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.acc_sub_group (
  id text PRIMARY KEY,
  acc_sub_id text NOT NULL REFERENCES public.acc_sub(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  account_code text NOT NULL UNIQUE,
  acc_name_ar text NOT NULL,
  acc_name_en text NOT NULL DEFAULT '',
  balance numeric NOT NULL DEFAULT 0,
  cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.default_accounts (
  id text PRIMARY KEY,
  default_key text NOT NULL UNIQUE,
  account_id text NOT NULL REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  acc_name_ar text NOT NULL,
  acc_name_en text NOT NULL DEFAULT '',
  cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS acc_sub_id text REFERENCES public.acc_sub(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS group_id text REFERENCES public.acc_sub_group(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS account_seq integer,
  ADD COLUMN IF NOT EXISTS acc_name_ar text,
  ADD COLUMN IF NOT EXISTS acc_name_en text,
  ADD COLUMN IF NOT EXISTS limited_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cur_no integer REFERENCES public.currency(cur_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lastRecalculatedAt" timestamptz;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_limited_balance_nonnegative,
  ADD CONSTRAINT accounts_limited_balance_nonnegative CHECK (limited_balance >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_account_code_unique_idx
  ON public.accounts (account_code)
  WHERE account_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS accounts_acc_sub_id_idx ON public.accounts (acc_sub_id);
CREATE INDEX IF NOT EXISTS accounts_group_id_idx ON public.accounts (group_id);
CREATE INDEX IF NOT EXISTS accounts_entity_type_entity_id_idx ON public.accounts (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS default_accounts_account_id_idx ON public.default_accounts (account_id);
CREATE INDEX IF NOT EXISTS acc_main_account_id_idx ON public.acc_main (account_id);
CREATE INDEX IF NOT EXISTS acc_sub_acc_main_id_idx ON public.acc_sub (acc_main_id);
CREATE INDEX IF NOT EXISTS acc_sub_group_acc_sub_id_idx ON public.acc_sub_group (acc_sub_id);

CREATE OR REPLACE FUNCTION public.accounting_touch_hierarchy_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_touch_account_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_updated_at ON public.account;
CREATE TRIGGER trg_account_updated_at
  BEFORE UPDATE ON public.account
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_hierarchy_updated_at();

DROP TRIGGER IF EXISTS trg_acc_main_updated_at ON public.acc_main;
CREATE TRIGGER trg_acc_main_updated_at
  BEFORE UPDATE ON public.acc_main
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_hierarchy_updated_at();

DROP TRIGGER IF EXISTS trg_acc_sub_updated_at ON public.acc_sub;
CREATE TRIGGER trg_acc_sub_updated_at
  BEFORE UPDATE ON public.acc_sub
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_hierarchy_updated_at();

DROP TRIGGER IF EXISTS trg_acc_sub_group_updated_at ON public.acc_sub_group;
CREATE TRIGGER trg_acc_sub_group_updated_at
  BEFORE UPDATE ON public.acc_sub_group
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_hierarchy_updated_at();

DROP TRIGGER IF EXISTS trg_default_accounts_updated_at ON public.default_accounts;
CREATE TRIGGER trg_default_accounts_updated_at
  BEFORE UPDATE ON public.default_accounts
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_hierarchy_updated_at();

DROP TRIGGER IF EXISTS trg_accounting_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounting_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_account_updated_at();

COMMENT ON TABLE public.account IS 'المستوى الرئيسي لشجرة الحسابات، مثل الأصول والخصوم والإيرادات والمصروفات.';
COMMENT ON TABLE public.acc_main IS 'المستوى الفرعي الأول لشجرة الحسابات.';
COMMENT ON TABLE public.acc_sub IS 'المستوى الفرعي الثاني لشجرة الحسابات.';
COMMENT ON TABLE public.acc_sub_group IS 'مجموعات حسابات اختيارية وقابلة للإدارة تحت الحساب الجزئي.';
COMMENT ON TABLE public.default_accounts IS 'مفاتيح الحسابات الافتراضية القابلة للإدارة وربطها بحسابات مالية ورقية فقط.';
COMMENT ON COLUMN public.accounts.cur_no IS 'مرجع عملة الحساب إلى currency.cur_id؛ يبقى accounts.currency النصي مؤقتًا للتوافق.';
COMMENT ON COLUMN public.accounts.limited_balance IS 'حد موجب للرصيد الطبيعي للحساب؛ الصفر يعني عدم وجود سقف.';
