-- يمنع journal_entries تكرار تنفيذ القيد التلقائي، بينما يبقى orders_history سجل تدقيق يسمح بحدث الإنشاء والتعديل والحذف.
DROP INDEX IF EXISTS public.orders_history_automatic_voucher_key_unique_idx;
