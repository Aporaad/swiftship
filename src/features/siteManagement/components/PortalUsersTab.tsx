import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

type SiteTab = 'analytics' | 'portal_users' | 'pending' | 'orders' | 'tickets' | 'announcements' | 'jobs' | 'security' | 'api';
type PortalUser = { id: string; username?: string; email?: string; fullName?: string; phone?: string; portal_role?: string; portalRole?: string; approval_status?: string; approvalStatus?: string; disabled?: boolean; address?: string; customerDetails?: { address?: string; company_name?: string; gps_location?: string } };
export interface PortalUsersTabProps {
  activeTab: SiteTab;
  isAr: boolean;
  portalUsers: PortalUser[];
  pUserSearch: string;
  setPUserSearch: (value: string) => void;
  pUserRoleFilter: string;
  setPUserRoleFilter: (value: string) => void;
  pUserStatusFilter: string;
  setPUserStatusFilter: (value: string) => void;
  pUserDisabledFilter: string;
  setPUserDisabledFilter: (value: string) => void;
  handleOpenCreatePUser: () => void;
  handleTogglePUserDisabled: (user: PortalUser) => void;
  setViewingPUser: (user: PortalUser | null) => void;
  handleOpenEditPUser: (user: PortalUser) => void;
  handleDeletePUser: (user: PortalUser) => void;
}

export const PortalUsersTab: React.FC<PortalUsersTabProps> = (props) => {
  const { activeTab, isAr, portalUsers, pUserSearch, setPUserSearch, pUserRoleFilter, setPUserRoleFilter, pUserStatusFilter, setPUserStatusFilter, pUserDisabledFilter, setPUserDisabledFilter, handleOpenCreatePUser, handleTogglePUserDisabled, setViewingPUser, handleOpenEditPUser, handleDeletePUser } = props;

  return (
    <>
      {/* ── TAB 0: Website Portal Users (portal_users) Management ──────────── */}
      {activeTab === 'portal_users' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Filter Controls Bar */}
          <div className="bg-[#0a0a0c] border border-white/[0.04] p-5 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#d4af37]" />
                  {isAr ? 'إدارة وحوكمة مستخدمي الموقع الإلكتروني (portal_users)' : 'Website Portal Users Management'}
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  {isAr
                    ? 'عرض وتعديل وتفعيل كافة الحسابات المسجلة بالموقع، وربطها بالعملاء والتفاصيل الإضافية (cust_details)'
                    : 'Manage, edit, disable, or authorize portal user accounts and their linked customer profiles'
                  }
                </p>
              </div>

              <button
                onClick={handleOpenCreatePUser}
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-lg shadow-amber-950/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                {isAr ? 'إضافة مستخدم موقع جديد' : 'Add New Portal User'}
              </button>
            </div>

            {/* Filter inputs grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/[0.05]">
              <input
                type="text"
                placeholder={isAr ? 'بحث بالاسم، البريد، أو الهاتف...' : 'Search name, email, phone...'}
                value={pUserSearch}
                onChange={e => setPUserSearch(e.target.value)}
                className="bg-black/50 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 font-bold outline-none focus:border-[#d4af37]/60"
              />

              <select
                value={pUserRoleFilter}
                onChange={e => setPUserRoleFilter(e.target.value)}
                className="bg-black/50 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-300 font-bold outline-none focus:border-[#d4af37]/60"
              >
                <option value="all">{isAr ? 'جميع الأدوار' : 'All Roles'}</option>
                <option value="client">{isAr ? '👤 عميل موقع (client)' : 'Client'}</option>
                <option value="customer">{isAr ? '👤 عميل (customer)' : 'Customer'}</option>
                <option value="courier">{isAr ? '🚚 مندوب (courier)' : 'Courier'}</option>
                <option value="supplier">{isAr ? '🏭 مورد (supplier)' : 'Supplier'}</option>
                <option value="admin">{isAr ? '👑 مدير (admin)' : 'Admin'}</option>
              </select>

              <select
                value={pUserStatusFilter}
                onChange={e => setPUserStatusFilter(e.target.value)}
                className="bg-black/50 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-300 font-bold outline-none focus:border-[#d4af37]/60"
              >
                <option value="all">{isAr ? 'جميع حالات الاعتماد' : 'All Approval Statuses'}</option>
                <option value="approved">{isAr ? '✓ معتمد (approved)' : 'Approved'}</option>
                <option value="pending_approval">{isAr ? '⏳ في الانتظار (pending)' : 'Pending'}</option>
                <option value="rejected">{isAr ? '✕ مرفوض (rejected)' : 'Rejected'}</option>
              </select>

              <select
                value={pUserDisabledFilter}
                onChange={e => setPUserDisabledFilter(e.target.value)}
                className="bg-black/50 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-300 font-bold outline-none focus:border-[#d4af37]/60"
              >
                <option value="all">{isAr ? 'حالة التفعيل والتعطيل' : 'All Account States'}</option>
                <option value="active">{isAr ? '🟢 حساب نشط' : 'Active'}</option>
                <option value="disabled">{isAr ? '🔴 حساب معطل' : 'Disabled'}</option>
              </select>
            </div>
          </div>

          {/* Portal Users Table */}
          <div className="bg-[#0a0a0c] border border-white/[0.04] rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-black/60 text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="p-4">{isAr ? 'المستخدم والحساب' : 'User Identity'}</th>
                    <th className="p-4">{isAr ? 'البريد والهاتف' : 'Contact'}</th>
                    <th className="p-4">{isAr ? 'الدور والاعتماد' : 'Role & Approval'}</th>
                    <th className="p-4">{isAr ? 'حالة الحساب' : 'Status'}</th>
                    <th className="p-4">{isAr ? 'التفاصيل الإضافية (cust_details)' : 'Extra Details'}</th>
                    <th className="p-4 text-left">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 bg-black/20">
                  {portalUsers
                    .filter(u => {
                      const q = pUserSearch.toLowerCase();
                      const matchesSearch = !q ||
                        (u.username || '').toLowerCase().includes(q) ||
                        (u.email || '').toLowerCase().includes(q) ||
                        (u.fullName || '').toLowerCase().includes(q) ||
                        (u.phone || '').includes(q);
                      const role = u.portal_role || u.portalRole || 'client';
                      const matchesRole = pUserRoleFilter === 'all' || role === pUserRoleFilter;
                      const appStatus = u.approval_status || u.approvalStatus || 'approved';
                      const matchesStatus = pUserStatusFilter === 'all' || appStatus === pUserStatusFilter;
                      const isDisabled = Boolean(u.disabled);
                      const matchesDisabled = pUserDisabledFilter === 'all' || (pUserDisabledFilter === 'disabled' ? isDisabled : !isDisabled);
                      return matchesSearch && matchesRole && matchesStatus && matchesDisabled;
                    })
                    .map((user) => {
                      const role = user.portal_role || user.portalRole || 'client';
                      const appStatus = user.approval_status || user.approvalStatus || 'approved';
                      const details = user.customerDetails || {};
                      const isDisabled = Boolean(user.disabled);

                      return (
                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center font-black text-[#d4af37] shrink-0">
                                {(user.username || user.fullName || 'U').substring(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-white block">{user.username || 'بدون اسم'}</span>
                                <span className="text-[10px] text-slate-500 font-bold block">{user.fullName || '—'}</span>
                              </div>
                            </div>
                          </td>

                          <td className="p-4 font-mono font-bold text-slate-300">
                            <div className="text-xs">{user.email || '—'}</div>
                            <div className="text-[10px] text-slate-500">{user.phone || '—'}</div>
                          </td>

                          <td className="p-4">
                            <div className="flex flex-col gap-1 w-max">
                              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30">
                                {role === 'client' || role === 'customer' ? '👤 عميل موقع' :
                                 role === 'courier' ? '🚚 مندوب توصيل' :
                                 role === 'supplier' ? '🏭 مورد مصانع' : '👑 مدير'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                                appStatus === 'approved' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' :
                                appStatus === 'pending_approval' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' :
                                'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                              }`}>
                                {appStatus === 'approved' ? '✓ معتمد' : appStatus === 'pending_approval' ? '⏳ قيد المراجعة' : '✕ مرفوض'}
                              </span>
                            </div>
                          </td>

                          <td className="p-4">
                            <button
                              onClick={() => handleTogglePUserDisabled(user)}
                              className={`px-3 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                isDisabled
                                  ? 'bg-rose-950/40 text-rose-400 border-rose-800/40 hover:bg-rose-900/60'
                                  : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/60'
                              }`}
                            >
                              {isDisabled ? '🔴 معطل' : '🟢 نشط'}
                            </button>
                          </td>

                          <td className="p-4 max-w-xs truncate text-slate-400">
                            <div className="font-bold text-slate-300 text-xs">{details.address || user.address || '—'}</div>
                            {details.company_name && (
                              <div className="text-[10px] text-[#d4af37] font-bold mt-0.5">🏢 {details.company_name}</div>
                            )}
                            {details.gps_location && (
                              <div className="text-[9px] font-mono text-cyan-400 mt-0.5 truncate">📍 {details.gps_location}</div>
                            )}
                          </td>

                          <td className="p-4 text-left">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setViewingPUser(user)}
                                title="عرض تفاصيل الحساب والنشاط"
                                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditPUser(user)}
                                title="تعديل الحساب والتفاصيل"
                                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-[#d4af37] border border-amber-500/30 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePUser(user)}
                                title="حذف مستخدم الموقع نهائياً"
                                className="p-2 rounded-xl bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/30 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {portalUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-500 font-bold italic">
                        {isAr ? '[ لا يوجد مستخدمين مسجلين بالموقع الإلكتروني حالياً ]' : '[ NO PORTAL USERS REGISTERED ]'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PortalUsersTab;
