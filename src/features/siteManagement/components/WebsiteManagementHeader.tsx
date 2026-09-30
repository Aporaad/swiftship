import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

export interface WebsiteManagementHeaderProps {
  [key: string]: any;
}

export const WebsiteManagementHeader: React.FC<WebsiteManagementHeaderProps> = (props) => {
  const { isAr, loadAllData, loading, portalUsers, pendingUsers, portalOrders, jobApplications } = props;

  return (
    <>
      {/* ── Page Title & Main Header ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-950 via-[#0a0a0d] to-slate-950 border border-[#d4af37]/25 p-6 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4af37]/20 to-amber-900/20 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shadow-lg shadow-black/40 shrink-0">
              <Globe className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {isAr ? 'مركزيـة إدارة وربط موقع الويب والبوابة' : 'Web Portal & Website Management Hub'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE & SYNCED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-1">
                {isAr
                  ? 'منظومة متكاملة لمراقبة أداء الموقع، اعتماد حسابات البوابة، استقبال الطلبات والشكاوى وطلبات التوظيف، وإدارة الأمان'
                  : 'Integrated hub for monitoring site performance, portal approvals, web orders, support, job applications, and security'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAllData}
              className="px-4 py-2.5 bg-[#08080a] border border-[#d4af37]/20 hover:border-[#d4af37]/40 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 text-[#d4af37] ${loading ? 'animate-spin' : ''}`} />
              {isAr ? 'تحديث البيانات' : 'Sync All'}
            </button>
            <a
              href="http://localhost:5174"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-[#d4af37] text-black rounded-xl text-xs font-black shadow-lg shadow-amber-950/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ArrowUpRight className="w-4 h-4" />
              {isAr ? 'زيارة الموقع المباشر' : 'Visit Live Site'}
            </a>
          </div>
        </div>

        {/* Quick KPI Bar inside header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.05]">
          <div className="bg-black/40 border border-white/[0.03] p-3 rounded-2xl flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'مستخدمي البوابة' : 'Portal Users'}</span>
              <span className="text-sm font-black text-white">{portalUsers.length}</span>
            </div>
          </div>

          <div className="bg-black/40 border border-white/[0.03] p-3 rounded-2xl flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'اعتمادات معلقة' : 'Pending Approvals'}</span>
              <span className="text-sm font-black text-amber-400">{pendingUsers.length}</span>
            </div>
          </div>

          <div className="bg-black/40 border border-white/[0.03] p-3 rounded-2xl flex items-center gap-3">
            <Package className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'طلبات من الموقع' : 'Web Orders'}</span>
              <span className="text-sm font-black text-emerald-400">{portalOrders.length}</span>
            </div>
          </div>

          <div className="bg-black/40 border border-white/[0.03] p-3 rounded-2xl flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-purple-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'طلبات توظيف' : 'Job Applications'}</span>
              <span className="text-sm font-black text-purple-400">{jobApplications.length}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WebsiteManagementHeader;
