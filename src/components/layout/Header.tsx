import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Command,
  Globe,
  HelpCircle,
  Menu,
  RotateCw,
  Search
} from 'lucide-react';
import type { LayoutNavItem } from './types';

type HeaderProps = {
  isAr: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeItem?: LayoutNavItem;
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
  handleGlobalSearchKeyPress: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  formattedTime: string;
  formattedDate: string;
  setIsQuickNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleLanguage: () => void;
  unreadCount: number;
  setIsPortalApprovalsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pendingPortalCount: number;
  setIsJobApplicationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pendingJobsCount: number;
  setIsSystemDevModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Header({
  isAr,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  activeItem,
  searchText,
  setSearchText,
  handleGlobalSearchKeyPress,
  setIsSearchOpen,
  formattedTime,
  formattedDate,
  setIsQuickNavOpen,
  toggleLanguage,
  unreadCount,
  setIsPortalApprovalsOpen,
  pendingPortalCount,
  setIsJobApplicationsOpen,
  pendingJobsCount,
  setIsSystemDevModalOpen
}: HeaderProps) {
  return (
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
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 select-none">
                <kbd className="bg-slate-900 border border-slate-800 text-[10px] text-[#d4af37]/80 px-2 py-0.5 rounded-md font-mono select-none pointer-events-none">
                  Ctrl + K
                </kbd>
                {searchText.trim() && (
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-3 py-1 text-[9px] font-black rounded-lg transition-all shadow-md select-all cursor-pointer pointer-events-auto"
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

              {/* Quick Navigation Command Button (Ctrl+T) */}
              <button
                onClick={() => setIsQuickNavOpen(true)}
                className="p-2.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-[#d4af37] transition-all bg-[#08080a] border border-slate-900 hover:border-[#d4af37]/20 flex items-center justify-center cursor-pointer relative group"
                title={isAr ? "التنقل السريع (Ctrl+T)" : "Quick Navigation Command (Ctrl+T)"}
              >
                <Command className="w-4 h-4 text-[#d4af37]" />
                <span className="absolute -bottom-8 right-1/2 translate-x-1/2 bg-black border border-slate-800 text-[9px] text-slate-400 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-250 pointer-events-none whitespace-nowrap font-mono">
                  {isAr ? "Ctrl + T للتنقل" : "Ctrl + T to Nav"}
                </span>
              </button>

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

              {/* Web Portal Registration Approvals Button */}
              <button
                onClick={() => setIsPortalApprovalsOpen(true)}
                className="p-2.5 rounded-xl hover:bg-amber-950/40 relative text-amber-400 transition-all bg-[#08080a] border border-amber-500/20 hover:border-amber-500/40 cursor-pointer"
                title={isAr ? "طلبات البوابة المعلقة" : "Pending Web Portal Approvals"}
              >
                <Globe className="w-4 h-4" />
                {pendingPortalCount > 0 && (
                  <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/40 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[8px] font-black text-black items-center justify-center">
                      {pendingPortalCount}
                    </span>
                  </span>
                )}
              </button>

              {/* Job Applications Reception Button */}
              <button
                onClick={() => setIsJobApplicationsOpen(true)}
                className="p-2.5 rounded-xl hover:bg-amber-950/40 relative text-amber-400 transition-all bg-[#08080a] border border-amber-500/20 hover:border-amber-500/40 cursor-pointer"
                title={isAr ? "استقبال طلبات التوظيف (jobs_req)" : "Job Applications (jobs_req)"}
              >
                <Briefcase className="w-4 h-4 text-amber-400" />
                {pendingJobsCount > 0 && (
                  <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/40 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[8px] font-black text-black items-center justify-center">
                      {pendingJobsCount}
                    </span>
                  </span>
                )}
              </button>

              {/* Quick Refresh Icon */}
              <button
                onClick={() => window.location.reload()}
                className="p-2.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-emerald-400 transition-all bg-[#08080a] border border-slate-900 hover:border-emerald-500/10"
                title="Sync Ledger Modules"
              >
                <RotateCw className="w-4 h-4 animate-hover" />
              </button>

              {/* System Info & Programmer Contact Button (?) */}
              <button
                onClick={() => setIsSystemDevModalOpen(true)}
                className="p-2.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-[#d4af37] transition-all bg-[#08080a] border border-slate-900 hover:border-[#d4af37]/20 flex items-center justify-center cursor-pointer relative group"
                title={isAr ? "معلومات النظام والمبرمج" : "System & Developer Bio"}
              >
                <HelpCircle className="w-4 h-4 text-[#d4af37]" />
                <span className="absolute -bottom-8 right-1/2 translate-x-1/2 bg-black border border-slate-800 text-[9px] text-slate-400 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-250 pointer-events-none whitespace-nowrap z-30">
                  {isAr ? "معلومات النظام" : "System & Dev Info"}
                </span>
              </button>
            </div>
          </header>
  );
}
