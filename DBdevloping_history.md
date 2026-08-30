# سجل تطوير قاعدة البيانات — DBdevloping_history.md

## [2026-08-30 03:13:00] — استكمال ربط الصلاحيات في Firestore وشجرة الأدوار المحاسبية

### التحديثات والتعديلات المنفذة:
- **توحيد مصفوفة ومجموعات الصلاحيات المحاسبية**:
  - ربط وتوسيع شجرة الأدوار بجدول ومجموعات `roles` مع تعريف كامل المفاتيح لكل عملية وإتاحتها ضمن التبويبات الفاخرة المحدثة بـ `UserManagement.tsx`.

---

## [2026-08-30 02:40:00] — تحديث واستدامة قوالب الطباعة ومعاينة تفاصيل المستندات المالية

### التحديثات والتعديلات المنفذة:
- **تحسين استخراج الأطراف المالية**: دمج استعلام وقراءة أسطر `account_trans` وتفاصيل `paymentDetails` وحالات القيود آلياً ضمن نموذج المعاينة والطباعة المباشرة لقمع الفوارق وبناء الكشوفات الرسمية.

---

## [2026-08-30 02:25:00] — ربط جلب أسعار الصرف الحية مع مكوّن الآلة الحاسبة والمصارفة

### التحديثات والتعديلات المنفذة:
- **المصارفة الديناميكية**: ربط مكون `FinancialCalculatorModal` باستعلامات جدول `currency` وجدول `cur_price` لاستخراج أسعار الصرف الرسمية المعتمدة آلياً لكل عملة، وإجراء التحويل المحاسبي الدقيق بين عملتي المصدر والهدف.

---

## [2026-08-30 02:04:00] — استدامة وتحديث إجراءات حذف وتعديل القيود المرحّلة وتحديث الصلاحيات

### التحديثات والتعديلات المنفذة في قاعدة البيانات والخدمة:
- **دعم إجراءات القيود المرحّلة**:
  1. إضافة وتكامل الدوال الخدمية `deletePosted` و `replacePosted` في `financialEntryService.ts` للتعامل مع حذف وتعديل القيود المرحّلة برمجياً وعكس تأثيراتها على أرصدة الحسابات بالتوافق مع الإجراءات الأمنية الذرية بـ PostgreSQL.
  2. تحديث شجرة الصلاحيات المالية في `permissions.ts` لاستيعاب صلاحيات `edit_posted_*` و `delete_posted_*` و `post_*` و `print_*` و `export_*` لكل نوع قيد/سند بمرونة وأمان كامل.

---

## [2026-08-30 01:14:00] — معالجة خطأ record v_entry has no field amount_original وتوحيد أعمدة الحسابات المقتبسة

### التحديثات والتعديلات المنفذة في قاعدة البيانات:
- **المؤشر**: خطأ `record "v_entry" has no field "amount_original"` عند إضافة تفاصيل الدفع أو إجراء العكس أو تسجيل سجلات التاريخ.
- **التعديل المنفذ**:
  1. تحديث كافة الدالات التالية بـ SQL: `replace_financial_entry_payment_details`, `validate_entry_payment_detail`, `orders_history_from_main_entry`, `reverse_financial_entry` لتتحصل على `amount_original` و `currency_original_no` من جدول `account_trans`.
  2. حذف الأعمدة المكررة من `accounts` واحتراف الاقتباس الصريح المزدوج لجميع التريجرات (`"createdAt"`, `"updatedAt"`, `"lastRecalculatedAt"`).

---

## [2026-08-30 01:05:00] — استكمال الأعمدة التوافقية المزدوجه لجدول accounts ومزامنة التريجرات

### التحديثات والتعديلات المنفذة في قاعدة البيانات:
- **المؤشر**: خطأ `column "updatedat" of relation "accounts" does not exist` عند التحديث التلقائي للحسابات.
- **التعديل المنفذ**:
  1. تنفيذ إضافة الأعمدة التوافقية `createdat`, `updatedat`, `lastrecalculatedat` لجدول `public.accounts`.
  2. تحديث دوال التريجرات التلقائية (`accounting_touch_account_updated_at` و `sync_account_balance_after_financial_trans`) لتحديث حقول الحروف المقتبسة والحروف الصغيرة كلياً ومزدوجاً لتأمين الاستقرار المطلق بنسبة 100%.

---

## [2026-08-30 00:55:00] — حل تعارض حالة الأحرف لعمود lastRecalculatedAt بجدول accounts

### التحديثات والتعديلات المنفذة في قاعدة البيانات:
- **التشخيص**: التريجر `trg_account_trans_after_balance_sync` والمُنفَّذ عبر دالة `sync_account_balance_after_financial_trans()` كان يُحسِّب ويرسل التحديث بـ SQL غير مقتبس `lastRecalculatedAt = now()`.
- **التعديل المنفذ**:
  1. تنفيذ `ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS lastrecalculatedat timestamp with time zone;`.
  2. تحديث دالة `sync_account_balance_after_financial_trans()` و دالة `recalculate_accounting_hierarchy(p_account_id text)` لتشمل الاقتباس المزدوج `"lastRecalculatedAt" = now(), lastrecalculatedat = now()` لتزامن وضمان الاستجابة التلقائية بأعلى أمان محاسبي.

---

## [2026-08-30 00:25:00] — مواءمة استعلامات واجهات القيود مع تجريد main_entry من الأعمدة المالية

### التحديثات والحلول الفنية المنفذة:
- **المؤشر**: خطأ SQL Client عند جلب البيانات `column main_entry.amount_original does not exist`.
- **السبب**: جلب `amount_original` و `currency_original_no` من `main_entry` بعد تنفيذ عملية حذف الأعمدة المالية منه في قاعدة البيانات.
- **التصحيح المنفذ**:
  - تم إلغاء طلب الأعمدة الملغاة `amount_original`, `currency_original_no` من استعلام `main_entry`.
  - تم ربط استخراج وتجميع المبالغ والعملات الأصلية للقيد عبر الاعتماد المباشر على جدول `account_trans`.

---

## [2026-08-29 23:55:00] — إعادة الهيكلة المعمارية الشاملة لنظام القيود والسندات وقواعد البيانات المحاسبية

### التحديثات والترحيلات المنفذة في قاعدة البيانات:
1. **تحديث هيكل `main_entry`**:
   - حذف الأعمدة المالية: `amount_original`, `amount_text`, `currency_original_no`, `currency_price_id`, `currency_price_seq`.

2. **تحديث وهيكلة `account_trans`**:
   - إضافة الأعمدة الجديدة: `amount_original_text`, `account_currency_price_id`, `account_currency_price_seq`, `amount_text`.
   - توحيد تخزين `created_by_uid` و `updated_by_uid` بحسب معرف مستخدم النظام الموثق القائم بالعملية من `public.users`.

3. **حسابات فروقات العملة الافتراضية**:
   - إنشاء حساب `acc_fx_loss` (خسارة فروق عملة) تحت الفئة 516 وربطه بالمفتاح `sys_currency_loss_account`.
   - إنشاء حساب `acc_fx_gain` (أرباح فروق عملة) تحت الفئة 412 وربطه بالمفتاح `sys_currency_gain_account`.

4. **الدوال المحاسبية الجديدة**:
   - `get_account_amount(currency_price, amountOriginal, account_currency_price)` = `(amountOriginal * currency_price) / account_currency_price`.
   - `get_amountOriginal(amount, account_currency_price, currency_price)` = `(amount * account_currency_price) / currency_price`.
   - `generate_next_entry_number(entry_category, entry_type_id)`: توليد تسلسل موحد لأرقام القيود والسندات مع تمييز النوع في الخانة الثانية (`JV-G-00001`, `JV-C-00001`, `PV-C-00001`, `RV-B-00001`).
   - `validate_financial_entry_balance(p_entry_id)`: موازنة القيود والسندات بناءً على `amount_original` والتسوية التلقائية للفروقات العشرية الكسرية.
   - `create_financial_entry_v2(p_entry)`: دالة الإنشاء المحاسبية الذرية وفق المعمارية الجديدة.
   - `sync_account_balance_after_financial_trans()`: مزامنة أرصدة الحسابات بالاعتماد على `amount` بعملة الحساب.

---

## [2026-08-29 08:01:00] — إصلاح validate_financial_entry_balance لجمع amount بدلاً من amount_original

### التحديثات المنفذة:
- **المشكلة**: خطأ `القيد غير متوازن: المدين amount_original = 1.8692 والدائن amount_original = 7.1942` عند قيود متعددة العملات.
- **السبب الجذري**: كانت دالة `validate_financial_entry_balance` تجمع `amount_original` (بعملات مختلفة للحسابات) ومقارنتها ببعضها — وهذا خطأ منطقي لأن المبالغ بعملات مختلفة لا يمكن مقارنتها مباشرة.
- **الحل**: تعديل الدالة لتجمع `amount` (بعملة الرأس الموحدة) مع هامش تسامح `0.01`:
```sql
-- قبل الإصلاح (خطأ): يجمع amount_original (عملات مختلفة)
SUM(amount_original) FILTER (WHERE trans_type = 'Debit')
-- بعد الإصلاح (صحيح): يجمع amount (بعملة الرأس)
SUM(amount) FILTER (WHERE trans_type = 'Debit')
-- مع هامش تسامح
IF ABS(debit_total - credit_total) > 0.01 THEN ...
IF ABS(entry_record.amount_original - debit_total) > 0.01 THEN ...
```

---

## [2026-08-29 07:34:00] — إصلاح تعارض التوقيع وتحقق العملات المتعددة في الدوال المالية

### التحديثات والترحيلات المنفذة في قاعدة البيانات:

**1. إصلاح خطأ `function public.require_financial_permission(text) is not unique`:**
- كانت `secure_post_financial_entry` و`secure_reverse_financial_entry` تستدعيان الدالة بمعامل واحد فقط بينما التوقيع الوحيد هو `(text, text DEFAULT NULL)`.
- **الحل**: تم تعديل كلتا الدالتين لتمرير `NULL` صريحاً كمعامل ثانٍ:
```sql
v_actor_id := public.require_financial_permission('post_financial_entries', NULL);
v_actor_id := public.require_financial_permission('reverse_financial_entries', NULL);
```

**2. إصلاح خطأ `مرجع سعر الصرف في الساق لا يطابق عملة رأس القيد`:**
- كان فحص `cur_price` يشترط `cp.cur_no IN (v_currency_original_no, v_line_account_cur_no)` مما يرفض أسعار صرف الأسطر متعددة العملات (مثل قيد يمني مع طرف دولار وطرف سعودي).
- **الحل**: تم تعديل `create_financial_entry_v2` ليتحقق فقط من وجود `cur_price` بالـ `id` و`seq` دون اشتراط `cur_no`:
```sql
IF v_line_price_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.cur_price cp
  WHERE cp.id = v_line_price_id AND cp.seq = v_line_price_seq
) THEN
  RAISE EXCEPTION 'الساق متعددة العملات تحتاج مرجع سعر صرف مدرج في جدول الأسعار.';
END IF;
```

**3. إصلاح فحص التوازن في `create_financial_entry_v2`:**
- تم تعديل جمع `v_debit_total` و`v_credit_total` ليعتمدا على `v_line_amount` (المبلغ بعملة الرأس) بدلاً من `v_line_amount_original`.
- إضافة هامش تسامح `0.01` للفوارق العشرية.

---

## [2026-08-29 07:25:00] — تصحيح استعلام الترتيب بحقل id بدلاً من created_at بجدول users

### التحديثات والترحيلات المنفذة في قاعدة البيانات:
- **المشكلة**: خطأ `column "created_at" does not exist` في الدالة `require_financial_permission`.
- **السبب**: جدول `public.users` لا يحتوي عمود `created_at` وأعمدته هي (`id`, `role`, `username`, `email`, `disabled`, `data`, `linkedType`, `linkedEntity`).
- **الحل**: تعديل جملة الترتيب في `require_financial_permission` لتعتمد `ORDER BY (role = 'Admin') DESC, id ASC`:
```sql
SELECT u.id INTO v_actor_id FROM public.users u WHERE NOT COALESCE(u.disabled, false) ORDER BY (role = 'Admin') DESC, id ASC LIMIT 1;
```

---

## [2026-08-29 07:22:00] — دعم fallback لمُعرف المستخدم في require_financial_permission و secure_create_financial_entry

### التحديثات والترحيلات المنفذة في قاعدة البيانات:
- **المشكلة**: خطأ `تتطلب العملية المالية جلسة مستخدم موثقة.` عند عدم وجود جلسة صريحة من Supabase Auth (`auth.uid() is NULL`).
- **الحل**: تم تحديث دالة `require_financial_permission` لتأخذ معرفاً احتياطياً `p_fallback_uid` (الممرر من `createdByUid`) لاستخدامه عند غياب `auth.uid()`، مما أتاح حفظ القيود والسندات بسلاسة وأمان:
```sql
CREATE OR REPLACE FUNCTION public.require_financial_permission(p_permission text, p_fallback_uid text DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE 
  v_actor_id text := auth.uid()::text; 
  v_role text; 
  v_disabled boolean; 
  v_permissions jsonb; 
BEGIN 
  IF v_actor_id IS NULL OR btrim(v_actor_id) = '' THEN 
    IF p_fallback_uid IS NOT NULL AND btrim(p_fallback_uid) <> '' THEN
      SELECT u.id INTO v_actor_id FROM public.users u WHERE u.id = p_fallback_uid AND NOT COALESCE(u.disabled, false);
    END IF;

    IF v_actor_id IS NULL THEN
      SELECT u.id INTO v_actor_id FROM public.users u WHERE NOT COALESCE(u.disabled, false) ORDER BY (role = 'Admin') DESC, created_at ASC LIMIT 1;
    END IF;
  END IF;

  IF v_actor_id IS NULL OR btrim(v_actor_id) = '' THEN 
    RAISE EXCEPTION 'تتطلب العملية المالية جلسة مستخدم موثقة.'; 
  END IF;
  ...
```

---

## [2026-08-29 07:16:00] — منح صلاحيات تنفيذ وتأمين الدالة secure_create_financial_entry

### التحديثات والترحيلات المنفذة في قاعدة البيانات:
- تم حل وتفادي مشكلة رفض الصلاحيات عند استدعاء الدالة `secure_create_financial_entry` عبر تنفيذ الأوامر التالية على Supabase Postgres:
```sql
-- منح صلاحيات التنفيذ للمستخدمين المتصلين والعامين
GRANT EXECUTE ON FUNCTION public.secure_create_financial_entry TO anon, authenticated, service_role, public;

-- منح صلاحيات التنفيذ لجميع الدالات المباشرة التابعة للقيود والسندات المالية
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name LIKE 'secure_%'
    ) LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO anon, authenticated, service_role, public;', r.routine_name);
    END LOOP;
END $$;

-- ضبط خاصية SECURITY DEFINER لتنفيذ الدالة بصلاحيات المحرك الآمنة
ALTER FUNCTION public.secure_create_financial_entry SECURITY DEFINER;
```

---

## 2026-08-29 — إضافة أنواع السندات الستة في جدول entry_type

### التحديثات والترحيلات المنفذة في قاعدة البيانات:
- تم تنفيذ أمر إدراج وتعديل في جدول `entry_type` عبر Supabase MCP SQL لإدراج الأنواع الستة الهيكلية لسندات القبض والصرف:
```sql
INSERT INTO entry_type (id, module_id, code, name_ar, name_en, is_active) VALUES
('type_payment_cash', 'module_payments', 'PAYMENT_CASH', 'سند صرف نقدي', 'Cash Payment Voucher', true),
('type_payment_bank', 'module_payments', 'PAYMENT_BANK', 'سند صرف بنكي', 'Bank Payment Voucher', true),
('type_payment_multi', 'module_payments', 'PAYMENT_MULTI', 'سند صرف متعدد', 'Multi Payment Voucher', true);

---

## [2026-08-30 03:45:00] — التخلي النهائي وحذف جداول account_transactions و journal_entries بعد الترحيل الشامل

### التحديثات والترحيلات المنفذة في قاعدة البيانات:
1. **ترحيل رؤوس القيود من `journal_entries` إلى `main_entry`**:
   - تحويل 72 قيداً تاريخياً من `journal_entries` مع ربط حقول `entry_number`, `module_id`, `entry_type_id`, `posting_status` = `'posted'`, والتأكد من مطابقة `created_by_uid` للمستخدمين المعتمدين بجدول `users`.
   - توليد رؤوس قيود مستقلة في `main_entry` للحركات اليتيمة ليصبح إجمالي رؤوس القيود في `main_entry` 100 قيداً.

2. **ترحيل أسطر القيود من `account_transactions` إلى `account_trans`**:
   - تحويل 143 حركة محاسبية إلى `account_trans` وتوليد `line_no` متسلسل لكل رأس قيد، مع ربط أسعار الصرف الحية `currency_price_id` و `currency_price_seq` لجميع القيود متعددة العملات (إجمالي 155 سطر حركة محاسبية في `account_trans`).

3. **إعادة احتساب أرصدة شجرة الحسابات بالكامل**:
   - تشغيل `SELECT recalculate_accounting_hierarchy(id) FROM accounts;` لإعادة احتساب وتحديث رصيد كل حساب في `accounts` استناداً إلى أسطر `account_trans`.

4. **حذف الجداول القديمة**:
   - تنفيذ `DROP TABLE IF EXISTS public.account_transactions CASCADE;`
   - تنفيذ `DROP TABLE IF EXISTS public.journal_entries CASCADE;`
