-- مزامنة صلاحيات Accountant المخزنة مع كتالوج الصلاحيات المالية الدقيقة.
-- لا تمس RLS ولا الجداول المالية الجديدة ولا تضيف عمود data إليها.
BEGIN;

UPDATE public.roles
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{permissions}',
  (
    SELECT jsonb_agg(permission ORDER BY permission)
    FROM (
      SELECT existing.permission
      FROM jsonb_array_elements_text(COALESCE(public.roles.data->'permissions', '[]'::jsonb)) AS existing(permission)
      UNION
      SELECT added.permission
      FROM unnest(ARRAY[
        'view_general_entries', 'create_general_entries', 'edit_general_entries', 'delete_general_entries',
        'view_compound_entries', 'create_compound_entries', 'edit_compound_entries', 'delete_compound_entries',
        'view_temporary_entries', 'create_temporary_entries', 'edit_temporary_entries', 'delete_temporary_entries',
        'view_account_movements', 'export_account_movements', 'print_account_movements',
        'view_receipt_vouchers', 'create_receipt_vouchers', 'edit_receipt_vouchers', 'delete_receipt_vouchers',
        'view_payment_vouchers', 'create_payment_vouchers', 'edit_payment_vouchers', 'delete_payment_vouchers',
        'view_custody_advances', 'create_custody_advances', 'edit_custody_advances', 'delete_custody_advances',
        'view_entry_settings', 'create_entry_settings', 'edit_entry_settings', 'delete_entry_settings',
        'post_financial_entries', 'post_temporary_entries', 'reverse_financial_entries', 'void_financial_entries', 'settle_custody_advances'
      ]::text[]) AS added(permission)
    ) AS merged
  ),
  true
)
WHERE id = 'Accountant';

COMMIT;
