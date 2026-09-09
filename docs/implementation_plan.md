# إنشاء جدول المنتجات المرتجعة وتبويبة إدارتها

## وصف المهمة
إنشاء جدول `returned_products` في Supabase لتتبع المنتجات المرتجعة من العملاء، مع بناء تبويبة "المنتجات المرتجعة" داخل واجهة Orders (ضمن قسم المنتجات) تدعم كامل عمليات CRUD وخيارات التحكم والفلترة.

## الملاحظات الجوهرية

> [!IMPORTANT]
> - المشروع يستخدم `supabase-firebase-adapter` كمحول بين Firebase API وSupabase.
> - يوجد نمط تسمية Snake_case في قاعدة البيانات.
> - الجدول الجديد سيُنشأ بـ Supabase MCP مباشرة.
> - التبويبة الجديدة ستُضاف داخل `ProductsManagementTab.tsx` كـ sub-tab ثالث بعد "المنتجات الرئيسية" و"حركة المنتجات".

## التغييرات المقترحة

---

### 1. قاعدة البيانات — Supabase Migration

#### جدول `returned_products` الجديد

الأعمدة المقترحة:
| الحقل | النوع | الوصف |
|-------|-------|--------|
| `return_id` | TEXT (PK) | معرف المرتجع |
| `order_id` | TEXT | رقم الطلب المرتبط |
| `order_item_id` | TEXT | معرف بند الطلب (FK → order_items.items_id) |
| `product_id` | TEXT | معرف المنتج (FK → products.product_id) |
| `customer_id` | TEXT | معرف العميل |
| `customer_name` | TEXT | اسم العميل |
| `product_name` | TEXT | اسم المنتج عند الإرجاع |
| `quantity` | INTEGER | الكمية المرتجعة |
| `return_reason` | TEXT | سبب الإرجاع |
| `return_type` | TEXT | نوع الإرجاع (استبدال/استرداد/إصلاح) |
| `return_status` | TEXT | حالة المرتجع (معلق/مقبول/مرفوض/مكتمل) |
| `refund_amount` | NUMERIC | مبلغ الاسترداد |
| `refund_currency` | TEXT | عملة الاسترداد |
| `return_condition` | TEXT | حالة المنتج (جديد/مستخدم/تالف) |
| `notes` | TEXT | ملاحظات |
| `is_insured` | BOOLEAN | هل المنتج مؤمن |
| `insurance_refund` | NUMERIC | مبلغ استرداد التأمين |
| `returned_at` | TIMESTAMP | تاريخ الإرجاع |
| `processed_by` | TEXT | من قام بالمعالجة |
| `processed_at` | TIMESTAMP | تاريخ المعالجة |
| `created_at` | TIMESTAMP | تاريخ الإنشاء |
| `created_by` | TEXT | أنشأه |
| `updated_at` | TIMESTAMP | تاريخ التحديث |
| `updated_by` | TEXT | حدّثه |

مع:
- RLS: تفعيل حماية الصفوف (authenticated فقط)
- فهارس على: `order_id`, `product_id`, `customer_id`, `return_status`

---

### 2. خدمة `returnedProductService.ts` — [NEW]
#### [NEW] [returnedProductService.ts](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/services/returnedProductService.ts)
خدمة مستقلة تحوي Business Logic للمنتجات المرتجعة:
- CRUD كامل: `fetchReturnedProducts`, `createReturnedProduct`, `updateReturnedProduct`, `deleteReturnedProduct`
- فلترة متعددة (حسب الحالة، العميل، المنتج، التاريخ)
- إحصائيات: إجمالي، معلق، مكتمل

---

### 3. مكوّن `ReturnedProductsTab.tsx` — [NEW]
#### [NEW] [ReturnedProductsTab.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/orders/ReturnedProductsTab.tsx)
مكوّن مستقل يحوي:
- جدول عرض المرتجعات مع فلترة وبحث
- نموذج إضافة/تعديل مرتجع
- تحكم كامل: إضافة، تعديل، حذف، تغيير الحالة
- إحصائيات ملخصة في الأعلى
- ألوان حالة متمايزة

---

### 4. تعديل `ProductsManagementTab.tsx` — [MODIFY]
#### [MODIFY] [ProductsManagementTab.tsx](file:///f:/system/swiftship-tracker/swiftshift2/SWIFTSHIP_SYSTEM/src/components/orders/ProductsManagementTab.tsx)
إضافة زر التبويب الثالث "المنتجات المرتجعة" وتضمين `ReturnedProductsTab` عند تفعيله.

---

## خطة التحقق

### التحقق التلقائي
- بناء TypeScript بدون أخطاء

### التحقق اليدوي
- ظهور التبويبة الجديدة داخل قسم المنتجات
- إمكانية إضافة/تعديل/حذف مرتجع
- تحديث حالة المرتجع بشكل صحيح
