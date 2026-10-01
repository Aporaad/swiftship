# جاهزية المرحلة 13 — تأسيس حد API قبل `alx_api`

**المشروع:** `Aporaad/swiftship`  
**التاريخ:** 2026-10-01  
**الحالة:** جاهزية وتحضير فقط؛ لا يبدأ النقل قبل إغلاق بوابتي المرحلتين 11 و12.

## الهدف

إنشاء حد API قابل للاختبار حول العقود المثبتة، من دون نقل كل الميزات أو تغيير قاعدة البيانات. يكون المسار المستهدف:

```text
React / Electron / alx_web → HTTP API → Application Gateway → Supabase
```

## المدخلات الجاهزة

- عقود DTO وmappers وقيم المعرفات والتواريخ والعملات والمبالغ موجودة في `src/data/dtos` و`src/shared/contracts`.
- عقد الأخطاء في `src/shared/contracts/error.contracts.ts`.
- حالات UI و`runQuery`/`runMutation` في `src/shared/contracts/ui.contracts.ts`.
- عقود Auth/Session وPermissionGate موجودة، مع بقاء التفويض النهائي خادمياً.
- خريطة الوصول والـRPCs والمخاطر موثقة في ملفات `docs/pre-api`.

## بوابة الدخول قبل البدء

1. إغلاق strict/legacy `any` المتبقي في Orders وFinanceAccounting على دفعات صغيرة.
2. إكمال ترحيل مستهلكي Query/Mutation إلى العقد المشترك، بما في ذلك حفظ نموذج المرتجعات.
3. تثبيت اختبار HTTP contract واحد على الأقل لمسار قراءة آمن ومسار خطأ.
4. عدم تنفيذ SQL أو تغيير RLS ضمن تأسيس الحد إلا بخطة منفصلة وموافقة صريحة.

## أول نطاق مقترح

يبدأ التنفيذ بمسارات منخفضة المخاطر وقابلة للقراءة فقط:

1. health/readiness endpoint.
2. `AuthGateway` وقراءة المستخدم الحالي دون أسرار.
3. `CustomersGateway` أو `CouriersGateway` للقراءة، بعد اعتماد DTO وpermission contract.
4. ترجمة أخطاء Supabase إلى `ErrorEnvelope` مع `requestId`.

لا يبدأ Orders أو Accounting API قبل توثيق transaction boundary وidempotency وside effects لكل mutation.

## معيار الخروج

- typecheck والاختبارات والبناء ناجحة.
- اختبار contract للـHTTP وerror envelope ناجح.
- لا وصول مباشر جديد من UI إلى Supabase في المسار المرحّل.
- لا تسريب لأسرار أو رسائل قاعدة بيانات خام.
- توثيق route، DTO، permission، audit، retry، وtransaction boundary لكل مسار.


## اعتماد بدء المرحلة 13 — 2026-10-01 20:14:30 +0000 — AI Model: Manus
أُغلقت بوابتا المرحلتين 11 و12 ضمن نطاقهما التنفيذي، وأصبحت المرحلة 13 جاهزة للبدء. لا يُنقل Orders أو Accounting API في البداية.

### أول مهمة تنفيذية معتمدة
1. تثبيت HTTP health/readiness contract واختبار `ErrorEnvelope`.
2. ربط المسار بحد Gateway قابل للاختبار دون كشف أسرار أو رسائل قاعدة بيانات خام.
3. توثيق route وDTO وpermission وaudit وretry وtransaction boundary قبل أي mutation.

**نتيجة الاعتماد:** المرحلة 13 جاهزة للتنفيذ في الدفعة التالية، ولم تُنفذ route جديدة في هذه الدفعة.

## تنفيذ المهمة الأولى — 2026-10-01 20:15:30 +0000 — AI Model: Manus
تم تنفيذ أول نطاق من المرحلة 13:

- `GET /api/readiness` أصبح route رسميًا.
- عقد الاستجابة يميز `ready` و`not_ready`، ويستخدم HTTP 200/503 وفق حالة قاعدة البيانات.
- أضيف اختبار contract لـ`readinessResponse` للحالتين.
- لم يتم نقل أي Feature إلى API ولم يتم تغيير قاعدة البيانات أو RLS.

**التحقق:** TypeScript ناجح واختبارات `server/app.test.ts` ناجحة (6 اختبارات).


## تنفيذ API Foundation — 2026-10-01 20:23:00 +0000 — AI Model: Manus
تم تنفيذ وتوثيق أساس HTTP:

- request ID middleware موحد عبر `x-request-id` مع UUID fallback.
- ErrorEnvelope handler آمن مركب بعد جميع routes في `server.ts`.
- `/api/v1/contract` ككتالوج versioned لنقاط الاتصال وحالة auth والتفعيل.
- توثيق route وDTO وpermission وaudit وretry وtransaction boundary في `api-foundation-contract-2026-10-01.md`.
- إبقاء current-user وCustomers وCouriers غير مفعلة حتى بناء server-auth middleware؛ لا يتم تجاوز بوابة التفويض.

**التحقق:** TypeScript ناجح، و10 اختبارات مستهدفة ناجحة (8 app + 2 ApiClient). لم تُنفذ SQL ولم تتغير قاعدة البيانات أو RLS.


## تنفيذ server-auth وCustomers — 2026-10-01 20:31:00 +0000 — AI Model: Manus
تم تنفيذ middleware المصادقة القابل للاختبار، ثم تفعيل أول مسار بيانات read-only:

- `GET /api/v1/customers` خلف Bearer authentication.
- عقد principal وأدوار server-side قابلة للحقن.
- DTO آمن وGateway typed مع pagination/search.
- حالات `AUTH_REQUIRED`, `AUTH_INVALID`, و`AUTH_NOT_CONFIGURED` موحدة وآمنة.
- `SWIFTSHIP_API_TOKEN` حل bootstrap مؤقت، وليس بديلًا عن verifier جلسة الإنتاج.

**التحقق:** TypeScript ناجح و16 اختبارًا مستهدفًا ناجحة. لم تُنفذ SQL ولم تتغير DB/RLS.
