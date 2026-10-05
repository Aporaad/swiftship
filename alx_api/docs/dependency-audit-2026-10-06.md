# Dependency Audit — 2026-10-06

## النطاق

تم تشغيل `npm audit --omit=dev --audit-level=high` بعد جلب آخر نسخة من `Aporaad/swiftship` و`Aporaad/alx_web`.

## النتائج

| المستودع | النتيجة |
|---|---|
| `alx_api` داخل SwiftShip | فحص TypeScript وbuild نجحا، لكن اختبار Jest العام توقف بـ `Segmentation fault` في `tests/security.test.ts` ضمن هذه الجلسة. لم يكتمل audit بسبب توقف السلسلة قبل الوصول إليه. |
| SwiftShip root | ظهرت 14 ثغرة npm في شجرة الاعتماديات، منها 7 عالية، وتشمل `browserslist`, `dompurify`, `node-forge`, `qs`, و`xlsx`. |
| `alx_web` | `npm audit --omit=dev --audit-level=high` أعاد `0 vulnerabilities`. |

## قرار المعالجة

لم يُنفذ `npm audit fix` تلقائيًا لأنه قد يغير إصدارات أو سلوك البناء دون مراجعة. يجب معالجة الثغرات في SwiftShip على دفعات صغيرة، بدءًا من الحزم عالية الخطورة القابلة للتحديث، مع تشغيل build/tests بعد كل دفعة. حزمة `xlsx` أبلغت عن ثغرات عالية دون إصلاح متاح، ولذلك يلزم تقييم استبدالها أو عزل مدخلاتها قبل الإطلاق.

## شرط الإطلاق

لا يُعتبر Hardening مكتملًا حتى تُراجع النتائج العالية، ويُسجل استثناء مبرر لكل ثغرة غير قابلة للإصلاح، ويُعاد تشغيل audit في CI مع تثبيت lockfile.
