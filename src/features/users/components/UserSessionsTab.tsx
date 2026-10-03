import React from 'react';
import { Crown, Zap, MonitorCheck, Users as UsersIcon, UserX, Timer, Info } from 'lucide-react';
import { db, updateDoc, doc } from '../../../data/legacy/legacy-adapter';
import { notificationService } from '../../../services/notificationService';
import { activityLogService } from '../../../services/activityLogService';


// واجهة props لمكوّن تبويب الجلسات النشطة
// Props interface for the UserSessionsTab component
interface UserSessionsTabProps {
  isAr: boolean;
  t: (ar: string, en: string) => string;
  sessions: any[];
  users: any[];
  sessionId?: string;
  currentUserDoc?: any;
  ROOT_EMAILS: string[];
  getRoleBadgeStyle: (role: string) => string;
  getTimeSince: (ts: any) => string;
  setConfirmConfig: (config: any) => void;
  handleRevokeSession: (sessionId: string) => void;
}

// دالة تحديد ما إذا كانت الجلسة نشطة (آخر نشاط خلال 3 دقائق)
// Determines if a session is currently online based on last heartbeat (3 minute window)
const isSessionOnline = (sess: any): boolean => {
  const rawLastSeen = sess.lastSeen || sess.last_seen;
  let lastSeenMs = 0;
  if (typeof rawLastSeen === 'number') lastSeenMs = rawLastSeen;
  else if (typeof rawLastSeen === 'string') {
    const parsed = Date.parse(rawLastSeen);
    if (!isNaN(parsed)) lastSeenMs = parsed;
  }
  if (!lastSeenMs) return false;
  return (Date.now() - lastSeenMs) < 3 * 60 * 1000;
};

export const UserSessionsTab: React.FC<UserSessionsTabProps> = ({
  isAr,
  t,
  sessions,
  users,
  sessionId,
  currentUserDoc,
  ROOT_EMAILS,
  getRoleBadgeStyle,
  getTimeSince,
  setConfirmConfig,
}) => {
  const onlineSessionsCount = sessions.filter(isSessionOnline).length;

  return (
    <div className="space-y-4">
      {/* إحصائيات الجلسات / Sessions stats */}
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

      {/* تنبيه معلوماتي حول آلية إنهاء الجلسات / Info banner about session termination mechanism */}
      <div className="bg-amber-950/10 border border-amber-900/20 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[10px] text-amber-300/80 font-bold leading-relaxed">
          {t(
            'يعمل نظام إنهاء الجلسات بشكل فوري: عند النقر على "إجراء"، يُرسَل أمر إلى Supabase يُلتقط تلقائياً من المستخدم المستهدف خلال ثوانٍ ويُعيد توجيهه لصفحة تسجيل الدخول.',
            "Session termination works in real-time: clicking an action sends a Supabase command that the target user's session picks up within seconds and redirects them to login."
          )}
        </div>
      </div>

      {/* جدول الجلسات / Sessions table */}
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
              {sessions.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)).map(sess => {
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
                            {isSelf && (
                              <span className="text-[8px] text-[#d4af37] font-black bg-[#d4af37]/10 border border-[#d4af37]/20 px-1.5 py-0.5 rounded">
                                {t('جلستك الحالية', 'CURRENT TAB')}
                              </span>
                            )}
                            {isOnline ? (
                              <span className="text-[8px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                {t('متصل الآن', 'Online')}
                              </span>
                            ) : (
                              <span className="text-[8px] text-slate-400 font-bold bg-slate-950/40 border border-slate-900/30 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                {t('خامل', 'Idle')}
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono">@{sess.email || sess.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${getRoleBadgeStyle(sess.role)}`}>
                        {sess.role}
                      </span>
                    </td>
                    <td className="p-4 text-center text-[10px] font-bold text-slate-400">
                      {sess.deviceInfo || t('غير معروف', 'Unknown')}
                    </td>
                    <td className="p-4 text-center text-[10px] font-bold text-slate-400">
                      {getTimeSince(sess.lastSeen || sess.last_seen)}
                    </td>
                    <td className="p-4 text-center">
                      {isSelf || (isRoot && !ROOT_EMAILS.includes(currentUserDoc?.email)) ? (
                        <span className="text-[#d4af37] text-[9px] font-black bg-[#d4af37]/10 border border-[#d4af37]/25 px-2 py-1 rounded-lg">
                          {isSelf ? t('جلستك', 'Your Session') : t('محمي', 'Protected')}
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmConfig({
                              isOpen: true,
                              type: 'danger',
                              title: t('إنهاء الجلسة المحددة', 'Terminate Selected Session'),
                              message: t(
                                `هل أنت متأكد من إنهاء جلسة ${sess.fullName} على الجهاز "${sess.deviceInfo || 'غير معروف'}"؟`,
                                `Are you sure you want to terminate ${sess.fullName}'s session on "${sess.deviceInfo || 'Unknown'}"?`
                              ),
                              onConfirm: async () => {
                                try {
                                  await updateDoc(doc(db, 'sessions', sess.id), { forceLogout: true });
                                  await activityLogService.log('terminate_session', sess.fullName, { sessionId: sess.id, deviceInfo: sess.deviceInfo });
                                  notificationService.notify({
                                    title: t('تم تسجيل الخروج', 'Logged Out'),
                                    message: t('تم إرسال أمر الخروج للجلسة بنجاح', 'Logout command sent successfully'),
                                    type: 'success',
                                    category: 'system'
                                  });
                                } catch (err: any) {
                                  notificationService.notify({
                                    title: t('خطأ', 'Error'),
                                    message: err.message,
                                    type: 'error',
                                    category: 'system'
                                  });
                                }
                              }
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/20 text-rose-400 border border-rose-900/30 hover:bg-rose-950/40 rounded-lg text-[9px] font-black transition-all mx-auto"
                        >
                          <Zap className="w-3 h-3" /> {t('إنهاء الجلسة', 'Terminate')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
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
  );
};

export default UserSessionsTab;
