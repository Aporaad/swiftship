# خطة نقل Swiftship clients إلى HTTP API

**الحالة:** خطة مرحلية؛ لا تغييرات عميل نفذت بعد.
**المستودعات:** `Aporaad/swiftship` و`Aporaad/alx_web`، فُحصت محلياً بتاريخ 2026-10-04.

## نتيجة جرد الكود

- مستودع Swiftship يحتوي **38 ملفاً** يستعمل Supabase queries/auth ضمن عميل النظام. نقطة adapter عامة في `src/lib/supabase-adapter.ts` تشمل قراءات وكتابات ديناميكية (`select/insert/upsert/update/delete`)، إضافة إلى استدعاءات Auth قديمة.
- مستودع `alx_web` يحتوي **9 ملفات** بهذه الاستعمالات. بوابة `src/context/PortalAuthContext.tsx` تعتمد Supabase Auth (`signInWithPassword`, `signUp`, session state)، كما تحتوي `legacy-supabase/supabase.ts` CRUD عاماً وملفات أخرى تتعامل مع `portal_users`, `cust_details`, و`customers`.
- Auth Core الحالي في API مرتبط بجدول `public.users` لمستخدمي النظام. ليس بديلاً جاهزاً لمصادقة البوابة `portal_users` أو جلسات Supabase Auth. لا يجوز توجيه Portal إلى Auth النظامي قبل تصميم الهوية/الربط والملكية.

## ترتيب النقل الآمن

1. **تثبيت عقد HTTP المشترك:** توليد/مشاركة TypeScript client من `alx_api/docs/openapi.yaml`، مع `API_BASE_URL`، timeout، request ID، parsing موحد للأخطاء، وإدارة refresh rotation دون وضع refresh token في `localStorage`. يظل التخزين الدقيق لـWeb مقابل Electron قراراً مفتوحاً إلى أن يُحسم نمط Cookies/Web وsecure storage/Electron.
2. **Auth داخلي (Swiftship):** بعد تعيين مستخدمي legacy إلى `user_roles` صراحة، انقل login/me/permissions/refresh/logout وراء feature flag. استخدم مستخدم اختبار غير إنتاجي أولاً. لا تغيّر login للمستخدمين الآخرين حتى ينجح smoke test؛ لا PIN fallback.
3. **Customers API أولاً:** نفّذ API domain endpoints وpagination/filter/sort وownership tests حسب المرحلة 6. انقل صفحة واحدة إلى HTTP، وقارن النتائج دون dual-write. أوقف الرجوع المباشر فقط بعد تغطية CRUD والملكية والـaudit.
4. **Orders/Shipments ثم Finance:** لا تُحوّل CRUD العام عشوائياً. انقل عبر endpoints typed لكل domain، transaction/idempotency للعمليات الحساسة، واختبارات انتقال الحالة والتوازن المالي.
5. **alx_web Portal مستقل:** صمّم مسارات portal login/session وبيانات `portal_users` وملكية العميل أولاً؛ أبقِ Supabase Auth الحالي حتى يكتمل API portal auth واستعادة كلمة المرور وتثبت روابط الحساب. افصل صلاحيات العميل عن Admin/Employee.
6. **القطع النهائي:** راقب أخطاء API ورفض الصلاحيات وزمن الاستجابة لكل مرحلة؛ ابدأ بتفعيل صغير قابل للتراجع، ثم أزل adapters المباشرة فقط بعد التحقق من عدم استدعاء `.from()`/`.rpc()` أو Supabase Auth في الصفحات المنقولة. لا تُسقط مفاتيح/صلاحيات قاعدة البيانات القديمة حتى اكتمال النقل كله وخطة rollback.

## بوابات تمنع بدء cutover

- لا توجد بعد `user_roles` لأي مستخدم حقيقي (حالة production الحالية: 0 assignments).
- Customers/Orders/Shipments/Finance endpoints غير منفذة في API؛ Auth وRBAC وحدهما لا يغطيان اعتماد `supabase-adapter` العام.
- مسار Portal Authentication منفصل عن `public.users` ولم يُصمم بعد.
- لا توجد وجهة استضافة production مربوطة؛ WebDev رجع `not_attached`، وCORS الرسمي وTLS verify-full ومفاتيح production تحتاج إعداداً محمياً.
- reset delivery provider غير محدد؛ تغيير كلمة المرور والاستعادة يظلان معطّلين بأمان.

**القرار العملي:** لا نزيل اتصال Supabase من أي client ولا نغيّر `alx_web` الآن. المرحلة التالية بعد توفير قرار الاستضافة وuser-role mapping هي تنفيذ Customers API وفق الخطة، ثم تحويل مسار تجريبي واحد.
