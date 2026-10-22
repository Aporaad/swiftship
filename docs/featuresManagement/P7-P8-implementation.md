# تنفيذ P7 وP8 — الفائزون والمطالبة والتسليم + الكوبونات

**التاريخ والوقت:** 2026-10-21 10:30 (+03:00)
**النموذج المنفذ:** Qoder
**الحالة:** P6 مغلق نهائيًا (مع تفاصيل المسابقة)؛ P7 وP8 منفّذتان برمجيًا؛ migration 0050 جاهز وغير مطبّق

## فهم الخطه والحالة السابقة

راجعت `خطة_تنفيذ_المسابقات_والجوائز_والكوبونات.md` ومجلد `docs/featuresManagement`. الحالات P0–P5 منفّذة (مخطط Drizzle + migrations 0048/0049 مطبّقة مباشرة على Supabase مع انحراف معتمد: بلا RLS وبلا dry-run)، وP6 كان مغلقًا برمجيًا في دفعتين (قائمة مسابقات البوابة، مشاركات مقيّدة بالعميل مع إزالة التكرار، مراجعة المشاركات إداريًا، تجميد أهلية SHA-256 بمفتاح idempotency). وفقًا لقرار §13.3 لا يُنفّذ أي سحب عشوائي؛ الفائزون يُعيَّنون يدويًا فقط.

القاعدة المعمارية الثابتة: `alx_api` يملك الهوية والصلاحيات ومنطق الأعمال والتحقق من قاعدة البيانات؛ واجهة المستخدم تجمع المدخلات وتعرض النتائج فقط ولا تحسب أهلية أو خصمًا أو فائزين، ولا تتصل بقاعدة البيانات مباشرة. كما يبقى نظاما الكوبون منفصلين: `couponEnabled/couponRate` (كوبون شراء الشركة في النواة) مقابل كوبونات عملاء `featuresManagement` (النظام التجاري الجديد عبر رمز/إصدار يتحقق منه الخادم).

## استكمال إغلاق P6

أُضيفت نقاط تفاصيل المسابقة المفردة التي كانت ناقصة في §10 من الخطه:

- إداري: `GET /api/v1/features/contests/:contestId` (يتطلب `features.contests.read`) يعرض التفاصيل الكاملة بما فيها المخزون الداخلي.
- بوابة: `GET /api/v1/portal/features/contests/:contestId` يعرض المسابقات المنشورة/النشطة فقط، ويقتصر على أسماء الجوائز ونوعها — تُخفى المخزون والقيمة والتكلفة الداخلية عن العميل.

## P7 — الفائزون والاعتماد والمطالبة والتسليم

- **تعيين الفائزين (يدوي):** `POST /api/v1/features/draw-runs/:drawRunId/winners` (صلاحية `features.draw.execute`) — معاملة واحدة بأقفال `FOR UPDATE` على `draw_run` (يجب أن يكون `ready`) وكل `contest_prize`/`entry`؛ لا يتجاوز `quantity_awarded` سقف `quantity_allocated`؛ يُنشئ `feature_winner_awards` بمهلة مطالبة مشتقّة من `claim_days`؛ idempotent عبر `idempotencyKey` (تعارض القيد الفريد يعيد نتيجة فارغة بأمان).
- **اعتماد السحب وإشعار الفائزين:** `POST /api/v1/features/draw-runs/:drawRunId/approve` (صلاحية `features.winners.approve`) — يفرض **فصل المهام**: المعتمد لا يساوي من نفّذ السحب (وإلا `SEPARATION_OF_DUTIES` 403)؛ يحوّل المشاركات إلى `winner` والجوائز إلى `notified` وينشئ إشعارًا داخل التطبيق لكل فائز (محروس بـ NOT EXISTS خلال دقيقة).
- **المطالبة (بوابة):** `POST /api/v1/portal/features/me/awards/:awardId/claim` — هوية العميل من الجلسة فقط؛ تحقق ملكية ذرّي عبر `UPDATE ... WHERE status IN ('assigned','notified')`؛ يفرض مهلة المطالبة من ساعة الخادم؛ يلتقط عنوان/هاتف التسليم بعد الفوز فقط.
- **قائمة جوائزى (بوابة):** `GET /api/v1/portal/features/me/awards`.
- **التسليم (إداري):** `POST /api/v1/features/winner-awards/:awardId/fulfillment` (صلاحية `features.prizes.fulfill`) — تمر بآلة حالات الجائزة: `claimed → fulfillment_pending → shipped → delivered` (أو reject/expire)، مع stamps زمنية مشروطة وحدث تدقيق.

## P8 — الكوبونات التجارية لعملاء featuresManagement

- **انتقالات القاعدة:** `POST /api/v1/features/coupons/:couponId/transitions` (activate/disable/expire) وفق آلة حالات قاعدة الكوبون.
- **الإصدار:** `POST /api/v1/features/coupons/:couponId/issuances` — يولّد الخادم رمزًا شخصيًا غير قابل للتخمين (بادئة القاعدة + مقطع CSPRNG من أبجدية بلا محارف ملتبسة)، ويشتق `expiresAt = min(body, rule.endsAt)`؛ idempotent.
- **الإلغاء:** `POST /api/v1/features/coupon-issuances/:issuanceId/revoke` (صلاحية `features.coupons.revoke`) — مسموح فقط قبل الاستهلاك الفعلي؛ `redeemed`/`revoked` مرفوضان.
- **قائمة كوبوناتي (بوابة):** `GET /api/v1/portal/features/me/coupons`.
- **معاينة التحقق (بوابة):** `POST /api/v1/portal/coupons/validate` — يحسب الخادم الأهلية والخصم على وعاء المنتجات المؤهلة فقط، ولا يحجز ولا يستهلك الاستحقاق؛ تُعاد نفس الحسابات عند إنشاء الطلب في P9. الخصم لا يتجاوز أبدًا إجمالي المنتجات، والكوبون الثابت مرتبط بعملة (بلا مصدر صرف معتمد لا يُطبّق على عملة أخرى — قرار §13.19).
- **ملخّص التقارير:** `GET /api/v1/features/reports/summary` (صلاحية `features.reports.read`).

## فصل طبقة النطاق

أُضيف ملف `features-management.p7.ts` يفصل كل قواعد P7/P8 كأدوال صرفة قابلة للاختبار بمعزل عن SQL/HTTP/UI: آلات حالات السحب/الجائزة/قاعدة الكوبون، `assertClaimable`/`computeClaimDeadline`/`assertRevocable`، `calculateCouponDiscount`، و`generateIssuedCode`، مع `FeaturesDomainError` الذي تترجمه الـroutes إلى استجابة HTTP آمنة (400 لأخطاء الخصم غير الصالح، وإلا 409).

## قاعدة البيانات

لم تُنفّذ أي SQL/DDL فعليًا هذه الجولة — قاعدة البيانات البعيدة غير متاحة من بيئة التنفيذ (انتهاء اتصال). migration `0050_features_winners_coupons.sql` أُنشئ كملف جاهز داخل `alx_api/src/db/migrations/` ويضيف: حالة `winner` للمشاركات، `quantity_awarded` للجوائز المخصّصة مع قيد سقف، أعمدة تتبّع المطالبة/التسليم لـ`feature_winner_awards`، أعمدة الإلغاء/الإنشاء لـ`feature_coupon_issuances`، وست صلاحيات P7/P8 مع إسنادها لدور `admin`. حُدّث `src/db/features-schema.ts` ليعكس نفس التغييرات ليبقى كتالوج Drizzle متزامنًا. يجب تطبيق 0050 قبل تفعيل نقاط كتابة P7/P8. الانحراف مستمر: بلا RLS وبلا dry-run (دين أمني موثّق).

## التحقق

نجح `npx tsc --noEmit`، ونجح ملف اختبارات النطاق الجديد `tests/unit/features-management.p7.test.ts` (14/14)، ونجحت حزمة `alx_api` الكاملة: **53 suite / 476 اختبارًا**. نجح Prettier على الملفات المتغيّرة، وفحص `js-yaml` لملف `docs/openapi.yaml`. حُدّث `docs/table-registry.md` بتأثير migration 0050، وأُضيفت مسارات ومخطّطات P6/P7/P8 إلى OpenAPI مع توسيع تعداد حالة المشاركة بـ`winner`.

## حدود ما بعد P8

يبقى تكامل كوبون العميل مع تسعير الطلب (P9: إعادة تطبيق حساب الخصم ذرّيًا عند `createCustomerOrder` مع إنشاء `feature_coupon_redemptions` وربط الاستهلاك/التراجع بالطلب)، والقرعة العشوائية إن أُقرّت لاحقًا كسياسة من المالك (غير مفعّلة حاليًا وفق §13.3)، وتطبيقات الواجهة (إدارة `featuresManagement` وصفحة البوابة `/portal/customer/gifts`).
