import React from 'react';
import { RefreshCw, Scale, X } from 'lucide-react';
import { financialAccountService } from '../../services/financialAccountService';

type AdjustmentData = {
  type: string;
  amount: string;
  currency: string;
  title: string;
  recipientName: string;
  notes: string;
};

interface ManualJournalAdjustmentModalProps {
  activeCurrencies: any[];
  adjustData: AdjustmentData;
  adjustLoading: boolean;
  adjustSalaryMonth: string;
  financialAccounts: any[];
  handleAddAdjustment: (event: React.FormEvent) => Promise<void>;
  isAdjustmentModalOpen: boolean;
  isAr: boolean;
  isSalaryPayment: boolean;
  isSourceDropdownOpen: boolean;
  isTargetDropdownOpen: boolean;
  postingFinancialAccounts: any[];
  setAdjustData: React.Dispatch<React.SetStateAction<AdjustmentData>>;
  setAdjustSalaryMonth: React.Dispatch<React.SetStateAction<string>>;
  setIsAdjustmentModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSalaryPayment: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSourceDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTargetDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSourceAccountId: React.Dispatch<React.SetStateAction<string>>;
  setSourceSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setTargetAccountId: React.Dispatch<React.SetStateAction<string>>;
  setTargetSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setTargetType: React.Dispatch<React.SetStateAction<string>>;
  settings: any;
  sourceAccountId: string;
  sourceSearchQuery: string;
  targetAccountId: string;
  targetSearchQuery: string;
  targetType: string;
}

export default function ManualJournalAdjustmentModal({
  activeCurrencies,
  adjustData,
  adjustLoading,
  adjustSalaryMonth,
  financialAccounts,
  handleAddAdjustment,
  isAdjustmentModalOpen,
  isAr,
  isSalaryPayment,
  isSourceDropdownOpen,
  isTargetDropdownOpen,
  postingFinancialAccounts,
  setAdjustData,
  setAdjustSalaryMonth,
  setIsAdjustmentModalOpen,
  setIsSalaryPayment,
  setIsSourceDropdownOpen,
  setIsTargetDropdownOpen,
  setSourceAccountId,
  setSourceSearchQuery,
  setTargetAccountId,
  setTargetSearchQuery,
  setTargetType,
  settings,
  sourceAccountId,
  sourceSearchQuery,
  targetAccountId,
  targetSearchQuery,
  targetType,
}: ManualJournalAdjustmentModalProps) {
  return (
    <>
      {/* MODAL 1: PRECISE MANUAL JOURNAL ENTRY ADJUSTMENT ADJUSTMENT */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start">
          <form onSubmit={handleAddAdjustment} className="bg-[#121215] border border-slate-850 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Scale className="w-4 h-4 text-[#d4af37]" />
                  {isAr ? 'تسجيل إقرار مالي وقيد تسوية خزينة' : 'Add Ledger Journal Adjustment Voucher'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  {isAr ? 'لتسوية أرصدة العملات أو عوائد غير تشغيلية.' : 'Manually adjust cash balance for capital assets or currency offsets.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* SOURCE/CREDIT ACCOUNT SELECTOR */}
              <div className="relative">
                <label className="block text-[9.5px] font-black text-rose-400 mb-1.5 uppercase">
                  {isAr ? 'حساب المصدر (الدائن)  *' : 'Source Account (Credit - From) *'}
                </label>

                {/* Account Selection Trigger */}
                <div
                  onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer flex justify-between items-center"
                >
                  <span className="truncate">
                    {sourceAccountId ? (
                      (() => {
                        const acc = postingFinancialAccounts.find(a => a.id === sourceAccountId || a.entityId === sourceAccountId);
                        if (!acc) return isAr ? '-- اختر حساب المصدر (الدائن) --' : '-- Choose Source Account --';
                        return `[${acc.code || acc.accountCode || 'Sys'}] - ${isAr ? acc.nameAr || acc.entityName : acc.nameEn || acc.entityName} ${acc.balance !== undefined ? `(${acc.balance.toLocaleString()} ${acc.currency || 'YER'})` : ''}`;
                      })()
                    ) : (
                      <span className="text-slate-500">{isAr ? '-- اختر حساب المصدر (الدائن) --' : '-- Choose Source Account --'}</span>
                    )}
                  </span>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform ${isSourceDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>

                {/* Custom Dropdown Content */}
                {isSourceDropdownOpen && (
                  <div className="absolute z-55 mt-2 w-full bg-[#121215] border border-slate-850 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-64">
                    {/* Account Search Input */}
                    <div className="p-2 border-b border-slate-850 bg-black/40 sticky top-0">
                      <input
                        type="text"
                        placeholder={isAr ? "🔎 ابحث بالاسم أو الكود..." : "🔎 Search by name or code..."}
                        value={sourceSearchQuery}
                        onChange={(e) => setSourceSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-black/50 border border-slate-800 text-white rounded-lg p-2 outline-none text-xs font-bold focus:border-[#d4af37]/50"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto p-1 custom-scrollbar">
                      {(() => {
                        const filteredAccounts = postingFinancialAccounts.filter(acc => {
                          const q = sourceSearchQuery.toLowerCase().trim();
                          if (!q) return true;
                          return (
                            (acc.accountCode && String(acc.accountCode).toLowerCase().includes(q)) ||
                            (acc.code && String(acc.code).toLowerCase().includes(q)) ||
                            (acc.nameAr && String(acc.nameAr).toLowerCase().includes(q)) ||
                            (acc.nameEn && String(acc.nameEn).toLowerCase().includes(q)) ||
                            (acc.entityName && String(acc.entityName).toLowerCase().includes(q))
                          );
                        });

                        const grouped: Record<string, any[]> = {};
                        filteredAccounts.forEach(acc => {
                          const type = acc.type || 'Other';
                          const entityType = acc.entityType || 'system';
                          let groupKey = type;
                          if (entityType === 'customer') groupKey = isAr ? 'العملاء (Customer)' : 'Customer';
                          else if (entityType === 'courier') groupKey = isAr ? 'المناديب (Courier)' : 'Courier';
                          else if (entityType === 'employee') groupKey = isAr ? 'الموظفين (Employee)' : 'Employee';
                          if (!grouped[groupKey]) grouped[groupKey] = [];
                          grouped[groupKey].push(acc);
                        });

                        return Object.entries(grouped).map(([type, accs]) => (
                          <div key={type} className="mb-2">
                            <span className="text-[10px] font-black text-slate-400 px-2 py-1 uppercase">{type}</span>
                            {accs.map(a => (
                              <div
                                key={a.id}
                                onClick={() => {
                                  setSourceAccountId(a.id);
                                  setIsSourceDropdownOpen(false);
                                  setSourceSearchQuery('');
                                }}
                                className={`px-2 py-1.5 hover:bg-white/5 cursor-pointer rounded-lg flex justify-between items-center ${sourceAccountId === a.id ? 'bg-[#d4af37]/15 text-[#d4af37]' : ''}`}
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-200">
                                    {isAr ? a.nameAr || a.entityName : a.nameEn || a.entityName}
                                  </span>
                                  <span className="font-mono text-[9px] text-slate-500">{a.accountCode || a.code || 'Sys'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* TARGET/DEBIT ACCOUNT SELECTOR */}
              <div className="relative">
                <label className="block text-[9.5px] font-black text-emerald-400 mb-1.5 uppercase">
                  {isAr ? 'الحساب المستهدف (المدين) *' : 'Target Account (Debit - To) *'}
                </label>

                {/* Account Selection Trigger */}
                <div
                  onClick={() => setIsTargetDropdownOpen(!isTargetDropdownOpen)}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer flex justify-between items-center"
                >
                  <span className="truncate">
                    {targetAccountId ? (
                      (() => {
                        const acc = postingFinancialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);
                        if (!acc) return isAr ? '-- اختر الحساب المستهدف --' : '-- Choose Target Account --';
                        return `[${acc.code || acc.accountCode || 'Sys'}] - ${isAr ? acc.nameAr || acc.entityName : acc.nameEn || acc.entityName} ${acc.balance !== undefined ? `(${acc.balance.toLocaleString()} ${acc.currency || 'YER'})` : ''}`;
                      })()
                    ) : (
                      <span className="text-slate-500">{isAr ? '-- اختر الحساب المستهدف (المدين) --' : '-- Choose Target Account --'}</span>
                    )}
                  </span>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform ${isTargetDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>

                {/* Custom Dropdown Content */}
                {isTargetDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-[#121215] border border-slate-850 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-64">
                    {/* Account Search Input */}
                    <div className="p-2 border-b border-slate-850 bg-black/40 sticky top-0">
                      <input
                        type="text"
                        placeholder={isAr ? "🔎 ابحث بالاسم أو الكود..." : "🔎 Search by name or code..."}
                        value={targetSearchQuery}
                        onChange={(e) => setTargetSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-black/50 border border-slate-800 text-white rounded-lg p-2 outline-none text-xs font-bold focus:border-[#d4af37]/50"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto p-1 custom-scrollbar">
                      {(() => {
                        const filteredAccounts = postingFinancialAccounts.filter(acc => {
                          const q = targetSearchQuery.toLowerCase().trim();
                          if (!q) return true;
                          return (
                            (acc.accountCode && String(acc.accountCode).toLowerCase().includes(q)) ||
                            (acc.code && String(acc.code).toLowerCase().includes(q)) ||
                            (acc.nameAr && String(acc.nameAr).toLowerCase().includes(q)) ||
                            (acc.nameEn && String(acc.nameEn).toLowerCase().includes(q)) ||
                            (acc.entityName && String(acc.entityName).toLowerCase().includes(q))
                          );
                        });

                        const grouped: Record<string, any[]> = {};
                        filteredAccounts.forEach(acc => {
                          const type = acc.type || 'Other';
                          const entityType = acc.entityType || 'system';
                          let groupKey = type;
                          if (entityType === 'customer') groupKey = 'Customer (عملاء)';
                          else if (entityType === 'courier') groupKey = 'Courier (مناديب)';
                          else if (entityType === 'employee') groupKey = 'Employee (موظفين)';
                          if (!grouped[groupKey]) grouped[groupKey] = [];
                          grouped[groupKey].push(acc);
                        });

                        if (Object.keys(grouped).length === 0) {
                          return <div className="p-4 text-center text-slate-500 text-xs font-bold">{isAr ? 'لا توجد نتائج' : 'No results found'}</div>;
                        }

                        return Object.entries(grouped).map(([type, accs]) => {
                          let iconColor = 'text-slate-400 font-black';
                          let iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>;

                          if (type.includes('Asset')) {
                            iconColor = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
                          } else if (type.includes('Liability')) {
                            iconColor = 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                          } else if (type.includes('Equity')) {
                            iconColor = 'text-purple-400 bg-purple-500/10 border border-purple-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>;
                          } else if (type.includes('Revenue')) {
                            iconColor = 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
                          } else if (type.includes('Expense')) {
                            iconColor = 'text-orange-400 bg-orange-500/10 border border-orange-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>;
                          }

                          let label = type === 'Asset' ? (isAr ? 'أصول (Asset)' : 'Asset') :
                            type === 'Liability' ? (isAr ? 'خصوم (Liability)' : 'Liability') :
                              type === 'Equity' ? (isAr ? 'حقوق ملكية (Equity)' : 'Equity') :
                                type === 'Revenue' ? (isAr ? 'إيرادات (Revenue)' : 'Revenue') :
                                  type === 'Expense' ? (isAr ? 'مصروفات (Expense)' : 'Expense') : type;

                          return (
                            <div key={type} className="mb-2">
                              <div className="px-2 py-1.5 flex items-center gap-1.5">
                                <div className={`p-1 rounded-md ${iconColor}`}>
                                  {iconSvg}
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
                              </div>
                              {accs.sort((a, b) => (a.code || a.accountCode || '').localeCompare(b.code || b.accountCode || '')).map(a => (
                                <div
                                  key={a.id}
                                  onClick={() => {
                                    setTargetAccountId(a.id);
                                    setTargetType(a.entityType || 'system');
                                    setAdjustData(prev => ({
                                      ...prev,
                                      recipientName: a.nameAr || a.entityName || ''
                                    }));
                                    setIsTargetDropdownOpen(false);
                                    setTargetSearchQuery('');
                                  }}
                                  className={`px-3 py-2.5 mx-1 mb-0.5 mt-0 hover:bg-white/5 cursor-pointer rounded-lg flex justify-between items-center transition-colors ${targetAccountId === a.id ? 'bg-[#d4af37]/10 border border-[#d4af37]/30' : ''}`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`text-xs font-bold ${targetAccountId === a.id ? 'text-[#d4af37]' : 'text-slate-200'}`}>
                                      {isAr ? a.nameAr || a.entityName : a.nameEn || a.entityName}
                                    </span>
                                    <span className="font-mono text-[9px] text-slate-500">{a.code || a.accountCode || 'Sys'}</span>
                                  </div>
                                  {a.balance !== undefined && (
                                    <span className="font-mono text-[10px] font-black tracking-tighter text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-slate-800">
                                      {a.balance.toLocaleString()} {a.currency || 'YER'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {targetAccountId && (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {(() => {
                      const targetAcc = financialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);
                      const adjustAmt = parseFloat(adjustData.amount) || 0;
                      if (targetAcc && typeof targetAcc.balance === 'number' && adjustAmt > 0) {
                        // Convert transaction amount to account currency
                        const convertedAdjustAmt = financialAccountService.convertToTargetCurrency(
                          adjustAmt,
                          adjustData.currency,
                          targetAcc.currency || settings.currency || 'SAR',
                          { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
                        );

                        // Target Account is being DEBITED
                        const firstChar = (targetAcc.accountCode || targetAcc.code || '1').trim().toUpperCase();
                        const isCreditNormal = firstChar.startsWith('2') || firstChar.startsWith('3') || firstChar.startsWith('4') || firstChar.startsWith('REV') || firstChar.startsWith('LIAB') || firstChar.startsWith('EQU');

                        // If it's a Credit-Normal account (Liability/Equity/Revenue), Debiting reduces balance
                        // Add a small epsilon (0.01) to avoid warnings on floating point imprecision
                        if (isCreditNormal && targetAcc.balance - convertedAdjustAmt < -0.01) {
                          return (
                            <div className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] p-2 rounded-lg flex items-start gap-1.5 animate-pulse">
                              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              <span>{isAr ? 'تنبيه: هذا القيد سيؤدي لتجاوز الرصيد الحالي للحساب المستهدف وسيصبح بالسالب.' : 'Alert: This entry will exceed the current balance of the target account.'}</span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    {(() => {
                      const sourceAcc = financialAccounts.find(a => a.id === sourceAccountId || a.entityId === sourceAccountId);
                      const adjustAmt = parseFloat(adjustData.amount) || 0;
                      if (sourceAcc && typeof sourceAcc.balance === 'number' && adjustAmt > 0) {
                        // Convert transaction amount to account currency
                        const convertedAdjustAmt = financialAccountService.convertToTargetCurrency(
                          adjustAmt,
                          adjustData.currency,
                          sourceAcc.currency || settings.currency || 'SAR',
                          { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
                        );

                        // Source Account is being CREDITED
                        const firstChar = (sourceAcc.accountCode || sourceAcc.code || '1').trim().toUpperCase();
                        const isDebitNormal = firstChar.startsWith('1') || firstChar.startsWith('5') || firstChar.startsWith('EXP') || firstChar.startsWith('AST') || firstChar.startsWith('ASS');

                        // If it's a Debit-Normal account (Asset/Expense), Crediting reduces balance
                        // Add a small epsilon (0.01) to avoid warnings on floating point imprecision
                        if (isDebitNormal && sourceAcc.balance - convertedAdjustAmt < -0.01) {
                          return (
                            <div className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] p-2 rounded-lg flex items-start gap-1.5 animate-pulse">
                              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              <span>{isAr ? 'تنبيه: هذا القيد سيؤدي لتجاوز الرصيد الحالي لحساب المصدر وسيصبح بالسالب.' : 'Alert: This entry will exceed the current balance of the source account.'}</span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>

              {/* If targetType is employee, show option for Salary Payment */}
              {targetType === 'employee' && targetAccountId && (
                <div className="bg-black/30 border border-slate-850 rounded-xl p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSalaryPayment}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsSalaryPayment(checked);
                        const acc = financialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);
                        if (checked && acc && acc.monthlySalary) {
                          setAdjustData(prev => ({ ...prev, amount: String(acc.monthlySalary) }));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-[#d4af37] focus:ring-0 cursor-pointer accent-[#d4af37]"
                    />
                    <span className="text-xs font-black text-white">
                      {isAr ? 'صرف كراتب شهري رسمي' : 'File as Official Monthly Salary'}
                    </span>
                  </label>

                  {isSalaryPayment && (
                    <div className="animate-fade-in">
                      <label className="block text-[9px] font-black text-slate-500 mb-1.5 uppercase">{isAr ? 'الشهر المستحق للراتب *' : 'Salary Month *'}</label>
                      <input
                        type="month"
                        required
                        value={adjustSalaryMonth}
                        onChange={e => setAdjustSalaryMonth(e.target.value)}
                        className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-2.5 text-xs font-bold font-mono text-center outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Amount && Original Currency */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'قيمة القيد المالي والصلابة' : 'Voucher amount'}</label>
                  <input
                    type="number"
                    required
                    value={adjustData.amount}
                    onChange={e => setAdjustData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-black outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'العملة' : 'Rate Original'}</label>
                  <select
                    value={adjustData.currency}
                    onChange={e => setAdjustData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37] cursor-pointer"
                  >
                    {activeCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title / Particulars */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'البيان وعنوان التعديل المالي' : 'Transaction description (Particulars)'}</label>
                <input
                  type="text"
                  required
                  value={adjustData.title}
                  onChange={e => setAdjustData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={isAr ? "مثال: تسوية رأس المال، بيع كاش موازي" : "Remittance correction / Asset Adjustment"}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Counterparty / Recipient Name */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الجهة المستلمة / المخصصة' : 'Party counterpart'}</label>
                <input
                  type="text"
                  value={adjustData.recipientName}
                  onChange={e => setAdjustData(prev => ({ ...prev, recipientName: e.target.value }))}
                  placeholder={isAr ? "اختياري: الخزينة، بنك الكريمي، إلخ" : "Al Kuraimi Bank, Office Vault, etc."}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'شرح وتأكيدات إضافية' : 'Supplementary audits details'}</label>
                <textarea
                  value={adjustData.notes}
                  onChange={e => setAdjustData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-normal outline-none focus:border-[#d4af37] h-16 resize-none"
                  placeholder={isAr ? "أية مستندات أو شروحات مرافقة للقيد..." : "Provide internal notes about this treasury adjustment..."}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="w-1/2 bg-slate-900 hover:bg-slate-800 text-slate-350 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={adjustLoading}
                className="w-1/2 bg-[#d4af37] hover:bg-[#bfa032] active:bg-[#aa8e2b] text-black py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {adjustLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isAr ? 'تنزيل التسجيل' : 'Commit Entry'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
