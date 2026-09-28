# RPC Register — سجل الدوال والإجراءات قبل API

**التاريخ:** 2026-09-28
**المشروع:** `ejrojwbbflzchasvgexr`
**النطاق:** قراءة metadata فقط؛ لم يتم استدعاء أي RPC تشغيلية.

## 1. دوال الكتابة الذرية المرشحة

| RPC | التوقيع | الناتج | Security definer | ملاحظات API |
|---|---|---|---|---|
| `secure_create_financial_entry` | `p_entry jsonb` | jsonb | نعم | مسار إنشاء مالي حساس؛ ACL يتضمن anon في القراءة الحالية ويحتاج Blocker |
| `create_financial_entry_v2` | `p_entry jsonb` | jsonb | نعم | مسار داخلي/حديث؛ service_role فقط حسب ACL المرصود |
| `secure_update_financial_entry` | `p_entry_id text, p_entry jsonb` | jsonb | نعم | تحديث entry؛ يحتاج permission وstate transition |
| `secure_post_financial_entry` | `p_entry_id text` | jsonb | نعم | posting؛ لا يعرض كـ CRUD عادي |
| `secure_reverse_financial_entry` | `p_entry_id text, p_reversal jsonb` | jsonb | نعم | عكس قيد؛ idempotency وaudit |
| `secure_unpost_order_financial_entry` | `p_entry_id text` | jsonb | نعم | أثر order/financial history |
| `secure_void_financial_entry_draft` | `p_entry_id text` | jsonb | نعم | void draft |
| `secure_delete_financial_entry_draft` | `p_entry_id text` | jsonb | نعم | delete draft |
| `secure_replace_financial_entry_draft` | `p_entry_id text, p_entry jsonb` | jsonb | نعم | replace draft |
| `secure_replace_posted_financial_entry` | `p_entry_id text, p_entry jsonb` | jsonb | نعم | حساس جداً؛ لا يسمح به إلا policy واضحة |
| `record_order_payment_v2` | `p_order_id text, p_payment_amount numeric, p_entry jsonb, p_updated_by_uid text` | jsonb | نعم | تسجيل دفع order؛ transaction مع entry/details/history |
| `secure_record_order_payment` | `p_order_id text, p_payment_amount numeric, p_entry jsonb` | jsonb | نعم | مسار compatibility/secure؛ يلزم اختيار مسار واحد |
| `secure_create_custody_advance` | `p_custody jsonb, p_entry jsonb` | jsonb | نعم | إنشاء عهدة وقيدها |
| `secure_settle_custody_advance` | `p_custody_id text, p_entry jsonb` | jsonb | نعم | تسوية عهدة |
| `delete_orders_with_dependents` | `p_order_ids text[]` | jsonb | نعم | حذف ذري مع توابع؛ ACL يتضمن anon؛ Blocker |

## 2. RPCs القديمة/المباشرة التي يجب عدم تعريضها للعميل

`create_financial_entry`, `create_custody_advance`, `post_financial_entry`, `reverse_financial_entry`, `replace_financial_entry_draft`, `settle_custody_advance`, `unpost_financial_entry`, `void_financial_entry_draft` موجودة بجانب secure/v2 variants. يجب تعريف **RPC ownership matrix** يحدد المسار المعتمد، ومنع التطبيق من الاختيار العشوائي بين النسخ.

## 3. دوال التحقق والداخلية

- `financial_entry_permission_for_payload` و`require_financial_permission`: authorization helpers.
- `validate_financial_entry_balance` و`validate_financial_entry_account_limits`: invariants مالية.
- `validate_main_entry_posting_transition` و`validate_main_entry_type_module`: lifecycle/type guards.
- `validate_account_trans_posting_target` و`enforce_account_transaction_posting_rules`: line/target guards.
- `validate_custody_advance_target` و`validate_entry_payment_detail`: روابط العهدة والدفع.
- `recalculate_accounting_hierarchy` و`recalculate_all_account_balances`: projections/reconciliation.
- `orders_history_write` و`orders_history_from_*`: audit side effects.
- `ensure_entity_financial_account` و`link_*_financial_account`: entity account provisioning.

## 4. مخاطر الصلاحيات المؤكدة من ACL

القراءة metadata أظهرت أن `anon` أو PUBLIC يملكون EXECUTE على عدة دوال `SECURITY DEFINER`، منها دوال حساب العملة، حذف الطلبات، `orders_history_write`، بعض دوال entry، ودوال `secure_*` متعددة. كما أن بعض الدوال لا تحتوي `proconfig` لـ`search_path`، وبعضها يستخدم `search_path=""` أو `public, auth`.

هذا لا يعني تنفيذ أي دالة أو استغلالها؛ لكنه يعني أن **لا Endpoint API يجب أن يمرر RPC مباشرة قبل مراجعة ACL وsearch_path وauthorization داخل الدالة**.

## 5. RPC Contract المطلوب لكل عملية

قبل بناء repository، يوثق لكل RPC: input schema، actor source، permission، allowed roles، preconditions، state transition، tables written، triggers، audit/history effects، idempotency key، error codes، transaction boundary، retry behavior، output DTO، وredaction policy.

## 6. القرار

لا يتم إنشاء DTO المالي أو Gateway المالي قبل اعتماد RPC ownership matrix. البداية الآمنة هي قراءة واختبار عقد واحد في بيئة اختبار، دون تعديل production، بعد معالجة صلاحيات anon وRLS عبر Migration منفصلة ومراجعة.
