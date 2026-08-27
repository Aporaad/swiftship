import React from 'react';
import { X } from 'lucide-react';

interface DeleteOrderModalProps {
  isOpen: boolean;
  orderToDelete: any;
  orderCount?: number;
  isDeleting?: boolean;
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
  orderCount = 1,
  isDeleting = false,
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
            ⚠️ {isAr ? (orderCount > 1 ? `حذف ${orderCount} طلبات حساس ومحمي` : 'حذف طلب حساس ومحمي') : (orderCount > 1 ? `Sensitive deletion of ${orderCount} orders` : 'Sensitive Order Deletion')}
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
              ? `سيُحذف ${orderCount > 1 ? `${orderCount} طلبات محددة` : 'الطلب المحدد'} مع المنتجات والشحنات والقيود والحركات والسجل والإشعارات والرسائل المرتبطة به بصورة دائمة. تبقى activity_logs دون حذف. أدخل رمز المدير للمتابعة.`
              : `${orderCount > 1 ? `${orderCount} selected orders` : 'The selected order'} and its linked products, shipments, journal entries, transactions, history, notifications, and messages will be permanently deleted. activity_logs will be preserved. Enter the administrator PIN to continue.`}
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
            disabled={isDeleting}
            className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl font-bold hover:text-white transition text-xs cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={onVerify}
            disabled={isDeleting}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black transition text-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? (isAr ? 'جارٍ الحذف...' : 'Deleting...') : (isAr ? 'تأكيد الحذف النهائي' : 'Verify & Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
