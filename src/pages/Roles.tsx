import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, CreditCard as Edit2, X, Plus, Trash2, Shield, CircleCheck as CheckCircle2 } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { activityLogService } from '../services/activityLogService';
import { PERMISSION_LABELS, PERMISSION_CATEGORIES, PermissionKey } from '../lib/permissions';

const AVAILABLE_PERMISSIONS = (t: any, lang: string) => [
  { id: 'view_dashboard', label: lang === 'ar' ? 'عرض لوحة التحكم والإحصائيات' : 'View Dashboard & Statistics', group: lang === 'ar' ? 'عام' : 'General' },
  { id: 'view_statistics', label: lang === 'ar' ? 'عرض الإحصائيات المالية التفصيلية' : 'View Detailed Financial Statistics', group: lang === 'ar' ? 'عام' : 'General' },
  { id: 'view_orders', label: lang === 'ar' ? 'عرض الطلبات' : 'View Orders', group: lang === 'ar' ? 'الطلبات' : 'Orders' },
  { id: 'add_orders', label: lang === 'ar' ? 'إضافة الطلبات' : 'Add Orders', group: lang === 'ar' ? 'الطلبات' : 'Orders' },
  { id: 'edit_orders', label: lang === 'ar' ? 'تعديل الطلبات' : 'Edit Orders', group: lang === 'ar' ? 'الطلبات' : 'Orders' },
  { id: 'update_order_status', label: lang === 'ar' ? 'تحديث حالة الطلب فقط' : 'Update Order Status Only', group: lang === 'ar' ? 'الطلبات' : 'Orders' },
  { id: 'delete_orders', label: lang === 'ar' ? 'حذف الطلبات' : 'Delete Orders', group: lang === 'ar' ? 'الطلبات' : 'Orders' },
  { id: 'edit_delivered_orders', label: lang === 'ar' ? 'تعديل الطلبات بعد التسليم' : 'Edit Orders After Delivery', group: lang === 'ar' ? 'الطلبات' : 'Orders' },
  { id: 'print_orders', label: lang === 'ar' ? 'طباعة وتصدير الفواتير' : 'Print & Export Invoices', group: lang === 'ar' ? 'الطلبات' : 'Orders' },
  { id: 'export_orders', label: lang === 'ar' ? 'تصدير بيانات الطلبات' : 'Export Orders Data', group: lang === 'ar' ? 'الطلبات' : 'Orders' },
  { id: 'view_customers', label: lang === 'ar' ? 'عرض العملاء' : 'View Customers', group: lang === 'ar' ? 'العملاء' : 'Customers' },
  { id: 'add_customers', label: lang === 'ar' ? 'إضافة العملاء' : 'Add Customers', group: lang === 'ar' ? 'العملاء' : 'Customers' },
  { id: 'edit_customers', label: lang === 'ar' ? 'تعديل العملاء' : 'Edit Customers', group: lang === 'ar' ? 'العملاء' : 'Customers' },
  { id: 'delete_customers', label: lang === 'ar' ? 'حذف العملاء' : 'Delete Customers', group: lang === 'ar' ? 'العملاء' : 'Customers' },
  { id: 'view_couriers', label: lang === 'ar' ? 'عرض المناديب' : 'View Couriers', group: lang === 'ar' ? 'المناديب' : 'Couriers' },
  { id: 'add_couriers', label: lang === 'ar' ? 'إضافة المناديب' : 'Add Couriers', group: lang === 'ar' ? 'المناديب' : 'Couriers' },
  { id: 'edit_couriers', label: lang === 'ar' ? 'تعديل المناديب' : 'Edit Couriers', group: lang === 'ar' ? 'المناديب' : 'Couriers' },
  { id: 'delete_couriers', label: lang === 'ar' ? 'حذف المناديب' : 'Delete Couriers', group: lang === 'ar' ? 'المناديب' : 'Couriers' },
  { id: 'view_sources', label: lang === 'ar' ? 'عرض مصادر الطلبات' : 'View Order Sources', group: lang === 'ar' ? 'المصادر' : 'Sources' },
  { id: 'add_sources', label: lang === 'ar' ? 'إضافة مصادر الطلبات' : 'Add Order Sources', group: lang === 'ar' ? 'المصادر' : 'Sources' },
  { id: 'edit_sources', label: lang === 'ar' ? 'تعديل مصادر الطلبات' : 'Edit Order Sources', group: lang === 'ar' ? 'المصادر' : 'Sources' },
  { id: 'delete_sources', label: lang === 'ar' ? 'حذف مصادر الطلبات' : 'Delete Order Sources', group: lang === 'ar' ? 'المصادر' : 'Sources' },
  { id: 'view_users', label: lang === 'ar' ? 'عرض الموظفين والأدوار' : 'View Staff & Roles', group: lang === 'ar' ? 'الموظفين' : 'Staff' },
  { id: 'add_users', label: lang === 'ar' ? 'إضافة الموظفين' : 'Add Staff members', group: lang === 'ar' ? 'الموظفين' : 'Staff' },
  { id: 'edit_users', label: lang === 'ar' ? 'تعديل الموظفين والأدوار' : 'Edit Staff & Roles', group: lang === 'ar' ? 'الموظفين' : 'Staff' },
  { id: 'delete_users', label: lang === 'ar' ? 'حذف الموظفين' : 'Delete Staff members', group: lang === 'ar' ? 'الموظفين' : 'Staff' },
  { id: 'reset_passwords', label: lang === 'ar' ? 'إعادة تعيين كلمات المرور' : 'Reset User Passwords', group: lang === 'ar' ? 'الموظفين' : 'Staff' },
  { id: 'disable_accounts', label: lang === 'ar' ? 'تعطيل وتفعيل الحسابات' : 'Disable & Enable Accounts', group: lang === 'ar' ? 'الموظفين' : 'Staff' },
  { id: 'terminate_sessions', label: lang === 'ar' ? 'إنهاء جلسات المستخدمين' : 'Terminate User Sessions', group: lang === 'ar' ? 'الموظفين' : 'Staff' },
  { id: 'view_activity_log', label: lang === 'ar' ? 'رؤية سجل النشاط الكامل' : 'View Full Activity Log', group: lang === 'ar' ? 'الموظفين' : 'Staff' },
  { id: 'view_finance', label: lang === 'ar' ? 'عرض البيانات المالية العامة' : 'View General Financial Data', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'add_finance', label: lang === 'ar' ? 'إضافة المدفوعات والعمليات المالية' : 'Add Payments & Finance', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'edit_finance', label: lang === 'ar' ? 'تعديل المدفوعات والعمليات المالية' : 'Edit Payments & Finance', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'view_expenses', label: lang === 'ar' ? 'رؤية المصروفات والتكاليف' : 'View Expenses & Costs', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'view_custody', label: lang === 'ar' ? 'عرض العهد المالية' : 'View Financial Custody', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'add_expenses', label: lang === 'ar' ? 'إضافة المصروفات' : 'Add Expenses', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'edit_expenses', label: lang === 'ar' ? 'تعديل المصروفات وتسوية العهد' : 'Edit Expenses & Reconcile', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'delete_expenses', label: lang === 'ar' ? 'حذف المصروفات' : 'Delete Expenses', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'edit_exchange_rates', label: lang === 'ar' ? 'تعديل أسعار الصرف' : 'Edit Exchange Rates', group: lang === 'ar' ? 'المحاسبة' : 'Accounting' },
  { id: 'view_reports', label: lang === 'ar' ? 'عرض التقارير المالية' : 'View Financial Reports', group: lang === 'ar' ? 'التقارير' : 'Reports' },
  { id: 'settings', label: lang === 'ar' ? 'عرض وإعدادات النظام' : 'Access System Settings', group: lang === 'ar' ? 'المسؤول' : 'Admin' },
  { id: 'edit_interface_settings', label: lang === 'ar' ? 'تعديل إعدادات المظهر والواجهة' : 'Edit Interface & Theme Settings', group: lang === 'ar' ? 'المسؤول' : 'Admin' },
  { id: 'edit_general_settings', label: lang === 'ar' ? 'تعديل إعدادات النظام والهوية' : 'Edit System Info & Identity', group: lang === 'ar' ? 'المسؤول' : 'Admin' },
  { id: 'edit_order_defaults', label: lang === 'ar' ? 'تعديل النسب والرسوم الافتراضية' : 'Edit Order & Price Defaults', group: lang === 'ar' ? 'المسؤول' : 'Admin' },
  { id: 'edit_company_info', label: lang === 'ar' ? 'تعديل معلومات الشركة' : 'Edit Company Information', group: lang === 'ar' ? 'المسؤول' : 'Admin' },
  { id: 'manage_whatsapp', label: lang === 'ar' ? 'إعدادات واتساب والتنبيهات' : 'WhatsApp & Alert Settings', group: lang === 'ar' ? 'المسؤول' : 'Admin' },
  { id: 'manage_backup', label: lang === 'ar' ? 'إدارة النسخ الاحتياطية' : 'Manage Backups', group: lang === 'ar' ? 'المسؤول' : 'Admin' },
  { id: 'view_notifications', label: lang === 'ar' ? 'عرض صفحة الإشعارات' : 'View Notifications', group: lang === 'ar' ? 'الإشعارات' : 'Notifications' },
  { id: 'send_notifications', label: lang === 'ar' ? 'إرسال إشعارات مخصصة وتجريبية' : 'Send Custom Notifications', group: lang === 'ar' ? 'الإشعارات' : 'Notifications' },
  { id: 'manage_notifications', label: lang === 'ar' ? 'إدارة وحذف الإشعارات' : 'Manage & Delete Notifications', group: lang === 'ar' ? 'الإشعارات' : 'Notifications' },
  { id: 'notify_orders', label: lang === 'ar' ? 'استقبل إشعارات الطلبات' : 'Receive Order Notifications', group: lang === 'ar' ? 'الإشعارات' : 'Notifications' },
  { id: 'notify_finance', label: lang === 'ar' ? 'استقبل إشعارات المالية' : 'Receive Finance Notifications', group: lang === 'ar' ? 'الإشعارات' : 'Notifications' },
  { id: 'notify_system', label: lang === 'ar' ? 'استقبل إشعارات النظام والأمان' : 'Receive System & Security Notifications', group: lang === 'ar' ? 'الإشعارات' : 'Notifications' },
];

export default function Roles() {
  const { role: currentUserRole, hasPermission, loading: roleLoading } = useRole();
  const { settings, t } = useSettings();

  // Check permissions
  const canManageRoles = currentUserRole === 'Admin' || hasPermission('manage_roles') || hasPermission('edit_role_permissions');

  // Build permission list from centralized PERMISSION_LABELS + PERMISSION_CATEGORIES
  const isAr = settings.language === 'ar';
  const currentPermissions = Object.entries(PERMISSION_CATEGORIES).flatMap(([category, permKeys]) =>
    permKeys.map(pId => ({
      id: pId,
      label: PERMISSION_LABELS[pId as PermissionKey]?.[isAr ? 'ar' : 'en'] || pId,
      group: category.includes('/') ? category.split('/')[isAr ? 0 : 1].trim() : category
    }))
  );

  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    permissions: [] as string[]
  });

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'roles'), async (snap) => {
      const fetchedRoles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRoles(fetchedRoles);
      
      // Auto-initialize default roles if they don't exist
      const defaultRoles = [
        { id: 'Admin', title: settings.language === 'ar' ? 'مدير النظام' : 'System Admin', permissions: ['*'] },
        { id: 'Employee', title: settings.language === 'ar' ? 'موظف' : 'Employee', permissions: ['view_dashboard', 'view_orders', 'add_orders', 'edit_orders', 'update_order_status', 'print_orders', 'view_customers', 'add_customers', 'edit_customers', 'view_couriers', 'add_couriers', 'edit_couriers', 'view_sources', 'add_sources', 'edit_sources', 'view_notifications', 'notify_orders', 'notify_system'] },
        { id: 'Courier', title: settings.language === 'ar' ? 'مندوب' : 'Courier', permissions: ['view_orders', 'update_order_status'] },
        { id: 'Accountant', title: settings.language === 'ar' ? 'محاسب' : 'Accountant', permissions: ['view_dashboard', 'view_orders', 'view_finance', 'add_finance', 'edit_finance', 'view_expenses', 'add_expenses', 'edit_expenses', 'view_custody', 'view_reports', 'view_sources', 'add_sources', 'edit_sources', 'view_notifications', 'notify_finance', 'notify_system'] }
      ];

      for (const dr of defaultRoles) {
        if (!fetchedRoles.find(r => r.id === dr.id)) {
          console.log(`Initializing missing role: ${dr.id}`);
          await setDoc(doc(db, 'roles', dr.id), {
            title: dr.title,
            permissions: dr.permissions,
            createdAt: Date.now(),
            isDefault: true
          });
        }
      }

      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'roles');
    });
    return unsub;
  }, [settings.language, roleLoading]);

  const handleOpenAdd = () => {
    setSelectedRole(null);
    setFormData({ id: '', title: '', permissions: [] });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: any) => {
    setSelectedRole(role);
    setFormData({
      id: role.id,
      title: role.title || role.id,
      permissions: role.permissions || []
    });
    setIsModalOpen(true);
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id) return alert(settings.language === 'ar' ? 'يرجى إدخال معرف الدور' : 'Please enter role ID');
    if (!canManageRoles) return alert(settings.language === 'ar' ? 'ليس لديك صلاحية إدارة الأدوار' : 'You do not have permission to manage roles');

    try {
      const isNew = !roles.find(r => r.id === formData.id);
      await setDoc(doc(db, 'roles', formData.id), {
        title: formData.title,
        permissions: formData.permissions,
        updatedAt: Date.now()
      });
      activityLogService.log(isNew ? 'add_role' : 'edit_role', formData.title || formData.id, {
        roleId: formData.id,
        permissionCount: formData.permissions.length
      });
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'roles');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'Admin') {
      return alert(settings.language === 'ar' ? 'لا يمكن حذف دور مدير النظام مطلقا' : 'Cannot delete Admin role');
    }
    if (!canManageRoles) return alert(settings.language === 'ar' ? 'ليس لديك صلاحية حذف الأدوار' : 'You do not have permission to delete roles');
    if (!window.confirm(settings.language === 'ar' ? `هل أنت متأكد من حذف دور ${id}؟` : `Are you sure you want to delete role ${id}?`)) return;
    try {
      await deleteDoc(doc(db, 'roles', id));
      activityLogService.log('delete_role', id, { roleId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'roles');
    }
  };

  if (loading || roleLoading) return <div className="p-20 text-center text-slate-500 font-bold">{settings.language === 'ar' ? 'جاري تحميل الأدوار...' : 'Loading roles...'}</div>;

  if (currentUserRole !== 'Admin' && !canManageRoles) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-b from-[#121215] to-[#08080a] rounded-3xl border border-[#d4af37]/20 shadow-xl max-w-xl mx-auto text-center" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-[#d4af37]/10 p-5 rounded-2xl border border-[#d4af37]/25 mb-6 text-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.1)]">
          <X className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-extrabold text-[#d4af37] mb-2 tracking-wide text-center uppercase">{t('accessDenied')}</h2>
        <p className="text-slate-400 text-xs text-center leading-relaxed">
          {settings.language === 'ar' ? 'إدارة الأدوار مخصصة لمدير النظام فقط.' : 'Role management is restricted to system administrators.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors">
      
      {/* Title block */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/35">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-start">
            <h1 className="text-xl font-black text-white leading-none mb-1">{settings.language === 'ar' ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {settings.language === 'ar' ? 'تخصيص مستويات وصول الموظفين وتوزيع أدوار النظام' : 'Configure user access levels and authorization policies'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20"
        >
          <Plus className="w-4 h-4" /> {settings.language === 'ar' ? 'إنشاء دور جديد' : 'Create New Role'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map(r => (
          <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col transition-all hover:border-[#d4af37]/30 shadow-lg shadow-black/30">
            <div className="p-5 border-b border-slate-800 bg-slate-950/45 flex justify-between items-center text-start">
              <div>
                <h3 className="font-extrabold text-[#d4af37] text-md leading-none mb-1">{r.title || r.id}</h3>
                <span className="text-[10px] text-slate-500 font-mono font-black uppercase tracking-widest" dir="ltr">{r.id}</span>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => handleOpenEdit(r)}
                  className="p-2 text-slate-400 border border-slate-800 bg-slate-950 hover:text-[#d4af37] hover:border-[#d4af37] rounded-xl transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {!['Admin'].includes(r.id) && (
                  <button 
                    onClick={() => handleDelete(r.id)}
                    className="p-2 text-rose-400 border border-slate-800 bg-slate-950 hover:bg-rose-950/20 hover:border-rose-500 rounded-xl transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-5 flex-1 text-start">
              <div className="text-[9px] font-black text-slate-500 mb-3 uppercase tracking-wider leading-none">
                {settings.language === 'ar' ? 'الصلاحيات الممنوحة:' : 'Assigned Permissions:'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.permissions?.map((pId: string) => {
                  const perm = currentPermissions.find(ap => ap.id === pId);
                  return (
                    <span 
                      key={pId} 
                      className="bg-slate-950 text-slate-300 px-2.5 py-1 rounded-lg text-[9px] font-bold border border-slate-800/80 transition-colors"
                    >
                      {perm?.label || pId}
                    </span>
                  );
                })}
                {(!r.permissions || r.permissions.length === 0) && (
                  <span className="text-slate-500 text-[10px] italic">{settings.language === 'ar' ? 'لا توجد صلاحيات محددة' : 'No permissions assigned'}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] p-1 rounded-2xl border border-[#d4af37]/20 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-850 flex justify-between items-center bg-black/40">
              <h3 className="font-extrabold text-[#d4af37] text-md uppercase">{selectedRole ? (settings.language === 'ar' ? 'تعديل صلاحيات الدور' : 'Edit Role Access Rules') : (settings.language === 'ar' ? 'إنشاء دور مخصص جديد' : 'Create Custom Role')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 overflow-y-auto flex-1 space-y-5 text-xs font-bold text-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-start">
                <div>
                  <label className="block text-slate-500 mb-1">اسم الدور (بالعربي)</label>
                  <input required placeholder="مثل: مشرف مستودع" type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full border border-slate-850 rounded-xl p-3 bg-slate-950 text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/50 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">المعرف (انجليزي)</label>
                  <input required disabled={!!selectedRole} placeholder="مثال: Warehouse_Supervisor" type="text" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} className="w-full border border-slate-850 rounded-xl p-3 bg-slate-950 text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/50 outline-none font-mono disabled:opacity-45 disabled:cursor-not-allowed text-start" dir="ltr" />
                </div>
              </div>

              <div className="text-start">
                <label className="block text-slate-500 mb-3">تخصيص مستويات الوصول</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-1">
                  {currentPermissions.map(perm => (
                    <label key={perm.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-850 bg-slate-950/40 hover:bg-slate-900 cursor-pointer transition-colors text-start">
                      <div 
                        onClick={() => togglePermission(perm.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${formData.permissions.includes(perm.id) ? 'bg-[#d4af37] border-[#d4af37] text-black font-black' : 'border-slate-800'}`}
                      >
                        {formData.permissions.includes(perm.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white">{perm.label}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">{perm.group}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </form>

            <div className="p-5 border-t border-slate-850 bg-black/40 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-850/40 rounded-xl transition-colors">{settings.language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition-all active:scale-[0.98]">{settings.language === 'ar' ? 'حفظ وتحميل الدور' : 'Save configuration'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
