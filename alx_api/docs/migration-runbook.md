# دليل تشغيل الـ Migrations (Migration Runbook)

**الإصدار:** 1.0  
**التاريخ:** 2026-10-05  
**المنفذ:** Claude Sonnet 4.6 (Thinking)

---

## 1. المبادئ الأساسية

> ⚠️ **تحذير حرج**: لا تُطبَّق Migrations على الإنتاج دون اتباع هذه الخطوات كاملة.

- كل Migration هي **ملف SQL صريح** في `src/db/migrations/`
- رقم تسلسلي بادئ `NNNN_` يضمن ترتيب التطبيق
- **لا يُستخدم** `drizzle push` أو `sync()` على الإنتاج
- كل Migration يجب أن تكون **idempotent** (استخدام `IF NOT EXISTS`)
- التوثيق إلزامي قبل وبعد كل تطبيق

---

## 2. قائمة الـ Migrations الحالية

| الرقم | الاسم | الوصف | الحالة |
|:---:|:---|:---|:---:|
| 0002 | auth_private_storage | تخزين Credentials في schema خاص | ✅ مطبّق |
| 0003 | auth_rls_runtime_access | Row-Level Security للـ API Runtime Role | ✅ مطبّق |
| 0004 | legacy_password_upgrade | ترقية كلمات المرور القديمة | ✅ مطبّق |
| 0005 | auth_core_passwords_and_events | جداول Passwords وAuth Events | ✅ مطبّق |
| 0006 | rbac_foundation | جداول RBAC (Roles, Permissions) | ✅ مطبّق |
| 0007 | portal_rbac_foundation | Seed للأدوار النظامية والصلاحيات | ✅ مطبّق |
| 0008 | customers_read_boundary | حدود قراءة جدول Customers | ✅ مطبّق |
| 0009 | operations_idempotency | جدول Idempotency للعمليات | ✅ مطبّق |
| 0010 | notifications_outbox | جدول Notifications وجدول Outbox | ⏳ جاهز للتطبيق |
| 0011 | portal_announcements | جدول Announcements للبوابة | ⏳ جاهز للتطبيق |

---

## 3. إجراء تطبيق Migration جديدة

### الخطوة 1: التحضير (قبل أي تطبيق)

```bash
# 1. أخذ Backup كامل لقاعدة البيانات
pg_dump -h HOST -U USER -d DATABASE_NAME -f backup_$(date +%Y%m%d_%H%M%S).sql

# 2. التحقق من الـ Backup
pg_restore --list backup_*.sql | head -20

# 3. مراجعة محتوى الـ Migration
cat src/db/migrations/NNNN_migration_name.sql
```

### الخطوة 2: التطبيق على البيئة المحلية

```bash
# تطبيق Migration على قاعدة البيانات المحلية
psql -h localhost -U alx_api_user -d alx_dev -f src/db/migrations/NNNN_migration_name.sql

# التحقق من التطبيق
psql -h localhost -U alx_api_user -d alx_dev -c "\dt public.*" | grep new_table
```

### الخطوة 3: التطبيق على بيئة الاختبار

```bash
# تطبيق على Test DB
psql -h TEST_HOST -U TEST_USER -d alx_test -f src/db/migrations/NNNN_migration_name.sql

# تشغيل الاختبارات للتحقق
cd alx_api && npm test
```

### الخطوة 4: التطبيق على الإنتاج

```bash
# 1. أوقف استقبال طلبات جديدة مؤقتاً (Maintenance Mode)
# 2. أخذ Backup فوري
pg_dump -h PROD_HOST -U PROD_USER -d alx_prod -f prod_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. تطبيق الـ Migration
psql -h PROD_HOST -U PROD_USER -d alx_prod -f src/db/migrations/NNNN_migration_name.sql

# 4. التحقق من التطبيق
psql -h PROD_HOST -U PROD_USER -d alx_prod -c "\dt public.*"

# 5. استئناف الخدمة
# 6. مراقبة الـ Logs لـ 5 دقائق
```

---

## 4. خطة التراجع (Rollback Plan)

> ⚠️ معظم الـ Migrations لا يمكن التراجع عنها تلقائياً. هذه الخطوات يدوية.

### التراجع عن إضافة جدول جديد:

```sql
-- مثال: التراجع عن Migration 0010
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS alx_api_private.notification_outbox CASCADE;
```

### التراجع عن إضافة عمود:

```sql
-- مثال: حذف عمود مضاف
ALTER TABLE public.users DROP COLUMN IF EXISTS new_column;
```

### إجراء Rollback كامل (من Backup):

```bash
# 1. إيقاف alx_api
# 2. استعادة من Backup
psql -h PROD_HOST -U PROD_USER -d alx_prod < backup_YYYYMMDD_HHMMSS.sql

# 3. التحقق من الاستعادة
psql -h PROD_HOST -U PROD_USER -d alx_prod -c "SELECT COUNT(*) FROM public.users"

# 4. تشغيل نسخة سابقة من alx_api
# 5. التحقق من Health endpoints
curl https://api.example.com/api/v1/health/ready
```

---

## 5. تطبيق Migrations 0010 و 0011 (خطوة فورية)

هذه الـ Migrations جاهزة ولم تُطبَّق بعد. أوامر التطبيق:

```sql
-- ═══════════════════════════════════════════════════════════
-- تطبيق 0010_notifications_outbox.sql
-- ═══════════════════════════════════════════════════════════
\i src/db/migrations/0010_notifications_outbox.sql

-- التحقق
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'notifications';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'alx_api_private' AND table_name = 'notification_outbox';

-- ═══════════════════════════════════════════════════════════
-- تطبيق 0011_portal_announcements.sql
-- ═══════════════════════════════════════════════════════════
\i src/db/migrations/0011_portal_announcements.sql

-- التحقق
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'announcements';

SELECT title, priority, is_active FROM public.announcements;
```

---

## 6. قواعد كتابة Migrations جديدة

```sql
-- Template لكل Migration جديدة
-- Migration: NNNN_description.sql
-- Description: وصف عربي وإنجليزي
-- Date: YYYY-MM-DD
-- Author: [اسم المنفذ]

-- استخدم دائماً IF NOT EXISTS لضمان الـ idempotency
CREATE TABLE IF NOT EXISTS public.new_table (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... الأعمدة
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system'
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_new_table_field
  ON public.new_table (field_name);

-- التعليق
COMMENT ON TABLE public.new_table IS 'وصف الجدول';
```

---

## 7. قائمة التحقق قبل كل Migration

- [ ] المحتوى مراجع من شخص ثانٍ
- [ ] Backup أُخذ وتم التحقق منه
- [ ] طُبِّق على Local أولاً
- [ ] طُبِّق على Test وشغّلت الاختبارات
- [ ] Migration يستخدم `IF NOT EXISTS`
- [ ] لا يوجد `DROP TABLE` غير مقصود
- [ ] لا يوجد `DELETE FROM` غير محدد
- [ ] توثيق في `DBdevloping_history.md`
- [ ] توثيق في `db_commends.md`
