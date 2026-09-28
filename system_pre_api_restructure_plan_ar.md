# تحليل المشروع وخطة تهيئته قبل إنشاء `alx_api`

**الإصدار:** 2.1 — إعادة صياغة محافظة على الهيكل الأصلي

**تاريخ المراجعة:** 2026-09-28

**الحالة:** تحليل وخطة تنفيذية جاهزة للبدء، مع تعديل الفروقات الضرورية فقط

**النطاق:** النظام المحلي الموجود في جذر `SWIFTSHIP_SYSTEM`، وموقع العملاء `alx_web`، وقاعدة PostgreSQL الحالية عبر Supabase

**القيود:** هذه الوثيقة لا تنفذ تعديلات برمجية أو SQL أو Migrations؛ وهي مبنية على الحالة الفعلية الحالية بعد تغييرات النظام وقاعدة Supabase.

---

## 1. الملخص التنفيذي

المشروع الحالي لا يحتاج إلى إضافة API فوق الوضع الحالي مباشرة. قبل إنشاء `alx_api` يجب إصلاح حدود النظام، وتثبيت عقود البيانات، وفصل العرض عن الوصول إلى البيانات، وإزالة اعتماد الواجهات على Supabase، وتحديد مصادر الحقيقة لكل كيان.

الوضع الحالي يجمع أربع مسؤوليات مختلفة داخل نفس التطبيق:

1. واجهات React للعرض والتفاعل.
2. منطق الأعمال الخاص بالطلبات والمالية والإشعارات.
3. محول تخزين يحاكي واجهات Firebase ويترجم بين أسماء حقول متعددة.
4. خادم Express يشغل الواجهة، ويهيئ المصادقة، ويشغل مستمعات Realtime، وينفذ عمليات مالية وخدمات Proxy.

هذا الدمج يجعل إنشاء API جديد فوق الكود الحالي خطراً؛ لأن API ستكرر منطقاً موجوداً في الصفحات والمحول والخادم، وقد تنتج سلوكاً مختلفاً عن سلوك النظام الحالي.

الهدف الصحيح هو تنفيذ **مرحلة تهيئة مسبقة للـ API** داخل النظام والموقع. في هذه المرحلة لا ننقل قاعدة البيانات إلى `alx_api` بعد، ولا نغير مخطط PostgreSQL. بدلاً من ذلك، ننشئ حدوداً داخلية ثابتة تجعل نقل الاتصال لاحقاً عملية استبدال طبقة واحدة بدلاً من إعادة كتابة كل الصفحات.

المسار المقترح هو:

```text
الوضع الحالي
React Pages -> Supabase/Firebase-like Adapter -> PostgreSQL

مرحلة التهيئة
React Pages -> Feature Services -> Data Gateway Contract -> Current Supabase Adapter -> PostgreSQL

بعد إنشاء alx_api
React Pages -> API Client -> alx_api -> Repository/Drizzle/pg -> PostgreSQL
```

خلال المرحلة الانتقالية يجب أن يكون `Data Gateway Contract` هو الحد الفاصل. في البداية ينفذ بواسطة Adapter مؤقت يتصل بـ Supabase، ثم يستبدل لاحقاً بـ HTTP Client يتصل بـ `alx_api`.

---

## 2. النطاق الذي تم فحصه

### 2.1 النظام المحلي

الفحص شمل البنية العليا والملفات الأساسية، ومنها:

- `package.json`.
- `server.ts`.
- `src/lib/supabase.ts`.
- `src/lib/supabase-adapter.ts`.
- `src/types.ts`.
- `src/pages`.
- `src/components`.
- `src/services`.
- `DATABASE_SCHEMA.md`.
- `security_spec.md`.
- `SYSTEM_DOCUMENTATION2.md`.
- `db_commends.md` و`DBdevloping_history.md` و`devloping_history.md`.
- ملفات `supabase/migrations` و`server` والاختبارات.

### 2.2 الموقع

تم التحقق من وجود `alx_web` كمشروع مستقل داخل المجلد المحلي، وقراءة:

- `alx_web/package.json`.
- `alx_web/src/App.tsx`.
- بنية `alx_web/src` التي تحتوي على `components` و`context` و`layouts` و`lib` و`pages` و`styles` و`types`.
- ملفات إعداد قاعدة البيانات الخاصة بالموقع.

يحتاج الموقع إلى فحص تفصيلي لصفحة وصفحة في مرحلة الجرد التنفيذية، لكن وجود `@supabase/supabase-js` في `package.json` يؤكد أنه عميل قاعدة بيانات مستقل حالياً وليس مجرد واجهة تنتظر API.

### 2.3 قاعدة البيانات

تم استخدام موصل Supabase في وضع القراءة فقط لاكتشاف المشروع والمخطط.

- المشروع النشط: `ejrojwbbflzchasvgexr`.
- PostgreSQL: الإصدار 17.6.1.
- الحالة: `ACTIVE_HEALTHY`.
- توجد مهاجرات فعلية حتى 2026-09-27 تضمنت تغييرات جوهرية في المفاتيح والعلاقات والمحاسبة والطلبات والبوابة.
- المخطط الحالي يجمع أعمدة canonical علائقية مع `data jsonb` متبقياً في كيانات توافقية.
- معظم الجداول التي تمت قراءتها تظهر `rls_enabled: false`، مع سياسات موجودة على بعض الجداول دون حماية فعلية عند تعطيل RLS.
- تم توحيد عدد مهم من المفاتيح إلى أسماء entity-specific مثل `user_id` و`customer_id` و`order_id` و`account_id` و`portal_user_id`.
- توجد RPCs مالية وعمليات ذرية جديدة وعلاقات Foreign Keys محدثة، لكن التطبيق والمحول لا يزالان يحملان توافقاً مع الأسماء القديمة.

---

## 3. صورة الوضع الحالي

## 3.1 النظام المحلي

`package.json` يبين أن النظام هو تطبيق React/Vite مع Electron وخادم Express مدمج. الخادم الحالي يشغل من خلال:

```text
npm run dev     -> tsx watch server.ts
npm run build   -> vite build
npm run build:server -> esbuild server.ts
npm run start   -> node dist/server.cjs
```

كما أن تبعيات النظام تشمل `@supabase/supabase-js` و`bcryptjs` و`express`، بينما لا توجد طبقة API مستقلة بتعريفات Routes/Controllers/Repositories.

يوجد داخل الجذر مجلد باسم `alx_api`، لكنه لا يمثل بعد مشروع API مكتمل وفق البنية التي تم اعتمادها سابقاً. يجب اعتباره مساحة محجوزة أو نقطة بدء، وليس دليلاً على وجود فصل معماري حقيقي.

## 3.2 طبقة Supabase الحالية

`src/lib/supabase.ts` يعيد تصدير كل شيء من:

```text
src/lib/supabase-adapter.ts
```

وهذا يعني أن الاسم البسيط `supabase` يخفي محولاً أكبر بكثير من عميل قاعدة بيانات.

المحول الحالي مسؤول عن:

- إنشاء Supabase Client.
- قراءة متغيرات البيئة من بيئة الخادم والواجهة.
- استخدام قيم Placeholder إذا فشلت التهيئة.
- تخزين الجلسة في `sessionStorage`.
- إدارة `loggedInUser` و`authListeners`.
- توفير API بأسماء Firebase-like مثل `getAuth` و`onAuthStateChanged`.
- تخزين Cache للـ Collections في الذاكرة.
- قراءة Cache من المتصفح.
- التحديث اللحظي عبر Realtime.
- تحويل `snake_case` إلى `camelCase` والعكس.
- دمج أعمدة الجدول مع `data` JSONB.
- إنشاء Aliases كثيرة للحقول.
- إثراء الطلبات بالأصناف والشحنات.
- تنفيذ عمليات القراءة والكتابة والحذف.

هذا الملف ليس Adapter صغيراً، بل يجمع:

```text
Database Client
+ Compatibility Layer
+ Data Mapper
+ Cache
+ Realtime Layer
+ Session Layer
+ Firebase-like API
+ Domain Enrichment
```

لذلك فإن أي صفحة تستورده تكون مرتبطة بكل هذه المسؤوليات بصورة غير مباشرة.

## 3.3 الخادم الحالي

`server.ts` يبلغ حجماً كبيراً ويجمع وظائف لا يجب أن تبقى في Process واحد على المدى الطويل. من خلال الجزء المقروء يظهر أنه:

- يهيئ Express.
- يستورد Adapter بأسماء Firebase-like.
- يهيئ Supabase Adapter Admin Mock.
- يهيئ قاعدة البيانات والمصادقة داخل المحول.
- يستخدم بريد وكلمة مرور إدارية ثابتين في المصدر.
- يحاول إنشاء الحساب الإداري تلقائياً عند بدء الخادم.
- يزرع بيانات المستخدم الإداري في قاعدة البيانات.
- ينشئ مستمعات Realtime.
- يعيد احتساب أرصدة الحسابات.
- ينفذ التسوية الآلية للعهد.
- يكتب Activity Logs.
- يشغل API Routes داخل نفس الخادم.
- يشغل Browser Proxy مع CORS واسع.
- يخدم Vite والملفات الثابتة.

هذا يجعل `server.ts` نقطة تجميع للبنية التحتية ومنطق الأعمال وعمليات التطوير والتوافق القديم.

## 3.4 الواجهات والمكونات

الواجهة الرئيسية تحتوي على صفحات ومكونات كبيرة جداً. أمثلة على أحجام ملحوظة في الفحص:

- `Orders.tsx` كبير جداً ويتجاوز مئات آلاف الأحرف.
- `FinanceAccounting.tsx` كبير جداً.
- `UserManagement.tsx` كبير جداً.
- `Layout.tsx` كبير ومركزي.
- صفحات `Customers` و`Couriers` و`Expenses` و`Reports` و`Settings` تحمل مسؤوليات متعددة.
- توجد ملفات `.bak` داخل `src/components` و`src/pages` و`src/services`.

وجود صفحات بهذه الأحجام لا يعني أن الحل هو تقسيمها عشوائياً. يجب أولاً تحديد حالة الصفحة، وعملياتها، ونماذجها، ومكونات العرض المشتركة، ثم تقسيمها حسب Feature.

## 3.5 الخدمات الحالية

يوجد تحسن واضح مقارنة بوضع تكون فيه كل العمليات داخل الصفحات؛ فهناك Services للطلبات والتاريخ والمالية والعملات والإشعارات. لكن هذه الخدمات ما زالت جزءاً من تطبيق الواجهة، وليست طبقة API أو Domain مستقلة.

المشكلة الأساسية هي أن بعض الخدمات:

- تستورد طبقة Supabase مباشرة.
- تنفذ قرارات أعمال وتخزيناً في الملف نفسه.
- لا تفصل بين Input DTO وDatabase Row.
- لا توفر عقوداً موحدة للأخطاء والنتائج.
- تعتمد على أسماء تاريخية متعددة للحقول.
- قد تنفذ عمليات متعددة من دون Transaction حقيقية على مستوى قاعدة البيانات.

## 3.6 الموقع `alx_web`

الموقع مشروع React/Vite مستقل، ويحتوي على `@supabase/supabase-js` كاعتماد مباشر. هذا يعني أن الموقع يتعامل مع قاعدة البيانات من طرف العميل أو يملك طبقة Supabase خاصة به.

هذا خطر معماري لأن الموقع قد يطبق قواعد مختلفة عن النظام المحلي، وقد يقرأ حقولاً لا يجب أن تظهر للعميل، كما أن أي تغيير في قاعدة البيانات يحتاج تعديلين أو أكثر.

يجب أن يصبح الموقع مستهلكاً لعقود API فقط، مع إبقاء عمليات عامة مثل Public Tracking خلف Endpoint عام محدود البيانات.

---

## 4. تحليل قاعدة البيانات الحالية

## 4.1 الملاحظات المؤكدة

قاعدة البيانات تحتوي على بنية مختلطة بين تصميم علائقي وتصميم Document/JSONB:

```text
أعمدة علائقية واضحة
+ data jsonb
+ أسماء قديمة وجديدة
+ أنواع تواريخ متعددة
+ علاقات Foreign Keys جزئية
```

أمثلة مؤكدة من المخطط الفعلي:

- `orders` يعتمد حالياً على `order_id` و`order_number` و`tracking_number` وعلاقات الأطراف، مع دعم `order_party` وسجل `orders_history`، وقد بقي `data jsonb` في بعض مسارات التوافق.
- `customers` يحتوي على `customer_id` و`account_id` و`is_active` و`data jsonb`.
- `couriers` يحتوي على أعمدة أساسية و`data jsonb`.
- `shipments` يحتوي على حقول تشغيلية متعددة و`data jsonb`.
- `users` يحتوي على `password` و`system_pin` كنصوص، وهو خطر يجب عزله قبل بناء Auth جديد.
- `sessions` موجود لكنه بسيط، ويحتوي على `force_logout` وبيانات مستخدم مكررة.
- `roles` يعتمد على `data jsonb` فقط تقريباً، بينما يرتبط `users.role` به كنص.
- `activity_logs` يحتوي على `data jsonb` بالإضافة إلى أعمدة مباشرة.
- الجداول المالية الحالية تتمحور حول `main_entry` و`account_trans` وتفاصيل الدفع والعهد والإجراءات الذرية، مع ضرورة عزل أي مراجع legacy قبل نقل المالية.
- `report_templates` لديه علاقة إلى `auth.users`، وهذا يمثل اعتماداً على Supabase Auth يجب اعتباره انتقالياً وممنوعاً داخل التصميم المستقبلي.

## 4.2 مشكلة RLS

نتيجة قراءة المخطط تبين أن معظم الجداول المهمة تظهر:

```text
rls_enabled: false
```

هذا لا يعني أن API الجديدة يجب أن تعتمد على RLS كآلية الصلاحيات الأساسية، لأن القرار المعتمد هو وضع الأمن داخل `alx_api`. لكنه يعني أن الوضع الحالي لا يوفر شبكة حماية إضافية إذا وصل عميل مباشرة إلى Supabase.

خطة التهيئة يجب أن تمنع العملاء من الوصول المباشر إلى Supabase أولاً، ثم تعالج صلاحيات قاعدة البيانات في مرحلة فصل API. لا يتم تشغيل أو تعديل RLS الآن ضمن هذه المهمة، لكن يجب تسجيله كمخاطر انتقالية.

## 4.3 ازدواجية الهوية والمصادقة

المخطط الحالي يحتوي على:

- `public.users`.
- `public.portal_users`.
- `public.sessions`.
- `auth.users` في علاقة واحدة على الأقل.
- محاكاة Auth داخل `supabase-adapter.ts`.
- حقول `password` و`system_pin` داخل `public.users`.

هذا لا يصلح كأساس مباشر لنظام المصادقة الداخلي الجديد. يجب ألا يبدأ `alx_api` باستخدام هذه الحقول كأنها Auth نهائية.

## 4.4 ازدواجية أسماء المعرفات

تظهر أسماء معرفات مختلفة حسب الجدول والحقبة، مثل:

```text
user_id
account_id
customer_id
order_id
shipment_id
portal_user_id
activity_log_id
```

هذا بحد ذاته ليس خطأ، لكن التوثيق والمحول يضيفان Aliases تجعل الكود يتعامل أحياناً مع:

```text
id
orderId
order_id
orderNumber
```

قبل إنشاء API يجب تثبيت اسم API موحد، مع إبقاء تحويل أسماء قاعدة البيانات داخل Adapter أو Repository فقط.

التحديث الضروري بعد تغييرات 2026-09-27:

- لا يفترض Repository أو DTO وجود `id` عام؛ تستخدم طبقة API أسماء دلالية مثل `orderId` و`customerId` و`accountId`، ويظل التحويل إلى أسماء PostgreSQL داخل Mapper واحد.
- لا يكون `data jsonb` مصدراً لحقول الهوية أو المبالغ أو العلاقات أو الحالات الأساسية.
- تعتمد العمليات المالية الجديدة على `main_entry` و`account_trans` والإجراءات الذرية الموثقة، ولا يعاد إدخال `journal_entries` أو `account_transactions` إذا لم تكن موجودة فعلياً.
- تدخل `order_party` و`orders_history` و`returned_products` و`portal_user_migration_map` في Data Access Map وSide Effects Map.

## 4.5 التواريخ

المخطط يستخدم في بعض الجداول `timestamptz`، بينما `users` يحتوي على `bigint` للحقول الزمنية، وبعض أنواع الواجهة تستخدم `number`.

التصميم المستهدف:

- PostgreSQL: `timestamptz`.
- API JSON: ISO 8601 UTC strings.
- Frontend state: `Date` أو string typed، وليس Epoch مختلطاً بلا عقد.
- Migration خاصة للتواريخ لا تنفذ قبل جرد جميع الاستخدامات.

## 4.6 المال والعملات

المشروع يحتوي على حسابات وعملات وحركات ومصاريف وقيود وتسويات. وجود `numeric` في قاعدة البيانات جيد، لكن الواجهة تستخدم `number` وحقولاً مشتقة كثيرة.

قبل نقل هذه العمليات إلى API يجب تعريف:

- Precision وScale لكل مبلغ.
- العملة الأصلية وعملة الحساب.
- سعر التحويل ومصدره.
- طريقة التقريب.
- معنى `balance` المخزن مقابل الرصيد المحسوب.
- ما الذي يمثل قيداً مرحلاً أو ملغى أو عكسياً.
- حدود Transaction لكل عملية مالية.

لا يجب أن تبدأ إعادة هيكلة المالية بتغيير الجداول. يجب أولاً استخراج قواعد السلوك الحالية واختبارها.

---

## 5. المشاكل الجذرية التي يجب إصلاحها قبل API

### 5.0 تحديث المخاطر بعد آخر فحص

تضاف إلى الأولويات الأصلية، دون تغيير ترتيب مراحل الخطة: استمرار الوصول المباشر من العملاء إلى Supabase مع RLS غير مفعل على جداول عامة، وإمكانية تنفيذ بعض دوال `SECURITY DEFINER` الحساسة بواسطة `anon`، ووجود `search_path` غير ثابت في دوال، واحتمال تضمين `.env` ضمن حزمة Electron. هذه البنود تسجل كـ Blockers انتقالية وتنفذ لاحقاً عبر Migrations منفصلة ومراجعة، لا ضمن إعادة الهيكلة نفسها. كما يجب تسجيل اختلاف المفاتيح entity-specific عن توقعات المحول القديم ونقص/تكرار بعض الفهارس ضمن High حتى يثبت تقرير الاستخدام خلاف ذلك.

### 5.1 لا يوجد حد اتصال موحد

الصفحات والخدمات والموقع يستطيعون استيراد Supabase أو Adapter مباشرة. لذلك لا توجد نقطة واحدة يمكن استبدالها بـ API Client.

### 5.2 الواجهة تعرف مخطط قاعدة البيانات

بعض الصفحات تعرف أسماء Collections والجداول وعمليات CRUD وRealtime. هذا يجعل الواجهة عميل قاعدة بيانات وليس عميل تطبيق.

### 5.3 الخادم يعيد تنفيذ منطقاً داخل محولات قديمة

`server.ts` يستخدم واجهات Firebase-like رغم أن الهدف هو Supabase حالياً ثم API PostgreSQL مستقلة لاحقاً. هذا يطيل عمر التوافق القديم بدلاً من إزالة التعقيد.

### 5.4 نماذج البيانات غير قانونية

`src/types.ts` صغير مقارنة بعدد الكيانات الفعلية. كما أن `any` وحقول JSONB وAliases تعني أن TypeScript لا يفرض نموذجاً ثابتاً.

### 5.5 الملفات الكبيرة تخفي العلاقات

الصفحات الكبيرة تجمع:

- state.
- dialogs.
- forms.
- queries.
- mutations.
- permissions.
- notifications.
- print/export.
- business rules.

هذا يجعل نقلها إلى API صعباً لأن حدود الوظائف غير واضحة.

### 5.6 بيانات حساسة في النموذج الحالي

وجود `password` و`system_pin` في `public.users`، ووجود بيانات اعتماد إدارية ثابتة داخل `server.ts`، يمثلان أولوية أمنية. لا يجوز ترحيل هذه الطريقة إلى API.

### 5.7 Realtime يستخدم كبديل عن Domain Events

الخادم يستمع إلى تغييرات الحسابات وينفذ التسويات وإعادة احتساب الرصيد. هذا قد يسبب:

- تكرار التنفيذ.
- سباقات بين تغييرات متزامنة.
- غياب Idempotency.
- صعوبة معرفة المستخدم الذي بدأ العملية.
- صعوبة الاختبار وإعادة المحاولة.

يجب تحويل عمليات الأعمال المهمة إلى Services وTransactions صريحة، ثم استخدام Outbox/Events لاحقاً عند الحاجة.

### 5.8 عدم وجود عقد API

لا يوجد حالياً:

- Versioned API contract.
- Response envelope موحد.
- Error code catalog.
- Pagination contract.
- DTOs مستقلة عن Database Rows.
- OpenAPI لكل Feature.

---

## 6. الهدف المعماري قبل إنشاء API

يجب الوصول إلى هذه البنية أولاً:

```text
alx_system
  -> feature hooks
  -> feature application services
  -> shared client contract
  -> current Supabase gateway
  -> PostgreSQL

alx_web
  -> portal feature services
  -> shared client contract
  -> current Supabase gateway أو HTTP compatibility adapter
  -> PostgreSQL
```

والحد المطلوب داخل العميلين:

```text
Presentation
  -> Application/Feature Layer
  -> Contract Layer
  -> Data Gateway
  -> Temporary Supabase Implementation
```

لاحقاً يصبح:

```text
Presentation
  -> Application/Feature Layer
  -> Contract Layer
  -> HTTP API Client
  -> alx_api
```

### 6.1 ما يجب أن يختفي من صفحات React

- `createClient`.
- أسماء الجداول.
- `from('table')`.
- استدعاءات Realtime المباشرة.
- `collection` و`doc` و`getDocs` و`updateDoc`.
- معرفة الأعمدة الداخلية.
- معرفة شكل `data` JSONB.
- اتخاذ قرار الصلاحية النهائي.

### 6.2 ما يبقى في الواجهة

- Form state.
- View state.
- Loading/Empty/Error states.
- تحويل استجابة API إلى View Model عند الحاجة.
- إخفاء عناصر الواجهة حسب Permissions المرسلة من API، مع بقاء التحقق النهائي في الخادم.
- Cache للعرض فقط، وليس مصدراً لحقيقة مالية أو أمنية.

---

## 7. خطة التهيئة المرحلية

## المرحلة 0: تجميد النطاق وإنشاء Baseline

### الهدف

منع استمرار إضافة وظائف جديدة إلى البنية القديمة أثناء إعادة التنظيم.

### الأعمال

1. أخذ نسخة Git أو Tag للحالة الحالية دون تعديل بيانات الإنتاج.
2. تسجيل نتيجة `typecheck` و`test` و`build` الحالية.
3. إنشاء سجل Modules الحالي.
4. تحديد الملفات التي ستظل Legacy مؤقتاً.
5. منع استخدام ملفات `.bak` كمرجع تشغيل.
6. اعتماد قاعدة: لا Feature جديدة تضيف Supabase import إلى صفحة جديدة.

### المخرجات

- Baseline report.
- Feature inventory.
- قائمة المخاطر.
- قائمة الملفات legacy.
- خطة تسمية موحدة.

### معيار الإنجاز

يمكن مقارنة كل مرحلة لاحقة بالحالة الأصلية دون الحاجة إلى تخمين ما تغير.

---

## المرحلة 1: جرد كامل للنظام والموقع

لا يكفي جرد أسماء الملفات. يجب بناء مصفوفة تربط كل صفحة بالبيانات والعمليات.

### حقول المصفوفة

| الحقل | الوصف |
|---|---|
| Feature | الطلبات، العملاء، المالية، الشحنات، إلخ |
| Client | النظام المحلي أو الموقع |
| Page | الصفحة الرئيسية |
| Components | المكونات المستخدمة |
| Services | الخدمات المستوردة |
| Tables | الجداول التي تصل إليها حالياً |
| Operations | قراءة، إنشاء، تعديل، حذف، Realtime |
| Auth requirement | المتطلب الحالي |
| Permission | الصلاحية المستهدفة |
| Side effects | إشعار، سجل، مالية، واتساب |
| Transaction need | هل العملية متعددة الكتابات؟ |
| API endpoint candidate | المسار المستهدف لاحقاً |
| Migration risk | منخفض، متوسط، مرتفع |

### ترتيب الجرد

1. Auth وUsers.
2. Customers وPortal Users.
3. Orders وOrder Items.
4. Shipments وTracking.
5. Couriers وEmployees.
6. Accounting وExpenses.
7. Notifications وAnnouncements.
8. Reports وSettings.
9. Browser Proxy والتكاملات الخارجية.

### معيار الإنجاز

كل عملية كتابة حالية يجب أن تكون معروفة: من أين تبدأ، ما الجداول التي تغيرها، وما الآثار الجانبية التي تنفذها.

---

## المرحلة 2: تحديد حدود Features

يتم تحويل البنية من صفحات عامة إلى Features:

```text
src/features/
├── auth/
├── users/
├── roles/
├── customers/
├── orders/
├── shipments/
├── couriers/
├── employees/
├── accounting/
├── expenses/
├── notifications/
├── reports/
└── settings/
```

كل Feature يحتوي مبدئياً على:

```text
feature/
├── components/
├── hooks/
├── services/
├── schemas/
├── types.ts
├── api.ts
└── index.ts
```

لا يتم نقل كل الملفات دفعة واحدة. تبدأ عملية النقل بأقل Feature خطراً لإثبات النمط، ثم العملاء، ثم الطلبات، ثم المالية.

### قاعدة الفصل

- `components`: عرض فقط.
- `hooks`: تنسيق حالة الواجهة واستدعاء Application Services.
- `services`: عمليات Feature على مستوى العميل، لا SQL.
- `api.ts`: عقد استدعاء Gateway.
- `schemas`: تحقق من Response/Input.
- `types.ts`: أنواع Feature وDTOs.

---

## المرحلة 3: بناء طبقة Data Gateway مؤقتة

هذه أهم مرحلة للتهيئة قبل API.

### التصميم

```text
src/data/
├── contracts/
│   ├── auth.gateway.ts
│   ├── users.gateway.ts
│   ├── customers.gateway.ts
│   ├── orders.gateway.ts
│   ├── shipments.gateway.ts
│   └── accounting.gateway.ts
├── current-supabase/
│   ├── supabase.client.ts
│   ├── supabase.mapper.ts
│   └── gateways/
└── http/
    └── api-client.ts
```

مثال مفهومي:

```text
OrdersGateway
  listOrders(input)
  getOrder(id)
  createOrder(input)
  updateOrder(id, input)
  changeOrderStatus(id, input)
```

في البداية تنفذ هذه الواجهة بواسطة:

```text
CurrentSupabaseOrdersGateway
```

لاحقاً تنفذ بواسطة:

```text
HttpOrdersGateway
```

ولا يتغير كود صفحة الطلبات أو مكونات الطلبات عند تبديل التنفيذ.

### قواعد Gateway

- لا يعيد Database Row خاماً.
- لا يكشف `data jsonb` للواجهة.
- لا ينشئ Aliases عامة لكل شيء.
- يطبق Mapping في مكان واحد.
- يحول أخطاء Supabase إلى App Errors موحدة.
- يفرض Pagination.
- يحدد الحقول المسموح بها.
- يعزل Realtime خلف Subscription Contract.

---

## المرحلة 4: تثبيت نموذج البيانات والـ DTOs

### 4.1 الفرق بين الأنواع

يجب فصل:

```text
DatabaseRow
ApiDto
CreateInput
UpdateInput
ViewModel
```

لا تستخدم نفس Interface لكل هذه الأغراض.

### 4.2 نموذج أولي للطلب

يجب اعتماد شكل قانوني مثل:

```text
OrderDto
  id
  orderNumber
  trackingNumber
  customerId
  status
  sourceId
  deliveryCourierId
  shippingCourierId
  orderParty
  createdAt
  updatedAt
```

أما أسماء مثل:

```text
order_status1
order_status_id
status
orderStatus
```

فتبقى في Mapper داخلي إلى أن يتم حسم المخطط النهائي في API.

### 4.3 التحقق

كل Input يحتاج Zod أو Schema مكافئ داخل العميل مؤقتاً، حتى لا تنتقل مدخلات غير صحيحة إلى API لاحقاً.

التحقق في الواجهة لتحسين التجربة، لكنه لا يغني عن تحقق API.

### 4.4 التواريخ

القرار المقترح قبل API:

```text
Database: timestamptz
Gateway boundary: ISO 8601 UTC string
View model: Date أو string typed حسب الاستخدام
```

يجب منع خلط Epoch milliseconds وISO strings داخل نفس Feature.

### 4.5 المبالغ

حتى لو استخدمت الواجهة `number` للعرض، يجب أن يحدد DTO:

- المبلغ.
- العملة.
- سعر التحويل عند الحاجة.
- الدقة.
- ما إذا كان المبلغ أصلياً أو محولاً.

---

## المرحلة 5: فصل المصادقة الحالية تمهيداً لـ Auth الجديد

لا يتم بناء Auth الجديد في هذه المهمة، لكن يجب تجهيز النظام له.

### الأعمال

1. إيقاف أي اعتماد جديد على `auth.currentUser` القادم من Adapter.
2. إنشاء `AuthSessionProvider` مستقل داخل الواجهة.
3. جعل Provider يتعامل مع `AuthGateway` وليس مع Supabase.
4. تعريف `CurrentUserDto` مستقل.
5. تعريف `SessionState`:
   - `loading`.
   - `authenticated`.
   - `unauthenticated`.
   - `expired`.
   - `locked`.
6. إيقاف حفظ بيانات المستخدم الحساسة في Storage.
7. عدم حفظ `password` أو `systemPin` في الواجهة.
8. عدم افتراض أن وجود User object يعني أن الجلسة موثقة.
9. دعم `refresh` و`logout` كعمليات مستقبلية من خلال Gateway.

### الشكل المستهدف

```text
AuthProvider
  -> AuthGateway
       -> Current Supabase compatibility implementation
       -> Future HTTP API implementation
```

حتى لا تضطر كل صفحة إلى إعادة كتابة المصادقة عند إنشاء `alx_api`.

---

## المرحلة 6: توحيد الصلاحيات داخل الواجهة دون اعتبارها مصدراً نهائياً

يجب تعريف صلاحيات الواجهة كأسماء ثابتة:

```text
orders.read
orders.create
orders.update
orders.change_status
shipments.read
accounting.read
accounting.post
users.manage
roles.manage
```

ثم استخدام:

```text
can(permission)
```

بدلاً من شروط منتشرة مثل:

```text
user.role === 'Admin'
user.isRoot === true
user.role !== 'Employee'
```

هذه الخطوة لا تجعل الواجهة آمنة وحدها، لكنها تمنع اختلاف تجربة المستخدم وتجعلها جاهزة لقراءة Permissions من `alx_api`.

يجب الاحتفاظ بفحص API النهائي دائماً.

---

## المرحلة 7: تفكيك `server.ts`

قبل إنشاء `alx_api`، لا ينبغي الاستمرار في توسيع `server.ts`.

### التقسيم المستهدف مؤقتاً داخل النظام

```text
server/
├── app.ts
├── routes/
├── current-db/
│   ├── client.ts
│   └── repositories/
├── jobs/
│   ├── account-reconciliation.ts
│   └── custody-settlement.ts
├── browser-proxy/
├── dev-server.ts
└── legacy-compat.ts
```

### الترتيب

1. استخراج Health وAPI middleware.
2. استخراج Browser Proxy.
3. استخراج Vite serving.
4. استخراج Realtime listeners.
5. استخراج التسويات المالية إلى Jobs/Services.
6. وضع Adapter القديم في ملف Legacy واضح.
7. منع استيراد Firebase-like API في ملفات جديدة.

### ملاحظة مهمة

هذا التفكيك لا يحول `server.ts` إلى `alx_api`. هو فقط يقلل نقاط التداخل حتى لا يتم نقل منطق غير مفهوم إلى API الجديدة.

---

## المرحلة 8: إصلاح خدمة Realtime والعمليات الخلفية

### الوضع الحالي

الخادم ينفذ إعادة احتساب وتسوية بناءً على تغييرات Realtime. هذا يجعل قاعدة البيانات وكأنها تشغل Business Logic مخفياً داخل Listener.

### التصميم المستهدف قبل API

لكل عملية خلفية يجب تعريف:

```text
Input
Trigger
Preconditions
Transaction boundary
Idempotency key
Retry policy
Audit event
Failure behavior
```

### مثال التسوية

```text
Credit transaction created
  -> validate event
  -> derive courier account
  -> find pending custody
  -> settle inside transaction
  -> write audit/activity
  -> mark operation key
```

إذا لم يكن تنفيذ العملية داخل Transaction في الوضع الحالي، يجب أولاً إضافة اختبارات تكشف السلوك، وليس تغيير طريقة الحساب عشوائياً.

### Realtime في المستقبل

بعد API:

```text
alx_api writes domain change
  -> commits transaction
  -> emits controlled event/outbox record
  -> clients receive invalidation/update
```

لا تعتمد الواجهة على مراقبة كل جدول مباشرة.

---

## المرحلة 9: تنظيم الصفحات الكبيرة

### النمط المطلوب

بدلاً من:

```text
Orders.tsx
  state + forms + queries + mutations + dialogs + rules + printing
```

نصل إلى:

```text
features/orders/
├── pages/OrdersPage.tsx
├── components/OrdersTable.tsx
├── components/OrderFilters.tsx
├── components/OrderForm.tsx
├── components/OrderDetailsDrawer.tsx
├── components/OrderStatusDialog.tsx
├── hooks/useOrders.ts
├── hooks/useOrderMutations.ts
├── services/orders.service.ts
├── schemas/orders.schemas.ts
├── types.ts
└── api.ts
```

### ترتيب استخراج المسؤوليات

1. الأنواع والثوابت.
2. Schemas.
3. Data Gateway.
4. Hooks للقراءة والكتابة.
5. المكونات الأصغر.
6. Dialogs/forms.
7. Page shell.
8. الاختبارات.

لا يتم تغيير سلوك العملية في نفس Commit الذي يتم فيه تقسيم الملف، إلا إذا كان التغيير ضرورياً لإصلاح عيب موثق.

---

## المرحلة 10: إزالة التكرار في المكونات

### العناصر المشتركة المتوقع استخراجها

- DataTable.
- FilterBar.
- Pagination.
- ConfirmDialog.
- FormField.
- CurrencyField.
- MoneyDisplay.
- StatusBadge.
- EntitySelect.
- AsyncState.
- EmptyState.
- ErrorState.
- PermissionGate.
- AuditPreview.

### قاعدة الاستخراج

لا يستخرج المكون إلا إذا:

- تكرر ثلاث مرات أو أكثر، أو
- يمثل نمطاً موحداً يجب أن يتغير مركزياً، أو
- يحتوي قاعدة وصول/أمان يجب عدم تكرارها.

لا يتم إنشاء مكون عام ضخم يحتوي عشرات الخيارات غير المترابطة.

---

## المرحلة 11: تنظيف الأنواع والحقول

### ترتيب التوحيد

1. أسماء Features.
2. أسماء DTOs.
3. معرفات الكيانات.
4. الحالات.
5. التواريخ.
6. العملات والمبالغ.
7. Pagination.
8. الأخطاء.
9. الصلاحيات.

### قواعد TypeScript

- `strict: true`.
- منع `any` في Auth وOrders وAccounting.
- استخدام `unknown` عند حدود البيانات الخارجية ثم Zod parsing.
- عدم استخدام `as` إلا مع سبب موثق.
- عدم تصدير Database Row إلى مكونات React.
- منع تعريف نفس Entity في عدة ملفات.
- وضع الأنواع المشتركة في `src/shared/contracts` بعد تثبيت العقد.

### الحقول الانتقالية

إذا كان هناك حقل قديم وجديد، لا تنشر Alias في كل الملفات. يستخدم Mapper واحد:

```text
Legacy DB Row -> Canonical DTO
Canonical DTO -> Legacy DB Write
```

ثم يسجل الحقل القديم في جدول Migration Debt إلى أن يزال لاحقاً.

---

## المرحلة 12: توحيد الأخطاء وحالات التحميل

### عقد الخطأ المقترح

```json
{
  "success": false,
  "error": {
    "code": "ORDER_STATUS_INVALID",
    "message": "لا يمكن الانتقال إلى الحالة المطلوبة",
    "details": [],
    "requestId": "..."
  }
}
```

في المرحلة الحالية يمكن للـ Gateway تحويل أخطاء Supabase إلى هذا الشكل، حتى قبل وجود API.

### حالات الواجهة

كل Query/Mutation يجب أن يميز بين:

```text
idle
loading
success
empty
error
submitting
success-after-mutation
```

لا تستخدم Cache قديمة على أنها بيانات مؤكدة في الحسابات أو الصلاحيات أو حالة الطلب الحالية.

---

## المرحلة 13: تخفيض اعتماد الموقع على Supabase

### الخطوات

1. إنشاء `alx_web/src/api`.
2. إنشاء `alx_web/src/contracts`.
3. نقل أي استعلام مباشر إلى `portal gateway`.
4. تعريف Public Tracking DTO لا يحتوي على PII.
5. تعريف Portal User Session DTO.
6. منع الموقع من استيراد Supabase في صفحات جديدة.
7. وضع Supabase implementation داخل `lib/legacy-supabase` مؤقتاً.
8. إضافة feature flag لتبديل Gateway مستقبلاً.

### Public Tracking

يجب أن يعيد فقط:

- رقم تتبع محدود أو Token عام.
- الحالة العامة.
- تاريخ الأحداث المسموح نشره.
- معلومات لا تكشف الاسم أو الهاتف أو العنوان أو الرصيد.

ويجب أن تكون بيانات التتبع العامة Endpoint محدداً في API الجديدة، وليس قراءة مباشرة من جدول `orders` أو `shipments`.

---

## 8. خطة التحقق من قاعدة البيانات دون تغييرها

هذه الخطوات قراءة وتشخيص فقط.

### 8.1 تقرير صحة المخطط

يجب إنشاء تقرير يتضمن:

- كل الجداول.
- عدد الصفوف التقريبي.
- Primary Keys.
- Foreign Keys.
- الجداول التي RLS فيها معطل.
- الحقول JSONB.
- الحقول التي تحتوي أسماء متشابهة.
- الحقول الزمنية غير الموحدة.
- الأعمدة المالية.
- الحقول التي قد تحتوي Secrets.
- العلاقات إلى `auth.users`.

### 8.2 تقرير جودة البيانات

قراءة فقط، مع استعلامات محدودة ومقسمة:

- سجلات بلا Customer في الطلبات.
- Orders بلا Tracking Number رغم متطلبات النظام.
- Shipments بلا Order.
- Users بلا Role صالح.
- Users تحتوي Password أو System PIN.
- Sessions قديمة أو غير مربوطة بمستخدم.
- Foreign Keys غير متطابقة إن وجدت عبر استعلامات تحقق.
- قيم Status خارج القائمة المعتمدة.
- مبالغ سالبة حيث لا يسمح المجال.
- تواريخ Epoch مقابل `timestamptz`.
- تكرار البريد أو اسم المستخدم.

لا يتم إصلاح النتائج داخل هذه المرحلة. تتحول النتائج إلى Backlog مصنف:

```text
Blocker
High
Medium
Low
```

### 8.3 تقرير الوصول

يجب توثيق من يملك حالياً صلاحية القراءة والكتابة، مع التركيز على أن العملاء لا ينبغي أن يحملوا مفاتيح قادرة على تعديل جداول عامة مباشرة.

---

## 9. خطة الاختبارات قبل API

## 9.1 اختبارات Baseline

- TypeScript check للنظام.
- TypeScript check للموقع.
- Unit tests الحالية.
- Build للنظام.
- Build للموقع.
- تشغيل النظام في وضع التطوير.
- اختبار Login الحالي في بيئة اختبار فقط.
- اختبار أهم صفحات Orders/Customers/Accounting.

### ملاحظة

إذا كانت الاختبارات الحالية مرتبطة بواجهات Firebase-like أو Supabase مباشرة، لا تحذفها فوراً. تنقل أولاً إلى Gateway tests، ثم تستبدلها باختبارات عقدية.

## 9.2 Contract Tests

لكل Gateway:

- المدخل الصحيح.
- المدخل غير الصحيح.
- سجل غير موجود.
- Permission مفقودة.
- Pagination.
- Error mapping.
- Null/Optional fields.
- Date/money serialization.

## 9.3 Golden Tests

للكيانات الحساسة، احفظ عينات DTOs متوقعة:

- Customer.
- Order.
- Shipment.
- User.
- Account.
- Journal Entry.

إذا تغير Mapper دون قصد تفشل Golden Test وتكشف التغيير.

## 9.4 اختبارات الآثار الجانبية

كل عملية كتابة يجب أن تحدد آثارها:

```text
Create order
  -> order row
  -> order history
  -> shipment optionally
  -> notification optionally
  -> activity audit
```

الهدف هو منع نقل عملية إلى API مع نسيان جزء كان يحدث داخل صفحة أو Listener.

---

## 10. خطة التنفيذ العملية المقترحة

### Sprint 1: Baseline والجرد

المخرجات:

- Inventory للنظام والموقع.
- Data access map.
- Baseline tests.
- قائمة أسرار ومخاطر.
- قائمة Features.

### Sprint 2: Contracts وNaming

المخرجات:

- Canonical DTOs للهوية والعملاء والطلبات والشحنات.
- Error contract.
- Pagination contract.
- Permission names.
- Date/money rules.

### Sprint 3: Gateway Layer

المخرجات:

- Gateway interfaces.
- Current Supabase implementations.
- Mapper tests.
- Error mapping.
- منع Imports المباشرة من الصفحات.

### Sprint 4: Auth Boundary

المخرجات:

- AuthProvider مستقل.
- AuthGateway.
- Session DTO.
- إزالة session object الخام من الصفحات.
- عدم تمرير Password/System PIN إلى الواجهة.

### Sprint 5: Feature Refactor

الترتيب:

1. Customers.
2. Couriers.
3. Shipments/Tracking.
4. Orders.
5. Users/Roles.
6. Expenses.
7. Accounting.
8. Reports.

### Sprint 6: Server Split

المخرجات:

- إزالة منطق التشغيل من `server.ts`.
- فصل Jobs وProxy وDev serving.
- عزل Legacy Adapter.
- توثيق نقاط ستنتقل إلى `alx_api`.

### Sprint 7: Portal Preparation

المخرجات:

- Portal Gateway.
- Public Tracking Contract.
- Portal Session Contract.
- إزالة القراءة المباشرة من صفحات الموقع.

### Sprint 8: Readiness Review

المخرجات:

- لا توجد صفحة جديدة تستورد Supabase.
- كل Feature رئيسي يملك Gateway.
- DTOs لا تكشف JSONB الخام.
- Auth boundary جاهز للاستبدال.
- قائمة Endpoints المقترحة لـ `alx_api`.
- تقرير Data Migration.

---

## 11. معايير عدم بدء `alx_api` قبل تحققها

لا يبدأ بناء API الإنتاجية قبل تحقق الشروط التالية:

### على مستوى الكود

- لا توجد استدعاءات Supabase مباشرة من صفحات النظام أو الموقع.
- لا توجد استدعاءات Firebase-like جديدة.
- كل عمليات البيانات تمر من Gateway.
- لا يوجد منطق أعمال جديد داخل UI components.
- لا يوجد `any` في العقود الأساسية الجديدة.
- يوجد Error Contract موحد.

### على مستوى البيانات

- تم اعتماد Canonical Model للطلبات والعملاء والشحنات.
- تم تحديد الحقول التي تبقى في JSONB.
- تم توثيق كل علاقات Orders/Shipments/Customers.
- تم تحديد وضع الحقول القديمة والحديثة.
- تم إعداد تقرير البيانات غير الصالحة دون تعديلها.

### على مستوى الأمن

- لا يتم تخزين أو إرسال كلمات مرور في الواجهة.
- تم تحديد خطة التعامل مع `users.password` و`users.system_pin`.
- تم حصر Public Tracking في DTO آمن.
- تم تسجيل RLS disabled كمخاطر انتقالية.
- لا توجد Secrets في المصدر أو في حزمة Electron.

### على مستوى التشغيل

- النظام والموقع يبنيان من نسخ نظيفة.
- الاختبارات الأساسية ناجحة.
- يوجد Rollback لكل Refactor.
- كل Feature مرحل يمكن تشغيله مع Gateway الحالي.
- لا توجد تغييرات غير موثقة في قاعدة البيانات.

---

## 12. ترتيب إنشاء `alx_api` بعد التهيئة

بعد تحقق معايير الجاهزية، يبدأ `alx_api` بهذا الترتيب:

1. Scaffold TypeScript/Express 5.
2. PostgreSQL Pool وDrizzle.
3. Migrations مستقلة.
4. Error/Response/Validation.
5. Auth داخلي.
6. Sessions وRefresh Tokens.
7. RBAC.
8. OpenAPI.
9. Users/Roles/Permissions.
10. Customers.
11. Orders.
12. Shipments/Tracking.
13. Accounting/Expenses.
14. Notifications.
15. Portal endpoints.
16. HTTP Client في النظام.
17. HTTP Client في الموقع.
18. إيقاف Supabase Client من العملاء.
19. تقييد الوصول المباشر إلى قاعدة البيانات.

لا يتم البدء بالمالية قبل تثبيت Auth/RBAC/Transaction patterns، ولا يتم البدء بنقل الموقع قبل تثبيت Public DTOs وحماية PII.

---

## 13. المخاطر وأولوياتها

| الخطر | الأولوية | الإجراء قبل API |
|---|---:|---|
| كلمات مرور وPIN داخل `public.users` | Blocker | جرد واختبار وإيقاف الاعتماد عليها في الواجهة |
| بيانات اعتماد ثابتة داخل `server.ts` | Blocker | توثيقها كعيب حرج ومنع نقلها إلى API |
| وصول مباشر من العملاء إلى Supabase | High | Gateway boundary ثم HTTP migration |
| RLS معطل على معظم الجداول | High | منع وصول العملاء المباشر، ثم خطة حماية مستقلة |
| Adapter مسؤول عن التخزين والجلسة والكاش | High | تفكيك Gateway/Auth/Cache/Mapper |
| `server.ts` يجمع وظائف متعددة | High | استخراج Jobs وProxy وDev server |
| JSONB كمصدر حقول أساسية | High | Canonical DTO/data dictionary |
| Realtime ينفذ منطقاً مالياً | High | Services/Transactions/Idempotency |
| اختلاف أسماء الحقول والتواريخ | High | Mapper وعقد موحدة |
| صفحات ضخمة | Medium | Feature refactor تدريجي |
| ملفات `.bak` داخل المصدر | Medium | إخراجها من مسار البناء والمرجعية |
| توثيق قديم أو متضارب | Medium | تحديثه بعد اعتماد Canonical Model |

---

## 14. النتيجة النهائية

المشروع ليس جاهزاً لإنشاء `alx_api` فوقه مباشرة، لكنه يملك أجزاء مفيدة يمكن الحفاظ عليها:

- Services موجودة في مجالات متعددة.
- اختبارات لبعض قواعد الطلبات والمالية.
- توثيق واسع للمخطط والتاريخ.
- علاقات Foreign Keys مهمة في PostgreSQL.
- فصل أولي بين النظام والموقع.

لكن يلزم قبل API تنفيذ طبقة تهيئة واضحة:

```text
جرد
  -> Canonical Contracts
  -> Gateway Boundary
  -> Auth Boundary
  -> Feature Refactor
  -> Server Split
  -> Data Quality Report
  -> Readiness Review
  -> alx_api
```

أهم قرار في الخطة هو عدم محاولة إصلاح كل شيء داخل الواجهات مرة واحدة، وعدم إعادة تصميم قاعدة البيانات قبل فهم الاستخدامات. الإصلاح الآمن هو إنشاء حدود جديدة حول الوضع الحالي، ثم نقل Feature واحدة في كل مرة، مع اختبارات تمنع تغير السلوك دون قصد.

**تم تحديث هذه الخطة فقط، ولم يتم تنفيذ تعديل برمجي أو SQL أو Migration ضمن إعادة الصياغة.** الخطوة الأولى العملية عند بدء التنفيذ هي إنشاء تقرير جرد آلي مفصل للنظام والموقع، ثم اعتماد Baseline قبل أي Refactor.

---

## المراجع

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security Documentation"
[2]: https://supabase.com/docs/guides/api "Supabase API Documentation"
[3]: https://www.postgresql.org/docs/current/ddl-constraints.html "PostgreSQL Constraints Documentation"
[4]: https://www.postgresql.org/docs/current/transaction-iso.html "PostgreSQL Transaction Isolation Documentation"
[5]: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html "OWASP REST Security Cheat Sheet"
[6]: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html "OWASP Authorization Cheat Sheet"
