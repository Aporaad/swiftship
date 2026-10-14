import React, { useState } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import { financialAccountService } from '../../../services/financialAccountService';
import toast from 'react-hot-toast';

import { portalUserService } from '../../../services/portalUserService';
import { siteContentService } from '../../../services/siteContentService';
import { couriersApiDataGateway } from '../../couriers/services/couriersApiDataGateway';
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
    companyName: '',
    idNumber: '',
    maxDebt: 0,
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
      await portalUserService.setPortalUserApproval(userObj.id, status);

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
      // المرسل والحالة يحدّدهما الخادم، فلا يُرسل إليهما نص من المتصفح.
      await siteContentService.replyToTicket(ticketId, ticketReplyText.trim());
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
      await siteContentService.createAnnouncement({
        title: annForm.title.trim(),
        content: annForm.content.trim(),
        targetAudience: annForm.targetAudience,
        priority: annForm.priority,
        isActive: true,
      });
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
      await siteContentService.setAnnouncementActive(ann.id, !ann.isActive);
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
      await siteContentService.deleteAnnouncement(id);
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
      const existing = jobApplications.find(j => j.id === appId);
      await siteContentService.setJobApplicationStatus(appId, status);

      if (status === 'approved' && (existing?.jobPosition === 'local_courier' || existing?.jobPosition === 'sourcing_courier')) {
        try {
          const courierId = `cour_job_${appId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`;
          const type = existing.jobPosition === 'sourcing_courier' ? 'sourcing' : 'local';
          const fullName = existing.fullName || 'مندوب جديد';
          await couriersApiDataGateway.createCourier({
            courierId,
            fullName,
            phone: existing.phone,
            email: existing.email,
            address: `${existing.city} ${existing.address}`.trim(),
            isActive: true,
            courierType: type,
            notes: `تم توظيفه واعتماد طلب توظيفه (${existing.refCode || 'طلب توظيف'})`,
          });
          await financialAccountService.createAccountForEntity(
            'courier',
            courierId,
            fullName,
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
      await siteContentService.deleteJobApplication(appId);
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
      companyName: '',
      idNumber: '',
      maxDebt: 0,
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
      address: user.address || '',
      city: dt.city || '',
      country: dt.country || 'اليمن',
      companyName: dt.companyName || '',
      idNumber: dt.idNumber || '',
      maxDebt: Number(dt.maxDebt) || 0,
      gps_location: dt.gpsLocation || '',
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
          phone: pUserFormData.phone,
          address: pUserFormData.address
        },
        {
          gpsLocation: pUserFormData.gps_location,
          city: pUserFormData.city,
          country: pUserFormData.country,
          companyName: pUserFormData.companyName,
          idNumber: pUserFormData.idNumber,
          maxDebt: Number(pUserFormData.maxDebt) || 0,
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
          phone: pUserFormData.phone,
          address: pUserFormData.address
        },
        {
          gpsLocation: pUserFormData.gps_location,
          city: pUserFormData.city,
          country: pUserFormData.country,
          companyName: pUserFormData.companyName,
          idNumber: pUserFormData.idNumber,
          maxDebt: Number(pUserFormData.maxDebt) || 0,
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
