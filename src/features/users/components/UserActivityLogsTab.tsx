import React, { useState, useMemo } from 'react';
import { Activity, ShieldAlert, Search } from 'lucide-react';

interface UserActivityLogsTabProps {
  isAr: boolean;
  activityLogs?: any[];
  users?: any[];
  hasPermission?: (permission: string) => boolean;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  logFilter?: string;
  setLogFilter?: (filter: string) => void;
  logUserFilter?: string;
  setLogUserFilter?: (user: string) => void;
  logLimit?: number;
  setLogLimit?: (limit: number) => void;
}

export const UserActivityLogsTab: React.FC<UserActivityLogsTabProps> = ({
  isAr,
  activityLogs = [],
  users = [],
  hasPermission = () => true,
  searchTerm: propsSearchTerm,
  setSearchTerm: propsSetSearchTerm,
  logFilter: propsLogFilter,
  setLogFilter: propsSetLogFilter,
  logUserFilter: propsLogUserFilter,
  setLogUserFilter: propsSetLogUserFilter,
  logLimit: propsLogLimit,
  setLogLimit: propsSetLogLimit,
}) => {
  const [localLogFilter, setLocalLogFilter] = useState('all');
  const [localLogUserFilter, setLocalLogUserFilter] = useState('all');
  const [localLogLimit, setLocalLogLimit] = useState(50);
  const [localSearchTerm, setLocalSearchTerm] = useState('');

  const logFilter = propsLogFilter !== undefined ? propsLogFilter : localLogFilter;
  const setLogFilter = propsSetLogFilter || setLocalLogFilter;
  const logUserFilter = propsLogUserFilter !== undefined ? propsLogUserFilter : localLogUserFilter;
  const setLogUserFilter = propsSetLogUserFilter || setLocalLogUserFilter;
  const logLimit = propsLogLimit !== undefined ? propsLogLimit : localLogLimit;
  const setLogLimit = propsSetLogLimit || setLocalLogLimit;
  const searchTerm = propsSearchTerm !== undefined ? propsSearchTerm : localSearchTerm;
  const setSearchTerm = propsSetSearchTerm || setLocalSearchTerm;

  const filteredLogs = useMemo(() => {
    return activityLogs
      .filter((log: any) => {
        const matchesAction = logFilter === 'all' || log.action === logFilter;
        const matchesUser = logUserFilter === 'all' || log.userId === logUserFilter || log.user_id === logUserFilter;
        const q = searchTerm.toLowerCase();
        const matchesSearch = !q || (log.userName || log.user_name || '').toLowerCase().includes(q) || (log.target || '').toLowerCase().includes(q);
        return matchesAction && matchesUser && matchesSearch;
      })
      .slice(0, logLimit);
  }, [activityLogs, logFilter, logUserFilter, logLimit, searchTerm]);

  return (
    <div className="space-y-4">
      {!hasPermission('view_activity_log') ? (
        <div className="flex flex-col items-center justify-center p-12 bg-[#121215] border border-slate-800 rounded-2xl text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500 mb-4 animate-pulse" />
          <p className="text-slate-500 text-sm font-bold">
            {isAr ? 'ليس لديك صلاحية عرض سجل النشاط' : 'No permission to view activity log'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 p-4 bg-black/30 border border-slate-800/50 rounded-2xl items-center">
            <div className="relative min-w-[200px] flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute top-2.5 right-3" />
              <input
                type="text"
                placeholder={isAr ? 'بحث في سجل النشاط...' : 'Search logs...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-black/50 border border-slate-800 text-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:border-[#d4af37]/50"
              />
            </div>

            <select
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
              className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
            >
              <option value="all">{isAr ? 'جميع الأنواع' : 'All Actions'}</option>
              {['add_user', 'edit_user', 'disable_user', 'enable_user', 'delete_user', 'reset_password', 'force_logout', 'add_role', 'edit_role', 'delete_role', 'add_order', 'edit_order', 'delete_order'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select
              value={logUserFilter}
              onChange={e => setLogUserFilter(e.target.value)}
              className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
            >
              <option value="all">{isAr ? 'جميع المستخدمين' : 'All Users'}</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
              ))}
            </select>

            <select
              value={logLimit}
              onChange={e => setLogLimit(Number(e.target.value))}
              className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
            >
              {[25, 50, 100, 200].map(n => (
                <option key={n} value={n}>{n} {isAr ? 'سجل' : 'records'}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
              <Activity className="w-3.5 h-3.5" /> {filteredLogs.length} {isAr ? 'سجل' : 'records'}
            </div>
          </div>

          <div className="bg-[#121215] border border-slate-800/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start" dir={isAr ? 'rtl' : 'ltr'}>
                <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-800/40">
                  <tr>
                    <th className="p-4 text-start">{isAr ? 'النشاط' : 'Action'}</th>
                    <th className="p-4 text-start">{isAr ? 'الموظف' : 'Staff'}</th>
                    <th className="p-4 text-start">{isAr ? 'الهدف' : 'Target'}</th>
                    <th className="p-4 text-start">{isAr ? 'تفاصيل' : 'Details'}</th>
                    <th className="p-4 text-center">{isAr ? 'الوقت' : 'Time'}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/30">
                  {filteredLogs.map((log: any) => {
                    const ts = log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp ? new Date(log.timestamp) : null;
                    return (
                      <tr key={log.id || Math.random()} className="hover:bg-slate-900/10 transition-colors">
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/20 text-amber-400 border border-amber-900/20 text-[9px] font-black">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-white text-[11px]">{log.userName || log.user_name || '—'}</div>
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
                    <tr>
                      <td colSpan={5} className="p-16 text-center text-slate-600 font-bold text-[10px] uppercase tracking-widest">
                        {isAr ? '[ لا توجد سجلات ]' : '[ no activity logs ]'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserActivityLogsTab;
