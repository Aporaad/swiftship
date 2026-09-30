/**
 * @file UsersReport.tsx
 * @description تقرير حسابات المستخدمين والرواتب
 * Users accounts and salaries report
 */

import React from 'react';
import { format } from 'date-fns';

interface UsersReportProps {
  isAr: boolean;
  filteredData: { users: any[]; orders: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  searchMatchList: (list: any[], key: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
}

// ─── UsersReport Component ──────────────────────────────────────────────────
const UsersReport: React.FC<UsersReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedUserId,
  setSelectedUserId,
  searchMatchList,
  convertToYER
}) => {
  const users = (filteredData as any).users || [];
  return (
      <div>
                <div className="space-y-6">
                  {selectedUserId === null ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-white">{isAr ? 'دفتر الموظفين وتدقيق كشوفات الرواتب' : 'Corporate Payroll & Staff Salaries'}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اختر أي موظف لمراجعة استمارات المرتبات والسندات المالية التابعة لحسابه في الدفاتر المركزية' : 'Understands corporate staffing and wage slips. Select employee to drill down into payments.'}</p>
                      </div>

                      <div className="overflow-x-auto w-full max-w-full pb-2">
                        <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[650px]">
                          <thead>
                            <tr className="text-slate-550 font-black">
                              <th className="py-2 px-3 text-start">{isAr ? 'الاسم بالكامل' : 'Staff Name'}</th>
                              <th className="py-2 px-3">{isAr ? 'البريد المهني الرسمي' : 'Work Email'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الصلاحيات الوظيفية' : 'Permission Role'}</th>
                              <th className="py-2 px-3 text-right">{isAr ? 'الراتب المعتمد أساسيا' : 'Approved Wage'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchMatchList(filteredData.users, 'fullName').map((u) => (
                              <tr key={u.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl cursor-pointer transition animate-fade-in" onClick={() => setSelectedUserId(u.id)}>
                                <td className="py-3 px-3 font-bold text-white text-start">{u.fullName || u.displayName}</td>
                                <td className="py-3 px-3 text-slate-500 font-mono font-bold">{u.email || '-'}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[8.5px] uppercase font-black bg-purple-500/5 text-purple-400 border border-purple-500/20">{u.role || 'COURIER'}</span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-[#d4af37]">{(u.monthlySalary || 0).toLocaleString()} YER</td>
                                <td className="py-3 px-3 text-center animate-fade-in">
                                  <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-black">
                                    {isAr ? 'دفتر المستحقات' : 'Edit Wage Card'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    // SELECTED STAFF/USER ID DRILLDOWN DETAILED DISPLAY
                    <div className="space-y-6 animate-fade-in">
                      {(() => {
                        const u = users.find(usr => usr.id === selectedUserId);
                        if (!u) return <p className="text-slate-500">Staff record not found.</p>;

                        // Filter direct ledger payroll actions relating to their name in description
                        const staffTxs = accountTransactions.filter(tx => tx.accountId === u.accountId);

    return (
      <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedUserId(null)}
                                  className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                >
                                  {isAr ? '← تراجع' : '← Back'}
                                </button>
                                <div>
                                  <span className="bg-purple-500/10 text-purple-400 border border-purple-500/15 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">STAFF FILE</span>
                                  <h4 className="text-sm font-black text-white mt-1">
                                    {isAr ? `تصفية الرواتب واستمارة شجرة الدفاتر: ${u.fullName || u.displayName}` : `Corporate Position Folder: ${u.fullName || u.displayName}`}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-550">OFFICIAL PAYROLL DECK</span>
                            </div>

                            {/* stats panels */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الراتب الأساسي الصافي' : 'Approved Basic Stipend'}</span>
                                <span className="text-lg font-mono font-black text-[#d4af37]">{(u.monthlySalary || 0).toLocaleString()} YER</span>
                                <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'الراتب الشهري المقر بقائمتها المركزية' : 'Monthly wage cleared in workspace registries.'}</p>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? ' الرصيد المالي' : 'balance'}</span>
                                <span className="text-lg font-mono font-black text-white">{staffTxs.reduce((acc, t) => (t.type === 'Credit') ? acc + t.amount : acc - t.amount, 0).toLocaleString()} <span className="text-xs font-sans text-slate-550">{isAr ? 'رصيد' : 'entries'}</span></span>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الصلاحيات والوصول' : 'Enterprise Access Scope'}</span>
                                <span className="text-md font-black text-purple-400 block mt-1 uppercase tracking-wider">{u.role || 'COURIER'}</span>
                                <p className="text-[9px] text-slate-550 mt-1 font-mono">{u.email || '-'}</p>
                              </div>
                            </div>

                            {/* matching historical journal entries */}
                            <div className="space-y-3">
                              <span className="text-xs font-black text-white block">{isAr ? 'السجل التاريخي لرواتب المنصرفة والعهود المستقطعة' : 'Direct payroll & ledger entries linked'}</span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-start border-collapse">
                                  <thead>
                                    <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                      <th className="py-2.5 px-3 text-start">{isAr ? 'التاريخ' : 'Datetime'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'رقم القيد' : 'Journal ID'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'الشرح ' : 'Narration'}</th>
                                      <th className="py-2.5 px-3 text-right">{isAr ? 'دائن ' : 'Credit'}</th>
                                      <th className="py-2.5 px-3 text-right">{isAr ? 'مدين' : 'Debit'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-850/30">
                                    {staffTxs.length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="text-center py-6 text-slate-650 italic font-bold">
                                          {isAr ? 'لا توجد دفعات مصادق عليها مقيدة تحت اسم هذا الموظف بعد' : 'No cash vouchers generated against this employee.'}
                                        </td>
                                      </tr>
                                    ) : (
                                      staffTxs.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-950/20 font-medium text-slate-400">
                                          <td className="py-3 px-3 text-slate-500">{format(new Date(tx.createdAt), 'yyyy-MM-dd')}</td>
                                          <td className="py-3 px-3 font-mono font-bold text-slate-350">{tx.refNumber || tx.refId}</td>
                                          <td className="py-3 px-3 text-white">{tx.description}</td>
                                          <td className="py-3 px-3 text-right font-mono font-black text-green-400">{tx.type === 'Credit' ? `+${tx.amount?.toLocaleString()} '${tx.currencyOriginal || 'SAR'}` : '-----'} </td>
                                          <td className="py-3 px-3 text-right font-mono font-black text-rose-400">{tx.type === 'Debit' ? `-${tx.amount?.toLocaleString()} '${tx.currencyOriginal || 'SAR'}` : '-----'} </td>
                                        </tr>
                                      ))
                                      )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
      </div>
  );
};

export default UsersReport;

