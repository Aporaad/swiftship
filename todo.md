

## [2026-09-28 09:52:52 +03:00] — استكمال Gateway implementations لكل Features — AI Model: Manus
- [x] تنفيذ Gateway مستقل لكل Feature داخل `src/data/current-supabase/gateways`.
- [x] تنفيذ Auth وBrowser وFinanceEntries بعملياتهم الخاصة.
- [x] تنفيذ SiteManagement وSettings وReports وجميع الكيانات ذات الجداول الموثقة.
- [x] تصحيح FinanceEntries ليستخدم `posting_status`, `posted_by_uid`, `voided_by_uid`, و`timestamptz` وفق Schema الفعلي.
- [x] إضافة اختبار Mapper وأخطاء Data Gateway.
- [ ] مراجعة الأعمدة الكتابية لكل Gateway قبل تفعيله من Features؛ لا تفعيل UI في هذه الخطوة.
- [ ] بعد اعتماد مراجعة الكتابة، الانتقال للخطوة التالية داخل المرحلة 3 فقط.


## [2026-09-28 09:52:52 +03:00] — تحقق من اكتمال Gateway لكل Feature — AI Model: Manus
- [x] وجود ملف Gateway مستقل لكل Feature المعتمد، وليس Registry فقط.
- [x] مراجعة أعمدة الكتابة في Orders وRoles وFinanceEntries وفق Schema الفعلي.
- [x] إبقاء عمليات الكتابة غير مستدعاة حتى مرحلة التفعيل المقصودة.
- [x] عدم ربط UI أو حذف الخدمات Legacy أو إنشاء API Endpoint.


## [2026-09-28 10:07:49 +03:00] — تصحيح نطاق المرحلة الثالثة — AI Model: Manus
- [x] مراجعة إضافات المرحلة الثالثة مقابل هدف إصلاح الهيكل للانتقال إلى API.
- [x] حذف `featureGateways.ts` لأنه Registry عام زائد وغير مطلوب في المرحلة المؤقتة.
- [x] إبقاء Gateway مستقل لكل Feature داخل المسار المنصوص عليه فقط.
- [x] إضافة ضابط رسمي للخطة يميز بين المكونات المؤقتة والتوسعات الدائمة.
- [x] منع Business Logic وorchestration وربط UI داخل طبقة الانتقال.
- [ ] لا يتم بدء المرحلة الرابعة أو أي توسعة دائمة قبل إغلاق المرحلة الثالثة وفق معيار الخطة.
