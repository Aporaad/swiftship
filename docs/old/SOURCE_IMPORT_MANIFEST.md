## 1. Code Architecture & Data Safety

* **Request Cancellation:** استخدم `AbortController` وإشارات الإلغاء في عمليات `fetch`/HTTP والعمليات غير المتزامنة، وألغِ الطلبات والـ subscriptions عند unmount أو تغيير الـ dependencies.
* **Type Safety:** فعّل `strict: true`. امنع `any` خصوصًا في `Auth`, `Orders`, و`Accounting`. استخدم `unknown` عند حدود البيانات الخارجية ثم قم بالتحقق والتحويل قبل استخدامها.
* **Models & DTOs:** لا تمرر Database Rows الخام إلى React components. استخدم **Canonical DTOs / Contracts** مستقلة عن مخطط قاعدة البيانات، مع Mapper مركزي عند الحاجة.
* **Validation:** استخدم Zod أو Schema مكافئ للتحقق من المدخلات، خصوصًا Forms وAPI/Gateway boundaries.
* **Error Handling:** استخدم **Error Contract موحدًا** مع error codes واضحة بدل أخطاء عشوائية أو رسائل مختلفة لكل صفحة.
* **DRY:** أعد استخدام الخدمات والمكونات الموجودة، ولا تنشئ abstraction جديدة إذا كان المشروع يملك Gateway/Service/Utility يؤدي نفس الدور.

## 2. Feature Architecture

استخدم التنظيم حسب المجال:

```text
features/orders/
├── pages/
├── components/
├── hooks/
├── services/
├── schemas/
├── types.ts
└── api.ts
```

المسار المطلوب للبيانات:

```text
React Page
→ Feature Hook/Service
→ Data Gateway Contract
→ Current Supabase Adapter
→ PostgreSQL
```

* ممنوع أن تبدأ صفحات جديدة باستدعاء Supabase مباشرة.
* لا تضع Business Logic داخل UI components.
* افصل Presentation عن Hooks وApplication Services وGateways.
* لا تنقل منطقًا موجودًا إلى abstraction جديدة دون الحفاظ على السلوك الحالي.

## 3. UI / UX

* حافظ على **React Functional Components + Hooks**.
* استخدم Tailwind CSS والنظام البصري الموجود بدل إضافة نظام Styling موازٍ.
* استخدم CSS responsive utilities وlayout primitives الموجودة بدل fixed widths التي تسبب overflow.
* احترم الـ theme والـ design tokens الموجودة في `src/index.css`.
* استخدم Lucide React للأيقونات بما يتوافق مع المشروع.
* قسّم الصفحات الكبيرة إلى Components صغيرة مثل:
  `DataTable`, `FilterBar`, `Pagination`, `ConfirmDialog`, `FormField`, `StatusBadge`, `EmptyState`, `ErrorState`, `PermissionGate`.
* لا تستخرج Component عامًا إلا عند وجود تكرار حقيقي أو قاعدة مشتركة يجب توحيدها.
* كل Query/Mutation يجب أن يميز بوضوح بين:
  `idle`, `loading`, `success`, `empty`, `error`, `submitting`, ونتيجة ما بعد mutation.
* لا تعرض بيانات Cache قديمة على أنها حالة مؤكدة في الصلاحيات أو الحسابات أو حالة الطلب.
* حافظ على دعم العربية وRTL الموجود في المشروع.

## 4. Data Screens

للشاشات التي تحتوي بيانات تشغيلية:

* Search.
* Filtering.
* Sorting.
* Pagination.
* Loading / Empty / Error states.
* Refresh عند الحاجة.
* Export/Print عند وجود المتطلب الوظيفي.

استخدم **Pagination Contract** موحدًا بدل تحميل آلاف السجلات دفعة واحدة.

في `Orders`, `Accounting`, `Customers`, `Shipments` وغيرها، لا تستخدم `any[]`. عرّف Canonical types وDTOs واضحة.

## 5. Networking & Data Access

* لا تستبدل بنية المشروع الحالية بـ `Dio`, `URLSession`, أو مكتبة HTTP جديدة دون سبب معماري موثق.
* حافظ على **Supabase Adapter/Gateway الحالي** أثناء مرحلة التهيئة.
* كل وصول جديد للبيانات يمر عبر Service/Gateway.
* لا تستورد Supabase مباشرة داخل Pages أو Components جديدة.
* طبّق mapping مركزي من Database Row إلى Canonical DTO.
* طبّق normalization للبيانات عند حدود النظام:

  * trimming.
  * null/optional handling.
  * توحيد التواريخ.
  * توحيد الأرقام والمبالغ.
  * معالجة Unicode/Arabic text.
* أي Retry يجب أن يكون مقصودًا ومحدودًا، ولا يعيد عمليات كتابة غير idempotent بشكل عشوائي.
* عمليات Realtime لا يجب أن تحتوي Business Logic ماليًا مخفيًا داخل UI.
* التوجه المستهدف هو:

```text
API/Service write
→ transaction
→ controlled event/invalidation
→ client update
```

بدل اعتماد الصفحات على مراقبة كل جدول مباشرة.

## 6. Authentication & Authorization

* استخدم **Supabase Authentication الموجود حاليًا** خلال مرحلة الترحيل الحالية.
* افصل Authentication عن Authorization.
* أنشئ/حافظ على `AuthProvider` مستقل عن الصفحات.
* ضع الوصول إلى جلسة المستخدم خلف `AuthGateway` بدل تمرير session objects الخام إلى كل Component.
* استخدم Permission-based checks مثل:

```text
can("orders.read")
can("orders.write")
can("accounting.read")
can("accounting.post")
users.manage
roles.manage
```

بدل نشر شروط Role مختلفة في كل صفحة.

* لا تضع Service Credentials أو أسرار قاعدة البيانات في Frontend.
* لا تعرض Passwords أو `systemPin` أو بيانات حساسة في DTOs المرسلة إلى الواجهة.
* أي فحص صلاحية في الواجهة هو لتحسين UX فقط؛ **التحقق النهائي يجب أن يكون على مستوى الخادم/API**.
* لا تغيّر آلية المصادقة الحالية إلى نظام آخر إلا ضمن خطة `alx_api` المعتمدة.

## 7. Security

* لا تضف أسرارًا أو credentials ثابتة إلى المصدر.
* لا تخزن كلمات مرور نصية أو بيانات حساسة غير لازمة في الواجهة.
* لا تسمح للـ Browser Client بتجاوز Gateway للوصول إلى بيانات حساسة.
* حافظ على RBAC المركزي وأسماء Permissions الموحدة.
* تعامل مع RLS كطبقة دفاعية مستقلة، ولا تفترض أن وجود UI permission يعني أن البيانات محمية.
* أي تعديل في الصلاحيات أو الوصول المباشر إلى Supabase يجب أن يكون مقصودًا ومختبرًا.

## 8. Monitoring & Logging

* استخدم آلية logging الموجودة في المشروع ولا تضف Logger framework جديدًا بلا حاجة.
* لا تسجل passwords أو tokens أو Service Credentials أو PII الحساسة.
* سجّل الأخطاء التشغيلية بمعلومات كافية للتشخيص دون تسريب بيانات حساسة.
* العمليات الحساسة مثل Orders وAccounting وAuth يجب أن تملك اختبارات تغطي النجاح والفشل وحالات الصلاحيات.

## 9. Verification

بعد أي تغيير معماري أو في البيانات:

```text
TypeScript check
→ Unit tests
→ Build
→ Feature verification
→ Security verification
```

استخدم أوامر المشروع الحالية:

```text
npm run check
npm run test
npm run build
```

ولا تعتبر الكود صحيحًا لمجرد أن الصفحة تعمل في حالة واحدة.

## 10. SwiftShip Migration Rules

التزم بالخطة المعمارية الموجودة في المشروع:

```text
Inventory
→ Canonical Contracts
→ Gateway Boundary
→ Auth Boundary
→ Feature Refactor
→ Server Split
→ Data Quality
→ Readiness Review
→ alx_api
```

لا تبدأ `alx_api` بإعادة كتابة عشوائية للواجهة.

ولا تنقل Feature إلى API قبل أن يكون لديها:

* Canonical DTO.
* Error Contract.
* Pagination/Filtering Contract عند الحاجة.
* Gateway boundary.
* Tests.
* Permission requirements واضحة.
* Mapping واضح بين البيانات الحالية والعقد الجديد.

**قاعدة أساسية:** حافظ على السلوك الحالي أثناء الـ Refactor، وافصل المسؤوليات تدريجيًا بدل تغيير Architecture وBusiness Logic وDatabase behavior في نفس التغيير.
