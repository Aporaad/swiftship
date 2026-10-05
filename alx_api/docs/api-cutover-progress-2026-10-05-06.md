
## [2026-10-06T02:20:40+03:00] — جلب النسخ ومراجعة الحالة وبدء Hardening

### النسخ التي تمت مراجعتها
- SwiftShip: `882575c`.
- alx_web: `23cf870`.

### النتيجة الفعلية
- `alx_api`: الوحدات الأساسية وAuth/RBAC وCustomers وOperations وFinance وRoles وNotifications وPortal public routes موجودة ومسجلة.
- Portal API الحالي يغطي `tracking` و`announcements` العامة، ولا يغطي بعد Portal Auth أو الملف الشخصي أو التذاكر أو طلبات الموقع.
- ما زالت مراجع Legacy/Supabase مباشرة موجودة في شاشات وخدمات من النظام المحلي والموقع؛ لذلك لا يجوز إعلان اكتمال Legacy cutover.
- فحص npm أظهر 14 ثغرة في SwiftShip root، منها 7 عالية، بينما `alx_web` أظهر صفر ثغرات في dependencies الإنتاجية.

### التنفيذ الجديد
- إضافة `docs/threat-model_ar.md`.
- إضافة `docs/migration-rollback-plan_ar.md`.
- إضافة `docs/incident-runbook_ar.md`.
- إضافة `docs/dependency-audit-2026-10-06.md`.
- لم يُنفذ `npm audit fix` تلقائيًا، ولم يُنفذ SQL أو migration جديد.

### نتائج التحقق
- `alx_api npm run check`: ناجح.
- `alx_api npm run build`: ناجح.
- Jest العام في جلسة المراجعة الحالية توقف بـ `Segmentation fault` في `tests/security.test.ts`.

### المرحلة التالية الملزمة
1. تنفيذ Portal Auth API منفصل عن system users، مع session/profile/self-service password flow آمن للموقع.
2. نقل Portal tickets/orders/profile إلى API مع ownership checks.
3. نقل بقية كتابات وقراءات النظام المحلي خلف Gateways.
4. معالجة dependency vulnerabilities ثم تنفيذ PostgreSQL smoke وbackup/restore drill.
5. إغلاق Legacy cutover فقط بعد اجتياز boundary audit وrollback والمراقبة.
