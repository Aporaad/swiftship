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
