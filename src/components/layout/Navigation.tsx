import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  RotateCw,
  SlidersHorizontal,
  X
} from 'lucide-react';
import type { LayoutNavItem, LayoutNavOrderConfig } from './types';

type NavigationProps = {
  filteredNavItems: LayoutNavItem[];
  isSidebarCollapsed: boolean;
  isItemActive: (itemPath: string) => boolean;
};

export function Navigation({ filteredNavItems, isSidebarCollapsed, isItemActive }: NavigationProps) {
  return (
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-300 font-bold text-xs group relative ${isSidebarCollapsed ? 'justify-center' : 'text-right'
                    } ${isActive
                      ? 'bg-gradient-to-r from-[#d4af37]/15 to-transparent text-white border-l-2 border-[#d4af37] shadow-[inset_4px_0_15px_rgba(212,175,55,0.05)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                    }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-[#d4af37]' : 'text-slate-500 group-hover:text-[#d4af37]'}`} />
                  {!isSidebarCollapsed && <span className="flex-1">{item.name}</span>}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] shadow-[0_0_8px_#d4af37]"></span>
                  )}
                </Link>
              );
            })}
          </nav>
  );
}

type MobileNavigationProps = {
  isAr: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filteredNavItems: LayoutNavItem[];
  isItemActive: (itemPath: string) => boolean;
};

export function MobileNavigation({
  isAr,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  filteredNavItems,
  isItemActive
}: MobileNavigationProps) {
  if (!isMobileMenuOpen) return null;

  return (
    <>
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
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-xs ${isActive
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
    </>
  );
}

type NavigationCustomizerProps = {
  isAr: boolean;
  isNavCustomizerOpen: boolean;
  setIsNavCustomizerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showSystemStatus: boolean;
  toggleSystemStatusVisibility: () => void;
  navOrderConfig: LayoutNavOrderConfig[];
  baseNavItems: LayoutNavItem[];
  moveNavItemUp: (index: number) => void;
  moveNavItemDown: (index: number) => void;
  toggleNavItemVisibility: (path: string) => void;
  resetNavOrderConfig: () => void;
};

export function NavigationCustomizer({
  isAr,
  isNavCustomizerOpen,
  setIsNavCustomizerOpen,
  showSystemStatus,
  toggleSystemStatusVisibility,
  navOrderConfig,
  baseNavItems,
  moveNavItemUp,
  moveNavItemDown,
  toggleNavItemVisibility,
  resetNavOrderConfig
}: NavigationCustomizerProps) {
  if (!isNavCustomizerOpen) return null;

  return (
    <>
        {/* Sidebar Navigation Customizer Modal */}
        {isNavCustomizerOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-start animate-fade-in">
            <div className="bg-[#121215] border border-[#d4af37]/30 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-[#d4af37]" />
                  <h3 className="font-black text-white text-sm">
                    {isAr ? 'تخصيص اللوحة الجانبية وترتيب الصفحات' : 'Customize Sidebar Links & Order'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsNavCustomizerOpen(false)}
                  className="p-1.5 bg-slate-900 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-2 flex-1 text-xs">
                <p className="text-slate-400 font-bold text-[11px] mb-3">
                  {isAr ? 'يمكنك تقديم أو تأخير ترتيب الصفحات أو إخفاء الصفحات وإظهار/إخفاء شريط حالة النظام:' : 'Reorder or hide navigation pages and toggle system status bar:'}
                </p>

                {/* System Status Control Toggle Switch */}
                <div className="p-3 bg-gradient-to-r from-[#d4af37]/10 via-black/40 to-black/40 border border-[#d4af37]/30 rounded-2xl flex items-center justify-between gap-3 mb-3 hover:border-[#d4af37]/50 transition shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-xs block">{isAr ? 'شريط حالة النظام المباشرة' : 'Live System Status Bar'}</span>
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'إظهار أو إخفاء بطاقة ومؤشرات حالة النظام بالشريط الجانبي' : 'Toggle live system status indicator in sidebar'}</span>
                    </div>
                  </div>

                  <button
                    onClick={toggleSystemStatusVisibility}
                    className={`px-3 py-1.5 border rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${showSystemStatus
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                      }`}
                    title={showSystemStatus ? (isAr ? 'إخفاء شريط حالة النظام' : 'Hide System Status') : (isAr ? 'إظهار شريط حالة النظام' : 'Show System Status')}
                  >
                    {showSystemStatus ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{showSystemStatus ? (isAr ? 'ظاهر' : 'Visible') : (isAr ? 'مخفي' : 'Hidden')}</span>
                  </button>
                </div>

                {navOrderConfig.map((conf, index) => {
                  const itemDef = baseNavItems.find(b => b.path === conf.path);
                  if (!itemDef) return null;
                  const Icon = itemDef.icon;

                  return (
                    <div key={conf.path} className="p-3 bg-black/40 border border-slate-850 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-800 transition">
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-[#d4af37]" />
                        <span className="font-bold text-white text-xs">{itemDef.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => moveNavItemUp(index)}
                          disabled={index === 0}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-30 cursor-pointer"
                          title={isAr ? 'تقديم لأعلى' : 'Move Up'}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => moveNavItemDown(index)}
                          disabled={index === navOrderConfig.length - 1}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-30 cursor-pointer"
                          title={isAr ? 'تأخير لأسفل' : 'Move Down'}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => toggleNavItemVisibility(conf.path)}
                          className={`p-1.5 border rounded-lg transition cursor-pointer ${conf.visible !== false
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-900 border-slate-800 text-slate-600'
                            }`}
                          title={conf.visible !== false ? (isAr ? 'إخفاء الصفحات' : 'Hide Page') : (isAr ? 'إظهار الصفحات' : 'Show Page')}
                        >
                          {conf.visible !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-slate-850 bg-[#07070a] flex justify-between items-center">
                <button
                  onClick={resetNavOrderConfig}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  {isAr ? 'إعادة الترتيب الافتراضي' : 'Reset Defaults'}
                </button>

                <button
                  onClick={() => setIsNavCustomizerOpen(false)}
                  className="px-5 py-2 bg-[#d4af37] text-black font-black rounded-xl text-xs shadow hover:bg-yellow-500 transition cursor-pointer"
                >
                  {isAr ? 'حفظ وإغلاق' : 'Save & Close'}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default Navigation;
