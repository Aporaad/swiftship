import React from 'react';
import { CheckCircle, RefreshCw, X } from 'lucide-react';

interface CustomerFifoPaymentModalProps {
  auditedCustomerId: string;
  customerLedgerDetails: any;
  handleCustomerFIFOPayment: (event: React.FormEvent) => Promise<void>;
  isAr: boolean;
  isPayModalOpen: boolean;
  orders: any[];
  payAmount: string;
  payLoading: boolean;
  payNotes: string;
  setIsPayModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPayAmount: React.Dispatch<React.SetStateAction<string>>;
  setPayNotes: React.Dispatch<React.SetStateAction<string>>;
}

export default function CustomerFifoPaymentModal({
  auditedCustomerId,
  customerLedgerDetails,
  handleCustomerFIFOPayment,
  isAr,
  isPayModalOpen,
  orders,
  payAmount,
  payLoading,
  payNotes,
  setIsPayModalOpen,
  setPayAmount,
  setPayNotes,
}: CustomerFifoPaymentModalProps) {
  return (
    <>
      {/* MODAL 2: CUSTOMER BILATERAL DEBT Settle PAYMENT (FIFO chronological Queue) */}
      {isPayModalOpen && customerLedgerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start">
          <div className="bg-[#121215] border border-slate-850 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-fade-in">
            <button
              onClick={() => setIsPayModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-all pointer-events-auto cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 border-b border-slate-850">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {isAr ? 'توريد وسداد دفعة في مستند مستقل' : 'Apply Balance Payment FIFO'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                {isAr ? `تطبيق دفعة مالية بقيمة معقولة على ديون العميل: ${customerLedgerDetails.customer.fullName}.` : `Settle outstanding payments of client ${customerLedgerDetails.customer.fullName} chronologically.`}
              </p>
            </div>

            <form onSubmit={handleCustomerFIFOPayment} className="p-6 space-y-4">

              {/* Debt Warning Box */}
              <div className="bg-[#d4af37]/5 border border-[#d4af37]/15 p-3.5 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase">{isAr ? 'المديونية العالقة الإجمالية YER' : 'Outstanding Liability'}</span>
                  <span className="text-amber-500 font-mono font-black text-sm">{customerLedgerDetails.currentOutstandingBalance.toLocaleString()} YER</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9.5px] uppercase">{isAr ? 'الفواتير المطالبة' : 'Unpaid Cargo'}</span>
                  <span className="text-white font-mono font-black text-sm">
                    {orders.filter(o => o.customerId === auditedCustomerId && parseFloat(o.amountRemaining || 0) > 0).length}
                  </span>
                </div>
              </div>

              {/* Paid Cash Input */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'قيمة تحصيل السداد المقبوض YER' : 'Amount Billed Payment YER'}</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black/40 border border-slate-850 text-[#d4af37] rounded-xl px-3.5 py-2.5 text-sm font-black outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Settle Details */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'البيان وملاحظات السند' : 'Payment descriptions / Receipts'}</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder={isAr ? "تفاصيل إضافية: سداد عبر الكريمي، تحصيلات حية" : "Under account transfer via Al-Kuraimi"}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="pt-3 border-t border-slate-850 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="w-1/2 bg-slate-900 hover:bg-slate-800 text-slate-350 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="w-1/2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {payLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {isAr ? 'توريد وسداد بالخزينة' : 'Settle Chronology'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
