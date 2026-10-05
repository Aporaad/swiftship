
## [2026-10-06T02:20:40+03:00] — AI Model: Manus
- [منجز] جلب ومراجعة آخر نسخ SwiftShip وalx_web ومقارنة خطة API بالكود الفعلي.
- [منجز] إنشاء نموذج تهديد وخطة migration/rollback ودليل حوادث وتشغيل وتقرير Dependency Audit.
- [منجز] تأكيد أن Portal API الحالي يغطي التتبع والإعلانات العامة فقط.
- [متبقي] نقل Portal Auth والملف الشخصي وتغيير كلمة المرور الذاتي والتذاكر والطلبات من Legacy إلى API.
- [متبقي] نقل كتابات وقراءات SwiftShip المتبقية ومنع الوصول المباشر إلى Supabase قبل إغلاق Legacy cutover.
- [متبقي] معالجة ثغرات npm العالية في SwiftShip، واختبار backup/restore وPostgreSQL smoke test فعلي.
- [متابعة] Jest العام يتوقف بـ Segmentation fault في `tests/security.test.ts` رغم نجاح TypeScript/build.
