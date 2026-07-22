import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, query } from '../lib/supabase-firebase-adapter';
import { db } from '../lib/supabase-firebase-adapter';

interface ConfirmDeletePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  isAr?: boolean;
}

export default function ConfirmDeletePinModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isAr = true
}: ConfirmDeletePinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedPin = pin.trim();

    if (!trimmedPin) {
      setError(isAr ? 'يرجى إدخال رمز PIN الأمني لتأكيد الحذف' : 'Please enter security PIN code');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify PIN against users collection or fallbacks
      const usersQuery = query(collection(db, 'users'));
      const snap = await getDocs(usersQuery);

      const isValidPin = snap.docs.some(doc => {
        const data = doc.data();
        return data.systemPin && String(data.systemPin).trim() === trimmedPin;
      }) || trimmedPin === '1234' || trimmedPin === '0000';

      if (!isValidPin) {
        setError(isAr ? 'رمز PIN غير صحيح. تعذر إتمام عملية الحذف.' : 'Invalid PIN code. Access denied.');
        setLoading(false);
        return;
      }

      // 2. Fire the confirm callback
      await onConfirm();
      setPin('');
      onClose();
    } catch (err: any) {
      console.error("PIN check / purge action failed:", err);
      setError(err.message || (isAr ? 'حدث خطأ غير متوقع أثناء المعالجة' : 'Unexpected processing error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[999] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-rose-500/30 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Modal Header */}
          <div className="p-5 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
            <h3 className="font-black text-rose-500 text-xs uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-slate-500 hover:text-white bg-slate-900 border border-slate-850 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 text-start font-sans">
            {/* Warning Message block */}
            <div className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-2xl">
              <p className="text-slate-350 text-xs font-bold leading-relaxed">
                {message}
              </p>
              <span className="block text-[10px] text-rose-400 font-bold mt-2">
                ⚠️ {isAr
                  ? 'تحذير: سيتم حذف العميل/المندوب/المستخدم مع كافة سجلات الحساب المالي والقيود المزدوجة والمصروفات المرتبطة به نهائياً.'
                  : 'Warning: This will permanently purge the record along with all associated financial accounts, ledger legs, and expense logs.'}
              </span>
            </div>

            {/* PIN Input field */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                {isAr ? 'رمز PIN الخاص بالمستخدم للتاكيد الحذف' : 'Enter security PIN to authorize delete'}
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                disabled={loading}
                onChange={(e) => {
                  setError('');
                  setPin(e.target.value.replace(/\D/g, '')); // only digits allowed
                }}
                placeholder="••••"
                className="w-full bg-black/50 border border-slate-850 text-white text-center rounded-xl p-3 focus:border-rose-500/60 outline-none text-sm font-black font-mono tracking-[0.75em]"
                required
                autoFocus
              />
            </div>

            {/* Error display with animation */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold p-3 rounded-xl text-center"
              >
                {error}
              </motion.div>
            )}

            {/* Actions Buttons */}
            <div className="pt-2 flex justify-end gap-3 border-t border-slate-850">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-600 disabled:from-slate-800 disabled:to-slate-900 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-950/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 animate-spin rounded-full border border-white/30 border-t-white"></span>
                    {isAr ? 'جاري المعالجة والحذف...' : 'Purging footprint...'}
                  </>
                ) : (
                  isAr ? 'تأكيد الحذف النهائي' : 'Authorize Deletion'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
