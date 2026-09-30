import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

export interface PendingApprovalsTabProps {
  [key: string]: any;
}

export const PendingApprovalsTab: React.FC<PendingApprovalsTabProps> = (props) => {
  const { activeTab, isAr, pendingUsers, actionId, handleUserApproval } = props;

  return (
    <>
      {/* ── TAB 2: Pending Approvals Queue ────────────────────────────────── */}
      {activeTab === 'pending' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              {isAr ? 'طابور الحسابات المعلقة في انتظار اعتمادك' : 'Pending Registrations Approval Queue'}
            </h3>
            <span className="text-xs text-slate-400 font-bold">{pendingUsers.length} طلبات معلقة</span>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-[#0a0a0c] border border-white/[0.04] rounded-3xl">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
              <p className="text-sm font-bold text-white">{isAr ? 'جميع حسابات البوابة مراجعة ومكتملة!' : 'All portal registrations reviewed!'}</p>
              <p className="text-xs text-slate-400">{isAr ? 'سيظهر أي تسجيل جديد للعملاء أو المناديب هنا تلقائياً' : 'New registrations will automatically appear here'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingUsers.map(u => (
                <div key={u.id} className="bg-[#0a0a0c] border border-slate-900 hover:border-amber-500/30 p-5 rounded-2xl space-y-3 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-sm">{u.fullName || u.email}</h4>
                      <span className="text-xs text-slate-400 block font-mono">{u.email}</span>
                      <span className="text-xs text-slate-400 block">{u.phone} • {u.city || '—'}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold uppercase">
                      {u.portalRole || 'customer'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={actionId === u.id}
                        onClick={() => handleUserApproval(u, 'rejected')}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 border border-rose-800/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        {isAr ? 'رفض' : 'Reject'}
                      </button>
                      <button
                        disabled={actionId === u.id}
                        onClick={() => handleUserApproval(u, 'approved')}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1"
                      >
                        {actionId === u.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {isAr ? 'اعتماد وإنشاء حساب مالي' : 'Approve & Create Account'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PendingApprovalsTab;
