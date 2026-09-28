# Current State — قبل إنشاء `alx_api`

## الحالة المؤكدة

المشروع عند commit `684912285c39a268aa3ce23aa98e4cad300e202c`، وتوجد فيه واجهة React/Vite وخادم Express وElectron وموقع `alx_web` ومجلد `alx_api` تخطيطي فقط. طبقة Supabase الحالية موزعة بين adapter وخدمات وصفحات، ولا يوجد حد Gateway موحد بعد.

## قاعدة البيانات

آخر تغييرات مؤكدة تتضمن توحيداً واسعاً للمفاتيح إلى أسماء entity-specific، ونواة مالية حول `main_entry` و`account_trans`، وإضافات `order_party` و`orders_history` و`returned_products` وخرائط مستخدمي البوابة. هذه التغييرات يجب أن تكون مصدر العقود الجديدة، مع إبقاء التحويل legacy داخل Mapper مؤقت.

## قرار التنفيذ

المرحلة الحالية لا تنقل أي Feature ولا تنشئ route API. المخرج هو Baseline وFeature Inventory وRisks Register. بعد اعتمادها تكون الخطوة التالية إكمال Data Access Map سطرياً لكل Page/Service، ثم بناء Canonical Contracts وMapper tests.

## عوائق البيئة

الفحوص من Linux على مجلد Windows المركب غير مستقرة؛ لذلك لا تعتمد نتيجة `npm run check/test/build` الحالية كحكم على جودة الكود. تعاد من Windows الأصلي أو من مساحة عمل محلية مستقرة.

## تحديث الحالة — 2026-09-28

يسجل القسم أعلاه خط الأساس الأولي، أما الحالة التنفيذية الحالية فهي:

- **Phase 4 مغلقة:** DTOs وMappers وSchemas وعقود الحقول القديمة اجتازت الفحص والاختبارات؛ راجع `phase4-dtos.md`.
- **Phase 5 مغلقة ضمن نطاق الفصل والتجهيز:** `CurrentUserDto` و`SessionState` و`AuthSessionProvider` مستقلة عن Supabase وتعمل عبر `AuthGateway`. لم يُبنَ Auth API جديد.
- لا يستعيد النظام كائن مستخدم من Storage بعد refresh؛ يلزم تسجيل الدخول مجدداً حالياً. عند توافر Gateway يعيد جلسة قابلة للتحقق والتجديد، يمكنه استعادتها حتى انتهاء المصادقة أو إبطالها.
- تحقق Windows: `npm run check -- --pretty false` و`npm run build` نجحا. اختبارات `src` نجحت (26 ملفاً)، والاختبار الخارجي المعتمد على اتصال Supabase تعذر بسبب `ConnectTimeoutError`؛ تفاصيل النتائج في `phase5-auth-session.md`.
- لم يحدث أي تغيير في مخطط قاعدة البيانات أو بياناتها أو RLS.
- **المرحلة التالية حسب الخطة: Phase 6 — توحيد الصلاحيات في الواجهة دون اعتبارها مصدر التفويض النهائي.** لم يبدأ تنفيذها بعد.
