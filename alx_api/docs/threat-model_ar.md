# نموذج التهديد الأمني — SwiftShip / alx_api

**التاريخ:** 2026-10-06 02:20 (+03:00)  
**النطاق:** `alx_api`، نظام SwiftShip المحلي، و`alx_web`  
**الحالة:** مسودة تنفيذية مرتبطة ببوابة الإطلاق

## 1. الحدود المعمارية الحالية

المسار المستهدف هو `SwiftShip/alx_web -> HTTPS JSON -> alx_api -> PostgreSQL`. يملك `alx_api` المصادقة والصلاحيات ومنطق الأعمال والمعاملات. ما زالت بعض الشاشات القديمة في النظام المحلي والموقع تستخدم طبقات Supabase/Legacy مباشرة، ولذلك لا يُعتبر الـcutover مكتملًا.

## 2. الأصول الحساسة

- كلمات المرور ووسائل إعادة التعيين وبيانات الجلسات.
- Access/Refresh Tokens ومفاتيح توقيع JWT.
- بيانات العملاء والعناوين وأرقام الهواتف.
- الطلبات والشحنات وأرقام التتبع.
- القيود المحاسبية والأرصدة والعهد.
- سجل التدقيق وبيانات الصلاحيات.
- أسرار اتصال PostgreSQL وقيم CORS وبيئة التشغيل.

## 3. التهديدات والضوابط

| التهديد | المسار | الضابط الحالي | الإجراء المتبقي |
|---|---|---|---|
| تجاوز الصلاحيات | HTTP API أو عميل معدل | RBAC وDeny-by-default واختبارات أمنية | إكمال مصفوفة Portal ownership |
| تسريب كلمة المرور | Frontend أو Logs | Argon2id داخل API ومنع Local Storage في Admin reset | نقل Portal Auth إلى API |
| إعادة استخدام Refresh Token | Auth API | Rotation وReuse Detection وإبطال الجلسات | اختبار تكامل PostgreSQL حي |
| كتابة مزدوجة Legacy/API | Feature flags | Gateways وfallback | تشغيل Shadow/Canary ثم إيقاف Legacy writes |
| كشف بيانات التتبع | Public Portal | DTO عام محدود وZod | مراجعة rate limit وcache headers |
| SQL injection | مدخلات HTTP | Parameters وRepositories | فحص ثابت شامل للـrepositories |
| فساد مالي | Finance writes | Transactions وقواعد التوازن وReversal | نقل Finance UI writes ثم منع RPC المباشر |
| اختراق سلسلة الاعتماديات | npm packages | فحص audit أولي | معالجة الحزم عالية الخطورة أو تثبيت بدائل |
| فقدان البيانات | Migration/تشغيل | Migrations قابلة للمراجعة | Backup/restore drill موثق قبل الإنتاج |

## 4. قرارات المنع

لا تُفعّل أعلام الكتابة في الإنتاج ما دام يوجد مسار Legacy موازٍ دون سياسة تعايش واضحة. لا تُحذف جداول أو دوال التوافق قبل أخذ نسخة احتياطية واختبار rollback ومقارنة أعداد السجلات والمجاميع المالية. لا تُسجل كلمات المرور أو Tokens أو الأسرار في `audit_logs` أو رسائل Pino.

## 5. بوابة القبول

يُقبل الانتقال التالي فقط بعد نجاح: فحص TypeScript/build/tests، اختبار صلاحيات المسار، اختبار rollback، smoke test عبر API مستخدم حقيقي غير إنتاجي، فحص direct database access في العميل، وتوثيق نتيجة backup/restore.
