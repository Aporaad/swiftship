CREATE TABLE IF NOT EXISTS public.items_category (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text NOT NULL DEFAULT '',
  hs_code_hint text,
  customs_per_carton numeric(16,2) NOT NULL DEFAULT 0 CHECK (customs_per_carton >= 0),
  tax_per_carton numeric(16,2) NOT NULL DEFAULT 0 CHECK (tax_per_carton >= 0),
  other_fees_per_carton numeric(16,2) NOT NULL DEFAULT 0 CHECK (other_fees_per_carton >= 0),
  customs_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (customs_rate >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  fee_currency text NOT NULL DEFAULT 'SAR',
  requires_review boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" bigint NOT NULL DEFAULT (extract(epoch FROM now()) * 1000)::bigint,
  "updatedAt" bigint NOT NULL DEFAULT (extract(epoch FROM now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS items_category_active_name_idx
  ON public.items_category (is_active, name_ar);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS item_category_id text,
  ADD COLUMN IF NOT EXISTS item_category_name text;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS content_category_id text,
  ADD COLUMN IF NOT EXISTS content_category_name text,
  ADD COLUMN IF NOT EXISTS carton_count numeric(12,2) NOT NULL DEFAULT 0 CHECK (carton_count >= 0),
  ADD COLUMN IF NOT EXISTS customs_fee numeric(16,2) NOT NULL DEFAULT 0 CHECK (customs_fee >= 0),
  ADD COLUMN IF NOT EXISTS tax_fee numeric(16,2) NOT NULL DEFAULT 0 CHECK (tax_fee >= 0),
  ADD COLUMN IF NOT EXISTS other_category_fee numeric(16,2) NOT NULL DEFAULT 0 CHECK (other_category_fee >= 0),
  ADD COLUMN IF NOT EXISTS category_fees_total numeric(16,2) NOT NULL DEFAULT 0 CHECK (category_fees_total >= 0),
  ADD COLUMN IF NOT EXISTS category_fee_currency text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_item_category_id_fkey,
  ADD CONSTRAINT products_item_category_id_fkey
    FOREIGN KEY (item_category_id) REFERENCES public.items_category(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_content_category_id_fkey,
  ADD CONSTRAINT shipments_content_category_id_fkey
    FOREIGN KEY (content_category_id) REFERENCES public.items_category(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS products_item_category_id_idx
  ON public.products (item_category_id);
CREATE INDEX IF NOT EXISTS shipments_content_category_id_idx
  ON public.shipments (content_category_id);

INSERT INTO public.items_category (
  id, code, name_ar, name_en, description, hs_code_hint, requires_review, details
) VALUES
  ('cat_clothing', 'CLOTHING', 'ملابس وأقمشة', 'Clothing & Textiles', 'ملابس جاهزة، منسوجات وأقمشة. راجع رمز HS ونسبة الرسوم قبل اعتماد أي مبلغ.', 'Ch. 61-63', false, '{"group":"fashion"}'::jsonb),
  ('cat_footwear_bags', 'FOOTWEAR_BAGS', 'أحذية وحقائب', 'Footwear & Bags', 'أحذية وحقائب وإكسسوارات سفر. الرسوم النظامية تحدد لاحقًا حسب بلد الاستيراد والرمز الجمركي.', 'Ch. 42, 64', false, '{"group":"fashion"}'::jsonb),
  ('cat_perfumes', 'PERFUMES', 'عطور وبخور', 'Perfumes & Fragrances', 'عطور وبخور ومنتجات عطرية. قد تتطلب قيود نقل أو مراجعة خاصة.', 'Ch. 33', true, '{"group":"beauty","hazardReview":true}'::jsonb),
  ('cat_cosmetics', 'COSMETICS', 'تجميل وعناية شخصية', 'Cosmetics & Personal Care', 'مستحضرات تجميل وعناية شخصية. راجع متطلبات المطابقة والمكونات.', 'Ch. 33', true, '{"group":"beauty"}'::jsonb),
  ('cat_electronics', 'ELECTRONICS', 'إلكترونيات وملحقات', 'Electronics & Accessories', 'أجهزة إلكترونية وملحقاتها. تحدد الرسوم وفق نوع الجهاز ورمز HS.', 'Ch. 85', false, '{"group":"technology"}'::jsonb),
  ('cat_mobile_accessories', 'MOBILE_ACCESSORIES', 'إكسسوارات جوال', 'Mobile Accessories', 'أغطية وشواحن وكابلات وملحقات الهاتف.', 'Ch. 85', false, '{"group":"technology"}'::jsonb),
  ('cat_home_supplies', 'HOME_SUPPLIES', 'مستلزمات منزلية', 'Household Supplies', 'أدوات منزلية واستخدام يومي.', 'Ch. 39, 69, 73', false, '{"group":"home"}'::jsonb),
  ('cat_hardware', 'HARDWARE', 'خردوات وأدوات', 'Hardware & Tools', 'خردوات وأدوات ومستلزمات صيانة.', 'Ch. 73, 82', false, '{"group":"home"}'::jsonb),
  ('cat_kitchenware', 'KITCHENWARE', 'أدوات مطبخ', 'Kitchenware', 'أوانٍ وأدوات ومستلزمات المطبخ.', 'Ch. 39, 69, 73', false, '{"group":"home"}'::jsonb),
  ('cat_baby_toys', 'BABY_TOYS', 'أطفال وألعاب', 'Baby & Toys', 'ألعاب ومستلزمات أطفال. تتحقق المطابقة والسلامة وفق اللوائح المحلية.', 'Ch. 95', true, '{"group":"children"}'::jsonb),
  ('cat_sports', 'SPORTS', 'رياضة ولياقة', 'Sports & Fitness', 'ملابس وأدوات رياضية ولياقة.', 'Ch. 61, 95', false, '{"group":"lifestyle"}'::jsonb),
  ('cat_stationery_books', 'STATIONERY_BOOKS', 'قرطاسية وكتب', 'Stationery & Books', 'قرطاسية وكتب ومواد مكتبية.', 'Ch. 48, 49, 96', false, '{"group":"office"}'::jsonb),
  ('cat_auto_parts', 'AUTO_PARTS', 'قطع غيار سيارات', 'Auto Parts', 'قطع غيار ومستلزمات سيارات. الرمز الجمركي يختلف حسب القطعة.', 'Ch. 87', false, '{"group":"automotive"}'::jsonb),
  ('cat_furniture', 'FURNITURE', 'أثاث ومفروشات', 'Furniture & Furnishings', 'أثاث ومفروشات ومنتجات كبيرة الحجم.', 'Ch. 94', false, '{"group":"home"}'::jsonb),
  ('cat_food', 'FOOD', 'أغذية ومستلزمات غذائية', 'Food & Groceries', 'أغذية ومشروبات ومستلزمات غذائية. يلزم التحقق من التراخيص وتواريخ الصلاحية.', 'Ch. 16-22', true, '{"group":"regulated"}'::jsonb),
  ('cat_medical', 'MEDICAL', 'طبية وصحية', 'Medical & Health', 'منتجات طبية وصحية. يلزم التحقق من الموافقات واللوائح.', 'Ch. 30, 90', true, '{"group":"regulated"}'::jsonb),
  ('cat_jewelry', 'JEWELRY', 'مجوهرات وإكسسوارات', 'Jewelry & Accessories', 'إكسسوارات ومجوهرات غير ثمينة أو ثمينة حسب الوصف. تتطلب المقتنيات عالية القيمة مراجعة.', 'Ch. 71', true, '{"group":"fashion","highValueReview":true}'::jsonb),
  ('cat_other', 'OTHER', 'أصناف أخرى', 'Other Items', 'فئة عامة مؤقتة؛ يفضّل إنشاء فئة دقيقة قبل احتساب الرسوم.', NULL, true, '{"group":"other"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
