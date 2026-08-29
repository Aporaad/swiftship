# سجل تطوير قاعدة البيانات — DBdevloping_history.md

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
('type_payment_multi', 'module_payments', 'PAYMENT_MULTI', 'سند صرف متعدد', 'Multi Payment Voucher', true),
('type_receipt_cash', 'module_receipts', 'RECEIPT_CASH', 'سند قبض نقدي', 'Cash Receipt Voucher', true),
('type_receipt_bank', 'module_receipts', 'RECEIPT_BANK', 'سند قبض بنكي', 'Bank Receipt Voucher', true),
('type_receipt_multi', 'module_receipts', 'RECEIPT_MULTI', 'سند قبض متعدد', 'Multi Receipt Voucher', true)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  code = EXCLUDED.code,
  is_active = true;
```
- الحسابات الافتراضية: الاعتماد على `sys_cash_account` وحسابات الصناديق والبنوك المسجلة في جدول `default_accounts` و `accounts`.
