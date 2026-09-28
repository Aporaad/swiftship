# سجل تنفيذ خطة SWIFTSHIP_SYSTEM

## نقطة الحالة — 2026-09-27

تم تنفيذ مراحل تطبيع مخطط قاعدة البيانات وإعادة الهيكلة المالية تدريجيًا على Supabase، مع إبقاء مصدر الحقيقة المالي في الجداول الجديدة وعدم اختلاق أرصدة أو أسعار صرف.

### ما تم إنجازه سابقًا

- توحيد أسماء الأعمدة إلى `snake_case` وتطهير حقول JSON من الحقول المكررة.
- إنشاء شجرة الحسابات والحسابات الورقية والحسابات الافتراضية وتوحيد معرفات الحسابات.
- إنشاء `entry_module`, `entry_type`, `main_entry`, `account_trans`, و`custody_advances`.
- نقل القيود القابلة للتحقق إلى النموذج الجديد، وربط الأرصدة بـ`account_trans.amount`.
- تحديث خدمات القيود والأتمتة والصلاحيات والتقارير الأساسية.
- حذف `expenses` سابقًا ضمن النطاق المؤكد، دون حذف القيود الجديدة.
- تطبيق الهجرات `202609270004` إلى `202609270007` الخاصة بإزالة مفاتيح JSON المالية القديمة وإصلاح المشغلات بعد حذف `data` من الكيانات.
- تطبيق خريطة `portal_users` وتحديث الخدمة والواجهات لاستخدام `account_id` و`linked_customer_id` بدل الروابط القديمة.

### تنظيف expenses والقطع النهائي

أكد الفحص الحي قبل الحذف أن الجداول `expenses`, `journal_entries`, و`account_transactions` غير موجودة أصلًا، ولا توجد قيود FK تشير إليها. كانت الحالة الجديدة: `main_entry=15`, `account_trans=31`, و`custody_advances=0`.

تم تنظيف `src/components/FinanceAccounting.tsx` من عمليات القراءة والكتابة والحذف إلى `expenses`. أصبحت قراءة العهد من `custody_advances`، وتسوية العهدة تحدث في `custody_advances`، وتوريد تحصيلات المندوب وتحصيل العميل يسجلان عبر `financialAccountService.recordTransaction`. أزيل تمرير `expenses` من `src/pages/Accounting.tsx`، كما أزيلت حقول الحساب المالية القديمة من مسارات المركز المالي.

طُبقت Migration `202609270009_drop_legacy_financial_tables_after_cutover` بنجاح بصيغة idempotent:

```sql
DROP TABLE IF EXISTS public.journal_entries;
DROP TABLE IF EXISTS public.account_transactions;
```

نتيجة التحقق بعد التطبيق: `expenses_exists=0`, `journal_entries_exists=0`, `account_transactions_exists=0`, مع بقاء النموذج الجديد وسجلاته دون حذف.

### قيود التحقق البيئي

تعذر إكمال فحص TypeScript وVitest من Linux على مجلد Windows المركب بسبب تعليق أدوات Node/TypeScript والمهلة. يجب تشغيل `npm run check`, `npm test`, و`npm run build` من Windows الأصلي قبل اعتماد التسليم النهائي.

## 2026-09-27 08:59 — تدقيق الخطة وتطبيع الحقول
- طُبقت Migration 010 و011 للحقول التي ثبتت قيمها، مع إبقاء الأعمدة العامة التي ما زال عقد التطبيق يعتمد عليها.
- أزيلت مراجع `journal_entries` و`account_transactions` من المحول، وتأكد المخطط الحي من غياب الجداول.
- تحقق مالي حي: لا orphan lines، لا orphan accounts، ولا unbalanced entries.
- فحص TypeScript يعمل من Windows الأصلي بسبب بطء المجلد المركب في Linux.
2026-09-27 09:31: إصلاح دالة توازن القيود متعددة العملات.
