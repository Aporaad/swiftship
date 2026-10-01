import React from 'react';
import {
  Search, Edit2, UserX, UserCheck, Trash2, Crown, ShieldAlert, Activity, Timer,
  WifiOff, Key, Zap, MonitorCheck, Users as UsersIcon, Info
} from 'lucide-react';

type TabUser = {
  id: string; fullName: string; email: string; username: string; role: string;
  roleId?: string; disabled: boolean; isRoot?: boolean; lastSeen?: number;
  tempBanUntil?: number | null; linkedType?: string | null; linkedEntity?: string | null; systemPin?: string;
};
type TabRole = { id: string; title: string; permissions: string[] };
type TabEntity = { id: string; fullName: string };
type TabSession = { id: string; fullName: string; email: string; role: string; deviceInfo: string; userId?: string; lastSeen: number; last_seen: number };
type TabActivityLog = { id: string; action: string; userId?: string; userName?: string; userRole?: string; target?: string; details?: Record<string, unknown>; timestamp?: number | string | { toDate: () => Date } };
type Permission = { id: string; label: string };
type RoleGroup = { group: string; perms: Permission[] };
type ActionMeta = { color: string; label: string; icon: React.ReactNode };
type ConfirmConfig = { isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'warning' | 'info' };

export interface UserManagementTabContentProps {
  activeTab: 'users' | 'roles' | 'sessions' | 'activity'; isAr: boolean;
  t: (ar: string, en: string) => string; hasPermission: (permission: string) => boolean;
  filteredUsers: TabUser[]; search: string; setSearch: React.Dispatch<React.SetStateAction<string>>;
  roleFilter: string; setRoleFilter: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string; setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  roles: TabRole[]; activeSessions: TabSession[]; onlineSessionsCount: number; ROOT_EMAILS: string[];
  couriersList: TabEntity[]; employeesList: TabEntity[]; role: string | null | undefined;
  getRoleBadgeStyle: (role: string) => string; getTempBanRemaining: (user: TabUser) => string | null;
  getTimeSince: (timestamp?: number) => string; isUserOnline: (user: TabUser) => boolean;
  handleToggleStatus: (user: TabUser) => void | Promise<void>; handleOpenEdit: (user: TabUser) => void;
  handleResetPassword: (user: TabUser) => void; setSessionTargetUser: React.Dispatch<React.SetStateAction<TabUser | null>>;
  setIsSessionModalOpen: React.Dispatch<React.SetStateAction<boolean>>; handleDeleteUser: (id: string, name: string) => void | Promise<void>;
  users: TabUser[]; dbSessions: TabSession[]; sessionId: string | null | undefined; currentUserDoc: TabUser | null | undefined;
  setConfirmConfig: React.Dispatch<React.SetStateAction<ConfirmConfig>>; filteredLogs: TabActivityLog[];
  logFilter: string; setLogFilter: React.Dispatch<React.SetStateAction<string>>; logUserFilter: string; setLogUserFilter: React.Dispatch<React.SetStateAction<string>>;
  logLimit: number; setLogLimit: React.Dispatch<React.SetStateAction<number>>; getActionMeta: (action: string, isAr: boolean) => ActionMeta;
  isSessionOnline: (session: TabSession) => boolean; handleRequestTerminateSession: (session: TabSession) => void;
  handleOpenEditRole: (role: TabRole) => void; handleDeleteRole: (id: string, title: string) => void;
  ALL_PERMISSIONS: (isAr: boolean) => Permission[];
}

/**
 * The four User Management tabs. The JSX is intentionally kept identical to the
 * page implementation while the shell owns state, permissions, and handlers.
 */
export const UserManagementTabContent: React.FC<UserManagementTabContentProps> = (props) => {
  const {
    activeTab, isAr, t, hasPermission, filteredUsers, search, setSearch,
    roleFilter, setRoleFilter, statusFilter, setStatusFilter, roles,
    activeSessions, onlineSessionsCount, ROOT_EMAILS, couriersList, employeesList,
    role, getRoleBadgeStyle, getTempBanRemaining, getTimeSince, isUserOnline,
    handleToggleStatus, handleOpenEdit, handleResetPassword, setSessionTargetUser,
    setIsSessionModalOpen, handleDeleteUser, users, dbSessions, sessionId,
    currentUserDoc, setConfirmConfig, filteredLogs, logFilter, setLogFilter,
    handleOpenEditRole, handleDeleteRole, ALL_PERMISSIONS,
    logUserFilter, setLogUserFilter, logLimit, setLogLimit, getActionMeta,
    isSessionOnline, handleRequestTerminateSession
  } = props;

  return (
<>
      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 1: USERS                                      */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="bg-[#121215] border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-800/50 bg-black/30 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4`} />
              <input type="text" placeholder={t('بحث بالاسم أو البريد أو المعرف...', 'Search by name, email or username...')} value={search} onChange={e => setSearch(e.target.value)}
                className={`w-full ${isAr ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 bg-black/50 border border-slate-800 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-600 font-bold`} />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
              <option value="all">{t('جميع الأدوار', 'All Roles')}</option>
              {roles.filter(r => r.id !== 'courier' && r.id !== 'Courier').map(r => <option key={r.id} value={r.id}>{r.title || r.id}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
              <option value="all">{t('جميع الحالات', 'All Status')}</option>
              <option value="online">{t('متصل الآن', 'Online Now')}</option>
              <option value="active">{t('نشط', 'Active')}</option>
              <option value="disabled">{t('معطَّل', 'Disabled')}</option>
            </select>
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/10 border border-emerald-900/20 rounded-xl text-[10px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              {activeSessions.length} {t('متصل', 'online')}
            </div>
          </div>

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
                      <td className="p-4"><span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${getRoleBadgeStyle(user.role)}`}>{user.role}</span></td>
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
                          <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">{t('نشط', 'ACTIVE')}</span>
                        )}
                      </td>
                      <td className="p-4 text-center text-[9px] text-slate-500 font-bold">{getTimeSince(user.lastSeen)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          {(role === 'Admin' || hasPermission('disable_accounts')) && (
                            <button onClick={() => handleToggleStatus(user)} title={user.disabled ? t('تفعيل', 'Enable') : t('تعطيل', 'Disable')}
                              className={`p-1.5 rounded-lg border transition-all ${user.disabled ? 'text-emerald-400 bg-emerald-950/10 border-emerald-900/30 hover:bg-emerald-950/30' : 'text-rose-400 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30'}`}>
                              {user.disabled ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {(role === 'Admin' || hasPermission('edit_users')) && (
                            <button onClick={() => handleOpenEdit(user)} title={t('تعديل', 'Edit')} className="p-1.5 rounded-lg border text-slate-400 hover:text-white bg-slate-900/50 border-slate-800 hover:border-[#d4af37]/30 transition-all">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(role === 'Admin' || hasPermission('reset_passwords')) && (
                            <button onClick={() => handleResetPassword(user)} title={t('إعادة تعيين كلمة المرور', 'Reset Password')} className="p-1.5 rounded-lg border text-amber-400 bg-amber-950/10 border-amber-900/30 hover:bg-amber-950/30 transition-all">
                              <Key className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(role === 'Admin' || hasPermission('terminate_sessions')) && !isRootTarget && online && (
                            <button onClick={() => { setSessionTargetUser(user); setIsSessionModalOpen(true); }} title={t('إنهاء الجلسة', 'End Session')} className="p-1.5 rounded-lg border text-rose-400 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30 transition-all">
                              <WifiOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(role === 'Admin' || hasPermission('delete_users')) && !isRootTarget && (
                            <button onClick={() => handleDeleteUser(user.id, user.fullName)} title={t('حذف', 'Delete')} className="p-1.5 rounded-lg border text-rose-500 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={8} className="p-16 text-center text-slate-600 font-bold text-[10px] uppercase tracking-widest">{t('[ لا يوجد موظفون مطابقون ]', '[ no staff profiles matched ]')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 2: ROLES & PERMISSIONS                        */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map(r => {
            const usersInRole = users.filter(u => u.role === r.id).length;
            const hasAll = r.permissions?.includes('*');
            const allPerms = ALL_PERMISSIONS(isAr);
            return (
              <div key={r.id} className="bg-gradient-to-b from-[#121215] to-[#0a0a0d] border border-slate-800/50 rounded-2xl overflow-hidden hover:border-[#d4af37]/25 transition-all flex flex-col shadow-lg">
                <div className="p-4 border-b border-slate-800/40 flex justify-between items-start bg-black/20">
                  <div>
                    <h3 className="font-extrabold text-[#d4af37] text-sm mb-0.5">{r.title || r.id}</h3>
                    <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest" dir="ltr">{r.id}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-slate-500 font-bold">{usersInRole} {t('مستخدم', 'users')}</span>
                      {hasAll && <span className="bg-amber-950/20 text-[#d4af37] border border-[#d4af37]/20 px-1.5 py-0.5 rounded text-[8px] font-black">{t('صلاحيات كاملة ★', 'FULL ACCESS ★')}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(role === 'Admin' || hasPermission('edit_roles')) && (
                      <button onClick={() => handleOpenEditRole(r)} className="p-1.5 text-slate-400 border border-slate-800 bg-slate-950 hover:text-[#d4af37] hover:border-[#d4af37]/30 rounded-lg transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                    )}
                    {r.id !== 'Admin' && (role === 'Admin' || hasPermission('delete_roles')) && (
                      <button onClick={() => handleDeleteRole(r.id, r.title || r.id)} className="p-1.5 text-rose-400 border border-slate-800 bg-slate-950 hover:bg-rose-950/20 hover:border-rose-500/30 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
                <div className="p-4 flex-1">
                  <div className="text-[9px] font-black text-slate-600 mb-2 uppercase tracking-wider">{t('الصلاحيات الممنوحة:', 'Granted Permissions:')}</div>
                  {hasAll ? (
                    <div className="text-[9px] text-[#d4af37] font-bold bg-[#d4af37]/5 border border-[#d4af37]/10 rounded-lg p-2 text-center">
                      ★ {t('جميع صلاحيات النظام', 'All System Permissions')} ({allPerms.length} {t('صلاحية', 'permissions')})
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const permsArr = Array.isArray(r.permissions) ? r.permissions : [];
                        return (
                          <>
                            {permsArr.slice(0, 8).map((pId: string) => {
                              const perm = allPerms.find(ap => ap.id === pId);
                              return <span key={pId} className="bg-slate-900/80 text-slate-300 border border-slate-800/60 px-1.5 py-0.5 rounded text-[8px] font-bold">{perm?.label || pId}</span>;
                            })}
                            {permsArr.length > 8 && (
                              <span className="bg-slate-900 text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded text-[8px] font-bold">+{permsArr.length - 8} {t('أخرى', 'more')}</span>
                            )}
                            {permsArr.length === 0 && <span className="text-slate-600 text-[10px] italic">{t('لا توجد صلاحيات', 'No permissions assigned')}</span>}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 3: ACTIVE SESSIONS                            */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('متصلون الآن', 'Online Now'), value: onlineSessionsCount, color: 'emerald', Icon: MonitorCheck },
              { label: t('إجمالي الموظفين', 'Total Staff'), value: users.length, color: 'blue', Icon: UsersIcon },
              { label: t('حسابات معطَّلة', 'Disabled'), value: users.filter(u => u.disabled).length, color: 'rose', Icon: UserX },
              { label: t('حظر مؤقت', 'Temp Banned'), value: users.filter(u => u.disabled && u.tempBanUntil).length, color: 'orange', Icon: Timer },
            ].map((stat, i) => (
              <div key={i} className={`bg-black/40 border border-${stat.color}-900/20 rounded-2xl p-4 flex items-center gap-3`}>
                <stat.Icon className={`w-5 h-5 text-${stat.color}-400 shrink-0`} />
                <div>
                  <div className={`text-xl font-black text-${stat.color}-400`}>{stat.value}</div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Session Termination Info */}
          <div className="bg-amber-950/10 border border-amber-900/20 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-300/80 font-bold leading-relaxed">
              {t(
                'يعمل نظام إنهاء الجلسات بشكل فوري: عند النقر على "إجراء"، يُرسَل أمر إلى Supabase يُلتقط تلقائياً من المستخدم المستهدف خلال ثوانٍ ويُعيد توجيهه لصفحة تسجيل الدخول.',
                'Session termination works in real-time: clicking an action sends a Supabase command that the target user\'s session picks up within seconds and redirects them to login.'
              )}
            </div>
          </div>

          {/* Sessions Table */}
          <div className="bg-[#121215] border border-slate-800/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800/40 bg-black/30 flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                {t('جميع المستخدمين — حالة الجلسات', 'All Users — Session Status')}
              </h3>
              <span className="text-[9px] text-slate-500 font-bold">{t('يتجدد كل دقيقة', 'Refreshes every minute')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" dir={isAr ? 'rtl' : 'ltr'}>
                <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-800/40">
                  <tr>
                    <th className="p-4 text-start">{t('المستخدم', 'User')}</th>
                    <th className="p-4 text-start">{t('الدور', 'Role')}</th>
                    <th className="p-4 text-center">{t('الجهاز / المتصفح', 'Device / Browser')}</th>
                    <th className="p-4 text-center">{t('آخر نشاط', 'Last Activity')}</th>
                    <th className="p-4 text-center">{t('إجراء الجلسة', 'Session Action')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/30">
                  {dbSessions.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)).map(sess => {
                    const isSelf = sessionId === sess.id;
                    const isRoot = ROOT_EMAILS.includes(sess.email) || sess.role === 'Admin';
                    const isOnline = isSessionOnline(sess);
                    const statusDotColor = isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500';
                    return (
                      <tr key={sess.id} className="transition-colors hover:bg-emerald-950/5">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-[10px]">
                              {sess.fullName?.substring(0, 2)}
                              <span className={`absolute -bottom-1 -right-1 w-2 h-2 ${statusDotColor} rounded-full border border-[#0a0a0d]`}></span>
                              {isRoot && <Crown className="w-2.5 h-2.5 text-yellow-400 absolute -top-1 -right-1" />}
                            </div>
                            <div>
                              <div className="font-bold text-white text-[11px] flex items-center gap-1.5 flex-wrap">
                                {sess.fullName}
                                {isSelf && <span className="text-[8px] text-[#d4af37] font-black bg-[#d4af37]/10 border border-[#d4af37]/20 px-1.5 py-0.5 rounded">{t('جلستك الحالية', 'CURRENT TAB')}</span>}
                                {isOnline ? (
                                  <span className="text-[8px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded-md uppercase tracking-wide">{t('متصل الآن', 'Online')}</span>
                                ) : (
                                  <span className="text-[8px] text-slate-400 font-bold bg-slate-950/40 border border-slate-900/30 px-1.5 py-0.5 rounded-md uppercase tracking-wide">{t('خامل', 'Idle')}</span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-500 font-mono">@{sess.email || sess.userId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${getRoleBadgeStyle(sess.role)}`}>{sess.role}</span></td>
                        <td className="p-4 text-center text-[10px] font-bold text-slate-400">{sess.deviceInfo || t('غير معروف', 'Unknown')}</td>
                        <td className="p-4 text-center text-[10px] font-bold text-slate-400">{getTimeSince(sess.lastSeen || sess.last_seen)}</td>
                        <td className="p-4 text-center">
                          {isSelf || (isRoot && !ROOT_EMAILS.includes(currentUserDoc?.email ?? '')) ? (
                            <span className="text-[#d4af37] text-[9px] font-black bg-[#d4af37]/10 border border-[#d4af37]/25 px-2 py-1 rounded-lg">
                              {isSelf ? t('جلستك', 'Your Session') : t('محمي', 'Protected')}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRequestTerminateSession(sess)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/20 text-rose-400 border border-rose-900/30 hover:bg-rose-950/40 rounded-lg text-[9px] font-black transition-all mx-auto"
                            >
                              <Zap className="w-3 h-3" /> {t('إنهاء الجلسة', 'Terminate')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {dbSessions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-600 font-bold text-xs uppercase tracking-widest">
                        {t('لا توجد جلسات نشطة حالياً', 'NO ACTIVE SESSIONS FOUND')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 4: ACTIVITY LOG                               */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {!hasPermission('view_activity_log') ? (
            <div className="flex flex-col items-center justify-center p-12 bg-[#121215] border border-slate-800 rounded-2xl text-center">
              <ShieldAlert className="w-12 h-12 text-rose-500 mb-4 animate-pulse" />
              <p className="text-slate-500 text-sm font-bold">{t('ليس لديك صلاحية عرض سجل النشاط', 'No permission to view activity log')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 p-4 bg-black/30 border border-slate-800/50 rounded-2xl">
                <select value={logFilter} onChange={e => setLogFilter(e.target.value)} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
                  <option value="all">{t('جميع الأنواع', 'All Actions')}</option>
                  {['add_user', 'edit_user', 'disable_user', 'enable_user', 'delete_user', 'reset_password', 'force_logout', 'temp_ban', 'add_role', 'edit_role', 'delete_role', 'add_order', 'edit_order', 'delete_order', 'edit_delivered_order', 'change_exchange_rate', 'add_expense', 'add_customer'].map(a => (
                    <option key={a} value={a}>{getActionMeta(a, isAr).label}</option>
                  ))}
                </select>
                <select value={logUserFilter} onChange={e => setLogUserFilter(e.target.value)} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
                  <option value="all">{t('جميع المستخدمين', 'All Users')}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
                <select value={logLimit} onChange={e => setLogLimit(Number(e.target.value))} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
                  {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} {t('سجل', 'records')}</option>)}
                </select>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                  <Activity className="w-3.5 h-3.5" /> {filteredLogs.length} {t('سجل', 'records')}
                </div>
              </div>

              <div className="bg-[#121215] border border-slate-800/50 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-800/40">
                      <tr>
                        <th className="p-4 text-start">{t('النشاط', 'Action')}</th>
                        <th className="p-4 text-start">{t('الموظف', 'Staff')}</th>
                        <th className="p-4 text-start">{t('الهدف', 'Target')}</th>
                        <th className="p-4 text-start">{t('تفاصيل', 'Details')}</th>
                        <th className="p-4 text-center">{t('الوقت', 'Time')}</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-800/30">
                      {filteredLogs.map(log => {
                        const meta = getActionMeta(log.action, isAr);
                        const ts = typeof log.timestamp === 'object' && log.timestamp !== null && 'toDate' in log.timestamp
                          ? log.timestamp.toDate()
                          : typeof log.timestamp === 'string' || typeof log.timestamp === 'number' ? new Date(log.timestamp) : null;
                        return (
                          <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-${meta.color}-950/20 text-${meta.color}-400 border border-${meta.color}-900/20 text-[9px] font-black`}>
                                {meta.icon} {meta.label}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-white text-[11px]">{log.userName || '—'}</div>
                              <div className="text-[9px] text-slate-500 font-bold uppercase">{log.userRole || ''}</div>
                            </td>
                            <td className="p-4 text-slate-300 font-bold text-[11px]">{log.target || '—'}</td>
                            <td className="p-4 max-w-xs">
                              {log.details && Object.keys(log.details).length > 0 ? (
                                <div className="text-[9px] text-slate-500 font-mono truncate">
                                  {Object.entries(log.details).slice(0, 2).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' | ')}
                                </div>
                              ) : <span className="text-slate-700 text-[9px]">—</span>}
                            </td>
                            <td className="p-4 text-center text-[9px] text-slate-500 font-bold whitespace-nowrap">
                              {ts ? ts.toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredLogs.length === 0 && (
                        <tr><td colSpan={5} className="p-16 text-center text-slate-600 font-bold text-[10px] uppercase tracking-widest">{t('[ لا توجد سجلات ]', '[ no activity logs ]')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

</>
  );
};

export default UserManagementTabContent;
