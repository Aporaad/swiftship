import React, { useState, useEffect } from 'react';
import { Briefcase, X, Check, ShieldAlert, RefreshCw, User, Phone, Mail, MapPin, Award, Clock, FileText, Trash2, UserCheck, AlertCircle } from 'lucide-react';
import { supabase, doc, setDoc, db } from '../lib/supabase-firebase-adapter';
import { financialAccountService } from '../services/financialAccountService';

function extractRows(data: any[]): any[] {
  return (data || []).map(row => {
    const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
    return { id: row.id, ...payload };
  });
}

const POSITION_LABELS: Record<string, { ar: string; en: string }> = {
  local_courier: { ar: '🚚 مندوب توصيل شحنات محلي', en: 'Local Delivery Courier' },
  sourcing_courier: { ar: '📦 مندوب شراء وتوريد مصانع', en: 'Sourcing Courier' },
  customer_service: { ar: '🎧 موظف استقبال وخدمة عملاء', en: 'Customer Service & Reception' },
  accountant: { ar: '📊 محاسب مالي', en: 'Financial Accountant' },
  warehouse_manager: { ar: '🏬 أمين مستودع ولوجستيات', en: 'Warehouse Specialist' },
  branch_manager: { ar: '🏢 مدير فرع', en: 'Branch Manager' },
  other: { ar: '💼 وظيفة أخرى', en: 'Other Role' },
};

export default function JobApplicationsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadApplications();
  }, [isOpen]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('jobs_req').select('*');
      if (error) {
        console.warn('[JobApplicationsModal] Fetch error:', error.message);
        setApplications([]);
      } else {
        const rows = extractRows(data || []);
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setApplications(rows);
      }
    } catch (err) {
      console.error('[JobApplicationsModal] Error loading applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (appId: string, newStatus: string) => {
    setActioningId(appId);
    try {
      const existing = applications.find(a => a.id === appId) || {};
      const updatedPayload = {
        ...existing,
        status: newStatus,
        updatedAt: Date.now()
      };
      const { id: _, ...cleanPayload } = updatedPayload;
      await supabase.from('jobs_req').update({ data: cleanPayload }).eq('id', appId);

      // If approved and applicant applied for courier role, auto-register as courier in system
      if (newStatus === 'approved' && (existing.jobPosition === 'local_courier' || existing.jobPosition === 'sourcing_courier')) {
        try {
          const courierId = `cour_job_${appId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`;
          const type = existing.jobPosition === 'sourcing_courier' ? 'sourcing' : 'local';
          const courierData = {
            fullName: existing.fullName || '',
            phone: existing.phone || '',
            email: existing.email || '',
            address: `${existing.city || ''} ${existing.address || ''}`.trim(),
            disabled: false,
            courierType: type,
            notes: `تم توظيفه واعتماد طلب توظيفه (${existing.refCode || 'طلب توظيف'})`,
            createdAt: Date.now(),
          };
          await setDoc(doc(db, 'couriers', courierId), courierData, { merge: true });
          await financialAccountService.createAccountForEntity(
            'courier',
            courierId,
            existing.fullName || 'مندوب جديد',
            type === 'sourcing' ? 'SAR' : 'YER'
          );
        } catch (cErr) {
          console.warn('[JobApplicationsModal] Courier auto-creation notice:', cErr);
        }
      }

      await loadApplications();
    } catch (err) {
      console.error('[JobApplicationsModal] Error updating status:', err);
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (appId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) return;
    setActioningId(appId);
    try {
      await supabase.from('jobs_req').delete().eq('id', appId);
      await loadApplications();
    } catch (err) {
      console.error('[JobApplicationsModal] Error deleting application:', err);
    } finally {
      setActioningId(null);
    }
  };

  const filteredApps = applications.filter(a => {
    if (statusFilter === 'all') return true;
    return (a.status || 'pending_review') === statusFilter;
  });

  const pendingCount = applications.filter(a => (a.status || 'pending_review') === 'pending_review').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#0d0d0f] border border-[#d4af37]/30 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">استقبال وإدارة طلبات التوظيف (jobs_req)</h2>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
                    {pendingCount} جديد
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">مراجعة وتوظيف الكوادر المتقدمة عبر موقع البوابة المباشر</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadApplications} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-900 bg-slate-950/40 flex flex-wrap gap-2 text-xs font-bold shrink-0">
          {[
            { key: 'all', label: `الكل (${applications.length})` },
            { key: 'pending_review', label: `قيد المراجعة (${pendingCount})` },
            { key: 'under_review', label: `تحت التقييم (${applications.filter(a => a.status === 'under_review').length})` },
            { key: 'approved', label: `مقبول ومُعظّم (${applications.filter(a => a.status === 'approved').length})` },
            { key: 'rejected', label: `مرفوض (${applications.filter(a => a.status === 'rejected').length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-slate-400">جاري تحميل طلبات التوظيف...</p>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <UserCheck className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-medium">لا توجد طلبات توظيف في هذه الفئة</p>
              <p className="text-xs text-slate-500">سيتم إدراج أي طلب توظيف يقدمه الزوار عبر البوابة فورياً هنا.</p>
            </div>
          ) : (
            filteredApps.map(app => {
              const posObj = POSITION_LABELS[app.jobPosition] || { ar: app.jobPosition || 'وظيفة عامة', en: '' };
              const appStatus = app.status || 'pending_review';

              return (
                <div key={app.id} className="bg-slate-950/70 border border-slate-900 hover:border-amber-500/30 p-5 rounded-2xl space-y-3 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-900 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{app.fullName}</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold">
                          {posObj.ar}
                        </span>
                        {app.refCode && (
                          <span className="text-[10px] font-mono text-slate-500">[{app.refCode}]</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-4">
                        <span>📱 {app.phone}</span>
                        {app.email && <span>✉️ {app.email}</span>}
                        <span>📍 {app.city} {app.address}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        appStatus === 'approved' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' :
                        appStatus === 'under_review' ? 'bg-blue-950/40 text-blue-400 border-blue-800/40' :
                        appStatus === 'rejected' ? 'bg-rose-950/40 text-rose-400 border-rose-800/40' :
                        'bg-amber-950/40 text-amber-400 border-amber-800/40'
                      }`}>
                        {appStatus === 'approved' ? 'مقبول ومعتمد ✓' :
                         appStatus === 'under_review' ? 'تحت التقييم والمقابلة' :
                         appStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(app.createdAt || Date.now()).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-black/40 p-3 rounded-xl border border-white/[0.02]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">المؤهل العلمي</span>
                      <span className="font-bold text-slate-300">{app.qualification || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">سنوات الخبرة</span>
                      <span className="font-bold text-slate-300">{app.experienceYears || 0} سنوات</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">رقم الهوية</span>
                      <span className="font-mono text-slate-300">{app.idNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">تاريخ التقديم</span>
                      <span className="font-mono text-slate-300">{new Date(app.createdAt || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Notes / Resume summary */}
                  {app.notes && (
                    <div className="text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/60 space-y-1">
                      <span className="text-[10px] text-amber-400 font-bold block">نبذة الخبرات والسيرة الذاتية / ملاحظات المتقدم:</span>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{app.notes}</p>
                    </div>
                  )}

                  {/* Admin Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900/60">
                    <button
                      disabled={actioningId === app.id}
                      onClick={() => handleDelete(app.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 border border-rose-800/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>

                    <div className="flex items-center gap-2">
                      {appStatus !== 'under_review' && (
                        <button
                          disabled={actioningId === app.id}
                          onClick={() => updateApplicationStatus(app.id, 'under_review')}
                          className="px-3 py-1.5 rounded-lg bg-blue-950/30 text-blue-400 hover:bg-blue-900/50 border border-blue-800/30 text-xs font-bold transition-all cursor-pointer"
                        >
                          تعيين تحت التقييم
                        </button>
                      )}

                      {appStatus !== 'rejected' && (
                        <button
                          disabled={actioningId === app.id}
                          onClick={() => updateApplicationStatus(app.id, 'rejected')}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 border border-rose-800/30 text-xs font-bold transition-all cursor-pointer"
                        >
                          رفض
                        </button>
                      )}

                      {appStatus !== 'approved' && (
                        <button
                          disabled={actioningId === app.id}
                          onClick={() => updateApplicationStatus(app.id, 'approved')}
                          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold shadow-md shadow-amber-950/30 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {actioningId === app.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          قبول واعتماد التوظيف
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
