# Data Quality Snapshot حي — المشروع الأصلي

**وقت القراءة:** 2026-10-03T02:58:01Z  
**Supabase project:** `ejrojwbbflzchasvgexr`  
**حالة المشروع:** `ACTIVE_HEALTHY`  
**Commit الكود:** `62b3209`  
**نطاق القراءة:** public schema فقط، بدون SQL تغييري أو Migration أو تعديل RLS/Grants.

> هذا التقرير قراءة مباشرة من قاعدة البيانات الأصلية، وليس staging. لم يتم تعديل أي سجل.

## ملخص المؤشرات

| المجال | المؤشر | القيمة | الخطورة | المالك / الإجراء |
|---|---|---:|---|---|
| Referential integrity | orders بدون customer صالح | 0 | Pass | API/Data owner |
| Referential integrity | order_items بدون order صالح | 0 | Pass | API/Data owner |
| Referential integrity | shipments بدون order صالح | 0 | Pass | API/Data owner |
| Referential integrity | accounts بدون currency صالح | 0 | Pass | Finance owner |
| Referential integrity | main_entry بدون order صالح | 0 | Pass | Finance owner |
| Referential integrity | account_trans بدون main_entry صالح | 0 | Pass | Finance owner |
| Identifiers | orders المكررة في order_number | 0 | Pass | Orders owner |
| Orders | إجمالي orders | 5 | Info | Orders owner |
| Users | إجمالي users | 11 | Info | Auth owner |
| Sessions | sessions بدون user صالح | 0 | Pass | Auth owner |
| Sessions | sessions منتهية | 0 | Pass | Auth owner |
| Sessions | sessions بدون expires_at | 2 | High | Auth owner؛ تحديد سياسة انتهاء الجلسة |
| Users | users مع password مخزن في public.users | 11 | Blocker | Security/Auth؛ عدم إعلان الإنتاج قبل إزالة/حماية الحقل |
| Users | users مع system_pin مخزن | 9 | Blocker | Security/Auth؛ عدم كشفه عبر أي API |
| Portal users | portal_users مع password column value | 0 | Pass | Portal/Auth owner |
| Finance | main_entry غير متوازن | 5 | Blocker | Finance owner؛ مراجعة القيود قبل API مالي إنتاجي |
| Finance | accounts برصيد سالب | 2 | High | Finance owner؛ مراجعة أرصدة وسيناريو العملة |
| Finance | accounts بدون اسم | 1 | Medium | Finance owner؛ استكمال بيانات الحساب |
| Auth | users معطلون | 2 | Info | Auth owner |

## Ownership verification على البيانات الحية

| الاختبار | الإجمالي | المملوك/المطابق | غير المملوك/غير المطابق | النتيجة |
|---|---:|---:|---:|---|
| session → users.user_id | 2 | 2 | 0 | Pass |
| orders.created_by → users.user_id | 5 | 0 | 5 | Fail / legacy data |
| orders.updated_by → users.user_id | 5 | 0 | 5 | Fail / legacy data |
| main_entry.created_by_uid → users.user_id | 19 | 18 | 1 | Fail / legacy data |
| account_trans.created_by_uid → users.user_id | 39 | 37 | 2 | Fail / legacy data |
| activity_logs.user_id → users.user_id | 43 | 43 | 0 | Pass |

أضيف إلى API Foundation تحقق ownership مرتبطاً بـ`users.linked_type` و`users.linked_entity`: Admin يتجاوز فحص الملكية التنظيمية، بينما Customer/Courier/Employee لا يحصل على سجل خارج الكيان المرتبط. المستخدم الذي لا يملك ربطاً واضحاً لا يُعتبر مالكاً. أضيفت اختبارات unit لهذا السلوك.

## مخاطر أمنية ظاهرة في الموصل

نتيجة مخطط Supabase نفسها تفيد بأن RLS معطل على **50 جدولاً عاماً**، بما فيها users وsessions وorders وfinancial tables وportal tables. هذا خارج نطاق التنفيذ بناءً على طلب المستخدم، ولم يتم تفعيل RLS تلقائياً حتى لا يؤدي ذلك إلى حجب الوصول دون سياسات صحيحة. لكن هذا **مخطر أمني حرج**: يجب منع عملاء المتصفح من الاتصال المباشر بقاعدة البيانات عند تشغيل API، ثم اعتماد سياسات RLS/Grants في دفعة مستقلة.

## قرار جودة البيانات

لا توجد مشكلة FK أو duplicate identifier في المؤشرات التي تم فحصها، لكن وجود passwords وsystem pins في `public.users`، وخمسة قيود غير متوازنة، وغياب `expires_at` لجلسات، وفشل ownership التاريخي لعدة حقول `created_by` يمنع إعلان **جاهزية إنتاجية كاملة** حتى تتم معالجة هذه البنود أو قبولها رسمياً مع خطة remediation قابلة للتدقيق.

## الاستعلامات المنفذة

تم تنفيذ قراءات `SELECT` فقط عبر Supabase MCP على المشروع الأصلي. لم تُنفذ DDL أو DML أو `apply_migration`، ولم تتغير قاعدة البيانات.
