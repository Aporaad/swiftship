/**
 * ChangePasswordModal.tsx
 * مودال تغيير كلمة المرور مباشرة من قبل المدير
 * Admin direct password change modal
 */

import React from 'react';
import { Key, X } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  t: (ar: string, en: string) => string;
  passwordTargetUser: any;
  newPasswordValue: string;
  setNewPasswordValue: (val: string) => void;
  handleAdminChangePassword: (e: React.FormEvent) => void;
  passwordLoading: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  isAr,
  t,
  passwordTargetUser,
  newPasswordValue,
  setNewPasswordValue,
  handleAdminChangePassword,
  passwordLoading,
}) => {
  if (!isOpen || !passwordTargetUser) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/20 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-800/50 flex justify-between items-center bg-black/40 shrink-0">
          <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            {t('تغيير كلمة المرور مباشرة', 'Direct Password Change')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleAdminChangePassword} className="p-6 space-y-4 overflow-y-auto flex-1 text-start" dir={isAr ? 'rtl' : 'ltr'}>
          {/* معلومات المستخدم المستهدف */}
          <div className="flex items-center gap-3 p-3 bg-black/40 border border-slate-800/40 rounded-xl shrink-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-[10px]">
              {passwordTargetUser.fullName?.substring(0, 2)}
            </div>
            <div>
              <div className="text-xs font-black text-white">{passwordTargetUser.fullName}</div>
              <div className="text-[9px] text-slate-500 font-mono">{passwordTargetUser.email}</div>
            </div>
          </div>

          {/* حقل كلمة المرور الجديدة */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('كلمة المرور الجديدة', 'New Password')}</label>
            <input
              required
              tabIndex={1}
              type="text"
              placeholder="••••••••"
              value={newPasswordValue}
              onChange={e => setNewPasswordValue(e.target.value)}
              className="w-full bg-black/50 border border-slate-800 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono transition-all"
              dir="ltr"
            />
            <span className="block text-[8px] text-slate-500 mt-1">
              {t('سيتغير تسجيل الدخول للمستخدم فوراً بهذا المفتاح دون الحاجة لبريده الإلكتروني.', "This will instantly change the user's password in Supabase Authentication directly.")}
            </span>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-800/50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs transition active:scale-95"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={passwordLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-700 hover:to-amber-500 disabled:opacity-50 text-black font-black text-xs rounded-xl shadow-md transition active:scale-95"
            >
              {passwordLoading ? t('جاري التغيير...', 'Changing...') : t('تغيير الآن', 'Change Now')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
