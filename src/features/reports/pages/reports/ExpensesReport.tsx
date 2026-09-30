/**
 * @file ExpensesReport.tsx
 * @description تقرير المصروفات التفصيلي
 * Detailed expenses report with category breakdown and drilldown
 */

import React from 'react';
import { format } from 'date-fns';

interface ExpensesReportProps {
  isAr: boolean;
  filteredData: { expenses: any[]; orders: any[] };
  selectedExpenseCategory: string | null;
  setSelectedExpenseCategory: (cat: string | null) => void;
  EXPENSE_CATEGORIES_DYNAMIC: any[];
  reportMetrics: { costs: number };
  accountTransactions: any[];
  accounts: any[];
  searchMatchList: (list: any[], keyField: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
}

// ─── ExpensesReport Component ───────────────────────────────────────────────
const ExpensesReport: React.FC<ExpensesReportProps> = ({
  isAr,
  filteredData,
  selectedExpenseCategory,
  setSelectedExpenseCategory,
  EXPENSE_CATEGORIES_DYNAMIC,
  reportMetrics,
  accountTransactions,
  accounts,
  searchMatchList,
  convertToYER
}) => {
  return (
                <div className="space-y-6">
                  {selectedExpenseCategory === null ? (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                        <div>
                          <h4 className="text-sm font-black text-white">{isAr ? 'تصنيفات ومجموع المصروفات والتشغيل' : 'Operating Expenses & Category Breakdown'}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اضغط على تظليل أي فئة لمراجعة حركتها المفصلة وسجلاتها المحاسبية' : 'Click any category to drill down raw registries.'}</p>
                        </div>
                        <span className="text-xs font-bold text-rose-400">{isAr ? 'إجمالي المنصرف الإجمالي:' : 'Total OpEx sum:'} <span className="font-mono font-black">{reportMetrics.costs.toLocaleString()} YER</span></span>
                      </div>

                      {/* Categories grid Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {EXPENSE_CATEGORIES_DYNAMIC.filter(cat => cat.id !== 'all').map(cat => {
                          const catExpenses = filteredData.expenses.filter(e => e.category === cat.id);
                          const catSum = catExpenses.reduce((sum, e) => sum + convertToYER(parseFloat(e.amount) || 0, e.currency || 'YER'), 0);
                          return (
                            <button
                              key={cat.id}
                              onClick={() => setSelectedExpenseCategory(cat.id)}
                              className="text-right p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-850/60 hover:border-[#d4af37]/30 rounded-2xl transition transform hover:-translate-y-1 block relative"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="bg-slate-950 border border-slate-800 text-slate-505 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">{cat.id}</span>
                                <div className="w-1.5 h-1.5 bg-[#d4af37] rounded-full" />
                              </div>
                              <span className="text-xs font-black text-white block truncate">{isAr ? cat.labelAr : cat.labelEn}</span>
                              <span className="text-md font-mono font-black text-rose-400 block mt-1">{catSum.toLocaleString()} YER</span>
                              <span className="text-[10px] text-slate-500 block mt-1">{catExpenses.length} {isAr ? 'سجل مصرف' : 'records'}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* General detailed Registry listing below */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-black text-white block">{isAr ? 'السجل العام المفصل للمصروفات والمسحوبات' : 'Detailed General Outflow Log'}</span>
                        <div className="overflow-x-auto w-full max-w-full pb-2">
                          <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[700px]">
                            <thead>
                              <tr className="text-slate-550 uppercase font-black">
                                <th className="py-2 px-3">{isAr ? 'كود السند' : 'Expense ID'}</th>
                                <th className="py-2 px-3">{isAr ? 'تاريخ المعاملة' : 'Date'}</th>
                                <th className="py-2 px-3 text-center">{isAr ? 'فئة المنصرف' : 'Category'}</th>
                                <th className="py-2 px-3">{isAr ? 'المستفيد' : 'Beneficiary'}</th>
                                <th className="py-2 px-3">{isAr ? 'شرح تفصيلي' : 'Narration'}</th>
                                <th className="py-2 px-3 text-right">{isAr ? 'المبلغ الفعلي' : 'Amount'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/30">
                              {searchMatchList(filteredData.expenses.filter(e => EXPENSE_CATEGORIES_DYNAMIC.some(c => c.id === e.category)), 'recipientName').map((exp) => (
                                <tr key={exp.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl transition-all">
                                  <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{exp.expenseNumber || 'EXP-XXX'}</td>
                                  <td className="py-3 px-3 text-slate-500">{format(new Date(exp.createdAt || Date.now()), 'yyyy-MM-dd')}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase">{exp.category}</span>
                                  </td>
                                  <td className="py-3 px-3 font-bold text-white">{exp.recipientName}</td>
                                  <td className="py-3 px-3 text-slate-400 font-medium truncate max-w-xs">{exp.notes || '-'}</td>
                                  <td className="py-3 px-3 text-right font-mono font-black text-rose-400">{exp.amount?.toLocaleString()} <span className="text-[10px] text-slate-550 font-sans">{exp.currency}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // SELECTED EXPENSE CATEGORY DETAILED VIEW
                    <div className="space-y-6">
                      {(() => {
                        const catObj = EXPENSE_CATEGORIES_DYNAMIC.find(c => c.id === selectedExpenseCategory);
                        const catExpenses = filteredData.expenses.filter(e => e.category === selectedExpenseCategory);
                        const catSum = catExpenses.reduce((sum, e) => sum + convertToYER(parseFloat(e.amount) || 0, e.currency || 'YER'), 0);

                        const linkedAccount = accounts.find(a =>
                          (catObj?.accountId && (a.id === catObj.accountId || a.entityId === catObj.accountId)) ||
                          (catObj?.accountCode && a.accountCode === catObj.accountCode)
                        );

                        const matchedTxs = linkedAccount ? accountTransactions.filter(tx => tx.accountId === linkedAccount.id) : [];

                        return (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedExpenseCategory(null)}
                                  className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                >
                                  {isAr ? '← عودة' : '← Back'}
                                </button>
                                <div>
                                  <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">{selectedExpenseCategory}</span>
                                  <h4 className="text-sm font-black text-white mt-1">
                                    {isAr ? `كشف حركة تفصيلي: ${catObj?.labelAr}` : `Category Statement: ${catObj?.labelEn}`}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-500 uppercase">SWIFTSHIP OPEX DECK</span>
                            </div>

                            {/* Category Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
                                <span className="text-[10px] text-rose-400 font-bold block mb-1">{isAr ? 'إجمالي المنصرف لهذه الفئة' : 'Total Category Spending'}</span>
                                <span className="text-lg font-mono font-black text-rose-400">{catSum.toLocaleString()} YER</span>
                                <span className="text-[9px] text-slate-550 block mt-1">{isAr ? 'مسحوبة من النقد المتداول وصندوق الصرف' : 'Withdrawn from aggregate liquidity.'}</span>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'عدد السندات والفواتير' : 'Registries Count'}</span>
                                <span className="text-lg font-mono font-black text-white">{catExpenses.length} <span className="text-xs text-slate-500 font-sans">{isAr ? 'سند' : 'bills'}</span></span>
                                <span className="text-[9px] text-slate-550 block mt-1">{isAr ? 'سجل تحليلي كامل بفترة الفلترة' : 'Filtered inside your specified dates.'}</span>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl">
                                <span className="text-[10px] text-slate-550 font-bold block mb-1">{isAr ? 'معدل الحركة الواحدة' : 'Average value per ticket'}</span>
                                <span className="text-lg font-mono font-black text-[#d4af37]">
                                  {catExpenses.length > 0 ? Math.round(catSum / catExpenses.length).toLocaleString() : 0} YER
                                </span>
                                <span className="text-[9px] text-slate-550 block mt-1">{isAr ? 'متوسط قيمة المعاملة الواحدة المقدر' : 'Arithmetic mean value.'}</span>
                              </div>
                              {linkedAccount && (
                                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                                  <span className="text-[10px] text-emerald-400 font-bold block mb-1">{isAr ? 'رصيد الحساب المالي المرتبط' : 'Linked Account Balance'}</span>
                                  <span className="text-lg font-mono font-black text-emerald-400">
                                    {(parseFloat(linkedAccount.balance as any) || 0).toLocaleString()} {linkedAccount.currency || 'YER'}
                                  </span>
                                  <span className="text-[9px] text-slate-550 block mt-1 truncate">{linkedAccount.nameAr || linkedAccount.nameEn} ({linkedAccount.accountCode})</span>
                                </div>
                              )}
                            </div>

                            {/* Filtered category registry Table */}
                            <div className="space-y-3">
                              <span className="text-xs font-black text-white block">{isAr ? 'سجل الحركات المصرحة بالفئة المحددة' : 'Direct Category Expense Slips'}</span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-start border-collapse">
                                  <thead>
                                    <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                      <th className="py-2.5 px-3 text-start">{isAr ? 'كود السند' : 'Slip ID'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'المستفيد' : 'Recipient'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'البيان وملاحظات مرافقة' : 'Narration & Details'}</th>
                                      <th className="py-2.5 px-3 text-right">{isAr ? 'المبلغ الفعلي' : 'Amount'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-850/30">
                                    {catExpenses.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="text-center py-10 text-slate-650 font-bold italic">
                                          {isAr ? 'لا توجد بيانات مصروفات لهذه الفئة بالفترة المحددة' : 'No expenses recorded in this category.'}
                                        </td>
                                      </tr>
                                    ) : (
                                      catExpenses.map(e => (
                                        <tr key={e.id} className="hover:bg-slate-950/20 font-medium">
                                          <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{e.expenseNumber}</td>
                                          <td className="py-3 px-3 text-slate-500">{format(new Date(e.createdAt || Date.now()), 'yyyy-MM-dd')}</td>
                                          <td className="py-3 px-3 text-white font-bold">{e.recipientName}</td>
                                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate">{e.notes || '-'}</td>
                                          <td className="py-3 px-3 text-right font-mono font-black text-rose-400">{e.amount?.toLocaleString()} {e.currency}</td>
                                        </tr>
                                      ))
                                      )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Indirect Accounting journal matches */}
                            {matchedTxs.length > 0 && (
                              <div className="space-y-3 pt-4 border-t border-slate-900">
                                <span className="text-xs font-black text-[#d4af37] block">{isAr ? 'القيود المحاسبية المقابلة في شجرة الحسابات' : 'Corresponding Ledger Node Journal entries'}</span>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-start border-collapse">
                                    <thead>
                                      <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold">
                                        <th className="py-2 px-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                                        <th className="py-2 px-3">{isAr ? 'رقم القيد' : 'Tx Code'}</th>
                                        <th className="py-2 px-3">{isAr ? 'الشرح' : 'Description'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'القدر المالي' : 'Sum'}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-850/25">
                                      {matchedTxs.map(tx => (
                                        <tr key={tx.id} className="font-medium text-slate-400">
                                          <td className="py-2.5 px-3 text-slate-600">{format(new Date(tx.createdAt), 'yyyy-MM-dd')}</td>
                                          <td className="py-2.5 px-3 font-mono text-slate-350">{tx.refNumber || '-'}</td>
                                          <td className="py-2.5 px-3 text-slate-300">{tx.description}</td>
                                          <td className={`py-2.5 px-3 text-right font-mono font-bold ${tx.type === 'Debit' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {tx.type === 'Debit' ? '+' : '-'}{tx.amount?.toLocaleString()} {tx.currencyOriginal || 'SAR'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
  );
};

export default ExpensesReport;

