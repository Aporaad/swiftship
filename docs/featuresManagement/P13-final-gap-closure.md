# P13 + الفجوات النهائية — تدقيق الخطة وإغلاقها (2026-10-21)

**المنفّذ:** Qoder · **النطاق:** إغلاق كل الفجوات المتبقية في `خطة_تنفيذ_المسابقات_والجوائز_والكوبونات.md` بعد اكتمال P0–P12.

## الفجوات التي رُصدت وأُغلقت
| البند | الفجوة الرصدية | الإغلاق |
|---|---|---|
| §12.9 / P13 | لا يوجد مفتاح مميزات خادمي | `FEATURES_MANAGEMENT_ENABLED` في `env.ts` + `writesEnabled` في بناية الخدمة؛ `assertWritesEnabled()` يحرس 15 مسار كتابة بـ `FEATURES_DISABLED`/503، والقراءة/المعاينة تبقى متاحة |
| §17.1.5 | لا طريقة لمنع استرداد جديد مع إبقاء السجلات | جسر `couponWritesEnabled?()` في `CustomerCouponGateway` + حارس في **مسار إنشاء الطلب فقط** (`portal-owned.service.ts`)؛ عرض السعر/المعاينة لا يُحجبان |
| §12.5 | لا محددات معدل مستقلة على المسارات الحساسة | `portalWriteLimiter` (مشاركة/مطالبة) و`couponValidateLimiter` (ثلث الحد، أدنى 5 — صدّ تخمين الرموز) عبر `express-rate-limit` بنفس نمط `auth.routes` |
| §10.2 | `GET /portal/features/me/entries` غير موجود | `listEntriesForCustomer` (repo) + `listMyEntries` (service) + المسار خلف `authenticatePortal` بهوية من الجلسة |
| §11.2 | لا تبويب «مشاركاتي» في بوابة الهدايا | `PortalFeatureEntryDto` + `listMyFeatureEntries()` في `portalAuthGateway.ts` + تبويب رابع في `GiftsPage.tsx` |
| §10.1 | خدمة الإدارة تفتقر للسحب/الفائزين/التسليم/التقارير | `getContestDetail`/`assignWinners`/`approveDrawRun`/`fulfillAward`/`reportsSummary` + `freezeEligibility` يعيد `drawRunId` |
| §11.1 | لا لوحة سحب/فائزين/تسليم ولا ملخص تقارير | `DrawWinnersPanel.tsx` (تجميد→تعيين يدوي→اعتماد بفصل مهام→تسليم) + `ReportsSummaryBar.tsx` + `AWARD_ACTIONS` في `featuresUi.ts` |
| §15 | لا اختبارات P13 | `features-management.p13.test.ts` — 35 اختبارًا (حظر الكتابة/إتاحة القراءة/الجسر/فصل نظامين الكوبون/ملكية مشاركاتي) |

## قرارات صاحب النظام المحفوظة (لم تتغير)
- كوبون الشراء الداخلي (`couponEnabled/couponRate` في نموذج الطلب الأساسي) **لم يُمس**؛ خصم featuresManagement الخادمي يسبقه ولا يُجمعا معًا (مثبَّت باختبار).
- لا قرعة عشوائية: الفائزون يُعيَّنون يدويًا من قائمة مؤهلة مجمّدة؛ الاعتماد يتطلب مراجعًا مختلفًا عن المنفّذ ( خادميًا).
- الواجهات (نواة + بوابة) تعرض وتجمع النوايا فقط؛ لا أهلية/خصم/فوز في المتصفح.

## مؤجلات بقرار (خارج نطاق الكود)
- تقوية RLS/GRANTs على جداول `public` العشرة، بنية المراقبة والتنبيهات (§16)، تشغيل النشر المتدرج الإنتاجي، قنوات الإشعارات الخارجية.
- التحقق الحي الإضافي عبر موصل Supabase: انتهت صلاحية تفويض OAuth في هذه الجلسة؛ سيُعاد بعد إعادة التفويض (الاستعلامات الجديدة تعتمد أعمدة مثبتة منذ 0050).

## أدلة التحقق (2026-10-21 07:1x)
- alx_api: `tsc --noEmit` نظيف؛ `jest` كامل = **56 suite / 539 test** ناجحة.
- alx_web: `tsc --noEmit` نظيف (EXIT 0).
- النواة: `tsc --noEmit` نظيف (EXIT 0) بعد إصلاح استيرادَي `DatePickerInput` مكسوري العمق في `CreateOrderStep3.tsx` و`ReportsContextFilters.tsx` (كانا يسبقان هذه الجولة).
- Prettier مطبّق على كل الملفات المعدّلة في الحزم الثلاث.
