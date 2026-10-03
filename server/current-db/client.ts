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
import { readErrorCode, readErrorMessage } from '../../src/shared/contracts/unknown.contracts';

export type DatabaseClient = ReturnType<typeof getPostgreSQL>;
export type ServerAuthClient = ReturnType<typeof initializeAuth>;

// ── نوع عميل قاعدة البيانات / Database client type ──────────────
export interface DbClient {
  db: DatabaseClient | null;
  auth: ServerAuthClient | null;
  ready: boolean;
}

/**
 * تهيئة عميل قاعدة البيانات والمصادقة الخلفية.
 * Initialises the database client and backend authentication.
 *
 * @returns كائن يحتوي db و auth وعلامة ready
 */
export async function createDbClient(): Promise<DbClient> {
  let db: DatabaseClient | null = null;
  let auth: ServerAuthClient | null = null;

  // تهيئة Admin SDK المحاكي / Initialise emulated Admin SDK
  try {
    admin.initializeApp();
    console.log('[DB Client] Backend Adapter Admin SDK initialized successfully');
  } catch (adminErr: unknown) {
    console.error('[DB Client] Backend Adapter Admin SDK init failed:', readErrorMessage(adminErr));
  }

  // تهيئة Client SDK / Initialise Client SDK
  try {
    const supabaseApp = initializeApp({});
    db = getPostgreSQL(supabaseApp);
    auth = initializeAuth(supabaseApp, { persistence: inMemoryPersistence });
    console.log('[DB Client] Backend Adapter Client SDK initialized successfully');
  } catch (e: unknown) {
    console.error('[DB Client] Backend Adapter Client SDK init failed:', readErrorMessage(e));
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
export async function authenticateServerSession(auth: ServerAuthClient | null, db: DatabaseClient | null): Promise<void> {
  if (!auth || !db) return;

  const systemEmail = process.env.SWIFTSHIP_SYSTEM_EMAIL?.trim();
  const systemPassword = process.env.SWIFTSHIP_SYSTEM_PASSWORD;
  if (!systemEmail || !systemPassword) {
    console.warn('[DB Client] Server session authentication is disabled: SWIFTSHIP_SYSTEM_EMAIL/PASSWORD are missing.');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, systemEmail, systemPassword);
    console.log('[DB Client] Backend server authenticated as admin@swiftship.system');
  } catch (authErr: unknown) {
    console.warn('[DB Client] Standard authentication failed:', readErrorMessage(authErr));

    const code = readErrorCode(authErr);
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
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
          createdAt: Date.now(),
        });
      } catch (regErr: unknown) {
        console.error('[DB Client] Failed to register administrative account:', readErrorMessage(regErr));
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
