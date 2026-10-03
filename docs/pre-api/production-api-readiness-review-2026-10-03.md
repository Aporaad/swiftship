# تقرير مراجعة جاهزية API الإنتاجية — 2026-10-03

## 1. المصدر والنسخة

- المستودع: `Aporaad/swiftship`
- الفرع: `main`
- آخر commit قبل هذه الدفعة: `fb5aaa9 add production api readiness execution plan`
- نطاق المراجعة: النظام الأساسي فقط.
- خارج النطاق: `alx_web`، RLS، Grants، وأي تغيير SQL أو Migration.

## 2. ما تم تنفيذه

### A — Auth / Session / Response Contract

- تصحيح verifier الجلسة لاستخدام المفاتيح الفعلية `sessions.session_id` و`users.user_id` بدلاً من افتراض `id`.
- رفض الجلسة عند `force_logout` أو `expires_at` المنتهي.
- إضافة `SuccessEnvelope<T>` و`successEnvelope` لتوحيد كل قراءات API الحالية.
- إبقاء error envelope مع `requestId` ورسالة آمنة.
- إضافة اختبار contract للـsuccess envelope.

### C — HTTP Client

- إضافة `credentials: include` افتراضياً.
- إرسال `x-request-id` لكل طلب.
- إضافة timeout افتراضي 10 ثوانٍ قابل للضبط.
- إضافة retry محدود للقراءات `GET` فقط؛ لا توجد واجهة كتابة تسمح بإعادة محاولة غير آمنة.
- الحفاظ على parsing لعقد الخطأ وعدم تمرير body غير JSON للمستخدم.

### A3 — Permission Matrix

- إضافة `docs/pre-api/api-permission-matrix.md` بمسارات القراءة الحالية، الصلاحيات، DTOs، وحدود ownership.

### F/G — Verification / Rollback Evidence

- `npm ci --no-audit --no-fund`: ناجح.
- `npm run check`: ناجح.
- اختبارات API/HTTP المستهدفة: **2 ملفات، 8 اختبارات ناجحة**.
- الاختبارات الكاملة: **73 ملفاً ناجحاً، 3 متخطاة؛ 259 اختباراً ناجحاً، 8 متخطاة**.
- `npm run build`: ناجح؛ بقيت تحذيرات حجم chunk و`import.meta` في CJS، وهي تحذيرات قائمة غير حاجبة.
- `git diff --check`: ناجح.

## 3. فجوات لم تُغلق ولا يجوز إخفاؤها

1. لا توجد بيئة staging/API مشتركة معزولة مثبتة؛ لذلك لم تُنفذ Smoke/E2E حقيقية ولا Data Quality Snapshot حي.
2. المسارات الحالية قراءة فقط؛ مسارات Portal والكتابات وidempotency/audit/ownership التفصيلي تحتاج دفعة مستقلة وبيانات اختبار معتمدة.
3. لا تزال طبقة Supabase Adapter انتقالية داخل النظام؛ لم يتم حذفها أو نقل كل Feature إلى HTTP.
4. AsyncState و`any` لم يُثبت إغلاقهما على كامل النظام، رغم نجاح check والاختبارات الحالية.
5. RLS وGrants مستثناة صراحةً، ولم تُفحص أو تُعدل.
6. لا يوجد تغيير قاعدة بيانات في هذه الدفعة؛ لا يمكن استنتاج جودة البيانات من المستودع وحده.

## 4. قرار الجاهزية

**القرار: النظام اجتاز دفعة إصلاح API Foundation وعقود Auth/Session الأساسية، لكنه غير مؤهل بعد لإعلان الجاهزية الإنتاجية الكاملة أو بدء تنفيذ `alx_api` الإنتاجي.**

السبب المتبقي ليس فشل الكود المحلي، بل غياب البوابات الخارجية المطلوبة: staging معزولة، ownership على بيانات حقيقية، Data Quality Snapshot، وSmoke/E2E. استثناء RLS/Grants محفوظ ومذكور كمخاطرة انتقالية، ولا يغير هذا القرار.

## 5. Rollback

- قبل التغيير: `fb5aaa9`.
- بعد التغيير: يُثبت في commit الدفعة عند اعتمادها.
- تعطيل HTTP client: عدم تفعيل `ApiClient`/إبقاء المستهلك على Gateway الحالي.
- تعطيل المسارات: عدم تسجيل `registerApiFoundationRoutes` أو إيقافها خلف readiness flag قبل النشر.
- لا توجد Migrations أو تغييرات SQL يمكن التراجع عنها.


## تحديث حي — 2026-10-03T02:58:01Z — AI Model: Manus

تم تجاوز شرط staging بناءً على طلب المستخدم وتنفيذ Data Quality Snapshot مباشرة على المشروع الأصلي `ejrojwbbflzchasvgexr`. تم تنفيذ قراءات Supabase فقط، بدون Migration أو DDL/DML أو تعديل RLS/Grants.

النتيجة: سلامة المفاتيح الأجنبية الأساسية والـduplicate order numbers سليمة في المؤشرات المفحوصة، لكن ظهرت blockers فعلية: 11 مستخدماً لديهم قيمة password في `public.users`، و9 لديهم `system_pin`، و5 قيود مالية غير متوازنة، و2 جلسة بلا `expires_at`، وحقلَا `created_by` للطلبات لا يطابقان أي user في 5/5 سجلات، إضافة إلى عدم تطابق سجل واحد في main_entry وسجلين في account_trans. كما ظهر من مخطط Supabase أن RLS معطل على 50 جدولاً عاماً؛ هذا مستثنى من الخطة ولم يتم تغييره.

تم تطبيق ownership enforcement في `server/routes/api-foundation.ts` اعتماداً على `linked_type` و`linked_entity`، مع اختبارات للمالك الصحيح والخاطئ والدور الإداري. لكن اختبار ownership على البيانات الحية لا ينجح بالكامل بسبب البيانات التاريخية أعلاه.

تم حفظ التفاصيل الكاملة في `docs/pre-api/data-quality-snapshot-2026-10-03.md`. لذلك يبقى القرار: **غير جاهز للإعلان الإنتاجي الكامل** إلى أن تُعالج blockers أو تُقبل رسمياً بخطة remediation موثقة. كما أن نقل جميع مستهلكي `alx_web` إلى HTTP لم يكتمل؛ ما زالت صفحات متعددة تستخدم `legacy-portal`، ولا يجوز ادعاء اكتماله.

## نتائج التحقق النهائي — 2026-10-03T02:59:21Z

- النظام: `npm run check` ناجح.
- النظام: 73 ملف اختبار ناجح، 3 متخطاة؛ 260 اختباراً ناجحاً، 8 متخطاة.
- `alx_web`: `npm ci` ناجح، `npm run audit:portal-boundary` ناجح، و`npm run build` ناجح.
- التدقيق النصي في SwiftShip ما زال يرصد 89 استيراداً من `legacy-adapter`، و7 استخدامات Supabase مباشرة داخل حدود `src/data`/`server/routes`، و34 موضع `any`، و26 ملفاً يستخدم `AsyncState`.
- التدقيق النصي في `alx_web` ما زال يرصد صفحات تستخدم `legacy-portal`؛ نجاح boundary script الحالي لا يساوي اكتمال النقل إلى HTTP، لأنه يسمح بحد التوافق الحالي.

بناءً على ذلك، اختبارات البناء ناجحة، لكن بوابة الجاهزية النهائية تفشل في ownership الحي، Data Quality blockers، ونقل كل المستهلكين إلى HTTP/إغلاق any وAsyncState. لا يوجد أساس مهني لإعلان الجاهزية الإنتاجية الكاملة الآن.
