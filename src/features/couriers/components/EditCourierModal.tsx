import React from 'react';
import { X, User, Phone, Mail, MapPin, DollarSign } from 'lucide-react';

export function EditCourierModal({
  isOpen,
  onClose,
  isAr,
  editFormData,
  setEditFormData,
  accounts = [],
  editLoading,
  handleEditSubmit
}: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-[#0c0c0f] border border-[#d4af37]/30 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col font-sans text-start">
        <div className="bg-black/40 p-5 border-b border-slate-850 flex justify-between items-center shrink-0">
          <h3 className="text-sm font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" />
            {isAr ? 'تعديل بيانات المندوب' : 'Edit Courier'}
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">{isAr ? 'اسم المندوب *' : 'Full Name *'}</label>
            <input required type="text" value={editFormData.fullName || ''} onChange={e => setEditFormData({ ...editFormData, fullName: e.target.value })} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">{isAr ? 'رقم الهاتف *' : 'Phone *'}</label>
              <input required type="text" value={editFormData.phone || ''} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60" />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" value={editFormData.email || ''} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">{isAr ? 'العنوان' : 'Address'}</label>
              <input type="text" value={editFormData.address || ''} onChange={e => setEditFormData({ ...editFormData, address: e.target.value })} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60" />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">{isAr ? 'نسبة العمولة (%)' : 'Commission (%)'}</label>
              <input type="number" min="0" max="100" value={editFormData.commissionRate ?? 0} onChange={e => setEditFormData({ ...editFormData, commissionRate: parseFloat(e.target.value) || 0 })} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">{isAr ? 'ملاحظات' : 'Notes'}</label>
            <textarea rows={2} value={editFormData.notes || ''} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60" />
          </div>

          <div className="pt-4 border-t border-slate-850 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" disabled={editLoading} className="px-6 py-2.5 rounded-xl bg-[#d4af37] text-black font-black text-xs hover:bg-amber-500 disabled:opacity-50">
              {editLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تحديث البيانات' : 'Update Courier')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
