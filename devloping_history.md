

## [2026-10-12 00:25:25 +03:00] — حفظ ونشر دفعة Courier
- دُفع `Aporaad/alx_api@bc19c20` و`Aporaad/swiftship@314c48c` إلى `main`. Render أعلن deployment لكل منهما `live` (API deployment `dep-db5vrubbc2fs7396sbkg`، SwiftShip deployment `dep-db5vssoae00c73a57hb0`).
- تحقق بعد النشر: API readiness وSwiftShip root = HTTP 200؛ endpoints قراءة Reporting Couriers وإنشاء Courier بلا مصادقة = HTTP 401. لم تُرسل أي بيانات إنشاء موثقة أو تتغير صفوف إنتاج.
- اختبارات alx_api: check/build و30 suites/168 tests ناجحة. SwiftShip: check/build واختبارات wiring المستهدفة 5/5 ناجحة؛ full test ما زال يحوي فشلًا واحدًا في auto-voucher hook، لذلك لا تُعلن الخطة كاملة.
- باقي نطاق الخطة: كتابة الحسابات المالية عبر Finance API ثم بقية صفحات Users/Customers/Employees/Settings، وإزالة fallbacks المالية وإصلاح عقد auto-entry-rules.
