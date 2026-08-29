# سجل تطوير قاعدة البيانات — DBdevloping_history.md

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
