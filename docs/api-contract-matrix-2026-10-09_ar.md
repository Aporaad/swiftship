# مصفوفة عقود API — SwiftShip

**المرحلة:** 0 — تثبيت الحدود والقياس  
**التاريخ:** 2026-10-09 00:29 (+03:00)  
**النطاق:** تعريف العقود وخط الأساس فقط؛ لا يوجد نقل ميزات أو تعديل قاعدة بيانات في هذه المرحلة.

## سياسة التشغيل

يُقرأ الوضع من `VITE_API_MODE`، والقيم المدعومة هي:

| الوضع | القراءة من legacy | الكتابة إلى legacy | الاستخدام |
|---|---:|---:|---|
| `api-only` | ممنوع | ممنوع | الإنتاج بعد اكتمال عقود المجال واختبارات القطع |
| `shadow` | مسموح مؤقتًا | ممنوع | مقارنة النتائج دون mutations مزدوجة |
| `legacy-migration` | مسموح | مسموح | التطوير/الترحيل فقط؛ مرفوض في production |

لا يغير هذا الملف المسار الحالي للميزات. تفعيل `api-only` لكل مجال يتطلب اكتمال حالة المجال في الجدول وإزالة fallback الخاص به.

## مصفوفة المجالات

| المجال | الحالة الحالية | API المسؤول | مرحلة القطع | الفجوة الرئيسية |
|---|---|---|---:|---|
| auth | متاح | `alx_api/modules/auth` | 2 | توحيد refresh/session في العميل |
| orders | جزئي | `alx_api/modules/operations` | 4 | مستهلكون قدامى وfallback |
| shipments | جزئي | `alx_api/modules/operations` | 4 | مستهلكون قدامى |
| products | جزئي | `alx_api/modules/operations` | 4 | returns/categories |
| customers | جزئي | `alx_api/modules/customers` | 4 | صفحات legacy |
| couriers/employees | جزئي | operations/reporting | 4 | قراءات legacy |
| users/roles | جزئي | users/roles | 6 | sessions وfallback في الصفحات |
| finance/accounting | جزئي | `alx_api/modules/finance` | 5 | خدمات وfallback مالي قديم |
| reports | جزئي | `alx_api/modules/reporting` | 5 | dashboard/report consumers |
| notifications | جزئي | `alx_api/modules/notifications` | 6 | service/page legacy |
| settings | مفقود | `alx_api/modules/settings` | 1 | اسم النظام والشعار والإعدادات العامة |
| currencies | مفقود | `alx_api/modules/currencies` | 1 | catalog والأسعار وأسعار الصرف |
| sources | جزئي | operations/reporting | 4 | CRUD legacy |
| site management | جزئي | portal/cross-cutting | 6 | تغطية غير مكتملة |
| returns/statuses/options/categories | مفقود | operations | 4 | لا توجد عقود API كاملة |
| browser/activity/sessions/search | مفقود | cross-cutting | 6 | مستمعون وعمليات legacy |

## خط الأساس للحدود

`src/config/legacy-boundary.baseline.json` يسجل الوضع الحالي كي يفشل الاختبار عند إضافة ملف جديد يستخدم:

- `data/legacy/legacy-compat`.
- Supabase runtime references مثل `supabase.from` و`supabase.channel` و`postgres_changes`.
- listeners مثل `onSnapshot` و`onAuthStateChanged`.

هذا **ليس قبولًا للمسار القديم**؛ هو آلية منع توسع أثناء النقل. كل مرحلة لاحقة يجب أن تقلل baseline حتى يصل إلى صفر في مسارات الإنتاج.

## معايير إنهاء المرحلة 0

- [x] تعريف `VITE_API_MODE` بقيم صريحة.
- [x] رفض `legacy-migration` في production.
- [x] تعريف مصفوفة عقود typed داخل التطبيق.
- [x] إنشاء static boundary test يمنع مخالفات جديدة.
- [x] تسجيل خط الأساس الحالي للمخالفات.
- [ ] الانتقال إلى المرحلة 1: بناء Settings/Currencies API في `alx_api`.
