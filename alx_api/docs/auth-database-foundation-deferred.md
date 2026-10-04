# مخطط Auth المؤجل — 2026-10-04

## نتيجة التنفيذ الحي

- طُبقت هجرة إضافية باسم `alx_api_auth_foundation_0001` على مشروع Supabase المرتبط، لإنشاء `alx_api_private` وستة جداول فارغة: `user_credentials`, `user_security`, `api_sessions`, `api_refresh_tokens`, `password_reset_tokens`, `auth_events`.
- أظهر فحص metadata أن كل الجداول الستة كانت **صفر صفوف** وأن RLS معطل عليها. أصدر Supabase تحذيراً بأنها مكشوفة لأدوار `anon` و`authenticated` في غياب RLS.
- وافق المستخدم على rollback. نُفذ `DROP SCHEMA IF EXISTS alx_api_private CASCADE;` بنجاح، ثم أعاد فحص schema قائمة فارغة.
- لم تُقرأ أو تُحدّث صفوف `public.users` ولم يتغير أي شيء في `RLS` أو `Grants` أو الجداول العامة.

## الحالة الحالية

- لا يوجد مخطط `alx_api_private` منشور في قاعدة البيانات.
- لا يوجد ملف SQL تنفيذي داخل `alx_api/migrations`; أزيل لمنع تطبيقه لاحقاً عرضاً.
- يحتفظ `src/db/schema.ts` بتعريف Drizzle محلي مقترح، وأضيف `DrizzleAuthRepository` و`createAuthUseCases` كتنفيذ برمجي غير موصول؛ لا تنشئ الاتصال أو تستخدم هذه الجداول في runtime قبل إقرار حماية مناسبة وتطبيق migration معتمد.
- Health check يستطيع اختبار اتصال PostgreSQL عند تزويد `DATABASE_URL`، لكن Auth routes تظل `503 AUTH_NOT_CONFIGURED` ما لم تُحقن use cases كاملة ومتصلة بقاعدة البيانات.
- بيانات `public.users.password` و`system_pin` غير مهاجرة هنا، ولم تُقرأ. لا تستخدم المقارنة بكلمة مرور plain text في API الجديدة.

## متطلبات الاستئناف

1. اعتماد سياسات أمان الجداول الجديدة وعدم كشف مخططها عبر Supabase Data API.
2. تصميم مهاجرة كلمات المرور من الأعمدة القديمة إلى Argon2id من دون عرض الأسرار أو تسجيلها، وخطة تعافٍ/إعادة تعيين.
3. اختبار Repository على قاعدة اختبار معتمدة ثم وصله إلى `AuthUseCases` بعد اعتماد المخطط وتوفير `DATABASE_URL` آمن.


## تحديث بعد اعتماد migration 0002 — 2026-10-04 03:39 +03:00

> الأقسام أعلاه تسجل نتيجة الجولة السابقة (rollback) وكانت صحيحة وقتها. بعد موافقة المستخدم اللاحقة أُنشئ المخطط من جديد بهجرة مستقلة؛ لا تُحذف هذه الملاحظة التاريخية.

- نُفذت `alx_api_auth_foundation_0002` على مشروع Supabase المتصل `ejrojwbbflzchasvgexr`؛ أنشأت `alx_api_private` والجداول الستة: `user_credentials`, `user_security`, `api_sessions`, `api_refresh_tokens`, `password_reset_tokens`, `auth_events`.
- أكدت قراءة metadata وجود كل جدول، صفر صفوف، PKs وFKs والقيود والفهارس، وسُجلت migration في قائمة migrations.
- لم تنقل الهجرة أي password/PIN ولم تغيّر `public.users` أو أي جدول عام. لم يتغير RLS أو GRANTS حسب اختيار المستخدم.
- فحص الامتيازات بعد التطبيق أعاد عدم وجود `USAGE` للمخطط أو `SELECT` على الجداول لدى `anon`, `authenticated`, `service_role`. بالتوازي، أعاد Advisor تنبيهاً حرجاً بأن RLS معطل على الجداول الستة وأنها مكشوفة. يوجد تعارض يستلزم عدم تفعيل Auth أو تعريض schema عبر Supabase Data API إلى أن يُحسم أمنياً.
- يبقى `DrizzleAuthRepository` غير مختبر باتصال runtime وغير موصول في `server.ts`. لم يُوفر `DATABASE_URL` للمشروع ولم تُقرأ أي قيمة credential. تظل `/api/v1/auth/*` على 503.
- اختار المستخدم إبقاء RLS/GRANTS مؤجلة ومتابعة محلية فقط. لا يُنفذ أي تعديل DB إضافي دون موافقة جديدة.


## تحديث أمني وتنفيذي — [2026-10-04T04:38:37+03:00]

> الملاحظات السابقة تصف الحالة قبل موافقة المستخدم على RLS/Grants؛ تظل محفوظة كسجل تاريخي.

- طُبقت migration `alx_api_auth_rls_runtime_0003` بعد اعتماد DDL. تم إنشاء `alx_api_runtime` بخصائص `NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS/NOINHERIT`، ثم تفعيل login بكلمة عشوائية جديدة. لا تُسجل قيمة كلمة المرور هنا.
- فُعّل **FORCE ROW LEVEL SECURITY** على الجداول الستة، وأُزيلت صلاحيات `PUBLIC/anon/authenticated/service_role` عن المخطط والجداول؛ لا يملك دور runtime أي صلاحيات على `password_reset_tokens` و`auth_events` أو `public.users` مباشرة.
- دور runtime لديه SELECT فقط على `api_login_users` view و`user_credentials`، وSELECT/INSERT/UPDATE على `user_security`, `api_sessions`, `api_refresh_tokens`. الـview لا تعرض `password` أو `system_pin`.
- فحص مباشر من خلال اتصال runtime أكد أن الدور ليس superuser ولا يملك `BYPASSRLS`، وأنه يصل للجداول والـview اللازمة ويرفض الوصول للـreset/events و`public.users` المباشر.
- `server.ts` يوصل `AuthService` عند توافر إعداداته؛ readiness يفحص الجداول/الـview فعلياً. اختبار HTTP: readiness 200 وlogin لهوية اصطناعية غير موجودة 401 عامة. الجداول لا تزال فارغة، ولم تُنقل أي بيانات اعتماد؛ المستخدمون الحاليون لا يمكنهم المصادقة حتى تنفيذ ترحيل منفصل معتمد.
- ملف `.env` محلي بصلاحية 0600 يحوي بيانات runtime ومفاتيح محلية؛ المستخدم طلب تضمينه في push عام وأكد مخاطرة نشر الأسرار صراحةً. يبقى التدوير الفوري لكلمة مرور حساب postgres المرسلة في المحادثة موصى به.
- اتصال التطوير مشفر TLS دون تحقق CA؛ production مرفوض افتراضياً ما لم يُضبط `DATABASE_SSL_MODE=verify-full` وشهادة CA الموثوقة. لا تعتبر هذه الخدمة production-ready بعد.
