# المرحلة 13 — Portal Gateway Bootstrap — 2026-10-02

## الحالة
بدأت المرحلة 13 في المستودع المنفصل `Aporaad/alx_web` حسب الخطة، دون نقل API إنتاجية أو تغيير قاعدة البيانات.

## المخرجات

- `src/contracts/portal.contracts.ts`
  - `PublicTrackingDto` لا يعرض الاسم أو الهاتف أو العنوان أو الرصيد.
  - `PortalUserSessionDto` لا يعرض كلمة مرور أو token.
- `src/api/portalGateway.ts`
  - عقد gateway للـ session والتتبع.
  - HTTP implementation لمسارات `/api/v1/portal/session` و`/api/v1/portal/tracking/:token`.
  - feature flag: `VITE_PORTAL_API_ENABLED` مع `VITE_PORTAL_API_BASE_URL`.
- `src/lib/legacy-supabase/supabase.ts`
  - موضع legacy واضح ومؤقت لتنفيذ Supabase القديم.
- `src/lib/supabase.ts`
  - compatibility re-export فقط؛ لا يُستخدم لإضافة استعلامات جديدة.

## حدود هذه الدفعة

- الـ feature flag معطل افتراضياً.
- لم تُنقل كل الصفحات القديمة دفعة واحدة.
- لم تُنشأ endpoints أو migrations أو SQL.
- لا يعتبر هذا إغلاقاً للمرحلة 13؛ بل بداية قابلة للاختبار قبل نقل أول consumer.

## التحقق

- بناء `alx_web` ناجح.
- فحص PII للعقود الجديدة لا يظهر حقول أسرار أو بيانات شخصية في DTOs.
- لا تغييرات قاعدة البيانات أو RLS.
