

## [2026-10-12 00:25:25 +03:00] — إغلاق دفعة Courier الأساسية
- [x] دفع `alx_api@bc19c20` و`swiftship@314c48c` إلى GitHub `main`، وأصبح deployment الخاص بكليهما `live` على Render.
- [x] تحقق API readiness = 200، وصفحة SwiftShip = 200؛ `GET /api/v1/reporting/couriers` و`POST /api/v1/operations/couriers` بلا مصادقة يعيدان 401، دون كتابة سجلات اختبار.
- [ ] التالي حسب الترتيب: API للحسابات المالية المرتبطة بـCourier ضمن Finance step 9، ثم بقية صفحات المرحلة 8 (Customers/Employees/Users/UserManagement/Settings) والحفاظ على الوظائف الحالية.
- [ ] لا يُغلق ترحيل API الكامل قبل نقل Finance fallbacks/auto-voucher والعمليات المتبقية واجتياز suite الواجهة كاملة؛ يبقى فشل `defaultAccountsVoucherWiring.test.ts` معروفًا وغير معالج في هذه الدفعة.
