-- SwiftShip accounting hierarchy — entity group binding support
-- Allows administrators to manage which optional account group receives each
-- entity type, while preserving direct leaf accounts under acc_sub when needed.

ALTER TABLE public.acc_sub_group
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS allows_direct_accounts boolean NOT NULL DEFAULT true;

ALTER TABLE public.acc_sub
  ADD COLUMN IF NOT EXISTS allows_direct_accounts boolean NOT NULL DEFAULT false;

ALTER TABLE public.acc_sub_group
  DROP CONSTRAINT IF EXISTS acc_sub_group_entity_type_valid,
  ADD CONSTRAINT acc_sub_group_entity_type_valid
    CHECK (entity_type IS NULL OR entity_type IN ('customer', 'employee', 'courier', 'source', 'shipping_company', 'asset', 'system'));

CREATE UNIQUE INDEX IF NOT EXISTS acc_sub_group_entity_type_unique_idx
  ON public.acc_sub_group (entity_type)
  WHERE entity_type IS NOT NULL;

COMMENT ON COLUMN public.acc_sub_group.entity_type IS 'ربط اختياري قابل للإدارة يحدد مجموعة الإنشاء التلقائي لكل نوع كيان.';
COMMENT ON COLUMN public.acc_sub_group.allows_direct_accounts IS 'يسمح بإنشاء حسابات مالية ورقية مباشرةً تحت المجموعة.';
COMMENT ON COLUMN public.acc_sub.allows_direct_accounts IS 'يسمح بإنشاء حسابات مالية ورقية مباشرةً تحت الحساب الجزئي عند عدم اختيار مجموعة.';
