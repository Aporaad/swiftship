import React from 'react';
import { Crown, UserCheck, UserX, Edit2, Key, WifiOff, Trash2, Search } from 'lucide-react';

// واجهة props لمكوّن تبويب قائمة المستخدمين
// Props interface for the UserListTab component
interface UserListTabProps {
  isAr: boolean;
  t: (ar: string, en: string) => string;
  filteredUsers: any[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterRole: string;
  setFilterRole: (role: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  roles: any[];
  role: string;
  hasPermission: (perm: string) => boolean;
  ROOT_EMAILS: string[];
  onlineUsersCount: number;
  couriersList: any[];
  employeesList: any[];
  getRoleBadgeStyle: (role: string) => string;
  getTempBanRemaining: (user: any) => string | null;
  getTimeSince: (ts: any) => string;
  isUserOnline?: (user: any) => boolean;
  handleToggleStatus: (user: any) => void;
  handleOpenEdit: (user: any) => void;
  handleResetPassword: (user: any) => void;
  setSessionTargetUser: (user: any) => void;
  setIsSessionModalOpen: (open: boolean) => void;
  handleDeleteUser: (id: string, name: string) => void;
  handleOpenAdd: () => void;
}

export const UserListTab: React.FC<UserListTabProps> = ({
  isAr,
  t,
  filteredUsers,
  searchTerm,
  setSearchTerm,
  filterRole,
  setFilterRole,
  filterStatus,
  setFilterStatus,
  roles,
  role,
  hasPermission,
  ROOT_EMAILS,
  onlineUsersCount,
  couriersList,
  employeesList,
  getRoleBadgeStyle,
  getTempBanRemaining,
  getTimeSince,
  isUserOnline = () => false,
  handleToggleStatus,
  handleOpenEdit,
  handleResetPassword,
  setSessionTargetUser,
  setIsSessionModalOpen,
  handleDeleteUser,
}) => {
  return (
    <div className="bg-[#121215] border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl">
      {/* فلاتر البحث والتصفية / Search and filter bar */}
      <div className="p-4 border-b border-slate-800/50 bg-black/30 flex flex-wrap gap-3">
        <div className={`relative flex-1 min-w-[180px]`}>
          <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4`} />
          <input
            type="text"
            placeholder={t('بحث بالاسم أو البريد أو المعرف...', 'Search by name, email or username...')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full ${isAr ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 bg-black/50 border border-slate-800 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-600 font-bold`}
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
        >
          <option value="all">{t('جميع الأدوار', 'All Roles')}</option>
          {roles.filter(r => r.id !== 'courier' && r.id !== 'Courier').map(r => (
            <option key={r.id} value={r.id}>{r.title || r.id}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
        >
          <option value="all">{t('جميع الحالات', 'All Status')}</option>
          <option value="online">{t('متصل الآن', 'Online Now')}</option>
          <option value="active">{t('نشط', 'Active')}</option>
          <option value="disabled">{t('معطَّل', 'Disabled')}</option>
        </select>
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/10 border border-emerald-900/20 rounded-xl text-[10px] font-bold text-emerald-400">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
          {onlineUsersCount} {t('متصل', 'online')}
        </div>
      </div>

      {/* جدول المستخدمين / Users table */}
      <div className="overflow-x-auto">
        <table className="w-full" dir={isAr ? 'rtl' : 'ltr'}>
          <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-800/50">
            <tr>
              <th className="p-4 text-start">{t('المستخدم والمعرف', 'User Account')}</th>
              <th className="p-4 text-start">{t('البريد الإلكتروني', 'Email')}</th>
              <th className="p-4 text-start">{t('الدور والصلاحية', 'Role')}</th>
              <th className="p-4 text-center">PIN</th>
              <th className="p-4 text-center">{t('الحالة', 'Status')}</th>
              <th className="p-4 text-center">{t('آخر ظهور', 'Last Seen')}</th>
              <th className="p-4 text-center">{t('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-slate-800/30 bg-black/10">
            {filteredUsers.map(user => {
              const isRootTarget = ROOT_EMAILS.includes(user.email) || user.isRoot;
              const online = isUserOnline(user);
              const tempBanLeft = getTempBanRemaining(user);
              return (
                <tr key={user.id} className={`hover:bg-slate-900/20 transition-colors ${user.disabled ? 'opacity-60' : ''}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-xs shrink-0 relative">
                        {user.fullName?.substring(0, 2)}
                        {isRootTarget && <Crown className="w-3 h-3 text-yellow-500 absolute -top-1.5 -right-1.5 animate-bounce" />}
                        {online && <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0a0a0d]"></span>}
                      </div>
                      <div>
                        <div className="font-extrabold text-white">{user.fullName}</div>
                        <div className="text-[9px] font-mono text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>@{user.username || 'not_set'}</span>
                        </div>
                        {user.linkedEntity && (
                          <div className="text-[9px] font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-900/40 px-2 py-0.5 rounded-lg flex items-center gap-1 w-max mt-1">
                            🔗 {user.linkedType === 'courier' ? t('مندوب:', 'Courier:') : t('موظف:', 'Employee:')}{' '}
                            {
                              user.linkedType === 'courier'
                                ? couriersList.find(c => c.id === user.linkedEntity)?.fullName || user.linkedEntity
                                : employeesList.find(e => e.id === user.linkedEntity)?.fullName || user.linkedEntity
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-400 text-[10px]" dir="ltr">{user.email}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${getRoleBadgeStyle(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-center font-mono text-slate-400 font-semibold text-[11px] tracking-widest">{user.systemPin || '—'}</td>
                  <td className="p-4 text-center">
                    {user.disabled ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="bg-rose-950/20 text-rose-400 border border-rose-900/30 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">
                          {tempBanLeft ? t('حظر مؤقت', 'TEMP BAN') : t('معطَّل', 'DISABLED')}
                        </span>
                        {tempBanLeft && <span className="text-[8px] text-orange-400 font-mono font-bold">{tempBanLeft}</span>}
                      </div>
                    ) : (
                      <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">
                        {t('نشط', 'ACTIVE')}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center text-[9px] text-slate-500 font-bold">{getTimeSince(user.lastSeen)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      {(role === 'Admin' || hasPermission('disable_accounts')) && (
                        <button
                          onClick={() => handleToggleStatus(user)}
                          title={user.disabled ? t('تفعيل', 'Enable') : t('تعطيل', 'Disable')}
                          className={`p-1.5 rounded-lg border transition-all ${user.disabled ? 'text-emerald-400 bg-emerald-950/10 border-emerald-900/30 hover:bg-emerald-950/30' : 'text-rose-400 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30'}`}
                        >
                          {user.disabled ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {(role === 'Admin' || hasPermission('edit_users')) && (
                        <button
                          onClick={() => handleOpenEdit(user)}
                          title={t('تعديل', 'Edit')}
                          className="p-1.5 rounded-lg border text-slate-400 hover:text-white bg-slate-900/50 border-slate-800 hover:border-[#d4af37]/30 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(role === 'Admin' || hasPermission('reset_passwords')) && (
                        <button
                          onClick={() => handleResetPassword(user)}
                          title={t('إعادة تعيين كلمة المرور', 'Reset Password')}
                          className="p-1.5 rounded-lg border text-amber-400 bg-amber-950/10 border-amber-900/30 hover:bg-amber-950/30 transition-all"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(role === 'Admin' || hasPermission('terminate_sessions')) && !isRootTarget && online && (
                        <button
                          onClick={() => { setSessionTargetUser(user); setIsSessionModalOpen(true); }}
                          title={t('إنهاء الجلسة', 'End Session')}
                          className="p-1.5 rounded-lg border text-rose-400 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30 transition-all"
                        >
                          <WifiOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(role === 'Admin' || hasPermission('delete_users')) && !isRootTarget && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.fullName)}
                          title={t('حذف', 'Delete')}
                          className="p-1.5 rounded-lg border text-rose-500 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={8} className="p-16 text-center text-slate-600 font-bold text-[10px] uppercase tracking-widest">
                  {t('[ لا يوجد موظفون مطابقون ]', '[ no staff profiles matched ]')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserListTab;
