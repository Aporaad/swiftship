# تقرير تعارضات بيانات الترحيل

**الحالة:** تقرير قراءة فقط؛ لم يتم تعديل أي صف.
**المصدر:** Supabase project `ejrojwbbflzchasvgexr` بتاريخ 2026-09-27.

## 1. ملخص مؤكد

- تم جرد مفاتيح `data` وأنواعها في الجداول المستهدفة.
- تظهر المفاتيح المالية القديمة في عدة جداول، ولا يجوز نقلها إلى أعمدة جديدة.
- غالبية سجلات العملاء والمناديب والموظفين والمصادر وشركات الشحن لديها `account_id` يطابق الحساب المالي القديم أو كوده.
- `portal_users` يحتوي حالات غير مكتملة ومتعارضة، ولذلك لا يجوز تنفيذ Backfill آلي له.
- لا توجد حالياً أعمدة معيارية كافية لكل الحقول التي تحددها الخطة، لذلك يجب إضافة البنية أولاً ثم Backfill.

## 2. حالات مالية تحتاج معالجة

| الجدول | الحالة | الدليل | الإجراء |
|---|---|---|---|
| customers | تطابق واضح | 5 سجلات تمت معاينتها؛ `account_id` يطابق `financialAccountId` و`financialAccountCode` | يسمح بقاعدة Backfill آلية بعد اختبار شامل |
| couriers | تطابق واضح | 3 سجلات؛ `account_id` يطابق القيم المالية القديمة | يسمح بقاعدة Backfill آلية بعد اختبار شامل |
| employees | تطابق واضح | 4 سجلات؛ `account_id` يطابق القيم المالية القديمة | يسمح بقاعدة Backfill آلية بعد اختبار شامل |
| assets | تطابق واضح | سجل واحد؛ `account_id` يطابق المرجع المالي القديم | يسمح بعد التحقق |
| sources | تطابق واضح | 8 سجلات؛ `account_id` يطابق المرجع القديم والكود | يسمح بعد التحقق |
| shipping_companies | تطابق واضح | 18 سجلاً؛ `account_id` يطابق المرجع القديم والكود | يسمح بعد التحقق |
| expenses | تطابق في السجل الحالي | `account_id` موجود ومطابق للقيم القديمة | لا ينفذ عليه حذف أو تحويل قبل قرار نطاق المصروفات |
| portal_users | تعارض/نقص | بعض السجلات تحمل `linked_acc_id` بصيغة `acc_1130_0084`، وبعضها `account_id` فارغ أو غير موحد، وبعضها مرتبط بعميل | يمنع Backfill آلي؛ إعداد خريطة يدوية لكل سجل |

## 3. حالات أسماء

- `customers`, `couriers`, `employees`, و`portal_users` تحتوي `fullName` داخل `data`.
- `assets` تحتوي `nameAr` و`nameEn`.
- `sources` تحتوي `name` و`source_name` بالقيم نفسها في السجلات المفحوصة.
- `shipping_companies` تعتمد حالياً على العمود `name`، ولا يمكن افتراض أن الاسم عربي أو إنجليزي آلياً.
- `customers` تحتوي اختلافات `gpsLocation` و`gps_location`.
- `customers` تحتوي اختلافات `joinBy` و`join_by` و`referrerId` و`referrer_id`، مع وجود قيم null.
- `couriers` تحتوي `level` و`levels`، ويجب مقارنة القيم قبل اعتماد `courier_level`.
- `employees` تحتوي `jobsType` بقيم نصية وnull، ويجب الحفاظ على null وعدم تحويله إلى قيمة مصطنعة.

## 4. حقول مركبة لا تنقل كأعمدة مباشرة

توجد حقول object أو array تحتاج تصميماً مستقلاً:

- `activity_logs.details`
- `assets.maintenanceLogs`
- `auto_entries.amountSources`, `auto_entries.debitAccount`, `auto_entries.creditAccount`
- `cust_details.acquisitionSource`, `bodyDetails`, `location`, `preferredCategories`
- `notifications.associatedUserIds`
- `orders.firedTriggers`
- `portal_tickets.replies`
- `report_templates.filters`
- `roles.permissions`
- إعدادات `settings` مثل `config`, `templates`, `triggers`, و`packaging`
- `user_settings.visibleMetrics`

لا يجوز تفكيك هذه الحقول قبل تثبيت شكلها واستخداماتها وعلاقتها بالصلاحيات.

## 5. بيانات حساسة

- `browser_pages.data` يحتوي `username` و`password`.
- `portal_users.data` يحتوي `password` في بعض السجلات.
- `settings.data` يحتوي `apiKey`.

لا يتم نسخ هذه القيم إلى تقارير عامة أو DTOs أو أعمدة مكشوفة. يجب تصميم نقل الأسرار في مرحلة أمنية مستقلة.

## 6. قرار الترحيل

الحالات التي يمكن ترحيلها آلياً مبدئياً: الحقول المباشرة ذات النوع الواضح، بعد إضافة الأعمدة والتحقق من عدم وجود تعارض. الحالات المالية القديمة لا تتحول إلى أعمدة جديدة. حالات `portal_users`، الحقول المركبة، والأسرار تبقى خارج Backfill الآلي حتى اعتماد قواعدها.
