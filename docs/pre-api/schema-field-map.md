# Schema Field Map — القرارات المعتمدة قبل Canonical DTOs

**التاريخ:** 2026-09-28
**المشروع:** `ejrojwbbflzchasvgexr`
**PostgreSQL:** 17.6.1
**الحالة:** تم تحديث الخريطة وفق القرارات المعتمدة وتطبيق Migration بنجاح؛ بدأت مواءمة Canonical Contracts.

## 1. القرارات الملزمة

1. جميع حقول التاريخ في قاعدة البيانات تستخدم `timestamptz` فقط.
2. أي قيمة تاريخ قديمة من نوع `bigint` تحول من Epoch milliseconds باستخدام `to_timestamp(value / 1000.0)`.
3. يمنع استخدام `bigint` لأي `created_at` أو `updated_at` أو `last_seen` مستقبلاً.
4. المصدر المعتمد لحالة الطلب هو `orders.order_status_id`. يبقى `order_status1` توافقياً مؤقتاً ولا يستخدم في كود جديد.
5. جدول `roles` لا يحتفظ بـ`data`؛ تنقل بياناته إلى حقول صريحة موحدة:
   - `role_id text`
   - `title text`
   - `is_default boolean`
   - `permissions jsonb`
   - `created_at timestamptz`
   - `updated_at timestamptz`
   - `created_by text`
   - `updated_by text`
6. تتم إزالة تكرار عناصر `permissions` أثناء النقل.
7. كل جدول في `public` يجب أن يحتوي على:
   - `created_at timestamptz`
   - `updated_at timestamptz`
   - `created_by text`
   - `updated_by text`
8. `data jsonb` لا يخرج إلى DTO، ويزال من `roles` فقط في هذه Migration. إزالة `data` من جداول أخرى تحتاج جرداً مستقلاً.

## 2. تحويلات التاريخ المطلوبة

| الجدول | الحقول القديمة | التحويل |
|---|---|---|
| `users` | `created_at`, `updated_at`, `last_seen` bigint | Epoch milliseconds إلى `timestamptz` |
| `cust_details` | `created_at`, `updated_at` bigint | Epoch milliseconds إلى `timestamptz` |
| `items_category` | `created_at`, `updated_at` bigint | Epoch milliseconds إلى `timestamptz` |
| `order_option` | `created_at`, `updated_at` bigint | Epoch milliseconds إلى `timestamptz` |
| أي جدول آخر | أي حقل تاريخ bigint يكتشف لاحقاً | يجب رفضه وإضافته إلى Migration منفصلة قبل API |

## 3. ملاحظات التدقيق

الأعمدة الموجودة مسبقاً تبقى مع أنواعها الموحدة، والأعمدة الناقصة تضاف كـ`text` للفاعل و`timestamptz` للزمن. يتم ملء `created_at` و`updated_at` المضافة للسجلات الحالية بقيم آمنة (`now()` و`created_at`) عند عدم وجود قيمة تاريخية. تبقى أعمدة التدقيق قابلة لـNULL للبيانات التاريخية، ولا يفرض `NOT NULL` قبل مراجعة كل مسارات الإدخال.

`report_templates.created_by` يتحول من `uuid` إلى `text` بعد إسقاط FK إلى `auth.users` حتى يتوافق مع نموذج الهوية الموحد؛ يجب أن تعيد API ربطه بهوية التطبيق وليس بصف `auth.users` مباشرة.

## 4. حالة التنفيذ

Migration المطبقة:
`supabase/migrations/20260928080000_standardize_audit_timestamps_and_roles.sql`

تم تطبيقها بنجاح. تم حذف `roles.data` بعد استخراج `title` و`is_default` و`permissions`، والتحقق من وجود حقول التدقيق الأربعة في جميع جداول `public`.
