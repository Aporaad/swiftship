/**
 * AccountPickerModal
 * نافذة منبثقة للبحث عن الحسابات المالية واختيارها
 * تُستبدل بها حقل select التقليدي في جميع نماذج القيود والسندات
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Building2, ChevronLeft } from 'lucide-react';
import type { FinanceAccount } from './EntryForm';

interface AccountPickerModalProps {
  /** قائمة الحسابات المتاحة للاختيار */
  accounts: FinanceAccount[];
  /** الحساب المختار حالياً */
  selectedAccountId: string;
  /** عنوان الحقل (مثال: "حساب الطرف الآخر") */
  label?: string;
  /** نص الزر الافتراضي عند عدم وجود اختيار */
  placeholder?: string;
  /** هل الحقل معطّل؟ */
  disabled?: boolean;
  /** دالة تُستدعى عند اختيار حساب */
  onSelect: (accountId: string) => void;
}

export default function AccountPickerModal({
  accounts,
  selectedAccountId,
  label,
  placeholder = 'اختر حساباً…',
  disabled = false,
  onSelect,
}: AccountPickerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  /** الحساب المختار حالياً */
  const selectedAccount = useMemo(
    () => accounts.find((acc) => acc.id === selectedAccountId),
    [accounts, selectedAccountId],
  );

  /** فلترة الحسابات بحسب نص البحث (اسم أو كود) */
  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter(
      (acc) =>
        acc.id.toLowerCase().includes(query) ||
        acc.nameAr.toLowerCase().includes(query) ||
        (acc.nameEn || '').toLowerCase().includes(query),
    );
  }, [accounts, searchQuery]);

  /** تركيز حقل البحث عند فتح النافذة */
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
      setSearchQuery('');
    }
  }, [isOpen]);

  /** إغلاق النافذة عند الضغط على Escape */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleSelect = (accountId: string) => {
    onSelect(accountId);
    setIsOpen(false);
  };

  return (
    <>
      {/* زر فتح منتقي الحساب */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={`mt-1 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-right text-xs font-bold transition shadow-sm
          ${disabled
            ? 'cursor-not-allowed border-slate-800 bg-slate-900/50 opacity-60'
            : 'border-slate-700 bg-slate-950 hover:border-cyan-500/60 hover:bg-slate-900 focus:border-cyan-500'
          }
          ${selectedAccountId ? 'text-slate-100' : 'text-slate-500'}`}
        aria-label={label || 'اختيار حساب مالي'}
      >
        <span className="flex-1 truncate text-right">
          {selectedAccount
            ? `${selectedAccount.id} — ${selectedAccount.nameAr}`
            : placeholder}
        </span>
        {selectedAccount && (
          <span className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black font-mono bg-slate-800 border border-slate-700 text-cyan-300">
            {selectedAccount.currencyCode}
          </span>
        )}
        <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {/* نافذة البحث المنبثقة */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="اختيار حساب مالي"
        >
          {/* خلفية شفافة معتمة */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* محتوى النافذة */}
          <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl" dir="rtl">
            {/* رأس النافذة */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-cyan-400" />
                <h3 className="font-black text-white">
                  {label || 'اختيار الحساب المالي'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* حقل البحث */}
            <div className="border-b border-slate-800 p-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الكود…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* قائمة الحسابات */}
            <div className="max-h-72 overflow-y-auto">
              {filteredAccounts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  لا توجد نتائج للبحث عن «{searchQuery}»
                </p>
              ) : (
                <ul className="divide-y divide-slate-800/60">
                  {filteredAccounts.map((acc) => (
                    <li key={acc.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(acc.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-right transition hover:bg-slate-800/70
                          ${acc.id === selectedAccountId ? 'bg-cyan-500/10' : ''}`}
                      >
                        {/* كود الحساب */}
                        <code className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold font-mono
                          ${acc.id === selectedAccountId
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-slate-800 text-slate-400'}`}>
                          {acc.id}
                        </code>

                        {/* اسم الحساب */}
                        <span className={`flex-1 text-sm font-bold truncate
                          ${acc.id === selectedAccountId ? 'text-cyan-100' : 'text-slate-200'}`}>
                          {acc.nameAr}
                        </span>

                        {/* رمز العملة */}
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-800 text-amber-300">
                          {acc.currencyCode}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* تذييل - عدد النتائج */}
            <div className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
              {filteredAccounts.length} حساب
              {searchQuery ? ` من أصل ${accounts.length}` : ''}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
