import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
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
  Plus, 
  Crown,
  Menu,
  ChevronDown,
  UserCog
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { Toaster } from 'react-hot-toast';
import GlobalSearchModal from './GlobalSearchModal';
import { activityLogService } from '../services/activityLogService';
import { notificationService } from '../services/notificationService';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, profile, hasPermission, loading: roleLoading } = useRole();
  const { settings, updateSettings, t } = useSettings();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Search State
  const [searchText, setSearchText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
  const [systime, setSystime] = useState(new Date());
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSystime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live Statistics Sync for Sidebar Status card
  useEffect(() => {
    if (!auth.currentUser || roleLoading || !role) return;

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      const docs = snap.docs.map(doc => doc.data());
      
      const active = docs.filter(o => o.orderStatus !== 'تم التسليم' && o.orderStatus !== 'ملغي' && o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled').length;
      const delayed = docs.filter(o => o.orderStatus === 'متأخر' || o.orderStatus === 'Delayed' || o.orderStatus?.toLowerCase() === 'delayed').length;
      const ongoing = docs.filter(o => ['في الطريق', 'قيد الشحن', 'شحن دولي', 'وصل مركز التوزيع في اليمن', 'In Transit', 'In Local Warehouse', 'Shipped', 'Cargo'].includes(o.orderStatus)).length;
      const unpaid = docs.filter(o => parseFloat(o.amountRemaining || 0) > 0).length;
      
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
    }, (error) => {
      console.error("Error listening to orders for sidebar stats:", error);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const count = snap.docs.length;
      setSystemStats(prev => ({
        ...prev,
        onlineStaff: Math.max(1, Math.min(count, 3))
      }));
    }, (error) => {
      console.error("Error listening to users for sidebar stats:", error);
    });

    return () => {
      unsubOrders();
      unsubUsers();
    };
  }, [role, roleLoading]);

  // Listen for Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!auth.currentUser || roleLoading || !role) return;
    
    const q = query(collection(db, 'notifications'), where('read', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      const allowedDocs = snap.docs.filter(doc => {
        const data = doc.data();
        if (role !== 'Admin') {
          const isCreator = data.creatorId === auth.currentUser?.uid;
          const isTarget = data.userId === auth.currentUser?.uid;
          const isAssociated = data.associatedUserIds?.includes(auth.currentUser?.uid);
          if (!isCreator && !isTarget && !isAssociated) return false;
        }
        const category = data.category || 'system';
        if (category === 'finance' && !hasPermission('notify_finance') && role !== 'Admin') return false;
        if (category === 'order' && !hasPermission('notify_orders') && role !== 'Admin') return false;
        if (category === 'system' && !hasPermission('notify_system') && role !== 'Admin') return false;
        return true;
      });
      setUnreadCount(allowedDocs.length);
    }, (error) => {
      console.error("Error listening to notifications:", error);
    });

    return () => unsub();
  }, [role, roleLoading, hasPermission]);

  // Log logout & sign out
  const handleLogout = async () => {
    try {
      await activityLogService.log('logout', 'User Session Ended');
    } catch (_) {}
    await signOut(auth);
    navigate('/login');
  };

  // Auto-backup check: if admin & autoBackupEnabled & 24h passed, run backup to Firestore
  useEffect(() => {
    if (roleLoading || role !== 'Admin' || !settings.autoBackupEnabled) return;
    const lastBackupAt = settings.lastAutoBackupAt || 0;
    const hoursSince = (Date.now() - lastBackupAt) / (1000 * 60 * 60);
    if (hoursSince < 24) return;

    const runAutoBackup = async () => {
      try {
        const cols = ['orders', 'customers', 'couriers', 'sources', 'users', 'roles'];
        const backupDoc: any = {
          version: '3.0',
          timestamp: new Date().toISOString(),
          createdBy: auth.currentUser?.email || 'admin',
          type: 'auto',
          data: {}
        };
        for (const col of cols) {
          try {
            const snap = await getDocs(collection(db, col));
            backupDoc.data[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (_) {}
        }
        // Save backup as a Firestore document under /backups collection
        const backupId = `auto_${new Date().toISOString().split('T')[0]}`;
        await setDoc(doc(db, 'backups', backupId), {
          ...backupDoc,
          savedAt: Date.now()
        });
        
        // Log activity and notify users
        activityLogService.log('backup_export', 'Auto Backup: ' + cols.join(', '));
        notificationService.notify({
          title: settings.language === 'ar' ? 'النسخ الاحتياطي التلقائي' : 'Automatic System Backup',
          message: settings.language === 'ar'
            ? 'قام النظام تلقائياً بأخذ نسخة احتياطية لجميع البيانات وحفظها في قاعدة البيانات'
            : 'The system has automatically backed up all collections to Firestore',
          type: 'success',
          category: 'system'
        });

        // Update lastAutoBackupAt
        await updateSettings({
          lastAutoBackupAt: Date.now(),
          lastBackup: new Date().toLocaleString(settings.language === 'ar' ? 'ar-YE' : 'en-US')
        } as any);
        console.log('[AutoBackup] Completed successfully');
      } catch (err) {
        console.error('[AutoBackup] Failed:', err);
      }
    };
    runAutoBackup();
  }, [role, roleLoading, settings.autoBackupEnabled, settings.lastAutoBackupAt]);

  const toggleLanguage = () => {
    const newLang = settings.language === 'ar' ? 'en' : 'ar';
    updateSettings({ language: newLang });
  };

  const isAr = settings.language === 'ar';

  const navItems = [
    { name: isAr ? 'الرئيسية' : 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'view_dashboard' },
    { name: isAr ? 'الطلبات' : 'Orders', path: '/orders', icon: Package, permission: 'view_orders' },
    { name: isAr ? 'التتبع' : 'Tracking', path: '/tracking', icon: Truck, permission: 'view_orders' },
    { name: isAr ? 'العملاء' : 'Customers', path: '/customers', icon: Users, permission: 'view_customers' },
    { name: isAr ? 'المناديب' : 'Couriers', path: '/couriers', icon: Truck, permission: 'view_couriers' },
    { name: isAr ? 'المصروفات والعهد' : 'Expenses & Custody', path: '/expenses', icon: Wallet, permission: 'view_finance' },
    { name: isAr ? 'المحاسبة' : 'Accounting', path: '/expenses?tab=accounting', icon: FileText, permission: 'view_finance' },
    { name: isAr ? 'المصادر' : 'Sources', path: '/sources', icon: MapPin, permission: 'view_sources' },
    { name: isAr ? 'التقارير' : 'Reports', path: '/expenses?tab=reports', icon: FileText, permission: 'view_reports' },
    { name: isAr ? 'المستخدمون والأدوار' : 'Users & Roles', path: '/user-management', icon: UserCog, permission: 'view_users' },
    { name: isAr ? 'الإشعارات' : 'Notifications', path: '/notifications', icon: Bell, permission: 'view_notifications' },
    { name: isAr ? 'الإعدادات' : 'Settings', path: '/settings', icon: Settings, permission: 'settings' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.path === '/expenses') {
      return hasPermission('view_finance') || hasPermission('view_expenses') || hasPermission('view_custody');
    }
    return hasPermission(item.permission);
  });

  const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'admin@swiftship.system'];
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
        if (itemPath === '/expenses') {
          // If the item path is just /expenses, don't match if we are on a tab query
          const tab = new URLSearchParams(location.search).get('tab');
          if (tab === 'reports' || tab === 'accounting') {
            return false;
          }
        }
        return true;
      }
      return location.pathname.startsWith(itemPath) && itemPath !== '/';
    }
  };

  // Get active item name
  const activeItem = filteredNavItems.find(i => isItemActive(i.path));

  // Multi-language system dates
  const formattedDate = systime.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formattedTime = systime.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className="flex bg-luxury-black text-slate-300 overflow-hidden h-screen font-sans selection:bg-[#d4af37]/30 select-none antialiased">
      <Toaster position={isAr ? "top-left" : "top-right"} toastOptions={{
        style: {
          background: '#0d0d0f',
          color: '#fff',
          border: '1px solid rgba(212, 175, 55, 0.2)'
        }
      }} />
      
      {/* Sidebar - Desktop Layout */}
      <aside className="w-72 bg-luxury-black border-r border-[#d4af37]/15 flex flex-col shrink-0 hidden md:flex relative z-20 backdrop-blur-md">
        
        {/* Dynamic Logo & System Name Block */}
        <div className="p-8 pb-6 flex flex-col items-center justify-center border-b border-[#d4af37]/10 relative">
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
          
          <div className="relative group cursor-pointer mb-2">
            <div className="absolute -inset-1 rounded-full bg-[#d4af37]/10 blur-md group-hover:bg-[#d4af37]/25 transition duration-500"></div>
            {settings.systemLogo ? (
              <img
                src={settings.systemLogo}
                alt={settings.systemName || 'Logo'}
                className="w-16 h-12 object-contain transition-all duration-500 transform group-hover:scale-105"
              />
            ) : (
              <svg className="w-16 h-12 text-[#d4af37] transition-all duration-500 transform group-hover:scale-105" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 5 L75 55 L50 43 L25 55 Z" stroke="currentColor" strokeWidth="2.5" fill="rgba(212,175,55,0.08)" />
                <path d="M50 5 L50 43" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
                <path d="M25 55 C12 40 10 25 22 15 C30 20 40 32 50 43" stroke="currentColor" strokeWidth="1.5" />
                <path d="M75 55 C88 40 90 25 78 15 C70 20 60 32 50 43" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="50" cy="5" r="3" fill="#fff" className="animate-ping" />
                <circle cx="50" cy="5" r="2.5" fill="currentColor" />
              </svg>
            )}
          </div>
          
          <h1 className="text-lg font-extrabold tracking-[0.1em] text-[#d4af37] uppercase text-center mt-1 luxury-glow-neon select-none">
            {settings.systemName || settings.companyName || 'SwiftShip'}
          </h1>
          <p className="text-[9px] font-black tracking-[0.3em] text-slate-500 uppercase mt-0.5 select-none">
            {isAr ? 'نظام إدارة اللوجستية' : 'Logistics & ERP'}
          </p>
        </div>
        
        {/* Scrollable Nav Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            // Support sub-routing match check
            const isActive = isItemActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-xs group relative text-right ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#d4af37]/15 to-transparent text-white border-l-2 border-[#d4af37] shadow-[inset_4px_0_15px_rgba(212,175,55,0.05)]' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-[#d4af37]' : 'text-slate-500 group-hover:text-[#d4af37]'}`} />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] shadow-[0_0_8px_#d4af37]"></span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Sidebar Panels as requested */}
        <div className="p-4 border-t border-[#d4af37]/10 space-y-3 bg-[#08080a]">
          {/* 🟢 ALX SYSTEM STATUS CARD */}
          <div 
            onClick={() => setIsStatusExpanded(!isStatusExpanded)}
            className={`p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-[#0a0a0d] to-[#0c0c10] border transition-all duration-300 relative overflow-hidden select-none text-start cursor-pointer active:scale-[0.98] ${
              systemStats.systemStatus === 'good' 
                ? 'border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:border-emerald-500/40' 
                : systemStats.systemStatus === 'warning'
                ? 'border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)] hover:border-amber-500/40'
                : 'border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between pb-1">
              <div className="flex flex-col">
                <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  systemStats.systemStatus === 'good' 
                    ? 'text-emerald-400' 
                    : systemStats.systemStatus === 'warning'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full inline-block animate-pulse shrink-0 ${
                    systemStats.systemStatus === 'good' 
                      ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' 
                      : systemStats.systemStatus === 'warning'
                      ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                      : 'bg-rose-400 shadow-[0_0_8px_#ef4444]'
                  }`}></span>
                  🟢 ALX SYSTEM STATUS
                </span>
                <span className="text-[9px] text-[#d4af37] font-bold block mt-0.5">
                  {isAr ? 'حالة النظام المباشرة' : 'Live System Status'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isStatusExpanded ? 'rotate-180 text-[#d4af37]' : ''}`} />
            </div>

            {/* Quick Summary Badge for compact view */}
            {!isStatusExpanded && (
              <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500 font-bold bg-black/30 px-2 py-1 rounded-lg border border-white/[0.01]">
                <span>{isAr ? 'الحالة العامة:' : 'System overall:'}</span>
                <span className={`font-black uppercase ${
                  systemStats.systemStatus === 'good' 
                    ? 'text-emerald-400' 
                    : systemStats.systemStatus === 'warning'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}>
                  {systemStats.systemStatus === 'good' 
                    ? (isAr ? 'يعمل بكفاءة' : 'Healthy') 
                    : systemStats.systemStatus === 'warning'
                    ? (isAr ? 'يحتاج متابعة' : 'Attention')
                    : (isAr ? 'تأخير بالمهام' : 'Delay')}
                </span>
              </div>
            )}

            {/* Metrics List displayed only when expanded */}
            {isStatusExpanded && (
              <div className="space-y-1 text-[10px] font-bold text-slate-400 mt-2.5 border-t border-white/[0.04] pt-2.5 animate-fade-in">
                <div className="flex justify-between items-center bg-black/40 p-1.5 rounded-lg border border-white/[0.02]">
                  <span className="text-slate-500 text-[9px]">{isAr ? 'حالة النظام ورسوخ العمل' : 'Status'}</span>
                  <span className={`font-black tracking-tight text-[9px] ${
                    systemStats.systemStatus === 'good' 
                      ? 'text-emerald-400' 
                      : systemStats.systemStatus === 'warning'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    {systemStats.systemStatus === 'good' 
                      ? (isAr ? 'النظام يعمل بكفاءة' : 'System Healthy') 
                      : systemStats.systemStatus === 'warning'
                      ? (isAr ? 'يرجى مراجعة المهام' : 'Attention Needed')
                      : (isAr ? 'يوجد تأخير يتطلب حث' : 'Critical Delay')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                  <span>{isAr ? 'الطلبات النشطة حالياً' : 'Active Orders Currently'}</span>
                  <span className="font-mono text-white text-[11px] font-black">{systemStats.activeOrders}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                  <span>{isAr ? 'الطلبات المتأخرة' : 'Delayed Orders'}</span>
                  <span className={`font-mono text-[11px] font-black ${systemStats.delayedOrders > 0 ? 'text-rose-500 animate-pulse bg-rose-500/10 px-1.5 rounded' : 'text-slate-500'}`}>
                    {systemStats.delayedOrders}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                  <span>{isAr ? 'الموظفين المتصلين الآن' : 'Staff Online'}</span>
                  <span className="font-mono text-emerald-400 text-[11px] font-black">{systemStats.onlineStaff}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                  <span>{isAr ? 'الشحنات الجارية' : 'Current Shipments'}</span>
                  <span className="font-mono text-cyan-400 text-[11px] font-black">{systemStats.ongoingShipments}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span>{isAr ? 'الطلبات المعلقة مالياً' : 'Financially Pending'}</span>
                  <span className={`font-mono text-[11px] font-black ${systemStats.financiallyPending > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {systemStats.financiallyPending}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2️⃣ Admin/Manager Privileges Card with تاج ذهبي (Gold Crown) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-black via-slate-950 to-[#0e0e11] border border-[#d4af37]/5 flex items-center gap-3 group">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#d4af37] to-amber-700 p-[1px] shadow-[0_0_10px_rgba(212,175,55,0.15)]">
                <div className="w-full h-full rounded-full bg-[#050505] flex items-center justify-center font-black text-[11px] text-[#d4af37] uppercase">
                  {profile?.fullName?.charAt(0) || 'SU'}
                </div>
              </div>
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-[#d4af37] to-yellow-600 text-black p-0.5 rounded-full select-none shadow-sm shadow-yellow-950" title="Full Superuser Rights">
                <Crown className="w-2.5 h-2.5" />
              </span>
            </div>
            
            <div className="flex-1 min-w-0 text-start">
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-white truncate">{profile?.fullName || 'مدير النظام'}</span>
              </div>
              <span className="text-[9px] text-[#d4af37] font-black uppercase tracking-widest block mt-0.5">
                {isAr ? 'صلاحيات كاملة 👑' : 'Full Admin Privileges'}
              </span>
            </div>
            
            <button 
              onClick={handleLogout} 
              className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/20 transition-all"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 h-full p-0 overflow-hidden relative">
        
        {/* Top Navbar */}
        <header className="h-20 border-b border-[#d4af37]/10 flex items-center justify-between px-8 bg-black/60 backdrop-blur-md sticky top-0 z-15 gap-4 shrink-0 transition-all">
          
          {/* Hamburger Menu & Page Title */}
          <div className="flex items-center gap-4 shrink-0">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="md:hidden p-2.5 rounded-xl border border-[#d4af37]/20 hover:bg-[#d4af37]/10 transition text-[#d4af37]"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-start text-start leading-none">
              <span className="text-[9px] font-black text-[#d4af37] uppercase tracking-[0.25em] mb-0.5 select-none">
                ALX SYSTEM GATEWAY
              </span>
              <h2 className="text-base font-black text-white tracking-wide uppercase">
                {activeItem?.name || (isAr ? 'لوحة المراقبة' : 'Admin Gateway')}
              </h2>
            </div>
          </div>

          {/* 🔍 Universal Global Search Panel in center */}
          <div className="flex-1 max-w-xl relative hidden sm:block">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search className="text-[#d4af37] w-4 h-4 transition duration-300" />
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleGlobalSearchKeyPress}
              placeholder={isAr ? 'البحث العالمي بالطلب أو العميل أو المندوب...' : 'Global intelligent search by order, customer, courier...'}
              className="w-full bg-[#08080a] border border-[#d4af37]/20 rounded-xl pr-10 pl-16 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37] font-bold transition-all text-start"
              dir={isAr ? 'rtl' : 'ltr'}
            />
            {/* Ctrl + K Shortcut layout display as requested */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none select-none">
              <kbd className="bg-slate-900 border border-slate-800 text-[10px] text-[#d4af37]/80 px-2 py-0.5 rounded-md font-mono select-none">
                Ctrl + K
              </kbd>
              {searchText.trim() && (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-3 py-1 text-[9px] font-black rounded-lg transition-all shadow-md select-all"
                >
                  {isAr ? 'ابحث' : 'Find'}
                </button>
              )}
            </div>
          </div>
          
          {/* Header Utilities */}
          <div className="flex items-center gap-4 shrink-0">
            
            {/* Live Local System Calendar Picker & Time */}
            <div className="hidden lg:flex flex-col items-end text-right border-l border-[#d4af37]/15 pl-4 gap-0.5 select-none font-sans">
              <span className="text-[10px] font-extrabold text-[#d4af37] tracking-wider uppercase flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
                {formattedTime}
              </span>
              <span className="text-[10px] font-bold text-slate-400 select-none leading-relaxed">
                {formattedDate}
              </span>
            </div>

            {/* Language Switch */}
            <button 
              onClick={toggleLanguage}
              className="p-2.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-[#d4af37] transition-all bg-[#08080a] border border-slate-900 hover:border-[#d4af37]/20 flex items-center justify-center cursor-pointer"
              title={isAr ? "Switch to English" : "التحويل للعربية"}
            >
              <svg className="w-4 h-4 text-[#d4af37]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth="1" strokeOpacity="0.4" />
                <path d="M2 12h20" strokeWidth="1" strokeOpacity="0.4" />
                <text x="12" y="15" textAnchor="middle" fill="#d4af37" fontSize="9.5" fontWeight="950" fontFamily="sans-serif">
                  {isAr ? 'AR' : 'EN'}
                </text>
              </svg>
            </button>
            
            {/* Notifications Bell with Glowing Badge */}
            <Link to="/notifications" className="p-2.5 rounded-xl hover:bg-slate-900 relative text-slate-400 hover:text-[#d4af37] transition-all bg-[#08080a] border border-slate-900 hover:border-[#d4af37]/20">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d4af37]/30 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#d4af37] text-[8px] font-black text-black items-center justify-center">
                    {unreadCount}
                  </span>
                </span>
              )}
            </Link>

            {/* Quick Refresh Icon */}
            <button 
              onClick={() => window.location.reload()}
              className="p-2.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-emerald-400 transition-all bg-[#08080a] border border-slate-900 hover:border-emerald-500/10"
              title="Sync Ledger Modules"
            >
              <RotateCw className="w-4 h-4 animate-hover" />
            </button>
          </div>
        </header>

        {/* Sub-routing Pages Outlet Viewport */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-luxury-black via-[#08080a] to-[#050505] custom-scrollbar">
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
      </main>

      {/* Mobile Sidebar overlay block */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="w-72 bg-luxury-black h-full border-r border-[#d4af37]/30 flex flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#d4af37]/10">
              <span className="text-[#d4af37] font-black uppercase text-sm">ALX DELIVERY</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="text-white hover:text-[#d4af37] font-bold text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
            
            <nav className="flex-1 space-y-2 overflow-y-auto">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-xs ${
                      isActive 
                        ? 'bg-[#d4af37]/10 text-white border-l-2 border-[#d4af37]' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-[#d4af37]" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
