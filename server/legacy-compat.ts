/**
 * طبقة التوافق مع الكود القديم (Legacy Compatibility Layer)
 * Legacy Compatibility — documents and isolates legacy patterns that must NOT be migrated to alx_api.
 *
 * هذا الملف يُوثِّق العيوب الحرجة في نمط الخادم الحالي ويُعزلها.
 * This file documents and isolates critical defects in the current server pattern.
 *
 * ⚠️ تحذير مهم: كل ما في هذا الملف يجب مراجعته وعدم نقله إلى alx_api.
 * ⚠️ Important: Everything here must be reviewed and MUST NOT be migrated to alx_api as-is.
 *
 * سجل العيوب الحرجة الموثقة:
 * Documented critical defects register:
 *
 * [DEFECT-01] بيانات اعتماد ثابتة في الكود
 *             Hardcoded credentials (admin@swiftship.system / systemPassword)
 *             الحالة: موثق — يُمنع نقله إلى API
 *             Status: Documented — must NOT be migrated to API
 *
 * [DEFECT-02] كلمات المرور تُخزَّن كنص صريح في public.users
 *             Passwords stored in plain-text in public.users
 *             الحالة: موثق — يُمنع نقله إلى API
 *             Status: Documented — must NOT be migrated to API
 *
 * [DEFECT-03] Business Logic مالي داخل Realtime listener
 *             Financial business logic running inside Realtime listener (account reconciliation)
 *             الحالة: موثق — سيُعاد التصميم في المرحلة الثامنة
 *             Status: Documented — will be redesigned in Phase 8
 *
 * [DEFECT-04] ROOT_EMAILS مُدرجة بشكل ثابت في الكود
 *             ROOT_EMAILS hardcoded in source
 *             الحالة: موثق — يُمنع نقله إلى API
 *             Status: Documented — must NOT be migrated to API
 *
 * [DEFECT-05] API routes مُعرَّفة مباشرة في server.ts بدون تنظيم
 *             API routes defined directly in server.ts without structure
 *             الحالة: مُعالَج في المرحلة السابعة بالاستخراج إلى server/routes/
 *             Status: Addressed in Phase 7 by extraction to server/routes/
 *
 * [DEFECT-06] استخدام Firebase-like API (supabase-adapter) في ملفات خادم جديدة
 *             Firebase-like API usage in new server files via supabase-adapter
 *             الحالة: مؤقت — الحد المقبول حتى إنشاء alx_api
 *             Status: Temporary — acceptable boundary until alx_api is created
 */

/**
 * قائمة الملفات والأنماط القديمة الواجب مراجعتها قبل API.
 * List of legacy files and patterns that must be reviewed before API creation.
 */
export const LEGACY_PATTERNS = {
  /** الـ Adapter القديم المبني على تحاكي Firebase / Firebase-like legacy adapter */
  adapterPath: 'src/lib/supabase-adapter.ts',

  /**
   * ملف الخادم الأصلي الكبير قبل التفكيك.
   * Original large server file before decomposition (Phase 7).
   * تم إبقاؤه لأغراض الاستلام والمقارنة.
   * Retained for reference and comparison.
   */
  legacyServerPath: 'server.ts',

  /**
   * بيانات الاعتماد الثابتة — موثقة كعيب حرج.
   * Hardcoded credentials — documented as critical defect.
   * يُمنع استخدامها في alx_api / Must NOT be used in alx_api.
   */
  criticalDefects: [
    'DEFECT-01: Hardcoded systemEmail/systemPassword in server/current-db/client.ts',
    'DEFECT-02: Plain-text passwords in public.users accessed by server/routes/auth.ts',
    'DEFECT-03: Financial business logic in Realtime listener (server/jobs/account-reconciliation.ts)',
    'DEFECT-04: ROOT_EMAILS hardcoded in server/routes/auth.ts',
  ],

  /**
   * يُمنع استيراد هذه الأنماط في ملفات جديدة لا صلة لها بطبقة التوافق.
   * These imports must NOT appear in new files outside the legacy compatibility layer.
   */
  bannedImportsInNewFiles: [
    "import * from '../src/lib/supabase-adapter'",
    "import { initializeApp } from '../src/lib/supabase-adapter'",
    "import { signInWithEmailAndPassword } from '../src/lib/supabase-adapter'",
  ],
} as const;

/**
 * يتحقق من أن ملف جديد لا يستورد الـ Adapter مباشرة.
 * Runtime guard — verifies a new file doesn't import the adapter directly.
 * يُستخدم في اختبارات التحقق من الحدود.
 * Used in boundary-check tests.
 *
 * @param importPath - مسار الاستيراد المراد التحقق منه
 */
export function assertNotLegacyAdapterImport(importPath: string): void {
  if (importPath.includes('supabase-adapter') && !importPath.includes('current-db')) {
    throw new Error(
      `[LegacyCompat] Direct import of supabase-adapter is not allowed in new files.\n` +
      `Use server/current-db/client.ts instead.\n` +
      `Offending import: ${importPath}`,
    );
  }
}
