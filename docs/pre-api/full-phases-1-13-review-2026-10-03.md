# المراجعة الشاملة لخطة إصلاح هيكل النظام والتجهيز لبناء API

- **المشروع الأساسي:** `Aporaad/swiftship`
- **الموقع المرتبط بالمرحلة 13:** `Aporaad/alx_web`
- **تاريخ المراجعة:** 2026-10-03
- **النسخة الأساسية بعد السحب:** `03cd31f` (`مراجعه خفيفه`)
- **الخطة المرجعية:** `system_pre_api_restructure_plan_ar.md`

## ملخص تنفيذي

تم سحب آخر نسخة من `swiftship` و`alx_web`، وتشغيل baseline كامل على النظام:

- `npm run check`: ناجح.
- `npm test -- --reporter=dot`: **71 ملف اختبار ناجحاً، 3 متخطاة؛ 254 اختباراً ناجحاً، 8 متخطاة**.
- `npm run build`: ناجح للنظام مع تحذيرات بنيوية غير حاجبة تخص chunk كبير و`import.meta` في CJS والاستيراد المختلط للمحول القديم.
- `alx_web npm run build`: ناجح بعد إصلاح نافذة التتبع.
- لم يتم تنفيذ SQL أو DDL أو DML؛ موصل Supabase غير مفعّل في الجلسة.

**قرار الجاهزية:** لا يُعلن بدء API الإنتاجية بعد. تم إغلاق/تحسين بوابات محددة، لكن ما زالت هناك فجوات صريحة في ترحيل صفحات النظام من Supabase المباشر، تنظيف `any` في Auth/Orders/Accounting، توحيد حالات Async على كامل النظام، ونقل بقية مستهلكي الموقع إلى Portal Gateway.

## مصفوفة المراحل

| المرحلة | الحالة بعد المراجعة | الإصلاح/التحقق في هذه الجولة | الفجوة المتبقية |
|---|---|---|---|
| 1 — الجرد الكامل | جزئية | تم اعتماد ملفات الجرد الحالية وتشغيل جرد imports وملفات الاختبار بعد آخر سحب | لا تزال مصفوفة العمليات والآثار الجانبية تحتاج مطابقة تشغيلية لكل عملية كتابة |
| 2 — Feature Boundaries | جزئية/مستقرة هيكلياً | المجلدات والعقود موجودة، و`financeEntries` و`browser` و`siteManagement` ظاهرة كحدود مستقلة | ما زالت imports مباشرة من الخدمات/المكونات القديمة؛ وجود الهيكل لا يثبت الفصل الكامل |
| 3 — Data Gateway | **تحسين منفذ** | أضيف `createCurrentSupabaseGatewayRegistry()` يربط المجالات الـ17 بتطبيقات فعلية، مع اختبار wiring؛ بقيت allowlists وDTO mapping في Gateways | بعض Gateways ما زالت محدودة الوظائف ولا تغطي كل عمليات الكتابة المطلوبة |
| 4 — DTOs/Mappers/Schemas | جزئية مستقرة | check والاختبارات وGolden contracts ناجحة، ووجود DTOs/Mapper موثق | يلزم فحص كامل لكل الحقول المستخدمة في صفحات legacy، خصوصاً مجال المالية والشحنات |
| 5 — Auth/Session | جزئية | AuthSessionProvider وCurrentUserDto وعقد الجلسة موجودة، وأزيلت بعض الأسرار من bootstrap | ما زال Auth legacy مستخدماً في نطاقات متعددة، وترحيل الهوية يحتاج خطة بيانات/موصل حي |
| 6 — Permissions | مستقرة على مستوى الكتالوج | تم التحقق من تطابق كتالوج الصلاحيات والثوابت واختبارات PermissionGate | الاستخدام الواسع داخل الصفحات لم يتحول بالكامل إلى PermissionGate/عقد موحد، والتفويض النهائي يجب أن يبقى خادمياً |
| 7 — Server Split | منفذة محلياً | `server.ts` منسق وroutes/jobs/browser-proxy مفصولة، وcheck/build ناجحان | ما زالت طبقة current-db/legacy adapter انتقالية وتحتاج منع التوسع فيها |
| 8 — DB/Realtime/Jobs | جزئية | Idempotency وretry وjob contracts واختبارات jobs موجودة | لا يوجد snapshot حي لـRLS/grants/جودة البيانات؛ لا يمكن إثبات سلامة البيانات دون connector |
| 9 — Large Pages | تحسن جزئي | تم تفكيك أجزاء من Finance/Orders وخدماتها، والبناء ناجح | توجد صفحات ومكونات كبيرة واعتماد مباشر على Supabase؛ يلزم استكمال التفكيك والتحقق السلوكي |
| 10 — Shared Components | منفذة ضمن قاعدة الاستخراج | تم توحيد `CurrencySelect` و`MoneyDisplay` حيث ثبت التكافؤ، مع اختبارات؛ لم تُنشأ primitives عامة غير متجانسة | DataTable/FilterBar/Pagination/StatusBadge وغيرها مؤجلة لأنها لا تملك عقداً ثلاثياً مثبتاً |
| 11 — Types/Fields | **غير مغلقة** | strict check ناجح، وتم إصلاح بعض عقود EditOrder/Gateway | ما زالت `any` في FinanceEntries وShipment/User/Accounting services، كما توجد استدعاءات Supabase مباشرة في حدود أساسية |
| 12 — Errors/Loading | **غير مغلقة على مستوى النظام** | AsyncState/runQuery/runMutation موجودة ومطبقة على دفعات واسعة واختبارات ناجحة | الجرد الحالي يثبت حالات loading/submitting/error محلية كثيرة في Settings/Orders/Finance/Users/Widgets وغيرها |
| 13 — Portal/API preparation | **تحسين منفذ، غير مغلقة** | الموقع يحتوي PortalGateway وDTO آمن وlegacy isolation وfeature flag؛ نُقلت نافذة التتبع إلى Gateway ومنع عرض الاسم/الهاتف/العنوان/الرصيد | AuthContext وصفحات الموقع الأخرى ما زالت تستورد Supabase مباشرة، وendpoint Portal HTTP المقابل غير منشور/متحقق حيّاً |

## الإصلاحات المنفذة في هذه الجولة

### المرحلة 3

- إنشاء سجل Gateway فعلي في `src/data/current-supabase/gateways/registry.ts`.
- ربط المجالات السبعة عشر جميعاً بتطبيقات Gateway concrete.
- إضافة اختبار يضمن عدم وجود domain مسجل دون implementation.

### المرحلة 13

في `alx_web`:

- نقل `CustomerTrackModal` من قراءة `orders` و`portal_orders` المباشرة إلى `portalGateway.getPublicTracking()`.
- إزالة `any` الخام وقراءة الحقول الشخصية والمالية من نافذة التتبع.
- جعل نافذة التتبع تعرض الحالة العامة والأحداث العامة فقط.
- إضافة fallback legacy داخل `PortalGateway` يعيد DTO محدوداً بلا PII.
- نجاح `npm run build` للموقع.

## التحذيرات غير الحاجبة

- Vite: chunk رئيسي أكبر من 500KB.
- esbuild: استخدام `import.meta` عند إخراج CJS.
- Vite: خلط dynamic/static imports للمحول القديم.
- هذه التحذيرات لا تفشل البناء، لكنها Backlog تشغيلية قبل الإنتاج.

## بوابات إلزامية قبل إعلان جاهزية إنشاء API

1. تفعيل connector قراءة قاعدة البيانات والحصول على snapshot محدود لـRLS/grants/foreign keys/جودة البيانات.
2. إكمال ترحيل AuthContext وبقية صفحات `alx_web` إلى Portal Gateway.
3. تثبيت endpoints Portal HTTP والتحقق من session/ownership قبل تفعيل feature flag.
4. إزالة/حصر direct Supabase imports من صفحات النظام، أو تسجيل كل ملف كـLegacy boundary مع مالك وخطة إزالة.
5. إكمال تنظيف `any` في Auth/Orders/Accounting وفرض contract test يمنع عودته في الحدود الجديدة.
6. إكمال AsyncState لكل Query/Mutation حقيقي، مع إبقاء حالات فتح النوافذ والحقول UI-only خارج العقد.
7. تشغيل build/test من نسخ نظيفة للنظام والموقع، ثم smoke/E2E على بيئة staging معزولة.
8. توثيق rollback لكل دفعة ورفع كل التغييرات إلى GitHub.

## الخلاصة

النسخة الحالية **ليست جاهزة بعد لبدء API الإنتاجية** وفق معايير الخطة؛ لكنها أصبحت قابلة للاستمرار المنهجي. الإصلاحات المنفذة في هذه الجولة آمنة ومحدودة ومتحقق منها، ولم يتم إعلان إغلاق مرحلة لم تستوفِ معيارها الكامل.
