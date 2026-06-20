import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Search, 
  FileText, 
  X, 
  Printer, 
  Coins, 
  Calendar, 
  User, 
  ShieldAlert, 
  DollarSign, 
  Receipt,
  UserCheck,
  CheckCircle,
  Eye
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';

export default function SalaryHistory() {
  const { role, hasPermission, loading: roleLoading } = useRole();
  const { settings, t } = useSettings();
  const isAr = settings.language === 'ar';

  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('');

  // Selected Voucher for Modal Receipt View
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  useEffect(() => {
    if (roleLoading) return;

    // 1. Subscribe to salary history
    const qHistory = query(collection(db, 'salary_history'), orderBy('createdAt', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      setSalaryHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("[SalaryHistory] Error fetching salary history:", err);
      setLoading(false);
    });

    // 2. Subscribe to users/staff for dropdown filter
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("[SalaryHistory] Error fetching users:", err);
    });

    return () => {
      unsubHistory();
      unsubUsers();
    };
  }, [roleLoading]);

  // Compute metrics
  const totalSalariesPaid = salaryHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const totalPaymentsCount = salaryHistory.length;
  const uniqueEmployeesPaid = new Set(salaryHistory.map(item => item.employeeId)).size;

  // Filtered dataset
  const filteredHistory = salaryHistory.filter(item => {
    const matchesSearch = !search.trim() || 
      (item.employeeName || '').toLowerCase().includes(search.toLowerCase()) || 
      (item.voucherCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.accountCode || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesEmployee = employeeFilter === 'all' || item.employeeId === employeeFilter;
    const matchesMonth = !monthFilter || item.salaryMonth === monthFilter;

    return matchesSearch && matchesEmployee && matchesMonth;
  });

  const handlePrintVoucher = () => {
    window.print();
  };

  if (roleLoading || loading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  // Access check
  if (!hasPermission('view_finance') && role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
          {isAr ? 'هذه الصفحة مخصصة للمسؤولين الماليين لعرض سجل رواتب الموظفين.' : 'This page is restricted to financial administrators.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors font-sans selection:bg-[#d4af37]/30">
      
      {/* Printable Receipt CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt-modal, #printable-receipt-modal * {
            visibility: visible;
          }
          #printable-receipt-modal {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">{isAr ? 'سجل رواتب الموظفين' : 'Staff Salary History'}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isAr ? 'مراقبة ومطابقة وجرد رواتب وعقود موظفي الشركة وحساباتهم' : 'Monitor, audit and record staff payroll details & history'}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Salaries Card */}
        <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
          <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'إجمالي الرواتب المصروفة' : 'Total Salaries Paid'}</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-mono font-black text-[#d4af37]">
              {totalSalariesPaid.toLocaleString()}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">{settings.currency || 'YER'}</span>
            </span>
            <Coins className="w-6 h-6 text-[#d4af37]/20 shrink-0" />
          </div>
        </div>

        {/* Payments Count Card */}
        <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
          <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'عدد الدفعات المصروفة' : 'Salary Slips Issued'}</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-mono font-black text-emerald-400">
              {totalPaymentsCount}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">{isAr ? 'دفعة' : 'slips'}</span>
            </span>
            <Receipt className="w-6 h-6 text-emerald-500/20 shrink-0" />
          </div>
        </div>

        {/* Employees Paid Card */}
        <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
          <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'الموظفين المستلمين للرواتب' : 'Staff Members Settled'}</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-mono font-black text-cyan-400">
              {uniqueEmployeesPaid}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">{isAr ? 'موظف' : 'members'}</span>
            </span>
            <UserCheck className="w-6 h-6 text-cyan-500/20 shrink-0" />
          </div>
        </div>
      </div>

      {/* Filter Belt */}
      <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input 
            type="text"
            placeholder={isAr ? 'ابحث باسم الموظف أو رقم السند أو الحساب...' : 'Search employee, slip code or account...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/50 outline-none text-start"
          />
        </div>

        {/* Employee Filter */}
        <div className="relative min-w-[180px]">
          <select 
            value={employeeFilter}
            onChange={e => setEmployeeFilter(e.target.value)}
            className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer text-start"
          >
            <option value="all">{isAr ? 'كل الموظفين' : 'All Staff Members'}</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.fullName || emp.email}</option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div className="relative min-w-[140px]">
          <input 
            type="month"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50 font-mono text-center cursor-pointer"
          />
        </div>

        {/* Reset button if month filter selected */}
        {monthFilter && (
          <button 
            onClick={() => setMonthFilter('')}
            className="bg-slate-900 hover:bg-slate-850 text-slate-400 p-2.5 rounded-xl border border-slate-850 text-xs font-black transition-all"
          >
            {isAr ? 'إلغاء الفلتر الشهري' : 'Clear Month'}
          </button>
        )}
      </div>

      {/* Salary History Table */}
      <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-850">
              <tr>
                <th className="p-4 text-start">{isAr ? 'تاريخ وساعة الصرف' : 'Posting Timeline'}</th>
                <th className="p-4 text-start">{isAr ? 'المستلم (الموظف)' : 'Liable Recipient'}</th>
                <th className="p-4 text-start">{isAr ? 'رقم الحساب' : 'Account Code'}</th>
                <th className="p-4 text-center">{isAr ? 'الشهر المستحق' : 'Salary Month'}</th>
                <th className="p-4 text-start">{isAr ? 'رقم السند/المرجع' : 'Voucher ID'}</th>
                <th className="p-4 text-start">{isAr ? 'البيان/ملاحظات' : 'Narrative Notes'}</th>
                <th className="p-4 text-center">{isAr ? 'القيمة المصروفة' : 'Amount paid'}</th>
                <th className="p-4 text-left">{isAr ? 'تفاصيل ومعاينة' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60 bg-black/10">
              {filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-950/40 transition-colors">
                  <td className="p-4 font-mono font-bold text-slate-400 text-start" dir="ltr">
                    {new Date(item.paidAt || item.createdAt).toLocaleString(isAr ? 'ar-YE' : 'en-US', { 
                      year: '2-digit', 
                      month: '2-digit', 
                      day: '2-digit', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </td>
                  <td className="p-4 text-start">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center font-black text-[10px] text-[#d4af37] shrink-0">
                        {item.employeeName?.substring(0, 1)}
                      </div>
                      <span className="font-extrabold text-white">{item.employeeName}</span>
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
                  <td className="p-4 text-center font-mono font-black text-xs text-emerald-450">
                    {(item.amount || 0).toLocaleString()} {item.currency || settings.currency}
                  </td>
                  <td className="p-4 text-left flex justify-end">
                    <button
                      onClick={() => setSelectedVoucher(item)}
                      title={isAr ? 'معاينة وطباعة سند الصرف' : 'View & Print Salary Slip'}
                      className="text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 border border-[#d4af37]/15 p-2 rounded-xl transition duration-300 flex items-center gap-1.5 font-bold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[10px]">{isAr ? 'معاينة' : 'View'}</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                    {isAr ? '[ لم يتم العثور على أي قيود صرف رواتب متطابقة ]' : '[ NO SALARY PAYOUT LOGS FOUND MATCHING FILTERS ]'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Slip / Payout Voucher Details Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-[#0c0c0f] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col font-sans" id="printable-receipt-modal">
            
            {/* Modal Header */}
            <div className="bg-black/40 p-5 border-b border-slate-850 flex justify-between items-center shrink-0 no-print">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'سند صرف راتب شهري رسمي' : 'Official Salary Slip Voucher'}
              </h3>
              <button 
                onClick={() => setSelectedVoucher(null)}
                className="text-slate-500 hover:text-white p-1 bg-slate-900 border border-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Voucher Body (Optimized for both screen & paper printout) */}
            <div className="p-8 space-y-6 text-start flex-1 overflow-y-auto bg-white text-black font-sans leading-relaxed select-all">
              
              {/* Receipt Top Header */}
              <div className="text-center pb-6 border-b border-slate-300">
                <h2 className="text-lg font-black tracking-wider text-slate-800">{settings.systemName || settings.companyName || 'alx Tracking'}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{isAr ? 'سند صرف رواتب الموظفين' : 'Salary Payout Receipt'}</p>
                <p className="text-[9px] font-mono text-slate-400 mt-0.5">{selectedVoucher.voucherCode}</p>
              </div>

              {/* Receipt Meta Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">{isAr ? 'الموظف المستلم' : 'Liable Staff Member'}</span>
                  <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{selectedVoucher.employeeName}</span>
                  <span className="text-[10px] font-mono text-slate-600 block mt-0.5">{isAr ? 'حساب مالي: ' : 'A/C: '}{selectedVoucher.accountCode}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">{isAr ? 'تاريخ الصرف والتقييد' : 'Posting Timeline'}</span>
                  <span className="font-bold text-slate-700 mt-0.5 block font-mono">
                    {new Date(selectedVoucher.paidAt || selectedVoucher.createdAt).toLocaleString(isAr ? 'ar-YE' : 'en-US', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {/* Salary details card */}
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">{isAr ? 'الشهر المستحق للراتب' : 'Salary Period Month'}</span>
                  <span className="font-mono font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-[11px]">{selectedVoucher.salaryMonth}</span>
                </div>
                <div className="border-t border-slate-200/80 my-2 pt-2 flex justify-between items-center text-sm font-black">
                  <span className="text-slate-800">{isAr ? 'المبلغ الصافي المصروف' : 'Net Amount Disbursed'}</span>
                  <span className="font-mono text-lg text-emerald-600">
                    {(selectedVoucher.amount || 0).toLocaleString()} {selectedVoucher.currency || settings.currency}
                  </span>
                </div>
              </div>

              {/* Remarks/Notes */}
              <div className="text-xs">
                <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1">{isAr ? 'شرح وبيان السند' : 'Journal Explanation Narrative'}</span>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic font-bold">
                  {selectedVoucher.notes || (isAr ? `صرف راتب الموظف المستحق لشهر ${selectedVoucher.salaryMonth}` : `Staff monthly salary paid for ${selectedVoucher.salaryMonth}`)}
                </p>
              </div>

              {/* Authority Signatures */}
              <div className="grid grid-cols-3 gap-4 text-center pt-8 border-t border-slate-200/80 text-[10px] font-bold text-slate-600">
                <div className="space-y-8">
                  <span>{isAr ? 'توقيع أمين الصندوق' : 'Cashier Sign'}</span>
                  <div className="border-b border-slate-300 w-3/4 mx-auto"></div>
                </div>
                <div className="space-y-8">
                  <span>{isAr ? 'توقيع المحاسب' : 'Accountant Sign'}</span>
                  <div className="border-b border-slate-300 w-3/4 mx-auto"></div>
                </div>
                <div className="space-y-8">
                  <span>{isAr ? 'توقيع المستلم (الموظف)' : 'Recipient Staff Sign'}</span>
                  <div className="border-b border-slate-300 w-3/4 mx-auto"></div>
                </div>
              </div>

              {/* Stamp or verification */}
              <div className="text-center pt-4 text-[9px] font-mono text-slate-400 no-print flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isAr ? 'سند الكتروني معتمد ومقيد بالدفاتر المركزية' : 'Digital voucher verified and processed'}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-end gap-3 shrink-0 no-print">
              <button 
                type="button" 
                onClick={() => setSelectedVoucher(null)} 
                className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-850/40 rounded-xl transition"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button 
                onClick={handlePrintVoucher}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> {isAr ? 'طباعة السند' : 'Print Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
