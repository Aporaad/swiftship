# تنفيذ P9 إلى P12 — تكامل كوبون العميل وواجهات الإدارة والبوابة والاختبارات النهائية

**التاريخ والوقت:** 2026-10-21 12:00 (+03:00)
**النموذج المنفذ:** Qoder
**الحالة:** P6–P8 مغلقة برمجيًا؛ migration 0050 مطبَّق حيًا على Supabase؛ P9 وP10 وP11 وP12 منفّذة ومتحقق منها

## فهم الحالة السابقة

اكتملت P0–P8: المخطط وmigrations 0048/0049/0050، وقاعدة `features-management` بطبقاتها (contracts/schemas/service/repository/routes/factory)، ومسارات البوابة والإدارة لـ P6/P7/P8، وطبقة النطاق الصرفة في `features-management.p7.ts`. القيدان المعماريان الثابتان: `alx_api` يملك الهوية والصلاحيات ومنطق الأعمال والتحقق؛ الواجهة تجمع المدخلات وتعرض النتائج فقط؛ ونظاما الكوبون منفصلان — كوبون شراء الشركة في النواة (`couponEnabled/couponRate`) مقابل كوبونات عملاء `featuresManagement` (رمز/إصدار يتحقق منه الخادم).

## P9 — الاسترداد الذرّي لكوبون العميل داخل إنشاء الطلب

- `features-management.p9.ts` ينفّذ `redeemCouponOnClient(client, …)` داخل نفس `PoolClient` الذي ينشئ الطلب:
  1. قفل القاعدة `SELECT … FOR UPDATE` (يرفض `COUPON_NOT_ACTIVE` إن لم تكن نشطة).
  2. الإصدار الشخصي: `UPDATE feature_coupon_issuances SET status='redeemed' WHERE status='issued' AND (customer_id IS NULL OR customer_id=$2)` — بلا صف ⇒ `COUPON_NOT_REDEEMABLE`؛ القاعدة العامة: فحص حدّ العميل ⇒ `COUPON_LIMIT_REACHED`.
  3. رفع `usage_count` مشروط بالحد الإجمالي ⇒ `COUPON_EXHAUSTED` عند بلوغه.
  4. إدراج `feature_coupon_redemptions` بحالة `redeemed`؛ القيد الفريد على `order_id` (23505) ⇒ `COUPON_ALREADY_APPLIED`.
- أي فشل يرفع `CouponRedemptionError` قبل الإدراج، فتتراجع المعاملة كلها: لا سطر يتيم ولا استهلاك مزدوج.
- التسعير: `serverCouponDiscountSAR` (محسوب خادميًا عبر `priceForOrder`) يسبق `couponEnabled/couponRate`، مُسقَف عند إجمالي المنتجات ومَقصوص عند صفر. المسار `priceForOrder` غير مستهلِك فيقتضي parity بين عرض السعر والإنشاء.
- الحقن: `POST /api/v1/portal/orders` يقبل `couponCode` (schema صارم)، وتُوسّعت OpenAPI بردّي 409 `PORTAL_COUPON_REDEMPTION_FAILED` و422 `PORTAL_COUPON_NOT_APPLICABLE`.

## P10 — قسم featuresManagement في النظام الأساسي

- واجهة إدارة جديدة كاملة: تبويبات المسابقات/الجوائز/الكوبونات (`src/features/featuresManagement/**`) + صفحة `FeaturesManagement` ومسار `/features-management` وعنصر تنقّل.
- بوابة نوعيّة `src/services/featuresManagementService.ts` فوق `appApiClient` (مخطِّطات camelCase مسطّحة، تطبيع آمن، بدون قراءة jsonb خام)، مع فصل تام عن منطق الأعمال.
- صلاحيات dotted مضافة في `PERMISSION_NAMES.ts` (`features.contests.read/manage` …). ملاحظة: بوابة العرض الحالية تسمح برمز `*` في `useRole`، فالتحكيم النهائي يبقى خادميًا.

## P11 — بوابة العميل `/portal/customer/gifts`

- `alx_web/src/api/portalAuthGateway.ts`: DTOs جديدة + طرق متسامحة التطبيع (`listFeatureContests`/`getFeatureContest`/`joinFeatureContest`/`listMyFeatureAwards`/`claimFeatureAward`/`listMyFeatureCoupons`/`validateCoupon`)؛ التواريخ (ISO) والمبالغ (NUMERIC كنص) تُطبَّع دون رفض شكلي صارم.
- `GiftsPage.tsx`: ثلاثة تبويبات ببيانات حقيقية (مسابقات + مشاركة بقبول الشروط، جوائزاي + مطالبة بعنوان/هاتف، كوبوناتي)؛ لا تحسب الواجهة أي خصم أو أهلية.
- `CreateOrderModal.tsx`: استُبدل إدخال الخصم الرقمي الموثوق من العميل بحقل `couponCode` + زر «تحقق» يستدعي `/portal/coupons/validate`؛ يُرسل `couponCode` في عرض السعر والإنشاء، ويعرض الخصم من `quote.couponDeduction`.

## P12 — اختبارات الأمان والتكامل النهائية

- `alx_api/tests/unit/features-management.p12.test.ts` يثبت: (1) لا سطر استرداد عند أي فشل حراسة؛ (2) حصر استهلاك الإصدار بصاحبه عبر `customer_id`؛ (3) قفل `FOR UPDATE` ورفع العدّاد المشروط بالحد الإجمالي؛ (4) parity quote==create وسقف الخصم دون سالب؛ (5) رفض حقن الهوية/الحقول الزائدة عبر مخططات `.strict()` (الطلب/التحقق/المشاركة/المطالبة).

## قاعدة البيانات

- migration `0050_features_winners_coupons.sql` طُبِّق حيًا على Supabase `ejrojwbbflzchasvgexr` (اسم: `features_winners_coupons_0050`).
- تحقّق قراءة عبر Supabase MCP: الجداول العشرة `feature_*` موجودة، و`feature_coupon_redemptions.order_id` عليه `UNIQUE (order_id)` (دعامة منع الاستهلاك المزدوج).
- الانحراف المستمر موثّق: بلا RLS وبلا dry-run — دين أمني يجب معالجته قبل الإطلاق العام.

## التحقق

- `alx_api`: `tsc --noEmit` نظيف؛ مجموعة Jest الكاملة **55 suite / 504 اختبارًا** ناجحة؛ Prettier مطبّق.
- `alx_web`: `tsc --noEmit` نظيف؛ Prettier مطبّق.
- توثيق التتبع في `todo.md` و`devloping_history.md` و`DBdevloping_history.md` و`user_commends.md` و`db_commends.md`.
