# سجل الجداول المعتمد — Approved Table Registry

**آخر تحديث / Last updated:** 2026-10-17 03:20 (المرحلات P1–P7، ترحيلات 0039–0043)
**القاعدة الحاكمة / Governing rule:** كل معلومة عمود رئيسي في جدولها؛ لا حقل داخل `jsonb` في `public` إطلاقًا.
Every fact is a first-class column of its own table; no field ever lives inside `jsonb` in `public`.

الحكم على كل جدول له ثلاث حالات فقط / Every table has exactly one of three rulings:
- **معتمد (Approved):** له كاتب/qارئ واحد معروف عبر `alx_api` أو بوابة API في الواجهة.
  (**Approved:** one known writer/reader, through `alx_api` or an API gateway in the UI.)
- **محذوف — مكرر (Dropped — duplicate):** كانت نسخه بياناته في مكان أدق، نُقلت ثم أُسقطت.
  (**Dropped — duplicate:** its facts already lived somewhere more precise; moved first, then dropped.)
- **محذوف — يتيم (Dropped — orphan):** لا نقطة ربط له في الـ API ولا في الواجهة.
  (**Dropped — orphan:** no link point exists in the API or in the UI.)

---

## 1. العملات وأسعار الصرف — currencies and exchange rates

| الجدول / Table | الحكم / Ruling | التبرير: من يكتب ومن يقرأ / Justification: who writes, who reads |
|---|---|---|
| `public.currency` | معتمد / Approved | المصدر المعتمد الوحيد لهوية العملة. يكتبه `/api/v1/currencies` (`currencies.repository.ts`) ويقرأه `settings.repository.ts:readGeneral` و`operations.repository.ts` عبر `LEFT JOIN public.currency cur ON cur.cur_id = o.currency`. عدد صفوفه الحقيقي 5 (كانت قراءته 0 خطأ قياس، راجع §7). |
| `public.cur_price` | معتمد / Approved | سجل أسعار الصرف التسلسلي (صف لكل تحديث بسعر `seq`). يقرأه `settings.repository.ts` بـ `LEFT JOIN LATERAL ... ORDER BY cp.seq DESC` لآخر سعر، ويكتبه `currencies.repository.ts:addRate` ومسار حفظ العملات. 13 صفًا. |
| `public.settings_custom_currency` | محذوف — مكرر / Dropped — duplicate | نسخة موازية للعملات (كود/اسم/رمز/سعر) داخل جدول إعدادات. عملت عليها شاشة العملات رغم أن المصدر الحقيقي `currency`+`cur_price`. 0042 دمجت كل كود ناقص في `currency` وأضاف السعر الناقص كصف `cur_price` ثم أسقطت الجدول؛ الرحيل يرفض الإسقاط إن بقي كود بلا مقابل. |

**الحقول المتنازع عليها / Disputed fields:**
- `currency.is_default` هو عمود العملة الأساسية (YER)، لذلك سعرها الثابت 1 يُبنى في الـ API (`CASE WHEN c.is_default THEN 1 ELSE COALESCE(latest.price,0)`) بدل اختراع صف سعر لها.
- `cur_price.price` هو السعر إلى الريال اليمني وحده؛ لا يوجد «سعر صرف عام» في عمود آخر، فلا مصدرين للحقيقة.

---

## 2. الأدوار والصلاحيات — roles and permissions (P2)

| الجدول | الحكم | التبرير |
|---|---|---|
| `alx_api_private.roles` | معتمد / Approved | كتالوج الأدوار الموحد الوحيد. يقرئه `roles.repository.ts` ويكتبه `/api/v1/roles`، وتقرأه دالة الحارس `alx_api_private.user_has_permission` (0039). |
| `alx_api_private.permissions` | معتمد / Approved | كتالوج أكواد الصلاحيات (عمود `code` صغير الحروف). 0040 سجّل فيه الأكواد القديمة التي كانت في `public.role_permission`. |
| `alx_api_private.user_roles` | معتمد / Approved | ربط مستخدم←دور مع `expires_at`؛ 0040 ضمن دورًا موحدًا لكل مستخدم من `users.role`. |
| `alx_api_private.role_permissions` | معتمد / Approved | منح الدور←الصلاحية. الصلاحيات لم تعد مصفوفة داخل الجدول الأب ولا في `public`. |
| `public.roles` | محذوف — مكرر | نسخة عامة موازية باسم الدور (نص) مع `permissions` jsonb سابقًا. بعد تسجيل أكوادها ومنحها للأدوار الموحدة أسقطها 0040. |
| `public.role_permission` | محذوف — مكرر | 185 صف صلاحية موازية؛ 0039 كان يقرأها حارس إعدادات القيود، فاستُبدل المصدر بـ `alx_api_private` ثم أُسقطت. |
| `public.sessions` | محذوف — مكرر | الجلسات المعتمدة في `alx_api_private.api_sessions` وتُقرأ عبر `/api/v1/sessions` و`/api/v1/auth/sessions`. شاشة الجلسات في الواجهة حُوِّلت إليهما (0040). |

---

## 3. المالية والحسابات — finance and accounts

| الجدول | الحكم | التبرير |
|---|---|---|
| `public.accounts` | معتمد | الحسابات شجرة النظام؛ يضيف لها 0043 عمودي البديل `superseded_by_account_id`+`superseded_at` بدل خريطة الترحيل. |
| `public.account_trans` | معتمد | حركة دفتر واحدة لكل سطر قيد؛ يقرؤها `finance.repository.ts` و`operations.repository.ts`. |
| `public.main_entry` | معتمد | رأس القيد وحالته (`posting_status`)؛ كتابته عبر دوال RPC التي صارت تُنفَّذ بمعرّف منفّذ حقيقي (`withActorClaims`). |
| `public.entry_payment_details` | معتمد | تفصيلات الدفع لكل رأس قيد، صفوف مستقلة لا مصفوفة. |
| `public.entry_module` / `public.entry_type` | معتمد | كتالوج وحدات وأنواع القيود (قراءتهما في تبويب إعدادات القيود). |
| `public.custody_advances` | معتمد | سلفة الأمانة برصيدها المحسوب الأعمدة (`amount_settled`/`amount_outstanding`). |
| `public.default_accounts` | معتمد | مفاتيح الحسابات الافتراضية (`default_key`←`account_id`) التي يختارها المستخدم من شاشة القيود. |
| `public.acc_main` / `acc_sub` / `acc_sub_group` / `account` | معتمد (هيكل) | أشجار الحسابات القديمة التي تُقرأ لبناء التسلسل؛ لم تعد تخزن حمولة. |
| `public.assets` / `asset_maintenance_log` | معتمد | الأصول وسجل صيانتها، صفوف مستقلة. |
| `public.expense_category` | معتمد | فئات المصارف بأعمدة (`label_ar`، `account_id`، `seq`)؛ يقرأها `settings.repository.ts:readExpenseCategories`. |
| `public.auto_entries` | معتمد | قواعد التلقائية؛ `amount_sources` صار `text[]` لا jsonb (0031/0034). |
| `public.salary_history` | معتمد | سجل الرواتب بأعمدته؛ `data` أُسقط في 0034. |
| `public.settings_report_account` | محذوف — مكرر | مجموعات حسابات للتقارير بلا أي قارئ في الـ API أو الواجهة؛ اختيار الحساب في التقارير يجري من `accounts` عبر `/api/v1/accounts`. |
| `public.account_id_migration_map` | محذوف — مكرر | جسر معرّات قديم←جديد (89 صفا). 0043 نقل آخر علاقة لكل معرّف إلى `accounts.superseded_by_account_id` (مع رفض الإشارة إلى حساب غير موجود) ثم أسقط الخريطة، فاختفى آخر اعتماد وقت التشغيل على خرائط الترحيل. |
| `public.financial_legacy_migration_map` | محذوف — أداة بناء | أثر ترحيل القيود القديمة (247 صفا)؛ لا يقرؤه أي مسار بعد اكتمال التحويل. |
| `public.financial_migration_exceptions` | محذوف — أداة بناء | استثناءات الترحيل (111 صفا) عولجت؛ الاستثناء الحالي يُعلَن من الـ API وقت العملية. |

---

## 4. الطلبات والشحن والتتبع — orders, shipments, tracking

| الجدول | الحكم | التبرير |
|---|---|---|
| `public.orders` | معتمد | 40+ عمودا مسطحا بدل `data` jsonb (0030–0038، إسقاط في 0034). |
| `public.order_items` / `products` / `returned_products` | معتمد | عناصر الطلب ومنتجاته والمرجعات — ومنها تُقرأ «منتجات» صفحة التتبع. |
| `public.order_status` / `order_option` | معتمد | كتالوجات الحالة والخيارات، بأعمدة حقيقية. |
| `public.orders_history` + `public.orders_history_change` | معتمد | سجل الحدث وصفوف تغييره المسطحة (0031)، وهي مصدر الخط الزمني العام. |
| `public.shipments` / `shipping_companies` | معتمد | الشحنات وشركات الشحن (`tracking_id_prefix`, `api_url` …). |
| `public.public_tracking` | معتمد | ملف التتبع العام بنشره ومعرّفه؛ تكتبه `trackingProfileService` عبر `/api/v1/operations/tracking-profiles`. |
| `public.public_tracking_product` | محذوف — يتيم | لا قارئ له: المنتجات تأتي من `order_items`، والجدول 0 صفوف (0042). |
| `public.public_tracking_event` | محذوف — يتيم | الخط الزمني يُبنى من `orders_history`؛ لا نقطة ربط في الـ API ولا الواجهة و0 صفوف (0042). |
| `public.customers` / `cust_details` / `couriers` / `employees` / `sources` | معتمد | الجهات وأدق تفاصيلها بأعمدة، وتفاصيل الجسم/الموقع صارت أعمدة (المهمه #13). |

---

## 5. التقارير وقوالب الطباعة — reports and print templates

| الجدول | الحكم | التبرير |
|---|---|---|
| `public.report_templates` | معتمد | قالب التقرير بأعمدته المسطحة (`name_ar`، `selected_*`، `sort_by` …). قراءة الـ API أصلحت في هذه الجولة (كانت تختار `data, filters` المسقطين). |
| `public.settings_print_template` | معتمد (مربوط الآن بالشاشة) | قالب الطباعة: 26 عمودا عربيا/إنجليزيا + أعلام العرض. 0041 أضاف `created_at/created_by/updated_by` وضمن صف القالب، والواجهة صارت تقرأ/تكتب عبر `/api/v1/settings/print_template` بدل `localStorage`. |
| `public.report_settings` | محذوف — مكرر | إعداد تقرير واحد كان يحمل `exchange_rates` jsonb؛ أسعاره في `cur_price` وعناوينه في `report_templates`/`settings_print_template`. |
| `public.report_exchange_rate` | محذوف — مكرر | نسخة أسعار موازية لـ `cur_price` (0 صفوف). |
| `public.report_template_filter` | محذوف — يتيم | مرشحات كانت داخل jsonb وأصبحت أعمدة `report_templates`؛ الجدول 0 صفوف ولا قارئ. |

**الحقول المتنازع عليها:**
- `report_templates.active_report` عمود **منطقي** (نعم/لا) من 0032، ولا يصلح مفتاح نوع التقرير الذي تعرضه الشاشة؛ لذلك تبقى قائمة التقارير حالةً في الواجهة، والجدول يخزن ما يُحدَّد فعلًا من معرّفات الأعمدة `selected_*`. أي طلب لجعل `active_report` نص النوع يحتاج ترحيلًا مستقلًا وقرارًا من المالك.
- لا يوجد `selected_order_id` في `report_templates`؛ الحفر إلى تفاصيل الطلب يجري من اختيار الشاشة وقت التشغيل، فلا عمود وهم يُخزن.

---

## 6. الإعدادات — settings (فئة = جدول)

| الجدول | الحكم | التبرير |
|---|---|---|
| `public.settings_general` | معتمد | الهوية والافتراضات وأرقام الترحيل: 50+ عمودا، يقرأها/يكتبها `settings.repository.ts:readGeneral/writeGeneral`. |
| `public.settings_backup_collection` | معتمد | مجموعات النسخ صفوف `(settings_key, collection_name, seq)` بدل مصفوفة jsonb. |
| `public.settings_logistics` | معتمد | مزوّد الشحن ومفاتيحه (`provider_key`, `api_key`, …). |
| `public.settings_whatsapp` (+ `_template`, `_trigger`) | معتمد | الإعداد/القوالب/المحفزات: ثلاثة جداول مترابطة، تكتبها `writeWhatsapp` في معاملة واحدة. |
| `public.settings_dashboard` / `settings_dashboard_metric` | محذوفان — مكرر | نفس المعلومة عمودان في `user_settings` (`dashboard_grid_columns`, `visible_metrics text[]`). 0042 نقل القيم إلى `user_settings` ثم أسقطهما. |
| `public.user_settings` | معتمد | تفضيلات المستخدم لكل مستخدم، شاملة ما كان في جدولي اللوحة. |
| `public.settings` | محذوف — قشرة | بعد أن تسطرت كل الفئات في 0031 وأُسقط عمود `data` في 0034، بقي 5 أعمدة و0 صفوف لا يقرأها شيء؛ أسقطها 0042 بعد حارس يتأكد أن لا دالة أو view عليها. |

---

## 7. تصحيح قياس وارد في هذا الملف — a measurement correction that was recorded here

سابقًا، سجّلت `DBdevloping_history.md` أن `public.currency` و`public.cur_price` **فارغتان (0 صفوف)**. هذا خطأ، والواقع:
An earlier entry in `DBdevloping_history.md` stated that `public.currency` and `public.cur_price` were **empty (0 rows)**. That was wrong; the truth is 5 and 13 rows.

**السبب التقني / Root cause:** الجداول مفعّلة عليها `ENABLE`+`FORCE ROW LEVEL SECURITY` (0018)، والقياس تم بحساب مالك القاعدة `postgres` الذي يخضع للسياسات تحت `FORCE` — فلم تُطابق أي سياسة وظهر العدّ صفرا.
These tables force row-level security (0018), and the count was taken as the database owner `postgres`, who is subject to policies under `FORCE` — no policy matched, so the count read zero.

**العلاج / Fix:** سياسة قراءة/كتابة للمالك في 0039 (`owner_currency_all`, `owner_cur_price_all`, `owner_report_templates_select` …) حتى تعدّ اللوحة الصفوف الحقيقية، وبقي وضع RLS كما هو بلا تغيير.
0039 added owner policies so the dashboard counts the real rows, and the RLS posture itself was not changed.

---

## 8. جداول البنية التحتية (ليست بيانات أعمال) — infrastructure tables (not business data)

| الجدول | الحكم | التبرير |
|---|---|---|
| `alx_api_private.api_sessions` / `api_refresh_tokens` / `auth_events` / `user_credentials` / `user_security` | معتمد — بنية | مصادقة `alx_api` الحصرية. |
| `alx_api_private.portal_*` | معتمد — بنية | مصادقة وأدوار بوابة العملاء. |
| `alx_api_private.notification_outbox` + `public.notification_recipient` | معتمد — بنية/بيانات | قائمة انتظار الإشعار وصفوف مستلميها. |
| `alx_api_private.operation_idempotency` | معتمد — بنية | منع تكرار العملية عند إعادة الإرسال. |
| `alx_api_private.password_reset_tokens` / `portal_registration_details` | معتمد — بنية | استعادة كلمة المرور وتفاصيل التسجيل. |
| `public.activity_logs` + `public.activity_log_detail` | معتمد | سجل النشاط وصفوف تفاصيله بدل `details` jsonb. |
| `public.announcements` / `browser_pages` / `jobs_req` / `portal_tickets` + `portal_ticket_reply` / `portal_users` / `whatsapp_logs` | معتمد | محتوى الموقع والصفحات وطلبات التوظيف والتذاكر بردودها وصفحات البوابة وسجل واتساب. |
| `public.users` | معتمد | المستخدمون؛ `role` صار يشير إلى الأدوار الموحدة عمليًا عبر `user_roles`. |

**حقول `jsonb` المتبقية في القاعدة كلها داخل `alx_api_private` للبنية التحتية فقط؛ `public` لا يحتوي أي عمود `json`/`jsonb`، و0042 يفشل عمدا إن ظهر أحدها.**
The only remaining `jsonb` columns live in `alx_api_private` for infrastructure. `public` holds no `json`/`jsonb` column, and 0042 fails on purpose if one ever appears.

---

## 9. حالة الترحيلات — migration status

| الملف | الغرض | الحالة |
|---|---|---|
| `0039_fix_runtime_access_and_financial_guard.sql` | حارس صلاحيات مالية حقيقي + سياسات إتاحة للقراءة | **بانتظار تطبيق المالك** (DDL عبر لوحة Supabase بحساب `postgres`). |
| `0040_unify_rbac_in_alx_api_private.sql` | توحيد RBAC وإسقاط `roles`/`role_permission`/`sessions` | **بانتظار تطبيق المالك**. |
| `0041_print_template_source_of_truth.sql` | أعمدة التدقيق لقالب الطباعة + الصف المعتمد | **بانتظار تطبيق المالك**. |
| `0042_drop_duplicate_and_orphan_tables.sql` | دمج ثم إسقاط المكرر واليتيم + حارس «لا jsonb» | **بانتظار تطبيق المالك**. |
| `0043_replace_migration_maps_with_real_columns.sql` | `accounts.superseded_*` بدل خرائط الترحيل + إسقاطها | **بانتظار تطبيق المالك**. |

**ترتيب التطبيق / Apply order:** 0039 ← 0040 ← 0041 ← 0042 ← 0043، في جلسة واحدة لكل ملف، ثم يُنشر كود الـ API (يقرأ `superseded_by_account_id` و`print_template`).
Apply 0039 → 0043 in order, one session per file, then deploy the API code (it reads `superseded_by_account_id` and the `print_template` category).

**ما لم يُنفَّذ في هذه القاعدة على لسان هذا الملف / What this registry does not claim:** لا شيء طُبِّق من 0039–0043 حتى الآن؛ التطبيق حق حصري للمالك.
Nothing in 0039–0043 has been applied yet; applying DDL is the owner's exclusive right.
