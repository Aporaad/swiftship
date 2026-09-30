import React from 'react';
import { Printer, Receipt, X } from 'lucide-react';

interface SalaryVoucherModalProps {
  isAr: boolean;
  settings: any;
  selectedSalaryVoucher: any | null;
  setSelectedSalaryVoucher: React.Dispatch<React.SetStateAction<any | null>>;
}

export default function SalaryVoucherModal({
  isAr,
  settings,
  selectedSalaryVoucher,
  setSelectedSalaryVoucher,
}: SalaryVoucherModalProps) {
  return (
    <>
      {/* ════════════ SALARY SLIP VOUCHER MODAL ════════════ */}
      {selectedSalaryVoucher && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-[#0c0c0f] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col font-sans" id="salary-print-modal">
            <div className="bg-black/40 p-5 border-b border-slate-850 flex justify-between items-center shrink-0 no-print">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'سند صرف راتب شهري رسمي' : 'Official Salary Slip Voucher'}
              </h3>
              <button onClick={() => setSelectedSalaryVoucher(null)} className="text-slate-500 hover:text-white p-1 bg-slate-900 border border-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-8 space-y-6 text-start flex-1 overflow-y-auto bg-white text-black font-sans leading-relaxed select-all">
              <div className="text-center pb-6 border-b border-slate-300">
                <h2 className="text-lg font-black tracking-wider text-slate-800">{settings.systemName || settings.companyName || 'alx'}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{isAr ? 'سند صرف رواتب الموظفين' : 'Salary Payout Receipt'}</p>
                <p className="text-[9px] font-mono text-slate-400 mt-0.5">{selectedSalaryVoucher.voucherCode}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">{isAr ? 'الموظف المستلم' : 'Staff Member'}</span>
                  <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{selectedSalaryVoucher.employeeName}</span>
                  <span className="text-[10px] font-mono text-slate-600 block mt-0.5">{isAr ? 'حساب: ' : 'A/C: '}{selectedSalaryVoucher.accountCode}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">{isAr ? 'تاريخ الصرف' : 'Payment Date'}</span>
                  <span className="font-bold text-slate-700 mt-0.5 block font-mono">
                    {new Date(selectedSalaryVoucher.paidAt || selectedSalaryVoucher.createdAt).toLocaleString(isAr ? 'ar-YE' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">{isAr ? 'الشهر المستحق' : 'Salary Period'}</span>
                  <span className="font-mono font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded">{selectedSalaryVoucher.salaryMonth}</span>
                </div>
                <div className="border-t border-slate-200/80 my-2 pt-2 flex justify-between items-center text-sm font-black">
                  <span className="text-slate-800">{isAr ? 'المبلغ الصافي المصروف' : 'Net Amount Disbursed'}</span>
                  <span className="font-mono text-lg text-emerald-600">{(selectedSalaryVoucher.amount || 0).toLocaleString()} {selectedSalaryVoucher.currency || 'YER'}</span>
                </div>
              </div>
              <div className="text-xs">
                <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1">{isAr ? 'البيان' : 'Narrative'}</span>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic font-bold">
                  {selectedSalaryVoucher.notes || (isAr ? `صرف راتب شهر ${selectedSalaryVoucher.salaryMonth}` : `Salary paid for ${selectedSalaryVoucher.salaryMonth}`)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center pt-8 border-t border-slate-200/80 text-[10px] font-bold text-slate-600">
                <div className="space-y-8"><span>{isAr ? 'توقيع أمين الصندوق' : 'Cashier'}</span><div className="border-b border-slate-300 w-3/4 mx-auto"></div></div>
                <div className="space-y-8"><span>{isAr ? 'توقيع المحاسب' : 'Accountant'}</span><div className="border-b border-slate-300 w-3/4 mx-auto"></div></div>
                <div className="space-y-8"><span>{isAr ? 'توقيع المستلم' : 'Recipient'}</span><div className="border-b border-slate-300 w-3/4 mx-auto"></div></div>
              </div>
            </div>
            <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-end gap-3 shrink-0 no-print">
              <button type="button" onClick={() => setSelectedSalaryVoucher(null)} className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-850/40 rounded-xl transition">
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button onClick={() => window.print()} className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> {isAr ? 'طباعة السند' : 'Print Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
