# حالة تطبيق Auth Core وRBAC على قاعدة Swiftship الحية

**التاريخ:** 2026-10-04 (+03:00)
**المشروع:** Supabase Swiftship، المشروع النشط الوحيد المُعاد من `list_projects`
**المستودع:** `Aporaad/swiftship`، `main`

## ما تم تطبيقه

- migration `alx_api_auth_core_password_events_0005_20261004` (version `20261004055451`): دوال تغيير/إعادة تعيين كلمة المرور وسجل الأحداث، مع صلاحية التنفيذ لـ`alx_api_runtime` فقط؛ يبقى مسار HTTP معطلاً بـ503 حتى تركيب قناة تسليم موثوقة.
- migration `alx_api_rbac_foundation_0006_20261004` (version `20261004055501`): جداول roles/permissions/user_roles/role_permissions، مع RLS مفعّل ومفروض ومنح قراءة محدود لدور API.
- seed `src/db/seeds/rbac_seed_2026-10-04.sql`: 152 permission صريحة، Admin=152، Employee=18، Accountant=16، Courier=2، بإجمالي 188 علاقة دور/صلاحية. Admin بلا wildcard. للأدوار الأخرى استُخدم تقاطع المصدرين كحد أدنى محافظ؛ لم تُضف صلاحيات Accountant الـ41 عالية التأثير.

## تحقق ما بعد التطبيق

- سجل migrations يحتوي 0005 و0006 بالاسمين والإصدارين أعلاه.
- أعداد الصلاحيات الفعلية بحسب الدور: `admin 152`, `employee 18`, `accountant 16`, `courier 2`؛ إجمالي catalog=152 وrole_permissions=188.
- `roles` عليه FORCE RLS، ودور API يستطيع SELECT.
- دوال 0005 SECURITY DEFINER: التنفيذ متاح لـ`alx_api_runtime`، ومرفوض لـ`anon` و`authenticated`.
- `user_credentials` يحتوي 0 صف؛ لم تُقرأ أو تُنقل أي كلمة مرور أو PIN ولم تتغير كلمات مرور `postgres` أو المالك أو `alx_api_runtime`.
- لا توجد صفوف `user_roles`: لم تُربط حسابات المستخدمين الحالية بأدوار API في هذه الجولة. يوجد في قاعدة legacy حسابات admin/employee/courier نشطة، ويلزم قرار صريح بربطها قبل صلاحيات تشغيلية للمستخدمين.

## ما لم يُنشر بعد

لم يُنشر Express API على عنوان production. مستودع API لا يحتوي Dockerfile أو إعداد نشر، وقراءة WebDev أعادت `not_attached`؛ لا توجد وجهة نشر فعالة ضمن المشروع الحالي. كما أن مزود تسليم استعادة كلمة المرور لم يُحدد، وخطة cutover للعملاء ووحدات الأعمال لم تُنفذ بعد. الخادم الجاري هو تطوير محلي فقط على `127.0.0.1:3001`.

## الحد الآمن

هذه تغييرات بنية RBAC وأدواره وصلاحياته فقط. لا يوجد bulk migration لكلمات المرور، لا استخدام PIN ككلمة مرور، ولا تغيير لأي كلمة مرور قاعدة بيانات. سجل أوامر SQL التفصيلي موجود في `db_commends.md`.
