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
