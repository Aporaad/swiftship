# مصفوفة صلاحيات API — SwiftShip System

**تاريخ التثبيت:** 2026-10-03 02:24:24 +0000  
**النطاق:** النظام الأساسي فقط. موقع `alx_web` وRLS وGrants خارج هذه الدفعة بناءً على توجيه المستخدم.

## العقد العام

- كل نجاح يعيد: `{ success: true, data, meta?, requestId }`.
- كل فشل يعيد: `{ success: false, error: { code, message, details, requestId } }`.
- رسائل أخطاء قاعدة البيانات وstack traces لا تخرج إلى العميل.
- `x-request-id` يُقبل بحد أقصى 128 حرفاً، ويُنشأ تلقائياً عند غيابه.
- لا تُعاد حقول `password` أو `system_pin` أو access/session token أو `data` الخام.

## المسارات المثبتة

| Method | Route | Auth | Permission | Ownership / Scope | DTO |
|---|---|---|---|---|---|
| GET | `/api/v1/contract` | Public | None | Contract metadata only | `ApiContractDto` |
| GET | `/api/v1/me` | Local session | Authenticated | Current session user only | `CurrentUserDto` |
| GET | `/api/v1/customers` | Local session | `customers:read` | Server-side filtered; no client identity override | `CustomerDto[]` |
| GET | `/api/v1/couriers` | Local session | `couriers:read` | Server-side filtered; no client identity override | `CourierDto[]` |
| GET | `/api/v1/orders` | Local session | `orders:read` | Ownership enforcement remains a server/API cutover gate | `OrderDto[]` |
| GET | `/api/v1/shipments` | Local session | `shipments:read` | Ownership enforcement remains a server/API cutover gate | `ShipmentDto[]` |
| GET | `/api/v1/products` | Local session | `products:read` | Server-side permission required | `ProductDto[]` |
| GET | `/api/v1/accounts` | Local session | `accounting:read` | Financial data requires explicit permission | `AccountDto[]` |
| GET | `/api/v1/entries` | Local session | `finance:read` | Financial data requires explicit permission | `MainEntryDto[]` |

## Session verifier

1. يقرأ `Authorization: Bearer <session_id>`.
2. يبحث في `sessions.session_id` فقط، وليس حقلاً عاماً باسم `id`.
3. يرفض `force_logout = true` أو `expires_at` المنتهي.
4. يقرأ هوية المستخدم من `sessions.user_id` ثم يبحث في `users.user_id`.
5. يرفض المستخدم المعطل.
6. لا يعتبر أي `userId` من body أو query مصدراً للهوية.

## أكواد الرفض

| HTTP | Code | الاستخدام |
|---:|---|---|
| 401 | `AUTH_REQUIRED` | غياب الجلسة أو انتهاؤها أو force logout |
| 403 | `PERMISSION_DENIED` | الدور لا يملك الصلاحية |
| 404 | `RESOURCE_NOT_FOUND` | يضاف عند إدخال مسارات التفاصيل |
| 409 | `CONFLICT` | تعارض كتابة أو idempotency |
| 422 | `VALIDATION_FAILED` | payload غير صالح |
| 429 | `RATE_LIMITED` | عند تفعيل حد الطلبات |
| 500 | `*_READ_FAILED` | فشل داخلي غير مكشوف التفاصيل |
| 503 | `AUTH_UNAVAILABLE` | تعذر الوصول إلى مصدر الجلسة |

## حدود هذه الدفعة

- المسارات الحالية قراءة فقط؛ لا تُعلن عمليات كتابة Portal أو ownership التفصيلية جاهزة قبل بيئة staging واختبارات بيانات معزولة.
- لا يوجد SQL أو Migration أو DDL/DML في هذه الدفعة.
- لا يُعلن بدء `alx_api` الإنتاجي قبل إغلاق بوابة staging وData Quality Snapshot، حتى مع استثناء RLS/Grants.
