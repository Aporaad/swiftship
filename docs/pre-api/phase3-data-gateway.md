# المرحلة 3 — Data Gateway Layer

**التاريخ:** 2026-09-28
**الحالة:** قيد التنفيذ الانتقالي؛ العقود وGateway implementation المستقل لكل Feature جاهزة، ولم يتم ربط UI أو بدء HTTP API.

## ما تم تنفيذه

تم إنشاء المسارات الرسمية فقط:

```text
src/data/
├── contracts/
├── current-supabase/
│   ├── supabase.client.ts
│   ├── supabase.mapper.ts
│   ├── tableGateway.ts
│   └── gateways/
└── http/
    └── api-client.ts
```

تم إنشاء عقود مستقلة لكل Features المعتمدة: `auth`, `browser`, `users`, `roles`, `customers`, `orders`, `products`, `sources`, `shipments`, `couriers`, `employees`, `accounting`, `financeEntries`, `notifications`, `reports`, `siteManagement`, و`settings`.

تم تنفيذ `CurrentSupabaseOrdersGateway` و`CurrentSupabaseRolesGateway` كتطبيقين أوليين للعقود، مع:

- Mapping صريح وعدم إعادة Database Row خام.
- Pagination بحد أدنى وأقصى.
- اختيار أعمدة محددة في Orders وRoles.
- تحويل أخطاء Supabase إلى `DataGatewayError`.
- اعتماد `order_status_id` فقط.
- عدم كشف `roles.data`.
- استخدام `timestamptz` بصيغة ISO عند التحديث.

تم إنشاء Gateway implementation مستقل لكل Feature في `src/data/current-supabase/gateways/`. لا يوجد Registry عام أو طبقة orchestration إضافية؛ تبديل التنفيذ مستقبلاً يتم عبر عقد Feature نفسه فقط. مصادر الجداول الموثقة هي: `browser_pages`, `users`, `customers`, `orders`, `products`, `sources`, `shipments`, `couriers`, `employees`, `accounts`, `main_entry`, `notifications`, `report_templates`, `announcements`, و`settings`.

## ما لم ينفذ بعد

لم يتم ربط أي Page أو Component بالـGateway، ولم يتم حذف الخدمات القديمة، ولم يتم إنشاء Endpoint أو تغيير قاعدة البيانات. هذه Gateways مؤقتة لتسهيل الانتقال إلى API وليست طبقة Business Logic جديدة؛ لا تضاف إليها وظائف دائمة أو orchestration خارج العقود. الخطوة التالية داخل المرحلة نفسها هي مراجعة الأعمدة والعمليات الكتابية لكل Gateway قبل أي تفعيل، دون تجاوز المرحلة أو إدخال API مبكر.

## فحص البيئة

فحص Windows الذي استخدم `--ignoreConfig` أعاد `TS5023` لأن نسخة TypeScript المحلية لا تدعم هذا الخيار؛ النتيجة تخص الأمر فقط وليست خطأ compile مثبتاً. يجب استخدام أمر فحص متوافق مع نسخة المشروع عند نقطة التحقق التالية.
