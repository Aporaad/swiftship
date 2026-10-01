# جاهزية المرحلة 11 — تنظيف الأنواع والحقول

## نطاق هذه الجولة

تبدأ المرحلة 11 بالترتيب المحدد في الخطة: **أسماء Features ثم أسماء DTOs**. لم يتم الانتقال إلى معرفات الكيانات أو الحالات أو التواريخ أو العملات العامة أو Pagination أو الأخطاء أو الصلاحيات.

## جرد أسماء Features

مجلدات `src/features` الحالية تستخدم مزيجًا من أسماء مفردة وجمعية وصيغ camelCase، منها `auth`, `browser`, `accounting`, `customers`, `orders`, `shipments`, `financeEntries`, و`siteManagement`. لا توجد في هذه الجولة إعادة تسمية للمجلدات أو المسارات؛ لأن ذلك يوسّع نطاق التغيير إلى routing وimports وملفات الاختبارات دون عقد بديل مثبت. سُجلت `financeEntries` و`siteManagement` كدين تسمية مستقل، مع الحفاظ على المسارات الحالية حتى تُعتمد خريطة أسماء canonical ومهاجر واحد.

## أول عقد DTO/View مشترك منفذ

ظهرت تعريفات متكررة ومتطابقة للأنواع التالية في نماذج المالية:

- `FinanceAccount` في `EntryWorkspaceTab`, `EntryForm`, `GeneralEntryForm`, `CompoundEntryForm`, و`VoucherEntryForm`.
- `FinanceCurrency` و`FinanceModule` و`FinanceEntryType` في النماذج نفسها.
- `FinanceCurrencyOption` في الحاسبة كان نفس شكل خيار العملة مع اختلاف اختياري في `isDefault`.

تم تثبيت العقد canonical في:

```text
src/shared/contracts/finance.contracts.ts
```

ثم نُقلت كل المستوردات إلى العقد المشترك من دون إبقاء aliases عامة في ملفات النماذج. أُبقي `balance` اختياريًا لأنه مستخدم في عرض حسابات السند فقط، وجُعل `isDefault` اختياريًا لأن الحاسبة تستقبل خيارات عملة لا تضمن هذا الحقل.

> هذه الأنواع عقود View مشتركة، وليست Database Rows أو Write DTOs. بقيت DTOs الموجودة في `src/data/dtos` منفصلة عن مكونات React وفق قاعدة الخطة.

## قواعد لم تُفعل بعد

إعداد `tsconfig.json` الحالي لا يصرح بـ`strict: true`، لذلك لم يتم تفعيله ضمن جولة أسماء/DTOs حتى لا تُخلط أخطاء انتقالية واسعة مع هذا التغيير المحدود. سيُعالج كخطوة مستقلة بعد تثبيت بقية عقود DTOs. كما لم تُغيّر حقول DB القديمة ولم تُنشأ aliases موزعة؛ أي انتقال Legacy Row → Canonical DTO سيبقى عبر mappers الموجودة.

## التحقق

- `npm run check`: ناجح.
- اختبارات DTO و`PermissionGate`: 20 اختبارًا ناجحًا في 4 ملفات.
- لا SQL ولا تغييرات قاعدة بيانات/RLS.

## الخطوة التالية

استكمال جرد أسماء DTOs في `src/data/dtos` و`src/data/dtos/mappers`، مع التركيز على الاختلافات بين `DatabaseRow`, `ApiDto`, `ViewModel`, و`Payload` قبل أي إعادة تسمية.


---

## جرد DTOs والـmappers — 2026-10-01 04:10 +03:00 — AI Model: Manus

تمت مراجعة جميع ملفات `src/data/dtos` وفهرس التصدير و`src/data/dtos/mappers/feature.mappers.ts` واختبارات `legacy-field-contracts`. التصنيف الحالي واضح: `DatabaseRow` تمثل أسماء أعمدة المصدر، و`ApiDto` تمثل camelCase بعد التحويل، و`ViewModel` تمثل عقد القراءة الخاص بالبوابة، و`CreateInput`/`UpdateInput` تمثل عقود الكتابة. الـPayloads التي تخص JSON داخل صفوف legacy بقيت داخل DTO الخاص بالميزة، بينما Payloads التشغيل القديمة في الخدمات/compatibility adapter سجلت كدين انتقال مستقل ولم تُخلط مع API DTO.

### التغييرات المنفذة

1. إزالة aliases غير المستخدمة `ReportsApiDto` و`ReportsDatabaseRow` وربط `ReportsViewModel` مباشرة بـ`ReportTemplateApiDto`.
2. إزالة alias `ShipmentsDatabaseRow` غير المستخدم، مع الإبقاء على `ShipmentDatabaseRow` و`ShipmentsApiDto` كعقدين منفصلين.
3. إزالة alias `FinanceEntriesViewModel` غير المستخدم.
4. توحيد `FinanceEntriesDatabaseRow` إلى `FinanceEntryDatabaseRow` ليتطابق مع `FinanceEntryApiDto`، وتحديث mapper واختبار حدود الحقول.
5. إضافة return type صريح `CustodyAdvanceApiDto` إلى `mapCustodyAdvanceRowToDto` لمنع خروج نوع inferred غير موثق.

لم تُعد تسمية كل DTOs الجمعية دفعة واحدة لأن بعضها يمثل مورد جدول/Collection (`UsersDatabaseRow`, `OrdersDatabaseRow`, `ShipmentsApiDto`) بينما DTO الناتج مفرد، ويحتاج القرار إلى convention مكتوب وخريطة migration حتى لا تتكسر عقود الميزات. لم تُنشأ aliases جديدة موزعة.

### نقاط migration debt المسجلة

- `OrdersWritePayload = Record<string, unknown>` داخل compatibility adapter ما زال مقصودًا لكتابات legacy متعددة الكيانات، ولا يجوز تحويله إلى `OrderCreateInput` لأن نفس العقد يخدم shipment/item/settings.
- `OrderFeatureRecord` و`ShipmentFeatureRecord` يحتفظان مؤقتًا بحقوق legacy snake_case مع camelCase داخل adapter؛ تحويلهما يتطلب Mapper واحدًا ثم ترحيل المستهلكين، وسيُنفذ في خطوة مستقلة بعد تثبيت naming convention.
- بعض Payloads التشغيلية في الخدمات (`FinancialEntryInput`, `PortalUserPayload`, `TrackingSyncInput`) ليست API DTOs؛ بقيت عند حدود الخدمة ولم تُنقل قسرًا إلى `src/data/dtos`.
- `strict: true` لم يُفعل بعد، لأنه خطوة مستقلة واسعة بعد تثبيت عقود DTOs.

### التحقق

- `npm run check`: ناجح.
- اختبارات `src/data/dtos`: 15 اختبارًا ناجحًا في 3 ملفات.
- المجموعة الكاملة السابقة بعد عقد المالية: 214 اختبارًا ناجحًا و8 متخطاة، والبناء ناجح.
- لا SQL ولا تغييرات قاعدة بيانات/RLS.

الخطوة التالية داخل المرحلة 11 هي الانتقال بالترتيب إلى **معرفات الكيانات** بعد تثبيت convention الأسماء، مع عدم إعادة تعريف DTOs أو تمرير Database Rows إلى React.
