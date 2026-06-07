import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';

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

export function useRole() {
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setPermissions([]);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  const sessionId = (() => {
    if (typeof window === 'undefined') return 'sess-server';
    let id = sessionStorage.getItem('swiftship_session_id');
    if (!id) {
      id = `sess-${Math.floor(100000 + Math.random() * 900000)}-${Date.now()}`;
      sessionStorage.setItem('swiftship_session_id', id);
    }
    return id;
  })();

  // Session heartbeats: update /sessions/{sessionId} dynamically so the Admin knows which device/tab is active
  useEffect(() => {
    if (!user || !profile) return;
    
    const updateSessionHeartbeat = async () => {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        const createdTime = sessionStorage.getItem('swiftship_session_created') || String(Date.now());
        if (!sessionStorage.getItem('swiftship_session_created')) {
          sessionStorage.setItem('swiftship_session_created', createdTime);
        }
        
        await setDoc(sessionRef, {
          id: sessionId,
          userId: user.uid,
          email: profile.email || user.email || '',
          fullName: profile.fullName || 'User',
          role: profile.role || 'Employee',
          deviceInfo: getDeviceAndBrowser(),
          lastSeen: Date.now(),
          lastSeenAt: new Date().toISOString(),
          createdAt: Number(createdTime),
          forceLogout: false
        }, { merge: true });
      } catch (err) {
        console.warn("[Session Heartbeat] Error:", err);
      }
    };

    updateSessionHeartbeat();
    const interval = setInterval(updateSessionHeartbeat, 45_000);
    return () => clearInterval(interval);
  }, [user, profile]);

  // Listen for individual session termination
  useEffect(() => {
    if (!user) return;
    
    const sessionRef = doc(db, 'sessions', sessionId);
    const unsubSession = onSnapshot(sessionRef, (sessionDoc) => {
      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        if (sessionData.forceLogout === true) {
          sessionStorage.removeItem('swiftship_session_id');
          sessionStorage.removeItem('swiftship_session_created');
          deleteDoc(sessionRef).catch(console.error);
          auth.signOut().catch(console.error);
        }
      }
    });

    return () => unsubSession();
  }, [user]);

  // Heartbeat: update lastSeen every 60s so the general user lists show online/offline status
  useEffect(() => {
    if (!user) return;
    const updateLastSeen = () => {
      updateDoc(doc(db, 'users', user.uid), {
        lastSeen: Date.now(),
        lastSeenAt: new Date().toISOString(),
      }).catch(() => {/* silently ignore */});
    };
    updateLastSeen(); // immediate on mount
    const interval = setInterval(updateLastSeen, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsub = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();

        // ── FORCE LOGOUT: admin requested remote session termination ──
        if (userData.forceLogout === true) {
          // Clear the flag first, then sign out
          updateDoc(doc(db, 'users', user.uid), { forceLogout: false, forceLogoutAt: null })
            .catch(console.error);
          auth.signOut().catch(console.error);
          return;
        }

        // ── DISABLED: account was disabled while user was logged in ──
        if (userData.disabled === true) {
          auth.signOut().catch(console.error);
          return;
        }

        // ── COURIERS: completely isolated from the staff system ──
        if (userData.role === 'Courier' || userData.roleId === 'courier' || userData.role === 'courier') {
          setRole(null);
          setPermissions([]);
          setProfile(null);
          setLoading(false);
          auth.signOut().catch(console.error);
          return;
        }

        setRole(userData.role);
        setProfile(userData);

        const ROOT_EMAILS = [
           'alsrhyarslan5@gmail.com', 
           'arslan.alshamari@gmail.com', 
           'admin@swiftship.system',
           'admin'
        ];

        const lowerEmail = user.email?.toLowerCase() || '';
        // Fetch permissions for this role
        if (userData.role === 'Admin' || ROOT_EMAILS.includes(lowerEmail) || userData.isRoot) {
          // Admins or SuperAdmin always have all permissions
          setPermissions(['*']);
          setLoading(false);
        } else if (userData.role) {
          onSnapshot(doc(db, 'roles', userData.role), (roleDoc) => {
            if (roleDoc.exists()) {
              setPermissions(roleDoc.data().permissions || []);
            } else {
              // Default fallback permissions if role doc doesn't exist yet
              setPermissions(DEFAULT_ROLE_PERMISSIONS[userData.role] || []);
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
        const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'admin@swiftship.system'];
        const userEmail = user.email?.toLowerCase();
        if (userEmail && ROOT_EMAILS.includes(userEmail)) {
          setRole('Admin');
          setPermissions(['*']);
          
          // Auto-create the user document if it's missing (one-time check)
          import('firebase/firestore').then(({ setDoc, doc }) => {
            setDoc(doc(db, 'users', user.uid), {
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
          import('firebase/firestore').then(({ query, collection, where, getDocs, doc, setDoc }) => {
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            getDocs(q).then((snap) => {
              if (!snap.empty) {
                const legacyDoc = snap.docs.find(d => d.id !== user.uid);
                if (legacyDoc) {
                  const data = legacyDoc.data();
                  setDoc(doc(db, 'users', user.uid), {
                    ...data,
                    uid: user.uid,
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
      // Fallback for SuperAdmin even if Firestore read fails (e.g. permission denied)
      const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'admin@swiftship.system'];
      const lowerEmail = (user.email || '').toLowerCase();
      if (ROOT_EMAILS.includes(lowerEmail)) {
        setRole('Admin');
        setPermissions(['*']);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const hasPermission = (permission: string) => {
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  };

  return { role, permissions, hasPermission, loading, profile };
}
