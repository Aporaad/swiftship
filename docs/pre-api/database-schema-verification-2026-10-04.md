# مقارنة `DATABASE_SCHEMA.md` مع Supabase — 2026-10-04

**النطاق:** Metadata للمخطط فقط؛ لا صفوف مستخدمين ولا أسرار. جرى الفحص باستخدام موصل Supabase للقراءة فقط، ثم أضيف مخطط Auth خاص مؤقتاً وتراجعنا عنه بعد تحذير RLS.

## النتيجة العامة

- أظهر الفحص **51 جدولاً** في `public`.
- لم تُجرَ أي تعديلات على الجداول العامة أو بياناتها في هذه المراجعة.
- توجد فروق موثقة بين الجداول الحية ونسخة `DATABASE_SCHEMA.md`؛ الملف مفيد كمرجع تأسيسي لكنه ليس snapshot مطابقاً للمخطط الحي.
- حُذفت الجداول المؤقتة الستة من `alx_api_private` بعد التحقق أنها فارغة، كما هو موضح في `alx_api/docs/auth-database-foundation-deferred.md`.

## فروق مؤكدة في الجداول المستخدمة أو المهمة لـAPI

| الجدول | فرق ظاهر في التقرير الحي مقارنة بالتوثيق |
|---|---|
| `users` | الأعمدة الحية تشمل `user_id`, `role`, `username`, `email`, `disabled`, `full_name`, `password`, `system_pin`, `is_root` وحقول ارتباط/تدقيق؛ لم يثبت وجود uniqueness لـ`username` أو `email` في ملخص الفحص. لا تُقرأ حقول كلمة المرور/PIN لأغراض هذا التقرير. |
| `roles` | المفتاح الحي `role_id`، مع `permissions` كـ`jsonb` وحقول `code/title/description`. |
| `sessions` | يستخدم `session_id` نصياً، و`user_id`, `force_logout`, `expires_at`؛ هذا يختلف عن بنية جلسات API ذات refresh-token rotation المقترحة. |
| `customers` | توجد حقول typed إضافية حية مثل `acquisition_source`, `address`, `body_details`, `location`, `onboarding_completed`, `preferred_categories`. |
| `shipments` | أسماء الحقول الحية تشمل `content_category_name`; التقرير التوثيقي لديه `created_by_name` و`shipping_category_name` غير ظاهرين في metadata. |
| `orders_history` | الحقل الحي `account_trans_count` يقابل التوثيق `account_transaction_count`. |
| `main_entry` | الحقل الحي `notes` (جمع)؛ يحتوي أيضاً `attachments`, `created_by_uid`, `is_automatic`, `reverses_entry_id`, `updated_by_uid`. |
| `jobs_req` | الاختلاف بين `job_req_id` / `jobs_req_id` مع أعمدة typed/data إضافية؛ يلزم حسم الاسم canonical قبل repository. |
| `order_option` | المفتاح الحي `order_option_id` مقابل `option_id` في التوثيق. |
| `items_category` | أسماء الجدول الحية (`items_category_id`, `name_ar`, `name_en`, `is_active` وغيرها) تختلف عن الحقول الموثقة مثل `category_id`, `category_name_ar`, `is_allowed`. |

كما ظهرت اختلافات/أعمدة إضافية في `browser_pages`, `notifications`, `portal_tickets`, `portal_users`, `report_templates`, `salary_history`, `user_settings`, `whatsapp_logs`, `order_status`, `auto_entries`, `entry_type`, `entry_payment_details`, و`cust_details`، مع جداول migration maps لا يحتوي التقرير التوثيقي لها تعريفاً تفصيلياً.

## القيود والقرارات

- لم تُجرَ إصلاحات تلقائية على أي فرق؛ يجب اعتماد canonical model وmigration لكل domain على حدة.
- لم تُفحص محتويات `users.password` أو `users.system_pin` أو أي قيم PII.
- لم تُنفذ تغييرات RLS/Grants. ظهرت تنبيهات قائمة في النظام لهذه السياسات، وتظل خارج النطاق المؤجل حسب توجيه المستخدم.
- قبل استخدام `DATABASE_SCHEMA.md` لتوليد repositories أو migrations يجب تحديثه من snapshot حيّ مع مراجعة PK/FK/indexes/nullability؛ لا يجوز افتراض أن أسماء الأعمدة القديمة ما زالت صحيحة.


## تحديث Auth بعد تنفيذ migration 0002 — 2026-10-04 03:35–03:40 +03:00

أُعيد فحص metadata لمشروع `ejrojwbbflzchasvgexr` بعد موافقة DDL. لم تتغير `public.users`, `public.roles`, `public.sessions`: `users.user_id` نصي وهو المفتاح المرتبط؛ metadata تعرض role/username/email/disabled وحقلي password/system_pin كنصوص دون قراءة قيمهما. أنشأت migration `alx_api_auth_foundation_0002` schema `alx_api_private` والجداول الستة الموثقة في `alx_api/src/db/migrations/0002_auth_private_storage.sql`؛ كل جدول فارغ وتوجد المفاتيح والقيود والفهارس المقصودة.

RLS معطل على الجداول الستة. قراءة الامتيازات أعادت false لـschema USAGE وtable SELECT لدى `anon`, `authenticated`, `service_role`، لكن Supabase Advisor أبلغ تنبيهاً حرجاً لغياب RLS واعتبر الجداول مكشوفة. لا تُعد هذه النتائج إثباتاً أمنياً متفقاً عليه؛ لا يربط API بهذه الجداول قبل حسم التحذير. لم تُغير RLS أو GRANTS، ولم تُنقل credentials. نصوص استعلامات metadata مسجلة في `db_commends.md`.


## تحديث مخطط Auth المحمي — [2026-10-04T04:38:37+03:00]

migration `alx_api_auth_rls_runtime_0003` طبقت على المشروع المرتبط بعد موافقة DDL. أكدت `list_tables` وجود الجداول الستة وعدد الصفوف 0 وRLS=true. فحص catalog أكد `relforcerowsecurity=true` لكل منها. أزيلت امتيازات anon/authenticated/service_role على schema usage والجداول، وأزيلت grants الافتراضية المقصودة في schema `alx_api_private`; الدور `alx_api_runtime` وحده لديه USAGE. لا يوجد SELECT لـ`authenticated` على جداول Auth الآن.

توجد `api_login_users` view بأعمدة `user_id, username, email, role, disabled` فقط. لا يملك runtime صلاحية SELECT مباشرة على `public.users`، ولا يقرأ `password` أو `system_pin`. دور runtime لا يملك `superuser`, `createdb`, `createrole`, أو `BYPASSRLS`; الصلاحيات الممنوحة مقتصرة على `user_credentials` (SELECT)، و`user_security/api_sessions/api_refresh_tokens` (SELECT/INSERT/UPDATE). لا grants أو policies للدور على `password_reset_tokens/auth_events` حتى تنفيذ endpoints.

هذه migration لا تغير أي table أو RLS/Grant في `public`؛ تحذيرات Advisor القديمة عن الجداول/functions العامة خارج هذا النطاق ما زالت منفصلة وتحتاج خطة معالجة مستقلة. ما زالت جداول Auth فارغة؛ لم تُنقل credentials. أوامر SQL وتوقيتها محفوظة في `db_commends.md`.
