# دليل اختبار تكامل PostgreSQL الفعلي مع `alx_api`

**الغرض:** تشغيل API ضد PostgreSQL الحقيقي باستخدام `DATABASE_URL` واختبار المصادقة والصلاحيات وFinance API دون كشف الأسرار أو تعديل بيانات إنتاجية غير مقصودة.

**تاريخ الإصدار:** 2026-10-05

> عند تنفيذ هذا الدليل بالكامل وتسجيل النتائج في قسم «محضر التنفيذ»، يعتبر اختبار التكامل منتهياً لهذه المرحلة.

## 1. قواعد السلامة قبل البدء

1. استخدم قاعدة اختبار أو بيئة staging إن كانت متاحة. لا تستخدم حساب `postgres` أو `service_role`.
2. يجب أن يكون `DATABASE_URL` موجهاً إلى دور `alx_api_runtime` أو حساب runtime مكافئ محدود الصلاحيات.
3. لا تضع كلمة المرور أو مفاتيح JWT داخل Git أو داخل رسالة.
4. لا تنفذ أوامر SQL كتابة على بيانات حقيقية أثناء smoke test إلا بعد إنشاء سجل اختبار واضح وقابل للتنظيف.
5. استخدم مستخدم API اختباري غير إنتاجي له صلاحيات Finance المطلوبة فقط.
6. الاختبار الافتراضي للقيود يختبر إنشاء **مسودة** ثم إبطالها؛ لا ترحّل قيداً حقيقياً في الإنتاج.

## 2. المتطلبات

- Node.js 22 أو أحدث.
- npm.
- PostgreSQL قابل للوصول من الجهاز.
- `DATABASE_URL` مباشر أو Pooler يعمل مع `pg`.
- مفاتيح Ed25519 لـJWT.
- مستخدم API تجريبي موجود في `public.users` مع صلاحيات RBAC مناسبة.
- نسخة نظيفة من فرع `main`.

## 3. تحميل المشروع وبناء API

```bash
gh repo clone Aporaad/swiftship
cd swiftship/alx_api
npm ci
npm run check
npm run lint
npm test -- --runInBand
npm run build
```

النتيجة المطلوبة:

- نجاح TypeScript check.
- نجاح lint.
- نجاح جميع اختبارات Jest.
- وجود مجلد build الناتج دون أخطاء.

## 4. إنشاء ملف البيئة محلياً

```bash
cp .env.example .env
chmod 600 .env
```

املأ القيم محلياً فقط:

```env
NODE_ENV=development
HOST=127.0.0.1
PORT=3001
DATABASE_URL=ضع_رابط_الاتصال_هنا
DATABASE_SSL_MODE=require
DATABASE_RUNTIME_ROLE=
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
JWT_PRIVATE_KEY_PEM=ضع_المفتاح_الخاص_هنا
JWT_PUBLIC_KEY_PEM=ضع_المفتاح_العام_هنا
AUTH_DUMMY_PASSWORD_HASH=ضع_hash_اختباري_هنا
JWT_ISSUER=swiftship-api
JWT_AUDIENCE=swiftship-client
ACCESS_TOKEN_TTL_SECONDS=600
REFRESH_TOKEN_TTL_SECONDS=2592000
LEGACY_PASSWORD_AUTH_ENABLED=true
AUTH_PASSWORD_CHANGES_ENABLED=false
```

### ملاحظات الاتصال

- في PostgreSQL المحلي يمكن استخدام `DATABASE_SSL_MODE=disable` فقط أثناء الاختبار المحلي المعزول.
- في staging استخدم `require` على الأقل.
- في production يجب استخدام `verify-full` مع `DATABASE_SSL_CA_PEM` موثوق.
- لا تضبط `DATABASE_RUNTIME_ROLE` في production؛ يجب أن يكون الدور جزءاً من رابط الاتصال نفسه وفق سياسة التشغيل.
- لا تستخدم `postgres` أو `service_role` كرابط API.

## 5. فحص اتصال PostgreSQL قبل تشغيل الخادم

تحقق من أن المتغير موجود دون طباعته:

```bash
node -e "console.log(process.env.DATABASE_URL ? 'DATABASE_URL present' : 'DATABASE_URL missing')"
```

إذا لم يقرأ Node ملف `.env` في بيئتك، استخدم shell آمن أو شغل الأمر من خلال npm/tsx الذي يحمّل `.env` حسب إعداد المشروع. لا تطبع القيمة نفسها.

اختبار PostgreSQL منخفض التأثير، من عميل موثوق وليس من التطبيق:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT current_user, current_database(), version();"
```

النتيجة المطلوبة:

- `current_user` هو دور runtime المحدود.
- الاتصال مشفر حسب إعداد البيئة.
- لا تظهر كلمة المرور في سجل الطرفية.

## 6. تشغيل `alx_api`

من مجلد `alx_api`:

```bash
npm run dev
```

أو تشغيل build:

```bash
npm run build
npm start
```

يجب أن يظهر في السجل ما يشبه:

```text
alx_api listening
host=127.0.0.1
port=3001
databaseConfigured=true
authConfigured=true
```

لا تشارك سطر سجل يحتوي على connection string أو secrets.

## 7. اختبار Health endpoints

### Liveness

```bash
curl -i http://127.0.0.1:3001/api/v1/health/live
```

المتوقع: HTTP `200` و`success=true`.

### Readiness

```bash
curl -i http://127.0.0.1:3001/api/v1/health/ready
```

المتوقع: HTTP `200`، مع:

```json
{
  "success": true,
  "data": {
    "status": "ready",
    "checks": { "database": true, "auth": true }
  }
}
```

إذا كانت النتيجة `503`:

- تحقق من `DATABASE_URL`.
- تحقق من TLS وCA.
- تحقق من JWT keys.
- تحقق من grants لدور runtime.
- تحقق من أن auth foundation migrations مطبقة.

## 8. اختبار Login والحصول على Access Token

استخدم مستخدم API اختباري فقط:

```bash
LOGIN_RESPONSE=$(curl -sS -X POST http://127.0.0.1:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"finance-api-test-user","password":"ضع_كلمة_المرور_الاختبارية"}')
printf '%s\n' "$LOGIN_RESPONSE"
```

استخرج التوكن في shell مؤقتاً:

```bash
ACCESS_TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
test -n "$ACCESS_TOKEN" && test "$ACCESS_TOKEN" != "null"
```

لا تحفظ التوكن في ملف Git. بعد انتهاء الاختبار:

```bash
unset LOGIN_RESPONSE ACCESS_TOKEN
```

## 9. اختبار هوية المستخدم وصلاحياته

```bash
curl -sS http://127.0.0.1:3001/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

curl -sS http://127.0.0.1:3001/api/v1/auth/permissions \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

يجب أن يكون المستخدم الاختباري مملوكاً له على الأقل بحسب الاختبارات التي ستنفذ:

- `view_financial_accounts`
- `view_account_movements`
- `view_finance`
- `add_finance`
- `post_financial_entries` عند اختبار الترحيل
- `reverse_financial_entries` عند اختبار العكس
- `void_financial_entries` عند اختبار إبطال المسودة

## 10. اختبار Finance read endpoints

### الحسابات

```bash
curl -sS 'http://127.0.0.1:3001/api/v1/finance/accounts?limit=5&offset=0' \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### الحركات المرحّلة

```bash
curl -sS 'http://127.0.0.1:3001/api/v1/finance/account-movements?limit=5&offset=0' \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### القيود

```bash
curl -sS 'http://127.0.0.1:3001/api/v1/finance/entries?limit=5&offset=0' \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### فئات وأنواع القيود

```bash
curl -sS http://127.0.0.1:3001/api/v1/finance/entry-modules \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

curl -sS http://127.0.0.1:3001/api/v1/finance/entry-types \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### قواعد القيود التلقائية والعهد

```bash
curl -sS 'http://127.0.0.1:3001/api/v1/finance/auto-entry-rules?limit=20&offset=0' \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

curl -sS 'http://127.0.0.1:3001/api/v1/finance/custody-advances?limit=20&offset=0' \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

## 11. اختبار رفض القيد غير المتوازن

هذا الاختبار لا يجب أن يكتب شيئاً:

```bash
curl -i -sS -X POST http://127.0.0.1:3001/api/v1/finance/entries \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "entryNumber":"API-TEST-UNBALANCED",
    "moduleId":"ضع_module_id_صحيح",
    "entryTypeId":"ضع_entry_type_id_صحيح",
    "entryCategory":"General",
    "postingStatus":"draft",
    "description":"اختبار رفض قيد غير متوازن",
    "lines":[
      {"accountId":"ضع_account_id_صحيح_1","accountCurNo":1,"transType":"Debit","amount":100,"amountOriginal":100,"currencyOriginalNo":1},
      {"accountId":"ضع_account_id_صحيح_2","accountCurNo":1,"transType":"Credit","amount":99,"amountOriginal":99,"currencyOriginalNo":1}
    ]
  }'
```

المتوقع: HTTP `400` أو `422`، وعدم ظهور سجل جديد برقم `API-TEST-UNBALANCED`.

## 12. اختبار إنشاء مسودة متوازنة ثم إبطالها

استخدم حسابين صالحين من نتيجة الحسابات، وعملة صحيحة، ونوع قيد صالح:

```bash
CREATE_RESPONSE=$(curl -sS -X POST http://127.0.0.1:3001/api/v1/finance/entries \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "entryNumber":"API-TEST-DRAFT-001",
    "moduleId":"ضع_module_id_صحيح",
    "entryTypeId":"ضع_entry_type_id_صحيح",
    "entryCategory":"General",
    "postingStatus":"draft",
    "description":"اختبار تكامل API PostgreSQL",
    "lines":[
      {"accountId":"ضع_account_id_صحيح_1","accountCurNo":1,"transType":"Debit","amount":1,"amountOriginal":1,"currencyOriginalNo":1},
      {"accountId":"ضع_account_id_صحيح_2","accountCurNo":1,"transType":"Credit","amount":1,"amountOriginal":1,"currencyOriginalNo":1}
    ]
  }')
printf '%s\n' "$CREATE_RESPONSE" | jq
ENTRY_ID=$(printf '%s' "$CREATE_RESPONSE" | jq -r '.data.id // .data.entryId')
test -n "$ENTRY_ID" && test "$ENTRY_ID" != "null"
```

بعد التأكد أن الاستجابة ناجحة، أَبطل المسودة:

```bash
curl -i -sS -X POST "http://127.0.0.1:3001/api/v1/finance/entries/$ENTRY_ID/void" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

المتوقع:

- إنشاء ناجح لمسودة متوازنة.
- حالة الإبطال `voided`.
- عدم إنشاء `account_trans` مرحّلة للمسودة.
- عدم تنفيذ حذف فعلي للقيد.

## 13. اختبار الترحيل والعكس — staging فقط

لا تنفذ هذه الخطوة على الإنتاج أثناء الاختبار الأول. إذا كانت بيئة staging معزولة، فاختبر:

```bash
curl -i -sS -X POST "http://127.0.0.1:3001/api/v1/finance/entries/$ENTRY_ID/post" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

ثم استخدم قيداً مرحّلاً منفصلاً لاختبار العكس:

```bash
curl -i -sS -X POST "http://127.0.0.1:3001/api/v1/finance/entries/$POSTED_ENTRY_ID/reverse" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"description":"اختبار عكس قيد تكامل API"}' | jq
```

المتوقع:

- لا يمكن ترحيل مسودة غير متوازنة.
- لا يمكن عكس قيد غير مرحّل.
- لا يمكن عكس القيد نفسه مرتين.
- لا يتم حذف القيد الأصلي.

## 14. اختبار الصلاحيات السلبية

سجّل الدخول بمستخدم لا يملك `view_finance` أو `add_finance`، ثم نفذ:

```bash
curl -i -sS 'http://127.0.0.1:3001/api/v1/finance/entries?limit=1' \
  -H "Authorization: Bearer $READ_ONLY_TOKEN"

curl -i -sS -X POST http://127.0.0.1:3001/api/v1/finance/entries \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $READ_ONLY_TOKEN" \
  -d '{}'
```

المتوقع: HTTP `403`، وعدم أي كتابة في قاعدة البيانات.

## 15. فحوص PostgreSQL بعد الاختبار

نفذ فحوص القراءة التالية مع مستخدم DBA أو أداة مراقبة مصرح بها، وليس من الواجهة:

```sql
SELECT current_user, current_database(), now();

SELECT main_entry_id, entry_number, posting_status, description
FROM public.main_entry
WHERE entry_number IN ('API-TEST-UNBALANCED', 'API-TEST-DRAFT-001')
ORDER BY created_at DESC
LIMIT 20;

SELECT main_entry_id, line_no, trans_type, amount_original
FROM public.account_trans
WHERE main_entry_id = 'ضع_entry_id_الاختباري_إن_وجد'
ORDER BY line_no
LIMIT 20;
```

تحقق من أن:

- القيد غير المتوازن غير موجود.
- المسودة الاختبارية أصبحت `voided` أو تم تنظيفها حسب سياسة staging.
- لا توجد أسطر مرحّلة غير متوقعة.
- لم تتغير سجلات إنتاجية خارج نطاق الاختبار.

## 16. اختبار Finance UI التدريجي

بعد نجاح API smoke test فقط، في بيئة تطوير أو staging:

```env
VITE_API_BASE_URL=http://127.0.0.1:3001
VITE_FINANCE_API_READS=true
```

ضع Access Token الاختباري المؤقت في آلية الجلسة المعتمدة للمشروع، ويستخدم الـGateway الحالي المفتاح الانتقالي:

```text
alx_api_access_token
```

شغل النظام ثم راقب:

- الحسابات.
- دفتر الأستاذ.
- القيود المرحّلة.
- حركات الحسابات.
- العهد.
- قواعد القيود التلقائية.

إذا فشل API، يعيد Finance Gateway القراءة من المصدر القديم تلقائياً. لا تعتبر ذلك نجاحاً للنقل؛ سجّل الخطأ وأوقف العلم في staging.

## 17. معايير النجاح

اعتبر الاختبار ناجحاً فقط إذا تحققت كل النقاط:

- `health/live` يعيد 200.
- `health/ready` يعيد 200 مع `database=true` و`auth=true`.
- login يعيد Access Token.
- `/auth/me` يعيد المستخدم الصحيح.
- Finance read endpoints تعيد بيانات دون كشف أسرار أو SQL.
- القيد غير المتوازن مرفوض قبل الكتابة.
- المسودة المتوازنة تنشأ وتُبطل دون حذف فعلي.
- الصلاحيات السلبية تعيد 403.
- لا يوجد اتصال API باستخدام `postgres` أو `service_role`.
- جميع اختبارات المشروع تبقى ناجحة.
- لا توجد تغييرات غير مقصودة في قاعدة البيانات.

## 18. محضر التنفيذ

املأ هذا القسم بعد التنفيذ:

```text
التاريخ والوقت:
البيئة: development / staging
Commit:
DATABASE_URL: موجود دون كشف القيمة / غير موجود
current_user:
health/live:
health/ready:
login:
/auth/me:
Finance reads:
Unbalanced entry rejected:
Balanced draft created:
Draft voided:
Permission denied test:
PostgreSQL post-check:
Finance UI read flag:
النتيجة النهائية: ناجح / يحتاج إصلاح
الملاحظات:
```

## 19. معالجة الأعطال

| العرض | الإجراء |
|---|---|
| `DATABASE_URL missing` | ضبط المتغير في `.env` أو بيئة التشغيل دون طباعته |
| `SERVICE_NOT_READY` | فحص database readiness وJWT keys وgrants |
| `AUTH_NOT_CONFIGURED` | ضبط JWT private/public key وdummy hash الاختباري |
| `401 AUTH_INVALID_CREDENTIALS` | أعد login وتأكد من إرسال `Authorization: Bearer` |
| `403` | أضف الصلاحية للمستخدم الاختباري فقط بعد مراجعة RBAC |
| `FINANCIAL_ENTRY_NOT_BALANCED` | راجع مجموع Debit/Credit ولا تتجاوز الحماية |
| `500` من RPC | اقرأ request ID وسجل الخادم، ولا تسجل payload السري |
| Finance UI يظهر البيانات القديمة | تحقق من `VITE_FINANCE_API_READS=true` ووجود Access Token، ثم راجع network logs |

بعد انتهاء الاختبار:

```bash
unset DATABASE_URL ACCESS_TOKEN LOGIN_RESPONSE CREATE_RESPONSE ENTRY_ID POSTED_ENTRY_ID READ_ONLY_TOKEN
```

ولا ترفع `.env` أو أي ملف يحتوي Tokens أو مفاتيح أو كلمات مرور.
