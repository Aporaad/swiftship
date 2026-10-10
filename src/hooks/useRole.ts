import { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';
import { useSettings } from '../context/SettingsContext';
import { useAuthSession } from '../features/auth/AuthSessionProvider';
import { readString, toRecord } from '../shared/contracts/unknown.contracts';

function clearAllLocalData() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
  }
}

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
   * Delete session record and clean local data and cache
   */
  const performSignOut = useCallback(async (sessId?: string) => {
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

    clearAllLocalData();
    await signOut().catch(console.error);
  }, [signOut]);

  /**
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

  // Listen to user activity events to reset the inactivity timer
  useEffect(() => {
    if (!enableHeartbeat || !user) return;
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const handler = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();
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

  useEffect(() => {
    if (!user) {
      setRole(null);
      setProfile(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ROOT_EMAILS = [
      'alsrhyarslan5@gmail.com',
      'arslan.alshamari@gmail.com',
      'engaporaad1@gmail.com',
      'admin@swiftship.system',
      'apo.1.read@gmail.com',
      'admin'
    ];

    const lowerEmail = (user.email || '').toLowerCase();
    const isRoot = ROOT_EMAILS.includes(lowerEmail);

    const userRole = isRoot ? 'Admin' : 'Admin';
    setRole(userRole);
    setPermissions(['*']);
    setProfile(mapRoleProfile({
      id: user.id,
      uid: user.id,
      email: user.email,
      fullName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
      role: userRole,
      isRoot,
      disabled: false
    }, user.id, user.email));
    setLoading(false);
  }, [user]);

  const hasPermission = (permission: string) => {
    if (!permissions || !Array.isArray(permissions)) return false;
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  };

  return { role, permissions, hasPermission, loading, profile, sessionId, signOut: performSignOut };
}
