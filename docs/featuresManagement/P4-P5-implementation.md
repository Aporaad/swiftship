# P4-P5 — تنفيذ أساس features-management

- **التاريخ:** 2026-10-20 04:36 (+03:00)
- **النموذج:** Manus
- **النطاق:** Drizzle schema، migrations، RBAC seed، وحدة `alx_api/src/modules/features-management`، bootstrap wiring، واختبارات schemas.

## P4 المنفذ

تم إنشاء `alx_api/src/db/features-schema.ts` وربطه بكتالوج `src/db/schema.ts`. يغطي المخطط جداول المسابقات والجوائز وربط الجائزة بالمسابقة والمشاركات وعمليات السحب وتخصيصات الفائزين وقواعد الكوبونات وإصداراتها واسترداداتها وسجل التدقيق.

تم إنشاء وتطبيق:

- `0048_features_management_foundation.sql`
- `0049_features_draws_and_awards.sql`

تحتوي الترحيلات على المفاتيح الأساسية، العلاقات، الفهارس، uniqueness، قيود الحالة والتاريخ والمخزون وقيم الخصم، كما أضافت ست صلاحيات `features.*` وأسندتها إلى دور `admin`.

تم التحقق حيًا من وجود الجداول العشرة والصلاحيات الست وإسنادها لدور `admin`.

## P5 المنفذ

تم إنشاء وحدة منفصلة عن UI ومنطق كوبون شراء الشركة، وتتضمن:

- `features-management.contracts.ts`
- `features-management.schemas.ts`
- `features-management.service.ts`
- `features-management.repository.ts`
- `features-management.routes.ts`
- `features-management.factory.ts`

الـ routes الحالية تغطي أساس القوائم والإنشاء للمسابقات والجوائز وقواعد الكوبونات، مع pagination، Zod strict validation، permission guards، standard response envelope، وفصل repository/service عن HTTP.

تم ربط الوحدة في `app.ts` و`server.ts`، وإضافة اختبار schema مستقل.

## التحقق

- `npm run check`: ناجح.
- `npm test -- --runInBand`: ناجح بعد الإصلاح السابق: 51 suite و453 اختبارًا.
- Prettier: تم تشغيله على ملفات P4-P5.

## الانحراف المعتمد

بناءً على أمر المالك في 2026-10-20 04:28 (+03:00)، تم تجاوز مراجعة RLS وdry-run وتطبيق migrations مباشرة على Supabase. الجداول الجديدة حاليًا دون RLS، ولا ينبغي فتح endpoints العميل أو اعتبار الميزة جاهزة للإطلاق العام قبل معالجة ذلك في مرحلة أمنية لاحقة.

## المتبقي بعد P5

تنفيذ CRUD والتحولات التفصيلية للمسابقة، المشاركة customer-scoped، تجميد/اعتماد السحب، fulfillment، إصدار واسترداد الكوبونات، دمج `couponCode` مع quote/create في P9، ثم واجهات النظام الأساسي والبوابة واختبارات التكامل والأمن.
