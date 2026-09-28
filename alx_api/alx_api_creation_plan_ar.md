# وثيقة إنشاء `alx_api` لنظام ALX

**الإصدار:** 1.0

**الحالة:** خطة معمارية وتنفيذية معتمدة مبدئياً

**النطاق:** إنشاء API مستقلة من الصفر للنظام المحلي وموقع العملاء

**قاعدة البيانات المستهدفة:** PostgreSQL فقط

**ملاحظة:** هذه الوثيقة لا تنفذ أي تغيير في المشروع الحالي، ولا تنشئ ملفات داخل مجلد `SWIFTSHIP_SYSTEM`. هي مواصفة البناء التي تسبق التنفيذ.

---

## 1. القرار التنفيذي

سيتم بناء `alx_api` كتطبيق مستقل يملك كل قواعد الاتصال بقاعدة البيانات، والمصادقة، والجلسات، والصلاحيات، والتحقق من صحة البيانات، ومنطق الأعمال، وسجل التدقيق.

لن يعتمد API على Supabase أو Supabase Auth أو أي خدمة هوية خارجية. سيكون PostgreSQL قاعدة البيانات الوحيدة المدعومة، سواء كان مستضافاً محلياً أو على مزود سحابي آخر.

المسار المستهدف هو:

```
alx_system / Electron
          \
           \
            HTTPS + JSON + Access Token
             \
              v
             alx_api
              |
              +-- Authentication
              +-- Sessions and Refresh Tokens
              +-- RBAC and Authorization
              +-- Business Services
              +-- Validation
              +-- Audit and Security Events
              +-- Transactions
              |
              v
          PostgreSQL

alx_web --------------------> alx_api
```

بعد اكتمال الترحيل، يجب ألا يعرف النظام المحلي أو الموقع:

- أسماء جداول PostgreSQL.

- تفاصيل SQL أو Drizzle.

- كلمات مرور قاعدة البيانات.

- مفاتيح التوقيع الخاصة بالتوكنات.

- كلمات المرور أو Hashes المستخدمين.

- قواعد انتقال حالات الطلبات.

- تفاصيل المعاملات المالية.

---

## 2. القرارات التقنية الثابتة

| المجال | القرار |
| --- | --- |
| اللغة | TypeScript بوضع `strict` |
| HTTP framework | Express 5 |
| قاعدة البيانات | PostgreSQL فقط |
| اتصال PostgreSQL | `node-postgres` (`pg`) عبر Pool واحد للتطبيق |
| ORM / Query Layer | Drizzle ORM مع PostgreSQL و`pg` |
| Schema/Migrations | Drizzle Schema وSQL migrations مراجعة ومضبوطة |
| المصادقة | نظام داخلي مملوك لـ ALX داخل API |
| كلمات المرور | Argon2id، مع Salt فريد لكل كلمة مرور |
| Access Tokens | JWT موقعة ومتحقق منها داخل API |
| Refresh Tokens | عشوائية، مخزنة كـ Hash، مع Rotation وكشف إعادة الاستخدام |
| الصلاحيات | RBAC مركزي مع نقطة توسعة لـ ABAC/Resource Ownership |
| التحقق من المدخلات | Zod |
| حماية HTTP | Helmet، CORS allowlist، Content-Type validation، body limits |
| Rate limiting | `express-rate-limit`، مع مخزن موزع عند التوسع |
| OpenAPI | عقد API versioned في `docs/openapi.yaml` |
| Logging | Pino مع JSON structured logs |
| الاختبارات | Jest + Supertest |
| التوثيق | Markdown وOpenAPI |
| قواعد البيانات الأخرى | غير مدعومة: لا SQLite ولا MySQL |
| Supabase | غير مستخدم داخل `alx_api` |

### 2.1 مبدأ مصدر الحقيقة الواحد

يجب أن يكون لكل مسؤولية مصدر واحد:

- الهوية والجلسة: `alx_api` وPostgreSQL.

- الصلاحيات: جداول RBAC وAuthorization Services داخل API.

- حالة الطلب الحالية: جدول الطلب، مع سجل انتقالات append-only.

- السجل المالي: جداول القيود والمعاملات، ولا يعتمد على Cache واجهة.

- تعريف العقود الخارجية: OpenAPI وZod schemas المتوافقة معه.

- مخطط قاعدة البيانات: Drizzle Schema وmigrations المراجعة.

---

## 3. حدود المسؤوليات

### 3.1 النظام المحلي والموقع

مسؤوليتهما:

- عرض الواجهات.

- جمع المدخلات الأولية.

- إدارة حالة العرض المحلية.

- استدعاء HTTP API.

- عرض حالات التحميل والنجاح والخطأ.

- تخزين Access Token مؤقتاً وفق سياسة العميل.

لا يجوز لهما:

- استدعاء PostgreSQL.

- استدعاء Drizzle.

- تنفيذ SQL.

- اتخاذ قرار صلاحية نهائي.

- إنشاء Hash لكلمة المرور كبديل عن API.

- تغيير حالة الطلب دون Endpoint معتمد.

### 3.2 `alx_api`

مسؤوليته:

- التحقق من هوية الطلب.

- تحديد المستخدم والجلسة.

- تطبيق RBAC وملكية الموارد.

- التحقق من المدخلات.

- تطبيق قواعد الأعمال.

- تنفيذ Transactions.

- تسجيل الأحداث الأمنية والتشغيلية.

- إخفاء تفاصيل قاعدة البيانات.

- إصدار استجابات موحدة.

### 3.3 PostgreSQL

مسؤوليته:

- تخزين البيانات.

- فرض القيود الأساسية.

- الفهارس والمفاتيح والعلاقات.

- تنفيذ Transactions وFunctions عند الحاجة.

- تخزين سجل التدقيق الذي يحتاج إلى ثبات طويل الأمد.

لا يجب وضع كل قواعد الأعمال داخل PostgreSQL؛ القواعد التي تحتاج سياق API أو صلاحيات المستخدم تبقى داخل Services، بينما تستخدم PostgreSQL للقيود والذرية والـ Transactions.

---

## 4. الهيكل النهائي للمجلد

```markdown
alx_api/
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   ├── database.ts
│   │   ├── security.ts
│   │   └── logger.ts
│   │
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema/
│   │   │   ├── users.schema.ts
│   │   │   ├── auth.schema.ts
│   │   │   ├── rbac.schema.ts
│   │   │   ├── customers.schema.ts
│   │   │   ├── orders.schema.ts
│   │   │   ├── shipments.schema.ts
│   │   │   ├── accounting.schema.ts
│   │   │   └── index.ts
│   │   ├── migrations/
│   │   └── transaction.ts
│   │
│   ├── core/
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   ├── error-codes.ts
│   │   │   └── error-mapper.ts
│   │   ├── http/
│   │   │   ├── response.ts
│   │   │   └── async-handler.ts
│   │   ├── pagination/
│   │   ├── result/
│   │   └── validation/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   ├── auth.schemas.ts
│   │   │   ├── auth.policy.ts
│   │   │   └── auth.types.ts
│   │   ├── users/
│   │   ├── roles/
│   │   ├── permissions/
│   │   ├── customers/
│   │   ├── orders/
│   │   ├── shipments/
│   │   ├── couriers/
│   │   ├── accounting/
│   │   ├── expenses/
│   │   ├── notifications/
│   │   └── tracking/
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── authorization.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── request-id.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── csrf.middleware.ts
│   │   ├── content-type.middleware.ts
│   │   └── audit.middleware.ts
│   │
│   ├── routes/
│   │   └── index.ts
│   │
│   └── shared/
│       ├── constants/
│       ├── types/
│       └── contracts/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   └── authorization/
│
├── docs/
│   ├── openapi.yaml
│   ├── authentication.md
│   ├── authorization.md
│   ├── database.md
│   ├── threat-model.md
│   ├── api-versioning.md
│   └── migration-runbook.md
│
├── drizzle.config.ts
├── .env.example
├── package.json
├── tsconfig.json
├── jest.config.ts
├── eslint.config.mjs
├── prettier.config.mjs
└── README.md
```

### 4.1 قاعدة تنظيم كل Module

كل Module يجب أن يتبع تدفقاً ثابتاً:

```
Route
  -> Middleware
  -> Controller
  -> Service
  -> Repository
  -> Drizzle/PostgreSQL
```

- `Route` يحدد HTTP method والمسار وMiddleware.

- `Controller` يحول HTTP إلى Input ويعيد Response.

- `Service` ينفذ منطق الأعمال والمعاملات.

- `Repository` ينفذ استعلامات البيانات فقط.

- `Schema` يتحقق من المدخلات والمخرجات.

- `Policy` يحدد القاعدة الخاصة بالمجال.

لا يجوز وضع SQL داخل Controller، ولا وضع منطق الأعمال داخل Repository.

---

## 5. تصميم قاعدة البيانات

### 5.1 قواعد عامة

- استخدام `uuid` أو `gen_random_uuid( )` للمعرفات العامة.

- استخدام `timestamptz` لكل التواريخ التشغيلية.

- التخزين بتوقيت UTC.

- استخدام `numeric` للمبالغ المالية، وليس `float`.

- استخدام `citext` أو فهارس مناسبة للبريد عند الحاجة.

- تعريف `NOT NULL` للحقول الإلزامية.

- تعريف `UNIQUE` للمعرفات الطبيعية مثل البريد واسم المستخدم.

- عدم وضع العلاقات أو الحالة الأساسية داخل JSONB.

- استخدام JSONB فقط للبيانات الإضافية غير المستقرة.

- إضافة `created_at` و`updated_at` حيث يلزم.

- استخدام Soft Delete فقط للكيانات التي تحتاج استرجاعاً أو متطلبات تدقيق.

- عدم حذف السجلات المالية أو سجلات التدقيق حذفاً فعلياً.

### 5.2 جداول الهوية والمصادقة

#### `users`

```
id
username
email
full_name
status                  active | suspended | locked | archived
is_root
failed_login_attempts
locked_until
last_login_at
last_password_change_at
created_at
updated_at
deleted_at
```

#### `user_credentials`

```
user_id
password_hash
password_algorithm
password_version
created_at
updated_at
```

يفضل الفصل بين ملف المستخدم وبيانات الاعتماد لتقليل انتشار البيانات الحساسة.

#### `sessions`

```
id
user_id
device_id
device_name
user_agent
ip_address
created_at
last_used_at
expires_at
revoked_at
revoke_reason
```

#### `refresh_tokens`

```
id
session_id
user_id
family_id
parent_token_id
token_hash
created_at
expires_at
used_at
revoked_at
```

يتم تخزين Hash فقط، ولا يتم تخزين Refresh Token الخام.

#### `password_reset_tokens`

```
id
user_id
token_hash
expires_at
used_at
created_at
```

#### `auth_events`

```
id
user_id
event_type
success
ip_address
user_agent
request_id
metadata
created_at
```

### 5.3 جداول RBAC

#### `roles`

```
id
code
name
description
is_system_role
created_at
updated_at
```

#### `permissions`

```
id
code
resource
action
description
created_at
```

#### `user_roles`

```
user_id
role_id
assigned_by
assigned_at
expires_at
```

#### `role_permissions`

```
role_id
permission_id
assigned_by
assigned_at
```

يجب وضع قيود Unique على أزواج:

```
(user_id, role_id)
(role_id, permission_id)
```

### 5.4 سجل التدقيق

#### `audit_logs`

```
id
actor_user_id
action
resource_type
resource_id
before_data
after_data
ip_address
user_agent
request_id
created_at
```

لا يجب تسجيل كلمات المرور أو Tokens أو الأسرار في `before_data` أو `after_data`.

### 5.5 نطاق العمل

بعد تثبيت جداول الهوية والصلاحيات، تتم إضافة جداول الأعمال على مراحل:

```
customers
orders
order_items
order_status_history
shipments
shipment_events
couriers
expenses
financial_accounts
journal_entries
journal_lines
notifications
tracking_events
```

قبل إنشاء هذه الجداول يجب اعتماد قاموس بيانات موحد للحقول والحالات والعلاقات، لأن التحليل السابق كشف اختلافاً بين أسماء مثل `status` و`orderStatus` وبين أكثر من شكل لمعرف المندوب والمصدر.

---

## 6. المصادقة الداخلية

### 6.1 تسجيل المستخدم

مسار التسجيل الإداري أو إنشاء موظف:

```
Validate input
  -> Verify caller permission
  -> Normalize email/username
  -> Check uniqueness
  -> Hash password with Argon2id
  -> Create user and credential in transaction
  -> Assign approved role
  -> Write audit event
  -> Return safe user DTO
```

لا يتم إرجاع `password_hash` أو أي Secret.

### 6.2 تسجيل الدخول

```
Validate credentials
  -> Apply login rate limit
  -> Find active user
  -> Check lock status
  -> Verify Argon2id hash
  -> Increase failure counter on failure
  -> Lock progressively after threshold
  -> Create session
  -> Issue short-lived access token
  -> Issue rotating refresh token
  -> Write auth event
```

يجب إرجاع رسالة عامة عند فشل الدخول، مثل:

```
بيانات الدخول غير صحيحة
```

ولا يتم كشف ما إذا كان البريد موجوداً أو كلمة المرور هي الخاطئة.

### 6.3 كلمات المرور

المعيار:

- Argon2id.

- Salt فريد يولده المكوّن نفسه.

- Hash قابل للتحقق ولا يمكن عكسه.

- Work factor مضبوط عبر Configuration.

- Rehash تلقائي عند رفع إعدادات الأمان.

- Password History للحسابات الحساسة عند الحاجة.

- منع إعادة استخدام آخر كلمات المرور للحسابات الإدارية.

- عدم تسجيل كلمة المرور في Logs أو Exceptions.

يمكن استخدام Pepper سري إضافي مخزن خارج PostgreSQL، لكن يجب إدخاله فقط إذا توفرت إدارة أسرار مناسبة. فقدان Pepper يستلزم خطة تغيير كلمات المرور، ولذلك لا يستخدم دون Runbook واضح.

### 6.4 Access Token

خصائصه:

- عمر قصير، مبدئياً من 5 إلى 15 دقيقة.

- توقيع غير متماثل، ويفضل Ed25519/EdDSA إذا كانت بيئة التشغيل تدعمه بثبات.

- بديل عملي: RS256 مع Private Key محفوظ خارج Git.

- Claims محددة:
  - `sub`: معرف المستخدم.
  - `sid`: معرف الجلسة.
  - `jti`: معرف التوكن.
  - `iss`: مصدر الإصدار.
  - `aud`: الجمهور المستهدف.
  - `iat`: وقت الإصدار.
  - `exp`: وقت الانتهاء.
  - `permission_version`: نسخة الصلاحيات عند الحاجة.

يجب التحقق من Algorithm وIssuer وAudience وExpiration وNot-Before. لا يعتمد API على محتوى التوكن قبل التحقق من التوقيع والـ Claims.

### 6.5 Refresh Token

- قيمة عشوائية طويلة.

- لا يخزن نصها الأصلي.

- يخزن Hash فقط.

- مرتبط بجلسة وبـ Token Family.

- يتم تدويره بعد الاستخدام.

- يتم تعليم القديم `used_at`.

- إعادة استخدام Token قديم تؤدي إلى إبطال عائلة الجلسة وتسجيل حدث أمني.

- عند تغيير كلمة المرور أو تعطيل الحساب يتم إبطال كل الجلسات.

### 6.6 Logout وإدارة الجلسات

يجب دعم:

- تسجيل الخروج من الجلسة الحالية.

- تسجيل الخروج من كل الأجهزة.

- عرض الجلسات النشطة للمستخدم المصرح له.

- إبطال جلسة محددة.

- إبطال الجلسات عند تغيير كلمة المرور.

- إبطال الجلسات عند تعطيل الحساب أو تغيير صلاحيات حساسة.

### 6.7 Password Reset

المسار المقترح:

```
Request reset
  -> Generate random one-time token
  -> Store token hash with short expiry
  -> Send link through configured notification channel
  -> Verify token hash and expiry
  -> Set new Argon2id hash
  -> Mark token used
  -> Revoke all sessions
  -> Write audit event
```

لا يسمح Endpoint بإخبار المرسل بوجود البريد من عدمه.

### 6.8 MFA

MFA ليست في أول Migration تشغيلية، لكنها جزء من تصميم Auth من البداية. يجب حجز حقول وواجهات تسمح بإضافة:

- TOTP.

- Recovery Codes hashed.

- MFA requirement على الأدوار الحساسة.

- تحدي إضافي لعمليات تغيير الدور أو البيانات المالية.

---

## 7. RBAC وAuthorization

### 7.1 نموذج الصلاحية

```
User
  -> User Roles
  -> Roles
  -> Role Permissions
  -> Permissions
```

صيغة الصلاحية:

```
resource.action
```

أمثلة:

```
orders.read
orders.create
orders.update
orders.delete
orders.assign
orders.change_status
shipments.read
shipments.update_status
customers.read
customers.update
accounting.read
accounting.create_entry
users.manage
roles.manage
permissions.manage
```

### 7.2 Middleware

```
authenticateRequest
requireRole('admin')
requirePermission('orders.update')
requireResourceAccess('orders', 'update')
```

يجب ألا يكون فحص Role بديلاً عن فحص Permission. Role هو تجميع إداري، أما القرار البرمجي فيبنى على Permission واضحة.

### 7.3 القواعد الإلزامية

- Deny by Default.

- كل Endpoint يحدد هل هو Public أو Authenticated أو Permission-gated.

- كل طلب يعاد فحصه في API.

- الواجهة لا تملك قرار الوصول النهائي.

- العمليات الحساسة تحتاج Permission وResource Ownership أو Scope.

- لا يسمح للمستخدم بتعديل أدواره.

- لا يمكن حذف Root أو تعطيله إلا عبر إجراء محمي متعدد الخطوات.

- تغيير الصلاحيات يسجل في Audit Log.

- يجب اختبار كل Permission Matrix.

### 7.4 الاستعداد لـ ABAC

RBAC وحده قد لا يكفي لاحقاً. يجب أن تقبل Authorization Service سياقاً مثل:

```
user
role
permission
resource
resourceOwner
branch
region
requestTime
orderStatus
```

وبذلك يمكن إضافة قواعد مثل:

- المندوب يرى شحناته فقط.

- موظف الفرع يعدل طلبات فرعه.

- المحاسب يقرأ القيود ولا يحذفها.

- لا يسمح بتعديل الطلب بعد إغلاقه إلا بصلاحية خاصة.

---

## 8. HTTP Security

### 8.1 الإعدادات الأساسية

- HTTPS في كل بيئة خارج التطوير المحلي.

- Helmet.

- CORS allowlist محددة.

- `Content-Type: application/json` للمسارات التي تحتاج JSON.

- حد لحجم Body.

- رفض HTTP Methods غير المستخدمة.

- منع Tokens في Query String.

- `Cache-Control: no-store` للاستجابات الحساسة.

- `X-Content-Type-Options: nosniff`.

- HSTS في الإنتاج.

- عدم إرسال Stack Trace للعميل.

### 8.2 CORS

لا يستخدم:

```
cors()
```

بلا إعداد.

يجب تعريف:

```
CORS_ORIGINS=https://alx.example.com,https://admin.example.com
```

وفي التطوير يسمح فقط بمصادر محددة. تطبيق Electron يعامل وفق طريقة الاتصال المقررة، ولا يفتح API لأي Origin عشوائي.

### 8.3 Rate Limiting

يجب تخصيص حدود مختلفة:

- Login: حد منخفض ومراقبة عالية.

- Refresh: حد منخفض.

- Password Reset: حد منخفض.

- API العامة: حد متوسط.

- API الداخلية: حد حسب المستخدم والعنوان.

- العمليات الثقيلة: حد خاص.

`express-rate-limit` مناسب للبداية مع ذاكرة محلية في نسخة واحدة. عند تشغيل أكثر من Instance يجب استخدام Store موزع مثل Redis أو حل PostgreSQL مضبوط، مع عدم الاعتماد على Memory Store.

### 8.4 CSRF

إذا استخدم الموقع Cookies للمصادقة:

- تفعيل CSRF protection للمسارات التي تغير البيانات.

- Cookies `HttpOnly` و`Secure` و`SameSite` مناسب.

- التحقق من Origin عند العمليات الحساسة.

إذا استخدم تطبيق سطح المكتب Authorization Header فقط، فلا يطبق نموذج CSRF الخاص بالCookies عليه، لكن تبقى حماية النقل والتوكنات مطلوبة.

---

## 9. PostgreSQL وDrizzle

### 9.1 الاتصال

- Pool واحد لكل Process.

- عدم إنشاء Pool داخل كل Request.

- تحديد `max` وفق قدرة PostgreSQL وعدد Instances.

- ضبط Connection Timeout وIdle Timeout.

- تسجيل أخطاء Pool دون كشف بيانات الاتصال.

- إغلاق Pool عند Shutdown.

- استخدام SSL عند الاتصال بخدمة PostgreSQL سحابية.

### 9.2 الاستعلامات

- استخدام Drizzle للعمليات typed.

- استخدام SQL صريح عند الحاجة إلى استعلامات PostgreSQL متقدمة، مع Repository معزول.

- عدم تركيب SQL من مدخلات المستخدم.

- استخدام Parameters دائماً.

- تحديد الحقول المطلوبة بدلاً من `select *` في المسارات العامة.

- فرض Pagination على القوائم.

- استخدام Cursor Pagination للجداول الكبيرة.

### 9.3 Transactions

يجب استخدام Transaction في:

- إنشاء مستخدم مع Role.

- تدوير Refresh Token.

- إنشاء طلب وعناصره.

- تغيير حالة الطلب مع سجل التاريخ.

- إنشاء شحنة مع أحداثها.

- تسجيل قيد مالي مع أسطره.

- أي عملية تحتوي أكثر من كتابة يجب أن تنجح أو تفشل كوحدة واحدة.

### 9.4 Migrations

المسار المعتمد:

```
Update Drizzle schema
  -> Generate migration
  -> Review generated SQL
  -> Run migration tests
  -> Apply to local PostgreSQL
  -> Apply to test database
  -> Backup/check production
  -> Apply in deployment step
```

ممنوع:

- `sequelize.sync( )`.

- `drizzle push` على الإنتاج.

- `drop database` من تشغيل API.

- Migration غير قابلة للمراجعة.

- تعديل قاعدة البيانات يدوياً دون توثيق.

يجب فصل Migration عن تشغيل السيرفر، وتطبيقها كخطوة نشر صريحة.

---

## 10. API Contract وOpenAPI

### 10.1 Versioning

جميع المسارات العامة تبدأ بـ:

```
/api/v1
```

مثال:

```
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
GET  /api/v1/orders
POST /api/v1/orders
```

### 10.2 Response موحد

نجاح:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

خطأ:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "بيانات الدخول غير صحيحة",
    "requestId": "...",
    "details": []
  }
}
```

`details` لا يحتوي على Stack Trace أو SQL أو بيانات حساسة.

### 10.3 Zod وOpenAPI

كل Endpoint يحتاج:

- Request Params Schema.

- Query Schema.

- Body Schema.

- Response DTO Schema.

- Error contract.

- Permission declaration.

- Test للحالات الصحيحة والخاطئة.

OpenAPI هو العقد الخارجي، وZod هو التحقق التنفيذي داخل API. يجب منع اختلافهما عبر مراجعة أو توليد من مصدر واضح.

---

## 11. Logging وAudit

### 11.1 Pino Logging

كل Log يحتوي على:

```
timestamp
level
service
environment
requestId
route
method
statusCode
durationMs
userId عند توفره
errorCode عند الخطأ
```

لا يسجل:

- كلمات المرور.

- Access Tokens.

- Refresh Tokens.

- Password Reset Tokens.

- مفاتيح التوقيع.

- Connection String.

- بيانات مالية كاملة دون حاجة.

### 11.2 الفرق بين Log وAudit

- Log تشغيلي لتشخيص الخدمة.

- Audit ثابت لإثبات من قام بعملية ومتى وعلى أي سجل.

- Auth Event لتتبع الدخول والفشل وتدوير الجلسات.

العمليات التي تحتاج Audit:

- إنشاء مستخدم.

- تعطيل مستخدم.

- تغيير Role.

- تغيير Permission.

- Login failed/success.

- Password change/reset.

- حذف أو تعديل طلب.

- تغيير حالة شحنة.

- إدخال أو عكس قيد مالي.

- استخدام Root أو Emergency operation.

---

## 12. الاختبارات

### 12.1 Unit Tests

تغطي:

- Argon2id hash/verify.

- Token signing/verification.

- Refresh rotation.

- Reuse detection.

- Password policy.

- Pagination.

- Zod schemas.

- Permission resolver.

- Order state transition rules.

- Financial validation.

### 12.2 Integration Tests

باستخدام Jest وSupertest ضد PostgreSQL اختبارية:

- Login صحيح.

- Login فاشل.

- Lockout.

- Refresh rotation.

- Logout.

- User creation.

- Role assignment.

- Permission denial.

- Order CRUD.

- Transaction rollback.

- Audit creation.

### 12.3 Security Tests

- لا يمكن تجاوز Auth بتغيير Header.

- لا يمكن استخدام Token منتهي.

- لا يمكن استخدام Token بتوقيع خاطئ.

- لا تقبل الخوارزمية غير المسموحة.

- لا يمكن إعادة استخدام Refresh Token.

- لا تظهر كلمة المرور في Response أو Log.

- لا يمكن الوصول إلى مورد مستخدم آخر.

- Rate limit يعمل.

- CORS لا يسمح بمصدر غير معتمد.

- SQL Injection وMalformed Input لا تكشف تفاصيل داخلية.

### 12.4 Authorization Matrix Tests

يجب إنشاء مصفوفة مثل:

| الدور | orders.read | orders.create | orders.update | accounting.read | users.manage |
| --- | --- | --- | --- | --- | --- |
| `super_admin` | نعم | نعم | نعم | نعم | نعم |
| `admin` | نعم | نعم | نعم | حسب السياسة | نعم |
| `dispatcher` | نعم | نعم | نعم | لا | لا |
| `accountant` | حسب السياسة | لا | لا | نعم | لا |
| `courier` | شحناته فقط | لا | حالة شحنته | لا | لا |
| `viewer` | نعم | لا | لا | لا | لا |

هذه المصفوفة ليست توثيقاً فقط، بل اختبارات قابلة للتنفيذ.

---

## 13. التشغيل والبيئات

### 13.1 البيئات

```
local
 test
 staging
 production
```

كل بيئة تستخدم PostgreSQL فقط، لكن بقاعدة وبيانات اعتماد منفصلة.

### 13.2 `.env.example`

```
NODE_ENV=development
PORT=4100
API_BASE_URL=http://localhost:4100

DATABASE_URL=postgresql://alx_api:change-me@localhost:5432/alx_dev
DATABASE_SSL=false
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=5000

JWT_ISSUER=alx-api
JWT_AUDIENCE=alx-clients
JWT_PRIVATE_KEY_PATH=
JWT_PUBLIC_KEY_PATH=
ACCESS_TOKEN_TTL=10m
REFRESH_TOKEN_TTL_DAYS=30

ARGON2_MEMORY_KIB=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=1
PASSWORD_PEPPER=

CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=10

LOG_LEVEL=info
OPENAPI_ENABLED=true
```

القيم الحقيقية لا تحفظ في Git. يجب أن يتحقق `env.ts` من المتغيرات عند بدء التشغيل، ويرفض تشغيل Production إذا كانت أسرار أو مفاتيح مطلوبة ناقصة.

### 13.3 Graceful Shutdown

عند إيقاف الخدمة:

1. إيقاف استقبال Requests جديدة.

1. انتظار الطلبات النشطة ضمن مهلة.

1. إغلاق Pool.

1. إغلاق Logger transports.

1. إنهاء العملية برمز مناسب.

### 13.4 Health Checks

```
GET /health/live
GET /health/ready
```

- `live`: الخدمة تعمل.

- `ready`: التطبيق قادر على استخدام PostgreSQL.

لا يعرض Health Check معلومات Connection String أو تفاصيل schema.

---

## 14. خطة التنفيذ المرحلية

### المرحلة 0: تثبيت المتطلبات

المخرجات:

- اعتماد أسماء النطاقات والحقول.

- اعتماد UTC وUUID.

- اعتماد أدوار البداية.

- اعتماد سياسة كلمات المرور.

- اعتماد مدة Tokens.

- تحديد بيئات PostgreSQL.

- توثيق قرار Drizzle و`pg`.

معيار الإنجاز: لا توجد قرارات متعارضة في وثيقة المجال أو الأمن.

### المرحلة 1: Scaffold وTooling

المخرجات:

- مشروع TypeScript مستقل.

- Express 5.

- Scripts للتطوير والبناء والاختبار والـ lint.

- `env.ts`.

- Pino.

- Error handler.

- Request ID.

- Health endpoints.

- Jest وSupertest.

- CI أولي.

معيار الإنجاز: الخدمة تبدأ بدون Modules أعمال، وتنجح اختبارات health والتهيئة.

### المرحلة 2: PostgreSQL وDrizzle

المخرجات:

- Pool واحد.

- Drizzle client.

- أول migration.

- Transaction helper.

- `users` و`user_credentials` و`sessions` و`refresh_tokens`.

- قاعدة PostgreSQL محلية للاختبار.

معيار الإنجاز: migrations قابلة للتطبيق والإلغاء حيث يسمح التصميم، والاختبارات تعمل ضد PostgreSQL.

### المرحلة 3: Auth Core

المخرجات:

- Argon2id service.

- Login.

- Logout.

- Refresh rotation.

- Session revoke.

- Password change.

- Password reset token flow.

- Auth events.

- Rate limiting للمصادقة.

معيار الإنجاز: لا يوجد مسار يستخدم كلمات مرور نصية أو Session محلية غير موثقة.

### المرحلة 4: RBAC

المخرجات:

- جداول roles/permissions.

- Seed للأدوار النظامية.

- Authorization service.

- Middleware.

- Users/Roles/Permissions endpoints.

- Audit لتغيير الصلاحيات.

- Permission matrix tests.

معيار الإنجاز: كل Endpoint خاص محمي بصلاحية معلنة ومختبرة.

### المرحلة 5: OpenAPI والعقود

المخرجات:

- `openapi.yaml`.

- Response/error contract.

- Zod schemas.

- Client contract generation إن لزم.

- توثيق Auth وRBAC.

معيار الإنجاز: يستطيع النظام المحلي والموقع معرفة API دون معرفة قاعدة البيانات.

### المرحلة 6: العملاء

المخرجات:

- Customers module.

- Pagination/filtering/sorting.

- Ownership policies.

- Tests.

معيار الإنجاز: أول Module أعمال مكتمل end-to-end، ويستخدمه Client تجريبي عبر HTTP.

### المرحلة 7: الطلبات والشحنات

المخرجات:

- Orders.

- Order items.

- Order status transitions.

- Order history.

- Shipments.

- Courier assignment.

- Tracking events.

- Transaction boundaries.

- Idempotency للأوامر الحساسة.

معيار الإنجاز: إنشاء طلب وتغيير حالته وتسجيل تاريخ العملية في Transaction واحدة حيث يلزم.

### المرحلة 8: المالية والمصروفات

المخرجات:

- Accounts.

- Journal entries.

- Journal lines.

- Expenses.

- Validation للتوازن.

- منع الحذف المباشر للقيود.

- Reversal workflow.

- Audit قوي.

معيار الإنجاز: لا يمكن إنشاء قيد غير متوازن، ولا يمكن تجاوز Permission المالية.

### المرحلة 9: الإشعارات والتكاملات

المخرجات:

- Notifications module.

- WhatsApp أو أي مزود خارجي عبر Adapter مستقل.

- Outbox pattern عند الحاجة.

- Retry وIdempotency.

- عدم ربط Domain مباشرة بمزود خارجي.

معيار الإنجاز: فشل مزود الإشعارات لا يلغي العملية الأساسية إذا كانت السياسة تسمح بذلك.

### المرحلة 10: نقل العملاء

الترتيب:

1. عميل HTTP مشترك.

1. نقل Login والجلسة.

1. نقل المستخدمين والأدوار.

1. نقل العملاء.

1. نقل الطلبات.

1. نقل الشحنات.

1. نقل المالية.

1. نقل الموقع.

1. منع الوصول المباشر إلى PostgreSQL من الواجهات.

معيار الإنجاز: لا توجد صفحة إنتاجية تنفذ CRUD مباشرة على قاعدة البيانات.

### المرحلة 11: Hardening والإطلاق

المخرجات:

- Threat model.

- Dependency audit.

- Security tests.

- Load test.

- Backup/restore drill.

- Migration rollback plan.

- Incident runbook.

- Production monitoring.

- مراجعة الصلاحيات.

معيار الإنجاز: يمكن تشغيل API وإيقافها وترقيتها واستعادة قاعدة البيانات دون خطوات غير موثقة.

---

## 15. خطة ترحيل البيانات من النظام الحالي

لا يبدأ الترحيل قبل تجميد قاموس البيانات.

### 15.1 الاكتشاف

- استخراج كل الجداول والمصادر الحالية.

- رصد الحقول المكررة.

- تحديد الحقول داخل JSONB.

- تحديد الحقول المتعارضة في التسمية.

- تحديد العلاقات الفعلية.

- تحديد السجلات التي تحتاج تنظيفاً.

- تحديد التواريخ والمبالغ غير الموحدة.

### 15.2 Canonical Model

إنشاء نموذج موحد لكل كيان:

```
Entity
  - columns
  - types
  - required fields
  - unique constraints
  - state machine
  - audit policy
  - permissions
```

### 15.3 Data Migration

- أخذ Backup كامل.

- تشغيل Migration على قاعدة اختبار.

- تحويل الحقول مع تقرير أخطاء.

- عدم إسقاط المصدر القديم قبل التحقق.

- عدّ السجلات قبل وبعد.

- مقارنة عينات ومجاميع مالية.

- تشغيل API في Read-only أو Shadow mode.

- تنفيذ Cutover مخطط.

### 15.4 التعايش المؤقت

إذا تطلب الانتقال فترة تعايش:

```
Old Client -> Compatibility Layer -> alx_api
New Client -> alx_api
```

ولا يسمح بوجود مسارين مستقلين للكتابة دون سياسة واضحة لمنع تعارض البيانات.

---

## 16. ما يجب عدم فعله

- عدم نسخ أي من المستودعين كما هو.

- عدم دعم SQLite أو MySQL.

- عدم استخدام Supabase Auth.

- عدم وضع Service Credentials في Frontend.

- عدم تخزين كلمة مرور نصية أو مشفرة قابلة للفك.

- عدم استخدام `database.drop( )` من API.

- عدم استخدام `sync()` لتعديل Production schema.

- عدم إصدار JWT بمفتاح افتراضي.

- عدم قبول Tokens في Query String أو Body.

- عدم وضع الصلاحيات في الواجهة فقط.

- عدم وضع SQL في Controllers.

- عدم إعادة `err.message` الخام للعميل.

- عدم استخدام `any` في Auth أو Finance أو Order State.

- عدم تنفيذ العمليات المالية متعددة الكتابات خارج Transaction.

- عدم حذف Audit Logs أو Journal Entries حذفاً فعلياً.

---

## 17. معايير القبول النهائية

يعتبر `alx_api` جاهزاً للانتقال التدريجي عندما تتحقق الشروط التالية:

### البنية

- كل Module يتبع Route/Controller/Service/Repository.

- لا يوجد وصول مباشر لقاعدة البيانات من النظام أو الموقع.

- كل Endpoint موثق في OpenAPI.

### المصادقة

- كلمات المرور Argon2id.

- Access Token قصير العمر.

- Refresh Token Rotation يعمل.

- Reuse Detection يعمل.

- Logout وإبطال الجلسات يعملان.

- Password Reset لا يكشف وجود البريد.

### الصلاحيات

- Deny by Default.

- Permission Matrix موجودة.

- كل Endpoint خاص لديه Permission.

- تغيير الأدوار يسجل Audit.

- اختبارات عدم تجاوز الصلاحيات ناجحة.

### قاعدة البيانات

- PostgreSQL فقط.

- Migrations مراجعة.

- لا يوجد `sync` أو `drop` في Production.

- Transactions للعمليات المركبة.

- Pagination في القوائم الكبيرة.

### الأمان

- HTTPS في Production.

- Helmet وCORS allowlist.

- Rate limiting.

- Body size limits.

- Structured logging.

- لا توجد أسرار في المصدر أو Logs.

- Dependency audit ناجح.

### الجودة

- Unit وIntegration وSecurity tests.

- Coverage مستهدف يحدد بعد بناء Modules، مع عدم قبول غياب اختبارات Auth/RBAC.

- CI يشغل typecheck وlint وtest وmigration verification.

- Runbooks للتشغيل والاستعادة والحوادث.

---

## 18. قائمة الحزم المقترحة

هذه قائمة أولية، ويجب تثبيت الإصدارات الفعلية وقت التنفيذ بعد مراجعة توافق Node.js وبيئة النشر:

### Runtime

```
express
pg
drizzle-orm
zod
jose
argon2 أو @node-rs/argon2
helmet
express-rate-limit
pino
pino-http
cors
cookie-parser عند استخدام Cookies
```

### Development

```
typescript
tsx
jest
ts-jest أو بديل TypeScript متوافق
supertest
eslint
prettier
drizzle-kit
@types/express
@types/node
```

### اختيار Argon2

يجب إجراء اختبار بناء وتشغيل في بيئة التطوير وبيئة النشر قبل تثبيت الحزمة النهائية، لأن بعض تطبيقات Argon2 تعتمد على Native binaries. القرار النهائي يكون بين:

- `argon2`: واجهة معروفة وناضجة في Node.js.

- `@node-rs/argon2`: بديل سريع يعتمد على Native binaries جاهزة لأنظمة محددة.

لا يتم استبدال Argon2id بـ SHA-256 أو تشفير قابل للفك.

---

## 19. قرارات تحتاج اعتماداً قبل بدء الكود

هذه القرارات لا تغير الاتجاه العام، لكنها تؤثر في التنفيذ:

1. هل يكون Access Token في `Authorization` لكل العملاء، أم Cookies للموقع وHeader لتطبيق Electron؟

1. هل تكون مفاتيح JWT Ed25519 أم RS256 وفق بيئة النشر؟

1. هل يوجد Redis مستقبلاً لـ Rate Limiting والجلسات الموزعة، أم يبدأ النظام بـ PostgreSQL؟

1. ما قائمة الأدوار النظامية النهائية؟

1. ما قائمة الصلاحيات النهائية لكل Module؟

1. ما قناة إرسال Password Reset وMFA؟

1. ما نطاقات CORS الرسمية؟

1. ما سياسة الاحتفاظ بـ Audit Logs؟

1. ما الحد الأقصى للصور والمرفقات وStorage المستقبلي؟

1. ما قاعدة البيانات التي ستستخدم في Local وStaging وProduction؟

لا ينبغي أن توقف هذه القرارات مرحلة Scaffold، لكنها يجب أن تحسم قبل تنفيذ Auth النهائي وRBAC وDeployment.

---

## 20. المصادر والمراجع

المبادئ الأمنية في هذه الخطة متوافقة مع توصيات OWASP الخاصة بتخزين كلمات المرور، وأمن REST، والتحكم في الوصول. توصي OWASP باستخدام خوارزمية Password Hashing بطيئة ومتكيفة مثل Argon2id، وتؤكد مبدأ أقل صلاحية والرفض الافتراضي والتحقق من الصلاحيات في كل طلب. كما تعتمد خطة الاتصال على Pool في `node-postgres`، وخطة المهاجرات على Migrations صريحة بدلاً من مزامنة Schema عند بدء التطبيق.

[1]: https://github.com/aichbauer/express-rest-api-boilerplate "aichbauer Express REST API Boilerplate"

[2]: https://github.com/didinj/node-express-postgresql-sequelize "didinj Node Express PostgreSQL Sequelize"

[3]: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html "OWASP Password Storage Cheat Sheet"

[4]: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html "OWASP REST Security Cheat Sheet"

[5]: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html "OWASP Authorization Cheat Sheet"

[6]: https://node-postgres.com/features/pooling "node-postgres Pooling Documentation"

[7]: https://orm.drizzle.team/docs/migrations "Drizzle ORM Migrations Documentation"

[8]: https://sequelize.org/docs/v6/other-topics/migrations/ "Sequelize Migrations Documentation"

