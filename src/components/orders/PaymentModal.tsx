import React from 'react';
import { Plus } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  selectedOrder: any;
  paymentFormData: {
    amount: string;
    method: string;
    notes: string;
    pin: string;
  };
  setPaymentFormData: (v: any) => void;
  isSubmitting: boolean;
  isAr: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function PaymentModal({
  isOpen,
  selectedOrder,
  paymentFormData,
  setPaymentFormData,
  isSubmitting,
  isAr,
  onClose,
  onSubmit,
}: PaymentModalProps) {
  if (!isOpen || !selectedOrder) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden text-start shadow-xl">
        <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center text-xs font-black text-white">
          <span>{isAr ? 'تحصيل دفعة مالية من العميل' : 'Post payment ledger'}</span>
          <button
            onClick={onClose}
            className="text-slate-400 bg-slate-800 p-1 rounded-lg"
          >
            <Plus className="w-4 h-4 rotate-45" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4 text-xs font-bold text-slate-300 font-sans">
          <div>
            <label className="block text-slate-500 mb-1">
              {isAr ? 'رقم الطلب' : 'Smart order code'}
            </label>
            <span className="font-mono text-[#d4af37] font-black text-sm">
              {selectedOrder.orderNumber}
            </span>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">
              {isAr ? 'إجمالي المتبقي للتحصيل' : 'Total dues left'}
            </label>
            <span className="font-mono text-rose-400 font-extrabold text-base">
              {parseFloat(selectedOrder.amountRemaining || 0).toLocaleString()} YER
            </span>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">
              {isAr ? 'المقدار المحصل المقبوض الآن (ريال يمني)' : 'Collection amount in YER'}
            </label>
            <input
              required
              type="number"
              step="any"
              value={paymentFormData.amount}
              onChange={e => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-sm font-black p-3 rounded-xl outline-none text-center"
              placeholder="0.00 YER"
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-1 text-amber-500 flex items-center gap-1">
              <span>{isAr ? 'رمز الـ PIN المالي الثنائي للتحقق' : 'Security PIN authorization'}</span>
              <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1.5 rounded font-sans uppercase">MANDATORY</span>
            </label>
            <input
              required
              type="password"
              maxLength={6}
              pattern="^[0-9]{4,6}$"
              title={isAr ? "رمز PIN سري من 4 إلى 6 أرقام" : "A 4-6 digit security PIN code"}
              value={paymentFormData.pin}
              onChange={e => setPaymentFormData({ ...paymentFormData, pin: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-yellow-500 font-mono text-sm font-black p-3 rounded-xl outline-none text-center tracking-widest"
              placeholder="••••"
            />
            <p className="text-[9px] text-slate-500 mt-1">
              {isAr
                ? 'اكتب الـ PIN الخاص بك المخزن في ملف الموظف لتفويض المعاملة.'
                : 'Enter your professional profile PIN to authorize transaction.'}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg disabled:opacity-50"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? (isAr ? 'جاري التحصيل...' : 'Settling...')
                : (isAr ? 'تأكيد ترحيل القبض' : 'Settle payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
