import React from 'react';
import { AlertTriangle, ChevronRight, X, Zap } from 'lucide-react';

export interface SessionActionModalProps {
  isOpen: boolean;
  sessionTargetUser: any;
  isAr: boolean;
  t: (ar: string, en: string) => string;
  isUserOnline: (user: any) => boolean;
  getRoleBadgeStyle: (role: string) => string;
  SESSION_ACTIONS: (isAr: boolean) => any[];
  setIsSessionModalOpen: (open: boolean) => void;
  setSessionTargetUser: (user: any) => void;
  setConfirmConfig: (config: any) => void;
  handleSessionAction: (user: any, action: any) => void;
}

/** Session action dialog kept separate from the page shell. */
export const SessionActionModal: React.FC<SessionActionModalProps> = ({
  isOpen, sessionTargetUser, isAr, t, isUserOnline, getRoleBadgeStyle,
  SESSION_ACTIONS, setIsSessionModalOpen, setSessionTargetUser,
  setConfirmConfig, handleSessionAction
}) => {
  if (!isOpen || !sessionTargetUser) return null;

  return (
    <>
      {/* ══════════════════════════════════════════════════ */}
      {/* SESSION ACTION MODAL — ENHANCED                   */}
      {/* ══════════════════════════════════════════════════ */}
      {isOpen && sessionTargetUser && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#141418] to-[#0a0a0d] border border-rose-900/30 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-rose-900/20 flex justify-between items-center bg-rose-950/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-rose-950/30 border border-rose-900/30 rounded-xl flex items-center justify-center">
                  <Zap className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-xs uppercase tracking-widest">{t('إجراءات الجلسة', 'Session Actions')}</h3>
                  <p className="text-[9px] text-rose-400/70 font-bold mt-0.5">{sessionTargetUser.fullName} — @{sessionTargetUser.username || sessionTargetUser.email}</p>
                </div>
              </div>
              <button onClick={() => { setIsSessionModalOpen(false); setSessionTargetUser(null); }} className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Info */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-3 p-3 bg-black/40 border border-slate-800/50 rounded-xl mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-sm">
                  {sessionTargetUser.fullName?.substring(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-black text-white">{sessionTargetUser.fullName}</div>
                  <div className="text-[9px] text-slate-500 font-mono">{sessionTargetUser.email}</div>
                </div>
                <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase ${getRoleBadgeStyle(sessionTargetUser.role)}`}>{sessionTargetUser.role}</span>
                {isUserOnline(sessionTargetUser) ? (
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-black">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>{t('نشط', 'ACTIVE')}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600 font-bold">{t('غير متصل', 'OFFLINE')}</span>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-950/10 border border-amber-900/20 rounded-xl mb-4">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[9px] text-amber-300/80 font-bold leading-relaxed">
                  {t('الإجراءات أدناه تؤثر على جلسة هذا المستخدم فوراً. سيتلقى المستخدم إشعاراً وسيُعاد توجيهه لصفحة تسجيل الدخول.', 'Actions below immediately affect this user\'s session. They will be redirected to login.')}
                </p>
              </div>
            </div>

            {/* Actions List */}
            <div className="px-5 pb-5 space-y-2">
              {SESSION_ACTIONS(isAr).map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      setIsSessionModalOpen(false);
                      setConfirmConfig({
                        isOpen: true,
                        type: action.severity as any,
                        title: action.label,
                        message: isAr
                          ? `هل أنت متأكد من تنفيذ "${action.label}" على حساب ${sessionTargetUser.fullName}؟`
                          : `Are you sure you want to "${action.label}" for ${sessionTargetUser.fullName}?`,
                        onConfirm: () => handleSessionAction(sessionTargetUser, action.id)
                      });
                    }}
                    className={`w-full flex items-start gap-3 p-3.5 rounded-xl border border-${action.color}-900/20 bg-${action.color}-950/10 hover:bg-${action.color}-950/25 transition-all text-start group`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-${action.color}-950/30 border border-${action.color}-900/30 flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 text-${action.color}-400`} />
                    </div>
                    <div className="flex-1">
                      <div className={`text-xs font-black text-${action.color}-300 group-hover:text-${action.color}-200 transition-colors`}>{action.label}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">{action.desc}</div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-${action.color}-500 shrink-0 mt-1`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default SessionActionModal;
