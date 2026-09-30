import React, { useState } from 'react';
import { supabase, doc, setDoc, db } from '../../../lib/supabase-adapter';
import { useSettings } from '../../../context/SettingsContext';
import { financialAccountService } from '../../../services/financialAccountService';
import toast from 'react-hot-toast';

import { portalUserService } from '../../../services/portalUserService';
import useWebsiteManagementData from '../hooks/useWebsiteManagementData';
import WebsiteManagementHeader from '../components/WebsiteManagementHeader';
import WebsiteManagementTabs from '../components/WebsiteManagementTabs';
import PortalUsersTab from '../components/PortalUsersTab';
import SiteAnalyticsTab from '../components/SiteAnalyticsTab';
import PendingApprovalsTab from '../components/PendingApprovalsTab';
import PortalOrdersTab from '../components/PortalOrdersTab';
import SupportTicketsTab from '../components/SupportTicketsTab';
import AnnouncementsTab from '../components/AnnouncementsTab';
import JobApplicationsTab from '../components/JobApplicationsTab';
import WebsiteSecurityTab from '../components/WebsiteSecurityTab';
import ApiIntegrationsTab from '../components/ApiIntegrationsTab';
import PortalUserDialogs from '../components/PortalUserDialogs';


export default function WebsiteManagementPage() {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';

  const [activeTab, setActiveTab] = useState<
    'analytics' | 'portal_users' | 'pending' | 'orders' | 'tickets' | 'announcements' | 'jobs' | 'security' | 'api'
  >('analytics');

  const {
    loading,
    setLoading,
    portalUsers,
    portalOrders,
    tickets,
    announcements,
    jobApplications,
    loadAllData,
  } = useWebsiteManagementData(isAr);

  // Portal Users Management UI State
  const [pUserSearch, setPUserSearch] = useState('');
  const [pUserRoleFilter, setPUserRoleFilter] = useState<string>('all');
  const [pUserStatusFilter, setPUserStatusFilter] = useState<string>('all');
  const [pUserDisabledFilter, setPUserDisabledFilter] = useState<string>('all');

  // Modals state for Portal Users
  const [showCreatePUserModal, setShowCreatePUserModal] = useState(false);
  const [editingPUser, setEditingPUser] = useState<any | null>(null);
  const [viewingPUser, setViewingPUser] = useState<any | null>(null);
  const [isPUserMapOpen, setIsPUserMapOpen] = useState(false);

  // Portal User Form State (For Creation & Editing)
  const [pUserFormData, setPUserFormData] = useState({
    username: '',
    email: '',
    password: '',
    portal_role: 'client',
    approval_status: 'approved',
    disabled: false,
    fullName: '',
    phone: '',
    address: '',
    city: '',
    country: 'اليمن',
    company_name: '',
    id_number: '',
    max_debt: 0,
    gps_location: '',
    lat: 15.3694,
    lng: 44.1910,
    notes: ''
  });

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

      await supabase.from('portal_users').update({ data: cleanPayload }).eq('portal_user_id', userObj.id);

      if (status === 'approved') {
        const entityId = userObj.linkedCustomerId || userObj.id;
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

      await supabase.from('portal_tickets').update({ data: cleanPayload }).eq('portal_ticket_id', ticketId);
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
        announcement_id: id,
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

      await supabase.from('announcements').insert({ announcement_id: id, data: payload });
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

      await supabase.from('announcements').update({ data: cleanPayload }).eq('announcement_id', ann.id);
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
      await supabase.from('announcements').delete().eq('announcement_id', id);
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

      await supabase.from('jobs_req').update({ data: cleanPayload }).eq('jobs_req_id', appId);

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
      await supabase.from('jobs_req').delete().eq('jobs_req_id', appId);
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting');
    } finally {
      setActionId(null);
    }
  };

  // ── Portal Users Management Actions ─────────────────────────────────────
  const handleOpenCreatePUser = () => {
    setPUserFormData({
      username: '',
      email: '',
      password: '',
      portal_role: 'client',
      approval_status: 'approved',
      disabled: false,
      fullName: '',
      phone: '',
      address: '',
      city: '',
      country: 'اليمن',
      company_name: '',
      id_number: '',
      max_debt: 0,
      gps_location: '',
      lat: 15.3694,
      lng: 44.1910,
      notes: ''
    });
    setShowCreatePUserModal(true);
  };

  const handleOpenEditPUser = (user: any) => {
    setEditingPUser(user);
    const dt = user.customerDetails || {};
    setPUserFormData({
      username: user.username || '',
      email: user.email || '',
      password: '',
      portal_role: user.portal_role || 'client',
      approval_status: user.approval_status || 'approved',
      disabled: Boolean(user.disabled),
      fullName: user.fullName || user.username || '',
      phone: user.phone || '',
      address: dt.address || user.address || '',
      city: dt.city || '',
      country: dt.country || 'اليمن',
      company_name: dt.company_name || '',
      id_number: dt.id_number || '',
      max_debt: Number(dt.max_debt) || 0,
      gps_location: dt.gps_location || user.gps_location || '',
      lat: 15.3694,
      lng: 44.1910,
      notes: dt.notes || user.notes || ''
    });
  };

  const handleTogglePUserDisabled = async (user: any) => {
    try {
      await portalUserService.togglePortalUserDisabled(user.id, Boolean(user.disabled));
      await loadAllData();
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر تغيير حالة الحساب' : 'Failed to toggle status'));
    }
  };

  const handleDeletePUser = async (user: any) => {
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف مستخدم الموقع ${user.username}؟` : `Delete portal user ${user.username}?`)) return;
    try {
      await portalUserService.deletePortalUser(user.id);
      toast.success(isAr ? 'تم حذف مستخدم الموقع بنجاح' : 'Portal user deleted');
      await loadAllData();
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر الحذف' : 'Failed to delete'));
    }
  };

  const handleCreatePUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pUserFormData.username.trim() || !pUserFormData.password.trim()) {
      return toast.error(isAr ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Username and password required');
    }
    setActionId('create_puser');
    try {
      await portalUserService.createPortalUser(
        {
          username: pUserFormData.username.trim(),
          email: pUserFormData.email.trim(),
          password: pUserFormData.password,
          portal_role: pUserFormData.portal_role,
          approval_status: pUserFormData.approval_status as any,
          disabled: pUserFormData.disabled,
          fullName: pUserFormData.fullName || pUserFormData.username,
          phone: pUserFormData.phone
        },
        {
          address: pUserFormData.address,
          gps_location: pUserFormData.gps_location,
          city: pUserFormData.city,
          country: pUserFormData.country,
          company_name: pUserFormData.company_name,
          id_number: pUserFormData.id_number,
          max_debt: Number(pUserFormData.max_debt) || 0,
          notes: pUserFormData.notes
        }
      );
      toast.success(isAr ? 'تم إضافة مستخدم الموقع بنجاح' : 'Portal user created');
      setShowCreatePUserModal(false);
      await loadAllData();
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر الإنشاء' : 'Creation failed'));
    } finally {
      setActionId(null);
    }
  };

  const handleEditPUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPUser) return;
    setActionId(editingPUser.id);
    try {
      await portalUserService.updatePortalUser(
        editingPUser.id,
        {
          username: pUserFormData.username.trim(),
          email: pUserFormData.email.trim(),
          password: pUserFormData.password || undefined,
          portal_role: pUserFormData.portal_role,
          approval_status: pUserFormData.approval_status as any,
          disabled: pUserFormData.disabled,
          fullName: pUserFormData.fullName,
          phone: pUserFormData.phone
        },
        {
          address: pUserFormData.address,
          gps_location: pUserFormData.gps_location,
          city: pUserFormData.city,
          country: pUserFormData.country,
          company_name: pUserFormData.company_name,
          id_number: pUserFormData.id_number,
          max_debt: Number(pUserFormData.max_debt) || 0,
          notes: pUserFormData.notes
        }
      );
      toast.success(isAr ? 'تم تحديث بيانات مستخدم الموقع بنجاح' : 'Portal user updated');
      setEditingPUser(null);
      await loadAllData();
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر التحديث' : 'Update failed'));
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
      <WebsiteManagementHeader
        isAr={isAr}
        loadAllData={loadAllData}
        loading={loading}
        portalUsers={portalUsers}
        pendingUsers={pendingUsers}
        portalOrders={portalOrders}
        jobApplications={jobApplications}
      />
      <WebsiteManagementTabs
        isAr={isAr}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        portalUsers={portalUsers}
        pendingUsers={pendingUsers}
        portalOrders={portalOrders}
        tickets={tickets}
        announcements={announcements}
        pendingJobs={pendingJobs}
      />
      <PortalUsersTab
        activeTab={activeTab}
        isAr={isAr}
        portalUsers={portalUsers}
        pUserSearch={pUserSearch}
        setPUserSearch={setPUserSearch}
        pUserRoleFilter={pUserRoleFilter}
        setPUserRoleFilter={setPUserRoleFilter}
        pUserStatusFilter={pUserStatusFilter}
        setPUserStatusFilter={setPUserStatusFilter}
        pUserDisabledFilter={pUserDisabledFilter}
        setPUserDisabledFilter={setPUserDisabledFilter}
        handleOpenCreatePUser={handleOpenCreatePUser}
        handleTogglePUserDisabled={handleTogglePUserDisabled}
        setViewingPUser={setViewingPUser}
        handleOpenEditPUser={handleOpenEditPUser}
        handleDeletePUser={handleDeletePUser}
      />
      <SiteAnalyticsTab
        activeTab={activeTab}
        isAr={isAr}
        customersCount={customersCount}
        couriersCount={couriersCount}
        suppliersCount={suppliersCount}
        approvedUsers={approvedUsers}
        pendingUsers={pendingUsers}
        portalUsers={portalUsers}
        pendingJobs={pendingJobs}
        portalOrders={portalOrders}
        tickets={tickets}
        jobApplications={jobApplications}
      />
      <PendingApprovalsTab
        activeTab={activeTab}
        isAr={isAr}
        pendingUsers={pendingUsers}
        actionId={actionId}
        handleUserApproval={handleUserApproval}
      />
      <PortalOrdersTab activeTab={activeTab} isAr={isAr} portalOrders={portalOrders} />
      <SupportTicketsTab
        activeTab={activeTab}
        isAr={isAr}
        tickets={tickets}
        replyingTicketId={replyingTicketId}
        setReplyingTicketId={setReplyingTicketId}
        ticketReplyText={ticketReplyText}
        setTicketReplyText={setTicketReplyText}
        handleReplyTicket={handleReplyTicket}
        actionId={actionId}
      />
      <AnnouncementsTab
        activeTab={activeTab}
        isAr={isAr}
        showAnnForm={showAnnForm}
        setShowAnnForm={setShowAnnForm}
        handleCreateAnnouncement={handleCreateAnnouncement}
        annForm={annForm}
        setAnnForm={setAnnForm}
        announcements={announcements}
        handleToggleAnnActive={handleToggleAnnActive}
        handleDeleteAnn={handleDeleteAnn}
      />
      <JobApplicationsTab
        activeTab={activeTab}
        isAr={isAr}
        jobApplications={jobApplications}
        handleDeleteJob={handleDeleteJob}
        handleJobStatus={handleJobStatus}
      />
      <WebsiteSecurityTab
        activeTab={activeTab}
        isAr={isAr}
        secSettings={secSettings}
        setSecSettings={setSecSettings}
        toast={toast}
      />
      <ApiIntegrationsTab
        activeTab={activeTab}
        isAr={isAr}
        secSettings={secSettings}
        setSecSettings={setSecSettings}
        toast={toast}
      />
      <PortalUserDialogs
        showCreatePUserModal={showCreatePUserModal}
        editingPUser={editingPUser}
        viewingPUser={viewingPUser}
        isPUserMapOpen={isPUserMapOpen}
        isAr={isAr}
        setShowCreatePUserModal={setShowCreatePUserModal}
        setEditingPUser={setEditingPUser}
        setViewingPUser={setViewingPUser}
        setIsPUserMapOpen={setIsPUserMapOpen}
        handleEditPUserSubmit={handleEditPUserSubmit}
        handleCreatePUserSubmit={handleCreatePUserSubmit}
        pUserFormData={pUserFormData}
        setPUserFormData={setPUserFormData}
        actionId={actionId}
      />
    </div>
  );

}
