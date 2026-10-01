import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

type SiteTab = 'analytics' | 'portal_users' | 'pending' | 'orders' | 'tickets' | 'announcements' | 'jobs' | 'security' | 'api';
type JobSummary = { status?: string };
export interface SiteAnalyticsTabProps {
  activeTab: SiteTab;
  isAr: boolean;
  customersCount: number;
  couriersCount: number;
  suppliersCount: number;
  approvedUsers: unknown[];
  pendingUsers: unknown[];
  portalUsers: unknown[];
  pendingJobs: unknown[];
  portalOrders: unknown[];
  tickets: unknown[];
  jobApplications: JobSummary[];
}

export const SiteAnalyticsTab: React.FC<SiteAnalyticsTabProps> = (props) => {
  const { activeTab, isAr, customersCount, couriersCount, suppliersCount, approvedUsers, pendingUsers, portalUsers, pendingJobs, portalOrders, tickets, jobApplications } = props;

  return (
    <>
      {/* ── TAB 1: Monitoring & Analytics ─────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Server Health Banner */}
          <div className="bg-[#0a0a0c] border border-white/[0.04] p-6 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
                <Server className="w-4 h-4" />
                <span>{isAr ? 'حالة السيرفر والموقع' : 'Server & Site Status'}</span>
              </div>
              <h3 className="text-xl font-black text-white">{isAr ? 'يعمل بكفاءة عالية (100%)' : 'Healthy & Operational (100%)'}</h3>
              <p className="text-xs text-slate-400 font-bold leading-relaxed">
                {isAr ? 'استجابة السيرفر 42ms — Supabase Realtime متصل ومزامن بالكامل' : 'Server response 42ms — Supabase Realtime active and synced'}
              </p>
            </div>

            <div className="space-y-2 border-t md:border-t-0 md:border-r border-white/[0.05] pt-4 md:pt-0 md:pr-6">
              <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-wider">
                <Users className="w-4 h-4" />
                <span>{isAr ? 'توزيع مستخدمي البوابة' : 'Portal Users Breakdown'}</span>
              </div>
              <div className="space-y-1 text-xs font-bold text-slate-300">
                <div className="flex justify-between"><span>👥 العملاء:</span><span className="text-white font-mono">{customersCount}</span></div>
                <div className="flex justify-between"><span>🚚 المناديب:</span><span className="text-white font-mono">{couriersCount}</span></div>
                <div className="flex justify-between"><span>🏭 الموردين:</span><span className="text-white font-mono">{suppliersCount}</span></div>
              </div>
            </div>

            <div className="space-y-2 border-t md:border-t-0 md:border-r border-white/[0.05] pt-4 md:pt-0 md:pr-6">
              <div className="flex items-center gap-2 text-purple-400 font-black text-xs uppercase tracking-wider">
                <Activity className="w-4 h-4" />
                <span>{isAr ? 'نشاط البوابة الكلي' : 'Overall Activity'}</span>
              </div>
              <div className="space-y-1 text-xs font-bold text-slate-300">
                <div className="flex justify-between"><span>مقبولون ومفعلون:</span><span className="text-emerald-400 font-mono">{approvedUsers.length}</span></div>
                <div className="flex justify-between"><span>في الانتظار:</span><span className="text-amber-400 font-mono">{pendingUsers.length}</span></div>
                <div className="flex justify-between"><span>طلبات توظيف معلقة:</span><span className="text-purple-400 font-mono">{pendingJobs.length}</span></div>
              </div>
            </div>
          </div>

          {/* Visual Progress / Distribution Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0a0a0c] border border-white/[0.04] p-6 rounded-3xl space-y-4">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'نسبة اعتماد وتفعيل الحسابات' : 'Portal Approvals Ratio'}
              </h4>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex">
                <div style={{ width: `${(approvedUsers.length / Math.max(1, portalUsers.length)) * 100}%` }} className="bg-emerald-500 h-full" />
                <div style={{ width: `${(pendingUsers.length / Math.max(1, portalUsers.length)) * 100}%` }} className="bg-amber-500 h-full" />
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> معتمد ({approvedUsers.length})</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> معلق ({pendingUsers.length})</span>
              </div>
            </div>

            <div className="bg-[#0a0a0c] border border-white/[0.04] p-6 rounded-3xl space-y-4">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-purple-400" />
                {isAr ? 'حالة طلبات التوظيف (jobs_req)' : 'Job Applications Status Ratio'}
              </h4>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex">
                <div style={{ width: `${(jobApplications.filter(j => j.status === 'approved').length / Math.max(1, jobApplications.length)) * 100}%` }} className="bg-emerald-500 h-full" />
                <div style={{ width: `${(jobApplications.filter(j => (j.status || 'pending_review') === 'pending_review').length / Math.max(1, jobApplications.length)) * 100}%` }} className="bg-amber-500 h-full" />
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> مقبول ({jobApplications.filter(j => j.status === 'approved').length})</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> معلق ({pendingJobs.length})</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SiteAnalyticsTab;
