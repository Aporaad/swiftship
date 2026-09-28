# خريطة ترحيل حقول قاعدة البيانات

**الحالة:** مسودة تنفيذية مبنية على جرد قراءة فقط بتاريخ 2026-09-27. لا تمثل هذه الوثيقة Migration منفذة.

## قواعد ملزمة

- لا حذف لحقول `data` أو الأعمدة القديمة في هذه المرحلة.
- لا إنشاء لأي عمود باسم `financial_account_id` أو `financial_account_code` أو `financial_balance`.
- المرجع المالي المستهدف هو `account_id` فقط.
- كل تعارض يسجل في `DATABASE_DATA_CONFLICTS.md` قبل أي Backfill.
- لا يتم تحويل قيمة JSON إلى عمود إلا بعد التحقق من النوع والمعنى ووجود قاعدة مصدر حقيقة.

## خريطة الحقول ذات الأولوية

| الجدول | مسار JSON القديم | الوجهة المستهدفة | النوع المقترح | القاعدة | الحالة |
|---|---|---|---|---|---|
| customers | `fullName` | `full_name` | text | نقل الاسم التشغيلي كما هو، ثم اعتماد `name_ar/name_en` بعد مراجعة اللغة | يحتاج إضافة عمود |
| couriers | `fullName` | `full_name` | text | نفس قاعدة الأشخاص | يحتاج إضافة عمود |
| employees | `fullName` | `full_name` | text | نفس قاعدة الأشخاص | يحتاج إضافة عمود |
| portal_users | `fullName` | `full_name` | text | للاستخدام المستقبلي فقط؛ لا تعديل للموقع الآن | يحتاج قرار تكامل |
| assets | `nameAr` | `name_ar` | text | نقل مباشر بعد فحص التعارض | يحتاج إضافة عمود |
| assets | `nameEn` | `name_en` | text | نقل مباشر بعد فحص التعارض | يحتاج إضافة عمود |
| sources | `name` / `source_name` | `name_ar` أو `name_en` | text | لا يمكن تحديد اللغة آلياً لكل قيمة؛ يلزم تصنيف | يحتاج مراجعة |
| shipping_companies | `name` | `name_ar` أو `name_en` | text | يلزم تحديد لغة الاسم، ولا ينسخ تلقائياً | يحتاج مراجعة |
| shipping_companies | `shippingCompanyUrl` | `shipping_company_url` | text | توحيد الاسم بعد فحص العمود الحالي | آمن بعد التحقق |
| shipping_companies | `trackingIDPrefix` / `trackingID_prefix` | `tracking_id_prefix` | text | دمج مع كشف اختلاف القيم | يحتاج تعارضات |
| couriers | `courierType` | `courier_type` | text | نقل مباشر بعد اعتماد القيم | يحتاج إضافة عمود |
| couriers | `level` / `levels` | `courier_level` | text | مقارنة القيمتين، وعدم الاختيار عند التعارض | يحتاج تعارضات |
| couriers | `commissionRate` | `commission_rate` | numeric | تحقق من المجال والوحدة | يحتاج إضافة عمود |
| employees | `jobsType` | `job_type` | text | توحيد الاسم، مع معالجة القيم null | يحتاج إضافة عمود |
| employees | `monthlySalary` | `monthly_salary` | numeric | مقارنة مع العمود الحالي | موجود جزئياً |
| employees/couriers/customers | `disabled` | `is_active` | boolean | `is_active = NOT disabled` فقط بعد إثبات المعنى | يحتاج تحقق |
| customers | `gpsLocation` / `gps_location` | `gps_latitude`, `gps_longitude` | numeric pair | لا يمكن تحويل النص دون محلل شكل ومراجعة | يحتاج جدول/محلل |
| portal_users | `linkedCustomerId` | `linked_customer_id` | text FK | تحقق من وجود customer_id قبل الربط | يحتاج FK لاحقاً |
| portal_users | `linkedAccId` | `account_id` | text FK | لا يعتمد وحده؛ يقارن مع `linked_customer_id` وحساب العميل | يحتاج تعارضات |
| expenses | `createdByUid` | `created_by` | text FK | النقل فقط إذا وجد المستخدم | يحتاج إضافة/تحقق |
| salary_history | `employeeId` | `employee_id` | text FK | تحقق من وجود الموظف | يحتاج FK لاحقاً |
| salary_history | `accountCode` | لا ينقل كمرجع | — | المرجع الوحيد هو `account_id` | حذف بعد التحقق |
| auto_entries | `debitAccount` | `debit_account_id` | text FK | استخراج معرف الحساب من الكائن لا نسخ الكائن | يحتاج تحليل شكل |
| auto_entries | `creditAccount` | `credit_account_id` | text FK | استخراج معرف الحساب من الكائن لا نسخ الكائن | يحتاج تحليل شكل |
| auto_entries | `amountSource` / `amount_source` | `amount_source` | text | اختيار المصدر الحديث بعد مقارنة القيم | يحتاج تعارضات |
| auto_entries | `amountSources` / `amount_sources` | `amount_sources` | jsonb/array | اعتماد الشكل الحديث بعد فحص العناصر | يحتاج تحليل عناصر |
| notifications | `associatedUserIds` | `associated_user_ids` | text[] أو جدول فرعي | يحدد لاحقاً حسب استعلامات الاستخدام | يحتاج قرار بنيوي |
| roles | `permissions` | JSONB مخصص أو RBAC فرعي | jsonb/جدول | لا يفكك قبل اعتماد نموذج الصلاحيات | يحتاج قرار أمني |
| portal_tickets | `replies` | جدول ردود أو JSONB مخصص | jsonb/جدول | لا يستخدم `data` العام كمصدر دائم | يحتاج تصميم |
| report_templates | `filters` | JSONB مخصص أو جدول فلاتر | jsonb/جدول | يلزم تثبيت شكل الفلاتر | يحتاج تصميم |
| settings/user_settings | مفاتيح الإعدادات | تصنيف إعدادات | متنوع | فصل secret/feature_flag/ui_preference/integration_config | يحتاج تصنيف |
| browser_pages | `username`, `password` | مخزن أسرار منفصل | حساس | لا يظهر في DTOs العامة | يحتاج مسار أمان |
| settings | `apiKey` | سر خارج جدول الإعدادات العامة | secret | لا يدرج في خرائط الحقول العامة | يحتاج نقل آمن |

## المفاتيح المالية القديمة

تظهر في `customers`, `couriers`, `employees`, `assets`, `sources`, `shipping_companies`, `expenses`, و`portal_users` مفاتيح مثل `financialAccountId`, `financialAccountCode`, و`financialBalance`. لا تنقل إلى أعمدة جديدة. يتم فقط:

1. مقارنة المرجع القديم مع `account_id`.
2. تسجيل المطابقة أو التعارض.
3. الاعتماد على `account_id` بعد التحقق.
4. إزالة المفاتيح القديمة في مرحلة الحذف النهائية فقط.
