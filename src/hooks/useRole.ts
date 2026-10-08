import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, setDoc, deleteDoc } from '../data/legacy/legacy-compat.ts';
import { db } from '../data/legacy/legacy-compat.ts';
import { clearAllLocalData } from '../data/legacy/legacy-compat.ts';
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';
import { useSettings } from '../context/SettingsContext';
import { useAuthSession } from '../features/auth/AuthSessionProvider';
import { readString, toRecord } from '../shared/contracts/unknown.contracts';

export interface RoleProfile {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  displayName?: string;
  username: string;
  role: string;
  disabled: boolean;
  isRoot?: boolean;
  roleId?: string;
  systemPin?: string;
}

function mapRoleProfile(value: unknown, fallbackUid: string, fallbackEmail?: string | null): RoleProfile {
  const profile = toRecord(value);
  return {
    id: readString(profile.id) ?? readString(profile.user_id) ?? fallbackUid,
    uid: readString(profile.uid) ?? fallbackUid,
    email: readString(profile.email) ?? fallbackEmail ?? '',
    fullName: readString(profile.fullName) ?? readString(profile.full_name) ?? readString(profile.username) ?? '',
    displayName: readString(profile.displayName),
    username: readString(profile.username) ?? (readString(profile.email) ?? fallbackEmail ?? '').split('@')[0] ?? '',
    role: readString(profile.role) ?? '',
    disabled: profile.disabled === true,
    isRoot: profile.isRoot === true,
    roleId: readString(profile.roleId),
    systemPin: readString(profile.systemPin) ?? readString(profile.system_pin),
  };
}

const getDeviceAndBrowser = () => {
  if (typeof window === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("SamsungBrowser")) browser = "Samsung Browser";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";
  else if (ua.includes("Trident")) browser = "Internet Explorer";
  else if (ua.includes("Edge") || ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.2")) os = "Windows 8";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} - ${os}`;
};

export function useRole(enableHeartbeat: boolean = false) {
  const { user, signOut } = useAuthSession();
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<RoleProfile | null>(null);
  const [sessionId, setSessionId] = useState<string>('sess-loading');

  // جلب إعدادات مهلة خمول المستخدم بالدقائق من Context تلقائياً بدلاً من القيمة الثابتة
  // Fetch user inactivity timeout in minutes from SettingsContext dynamically
  let timeoutMinutes = 10;
  try {
    const { settings } = useSettings();
    if (settings && typeof settings.userSessionTimeout === 'number' && settings.userSessionTimeout > 0) {
      timeoutMinutes = settings.userSessionTimeout;
    }
  } catch (_) {
    // Fallback in case useRole is consumed outside SettingsProvider
  }
  const inactivityTimeoutMs = timeoutMinutes * 60 * 1000;

  // مرجع لمُعرّف session لاستخدامه في cleanup بعيداً عن React state
  // Ref to hold session ID for use in cleanup callbacks outside React state
  const sessionIdRef = useRef<string>('sess-loading');
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * حذف سجل الجلسة من قاعدة البيانات وتنظيف البيانات المحلية والذاكرة المخبئية
   * Delete session record from DB and clean local data and cache
   */
  const performSignOut = useCallback(async (sessId?: string) => {
    const targetSessionId = sessId || sessionIdRef.current;
    if (targetSessionId && targetSessionId !== 'sess-loading' && targetSessionId !== 'sess-loggedout') {
      try {
        // حذف الجلسة من قاعدة البيانات
        // Delete session from database
        await deleteDoc(doc(db, 'sessions', targetSessionId));
      } catch (e) {
        console.warn('[useRole] Failed to delete session from DB:', e);
      }
    }

    // تنظيف بيانات الجلسة والمستخدم من التخزين المحلي والـ Session Storage
    // Clean session identifiers from storage
    if (typeof window !== 'undefined') {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && (key.startsWith('swiftship_session_') || key.startsWith('swiftship_persisted_'))) {
            sessionStorage.removeItem(key);
          }
        }
        localStorage.removeItem('swiftship_persisted_user');
        localStorage.removeItem('swiftship_session_id');
      } catch (_) { }
    }

    // مسح جميع بيانات التخزين المؤقت في الكاش local storage
    // Clear all local cache data
    clearAllLocalData();

    await signOut().catch(console.error);
  }, [signOut]);

  /**
   * إعادة ضبط مؤقت الخمول بناءً على مهلة خمول الجلسة الديناميكية من الإعدادات
   * Reset the inactivity timer on user activity based on userSessionTimeout
   */
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!inactivityTimeoutMs || inactivityTimeoutMs <= 0) return;
    inactivityTimerRef.current = setTimeout(() => {
      console.warn('[useRole] Inactivity timeout reached - signing out');
      performSignOut();
    }, inactivityTimeoutMs);
  }, [performSignOut, inactivityTimeoutMs]);

  // استمع لأحداث نشاط المستخدم لإعادة ضبط مؤقت الخمول
  // Listen to user activity events to reset the inactivity timer
  useEffect(() => {
    if (!enableHeartbeat || !user) return;
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const handler = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer(); // ابدأ المؤقت فوراً / start timer immediately
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [enableHeartbeat, user, resetInactivityTimer]);

  // Compute or retrieve a unique, user-specific, tab-isolated session ID
  useEffect(() => {
    if (!user) {
      setSessionId('sess-loggedout');
      sessionIdRef.current = 'sess-loggedout';
      if (typeof window !== 'undefined') {
        for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
          const key = sessionStorage.key(index);
          if (key && (key.startsWith('swiftship_session_id_') || key.startsWith('swiftship_session_created_'))) {
            sessionStorage.removeItem(key);
          }
        }
      }
      return;
    }

    const storageKey = `swiftship_session_id_${user.id}`;
    let id = sessionStorage.getItem(storageKey);
    if (!id) {
      id = `sess-${user.id.substring(0, 5)}-${Math.floor(100000 + Math.random() * 900000)}-${Date.now()}`;
      sessionStorage.setItem(storageKey, id);
    }
    setSessionId(id);
    sessionIdRef.current = id;
  }, [user]);

  // Session heartbeats: update /sessions/{sessionId} with correct ISO timestamps
  useEffect(() => {
    if (!enableHeartbeat || !user || loading || sessionId === 'sess-loading' || sessionId === 'sess-loggedout') return;

    const updateSessionHeartbeat = async () => {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        const createdTimeKey = `swiftship_session_created_${user.id}`;
        const createdTimeStr = sessionStorage.getItem(createdTimeKey) || new Date().toISOString();
        if (!sessionStorage.getItem(createdTimeKey)) {
          sessionStorage.setItem(createdTimeKey, createdTimeStr);
        }

        const emailVal = profile?.email || user.email || '';
        const fullNameVal = profile?.fullName || user.displayName || (emailVal ? emailVal.split('@')[0] : 'User');
        const roleVal = profile?.role || role || 'Employee';
        const nowISO = new Date().toISOString();

        // بناء بيانات الجلسة لحقل data والأعمدة المباشرة بصيغة ISO صحيحة
        // Build session data with ISO timestamps for DB columns
        await setDoc(sessionRef, {
          id: sessionId,
          userId: user.id,
          user_id: user.id,
          createdAt: createdTimeStr,
          created_at: createdTimeStr,
          lastSeen: nowISO,
          last_seen: nowISO,
          forceLogout: false,
          force_logout: false,
          email: emailVal,
          fullName: fullNameVal,
          full_name: fullNameVal,
          role: roleVal,
          deviceInfo: getDeviceAndBrowser(),
          device_info: getDeviceAndBrowser(),
        }, { merge: true });
      } catch (err) {
        console.warn("[Session Heartbeat] Error:", err);
      }
    };

    updateSessionHeartbeat();
    const interval = setInterval(updateSessionHeartbeat, 30_000);
    return () => clearInterval(interval);
  }, [enableHeartbeat, user, profile, role, loading, sessionId]);

  // ── DELETE SESSION FROM DB ON WINDOW / TAB / APP CLOSE ──
  // عند إغلاق التبويب أو نافذة التطبيق أو المتصفح، يتم حذف سجل الجلسة من قاعدة البيانات فوراً
  // ملاحظة: لا نمس sessionStorage أو localStorage هنا حتى يتمكن تحديث الصفحة (F5) من إعادة إحياء الجلسة تلقائياً
  useEffect(() => {
    if (!enableHeartbeat || !user || sessionId === 'sess-loading' || sessionId === 'sess-loggedout') return;

    const handleBeforeUnload = () => {
      const targetSessId = sessionIdRef.current;
      if (targetSessId && targetSessId !== 'sess-loading' && targetSessId !== 'sess-loggedout') {
        const env = import.meta.env || {};
        const supabaseUrl = env.VITE_SUPABASE_URL;
        const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

        // إذا كان النظام يعمل عبر ALX API أو كانت Supabase معطلة، لا تُحاول الاتصال بـ Supabase REST
        if (env.VITE_USE_HTTP_API === 'true' || !supabaseUrl) return;

        // إرسال طلب حذف الجلسة من DB عبر fetch مع keepalive
        try {
          fetch(`${supabaseUrl}/rest/v1/sessions?id=eq.${targetSessId}`, {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            keepalive: true
          }).catch(() => {});
        } catch (_) {}
      }
    };

    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enableHeartbeat, user, sessionId]);

  // Listen for individual session termination (forceLogout from admin)
  useEffect(() => {
    if (!enableHeartbeat || !user || sessionId === 'sess-loading' || sessionId === 'sess-loggedout') return;

    const sessionRef = doc(db, 'sessions', sessionId);
    const unsubSession = onSnapshot(sessionRef, (sessionDoc) => {
      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        if (sessionData.force_logout === true || sessionData.forceLogout === true) {
          const keyId = `swiftship_session_id_${user.id}`;
          const keyCreated = `swiftship_session_created_${user.id}`;
          sessionStorage.removeItem(keyId);
          sessionStorage.removeItem(keyCreated);
          // حذف سجل الجلسة من قاعدة البيانات ثم تسجيل الخروج
          // Delete session from DB then sign out
          performSignOut(sessionId);
        }
      }
    });

    return () => unsubSession();
  }, [enableHeartbeat, user, sessionId, performSignOut]);

  // Heartbeat: update last_seen every 60s so the general user lists show online/offline status
  useEffect(() => {
    if (!enableHeartbeat || !user || loading) return;
    const updateLastSeen = () => {
      const nowISO = new Date().toISOString();
      updateDoc(doc(db, 'users', user.id), {
        last_seen: Date.now(), // عدد مليثاني - للمقارنات التحليلية
        last_seen_at: nowISO,  // نص للعرض
      }).catch(() => {/* silently ignore */ });
    };
    updateLastSeen(); // immediate on mount
    const interval = setInterval(updateLastSeen, 60_000);
    return () => clearInterval(interval);
  }, [enableHeartbeat, user, loading]);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setProfile(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    // Reset state for new user to prevent stale profile/role mixing
    setRole(null);
    setProfile(null);
    setPermissions([]);
    setLoading(true);

    let unsubRole: (() => void) | null = null;

    const unsub = onSnapshot(doc(db, 'users', user.id), (userDoc) => {
      if (userDoc.exists()) {
        const userData = toRecord(userDoc.data());
        const userRole = readString(userData.role);

        // ── FORCE LOGOUT: admin requested remote session termination ──
        if (userData.forceLogout === true || userData.force_logout === true) {
          // Clear the flag first, then sign out
          updateDoc(doc(db, 'users', user.id), { forceLogout: false, force_logout: false, forceLogoutAt: null })
            .catch(console.error);
          // حذف سجل الجلسة من DB وتسجيل الخروج
          // Delete session from DB and sign out
          performSignOut();
          return;
        }

        // ── DISABLED: account was disabled while user was logged in ──
        if (userData.disabled === true) {
          performSignOut();
          return;
        }

        // ── COURIERS: completely isolated from the staff system ──
        if (userRole === 'Courier' || userData.roleId === 'courier' || userRole === 'courier') {
          setRole(null);
          setPermissions([]);
          setProfile(null);
          setLoading(false);
          performSignOut();
          return;
        }

        setRole(userRole ?? null);
        setProfile(mapRoleProfile(userData, user.id, user.email));

        const ROOT_EMAILS = [
          'alsrhyarslan5@gmail.com',
          'arslan.alshamari@gmail.com',
          'engaporaad1@gmail.com',
          'admin@swiftship.system',
          'apo.1.read@gmail.com',
          'admin'
        ];

        const lowerEmail = user.email?.toLowerCase() || '';

        // Clean up previous role subscription if any
        if (unsubRole) {
          unsubRole();
          unsubRole = null;
        }

        // Fetch permissions for this role
        if (userRole === 'Admin' || ROOT_EMAILS.includes(lowerEmail) || userData.isRoot === true) {
          // Admins or SuperAdmin always have all permissions
          setPermissions(['*']);
          setLoading(false);
        } else if (userRole) {
          unsubRole = onSnapshot(doc(db, 'roles', userRole), (roleDoc) => {
            if (roleDoc.exists()) {
              const roleData = toRecord(roleDoc.data());
              const rolePermissions = Array.isArray(roleData.permissions)
                ? roleData.permissions.filter((permission): permission is string => typeof permission === 'string')
                : [];
              setPermissions(rolePermissions);
            } else {
              // Default fallback permissions if role doc doesn't exist yet
              setPermissions(DEFAULT_ROLE_PERMISSIONS[userRole] || []);
            }
            setLoading(false);
          }, (err) => {
            console.error("Error fetching permissions:", err);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }

      } else {
        // If user doc doesn't exist but it's the super admin email, grant all permissions and auto-create doc
        const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'engaporaad1@gmail.com', 'admin@swiftship.system', 'apo.1.read@gmail.com'];
        const userEmail = user.email?.toLowerCase();
        if (userEmail && ROOT_EMAILS.includes(userEmail)) {
          setRole('Admin');
          setPermissions(['*']);

          // Auto-create the user document if it's missing (one-time check)
          import('../data/legacy/legacy-compat.ts').then(({ setDoc, doc }) => {
            setDoc(doc(db, 'users', user.id), {
              email: user.email,
              username: user.email?.split('@')[0] || 'admin',
              fullName: 'Root Admin',
              role: 'Admin',
              isRoot: true,
              createdAt: Date.now(),
              disabled: false
            }, { merge: true }).catch(console.error);
          });
        } else {
          // If not super admin, check if there's a legacy invitation for this email
          import('../data/legacy/legacy-compat.ts').then(({ query, collection, where, getDocs, doc, setDoc }) => {
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            getDocs(q).then((snap) => {
              if (!snap.empty) {
                const legacyDoc = snap.docs.find(d => d.id !== user.id);
                if (legacyDoc) {
                  const data = legacyDoc.data();
                  setDoc(doc(db, 'users', user.id), {
                    ...data,
                    uid: user.id,
                    updatedAt: Date.now()
                  }).catch(console.error);
                  // The snapshot will trigger again automatically
                }
              }
            }).catch(console.error);
          });

          setRole(null);
          setPermissions([]);
        }
        setLoading(false);
      }
    }, (err) => {
      console.warn("Error fetching role (possibly missing doc):", err);
      // Fallback for SuperAdmin even if PostgreSQL read fails (e.g. permission denied)
      const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'engaporaad1@gmail.com', 'admin@swiftship.system', 'apo.1.read@gmail.com'];
      const lowerEmail = (user.email || '').toLowerCase();
      if (ROOT_EMAILS.includes(lowerEmail)) {
        setRole('Admin');
        setPermissions(['*']);
      }
      setLoading(false);
    });

    return () => {
      unsub();
      if (unsubRole) {
        unsubRole();
      }
    };
  }, [user]);

  const hasPermission = (permission: string) => {
    if (!permissions || !Array.isArray(permissions)) return false;
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  };

  return { role, permissions, hasPermission, loading, profile, sessionId, signOut: performSignOut };
}
