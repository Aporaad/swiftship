import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
  ChevronDown
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { Toaster } from 'react-hot-toast';
import GlobalSearchModal from './GlobalSearchModal';

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

  // System Time State
  const [systime, setSystime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setSystime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      setUnreadCount(snap.docs.length);
    }, (error) => {
      console.error("Error listening to notifications:", error);
    });

    return () => unsub();
  }, [role, roleLoading]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const toggleLanguage = () => {
    const newLang = settings.language === 'ar' ? 'en' : 'ar';
    updateSettings({ language: newLang });
  };

  const isAr = settings.language === 'ar';

  const navItems = [
    { name: isAr ? 'الرئيسية' : 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'view_dashboard' },
    { name: isAr ? 'الطلبات' : 'Orders', path: '/orders', icon: Package, permission: 'view_orders' },
    { name: isAr ? 'الشحن' : 'Shipping', path: '/tracking', icon: Truck, permission: 'view_orders' },
    { name: isAr ? 'العملاء' : 'Customers', path: '/customers', icon: Users, permission: 'view_customers' },
    { name: isAr ? 'المندوبين' : 'Couriers', path: '/couriers', icon: Truck, permission: 'manage_couriers' },
    { name: isAr ? 'المصروفات والعهد' : 'Expenses & Custody', path: '/expenses', icon: Wallet, permission: 'view_finance' },
    { name: isAr ? 'المحاسبة' : 'Accounting', path: '/expenses?tab=accounting', icon: FileText, permission: 'view_finance' },
    { name: isAr ? 'المصادر' : 'Sources', path: '/sources', icon: MapPin, permission: 'manage_sources' },
    { name: isAr ? 'التقارير' : 'Reports', path: '/expenses?tab=reports', icon: FileText, permission: 'view_finance' },
    { name: isAr ? 'المستخدمين' : 'Users Management', path: '/users', icon: Users, permission: 'manage_users' },
    { name: isAr ? 'الأدوار والصلاحيات' : 'Roles & Permissions', path: '/roles', icon: ShieldCheck, permission: 'manage_users' },
    { name: isAr ? 'الإشعارات' : 'Notifications', path: '/notifications', icon: Bell, permission: 'view_dashboard' },
    { name: isAr ? 'الإعدادات' : 'Settings', path: '/settings', icon: Settings, permission: 'settings' },
  ];

  const filteredNavItems = navItems.filter(item => hasPermission(item.permission));

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

  // Get active item name
  const activeItem = filteredNavItems.find(i => i.path === location.pathname || (location.pathname.startsWith(i.path) && i.path !== '/'));

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
        
        {/* Luxury Gold ALX Delivery Logo Block */}
        <div className="p-8 pb-6 flex flex-col items-center justify-center border-b border-[#d4af37]/10 relative">
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
          
          <div className="relative group cursor-pointer mb-2">
            <div className="absolute -inset-1 rounded-full bg-[#d4af37]/10 blur-md group-hover:bg-[#d4af37]/25 transition duration-500"></div>
            {/* Custom Gold Wing SVG Logo */}
            <svg className="w-16 h-12 text-[#d4af37] transition-all duration-500 transform group-hover:scale-105" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 5 L75 55 L50 43 L25 55 Z" stroke="currentColor" strokeWidth="2.5" fill="rgba(212,175,55,0.08)" />
              <path d="M50 5 L50 43" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
              {/* Left Wing */}
              <path d="M25 55 C12 40 10 25 22 15 C30 20 40 32 50 43" stroke="currentColor" strokeWidth="1.5" />
              {/* Right Wing */}
              <path d="M75 55 C88 40 90 25 78 15 C70 20 60 32 50 43" stroke="currentColor" strokeWidth="1.5" />
              {/* Core Star glow */}
              <circle cx="50" cy="5" r="3" fill="#fff" className="animate-ping" />
              <circle cx="50" cy="5" r="2.5" fill="currentColor" />
            </svg>
          </div>
          
          <h1 className="text-xl font-extrabold tracking-[0.15em] text-[#d4af37] uppercase text-center mt-1 luxury-glow-neon select-none">
            ALX DELIVERY
          </h1>
          <p className="text-[9px] font-black tracking-[0.3em] text-slate-500 uppercase mt-0.5 select-none">
            Logistics & ERP
          </p>
        </div>
        
        {/* Scrollable Nav Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            // Support sub-routing match check
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/');
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
          {/* 1️⃣ ALX HUB Card */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#121216] to-[#0a0a0c] border border-[#d4af37]/10 hover:border-[#d4af37]/25 transition duration-300 relative overflow-hidden group select-none">
            <div className="absolute right-0 bottom-0 translate-y-2 translate-x-2 text-[#d4af37]/5 opacity-25 group-hover:opacity-40 transition-opacity">
              <Crown className="w-16 h-16" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-lg flex items-center justify-center font-extrabold text-[#d4af37] text-xs shadow-inner">
                AX
              </div>
              <div className="flex-1 min-w-0 text-start">
                <p className="text-xs font-black text-white group-hover:text-[#d4af37] transition duration-300">ALX HUB</p>
                <p className="text-[9px] text-[#d4af37]/80 font-bold">{isAr ? 'لوحة القيادة الذكية' : 'Smart System Hub'}</p>
              </div>
            </div>
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
              className="p-2.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-[#d4af37] transition-all bg-[#08080a] border border-slate-900 hover:border-[#d4af37]/20"
              title="Toggle Language"
            >
              <Languages className="w-4 h-4" />
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
                const isActive = location.pathname === item.path;
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
