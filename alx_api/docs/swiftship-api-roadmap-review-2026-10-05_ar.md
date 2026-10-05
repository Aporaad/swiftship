# مراجعة خطة SwiftShip وخطة إنشاء وربط API

**تاريخ المراجعة:** 2026-10-05 03:18 (+03:00)

## 1. الخلاصة التنفيذية

المسار المعتمد في المشروع هو:

```text
SwiftShip / Electron + alx_web
        -> Feature Services / Data Gateway
        -> HTTPS JSON API: alx_api
        -> PostgreSQL
```

الهدف النهائي هو أن تكون `alx_api` مصدر الحقيقة للمصادقة، والصلاحيات، ومنطق الأعمال، والمعاملات، بينما تقتصر الواجهات على العرض، وتجميع المدخلات، واستدعاء HTTP API.

**الحالة الحالية:** تم بناء أساس API، Auth/RBAC، Customers، Operations، وFinance API. بدأ نقل Finance UI بقراءة تدريجية خلف feature flag مع fallback للمصدر القديم. لم يكتمل بعد اختبار التكامل الفعلي عبر مستخدم API موثق؛ تم إعداد دليل مستقل لهذه العملية، وبناءً على طلب المستخدم سيُعتبر الاختبار منتهياً بعد تنفيذه وفق الدليل.

## 2. نتيجة مقارنة الخطط بالمستودع

| المرحلة | المطلوب | الحالة الحالية | المتبقي |
|---|---|---|---|
| التهيئة السابقة للـAPI | فصل Features وData Gateway وتقليل وصول الواجهة المباشر للبيانات | منفذة جزئياً؛ توجد Gateways وHTTP client، مع بقاء Legacy واسع | إكمال Gateway مستقل لكل Feature، وتخفيض imports المباشرة من Supabase |
| 0–1 | القرارات وScaffold وTooling وHealth | منفذة في `alx_api` | CI وتشغيل بيئات موثقة بصورة كاملة |
| 2 | PostgreSQL/Drizzle وmigrations واختبارات PostgreSQL | الاتصال وDrizzle وmigrations الأساسية موجودة | اختبار Integration فعلي بمستخدم API موثق، وRunbook التشغيل |
| 3 | Auth Core | موجود: Argon2id/JWT/Refresh/Sessions ومسارات Auth | ترحيل credentials للمستخدمين الفعليين، password reset delivery، smoke test حقيقي |
| 4 | RBAC | موجود Middleware وpermissions ومسارات محمية | user-role mapping فعلي، audit كامل لتغييرات الصلاحيات، مصفوفة إنتاجية نهائية |
| 5 | OpenAPI/Zod/Response contract | منفذة ومحدثة للـFinance | توليد/مشاركة typed client موحد إن اعتمد الفريق ذلك |
| 6 | Customers | Routes وRepository واختبارات موجودة | نقل عميل تجريبي فعلياً عبر HTTP والتحقق من ownership/CRUD الكامل |
| 7 | Orders/Shipments | القراءة والكتابة والتاريخ والتتبع والإسناد وIdempotency موجودة | اختبار تكامل حقيقي، ومراجعة endpoint coverage مقابل كل شاشة، ثم نقل UI تدريجياً |
| 8 | Accounts/Journal/Lines/Expenses/Reversal | Finance API الحسابات والقيود والعكس وقواعد الأتمتة والعهد منفذة | مصروفات متخصصة، audit مالي أقوى، تكامل PostgreSQL فعلي، نقل Finance UI للكتابة |
| 9 | Notifications/Integrations | لم تبدأ | Outbox، retries، idempotency، adapters لمزودي الإشعارات |
| 10 | نقل النظام المحلي والموقع | لم يبدأ cutover النهائي | Auth ثم Users/Roles ثم Customers ثم Orders ثم Shipments ثم Finance ثم `alx_web` |
| 11 | Hardening/Launch | غير مكتملة | threat model، dependency audit، load/security tests، backup/restore، rollback، monitoring |

## 3. المرحلة الحالية المعتمدة

المرحلة النشطة الآن هي:

> **نقل Finance UI إلى Data Gateway HTTP بصورة قراءة تدريجية قابلة للتراجع.**

تم تنفيذ الدفعة الأولى التالية:

- إضافة endpoint عام لحركات الحسابات المرحّلة:
  - `GET /api/v1/finance/account-movements`
- إضافة `AccessTokenFactory` اختياري إلى `ApiClient`.
- إنشاء `FinanceApiDataGateway`.
- تفعيل القراءة عبر HTTP فقط عند ضبط:

```env
VITE_FINANCE_API_READS=true
VITE_API_BASE_URL=http://127.0.0.1:3001
```

- إبقاء المصدر القديم كـfallback تلقائي عند فشل API.
- نقل الحسابات، القيود، الحركات، العهد، وقواعد القيود التلقائية للقراءة من API عند تفعيل العلم.
- إبقاء الأصول والموظفين والرواتب والكتابات القديمة خارج النقل في هذه الدفعة.

## 4. المراحل القادمة بالترتيب

### أ. إغلاق اختبار PostgreSQL والتشغيل

1. بناء `alx_api`.
2. تشغيله مع `DATABASE_URL` لدور runtime غير مميز.
3. إنشاء/استخدام مستخدم API اختباري غير إنتاجي.
4. اختبار login، readiness، الحسابات، القيود، الصلاحيات، والعكس.
5. حفظ النتائج دون تسجيل الأسرار.

الدليل التنفيذي موجود في:

`alx_api/docs/postgresql-api-integration-runbook_ar.md`

### ب. إكمال نقل Finance UI للقراءة

- تشغيل flag في بيئة اختبار فقط.
- مقارنة الحسابات والقيود والحركات بين المصدر القديم وAPI.
- التحقق من pagination والعملة والحالة `posted`.
- إصلاح اختلافات DTO/field mapping.
- إزالة fallback فقط بعد نجاح smoke test وقرار cutover.

### ج. نقل Finance UI للكتابة

- تحويل إنشاء القيد إلى `POST /api/v1/finance/entries`.
- تحويل الترحيل إلى `POST /api/v1/finance/entries/:id/post`.
- تحويل العكس إلى `POST /api/v1/finance/entries/:id/reverse`.
- تحويل إبطال المسودة إلى `POST /api/v1/finance/entries/:id/void`.
- منع أي كتابة مباشرة من الواجهة إلى `main_entry` أو `account_trans`.
- إضافة idempotency للعمليات المالية الحساسة قبل تفعيلها للمستخدمين.

### د. استكمال Finance Domain

- Endpoint متخصص للمصروفات مع قواعد الصلاحيات.
- Audit مالي غير قابل للتلاعب من مستوى API.
- إدارة العملات وأسعار الصرف عبر API.
- اختبار تأثير القيود التلقائية على الطلبات والعهد والمصروفات.

### هـ. نقل بقية العملاء

1. Auth والـsession.
2. Users/Roles/Permissions.
3. Customers.
4. Orders.
5. Shipments/Couriers.
6. Finance.
7. `alx_web` بعد تصميم Portal Auth وملكية `portal_users`.

### و. الإطلاق الصلب

لا يتم حذف Supabase adapters أو صلاحيات قاعدة البيانات القديمة قبل تحقق:

- عدم وجود `.from()` أو `.rpc()` مباشر في الصفحات المنقولة.
- نجاح rollback.
- نجاح مراقبة الأخطاء والصلاحيات والأداء.
- اكتمال TLS/CORS/Secrets/Backups.
- وجود مستخدمين وأدوار فعلية في RBAC.

## 5. قرارات تمنع تجاوز الخطة

- لا يتم نقل Finance UI للكتابة قبل نجاح اختبار PostgreSQL الموثق.
- لا يتم تفعيل `VITE_FINANCE_API_READS=true` في الإنتاج قبل smoke test.
- لا يتم توجيه `alx_web` إلى Auth النظام قبل تصميم Portal Auth وملكية العملاء.
- لا يتم إعطاء التطبيق اتصال `postgres` أو `service_role`.
- لا يتم حذف القيود المالية؛ العكس هو مسار التصحيح.
- لا يتم وضع Access Token أو Refresh Token في Git أو داخل ملفات المشروع.

## 6. تحديث التنفيذ بتاريخ 2026-10-05 02:22 UTC

بدأت دفعة نقل واجهات المندوبين والموظفين والمحاسبة إلى HTTP API بطريقة قراءة تدريجية قابلة للتراجع:

- أضيف مورد `employees` إلى Reporting API مع صلاحية `view_employees`.
- أضيفت بوابة `staffApiDataGateway` لقراءة المندوبين والموظفين والطلبات والحسابات من API.
- أصبحت صفحات Couriers وEmployees وAccounting تستخدم البوابة عند تفعيل `VITE_STAFF_API_READS=true`، مع إبقاء Legacy fallback عند تعطيل العلم.
- أضيف Feature Flag التالي إلى `.env.example`:

```env
VITE_STAFF_API_READS=true
```

هذه الدفعة تنقل القراءة فقط. لم يتم تفعيل الكتابة عبر API للمندوبين والموظفين بعد، لأن ذلك يحتاج endpoints typed للإنشاء والتعديل والتعطيل والحذف، مع معاملات ربط الحساب المالي واختبارات صلاحيات قبل إزالة Legacy mutations.

## 7. الترتيب التالي بعد هذه الدفعة

1. إضافة عقود الكتابة للمندوبين والموظفين والحسابات المالية مع validation وaudit.
2. نقل تفاصيل المندوب والموظف وكشوف الحركات إلى API.
3. نقل mutations الإنشاء والتعديل والتعطيل والحذف خلف flags منفصلة.
4. إجراء smoke test بحساب API موثق ثم إزالة fallback لكل شاشة على حدة.
5. الانتقال إلى Users/Roles ثم Notifications/Integrations ثم hardening والإطلاق.
