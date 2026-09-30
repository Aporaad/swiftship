import React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import Navigation from './Navigation';
import type { LayoutNavItem, LayoutSystemStats } from './types';

type SidebarSettings = {
  systemLogo?: string | null;
  systemName?: string | null;
  companyName?: string | null;
};

type SidebarProfile = {
  fullName?: string | null;
};

type SidebarProps = {
  isAr: boolean;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setIsNavCustomizerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settings: SidebarSettings;
  filteredNavItems: LayoutNavItem[];
  isItemActive: (itemPath: string) => boolean;
  showSystemStatus: boolean;
  isStatusExpanded: boolean;
  setIsStatusExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  systemStats: LayoutSystemStats;
  profile?: SidebarProfile | null;
  handleLogout: () => void | Promise<void>;
  t: (key: 'logout') => string;
};

export default function Sidebar({
  isAr,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  setIsNavCustomizerOpen,
  settings,
  filteredNavItems,
  isItemActive,
  showSystemStatus,
  isStatusExpanded,
  setIsStatusExpanded,
  systemStats,
  profile,
  handleLogout,
  t
}: SidebarProps) {
  return (
        <aside className={`bg-luxury-black border-r border-[#d4af37]/15 flex flex-col shrink-0 hidden md:flex relative z-20 backdrop-blur-md transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72'
          }`}>

          {/* Dynamic Logo & System Name Block + Collapse Toggle */}
          <div className="p-4 pb-4 flex flex-col items-center justify-center border-b border-[#d4af37]/10 relative">
            <div className="flex items-center justify-between w-full mb-1">
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                  {isAr ? 'اللوحة الجانبية' : 'Sidebar Navigation'}
                </span>
              )}
              <div className="flex items-center gap-1.5 ms-auto">
                {/* Small Customize Icon Button */}
                {!isSidebarCollapsed && (
                  <button
                    onClick={() => setIsNavCustomizerOpen(true)}
                    className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-500 hover:text-[#d4af37] transition cursor-pointer"
                    title={isAr ? 'تخصيص ترتيب الصفحات' : 'Customize Navigation Order'}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Collapse/Expand Toggle */}
                <button
                  onClick={() => {
                    const next = !isSidebarCollapsed;
                    setIsSidebarCollapsed(next);
                    localStorage.setItem('swiftship_sidebar_collapsed', String(next));
                  }}
                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-[#d4af37] transition cursor-pointer"
                  title={isSidebarCollapsed ? (isAr ? 'توسيع اللوحة الجانبية' : 'Expand Sidebar') : (isAr ? 'طي اللوحة الجانبية' : 'Collapse Sidebar')}
                >
                  {isSidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isSidebarCollapsed && (
              <div className="text-center mt-2">
                <div className="relative group cursor-pointer mb-2 inline-block">
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
                      <circle cx="50" cy="5" r="2.5" fill="currentColor" />
                    </svg>
                  )}
                </div>

                <h1 className="text-lg font-extrabold tracking-[0.1em] text-[#d4af37] uppercase text-center mt-1 luxury-glow-neon select-none">
                  {settings.systemName || settings.companyName || 'alx'}
                </h1>
                <p className="text-[9px] font-black tracking-[0.3em] text-slate-500 uppercase mt-0.5 select-none">
                  {isAr ? 'نظام إدارة اللوجستية' : 'Logistics & ERP'}
                </p>
              </div>
            )}
          </div>

          <Navigation
            filteredNavItems={filteredNavItems}
            isSidebarCollapsed={isSidebarCollapsed}
            isItemActive={isItemActive}
          />


          {/* Bottom Status Panel */}
          <div className="p-3 border-t border-[#d4af37]/10 space-y-3 bg-[#08080a]">
            {/* 🟢 ALX SYSTEM STATUS CARD - Controlled by showSystemStatus & Responsive to Collapse */}
            {showSystemStatus && (
              isSidebarCollapsed ? (
                /* Collapsed View: Pulsing Status Light Icon Only */
                <div className="flex justify-center items-center py-1">
                  <button
                    onClick={() => setIsStatusExpanded(prev => !prev)}
                    title={isAr
                      ? `حالة النظام: ${systemStats.systemStatus === 'good' ? 'يعمل بكفاءة' : systemStats.systemStatus === 'warning' ? 'يحتاج متابعة' : 'تأخير بالمهام'}`
                      : `System Status: ${systemStats.systemStatus}`
                    }
                    className={`p-3 rounded-2xl border transition-all cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center ${systemStats.systemStatus === 'good'
                      ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : systemStats.systemStatus === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                      }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full inline-block animate-pulse shrink-0 ${systemStats.systemStatus === 'good'
                      ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]'
                      : systemStats.systemStatus === 'warning'
                        ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                        : 'bg-rose-400 shadow-[0_0_10px_#ef4444]'
                      }`} />
                  </button>
                </div>
              ) : (
                /* Expanded View: Full Status Card */
                <div
                  onClick={() => setIsStatusExpanded(!isStatusExpanded)}
                  className={`p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-[#0a0a0d] to-[#0c0c10] border transition-all duration-300 relative overflow-hidden select-none text-start cursor-pointer active:scale-[0.98] ${systemStats.systemStatus === 'good'
                    ? 'border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:border-emerald-500/40'
                    : systemStats.systemStatus === 'warning'
                      ? 'border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)] hover:border-amber-500/40'
                      : 'border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:border-rose-500/40'
                    }`}
                >
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${systemStats.systemStatus === 'good'
                        ? 'text-emerald-400'
                        : systemStats.systemStatus === 'warning'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full inline-block animate-pulse shrink-0 ${systemStats.systemStatus === 'good'
                          ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                          : systemStats.systemStatus === 'warning'
                            ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                            : 'bg-rose-400 shadow-[0_0_8px_#ef4444]'
                          }`}></span>
                        🟢 ALX SYSTEM STATUS
                      </span>
                      {/*<span className="text-[9px] text-[#d4af37] font-bold block mt-0.5">
                        {isAr ? 'حالة النظام المباشرة' : 'Live System Status'}
                      </span>*/}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isStatusExpanded ? 'rotate-180 text-[#d4af37]' : ''}`} />
                  </div>

                  {/* Quick Summary Badge for compact view 
              {!isStatusExpanded && (
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500 font-bold bg-black/30 px-2 py-1 rounded-lg border border-white/[0.01]">
                  <span>{isAr ? 'الحالة العامة:' : 'System overall:'}</span>
                  <span className={`font-black uppercase ${systemStats.systemStatus === 'good'
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
              )}*/}

                  {/* Metrics List displayed only when expanded */}
                  {isStatusExpanded && (
                    <div className="space-y-1 text-[10px] font-bold text-slate-400 mt-2.5 border-t border-white/[0.04] pt-2.5 animate-fade-in">
                      <div className="flex justify-between items-center bg-black/40 p-1.5 rounded-lg border border-white/[0.02]">
                        <span className="text-slate-500 text-[9px]">{isAr ? 'حالة النظام ورسوخ العمل' : 'Status'}</span>
                        <span className={`font-black tracking-tight text-[9px] ${systemStats.systemStatus === 'good'
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
              )
            )}

            {/* 2️⃣ Admin/Manager Privileges Card - Responsive to Sidebar Collapse */}
            {isSidebarCollapsed ? (
              /* Collapsed View: Account Icon & Logout Button */
              <div className="flex flex-col items-center justify-center py-1 gap-2">
                <div
                  className="relative cursor-pointer group"
                  title={`${profile?.fullName || (isAr ? 'مدير النظام' : 'Admin User')} (${isAr ? 'صلاحيات كاملة' : 'Full Admin'})`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#d4af37] to-amber-700 p-[1px] shadow-[0_0_10px_rgba(212,175,55,0.15)] group-hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full bg-[#050505] flex items-center justify-center font-black text-[11px] text-[#d4af37] uppercase">
                      {profile?.fullName?.charAt(0) || 'SU'}
                    </div>
                  </div>
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-[#d4af37] to-yellow-600 text-black p-0.5 rounded-full select-none shadow-sm shadow-yellow-950" title="Full Superuser Rights">
                    <Crown className="w-2.5 h-2.5" />
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded-xl hover:bg-red-950/20 transition-all cursor-pointer"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Expanded View: Full Account Card */
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
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/20 transition-all cursor-pointer"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>
  );
}
