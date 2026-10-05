# دليل حوادث الإنتاج (Incident Runbook) لـ alx_api

**الإصدار:** 1.0  
**التاريخ:** 2026-10-05  
**المنفذ:** Claude Sonnet 4.6 (Thinking)

---

## 1. تصنيف الحوادث (Severity Levels)

| الدرجة | التعريف | مثال | وقت الاستجابة |
|:---:|:---|:---|:---:|
| **P1** | تعطل كامل للخدمة | API لا يستجيب، DB غير متاح | < 15 دقيقة |
| **P2** | تأثير على وظيفة رئيسية | تسجيل الدخول معطل، Mutations تفشل | < 30 دقيقة |
| **P3** | تدهور أداء | بطء ملحوظ، Rate Limit مرتفع | < 2 ساعة |
| **P4** | مشكلة ثانوية | إشعارات لا تُرسَل، Portal بطيء | < 24 ساعة |

---

## 2. إجراءات الحوادث الشائعة

### 2.1 API لا يستجيب (P1)

```bash
# 1. التحقق من حالة العملية
pm2 status  # أو: systemctl status alx_api

# 2. فحص Health endpoints
curl -f https://api.example.com/api/v1/health/live
curl -f https://api.example.com/api/v1/health/ready

# 3. فحص Logs
pm2 logs alx_api --lines 100
# أو: journalctl -u alx_api -n 100

# 4. فحص استهلاك الموارد
top -p $(pgrep -f alx_api)
df -h  # مساحة القرص

# 5. إعادة التشغيل إذا لزم
pm2 restart alx_api
# أو: systemctl restart alx_api

# 6. مراقبة الـ Logs بعد الإعادة
pm2 logs alx_api --lines 50
```

### 2.2 قاعدة البيانات غير متاحة (P1)

```bash
# 1. التحقق من اتصال DB
psql -h DB_HOST -U alx_api_user -d alx_prod -c "SELECT 1"

# 2. فحص Pool في Logs
grep "pool" /var/log/alx_api/*.log | tail -20

# 3. فحص اتصالات PostgreSQL النشطة
psql -h DB_HOST -U ADMIN_USER -d alx_prod -c "
  SELECT count(*), state, wait_event_type
  FROM pg_stat_activity
  WHERE datname = 'alx_prod'
  GROUP BY state, wait_event_type
"

# 4. فحص الـ Locks
psql -h DB_HOST -U ADMIN_USER -d alx_prod -c "
  SELECT pid, query, state, wait_event, now() - pg_stat_activity.query_start AS duration
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
"

# 5. إعادة تشغيل alx_api لإعادة بناء الـ Pool
pm2 restart alx_api
```

### 2.3 Rate Limit مرتفع جداً (P2)

```bash
# 1. فحص عدد الطلبات
grep "429" /var/log/alx_api/access.log | awk '{print $2}' | sort | uniq -c | sort -rn | head -20

# 2. تحديد الـ IP المصدر
grep "429" /var/log/alx_api/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -10

# 3. إذا كان هجوماً: حظر الـ IP على مستوى Infrastructure
# nginx: deny IP;
# firewall: iptables -A INPUT -s IP -j DROP
```

### 2.4 فشل المصادقة لمستخدم (P3)

```sql
-- فحص حالة المستخدم وقفل الحساب
SELECT
  id, username, status,
  failed_login_attempts,
  locked_until,
  last_login_at
FROM public.users
WHERE email = 'user@example.com' OR username = 'username';

-- فحص auth_events الأخيرة
SELECT event_type, success, ip_address, created_at
FROM alx_api_private.auth_events
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 20;

-- إلغاء القفل يدوياً (عند التأكد من الهوية)
UPDATE public.users
SET failed_login_attempts = 0, locked_until = NULL
WHERE id = 'USER_ID';
```

### 2.5 إبطال جلسة مشبوهة (أمني - P1)

```sql
-- إبطال جلسة محددة
UPDATE alx_api_private.sessions
SET revoked_at = NOW(), revoke_reason = 'security_incident'
WHERE session_id = 'SESSION_ID';

-- إبطال كل جلسات مستخدم (عند اختراق الحساب)
UPDATE alx_api_private.sessions
SET revoked_at = NOW(), revoke_reason = 'account_compromised'
WHERE user_id = 'USER_ID' AND revoked_at IS NULL;

-- إبطال كل Refresh Tokens للمستخدم
UPDATE alx_api_private.refresh_tokens
SET revoked_at = NOW()
WHERE user_id = 'USER_ID' AND revoked_at IS NULL;

-- تسجيل حدث أمني
INSERT INTO alx_api_private.auth_events (user_id, event_type, success, metadata, created_at)
VALUES ('USER_ID', 'session.force_revoked', true, '{"reason": "security_incident"}', NOW());
```

---

## 3. إجراءات الاستعادة من Backup

```bash
# 1. إيقاف alx_api
pm2 stop alx_api

# 2. إنشاء قاعدة بيانات مؤقتة للتحقق
createdb -h DB_HOST -U ADMIN_USER alx_restore_test

# 3. استعادة Backup على القاعدة المؤقتة
psql -h DB_HOST -U ADMIN_USER alx_restore_test < backup_YYYYMMDD.sql

# 4. التحقق من البيانات
psql -h DB_HOST -U ADMIN_USER alx_restore_test -c "SELECT COUNT(*) FROM public.users"
psql -h DB_HOST -U ADMIN_USER alx_restore_test -c "SELECT COUNT(*) FROM public.orders"

# 5. إذا كانت البيانات صحيحة، الاستعادة على قاعدة الإنتاج
# (احذر: هذه عملية لا رجعة فيها)
psql -h DB_HOST -U ADMIN_USER alx_prod < backup_YYYYMMDD.sql

# 6. إعادة تشغيل alx_api
pm2 start alx_api

# 7. التحقق من Health
curl https://api.example.com/api/v1/health/ready
```

---

## 4. مراقبة الإنتاج (Production Monitoring)

### 4.1 Endpoints المراقبة

| الـ Endpoint | المتوقع | الإجراء عند الفشل |
|:---|:---|:---|
| `GET /api/v1/health/live` | 200 OK | إعادة تشغيل API |
| `GET /api/v1/health/ready` | 200 OK | فحص DB connection |

### 4.2 مقاييس يجب مراقبتها

```
- Response Time P95 < 500ms
- Error Rate 5xx < 0.1%
- Database Connection Pool Usage < 80%
- Memory Usage < 80%
- Rate Limit 429 Rate < 1%
- Failed Login Attempts (spike detection)
```

### 4.3 تحقق يدوي دوري (أسبوعي)

```bash
# 1. فحص Audit Logs للنشاط المشبوه
psql -c "
  SELECT event_type, COUNT(*) as count
  FROM alx_api_private.auth_events
  WHERE created_at > NOW() - INTERVAL '7 days'
    AND success = false
  GROUP BY event_type
  ORDER BY count DESC
"

# 2. فحص الحسابات المقفولة
psql -c "
  SELECT username, email, failed_login_attempts, locked_until
  FROM public.users
  WHERE locked_until > NOW()
  ORDER BY locked_until DESC
"

# 3. فحص Outbox المعلقة
psql -c "
  SELECT channel, COUNT(*) as count, MIN(created_at) as oldest
  FROM alx_api_private.notification_outbox
  WHERE status IN ('queued', 'failed')
  GROUP BY channel
"

# 4. فحص Database size
psql -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname IN ('public', 'alx_api_private')
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10
"
```

---

## 5. قائمة جهات الاتصال (يُكمل الفريق)

| الدور | المسؤول | قناة الاتصال |
|:---|:---|:---|
| مدير المشروع | - | - |
| DevOps / Infrastructure | - | - |
| DBA (قاعدة البيانات) | - | - |
| مزود الاستضافة | - | - |
| دعم PostgreSQL | - | - |
