-- Migration 202609270008
-- Phase 8 completion: canonical portal_users link map.
-- Preserve unresolved legacy references in a dedicated audit table; do not invent links.

BEGIN;

CREATE TABLE IF NOT EXISTS public.portal_user_migration_map (
  portal_user_id text PRIMARY KEY REFERENCES public.portal_users(portal_user_id),
  legacy_linked_acc_id text,
  legacy_linked_customer_id text,
  legacy_financial_account_id text,
  legacy_financial_account_code text,
  resolved_customer_id text,
  resolved_account_id text,
  resolution_status text NOT NULL,
  resolution_note text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_user_migration_map_status_check CHECK (resolution_status IN ('resolved','unresolved','no_link'))
);

ALTER TABLE public.portal_users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS account_id text,
  ADD COLUMN IF NOT EXISTS linked_customer_id text,
  ADD COLUMN IF NOT EXISTS is_disabled boolean;

INSERT INTO public.portal_user_migration_map (
  portal_user_id, legacy_linked_acc_id, legacy_linked_customer_id,
  legacy_financial_account_id, legacy_financial_account_code,
  resolved_customer_id, resolved_account_id, resolution_status, resolution_note
)
SELECT
  p.portal_user_id,
  p.linked_acc_id,
  p.data ->> 'linkedAccId',
  p.data ->> 'financialAccountId',
  p.data ->> 'financialAccountCode',
  CASE p.portal_user_id
    WHEN '1b24fa75-06cc-430c-b266-6d0d7100a794' THEN 'cust_0084'
    WHEN '2529abe1-9ebf-4625-9f11-21fcd40e77bb' THEN 'cust_2529abe19ebf'
    ELSE NULL
  END,
  CASE p.portal_user_id
    WHEN '1b24fa75-06cc-430c-b266-6d0d7100a794' THEN '1132-0009'
    WHEN '2529abe1-9ebf-4625-9f11-21fcd40e77bb' THEN '1132-0005'
    ELSE NULL
  END,
  CASE
    WHEN p.portal_user_id IN ('1b24fa75-06cc-430c-b266-6d0d7100a794','2529abe1-9ebf-4625-9f11-21fcd40e77bb') THEN 'resolved'
    WHEN NULLIF(COALESCE(p.linked_acc_id, p.data ->> 'linkedAccId', p.data ->> 'linkedCustomerId', p.data ->> 'financialAccountId', p.data ->> 'financialAccountCode'), '') IS NULL THEN 'no_link'
    ELSE 'unresolved'
  END,
  CASE p.portal_user_id
    WHEN '1b24fa75-06cc-430c-b266-6d0d7100a794' THEN 'Matched customer cust_0084 and canonical account 1132-0009.'
    WHEN '2529abe1-9ebf-4625-9f11-21fcd40e77bb' THEN 'Matched customer cust_2529abe19ebf and canonical account 1132-0005.'
    WHEN '31babee8-c4f9-4c8f-a0cc-bdfecc235115' THEN 'No customer or account reference present.'
    WHEN 'bed74850-4baa-4ebd-9220-a282f58908cd' THEN 'Legacy customer cust_0085 and account acc_1130_0085 do not exist in current canonical tables.'
    WHEN 'f8b0e479-5003-494b-92a2-af9a542c9258' THEN 'Legacy customer cust_f8b0e4795003 does not exist in current customers table; no account reference.'
    WHEN 'puser_t01o26ftv' THEN 'Legacy linked_acc_id 1132-0012 has no matching account or customer in current schema.'
    WHEN 'puser_vgjnsasxj' THEN 'Empty legacy linked_acc_id; no customer or account reference present.'
    ELSE 'Captured before canonicalization.'
  END
FROM public.portal_users p
ON CONFLICT (portal_user_id) DO UPDATE SET
  legacy_linked_acc_id = EXCLUDED.legacy_linked_acc_id,
  legacy_linked_customer_id = EXCLUDED.legacy_linked_customer_id,
  legacy_financial_account_id = EXCLUDED.legacy_financial_account_id,
  legacy_financial_account_code = EXCLUDED.legacy_financial_account_code,
  resolved_customer_id = EXCLUDED.resolved_customer_id,
  resolved_account_id = EXCLUDED.resolved_account_id,
  resolution_status = EXCLUDED.resolution_status,
  resolution_note = EXCLUDED.resolution_note;

UPDATE public.portal_users p
SET
  full_name = NULLIF(p.data ->> 'fullName', ''),
  name_ar = CASE WHEN NULLIF(p.data ->> 'fullName', '') ~ '[ء-ي]' THEN NULLIF(p.data ->> 'fullName', '') ELSE p.name_ar END,
  name_en = CASE WHEN NULLIF(p.data ->> 'fullName', '') !~ '[ء-ي]' THEN NULLIF(p.data ->> 'fullName', '') ELSE p.name_en END,
  account_id = m.resolved_account_id,
  linked_customer_id = m.resolved_customer_id,
  is_disabled = p.disabled,
  data = p.data - 'linkedAccId' - 'linkedCustomerId' - 'financialAccountId' - 'financialAccountCode' - 'financialBalance'
FROM public.portal_user_migration_map m
WHERE m.portal_user_id = p.portal_user_id;

ALTER TABLE public.portal_users
  ADD CONSTRAINT portal_users_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(account_id),
  ADD CONSTRAINT portal_users_linked_customer_id_fkey FOREIGN KEY (linked_customer_id) REFERENCES public.customers(customer_id);

CREATE INDEX IF NOT EXISTS portal_users_account_id_idx ON public.portal_users(account_id);
CREATE INDEX IF NOT EXISTS portal_users_linked_customer_id_idx ON public.portal_users(linked_customer_id);

COMMIT;
