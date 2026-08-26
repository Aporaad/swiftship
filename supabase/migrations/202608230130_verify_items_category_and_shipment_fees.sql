-- Run this AFTER 202608230130_create_items_category_and_shipment_fees.sql.
-- Expected result: 18 seeded item categories, two foreign keys, and the listed columns.

-- 1) Confirm the seeded categories exist. Expected category_count = 18.
SELECT COUNT(*) AS category_count
FROM public.items_category;

-- 2) Review all categories and confirm all initial per-carton monetary values are zero.
SELECT
  code,
  name_ar,
  name_en,
  hs_code_hint,
  customs_per_carton,
  tax_per_carton,
  other_fees_per_carton,
  fee_currency,
  requires_review,
  is_active
FROM public.items_category
ORDER BY name_ar;

-- 3) Confirm the product and shipment foreign-key relationships.
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN (
  'products_item_category_id_fkey',
  'shipments_content_category_id_fkey'
)
ORDER BY conname;

-- 4) Confirm all required direct columns are present.
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'products' AND column_name IN ('item_category_id', 'item_category_name'))
    OR
    (table_name = 'shipments' AND column_name IN (
      'content_category_id',
      'content_category_name',
      'carton_count',
      'customs_fee',
      'tax_fee',
      'other_category_fee',
      'category_fees_total',
      'category_fee_currency'
    ))
  )
ORDER BY table_name, column_name;

-- 5) Optional safety check: this must return zero rows after the foreign keys are created.
SELECT p.id, p.item_category_id
FROM public.products AS p
LEFT JOIN public.items_category AS c ON c.id = p.item_category_id
WHERE p.item_category_id IS NOT NULL
  AND c.id IS NULL;

SELECT s.id, s.content_category_id
FROM public.shipments AS s
LEFT JOIN public.items_category AS c ON c.id = s.content_category_id
WHERE s.content_category_id IS NOT NULL
  AND c.id IS NULL;
