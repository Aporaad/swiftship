/**
 * AddUserModal.tsx
 * نموذج إضافة مستخدم جديد للنظام
 * Modal form for adding a new system user
 */

import React, { useState } from 'react';
import { Crown, X, Eye, EyeOff } from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  t: (ar: string, en: string) => string;
  addFormData: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    systemPin: string;
    role: string;
    linkedType: string;
    linkedEntity: string;
  };
  setAddFormData: React.Dispatch<React.SetStateAction<any>>;
  handleAddUser: (e: React.FormEvent) => void;
  addLoading: boolean;
  roles: any[];
  couriersList: any[];
  employeesList: any[];
  showPassword?: boolean;
  setShowPassword?: (show: boolean) => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  isAr,
  t,
  addFormData,
  setAddFormData,
  handleAddUser,
  addLoading,
  roles,
  couriersList,
  employeesList,
  showPassword: controlledShowPassword,
  setShowPassword: controlledSetShowPassword,
}) => {
  const [localShowPassword, setLocalShowPassword] = useState(false);
  const showPassword = controlledShowPassword ?? localShowPassword;
  const setShowPassword = (show: boolean) => {
    controlledSetShowPassword?.(show);
    if (!controlledSetShowPassword) setLocalShowPassword(show);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/20 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-800/50 flex justify-between items-center bg-black/40 shrink-0">
          <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#d4af37]" />
            {t('إضافة موظف جديد', 'Add New Staff Member')}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleAddUser} className="p-6 space-y-4 overflow-y-auto flex-1 text-start" dir={isAr ? 'rtl' : 'ltr'}>
          {/* الاسم الكامل */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الاسم الكامل', 'Full Name')} *</label>
            <input
              required
              tabIndex={1}
              type="text"
              value={addFormData.fullName}
              onChange={e => setAddFormData({ ...addFormData, fullName: e.target.value })}
              className="w-full bg-black/50 border border-slate-800 text-slate-100 rounded-xl py-3 px-4 text-xs font-bold focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none transition-all"
            />
          </div>
          {/* اسم المستخدم و PIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('اسم المستخدم', 'Username')} *</label>
              <input
                required
                tabIndex={2}
                type="text"
                placeholder="arslan_ops"
                value={addFormData.username}
                onChange={e => setAddFormData({ ...addFormData, username: e.target.value })}
                className="w-full bg-black/50 border border-slate-800 text-slate-100 rounded-xl py-3 px-4 text-xs font-bold focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono transition-all"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('رمز PIN', 'Security PIN')}</label>
              <input
                tabIndex={3}
                type="text"
                maxLength={4}
                placeholder="1234"
                value={addFormData.systemPin}
                onChange={e => setAddFormData({ ...addFormData, systemPin: e.target.value })}
                className="w-full bg-black/50 border border-slate-800 text-slate-100 rounded-xl py-3 px-4 text-xs font-bold focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono text-center tracking-widest transition-all"
              />
            </div>
          </div>
          {/* البريد الإلكتروني */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('البريد الإلكتروني', 'Email')} *</label>
            <input
              required
              tabIndex={4}
              type="email"
              placeholder="name@company.com"
              value={addFormData.email}
              onChange={e => setAddFormData({ ...addFormData, email: e.target.value })}
              className="w-full bg-black/50 border border-slate-800 text-slate-100 rounded-xl py-3 px-4 text-xs font-bold focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono transition-all"
              dir="ltr"
            />
          </div>
          {/* كلمة المرور */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('كلمة المرور', 'Password')} *</label>
            <div className="relative">
              <input
                required
                tabIndex={5}
                type={showPassword ? 'text' : 'password'}
                value={addFormData.password}
                onChange={e => setAddFormData({ ...addFormData, password: e.target.value })}
                placeholder="••••••••"
                className={`w-full bg-black/50 border border-slate-800 text-slate-100 rounded-xl py-3 focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono text-xs font-bold transition-all ${isAr ? 'pr-4 pl-10' : 'pl-4 pr-10'}`}
                dir="ltr"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-500 hover:text-white`}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {/* الدور */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الدور والصلاحية', 'Assigned Role')}</label>
            <select
              tabIndex={6}
              value={addFormData.role}
              onChange={e => setAddFormData({ ...addFormData, role: e.target.value })}
              className="w-full bg-black/50 border border-slate-800 text-white rounded-xl py-3 px-4 focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none text-xs font-bold transition-all font-sans"
            >
              {roles.filter(r => r.id !== 'courier' && r.id !== 'Courier').map(r => <option key={r.id} value={r.id}>{r.title || r.id}</option>)}
            </select>
          </div>

          {/* ربط الكيان */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-3.5 rounded-xl border border-slate-800/80">
            <div>
              <label className="block text-[10px] font-black text-[#d4af37] mb-1.5 uppercase tracking-wider">{t('الربط مع كيان (شخص/حساب)', 'Link User to Entity')}</label>
              <select
                value={addFormData.linkedType}
                onChange={e => setAddFormData({ ...addFormData, linkedType: e.target.value, linkedEntity: '' })}
                className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold"
              >
                <option value="none">{t('غير مرتبط (حساب مستقل)', 'Standalone User')}</option>
                <option value="employee">{t('موظف (Employee)', 'Employee')}</option>
                <option value="courier">{t('مندوب (Courier)', 'Courier')}</option>
              </select>
            </div>
            {addFormData.linkedType !== 'none' && (
              <div>
                <label className="block text-[10px] font-black text-[#d4af37] mb-1.5 uppercase tracking-wider">
                  {addFormData.linkedType === 'employee' ? t('اختر الموظف المرتبط', 'Select Employee') : t('اختر المندوب المرتبط', 'Select Courier')}
                </label>
                <select
                  value={addFormData.linkedEntity}
                  onChange={e => setAddFormData({ ...addFormData, linkedEntity: e.target.value })}
                  className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold"
                >
                  <option value="">{t('اختر الكيان...', 'Select target...')}</option>
                  {addFormData.linkedType === 'employee'
                    ? employeesList.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.jobsType || 'موظف'})</option>)
                    : couriersList.map(c => <option key={c.id} value={c.id}>{c.fullName || c.name} ({c.phone || ''})</option>)
                  }
                </select>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800/50 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs transition active:scale-95">{t('إلغاء', 'Cancel')}</button>
            <button type="submit" disabled={addLoading} className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-50 text-black font-black text-xs rounded-xl shadow-md transition active:scale-95">
              {addLoading ? t('جاري الإنشاء...', 'Creating...') : t('إنشاء الحساب', 'Create Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
