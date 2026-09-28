# المرحلة 4 — تثبيت نموذج البيانات والـDTOs

**التاريخ:** 2026-09-28
**الحالة:** مكتملة ومغلقة بتاريخ 2026-09-28 بعد اجتياز التحقق النهائي؛ لم يتم ربط UI أو إنشاء API.

## الفصل المعتمد

تم فصل الأنواع إلى:

```text
DatabaseRow → Mapper → ApiDto
CreateInput / UpdateInput → Feature Schema
ApiDto → ViewModel
```

لا تستخدم طبقة Feature نفس Interface لتمثيل صف قاعدة البيانات وDTO وViewModel.

## المسارات الدائمة

```text
src/data/dtos/
├── common.dto.ts
├── <feature>.dto.ts لكل Feature
└── mappers/feature.mappers.ts
```

ويصدر `src/features/<feature>/types.ts` الـViewModel فقط. توجد Schemas مستقلة داخل كل Feature للتحقق من CreateInput وUpdateInput. تم استخدام Schema helper محلي لأن Zod غير مثبت، ولم تتم إضافة dependency جديدة.

## القرارات

- أسماء Legacy مثل `order_status_id` تبقى داخل DatabaseRow/Mapper ولا تصل إلى ApiDto.
- الـOrders ApiDto يستخدم `status` canonical، بينما يظل `order_status_id` تفصيلاً داخلياً حتى API.
- كل التواريخ على حدود DTO هي ISO UTC typed strings.
- المبالغ توصف عبر `MoneyDto` مع العملة والدقة وسعر التحويل عند الحاجة.
- `FinanceEntries` يبقى مستقلاً عن Accounting.
- `Browser` و`siteManagement` لهما DTOs وSchemas وMappers مستقلة.
- `expenses` يبقى داخل Accounting ولا يوجد DTO/Feature مستقل للمصروفات.

## حدود هذه المرحلة

هذه DTOs دائمة لأنها جزء من العقد الداخلي للنظام، لكن لا يوجد في هذه المرحلة أي ربط جديد مع Pages أو Components. لا يتم بناء Auth الجديد، ولا Provider، ولا API Endpoint؛ تلك أعمال المرحلة 5 أو مراحل API اللاحقة.

## التحقق

تم التحقق بنيوياً من وجود DTO وSchema لكل Feature وMapper شامل. فحص TypeScript الموجه لم يكتمل لأن عملية `npx tsc` انتهت بالرمز 137 في بيئة Sandbox، ولذلك لا تُسجل هذه النتيجة كنجاح أو فشل للـcompile.


## [2026-09-28 12:40:16 +03:00] مراجعة إعادة الاستئناف — AI Model: Manus

**الحالة الحالية:** المرحلة الرابعة غير مغلقة. توثيق وجود DTOs وSchemas وMappers لكل Feature يثبت التغطية الهيكلية فقط؛ فحص TypeScript المسجل سابقًا انتهى بالرمز 137، ولم يثبت نجاح compile. كما طلب المستخدم إعادة التحقق من اكتمال الحقول مقابل الواجهات والخدمات القديمة، بما فيها حقول `data` وملفات العميل التابعة.

**مصادر الحقول الملزمة:** `src/pages` و`src/components` و`src/lib` و`src/services` و`src/hooks` و`src/types.ts`، مع `public` فقط من Supabase. لا يُستخدم `auth` ولا `src/features` أو DTOs الجديدة كمصدر لمتطلبات الحقول.

**ملاحظة تدقيق أولية:** نموذج إنشاء العميل يحتوي `lat` و`lng`، لكن خدمة `saveCustomerDetails` القديمة لا تحفظهما داخل `cust_details.data`. ويحتوي `portal_users.data` في المسار القديم على `password`، لذا يجب ألا يظهر في DTO القراءة وأن يبقى حساسًا للكتابة فقط.

**الخطوة التالية:** استكمال جرد ومطابقة الحقول لكل Feature، ثم تحديث DTOs والـMappers والـSchemas والاختبارات. لم يتم في هذه المراجعة تعديل كود المصدر أو تنفيذ SQL.


## [2026-09-28 13:42:10 +03:00] — تحقق وتقدم التنفيذ — AI Model: Manus
- فصل ViewModels الانتقالية عن ApiDtos الكاملة لعقود المجالات التي يستهلكها Gateway الحالي.
- نجح typecheck محدود لملفات DTO/Mapper/Schema المستهدفة.
- أضيفت اختبارات عقد الحقول القديمة في `src/data/dtos/legacy-field-contracts.test.ts`؛ لم يُعتمد تنفيذها بعد لأن Vitest/esbuild لا يعملان على mount الحالي بصورة متوافقة.
- **الحالة السابقة:** مفتوحة حين تعذر التحقق على sandbox.

## [2026-09-28 14:08:30 +03:00] — إغلاق المرحلة الرابعة — AI Model: Manus
- اجتاز `npm run check -- --pretty false` على Windows محلياً، وفق نتيجة المستخدم.
- نجحت مجموعة Vitest كاملة: 40 ملفاً ناجحاً، ملف واحد متجاوز من 41؛ واختبار `legacy-field-contracts.test.ts` نجح 9/9.
- طوبقت أعمدة `customers` و`cust_details` و`portal_users` مباشرةً مع مخطط Supabase `public` فقط. صحح توثيق `DATABASE_SCHEMA.md` لقسم `cust_details` وفق المخطط الحي.
- لم يظهر حقل/جدول مرفقات خاص بالعملاء في المصادر القديمة أو المخطط، ولا مفاتيح ملفات في `cust_details.data`. الحقل `attachments` في `src/types.ts` يخص القيود المالية؛ لم تُضف حقول افتراضية بلا مصدر.
- لا تعديل على قاعدة البيانات أو RLS أو Gateways المرحلة الثالثة. **الحالة: مغلقة. الخطوة التالية: المرحلة الخامسة وفق الخطة.**
