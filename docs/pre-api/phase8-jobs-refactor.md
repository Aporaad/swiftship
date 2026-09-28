# المرحلة 8 — إصلاح خدمة Realtime والعمليات الخلفية

**الحالة:** مكتملة بالكامل ومُتحقَّق منها.
**التاريخ:** 2026-09-28
**AI Model:** Gemini 3.6 Flash (Medium) / Antigravity

## الملخص الإجمالي

تم إعادة هيكلة وتطوير إطار العمل الخاص بالوظائف الخلفية (Background Jobs) ومستمعات Realtime لعزل منطق الأعمال وتأمين الحدود المعاملية. تم التخلص من تنفيذ الأعمال المالية التلقائية العشوائية داخل Realtime Listeners واستبدالها بإطار عمل منظم يضمن الشروط الثمانية المعمارية المعتمدة لكل عملية خلفية.

## العناصر الهيكلية الثمانية المعرفّة لكل وظيفة خلفية

1. **Input**: نمط مدخلات معرف بدقة ومُحدد بالأنواع (TypeScript DTO).
2. **Trigger**: مصدر تحفيز صريح (`cron`, `event`, `manual`, `realtime_listener`).
3. **Preconditions**: فحص وتحقق من الشروط المسبقة وجاهزية قاعدة البيانات والمتغيرات قبل بدء التنفيذ.
4. **Transaction boundary**: تنفيذ العملية داخل حدود معاملية ذرية مؤمنة.
5. **Idempotency key**: مفتاح منع التكرار ومنع السباق بين العمليات والمتغيرات المتزامنة (`idempotencyKey`).
6. **Retry policy**: سياسة التكرار عند التعثر التلقائي مع مضاعفة التأخير الزمني (Exponential Backoff).
7. **Audit event**: كتابة سجل تدقيق النشاط (Activity Log / Audit Trail) فور الانتهاء.
8. **Failure behavior**: معالجة الأخطاء بسلوك فشل منظم وسليم دون إسقاط العملية أو تعطيل الخادم.

## الملفات المنشأة والمعدلة

```text
server/jobs/
├── types.ts                   ← تعاريف وعقود الوظائف الخلفية والشروط الثمانية
├── job-runner.ts              ← مشغل الوظائف الآمن (Preconditions, Idempotency, Retry, Audit, Failure)
├── account-reconciliation.ts  ← إعادة هيكلة مطابقة أرصدة الحسابات كمشغل خلفي منظم + Debounced Listener
├── tracking-sync.ts           ← إعادة هيكلة مزامنة التتبع الدوري
├── custody-settlement.ts      ← إنشاء مشغل تسوية عهد المناديب مع تسجيل التدقيق
└── jobs.test.ts               ← 6 اختبارات وحدة كاملة للتحقق من الشروط الثمانية
```

## تفاصيل الوظائف الخلفية المنفذة

### 1. مطابقة أرصدة الحسابات (`account-reconciliation.ts`)
- **المدخلات**: `AccountReconciliationInput { accountId: string }`.
- **المحفز**: `realtime_listener` (مع Debouncing بمقدار 500ms) أو `manual` أو `cron`.
- **مفتاح التكرار**: `reconcile_{accountId}_{timeBucket}` في إطار 2 ثانية لمنع تكرار الاحتساب متزامن.
- **التنفيذ المعاملي**: احتساب مجموع الحركات المدينة والدائنة تحديث الرصيد بناءً على طبيعة الحساب (أصول/خصوم).

### 2. مزامنة التتبع الدوري (`tracking-sync.ts`)
- **المدخلات**: `TrackingSyncInput { targetStatuses?: string[] }`.
- **الشروط المسبقة**: التحقق من تفعيل Logistics API وإعداد المفاتيح.
- **مفتاح التكرار**: `tracking_sync_{minuteBucket}`.
- **التنفيذ المعاملي**: تحديث بيانات الطلب وسجل التتبع العام تلقائياً فور اكتشاف تغيير خارجي.

### 3. تسوية عهد المناديب (`custody-settlement.ts`)
- **المدخلات**: `CustodySettlementInput { courierAccountId, transactionId, settlementAmount }`.
- **الشروط المسبقة**: فحص الحساب والمبلغ والعملة والمقبوض.
- **مفتاح التكرار**: `custody_settle_{transactionId}`.
- **سجل التدقيق**: كتابة سجل نشاط في `activity_logs`.

## نتائج التحقق

1. **TypeScript Typecheck**:
   - تم تشغيل `npx tsc --noEmit` بنجاح كامل بدون أي خطأ (0 errors).
2. **Vitest Unit Tests**:
   - `server/jobs/jobs.test.ts`: 6/6 اختبارات ناجحة (تحقق Preconditions, Idempotency suppression, Retries, Failure handling, Reconciliation, Custody Settlement).
3. **Production Build**:
   - تم تشغيل `npm run build` واجتازه بنجاح.

## الحدود والقيود
- لم يتم إجراء تغييرات على مخطط قاعدة البيانات أو RLS.
- لم يتم تغيير عقود واجهات UI الخارجية.
