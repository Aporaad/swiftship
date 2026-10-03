# خطة تنفيذ التجهيز الإنتاجي الكامل لإنشاء API

**المشروع:** SwiftShip + ALX Web Portal  
**التاريخ:** 2026-10-03  
**القرار:** تنفيذ جميع فجوات التجهيز المتبقية، مع **استثناء RLS وGrants** بناءً على طلب المستخدم.

---

## 1. نطاق الخطة

### داخل النطاق

- تحويل Portal Gateway من تنفيذ legacy إلى HTTP API فعلي.
- تثبيت Auth/Session/Ownership بين الموقع والـAPI.
- إكمال حدود Gateway وDTO وError Contract.
- إكمال تدقيق AsyncState لعمليات Query/Mutation الحقيقية.
- إكمال تنظيف الأنواع في العقود وFeature boundaries الجديدة.
- إكمال Data Quality Snapshot دون فحص RLS/Grants.
- تشغيل اختبارات النظام والموقع من نسخ نظيفة.
- تشغيل Smoke/E2E على staging معزولة.
- توثيق rollback، release checklist، وقرار بدء `alx_api`.

### خارج النطاق صراحةً

- فحص أو تعديل RLS.
- فحص أو تعديل Grants.
- أي Migration أو SQL تغيّر بنية الإنتاج دون موافقة منفصلة.
- حذف الجداول أو الحقول legacy.

> **ملاحظة تشغيلية:** استثناء RLS/Grants يعني أن حماية الوصول المباشر إلى قاعدة البيانات تظل مخاطرة مقبولة ومُسجلة، ولذلك يجب منع العملاء من الاتصال المباشر بقاعدة البيانات عند تفعيل الـAPI، حتى لو لم ننفذ فحص RLS/Grants.

---

## 2. الوضع الحالي المثبت

- النظام يبني بنجاح ويفتاز `npm run check`.
- اختبارات النظام: **73 ملفاً ناجحاً، 258 اختباراً ناجحاً**، مع 3 ملفات و8 اختبارات متخطاة.
- لا توجد استيرادات مباشرة من `src/lib/supabase` خارج حد التوافق في النظام.
- صفحات ومكونات وسياق `alx_web` لا تستورد Supabase مباشرة.
- فحص Portal boundary ناجح.
- النظام والموقع مرفوعان إلى GitHub وبحالتي working tree نظيفتين.
- Portal ما زال يستخدم تنفيذ legacy خلف حد توافق، وليس HTTP API فعلياً.
- لا توجد بيئة staging/API مشتركة مثبتة حتى الآن.

---

## 3. ترتيب التنفيذ الإلزامي

```text
A. تثبيت عقود API وAuth
  -> B. بناء Portal HTTP API
  -> C. نقل Portal client إلى HTTP
  -> D. إكمال AsyncState والأنواع
  -> E. Data Quality Snapshot بدون RLS/Grants
  -> F. اختبارات clean + staging E2E
  -> G. Rollback/Release Review
  -> إعلان جاهزية إنشاء alx_api
```

لا يجوز تجاوز مرحلة قبل اجتياز معيار قبولها.

---

# المرحلة A — تثبيت عقود API وAuth

## A1. تثبيت Response/Error Contract

**المهام**

- تثبيت envelope موحد:
  - نجاح: `{ success: true, data, meta?, requestId }`
  - فشل: `{ success: false, error: { code, message, details, requestId } }`
- منع تسريب رسائل قاعدة البيانات أو stack traces.
- توحيد أكواد `401`, `403`, `404`, `409`, `422`, `429`, `500`, `503`.
- إضافة اختبارات contract لكل مسار موجود.

**معيار القبول**

- كل Route API يعيد envelope موحداً.
- لا يوجد route يعيد `password`, `system_pin`, session token أو JSONB خام.
- اختبارات error contract ناجحة.

## A2. تثبيت Session DTO وOwnership

**المهام**

- تثبيت `CurrentUserDto` و`SessionDto`.
- اعتماد session token خادمي فقط.
- رفض session منتهية أو force-logout.
- إضافة ownership checks للموارد:
  - customer
  - courier
  - supplier
  - orders
  - shipments
  - ledger
  - support tickets
- عدم اعتبار `userId` القادم من body مصدراً للهوية.

**معيار القبول**

- كل Route محمي يحدد auth وpermission وownership.
- اختبارات: unauthenticated / wrong role / wrong owner / valid owner.

## A3. تثبيت Permission Dictionary

**المهام**

- توحيد أسماء الصلاحيات بين النظام والـAPI والموقع.
- إعداد مصفوفة:
  - route
  - method
  - permission
  - ownership rule
  - DTO
- منع صلاحيات legacy غير المعرفة في الـAPI الجديد.

**المخرج**

- `docs/pre-api/api-permission-matrix.md`

---

# المرحلة B — بناء Portal HTTP API

## B1. Portal Routes للقراءة

تنفيذ وتوثيق المسارات التالية خلف session/ownership:

- `GET /api/v1/me`
- `GET /api/v1/portal/announcements`
- `GET /api/v1/portal/orders`
- `GET /api/v1/portal/orders/:id`
- `GET /api/v1/portal/tracking/:token`
- `GET /api/v1/portal/ledger`
- `GET /api/v1/portal/support-tickets`
- `GET /api/v1/portal/profile`

## B2. Portal Routes للكتابة

- `PATCH /api/v1/portal/profile`
- `POST /api/v1/portal/support-tickets`
- `POST /api/v1/portal/customer-onboarding`
- `POST /api/v1/portal/password/reset-request`
- `POST /api/v1/portal/password/change`

كل عمليات الكتابة يجب أن تحتوي على:

- validation schema
- idempotency عند الحاجة
- audit event
- error mapping
- ownership check

## B3. Public Tracking

- إبقاء Public Tracking بدون PII.
- قبول tracking token فقط.
- منع البحث العام بالبريد أو الهاتف أو الاسم.
- تثبيت DTO عام يحتوي الحالة والأحداث العامة فقط.
- تحديد rate limit وrequest id.

**معيار قبول المرحلة B**

- OpenAPI أو contract markdown يغطي كل Route.
- اختبارات route على mock DB ناجحة.
- لا يعتمد أي Route جديد على قراءة Supabase من المتصفح.

---

# المرحلة C — نقل alx_web إلى HTTP API

## C1. إنشاء HTTP API Client

**المهام**

- إنشاء `src/api/httpClient.ts`.
- دعم:
  - base URL من environment
  - credentials/session header
  - request id
  - JSON parsing
  - error envelope
  - timeout
  - retry للقراءات الآمنة فقط
- منع retry للكتابات غير idempotent.

## C2. تحويل Portal Gateway

- جعل `portalGateway` يعتمد على HTTP client عند تفعيل `VITE_API_BASE_URL`.
- إبقاء legacy implementation خلف feature flag مؤقت فقط.
- تسجيل telemetry عند استخدام fallback.
- إزالة fallback بعد اجتياز staging E2E.

## C3. نقل المستهلكين

بالترتيب:

1. CustomerTrackModal.
2. AnnouncementsPage.
3. MyOrdersPage.
4. CustomerDashboard.
5. CustomerLedgerPage.
6. CourierDashboard/CourierTasks/CourierLedger.
7. SupplierDashboard/SupplierOrders/SupplierLedger.
8. SupportTicketsPage.
9. ProfilePage وOnboarding.
10. PortalAuthContext.

**معيار القبول**

- لا توجد قراءة أو كتابة مباشرة من صفحات الموقع.
- تشغيل الموقع بدون متغيرات Supabase client.
- feature flag HTTP يعمل على staging.
- legacy fallback قابل للتعطيل بواسطة config فقط.

---

# المرحلة D — إكمال AsyncState والأنواع

## D1. AsyncState

تدقيق كل Query/Mutation حقيقي في:

- Settings
- UserManagement
- Orders
- Finance
- Accounting
- Reports
- Customers
- Couriers
- Employees
- Notifications
- Sources/Shipping Companies
- Portal pages

استثناءات مسموحة فقط:

- فتح وإغلاق modal.
- اختيار tab.
- حقول النموذج المحلية.
- حالة hover/focus.

كل عملية بيانات يجب أن تملك:

- idle/loading/submitting
- success أو empty
- error code
- retry أو recovery واضح
- منع double submit للكتابات

## D2. Types/Contracts

- منع `any` في:
  - DTOs
  - Gateway interfaces
  - API routes
  - Auth/session contracts
  - Portal contracts
- تحويل legacy records إلى `unknown` ثم mapper typed.
- عدم استخدام cast غير موثق.
- إضافة contract test يمنع `any` في المسارات الجديدة.

**معيار القبول**

- `npm run check` ناجح.
- لا توجد `any` في `src/data`, `server/routes`, `src/api`, `alx_web/src/api`.
- كل Query/Mutation مدرج في AsyncState audit ومحدد مالكه.

---

# المرحلة E — Data Quality Snapshot بدون RLS/Grants

## E1. Snapshot قراءة فقط

يُنفذ على staging أو نسخة قراءة فقط، دون RLS/Grants:

- foreign keys
- nullability للحقول الأساسية
- duplicate identifiers
- orphan orders/customers/shipments
- invalid status values
- invalid currency codes
- invalid dates
- negative أو non-finite amounts
- records بدون account link في المصادر والشحن والشؤون المالية
- وجود password/system_pin في public data
- تفاوت أسماء الحقول legacy/canonical

## E2. تقرير الجودة

المخرج:

- `docs/pre-api/data-quality-snapshot-YYYY-MM-DD.md`

لكل مشكلة:

- table/field
- count
- sample IDs غير الحساسة
- severity
- remediation owner
- هل تعالج قبل API أم بعده

**معيار القبول**

- التقرير موجود وموقع ببيئة التنفيذ وتاريخ snapshot.
- لا توجد مشكلة Blocker غير موثقة.
- لا يتم تعديل البيانات ضمن هذه المرحلة.

---

# المرحلة F — التحقق الكامل

## F1. Clean install

### النظام

```bash
rm -rf node_modules dist
npm ci --no-audit --no-fund
npm run check
npm test -- --reporter=dot
npm run build
```

### الموقع

```bash
rm -rf node_modules dist
npm ci --no-audit --no-fund
npm run audit:portal-boundary
npm run build
```

## F2. API smoke tests على staging

- `/api/v1/contract`
- `/api/v1/me`
- login/session expiry
- permission denial
- ownership denial
- public tracking without PII
- portal orders
- portal ledger
- support ticket write
- request id propagation
- error envelope

## F3. E2E

السيناريوهات الإلزامية:

1. Customer login → orders → tracking.
2. Customer cannot read another customer's order.
3. Courier sees assigned tasks only.
4. Supplier sees assigned ledger/orders only.
5. Anonymous user sees public tracking only.
6. Expired session is rejected.
7. Duplicate write with same idempotency key is safe.
8. API unavailable shows recoverable error in portal.

**معيار القبول**

- جميع السيناريوهات ناجحة في بيئة staging معزولة.
- لا توجد كتابة إلى production.
- تقرير test run محفوظ.

---

# المرحلة G — Rollback وقرار الجاهزية

## G1. Rollback لكل دفعة

يجب توثيق:

- commit قبل التغيير
- commit بعد التغيير
- feature flag
- طريقة تعطيل HTTP client
- طريقة إعادة legacy fallback
- طريقة إيقاف route جديد
- migration impact: **لا توجد migrations ضمن هذه الخطة**

## G2. Release checklist

لا يُعلن الاكتمال إلا إذا كانت كل الإجابات نعم:

- [ ] Auth/session/ownership مثبتة باختبارات.
- [ ] Error/response contract موحد.
- [ ] Portal HTTP routes موثقة ومختبرة.
- [ ] alx_web يعمل عبر HTTP Gateway على staging.
- [ ] لا يوجد Supabase مباشر في صفحات العملاء.
- [ ] AsyncState audit مكتمل.
- [ ] لا يوجد `any` في العقود والحدود الجديدة.
- [ ] Data quality snapshot محفوظ، مع استثناء RLS/Grants موثق.
- [ ] clean install/build/test ناجحان للنظام والموقع.
- [ ] smoke/E2E staging ناجحة.
- [ ] rollback موثق لكل دفعة.
- [ ] لا توجد تغييرات قاعدة بيانات غير موثقة.

## قرار الإعلان النهائي

عند اكتمال كل البنود أعلاه يُضاف إلى التقرير:

> **تم اجتياز تجهيز إنشاء API إنتاجي من ناحية الكود والعقود وAuth/ownership وPortal HTTP والاختبارات وبيانات الجودة. تم استثناء RLS/Grants بناءً على موافقة المستخدم، وتبقى هذه مخاطرة تشغيلية مقبولة ومُسجلة. يمكن بدء Scaffold وتنفيذ `alx_api` وفق ترتيب الخطة.**

---

## 4. ترتيب الالتزامات المقترح

1. `api-contracts-auth-boundary`
2. `portal-http-routes`
3. `portal-http-client`
4. `async-state-audit-batch-*`
5. `typed-boundary-cleanup`
6. `data-quality-snapshot`
7. `staging-smoke-e2e`
8. `production-api-readiness-decision`

كل التزام يجب أن يمر بـ`check` واختبارات النطاق قبل دمجه.

---

## 5. بوابة خارجية مطلوبة قبل المرحلتين E وF

يلزم توفير بيئة staging أو موصل قراءة فقط لقاعدة البيانات. لا يتطلب ذلك تفعيل RLS/Grants أو تعديلهما، لكنه ضروري لإثبات:

- Data Quality Snapshot.
- ownership على بيانات حقيقية.
- Portal HTTP E2E.
- صحة mapping بين الحقول legacy وcanonical.

بدون هذه البيئة يمكن تنفيذ الكود والاختبارات الوحدوية فقط، ولا يجوز إعلان **التجهيز الإنتاجي الكامل**.
