# alx — خطة تحويله لتطبيق Desktop على Windows

## وصف المشروع

alx هو تطبيق React + Express + Supabase لتتبع الشحنات. الهدف هو تحويله إلى برنامج **Desktop ثابت على Windows** يعمل محلياً بدون متصفح منفصل، باستخدام **Electron** الذي يغلّف التطبيق ويجعله يبدو كبرنامج عادي.

## الاستراتيجية المختارة: Electron

**لماذا Electron؟**
- يحتوي المشروع على خادم Express يجب تشغيله في الخلفية (لإدارة المصادقة، Supabase، إلخ)
- React frontend يحتاج لبيئة تشغيل
- Electron يتضمن Node.js و Chromium ويمكنه تشغيل كل شيء داخله
- الناتج النهائي: ملف `.exe` واحد قابل للتثبيت والتشغيل

---

## الخطوات التنفيذية

### 1. تهيئة Electron في المشروع
- إضافة `electron`, `electron-builder`, `concurrently`, `wait-on` للـ devDependencies
- إنشاء ملف `electron/main.js` (نقطة دخول Electron)
- إنشاء ملف `electron/preload.js`

### 2. تعديل `package.json`
- إضافة scripts جديدة: `electron:dev`, `electron:build`
- إضافة إعدادات `electron-builder` (اسم التطبيق، الأيقونة، الناتج)
- تغيير `"main"` ليشير إلى `electron/main.js`

### 3. تعديل `vite.config.ts`
- تعيين `base: './'` بدلاً من `/` حتى تعمل المسارات النسبية في Electron
- تعيين منفذ ثابت للـ dev server

### 4. إنشاء `electron/main.js`
- تشغيل خادم Express داخل Electron كـ child process
- فتح نافذة Electron تحمّل الواجهة
- الانتظار حتى يصبح الخادم جاهزاً ثم تحميل الصفحة
- التعامل مع حالة الإنتاج (تحميل الـ dist المبني)

### 5. إنشاء ملف `.env` جاهز للعمل محلياً

### 6. إنشاء سكريبت `build-desktop.bat`
- ملف batch لتسهيل عملية البناء بنقرة واحدة

### 7. البناء والتحقق
- تشغيل `npm run build` لبناء الواجهة
- تشغيل `electron-builder` لإنشاء ملف الـ `.exe`

---

## ملفات ستُعدَّل أو تُنشأ

### [MODIFY] [package.json](file:///f:/system/swiftship-tracker/swiftshift2/swiftship/package.json)
- إضافة electron devDependencies
- إضافة build scripts وإعدادات electron-builder

### [MODIFY] [vite.config.ts](file:///f:/system/swiftship-tracker/swiftshift2/swiftship/vite.config.ts)
- تعيين `base: './'` للمسارات النسبية

### [NEW] electron/main.js
- نقطة دخول Electron الرئيسية
- تشغيل Express server
- إدارة النافذة

### [NEW] electron/preload.js
- سكريبت preload للأمان

### [NEW] build-desktop.bat
- سكريبت بناء سهل الاستخدام

### [NEW] .env
- متغيرات البيئة الفعلية للعمل المحلي

---

## خطة التحقق

### اختبارات آلية
- `npm run build` — التحقق من نجاح بناء Vite
- `npx electron-builder --win` — بناء ملف الـ installer

### التحقق اليدوي
- تشغيل `npm run electron:dev` والتأكد أن النافذة تفتح بشكل صحيح
- التحقق أن تسجيل الدخول يعمل
- التحقق من الاتصال بـ Supabase

> [!IMPORTANT]
> ستحتاج إلى ملف `.env` يحتوي على بيانات Supabase الحقيقية (`VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` و `SUPABASE_URL` و `SUPABASE_ANON_KEY`) حتى يعمل التطبيق بشكل كامل.

> [!NOTE]
> الناتج النهائي سيكون في مجلد `dist-electron/` وسيحتوي على ملف `.exe` قابل للتثبيت على أي جهاز Windows بدون الحاجة لـ Node.js.
