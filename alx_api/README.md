# alx_api — Scaffold أولي

هذه مجلد خدمة API مستقل مبني وفق القرارات التقنية في `alx_api_creation_plan_ar.md`. يحتوي على هيكل TypeScript strict، وExpress 5، وتحقق البيئة، وRequest ID، وSecurity/CORS/Rate Limit middleware، وعقد الاستجابة، ومصنع PostgreSQL/Drizzle غير مستدعى تلقائياً، ومسارات Health، واختبارات تأسيسية وOpenAPI.

## الحالة وحدود هذا الـScaffold

- هذا **بدء تأسيسي فقط** وليس API أعمال مكتملة ولا جاهزة للإنتاج.
- لا Auth أو JWT أو RBAC أو business endpoints حتى الآن.
- لا يوجد اتصال بقاعدة SwiftShip أو أي `DATABASE_URL` مضمّن، ولا migrations ولا استعلامات DB.
- readiness يبقى `503` عمداً حتى توصيل واعتماد الاعتماديات ونشر إعدادها.
- قرارات Auth/Token/CORS/أدوار الإنتاج تُحسم قبل تنفيذ Auth النهائي.

## التشغيل المحلي

```bash
npm ci
npm run check
npm test
npm run build
npm run dev
```

انسخ `.env.example` إلى `.env` محلياً عند الحاجة، ولا تستخدم أسرار الإنتاج في التطوير. Health: `GET /api/v1/health/live` و`GET /api/v1/health/ready`.
