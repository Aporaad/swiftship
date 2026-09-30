import React from 'react';
import { POSITION_LABELS } from '../constants';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

export interface JobApplicationsTabProps {
  [key: string]: any;
}

export const JobApplicationsTab: React.FC<JobApplicationsTabProps> = (props) => {
  const { activeTab, isAr, jobApplications, handleDeleteJob, handleJobStatus } = props;

  return (
    <>
      {/* ── TAB 6: Job Applications (jobs_req) ────────────────────────────── */}
      {activeTab === 'jobs' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-purple-400" />
              {isAr ? 'استقبال وإدارة طلبات التوظيف (jobs_req)' : 'Job Applications Management'}
            </h3>
            <span className="text-xs text-slate-400 font-bold">{jobApplications.length} طلبات توظيف</span>
          </div>

          {jobApplications.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-[#0a0a0c] border border-white/[0.04] rounded-3xl">
              <UserCheck className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-white">{isAr ? 'لا توجد طلبات توظيف حالياً' : 'No job applications found'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobApplications.map(app => {
                const posObj = POSITION_LABELS[app.jobPosition] || { ar: app.jobPosition || 'وظيفة عامة', en: '' };
                const appStatus = app.status || 'pending_review';

                return (
                  <div key={app.id} className="bg-[#0a0a0c] border border-slate-900 hover:border-amber-500/30 p-5 rounded-2xl space-y-3 transition-all">
                    <div className="flex justify-between items-start border-b border-white/[0.04] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-base">{app.fullName}</h4>
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold">
                            {posObj.ar}
                          </span>
                          {app.refCode && <span className="text-[10px] font-mono text-slate-500">[{app.refCode}]</span>}
                        </div>
                        <span className="text-xs text-slate-400 block mt-1">📱 {app.phone} • ✉️ {app.email || '—'} • 📍 {app.city} {app.address}</span>
                      </div>

                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${appStatus === 'approved' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' :
                          appStatus === 'under_review' ? 'bg-blue-950/40 text-blue-400 border-blue-800/40' :
                            appStatus === 'rejected' ? 'bg-rose-950/40 text-rose-400 border-rose-800/40' :
                              'bg-amber-950/40 text-amber-400 border-amber-800/40'
                        }`}>
                        {appStatus === 'approved' ? 'مقبول ومعتمد ✓' :
                          appStatus === 'under_review' ? 'تحت التقييم والمقابلة' :
                            appStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-black/40 p-3 rounded-xl border border-white/[0.02]">
                      <div><span className="text-slate-500 block text-[10px]">المؤهل العلمى</span><span className="font-bold text-slate-300">{app.qualification || 'غير محدد'}</span></div>
                      <div><span className="text-slate-500 block text-[10px]">سنوات الخبرة</span><span className="font-bold text-slate-300">{app.experienceYears || 0} سنوات</span></div>
                      <div><span className="text-slate-500 block text-[10px]">رقم الهوية</span><span className="font-mono text-slate-300">{app.idNumber || '—'}</span></div>
                      <div><span className="text-slate-500 block text-[10px]">تاريخ التقديم</span><span className="font-mono text-slate-300">{new Date(app.createdAt || Date.now()).toLocaleDateString('en-GB')}</span></div>
                    </div>

                    {app.notes && (
                      <div className="text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                        <span className="text-[10px] text-amber-400 font-bold block">نبذة الخبرات والسيرة الذاتية:</span>
                        <p className="text-slate-300 whitespace-pre-wrap mt-0.5">{app.notes}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2">
                      <button onClick={() => handleDeleteJob(app.id)} className="px-3 py-1.5 bg-rose-950/30 text-rose-400 text-xs rounded-xl border border-rose-800/30 cursor-pointer">
                        {isAr ? 'حذف' : 'Delete'}
                      </button>

                      <div className="flex gap-2">
                        {appStatus !== 'under_review' && (
                          <button onClick={() => handleJobStatus(app.id, 'under_review')} className="px-3 py-1.5 bg-blue-950/30 text-blue-400 text-xs font-bold rounded-xl border border-blue-800/30 cursor-pointer">
                            {isAr ? 'تعيين تحت التقييم' : 'Under Review'}
                          </button>
                        )}
                        {appStatus !== 'rejected' && (
                          <button onClick={() => handleJobStatus(app.id, 'rejected')} className="px-3 py-1.5 bg-rose-950/30 text-rose-400 text-xs font-bold rounded-xl border border-rose-800/30 cursor-pointer">
                            {isAr ? 'رفض' : 'Reject'}
                          </button>
                        )}
                        {appStatus !== 'approved' && (
                          <button onClick={() => handleJobStatus(app.id, 'approved')} className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-xs font-black rounded-xl shadow cursor-pointer">
                            {isAr ? 'قبول واعتماد التوظيف' : 'Approve & Hire'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default JobApplicationsTab;
