import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';

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

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsub = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // External Couriers are completely isolated and not allowed inside the system
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
              const defaults: Record<string, string[]> = {
                'Employee': ['view_dashboard', 'view_orders', 'manage_orders', 'view_customers', 'manage_customers', 'delete_orders', 'delete_customers', 'manage_couriers', 'delete_couriers'],
                'Accountant': ['view_dashboard', 'view_orders', 'view_finance', 'manage_finance', 'manage_sources', 'delete_sources'],
                'Courier': ['view_orders', 'update_order_status']
              };
              setPermissions(defaults[userData.role] || []);
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
