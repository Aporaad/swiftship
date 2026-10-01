# API Foundation — نقاط الاتصال وعقود HTTP

**المشروع:** `Aporaad/swiftship`  
**التاريخ:** 2026-10-01  
**المرحلة:** 13  
**الحالة:** أساس HTTP منفذ وقابل للاختبار؛ نقل بيانات الأعمال ما زال محميًا حتى اكتمال تفويض الخادم.

## المسار المعتمد

```text
UI / Electron / alx_web
        │
        ▼
HTTP API (Express)
        │  x-request-id + ErrorEnvelope
        ▼
Application Gateway
        │
        ▼
Supabase adapter
```

## نقاط الاتصال الحالية

| Method | Route | DTO / Response | Auth | Mutation | الحالة |
|---|---|---|---|---|---|
| GET | `/api/health` | `{ status, project }` | Public | No | منفذ |
| GET | `/api/readiness` | `{ status, checks.database }` | Public | No | منفذ |
| GET | `/api/v1/contract` | `ApiFoundationContract` | Public | No | منفذ |
| GET | `/api/v1/auth/current-user` | Current user DTO | Server auth required | No | غير مفعل |
| GET | `/api/v1/customers` | Customers DTO list | Server auth required | No | غير مفعل |
| GET | `/api/v1/couriers` | Couriers DTO list | Server auth required | No | غير مفعل |

المسارات غير المفعلة موثقة عمدًا بقيمة `auth: not-enabled` في `/api/v1/contract`؛ لا يتم كشف بيانات الأعمال قبل وجود جلسة مستخدم قابلة للتحقق وتفويض خادمي فعلي.

## عقد request ID

- يقرأ الخادم `x-request-id` إذا كان نصًا غير فارغ وبحد أقصى 128 حرفًا.
- عند غيابه أو عدم صلاحيته ينشئ الخادم UUID جديدًا.
- يعاد المعرف في response header نفسه.
- يستخدم المعرف لربط السجل التشغيلي بالخطأ دون تسريب تفاصيل قاعدة البيانات.

## عقد الأخطاء

كل خطأ API جديد يجب أن يعيد:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_API_ERROR",
    "message": "An internal API error occurred.",
    "requestId": "..."
  }
}
```

رسائل Supabase الخام لا تخرج إلى العميل. يتم تسجيل السبب الداخلي في طبقة الخادم وفق سياسة audit لاحقة، بينما يظل response آمنًا وثابتًا.

## permission وaudit وretry وtransaction

- `health`, `readiness`, و`contract`: عامة، read-only، بلا transaction أو retry.
- `current-user`, `customers`, و`couriers`: تتطلب server-auth وpermission contract قبل التفعيل.
- لا توجد mutations في هذه الدفعة؛ لذلك لا transaction boundary أو idempotency key مفعلة بعد.
- لا يستخدم API Foundation retry تلقائيًا؛ أي retry لاحق يجب أن يكون خاصًا بالـgateway وبـGET idempotent فقط.
- يجب تسجيل `requestId`, route, actor, result, وlatency قبل تفعيل مسارات البيانات.

## التحقق

- `npm run check -- --pretty false`: ناجح.
- `server/app.test.ts`: 8 اختبارات ناجحة.
- `src/data/http/api-client.test.ts`: اختباران ناجحان.
- لم تنفذ SQL ولم تتغير الجداول أو RLS أو migrations.

## القرار التالي

الخطوة التالية هي بناء server-auth middleware قابل للاختبار، ثم تفعيل قراءة Customers أو Couriers فقط بعد اعتماد DTO وpermission وaudit contract. لا يبدأ Orders أو Accounting API ولا أي mutation قبل هذه البوابة.
