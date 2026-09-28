# Current State — قبل إنشاء `alx_api`

## الحالة المؤكدة

المشروع عند commit `684912285c39a268aa3ce23aa98e4cad300e202c`، وتوجد فيه واجهة React/Vite وخادم Express وElectron وموقع `alx_web` ومجلد `alx_api` تخطيطي فقط. طبقة Supabase الحالية موزعة بين adapter وخدمات وصفحات، ولا يوجد حد Gateway موحد بعد.

## قاعدة البيانات

آخر تغييرات مؤكدة تتضمن توحيداً واسعاً للمفاتيح إلى أسماء entity-specific، ونواة مالية حول `main_entry` و`account_trans`، وإضافات `order_party` و`orders_history` و`returned_products` وخرائط مستخدمي البوابة. هذه التغييرات يجب أن تكون مصدر العقود الجديدة، مع إبقاء التحويل legacy داخل Mapper مؤقت.

## قرار التنفيذ

المرحلة الحالية لا تنقل أي Feature ولا تنشئ route API. المخرج هو Baseline وFeature Inventory وRisks Register. بعد اعتمادها تكون الخطوة التالية إكمال Data Access Map سطرياً لكل Page/Service، ثم بناء Canonical Contracts وMapper tests.

## عوائق البيئة

الفحوص من Linux على مجلد Windows المركب غير مستقرة؛ لذلك لا تعتمد نتيجة `npm run check/test/build` الحالية كحكم على جودة الكود. تعاد من Windows الأصلي أو من مساحة عمل محلية مستقرة.
