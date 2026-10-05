# نموذج التهديدات لـ alx_api (Threat Model)

**الإصدار:** 1.0  
**التاريخ:** 2026-10-05  
**المنفذ:** Claude Sonnet 4.6 (Thinking)  
**المنهجية:** STRIDE

---

## 1. الأصول المحمية (Assets)

| الأصل | التصنيف | الأهمية |
|:---|:---:|:---:|
| بيانات اعتماد المستخدمين (Argon2id hashes) | سري جداً | حرجة |
| مفاتيح JWT الخاصة (Ed25519) | سري جداً | حرجة |
| بيانات العملاء والطلبات | سري | عالية |
| السجلات المالية والقيود المحاسبية | سري | عالية |
| Refresh Tokens (hashed in DB) | سري | عالية |
| سجلات التدقيق (Audit Logs) | حساس | متوسطة |
| إعلانات البوابة العامة | عام | منخفضة |

---

## 2. حدود الثقة (Trust Boundaries)

```
┌─────────────────────────────────────────────────────────────────┐
│  الإنترنت العام (Untrusted)                                       │
│                                                                   │
│   alx_web (Browser)         alx_system (Electron)                │
│        │                          │                               │
│        └──────────┬───────────────┘                              │
│                   │ HTTPS + JWT                                   │
├───────────────────┼─────────────────────────────────────────────┤
│  DMZ / API Layer                                                  │
│                   ▼                                               │
│              alx_api (Express 5)                                  │
│                   │                                               │
├───────────────────┼─────────────────────────────────────────────┤
│  Internal Network                                                 │
│                   ▼                                               │
│            PostgreSQL Database                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. نموذج التهديدات STRIDE

### 3.1 Spoofing (انتحال الهوية)

| التهديد | المسار | الضابط الحالي | الحالة |
|:---|:---|:---|:---:|
| استخدام JWT مزور | كل endpoints محمية | Ed25519 verification في كل طلب | ✅ مُعالَج |
| إعادة استخدام Refresh Token منتهٍ | `POST /auth/refresh` | Reuse Detection + Family Revocation | ✅ مُعالَج |
| Credential Stuffing على Login | `POST /auth/login` | Rate Limit (10 req/15min) + Lockout | ✅ مُعالَج |
| JWT Algorithm Confusion (alg: none) | كل endpoints | Only Ed25519 accepted, `alg: none` rejected | ✅ مُعالَج |
| Session fixation | Login flow | إنشاء session_id جديد عند كل دخول | ✅ مُعالَج |

### 3.2 Tampering (التلاعب بالبيانات)

| التهديد | المسار | الضابط الحالي | الحالة |
|:---|:---|:---|:---:|
| تعديل JWT payload | كل endpoints | التوقيع Ed25519 يكشف أي تعديل | ✅ مُعالَج |
| SQL Injection | كل DB queries | Parameterized queries only (pg driver) | ✅ مُعالَج |
| تعديل حالة طلب للخلف | `PATCH /orders/:id/status` | Status rank validation في Repository | ✅ مُعالَج |
| تعديل سجلات مالية مغلقة | Finance endpoints | Permission `accounting.void` محمية | ✅ مُعالَج |
| Mass Assignment في Body | كل endpoints | Zod schema يحدد الحقول المسموحة فقط | ✅ مُعالَج |
| CSRF على mutations | Web client | SameSite cookies + Origin check | ⚠️ مطلوب تطبيق Cookie mode للـ web |

### 3.3 Repudiation (الإنكار)

| التهديد | الضابط الحالي | الحالة |
|:---|:---|:---:|
| إنكار تغيير حالة طلب | orders_history بـ actorId | ✅ مُعالَج |
| إنكار قيد مالي | journal_entries + audit_logs | ✅ مُعالَج |
| إنكار تغيير صلاحية | RBAC audit events | ✅ مُعالَج |
| إنكار تسجيل دخول | auth_events table | ✅ مُعالَج |
| إنكار حذف سجل | Soft delete مع deleted_at | ✅ مُعالَج |

### 3.4 Information Disclosure (إفشاء المعلومات)

| التهديد | المسار | الضابط الحالي | الحالة |
|:---|:---|:---:|
| كشف Stack Trace للعميل | Error handler | Error handler يُرجع رسالة عامة فقط | ✅ مُعالَج |
| كشف Connection String | Logs | Pino redacts sensitive headers | ✅ مُعالَج |
| كشف password_hash في Response | Auth endpoints | DTO لا يُرجع credentials | ✅ مُعالَج |
| كشف JWT في Logs | Pino config | `req.headers.authorization` محذوف | ✅ مُعالَج |
| User Enumeration عبر Login | `POST /auth/login` | رسالة خطأ موحدة للجميع | ✅ مُعالَج |
| User Enumeration عبر Password Reset | Reset endpoint | رسالة موحدة بغض النظر عن وجود البريد | ✅ مُعالَج |
| كشف بيانات PostgreSQL داخلية | DB errors | catch blocks تُخفي DB errors | ✅ مُعالَج |
| Excessive Data Exposure في Lists | Operations/Finance | Pagination + حقول محددة فقط | ✅ مُعالَج |
| CORS مفتوح | كل الـ origins | CORS allowlist محددة في env | ✅ مُعالَج |

### 3.5 Denial of Service (رفض الخدمة)

| التهديد | الضابط الحالي | الحالة |
|:---|:---|:---:|
| Flood على Login | Rate limit 10/15min | ✅ مُعالَج |
| Flood على الـ API العام | Rate limit 300/15min | ✅ مُعالَج |
| Large Body attack | JSON body limit في env | ✅ مُعالَج |
| Slow HTTP attacks | Express 5 built-in timeout | ⚠️ يُنصح بإضافة `server.timeout` |
| ReDoS على Zod schemas | Zod لا تستخدم regex معقدة | ✅ مُعالَج (regex بسيطة) |
| Connection Pool exhaustion | Pool max محدد في env | ✅ مُعالَج |
| Infinite pagination | `max(100)` في كل page schema | ✅ مُعالَج |

### 3.6 Elevation of Privilege (رفع الصلاحيات)

| التهديد | الضابط الحالي | الحالة |
|:---|:---|:---:|
| مستخدم عادي يعدل أدواره | `requirePermission('roles.manage')` | ✅ مُعالَج |
| مندوب يصل لطلبات غيره | Authorization middleware | ✅ مُعالَج (Deny by Default) |
| تجاوز RBAC عبر تعديل JWT | JWT signature verification | ✅ مُعالَج |
| Privilege escalation عبر Mass Assignment | Zod schema strict mode | ✅ مُعالَج |
| Root account deletion | Protected endpoints مع is_system_role | ✅ مُعالَج |

---

## 4. المخاطر المتبقية والتوصيات

### 4.1 مخاطر عالية الأولوية

| المخطر | التوصية | الموعد المقترح |
|:---|:---|:---:|
| لا يوجد HTTP request timeout صريح | أضف `server.headersTimeout` و`server.requestTimeout` | قبل الإنتاج |
| CSRF للـ web client يستخدم Cookies | طبّق `SameSite=Strict` + Double Submit Cookie أو CSRF token | قبل الإطلاق |
| Rate Limit ذاكرة محلية (in-memory) | انقل لـ Redis أو PostgreSQL عند تعدد الـ instances | عند التوسع |

### 4.2 مخاطر متوسطة الأولوية

| المخطر | التوصية | الموعد المقترح |
|:---|:---|:---:|
| لا يوجد Permission caching | أضف cache قصير المدى (30s) للـ permissions | بعد الإطلاق |
| لا يوجد Brute Force protection على Password Reset | أضف rate limit مخصص للـ reset endpoint | قبل الإنتاج |
| لا يوجد MFA | صمم MFA flow (TOTP) وأضف endpoints | الإصدار 1.1 |

### 4.3 مخاطر منخفضة الأولوية

| المخطر | التوصية |
|:---|:---|
| No Content Security Policy للـ web | أضف CSP headers عبر Helmet config |
| Auth events لا تُراقَب تلقائياً | أضف alerting على failed_login_attempts > threshold |
| لا يوجد IP-based blocking | أضف دعم IP blocklist للإنتاج |

---

## 5. تشغيل Dependency Audit

```bash
# فحص الثغرات في التبعيات
cd alx_api
npm audit --audit-level=high

# فحص التبعيات القديمة
npx npm-check-updates --target minor
```

---

## 6. قائمة التحقق الأمني (Security Checklist)

### قبل كل إصدار:
- [ ] `npm audit` بدون ثغرات High أو Critical
- [ ] مراجعة CORS origins
- [ ] مراجعة Rate Limits
- [ ] مراجعة الـ permissions الجديدة في Permission Matrix
- [ ] اختبار Security Tests suite

### قبل الإطلاق الأول:
- [ ] تغيير جميع المفاتيح والأسرار من القيم الافتراضية
- [ ] تفعيل HTTPS
- [ ] تفعيل HSTS
- [ ] تطبيق production env variables
- [ ] تشغيل `npm audit` على النسخة النهائية
- [ ] تشغيل Load Test أساسي
- [ ] اختبار Backup/Restore
- [ ] مراجعة Audit Logs بعد أول أسبوع

---

## 7. مراجع

- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
