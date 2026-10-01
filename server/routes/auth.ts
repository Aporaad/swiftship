/**
 * مسارات المصادقة الخلفية
 * Auth Routes — server-side authentication endpoints.
 *
 * هذه المسارات مُستخرجة من server.ts لعزل منطق المصادقة.
 * Extracted from server.ts to isolate authentication logic.
 *
 * ⚠️ ملاحظات أمنية موثقة (مخاطر حرجة):
 * 1. يتم مقارنة كلمة المرور كنص صريح (plain-text password comparison).
 * 2. تخزين كلمة المرور داخل جدول public.users — يجب عدم نقله إلى API الجديدة.
 * 3. ROOT_EMAILS مدرجة في الكود بشكل ثابت.
 * ⚠️ Documented security risks (critical defects — DO NOT migrate to alx_api):
 * 1. Plain-text password comparison.
 * 2. Passwords stored in public.users table.
 * 3. ROOT_EMAILS hardcoded.
 */

import type { Express } from 'express';
import bcrypt from 'bcryptjs';
import {
  admin,
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  limit,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from '../current-db/client';

// ── قائمة البريد الإلكتروني للمستخدمين الجذر ────────────────────
// ⚠️ ROOT_EMAILS ثابتة في الكود — عيب حرج / hardcoded root emails — critical defect
const ROOT_EMAILS = (process.env.SWIFTSHIP_ROOT_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const SYSTEM_ADMIN_EMAIL = (process.env.SWIFTSHIP_SYSTEM_EMAIL ?? '').trim().toLowerCase();

async function hasPasswordResetAuthority(req: { header(name: string): string | undefined }, db: any): Promise<boolean> {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const sessionId = authorization.slice(7).trim();
  if (!sessionId) return false;
  const sessions = await getDocs(query(collection(db, 'sessions'), where('id', '==', sessionId), limit(1)));
  if (sessions.empty) return false;
  const session = sessions.docs[0].data() as Record<string, unknown>;
  if (session.force_logout === true || session.forceLogout === true) return false;
  const userId = typeof session.user_id === 'string' ? session.user_id : typeof session.userId === 'string' ? session.userId : '';
  if (!userId) return false;
  const users = await getDocs(query(collection(db, 'users'), where('id', '==', userId), limit(1)));
  if (users.empty) return false;
  const user = users.docs[0].data() as Record<string, unknown>;
  if (user.disabled === true) return false;
  const role = typeof user.role === 'string' ? user.role.toLowerCase() : '';
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return role === 'admin' || user.isRoot === true || permissions.includes('reset_passwords');
}

/**
 * تسجيل مسارات المصادقة على تطبيق Express.
 * Registers authentication routes on the Express app.
 *
 * @param app - تطبيق Express / Express application
 * @param db - عميل قاعدة البيانات / Database client
 * @param auth - عميل المصادقة / Auth client
 */
export function registerAuthRoutes(app: Express, db: any, auth: any): void {
  // ── تغيير كلمة المرور الإدارية ──────────────────────────────────
  // Direct administrative password update bypassing disabled Identity Toolkit API
  app.post('/api/auth/admin-change-password', async (req, res) => {
    const { uid, newPassword } = req.body;
    if (!uid || !newPassword) {
      return res.status(400).json({ error: 'User ID and password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
      if (!(await hasPasswordResetAuthority(req, db))) {
        return res.status(403).json({ error: 'Admin password-reset permission required' });
      }
    } catch {
      return res.status(503).json({ error: 'Authorization service unavailable' });
    }

    try {
      // ⚠️ تخزين كلمة المرور كنص صريح — عيب حرج / plain-text — critical defect
      const userRef = doc(db, 'users', uid);
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await updateDoc(userRef, { password_hash: passwordHash, password: null });
      console.log(`[Auth] Changed password in PostgreSQL for user ${uid}`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[Auth] Failed to change user password:', err);
      return res.status(500).json({ error: err.message || 'Failed to change password' });
    }
  });

  // ── التحقق من تسجيل الدخول ──────────────────────────────────────
  // Dual-logic login validation (custom PostgreSQL passwords + Supabase Auth)
  app.post('/api/auth/verify-login', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password are required' });
    }

    try {
      const idLower = identifier.toLowerCase();
      let email = idLower;

      if (idLower === 'admin' && SYSTEM_ADMIN_EMAIL) {
        email = SYSTEM_ADMIN_EMAIL;
      }

      let userDoc: any = null;
      let userDocId = '';

      // البحث عن المستخدم بالبريد الإلكتروني أو اسم المستخدم
      // Search user by email or username
      if (email.includes('@')) {
        const snap = await getDocs(
          query(collection(db, 'users'), where('email', '==', email), limit(1)),
        );
        if (!snap.empty) {
          userDoc = snap.docs[0].data();
          userDocId = snap.docs[0].id;
        }
      } else {
        const snap = await getDocs(
          query(collection(db, 'users'), where('username', '==', identifier), limit(1)),
        );
        if (!snap.empty) {
          userDoc = snap.docs[0].data();
          userDocId = snap.docs[0].id;
          email = userDoc.email;
        }
      }

      const isRoot = ROOT_EMAILS.includes(email.toLowerCase());

      // إنشاء حساب المستخدم الجذر تلقائياً إذا لم يكن موجوداً
      // Auto-create root user account if not found
      if (!userDoc && isRoot) {
        let uid = '';
        let createdSuccessfully = false;

        // محاولة Admin SDK أولاً / Try Admin SDK first
        try {
          if (admin.apps.length > 0) {
            try {
              const authUser = await admin.auth().getUserByEmail(email);
              uid = authUser.uid;
            } catch (authErr: any) {
              if (authErr.code === 'auth/user-not-found' || authErr.code === 'user-not-found') {
                const userRecord = await admin.auth().createUser({
                  email,
                  emailVerified: true,
                  password,
                });
                uid = userRecord.uid;
              } else {
                throw authErr;
              }
            }

            // ⚠️ تخزين كلمة المرور كنص صريح — عيب حرج
            await admin.supabase().collection('users').doc(uid).set({
              email: email.toLowerCase(),
              username: email.toLowerCase().split('@')[0],
              fullName: email.toLowerCase().split('@')[0].toUpperCase() + ' (Root)',
              role: 'Admin',
              isRoot: true,
              password_hash: await bcrypt.hash(password, 12),
              disabled: false,
              createdAt: Date.now(),
            }, { merge: true });
            createdSuccessfully = true;
          }
        } catch (adminErr: any) {
          console.warn('[Auth] Admin SDK failed, trying Client SDK fallback:', adminErr.message);
        }

        // الرجوع إلى Client SDK إذا فشل Admin SDK
        // Fallback to Client SDK if Admin SDK unavailable
        if (!createdSuccessfully) {
          try {
            try {
              const userCred = await signInWithEmailAndPassword(auth, email, password);
              uid = userCred.user.uid;
            } catch (signInErr: any) {
              if (
                signInErr.code === 'auth/user-not-found' ||
                signInErr.code === 'auth/invalid-credential' ||
                signInErr.code === 'auth/user-disabled'
              ) {
                try {
                  const userCred = await createUserWithEmailAndPassword(auth, email, password);
                  uid = userCred.user.uid;
                } catch (createErr: any) {
                  if (createErr.code !== 'auth/email-already-in-use') {
                    throw createErr;
                  }
                }
              } else {
                throw signInErr;
              }
            }

            if (uid) {
              // ⚠️ تخزين كلمة المرور كنص صريح — عيب حرج
              await setDoc(doc(db, 'users', uid), {
                email: email.toLowerCase(),
                username: email.toLowerCase().split('@')[0],
                fullName: email.toLowerCase().split('@')[0].toUpperCase() + ' (Root)',
                role: 'Admin',
                isRoot: true,
                password_hash: await bcrypt.hash(password, 12),
                disabled: false,
                createdAt: Date.now(),
              }, { merge: true });
              createdSuccessfully = true;
            }
          } catch (clientErr: any) {
            console.error('[Auth] Client SDK root creation fallback failed:', clientErr.message);
          }
        }

        if (uid) {
          userDoc = {
            email,
            username: email.split('@')[0],
            fullName: email.split('@')[0].toUpperCase() + ' (Root)',
            role: 'Admin',
            isRoot: true,
            password_hash: await bcrypt.hash(password, 12),
            disabled: false,
          };
          userDocId = uid;
        }
      }

      if (!userDoc) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (userDoc.disabled) {
        return res.status(403).json({ error: 'This account is currently disabled.' });
      }

      if (typeof userDoc.password_hash === 'string' && userDoc.password_hash.length > 0) {
        if (!(await bcrypt.compare(password, userDoc.password_hash))) {
          return res.status(401).json({ error: 'Invalid login credentials' });
        }
      } else if (typeof userDoc.password === 'string' && userDoc.password.length > 0) {
        return res.status(409).json({ error: 'Password migration required' });
      }

      // توليد رمز مخصص / Generate custom token
      let customToken = '';
      try {
        customToken = await admin.auth().createCustomToken(userDocId);
      } catch (tokenErr: any) {
        console.warn('[Auth] Could not generate customToken:', tokenErr.message);
      }

      if (customToken) {
        return res.json({ success: true, customToken, email });
      }
      return res.json({ success: true, useClientAuth: true, email, isLegacyNoPasswordDoc: !userDoc.password_hash });
    } catch (err: any) {
      console.error('[Auth] Verify login backend error:', err);
      return res.status(500).json({ error: err.message || 'Verification failed' });
    }
  });
}
