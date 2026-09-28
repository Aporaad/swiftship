/**
 * عميل قاعدة البيانات الحالي (Supabase Adapter)
 * Current Database Client — wraps the Supabase-Firebase adapter for server-side use.
 *
 * هذا الملف يُعرِّف دالة تهيئة عميل قاعدة البيانات المؤقت المبني على Supabase Adapter.
 * This file initialises the temporary database client built on top of the Supabase adapter.
 *
 * ملاحظة: هذا الملف مؤقت لمرحلة الانتقال قبل API.
 * Note: This file is temporary — used only during the pre-API transition phase.
 */

import admin, {
  initializeApp,
  getPostgreSQL,
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  limit,
  getDocs,
  updateDoc,
  onSnapshot,
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  setDoc,
  createUserWithEmailAndPassword,
} from '../../src/lib/supabase-adapter';

// ── نوع عميل قاعدة البيانات / Database client type ──────────────
export interface DbClient {
  db: ReturnType<typeof getPostgreSQL>;
  auth: ReturnType<typeof initializeAuth>;
  ready: boolean;
}

/**
 * تهيئة عميل قاعدة البيانات والمصادقة الخلفية.
 * Initialises the database client and backend authentication.
 *
 * @returns كائن يحتوي db و auth وعلامة ready
 */
export async function createDbClient(): Promise<DbClient> {
  let db: any = null;
  let auth: any = null;

  // تهيئة Admin SDK المحاكي / Initialise emulated Admin SDK
  try {
    admin.initializeApp();
    console.log('[DB Client] Backend Adapter Admin SDK initialized successfully');
  } catch (adminErr: any) {
    console.error('[DB Client] Backend Adapter Admin SDK init failed:', adminErr.message);
  }

  // تهيئة Client SDK / Initialise Client SDK
  try {
    const supabaseApp = initializeApp({});
    db = getPostgreSQL(supabaseApp);
    auth = initializeAuth(supabaseApp, { persistence: inMemoryPersistence });
    console.log('[DB Client] Backend Adapter Client SDK initialized successfully');
  } catch (e: any) {
    console.error('[DB Client] Backend Adapter Client SDK init failed:', e.message);
  }

  return { db, auth, ready: Boolean(db && auth) };
}

/**
 * مصادقة الخادم بحساب النظام الإداري.
 * Authenticates the server session using the system administrative account.
 *
 * ⚠️ تنبيه أمني: بيانات الاعتماد هذه موثقة كعيب حرج ويجب عدم نقلها إلى API الجديدة.
 * ⚠️ Security warning: These credentials are documented as a critical defect — MUST NOT be migrated to alx_api.
 */
export async function authenticateServerSession(auth: any, db: any): Promise<void> {
  if (!auth || !db) return;

  // ⚠️ بيانات اعتماد ثابتة — عيب حرج موثوق، لا تُنقل لـ API الجديدة
  // ⚠️ Hardcoded credentials — documented critical defect, do NOT copy to alx_api
  const systemEmail = 'admin@swiftship.system';
  const systemPassword = 'swiftship@system_pw_2026';

  try {
    await signInWithEmailAndPassword(auth, systemEmail, systemPassword);
    console.log('[DB Client] Backend server authenticated as admin@swiftship.system');
  } catch (authErr: any) {
    console.warn('[DB Client] Standard authentication failed:', authErr.message);

    if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/user-not-found') {
      try {
        await createUserWithEmailAndPassword(auth, systemEmail, systemPassword);
        console.log('[DB Client] Registered admin@swiftship.system on-the-fly');

        await setDoc(doc(db, 'users', auth.currentUser!.uid), {
          email: systemEmail,
          username: 'admin',
          fullName: 'System Root Administrator',
          role: 'Admin',
          isRoot: true,
          disabled: false,
          systemPin: '000000',
          // ⚠️ password مخزّن بالنص — عيب حرج / ⚠️ plain-text password — critical defect
          password: systemPassword,
          createdAt: Date.now(),
        });
      } catch (regErr: any) {
        console.error('[DB Client] Failed to register administrative account:', regErr.message);
      }
    }
  }
}

// ── تصدير دوال الـ Adapter للاستخدام من الملفات الأخرى ───────────
// Re-export adapter helpers so route files don't import the adapter directly
export {
  admin,
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  limit,
  getDocs,
  updateDoc,
  onSnapshot,
  setDoc,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
};
