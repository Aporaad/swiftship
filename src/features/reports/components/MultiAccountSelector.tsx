/**
 * @file MultiAccountSelector.tsx
 * @description مكوّن اختيار حسابات متعددة من شجرة الحسابات
 * Multi-account selector component with search and bulk selection support
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, Check, Save } from 'lucide-react';
import type { MultiAccountSelectorProps } from '../types/reports.types';

// ─── MultiAccountSelector Component ────────────────────────────────────────
const MultiAccountSelector: React.FC<MultiAccountSelectorProps> = ({
  selectedIds,
  setSelectedIds,
  labelAr,
  labelEn,
  accounts,
  isAr,
  onSave
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة عند النقر خارجها
  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // تصفية الحسابات حسب مصطلح البحث
  // Filter accounts by search query
  const filteredAccounts = accounts.filter(acc =>
    (acc.name || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (acc.accountCode || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (acc.entityName || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  // تبديل حالة اختيار حساب معين
  // Toggle selection state for a single account
  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // تحديد جميع الحسابات المصفاة
  // Select all filtered accounts
  const selectAll = () => {
    const allFilteredIds = filteredAccounts.map(a => a.id);
    setSelectedIds(prev => {
      const otherSelected = prev.filter(id => !allFilteredIds.includes(id));
      return [...otherSelected, ...allFilteredIds];
    });
  };

  // إلغاء تحديد جميع الحسابات المصفاة
  // Deselect all filtered accounts
  const deselectAll = () => {
    const allFilteredIds = filteredAccounts.map(a => a.id);
    setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
  };

  const selectedAccounts = accounts.filter(acc => selectedIds.includes(acc.id));

  return (
    <div className="relative" ref={containerRef}>
      <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1.5 tracking-wider">
        {isAr ? labelAr : labelEn}
      </span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-950 border rounded-2xl px-4 py-3 text-start flex justify-between items-center transition-all cursor-pointer shadow-inner relative focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20 ${isOpen ? 'border-[#d4af37] ring-2 ring-[#d4af37]/10' : 'border-slate-800 hover:border-slate-700'
          }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 overflow-hidden flex-1 select-none">
          {selectedAccounts.length === 0 ? (
            <span className="text-xs text-slate-500 font-bold italic">
              {isAr ? 'اضغط لتحديد الحسابات من الشجرة ماليًا...' : 'Click to select accounts...'}
            </span>
          ) : (
            <>
              <span className="bg-[#d4af37]/25 text-[#d4af37] text-[10px] px-2 py-0.5 rounded-full font-black font-mono shrink-0">
                {selectedAccounts.length}
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedAccounts.slice(0, 4).map(acc => (
                  <span key={acc.id} className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1">
                    {acc.entityName || acc.name}
                    <span className="text-slate-500 text-[8px] font-mono">[{acc.accountCode}]</span>
                  </span>
                ))}
                {selectedAccounts.length > 4 && (
                  <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded-lg text-[8.5px] font-black">
                    +{selectedAccounts.length - 4} {isAr ? 'حسابات إضافية' : 'others'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[#d4af37]' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-[100] left-0 right-0 mt-2 bg-slate-950/98 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-3.5 space-y-3"
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={isAr ? 'البحث باسم الحساب أو كود الدليل...' : 'Search by account name or code...'}
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-[11px] text-white outline-none focus:border-[#d4af37]/45 focus:bg-slate-900 transition-all font-bold placeholder:text-slate-550"
              />
            </div>

            <div className="flex justify-between items-center text-[10px] border-b border-slate-900 pb-2 px-1">
              <span className="text-slate-500 font-bold">
                {isAr ? `${filteredAccounts.length} حساب متاح` : `${filteredAccounts.length} accounts available`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[#d4af37] hover:text-[#e4cf67] font-black transition-colors"
                >
                  {isAr ? 'تحديد الكل' : 'Select All'}
                </button>
                <span className="text-slate-800">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-400 hover:text-slate-300 font-black transition-colors"
                >
                  {isAr ? 'إلغاء التحديد' : 'Clear All'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 max-h-[190px] overflow-y-auto pr-1">
              {filteredAccounts.map(acc => {
                const isSelected = selectedIds.includes(acc.id);
                return (
                  <div
                    key={acc.id}
                    onClick={() => toggleSelection(acc.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all select-none ${isSelected
                      ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/35'
                      : 'bg-slate-900/10 text-slate-400 border-transparent hover:bg-slate-900/40 hover:text-white'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-[#d4af37] border-[#d4af37] text-black animate-scale-in' : 'border-slate-800 bg-slate-950'
                      }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3.5]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{acc.entityName || acc.name}</span>
                        <span className="font-mono text-[9px] text-[#d4af37] shrink-0 font-black">[{acc.accountCode}]</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 mt-0.5 font-mono">
                        <span>{isAr ? 'الرصيد الحالي:' : 'Current Balance:'} {(acc.balance || 0).toLocaleString()} {acc.currency || 'SAR'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredAccounts.length === 0 && (
                <p className="text-[10px] text-slate-500 italic text-center py-4">{isAr ? 'لا توجد حسابات مطابقة للبحث' : 'No matching accounts found.'}</p>
              )}
            </div>

            {onSave && (
              <div className="pt-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    onSave();
                    setIsOpen(false);
                  }}
                  className="w-full bg-[#d4af37] hover:bg-[#c49f27] text-black text-[11px] font-black py-2 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group"
                >
                  <Save className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  {isAr ? 'حفظ التغييرات ومزامنة البيانات' : 'Save & Sync Changes'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiAccountSelector;
