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


## بدء خطوة معرفات الكيانات — 2026-10-01 04:12 +03:00 — AI Model: Manus

وفق الترتيب الإلزامي، بدأ بند معرفات الكيانات بعد إغلاق جرد DTOs والـmappers. أُضيف `src/shared/contracts/identifiers.ts` بعقود `EntityId` و`NumericEntityId` والأنواع الاختيارية، وربطت بها عقود المالية المشتركة دون تغيير النوع الفعلي أو runtime. لم تُعدّل أعمدة قاعدة البيانات ولم تُمرر Database Rows إلى React.

هذه الخطوة لا تغلق المرحلة 11 كاملة بعد؛ البنود المتبقية بالترتيب هي الحالات، التواريخ، العملات والمبالغ، Pagination، الأخطاء، والصلاحيات، ثم تفعيل قواعد TypeScript تدريجيًا بعد معالجة `any` في Auth/Orders/Accounting.

التحقق: `npm run check` ناجح، واختبارات DTO والمكونات المشتركة 20/20 ناجحة.


## بند الحالات والتواريخ والعملات والمبالغ — الجولة الأولى — 2026-10-01 04:18 +03:00 — AI Model: Manus

تم إنشاء `src/shared/contracts/value-primitives.ts` لتثبيت حدود القيم الخارجية دون تغيير قيم legacy داخل النظام. يحتوي العقد على `IsoDateString` للتاريخ date-only بصيغة `YYYY-MM-DD` مع تحقق تقويمي فعلي، و`CurrencyCode` مع تطبيع uppercase والتحقق من الرمز، و`Amount` مع قبول الأرقام finite فقط، و`StatusCode` مع trim فقط للحفاظ على الحالة العربية/الإنجليزية كما هي.

تم تصدير المطبعّات من `src/data/dtos/common.dto.ts` حتى تستخدمها حدود DTO بدل نسخ parsing محلية. لم يتم فرض Union عام للحالات لأن الجرد أثبت وجود مجموعات مستقلة: حالات الطلب والشحن بالعربية والإنجليزية، حالات الدفع (`Paid`/`Partial Paid`/`Unpaid`)، حالات الترحيل (`draft`/`posted`/`voided`)، وحالات الاعتماد. توحيدها في قيمة واحدة الآن سيغير سلوكًا تجاريًا؛ لذلك تم تثبيت primitive محافظ أولًا.

اختبارات الحدود: 19/19 ناجحة، وTypeScript check ناجح. لم تُنفذ SQL أو Migratons. ما زال ترحيل DTOs المحددة إلى primitives مفتوحًا وسيتم تنفيذه مجموعةً مجموعةً بعد مطابقة الحقول، مع عدم تحويل timestamps إلى date-only أو العكس.


## ترحيل DTOs الأول وتوحيد نطاق الاعتماد — 2026-10-01 04:21 +03:00 — AI Model: Manus

نُقل DTO الشحن تدريجيًا عبر فصل `ShipmentSupplementalData` الخاص بالـpayload المرن عن `ShipmentSupplementalViewData` الخاص بالعرض. حقول `shippingDate` و`expectedArrival` و`deliveryDate` في شكل العرض أصبحت `IsoDateString | null`، ويقوم `mapShipmentsRowToDto` باستخدام `isoDateOrNull` بدل تمرير نص خام. بقي شكل الإدخال مرنًا حتى لا تتأثر نماذج HTML أو payloadات legacy.

بدأ توحيد نطاق الحالات المستقل للاعتماد بإضافة `ApprovalStatus` بقيم `approved | pending_approval | rejected`، وتضييق `PortalUserApiDto` و`PortalUserCreateInput` إليه. يقوم mapper بتحويل القيمة غير المعروفة إلى null بدل معاملتها كاعتماد صالح. لم تُخلط هذه القيم مع حالات الطلب أو الدفع أو الترحيل.

التحقق: `npm run check` ناجح، الاختبارات الكاملة 219 ناجحًا و8 متخطاة، والبناء ناجح مع تحذيرات البنية السابقة فقط. لا SQL أو تغييرات قاعدة بيانات.


## توحيد نطاقات PostingStatus وPaymentStatus وOrder/ShipmentStatus — 2026-10-01 04:27 +03:00 — AI Model: Manus

أُضيفت النطاقات المستقلة التالية إلى عقد القيم: `PostingStatus` بقيم `draft | posted | voided`، و`PaymentStatus` بقيم `Paid | Partial Paid | Unpaid`، و`OrderStatus` و`ShipmentStatus` كقيم نصية branded تحفظ أسماء الحالات الديناميكية العربية والإنجليزية القادمة من جدول `order_status`.

تم تضييق `FinanceEntryApiDto.postingStatus` و`OrderApiDto.paymentStatus/status` و`ShipmentsApiDto.status`، مع إبقاء Database Rows وpayloadات النماذج legacy نصية عند الحاجة. المطبعات تدعم aliases الدفع lowercase/underscore وتعيد القيمة canonical، بينما ترفض PostingStatus غير المعروف. تم ربط `FinancialPostingStatus` بالخطة canonical مع إبقاء `voided` نتيجة lifecycle لا حالة إنشاء عادية.

تم تحديث mappers المالية والطلبات والشحن، وإضافة اختبارات الحالات. التحقق: check ناجح، 221 اختبارًا ناجحًا و8 متخطاة، والبناء ناجح مع تحذيرات البناء السابقة فقط. لا SQL أو تغييرات قاعدة بيانات.


## ترحيل CurrencyCode وأدوار المبالغ — 2026-10-01 04:33 +03:00 — AI Model: Manus

أضيفت primitives مستقلة: `CurrencyCode`، `OriginalAmount`، `ConvertedAmount`، و`ExchangeRate`. تم توفير مطبعات تتحقق من الأرقام finite، وترفض سعر الصرف غير الموجب، ولا تخلط المبلغ الأصلي بالمحوّل.

تم تطبيقها تدريجيًا على حدود DTOs التالية: `FinanceEntryLineDto.amount` أصبح `ConvertedAmount`، و`originalAmount` أصبح `OriginalAmount`، و`conversionRate` أصبح `ExchangeRate`; كما أصبح `FinanceEntryPaymentDetailDto.originalAmount` من نوع `OriginalAmount`. تم تضييق `AccountingApiDto.currencyCode` و`CurrencyApiDto.code` و`OrderApiDto.currency` إلى `CurrencyCode` مع إبقاء معرفات العملات الرقمية منفصلة عن الرموز النصية.

تم تحديث mappers لاستخدام المطبعّات وعدم اختراع fallback لرمز العملة، مع إبقاء Database Rows وpayloadات legacy العامة دون تغيير. التحقق: check ناجح، 222 اختبارًا ناجحًا و8 متخطاة، والبناء ناجح مع تحذيرات البناء السابقة فقط. لا SQL أو تغييرات قاعدة بيانات.


## إكمال ترحيل CustodyAdvance وOrders/Products — 2026-10-01 04:38 +03:00 — AI Model: Manus

تم ترحيل `CustodyAdvanceApiDto` إلى `OriginalAmount` للحقول `amountOriginal` و`amountSettled` و`amountOutstanding`، مع إبقاء `currencyOriginalId` كمعرف رقمي مستقل. تم ترحيل إجماليات `OrderApiDto` إلى `Amount`، وحقول مبالغ العرض في `ProductsApiDto` و`ProductCategoryApiDto` و`OrderItemApiDto` و`ReturnedProductApiDto` إلى `Amount`، ورموز العملات إلى `CurrencyCode` حيث يوجد رمز فعلي.

أعيدت mappers لاستخدام `amountOrNull` و`originalAmountOrNull` و`currencyCodeOrNull`، ولم تتم إعادة تسمية الحقول legacy أو اعتبار مبلغ منفرد converted/original بلا دليل من قاعدة البيانات. لا توجد حقول converted فعلية في Orders/Products يمكن فصلها بأمان في الجولة الحالية.

التحقق: check ناجح، الاختبارات الكاملة 222 ناجحًا و8 متخطاة، والبناء ناجح. لا SQL أو تغييرات قاعدة بيانات.

### تدقيق الإغلاق الإجرائي

أظهر فحص قواعد المرحلة أن `strict: true` غير مفعّل وأن strict override ينتج 238 خطأً، كما يوجد 436 تطابقًا لـ`any` في النطاق الموسع. لذلك لا يمكن إعلان المرحلة 11 مكتملة بالكامل أو الانتقال إلى المرحلة 12 دون تنفيذ تنظيف واسع مستقل للـstrict/any؛ تم إبقاء هذه البنود مفتوحة بدل إخفائها أو ادعاء إنجازها.


## دفعة strict/any وعقود UI المشتركة — 2026-10-01 04:46 +03:00 — AI Model: Manus

تم تثبيت baseline strict جديد: انخفضت أخطاء `tsc --strict` من 238 إلى 220 بعد إضافة `@types/react-dom`. أضيفت عقود مشتركة في `src/shared/contracts/ui.contracts.ts` لـ`PaginationMeta` و`PaginationState` و`AsyncState` و`ErrorDetails`، مع `createPaginationMeta` و`errorDetailsFromUnknown` واختبارات مستقلة (10 اختبارات ناجحة). كما أزيل catch صريح من نوع `any` في OrdersPage واستُخدم `unknown` مع فحص `instanceof Error`.

لا يزال تفعيل strict الكامل غير آمن حتى معالجة 220 خطأ متبقيًا؛ لم يتم تعديل tsconfig لإخفاء الأخطاء.


## دفعة nullability وdead-code — 2026-10-01 04:52 +03:00 — AI Model: Manus

أصلحت nullability في `server/jobs/tracking-sync.ts` باستخدام guards محلية، وحولت catches إلى `unknown`. أصلحت فرعًا مستحيلًا في `server/routes/tracking.ts` كان يجعل `externalResult` من نوع `never` تحت strict، وأزلت payload/catch من نوع any. انخفض strict baseline من 220 إلى 208 خطأ. لم يتم تفعيل strict بعد، وما زالت أخطاء implicit-any في مكونات Orders/Accounting وغيرها تتطلب نماذج domain typed فعلية.
