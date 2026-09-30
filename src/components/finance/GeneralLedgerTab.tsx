import React from 'react';
import { Edit2, Eye, FileSpreadsheet, PlusCircle, Printer, Search, Trash2 } from 'lucide-react';
import type {
  LedgerCurrencyFilter,
  LedgerDateFilter,
  LedgerModuleFilter,
  LedgerTypeFilter,
} from '../financeAccounting/FinanceAccountingTypes';

interface GeneralLedgerTabProps {
  isAr: boolean;
  exportLedgerToCSV: () => void;
  triggerPrint: (title: string, elementId: string) => void;
  setIsAdjustmentModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  typeFilter: LedgerTypeFilter;
  setTypeFilter: React.Dispatch<React.SetStateAction<LedgerTypeFilter>>;
  moduleFilter: LedgerModuleFilter;
  setModuleFilter: React.Dispatch<React.SetStateAction<LedgerModuleFilter>>;
  currencyFilter: LedgerCurrencyFilter;
  setCurrencyFilter: React.Dispatch<React.SetStateAction<LedgerCurrencyFilter>>;
  activeCurrencies: any[];
  dateFilter: LedgerDateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<LedgerDateFilter>>;
  searchLedgerQuery: string;
  setSearchLedgerQuery: React.Dispatch<React.SetStateAction<string>>;
  customStartDate: string;
  setCustomStartDate: React.Dispatch<React.SetStateAction<string>>;
  customEndDate: string;
  setCustomEndDate: React.Dispatch<React.SetStateAction<string>>;
  filteredLedgerEntries: any[];
  setSelectedLedgerEntry: React.Dispatch<React.SetStateAction<any | null>>;
  canEditFinance: boolean;
  setSelectedEditEntry: React.Dispatch<React.SetStateAction<any | null>>;
  setEditJournalData: React.Dispatch<React.SetStateAction<any>>;
  setIsEditJournalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEntryToDelete: React.Dispatch<React.SetStateAction<any | null>>;
  setDeletePin: React.Dispatch<React.SetStateAction<string>>;
  setDeletePinError: React.Dispatch<React.SetStateAction<string>>;
  setIsDeletePinModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function GeneralLedgerTab({
  isAr,
  exportLedgerToCSV,
  triggerPrint,
  setIsAdjustmentModalOpen,
  typeFilter,
  setTypeFilter,
  moduleFilter,
  setModuleFilter,
  currencyFilter,
  setCurrencyFilter,
  activeCurrencies,
  dateFilter,
  setDateFilter,
  searchLedgerQuery,
  setSearchLedgerQuery,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  filteredLedgerEntries,
  setSelectedLedgerEntry,
  canEditFinance,
  setSelectedEditEntry,
  setEditJournalData,
  setIsEditJournalOpen,
  setEntryToDelete,
  setDeletePin,
  setDeletePinError,
  setIsDeletePinModalOpen,
}: GeneralLedgerTabProps) {
  return (
        <div className="space-y-6">

          {/* Advanced Multi-Filters Desk && Quick voucher adjustment trigger */}
          <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">{isAr ? 'مرشحات المراجعة المالية المتقدمة' : 'Advanced Accounting Audit Bench'}</h3>
                <p className="text-[10px] text-slate-550 font-medium">{isAr ? 'قم بفلترة قيود الخزينة وميزان المراجعة تزامناً مع الدفاتر.' : 'Filter daily cash books and compute targeted balances live.'}</p>
              </div>

              <div className="flex flex-wrap gap-2.5 w-full lg:w-auto">
                {/* Export Link */}
                <button
                  onClick={exportLedgerToCSV}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-black transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  {isAr ? 'تصدير الدفتر CSV' : 'Export Ledger Sheet'}
                </button>

                {/* Print button */}
                <button
                  onClick={() => triggerPrint(isAr ? 'الدفتر المالي العام' : 'General Chronology Ledger', 'ledger-print-wrapper')}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-black transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-[#d4af37]" />
                  {isAr ? 'طباعة الدفتر' : 'Print General Book'}
                </button>

                {/* Trigger Adjustment Modal */}
                <button
                  onClick={() => setIsAdjustmentModalOpen(true)}
                  className="flex items-center gap-1.5 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-3.5 py-2 rounded-xl text-xs font-black transition-all ml-auto lg:ml-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  {isAr ? 'قيد تسوية وتعديل مالي' : 'Manual Journal Entry'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-black/20 p-4 rounded-2xl border border-slate-900">

              {/* Type Filter */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'نوع القيد الدفتري' : 'Transaction Type'}</label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'جميع القيود' : 'All Ledger Entries'}</option>
                  <option value="Debit">{isAr ? 'مقبوضات / مدين (+)' : 'Inflows / Debits'}</option>
                  <option value="Credit">{isAr ? 'مصروفات وصرف / دائن (-)' : 'Outflows / Credits'}</option>
                </select>
              </div>

              {/* Module Filter */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'فلتر المعاملة (الوحدة)' : 'Module / Type'}</label>
                <select
                  value={moduleFilter}
                  onChange={e => setModuleFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'جميع الوحدات' : 'All Modules'}</option>
                  <option value="order">{isAr ? 'طلبات الشحن الشحنات' : 'Cargo Orders'}</option>
                  <option value="custody">{isAr ? 'عهد مالية' : 'Custodies'}</option>
                  <option value="payment">{isAr ? 'قبض دفعات' : 'Customer Payments'}</option>
                  <option value="salary">{isAr ? 'صرف رواتب' : 'Salaries'}</option>
                  <option value="adjustment">{isAr ? 'قيود تسوية' : 'Adjustments'}</option>
                </select>
              </div>

              {/* Currency original Filter */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'حسب عملة السداد الأصلية' : 'Billed CurrencyOriginal'}</label>
                <select
                  value={currencyFilter}
                  onChange={e => setCurrencyFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'جميع العملات' : 'All currencies'}</option>
                  {activeCurrencies.map(c => (
                    <option key={c.code} value={c.code}>
                      {isAr ? (c.main_nameAR || c.sup_nameAR || c.code) : (c.main_nameEn || c.sup_nameEn || c.code)} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Predefined Date Ranges */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'الفترة الزمنية' : 'Accounting Period'}</label>
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'كامل السجل التاريخي' : 'All time records'}</option>
                  <option value="today">{isAr ? 'اليوم' : 'Today only'}</option>
                  <option value="7days">{isAr ? 'آخر 7 أيام' : 'Last 7 Days'}</option>
                  <option value="30days">{isAr ? 'آخر 30 يوم' : 'Last 30 Days'}</option>
                  <option value="custom">{isAr ? 'فترة زمنية مخصصة' : '-- Custom Date Range --'}</option>
                </select>
              </div>

              {/* Text Search input */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'بحث سريع بالنص' : 'Interactive text search'}</label>
                <div className="relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-550 w-3 h-3" />
                  <input
                    type="text"
                    value={searchLedgerQuery}
                    onChange={e => setSearchLedgerQuery(e.target.value)}
                    placeholder={isAr ? "رقم مرجعي، عميل، سند..." : "Search particulars..."}
                    className="w-full pr-8 pl-3 py-1.5 bg-black/40 border border-slate-850 text-white rounded-lg text-xs font-semibold outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

            </div>

            {/* Custom Date Pickers Expanded */}
            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-3 bg-black/35 p-3 rounded-2xl border border-dashed border-slate-850 animate-fade-in max-w-xl">
                <div>
                  <label className="block text-[9px] text-slate-550 mb-1">{isAr ? 'من تاريخ:' : 'Starting date:'}</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="bg-black/50 border border-slate-850 text-white rounded-lg p-1.5 text-xs font-bold w-full outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-550 mb-1">{isAr ? 'إلى تاريخ:' : 'Ending date:'}</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="bg-black/50 border border-slate-850 text-white rounded-lg p-1.5 text-xs font-bold w-full outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Ledger Table Section */}
          <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-xl" id="ledger-print-wrapper">

            {/* PDF/Print Custom Header - Hidden in Standard view */}
            <div className="hidden print:block p-4 border-b border-black">
              <h2 className="text-sm font-bold">{isAr ? 'مراجع دفتر اليومية العام' : 'Consolidated General Ledger Feed'}</h2>
              <p className="text-xs">
                {isAr ? `تصفية المرشحات: نوع القيد [${typeFilter}] العملة [${currencyFilter}] الفترة [${dateFilter}]`
                  : `Filters applied: Module [${typeFilter}] Currency [${currencyFilter}] Range [${dateFilter}]`}
              </p>
              <br />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead className="bg-[#0a0a0d] text-slate-500 text-[9.5px] font-black uppercase tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="p-4">{isAr ? 'التاريخ الفعلي' : 'Effective Date'}</th>
                    <th className="p-4">{isAr ? 'سند مرجعي / رمز القيد' : 'Voucher Node'}</th>
                    <th className="p-4">{isAr ? 'البيان والوصف التفصيلي' : 'Particulars / Annotations'}</th>
                    <th className="p-4">{isAr ? 'الطرف المدين (من حـ/)' : 'Debit Side (Dr.)'}</th>
                    <th className="p-4">{isAr ? 'الطرف الدائن (إلى حـ/)' : 'Credit Side (Cr.)'}</th>
                    <th className="p-4 text-center">{isAr ? 'مبلغ القيد والعملة' : 'Voucher Amount'}</th>
                    <th className="p-4 text-center">{isAr ? 'العمليات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-805 bg-black/10 font-bold">
                  {filteredLedgerEntries.map((e) => {
                    return (
                      <tr key={e.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="p-4 text-slate-500 text-[10px] whitespace-nowrap">
                          {e.date.toLocaleDateString()} <span className="text-[9px] block text-slate-600 font-normal">{e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => setSelectedLedgerEntry(e)}
                            className="bg-slate-900 hover:bg-slate-850 hover:border-slate-700 border border-slate-800 text-[#d4af37] px-2.5 py-1 rounded-lg text-[9.5px] font-mono whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
                            title={isAr ? 'معاينة القيد المالي المزدوج المتقابل وتفاصيله' : 'Preview Balanced Voucher Details'}
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            {e.refNumber}
                          </button>
                        </td>
                        <td className="p-4 max-w-xs">
                          <span className="text-slate-200 block text-xs font-black truncate">{e.title}</span>
                          {e.notes && e.notes !== e.title && (
                            <span className="text-[9px] text-slate-500 block font-normal truncate">{e.notes}</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] px-1 py-0.2 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 rounded shrink-0">مدين</span>
                            <span className="text-xs text-slate-200">{e.debitPartyName || '—'}</span>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-rose-400">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] px-1 py-0.2 bg-rose-950/60 border border-rose-800/40 text-rose-400 rounded shrink-0">دائن</span>
                            <span className="text-xs text-slate-200">{e.creditPartyName || '—'}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-black text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-white text-xs">
                              {e.amountOriginal.toLocaleString()} {e.currencyOriginal}
                            </span>
                            {e.currencyOriginal !== 'YER' && (
                              <span className="text-[9.5px] text-slate-500 font-normal" dir="ltr">
                                (≈ {e.amount.toLocaleString()} YER)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedLedgerEntry(e)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                              title={isAr ? 'معاينة القيد والطباعة' : 'View Voucher'}
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                            </button>

                            {/* Edit Button */}
                            {canEditFinance && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEditEntry(e);
                                  setEditJournalData({
                                    amountOriginal: (e.amountOriginal || e.amount).toString(),
                                    currencyOriginal: e.currencyOriginal || 'YER',
                                    notes: e.notes || e.title || '',
                                    createdAt: new Date(e.date).toISOString().substring(0, 16),
                                    debitAccountId: e.debitAccountId || e.debitLeg?.accountId || '',
                                    creditAccountId: e.creditAccountId || e.creditLeg?.accountId || ''
                                  });
                                  setIsEditJournalOpen(true);
                                }}
                                className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg text-xs transition-all cursor-pointer"
                                title={isAr ? 'تعديل بيانات القيد المالي' : 'Edit Entry'}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                              </button>
                            )}

                            {/* Delete Button */}
                            {canEditFinance && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEntryToDelete(e);
                                  setDeletePin('');
                                  setDeletePinError('');
                                  setIsDeletePinModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-400 rounded-lg text-xs transition-all cursor-pointer"
                                title={isAr ? 'حذف القيد المالي (يتطلب رمز PIN)' : 'Delete Entry (PIN required)'}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLedgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-16 text-center text-slate-500 font-bold font-mono text-[10px] uppercase select-none">
                        [ {isAr ? 'لا توجد قيود بالدفتر اليومي مطابقة للمرشحات' : 'no_ledger_vouchers_recorded_in_current_scope'} ]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Trial Balance Footer Stats block */}
            <div className="bg-[#0e0e11] p-4 border-t border-slate-850 flex flex-wrap justify-between items-center text-xs text-slate-400">
              <span className="font-mono text-[10px] uppercase">[ {filteredLedgerEntries.length} chronological_vouchers_rendered ]</span>
              <div className="flex gap-4 font-bold">
                <span className="text-emerald-400">{isAr ? 'إجمالي المقبوض:' : 'Total Debit:'} {filteredLedgerEntries.filter(e => e.type === 'Debit').reduce((sum, e) => sum + e.amount, 0).toLocaleString()} YER</span>
                <span className="text-rose-500">{isAr ? 'إجمالي المنصرف:' : 'Total Credit:'} {filteredLedgerEntries.filter(e => e.type === 'Credit').reduce((sum, e) => sum + e.amount, 0).toLocaleString()} YER</span>
              </div>
            </div>

          </div>
        </div>
  );
}
