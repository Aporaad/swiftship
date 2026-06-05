# دليل نظام المحاسبة المالية (SCF) - SwiftShip
# SwiftShip Financial Accounting System Documentation

---

## 1. نظرة عامة على النظام المحاسبي

يعمل النظام المحاسبي المالي (SCF) على أساس القيد المزدوج (Double-Entry Bookkeeping) حيث كل عملية مالية تُسجّل بقيدَين متوازنين: مدين (Debit) ودائن (Credit). النظام متكامل مع جميع كيانات المنظومة (طلبات، عملاء، مناديب، موظفين) ويضمن تلقائية التسجيل المحاسبي.

### المجموعات الرئيسية في Firestore:
| المجموعة | الوظيفة |
|---------|---------|
| `orders` | الطلبات مع كافة البيانات المالية |
| `expenses` | سندات المصروفات والعهد والرواتب |
| `accounts` | الحسابات المالية الفرعية (دفتر الأستاذ الفرعي) |
| `account_transactions` | قيود دفتر الأستاذ (مدين/دائن) |
| `salary_history` | سجل صرف الرواتب |
| `settings` | أسعار الصرف والإعدادات المالية الافتراضية |
| `customers` | بيانات العملاء مع الحساب المالي |
| `couriers` | بيانات المناديب مع المحفظة |
| `users` | بيانات الموظفين مع الحساب المالي |

---

## 2. خطة الحسابات (Chart of Accounts)

### الحسابات النظامية الثابتة:
| الرمز | الاسم العربي | الاسم الإنجليزي | النوع | الرصيد الطبيعي |
|------|-------------|----------------|------|---------------|
| 1110 | الصندوق النقدي | Cash Safe Box | أصول | مدين |
| 1120 | ذمم العملاء | Accounts Receivable | أصول | مدين |
| 1210 | أسطول المركبات | Vehicle Fleet | أصول | مدين |
| 1220 | أجهزة الفحص والمعدات | Inspection Equipment | أصول | مدين |
| 1230 | الأثاث والممتلكات الثابتة | Office Furniture/Fixed Assets | أصول | مدين |
| 2110 | عهد المناديب | Courier Custody | خصوم | دائن |
| 2120 | رواتب مستحقة | Salaries Payable | خصوم | دائن |
| 3100 | رأس المال المدفوع | Paid-in Capital | حقوق ملكية | دائن |
| 3200 | الأرباح المحتجزة | Retained Earnings | حقوق ملكية | دائن |
| 4100 | إيرادات الشحن | Shipping Revenue | إيرادات | دائن |
| 4200 | تسويات داخلية | Internal Adjustments | إيرادات | دائن |
| 5100 | مصروفات تشغيلية | Operating Expenses | مصروفات | مدين |
| 5200 | عمولات المناديب | Courier Commissions | مصروفات | مدين |
| 5300 | رواتب الموظفين | Staff Salaries | مصروفات | مدين |

### الحسابات الفرعية التلقائية (Subledgers):
| البادئة | الكيان | التصنيف | مثال |
|---------|-------|---------|------|
| 1130-xxxx | عميل | ذمم مدينة (أصول) | 1130-0001 |
| 2120-xxxx | مندوب | عهد/دائن (خصوم) | 2120-0001 |
| 2130-xxxx | موظف | رواتب مستحقة (خصوم) | 2130-0001 |

---

## 3. إنشاء الحسابات المالية التلقائي

عند إنشاء أي كيان جديد، يتم تلقائياً إنشاء حساب مالي مرتبط به:

### 3.1 إنشاء عميل جديد:
```
الخطوة 1: حفظ بيانات العميل في مجموعة customers
الخطوة 2: إنشاء حساب مالي في مجموعة accounts برمز 1130-NNNN
الخطوة 3: تحديث مستند العميل بـ financialAccountId و financialAccountCode
النتيجة: العميل يظهر رصيده المالي فوراً في الجدول مع أيقونة 🪙
```

### 3.2 إنشاء مندوب جديد:
```
الخطوة 1: حفظ بيانات المندوب في مجموعة couriers
الخطوة 2: إنشاء حساب مالي في مجموعة accounts برمز 2120-NNNN
الخطوة 3: تحديث مستند المندوب بـ financialAccountId و financialAccountCode
النتيجة: المندوب يظهر رصيد عهدته فوراً في الجدول
```

### 3.3 إنشاء موظف جديد:
```
الخطوة 1: حفظ بيانات الموظف في مجموعة users
الخطوة 2: إنشاء حساب مالي في مجموعة accounts برمز 2130-NNNN
الخطوة 3: تحديث مستند الموظف بـ financialAccountId و financialAccountCode
النتيجة: الموظف يظهر رصيده المالي فوراً في الجدول
```

---

## 4. بنية الحساب المالي (FinancialAccount)

```typescript
interface FinancialAccount {
  id: string;
  accountCode: string;          // 1130-0001, 2120-0001, 2130-0001
  accountPrefix: string;        // '1130', '2120', '2130'
  accountNumber: string;        // رقم تسلسلي مسبوق بأصفار
  entityType: 'customer' | 'courier' | 'employee';
  entityId: string;             // FK → customers/{id} | couriers/{id} | users/{id}
  entityName: string;           // الاسم (مخزن لتسريع العرض)
  currency: string;             // العملة الأساسية (YER)
  balance: number;              // الرصيد الحالي بالعملة الأساسية
  debitTotal: number;           // إجمالي المدين
  creditTotal: number;          // إجمالي الدائن
  isActive: boolean;            // حالة الحساب
  monthlySalary?: number;       // الراتب الشهري (للموظفين فقط)
  createdAt: number;
  updatedAt: number;
}
```

---

## 5. بنية القيد المحاسبي (AccountTransaction)

```typescript
interface AccountTransaction {
  id: string;
  accountId: string;            // FK → accounts/{id}
  accountCode: string;          // رمز الحساب للعرض
  entityType: 'customer' | 'courier' | 'employee';
  entityId: string;             // FK → الكيان الأصلي
  entityName: string;           // الاسم (مخزن للتسريع)
  type: 'Debit' | 'Credit';     // نوع القيد
  amount: number;               // المبلغ بالعملة الأساسية
  amountOriginal: number;       // المبلغ بالعملة الأصلية
  currencyOriginal: string;     // 'YER' | 'USD' | 'SAR'
  description: string;          // وصف القيد
  refNumber: string;            // رقم المرجع (طلب/مصروف)
  module: 'expense' | 'order' | 'adjustment' | 'custody' | 'payment' | 'salary';
  salaryMonth?: string;         // YYYY-MM (للرواتب فقط)
  createdAt: number;
  createdByUid: string;
  createdByName: string;
}
```

---

## 6. معادلات الحسابات المالية للطلبات

### 6.1 حساب تكلفة المنتجات:
```
productsSum = Σ(item.quantity × item.productPrice)
bankCommValue = bankCommissionEnabled ? (productsSum × bankCommissionRate / 100) : 0
couponValue = couponEnabled ? (productsSum × couponRate / 100) : 0
priceSAR = productsSum + bankCommValue - couponValue
```

### 6.2 حساب تكلفة الشحن:
```
IF شحن مسجّل في جدول الشحن:
  shippingCostSAR = Σ(shippingCost) + packagingFeeRate%
  
ELSE IF طلب مصنع:
  shippingCostSAR = MAX(totalWeight × 19, totalCBM × 1400)
  
ELSE IF تطبيقات تسوق:
  IF sheinRedPrice موجود:
    priceSAR = sheinRedPrice
  shippingCostSAR = priceSAR × (companyProfitRate / 100)
```

### 6.3 حساب الإجمالي والمدفوع:
```
totalOrderSAR = priceSAR + shippingCostSAR + packagingFee
exchangeRate = (currency === 'USD') ? exchangeRateUSD : exchangeRateYER
totalOrderYER = totalOrderSAR × exchangeRate
totalBilled = totalOrderYER + deliveryCourierFee
amountRemaining = totalBilled - amountPaid

paymentStatus:
  IF amountRemaining ≤ 0 → 'Paid'
  IF amountPaid > 0 → 'Partial Paid'  
  ELSE → 'Unpaid'
```

### 6.4 توزيع الأرباح:
```
rawProfitSAR = shippingCostSAR + packagingFee
saudiRate = shippingCourier.commissionRate || 30%
profitSaudiSAR = rawProfitSAR × (saudiRate / 100)
profitCompanySAR = rawProfitSAR - profitSaudiSAR
```

---

## 7. تحويل العملات

### أسعار الصرف الافتراضية (محفوظة في Settings):
| العملة | السعر مقابل YER |
|--------|---------------|
| USD | 535 |
| SAR | 140 |

### معادلة التحويل:
```
من USD إلى YER: amount × exchangeRateUSD
من SAR إلى YER: amount × exchangeRateSAR
من YER إلى USD: amount / exchangeRateUSD
من YER إلى SAR: amount / exchangeRateSAR
```

### تحويل العملات في الحسابات المالية:
```
convertToDefaultCurrency(amount, fromCurrency, defaultCurrency, rates):
  1. تحويل إلى YER كعملة أساسية
  2. إذا العملة المصدر = العملة الهدف → إرجاع المبلغ مباشرة
  3. تحويل من YER إلى العملة الهدف إذا لزم
```

### حماية أسعار الصرف:
- الموظفون العاديون لا يستطيعون تعديل أسعار الصرف في الطلبات (حقل disabled)
- صلاحية `edit_exchange_rates` مطلوبة للتعديل
- سعر الصرف التاريخي يُحفظ مع كل طلب (`exchangeRateAtCreation`, `exchangeRateDate`)

---

## 8. تدفقات العمليات المالية

### 8.1 تدفق إيراد الطلب:
```
عند إنشاء طلب جديد:
  حساب العميل 1130-xxxx  ←  مدين  (totalCostYER)
  إيراد الشحن 4100       ←  دائن  (totalCostYER)

عند استلام دفعة من العميل:
  الصندوق 1110           ←  مدين  (amountPaid)
  حساب العميل 1130-xxxx  ←  دائن  (amountPaid)
```

### 8.2 تدفق عهدة المندوب:
```
عند صرف عهدة للمندوب:
  حساب المندوب 2120-xxxx  ←  مدين  (مبلغ العهدة)
  الصندوق 1110            ←  دائن  (مبلغ العهدة)
  حالة المصروف: Pending

عند تسوية العهدة:
  الصندوق 1110            ←  مدين  (مبلغ التسوية)
  حساب المندوب 2120-xxxx  ←  دائن  (مبلغ التسوية)
  حالة المصروف: Settled
```

### 8.3 تدفق صرف الرواتب:
```
عند صرف راتب موظف:
  حساب الموظف 2130-xxxx  ←  دائن  (مبلغ الراتب)
  الصندوق 1110            ←  مدين  (مبلغ الراتب)
  يُنشأ سجل في salary_history برمز SAL-YYYYMM-####
```

### 8.4 تدفق المصروفات العامة:
```
عند تسجيل مصروف:
  مصروفات تشغيلية 5100   ←  مدين  (مبلغ المصروف)
  الصندوق 1110            ←  دائن  (مبلغ المصروف)
```

---

## 9. تحديث أرصدة الحسابات

كل قيد محاسبي يُحدّث الرصيد تلقائياً بعملية ذرية (writeBatch):
```
IF نوع القيد = 'Debit':
  balance += amount
  debitTotal += amount
  
IF نوع القيد = 'Credit':
  balance -= amount
  creditTotal += amount

transactionCount += 1
updatedAt = Date.now()
```

---

## 10. فئات المصروفات

| المعرف | الاسم العربي | الاسم الإنجليزي | النوع |
|--------|-------------|----------------|------|
| marketing | إعلانات وتسويق | Advertising & Marketing | General |
| packaging | تغليف وكرتون | Packaging & Cardboard | General |
| telecom | اتصالات وإنترنت | Communications & Internet | General |
| custody | عهد مالية لمندوب | Courier Custody | Custody |
| salary | صرف رواتب الموظفين | Staff Salary Payments | Salary |
| wages | أجور ومكافآت | Wages & Bonuses | General |
| factory | سداد مصنع الصين | Offshore Factory Trade | FactoryPayment |
| other | مصروفات أخرى | Other Expenses | General |

---

## 11. التقارير المالية

### 11.1 مقاييس الأداء المحسوبة:
| المقياس | المعادلة |
|---------|---------|
| إجمالي قيمة الطلبات | Σ(totalCostYER) |
| إجمالي المحصّل | Σ(amountPaid) |
| إجمالي المستحق | Σ(amountRemaining) |
| إجمالي المصروفات العامة | Σ(expenses where type=General) بالـYER |
| إجمالي مدفوعات المصنع | Σ(expenses where type=FactoryPayment) بالـUSD |
| إجمالي العهد المصروفة | Σ(expenses where type=Custody) بالـYER |
| إجمالي العهد المسوّاة | Σ(settled custody) بالـYER |
| صافي المصروفات التشغيلية | General + (عهد غير مسوّاة) |
| الربح الصافي | المحصّل - المصروفات التشغيلية |
| هامش الربح الصافي | (الربح الصافي / المحصّل) × 100% |
| معدل نجاح التوصيل | (الطلبات المسلّمة / غير الملغاة) × 100% |

### 11.2 تصدير التقارير:
- PDF مع خيارات متقدمة (ملخص تنفيذي، جدول الطلبات، سندات المصروفات، حركة المناديب، خانة التوقيع)
- CSV لتحليل البيانات

---

## 12. ميزان المراجعة (Trial Balance)

```
لكل حساب:
  رصيد = إجمالي المدين - إجمالي الدائن
  
التحقق: إجمالي المدين = إجمالي الدائن (التوازن المحاسبي)

أصول:     رصيد مدين (إيجابي)
خصوم:     رصيد دائن (سلبي)
حقوق:     رصيد دائن (سلبي)
إيرادات:  رصيد دائن (سلبي)
مصروفات:  رصيد مدين (إيجابي)
```

---

## 13. دفتر الأستاذ الخاص بالكيانات (Entity Ledger)

### 13.1 كشف حساب العميل:
```
لكل طلب:
  مدين: قيمة الطلب (totalCostYER) → Sales COD Charge
  دائن: المبلغ المدفوع (amountPaid) → COD Payment Settled
  
الرصيد الجاري = Σ(دائن) - Σ(مدين)
الرصيد الموجب = العميل له مستحقات
الرصيد السالب = العميل له فائض دفع
```

### 13.2 كشف حساب المندوب:
```
لكل مصروف عهدة:
  مدين: مبلغ العهدة → Custody Issued
لكل تسوية:
  دائن: مبلغ التسوية → Custody Settled
لكل طلب مسلّم:
  مدين: قيمة الطلب → COD Collected at Door

الرصيد الجاري = Σ(مدين) - Σ(دائن)
الرصيد = النقد في حوزة المندوب
```

---

## 14. صلاحيات النظام المالي

| الصلاحية | الوظيفة |
|---------|---------|
| view_finance | عرض البيانات المالية العامة |
| add_finance | إضافة سندات مالية |
| edit_finance | تعديل السندات المالية |
| edit_exchange_rates | تعديل أسعار الصرف |
| view_expenses | عرض المصروفات |
| add_expenses | إضافة مصروفات |
| edit_expenses | تسوية العهد |
| delete_expenses | حذف مصروفات |
| view_custody | عرض العهد المالية |
| view_reports | عرض التقارير المالية |
| view_financial_accounts | عرض الحسابات المالية |
| manage_financial_accounts | إدارة الحسابات المالية |

---

## 15. سجلات النشاط المالي

| الإجراء | الوصف |
|---------|------|
| create_wallet | إنشاء حساب مالي لكيان جديد |
| migrate_wallets | ترحيل الكيانات الموجودة |
| post_ledger | تسجيل قيد محاسبي |
| reverse_ledger | عكس قيد محاسبي |
| customer_payment | استلام دفعة من عميل |
| courier_custody_issue | صرف عهدة لمندوب |
| courier_custody_settle | تسوية عهدة مندوب |
| expense_posting | ترحيل مصروف |
| salary_payment | صرف راتب |
| manual_adjustment | تسوية يدوية |
| add_payment | إضافة دفعة طلب |
| settle_custody | تسوية عهدة |

---

## 16. ملفات النظام المالي

| الملف | الوظيفة |
|------|---------|
| src/types/finance.ts | تعريفات أنواع البيانات المالية |
| src/services/financialAccountService.ts | خدمة الحسابات المالية والقيود |
| src/services/walletService.ts | خدمة إنشاء المحافظ التلقائي |
| src/services/bookkeepingService.ts | خدمة القيد المزدوج |
| src/components/FinanceAccounting.tsx | واجهة الدفتر المحاسبي |
| src/components/FinanceReports.tsx | واجهة التقارير المالية |
| src/components/ChartOfAccounts.tsx | خطة الحسابات |
| src/components/AssetsPortfolio.tsx | إدارة الأصول الثابتة |
| src/components/GlobalEntityLedgerModal.tsx | كشف حساب الكيان |
| src/pages/Expenses.tsx | صفحة المصروفات والعهد |
| src/pages/SalaryHistory.tsx | سجل صرف الرواتب |
