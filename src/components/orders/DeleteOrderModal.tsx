import React from 'react';
import { X } from 'lucide-react';

interface DeleteOrderModalProps {
  isOpen: boolean;
  orderToDelete: any;
  deletePin: string;
  deleteError: string;
  setDeletePin: (v: string) => void;
  setDeleteError: (v: string) => void;
  onClose: () => void;
  onVerify: () => void;
  isAr: boolean;
}

export default function DeleteOrderModal({
  isOpen,
  orderToDelete,
  deletePin,
  deleteError,
  setDeletePin,
  setDeleteError,
  onClose,
  onVerify,
  isAr,
}: DeleteOrderModalProps) {
  if (!isOpen || !orderToDelete) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border-2 border-rose-500/30 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col">
        <div className="p-4 bg-rose-950/20 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-black text-rose-450 text-sm flex items-center gap-2">
            ⚠️ {isAr ? 'حذف طلب حساس ومحمي' : 'Sensitive Order Deletion'}
          </h3>
          <button
            onClick={onClose}
            className="bg-slate-800 text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs font-bold text-slate-350 text-center">
          <p className="text-slate-400 leading-relaxed text-center">
            {isAr
              ? 'هذا الطلب يحتوي على مدفوعات مسجلة أو تخطت حالته التثبيت الأولي. يرجى إدخال الرمز السري الشخصي للمدير (System PIN) للمتابعة.'
              : 'This order has payments recorded or is advanced in the logistics process. Please enter your personal System PIN to confirm deletion.'}
          </p>

          {deleteError && (
            <div className="bg-rose-950/30 text-rose-400 p-2.5 rounded-xl border border-rose-900/30 font-mono text-center">
              {deleteError}
            </div>
          )}

          <input
            type="password"
            value={deletePin}
            onChange={(e) => {
              setDeletePin(e.target.value);
              setDeleteError('');
            }}
            className="block w-full px-4 py-3 bg-black border border-slate-850 rounded-xl text-white outline-none focus:border-rose-500 text-center font-mono text-xl tracking-[0.5em]"
            placeholder="••••••"
            maxLength={10}
            autoFocus
          />
        </div>

        <div className="p-4 bg-slate-950/30 border-t border-slate-850 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl font-bold hover:text-white transition text-xs cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={onVerify}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black transition text-xs cursor-pointer"
          >
            {isAr ? 'تأكيد الحذف النهائي' : 'Verify & Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
