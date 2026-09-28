# خريطة توحيد أسماء الحقول

**الحالة:** مسودة مبنية على القراءة الحالية؛ لا توجد تغييرات مطبقة.

## قواعد عامة

| الشكل القديم | الشكل المستهدف | ملاحظة |
|---|---|---|
| `name` | `name_ar` أو `name_en` | لا يحدد اللغة آلياً |
| `source_name` | `name_ar` أو `name_en` | يحدد حسب القيمة وسياق المصدر |
| `nameAr` | `name_ar` | نقل مباشر عند غياب تعارض |
| `nameEn` | `name_en` | نقل مباشر عند غياب تعارض |
| `fullName` | `full_name` | للأشخاص والكيانات المحددة |
| `createdAt` | `created_at` | تاريخ إنشاء |
| `updatedAt` | `updated_at` | تاريخ تعديل |
| `createdBy` / `createdByUid` | `created_by` | بعد تحقق FK المستخدم |
| `updatedBy` / `updatedByUid` | `updated_by` | بعد تحقق FK المستخدم |
| `isActive` | `is_active` | Boolean مباشر |
| `disabled` | `is_active = NOT disabled` | يحتاج إثبات المعنى |
| `jobsType` | `job_type` | الموظفون |
| `courierType` | `courier_type` | المناديب |
| `level` / `levels` | `courier_level` | بعد كشف التعارض |
| `commissionRate` | `commission_rate` | Numeric |
| `monthlySalary` | `monthly_salary` | Numeric |
| `gpsLocation` / `gps_location` | `gps_latitude`, `gps_longitude` | يحتاج محلل صيغة |
| `joinBy` / `join_by` | `join_by` | توحيد مباشر بعد مقارنة القيم |
| `referrerId` / `referrer_id` | `referrer_id` | توحيد مباشر بعد مقارنة القيم |
| `linkedAccId` | `account_id` | لا يطبق دون تحقق الحساب |
| `linkedCustomerId` | `linked_customer_id` | FK إلى customers |
| `shippingCompanyUrl` | `shipping_company_url` | توحيد مباشر |
| `trackingIDPrefix` / `trackingID_prefix` | `tracking_id_prefix` | كشف اختلاف القيم أولاً |
| `externalResponse` | `external_response` | سجلات WhatsApp |
| `errorMsg` | `error_message` | سجلات WhatsApp |

## الأسماء الشخصية

الجداول المستهدفة:

- `customers`
- `couriers`
- `employees`
- `portal_users` للتكامل المستقبلي فقط

يضاف فيها عند اعتماد البنية:

```text
full_name
name_ar
name_en
```

لا يتم ملء اللغتين آلياً من `full_name` إلا بقاعدة موثقة لكل صف أو مجموعة صفوف.
