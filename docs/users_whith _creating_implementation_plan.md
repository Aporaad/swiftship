# خطة تنفيذ: إنشاء مستخدمين للنظام والموقع وتقسيم النماذج وإضافة واجهة مستخدمين الموقع

تصف هذه الخطة كيفية تنفيذ متطلبات إنشاء مستخدم في النظام مباشرة عند إضافة (موظف / مندوب)، وإنشاء مستخدم في الموقع عند إضافة (عميل) مع إظهار حقول التفاصيل الإضافية دائماً وتقسيم نموذج العميل إلى تبويبات ومراحل منظمة، بالإضافة إلى بناء واجهة مستقلة لإدارة والتحكم بـ "مستخدمين الموقع" (`portal_users`) ضمن واجهات إدارة الموقع الإلكتروني.

---

## User Review Required

> [!IMPORTANT]
> - **جدول مستخدمين النظام (`users`)**: يتم إنشاء حسابات مستخدمي اللوحة/النظام فيها عند تفعيل زر "إنشاء مستخدم في النظام" لدى الموظف أو المندوب، وتعيين `linkedType` (`'employee'` / `'courier'`) و `linkedEntity` (`employee.id` / `courier.id`).
> - **جدول مستخدمين الموقع (`portal_users`) وجدول التفاصيل الإضافية (`cust_details`)**: عند إنشاء عميل وتفعيل زر "إنشاء مستخدم في الموقع للعميل"، يتم حفظ تفاصيل العميل الإضافية دائماً في `cust_details` وإنشاء حساب دخول الموقع في `portal_users` وربط الحسابين تلقائياً.
> - **تبويبات ومراحل نموذج العميل**: سيتم إعادة هيكلة نموذج إنشاء وتعديل العميل إلى مراحل وتبويبات سهلة الاستخدام (البيانات الأساسية | التفاصيل الإضافية | حساب مستخدم الموقع).

---

## Proposed Changes

### 1. الكادر والأشخاص (`src/pages/Employees.tsx` & `src/pages/Couriers.tsx`)

#### [MODIFY] [Employees.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/Employees.tsx)
- إضافة زر وتأرجح (Toggle/Checkbox) في نموذج إضافة الموظف: **"إنشاء مستخدم في النظام للموظف"**.
- عند تفعيله تظهر حقول إنشاء المستخدم: (اسم المستخدم للنظام `username`، كلمة المرور `password`، الدور `role`).
- عند الحفظ: إنشاء سجل الموظف والحساب المالي كالمعتاد، بالإضافة إلى إنشاء سجل المستخدم في جدول `users` وتعيين `linkedType: 'employee'` و `linkedEntity: empId` بربط مباشر.

#### [MODIFY] [Couriers.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/Couriers.tsx)
- إضافة زر وتأرجح (Toggle/Checkbox) في نموذج إضافة المندوب: **"إنشاء مستخدم في النظام للمندوب"**.
- عند تفعيله تظهر حقول إنشاء المستخدم: (اسم المستخدم للنظام `username`، كلمة المرور `password`، الدور `role`).
- عند الحفظ: إنشاء سجل المندوب والحساب المالي، وإنشاء حساب مستخدم للنظام في جدول `users` وتعيين `linkedType: 'courier'` و `linkedEntity: courierId`.

---

### 2. خدمات وحسابات العميل والموقع (`src/services/portalUserService.ts` & `src/components/entities/EntityCreateModals.tsx` & `src/pages/Customers.tsx`)

#### [NEW] [portalUserService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/portalUserService.ts)
- إنشاء خدمة مخصصة لفصل Business Logic لمستخدمي الموقع (`portal_users`) وتفاصيل العملاء (`cust_details`).
- توفير دوال:
  - `getPortalUsers()`: استعلام جلب كافة مستخدمي الموقع وإثرائهم بتفاصيل العملاء.
  - `createPortalUser(portalUserData, custDetailsData)`: إدراج سجل في `portal_users` و `cust_details`.
  - `updatePortalUser(id, portalUserData, custDetailsData)`: تحديث بيانات مستخدم الموقع والتفاصيل الإضافية.
  - `togglePortalUserStatus(id, disabled)`: تفعيل أو تعطيل حساب مستخدم الموقع.
  - `deletePortalUser(id)`: حذف مستخدم الموقع والتفاصيل الإضافية التابعة له.
  - `saveCustomerDetails(customerId, userUid, details)`: حفظ التفاصيل الإضافية للعميل في `cust_details`.

#### [MODIFY] [EntityCreateModals.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/entities/EntityCreateModals.tsx) & [Customers.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/Customers.tsx)
- **إظهار حقول تفاصيل العميل الإضافية دائماً**: (العنوان التفصيلي، موقع GPS، المدينة، الدولة، اسم الشركة، رقم الهوية/السجل التجاري، الحد الأقصى للدين، ملاحظات).
- **زر "إنشاء مستخدم في الموقع للعميل"**: عند النقر عليه تظهر حقول مستخدم الموقع (اسم المستخدم للموقع، البريد الإلكتروني للموقع، كلمة المرور للموقع، الدور `'client'`).
- **تقسيم النموذج إلى مراحل وتبويبات (Tabs/Steps Wizard)**:
  - 📋 **التبويب الأول — البيانات الأساسية**: الاسم الكامل، رقم الهاتف، البريد الإلكتروني.
  - 🏢 **التبويب الثاني — التفاصيل الإضافية (`cust_details`)**: العنوان، المدينة، الدولة، اسم الشركة، السجل التجاري/الهوية، سقف الدين.
  - 🌐 **التبويب الثالث — حساب مستخدم الموقع (`portal_users`)**: زر التفعيل، اسم المستخدم، بريد الموقع، كلمة المرور.

---

### 3. إدارة الموقع الإلكتروني (`src/pages/WebsiteManagement.tsx`)

#### [MODIFY] [WebsiteManagement.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/pages/WebsiteManagement.tsx)
- إضافة تبويب رئيسي جديد: **"🌐 مستخدمين الموقع" (`portal_users`)** ضمن شريط تبويبات إدارة الموقع.
- بناء واجهة متكاملة لإدارة مستخدمين الموقع:
  - جدول تفاعلي يعرض كافة مستخدمي البوابة (`portal_users`) مع بيانات العميل والمرجع وتفاصيل `cust_details`.
  - شريط بحث وتصفية حسب حالة الاعتماد وحالة الحساب والاسم والبريد والدور.
  - نافذة **"إضافة مستخدم موقع جديد"** مع إمكانية ربطه بعميل قائم أو إنشاء عميل جديد له وتخزين `cust_details`.
  - نافذة **"تعديل بيانات مستخدم الموقع"** لتحديث اسم المستخدم، البريد، كلمة المرور، التفاصيل الإضافية، وحالة الاعتماد.
  - إمكانية **"تعطيل / تفعيل"** و **"حذف"** الحساب مع تأكيد الحذف.
  - زر **"استعراض النشاطات"** للوصول الفوري إلى طلبات وتذاكر العميل المرتبط بالمستخدم.

---

### 4. التوثيق وتطابق القواعد (`user_global`)

#### [MODIFY] [user_commends.md](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/user_commends.md)
- إضافة أمر المستخدم كاملاً تحت العنوان `## [2026-09-10 01:22:00] — AI Model: Antigravity / Gemini 3.6 Flash`.

#### [MODIFY] [todo.md](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/todo.md)
- إضافة المهام الجديدة المختصرة في نهاية الملف دون حذف أي بيانات سابقة.

#### [MODIFY] [devloping_history.md](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/devloping_history.md)
- توثيق كافة التغييرات المنجزة وتاريخ الإنجاز.

#### [MODIFY] [DBdevloping_history.md](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/DBdevloping_history.md)
- توثيق الجداول والحقول المستخدمة (`users`, `portal_users`, `cust_details`).

---

## Verification Plan

### Automated Tests & Type Checks
- تشغيل فحص الأنواع `npx tsc --noEmit` للتحقق 100% من عدم وجود أي أخطاء تركيبية في TypeScript.
- تشغيل البناء الإنتاجي `npm run build` للتأكد من خلو المشروع من أخطاء التجميع.

### Manual Verification
- **تجربة إضافة موظف / مندوب جديد**: التأكد من ظهور زر "إنشاء مستخدم في النظام للموظف/المندوب" وحفظ السجل في `employees`/`couriers` وإنشاء مستخدم في `users` وربطهما بصورة آمنة.
- **تجربة إضافة عميل جديد**: التأكد من تقسيم النموذج إلى مراحل وتبويبات، وإظهار التفاصيل الإضافية دائماً وحفظها بجدول `cust_details` وحفظ مستخدم الموقع بـ `portal_users` عند النقر على الزر.
- **تجربة واجهة مستخدمين الموقع**: فتح تبويب "مستخدمين الموقع" بـ `WebsiteManagement.tsx` واختبار الإضافة، التعديل، التفعيل/التعطيل، والحذف واستعراض البيانات بنجاح.
