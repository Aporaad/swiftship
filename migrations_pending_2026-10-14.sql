-- migrations_pending_2026-10-14.sql
-- الترتيب: 0021، 0022، ثم 0024 حتى 0032 (كلها إضافية وidempotent).
-- لا يُضمَّن 0034: يُسقط أعمدة jsonb ويجب أن يجري فقط بعد نشر alx_api والواجهة المسطّحين.
-- Order: 0021, 0022, then 0024..0032. 0034 is intentionally excluded.

-- ========== 0021_public_tracking.sql ==========
-- 0021_public_tracking.sql
-- ملف التتبع العام: كل حقل عمود حقيقي بلا أي jsonb.
-- Public tracking profile: every field is a first-class column (no jsonb payload).
-- الجداول التابعة تحفظ المنتجات وسجل الأحداث علائقيًا بدل مصفوفات jsonb.
-- Child tables store the products and the logistics log relationally instead of jsonb arrays.

CREATE TABLE IF NOT EXISTS public.public_tracking (
  tracking_id text PRIMARY KEY,
  order_number text,
  status text,
  location_yemen text,
  customer_name text,
  customer_phone text,
  customer_address text,
  weight numeric,
  cbm numeric,
  shipping_company text,
  amount_paid numeric,
  amount_remaining numeric,
  total_cost_yer numeric,
  currency text,
  is_published boolean NOT NULL DEFAULT true,
  profile_updated_at double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text
);

CREATE INDEX IF NOT EXISTS public_tracking_order_number_idx
  ON public.public_tracking (order_number);

-- منتجات الشحنة المنشورة — published shipment products, one row per catalog line.
CREATE TABLE IF NOT EXISTS public.public_tracking_product (
  tracking_id text NOT NULL REFERENCES public.public_tracking (tracking_id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  product_name text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (tracking_id, line_no)
);

-- سجل الأحداث اللوجستي — logistics log events shown on the public page.
CREATE TABLE IF NOT EXISTS public.public_tracking_event (
  tracking_id text NOT NULL REFERENCES public.public_tracking (tracking_id) ON DELETE CASCADE,
  occurred_at bigint NOT NULL,
  seq integer NOT NULL,
  status text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  PRIMARY KEY (tracking_id, occurred_at, seq)
);

ALTER TABLE public.public_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_tracking_product DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_tracking_event DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_tracking TO alx_api_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_tracking_product TO alx_api_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_tracking_event TO alx_api_runtime;

-- ========== 0022_products_is_allowed.sql ==========
-- 0022_products_is_allowed.sql
-- يضيف عمود "مسموح بالطلب" إلى كتالوج المنتجات الرئيسية
-- Adds the is_allowed flag to the master products catalog (frontend filters allowed/blocked products)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_allowed boolean NOT NULL DEFAULT true;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO alx_api_runtime;

-- ========== 0024_flatten_tolerant_casts.sql ==========
-- 0024_flatten_tolerant_casts.sql
-- دوال تحويل متسامحة تُستخدم في كل ترحيلات التسطير؛ تعيد NULL بدل إسقاط الترحيل عند بيانات قديمة وسخة.
-- Tolerant casts used by every flattening migration: dirty legacy values become NULL instead of aborting.

CREATE SCHEMA IF NOT EXISTS alx_api_private;

CREATE OR REPLACE FUNCTION alx_api_private.cast_number(raw text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN NULL; END IF;
  RETURN raw::numeric;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION alx_api_private.cast_integer(raw text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN NULL; END IF;
  RETURN trunc(raw::numeric)::integer;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION alx_api_private.cast_boolean(raw text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN NULL; END IF;
  RETURN btrim(raw)::boolean;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- يقبل الطابع ISO أو milliseconds epoch — accepts ISO timestamps or epoch milliseconds.
CREATE OR REPLACE FUNCTION alx_api_private.cast_timestamp(raw text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN NULL; END IF;
  IF raw ~ '^[0-9]+(\\.[0-9]+)?$' THEN
    RETURN to_timestamp(raw::numeric / 1000);
  END IF;
  RETURN raw::timestamptz;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- استخراج قيمة نصية من مفاتيح متعددة بالترتيب — first non-empty text among several jsonb keys.
CREATE OR REPLACE FUNCTION alx_api_private.payload_text(payload jsonb, VARIADIC keys text[])
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(btrim(x.value #>> '{}'), '')
    FROM unnest(keys) AS k(key)
    JOIN LATERAL (SELECT payload -> k.key AS value) x ON TRUE
   WHERE x.value IS NOT NULL AND btrim(x.value #>> '{}') <> ''
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION alx_api_private.payload_number(payload jsonb, key text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT alx_api_private.cast_number(payload ->> key)
$$;

CREATE OR REPLACE FUNCTION alx_api_private.payload_boolean(payload jsonb, key text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT alx_api_private.cast_boolean(payload ->> key)
$$;

CREATE OR REPLACE FUNCTION alx_api_private.payload_timestamp(payload jsonb, key text)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT alx_api_private.cast_timestamp(payload ->> key)
$$;

CREATE OR REPLACE FUNCTION alx_api_private.payload_text_array(payload jsonb, key text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE((SELECT array_agg(btrim(x.value #>> '{}'))
                     FROM jsonb_array_elements(COALESCE(payload -> key, '[]'::jsonb)) x(value)
                    WHERE jsonb_typeof(payload -> key) = 'array'
                      AND btrim(x.value #>> '{}') <> ''), '{}')
$$;

GRANT USAGE ON SCHEMA alx_api_private TO alx_api_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA alx_api_private TO alx_api_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA alx_api_private GRANT EXECUTE ON FUNCTIONS TO alx_api_runtime;

-- ========== 0025_flatten_notifications.sql ==========
-- 0025_flatten_notifications.sql
-- تسطير الإشعارات: نقل كل ما يبقى داخل data إلى أعمدة حقيقية، ومصفوفة المستلمين إلى text[]،
-- ثم جدول مستلمين علائقي يحمل حالة القراءة لكل مستلم على حدة.
-- Flattens notifications: every jsonb payload field moves to a real column, the recipient array
-- becomes a first-class text[] (not jsonb), and per-recipient read state becomes a child table.
-- لا يمكن لمس الواجهة أي حقل jsonb بعد هذا الترحيل — the API never reads jsonb after this migration.
-- الترحيل idempotent: يُمكن إعادة تنفيذه بأمان بعد 0034 (إسقاط data و associated_user_ids).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ضمان وجود الأعمدة الرئيسية المسطّحة (لا تعتمد على حالة قاعدة البيانات القديمة)
-- Guarantee the flat columns exist so the backfill below is valid on any environment.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title              text,
  ADD COLUMN IF NOT EXISTS message            text,
  ADD COLUMN IF NOT EXISTS type               text,
  ADD COLUMN IF NOT EXISTS category           text,
  ADD COLUMN IF NOT EXISTS creator_id         text,
  ADD COLUMN IF NOT EXISTS creator_name       text,
  ADD COLUMN IF NOT EXISTS is_public          boolean,
  ADD COLUMN IF NOT EXISTS is_read            boolean,
  ADD COLUMN IF NOT EXISTS read               boolean,
  ADD COLUMN IF NOT EXISTS user_id            text,
  ADD COLUMN IF NOT EXISTS created_by         text,
  ADD COLUMN IF NOT EXISTS updated_by         text,
  ADD COLUMN IF NOT EXISTS created_at         timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. تعبئة الأعمدة المسطّحة من حمولة data القديمة (فقط إن كان العمود data موجوداً)
-- Backfill the flat columns from the legacy payload, only while the jsonb column still exists.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'data'
  ) THEN
    UPDATE public.notifications
       SET title        = COALESCE(NULLIF(title, ''),        data->>'title'),
           message      = COALESCE(NULLIF(message, ''),      data->>'message'),
           type         = COALESCE(NULLIF(type, ''),         data->>'type'),
           category     = COALESCE(NULLIF(category, ''),     data->>'category'),
           creator_id   = COALESCE(NULLIF(creator_id, ''),   data->>'creatorId'),
           creator_name = COALESCE(NULLIF(creator_name, ''), data->>'creatorName'),
           is_public    = COALESCE(is_public,    alx_api_private.payload_boolean(data, 'isPublic')),
           is_read      = COALESCE(is_read, read, alx_api_private.payload_boolean(data, 'read'), false),
           read         = COALESCE(is_read, read, alx_api_private.payload_boolean(data, 'read'), false),
           user_id      = COALESCE(NULLIF(user_id, ''),      data->>'userId')
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';

    -- مصفوفة المستلمين: تجمع مصدرها من العمود أو من data قبل التحويل — merge both legacy sources first,
    -- لأن صفوفًا حقيقية لا تحمل قائمة المستلمين إلا داخل الحمولة القديمة.
    -- نفس الشرط يحمي إعادة التنفيذ بعد تحويل العمود إلى text[].
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'notifications'
         AND column_name = 'associated_user_ids' AND data_type = 'jsonb'
    ) THEN
      UPDATE public.notifications
         SET associated_user_ids = COALESCE(
               CASE WHEN jsonb_typeof(associated_user_ids) = 'array' AND associated_user_ids <> '[]'::jsonb
                    THEN associated_user_ids END,
               CASE WHEN jsonb_typeof(data->'associatedUserIds') = 'array'
                    THEN data->'associatedUserIds' END,
               '[]'::jsonb)
       WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
    END IF;
  END IF;
END
$$;

-- قيود NOT NULL بعد التعبئة — constraints are applied only once the values exist.
UPDATE public.notifications SET is_read = false WHERE is_read IS NULL;
UPDATE public.notifications SET is_public = false WHERE is_public IS NULL;
UPDATE public.notifications SET type = 'system' WHERE type IS NULL OR btrim(type) = '';
ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN is_public SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN is_public SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.notifications ALTER COLUMN updated_at SET DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. مستلمو الإشعار: جدول علائقي يحمل حالة القراءة لكل مستلم — one row per recipient.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_recipient (
  notification_id text NOT NULL REFERENCES public.notifications (notification_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

-- تحويل عمود المستلمين من jsonb إلى text[] (عمود رئيسي) مرة واحدة فقط — convert jsonb → text[] idempotently.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications'
       AND column_name = 'associated_user_ids' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.notifications
      ALTER COLUMN associated_user_ids TYPE text[]
        USING (
          SELECT COALESCE(array_agg(DISTINCT btrim(x.value #>> '{}'))
                            FILTER (WHERE btrim(x.value #>> '{}') <> ''),
                         ARRAY[]::text[])
            FROM jsonb_array_elements(
                   CASE WHEN jsonb_typeof(associated_user_ids) = 'array'
                        THEN associated_user_ids ELSE '[]'::jsonb END
                 ) AS x(value)
        );
  END IF;
END
$$;

-- تعبئة الجدول العلائقي من text[] (أو من الحمولة القديمة إن بقيت) — populate the child table once.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications'
       AND column_name = 'associated_user_ids' AND data_type = 'ARRAY'
  ) THEN
    INSERT INTO public.notification_recipient (notification_id, user_id)
         SELECT n.notification_id, btrim(r.user_id)
           FROM public.notifications n
           CROSS JOIN unnest(n.associated_user_ids) AS r(user_id)
          WHERE btrim(r.user_id) <> ''
         ON CONFLICT (notification_id, user_id) DO NOTHING;
  END IF;
END
$$;

-- تطابق حالة القراءة بين الإشعار ومستلميه لتجربة مستقرة أثناء الانتقال.
-- Keep per-recipient read state aligned with the parent flag for a safe rollout.
UPDATE public.notification_recipient r
   SET is_read = n.is_read
  FROM public.notifications n
 WHERE n.notification_id = r.notification_id
   AND n.is_read IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. فهارس على الأعمدة الحقيقية — indexes on the real flat columns.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON public.notifications (created_at DESC, notification_id DESC);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS notifications_category_idx
  ON public.notifications (category, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_public_unread_idx
  ON public.notifications (is_public, is_read)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS notification_recipient_user_idx
  ON public.notification_recipient (user_id, is_read);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. الأمان والصلاحيات — grants (alx_api_runtime بلا DDL).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notification_recipient DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO alx_api_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_recipient TO alx_api_runtime;

COMMENT ON TABLE public.notifications IS
  'إشعارات داخلية مسطّحة: كل حقل عمود رئيسي، بلا حمولة jsonb — flat in-app notifications, no payload column.';
COMMENT ON TABLE public.notification_recipient IS
  'مستلمو كل إشعار وحالة قراءة كل مستلم — one row per notification recipient with its own read state.';

-- ========== 0026_flatten_activity_logs.sql ==========
-- 0026_flatten_activity_logs.sql
-- تسطير سجل النشاط: اسم المستخدم ودوره أعمدة حقيقية، وملخص نصي، وتفاصيل الحدث جدول علائقي.
-- Flattens activity logs: user name/role become first-class columns, the ambiguous `details`
-- text blob is renamed to `summary`, and structured event fields become a child table.
-- الترحيل idempotent: آمن عند إعادة التنفيذ وأيضاَ بعد 0034 الذي يُسقط عمود data.
-- Idempotent: safe to re-run, and safe after 0034 dropped the payload column.

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS user_role text,
  ADD COLUMN IF NOT EXISTS summary text;

-- العمود النصي القديم كان يخزن أحياناً كرة JSON مضغوطة؛ اسمه الجديد يوضح دوره: ملخص مقروء فقط.
-- The legacy text column sometimes held a compacted JSON blob; renaming it makes its real
-- role explicit: a human-readable summary line and nothing else.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'activity_logs'
       AND column_name = 'details'
  ) THEN
    -- الدمج قبل التحويل: احتفظ بأي ملخص حقيقي ثم أعد تسمية العمود القديم.
    -- Merge first so no real summary is lost, then rename the legacy column once.
    UPDATE public.activity_logs
       SET summary = COALESCE(NULLIF(summary, ''), NULLIF(btrim(details), ''));
    ALTER TABLE public.activity_logs DROP COLUMN details;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- التعبئة من الحمولة القديمة أثناء وجودها فقط — backfill only while jsonb still exists.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'data'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.activity_logs
     SET user_name = COALESCE(NULLIF(user_name, ''), data->>'userName'),
         user_role = COALESCE(NULLIF(user_role, ''), data->>'userRole'),
         action    = COALESCE(NULLIF(action, ''),    data->>'action'),
         category  = COALESCE(NULLIF(category, ''),  data->>'category'),
         target    = COALESCE(NULLIF(target, ''),    data->>'target'),
         type      = COALESCE(NULLIF(type, ''),      data->>'type'),
         user_id   = COALESCE(NULLIF(user_id, ''),   data->>'userId')
   WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';

  -- تفاصيل الحدث صفوف/قيمة بدل كرة jsonb — one row per detail key instead of a jsonb blob.
  INSERT INTO public.activity_log_detail (activity_log_id, field_name, field_value)
       SELECT a.activity_log_id, x.key, x.value #>> '{}'
         FROM public.activity_logs a, jsonb_each(a.data->'details') AS x(key, value)
        WHERE jsonb_typeof(a.data->'details') = 'object'
          AND jsonb_typeof(x.value) <> 'object'
       ON CONFLICT (activity_log_id, field_name) DO NOTHING;

  -- القيم المتداخلة (كائن داخل تفاصيل) تُسطّر بمسار منقّط — nested values flatten to dotted paths.
  INSERT INTO public.activity_log_detail (activity_log_id, field_name, field_value)
       SELECT a.activity_log_id, x.key || '.' || y.key, y.value #>> '{}'
         FROM public.activity_logs a
         JOIN jsonb_each(a.data->'details') AS x(key, value) ON jsonb_typeof(x.value) = 'object'
         CROSS JOIN jsonb_each(x.value) AS y(key, value)
       ON CONFLICT (activity_log_id, field_name) DO NOTHING;

  -- ملخص نصي قابل للعرض مباشرة في الواجهة — a plain-text summary for direct rendering.
  UPDATE public.activity_logs
     SET summary = COALESCE(NULLIF(summary, ''), data->>'details')
   WHERE data IS NOT NULL AND jsonb_typeof(data->'details') = 'string';
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- جدول التفاصيل العلائقي — the relational detail table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log_detail (
  activity_log_id text NOT NULL REFERENCES public.activity_logs (activity_log_id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_value text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_log_id, field_name)
);

-- ضمان عدم NULL قبل الاستخدام — the API always renders a summary line.
UPDATE public.activity_logs SET summary = '' WHERE summary IS NULL;
ALTER TABLE public.activity_logs ALTER COLUMN summary SET DEFAULT '';

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx
  ON public.activity_logs (created_at DESC NULLS LAST, activity_log_id);

CREATE INDEX IF NOT EXISTS activity_logs_user_idx
  ON public.activity_logs (user_id, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS activity_logs_category_idx
  ON public.activity_logs (category, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS activity_log_detail_log_idx
  ON public.activity_log_detail (activity_log_id);

ALTER TABLE public.activity_log_detail DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activity_logs, public.activity_log_detail TO alx_api_runtime;

COMMENT ON TABLE public.activity_logs IS
  'سجل نشاط مسطّح: ملخص نصي وتفاصيل في جدول علائقي، بلا حمولة jsonb — flat activity log with a relational detail table.';
COMMENT ON TABLE public.activity_log_detail IS
  'حقل/قيمة لكل حدث نشاط — one key/value row per recorded activity detail.';

-- ========== 0027_flatten_site_content.sql ==========
-- 0027_flatten_site_content.sql
-- تسطير محتوى الموقع: الإعلانات، تذاكر الدعم، وطلبات التوظيف — بلا أي حقل jsonb.
-- Flattens site content: announcements, support tickets (replies as rows) and job applications.
-- الترحيل idempotent: آمن عند إعادة التنفيذ وبعد 0034 الذي يُسقط data و replies.
-- Idempotent: safe to re-run and after 0034 drops the payload/replies columns.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. الأعمدة الرئيسية الجديدة — the new first-class columns.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS target_audience text;

ALTER TABLE public.portal_tickets
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS user_role text,
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS admin_response text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. الإعلانات / announcements — تحويل متسامح بلا إسقاط صف بسبب قيمة وسخة.
--    Tolerant casts so one dirty legacy row can never abort the whole migration.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'data'
  ) THEN
    UPDATE public.announcements
       SET title           = COALESCE(NULLIF(title, ''), data->>'title'),
           content         = COALESCE(NULLIF(content, ''), data->>'content', data->>'body'),
           priority        = COALESCE(NULLIF(priority, ''), data->>'priority', 'normal'),
           is_active       = COALESCE(is_active, alx_api_private.payload_boolean(data, 'is_active'),
                                       alx_api_private.payload_boolean(data, 'isActive'), true),
           target_audience = COALESCE(NULLIF(target_audience, ''), data->>'target_audience', data->>'targetAudience')
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. تذاكر الدعم / portal_tickets
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'portal_tickets' AND column_name = 'data'
  ) THEN
    UPDATE public.portal_tickets
       SET subject      = COALESCE(NULLIF(subject, ''), data->>'subject'),
           message      = COALESCE(NULLIF(message, ''), data->>'message'),
           type         = COALESCE(NULLIF(type, ''),    data->>'type'),
           status       = COALESCE(NULLIF(status, ''),  data->>'status', 'open'),
           user_uid     = COALESCE(NULLIF(user_uid, ''), data->>'userUid'),
           user_name    = COALESCE(NULLIF(user_name, ''), data->>'userName'),
           user_role    = COALESCE(NULLIF(user_role, ''), data->>'userRole'),
           user_email   = COALESCE(NULLIF(user_email, ''), data->>'userEmail'),
           created_by   = COALESCE(NULLIF(created_by, ''), data->>'createdBy'),
           created_at   = COALESCE(created_at, alx_api_private.payload_timestamp(data, 'createdAt')),
           updated_at   = COALESCE(updated_at, alx_api_private.payload_timestamp(data, 'updatedAt'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;
END
$$;

-- ردود الدعم صفوف حقيقية بدل مصفوفة jsonb — replies become relational rows, not a jsonb array.
CREATE TABLE IF NOT EXISTS public.portal_ticket_reply (
  portal_ticket_id text NOT NULL REFERENCES public.portal_tickets (portal_ticket_id) ON DELETE CASCADE,
  seq integer NOT NULL,
  sender text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  replied_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portal_ticket_id, seq)
);

DO $$
BEGIN
  -- المصدر الأول: مصفوفة replies داخل الحمولة القديمة — payload array.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'portal_tickets' AND column_name = 'data'
  ) THEN
    INSERT INTO public.portal_ticket_reply (portal_ticket_id, seq, sender, message, replied_at)
         SELECT t.portal_ticket_id,
                (x.ordinality - 1)::integer,
                COALESCE(x.value->>'sender', ''),
                COALESCE(x.value->>'message', ''),
                COALESCE(alx_api_private.cast_timestamp(x.value->>'repliedAt'), t.created_at)
           FROM public.portal_tickets t,
                jsonb_array_elements(COALESCE(t.data->'replies', '[]'::jsonb))
                  WITH ORDINALITY AS x(value, ordinality)
          WHERE jsonb_typeof(t.data->'replies') = 'array'
            AND t.data IS NOT NULL AND jsonb_typeof(t.data) = 'object'
         ON CONFLICT (portal_ticket_id, seq) DO NOTHING;
  END IF;

  -- المصدر الثاني: عمود replies jsonb (إن وُجد) قبل إسقاطه في 0034 — the jsonb column itself.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'portal_tickets'
       AND column_name = 'replies' AND data_type = 'jsonb'
  ) THEN
    INSERT INTO public.portal_ticket_reply (portal_ticket_id, seq, sender, message, replied_at)
         SELECT t.portal_ticket_id,
                (x.ordinality - 1)::integer,
                COALESCE(x.value->>'sender', ''),
                COALESCE(x.value->>'message', ''),
                COALESCE(alx_api_private.cast_timestamp(x.value->>'repliedAt'), t.created_at)
           FROM public.portal_tickets t,
                jsonb_array_elements(COALESCE(t.replies, '[]'::jsonb))
                  WITH ORDINALITY AS x(value, ordinality)
          WHERE jsonb_typeof(t.replies) = 'array'
         ON CONFLICT (portal_ticket_id, seq) DO NOTHING;
  END IF;

  -- آخر رد يصبح العمود المسطّح — the newest reply is the flat admin response.
  UPDATE public.portal_tickets t
     SET admin_response = COALESCE(
           NULLIF(btrim(t.admin_response), ''),
           (SELECT r.message FROM public.portal_ticket_reply r
             WHERE r.portal_ticket_id = t.portal_ticket_id ORDER BY r.seq DESC LIMIT 1));
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. طلبات التوظيف / job applications — الأعمدة موجودة؛ نعبّئ الفارغ منها فقط.
--    Columns already exist; only the empty ones are backfilled, then jsonb is never read.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'jobs_req' AND column_name = 'data'
  ) THEN
    UPDATE public.jobs_req
       SET full_name        = COALESCE(NULLIF(full_name, ''), data->>'fullName'),
           job_position     = COALESCE(NULLIF(job_position, ''), data->>'jobPosition'),
           category         = COALESCE(NULLIF(category, ''), data->>'jobPosition'),
           ref_code         = COALESCE(NULLIF(ref_code, ''), data->>'refCode'),
           phone            = COALESCE(NULLIF(phone, ''), data->>'phone'),
           email            = COALESCE(NULLIF(email, ''), data->>'email'),
           city             = COALESCE(NULLIF(city, ''), data->>'city'),
           address          = COALESCE(NULLIF(address, ''), data->>'address'),
           qualification    = COALESCE(NULLIF(qualification, ''), data->>'qualification'),
           id_number        = COALESCE(NULLIF(id_number, ''), data->>'idNumber'),
           notes            = COALESCE(NULLIF(notes, ''), data->>'notes'),
           experience_years = COALESCE(experience_years, alx_api_private.cast_integer(data->>'experienceYears')),
           status           = COALESCE(NULLIF(status, ''), data->>'status', 'pending_review'),
           created_at       = COALESCE(created_at, alx_api_private.payload_timestamp(data, 'createdAt')),
           updated_at       = COALESCE(updated_at, alx_api_private.payload_timestamp(data, 'updatedAt'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. الفهارس والصلاحيات — indexes and grants (alx_api_runtime بلا DDL).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS portal_ticket_reply_ticket_idx ON public.portal_ticket_reply (portal_ticket_id);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON public.announcements (created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS portal_tickets_status_created_idx ON public.portal_tickets (status, created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS jobs_req_status_created_idx ON public.jobs_req (status, created_at DESC NULLS LAST);

ALTER TABLE public.portal_ticket_reply DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.announcements, public.portal_tickets, public.portal_ticket_reply, public.jobs_req
  TO alx_api_runtime;

COMMENT ON TABLE public.portal_ticket_reply IS
  'ردود تذاكر الدعم: سطر لكل رد بدل مصفوفة jsonb — one row per ticket reply, no jsonb array.';

-- ========== 0028_flatten_portal_users.sql ==========
-- 0028_flatten_portal_users.sql
-- تسطير مستخدمي البوابة: العنوان، الموقع، والحساب المالي أعمدة حقيقية.
-- Flattens portal users: profile, location and financial-account fields become first-class columns.
-- الترحيل idempotent: آمن عند إعادة التنفيذ وبعد 0034 الذي يُسقط data.
-- Idempotent: safe to re-run and after 0034 drops the payload column.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. الأعمدة الرئيسية — first-class columns for every previously nested field.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.portal_users
  ADD COLUMN IF NOT EXISTS auth_uid text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS gps_location text,
  ADD COLUMN IF NOT EXISTS financial_currency text,
  ADD COLUMN IF NOT EXISTS financial_account_id text,
  ADD COLUMN IF NOT EXISTS financial_account_code text,
  ADD COLUMN IF NOT EXISTS financial_balance numeric,
  ADD COLUMN IF NOT EXISTS identity_doc_note text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS courier_type text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. التعبئة من الحمولة القديمة أثناء وجودها فقط — backfill only while data exists.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'portal_users' AND column_name = 'data'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.portal_users
     SET full_name               = COALESCE(NULLIF(full_name, ''), data->>'fullName'),
         name_ar                 = COALESCE(NULLIF(name_ar, ''), data->>'fullName'),
         name_en                 = COALESCE(NULLIF(name_en, ''), data->>'fullName'),
         username                = COALESCE(NULLIF(username, ''), data->>'username'),
         email                   = COALESCE(NULLIF(email, ''), data->>'email'),
         phone                   = COALESCE(NULLIF(phone, ''), data->>'phone'),
         portal_role             = COALESCE(NULLIF(portal_role, ''), data->>'portalRole'),
         type                    = COALESCE(NULLIF(type, ''), data->>'type'),
         approval_status         = COALESCE(NULLIF(approval_status, ''), data->>'approvalStatus'),
         notes                   = COALESCE(NULLIF(notes, ''), data->>'notes'),
         auth_uid                = COALESCE(NULLIF(auth_uid, ''), data->>'uid'),
         address                 = COALESCE(NULLIF(address, ''), data->>'address'),
         gps_location            = COALESCE(NULLIF(gps_location, ''), data->>'gpsLocation'),
         financial_currency      = COALESCE(NULLIF(financial_currency, ''), data->>'financialCurrency'),
         financial_account_id    = COALESCE(NULLIF(financial_account_id, ''), data->>'financialAccountId'),
         financial_account_code  = COALESCE(NULLIF(financial_account_code, ''), data->>'financialAccountCode'),
         financial_balance       = COALESCE(financial_balance, alx_api_private.payload_number(data, 'financialBalance')),
         identity_doc_note       = COALESCE(NULLIF(identity_doc_note, ''), data->>'identityDocNote'),
         company_name            = COALESCE(NULLIF(company_name, ''), data->>'companyName'),
         courier_type            = COALESCE(NULLIF(courier_type, ''), data->>'courierType'),
         profile_image_url       = COALESCE(NULLIF(profile_image_url, ''), data->>'profileImageUrl'),
         commercial_register_url = COALESCE(NULLIF(commercial_register_url, ''), data->>'commercialRegisterUrl', data->>'commercialRegister'),
         identity_doc_url        = COALESCE(NULLIF(identity_doc_url, ''), data->>'identityDocUrl'),
         linked_customer_id      = COALESCE(NULLIF(linked_customer_id, ''), data->>'linkedCustomerId', data->>'linkedAccId'),
         join_by                 = COALESCE(NULLIF(join_by, ''), data->>'joinBy'),
         referrer_id             = COALESCE(NULLIF(referrer_id, ''), data->>'referrerId'),
         is_disabled             = COALESCE(is_disabled, disabled, alx_api_private.payload_boolean(data, 'isDisabled'), false),
         disabled                = COALESCE(is_disabled, disabled, alx_api_private.payload_boolean(data, 'isDisabled'), false),
         created_at              = COALESCE(created_at, alx_api_private.payload_timestamp(data, 'createdAt')),
         updated_at              = COALESCE(updated_at, alx_api_private.payload_timestamp(data, 'updatedAt')),
         onboarding_completed    = COALESCE(onboarding_completed, alx_api_private.payload_boolean(data, 'onboardingCompleted'))
   WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
END
$$;

-- عمود حالة الإيقاف واحد الحسم؛ التعطيل لا يُقرأ من علمين متضادين.
-- One authoritative disabled flag; the API never reconciles two contradicting booleans.
UPDATE public.portal_users SET is_disabled = COALESCE(disabled, false) WHERE is_disabled IS NULL;
ALTER TABLE public.portal_users ALTER COLUMN is_disabled SET DEFAULT false;
ALTER TABLE public.portal_users ALTER COLUMN is_disabled SET NOT NULL;

CREATE INDEX IF NOT EXISTS portal_users_auth_uid_idx ON public.portal_users (auth_uid) WHERE auth_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS portal_users_linked_customer_idx ON public.portal_users (linked_customer_id) WHERE linked_customer_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portal_users TO alx_api_runtime;

COMMENT ON TABLE public.portal_users IS
  'مستخدمو البوابة بحقول حقيقية مسطّحة، بلا حمولة jsonb — flat portal users without a payload column.';

-- ========== 0029_flatten_legacy_catalog_tables.sql ==========
-- 0029_flatten_legacy_catalog_tables.sql
-- تسطير الجداول التشغيلية القديمة: حالات الطلب، خيارات الطلب، فئات الأصناف، المتصفح،
-- إعدادات المستخدم، الرواتب، الشحنات، تفاصيل العملاء، والواتساب.
-- Flattens the remaining legacy tables so the API reads and writes first-class columns only.
-- الترحيل idempotent: آمن عند إعادة التنفيذ، وآمن بعد 0034 (إسقاط أعمدة jsonb).
-- Idempotent: safe to re-run, and safe after 0034 dropped the payload columns.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ضمان الأعمدة المسطّحة التي ستُستخدم في التعبئة — guarantee the flat targets exist.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.items_category
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS requires_high_value_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_hazard_review boolean NOT NULL DEFAULT false;

ALTER TABLE public.salary_history
  ADD COLUMN IF NOT EXISTS employee_name text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS account_code text;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS shipping_category_name text;

ALTER TABLE public.cust_details
  ADD COLUMN IF NOT EXISTS preferred_categories text[],
  ADD COLUMN IF NOT EXISTS location text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. حالات الطلب / order_status
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'order_status' AND column_name = 'data'
  ) THEN
    UPDATE public.order_status
       SET name_ar     = COALESCE(NULLIF(name_ar, ''),     data->>'nameAr'),
           name_en     = COALESCE(NULLIF(name_en, ''),     data->>'nameEn'),
           code        = COALESCE(NULLIF(code, ''),        data->>'code'),
           color       = COALESCE(NULLIF(color, ''),       data->>'color'),
           description = COALESCE(NULLIF(description, ''), data->>'description'),
           is_first    = COALESCE(is_first, alx_api_private.payload_boolean(data, 'isFirst')),
           is_last     = COALESCE(is_last,  alx_api_private.payload_boolean(data, 'isLast')),
           sort_order  = COALESCE(sort_order, alx_api_private.cast_integer(data->>'sortOrder'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. خيارات الطلب / order_option — تفاصيل نصية عادية بلا أي jsonb.
--    Order options keep a plain text details column; older clones stored it as jsonb.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'order_option' AND column_name = 'data'
  ) THEN
    UPDATE public.order_option
       SET name_ar  = COALESCE(NULLIF(name_ar, ''), data->>'nameAr'),
           name_en  = COALESCE(NULLIF(name_en, ''), data->>'nameEn'),
           code     = COALESCE(NULLIF(code, ''),    data->>'code'),
           type     = COALESCE(NULLIF(type, ''),    data->>'type'),
           price    = COALESCE(price,    alx_api_private.payload_number(data, 'price')),
           duration = COALESCE(duration, alx_api_private.cast_integer(data->>'duration'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'order_option'
       AND column_name = 'details' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.order_option
      ALTER COLUMN details TYPE text USING (NULLIF(btrim(details #>> '{}'), ''));
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. فئات الأصناف / items_category — مراجعة القيم المرتفعة والبضائع الخطرة أعمدة حقيقية.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'items_category'
       AND column_name = 'details' AND data_type = 'jsonb'
  ) THEN
    UPDATE public.items_category
       SET group_name                 = COALESCE(NULLIF(group_name, ''), details->>'group'),
           requires_high_value_review = COALESCE(requires_high_value_review, alx_api_private.payload_boolean(details, 'highValueReview'), false),
           requires_hazard_review     = COALESCE(requires_hazard_review,     alx_api_private.payload_boolean(details, 'hazardReview'), false)
     WHERE details IS NOT NULL AND jsonb_typeof(details) = 'object';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. قواعد القيد التلقائي / auto_entries
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'auto_entries' AND column_name = 'data'
  ) THEN
    UPDATE public.auto_entries
       SET name_ar             = COALESCE(NULLIF(name_ar, ''), data->>'nameAr', data->>'name_ar'),
           name_en             = COALESCE(NULLIF(name_en, ''), data->>'nameEn', data->>'name_en'),
           description_temp_ar = COALESCE(NULLIF(description_temp_ar, ''), data->>'descriptionTempAr'),
           description_temp_en = COALESCE(NULLIF(description_temp_en, ''), data->>'descriptionTempEn'),
           credit_account      = COALESCE(NULLIF(credit_account, ''), data->>'creditAccount'),
           debit_account       = COALESCE(NULLIF(debit_account, ''),  data->>'debitAccount'),
           amount_source       = COALESCE(NULLIF(amount_source, ''),  data->>'amountSource', data->>'amount_source'),
           amount_strategy     = COALESCE(NULLIF(amount_strategy, ''), data->>'amountStrategy', data->>'amount_strategy'),
           status_name_ar      = COALESCE(NULLIF(status_name_ar, ''), data->>'statusNameAr'),
           skip_when_zero      = COALESCE(skip_when_zero, alx_api_private.payload_boolean(data, 'skipWhenZero'),
                                          alx_api_private.payload_boolean(data, 'skip_when_zero')),
           currency            = COALESCE(NULLIF(currency, ''), data->>'currencyId', data->>'currency'),
           cur_no              = COALESCE(cur_no, alx_api_private.cast_integer(data->>'curNo'),
                                          alx_api_private.cast_integer(data->>'cur_no')),
           auto_post           = COALESCE(auto_post, alx_api_private.payload_boolean(data, 'autoPost'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;

  -- مصادر المبالغ: jsonb[] → text[] مرة واحدة فقط — convert the array column exactly once.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'auto_entries'
       AND column_name = 'amount_sources' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.auto_entries
      ALTER COLUMN amount_sources TYPE text[]
        USING COALESCE((SELECT array_agg(btrim(x.value #>> '{}'))
                          FROM jsonb_array_elements(
                                 CASE WHEN jsonb_typeof(amount_sources) = 'array'
                                      THEN amount_sources ELSE '[]'::jsonb END
                               ) AS x(value)
                         WHERE btrim(x.value #>> '{}') <> ''),
                       '{}');
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. صفحات المتصفح / browser_pages
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'browser_pages' AND column_name = 'data'
  ) THEN
    UPDATE public.browser_pages
       SET name_ar   = COALESCE(NULLIF(name_ar, ''), data->>'name', data->>'nameAr'),
           name_en   = COALESCE(NULLIF(name_en, ''), data->>'name', data->>'nameEn'),
           url       = COALESCE(NULLIF(url, ''), data->>'url'),
           category  = COALESCE(NULLIF(category, ''), data->>'category'),
           username  = COALESCE(NULLIF(username, ''), data->>'username'),
           password  = COALESCE(NULLIF(password, ''), data->>'password'),
           view_mode = COALESCE(NULLIF(view_mode, ''), data->>'viewMode'),
           tab_color = COALESCE(NULLIF(tab_color, ''), data->>'tabColor'),
           auto_login = COALESCE(auto_login, alx_api_private.payload_boolean(data, 'autoLogin')),
           is_pinned  = COALESCE(is_pinned,  alx_api_private.payload_boolean(data, 'isPinned')),
           sort_order = COALESCE(sort_order, alx_api_private.cast_integer(data->>'sortOrder'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. إعدادات المستخدم / user_settings — المقاييس الظاهرة text[] بدل jsonb.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'data'
  ) THEN
    UPDATE public.user_settings
       SET user_id = COALESCE(NULLIF(user_id, ''), data->>'userid', data->>'userId'),
           language = COALESCE(NULLIF(language, ''), data->>'language'),
           theme    = COALESCE(NULLIF(theme, ''),    data->>'theme'),
           font_size = COALESCE(NULLIF(font_size, ''), data->>'fontSize'),
           dashboard_grid_columns = COALESCE(dashboard_grid_columns,
                             alx_api_private.cast_integer(data->>'dashboardGridColumns'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_settings'
       AND column_name = 'visible_metrics' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.user_settings
      ALTER COLUMN visible_metrics TYPE text[]
        USING COALESCE((SELECT array_agg(btrim(x.value #>> '{}'))
                          FROM jsonb_array_elements(
                                 CASE WHEN jsonb_typeof(visible_metrics) = 'array'
                                      THEN visible_metrics ELSE '[]'::jsonb END
                               ) AS x(value)
                         WHERE btrim(x.value #>> '{}') <> ''),
                       '{}');
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. سجل الرواتب / salary_history
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'salary_history' AND column_name = 'data'
  ) THEN
    UPDATE public.salary_history
       SET employee_id     = COALESCE(NULLIF(employee_id, ''), data->>'employeeId'),
           employee_name   = COALESCE(NULLIF(employee_name, ''), data->>'employeeName'),
           created_by_name = COALESCE(NULLIF(created_by_name, ''), data->>'createdByName'),
           account_code    = COALESCE(NULLIF(account_code, ''), data->>'accountCode'),
           amount          = COALESCE(amount, alx_api_private.payload_number(data, 'amount')),
           currency        = COALESCE(NULLIF(currency, ''), data->>'currency'),
           month           = COALESCE(NULLIF(month, ''), data->>'salaryMonth', data->>'month'),
           voucher_code    = COALESCE(NULLIF(voucher_code, ''), data->>'voucherCode'),
           status          = COALESCE(NULLIF(status, ''), data->>'status'),
           notes           = COALESCE(NULLIF(notes, ''), data->>'notes'),
           paid_at         = COALESCE(paid_at, alx_api_private.cast_timestamp(data->>'paidAt'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. الشحنات / shipments
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'data'
  ) THEN
    UPDATE public.shipments
       SET shipping_type           = COALESCE(NULLIF(shipping_type, ''), data->>'shippingType'),
           shipping_source         = COALESCE(NULLIF(shipping_source, ''), data->>'shippingSource'),
           shipping_destination    = COALESCE(NULLIF(shipping_destination, ''), data->>'shippingDestination'),
           shipping_category_name  = COALESCE(NULLIF(shipping_category_name, ''), data->>'shippingCategoryName'),
           shipping_company_id     = COALESCE(NULLIF(shipping_company_id, ''), data->>'shippingCompany'),
           shipping_category_price = COALESCE(shipping_category_price, alx_api_private.payload_number(data, 'shippingCategoryPrice')),
           expected_arrival        = COALESCE(expected_arrival, alx_api_private.payload_timestamp(data, 'expectedArrival')),
           shipping_date           = COALESCE(shipping_date,    alx_api_private.payload_timestamp(data, 'shippingDate')),
           delivery_date           = COALESCE(delivery_date,    alx_api_private.payload_timestamp(data, 'deliveryDate')),
           shipping_duration       = COALESCE(shipping_duration, alx_api_private.cast_integer(data->>'shippingDuration')),
           packaging_fees          = COALESCE(packaging_fees,   alx_api_private.payload_number(data, 'packagingFees'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. تفاصيل العملاء / cust_details
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'cust_details' AND column_name = 'data'
  ) THEN
    UPDATE public.cust_details
       SET age            = COALESCE(age, alx_api_private.cast_integer(data->>'age')),
           gender         = COALESCE(NULLIF(gender, ''), data->>'gender'),
           city           = COALESCE(NULLIF(city, ''), data->>'city'),
           country        = COALESCE(NULLIF(country, ''), data->>'country'),
           company_name   = COALESCE(NULLIF(company_name, ''), data->>'company_name', data->>'companyName'),
           id_number      = COALESCE(NULLIF(id_number, ''), data->>'id_number', data->>'idNumber'),
           max_debt       = COALESCE(max_debt, alx_api_private.payload_number(data, 'max_debt'),
                                     alx_api_private.payload_number(data, 'maxDebt')),
           notes          = COALESCE(NULLIF(notes, ''), data->>'notes'),
           gps_location   = COALESCE(NULLIF(gps_location, ''), data->>'gps_location', data->>'gpsLocation'),
           body_details   = COALESCE(NULLIF(body_details, ''), data->>'bodyDetails'),
           location       = COALESCE(NULLIF(location, ''), data->>'location'),
           join_by        = COALESCE(NULLIF(join_by, ''), data->>'joinBy'),
           referrer_id    = COALESCE(NULLIF(referrer_id, ''), data->>'referrerId'),
           onboarding_completed     = COALESCE(onboarding_completed, alx_api_private.payload_boolean(data, 'onboardingCompleted')),
           privacy_policy_agreed    = COALESCE(privacy_policy_agreed, alx_api_private.payload_boolean(data, 'privacyPolicyAgreed')),
           privacy_policy_agreed_at = COALESCE(privacy_policy_agreed_at, alx_api_private.payload_timestamp(data, 'privacyPolicyAgreedAt'))
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';

    -- الفئات المفضلة: مصفوفة نصية حقيقية — preferred categories become a real text[].
    UPDATE public.cust_details
       SET preferred_categories = alx_api_private.payload_text_array(data, 'preferredCategories')
     WHERE preferred_categories IS NULL
       AND data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. العملاء / customers — الاسم الكامل وعمود نصي والمصفوفات text[]
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.customers
   SET full_name = COALESCE(NULLIF(full_name, ''), NULLIF(btrim(name_ar), ''), NULLIF(btrim(name_en), ''))
 WHERE full_name IS NULL OR btrim(full_name) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'customers'
       AND column_name = 'preferred_categories' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.customers
      ALTER COLUMN preferred_categories TYPE text[]
        USING COALESCE((SELECT array_agg(btrim(x.value #>> '{}'))
                          FROM jsonb_array_elements(
                                 CASE WHEN jsonb_typeof(preferred_categories) = 'array'
                                      THEN preferred_categories ELSE '[]'::jsonb END
                               ) AS x(value)
                         WHERE btrim(x.value #>> '{}') <> ''),
                       '{}');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'customers'
       AND column_name = 'body_details' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.customers ALTER COLUMN body_details TYPE text USING (body_details #>> '{}');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'customers'
       AND column_name = 'location' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.customers ALTER COLUMN location TYPE text USING (location #>> '{}');
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. سجلات الواتساب / whatsapp_logs
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'whatsapp_logs' AND column_name = 'data'
  ) THEN
    UPDATE public.whatsapp_logs
       SET phone      = COALESCE(NULLIF(phone, ''), data->>'phone'),
           message    = COALESCE(NULLIF(message, ''), data->>'message'),
           status     = COALESCE(NULLIF(status, ''), data->>'status'),
           event_type = COALESCE(NULLIF(event_type, ''), data->>'eventType'),
           error_msg  = COALESCE(NULLIF(error_msg, ''), data->>'errorMsg')
     WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'whatsapp_logs'
       AND column_name = 'external_response' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.whatsapp_logs
      ALTER COLUMN external_response TYPE text USING (external_response #>> '{}');
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. الأمان والصلاحيات — grants (alx_api_runtime بلا DDL).
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.order_status, public.order_option, public.items_category, public.auto_entries,
  public.browser_pages, public.user_settings, public.salary_history, public.shipments,
  public.cust_details, public.customers, public.whatsapp_logs
  TO alx_api_runtime;

COMMENT ON TABLE public.order_option IS
  'خيارات الطلب: التفاصيل نص عادي، بلا حمولة jsonb — order options with plain-text details.';

-- ========== 0030_flatten_orders.sql ==========
-- 0030_flatten_orders.sql
-- تسطير الطلبات: كل حقل كان داخل data يصبح عمودًا حقيقيًا في جدول orders.
-- Flattens orders: every field that lived inside the jsonb payload becomes a first-class column.
-- هذا هو سبب عدم ظهور حقول الطلب كاملة في الواجهة قبل التسطير.
-- This is why the order fields were missing from the UI before the flattening.

ALTER TABLE public.orders
  -- التكاليف والأرباح / costs and profits
  ADD COLUMN IF NOT EXISTS total_cost_yer numeric,
  ADD COLUMN IF NOT EXISTS total_cost_sar numeric,
  ADD COLUMN IF NOT EXISTS products_sum numeric,
  ADD COLUMN IF NOT EXISTS sourcing_cost_amount numeric,
  ADD COLUMN IF NOT EXISTS sourcing_cost_source text,
  ADD COLUMN IF NOT EXISTS delivery_courier_fee numeric,
  ADD COLUMN IF NOT EXISTS delivery_courier_fee_currency text,
  ADD COLUMN IF NOT EXISTS delivery_courier_fee_order_currency numeric,
  ADD COLUMN IF NOT EXISTS shipping_cost_sar numeric,
  ADD COLUMN IF NOT EXISTS shipping_courier_fee_rate numeric,
  ADD COLUMN IF NOT EXISTS product_insurance_fee numeric,
  ADD COLUMN IF NOT EXISTS packaging_fee numeric,
  ADD COLUMN IF NOT EXISTS packaging_fee_rate numeric,
  ADD COLUMN IF NOT EXISTS profit_company_sar numeric,
  ADD COLUMN IF NOT EXISTS profit_saudi_sar numeric,
  ADD COLUMN IF NOT EXISTS profit_per_kg_rate numeric,
  ADD COLUMN IF NOT EXISTS company_profit_rate numeric,
  ADD COLUMN IF NOT EXISTS shein_red_price numeric,
  ADD COLUMN IF NOT EXISTS cbm_shipping_rate_value numeric,
  ADD COLUMN IF NOT EXISTS total_cbm numeric,
  ADD COLUMN IF NOT EXISTS total_weight numeric,
  -- المدفوعات / payments
  ADD COLUMN IF NOT EXISTS amount_paid numeric,
  ADD COLUMN IF NOT EXISTS amount_remaining numeric,
  ADD COLUMN IF NOT EXISTS cash_amount numeric,
  ADD COLUMN IF NOT EXISTS bank_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS paid_currency_code text,
  ADD COLUMN IF NOT EXISTS bank_reference text,
  ADD COLUMN IF NOT EXISTS pay_later boolean,
  -- العملات وأسعار الصرف / currencies and exchange rates
  ADD COLUMN IF NOT EXISTS order_currency_code text,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate_usd numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate_yer numeric,
  -- الحسابات المرتبطة / linked accounting ids
  ADD COLUMN IF NOT EXISTS customer_account_id text,
  ADD COLUMN IF NOT EXISTS cash_account_id text,
  ADD COLUMN IF NOT EXISTS bank_account_id text,
  ADD COLUMN IF NOT EXISTS bank_commission_rate numeric,
  ADD COLUMN IF NOT EXISTS bank_commission_type text,
  ADD COLUMN IF NOT EXISTS bank_commission_enabled boolean,
  -- الكوبون / coupon
  ADD COLUMN IF NOT EXISTS coupon_rate numeric,
  ADD COLUMN IF NOT EXISTS coupon_value numeric,
  ADD COLUMN IF NOT EXISTS coupon_enabled boolean,
  -- الحالة والتوصيل / status and delivery
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS location_yemen text,
  ADD COLUMN IF NOT EXISTS shipping_company text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS cart_share_code text,
  -- الأعلام / flags
  ADD COLUMN IF NOT EXISTS add_shipping_enabled boolean,
  ADD COLUMN IF NOT EXISTS home_delivery_enabled boolean,
  ADD COLUMN IF NOT EXISTS packaging_fee_enabled boolean,
  ADD COLUMN IF NOT EXISTS deduct_sourcing_cost_from_courier boolean,
  ADD COLUMN IF NOT EXISTS via_shipping_agent boolean,
  ADD COLUMN IF NOT EXISTS direct_approve boolean,
  -- الهوية والعرض: أسماء العملاء والمستلمين كانت داخل الحمولة فلا تظهر الحقول في الواجهة.
  -- Identity and display fields lived only in the payload, which is why the order columns looked empty in the UI.
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_address text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS order_source_name text,
  ADD COLUMN IF NOT EXISTS goods_description text,
  ADD COLUMN IF NOT EXISTS customer_uid text,
  ADD COLUMN IF NOT EXISTS portal_uid text;

CREATE TABLE IF NOT EXISTS public.order_fired_trigger (
  order_id text NOT NULL REFERENCES public.orders (order_id) ON DELETE CASCADE,
  seq integer NOT NULL,
  trigger_name text NOT NULL,
  PRIMARY KEY (order_id, seq)
);

-- 1) التعبئة من data — backfill every new column from the legacy payload.
-- الحراسة مطلوبة: بعد 0034 لا يوجد عمود data، وإعادة التنفيذ يجب أن تنجح.
-- Guarded so a re-run after 0034 (payload dropped) still succeeds.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'data'
  ) THEN
    RETURN;
  END IF;

UPDATE public.orders
   SET total_cost_yer                    = COALESCE(total_cost_yer, alx_api_private.payload_number(data, 'totalCostYER')),
       total_cost_sar                    = COALESCE(total_cost_sar, alx_api_private.payload_number(data, 'totalCostSAR')),
       products_sum                      = COALESCE(products_sum, alx_api_private.payload_number(data, 'productsSum')),
       sourcing_cost_amount              = COALESCE(sourcing_cost_amount, alx_api_private.payload_number(data, 'sourcingCostAmount')),
       sourcing_cost_source              = COALESCE(sourcing_cost_source, alx_api_private.payload_text(data, VARIADIC ARRAY['sourcing_cost', 'sourcingCost'])),
       delivery_courier_fee              = COALESCE(delivery_courier_fee, alx_api_private.payload_number(data, 'deliveryCourierFee')),
       delivery_courier_fee_currency     = COALESCE(delivery_courier_fee_currency, alx_api_private.payload_text(data, 'deliveryCourierFeeCurrency')),
       delivery_courier_fee_order_currency = COALESCE(delivery_courier_fee_order_currency, alx_api_private.payload_number(data, 'deliveryCourierFeeOrderCurrency')),
       shipping_cost_sar                 = COALESCE(shipping_cost_sar, alx_api_private.payload_number(data, 'shippingCostSAR')),
       shipping_courier_fee_rate         = COALESCE(shipping_courier_fee_rate, alx_api_private.payload_number(data, 'shippingCourierFeeRate')),
       product_insurance_fee             = COALESCE(product_insurance_fee, alx_api_private.payload_number(data, 'productInsuranceFee'), alx_api_private.payload_number(data, 'product_insurance_fee')),
       packaging_fee                     = COALESCE(packaging_fee, alx_api_private.payload_number(data, 'packagingFee')),
       packaging_fee_rate                = COALESCE(packaging_fee_rate, alx_api_private.payload_number(data, 'packagingFeeRate')),
       profit_company_sar                = COALESCE(profit_company_sar, alx_api_private.payload_number(data, 'profitCompanySAR')),
       profit_saudi_sar                  = COALESCE(profit_saudi_sar, alx_api_private.payload_number(data, 'profitSaudiSAR')),
       profit_per_kg_rate                = COALESCE(profit_per_kg_rate, alx_api_private.payload_number(data, 'profitPerKgRate')),
       company_profit_rate               = COALESCE(company_profit_rate, alx_api_private.payload_number(data, 'companyProfitRate')),
       shein_red_price                   = COALESCE(shein_red_price, alx_api_private.payload_number(data, 'sheinRedPrice')),
       cbm_shipping_rate_value           = COALESCE(cbm_shipping_rate_value, alx_api_private.payload_number(data, 'cbmShippingRateValue')),
       total_cbm                         = COALESCE(total_cbm, alx_api_private.payload_number(data, 'totalCBM')),
       total_weight                      = COALESCE(total_weight, alx_api_private.payload_number(data, 'totalWeight')),
       amount_paid                       = COALESCE(amount_paid, alx_api_private.payload_number(data, 'amountPaid')),
       amount_remaining                  = COALESCE(amount_remaining, alx_api_private.payload_number(data, 'amountRemaining')),
       cash_amount                       = COALESCE(cash_amount, alx_api_private.payload_number(data, 'cashAmount')),
       bank_amount                       = COALESCE(bank_amount, alx_api_private.payload_number(data, 'bankAmount')),
       payment_method                    = COALESCE(payment_method, alx_api_private.payload_text(data, 'paymentMethod')),
       payment_status                    = COALESCE(payment_status, alx_api_private.payload_text(data, 'paymentStatus')),
       paid_currency_code                = COALESCE(paid_currency_code, alx_api_private.payload_text(data, 'paidCurrency')),
       bank_reference                    = COALESCE(bank_reference, alx_api_private.payload_text(data, 'bankReference')),
       pay_later                         = COALESCE(pay_later, alx_api_private.payload_boolean(data, 'payLater')),
       order_currency_code               = COALESCE(order_currency_code, alx_api_private.payload_text(data, VARIADIC ARRAY['orderCurrency', 'currency'])),
       exchange_rate                     = COALESCE(exchange_rate, alx_api_private.payload_number(data, 'exchangeRate')),
       exchange_rate_usd                 = COALESCE(exchange_rate_usd, alx_api_private.payload_number(data, 'exchangeRateUSD')),
       exchange_rate_yer                 = COALESCE(exchange_rate_yer, alx_api_private.payload_number(data, 'exchangeRateYER')),
       customer_account_id               = COALESCE(customer_account_id, alx_api_private.payload_text(data, 'customerAccountId')),
       cash_account_id                   = COALESCE(cash_account_id, alx_api_private.payload_text(data, 'cashAccountId')),
       bank_account_id                   = COALESCE(bank_account_id, alx_api_private.payload_text(data, 'bankAccountId')),
       bank_commission_rate              = COALESCE(bank_commission_rate, alx_api_private.payload_number(data, 'bankCommissionRate')),
       bank_commission_type              = COALESCE(bank_commission_type, alx_api_private.payload_text(data, 'bankCommissionType')),
       bank_commission_enabled           = COALESCE(bank_commission_enabled, alx_api_private.payload_boolean(data, 'bankCommissionEnabled')),
       coupon_rate                       = COALESCE(coupon_rate, alx_api_private.payload_number(data, 'couponRate')),
       coupon_value                      = COALESCE(coupon_value, alx_api_private.payload_number(data, 'couponValue')),
       coupon_enabled                    = COALESCE(coupon_enabled, alx_api_private.payload_boolean(data, 'couponEnabled')),
       delivery_status                   = COALESCE(delivery_status, alx_api_private.payload_text(data, 'deliveryStatus')),
       location_yemen                    = COALESCE(location_yemen, alx_api_private.payload_text(data, 'locationYemen')),
       shipping_company                  = COALESCE(shipping_company, alx_api_private.payload_text(data, 'shippingCompany')),
       internal_notes                    = COALESCE(internal_notes, alx_api_private.payload_text(data, 'internalNotes')),
       cart_share_code                   = COALESCE(cart_share_code, alx_api_private.payload_text(data, 'cartShareCode')),
       add_shipping_enabled              = COALESCE(add_shipping_enabled, alx_api_private.payload_boolean(data, 'addShippingEnabled')),
       home_delivery_enabled             = COALESCE(home_delivery_enabled, alx_api_private.payload_boolean(data, 'homeDeliveryEnabled')),
       packaging_fee_enabled             = COALESCE(packaging_fee_enabled, alx_api_private.payload_boolean(data, 'packagingFeeEnabled')),
       deduct_sourcing_cost_from_courier = COALESCE(deduct_sourcing_cost_from_courier, alx_api_private.payload_boolean(data, 'deductSourcingCostFromCourier')),
       via_shipping_agent                = COALESCE(via_shipping_agent, alx_api_private.payload_boolean(data, 'viaShippingAgent')),
       direct_approve                    = COALESCE(direct_approve, alx_api_private.payload_boolean(data, 'directApprove')),
       -- أعمدة موجودة يُعاد تعبئتها الفارغ منها — existing columns get their empty values backfilled.
       order_number                      = COALESCE(NULLIF(order_number, ''), alx_api_private.payload_text(data, 'orderNumber')),
       tracking_number                   = COALESCE(NULLIF(tracking_number, ''), alx_api_private.payload_text(data, 'trackingNumber')),
       order_status1                     = COALESCE(NULLIF(order_status1, ''), alx_api_private.payload_text(data, VARIADIC ARRAY['orderStatus', 'order_status1', 'status'])),
       customer_id                       = COALESCE(NULLIF(customer_id, ''), alx_api_private.payload_text(data, 'customerId')),
       employee_id                       = COALESCE(NULLIF(employee_id, ''), alx_api_private.payload_text(data, 'employeeId')),
       courier_id                        = COALESCE(NULLIF(courier_id, ''), alx_api_private.payload_text(data, 'courierId')),
       order_party_id                    = COALESCE(NULLIF(order_party_id, ''), alx_api_private.payload_text(data, 'orderPartyId')),
       order_party_type                  = COALESCE(NULLIF(order_party_type, ''), alx_api_private.payload_text(data, 'orderPartyType')),
       order_party_account_id            = COALESCE(NULLIF(order_party_account_id, ''), alx_api_private.payload_text(data, 'orderPartyAccountId')),
       order_source_type                 = COALESCE(NULLIF(order_source_type, ''), alx_api_private.payload_text(data, 'orderSourceType')),
       external_order_number             = COALESCE(NULLIF(external_order_number, ''), alx_api_private.payload_text(data, 'externalOrderNumber')),
       is_staff_order                    = COALESCE(is_staff_order, alx_api_private.payload_boolean(data, 'isStaffOrder')),
       -- الهوية والعرض / identity and display
       customer_name                     = COALESCE(NULLIF(customer_name, ''), alx_api_private.payload_text(data, 'customerName')),
       customer_phone                    = COALESCE(NULLIF(customer_phone, ''), alx_api_private.payload_text(data, 'customerPhone')),
       customer_email                    = COALESCE(NULLIF(customer_email, ''), alx_api_private.payload_text(data, 'customerEmail')),
       customer_address                  = COALESCE(NULLIF(customer_address, ''), alx_api_private.payload_text(data, 'customerAddress')),
       recipient_name                    = COALESCE(NULLIF(recipient_name, ''), alx_api_private.payload_text(data, 'recipientName')),
       recipient_phone                   = COALESCE(NULLIF(recipient_phone, ''), alx_api_private.payload_text(data, 'recipientPhone')),
       recipient_address                 = COALESCE(NULLIF(recipient_address, ''), alx_api_private.payload_text(data, 'recipientAddress')),
       delivery_city                     = COALESCE(NULLIF(delivery_city, ''), alx_api_private.payload_text(data, 'deliveryCity')),
       order_source_name                 = COALESCE(NULLIF(order_source_name, ''), alx_api_private.payload_text(data, 'orderSourceName')),
       goods_description                 = COALESCE(NULLIF(goods_description, ''), alx_api_private.payload_text(data, VARIADIC ARRAY['goodsDescription', 'description'])),
       customer_uid                      = COALESCE(NULLIF(customer_uid, ''), alx_api_private.payload_text(data, VARIADIC ARRAY['customerUid', 'customerId'])),
       portal_uid                        = COALESCE(NULLIF(portal_uid, ''), alx_api_private.payload_text(data, 'portalUid'))
 WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
END
$$;

-- 2) المحفزات صفوف علائقية — fired triggers become relational rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'data'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.order_fired_trigger (order_id, seq, trigger_name)
       SELECT o.order_id, (x.ordinality - 1)::integer, btrim(x.value #>> '{}')
         FROM public.orders o,
              jsonb_array_elements_text(COALESCE(o.data->'firedTriggers', '[]'::jsonb))
                WITH ORDINALITY AS x(value, ordinality)
        WHERE jsonb_typeof(o.data->'firedTriggers') = 'array'
          AND o.data IS NOT NULL AND jsonb_typeof(o.data) = 'object'
          AND btrim(x.value) <> ''
       ON CONFLICT (order_id, seq) DO NOTHING;
END
$$;

CREATE INDEX IF NOT EXISTS order_fired_trigger_order_idx ON public.order_fired_trigger (order_id);
CREATE INDEX IF NOT EXISTS orders_total_cost_yer_idx ON public.orders (total_cost_yer);
CREATE INDEX IF NOT EXISTS orders_portal_provenance_idx ON public.orders (customer_uid, portal_uid);

ALTER TABLE public.order_fired_trigger DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders, public.order_fired_trigger TO alx_api_runtime;

-- ========== 0031_flatten_settings.sql ==========
-- 0031_flatten_settings.sql
-- تسطير الإعدادات: جدول لكل فئة إعدادات بأعمدة حقيقية، والجداول التابعة للمصفوفات.
-- Flattens settings: one table per settings category with real columns, child tables for the arrays.
-- لا يبقى أي مستند jsonb في الإعدادات بعد هذا الترحيل. — no jsonb document survives in settings.
--
-- ترتيب التنفيذ: هذا الترحيل يقرأ public.settings.data، لذا يجب أن يسبق 0034.
-- إن كان العمود قد حُذف مسبقاً فإن التنفيذ يتوقف برسالة واضحة بدل فشل نصفي.
-- Ordering: run before 0034 (it reads the settings payload); a missing payload stops with a clear message.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'data'
  ) THEN
    RAISE EXCEPTION '0031 must run before 0034: public.settings.data is already gone.'
      USING HINT = 'Restoring settings from the payload is impossible after the drop; verify the flat tables instead.';
  END IF;
END
$$;

-- ── الإعدادات العامة / general ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings_general (
  settings_key text PRIMARY KEY DEFAULT 'general',
  tax_id text,
  theme text,
  language text,
  currency text,
  currency_symbol text,
  font_size text,
  system_name text,
  system_logo text,
  invoice_logo text,
  invoice_notes text,
  company_name text,
  company_address text,
  company_email text,
  company_phone text,
  company_website text,
  order_prefix text,
  order_start_number integer,
  default_order_currency text,
  exchange_rate_sar numeric,
  exchange_rate_usd numeric,
  exchange_rates_api_url text,
  cbm_shipping_rate_api_url text,
  default_cbm_shipping_rate numeric,
  last_cbm_rate_update text,
  last_cbm_rate_updated_by text,
  last_exchange_rate_update text,
  last_exchange_rate_updated_by text,
  last_exchange_rate_update_time text,
  auto_update_exchange_rates boolean,
  default_delivery_fee numeric,
  default_packaging_fee numeric,
  default_product_insurance_fee numeric,
  default_product_insurance_type text,
  default_profit_per_kg numeric,
  default_company_profit_rate numeric,
  default_courier_commission_rate numeric,
  default_bank_commission_rate numeric,
  default_shipping_duration integer,
  default_yemen_delivery_duration integer,
  default_factory_duration integer,
  default_shein_duration integer,
  default_app_duration integer,
  user_session_timeout integer,
  protect_sensitive_order_delete boolean,
  auto_backup_enabled boolean,
  backup_schedule text,
  backup_retention_days integer,
  backup_encrypted boolean,
  backup_count integer,
  last_backup text,
  last_auto_backup_at double precision,
  user_setting_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings_general (settings_key, tax_id, theme, language, currency, currency_symbol, font_size,
  system_name, system_logo, invoice_logo, invoice_notes, company_name, company_address, company_email, company_phone,
  company_website, order_prefix, order_start_number, default_order_currency, exchange_rate_sar, exchange_rate_usd,
  exchange_rates_api_url, cbm_shipping_rate_api_url, default_cbm_shipping_rate, last_cbm_rate_update,
  last_cbm_rate_updated_by, last_exchange_rate_update, last_exchange_rate_updated_by, last_exchange_rate_update_time,
  auto_update_exchange_rates, default_delivery_fee, default_packaging_fee, default_product_insurance_fee,
  default_product_insurance_type, default_profit_per_kg, default_company_profit_rate, default_courier_commission_rate,
  default_bank_commission_rate, default_shipping_duration, default_yemen_delivery_duration, default_factory_duration,
  default_shein_duration, default_app_duration, user_session_timeout, protect_sensitive_order_delete,
  auto_backup_enabled, backup_schedule, backup_retention_days, backup_encrypted, backup_count, last_backup,
  last_auto_backup_at, user_setting_id, updated_at)
SELECT 'general',
       data->>'taxId', data->>'theme', data->>'language', data->>'currency', data->>'currencySymbol', data->>'fontSize',
       data->>'systemName', data->>'systemLogo', data->>'invoiceLogo', data->>'invoiceNotes', data->>'companyName',
       data->>'companyAddress', data->>'companyEmail', data->>'companyPhone', data->>'companyWebsite',
       data->>'orderPrefix', alx_api_private.cast_integer(data->>'orderStartNumber'), data->>'defaultOrderCurrency',
       alx_api_private.payload_number(data, 'exchangeRateSAR'), alx_api_private.payload_number(data, 'exchangeRateUSD'),
       data->>'exchangeRatesApiUrl', data->>'cbmShippingRateApiUrl',
       alx_api_private.payload_number(data, 'defaultCbmShippingRate'), data->>'lastCbmRateUpdate',
       data->>'lastCbmRateUpdatedBy', data->>'lastExchangeRateUpdate', data->>'lastExchangeRateUpdatedBy',
       data->>'lastExchangeRateUpdateTime', alx_api_private.payload_boolean(data, 'autoUpdateExchangeRates'),
       alx_api_private.payload_number(data, 'defaultDeliveryFee'), alx_api_private.payload_number(data, 'defaultPackagingFee'),
       alx_api_private.payload_number(data, 'defaultProductInsuranceFee'), data->>'defaultProductInsuranceType',
       alx_api_private.payload_number(data, 'defaultProfitPerKg'), alx_api_private.payload_number(data, 'defaultCompanyProfitRate'),
       alx_api_private.payload_number(data, 'defaultCourierCommissionRate'), alx_api_private.payload_number(data, 'defaultBankCommissionRate'),
       alx_api_private.cast_integer(data->>'defaultShippingDuration'), alx_api_private.cast_integer(data->>'defaultYemenDeliveryDuration'),
       alx_api_private.cast_integer(data->>'defaultFactoryDuration'), alx_api_private.cast_integer(data->>'defaultSheinDuration'),
       alx_api_private.cast_integer(data->>'defaultAppDuration'), alx_api_private.cast_integer(data->>'userSessionTimeout'),
       alx_api_private.payload_boolean(data, 'protectSensitiveOrderDelete'), alx_api_private.payload_boolean(data, 'autoBackupEnabled'),
       data->>'backupSchedule', alx_api_private.cast_integer(data->>'backupRetentionDays'),
       alx_api_private.payload_boolean(data, 'backupEncrypted'), alx_api_private.cast_integer(data->>'backupCount'),
       data->>'lastBackup', alx_api_private.payload_number(data, 'lastAutoBackupAt'), data->>'user_setting_id',
       COALESCE(updated_at, now())
  FROM public.settings WHERE setting_id = 'general'
ON CONFLICT (settings_key) DO NOTHING;

-- عملات المستخدم: صفوف بدل مصفوفة jsonb — custom currencies become rows, not a jsonb array.
CREATE TABLE IF NOT EXISTS public.settings_custom_currency (
  settings_key text NOT NULL DEFAULT 'general',
  code text NOT NULL,
  name text NOT NULL DEFAULT '',
  symbol text NOT NULL DEFAULT '',
  flag text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  rate_to_yer numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (settings_key, code)
);

INSERT INTO public.settings_custom_currency (settings_key, code, name, symbol, flag, is_active, rate_to_yer)
     SELECT 'general',
            COALESCE(NULLIF(x.value->>'code', ''), x.value->>'id'),
            COALESCE(x.value->>'name', ''), COALESCE(x.value->>'symbol', ''), COALESCE(x.value->>'flag', ''),
            COALESCE(alx_api_private.payload_boolean(x.value, 'isActive'), true),
            COALESCE(alx_api_private.payload_number(x.value, 'rateToYER'), 0)
       FROM public.settings s, jsonb_array_elements(s.data->'customCurrencies') x(value)
      WHERE s.setting_id = 'general' AND jsonb_typeof(s.data->'customCurrencies') = 'array'
        AND COALESCE(NULLIF(x.value->>'code', ''), x.value->>'id') IS NOT NULL
     ON CONFLICT DO NOTHING;

-- مجموعات النسخ الاحتياطي: صفوف بدل مصفوفة jsonb — backup collections become rows.
CREATE TABLE IF NOT EXISTS public.settings_backup_collection (
  settings_key text NOT NULL DEFAULT 'general',
  collection_name text NOT NULL,
  seq integer NOT NULL DEFAULT 1,
  PRIMARY KEY (settings_key, collection_name)
);

INSERT INTO public.settings_backup_collection (settings_key, collection_name, seq)
     SELECT 'general', btrim(x.value), (x.ordinality)::integer
       FROM public.settings s,
            jsonb_array_elements_text(s.data->'backupCollections') WITH ORDINALITY x(value, ordinality)
      WHERE s.setting_id = 'general' AND jsonb_typeof(s.data->'backupCollections') = 'array'
     ON CONFLICT DO NOTHING;

-- ── تكامل الشحن / logistics (نفس البنية لفئة logistics_api) ──────────────────
CREATE TABLE IF NOT EXISTS public.settings_logistics (
  provider_key text PRIMARY KEY,
  provider text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  api_key text NOT NULL DEFAULT '',
  default_destination_country text NOT NULL DEFAULT ''
);

INSERT INTO public.settings_logistics (provider_key, provider, enabled, api_key, default_destination_country)
     SELECT s.setting_id, COALESCE(s.data->>'provider', ''),
            COALESCE(alx_api_private.payload_boolean(s.data, 'enabled'), false),
            COALESCE(s.data->>'apiKey', ''), COALESCE(s.data->>'defaultDestinationCountry', '')
       FROM public.settings s WHERE s.setting_id IN ('logistics', 'logistics_api')
     ON CONFLICT (provider_key) DO NOTHING;

-- ── واتساب / whatsapp: config وtemplates وtriggers كلها جداول حقيقية ─────────
CREATE TABLE IF NOT EXISTS public.settings_whatsapp (
  settings_key text PRIMARY KEY DEFAULT 'whatsapp',
  enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT '',
  config_token text NOT NULL DEFAULT '',
  config_sender text NOT NULL DEFAULT '',
  config_instance_id text NOT NULL DEFAULT '',
  config_custom_url text NOT NULL DEFAULT '',
  config_custom_method text NOT NULL DEFAULT '',
  config_custom_body text NOT NULL DEFAULT '',
  config_custom_headers text NOT NULL DEFAULT '',
  config_account_sid text NOT NULL DEFAULT ''
);

INSERT INTO public.settings_whatsapp (settings_key, enabled, provider, config_token, config_sender, config_instance_id,
  config_custom_url, config_custom_method, config_custom_body, config_custom_headers, config_account_sid)
SELECT 'whatsapp', COALESCE(alx_api_private.payload_boolean(data, 'enabled'), false), COALESCE(data->>'provider', ''),
       COALESCE(data->'config'->>'token', ''), COALESCE(data->'config'->>'sender', ''),
       COALESCE(data->'config'->>'instanceId', ''), COALESCE(data->'config'->>'customUrl', ''),
       COALESCE(data->'config'->>'customMethod', ''), COALESCE(data->'config'->>'customBody', ''),
       COALESCE(data->'config'->>'customHeaders', ''), COALESCE(data->'config'->>'accountSid', '')
  FROM public.settings WHERE setting_id = 'whatsapp'
ON CONFLICT (settings_key) DO NOTHING;

-- قوالب الرسائل ومحفزاتها: صفوف مفاتيح/قيم — message templates and triggers become key/value rows.
CREATE TABLE IF NOT EXISTS public.settings_whatsapp_template (
  settings_key text NOT NULL DEFAULT 'whatsapp',
  template_key text NOT NULL,
  body text NOT NULL DEFAULT '',
  PRIMARY KEY (settings_key, template_key)
);

INSERT INTO public.settings_whatsapp_template (settings_key, template_key, body)
     SELECT 'whatsapp', x.key, COALESCE(x.value #>> '{}', '')
       FROM public.settings s, jsonb_each_text(s.data->'templates') x(key, value)
      WHERE s.setting_id = 'whatsapp' AND jsonb_typeof(s.data->'templates') = 'object'
     ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.settings_whatsapp_trigger (
  settings_key text NOT NULL DEFAULT 'whatsapp',
  trigger_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (settings_key, trigger_key)
);

INSERT INTO public.settings_whatsapp_trigger (settings_key, trigger_key, enabled)
     SELECT 'whatsapp', x.key, COALESCE(alx_api_private.payload_boolean(s.data->'triggers', x.key), false)
       FROM public.settings s, jsonb_object_keys(s.data->'triggers') x(key)
      WHERE s.setting_id = 'whatsapp' AND jsonb_typeof(s.data->'triggers') = 'object'
     ON CONFLICT DO NOTHING;

-- ── قالب الطباعة / print_template ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings_print_template (
  settings_key text PRIMARY KEY DEFAULT 'print_template',
  header_title_ar text, header_title_en text,
  subtitle_ar text, subtitle_en text,
  footer_text_ar text, footer_text_en text,
  signature1_ar text, signature1_en text,
  signature2_ar text, signature2_en text,
  signature3_ar text, signature3_en text,
  tax_number text, logo_url text, primary_color text,
  font_family text, font_size text, paper_size text, table_style text, margins text,
  show_logo boolean, show_tax_id boolean, show_barcode boolean, show_date_time boolean, show_signatures boolean,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings_print_template (settings_key, header_title_ar, header_title_en, subtitle_ar, subtitle_en,
  footer_text_ar, footer_text_en, signature1_ar, signature1_en, signature2_ar, signature2_en, signature3_ar, signature3_en,
  tax_number, logo_url, primary_color, font_family, font_size, paper_size, table_style, margins,
  show_logo, show_tax_id, show_barcode, show_date_time, show_signatures, updated_at)
SELECT 'print_template', data->>'headerTitleAr', data->>'headerTitleEn', data->>'subtitleAr', data->>'subtitleEn',
       data->>'footerTextAr', data->>'footerTextEn', data->>'signature1Ar', data->>'signature1En',
       data->>'signature2Ar', data->>'signature2En', data->>'signature3Ar', data->>'signature3En',
       data->>'taxNumber', data->>'logoUrl', data->>'primaryColor', data->>'fontFamily', data->>'fontSize',
       data->>'paperSize', data->>'tableStyle', data->>'margins',
       alx_api_private.payload_boolean(data, 'showLogo'), alx_api_private.payload_boolean(data, 'showTaxId'),
       alx_api_private.payload_boolean(data, 'showBarcode'), alx_api_private.payload_boolean(data, 'showDateTime'),
       alx_api_private.payload_boolean(data, 'showSignatures'), COALESCE(updated_at, now())
  FROM public.settings WHERE setting_id = 'print_template'
ON CONFLICT (settings_key) DO NOTHING;

-- ── حسابات التقارير / report_accounts: صفوف اختيار بدل مصفوفات jsonb ─────────
CREATE TABLE IF NOT EXISTS public.settings_report_account (
  settings_key text NOT NULL DEFAULT 'report_accounts',
  account_group text NOT NULL,
  account_id text NOT NULL,
  seq integer NOT NULL DEFAULT 1,
  PRIMARY KEY (settings_key, account_group, account_id)
);

INSERT INTO public.settings_report_account (settings_key, account_group, account_id, seq)
     SELECT 'report_accounts', g.key, btrim(x.value), (x.ordinality)::integer
       FROM public.settings s
       JOIN jsonb_each(s.data) g(key, value) ON jsonb_typeof(g.value) = 'array'
       CROSS JOIN jsonb_array_elements_text(g.value) WITH ORDINALITY x(value, ordinality)
      WHERE s.setting_id = 'report_accounts'
     ON CONFLICT DO NOTHING;

-- ── فئات المصروفات / expense_categories: جدول حقيقي بدل مستند jsonb ──────────
CREATE TABLE IF NOT EXISTS public.expense_category (
  category_id text PRIMARY KEY,
  label_ar text NOT NULL DEFAULT '',
  label_en text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  account_id text,
  account_code text,
  seq integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.expense_category (category_id, label_ar, label_en, icon, is_system, account_id, account_code, seq)
     SELECT x.value->>'id', COALESCE(x.value->>'labelAr', ''), COALESCE(x.value->>'labelEn', ''),
            COALESCE(x.value->>'icon', ''), COALESCE(alx_api_private.payload_boolean(x.value, 'isSystem'), false),
            x.value->>'accountId', x.value->>'accountCode', (x.ordinality)::integer
       FROM public.settings s,
            jsonb_array_elements(s.data->'data') WITH ORDINALITY x(value, ordinality)
      WHERE s.setting_id = 'expense_categories' AND jsonb_typeof(s.data->'data') = 'array'
        AND COALESCE(x.value->>'id', '') <> ''
     ON CONFLICT DO NOTHING;

-- قواعد القيد التلقائي تعيش في auto_entries بالفعل؛ نسخة الإعدادات كانت مكررة.
-- Auto voucher rules already live in auto_entries; the settings copy was a duplicate.
DELETE FROM public.settings WHERE setting_id = 'automatic_voucher_rules';

-- ── لوحة التحكم لكل مستخدم / per-user dashboard ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings_dashboard (
  user_id text PRIMARY KEY,
  grid_columns integer NOT NULL DEFAULT 4,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings_dashboard (user_id, grid_columns)
     SELECT CASE WHEN position('_' in s.setting_id) > 0 THEN split_part(s.setting_id, '_', 2) ELSE s.setting_id END,
            COALESCE(alx_api_private.cast_integer(s.data->>'gridColumns'), 4)
       FROM public.settings s WHERE s.setting_id LIKE 'dashboard%'
     ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.settings_dashboard_metric (
  user_id text NOT NULL REFERENCES public.settings_dashboard (user_id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  seq integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, metric_key)
);

INSERT INTO public.settings_dashboard_metric (user_id, metric_key, seq)
     SELECT CASE WHEN position('_' in s.setting_id) > 0 THEN split_part(s.setting_id, '_', 2) ELSE s.setting_id END,
            btrim(x.value), (x.ordinality)::integer
       FROM public.settings s,
            jsonb_array_elements_text(s.data->'visibleMetrics') WITH ORDINALITY x(value, ordinality)
      WHERE s.setting_id LIKE 'dashboard%' AND jsonb_typeof(s.data->'visibleMetrics') = 'array'
     ON CONFLICT DO NOTHING;

ALTER TABLE public.settings_general DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_custom_currency DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_backup_collection DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_logistics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_whatsapp DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_whatsapp_template DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_whatsapp_trigger DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_print_template DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_report_account DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_category DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_dashboard DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_dashboard_metric DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.settings_general, public.settings_custom_currency, public.settings_backup_collection,
  public.settings_logistics, public.settings_whatsapp, public.settings_whatsapp_template,
  public.settings_whatsapp_trigger, public.settings_print_template, public.settings_report_account,
  public.expense_category, public.settings_dashboard, public.settings_dashboard_metric
  TO alx_api_runtime;

-- ========== 0032_flatten_permissions_and_reports.sql ==========
-- 0032_flatten_permissions_and_reports.sql
-- تسطير صلاحيات الأدوار، قوالب التقارير، وسجل تغييرات الطلبات.
-- Flattens role permissions, report templates/settings and the order history diffs.
-- الترحيل idempotent: كل خطوة محروسة بوجود عمود jsonb، فلا تفشل بعد 0034 ولا عند إعادة التنفيذ.
-- Idempotent: every payload step is guarded by column presence/type, so re-runs stay safe.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. صلاحيات الأدوار: جدول علائقي بدل مصفوفة jsonb — permissions become rows.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permission (
  role_id text NOT NULL REFERENCES public.roles (role_id) ON DELETE CASCADE,
  permission_code text NOT NULL,
  PRIMARY KEY (role_id, permission_code)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'roles'
       AND column_name = 'permissions' AND data_type = 'jsonb'
  ) THEN
    RETURN;
  END IF;

  -- صلاحيات مخزنة كمصفوفة — array-shaped legacy payloads.
  INSERT INTO public.role_permission (role_id, permission_code)
       SELECT r.role_id, btrim(x.value)
         FROM public.roles r, jsonb_array_elements_text(r.permissions) x(value)
        WHERE jsonb_typeof(r.permissions) = 'array' AND btrim(x.value) <> ''
       ON CONFLICT (role_id, permission_code) DO NOTHING;

  -- صلاحيات مخزنة ككائن {code: true} — object-shaped legacy variants.
  INSERT INTO public.role_permission (role_id, permission_code)
       SELECT r.role_id, x.key
         FROM public.roles r, jsonb_each(r.permissions) x(key, value)
        WHERE jsonb_typeof(r.permissions) = 'object'
          AND COALESCE(x.value #>> '{}', 'true') <> 'false'
       ON CONFLICT (role_id, permission_code) DO NOTHING;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. أسعار صرف التقارير / report_settings.exchange_rates — صفوف عملة/سعر.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_exchange_rate (
  report_setting_id text NOT NULL REFERENCES public.report_settings (report_setting_id) ON DELETE CASCADE,
  currency_code text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (report_setting_id, currency_code)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'report_settings'
       AND column_name = 'exchange_rates' AND data_type = 'jsonb'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.report_exchange_rate (report_setting_id, currency_code, rate)
       SELECT rs.report_setting_id, x.key, COALESCE(alx_api_private.payload_number(rs.exchange_rates, x.key), 0)
         FROM public.report_settings rs, jsonb_object_keys(rs.exchange_rates) x(key)
        WHERE jsonb_typeof(rs.exchange_rates) = 'object'
       ON CONFLICT (report_setting_id, currency_code) DO NOTHING;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. قوالب التقارير — الأعمدة موجودة؛ نوفّق الفارغ منها قبل زوال المستند.
--    active_report هو boolean حقيقي: لا يُقارن بنص، بل يُحوّل تحويلاً متسامحاً.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'report_templates' AND column_name = 'data'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.report_templates
     SET active_report             = COALESCE(active_report, alx_api_private.payload_boolean(data, 'activeReport')),
         name_ar                   = COALESCE(NULLIF(name_ar, ''), data->>'nameAr'),
         name_en                   = COALESCE(NULLIF(name_en, ''), data->>'nameEn'),
         search_term               = COALESCE(NULLIF(search_term, ''), data->>'searchTerm'),
         sort_by                   = COALESCE(NULLIF(sort_by, ''), data->>'sortBy'),
         sort_order                = COALESCE(NULLIF(sort_order, ''), data->>'sortOrder'),
         selected_company_id       = COALESCE(NULLIF(selected_company_id, ''), data->>'selectedCompanyId'),
         selected_courier_id       = COALESCE(NULLIF(selected_courier_id, ''), data->>'selectedCourierId'),
         selected_customer_id      = COALESCE(NULLIF(selected_customer_id, ''), data->>'selectedCustomerId'),
         selected_expense_category = COALESCE(NULLIF(selected_expense_category, ''), data->>'selectedExpenseCategory'),
         selected_user_id          = COALESCE(NULLIF(selected_user_id, ''), data->>'selectedUserId')
   WHERE data IS NOT NULL AND jsonb_typeof(data) = 'object';
END
$$;

-- مرشّحات التقرير صفوف مفتاح/قيمة — report filters become key/value rows.
CREATE TABLE IF NOT EXISTS public.report_template_filter (
  report_template_id text NOT NULL REFERENCES public.report_templates (report_template_id) ON DELETE CASCADE,
  filter_key text NOT NULL,
  filter_value text NOT NULL DEFAULT '',
  seq integer NOT NULL DEFAULT 1,
  PRIMARY KEY (report_template_id, filter_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'report_templates'
       AND column_name = 'filters' AND data_type = 'jsonb'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.report_template_filter (report_template_id, filter_key, filter_value, seq)
       SELECT rt.report_template_id, x.key, COALESCE(x.value #>> '{}', ''), (x.ordinality)::integer
         FROM public.report_templates rt,
              jsonb_each(rt.filters) WITH ORDINALITY x(key, value, ordinality)
        WHERE jsonb_typeof(rt.filters) = 'object'
       ON CONFLICT (report_template_id, filter_key) DO NOTHING;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. سجل الطلبات: تغييرات الحقل صفوف بدل كائنات before/after.
--    Order history: each changed field becomes a row instead of before/after jsonb blobs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders_history_change (
  orders_history_id text NOT NULL REFERENCES public.orders_history (orders_history_id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  PRIMARY KEY (orders_history_id, field_name)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders_history'
       AND column_name = 'after_data' AND data_type = 'jsonb'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.orders_history_change (orders_history_id, field_name, old_value, new_value)
       SELECT h.orders_history_id, x.key,
              COALESCE(h.before_data #>> ARRAY[x.key], (h.before_data->'data' #>> ARRAY[x.key])),
              COALESCE(h.after_data #>> ARRAY[x.key], (h.after_data->'data' #>> ARRAY[x.key]))
         FROM public.orders_history h,
              jsonb_object_keys(COALESCE(h.after_data, h.before_data, '{}'::jsonb)) x(key)
        WHERE COALESCE(h.after_data, h.before_data) IS NOT NULL
          AND x.key NOT IN ('data')
       ON CONFLICT (orders_history_id, field_name) DO NOTHING;

  -- تغييرات متداخلة داخل مفتاح data القديم — nested snapshot keys flatten with a dotted path.
  INSERT INTO public.orders_history_change (orders_history_id, field_name, old_value, new_value)
       SELECT h.orders_history_id, 'data.' || x.key,
              COALESCE(h.before_data->'data' #>> ARRAY[x.key], h.before_data #>> ARRAY[x.key]),
              COALESCE(h.after_data->'data' #>> ARRAY[x.key], h.after_data #>> ARRAY[x.key])
         FROM public.orders_history h,
              jsonb_object_keys(COALESCE(h.after_data->'data', h.before_data->'data', '{}'::jsonb)) x(key)
        WHERE jsonb_typeof(COALESCE(h.after_data->'data', h.before_data->'data')) = 'object'
       ON CONFLICT (orders_history_id, field_name) DO NOTHING;
END
$$;

-- مفاتيح metadata المعروفة أعمدة حقيقية — known metadata keys become first-class columns.
ALTER TABLE public.orders_history
  ADD COLUMN IF NOT EXISTS trigger_name text,
  ADD COLUMN IF NOT EXISTS changed_fields text[],
  ADD COLUMN IF NOT EXISTS deleted_order_id text,
  ADD COLUMN IF NOT EXISTS order_reference text,
  ADD COLUMN IF NOT EXISTS activity_target text,
  ADD COLUMN IF NOT EXISTS activity_action text,
  ADD COLUMN IF NOT EXISTS activity_details text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders_history'
       AND column_name = 'metadata' AND data_type = 'jsonb'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.orders_history
     SET trigger_name       = COALESCE(NULLIF(trigger_name, ''), metadata->>'trigger'),
         deleted_order_id   = COALESCE(NULLIF(deleted_order_id, ''), metadata->>'deletedOrderId'),
         order_reference    = COALESCE(NULLIF(order_reference, ''), metadata->>'orderReference'),
         activity_target    = COALESCE(NULLIF(activity_target, ''), metadata->>'activityTarget'),
         activity_action    = COALESCE(NULLIF(activity_action, ''), metadata->>'activityAction'),
         activity_details   = COALESCE(NULLIF(activity_details, ''), metadata->>'activityDetails'),
         changed_fields     = COALESCE(changed_fields,
             (SELECT array_agg(btrim(y.value)) FROM jsonb_array_elements_text(COALESCE(metadata->'changedFields', '[]'::jsonb)) y(value)
               WHERE jsonb_typeof(metadata->'changedFields') = 'array')),
         main_entry_id      = COALESCE(NULLIF(main_entry_id, ''), alx_api_private.payload_text(metadata, 'mainEntryId')),
         shipment_id        = COALESCE(NULLIF(shipment_id, ''), alx_api_private.payload_text(metadata, 'shipmentId')),
         account_trans_count = COALESCE(account_trans_count, alx_api_private.cast_integer(metadata->>'accountTransCount'))
   WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object';
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. الفهارس والصلاحيات — indexes and grants (alx_api_runtime بلا DDL).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS orders_history_change_history_idx ON public.orders_history_change (orders_history_id);
CREATE INDEX IF NOT EXISTS role_permission_role_idx ON public.role_permission (role_id);
CREATE INDEX IF NOT EXISTS role_permission_code_idx ON public.role_permission (permission_code);
CREATE INDEX IF NOT EXISTS report_template_filter_template_idx ON public.report_template_filter (report_template_id);

ALTER TABLE public.role_permission DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exchange_rate DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_template_filter DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_history_change DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.role_permission, public.report_exchange_rate, public.report_template_filter,
  public.orders_history_change, public.orders_history, public.report_templates, public.report_settings, public.roles
  TO alx_api_runtime;

COMMENT ON TABLE public.role_permission IS
  'صلاحيات كل دور صفوف حقيقية بدل مصفوفة jsonb — one row per role permission.';
COMMENT ON TABLE public.orders_history_change IS
  'تغيّرات كل سجل: حقل/قيمة قديمة/قيمة جديدة — one row per changed field of a history entry.';

