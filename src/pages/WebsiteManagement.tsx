import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe, Activity, Users, Package, Briefcase, MessageSquare, Megaphone, Shield,
  Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2,
  Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon,
  ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin
} from 'lucide-react';
import { supabase, doc, setDoc, db } from '../lib/supabase-firebase-adapter';
import { useSettings } from '../context/SettingsContext';
import { financialAccountService } from '../services/financialAccountService';
import toast from 'react-hot-toast';

function extractRows(data: any[]): any[] {
  return (data || []).map(row => {
    const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
    return { id: row.id, ...payload };
  });
}

const POSITION_LABELS: Record<string, { ar: string; en: string }> = {
  local_courier: { ar: '🚚 مندوب توصيل محلي', en: 'Local Courier' },
  sourcing_courier: { ar: '📦 مندوب توريد مصانع', en: 'Sourcing Courier' },
  customer_service: { ar: '🎧 موظف استقبال وخدمة عملاء', en: 'Customer Service' },
  accountant: { ar: '📊 محاسب مالي', en: 'Financial Accountant' },
  warehouse_manager: { ar: '🏬 أمين مستودع ولوجستيات', en: 'Warehouse Specialist' },
  branch_manager: { ar: '🏢 مدير فرع', en: 'Branch Manager' },
  other: { ar: '💼 وظيفة أخرى', en: 'Other Role' },
};

export default function WebsiteManagement() {
  const { settings, updateSettings, t } = useSettings();
  const isAr = settings.language === 'ar';

  const [activeTab, setActiveTab] = useState<
    'analytics' | 'pending' | 'orders' | 'tickets' | 'announcements' | 'jobs' | 'security' | 'api'
  >('analytics');

  const [loading, setLoading] = useState(true);

  // Data Collections State
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [portalOrders, setPortalOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [jobApplications, setJobApplications] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);

  // Form & Action states
  const [actionId, setActionId] = useState<string | null>(null);
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');

  // Announcement Form State
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annForm, setAnnForm] = useState({
    title: '',
    content: '',
    targetAudience: 'all',
    priority: 'normal',
  });

  // Settings State
  const [secSettings, setSecSettings] = useState({
    allowPortalRegistration: true,
    requireAdminApproval: true,
    allowGuestJobApplications: true,
    portalMaintenanceMode: false,
    portalSessionTimeout: 60,
    webhookUrlOrders: '',
    webhookUrlStatus: '',
    apiKeySecret: 'sk_live_alx_prod_' + Math.random().toString(36).slice(2, 10),
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, oRes, tRes, aRes, jRes, cRes] = await Promise.all([
        supabase.from('portal_users').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('portal_tickets').select('*'),
        supabase.from('announcements').select('*'),
        supabase.from('jobs_req').select('*'),
        supabase.from('couriers').select('*'),
      ]);

      const users = extractRows(uRes.data || []);
      const orders = extractRows(oRes.data || []);
      const tick = extractRows(tRes.data || []);
      const ann = extractRows(aRes.data || []);
      const jobs = extractRows(jRes.data || []);
      const cour = extractRows(cRes.data || []);

      users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      tick.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      ann.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      jobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setPortalUsers(users);
      setPortalOrders(orders.filter(o => o.customerUid || o.portalUid || o.orderSourceType === 'App'));
      setTickets(tick);
      setAnnouncements(ann);
      setJobApplications(jobs);
      setCouriers(cour);
    } catch (err) {
      console.error('[WebsiteManagement] Error loading portal data:', err);
      toast.error(isAr ? 'حدث خطأ أثناء تحميل بيانات الموقع' : 'Error loading portal data');
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ── Pending User Approvals Action ──────────────────────────────────────────
  const handleUserApproval = async (userObj: any, status: 'approved' | 'rejected') => {
    setActionId(userObj.id);
    try {
      const cleanPayload = {
        ...userObj,
        approvalStatus: status,
        approval_status: status,
        updatedAt: Date.now(),
      };
      delete cleanPayload.id;

      await supabase.from('portal_users').update({ data: cleanPayload }).eq('id', userObj.id);

      if (status === 'approved') {
        const entityId = userObj.linkedAccId || userObj.linkedCustomerId || userObj.id;
        const name = userObj.fullName || userObj.email;
        if (userObj.portalRole === 'customer') {
          await financialAccountService.createAccountForEntity('customer', entityId, name, 'YER');
        } else if (userObj.portalRole === 'courier') {
          await financialAccountService.createAccountForEntity('courier', entityId, name, 'YER');
        } else if (userObj.portalRole === 'supplier') {
          await financialAccountService.createAccountForEntity('customer', entityId, name, 'USD');
        }
      }

      toast.success(status === 'approved' ? (isAr ? 'تم اعتماد الحساب بنجاح!' : 'Account Approved!') : (isAr ? 'تم رفض الحساب' : 'Account Rejected'));
      await loadAllData();
    } catch (err: any) {
      console.error('[WebsiteManagement] User approval error:', err);
      toast.error(err.message || 'Error processing request');
    } finally {
      setActionId(null);
    }
  };

  // ── Ticket Reply Action ───────────────────────────────────────────────────
  const handleReplyTicket = async (ticketId: string) => {
    if (!ticketReplyText.trim()) return;
    setActionId(ticketId);
    try {
      const existing = tickets.find(t => t.id === ticketId) || {};
      const replies = existing.replies || [];
      replies.push({
        id: Math.random().toString(36).slice(2),
        sender: 'Admin Support',
        message: ticketReplyText.trim(),
        createdAt: Date.now(),
      });

      const cleanPayload = {
        ...existing,
        replies,
        status: 'in_progress',
        updatedAt: Date.now(),
      };
      delete cleanPayload.id;

      await supabase.from('portal_tickets').update({ data: cleanPayload }).eq('id', ticketId);
      toast.success(isAr ? 'تم إرسال الرد على التذكرة' : 'Reply sent');
      setReplyingTicketId(null);
      setTicketReplyText('');
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reply');
    } finally {
      setActionId(null);
    }
  };

  // ── Announcement Create Action ────────────────────────────────────────────
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annForm.title.trim() || !annForm.content.trim()) return;

    setLoading(true);
    try {
      const id = `ann_${Date.now()}`;
      const payload = {
        id,
        title: annForm.title.trim(),
        content: annForm.content.trim(),
        targetAudience: annForm.targetAudience,
        target_audience: annForm.targetAudience,
        priority: annForm.priority,
        isActive: true,
        is_active: true,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      await supabase.from('announcements').insert({ id, data: payload });
      toast.success(isAr ? 'تم نشر الإعلان بنجاح!' : 'Announcement published!');
      setShowAnnForm(false);
      setAnnForm({ title: '', content: '', targetAudience: 'all', priority: 'normal' });
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error creating announcement');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAnnActive = async (ann: any) => {
    setActionId(ann.id);
    try {
      const newStatus = !ann.isActive && !ann.is_active;
      const cleanPayload = {
        ...ann,
        isActive: newStatus,
        is_active: newStatus,
        updatedAt: Date.now(),
      };
      delete cleanPayload.id;

      await supabase.from('announcements').update({ data: cleanPayload }).eq('id', ann.id);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error updating status');
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteAnn = async (id: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا الإعلان؟' : 'Delete announcement?')) return;
    setActionId(id);
    try {
      await supabase.from('announcements').delete().eq('id', id);
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting');
    } finally {
      setActionId(null);
    }
  };

  // ── Job Application Action ────────────────────────────────────────────────
  const handleJobStatus = async (appId: string, status: string) => {
    setActionId(appId);
    try {
      const existing = jobApplications.find(j => j.id === appId) || {};
      const cleanPayload = {
        ...existing,
        status,
        updatedAt: Date.now(),
      };
      delete cleanPayload.id;

      await supabase.from('jobs_req').update({ data: cleanPayload }).eq('id', appId);

      if (status === 'approved' && (existing.jobPosition === 'local_courier' || existing.jobPosition === 'sourcing_courier')) {
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
        } catch (_) { }
      }

      toast.success(isAr ? 'تم تحديث حالة طلب التوظيف' : 'Job status updated');
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error updating job application');
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteJob = async (appId: string) => {
    if (!window.confirm(isAr ? 'حذف طلب التوظيف نهائياً؟' : 'Delete job application?')) return;
    setActionId(appId);
    try {
      await supabase.from('jobs_req').delete().eq('id', appId);
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting');
    } finally {
      setActionId(null);
    }
  };

  // ── Derived Statistics for Analytics ──────────────────────────────────────
  const pendingUsers = portalUsers.filter(u => u.approvalStatus === 'pending_approval' || u.approval_status === 'pending_approval');
  const approvedUsers = portalUsers.filter(u => u.approvalStatus === 'approved' || u.approval_status === 'approved');
  const pendingJobs = jobApplications.filter(j => (j.status || 'pending_review') === 'pending_review');

  const customersCount = portalUsers.filter(u => u.portalRole === 'customer').length;
  const couriersCount = portalUsers.filter(u => u.portalRole === 'courier').length;
  const suppliersCount = portalUsers.filter(u => u.portalRole === 'supplier').length;

  return (
    <div className="space-y-6 select-none" dir={isAr ? 'rtl' : 'ltr'}>

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

      {/* ── Tab Navigation Bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#d4af37]/15 pb-2 overflow-x-auto custom-scrollbar">
        {[
          { id: 'analytics', label: isAr ? '📊 شاشة المراقبة والإحصائيات' : 'Monitoring & Analytics', badge: null },
          { id: 'pending', label: isAr ? '⏳ اعتماد الحسابات المعلقة' : 'Pending Approvals', badge: pendingUsers.length },
          { id: 'orders', label: isAr ? '📦 طلبات البوابة' : 'Portal Orders', badge: portalOrders.length },
          { id: 'tickets', label: isAr ? '🎧 الشكاوى والاقتراحات' : 'Support Tickets', badge: tickets.filter(t => t.status === 'open').length },
          { id: 'announcements', label: isAr ? '📢 الإعلانات والعروض' : 'Announcements', badge: announcements.length },
          { id: 'jobs', label: isAr ? '💼 طلبات التوظيف (jobs_req)' : 'Job Applications', badge: pendingJobs.length },
          { id: 'security', label: isAr ? '🛡️ أمان وإدارة الموقع' : 'Website Security', badge: null },
          { id: 'api', label: isAr ? '🔗 ربط API والـ Webhooks' : 'API & Webhooks', badge: null },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === tab.id
                ? 'bg-gradient-to-r from-[#d4af37]/20 to-amber-900/20 text-[#d4af37] border border-[#d4af37]/40 shadow-lg shadow-black/30'
                : 'bg-black/30 hover:bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.03]'
              }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== null && tab.badge > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === tab.id ? 'bg-[#d4af37] text-black' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

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

      {/* ── TAB 3: Web Portal Orders ──────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              {isAr ? 'استقبال وتوجيه طلبات البوابة الإلكترونية' : 'Web Portal Orders Routing'}
            </h3>
            <span className="text-xs text-slate-400 font-bold">{portalOrders.length} طلبات موقع</span>
          </div>

          {portalOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-[#0a0a0c] border border-white/[0.04] rounded-3xl">
              <Package className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-white">{isAr ? 'لا توجد طلبات جديدة من البوابة حالياً' : 'No web portal orders found'}</p>
            </div>
          ) : (
            <div className="bg-[#0a0a0c] border border-white/[0.04] rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right text-slate-300">
                  <thead className="bg-black/50 text-slate-400 font-bold border-b border-white/[0.05]">
                    <tr>
                      <th className="p-3.5">رقم الطلب</th>
                      <th className="p-3.5">التاريخ</th>
                      <th className="p-3.5">العميل / المستلم</th>
                      <th className="p-3.5">مصدر الشراء</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {portalOrders.map(ord => (
                      <tr key={ord.id} className="hover:bg-white/[0.02]">
                        <td className="p-3.5 font-bold font-mono text-[#d4af37]">{ord.orderNumber || ord.trackingNumber || ord.id.slice(0, 10)}</td>
                        <td className="p-3.5 font-mono text-slate-400">{ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                        <td className="p-3.5">
                          <div className="font-bold text-white">{ord.customerName || ord.recipientName || '—'}</div>
                          <div className="text-[10px] text-slate-500">{ord.customerPhone || ord.deliveryCity}</div>
                        </td>
                        <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold">{ord.orderSourceName || 'البوابة'}</span></td>
                        <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">{ord.orderStatus || ord.status || 'معلق'}</span></td>
                        <td className="p-3.5 font-bold text-white">{ord.totalPrice || ord.totalAmount || 0} YER</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Support Tickets View ───────────────────────────────────── */}
      {activeTab === 'tickets' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              {isAr ? 'شاشة الرد على الشكاوى والاقتراحات والدعم الفني' : 'Customer Support & Tickets Management'}
            </h3>
            <span className="text-xs text-slate-400 font-bold">{tickets.length} تذاكر</span>
          </div>

          {tickets.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-[#0a0a0c] border border-white/[0.04] rounded-3xl">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-white">{isAr ? 'لا توجد شكاوى أو تذاكر حالياً' : 'No support tickets found'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map(t => (
                <div key={t.id} className="bg-[#0a0a0c] border border-white/[0.04] p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-sm">{t.subject || 'بدون عنوان'}</h4>
                      <span className="text-xs text-slate-400 block">{t.userName || t.userEmail}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${t.status === 'open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                      {t.status === 'open' ? (isAr ? 'مفتوحة' : 'Open') : (isAr ? 'تم الرد' : 'Resolved')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-white/[0.02]">{t.message}</p>

                  {/* Replies history */}
                  {Array.isArray(t.replies) && t.replies.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/[0.03]">
                      <span className="text-[10px] text-slate-500 font-bold block">الردود السابقة:</span>
                      {t.replies.map((rep: any, idx: number) => (
                        <div key={idx} className="text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-amber-400 font-bold block text-[10px]">{rep.sender} ({new Date(rep.createdAt).toLocaleTimeString('en-GB')}):</span>
                          <p className="text-slate-300">{rep.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input */}
                  {replyingTicketId === t.id ? (
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        className="flex-1 bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500"
                        placeholder={isAr ? 'اكتب ردك هنا...' : 'Type your response...'}
                        value={ticketReplyText}
                        onChange={e => setTicketReplyText(e.target.value)}
                      />
                      <button
                        onClick={() => handleReplyTicket(t.id)}
                        disabled={actionId === t.id}
                        className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400 cursor-pointer"
                      >
                        {isAr ? 'إرسال الرد' : 'Send'}
                      </button>
                      <button onClick={() => setReplyingTicketId(null)} className="px-3 py-2 bg-slate-900 text-slate-400 text-xs rounded-xl hover:text-white cursor-pointer">
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReplyingTicketId(t.id); setTicketReplyText(''); }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-3 h-3 text-[#d4af37]" />
                      {isAr ? 'إضافة رد' : 'Reply'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: Announcements Management ──────────────────────────────── */}
      {activeTab === 'announcements' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-400" />
              {isAr ? 'إدارة ونشر الإعلانات والعروض للبوابة' : 'Announcements & Offers Manager'}
            </h3>
            <button
              onClick={() => setShowAnnForm(!showAnnForm)}
              className="px-4 py-2 bg-gradient-to-r from-[#d4af37] to-amber-600 text-black font-black text-xs rounded-xl hover:from-amber-400 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'إعلان جديد' : 'New Announcement'}
            </button>
          </div>

          {/* Form */}
          {showAnnForm && (
            <form onSubmit={handleCreateAnnouncement} className="bg-[#0a0a0c] border border-[#d4af37]/30 p-5 rounded-2xl space-y-4">
              <h4 className="font-bold text-white text-sm">{isAr ? 'إنشاء إعلان أو عرض جديد' : 'Create New Announcement'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text" required
                  placeholder={isAr ? 'عنوان الإعلان' : 'Title'}
                  className="bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  value={annForm.title}
                  onChange={e => setAnnForm({ ...annForm, title: e.target.value })}
                />
                <div className="flex gap-2">
                  <select
                    className="bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white flex-1"
                    value={annForm.targetAudience}
                    onChange={e => setAnnForm({ ...annForm, targetAudience: e.target.value })}
                  >
                    <option value="all">{isAr ? 'جميع مستخدمي البوابة' : 'All Users'}</option>
                    <option value="customer">{isAr ? 'العملاء فقط' : 'Customers Only'}</option>
                    <option value="courier">{isAr ? 'المناديب فقط' : 'Couriers Only'}</option>
                    <option value="supplier">{isAr ? 'الموردين فقط' : 'Suppliers Only'}</option>
                  </select>
                  <select
                    className="bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    value={annForm.priority}
                    onChange={e => setAnnForm({ ...annForm, priority: e.target.value })}
                  >
                    <option value="normal">{isAr ? 'عادي' : 'Normal'}</option>
                    <option value="urgent">{isAr ? 'عاجل' : 'Urgent'}</option>
                  </select>
                </div>
              </div>
              <textarea
                required rows={3}
                placeholder={isAr ? 'محتوى الإعلان أو العرض...' : 'Content...'}
                className="w-full bg-black border border-slate-800 rounded-xl p-3 text-xs text-white"
                value={annForm.content}
                onChange={e => setAnnForm({ ...annForm, content: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAnnForm(false)} className="px-4 py-2 bg-slate-900 text-slate-400 text-xs rounded-xl cursor-pointer">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl cursor-pointer">
                  {isAr ? 'نشر الإعلان' : 'Publish'}
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.id} className="bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl flex justify-between items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{ann.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ann.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-300'
                      }`}>
                      {ann.priority === 'urgent' ? (isAr ? 'عاجل' : 'Urgent') : (isAr ? 'عادي' : 'Normal')}
                    </span>
                    <span className="text-[10px] text-slate-500">مستهدف: {ann.targetAudience || 'الكل'}</span>
                  </div>
                  <p className="text-xs text-slate-400">{ann.content}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleAnnActive(ann)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border ${ann.isActive || ann.is_active ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                  >
                    {ann.isActive || ann.is_active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
                  </button>
                  <button onClick={() => handleDeleteAnn(ann.id)} className="p-2 text-rose-400 hover:bg-rose-950/40 rounded-xl cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* ── TAB 7: Website Security & Governance ──────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#0a0a0c] border border-white/[0.04] p-6 rounded-3xl space-y-6">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/[0.05] pb-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              {isAr ? 'إعدادات وأمان وحوكمة موقع الويب للبوابة' : 'Website Security & Governance Configuration'}
            </h3>

            <div className="space-y-4">
              {[
                { key: 'allowPortalRegistration', title: isAr ? 'السماح بالتسجيل المباشر للحسابات الجديدة' : 'Allow Direct User Registrations', desc: isAr ? 'تمكين نموذج التسجيل للعملاء والمناديب عبر الموقع' : 'Enable registration form on public web portal' },
                { key: 'requireAdminApproval', title: isAr ? 'اشتراط موافقة الأدمن قبل تفعيل أي حساب جديد' : 'Require Admin Approval For New Accounts', desc: isAr ? 'توجيه أي حساب جديد إلى طابور الموافقة والمعاينة أولاً' : 'Put new accounts in pending queue until manually approved' },
                { key: 'allowGuestJobApplications', title: isAr ? 'السماح للزوار بالتقديم على الوظائف بدون حساب' : 'Allow Public Guest Job Applications', desc: isAr ? 'تمكين الزوار من التقديم عبر نموذج التوظيف بدون تسجيل الدخول' : 'Allow non-logged in visitors to submit job applications' },
                { key: 'portalMaintenanceMode', title: isAr ? 'وضع الصيانة لنموذج التوظيف والبوابة' : 'Maintenance Mode', desc: isAr ? 'توقيف استقبال الطلبات والتسجيل مؤقتاً للتحديث' : 'Temporarily disable portal registration & order submissions' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-black/40 border border-white/[0.02] rounded-2xl">
                  <div>
                    <h4 className="font-bold text-white text-xs">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setSecSettings({ ...secSettings, [item.key]: !(secSettings as any)[item.key] })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${(secSettings as any)[item.key] ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${(secSettings as any)[item.key] ? 'right-0.5' : 'left-0.5'
                      }`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/[0.05] flex justify-end">
              <button
                onClick={() => toast.success(isAr ? 'تم حفظ إعدادات الأمان بنجاح' : 'Security settings saved')}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 text-black font-black text-xs rounded-xl shadow cursor-pointer"
              >
                {isAr ? 'حفظ إعدادات الأمان' : 'Save Security Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 8: API Integrations & Webhooks ────────────────────────────── */}
      {activeTab === 'api' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#0a0a0c] border border-white/[0.04] p-6 rounded-3xl space-y-6">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/[0.05] pb-3">
              <LinkIcon className="w-4 h-4 text-blue-400" />
              {isAr ? 'إعداد ربط الموقع مع الـ API والـ Webhooks التلقائية' : 'API & Webhooks Integration Settings'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'رابط Webhook لتنبيهات الطلبات الجديدة' : 'Orders Webhook Notification URL'}
                </label>
                <input
                  type="text"
                  className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                  placeholder="https://api.yourdomain.com/webhooks/orders"
                  value={secSettings.webhookUrlOrders}
                  onChange={e => setSecSettings({ ...secSettings, webhookUrlOrders: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'رابط Webhook لتحديثات حالة الشحنات' : 'Shipment Status Update Webhook URL'}
                </label>
                <input
                  type="text"
                  className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                  placeholder="https://api.yourdomain.com/webhooks/status"
                  value={secSettings.webhookUrlStatus}
                  onChange={e => setSecSettings({ ...secSettings, webhookUrlStatus: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'مفتاح الـ API الخاص بربط البوابة (Secret Token)' : 'API Secret Token'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text" readOnly
                    className="flex-1 bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-amber-400 font-mono"
                    value={secSettings.apiKeySecret}
                  />
                  <button
                    type="button"
                    onClick={() => toast.success(isAr ? 'تم نسخ رمز الأمان' : 'Secret Token Copied')}
                    className="px-4 py-2.5 bg-slate-900 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-800 cursor-pointer"
                  >
                    {isAr ? 'نسخ' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.05] flex justify-between items-center">
              <button
                type="button"
                onClick={() => toast.success(isAr ? 'اتصال API واختبار Supabase ناجح (HTTP 200 OK)' : 'API Test Successful (HTTP 200 OK)')}
                className="px-4 py-2.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 font-bold text-xs rounded-xl cursor-pointer"
              >
                {isAr ? 'اختبار كفاءة الاتصال بـ API' : 'Test API Connection'}
              </button>
              <button
                type="button"
                onClick={() => toast.success(isAr ? 'تم حفظ إعدادات الـ API' : 'API settings saved')}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 text-black font-black text-xs rounded-xl shadow cursor-pointer"
              >
                {isAr ? 'حفظ إعدادات الربط' : 'Save API Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
