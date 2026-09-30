import React from 'react';
import { X } from 'lucide-react';
import type { CourierEditFormValues } from '../types';

interface EditCourierModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  editFormData: CourierEditFormValues;
  setEditFormData: React.Dispatch<React.SetStateAction<CourierEditFormValues>>;
  editLoading: boolean;
  handleEditSubmit: React.FormEventHandler<HTMLFormElement>;
}

export function EditCourierModal({
  isOpen,
  onClose,
  isAr,
  editFormData,
  setEditFormData,
  editLoading,
  handleEditSubmit,
}: EditCourierModalProps) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleEditSubmit} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-widest">{isAr ? 'تعديل بيانات وإثباتات مندوب' : 'Configure Courier Parameters'}</h3>
              <button type="button" onClick={() => onClose} className="text-slate-550 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-start">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الكامل' : 'Full Name'}</label>
                <input required type="text" value={editFormData.fullName} onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الهاتف' : 'Phone'}</label>
                  <input type="tel" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" dir="ltr" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني' : 'Mail ID'}</label>
                  <input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" dir="ltr" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'سكني' : 'Settlement Residence'}</label>
                <input type="text" value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الموقع جيوغرافيك (GPS)' : 'Live Coordinates GPS'}</label>
                <input type="text" value={editFormData.gpsLocation} onChange={(e) => setEditFormData({ ...editFormData, gpsLocation: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'نسبة العمولة التشغيلية (%)' : 'Operational Commission Rate (%)'}</label>
                  <input type="number" min="0" max="100" step="0.1" value={editFormData.commissionRate} onChange={(e) => setEditFormData({ ...editFormData, commissionRate: parseFloat(e.target.value) || 0 })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'نوع المندوب' : 'Courier Type'}</label>
                  <select
                    value={editFormData.courierType || 'local'}
                    onChange={(e) => setEditFormData({ ...editFormData, courierType: e.target.value as 'local' | 'sourcing' })}
                    className="w-full bg-black/50 border border-[#d4af37]/25 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  >
                    <option value="local" className="bg-[#121215] text-white">{isAr ? 'مندوب محلي (اليمن)' : 'Local / Delivery'}</option>
                    <option value="sourcing" className="bg-[#121215] text-[#d4af37]">{isAr ? 'مندوب تجميع (سعودي)' : 'Sourcing / Collection'}</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer pt-3">
                  <input type="checkbox" checked={editFormData.disabled} onChange={(e) => setEditFormData({ ...editFormData, disabled: e.target.checked })} className="w-4 h-4 text-rose-600 focus:ring-rose-500 bg-black/50 border-slate-850 rounded" />
                  <span className="text-[11px] font-black text-rose-500 uppercase tracking-tighter">{isAr ? 'تجميد حساب المندوب مؤقتاً' : 'Freeze courier account'}</span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'ملاحظات وبنود التحديث' : 'Administrative Confidential Remarks'}</label>
                <textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none h-20 text-start"></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => onClose} className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-855 rounded-xl transition-colors text-xs">{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={editLoading} className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-40 text-black font-black rounded-xl shadow-md transition-all text-xs active:scale-95">
                {editLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وحماية التعديلات' : 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
  );
}
