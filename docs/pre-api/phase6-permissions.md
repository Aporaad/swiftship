# المرحلة 6 — توحيد الصلاحيات داخل الواجهة

**الحالة:** مكتملة بالكامل ومُتحقَّق منها.
**التاريخ:** 2026-09-28
**AI Model:** Gemini 3.6 Flash (High) / Antigravity

## القرار المعتمد

- لا تكتب الصفحات شرطاً من نوع `role === 'Admin' || hasPermission(...)`. هذا الفحص مُضمَّن داخل `usePermission()`.
- منطق "Admin يملك كل شيء" (wildcard `*`) موجود داخل `useRole.hasPermission()` ومُعاد تغليفه في `usePermission`.
- هذا التوحيد لإخفاء/إظهار عناصر UI فقط — التحقق النهائي يبقى في طرف الخادم.
- لم يُلمس `permissions.ts` القديم أو `useRole.ts`؛ تم البناء فوقهما دون تغيير السلوك الحالي.

## الملفات المنشأة

```text
src/shared/permissions/
├── PERMISSION_NAMES.ts   ← ثوابت كل مفاتيح الصلاحيات (PERM.EDIT_ORDERS إلخ)
└── index.ts              ← تصدير موحد

src/features/auth/hooks/
├── usePermission.ts      ← Hook مركزي: can(), canAll(), canAny()
└── usePermission.test.ts ← 8 اختبارات (جميعها ناجحة)

src/features/auth/components/
└── PermissionGate.tsx    ← مكوّن عرض مشروط بالصلاحيات
```

تم تحديث `src/features/auth/index.ts` لتصدير: `usePermission`, `UsePermissionResult`, `PermissionGate`.

## العقد الجديد

```ts
// بدلاً من:
role === 'Admin' || hasPermission('edit_orders')

// استخدم:
const { can } = usePermission();
can('edit_orders')

// أو مع PermissionGate:
<PermissionGate permission="edit_orders">
  <EditButton />
</PermissionGate>

// مع anyOf:
<PermissionGate anyOf={['edit_orders', 'delete_orders']}>
  <ActionMenu />
</PermissionGate>

// مع fallback:
<PermissionGate permission="edit_orders" fallback={<ViewOnlyBadge />}>
  <EditButton />
</PermissionGate>
```

## ثوابت PERM

تم إنشاء كائن `PERM` يحتوي على جميع مفاتيح الصلاحيات كـ constants مكتوبة بـ UPPER_SNAKE_CASE:

```ts
import { PERM } from '../../shared/permissions';
can(PERM.EDIT_ORDERS)  // بدلاً من can('edit_orders')
```

## حدود هذه المرحلة

- لم يتم إعادة كتابة الصفحات القديمة لاستخدام `usePermission` أو `PermissionGate` — هذا عمل Sprint 5 (Feature Refactor).
- الصفحات القديمة تواصل عملها بشكل طبيعي مع `role === 'Admin' || hasPermission(...)`.
- لا تغييرات على قاعدة البيانات أو RLS أو Gateways.

## التحقق

- **اختبارات `usePermission`:** 8/8 ناجحة.
- **TypeScript check:** نجح للملفات الجديدة.
- **`npm run build`:** لم يتم تشغيله بعد إغلاق المرحلة — يُشغَّل عند الحاجة.


## [2026-09-28 17:22:00 +03:00] — تدقيق مستقل وإغلاق المرحلة السادسة — AI Model: Manus

### نتائج تدقيق التغطية
- تمت مقارنة مصدر `PermissionKey` السابق في Git مع `PERM`: 152 مفتاح صلاحية ملموساً (بالإضافة إلى wildcard `*`) مقابل 152 ثابتاً، بلا مفاتيح مفقودة أو زائدة.
- كشف التدقيق أن `ALL_PERMISSIONS` كان يحتوي 150 تعريفاً فقط، رغم وجود `view_website_management` و`manage_website` في نوع `PermissionKey` والثوابت. أضيف التعريفان إلى كتالوج الأدوار تحت `admin`؛ أصبح الكتالوج يطابق الثوابت بالكامل (152/152) دون تكرار.
- لم تتغير `DEFAULT_ROLE_PERMISSIONS` أو قواعد Admin/wildcard، ولم تُمنح أي صلاحية تلقائياً لأي دور.
- أصبح `usePermission` و`PermissionGate` يقبلان `PermissionName` المشتق من `PERM` بدلاً من `string` المفتوح. ظل استخدامهما عرضياً داخل UI فقط، ولا يمثل تفويضاً أمنياً.

### التحقق بعد التدقيق
- اختبارات Hook الحالية: 8/8.
- اختبارات `PermissionGate`: 5/5.
- اختبار تطابق كتالوج الأدوار مع الثوابت: 1/1.
- `npm run check -- --pretty false`: ناجح على Windows.
- `npm test -- src --reporter=dot`: 29 ملفاً ناجحاً.
- `npm run build`: ناجح للواجهة والخادم. بقيت تحذيرات غير حاجبة تخص `import.meta` مع إخراج CJS وحجم بعض chunks.

### حدود العمل
لم تُعد كتابة الصفحات القديمة لاستخدام Hook/Gate، وفق حد المرحلة المعتمد. لا SQL ولا تغييرات قاعدة بيانات أو RLS، ولا Endpoint API. المرحلة 7 لم تبدأ.
