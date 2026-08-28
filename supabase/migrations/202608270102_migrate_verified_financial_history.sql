-- ترحيل تاريخي محافظ لقيود SwiftShip والعهد.
-- ينقل فقط القيود ذات الرأس المرتبط والأسطر السليمة والمتوازنة وسعر التحويل المثبت عند اختلاف العملة.
-- لا يحذف أو يعدل journal_entries أو account_transactions أو expenses، ولا يغير RLS.

BEGIN;

CREATE TEMP TABLE financial_legacy_qualified_entries ON COMMIT DROP AS
WITH header_base AS (
  SELECT
    j.id,
    j.data,
    COALESCE(NULLIF(btrim(j.data->>'entryNumber'), ''), NULLIF(btrim(j.data->>'refNumber'), ''), NULLIF(btrim(j."transactionID"), '')) AS legacy_entry_number,
    NULLIF(btrim(j.data->>'module'), '') AS legacy_module,
    NULLIF(btrim(j.data->>'description'), '') AS description,
    NULLIF(btrim(j.data->>'notes'), '') AS legacy_notes,
    j.cur_no AS currency_original_no,
    j.order_id,
    j.shipment_id,
    COALESCE(NULLIF(btrim(j.automation_key), ''), NULLIF(btrim(j.data->>'automationKey'), '')) AS automation_key,
    COALESCE(NULLIF(btrim(j.auto_rule_id), ''), NULLIF(btrim(j.data->>'autoRuleId'), '')) AS auto_rule_id,
    (j.is_automatic IS TRUE OR lower(COALESCE(j.data->>'isAutomatic', 'false')) = 'true') AS is_automatic,
    CASE
      WHEN COALESCE(j.data->>'amount', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (j.data->>'amount')::numeric
      ELSE NULL
    END AS declared_amount_original,
    CASE
      WHEN COALESCE(j.data->>'createdAt', '') ~ '^[0-9]{13}$' THEN to_timestamp((j.data->>'createdAt')::numeric / 1000.0)
      ELSE NULL
    END AS effective_at,
    COALESCE(NULLIF(btrim(j.created_by_uid), ''), NULLIF(btrim(j.data->>'createdByUid'), '')) AS created_by_candidate,
    CASE NULLIF(btrim(j.data->>'paymentMethod'), '')
      WHEN 'cash' THEN 'cash'
      WHEN 'bank' THEN 'bank'
      WHEN 'mixed' THEN 'mixed'
      WHEN 'deferred' THEN 'deferred'
      ELSE NULL
    END AS payment_method,
    CASE lower(COALESCE(j.data->>'module', ''))
      WHEN 'order' THEN 'module_orders'
      WHEN 'payment' THEN 'module_orders'
      WHEN 'expense' THEN 'module_expenses'
      WHEN 'adjustment' THEN 'module_accounting'
      ELSE NULL
    END AS module_id,
    CASE lower(COALESCE(j.data->>'module', ''))
      WHEN 'order' THEN 'type_order_value'
      WHEN 'payment' THEN 'type_order_payment'
      WHEN 'expense' THEN 'type_expense'
      WHEN 'adjustment' THEN 'type_adjustment'
      ELSE NULL
    END AS entry_type_id
  FROM public.journal_entries j
),
line_base AS (
  SELECT
    h.id AS entry_id,
    h.currency_original_no AS header_currency_no,
    h.effective_at,
    at.id AS legacy_line_id,
    at.type AS trans_type,
    at.account_id,
    at.cur_no AS account_cur_no,
    at.amount AS account_amount,
    CASE
      WHEN COALESCE(at.data->>'amountOriginal', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (at.data->>'amountOriginal')::numeric
      ELSE NULL
    END AS amount_original,
    a.id IS NOT NULL AS account_exists,
    a.is_active IS TRUE AND a.acc_sub_id IS NOT NULL AS account_postable,
    a.cur_no AS stored_account_cur_no
  FROM header_base h
  JOIN public.account_transactions at ON NULLIF(btrim(at.data->>'journalEntryId'), '') = h.id
  LEFT JOIN public.accounts a ON a.id = at.account_id
),
line_fx AS (
  SELECT
    l.*,
    p.id AS currency_price_id,
    p.seq AS currency_price_seq,
    p.price AS historical_price
  FROM line_base l
  LEFT JOIN LATERAL (
    SELECT cp.id, cp.seq, cp.price
    FROM public.cur_price cp
    WHERE cp.cur_no = l.header_currency_no
      AND cp.day_date <= l.effective_at
    ORDER BY cp.day_date DESC, cp.seq DESC
    LIMIT 1
  ) p ON l.header_currency_no <> l.account_cur_no
),
entry_metrics AS (
  SELECT
    h.*,
    COUNT(l.legacy_line_id) AS line_count,
    COUNT(l.legacy_line_id) FILTER (
      WHERE l.trans_type IN ('Debit', 'Credit')
        AND l.account_exists
        AND l.account_postable
        AND l.stored_account_cur_no = l.account_cur_no
        AND l.account_amount > 0
        AND l.amount_original > 0
    ) AS valid_line_count,
    COALESCE(SUM(l.amount_original) FILTER (WHERE l.trans_type = 'Debit'), 0) AS debit_original,
    COALESCE(SUM(l.amount_original) FILTER (WHERE l.trans_type = 'Credit'), 0) AS credit_original,
    COUNT(l.legacy_line_id) FILTER (WHERE l.header_currency_no <> l.account_cur_no) AS cross_currency_count,
    COUNT(l.legacy_line_id) FILTER (
      WHERE l.header_currency_no <> l.account_cur_no
        AND l.currency_price_id IS NOT NULL
        AND abs(round(l.account_amount / l.amount_original, 4) - l.historical_price) <= 0.0001
    ) AS matched_cross_currency_count,
    MAX(l.currency_price_id) FILTER (WHERE l.header_currency_no <> l.account_cur_no) AS currency_price_id,
    MAX(l.currency_price_seq) FILTER (WHERE l.header_currency_no <> l.account_cur_no) AS currency_price_seq
  FROM header_base h
  LEFT JOIN line_fx l ON l.entry_id = h.id
  GROUP BY
    h.id, h.data, h.legacy_entry_number, h.legacy_module, h.description, h.legacy_notes,
    h.currency_original_no, h.order_id, h.shipment_id, h.automation_key, h.auto_rule_id,
    h.is_automatic, h.declared_amount_original, h.effective_at, h.created_by_candidate,
    h.payment_method, h.module_id, h.entry_type_id
)
SELECT *
FROM entry_metrics
WHERE line_count >= 2
  AND valid_line_count = line_count
  AND debit_original = credit_original
  AND declared_amount_original = debit_original
  AND cross_currency_count = matched_cross_currency_count
  AND effective_at IS NOT NULL
  AND legacy_entry_number IS NOT NULL
  AND description IS NOT NULL
  AND module_id IS NOT NULL
  AND entry_type_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.currency c WHERE c.cur_id = currency_original_no)
  AND (order_id IS NULL OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id))
  AND (shipment_id IS NULL OR EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id));

INSERT INTO public.main_entry (
  id, entry_number, module_id, entry_type_id, entry_category, posting_status,
  amount_original, amount_text, currency_original_no, currency_price_id, currency_price_seq,
  description, notes, attachments, payment_method, order_id, shipment_id,
  automation_key, auto_rule_id, is_automatic,
  effective_at, posted_at, created_at, updated_at,
  created_by_uid, updated_by_uid, posted_by_uid
)
SELECT
  q.id,
  'LEGACY-' || q.id,
  q.module_id,
  q.entry_type_id,
  CASE WHEN q.line_count = 2 THEN 'General' ELSE 'Compound' END,
  'posted',
  q.debit_original,
  '',
  q.currency_original_no,
  q.currency_price_id,
  q.currency_price_seq,
  q.description,
  'رقم القيد التاريخي: ' || q.legacy_entry_number
    || CASE WHEN q.legacy_notes IS NOT NULL THEN E'\n' || q.legacy_notes ELSE '' END,
  CASE
    WHEN jsonb_typeof(q.data->'attachments') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(q.data->'attachments'))
    ELSE ARRAY[]::text[]
  END,
  q.payment_method,
  q.order_id,
  q.shipment_id,
  q.automation_key,
  q.auto_rule_id,
  q.is_automatic,
  q.effective_at,
  q.effective_at,
  q.effective_at,
  q.effective_at,
  u.id,
  u.id,
  u.id
FROM financial_legacy_qualified_entries q
LEFT JOIN public.users u ON u.id = q.created_by_candidate
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_legacy_migration_map m
  WHERE m.legacy_table = 'journal_entries' AND m.legacy_id = q.id
)
  AND NOT EXISTS (SELECT 1 FROM public.main_entry me WHERE me.id = q.id);

CREATE TEMP TABLE financial_legacy_qualified_lines ON COMMIT DROP AS
SELECT
  at.id AS legacy_line_id,
  q.id AS entry_id,
  ROW_NUMBER() OVER (PARTITION BY q.id ORDER BY at.id)::integer AS line_no,
  at.type AS trans_type,
  at.account_id,
  at.cur_no AS account_cur_no,
  at.amount,
  (at.data->>'amountOriginal')::numeric AS amount_original,
  q.currency_original_no,
  p.id AS currency_price_id,
  p.seq AS currency_price_seq,
  COALESCE(NULLIF(btrim(at.data->>'entityType'), ''), '') AS entity_type,
  COALESCE(NULLIF(btrim(at.data->>'entityId'), ''), '') AS entity_id,
  CASE NULLIF(btrim(at.data->>'paymentMethod'), '')
    WHEN 'cash' THEN 'cash'
    WHEN 'bank' THEN 'bank'
    WHEN 'mixed' THEN 'mixed'
    WHEN 'deferred' THEN 'deferred'
    ELSE q.payment_method
  END AS payment_method,
  COALESCE(at.order_id, q.order_id) AS order_id,
  COALESCE(at.shipment_id, q.shipment_id) AS shipment_id,
  q.auto_rule_id,
  q.automation_key,
  COALESCE(NULLIF(btrim(at.data->>'description'), ''), q.description) AS description,
  COALESCE(NULLIF(btrim(at.data->>'notes'), ''), '') AS note,
  CASE
    WHEN COALESCE(at.data->>'createdAt', '') ~ '^[0-9]{13}$' THEN to_timestamp((at.data->>'createdAt')::numeric / 1000.0)
    ELSE q.effective_at
  END AS created_at,
  NULLIF(btrim(at.data->>'createdByUid'), '') AS created_by_candidate
FROM financial_legacy_qualified_entries q
JOIN public.account_transactions at ON NULLIF(btrim(at.data->>'journalEntryId'), '') = q.id
LEFT JOIN LATERAL (
  SELECT cp.id, cp.seq
  FROM public.cur_price cp
  WHERE cp.cur_no = q.currency_original_no
    AND cp.day_date <= q.effective_at
  ORDER BY cp.day_date DESC, cp.seq DESC
  LIMIT 1
) p ON q.currency_original_no <> at.cur_no;

INSERT INTO public.account_trans (
  id, entry_id, line_no, trans_type, account_id, account_cur_no,
  amount, amount_original, currency_original_no, currency_price_id, currency_price_seq,
  entity_type, entity_id, payment_method, order_id, shipment_id,
  auto_rule_id, automation_key, description, note,
  created_at, updated_at, created_by_uid, updated_by_uid
)
SELECT
  ql.legacy_line_id,
  ql.entry_id,
  ql.line_no,
  ql.trans_type,
  ql.account_id,
  ql.account_cur_no,
  ql.amount,
  ql.amount_original,
  ql.currency_original_no,
  ql.currency_price_id,
  ql.currency_price_seq,
  ql.entity_type,
  ql.entity_id,
  ql.payment_method,
  ql.order_id,
  ql.shipment_id,
  ql.auto_rule_id,
  ql.automation_key,
  ql.description,
  ql.note,
  ql.created_at,
  ql.created_at,
  u.id,
  u.id
FROM financial_legacy_qualified_lines ql
LEFT JOIN public.users u ON u.id = ql.created_by_candidate
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_legacy_migration_map m
  WHERE m.legacy_table = 'account_transactions' AND m.legacy_id = ql.legacy_line_id
)
  AND NOT EXISTS (SELECT 1 FROM public.account_trans at2 WHERE at2.id = ql.legacy_line_id);

INSERT INTO public.financial_legacy_migration_map (
  legacy_table, legacy_id, target_table, target_id, migration_status
)
SELECT 'journal_entries', q.id, 'main_entry', q.id, 'migrated'
FROM financial_legacy_qualified_entries q
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;

INSERT INTO public.financial_legacy_migration_map (
  legacy_table, legacy_id, target_table, target_id, migration_status
)
SELECT 'account_transactions', ql.legacy_line_id, 'account_trans', ql.legacy_line_id, 'migrated'
FROM financial_legacy_qualified_lines ql
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;

INSERT INTO public.financial_migration_exceptions (
  id, legacy_table, legacy_id, exception_code, severity, description
)
WITH header_metrics AS (
  SELECT
    j.id,
    COUNT(at.id) AS line_count,
    COUNT(at.id) FILTER (
      WHERE at.type IN ('Debit', 'Credit')
        AND a.id IS NOT NULL
        AND a.is_active IS TRUE
        AND a.acc_sub_id IS NOT NULL
        AND a.cur_no = at.cur_no
        AND at.amount > 0
        AND COALESCE(at.data->>'amountOriginal', '') ~ '^[0-9]+(\.[0-9]+)?$'
        AND (at.data->>'amountOriginal')::numeric > 0
    ) AS valid_line_count,
    COALESCE(SUM((at.data->>'amountOriginal')::numeric) FILTER (
      WHERE at.type = 'Debit' AND COALESCE(at.data->>'amountOriginal', '') ~ '^[0-9]+(\.[0-9]+)?$'
    ), 0) AS debit_original,
    COALESCE(SUM((at.data->>'amountOriginal')::numeric) FILTER (
      WHERE at.type = 'Credit' AND COALESCE(at.data->>'amountOriginal', '') ~ '^[0-9]+(\.[0-9]+)?$'
    ), 0) AS credit_original,
    COUNT(at.id) FILTER (WHERE j.cur_no <> at.cur_no) AS cross_currency_count,
    COUNT(at.id) FILTER (
      WHERE j.cur_no <> at.cur_no
        AND p.id IS NOT NULL
        AND COALESCE(at.data->>'amountOriginal', '') ~ '^[0-9]+(\.[0-9]+)?$'
        AND abs(round(at.amount / (at.data->>'amountOriginal')::numeric, 4) - p.price) <= 0.0001
    ) AS matched_cross_currency_count
  FROM public.journal_entries j
  LEFT JOIN public.account_transactions at ON NULLIF(btrim(at.data->>'journalEntryId'), '') = j.id
  LEFT JOIN public.accounts a ON a.id = at.account_id
  LEFT JOIN LATERAL (
    SELECT cp.id, cp.price
    FROM public.cur_price cp
    WHERE cp.cur_no = j.cur_no
      AND COALESCE(j.data->>'createdAt', '') ~ '^[0-9]{13}$'
      AND cp.day_date <= to_timestamp((j.data->>'createdAt')::numeric / 1000.0)
    ORDER BY cp.day_date DESC, cp.seq DESC
    LIMIT 1
  ) p ON j.cur_no <> at.cur_no
  GROUP BY j.id
)
SELECT
  'exception:journal:' || h.id,
  'journal_entries',
  h.id,
  CASE
    WHEN hm.line_count < 2 THEN 'MISSING_OR_INSUFFICIENT_LINES'
    WHEN hm.valid_line_count <> hm.line_count THEN 'INVALID_LINE_OR_POSTING_ACCOUNT'
    WHEN hm.debit_original <> hm.credit_original THEN 'UNBALANCED_ORIGINAL_AMOUNT'
    WHEN hm.cross_currency_count <> hm.matched_cross_currency_count THEN 'UNPROVEN_FX_RATE'
    ELSE 'FAILED_LEGACY_VALIDATION'
  END,
  'blocking',
  CASE
    WHEN hm.line_count < 2 THEN 'الرأس التاريخي لا يملك ساقين محاسبيتين سليمتين على الأقل؛ لم يرحل.'
    WHEN hm.valid_line_count <> hm.line_count THEN 'يوجد سطر تاريخي غير صالح أو حساب غير قابل للترحيل؛ لم يرحل الرأس.'
    WHEN hm.debit_original <> hm.credit_original THEN 'لا يتساوى مجموع amount_original للمدين والدائن؛ لم يرحل الرأس.'
    WHEN hm.cross_currency_count <> hm.matched_cross_currency_count THEN 'تعذر إثبات سعر صرف تاريخي مطابق لساق متعددة العملات؛ لم يرحل الرأس.'
    ELSE 'فشل الرأس في أحد شروط الترحيل التاريخي؛ لم يرحل.'
  END
FROM public.journal_entries h
JOIN header_metrics hm ON hm.id = h.id
WHERE NOT EXISTS (SELECT 1 FROM financial_legacy_qualified_entries q WHERE q.id = h.id)
ON CONFLICT (legacy_table, legacy_id, exception_code) DO NOTHING;

INSERT INTO public.financial_legacy_migration_map (
  legacy_table, legacy_id, target_table, target_id, migration_status
)
SELECT
  e.legacy_table,
  e.legacy_id,
  'financial_migration_exceptions',
  e.id,
  'exception'
FROM public.financial_migration_exceptions e
WHERE e.legacy_table = 'journal_entries'
  AND e.exception_code IN (
    'MISSING_OR_INSUFFICIENT_LINES',
    'INVALID_LINE_OR_POSTING_ACCOUNT',
    'UNBALANCED_ORIGINAL_AMOUNT',
    'UNPROVEN_FX_RATE',
    'FAILED_LEGACY_VALIDATION'
  )
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;

INSERT INTO public.financial_migration_exceptions (
  id, legacy_table, legacy_id, exception_code, severity, description
)
SELECT
  'exception:account-transaction:' || at.id,
  'account_transactions',
  at.id,
  'MISSING_LEGACY_HEADER',
  'blocking',
  'سطر القيد التاريخي يشير إلى journalEntryId غير موجود؛ لم يرحل ولم يدخل في الرصيد الجديد.'
FROM public.account_transactions at
LEFT JOIN public.journal_entries h ON h.id = NULLIF(btrim(at.data->>'journalEntryId'), '')
WHERE NULLIF(btrim(at.data->>'journalEntryId'), '') IS NOT NULL
  AND h.id IS NULL
ON CONFLICT (legacy_table, legacy_id, exception_code) DO NOTHING;

INSERT INTO public.financial_legacy_migration_map (
  legacy_table, legacy_id, target_table, target_id, migration_status
)
SELECT
  e.legacy_table,
  e.legacy_id,
  'financial_migration_exceptions',
  e.id,
  'exception'
FROM public.financial_migration_exceptions e
WHERE e.legacy_table = 'account_transactions'
  AND e.exception_code = 'MISSING_LEGACY_HEADER'
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;

CREATE TEMP TABLE financial_legacy_qualified_custody ON COMMIT DROP AS
SELECT
  e.id,
  NULLIF(btrim(e.expense_number), '') AS custody_number,
  CASE lower(COALESCE(e.data->>'recipientEntityType', ''))
    WHEN 'employee' THEN 'employee'
    WHEN 'courier' THEN 'courier'
    WHEN 'customer' THEN 'customer'
    ELSE NULL
  END AS recipient_type,
  NULLIF(btrim(e.data->>'recipientEntityId'), '') AS recipient_id,
  NULLIF(btrim(e.data->>'recipientName'), '') AS recipient_name,
  e.account_id AS recipient_account_id,
  e.amount AS amount_original,
  e.cur_no AS currency_original_no,
  lower(COALESCE(e.data->>'status', '')) AS legacy_status,
  CASE
    WHEN COALESCE(e.data->>'createdAt', '') ~ '^[0-9]{13}$' THEN to_timestamp((e.data->>'createdAt')::numeric / 1000.0)
    ELSE NULL
  END AS issued_at,
  CASE
    WHEN COALESCE(e.data->>'settledAt', '') ~ '^[0-9]{13}$' THEN to_timestamp((e.data->>'settledAt')::numeric / 1000.0)
    ELSE NULL
  END AS settled_at,
  NULLIF(btrim(e.data->>'createdByUid'), '') AS issued_by_candidate,
  NULLIF(btrim(e.data->>'notes'), '') AS legacy_notes
FROM public.expenses e
JOIN public.accounts a ON a.id = e.account_id
WHERE COALESCE(e.data->>'type', '') = 'Custody'
  AND e.amount > 0
  AND e.cur_no IS NOT NULL
  AND a.is_active IS TRUE
  AND a.acc_sub_id IS NOT NULL
  AND a.cur_no = e.cur_no
  AND NULLIF(btrim(e.expense_number), '') IS NOT NULL
  AND NULLIF(btrim(e.data->>'recipientName'), '') IS NOT NULL
  AND NULLIF(btrim(e.data->>'recipientEntityId'), '') IS NOT NULL
  AND lower(COALESCE(e.data->>'status', '')) IN ('open', 'settled')
  AND COALESCE(e.data->>'createdAt', '') ~ '^[0-9]{13}$'
  AND (
    (lower(COALESCE(e.data->>'recipientEntityType', '')) = 'courier' AND EXISTS (SELECT 1 FROM public.couriers co WHERE co.id = NULLIF(btrim(e.data->>'recipientEntityId'), '')))
    OR (lower(COALESCE(e.data->>'recipientEntityType', '')) = 'employee' AND EXISTS (SELECT 1 FROM public.employees em WHERE em.id = NULLIF(btrim(e.data->>'recipientEntityId'), '')))
    OR (lower(COALESCE(e.data->>'recipientEntityType', '')) = 'customer' AND EXISTS (SELECT 1 FROM public.customers cu WHERE cu.id = NULLIF(btrim(e.data->>'recipientEntityId'), '')))
  )
  AND EXISTS (SELECT 1 FROM public.currency c WHERE c.cur_id = e.cur_no);

INSERT INTO public.custody_advances (
  id, custody_number, recipient_type, recipient_id, recipient_name, recipient_account_id,
  amount_original, currency_original_no, amount_settled, amount_outstanding, status,
  note, issued_at, issued_by_uid, settled_at, created_at, updated_at, created_by_uid
)
SELECT
  q.id,
  q.custody_number,
  q.recipient_type,
  q.recipient_id,
  q.recipient_name,
  q.recipient_account_id,
  q.amount_original,
  q.currency_original_no,
  CASE WHEN q.legacy_status = 'settled' THEN q.amount_original ELSE 0 END,
  CASE WHEN q.legacy_status = 'settled' THEN 0 ELSE q.amount_original END,
  q.legacy_status,
  'سجل عهدة تاريخي من expenses'
    || CASE WHEN q.legacy_notes IS NOT NULL THEN E'\n' || q.legacy_notes ELSE '' END,
  q.issued_at,
  u.id,
  q.settled_at,
  q.issued_at,
  q.issued_at,
  u.id
FROM financial_legacy_qualified_custody q
LEFT JOIN public.users u ON u.id = q.issued_by_candidate
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_legacy_migration_map m
  WHERE m.legacy_table = 'expenses' AND m.legacy_id = q.id
)
  AND NOT EXISTS (SELECT 1 FROM public.custody_advances ca WHERE ca.id = q.id);

INSERT INTO public.financial_legacy_migration_map (
  legacy_table, legacy_id, target_table, target_id, migration_status
)
SELECT 'expenses', q.id, 'custody_advances', q.id, 'migrated'
FROM financial_legacy_qualified_custody q
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;

INSERT INTO public.financial_migration_exceptions (
  id, legacy_table, legacy_id, exception_code, severity, description
)
SELECT
  'exception:expense:' || e.id,
  'expenses',
  e.id,
  'CUSTODY_NOT_VERIFIABLE',
  'blocking',
  'سجل العهدة التاريخي لا يملك طرفًا وحسابًا وعملة وحالة قابلة لإثبات النقل؛ بقي في expenses للمراجعة ولم يحذف.'
FROM public.expenses e
WHERE COALESCE(e.data->>'type', '') = 'Custody'
  AND NOT EXISTS (SELECT 1 FROM financial_legacy_qualified_custody q WHERE q.id = e.id)
ON CONFLICT (legacy_table, legacy_id, exception_code) DO NOTHING;

INSERT INTO public.financial_legacy_migration_map (
  legacy_table, legacy_id, target_table, target_id, migration_status
)
SELECT
  e.legacy_table,
  e.legacy_id,
  'financial_migration_exceptions',
  e.id,
  'exception'
FROM public.financial_migration_exceptions e
WHERE e.legacy_table = 'expenses'
  AND e.exception_code = 'CUSTODY_NOT_VERIFIABLE'
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;

COMMIT;
