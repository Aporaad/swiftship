import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs, writeBatch, doc, setDoc } from '../lib/supabase-adapter';
import { db } from '../lib/supabase-adapter';
import { clearAllLocalData } from '../lib/supabase-adapter';
import { formatDate, formatDateTime, formatTime, now } from '../lib/dateUtils';
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  LogOut,
  MapPin,
  Bell,
  Search,
  Settings,
  ShieldCheck,
  Languages,
  RotateCw,
  Wallet,
  FileText,
  BookOpen,
  Plus,
  Crown,
  Menu,
  ChevronDown,
  UserCog,
  Command,
  HelpCircle,
  Phone,
  Mail,
  Send,
  MessageCircle,
  AlertTriangle,
  Download,
  Upload,
  LayoutList,
  Info,
  Building2,
  Cpu,
  Globe,
  User,
  Activity,
  Code2,
  ExternalLink,
  Briefcase,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useAuthSession } from '../features/auth/AuthSessionProvider';
import { useSettings } from '../context/SettingsContext';
import { Toaster } from 'react-hot-toast';
import GlobalSearchModal from './GlobalSearchModal';
import GlobalEntityLedgerModal from './GlobalEntityLedgerModal';
import QuickNavModal from './QuickNavModal';
import PendingPortalApprovalsModal from './PendingPortalApprovalsModal';
import JobApplicationsModal from './JobApplicationsModal';
import { activityLogService } from '../services/activityLogService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../lib/supabase-adapter';
import Header from './layout/Header';
import Sidebar from './layout/Sidebar';
import { MobileNavigation, NavigationCustomizer } from './layout/Navigation';

export default function Layout() {
  const { legacyAuth: auth, signOut } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, profile, hasPermission, loading: roleLoading, sessionId } = useRole(true);
  const { settings, updateSettings, t } = useSettings();
  const isAr = settings.language === 'ar';
  const [isPortalApprovalsOpen, setIsPortalApprovalsOpen] = useState(false);
  const [isJobApplicationsOpen, setIsJobApplicationsOpen] = useState(false);
  const [pendingPortalCount, setPendingPortalCount] = useState(0);
  const [pendingJobsCount, setPendingJobsCount] = useState(0);
  const isOfflineModeActive = (window as any).__isOfflineMode || false;

  const downloadBackup = () => {
    try {
      const backup: any = {};
      const tables = ['users', 'orders', 'settings', 'accounts', 'account_trans', 'activity_logs', 'roles', 'sources', 'notifications'];
      tables.forEach(table => {
        const saved = localStorage.getItem(`swiftship_table_backup_${table}`);
        if (saved) {
          backup[table] = JSON.parse(saved);
        }
      });

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swiftship_emergency_backup_${formatDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        Object.entries(parsed).forEach(([table, data]) => {
          localStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(data));
        });
        alert(isAr ? 'تم استيراد واستعادة البيانات الاحتياطية بنجاح!' : 'Disaster recovery backup imported successfully!');
        window.location.reload();
      } catch (err) {
        alert(isAr ? 'خطأ: ملف النسخة الاحتياطية غير صالح.' : 'Error: Selected backup file format is invalid.');
      }
    };
    reader.readAsText(file);
  };

  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('swiftship_sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [isNavCustomizerOpen, setIsNavCustomizerOpen] = useState(false);
  const [showSystemStatus, setShowSystemStatus] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('swiftship_show_system_status');
      return saved !== null ? saved === 'true' : true;
    } catch (_) {
      return true;
    }
  });

  const toggleSystemStatusVisibility = () => {
    setShowSystemStatus(prev => {
      const next = !prev;
      try {
        localStorage.setItem('swiftship_show_system_status', String(next));
      } catch (_) { }
      return next;
    });
  };

  // Global Search State
  const [searchText, setSearchText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Quick Navigation State
  const [isQuickNavOpen, setIsQuickNavOpen] = useState(false);

  // Programmer & System Info Modal State
  const [isSystemDevModalOpen, setIsSystemDevModalOpen] = useState(false);

  // Real-time System Status state
  const [systemStats, setSystemStats] = useState({
    activeOrders: 0,
    delayedOrders: 0,
    onlineStaff: 1,
    ongoingShipments: 0,
    financiallyPending: 0,
    systemStatus: 'good' as 'good' | 'warning' | 'error'
  });

  // System Time State
  const [systime, setSystime] = useState(formatDate());
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSystime(formatDate()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live Statistics Sync for Sidebar Status card
  useEffect(() => {
    if (!auth.currentUser || roleLoading || !role) return;

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap: any) => {
      const docs = snap.docs.map((doc: any) => doc.data());

      const active = docs.filter((o: any) => o.orderStatus !== 'تم التسليم' && o.orderStatus !== 'ملغي' && o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled').length;

      const todayStr = formatDate();
      const delayed = docs.filter((o: any) => {
        if (o.orderStatus === 'متأخر' || o.orderStatus === 'Delayed' || o.orderStatus?.toLowerCase() === 'delayed') {
          return true;
        }
        const isCompleted = o.orderStatus === 'تم التسليم' || o.orderStatus === 'Delivered' || o.orderStatus === 'ملغي' || o.orderStatus === 'Cancelled';
        if (!isCompleted && Array.isArray(o.shippingDetails)) {
          return o.shippingDetails.some((sh: any) => sh.expectedArrival && sh.expectedArrival < todayStr);
        }
        return false;
      }).length;

      const ongoing = docs.filter((o: any) => [
        'وصل مستودع السعودية',
        'جاري الشحن لليمن',
        'في التخليص الجمركي',
        'وصل مركز التوزيع في اليمن',
        'مع المندوب للتوصيل',
        'في الطريق',
        'قيد الشحن',
        'جاري التوصيل',
        'وصل المخزن',
        'In Transit',
        'In Local Warehouse',
        'Shipped',
        'Cargo'
      ].includes(o.orderStatus)).length;

      const unpaid = docs.filter((o: any) => o.orderStatus !== 'ملغي' && o.orderStatus !== 'Cancelled' && parseFloat(o.amountRemaining || 0) > 0).length;

      let status: 'good' | 'warning' | 'error' = 'good';
      if (delayed > 0) {
        status = 'error';
      } else if (active > 0 && unpaid > active / 2) {
        status = 'warning';
      }

      setSystemStats(prev => ({
        ...prev,
        activeOrders: active,
        delayedOrders: delayed,
        ongoingShipments: ongoing,
        financiallyPending: unpaid,
        systemStatus: status
      }));
    }, (error: any) => {
      console.error("Error listening to orders for sidebar stats:", error);
    });

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap: any) => {
      const docs = snap.docs.map((doc: any) => doc.data() as any);
      const activeSessionsCount = docs.filter((s: any) => s.lastSeen && (Date.now() - s.lastSeen) < 3 * 60 * 1000).length;
      setSystemStats(prev => ({
        ...prev,
        onlineStaff: Math.max(1, activeSessionsCount)
      }));
    }, (error: any) => {
      console.error("Error listening to sessions for sidebar stats:", error);
    });

    return () => {
      unsubOrders();
      unsubSessions();
    };
  }, [role, roleLoading]);

  // Real-time Pending Web Portal Approvals & Job Applications count
  useEffect(() => {
    const fetchPendingPortal = async () => {
      try {
        const { data } = await supabase.from('portal_users').select('*');
        const rows = (data || []).map((row: any) => {
          const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
          return { id: row.id, ...payload };
        });
        const pending = rows.filter((u: any) => u.approvalStatus === 'pending_approval' || u.approval_status === 'pending_approval');
        setPendingPortalCount(pending.length);

        const { data: jData } = await supabase.from('jobs_req').select('*');
        const jRows = (jData || []).map((row: any) => {
          const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
          return { id: row.id, ...payload };
        });
        const jPending = jRows.filter((j: any) => (j.status || 'pending_review') === 'pending_review');
        setPendingJobsCount(jPending.length);
      } catch (_) { }
    };

    fetchPendingPortal();
    const interval = setInterval(fetchPendingPortal, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for Ctrl+K and Ctrl+T shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K for search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      // Ctrl + T or Cmd + T or Alt + T for Quick Navigation
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') || (e.altKey && e.key.toLowerCase() === 't')) {
        e.preventDefault();
        setIsQuickNavOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!auth.currentUser || roleLoading || !role) return;

    const q = query(collection(db, 'notifications'), where('read', '==', false));
    const unsub = onSnapshot(q, (snap: any) => {
      const allowedDocs = snap.docs.filter((doc: any) => {
        const data = doc.data();
        if (role !== 'Admin') {
          const isCreator = data.creatorId === auth.currentUser?.uid;
          const isTarget = data.userId === auth.currentUser?.uid;
          const isAssociated = Array.isArray(data.associatedUserIds) && data.associatedUserIds.includes(auth.currentUser?.uid);
          if (!isCreator && !isTarget && !isAssociated) return false;
        }
        const category = data.category || 'system';
        if (category === 'finance' && !hasPermission('notify_finance') && role !== 'Admin') return false;
        if (category === 'order' && !hasPermission('notify_orders') && role !== 'Admin') return false;
        if (category === 'system' && !hasPermission('notify_system') && role !== 'Admin') return false;
        return true;
      });
      setUnreadCount(allowedDocs.length);
    }, (error: any) => {
      console.error("Error listening to notifications:", error);
    });

    return () => unsub();
  }, [role, roleLoading, hasPermission]);

  // Inactivity/Idle session automatic logout
  useEffect(() => {
    const timeoutMinutes = settings.userSessionTimeout;
    if (!timeoutMinutes || timeoutMinutes <= 0 || !auth.currentUser) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    let lastActivity = Date.now();

    const updateActivity = () => {
      lastActivity = Date.now();
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= timeoutMs) {
        clearInterval(checkInterval);
        activityEvents.forEach(evt => window.removeEventListener(evt, updateActivity));

        notificationService.notify({
          title: isAr ? 'انتهاء الجلسة' : 'Session Expired',
          message: isAr
            ? 'تم تسجيل خروجك تلقائياً لعدم وجود أي نشاط خلال المدة المحددة.'
            : 'You have been logged out automatically due to inactivity.',
          type: 'info',
          category: 'system'
        });

        handleLogout();
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(checkInterval);
      activityEvents.forEach(evt => window.removeEventListener(evt, updateActivity));
    };
  }, [settings.userSessionTimeout, auth.currentUser, isAr]);

  // Log logout & sign out
  const handleLogout = async () => {
    try {
      await activityLogService.log('logout', 'User Session Ended');
    } catch (_) { }

    try {
      const activeSessId = sessionId || sessionStorage.getItem('swiftship_session_id');
      if (activeSessId && activeSessId !== 'sess-loading' && activeSessId !== 'sess-loggedout') {
        const { deleteDoc, doc } = await import('../lib/supabase-adapter');
        await deleteDoc(doc(db, 'sessions', activeSessId));
      }

      if (typeof window !== 'undefined') {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && (key.startsWith('swiftship_session_id') || key.startsWith('swiftship_session_created'))) {
            sessionStorage.removeItem(key);
          }
        }
      }
    } catch (err) {
      console.warn("Could not delete session on manual signout:", err);
    }

    // Wipe all cached data from localStorage before signing out
    clearAllLocalData();

    await signOut();
    navigate('/login');
  };

  // Auto-backup check: if admin & autoBackupEnabled & 24h passed, run backup to PostgreSQL
  useEffect(() => {
    if (roleLoading || role !== 'Admin' || !settings.autoBackupEnabled || !auth.currentUser) return;
    const lastBackupAt = settings.lastAutoBackupAt || 0;
    const hoursSince = (Date.now() - lastBackupAt) / (1000 * 60 * 60);
    if (hoursSince < 24) return;

    const runAutoBackup = async () => {
      try {
        const cols = ['orders', 'customers', 'couriers', 'sources', 'users', 'roles'];
        const backupDoc: any = {
          version: '3.0',
          timestamp: formatDateTime(),
          createdBy: auth.currentUser?.email || 'admin',
          type: 'auto',
          data: {}
        };
        for (const col of cols) {
          try {
            const snap = await getDocs(collection(db, col));
            backupDoc.data[col] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          } catch (colErr: any) {
            console.warn(`[AutoBackup] Ignored error reading collection ${col}:`, colErr.message || colErr);
          }
        }
        // Save backup as a PostgreSQL document under /backups collection
        const backupId = `auto_${formatDate()}`;
        try {
          await setDoc(doc(db, 'backups', backupId), {
            ...backupDoc,
            savedAt: Date.now()
          });
        } catch (setDocErr: any) {
          console.error('[AutoBackup] setDoc to backups collection failed:', setDocErr);
          throw setDocErr;
        }

        // Log activity and notify users
        try {
          activityLogService.log('backup_export', 'Auto Backup: ' + cols.join(', '));
        } catch (actLogErr) {
          console.warn('[AutoBackup] activityLogService failed, continuing:', actLogErr);
        }

        try {
          await notificationService.notify({
            title: settings.language === 'ar' ? 'النسخ الاحتياطي التلقائي' : 'Automatic System Backup',
            message: settings.language === 'ar'
              ? 'قام النظام تلقائياً بأخذ نسخة احتياطية لجميع البيانات وحفظها في قاعدة البيانات'
              : 'The system has automatically backed up all collections to PostgreSQL',
            type: 'success',
            category: 'system'
          });
        } catch (notifErr: any) {
          console.error('[AutoBackup] notificationService.notify failed:', notifErr);
          throw notifErr;
        }

        // Update lastAutoBackupAt
        try {
          await updateSettings({
            lastAutoBackupAt: Date.now(),
            lastBackup: formatDateTime()
          } as any);
        } catch (updateSetErr: any) {
          console.error('[AutoBackup] updateSettings failed:', updateSetErr);
          throw updateSetErr;
        }
      } catch (err: any) {
        console.error('[AutoBackup] General failure caught in runAutoBackup:', err.message || err);
      }
    };
    runAutoBackup();
  }, [role, roleLoading, settings.autoBackupEnabled, settings.lastAutoBackupAt, auth.currentUser]);

  const toggleLanguage = () => {
    const newLang = settings.language === 'ar' ? 'en' : 'ar';
    updateSettings({ language: newLang });
  };

  const baseNavItems = [
    { id: 'dashboard', name: isAr ? 'الرئيسية' : 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'view_dashboard' },
    { id: 'orders', name: isAr ? 'الطلبات والشحنات' : 'Orders & Shipments', path: '/orders', icon: Package, permission: 'view_orders' },
    { id: 'customers', name: isAr ? 'العملاء' : 'Customers', path: '/customers', icon: Users, permission: 'view_customers' },
    { id: 'couriers', name: isAr ? 'المناديب' : 'Couriers', path: '/couriers', icon: Truck, permission: 'view_couriers' },
    { id: 'finance', name: isAr ? 'القيود والسندات' : 'Entries & Vouchers', path: '/finance', icon: Wallet, permission: 'view_general_entries' },
    { id: 'accounting', name: isAr ? 'المحاسبة' : 'Accounting', path: '/accounting', icon: BookOpen, permission: 'view_finance' },
    { id: 'sources', name: isAr ? 'المصادر' : 'Sources', path: '/sources', icon: MapPin, permission: 'view_sources' },
    { id: 'browser', name: isAr ? 'متصفح المواقع' : 'Web Browser', path: '/browser', icon: Monitor, permission: 'view_browser' },
    { id: 'reports', name: isAr ? 'التقارير' : 'Reports', path: '/reports', icon: FileText, permission: 'view_reports' },
    { id: 'employees', name: isAr ? 'الموظفين' : 'Employees', path: '/employees', icon: Briefcase, permission: 'view_employees' },
    { id: 'users', name: isAr ? 'المستخدمون والأدوار' : 'Users & Roles', path: '/user-management', icon: UserCog, permission: 'view_users' },
    { id: 'website', name: isAr ? 'إدارة الموقع' : 'Website Management', path: '/website-management', icon: Globe, permission: 'view_website_management' },
    { id: 'notifications', name: isAr ? 'الإشعارات' : 'Notifications', path: '/notifications', icon: Bell, permission: 'view_notifications' },
    { id: 'settings', name: isAr ? 'الإعدادات' : 'Settings', path: '/settings', icon: Settings, permission: 'settings' },
  ];

  const [navOrderConfig, setNavOrderConfig] = useState<{ path: string; visible: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem('swiftship_sidebar_nav_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) { }
    return baseNavItems.map(item => ({ path: item.path, visible: true }));
  });

  const updateNavOrderConfig = (newConfig: { path: string; visible: boolean }[]) => {
    setNavOrderConfig(newConfig);
    try {
      localStorage.setItem('swiftship_sidebar_nav_config', JSON.stringify(newConfig));
    } catch (_) { }
  };

  const moveNavItemUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...navOrderConfig];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    updateNavOrderConfig(updated);
  };

  const moveNavItemDown = (index: number) => {
    if (index >= navOrderConfig.length - 1) return;
    const updated = [...navOrderConfig];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    updateNavOrderConfig(updated);
  };

  const toggleNavItemVisibility = (path: string) => {
    const updated = navOrderConfig.map(c => c.path === path ? { ...c, visible: !c.visible } : c);
    updateNavOrderConfig(updated);
  };

  const resetNavOrderConfig = () => {
    const defaultConfig = baseNavItems.map(item => ({ path: item.path, visible: true }));
    updateNavOrderConfig(defaultConfig);
    setShowSystemStatus(true);
    try {
      localStorage.setItem('swiftship_show_system_status', 'true');
    } catch (_) { }
  };

  const orderedNavItems = useMemo(() => {
    const result: typeof baseNavItems = [];
    navOrderConfig.forEach(conf => {
      if (conf.visible !== false) {
        const found = baseNavItems.find(b => b.path === conf.path);
        if (found) result.push(found);
      }
    });
    baseNavItems.forEach(b => {
      if (!navOrderConfig.some(c => c.path === b.path)) {
        result.push(b);
      }
    });
    return result;
  }, [navOrderConfig, isAr]);

  const filteredNavItems = orderedNavItems.filter(item => {
    if (item.path === '/website-management') {
      return hasPermission('view_website_management') || role === 'Admin';
    }
    if (item.path === '/browser') {
      return hasPermission('view_browser') || role === 'Admin' || true;
    }
    if (item.path === '/finance') {
      return hasPermission('view_finance') || hasPermission('view_expenses') || hasPermission('view_custody') || hasPermission('view_general_entries');
    }
    return hasPermission(item.permission);
  });

  const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'engaporaad1@gmail.com', 'admin@swiftship.system', 'apo.1.read@gmail.com'];
  const userEmail = auth.currentUser?.email?.toLowerCase();
  const isRootAdmin = userEmail && ROOT_EMAILS.includes(userEmail);

  if (roleLoading) {
    return (
      <div className="flex bg-luxury-black text-white h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-luxury-gold/20 border-t-luxury-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]"></div>
      </div>
    );
  }

  if (!role && !roleLoading && !isRootAdmin) {
    return (
      <div className="flex bg-luxury-black text-white h-screen flex-col items-center justify-center p-8 text-center select-none">
        <ShieldCheck className="w-20 h-20 text-[#d4af37] mb-6 animate-pulse" />
        <h1 className="text-3xl font-black mb-4 tracking-tight text-[#d4af37]">{isAr ? 'غير مصرح' : 'Unauthorized'}</h1>
        <p className="text-slate-400 max-w-md mb-8">
          {isAr
            ? 'هذا الحساب غير مسجل في النظام حالياً. يرجى التواصل مع المدير لتفعيل حسابك.'
            : 'This account is not currently registered in the system. Please contact the administrator to activate your account.'}
        </p>
        <button onClick={handleLogout} className="bg-gradient-to-r from-luxury-gold to-yellow-600 hover:from-yellow-600 hover:to-luxury-gold text-black px-10 py-3.5 rounded-2xl font-black transition-all duration-300 shadow-lg shadow-yellow-950/40">
          {t('logout')}
        </button>
      </div>
    );
  }

  const handleGlobalSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchText.trim()) {
      setIsSearchOpen(true);
    }
  };

  // Determine if a navigation item is active, accounting for query parameters
  const isItemActive = (itemPath: string) => {
    if (itemPath.includes('?')) {
      const [pathPart, queryPart] = itemPath.split('?');
      if (location.pathname !== pathPart) return false;

      const itemParams = new URLSearchParams(queryPart);
      const currentParams = new URLSearchParams(location.search);

      let match = true;
      itemParams.forEach((val, key) => {
        if (currentParams.get(key) !== val) {
          match = false;
        }
      });
      return match;
    } else {
      if (location.pathname === itemPath) {
        return true;
      }
      return location.pathname.startsWith(itemPath) && itemPath !== '/';
    }
  };

  // Get active item name
  const activeItem = filteredNavItems.find(i => isItemActive(i.path));

  // Multi-language system dates
  const formattedDate = formatDate();
  const formattedTime = formatTime();

  return (
    <div className="flex bg-luxury-black text-slate-300 overflow-hidden h-screen font-sans selection:bg-[#d4af37]/30 antialiased">
      <Toaster
        position={isAr ? "top-left" : "top-right"}
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          duration: 4500,
          style: {
            background: '#0d0d0f',
            color: '#fff',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 700,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 99999,
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#0d0d0f' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0d0d0f' },
          },
        }}
      />

      <Sidebar
        isAr={isAr}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        setIsNavCustomizerOpen={setIsNavCustomizerOpen}
        settings={settings}
        filteredNavItems={filteredNavItems}
        isItemActive={isItemActive}
        showSystemStatus={showSystemStatus}
        isStatusExpanded={isStatusExpanded}
        setIsStatusExpanded={setIsStatusExpanded}
        systemStats={systemStats}
        profile={profile}
        handleLogout={handleLogout}
        t={t}
      />


      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 h-full p-0 overflow-hidden relative">

      <Header
        isAr={isAr}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        activeItem={activeItem}
        searchText={searchText}
        setSearchText={setSearchText}
        handleGlobalSearchKeyPress={handleGlobalSearchKeyPress}
        setIsSearchOpen={setIsSearchOpen}
        formattedTime={formattedTime}
        formattedDate={formattedDate}
        setIsQuickNavOpen={setIsQuickNavOpen}
        toggleLanguage={toggleLanguage}
        unreadCount={unreadCount}
        setIsPortalApprovalsOpen={setIsPortalApprovalsOpen}
        pendingPortalCount={pendingPortalCount}
        setIsJobApplicationsOpen={setIsJobApplicationsOpen}
        pendingJobsCount={pendingJobsCount}
        setIsSystemDevModalOpen={setIsSystemDevModalOpen}
      />


        {/* Sub-routing Pages Outlet Viewport */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-luxury-black via-[#08080a] to-[#050505] custom-scrollbar">
          {isOfflineModeActive && (
            <div className="mb-6 p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 animate-bounce" />
                <div className="text-start" dir={isAr ? "rtl" : "ltr"}>
                  <p className="text-xs font-bold text-amber-200">
                    {isAr
                      ? 'وضع التشغيل الاحتياطي للطوارئ (بدون اتصال بقاعدة البيانات). جميع البيانات معروضة ومحفوظة من النسخة الاحتياطية المحلية بأمان.'
                      : 'Emergency Offline Recovery Mode (Offline). All system actions are buffered locally via secure browser sandbox.'}
                  </p>
                  <p className="text-[10px] text-amber-500/80 mt-0.5">
                    {isAr
                      ? 'تم الدخول بصفة المسؤول الرئيسي للصيانة وتفادي الكوارث. يمكنك تصفح البيانات وتغيير النظام وتصدير نسخة احتياطية محلية.'
                      : 'Logged in as Main System Administrator for disaster recovery and maintenance. Browse historical indices or dump cached collections.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={downloadBackup}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-black bg-[#d4af37] hover:bg-yellow-600 rounded-lg transition-all cursor-pointer"
                  title={isAr ? "تنزيل نسخة احتياطية دقيقة" : "Download precision system data backup"}
                >
                  <Download className="w-3.5 h-3.5" />
                  {isAr ? 'تصدير نسخة احتياطية (JSON)' : 'Export Backup (JSON)'}
                </button>
                <label className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-amber-200 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-500/35 rounded-lg transition-all cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {isAr ? 'استيراد واستعادة بيانات' : 'Import/Restore Backup'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
          <Outlet />
        </div>

        {/* Footer */}
        <footer className="h-10 border-t border-[#d4af37]/10 flex items-center px-8 justify-between text-[10px] text-slate-500 bg-black/80 backdrop-blur-md shrink-0 relative select-none">
          <div className="flex gap-4">
            <span className="tracking-[0.1em] font-extrabold text-[#d4af37]/60">ALX DELIVER ULTRA PRO V3</span>
            <span className="border-l border-slate-800 pl-4 text-slate-600 font-mono">SEC_TOKEN: FIPS-140-3</span>
          </div>
          <div className="flex items-center gap-2 font-bold tracking-widest text-[#d4af37]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIVE NODES ONLINE
          </div>
        </footer>

        {/* Floatable Global Search Modal */}
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => {
            setIsSearchOpen(false);
            setSearchText('');
          }}
          searchQuery={searchText}
        />

        {/* Quick Navigation Menu Modal */}
        <QuickNavModal
          isOpen={isQuickNavOpen}
          onClose={() => setIsQuickNavOpen(false)}
        />

        {/* Global Financial Statement Modal */}
        <GlobalEntityLedgerModal />

        {/* System & Developer Information Modal */}
        {isSystemDevModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsSystemDevModalOpen(false)}>
            <div
              className="w-full max-w-2xl bg-gradient-to-b from-[#0d0d0f] to-[#050507] border border-[#d4af37]/30 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
              dir={isAr ? 'rtl' : 'ltr'}
            >
              {/* Luxury Accent Lines */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent"></div>
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#d4af37]/5 rounded-full blur-[100px] pointer-events-none"></div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-white/[0.05] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4af37]/20 to-amber-900/20 border border-[#d4af37]/30 flex items-center justify-center shadow-lg shadow-black/20">
                    <ShieldCheck className="w-6 h-6 text-[#d4af37]" />
                  </div>
                  <div className="text-start">
                    <h3 className="text-lg font-black text-white tracking-tight leading-none">
                      {isAr ? 'مركز معلومات النظام والمطور' : 'System Intelligence Hub'}
                    </h3>
                    <p className="text-[10px] text-[#d4af37] font-black uppercase tracking-[0.2em] mt-1.5">
                      Enterprise Enterprise V4 • Global Edition
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSystemDevModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center border border-white/[0.05] bg-white/[0.02] text-slate-400 hover:text-white rounded-xl transition-all hover:bg-white/[0.05] active:scale-95"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              {/* Modal Content - Scrollable Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">

                {/* 1. System Overview Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Cpu className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                      {isAr ? 'نظرة عامة على النظام' : 'System Overview'}
                    </span>
                  </div>
                  <div className="bg-[#0a0a0c] border border-white/[0.03] p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Activity className="w-20 h-20 text-[#d4af37]" />
                    </div>
                    <h4 className="text-sm font-black text-white mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                      {isAr ? 'SwiftShip Enterprise V4 - بنية لوجستية معيارية' : 'SwiftShip Enterprise V4 - Logistics Infrastructure'}
                    </h4>
                    <p className="text-xs text-slate-400 font-bold leading-relaxed text-start">
                      {isAr
                        ? 'منظومة SwiftShip Enterprise V4 التقنية: بنية برمجية متطورة مخصصة لأتمتة سلاسل التوريد وإدارة الأصول اللوجستية. تعتمد المنظومة بروتوكولات تشفير معيارية ومعايير حوكمة مالية متكاملة لضمان دقة البيانات وكفاءة الأداء في البيئات التشغيلية عالية الكثافة.'
                        : 'SwiftShip Enterprise V4: An advanced technical framework dedicated to supply chain automation and logistics asset management. Utilizing standardized encryption protocols and integrated financial governance to ensure data precision and operational efficiency in high-concurrency environments.'}
                    </p>
                    <div className="mt-4 flex gap-3">
                      <span className="px-3 py-1 bg-white/[0.03] border border-white/[0.05] rounded-full text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                        Build 2026.07.V4
                      </span>
                      <span className="px-3 py-1 bg-[#d4af37]/5 border border-[#d4af37]/10 rounded-full text-[9px] font-black text-[#d4af37] uppercase tracking-tighter">
                        Active Support
                      </span>
                    </div>
                  </div>
                </section>

                {/* 2. Company Overview Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Building2 className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                      {isAr ? 'نبذة عن الشركة' : 'Company Overview'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#0a0a0c] border border-white/[0.03] p-5 rounded-3xl space-y-3 text-start">
                      <h5 className="text-xs font-black text-white">
                        {settings.companyName || (isAr ? 'الكس-تراك للحلول اللوجستية' : 'Al-Xpress Logistics')}
                      </h5>
                      <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                        {isAr
                          ? 'شركة رائدة في تقديم الحلول اللوجستية المتكاملة وخدمات النقل الذكي، نعتمد على الابتكار التقني لرفع كفاءة سلاسل التوريد في المنطقة.'
                          : 'A leading provider of integrated logistics solutions and smart transportation services, leveraging technical innovation to enhance supply chain efficiency.'}
                      </p>
                    </div>
                    <div className="bg-[#0a0a0c] border border-white/[0.03] p-5 rounded-3xl space-y-3 text-start">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>{settings.companyAddress || (isAr ? 'المركز الرئيسي - اليمن / المملكة العربية السعودية' : 'Headquarters - Yemen / KSA')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span dir="ltr">{settings.companyPhone || '+967 77X XXX XXX'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <Globe className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>{settings.companyWebsite || 'www.al-xpress.com'}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 3. Developer & Technical Support Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Code2 className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                      {isAr ? 'المطور والدعم الفني' : 'Dev & Tech Support'}
                    </span>
                  </div>
                  <div className="bg-gradient-to-br from-[#0a0a0c] to-[#0d0d10] border border-[#d4af37]/10 p-6 rounded-3xl relative group">
                    <div className="flex flex-col sm:flex-row items-center gap-5 text-start">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-b from-[#d4af37] to-amber-700 p-[1px] shadow-lg shadow-[#d4af37]/5 shrink-0">
                        <div className="w-full h-full rounded-2xl bg-black flex items-center justify-center overflow-hidden">
                          <User className="w-10 h-10 text-[#d4af37]/20" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                          <span className="absolute bottom-2 inset-x-0 text-center text-[9px] font-black text-[#d4af37] uppercase">Lead</span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="text-lg font-black text-white flex items-center gap-2">
                          {isAr ? 'أرسلان الشماري' : 'Arslan ALShamari'}
                          <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[8px] font-black uppercase">
                            Available for Support
                          </div>
                        </h4>
                        <p className="text-xs text-[#d4af37] font-black uppercase tracking-wide">
                          {isAr ? 'كبير مهندسي البرمجيات وأمن المعلومات' : 'Senior Software Architect & InfoSec Specialist'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-bold max-w-md">
                          {isAr
                            ? 'لطلب الدعم الفني المباشر، الاستشارات التقنية، أو طلب تعديلات وتطويرات مخصصة للنظام، يرجى استخدام وسائل التواصل الرسمية أدناه.'
                            : 'For direct technical support, technical consultations, or custom system modifications and developments, please use the official contact methods below.'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                      <div className="space-y-2">
                        <a
                          href="tel:+967776422777"
                          className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl group/link hover:bg-[#d4af37]/10 hover:border-[#d4af37]/30 transition-all cursor-pointer shadow-sm active:scale-[0.98] relative z-10"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 group-hover/link:border-[#d4af37]/40 transition-colors">
                              <Phone className="w-3.5 h-3.5 text-slate-500 group-hover/link:text-[#d4af37] transition-colors" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 group-hover/link:text-slate-300 transition-colors">{isAr ? 'اتصال مباشر' : 'Direct Call'}</span>
                          </div>
                          <span dir="ltr" className="text-xs font-mono font-black text-white group-hover/link:text-[#d4af37] transition-colors">+967 776 422 777</span>
                        </a>
                        <a
                          href="mailto:arslan.alshamari@gmail.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl group/link hover:bg-[#d4af37]/10 hover:border-[#d4af37]/30 transition-all cursor-pointer shadow-sm active:scale-[0.98] relative z-10"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 group-hover/link:border-[#d4af37]/40 transition-colors">
                              <Mail className="w-3.5 h-3.5 text-slate-500 group-hover/link:text-[#d4af37] transition-colors" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 group-hover/link:text-slate-300 transition-colors">{isAr ? 'البريد الرسمي' : 'Official Email'}</span>
                          </div>
                          <span className="text-[10px] font-black text-white group-hover/link:text-[#d4af37] transition-colors">arslan.alshamari@gmail.com</span>
                        </a>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href="https://wa.me/967776422777"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center justify-center gap-2 bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/30 rounded-2xl transition-all p-4 group/btn cursor-pointer shadow-sm active:scale-95 relative z-10"
                        >
                          <MessageCircle className="w-6 h-6 text-emerald-400 group-hover/btn:scale-110 transition-transform shadow-emerald-500/20" />
                          <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">WhatsApp</span>
                        </a>
                        <a
                          href="https://t.me/Arslan_ALShamari"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center justify-center gap-2 bg-sky-500/5 border border-sky-500/10 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-2xl transition-all p-4 group/btn cursor-pointer shadow-sm active:scale-95 relative z-10"
                        >
                          <Send className="w-6 h-6 text-sky-400 group-hover/btn:scale-110 transition-transform shadow-sky-500/20" />
                          <span className="text-[9px] font-black uppercase text-sky-400 tracking-wider">Telegram</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="px-8 py-4 border-t border-white/[0.05] bg-black/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      System Online & Secure
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-white/20 tracking-[0.3em]">AES-256</span>
                  <div className="h-3 w-[1px] bg-white/10"></div>
                  <span className="text-[10px] font-black text-[#d4af37]/40 tracking-[0.2em]">ALX-V4-2026</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <MobileNavigation
        isAr={isAr}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        filteredNavItems={filteredNavItems}
        isItemActive={isItemActive}
      />

      <NavigationCustomizer
        isAr={isAr}
        isNavCustomizerOpen={isNavCustomizerOpen}
        setIsNavCustomizerOpen={setIsNavCustomizerOpen}
        showSystemStatus={showSystemStatus}
        toggleSystemStatusVisibility={toggleSystemStatusVisibility}
        navOrderConfig={navOrderConfig}
        baseNavItems={baseNavItems}
        moveNavItemUp={moveNavItemUp}
        moveNavItemDown={moveNavItemDown}
        toggleNavItemVisibility={toggleNavItemVisibility}
        resetNavOrderConfig={resetNavOrderConfig}
      />


      {/* Pending Portal Approvals Modal */}
      <PendingPortalApprovalsModal
        isOpen={isPortalApprovalsOpen}
        onClose={() => setIsPortalApprovalsOpen(false)}
      />

      {/* Job Applications Reception Modal */}
      <JobApplicationsModal
        isOpen={isJobApplicationsOpen}
        onClose={() => setIsJobApplicationsOpen(false)}
      />
    </div>
  );
}
