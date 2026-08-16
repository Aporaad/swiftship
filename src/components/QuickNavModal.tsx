import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useRole } from '../hooks/useRole';
import { 
  X, 
  Search, 
  LayoutDashboard, 
  Package, 
  Users, 
  Truck, 
  Wallet, 
  FileText, 
  MapPin, 
  UserCog, 
  Bell, 
  Settings,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface QuickNavModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickNavModal({ isOpen, onClose }: QuickNavModalProps) {
  const { settings, t } = useSettings();
  const isAr = settings.language === 'ar';
  const navigate = useNavigate();
  const { hasPermission, loading: roleLoading } = useRole();
  const [queryText, setQueryText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Full master nav list with corresponding icon definitions
  const navItems = [
    { name: isAr ? 'الرئيسية' : 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'view_dashboard', desc: isAr ? 'ملخص عام وإحصائيات النظام' : 'Overall summary & key metrics' },
    { name: isAr ? 'الطلبات' : 'Orders', path: '/orders', icon: Package, permission: 'view_orders', desc: isAr ? 'إدارة الشحنات والطرود والطلبات' : 'Manage shipments, packages & orders' },
    { name: isAr ? 'التتبع' : 'Tracking', path: '/tracking', icon: Truck, permission: 'track_order', desc: isAr ? 'حالة الشحن والتتبع الدولي' : 'Real-time transit state tracking' },
    { name: isAr ? 'العملاء' : 'Customers', path: '/customers', icon: Users, permission: 'view_customers', desc: isAr ? 'دليل وأرصدة ومحافظ العملاء' : 'Customer registry, ledgers & wallets' },
    { name: isAr ? 'المناديب' : 'Couriers', path: '/couriers', icon: Truck, permission: 'view_couriers', desc: isAr ? 'مناديب التوصيل المحلي والعهد' : 'Local couriers & settlement logs' },
    { name: isAr ? 'المصروفات والعهد' : 'Expenses & Custody', path: '/expenses', icon: Wallet, permission: 'view_finance', desc: isAr ? 'إدارة الحسابات المالية والعهد والمصروفات' : 'Global finance ledger, expenses & custody' },
    { name: isAr ? 'المحاسبة' : 'Accounting', path: '/accounting', icon: FileText, permission: 'view_finance', desc: isAr ? 'إغلاق الحسابات ومطابقات القيود' : 'Account balancing & matching settlements' },
    { name: isAr ? 'المصادر' : 'Sources', path: '/sources', icon: MapPin, permission: 'view_sources', desc: isAr ? 'محطات ومصادر التوريد الخارجية' : 'External shipping pipelines & sources' },
    { name: isAr ? 'التقارير' : 'Reports', path: '/reports', icon: FileText, permission: 'view_reports', desc: isAr ? 'تقارير مالية وتحليلية شاملة' : 'Detailed analytics & financial reports' },
    { name: isAr ? 'المستخدمون والأدوار' : 'Users & Roles', path: '/user-management', icon: UserCog, permission: 'view_users', desc: isAr ? 'إدارة صلاحيات الموظفين وأدوارهم' : 'Control employee authorizations & duties' },
    { name: isAr ? 'الإشعارات' : 'Notifications', path: '/notifications', icon: Bell, permission: 'view_notifications', desc: isAr ? 'مركز التنبيهات وإيصالات الواتساب' : 'Notification log & WhatsApp dispatcher' },
    { name: isAr ? 'الإعدادات' : 'Settings', path: '/settings', icon: Settings, permission: 'settings', desc: isAr ? 'تخصيص النظام وبيانات الشركة والشعار' : 'Configure layout, logos & general settings' },
  ];

  // Filter based on user configuration & permissions
  const filteredNavItems = navItems.filter(item => {
    if (roleLoading) return false;
    if (item.path === '/expenses') {
      return hasPermission('view_finance') || hasPermission('view_expenses') || hasPermission('view_custody');
    }
    return hasPermission(item.permission);
  });

  // Filter based on search input
  const searchedItems = filteredNavItems.filter(item => {
    const term = queryText.toLowerCase().trim();
    if (!term) return true;
    return (
      item.name.toLowerCase().includes(term) ||
      item.desc.toLowerCase().includes(term) ||
      item.path.toLowerCase().includes(term)
    );
  });

  // Autofocus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQueryText('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle keyboard events inside the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % Math.max(1, searchedItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + searchedItems.length) % Math.max(1, searchedItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchedItems[activeIndex]) {
          triggerNavigation(searchedItems[activeIndex].path);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, searchedItems, activeIndex]);

  // Keep active item scrolled into view if needed
  const activeItemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  const triggerNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in text-start select-none"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b0b0d] border border-slate-800/80 rounded-3xl w-full max-w-xl h-auto max-h-[75vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] text-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="p-5 border-b border-[#d4af37]/10 flex justify-between items-center bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-xl text-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.05)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm tracking-wide">
                {isAr ? 'قائمة التنقل السريع ⚡' : 'Quick Navigation Menu ⚡'}
              </h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.12em] mt-0.5">
                {isAr ? 'انتقل إلى أي وحدة داخلية بسرعة فائقة' : 'Jump to any internal service instantly'}
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white bg-slate-900 border border-slate-800/60 p-2 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Search Input */}
        <div className="p-4 bg-black/20 border-b border-slate-800/60 flex items-center gap-3">
          <div className="relative flex-grow">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search className="w-4 h-4 text-[#d4af37]/80" />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                setActiveIndex(0);
              }}
              placeholder={isAr ? 'اكتب اسم الوجهة أو الوصف للتصفية...' : 'Type module name or route description...'}
              className="w-full bg-[#050506] border border-[#d4af37]/20 rounded-2xl pr-10 pl-5 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37] placeholder:text-slate-600 font-bold text-start"
              dir={isAr ? 'rtl' : 'ltr'}
            />
          </div>
        </div>

        {/* List of Navigation Modules */}
        <div className="flex-grow overflow-y-auto p-3 space-y-1.5 custom-scrollbar max-h-[45vh]">
          {searchedItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-bold text-xs select-none">
              {isAr ? 'لا توجد وجهة مطابقة لمدخلات البحث' : 'No matching modules found'}
            </div>
          ) : (
            searchedItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === activeIndex;
              return (
                <div
                  key={item.path}
                  ref={isSelected ? activeItemRef : null}
                  onClick={() => triggerNavigation(item.path)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full p-3 rounded-xl transition-all duration-200 text-start flex items-center justify-between gap-3 border cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#d4af37]/15 to-[#050507] border-[#d4af37] shadow-[inset_3px_0_10px_rgba(212,175,55,0.04)] text-white'
                      : 'bg-[#08080a] hover:bg-slate-900/40 border-slate-850 hover:border-slate-80s0'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-grow">
                    <div className={`p-2 rounded-lg shrink-0 transition-all ${
                      isSelected ? 'bg-[#d4af37]/25 border border-[#d4af37]/35 text-[#d4af37]' : 'bg-slate-950 border border-slate-900 text-slate-400'
                    }`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    
                    <div className="min-w-0 flex-grow">
                      <p className="text-xs font-black tracking-wide">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-550 mr-2 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900">
                      {item.path}
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isSelected ? 'text-[#d4af37] translate-x-0.5' : 'text-slate-600'
                    }`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Helper */}
        <div className="p-3 bg-[#050507] border-t border-slate-850 flex items-center justify-between text-[9px] text-slate-550 font-sans tracking-wide shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-1.5 py-0.5 rounded font-mono font-bold">
              ↑↓
            </span>
            <span>{isAr ? 'للاختيار والتنقل' : 'to select'}</span>
            <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-1.5 py-0.5 rounded font-mono font-bold">
              Enter
            </span>
            <span>{isAr ? 'للدخول المباشر' : 'to confirm'}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-1.5 py-0.5 rounded font-mono font-bold">
              Esc
            </span>
            <span>{isAr ? 'للإغلاق' : 'to close'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
