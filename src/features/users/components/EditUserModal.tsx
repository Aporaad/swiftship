/**
 * EditUserModal.tsx
 * نموذج تعديل بيانات مستخدم موجود في النظام
 * Modal form for editing an existing system user's data
 */

import React from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  t: (ar: string, en: string) => string;
  selectedUser: any;
  editFormData: {
    fullName: string;
    username: string;
    role: string;
    disabled: boolean;
    systemPin: string;
    linkedType: string;
    linkedEntity: string;
  };
  setEditFormData: React.Dispatch<React.SetStateAction<any>>;
  handleUpdateUser: (e: React.FormEvent) => void;
  editLoading: boolean;
  roles: any[];
  couriersList: any[];
  employeesList: any[];
  ROOT_EMAILS: string[];
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  isAr,
  t,
  selectedUser,
  editFormData,
  setEditFormData,
  handleUpdateUser,
  editLoading,
  roles,
  couriersList,
  employeesList,
  ROOT_EMAILS,
}) => {
  if (!isOpen || !selectedUser) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/20 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-800/50 flex justify-between items-center bg-black/40 shrink-0">
          <h3 className="font-black text-white text-xs uppercase tracking-widest">{t('تعديل بيانات الموظف', 'Edit Staff Member')}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleUpdateUser} className="p-6 space-y-4 overflow-y-auto flex-1 text-start" dir={isAr ? 'rtl' : 'ltr'}>
          {/* الاسم الكامل */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الاسم الكامل', 'Full Name')}</label>
            <input
              required
              tabIndex={1}
              type="text"
              value={editFormData.fullName}
              onChange={e => setEditFormData({ ...editFormData, fullName: e.target.value })}
              className="w-full bg-black/50 border border-slate-800 text-slate-100 rounded-xl py-3 px-4 text-xs font-bold focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('اسم المستخدم', 'Username')}</label>
              <input
                required
                tabIndex={2}
                type="text"
                value={editFormData.username}
                onChange={e => setEditFormData({ ...editFormData, username: e.target.value })}
                className="w-full bg-black/50 border border-slate-800 text-slate-100 rounded-xl py-3 px-4 text-xs font-bold focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono transition-all"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">PIN</label>
              <input
                tabIndex={3}
                type="text"
                maxLength={4}
                value={editFormData.systemPin}
                onChange={e => setEditFormData({ ...editFormData, systemPin: e.target.value })}
                className="w-full bg-black/50 border border-slate-800 text-slate-100 rounded-xl py-3 px-4 text-xs font-bold focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono text-center tracking-widest transition-all"
              />
            </div>
          </div>

          {/* الدور */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الدور والصلاحية', 'Assigned Role')}</label>
            <select
              tabIndex={4}
              disabled={ROOT_EMAILS.includes(selectedUser.email) || selectedUser.isRoot}
              value={editFormData.role}
              onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}
              className="w-full bg-black/50 border border-slate-800 text-white rounded-xl py-3 px-4 focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed font-sans transition-all"
            >
              {roles.filter(r => r.id !== 'courier' && r.id !== 'Courier').map(r => <option key={r.id} value={r.id}>{r.title || r.id}</option>)}
            </select>
          </div>

          {/* ربط الكيان */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-3.5 rounded-xl border border-slate-800/80">
            <div>
              <label className="block text-[10px] font-black text-[#d4af37] mb-1.5 uppercase tracking-wider">{t('الربط مع كيان (شخص/حساب)', 'Link User to Entity')}</label>
              <select
                value={editFormData.linkedType}
                onChange={e => setEditFormData({ ...editFormData, linkedType: e.target.value, linkedEntity: '' })}
                className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold"
              >
                <option value="none">{t('غير مرتبط (حساب مستقل)', 'Standalone User')}</option>
                <option value="employee">{t('موظف (Employee)', 'Employee')}</option>
                <option value="courier">{t('مندوب (Courier)', 'Courier')}</option>
              </select>
            </div>
            {editFormData.linkedType !== 'none' && (
              <div>
                <label className="block text-[10px] font-black text-[#d4af37] mb-1.5 uppercase tracking-wider">
                  {editFormData.linkedType === 'employee' ? t('اختر الموظف المرتبط', 'Select Employee') : t('اختر المندوب المرتبط', 'Select Courier')}
                </label>
                <select
                  value={editFormData.linkedEntity}
                  onChange={e => setEditFormData({ ...editFormData, linkedEntity: e.target.value })}
                  className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold"
                >
                  <option value="">{t('اختر الكيان...', 'Select target...')}</option>
                  {editFormData.linkedType === 'employee'
                    ? employeesList.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.jobsType || 'موظف'})</option>)
                    : couriersList.map(c => <option key={c.id} value={c.id}>{c.fullName || c.name} ({c.phone || ''})</option>)
                  }
                </select>
              </div>
            )}
          </div>

          {/* تعطيل/تفعيل الحساب */}
          {!ROOT_EMAILS.includes(selectedUser.email) && !selectedUser.isRoot && (
            <div className="bg-black/30 border border-slate-800 rounded-xl p-4 shrink-0">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setEditFormData({ ...editFormData, disabled: !editFormData.disabled })}
                  className={`w-11 h-6 rounded-full border transition-all flex items-center relative cursor-pointer ${editFormData.disabled ? 'bg-rose-900/30 border-rose-700/40' : 'bg-slate-800 border-slate-700'}`}
                >
                  <span className={`w-4 h-4 rounded-full transition-all absolute ${editFormData.disabled ? 'bg-rose-400 right-1' : 'bg-slate-500 left-1'}`}></span>
                </div>
                <div>
                  <span className={`block text-xs font-black uppercase ${editFormData.disabled ? 'text-rose-400' : 'text-slate-400'}`}>
                    {editFormData.disabled ? t('الحساب معطَّل', 'Account Disabled') : t('الحساب نشط', 'Account Active')}
                  </span>
                  <span className="block text-[9px] text-slate-600 mt-0.5">{t('يمنع تسجيل الدخول فوراً', 'Instantly prevents login')}</span>
                </div>
              </label>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800/50 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs transition active:scale-95">{t('إلغاء', 'Cancel')}</button>
            <button type="submit" disabled={editLoading} className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-50 text-black font-black text-xs rounded-xl shadow-md transition active:scale-95">
              {editLoading ? t('جاري الحفظ...', 'Saving...') : t('حفظ التغييرات', 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
