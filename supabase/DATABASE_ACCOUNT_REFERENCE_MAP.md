# خريطة مراجع الحسابات المالية

**الحالة:** قراءة وتحليل فقط؛ لا يوجد Backfill منفذ.

## القاعدة الموحدة

`account_id` هو المرجع المالي الوحيد في التصميم المستهدف. لا تنشأ أعمدة `financial_account_id` أو `financial_account_code` أو `financial_balance`.

## خريطة الكيانات

| الكيان | المرجع الحالي | المرجع القديم داخل data | القاعدة المستهدفة |
|---|---|---|---|
| customers | `customers.account_id` | `financialAccountId`, `financialAccountCode`, `financialBalance` | اعتماد `account_id` فقط |
| couriers | `couriers.account_id` | نفس المفاتيح | اعتماد `account_id` فقط |
| employees | `employees.account_id` | نفس المفاتيح | اعتماد `account_id` فقط |
| assets | `assets.account_id` | نفس المفاتيح | اعتماد `account_id` فقط |
| sources | `sources.account_id` | نفس المفاتيح | اعتماد `account_id` فقط |
| shipping_companies | `shipping_companies.account_id` | نفس المفاتيح | اعتماد `account_id` فقط |
| expenses | `expenses.account_id` | `financialAccountId`, `financialAccountCode` | اعتماد `account_id`، مع إبقاء الإرث مؤقتاً |
| salary_history | `salary_history.account_id` | `accountCode` | لا يستبدل `account_id` بالكود |
| orders | `order_party_account_id` | `customerAccountId`, `orderPartyAccountId`, وحقول الدفع | تمييز حساب الطرف عن حساب الصندوق والبنك |
| auto_entries | `debit_account_id`, `credit_account_id` مستهدفان | `debitAccount`, `creditAccount` ككائنات | استخراج معرفات لا نسخ الكائنات |
| portal_users | `linked_acc_id` وبيانات قديمة | `linkedAccId`, `financialAccountId`, `financialAccountCode` | يحتاج خريطة يدوية لكل صف |

## تحقق إلزامي قبل Backfill

1. وجود الحساب في `public.accounts`.
2. كون الحساب نشطاً وقابلاً للترحيل عند انطباق القاعدة.
3. عدم اختلاف `account_id` عن المرجع القديم إلا مع تسجيل تعارض.
4. عدم استخدام `financialBalance` لتحديث رصيد الحساب.
5. عدم إنشاء حساب جديد بسبب قيمة JSON قديمة قبل مراجعة الحالة.

## نتيجة الجرد الحالية

- الكيانات التشغيلية الرئيسية خارج `portal_users` تظهر تطابقاً واضحاً بين `account_id` والقيم المالية القديمة في السجلات الحالية المفحوصة.
- `portal_users` يحتوي معرفات بصيغ مثل `acc_1130_0084` وحالات `account_id` فارغة أو مرتبطة بعميل؛ لا يسمح بالتحويل الآلي.
- الأرصدة القديمة لا تعتبر مصدر حقيقة؛ مصدر الرصيد هو نموذج القيود المعتمد في الخطة المالية.
