# مراجعة حالة SwiftShip وخطة alx_api — 2026-10-06

## الحالة بعد تحميل آخر نسخة

تم تحديث فرع `main` من مستودع `Aporaad/swiftship` إلى commit `a0f674c`. المستودع المحلي متطابق مع `origin/main` قبل تغييرات Hardening الحالية.

المسار المعماري المعتمد هو:

```text
SwiftShip / alx_web -> Feature Gateways -> alx_api -> PostgreSQL
```

الهدف النهائي ما زال إزالة وصول الواجهات المباشر إلى Supabase/PostgreSQL وجعل `alx_api` مصدر الحقيقة للمصادقة والصلاحيات ومنطق الأعمال والمعاملات.

## ما تم تنفيذه فعلياً

| النطاق | الحالة الحالية |
|---|---|
| Scaffold وHealth وHTTP Security | منفذ |
| PostgreSQL وPool وDrizzle والمهاجرات الأساسية | منفذ |
| Auth Core وArgon2id وEd25519 وRefresh Rotation | منفذ برمجياً |
| RBAC وUsers وRoles | منفذ مع بوابات UI تدريجية |
| Customers | القراءة والكتابة والأرشفة الذرية منفذة |
| Orders وShipments وProducts | API وGateways للقراءة والكتابة خلف Feature Flags |
| Finance | القراءة والكتابة والترحيل والعكس والإبطال وقواعد الأتمتة منفذة |
| Staff/Couriers/Employees | عقود وقراءة وكتابات جزئية خلف Flags، والحذف الذري موجود في API حسب سجل المشروع |
| Notifications وOutbox | وحدة ومسارات ومهاجرات موجودة ومسجلة في composition root |
| Portal Public | التتبع والإعلانات العامة موجودان |
| Portal Auth | Repository وService ومسارات login/refresh/logout/me/password موجودة، وتحتاج تطبيق migration واختبار PostgreSQL وربط alx_web |
| Client Cutover | جزئي؛ توجد Legacy imports وfallbacks متعددة ولم يتم إعلان الإغلاق |
| Hardening | بدأ بالتقارير والخطط والتدقيق، وما زالت المعالجة التشغيلية متبقية |

## المراحل المتبقية بالترتيب

1. تطبيق migration `0013_portal_auth_private_storage.sql` على قاعدة اختبار بعد أخذ backup والتحقق من grants وRLS، ثم تشغيل PostgreSQL smoke test بحساب API runtime موثق.
2. ربط `alx_web` بمسارات Portal Auth وإزالة Supabase Auth من `PortalAuthContext` بعد نجاح الاختبار.
3. إكمال نقل Portal profile والتذاكر وطلبات العملاء وملكية الموارد.
4. تفعيل Feature Flags تدريجياً لكل عمليات الكتابة بعد smoke test ومقارنة البيانات، ثم إزالة Legacy fallback من كل وحدة بعد boundary audit.
5. مراجعة ومعالجة ثغرات SwiftShip root: يوجد حالياً 14 finding، منها 7 عالية، بينما `xlsx` لا يظهر له إصلاح مباشر متاح ويحتاج عزلاً أو استبدالاً.
6. تنفيذ backup/restore drill، واختبارات تحميل وأمان، ومراقبة production، وخطة rollback فعلية قبل الإطلاق.

## إجراءات Hardening المنفذة في هذه الدفعة

- إصلاح lint في Portal tracking schema.
- إزالة `any` من اختبار صلاحيات Finance باستخدام عقد TypeScript صريح.
- إزالة مفاتيح JWT الخاصة والعامة من التتبع الحالي في Git.
- إضافة تجاهل `**/.secrets/` و`*.pem` إلى `.gitignore`.
- إبقاء تشغيل API معتمداً على `JWT_PRIVATE_KEY_PEM` و`JWT_PUBLIC_KEY_PEM` من البيئة فقط.
- ملاحظة أمنية إلزامية: بما أن المفاتيح ظهرت في تاريخ Git السابق، يجب تدويرها في بيئة التشغيل/المستودع البعيد قبل الإنتاج. إزالة الملفات من آخر commit لا تلغي ظهورها من التاريخ السابق.

## نتائج التحقق

- `alx_api`: `check` و`lint` و`build` ناجحة؛ Jest: **20 Test Suites / 133 Tests Passed**.
- SwiftShip root: `check` و`lint` و`build` ناجحة؛ Vitest: **76 Test Files Passed، 3 Skipped، 276 Tests Passed، 8 Skipped**.
- فشل سابق في فحص الواجهة كان بسبب تمرير `--runInBand` إلى Vitest، وليس بسبب الكود؛ تمت إعادة التشغيل بالأمر الصحيح.
- `npm audit --omit=dev --audit-level=high`: **14 vulnerabilities**، منها **7 high**؛ لم يتم تشغيل `npm audit fix` تلقائياً لتجنب تغييرات غير مراجعة.
- لم يتم تنفيذ SQL أو DDL أو DML جديد على قاعدة البيانات في هذه الدفعة.


## تحديث متابعة التنفيذ — [2026-10-06T23:10:08+03:00]

### الحالة المؤكدة

- بدأ الاستئناف على `Aporaad/swiftship` عند `fda074c`، و`alx_web` عند `0dab367`.
- migration `0013_portal_auth_private_storage` ونسخة التصحيح ظاهرتان في سجل قاعدة Supabase كمطبقتين؛ الجداول الخاصة موجودة وRLS مفعّل. لم ينفذ هذا التحديث أي كتابة جديدة إلى قاعدة البيانات.
- حُسنت معاملات `PortalAuthRepository` لاستخدام اتصال PostgreSQL واحد للمعاملة، مع إبطال refresh-token family عند إعادة الاستخدام، وإبطال الجلسة عند logout.
- أصبح عقد OpenAPI صالحاً للتحليل بعد دمج مفاتيح `orders` و`shipments` و`products` المتكررة؛ يتضمن الآن نقاط Portal Auth السبع (register/login/refresh/logout/me/profile/password). تحقق parser من **46 path** و**57 operation**، وكل `operationId` ومراجع schemas محلولة.
- التحقق البرمجي: alx_api: `check` و`build` و`lint` ناجحة، **22 suites / 139 tests passed**. alx_web: `check` و`build` ناجحة، **7 tests passed**، وPortal boundary audit ناجح.

### ما لم يُغلق بعد — لا تفعّل أعلام التسجيل/الملف الشخصي

- مسار Portal registration في API ينشئ هوية Portal وبيانات اعتمادها فقط، ولا ينشئ بعد كيان العميل/المندوب/المصدر والحساب المالي كما يفعل المسار القديم في `PortalAuthContext`. لذلك يبقى `VITE_PORTAL_REGISTRATION_API_ENABLED` غير مفعّل حتى اكتمال provisioning وربطه بمعاملة domain.
- تحديث Portal profile في API لا يثبت بعد مزامنة كل الحقول مع كيان العميل/المندوب/المصدر، لذا لا يُفعّل `VITE_PORTAL_PROFILE_API_ENABLED` قبل استكمالها واختبارها.
- لم يُجر smoke/integration test بحساب `alx_api_runtime` على PostgreSQL اختبارية معزولة. لا تستخدم قاعدة الإنتاج لإنشاء حسابات اختبارية؛ جهز staging مستقل، ثم اختبر صلاحيات grants/RLS، التسجيل والاعتماد، login/refresh/replay/logout، profile وتزامن الكيانات.
- تبقى ملكية الموارد وتذاكر الدعم وطلبات العملاء ومراحل نقل الموقع ثم Hardening/الإطلاق حسب ترتيب المرحلة 10 و11 في الخطة.
