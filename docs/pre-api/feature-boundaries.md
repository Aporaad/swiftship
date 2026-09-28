# Feature Boundaries — المرحلة 2

**التاريخ:** 2026-09-28
**الحالة:** مكتمل هيكلياً؛ لم يتم نقل صفحات أو تفعيل Gateway أو إنشاء API.

## 1. الهيكل المعتمد

كل Feature يلتزم بالمسارات التالية:

```text
src/features/<feature>/
├── components/
├── hooks/
├── services/
├── schemas/
├── types.ts
├── api.ts
└── index.ts
```

`components` للعرض فقط، و`hooks` لتنسيق حالة الواجهة واستدعاء Application Services، و`services` لمنطق الأعمال دون SQL، و`schemas` للتحقق، و`types.ts` للـView Models وDTOs، و`api.ts` لعقد Feature، و`index.ts` للتصدير العام.

## 2. مصفوفة النطاق

| Feature | المسار | الملكية الوظيفية | ملاحظات المرحلة 2 |
|---|---|---|---|
| Auth | `src/features/auth` | تسجيل الدخول والجلسة والهوية | لا تنقل أسرار أو SQL إلى components |
| Browser | `src/features/browser` | المتصفح الداخلي الخاص بالنظام، التصفح، والـproxy UI | لا يملك صلاحيات النظام أو بيانات الأعمال مباشرة |
| Users | `src/features/users` | مستخدمو النظام وحساباتهم | يتعامل مع Role ID دون كشف `users.password/system_pin` |
| Roles | `src/features/roles` | الأدوار والصلاحيات | أول Feature منخفض المخاطر؛ يحتوي Application Service وschema واختباراً |
| Customers | `src/features/customers` | العملاء وملفاتهم | لا يملك منطقاً مالياً داخلياً |
| Orders | `src/features/orders` | الطلبات وعناصرها وحالة الطلب | يعتمد لاحقاً على `order_status_id` |
| Products | `src/features/products` | المنتجات الرئيسية، التصنيفات، وحركة المنتج داخل الطلب | المرتجعات تُنسق مع Orders ولا تدمج ملكية المنتجات |
| Sources | `src/features/sources` | مصادر الطلب، شركات الشحن، والأصول/مصادر التوريد المرتبطة | لا يملك إنشاء القيود؛ الحساب المرجعي عبر Accounting |
| Shipments | `src/features/shipments` | الشحنات والتتبع | لا يملك إنشاء القيود المالية |
| Couriers | `src/features/couriers` | المناديب | علاقات الطلبات عبر عقد واضح |
| Employees | `src/features/employees` | الموظفون | الحساب المالي عبر Accounting boundary |
| Accounting | `src/features/accounting` | دليل الحسابات والعملات والأرصدة والعهد والمصروفات | `expenses` داخله، وليس Feature مستقلاً |
| FinanceEntries | `src/features/financeEntries` | القيود والسندات ودورات الترحيل والعكس والإلغاء وإعدادات القيد | Feature مالي مستقل عن Accounting |
| Notifications | `src/features/notifications` | الإشعارات والتنبيهات | لا ينفذ Business Logic للطلبات |
| Reports | `src/features/reports` | التقارير وقوالبها وإعداداتها | يستهلك DTOs ولا يقرأ صفوفاً خاماً |
| SiteManagement | `src/features/siteManagement` | إدارة موقع الشركة، المحتوى، القوالب، وإعدادات الموقع | لا يخلط إعدادات الموقع مع Settings العامة |
| Settings | `src/features/settings` | إعدادات النظام والواجهة | لا يملك صلاحيات القرار النهائي |

## 3. FinanceEntries scope

يشمل `FinanceEntries` القيود العامة والمركبة والمؤقتة، سندات القبض وسندات الصرف، إعدادات القيد، الترحيل، العكس، الإلغاء، والتدقيق المرتبط بالقيد. لا يشمل إدارة دليل الحسابات أو حذف المصروفات.

## 4. Accounting scope

يشمل `accounting` دليل الحسابات، الحسابات، العملات، الأرصدة المشتقة، العهد، والمصروفات. تم إنشاء `src/features/accounting/expenses/` كنطاق داخلي للمصروفات، مع منع إنشاء `src/features/expenses/`.

## 5. Legacy boundary

خلال هذه المرحلة تبقى الصفحات والخدمات القديمة تعمل في أماكنها، ولا يتم نقلها دفعة واحدة. لا يسمح بإضافة Supabase أو SQL إلى Feature components جديدة. النقل الفعلي يبدأ بعد إغلاق هذه المصفوفة ثم تنفيذ المرحلة 3 في المسارات التي تحددها الخطة.
