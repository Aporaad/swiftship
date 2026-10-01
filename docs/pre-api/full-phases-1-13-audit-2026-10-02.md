# تدقيق تجميعي مستقل للمراحل 1–13 — SwiftShip

**تاريخ التقرير:** 2026-10-02  
**دور المراجعة:** مراجع رئيسي  
**منهج المراجعة:** تجميع نتائج التدقيق المستقلة والوثائق الموجودة في المستودع فقط؛ لا إعادة بحث، ولا فحص حي جديد، ولا تعديل على قاعدة البيانات.  
**قاعدة الحكم:** لا تُغلق مرحلة إذا كان بند إلزامي في الخطة غير مثبت بدليل قابل لإعادة التشغيل. وجود ملفات أو نجاح `typecheck`/`build` لا يثبت وحده التكافؤ السلوكي، أمن قاعدة البيانات، جاهزية التشغيل، أو اكتمال نقل المستهلكين.

## 1. الحكم التنفيذي

**الحالة العامة: غير جاهز للإعلان عن الجاهزية أو بدء API إنتاجية (`BLOCKED / NOT READY`).** توجد مخرجات برمجية حقيقية ومتقدمة في العقود، حدود المصادقة، تفكيك الخادم، الوظائف الخلفية، واستخراج بعض المكونات. لكن توجد بوابات إلزامية غير مثبتة أو غير مكتملة: جرد قاعدة البيانات والأمن الحي، بقاء مسارات Legacy مباشرة، عدم إثبات تغطية كل المستهلكين بالعقود الموحدة، تعارض نطاق/ترقيم المرحلة 13، وعدم وجود إثبات end-to-end وContract/Security/Financial كامل للـAPI.

هذا الحكم لا ينفي التقدم الفعلي؛ بل يفصل بين **الكود الموجود** و**الإغلاق القابل للاعتماد**. كما أن السجلات تحتوي عبارات إغلاق لاحقة تتعارض مع تدقيقات مطابقة للخطة لاحقة أو مع غياب دليل تفصيلي كافٍ؛ عند التعارض تم اعتماد الحكم المحافظ، والإبقاء على المرحلة مفتوحة.

## 2. تصنيف الأدلة

- **منفذ فعلياً:** يوجد كود/اختبار أو فحص قابل للإسناد إلى مخرج المرحلة، مع تحديد نطاقه. لا يعني ذلك أن المرحلة مغلقة إذا بقي بند آخر إلزامي.
- **موثق فقط:** توجد خطة أو جرد أو قرار أو تقرير يصف المطلوب/الحالة، من دون تنفيذ يثبت المخرج.
- **غير مثبت:** لا يوجد دليل كافٍ من الملفات على النتيجة المطلوبة، أو أن الدليل متعارض/بيئي/جزئي ولا يصلح لإثباتها.
- **مغلق قابل للاعتماد:** لا يُستخدم إلا عندما تكون مخرجات المرحلة الإلزامية المثبتة متوافقة مع نطاق الخطة، ولا توجد فجوة إلزامية معلقة في آخر تدقيق مطابق للخطة.

## 3. مصفوفة الحالة المرتبة حسب الخطة المعتمدة

| الترتيب | المرحلة ونطاقها المعتمد | منفذ فعلياً | موثق فقط | غير مثبت / قرار المراجعة | الحالة المحافظة |
|---:|---|---|---|---|---|
| 1 | **مطابقة المخطط الفعلي مع التوثيق والكود** | Baseline، خرائط الوصول، خرائط IDs، وتقارير metadata جزئية؛ قراءة metadata لاحقة رصدت 51 جدولاً وRLS على 1/51 | `baseline-report.md`، `feature-inventory.md`، `risks-register.md`، `data-access-map.md` | لا يوجد snapshot مكتمل لكل جدول يتضمن PK/FK/RLS/policies/JSONB/triggers/RPC/row counts/sensitivity؛ لا إثبات كامل لـlegacy cutover أو كل RPCs | **غير مغلقة — موثق جزئياً، البنود الإلزامية غير مثبتة** |
| 2 | **Canonical Contracts** | DTOs/Schemas/Mappers ومسارات `src/shared/contracts`؛ فصل DatabaseRow/ApiDto/ViewModel؛ primitives للتواريخ والعملات والحالات؛ اختبارات حدود متعددة | اكتمال التغطية السلوكية لكل مستهلك قديم، وGolden DTOs الشاملة لكل الكيانات | بقيت آثار legacy payloads وخرائط IDs، ولا يثبت وجود عقد موحد مستهلك فعلياً في كل Feature؛ بعض المخرجات هي جرد/تصميم | **منفذة جزئياً — لا إعلان إغلاق شامل** |
| 3 | **Data Gateway Layer** | هيكل `src/data`، عقود لكل Feature، Gateways أولية لـOrders/Roles، mapping صريح، pagination، تحويل أخطاء، منع `roles.data` | تغطية كل العمليات الكتابية، مراجعة الأعمدة النهائية، خريطة Registry/اختيار التنفيذ | لا Page/Component موصول فعلياً بالـGateway وفق التقرير؛ لم تحذف الخدمات القديمة؛ لم يبدأ HTTP API؛ لم يثبت أن كل Feature يمر بالحد | **منفذة جزئياً — غير مغلقة** |
| 4 | **Auth Boundary وRBAC/DTOs** | `CurrentUserDto` بلا أسرار، `SessionState`، `AuthGateway`، `AuthSessionProvider`، عدم استعادة مستخدم Storage، `usePermission` و`PermissionGate`، تطابق 152 permission، فحوص واختبارات وبناء ناجحة ضمن النطاق | التفويض الخادمي النهائي، API session verifier، إزالة الأسرار من كل مسارات Electron/legacy | المرحلة تثبت فصل UI/التجهيز لا Auth API إنتاجية؛ الصفحات القديمة ما زالت تستخدم شروطها؛ بقاء `users.password/system_pin` في public موثق كخطر | **مغلقة داخل نطاق الفصل وUI فقط؛ ليست بوابة أمان إنتاجية** |
| 5 | **تفكيك `server.ts`** | `server/app.ts`، jobs/routes/browser-proxy/dev-server/current-db/legacy-compat، `server.ts` أصبح orchestrator صغيراً؛ typecheck واختبارات wiring ناجحة | معالجة كل أسرار config، allowlist/timeouts للـproxy، تشغيل معزول على staging، إزالة مخاطر legacy | كلمات مرور plain-text، admin credentials ثابتة، ROOT_EMAILS ثابتة، CORS واسع؛ لم تُنقل قاعدة البيانات إلى `alx_api` | **منفذة هيكلياً — الإغلاق التشغيلي/الأمني غير مثبت** |
| 6 | **الآثار الجانبية وRealtime** | `job-runner` وعقود Input/Trigger/Preconditions/Transaction/Idempotency/Retry/Audit/Failure؛ reconciliation/tracking/custody؛ 6/6 اختبارات وبناء ناجح | إثبات كل العمليات الحساسة في بيئة بيانات معزولة، وتغطية كل side effects الخارجية | لا تغييرات RLS/DB؛ السجل لا يثبت end-to-end للتسويات والدفعات والـWhatsApp؛ بعض التشغيل قائم على legacy adapter | **منفذة فعلياً ضمن الوظائف المفحوصة؛ الإغلاق الشامل غير مثبت** |
| 7 | **تأسيس `alx_api` فعلياً** | لا يوجد scaffold مستقل كامل موثق كـ`alx_api` عامل في هذه النتائج | خطة مجلدات/modules، قواعد Controller/Repository/Domain، ومخرجات API Foundation داخل `swiftship` في بعض السجلات | لا دليل على `alx_api` production core، OpenAPI، PostgreSQL adapter، modules واختبارات مستقلة وفق الخطة؛ API Foundation داخل النظام كان نطاقاً مختلفاً ثم جرى rollback لبعضه | **غير منفذة وفق نطاق الخطة** |
| 8 | **ترتيب Endpoints الأولي** | readiness/health وبعض أساس HTTP وقراءات Customers/Couriers ظهرت في سجلات تنفيذ، لكنها ليست مستقرة كدليل نهائي بعد سجل rollback وتغير مصدر auth | جدول routes وعقود API، أولويات القراءة، وقواعد منع Orders/Accounting mutations موثقة | لا تثبيت نهائي لكل endpoints المطلوبة، ولا Contract/Security/Financial suite كاملة؛ لا دليل أن routes السابقة باقية في الشجرة الحالية بعد rollback | **موثق/منفذ جزئياً؛ غير مثبت كمرحلة مكتملة** |
| 9 | **تهيئة `alx_web`** | في المستودع المنفصل: `PortalGateway`، DTOs عامة بلا PII، عزل `legacy-supabase`، feature flag، build ناجح، ونقل `AnnouncementsPage` إلى gateway/fallback | خطة النقل التدريجي، endpoints المتوقعة، منع PII، وشروط الإبقاء المؤقت على legacy | flag معطل؛ لم تُنقل كل الصفحات؛ لم تُنشأ endpoints/server contract أو migrations؛ `alx_web` كان gitlink غير قابل للاسترجاع في تدقيق سابق؛ لا يثبت cutover | **منفذة جزئياً — غير مغلقة** |
| 10 | **إزالة تكرار المكونات** | `CurrencySelect` نُقل إلى 13 موضعاً، `MoneyDisplay` إلى 7 استخدامات متجانسة، اختبارات وcheck/build ناجحة؛ أُبقي `ConfirmModal/FormField` المركزيان دون بدائل | مرشحّات DataTable/FilterBar/Pagination/StatusBadge وغيرها وجرد التكرار | المرحلة بدأت/سجلت إغلاقاً بعد اعتبار 9 مغلقة، لكن 9 لم تثبت؛ لا توجد عقود ثلاثية لبعض المرشحين، ولا دليل أن كل التكرار الملزم عولج | **منفذة جزئياً ومشروطة ببوابة 9؛ لا إغلاق نهائي** |
| 11 | **تنظيف الأنواع والحقول** | `strict: true` وفحص strict ناجحان في checkpoint، عقود IDs/value primitives، إزالة `any` من `EditOrderModal` في آخر دفعة، ونجاحات check/tests/build | توثيق دفعات Finance/Orders وعقود الإجراءات | آخر تدقيق مطابق للخطة وجد `any` فعلياً ثم سجلت دفعة إزالته، لكن لا يوجد مسح شامل لاحق يثبت عدم بقاء `any` في Auth/Orders/Accounting وكل نطاق الخطة؛ لا إثبات Golden DTO كامل أو عدم Database Rows في UI | **قيد التنفيذ — فجوة الإغلاق غير مثبتة** |
| 12 | **توحيد الأخطاء وحالات التحميل** | عقود `ErrorEnvelope` و`AsyncState` و`runQuery/runMutation`، حدود HTTP/Supabase، وترحيل مستهلكين محددين (Orders/Finance/Admin) مع اختبارات متزايدة | عبارة إغلاق شامل في السجل، وقائمة مسارات مرحّلة | تدقيق مطابق للخطة أحصى 62 حالة محلية، ثم دفعات لاحقة قالت إن مكونات مالية أخرى بقيت؛ لا جرد/اختبار نهائي مستقل يثبت كل Query/Mutation في النظام بعد عبارة الإغلاق | **منفذة على نطاقات؛ الإغلاق الشامل غير مثبت** |
| 13 | **API Foundation/خفض اعتماد `alx_web` حسب الخطة الفعلية** | في `alx_web` بداية Portal Gateway وDTOs وflag؛ وفي `swiftship` أساس HTTP تاريخي (health/request-id/errors/routes) لكن بعضه أزيل بالـrollback | عقود API، route catalog، شروط auth/permission/audit/retry/transaction، وسجلات تنفيذ متعارضة | الخطة تشترط مخرجات `alx_web` وPublic Tracking/Portal Session وlegacy isolation وfeature flag ثم نقل reads وحماية الملكية؛ الـflag معطل، endpoints غير منشورة، ولم يثبت أول cutover end-to-end؛ لا يجوز اعتماد API Foundation المختلف كإغلاق | **غير مغلقة — منفذة جزئياً فقط** |

### ملاحظة مهمة على ترقيم النطاق

يوجد **انحراف تسمية** بين أسماء الملفات/السجلات والخطة: ملف `phase8-jobs-refactor` يصف وظائف Realtime التي تقابل متطلبات المرحلة 6 في الخطة، وملفات `phase9-large-pages` تصف صفحات النظام بينما المرحلة 9 في الخطة هي `alx_web`، وملفات `phase13-*` تخلط API Foundation داخل `swiftship` مع Portal Gateway داخل `alx_web`. لذلك لا يصح استخدام اسم الملف وحده لإعلان الإغلاق؛ المرجع هو مخرج الخطة ونطاقه.

## 4. الفصل الصريح بين التنفيذ والتوثيق وعدم الإثبات

### 4.1 منفذ فعلياً

1. فصل DTO/Mapper/Schema والعقود الأساسية، مع اختبارات حدود ناجحة في نطاقات متعددة.
2. AuthSessionProvider وSessionState وطبقة صلاحيات UI؛ لا أسرار في DTO/Storage وفق الاختبارات الموثقة.
3. تفكيك `server.ts` إلى وحدات وخدمات/jobs/routes، مع نجاح typecheck واختبارات wiring.
4. إطار الوظائف الخلفية بعناصره الثمانية، مع اختبارات idempotency/retry/failure/reconciliation/custody ضمن النطاق المفحوص.
5. استخراج `CurrencySelect` و`MoneyDisplay` بعقود ضيقة، ونقل المستهلكين المثبتين.
6. عقود الأخطاء/AsyncState وربطها بعدد متزايد من المستهلكين، لا بكل النظام المثبت.
7. بداية `PortalGateway` في `alx_web` مع DTOs عامة محدودة PII وfeature flag وعزل legacy.

### 4.2 موثق فقط

1. جرد schema/DB contract وRPC register الشامل المطلوب في المرحلة 1.
2. خريطة القطع النهائي من legacy إلى canonical، وتغطية كل الاستدعاءات المباشرة.
3. خطة `alx_api` المستقلة، OpenAPI، modules، PostgreSQL adapter، واختبارات الأمن/المال الشاملة.
4. endpoints المتوقعة وقرارات auth/permission/audit/retry/transaction قبل التنفيذ.
5. مرشحات المكونات العامة التي رفضت الاستخراج لعدم ثبوت التكافؤ الثلاثي.
6. خطط نقل بقية `alx_web` وحماية ownership قبل تفعيل HTTP flag.

### 4.3 غير مثبت

1. حالة RLS/policies/grants و`SECURITY DEFINER` الكاملة بعد كل التغييرات؛ الدليل المتاح رصد RLS على جدول واحد من 51 في قراءة سابقة، لا خطة معالجة ناجحة.
2. صحة البيانات التشغيلية: orphan orders/shipments، users بلا role، تكرار الحسابات، status غير صحيح، المبالغ السالبة، والجلسات القديمة.
3. اكتمال ربط كل Page/Component بالـGateway وعدم تمرير Database Rows أو الاستدعاء المباشر من UI.
4. اكتمال إزالة `any` وكل مستهلكي loading/error/query/mutation المحلية بعد آخر دفعات.
5. تشغيل الخادم/الموقع/الـAPI end-to-end في staging آمن مع Auth وعمليات قراءة/كتابة ممثلة.
6. Contract/Security/Financial tests المطلوبة قبل الجاهزية، خصوصاً idempotency، permission denied، PII، الترحيل المالي، والتسويات.
7. بقاء API Foundation السابق في الشجرة بعد rollback، وبالتالي لا يصح احتسابه دليلاً حياً من دون commit/path verification.

## 5. الأخطاء التقنية المشتركة المستخرجة

### أ. الخلط بين وجود الهيكل واستخدامه
إنشاء مجلدات وملفات hooks/gateways/contracts لا يثبت أن الصفحات تستخدمها. ظهر ذلك صراحة في المرحلة 3، وفي المرحلة 9 قبل تحديث لاحق، وفي عقود Async حيث بقيت حالات محلية خارج العقد.

### ب. اعتبار `check` و`build` دليلاً على اكتمال المرحلة
نجاح TypeScript والبناء يثبت قابلية ترجمة/تجميع محدودة فقط. لا يثبت السلوك، تكافؤ UI، RLS، auth الحقيقي، transaction boundary، أو التشغيل end-to-end. كما أن فحوص Linux على mount Windows أعطت timeout/`ENOTCONN`، وبعض اختبارات Supabase الخارجية بقيت متعثرة.

### ج. API/authorization ليست مجرد route
إضافة route أو request ID أو ErrorEnvelope لا تكفي. يلزم session verifier، actor خادمي، permission، ownership، DTO allowlist، audit، واختبارات الرفض. كما أن مصدر auth تغيّر بين Supabase Auth وlocal `public.sessions`; السجل السابق الملغى لا يُعد دليلاً حياً.

### د. الأمن في قاعدة البيانات خارج حدود refactor البرمجي
وجود `public.users.password/system_pin`، تعطيل RLS على 50/51 جدولاً في القراءة الموثقة، ودوال حساسة قابلة للتنفيذ من anon في سجل المخاطر، كلها بوابات مستقلة لا يغلقها DTO أو PermissionGate UI.

### هـ. المرحلية غير المنضبطة والـrollback
سجلات الإغلاق المتعاقبة تتعارض أحياناً مع تدقيق مطابق للخطة لاحقاً، ثم يحدث rollback لمخرجات خارج النطاق. لا يجوز عدّ سجل تاريخي أو عبارة إغلاق بلا path/commit واختبار حديث دليلاً على الوضع الحالي.

### و. انجراف أسماء ونطاقات المراحل
تسمية ملفات jobs/pages/API بأرقام لا تطابق دائماً أرقام الخطة أدت إلى احتساب مخرجات مرحلة مكان أخرى. يجب ربط كل بند بـ`plan stage + path + commit + test evidence`.

### ز. عدم فصل الاختبارات المحلية عن تكامل Supabase
الاختبارات المحلية نجحت في مجموعات كثيرة، لكن اختبارات Supabase الخارجية/البيئة المهيأة بقيت فاشلة أو متخطاة. يلزم تصنيفها صراحة إلى unit/contract/integration وبيئة staging آمنة، لا تسجيل المجموعة كناجحة بالكامل.

### ح. آثار مالية وRealtime تحتاج دليلاً تنفيذياً لا تعليماً فقط
تم بناء إطار جيد للـidempotency/retry/audit، لكن عمليات الدفع والقيود والعهد والحذف والتسوية تحتاج إثبات transaction/financial invariants على بيانات اختبار، لا مجرد وجود runner أو اختبار وحدة.

## 6. بوابات تمنع إعلان الجاهزية

1. **بوابة قاعدة البيانات والأمن:** إكمال snapshot حي read-only لكل الجداول والسياسات/grants/RLS/SECURITY DEFINER/search_path، ومعالجة أو قبول مخاطر `password/system_pin` وanon execution قبل أي production API.
2. **بوابة النطاق:** تثبيت canonical stage register يربط المرحلة بالمخرج والمسار والـcommit؛ لا احتساب API Foundation داخل `swiftship` بديلاً عن مخرجات `alx_web` في المرحلة 13.
3. **بوابة Gateway:** إثبات أن كل Feature الأساسي يمر عبر Gateway وأن الصفحات لا تعرف الجدول/`from()`/RPC/JSONB/Realtime، مع سجل imports قبل/بعد.
4. **بوابة الأنواع:** تنفيذ مسح نهائي متكرر لـ`strict: true` و`any` في Auth/Orders/Accounting وكل العقود الأساسية، وإثبات عدم تصدير Database Rows إلى React.
5. **بوابة Async:** إكمال جرد وترحيل كل Query/Mutation وحالات loading/error/submitting، ثم اختبار السلوك، لا الاكتفاء بالمسارات الستة أو بعبارة إغلاق.
6. **بوابة `alx_web`:** نشر endpoints server-side، تفعيل flag فقط بعد auth/ownership، نقل reads الفعلية، منع PII، وإثبات fallback/rollback.
7. **بوابة API:** Contract tests لكل route (valid/invalid/not-found/denied/pagination/serialization/error/duplicate)، وAuth/security/financial suites، واختبار start-up في staging.
8. **بوابة التشغيل:** build النظام والموقع وAPI، smoke وE2E ممثل، logs فيها requestId/actorId دون أسرار، rollback معروف، وبيئة اختبار لا تكتب إلى production.
9. **بوابة المالية:** توثيق transaction boundary وidempotency وpermissions وaudit لكل mutation في Orders/Accounting/Payments/Custody؛ ممنوع نشر CRUD مالي عام للجداول.

## 7. أولوية إصلاح عملية

### P0 — قبل أي إعلان جاهزية أو API إنتاجية

1. تجميد عبارات الإغلاق المتعارضة وإصدار سجل حالة واحد conservative حسب الخطة.
2. تنفيذ DB security snapshot read-only كامل، ثم معالجة RLS/grants/SECURITY DEFINER والأسرار وحقول password/PIN في public/Electron.
3. تثبيت مصدر auth واحد خادمي، وإلغاء أي static credentials/token/bootstrap غير مناسب للإنتاج، مع اختبار actor/session/force logout/disabled.
4. تثبيت نطاق المرحلة 13 الصحيح في `alx_web`، نشر contract server-side، واختبار portal session/public tracking وownership قبل تفعيل flag.

### P1 — لإغلاق التسلسل المعماري

5. إكمال stage register للـGateway ومراجعة imports المباشرة لكل Feature؛ وصل المستهلكين الفعليين وإزالة/عزل legacy تدريجياً.
6. تشغيل مسح نهائي strict/any/Database Rows في النطاق الكامل، ومعالجة أي نتيجة قبل إعادة إعلان المرحلة 11.
7. استكمال AsyncState/runQuery/runMutation لكل المستهلكين، مع تقرير جرد يثبت الصفر المتبقي أو استثناءات مبررة.
8. إعادة تدقيق المرحلة 9 (النظام و`alx_web` كلٌ في نطاقه الصحيح) ثم إعادة تقييم المرحلة 10 التابعة لها.

### P2 — قبل نقل الأعمال الحساسة

9. إنشاء `alx_api` scaffold فعلي مستقل وفق الخطة، مع config/validation/error/OpenAPI/tests، دون نقل Orders/Accounting أولاً.
10. بدء Customers/Couriers/Shipments read-only بعد contract/security tests، ثم Orders بحدود معاملات وآثار جانبية موثقة.
11. بناء اختبارات مالية للاتزان، العملات والتقريب، payment/custody idempotency، reverse/void، reconciliation.
12. تخفيف warnings البنيوية (`import.meta`/CJS، mixed dynamic/static adapter imports، chunks) بعد تثبيت الوظائف، وعدم اعتبارها بديلاً عن البوابات الأمنية.

## 8. قرار المراجعة النهائي

- **لا تُعلن المراحل 1، 2، 3، 5، 7، 8، 9، 10، 11، 12، 13 مغلقة على مستوى التسلسل الحالي.**
- **المرحلة 4** يمكن اعتبارها مغلقة **داخل نطاق فصل Auth/DTO/UI permission المعلن فقط**، وليس كإثبات تفويض خادمي أو جاهزية أمنية.
- **المرحلة 6** منفذة فعلياً ضمن إطار الوظائف المفحوصة، لكن إغلاق كل side effects الإنتاجية غير مثبت.
- لا يبدأ `alx_api` الإنتاجية ولا نقل العملاء قبل إغلاق P0، ثم إعادة فحص P1/P2 بالأدلة الحالية (path/commit/command/result).

> الخلاصة: SwiftShip في حالة **تقدم هندسي ملموس، لكن جاهزية غير مثبتة وبوابات حرجة مفتوحة**. القرار الصحيح هو الاستمرار في الإصلاح المرحلي والتدقيق القابل لإعادة التشغيل، لا إعلان الإغلاق بناءً على اكتمال الملفات أو نجاح البناء وحده.

## 9. مصادر التدقيق التي جُمعت دون إعادة بحث

`docs/pre-api/baseline-report.md`, `current-state.md`, `feature-inventory.md`, `feature-boundaries.md`, `data-access-map.md`, `risks-register.md`, `phase3-data-gateway.md`, `phase4-dtos.md`, `phase5-auth-session.md`, `phase6-permissions.md`, `phase7-server-split.md`, `phase8-jobs-refactor.md`, `phase8-db-readiness-2026-10-02.md`, `phase9-audit-2026-09-30.md`, `phase9-large-pages.md`, `phase10-readiness-2026-10-01.md`, `phase11-readiness-2026-10-01.md`, `phase12-errors-loading-2026-10-01.md`, `phase13-api-foundation-readiness-2026-10-01.md`, `phase13-portal-gateway-2026-10-02.md`, `api-foundation-contract-2026-10-01.md`، والخطة `خطة إصلاح هيكل النظام وتجهيزه لإنشاء .md`.

## 6. إصلاحات ما بعد التدقيق — 2026-10-02 02:42 +0300 — AI Model: Manus
بناءً على الأخطاء التقنية القابلة للإصلاح التي أثبتها التدقيق، تم تنفيذ إصلاحات محددة دون تغيير قاعدة البيانات:

- إصلاح `server/app.ts`: استخدام `baseUrl + path` عند تركيب middleware تحت `/api/*` مع الحفاظ على توافق الاختبارات المباشرة؛ أصبحت health وbrowser-proxy مستثناة فعلياً عند عدم جاهزية قاعدة البيانات.
- إضافة اختبارات mounted-path في `server/app.test.ts`.
- إصلاح `server/routes/tracking.ts`: عدم إعادة `{ ok: true }` عندما تفشل `syncActiveOrders` بعد retries؛ يعاد HTTP 502 برسالة آمنة وعدد المحاولات.
- إصلاح `server/jobs/account-reconciliation.ts`: التقاط أخطاء ونتيجة reconciliation داخل callback المؤجل بدلاً من ترك Promise rejection غير مراقب.
- إصلاح سباق idempotency داخل العملية في `server/jobs/job-runner.ts` عبر `inFlightJobs`؛ التنفيذ الثاني ينتظر نتيجة الأول. ما زالت durability عبر عدة عمليات/خوادم تتطلب transaction أو unique claim في قاعدة البيانات ولم تُنفذ في هذه الدفعة.
- إضافة اختبار concurrency لمفتاح idempotency في `server/jobs/jobs.test.ts`.

التحقق بعد الإصلاحات: `npm run check` ناجح، الاختبارات 68 ملفاً ناجحاً و243 اختباراً ناجحاً و8 متخطاة، `npm run build` ناجح، و`git diff --check` ناجح. تحذيرات Vite الخاصة بحجم chunk وesbuild الخاصة بـ`import.meta` في CJS بقيت تحذيرات غير مانعة.

الحكم لم يتغير: النظام ليس خالياً من كل الفجوات المعمارية/الأمنية، ولا يصح إعلان جاهزية API إنتاجية؛ الفجوات المتبقية موثقة في أقسام المراحل وبـbacklog ذي أولوية.

## 7. دفعة إغلاق P0/P1 — 2026-10-02 02:56 +0300 — AI Model: Manus
- أزيل تضمين `.env` من حزمة Electron.
- أزيلت بيانات اعتماد الخادم الثابتة، وأصبح bootstrap يعتمد على متغيرات بيئية مطلوبة.
- أزيلت كتابة `password/systemPin` الافتراضيين عند إنشاء مستخدم النظام.
- أصبحت كلمات المرور الجديدة `bcrypt password_hash`، والسجلات القديمة النصية تُرفض حتى ترحيلها بشكل آمن.
- حُمي مسار تغيير كلمة المرور بجلسة وصلاحية إدارية خادمية.
- أُجبرت Table Gateways على allowlist أعمدة صريحة، مع اختبار contract يمنع allowlist الفارغة.
- التحقق: check والاختبارات ناجحان؛ 69 ملف اختبار، 244 اختباراً ناجحاً، 8 متخطاة، وdiff-check ناجح.
- ما زال snapshot حي لقاعدة البيانات وmigration السجلات القديمة وRLS/grants بحاجة إلى بيئة قاعدة بيانات معتمدة؛ لم يتم اختلاق نتيجة أو تنفيذ SQL دون اتصال.
