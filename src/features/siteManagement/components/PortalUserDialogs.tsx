import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';
import LocationMapPickerModal from '../../../components/common/LocationMapPickerModal';

export interface PortalUserDialogsProps {
  [key: string]: any;
}

export const PortalUserDialogs: React.FC<PortalUserDialogsProps> = (props) => {
  const { showCreatePUserModal, editingPUser, viewingPUser, isPUserMapOpen, isAr, setShowCreatePUserModal, setEditingPUser, setViewingPUser, setIsPUserMapOpen, handleEditPUserSubmit, handleCreatePUserSubmit, pUserFormData, setPUserFormData, actionId } = props;

  return (
    <>
      {/* ── CREATE & EDIT PORTAL USER MODAL ──────────────────────────────── */}
      {(showCreatePUserModal || editingPUser) && (
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e0e12] border border-[#d4af37]/30 rounded-3xl shadow-2xl max-w-xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-black/50 shrink-0">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#d4af37]" />
                {editingPUser
                  ? (isAr ? 'تعديل بيانات مستخدم الموقع (portal_users)' : 'Edit Portal User')
                  : (isAr ? 'إضافة مستخدم موقع جديد (portal_users)' : 'Create New Portal User')
                }
              </h3>
              <button
                type="button"
                onClick={() => { setShowCreatePUserModal(false); setEditingPUser(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={editingPUser ? handleEditPUserSubmit : handleCreatePUserSubmit}
              className="p-5 space-y-4 overflow-y-auto flex-1 text-start"
            >
              {/* Login Credentials Section */}
              <div className="p-4 rounded-2xl bg-black/40 border border-slate-850 space-y-3">
                <h4 className="text-xs font-black text-[#d4af37] flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  {isAr ? 'بيانات الاعتماد وتسجيل الدخول للموقع' : 'Portal Login Credentials'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'اسم المستخدم *' : 'Username *'}</label>
                    <input
                      required
                      type="text"
                      placeholder="username"
                      value={pUserFormData.username}
                      onChange={e => setPUserFormData({ ...pUserFormData, username: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#d4af37]/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                    <input
                      type="email"
                      placeholder="user@web.com"
                      value={pUserFormData.email}
                      onChange={e => setPUserFormData({ ...pUserFormData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#d4af37]/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">
                      {editingPUser ? (isAr ? 'كلمة المرور (اتركها فارغة للتعديل بدون تغيير)' : 'New Password (Optional)') : (isAr ? 'كلمة المرور *' : 'Password *')}
                    </label>
                    <input
                      required={!editingPUser}
                      type="password"
                      placeholder="••••••••"
                      value={pUserFormData.password}
                      onChange={e => setPUserFormData({ ...pUserFormData, password: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#d4af37]/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'دور المستخدم بالموقع' : 'Portal Role'}</label>
                    <select
                      value={pUserFormData.portal_role}
                      onChange={e => setPUserFormData({ ...pUserFormData, portal_role: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 font-bold outline-none focus:border-[#d4af37]/60"
                    >
                      <option value="client">{isAr ? '👤 عميل موقع (client)' : 'Client'}</option>
                      <option value="courier">{isAr ? '🚚 مندوب توصيل (courier)' : 'Courier'}</option>
                      <option value="supplier">{isAr ? '🏭 مورد (supplier)' : 'Supplier'}</option>
                      <option value="admin">{isAr ? '👑 مدير (admin)' : 'Admin'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'حالة الاعتماد' : 'Approval Status'}</label>
                    <select
                      value={pUserFormData.approval_status}
                      onChange={e => setPUserFormData({ ...pUserFormData, approval_status: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 font-bold outline-none focus:border-[#d4af37]/60"
                    >
                      <option value="approved">{isAr ? '✓ معتمد (approved)' : 'Approved'}</option>
                      <option value="pending_approval">{isAr ? '⏳ قيد المراجعة (pending)' : 'Pending'}</option>
                      <option value="rejected">{isAr ? '✕ مرفوض (rejected)' : 'Rejected'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'حالة الحساب' : 'Account Status'}</label>
                    <select
                      value={pUserFormData.disabled ? 'disabled' : 'active'}
                      onChange={e => setPUserFormData({ ...pUserFormData, disabled: e.target.value === 'disabled' })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 font-bold outline-none focus:border-[#d4af37]/60"
                    >
                      <option value="active">{isAr ? '🟢 نشط ومفعل' : 'Active'}</option>
                      <option value="disabled">{isAr ? '🔴 معطل' : 'Disabled'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal & Extra Customer Details Section (cust_details) */}
              <div className="p-4 rounded-2xl bg-black/40 border border-slate-850 space-y-3">
                <h4 className="text-xs font-black text-[#d4af37] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {isAr ? 'تفاصيل العميل الإضافية (cust_details)' : 'Customer Profile & Extra Details'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'الاسم الكامل' : 'Full Name'}</label>
                    <input
                      type="text"
                      placeholder="الاسم الثلاثي..."
                      value={pUserFormData.fullName}
                      onChange={e => setPUserFormData({ ...pUserFormData, fullName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#d4af37]/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'رقم الهاتف' : 'Phone'}</label>
                    <input
                      type="text"
                      placeholder="+967..."
                      value={pUserFormData.phone}
                      onChange={e => setPUserFormData({ ...pUserFormData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono outline-none focus:border-[#d4af37]/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'الدولة' : 'Country'}</label>
                    <input
                      type="text"
                      value={pUserFormData.country}
                      onChange={e => setPUserFormData({ ...pUserFormData, country: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#d4af37]/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'المدينة / المحافظة' : 'City'}</label>
                    <input
                      type="text"
                      placeholder="صنعاء / عدن..."
                      value={pUserFormData.city}
                      onChange={e => setPUserFormData({ ...pUserFormData, city: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#d4af37]/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'العنوان التفصيلي' : 'Detailed Address'}</label>
                  <input
                    type="text"
                    placeholder="المنطقة، الشارع، المعلم الشهير..."
                    value={pUserFormData.address}
                    onChange={e => setPUserFormData({ ...pUserFormData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#d4af37]/60"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'اسم الشركة / المؤسسة' : 'Company Name'}</label>
                    <input
                      type="text"
                      value={pUserFormData.company_name}
                      onChange={e => setPUserFormData({ ...pUserFormData, company_name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#d4af37]/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">{isAr ? 'سقف الدين الأقصى (ريال)' : 'Max Debt Limit'}</label>
                    <input
                      type="number"
                      min="0"
                      value={pUserFormData.max_debt}
                      onChange={e => setPUserFormData({ ...pUserFormData, max_debt: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono outline-none focus:border-[#d4af37]/60"
                    />
                  </div>
                </div>

                {/* Leaflet GPS Map Picker button inside Website Management */}
                <div className="p-3 rounded-xl bg-black/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-[#d4af37] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      {isAr ? 'تثبيت موقع GPS على الخريطة التفاعلية' : 'GPS Map Location'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsPUserMapOpen(true)}
                      className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[#d4af37] text-xs font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {isAr ? 'فتح الخريطة التفاعلية 🗺️' : 'Open Map 🗺️'}
                    </button>
                  </div>

                  <input
                    type="text"
                    readOnly
                    value={pUserFormData.gps_location}
                    placeholder="https://maps.google.com/?q=..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-[11px] font-mono font-bold text-slate-300 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowCreatePUserModal(false); setEditingPUser(null); }}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={actionId === 'create_puser' || actionId === editingPUser?.id}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {editingPUser
                    ? (isAr ? 'تحديث الحساب' : 'Update User')
                    : (isAr ? 'حفظ الحساب في الموقع' : 'Save Portal User')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW PORTAL USER DETAILS MODAL ────────────────────────────────── */}
      {viewingPUser && (
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e0e12] border border-[#d4af37]/30 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-black/50 shrink-0">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'بطاقة تفاصيل مستخدم الموقع' : 'Portal User Details Card'}
              </h3>
              <button
                type="button"
                onClick={() => setViewingPUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-start flex-1">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-slate-850">
                <div className="w-12 h-12 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center font-black text-lg text-[#d4af37]">
                  {(viewingPUser.username || viewingPUser.fullName || 'U').substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-black text-white">{viewingPUser.username}</h4>
                  <span className="text-xs text-slate-400 font-bold block">{viewingPUser.fullName || '—'}</span>
                  <span className="text-[10px] font-mono text-amber-400 block mt-0.5">ID: {viewingPUser.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-black/40 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
                  <span className="font-mono font-bold text-slate-200">{viewingPUser.email || '—'}</span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'رقم الهاتف' : 'Phone'}</span>
                  <span className="font-mono font-bold text-slate-200">{viewingPUser.phone || '—'}</span>
                </div>
              </div>

              {/* cust_details additional fields */}
              {viewingPUser.customerDetails && (
                <div className="p-4 bg-black/40 rounded-2xl border border-slate-850 space-y-2">
                  <h5 className="text-xs font-black text-[#d4af37]">{isAr ? 'التفاصيل الإضافية (cust_details)' : 'Extra Customer Details'}</h5>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-300">
                    <div><span className="text-slate-500 block text-[10px]">المدينة:</span>{viewingPUser.customerDetails.city || '—'}</div>
                    <div><span className="text-slate-500 block text-[10px]">الدولة:</span>{viewingPUser.customerDetails.country || 'اليمن'}</div>
                    <div><span className="text-slate-500 block text-[10px]">الشركة:</span>{viewingPUser.customerDetails.company_name || '—'}</div>
                    <div><span className="text-slate-500 block text-[10px]">سقف الدين:</span>{viewingPUser.customerDetails.max_debt ? `${viewingPUser.customerDetails.max_debt.toLocaleString()} YER` : '—'}</div>
                  </div>
                  {viewingPUser.customerDetails.address && (
                    <div className="pt-1 text-xs">
                      <span className="text-slate-500 block text-[10px]">العنوان السكني:</span>
                      <span className="text-slate-200 font-bold">{viewingPUser.customerDetails.address}</span>
                    </div>
                  )}
                  {viewingPUser.customerDetails.gps_location && (
                    <div className="pt-1 text-xs">
                      <span className="text-slate-500 block text-[10px]">رابط GPS:</span>
                      <a href={viewingPUser.customerDetails.gps_location} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline font-mono text-[10px]">
                        {viewingPUser.customerDetails.gps_location}
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingPUser(null)}
                  className="px-5 py-2 bg-slate-900 border border-slate-800 text-white font-bold text-xs rounded-xl"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Map Picker Modal for Website Management */}
      <LocationMapPickerModal
        isOpen={isPUserMapOpen}
        onClose={() => setIsPUserMapOpen(false)}
        initialData={{
          country: pUserFormData.country,
          city: pUserFormData.city,
          street: pUserFormData.address,
          addressDetails: pUserFormData.address,
          lat: pUserFormData.lat,
          lng: pUserFormData.lng,
          gps_location: pUserFormData.gps_location
        }}
        onSelectLocation={(data) => {
          setPUserFormData(prev => ({
            ...prev,
            country: data.country || prev.country,
            city: data.city || prev.city,
            address: [data.governorate, data.city, data.street, data.addressDetails].filter(Boolean).join(' - ') || prev.address,
            lat: data.lat || prev.lat,
            lng: data.lng || prev.lng,
            gps_location: data.gps_location || prev.gps_location
          }));
        }}
        isAr={isAr}
      />
    </>
  );
};

export default PortalUserDialogs;
