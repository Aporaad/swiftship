# تقرير استئناف تنفيذ `alx_api`

**وقت الفحص:** 2026-10-04 06:36 (+03:00)
**المستودع:** `Aporaad/swiftship`، الفرع `main`، أحدث نقطة أساس مطابقة لـ`origin/main`: `57e8b4456f2d817f4cdd489b3905c27576aea3d1`
**قاعدة البيانات المتصلة:** Supabase project `ejrojwbbflzchasvgexr`
**المرجع المعتمد للتنفيذ:** `alx_api_creation_plan_ar.md`

## خلاصة التنفيذ

- نُسخت أحدث نسخة من المستودع، وتمت مراجعة سجل المهمة السابقة وخطة إنشاء API وتقرير الحالة الموجودين.
- نواة API وAuth موجودة مسبقاً: Express 5 وTypeScript strict وPostgreSQL/Drizzle، ومسارات login/refresh/logout، وArgon2id، وتوقيع Ed25519، وتدوير refresh tokens، ومستودع Drizzle، وقيود HTTP وOpenAPI أساسي.
- في هذه الجولة استُكملت أداة lint في حزمة `alx_api`: أضيف ESLint flat config وPrettier config وسكربت `lint`، وأصبح GitHub Actions يشغّل lint. صُححت الملاحظات التي كشفها lint دون تغيير سلوك المصادقة.
- أُزيل `alx_api/.env` من Git index في شجرة العمل وأصبح مستثنى بقاعدة `.gitignore` القائمة، مع الإبقاء على النسخة المحلية كما هي. **لم تُقرأ قيم الملف أو تُطبع**. هذا لا يزيل الملف من تاريخ Git المنشور ولا يدوّر أي سر.

## فحوص الشيفرة

نجحت بعد التغييرات:

- `npm run check`
- `npm run lint`
- `npm test -- --runInBand` — 10 suites و44 اختباراً ناجحاً
- `npm run build`
- فحص تنسيق ملفي إعداد ESLint/Prettier بـPrettier
- `git diff --check`

## حالة مراحل الخطة

| المرحلة | الحالة الحالية | الملاحظة |
|---|---|---|
| 0 — تثبيت المتطلبات | جزئية | التقنية وقرارات Auth الأساسية موجودة، لكن الأدوار والصلاحيات النهائية، قناة reset، CORS الرسمية، الاحتفاظ بالتدقيق وبيئات الاختبار/الإنتاج ما زالت غير محسومة. |
| 1 — Scaffold وTooling | مكتملة كأساس | أضيف lint إلى CI في هذه الجولة؛ لا تزال بعض تحسينات CI/اختبارات قاعدة البيانات غير موجودة. |
| 2 — PostgreSQL وDrizzle | جزئية متقدمة | مخطط Auth ومهاجرتان مطبقتان، لكن لا توجد قاعدة اختبار معزولة أو اختبارات repository/migration/rollback مكتملة. |
| 3 — Auth Core | جزئية | login/refresh/logout الأساسي موجود؛ كلمات الاعتماد المنقولة غير موجودة، كما ينقص إكمال أحداث Auth، وإدارة الجلسات، وتغيير/reset كلمة المرور. |
| 4 — RBAC | غير مبدوءة | لم تُبنَ جداول/خدمات/واجهات API لـRBAC أو مصفوفة الصلاحيات. |
| 5 — OpenAPI والعقود | جزئية | العقد الأساسي موجود؛ ينقص اختبار يمنع تباعد OpenAPI عن Zod/routes وتوثيق الوحدات التالية. |
| 6 — العملاء | غير مبدوءة | لا يوجد Customers module متكامل عبر API. |
| 7 — الطلبات والشحنات | غير مبدوءة داخل API | لا توجد وحدات endpoints/services/transactions متكاملة. |
| 8 — المالية والمصروفات | غير مبدوءة داخل API | يلزم تثبيت Auth/RBAC وقاموس البيانات قبل البدء. |
| 9 — الإشعارات | غير مبدوءة | لا توجد adapters/outbox/retry. |
| 10 — نقل العملاء | غير مبدوءة | النظام المحلي والموقع لم ينتقلا بالكامل إلى HTTP API. |
| 11 — Hardening والإطلاق | غير جاهزة | أسرار منشورة تاريخياً، TLS ليس `verify-full`، واختبارات الأمن والتكامل والتشغيل لم تكتمل. |

## حالة قاعدة البيانات — قراءة فقط

- سجل الهجرات يتضمن `alx_api_auth_foundation_0002` و`alx_api_auth_rls_runtime_0003`.
- جداول `alx_api_private` الستة موجودة، وRLS مفعّل عليها، وكلها فارغة وفق metadata؛ لم تُقرأ صفوف مستخدمين أو بيانات اعتماد.
- لم يُنفذ SQL أو DDL أو DML في هذه الجولة.
- أظهر Supabase Security Advisor تحذيرات قائمة خارج مخطط Auth: 50 جدولاً في `public` بلا RLS، و44 دالة `SECURITY DEFINER` متاحة لدور `anon`، بالإضافة إلى تحذيرات mutable `search_path`. لم أغيّر سياسات المخطط العام لأن ذلك قد يغيّر سلوك التطبيق الحالي؛ يلزم تدقيق وصلاحية/اختبار منفصل قبل أي معالجة.
- يوجد تنبيه معلوماتي بأن `auth_events` و`password_reset_tokens` عليهما RLS دون policies؛ وهذا يتوافق مع غياب صلاحيات دور runtime الحالية لهذين الجدولين، فلا تستخدمهما الخدمة حتى اعتماد grants وسياسة وصول محددة.

## حواجز ما قبل إكمال Auth والإطلاق

1. ملف `.env` كان متعقباً في المستودع العام. أزيل من النسخة الحالية في هذه الجولة فقط؛ بقيت commits السابقة متاحة في تاريخ Git. يجب تدوير كلمة مرور `alx_api_runtime` ومفتاح JWT، ومراجعة كلمة مرور مالك قاعدة البيانات التي سبق إدراجها في المحادثة، قبل أي استخدام فعلي.
2. إزالة الأسرار من تاريخ Git تتطلب إعادة كتابة تاريخ/force-push وتنسيقاً مع clones؛ لم تُنفّذ.
3. يجب إعداد CA موثوقة لـPostgreSQL وتفعيل `DATABASE_SSL_MODE=verify-full` للإنتاج.
4. جداول الاعتمادات ما زالت فارغة؛ يلزم اعتماد سياسة نقل كلمات المرور القديمة (دون استخدام PIN ككلمة مرور)، وبيئة اختبار ونسخة احتياطية مشفرة قبل أي ترحيل.
5. تُحسم قناة password reset، أدوار/permissions النظامية، CORS، مدة حفظ Audit، وبيئات قاعدة البيانات قبل استكمال Auth/RBAC والنشر.

## القرار التنفيذي

التطبيق **ليس API مكتملاً ولا جاهزاً للإنتاج**. ما أُنجز هنا هو استكمال آمن لجزء من مرحلة Scaffold/Tooling وإيقاف إعادة تتبع ملف الأسرار في النسخة الحالية، دون تغيير قاعدة البيانات. الخطوة التالية وفق الأولوية هي معالجة حادثة الأسرار بموافقة صريحة على التدوير وإعادة كتابة تاريخ Git، ثم اعتماد القرارات والبيئة الاختبارية، وبعدها إكمال Auth Core قبل RBAC ووحدات الأعمال.

مراجع Supabase:
- [RLS disabled in public schema](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)
- [Public executable SECURITY DEFINER functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Mutable function search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
