import React from 'react';
import { Crown, X, MapPin, DollarSign } from 'lucide-react';
import type { CourierFormValues, CourierSystemUserFormValues } from '../types';

interface AddCourierModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  addFormData: CourierFormValues;
  setAddFormData: React.Dispatch<React.SetStateAction<CourierFormValues>>;
  createSystemUser: boolean;
  setCreateSystemUser: React.Dispatch<React.SetStateAction<boolean>>;
  systemUserFormData: CourierSystemUserFormValues;
  setSystemUserFormData: React.Dispatch<React.SetStateAction<CourierSystemUserFormValues>>;
  addLoading: boolean;
  handleAddSubmit: React.FormEventHandler<HTMLFormElement>;
}

export function AddCourierModal({
  isOpen,
  onClose,
  isAr,
  addFormData,
  setAddFormData,
  createSystemUser,
  setCreateSystemUser,
  systemUserFormData,
  setSystemUserFormData,
  addLoading,
  handleAddSubmit,
}: AddCourierModalProps) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddSubmit} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تسجيل وتقييد مندوب لوجستي' : 'Engage New Logistics Courier'}
              </h3>
              <button type="button" onClick={() => onClose} className="text-slate-550 hover:text-white p-1 bg-slate-900 border border-slate-800 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-start">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الثلاثي للمندوب' : 'Full Name'}</label>
                <input required type="text" value={addFormData.fullName} onChange={(e) => setAddFormData({ ...addFormData, fullName: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الهوية الجوال' : 'Cellphone'}</label>
                  <input required placeholder="+967..." type="tel" value={addFormData.phone} onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" dir="ltr" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني للولوج' : 'Login Mail ID'}</label>
                  <input type="email" placeholder="courier@swiftship.net" value={addFormData.email} onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" dir="ltr" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'مستقر السكن الحالي' : 'Courier Base Address'}</label>
                <input placeholder="صنعاء - شارع الخمسين" type="text" value={addFormData.address} onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'مسارات التتبع والموقع الفعلي (GPS)' : 'Live GPS Coords/Maps Link'}</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4af37] w-4 h-4" />
                  <input type="text" value={addFormData.gpsLocation} onChange={(e) => setAddFormData({ ...addFormData, gpsLocation: e.target.value })} placeholder="https://maps.google.com/?q=..." className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 pl-10 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'العمولة من عمليات التوزيع (%)' : 'Standard Commission Rate (%)'}</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-550 w-4 h-4" />
                    <input type="number" min="0" max="100" step="0.1" value={addFormData.commissionRate} onChange={(e) => setAddFormData({ ...addFormData, commissionRate: parseFloat(e.target.value) || 0 })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 pl-10 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'نوع المندوب' : 'Courier Type'}</label>
                  <select
                    value={addFormData.courierType}
                    onChange={(e) => setAddFormData({ ...addFormData, courierType: e.target.value as 'local' | 'sourcing' })}
                    className="w-full bg-black/50 border border-[#d4af37]/25 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  >
                    <option value="local" className="bg-[#121215] text-white">{isAr ? 'مندوب محلي (اليمن)' : 'Local / Delivery'}</option>
                    <option value="sourcing" className="bg-[#121215] text-[#d4af37]">{isAr ? 'مندوب تجميع (سعودي)' : 'Sourcing / Collection'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'تقرير وملاحظات التسجيل' : 'Induction confidential remarks'}</label>
                <textarea value={addFormData.notes} onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none h-20 text-start"></textarea>
              </div>

              {/* ── System User Provisioning Section ──────────────────────────────── */}
              <div className="pt-3 border-t border-slate-850 space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-all">
                  <input
                    type="checkbox"
                    checked={createSystemUser}
                    onChange={(e) => setCreateSystemUser(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-[#d4af37] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-black text-[#d4af37]">
                    {isAr ? 'إنشاء مستخدم في النظام (users) للمندوب وربطه به تلقائياً' : 'Create System Login User (users) for Courier'}
                  </span>
                </label>

                {createSystemUser && (
                  <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 space-y-3 text-start animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'اسم المستخدم للنظام *' : 'System Username *'}</label>
                        <input
                          required={createSystemUser}
                          type="text"
                          placeholder="courier_user"
                          value={systemUserFormData.username}
                          onChange={(e) => setSystemUserFormData({ ...systemUserFormData, username: e.target.value })}
                          className="w-full bg-black border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'البريد الإلكتروني للنظام' : 'System Email'}</label>
                        <input
                          type="email"
                          placeholder="courier@system.local"
                          value={systemUserFormData.email}
                          onChange={(e) => setSystemUserFormData({ ...systemUserFormData, email: e.target.value })}
                          className="w-full bg-black border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'كلمة المرور *' : 'Password *'}</label>
                        <input
                          required={createSystemUser}
                          type="password"
                          placeholder="••••••••"
                          value={systemUserFormData.password}
                          onChange={(e) => setSystemUserFormData({ ...systemUserFormData, password: e.target.value })}
                          className="w-full bg-black border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'رمز PIN للنظام' : 'System PIN'}</label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="1234"
                          value={systemUserFormData.systemPin}
                          onChange={(e) => setSystemUserFormData({ ...systemUserFormData, systemPin: e.target.value })}
                          className="w-full bg-black border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono tracking-widest text-center"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'الدور والصلاحية' : 'System Role'}</label>
                        <select
                          value={systemUserFormData.role}
                          onChange={(e) => setSystemUserFormData({ ...systemUserFormData, role: e.target.value })}
                          className="w-full bg-black border border-slate-800 text-white rounded-xl p-2.5 text-xs font-bold outline-none focus:border-[#d4af37]/60 cursor-pointer"
                        >
                          <option value="Courier">{isAr ? 'مندوب توصيل (Courier)' : 'Courier'}</option>
                          <option value="Staff">{isAr ? 'موظف (Staff)' : 'Staff'}</option>
                          <option value="Admin">{isAr ? 'مدير نظام (Admin)' : 'Admin'}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => onClose} className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-850 rounded-xl transition-colors text-xs">{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={addLoading} className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-40 text-black font-black rounded-xl shadow-md transition-all text-xs active:scale-95">
                {addLoading ? (isAr ? 'جاري التسجيل والربط...' : 'Creating login...') : (isAr ? 'حفظ وإصدار كود المندوب' : 'Register Courier')}
              </button>
            </div>
          </form>
        </div>
  );
}
