# alx_api — API Foundation

خدمة REST مستقلة وفق `alx_api_creation_plan_ar.md`، مبنية بـTypeScript strict وExpress 5 وDrizzle ORM وPostgreSQL. المسارات تحت `/api/v1` وتستخدم غلاف الاستجابة الموحد وZod validation وRequest IDs وHelmet وCORS allowlist وrate limits.

## الحالة الحالية

- بنية API وAuth foundation موجودة: AuthService مفصول عن HTTP، Argon2id، Ed25519 JWT، تدوير refresh tokens مع تخزين hash، Drizzle repository، وfactory موصول بالخادم عند توافر الإعدادات.
- migration `alx_api_auth_foundation_0002` أنشأت ستة جداول فارغة في `alx_api_private`، و`alx_api_auth_rls_runtime_0003` فعلت وفرضت RLS عليها، وألغت وصول `PUBLIC/anon/authenticated/service_role`، وأتاحت أقل الصلاحيات لدور `alx_api_runtime` فقط.
- `api_login_users` view تعرض أعمدة التعريف اللازمة فقط، ولا تمنح runtime قراءة `public.users.password` أو `system_pin`.
- دور runtime غير مميز ولا يتجاوز RLS؛ لا تستخدم `postgres` أو `service_role` بوصفه اتصال التطبيق. أُدرج ملف `.env` في هذا الرفع العام بطلب المستخدم؛ لذلك تُعد كلمة مرور runtime ومفتاح JWT فيه مكشوفين ويجب تدويرهما فوراً، ولا يعاد استخدامهما في الإنتاج. احتفظ بالأسرار التشغيلية لاحقاً في مدير أسرار خاص، لا في Git.
- `GET /api/v1/health/ready` يتحقق من صلاحيات قراءة الجداول والـview المطلوبة، إضافة إلى إعداد Auth. عدم وجود إعداد اتصال أو مفاتيح صحيحة يبقي الخدمة غير جاهزة.
- لم تُقرأ أو تُنقل كلمات مرور/PIN القديمة. جدول `user_credentials` ما زال فارغاً؛ لذلك لا يمكن للمستخدمين الحاليين تسجيل الدخول عبر API حتى اعتماد وتنفيذ ترحيل credentials منفصل وآمن.
- `password_reset_tokens` و`auth_events` مفعّل عليهما RLS ولا يملك runtime وصولاً إليهما حتى تنفيذ ميزات وسياسات مخصصة.
- أمان بقية `public` خارج هذه migration؛ لم تُعدّل RLS/Grants على الجداول القديمة.

## التشغيل المحلي

```bash
npm ci
npm run check
npm test
npm run build
npm run dev
```

يقرأ Node 22 ملف `.env` المحلي اختيارياً. يجب أن يستخدم `DATABASE_URL` دور `alx_api_runtime` عبر pooler؛ في التطوير `DATABASE_SSL_MODE=require` يشفّر الاتصال دون تحقق CA، أما الإنتاج فيُلزم `DATABASE_SSL_MODE=verify-full` و`DATABASE_SSL_CA_PEM` الرسمية. لا تستخدم بيانات مالك قاعدة البيانات كاتصال runtime. المنافذ الافتراضية محلية على `127.0.0.1:3001`.

## مسارات Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

تظل استجابات Auth موحدة ومحدودة الرسائل؛ التنفيذ لا يعدّ جاهزاً للإنتاج قبل ترحيل بيانات الاعتماد، اختبار integration على PostgreSQL، ومراجعة إصدار مفاتيح JWT وعمليات التشغيل.
