# سجل مخاطر المرحلة الأولى قبل `alx_api`

**التاريخ:** 2026-09-28
**الحالة:** تسجيل وتحليل فقط؛ لا توجد معالجة SQL أو برمجية ضمن هذا الملف.

| المعرف | الخطر | الأولوية | الدليل الحالي | الإجراء قبل الإنتاج |
|---|---|---:|---|---|
| R-001 | وصول العملاء المباشر إلى Supabase | Blocker | `@supabase/supabase-js` واعتماد الصفحات/الموقع على طبقات مباشرة | Gateway ثم HTTP API ومنع الوصول المباشر تدريجياً |
| R-002 | RLS غير مفعل على جداول عامة كثيرة | Blocker/High | نتائج فحص Supabase السابقة | تقرير grants/policies ثم تفعيل مرحلي مختبر |
| R-003 | دوال SECURITY DEFINER قابلة للتنفيذ من anon | Blocker | نتائج مستشاري Supabase السابقة | تصنيف الدوال وسحب EXECUTE الحساس عبر Migration منفصلة |
| R-004 | أسرار/حقول حساسة في public أو Electron | Blocker | `users.password`, `users.system_pin` وإدراج `.env` في `extraResources` | Auth boundary، إزالة الأسرار من build، تدوير أي سر مكشوف |
| R-005 | اختلاف canonical IDs عن المحول القديم | High | مفاتيح `*_id` الجديدة مقابل aliases القديمة | Mapper واحد وContract tests |
| R-006 | `server.ts` يجمع مسؤوليات كثيرة | High | الخادم يشغل routes/auth/jobs/realtime/proxy/serving | تفكيك تدريجي بعد تثبيت العقود |
| R-007 | Realtime قد يسبب آثاراً مالية غير idempotent | High | listeners وعمليات reconciliation | event/transaction/idempotency contract |
| R-008 | legacy JSONB/financial references | High | migrations الحديثة أزالت مفاتيح وجداول قديمة | consumer register قبل الحذف |
| R-009 | فحوص Linux على مجلد Windows المركب غير موثوقة | High | `npm check` timeout و`ENOTCONN` في test/build | إعادة الفحص من Windows الأصلي |
| R-010 | وجود ملفات `.bak` | Medium | ملفات bak مرصودة في pages/components/services/config | تصنيفها ومنع استخدامها كمرجع تشغيل |

## قرار المعالجة

لا تعالج هذه المخاطر دفعة واحدة. المرحلة الحالية تنتج أدلة وتقارير فقط، ثم تعالج المخاطر في مراحل منفصلة قابلة للاختبار والرجوع.
