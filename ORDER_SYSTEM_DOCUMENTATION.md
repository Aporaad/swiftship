# دليل نظام إنشاء الطلبات - التوثيق والتحليل الشامل
# Order Creation System - Complete Documentation & Analysis

---

## 1. نظرة عامة

نظام الطلبات هو المحرك المالي الأساسي للتطبيق. كل طلب يُنشئ سلسلة من القيود المحاسبية المزدوجة ويرتبط بالعملاء والمناديب والمصادر. هذا الدليل يشرح كل مكون بناءً على الكود الفعلي.

---

## 2. حقول نموذج إنشاء الطلب (formData)

### 2.1 بيانات العميل:
| الحقل | النوع | الافتراضي | الوظيفة |
|------|------|---------|--------|
| `customerId` | string | `''` | معرف مستند العميل في Firestore |
| `customerName` | string | `''` | اسم العميل (يُملأ تلقائياً عند الاختيار) |
| `customerPhone` | string | `''` | رقم هاتف العميل (يُملأ تلقائياً) |
| `customerAddress` | string | `''` | عنوان التوصيل (يُملأ تلقائياً) |

### 2.2 بيانات المصدر:
| الحقل | النوع | الافتراضي | الوظيفة |
|------|------|---------|--------|
| `orderSourceId` | string | `''` | معرف المصدر في Firestore (شي/توباو/سلا...) |
| `orderSourceName` | string | `''` | اسم المصدر المعروض |
| `orderSourceType` | string | `'App'` | نوع المصدر: `'App'` (تطبيقات تسوق) أو `'Factory'` (مصنع صيني) |
| `externalOrderNumber` | string | `''` | رقم الطلب الأصلي من المصدر (سلا/رقم خارجي) |
| `trackingNumber` | string | `''` | رقم التتبع العالمي (يُعين تلقائياً = orderNumber إن لم يُحدد) |

### 2.3 بيانات الشحن:
| الحقل | النوع | الافتراضي | الوظيفة |
|------|------|---------|--------|
| `shippingCompany` | string | `'Aramex'` | شركة الشحن (Aramex/DHL/SafePost) |

### 2.4 بيانات المناديب:
| الحقل | النوع | الافتراضي | الوظيفة |
|------|------|---------|--------|
| `shippingCourierId` | string | `''` | معرف مندوب الشحن السعودي (المرحلة السعودية) |
| `deliveryCourierId` | string | `''` | معرف مندوب التوصيل اليمني (المرحلة النهائية) |
| `deliveryCourierFee` | number | `4000` | رسوم التوصيل اليمني الثابتة بالريال اليمني (YER) |

### 2.5 العملات وأسعار الصرف:
| الحقل | النوع | الافتراضي | الوظيفة |
|------|------|---------|--------|
| `currency` | string | `'SAR'` | العملة الأساسية للطلب (`SAR` أو `USD`) |
| `exchangeRateYER` | number | `390` | سعر صرف SAR إلى YER (يُسحب من الإعدادات) |
| `exchangeRateUSD` | number | `535` | سعر صرف USD إلى YER (يُسحب من الإعدادات) |

### 2.6 العمولات والرسوم:
| الحقل | النوع | الافتراضي | الوظيفة |
|------|------|---------|--------|
| `bankCommissionRate` | number | `3` | نسبة عمولة البنك % (تُسحب من الإعدادات) |
| `companyProfitRate` | number | `12` | نسبة هامش ربح الشركة % (للتطبيقات) |
| `packagingFee` | number | `0` | رسوم التغليف الثابتة بالـSAR |
| `sheinRedPrice` | number | `0` | سعر SHEIN الأحمر البديل (إن > 0 يُستبدل سعر المنتج) |

### 2.7 الدفع:
| الحقل | النوع | الافتراضي | الوظيفة |
|------|------|---------|--------|
| `amountPaid` | number | `0` | المبلغ المدفوع مقدماً بالـYER |
| `paymentMethod` | string | `'Cash'` | طريقة الدفع (نقدي/تحويل بنكي) |
| `notes` | string | `''` | ملاحظات داخلية |

---

## 3. بنية عناصر الطلب (items)

كل طلب يحتوي على مصفوفة عناصر (منتجات):

| الحقل | النوع | الوظيفة |
|------|------|--------|
| `productName` | string | اسم/عنوان المنتج من المصدر |
| `productUrl` | string | رابط المنتج على موقع المصدر |
| `quantity` | number | عدد الوحدات |
| `productPrice` | number | سعر الوحدة بالعملة الأساسية (SAR/USD) |
| `weight` | number | وزن الوحدة بالكيلوغرام |
| `cbm` | number | حجم الوحدة بالمتر المكعب |
| `length` | number | الطول بالسنتيمتر |
| `width` | number | العرض بالسنتيمتر |
| `height` | number | الارتفاع بالسنتيمتر |
| `trackingNumber` | string | رقم تتبع خاص بالعنصر (اختياري) |

---

## 4. بنية تفاصيل الشحن (shippingDetails)

كل طلب يحتوي على مصفوفة مراحل الشحن:

| الحقل | النوع | الوظيفة |
|------|------|--------|
| `id` | string | معرف فريد للمرحلة |
| `shippingType` | string | نوع النقل: `'بري'` (بري) / `'جو'` (جوي) / `'بحري'` (بحري) |
| `shippingCompany` | string | اسم شركة النقل |
| `shippingSource` | string | مدينة/موقع المصدر |
| `shippingDestination` | string | مدينة/موقع الوجهة |
| `shippingDate` | string | تاريخ الشحن (YYYY-MM-DD) |
| `shippingDuration` | string | المدة بالأيام |
| `expectedArrival` | string | تاريخ الوصول المتوقع |
| `deliveryDate` | string | تاريخ التسليم الفعلي |
| `shippingCost` | number | تكلفة الشحن بالـSAR |
| `packagingFees` | number | رسوم التغليف لهذه المرحلة |

---

## 5. خوارزمية الترقيم التلقائي

```
صيغة الرقم: [PREFIX]-[YYMM]-[COUNTER]

مثال: ALX-2612-1001

PREFIX: من الإعدادات (افتراضي: 'ALX')
YY: آخر رقمين من السنة (2026 → 26)
MM: الشهر بصيغة مسبوقة بأصفار (ديسمبر → 12)
COUNTER: رقم تسلسلي يبدأ من orderStartNumber (افتراضي: 1001)

المنطق:
1. بناء بادئة الشهر: "ALX-2612"
2. البحث عن كل الطلبات في نفس الشهر بنفس البادئة
3. العداد = startNumber + عدد الطلبات الموجودة
4. النتيجة: ALX-2612-1001, ALX-2612-1002, ...
```

---

## 6. الخوارزمية المالية والحسابية

### 6.1 حساب تكلفة المنتجات:

```
الخطوة 1: مجموع المنتجات
  productsSum = Σ(item.quantity × item.productPrice)

الخطوة 2: حساب الوزن والحجم الإجمالي
  totalWeight = Σ(item.quantity × item.weight)
  totalCBM = Σ(item.quantity × item.cbm)

الخطوة 3: عمولة البنك (إن مفعّلة)
  bankCommValue = bankCommissionEnabled 
    ? productsSum × (bankCommissionRate / 100) 
    : 0

الخطوة 4: كوبون الخصم (إن مفعّل)
  couponValue = couponEnabled 
    ? productsSum × (couponRate / 100) 
    : 0

الخطوة 5: السعر بعد التعديلات
  priceSAR = productsSum + bankCommValue - couponValue
```

### 6.2 حساب تكلفة الشحن (3 أوضاع):

#### الوضع A: شحن مسجّل يدوياً (عند وجود بيانات في جدول الشحن):
```
shippingsCostSum = Σ(shippingCost من كل مرحلة)
shippingPackagingFee = packagingFeeEnabled 
  ? shippingsCostSum × (packagingFeeRate / 100) 
  : 0
shippingCostSAR = shippingsCostSum + shippingPackagingFee
```

#### الوضع B: طلب مصنع (Factory):
```
تكلفة الوزن = totalWeight × 19 SAR/كغ
تكلفة الحجم = totalCBM × 1400 SAR/م³
shippingCostSAR = MAX(تكلفة الوزن, تكلفة الحجم)

المنطق: يُأخذ الأكبر لأن شركات الشحن تحسب بالوزن الحقيقي أو الوزن الحجمي أيهما أكبر
```

#### الوضع C: تطبيقات التسوق (Shein/Taobao/AliExpress):
```
إن وُجد sheinRedPrice > 0:
  priceSAR = sheinRedPrice    ← يستبدل السعر المحسوب بالسعر الأحمر

shippingCostSAR = priceSAR × (companyProfitRate / 100)
مثال: priceSAR = 500, companyProfitRate = 12%
shippingCostSAR = 500 × 0.12 = 60 SAR
```

### 6.3 حساب الإجمالي:
```
totalOrderSAR = priceSAR + shippingCostSAR + packagingFee

تحديد سعر الصرف:
  IF currency = 'USD' → exchange = exchangeRateUSD
  IF currency = 'SAR' → exchange = exchangeRateYER

totalOrderYER = totalOrderSAR × exchange
```

### 6.4 حساب الرصيد المتبقي:
```
totalBilled = totalOrderYER + deliveryCourierFee
remainingYER = totalBilled - amountPaid

حالة الدفع:
  IF remainingYER ≤ 0        → 'Paid' (مدفوع بالكامل)
  IF amountPaid > 0           → 'Partial Paid' (مدفوع جزئياً)
  ELSE                        → 'Unpaid' (غير مدفوع)
```

### 6.5 توزيع الأرباح:
```
rawProfitSAR = shippingCostSAR + packagingFee
  - (IF Factory: totalWeight × 10 ELSE: 0)

saudiRate = shippingCourier.commissionRate || 30%

profitSaudiSAR = rawProfitSAR × (saudiRate / 100)
profitCompanySAR = rawProfitSAR - profitSaudiSAR

مثال:
  shippingCostSAR = 60, packagingFee = 15
  rawProfitSAR = 75
  saudiRate = 30%
  profitSaudiSAR = 75 × 0.30 = 22.5 SAR
  profitCompanySAR = 75 - 22.5 = 52.5 SAR
```

---

## 7. دورة حياة الطلب

### 7.1 حالات الطلب:
```
تم تسجيل الطلب (Pending)
    ↓
وصل مستودع السعودية (In KSA Depot)
    ↓
جاري الشحن لليمن (In Route)
    ↓
في التخليص الجمركي (Customs Clearance)
    ↓
وصل مركز التوزيع في اليمن (In Yemen Center)
    ↓
مع المندوب للتوصيل (Out for Delivery)
    ↓
تم التسليم (Delivered)

في أي مرحلة يمكن الإلغاء → ملغي (Cancelled)
```

### 7.2 الأحداث المالية في كل مرحلة:

| المرحلة | الحدث المالي | نوع القيد |
|---------|-------------|----------|
| إنشاء الطلب | تسجيل قيمة الطلب على العميل | مدين على حساب العميل |
| إنشاء الطلب (مع دفعة) | تسجيل الدفعة المقدمة | دائن على حساب العميل |
| التسليم | إنشاء عهدة تلقائية للمندوب | مدين على حساب المندوب |
| التسليم | تسوية رصيد العميل | دائن على حساب العميل |

---

## 8. تدفق إنشاء الطلب (10 خطوات)

```
1. التحقق من صحة البيانات ← customerId مطلوب
2. توليد رقم الطلب ← generateSmartOrderCode()
3. حساب القيم المالية ← computeCalculations()
4. تحديد حالة الدفع ← Paid / Partial Paid / Unpaid
5. بناء كائن البيانات (payload) ← كل الحقول + القيم المحسوبة
6. الحفظ في Firestore ← addDoc('orders', payload)
7. تسجيل قيد مدين على العميل ← financialAccountService.recordTransaction (Debit)
8. تسجيل قيد دائن للدفعة (إن وُجدت) ← financialAccountService.recordTransaction (Credit)
9. تسجيل النشاط ← activityLogService.log('add_order')
10. إرسال الإشعارات ← toast + WhatsApp
```

---

## 9. نموذج دفع الطلبات

### حقول نموذج الدفع:
| الحقل | النوع | الوظيفة |
|------|------|--------|
| `amount` | number | المبلغ المطلوب تحصيله بالـYER |
| `method` | string | طريقة الدفع (Cash/Bank Transfer) |
| `notes` | string | ملاحظات على الدفعة |
| `pin` | string | رمز PIN الأمني للموظف (إلزامي) |

### تدفق تسجيل الدفعة:
```
1. التحقق: amount > 0 و PIN يطابق رمز الموظف
2. حساب الأرصدة الجديدة:
   newPaid = amountPaid + paidAmount
   newRemaining = MAX(0, amountRemaining - paidAmount)
   newStatus = (newRemaining ≤ 0) ? 'Paid' : 'Partial Paid'

3. تحديث مستند الطلب:
   amountPaid → newPaid
   amountRemaining → newRemaining
   paymentStatus → newStatus

4. تسجيل القيد المحاسبي:
   نوع: Credit على حساب العميل
   المبلغ: المحوّل إلى عملة الحساب الافتراضية
   الوصف: "دفعة للطلب رقم: ALX-2612-1001"

5. تسجيل النشاط:
   activityLogService.log('add_payment')

6. إرسال إشعار واتساب بالدفعة
```

---

## 10. بنية مستند الطلب في Firestore

```typescript
{
  // المعرفات
  orderNumber: string,           // ALX-2612-1001
  trackingNumber: string,        // رقم التتبع
  
  // بيانات العميل
  customerId: string,
  customerName: string,
  customerPhone: string,
  customerAddress: string,
  
  // بيانات المصدر
  orderSourceId: string,
  orderSourceName: string,
  orderSourceType: 'App' | 'Factory',
  externalOrderNumber: string,
  
  // بيانات المناديب
  shippingCourierId: string,     // مندوب سعودي
  deliveryCourierId: string,     // مندوب يمني
  deliveryCourierFee: number,    // رسوم التوصيل اليمني (YER)
  
  // العملات والصرف
  currency: 'SAR' | 'USD',
  exchangeRateYER: number,        // سعر الصرف عند إنشاء الطلب
  exchangeRateUSD: number,        // سعر الصرف عند إنشاء الطلب
  
  // العمولات
  bankCommissionRate: number,     // %
  companyProfitRate: number,      // %
  packagingFee: number,           // SAR
  sheinRedPrice: number,          // سعر بديل
  
  // القيم المحسوبة
  totalWeight: number,            // كغ
  totalCBM: number,               // م³
  totalCostSAR: number,           // الإجمالي بالـSAR
  totalCostYER: number,           // الإجمالي بالـYER
  amountPaid: number,             // المدفوع بالـYER
  amountRemaining: number,        // المتبقي بالـYER
  paymentStatus: 'Paid' | 'Partial Paid' | 'Unpaid',
  paymentMethod: string,
  
  // توزيع الأرباح
  profitSaudiSAR: number,         // حصة المندوب السعودي
  profitCompanySAR: number,       // حصة الشركة
  
  // العناصر والشحن
  items: Array<Item>,             // مصفوفة المنتجات
  shippingDetails: Array<Shipping>, // مصفوفة مراحل الشحن
  
  // الحالة
  orderStatus: string,
  deliveryStatus: string,
  locationYemen: string,
  
  // البيانات الوصفية
  notes: string,
  createdByEmail: string,
  createdByName: string,
  createdAt: number,
  updatedAt: number
}
```

---

## 11. الارتباط مع النظام المحاسبي

### 11.1 عند إنشاء الطلب:
```
القيد المزدوج:

  مدين: حساب العميل 1130-xxxx    totalOrderYER + deliveryCourierFee
  دائن: إيرادات الشحن 4100       totalOrderYER + deliveryCourierFee

  إن وُجدت دفعة مقدمة:
    مدين: الصندوق النقدي 1110     amountPaid
    دائن: حساب العميل 1130-xxxx    amountPaid
```

### 11.2 عند تسجيل دفعة:
```
  مدين: الصندوق النقدي 1110      amount
  دائن: حساب العميل 1130-xxxx     amount
```

### 11.3 عند التسليم (إن وُجد رصيد متبقي):
```
  إنشاء مصروف عهدة تلقائي:
    مدين: حساب المندوب 2120-xxxx   remainingAmount
    دائن: الصندوق النقدي 1110      remainingAmount

  تسوية رصيد العميل:
    مدين: الصندوق النقدي 1110      remainingAmount
    دائن: حساب العميل 1130-xxxx    remainingAmount
```

### 11.4 تحويل العملات في القيود:
```
كل مبلغ YER يُحوّل إلى عملة الحساب الافتراضية قبل التسجيل:

  IF fromCurrency = defaultCurrency → المبلغ مباشرة
  ELSE:
    تحويل إلى YER أولاً:
      USD → YER: amount × 535
      SAR → YER: amount × 140
    ثم من YER إلى العملة الافتراضية إن لزم
```

---

## 12. الارتباط مع العملاء

### 12.1 آلية الربط:
```
الطلب.customerId ←→ العميل.id (مفتاح أساسي)

عند إنشاء طلب:
  1. يُبحث عن العميل في مجموعة customers
  2. يُستخرج: financialAccountId, financialAccountCode
  3. تُسجّل القيود على حساب العميل المالي

في كشف حساب العميل (GlobalEntityLedgerModal):
  لكل طلب:
    مدين: قيمة الطلب (Sales COD Charge)
    دائن: المبلغ المدفوع (COD Payment Settled)
  
  رصيد جاري = Σ(دائن) - Σ(مدين)
  رصيد موجب = العميل له فائض دفع
  رصيد سالب = العميل له مستحقات
```

---

## 13. الارتباط مع المناديب

### 13.1 مندوب الشحن السعودي:
```
shippingCourierId ←→ المندوب.id
يستلم نسبة من الأرباح (commissionRate)
profitSaudiSAR = rawProfitSAR × (commissionRate / 100)
```

### 13.2 مندوب التوصيل اليمني:
```
deliveryCourierId ←→ المندوب.id
يستلم رسوم ثابتة: deliveryCourierFee (YER)
عند التسليم يُنشأ تلقائياً:
  - مصروف عهدة (Custody) على المندوب
  - قيد مدين على حساب المندوب المالي

في كشف حساب المندوب:
  الطلبات المسلّمة فقط (status = 'تم التسليم'):
    مدين: مقبوضات COD في حوزة المندوب
  
  مصروفات العهدة:
    مدين: مبلغ العهدة المصروفة
    دائن: مبلغ العهدة المسوّاة
  
  رصيد جاري = النقد في حوزة المندوب
```

---

## 14. فاتورة PDF

### المحتوى:
```
╔══════════════════════════════════════════╗
║     SWIFTSHIP LOGISTICS INVOICE         ║
╚══════════════════════════════════════════╝

رأس الفاتورة:
  - شعار الفاتورة (invoiceLogo من الإعدادات)
  - اسم الشركة
  - رقم الطلب + تاريخ الإنشاء
  - رمز QR للتتبع

بيانات العميل:
  - الاسم / الهاتف / العنوان

جدول المنتجات:
  المنتج | الكمية | السعر | الوزن | الحجم

جدول الشحن:
  النوع | الشركة | المصدر ← الوجهة | التاريخ | التكلفة

ملخص مالي:
  إجمالي المنتجات:     xxxx SAR
  عمولة البنك:         +xxx SAR
  خصم الكوبون:         -xxx SAR
  تكلفة الشحن:         xxxx SAR
  رسوم التغليف:        xxx SAR
  ─────────────────────────────
  الإجمالي (YER):      xxx,xxx YER
  رسوم التوصيل:        x,xxx YER
  ─────────────────────────────
  المدفوع:             xxx,xxx YER
  المتبقي:             xxx,xxx YER

تذييل:
  - ملاحظات الفاتورة (invoiceNotes من الإعدادات)
```

---

## 15. الإعدادات المالية الافتراضية

تُسحب القيم الافتراضية من الإعدادات عند فتح نموذج الطلب:

| الإعداد | الحقل في formData | الافتراضي |
|--------|-------------------|---------|
| `exchangeRateSAR` | `exchangeRateYER` | 390 |
| `exchangeRateUSD` | `exchangeRateUSD` | 535 |
| `bankCommissionRate` | `bankCommissionRate` | 3% |
| `companyProfitRate` | `companyProfitRate` | 12% |
| `packagingFee` | `packagingFee` | 0 |
| `deliveryCourierFee` | `deliveryCourierFee` | 4000 YER |
| `orderPrefix` | في generateSmartOrderCode | ALX |
| `orderStartNumber` | في generateSmartOrderCode | 1001 |

---

## 16. الصلاحيات المتعلقة بالطلبات

| الصلاحية | الوظيفة | طريقة التطبيق |
|---------|--------|-------------|
| `view_orders` | عرض الطلبات | منع الوصول للصفحة |
| `add_orders` | إضافة طلبات | إخفاء زر الإضافة |
| `edit_orders` | تعديل الطلبات | إخفاء أزرار التعديل |
| `delete_orders` | حذف الطلبات | منع الحذف + إخفاء الزر |
| `delete_paid_orders` | حذف المدفوع | منع حذف الطلبات المدفوعة |
| `edit_delivered_orders` | تعديل المسلّم | منع تعديل بعد التسليم |
| `print_orders` | طباعة الفواتير | إخفاء زر الطباعة |
| `export_orders` | تصدير البيانات | إخفاء زر التصدير |
| `edit_exchange_rates` | تعديل الصرف | حقل سعر الصرف disabled |

---

## 17. سجلات النشاط المتعلقة بالطلبات

| الإجراء | الوصف | البيانات المسجلة |
|---------|------|----------------|
| `add_order` | إنشاء طلب جديد | رقم الطلب، العميل، الإجمالي |
| `edit_order` | تعديل بيانات طلب | الحقول المتغيرة |
| `delete_order` | حذف طلب | رقم الطلب، السبب |
| `add_payment` | تسجيل دفعة | المبلغ، الطريقة، المتبقي |
| `export_orders_pdf` | تصدير PDF | عدد الطلبات |
| `export_orders_csv` | تصدير CSV | عدد الطلبات |

---

## 18. مخطط العلاقات

```
                    ┌──────────────┐
                    │   Settings   │
                    │ (أسعار الصرف│
                    │  والعمولات) │
                    └──────┬───────┘
                           │ تُسحب عند الإنشاء
                           ▼
┌──────────┐    ┌─────────────────────┐    ┌──────────┐
│ Customer  │◄──►│      ORDER         │◄──►│ Courier  │
│1130-xxxx │    │  ALX-YYMM-NNNN    │    │2120-xxxx│
│(ذمم مدينة)│    │                     │    │(عهد/دائن)│
└────┬─────┘    │  items[]           │    └────┬─────┘
     │          │  shippingDetails[] │         │
     │          │  financial fields  │         │
     │          └────────┬──────────┘         │
     │                   │                     │
     │          ┌────────▼──────────┐         │
     │          │ account_transactions│◄────────│
     │          │ (القيود المحاسبية) │         │
     │          └────────┬──────────┘         │
     │                   │                     │
     ▼                   ▼                     ▼
┌──────────┐    ┌──────────────────┐    ┌──────────┐
│  Ledger  │    │   Expenses       │    │  Salary  │
│  (كشف    │    │  (عهد/مصروف)     │    │ History  │
│  حساب)   │    │                   │    │(رواتب)   │
└──────────┘    └──────────────────┘    └──────────┘
```
