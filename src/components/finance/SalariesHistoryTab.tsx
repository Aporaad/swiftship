import React from 'react';
import { Coins, Eye, Printer, Receipt, Search, UserCheck } from 'lucide-react';

interface SalaryHistoryTabProps {
  isAr: boolean;
  salaryHistory: any[];
  employees: any[];
  accountTransactions: any[];
  setSelectedSalaryVoucher: React.Dispatch<React.SetStateAction<any>>;
  salarySearch: string;
  setSalarySearch: React.Dispatch<React.SetStateAction<string>>;
  salaryEmployeeFilter: string;
  setSalaryEmployeeFilter: React.Dispatch<React.SetStateAction<string>>;
  salaryMonthFilter: string;
  setSalaryMonthFilter: React.Dispatch<React.SetStateAction<string>>;
  employeeStatementId: string | null;
  setEmployeeStatementId: React.Dispatch<React.SetStateAction<string | null>>;
  empStmtDateFilter: 'all' | '30days' | 'custom';
  setEmpStmtDateFilter: React.Dispatch<React.SetStateAction<'all' | '30days' | 'custom'>>;
  empStmtStartDate: string;
  setEmpStmtStartDate: React.Dispatch<React.SetStateAction<string>>;
  empStmtEndDate: string;
  setEmpStmtEndDate: React.Dispatch<React.SetStateAction<string>>;
}

export default function SalaryHistoryTab({
  isAr,
  salaryHistory,
  employees,
  accountTransactions,
  setSelectedSalaryVoucher,
  salarySearch,
  setSalarySearch,
  salaryEmployeeFilter,
  setSalaryEmployeeFilter,
  salaryMonthFilter,
  setSalaryMonthFilter,
  employeeStatementId,
  setEmployeeStatementId,
  empStmtDateFilter,
  setEmpStmtDateFilter,
  empStmtStartDate,
  setEmpStmtStartDate,
  empStmtEndDate,
  setEmpStmtEndDate,
}: SalaryHistoryTabProps) {
  return (
    <>
        {(() => {
        // ── Derived data ──
        const filteredSalaries = salaryHistory.filter(item => {
          const q = salarySearch.toLowerCase();
          const matchSearch = !q ||
            (item.employeeName || '').toLowerCase().includes(q) ||
            (item.voucherCode || '').toLowerCase().includes(q) ||
            (item.accountCode || '').toLowerCase().includes(q);
          const matchEmp = salaryEmployeeFilter === 'all' || item.employeeId === salaryEmployeeFilter;
          const matchMonth = !salaryMonthFilter || item.salaryMonth === salaryMonthFilter;
          return matchSearch && matchEmp && matchMonth;
        });

        const totalPaid = salaryHistory.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const uniqueStaff = new Set(salaryHistory.map(i => i.employeeId)).size;

        // Employee statement transactions
        const empStatementEmployee = employees.find(e => e.id === employeeStatementId);
        const empStatementTxns = accountTransactions
          .filter(tx => tx.entityId === employeeStatementId && tx.entityType === 'employee')
          .concat(
            salaryHistory
              .filter(s => s.employeeId === employeeStatementId)
              .map(s => ({
                id: `SAL-${s.id}`,
                createdAt: s.paidAt || s.createdAt,
                description: isAr ? `صرف راتب شهر ${s.salaryMonth}` : `Salary payment for ${s.salaryMonth}`,
                type: 'Credit',
                amount: parseFloat(s.amount) || 0,
                currency: s.currency || 'YER',
                module: 'salary',
                refNumber: s.voucherCode
              }))
          )
          .filter(tx => {
            if (empStmtDateFilter === '30days') {
              const d = new Date(tx.createdAt);
              return (Date.now() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
            }
            if (empStmtDateFilter === 'custom' && empStmtStartDate && empStmtEndDate) {
              const d = new Date(tx.createdAt);
              return d >= new Date(empStmtStartDate) && d <= new Date(empStmtEndDate + 'T23:59:59');
            }
            return true;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const empStmtCredit = empStatementTxns.filter(t => t.type === 'Credit').reduce((s, t) => s + (t.amount || 0), 0);
        const empStmtDebit = empStatementTxns.filter(t => t.type === 'Debit').reduce((s, t) => s + (t.amount || 0), 0);
        const empStmtBalance = empStmtDebit - empStmtCredit;

        return (
          <div className="space-y-6 pb-10">
            {/* Print CSS */}
            <style dangerouslySetInnerHTML={{
              __html: `
              @media print {
                body * { visibility: hidden; }
                #salary-print-modal, #salary-print-modal * { visibility: visible; }
                #salary-print-modal { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; }
                .no-print { display: none !important; }
              }
            `}} />

            {/* ── Sub-navigation: Salary list vs Employee Statement ── */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setEmployeeStatementId(null)}
                className={`text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${!employeeStatementId
                  ? 'bg-[#d4af37]/15 border-[#d4af37]/40 text-[#d4af37]'
                  : 'bg-black/30 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                {isAr ? 'سجل الرواتب' : 'Salary History'}
              </button>
              <span className="text-slate-700 text-xs">|</span>
              <select
                value={employeeStatementId || ''}
                onChange={e => setEmployeeStatementId(e.target.value || null)}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-black text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer"
              >
                <option value="">{isAr ? '── كشف حساب موظف ──' : '── Employee Statement ──'}</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName || emp.email}</option>
                ))}
              </select>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* VIEW A: SALARY HISTORY LIST */}
            {/* ════════════════════════════════════════════════════════ */}
            {!employeeStatementId && (
              <div className="space-y-5">
                {/* Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'إجمالي الرواتب المصروفة' : 'Total Salaries Paid'}</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-mono font-black text-[#d4af37]">
                        {totalPaid.toLocaleString()}
                        <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">YER</span>
                      </span>
                      <Coins className="w-6 h-6 text-[#d4af37]/20 shrink-0" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'إجمالي سندات الصرف' : 'Total Salary Slips'}</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-mono font-black text-emerald-400">
                        {salaryHistory.length}
                        <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">{isAr ? 'سند' : 'slips'}</span>
                      </span>
                      <Receipt className="w-6 h-6 text-emerald-500/20 shrink-0" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'الموظفين المستلمين للرواتب' : 'Staff Members Settled'}</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-mono font-black text-cyan-400">
                        {uniqueStaff}
                        <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">{isAr ? 'موظف' : 'staff'}</span>
                      </span>
                      <UserCheck className="w-6 h-6 text-cyan-500/20 shrink-0" />
                    </div>
                  </div>
                </div>

                {/* Filter Belt */}
                <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={isAr ? 'ابحث باسم الموظف أو رقم السند...' : 'Search employee, voucher ID...'}
                      value={salarySearch}
                      onChange={e => setSalarySearch(e.target.value)}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/50 outline-none"
                    />
                  </div>
                  <div className="relative min-w-[180px]">
                    <select
                      value={salaryEmployeeFilter}
                      onChange={e => setSalaryEmployeeFilter(e.target.value)}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer"
                    >
                      <option value="all">{isAr ? 'كل الموظفين' : 'All Staff'}</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullName || emp.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative min-w-[140px]">
                    <input
                      type="month"
                      value={salaryMonthFilter}
                      onChange={e => setSalaryMonthFilter(e.target.value)}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50 font-mono text-center cursor-pointer"
                    />
                  </div>
                  {salaryMonthFilter && (
                    <button
                      onClick={() => setSalaryMonthFilter('')}
                      className="bg-slate-900 hover:bg-slate-850 text-slate-400 px-3 py-2.5 rounded-xl border border-slate-850 text-xs font-black transition-all"
                    >
                      {isAr ? 'إلغاء الفلتر' : 'Clear'}
                    </button>
                  )}
                </div>

                {/* Salary History Table */}
                <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-850">
                        <tr>
                          <th className="p-4 text-start">{isAr ? 'تاريخ الصرف' : 'Payment Date'}</th>
                          <th className="p-4 text-start">{isAr ? 'الموظف المستلم' : 'Staff Member'}</th>
                          <th className="p-4 text-start">{isAr ? 'رقم الحساب' : 'Account Code'}</th>
                          <th className="p-4 text-center">{isAr ? 'الشهر المستحق' : 'Salary Month'}</th>
                          <th className="p-4 text-start">{isAr ? 'رقم السند' : 'Voucher ID'}</th>
                          <th className="p-4 text-start">{isAr ? 'البيان' : 'Notes'}</th>
                          <th className="p-4 text-center">{isAr ? 'المبلغ المصروف' : 'Amount Paid'}</th>
                          <th className="p-4 text-left">{isAr ? 'إجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 bg-black/10">
                        {filteredSalaries.map(item => (
                          <tr key={item.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-4 font-mono font-bold text-slate-400 text-start" dir="ltr">
                              {new Date(item.paidAt || item.createdAt).toLocaleString(isAr ? 'ar-YE' : 'en-US', {
                                year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                            <td className="p-4 text-start">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center font-black text-[10px] text-[#d4af37] shrink-0">
                                  {(item.employeeName || '?').substring(0, 1)}
                                </div>
                                <div>
                                  <span className="font-extrabold text-white block">{item.employeeName}</span>
                                  <button
                                    onClick={() => setEmployeeStatementId(item.employeeId)}
                                    className="text-[9px] text-[#d4af37]/70 hover:text-[#d4af37] font-bold underline underline-offset-2 transition"
                                  >
                                    {isAr ? 'عرض كشف الحساب' : 'View Statement'}
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-start">
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-900/60 border border-slate-850 px-2 py-0.5 rounded-md">
                                {item.accountCode || '—'}
                              </span>
                            </td>
                            <td className="p-4 text-center font-mono font-black text-slate-300">
                              <span className="bg-amber-950/20 text-amber-500 border border-amber-900/20 px-2 py-0.5 rounded-lg text-[10px]">
                                {item.salaryMonth}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-xs font-black text-[#d4af37] text-start">{item.voucherCode}</td>
                            <td className="p-4 text-slate-400 max-w-xs truncate text-start">{item.notes || '—'}</td>
                            <td className="p-4 text-center font-mono font-black text-xs text-emerald-400">
                              {(item.amount || 0).toLocaleString()} {item.currency || 'YER'}
                            </td>
                            <td className="p-4 text-left">
                              <button
                                onClick={() => setSelectedSalaryVoucher(item)}
                                className="text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 border border-[#d4af37]/15 p-2 rounded-xl transition flex items-center gap-1.5 font-bold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="text-[10px]">{isAr ? 'معاينة' : 'View'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredSalaries.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                              {isAr ? '[ لم يتم العثور على قيود صرف رواتب ]' : '[ NO SALARY PAYOUT RECORDS FOUND ]'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════ */}
            {/* VIEW B: EMPLOYEE ACCOUNT STATEMENT */}
            {/* ════════════════════════════════════════════════════════ */}
            {employeeStatementId && (
              <div className="space-y-5">
                {/* Employee header card */}
                <div className="bg-gradient-to-r from-[#121215] to-[#0a0a0d] border border-[#d4af37]/20 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 flex items-center justify-center font-black text-2xl text-[#d4af37]">
                      {(empStatementEmployee?.fullName || empStatementEmployee?.email || '?')[0]}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">{empStatementEmployee?.fullName || empStatementEmployee?.email || employeeStatementId}</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {isAr ? 'كشف حساب الموظف' : 'Employee Account Statement'}
                      </p>
                      {empStatementEmployee?.monthlySalary && (
                        <p className="text-xs font-mono text-[#d4af37] mt-0.5">
                          {isAr ? 'الراتب الشهري:' : 'Monthly Salary:'} {empStatementEmployee.monthlySalary?.toLocaleString()} {empStatementEmployee.currency || 'YER'}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Summary metrics */}
                  <div className="flex gap-4 flex-wrap">
                    <div className="bg-black/40 border border-slate-850 rounded-2xl px-4 py-3 text-center min-w-[110px]">
                      <span className="text-[9px] font-black uppercase text-slate-500 block">{isAr ? 'إجمالي المصروف' : 'Total Paid Out'}</span>
                      <span className="text-base font-mono font-black text-rose-400">{empStmtCredit.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/40 border border-slate-850 rounded-2xl px-4 py-3 text-center min-w-[110px]">
                      <span className="text-[9px] font-black uppercase text-slate-500 block">{isAr ? 'إجمالي الوارد' : 'Total Received'}</span>
                      <span className="text-base font-mono font-black text-emerald-400">{empStmtDebit.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/40 border border-slate-850 rounded-2xl px-4 py-3 text-center min-w-[110px]">
                      <span className="text-[9px] font-black uppercase text-slate-500 block">{isAr ? 'الرصيد الصافي' : 'Net Balance'}</span>
                      <span className={`text-base font-mono font-black ${empStmtBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {empStmtBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statement Filters */}
                <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{isAr ? 'تصفية حسب الفترة:' : 'Filter by Period:'}</span>
                  {(['all', '30days', 'custom'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setEmpStmtDateFilter(opt)}
                      className={`text-[11px] font-black px-3 py-1.5 rounded-lg border transition-all ${empStmtDateFilter === opt
                        ? 'bg-[#d4af37]/15 border-[#d4af37]/40 text-[#d4af37]'
                        : 'bg-black/30 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                    >
                      {opt === 'all' ? (isAr ? 'الكل' : 'All Time') : opt === '30days' ? (isAr ? 'آخر 30 يوم' : 'Last 30 Days') : (isAr ? 'نطاق مخصص' : 'Custom Range')}
                    </button>
                  ))}
                  {empStmtDateFilter === 'custom' && (
                    <>
                      <input type="date" value={empStmtStartDate} onChange={e => setEmpStmtStartDate(e.target.value)}
                        className="bg-black/50 border border-slate-850 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50" />
                      <span className="text-slate-600 text-xs">—</span>
                      <input type="date" value={empStmtEndDate} onChange={e => setEmpStmtEndDate(e.target.value)}
                        className="bg-black/50 border border-slate-850 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50" />
                    </>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="mr-auto bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all no-print"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {isAr ? 'طباعة الكشف' : 'Print Statement'}
                  </button>
                </div>

                {/* Statement Table */}
                <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl" id="emp-statement-print">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-850">
                        <tr>
                          <th className="p-4 text-start">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                          <th className="p-4 text-start">{isAr ? 'البيان' : 'Description'}</th>
                          <th className="p-4 text-start">{isAr ? 'المرجع' : 'Reference'}</th>
                          <th className="p-4 text-start">{isAr ? 'نوع العملية' : 'Module'}</th>
                          <th className="p-4 text-center">{isAr ? 'مدين (وارد)' : 'Debit (In)'}</th>
                          <th className="p-4 text-center">{isAr ? 'دائن (صادر)' : 'Credit (Out)'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 bg-black/10">
                        {empStatementTxns.map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-4 font-mono text-slate-400 text-start" dir="ltr">
                              {new Date(tx.createdAt).toLocaleString(isAr ? 'ar-YE' : 'en-US', {
                                year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                            <td className="p-4 text-start text-slate-300 font-bold max-w-xs truncate">{tx.description}</td>
                            <td className="p-4 text-start">
                              <span className="font-mono text-[10px] text-[#d4af37] bg-amber-950/20 border border-amber-900/20 px-2 py-0.5 rounded-md">
                                {tx.refNumber || '—'}
                              </span>
                            </td>
                            <td className="p-4 text-start">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${tx.module === 'salary'
                                ? 'bg-purple-950/30 text-purple-400 border-purple-900/30'
                                : tx.module === 'order'
                                  ? 'bg-blue-950/30 text-blue-400 border-blue-900/30'
                                  : 'bg-slate-900 text-slate-500 border-slate-800'
                                }`}>
                                {tx.module === 'salary' ? (isAr ? 'راتب' : 'Salary') :
                                  tx.module === 'order' ? (isAr ? 'طلب' : 'Order') :
                                    tx.module === 'expense' ? (isAr ? 'مصروف' : 'Expense') :
                                      tx.module || '—'}
                              </span>
                            </td>
                            <td className="p-4 text-center font-mono font-black text-emerald-400">
                              {tx.type === 'Debit' ? (
                                <div className="flex flex-col">
                                  <span>{(tx.amountOriginal || tx.amount || 0).toLocaleString()} {tx.currencyOriginal || 'YER'}</span>
                                  {tx.amountOriginal !== tx.amount && <span className="text-[9px] text-slate-500 font-bold tracking-tighter">({(tx.amount || 0).toLocaleString()} YER)</span>}
                                </div>
                              ) : '—'}
                            </td>
                            <td className="p-4 text-center font-mono font-black text-rose-400">
                              {tx.type === 'Credit' ? (
                                <div className="flex flex-col">
                                  <span>{(tx.amountOriginal || tx.amount || 0).toLocaleString()} {tx.currencyOriginal || 'YER'}</span>
                                  {tx.amountOriginal !== tx.amount && <span className="text-[9px] text-slate-500 font-bold tracking-tighter">({(tx.amount || 0).toLocaleString()} YER)</span>}
                                </div>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                        {empStatementTxns.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                              {isAr ? '[ لا توجد حركات مسجلة لهذا الموظف ]' : '[ NO TRANSACTIONS FOUND FOR THIS EMPLOYEE ]'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {empStatementTxns.length > 0 && (
                        <tfoot className="bg-[#0a0a0d] border-t border-slate-850">
                          <tr>
                            <td colSpan={4} className="p-4 text-start font-black text-slate-400 text-[10px] uppercase tracking-wider">
                              {isAr ? 'المجموع الإجمالي للفترة' : 'Period Grand Totals'}
                            </td>
                            <td className="p-4 text-center font-mono font-black text-emerald-400">{empStmtDebit.toLocaleString()}</td>
                            <td className="p-4 text-center font-mono font-black text-rose-400">{empStmtCredit.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        })()}
    </>
  );
}
