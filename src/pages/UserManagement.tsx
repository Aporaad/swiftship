import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc,
  query, orderBy, limit, getDocs, where
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Search, Edit2, X, Plus, UserX, UserCheck, Trash2, Users as UsersIcon,
  Shield, Eye, EyeOff, Crown, ShieldAlert, Activity, Clock,
  CheckCircle2, LogOut, Key, MonitorCheck, FileClock,
  Zap, AlertTriangle, Timer, Ban, WifiOff, Lock, Unlock,
  UserMinus, RefreshCw, ChevronDown, ChevronRight, Info,
  Coins, Truck
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { notificationService } from '../services/notificationService';
import { activityLogService } from '../services/activityLogService';
import ConfirmModal from '../components/ConfirmModal';
import { financialAccountService } from '../services/financialAccountService';

// ══════════════════════════════════════════════════════════════
// PERMISSIONS — FULL SYSTEM COVERAGE
// ══════════════════════════════════════════════════════════════
const PERMISSION_GROUPS = (isAr: boolean) => [
  {
    group: isAr ? '🏠 عام' : '🏠 General',
    perms: [
      { id: 'view_dashboard', label: isAr ? 'عرض لوحة التحكم والإحصائيات' : 'View Dashboard & Statistics' },
      { id: 'view_statistics', label: isAr ? 'عرض الإحصائيات المالية التفصيلية' : 'View Detailed Financial Statistics' },
    ]
  },
  {
    group: isAr ? '📦 الطلبات' : '📦 Orders',
    perms: [
      { id: 'view_orders', label: isAr ? 'عرض الطلبات' : 'View Orders' },
      { id: 'add_orders', label: isAr ? 'إضافة الطلبات' : 'Add Orders' },
      { id: 'edit_orders', label: isAr ? 'تعديل الطلبات' : 'Edit Orders' },
      { id: 'update_order_status', label: isAr ? 'تحديث حالة الطلب فقط' : 'Update Order Status Only' },
      { id: 'delete_orders', label: isAr ? 'حذف الطلبات' : 'Delete Orders' },
      { id: 'edit_delivered_orders', label: isAr ? 'تعديل الطلبات بعد التسليم' : 'Edit Orders After Delivery' },
      { id: 'print_orders', label: isAr ? 'طباعة وتصدير الفواتير' : 'Print & Export Invoices' },
      { id: 'export_orders', label: isAr ? 'تصدير بيانات الطلبات' : 'Export Orders Data' },
    ]
  },
  {
    group: isAr ? '👥 العملاء' : '👥 Customers',
    perms: [
      { id: 'view_customers', label: isAr ? 'عرض قائمة العملاء' : 'View Customers List' },
      { id: 'add_customers', label: isAr ? 'إضافة العملاء' : 'Add Customers' },
      { id: 'edit_customers', label: isAr ? 'تعديل العملاء' : 'Edit Customers' },
      { id: 'delete_customers', label: isAr ? 'حذف العملاء' : 'Delete Customers' },
    ]
  },
  {
    group: isAr ? '🚚 المناديب' : '🚚 Couriers',
    perms: [
      { id: 'view_couriers', label: isAr ? 'عرض المناديب' : 'View Couriers' },
      { id: 'add_couriers', label: isAr ? 'إضافة المناديب' : 'Add Couriers' },
      { id: 'edit_couriers', label: isAr ? 'تعديل المناديب' : 'Edit Couriers' },
      { id: 'delete_couriers', label: isAr ? 'حذف المناديب' : 'Delete Couriers' },
    ]
  },
  {
    group: isAr ? '💰 المالية' : '💰 Finance',
    perms: [
      { id: 'view_finance', label: isAr ? 'عرض البيانات المالية العامة' : 'View General Financial Data' },
      { id: 'add_finance', label: isAr ? 'إضافة المدفوعات والعمليات المالية' : 'Add Payments & Finance' },
      { id: 'edit_finance', label: isAr ? 'تعديل المدفوعات والعمليات المالية' : 'Edit Payments & Finance' },
      { id: 'view_expenses', label: isAr ? 'رؤية المصروفات والتكاليف' : 'View Expenses & Costs' },
      { id: 'view_custody', label: isAr ? 'عرض العهد المالية' : 'View Financial Custody' },
      { id: 'add_expenses', label: isAr ? 'إضافة المصروفات' : 'Add Expenses' },
      { id: 'edit_expenses', label: isAr ? 'تعديل المصروفات وتسوية العهد' : 'Edit Expenses & Reconcile' },
      { id: 'delete_expenses', label: isAr ? 'حذف المصروفات' : 'Delete Expenses' },
      { id: 'edit_exchange_rates', label: isAr ? 'تعديل أسعار الصرف' : 'Edit Exchange Rates' },
      { id: 'view_financial_accounts', label: isAr ? 'عرض أرصدة وكشوفات الحسابات المالية' : 'View Financial Account Balances & Statements' },
      { id: 'manage_financial_accounts', label: isAr ? 'إدارة وتعديل أرصدة الحسابات المالية' : 'Manage Financial Account Balances & Adjustments' },
    ]
  },
  {
    group: isAr ? '📊 التقارير' : '📊 Reports',
    perms: [
      { id: 'view_reports', label: isAr ? 'عرض التقارير المالية' : 'View Financial Reports' },
    ]
  },
  {
    group: isAr ? '🗺️ المصادر' : '🗺️ Sources',
    perms: [
      { id: 'view_sources', label: isAr ? 'عرض مصادر الطلبات' : 'View Order Sources' },
      { id: 'add_sources', label: isAr ? 'إضافة مصادر الطلبات' : 'Add Order Sources' },
      { id: 'edit_sources', label: isAr ? 'تعديل مصادر الطلبات' : 'Edit Order Sources' },
      { id: 'delete_sources', label: isAr ? 'حذف مصادر الطلبات' : 'Delete Order Sources' },
    ]
  },
  {
    group: isAr ? '🔔 الإشعارات' : '🔔 Notifications',
    perms: [
      { id: 'view_notifications', label: isAr ? 'عرض صفحة الإشعارات' : 'View Notifications' },
      { id: 'send_notifications', label: isAr ? 'إرسال إشعارات مخصصة وتجريبية' : 'Send Custom Notifications' },
      { id: 'manage_notifications', label: isAr ? 'إدارة وحذف الإشعارات' : 'Manage & Delete Notifications' },
      { id: 'notify_orders', label: isAr ? 'استقبال إشعارات الطلبات' : 'Receive Order Notifications' },
      { id: 'notify_finance', label: isAr ? 'استقبال إشعارات المالية' : 'Receive Finance Notifications' },
      { id: 'notify_system', label: isAr ? 'استقبال إشعارات النظام والأمان' : 'Receive System & Security Notifications' },
    ]
  },
  {
    group: isAr ? '👤 إدارة الموظفين' : '👤 Staff Management',
    perms: [
      { id: 'view_users', label: isAr ? 'عرض قائمة الموظفين والأدوار' : 'View Staff & Roles List' },
      { id: 'add_users', label: isAr ? 'إضافة الموظفين' : 'Add Staff members' },
      { id: 'edit_users', label: isAr ? 'تعديل الموظفين والأدوار' : 'Edit Staff & Roles' },
      { id: 'delete_users', label: isAr ? 'حذف الموظفين' : 'Delete Staff Members' },
      { id: 'reset_passwords', label: isAr ? 'إعادة تعيين كلمات المرور' : 'Reset User Passwords' },
      { id: 'disable_accounts', label: isAr ? 'تعطيل وتفعيل الحسابات' : 'Disable & Enable Accounts' },
      { id: 'terminate_sessions', label: isAr ? 'إنهاء جلسات المستخدمين' : 'Terminate User Sessions' },
      { id: 'view_activity_log', label: isAr ? 'رؤية سجل النشاط الكامل' : 'View Full Activity Log' },
    ]
  },
  {
    group: isAr ? '🛡️ الأدوار والصلاحيات' : '🛡️ Roles & Permissions',
    perms: [
      { id: 'view_roles', label: isAr ? 'عرض الأدوار والصلاحيات' : 'View Roles & Permissions' },
      { id: 'add_roles', label: isAr ? 'إنشاء أدوار جديدة' : 'Create New Roles' },
      { id: 'edit_roles', label: isAr ? 'تعديل الأدوار والصلاحيات' : 'Edit Roles & Permissions' },
      { id: 'delete_roles', label: isAr ? 'حذف الأدوار' : 'Delete Roles' },
    ]
  },
  {
    group: isAr ? '⚙️ الإعدادات' : '⚙️ Settings',
    perms: [
      { id: 'settings', label: isAr ? 'الوصول لإعدادات النظام' : 'Access System Settings' },
      { id: 'edit_company_info', label: isAr ? 'تعديل معلومات الشركة' : 'Edit Company Information' },
      { id: 'manage_whatsapp', label: isAr ? 'إعدادات واتساب والتنبيهات' : 'WhatsApp & Alert Settings' },
      { id: 'manage_backup', label: isAr ? 'إدارة النسخ الاحتياطية' : 'Manage Backups' },
    ]
  },
];

// Flat permissions list for checking
const ALL_PERMISSIONS = (isAr: boolean) =>
  PERMISSION_GROUPS(isAr).flatMap(g => g.perms);

const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'admin@swiftship.system'];

// ══════════════════════════════════════════════════════════════
// ACTION LABEL MAPPING
// ══════════════════════════════════════════════════════════════
const getActionMeta = (action: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string; color: string; icon: string }> = {
    login:                { ar: 'تسجيل دخول',                en: 'Login',               color: 'emerald', icon: '🔓' },
    logout:               { ar: 'تسجيل خروج',               en: 'Logout',              color: 'slate',   icon: '🔒' },
    add_user:             { ar: 'إضافة موظف',                en: 'Add User',            color: 'cyan',    icon: '➕' },
    edit_user:            { ar: 'تعديل موظف',                en: 'Edit User',           color: 'blue',    icon: '✏️' },
    disable_user:         { ar: 'تعطيل حساب',                en: 'Disable Account',     color: 'rose',    icon: '🚫' },
    enable_user:          { ar: 'تفعيل حساب',                en: 'Enable Account',      color: 'emerald', icon: '✅' },
    delete_user:          { ar: 'حذف موظف',                  en: 'Delete User',         color: 'rose',    icon: '🗑️' },
    reset_password:       { ar: 'إعادة تعيين كلمة المرور',   en: 'Reset Password',      color: 'amber',   icon: '🔑' },
    terminate_session:    { ar: 'إنهاء جلسة',                en: 'Terminate Session',   color: 'rose',    icon: '⛔' },
    force_logout:         { ar: 'إنهاء قسري للجلسة',         en: 'Force Logout',        color: 'rose',    icon: '⚡' },
    temp_ban:             { ar: 'حظر مؤقت',                   en: 'Temporary Ban',       color: 'orange',  icon: '⏳' },
    edit_role:            { ar: 'تعديل دور',                  en: 'Edit Role',           color: 'purple',  icon: '🛡️' },
    add_role:             { ar: 'إضافة دور',                  en: 'Add Role',            color: 'purple',  icon: '➕' },
    delete_role:          { ar: 'حذف دور',                    en: 'Delete Role',         color: 'rose',    icon: '🗑️' },
    delete_order:         { ar: 'حذف طلب',                    en: 'Delete Order',        color: 'rose',    icon: '📦' },
    edit_delivered_order: { ar: 'تعديل طلب مُسلَّم',          en: 'Edit Delivered Order',color: 'amber',   icon: '📝' },
    change_exchange_rate: { ar: 'تغيير سعر الصرف',            en: 'Change Exchange Rate',color: 'amber',   icon: '💱' },
    add_expense:          { ar: 'إضافة مصروف',                en: 'Add Expense',         color: 'orange',  icon: '💸' },
    delete_expense:       { ar: 'حذف مصروف',                  en: 'Delete Expense',      color: 'rose',    icon: '🗑️' },
    edit_order:           { ar: 'تعديل طلب',                  en: 'Edit Order',          color: 'blue',    icon: '✏️' },
    add_order:            { ar: 'إضافة طلب',                  en: 'Add Order',           color: 'cyan',    icon: '➕' },
    add_customer:         { ar: 'إضافة عميل',                 en: 'Add Customer',        color: 'cyan',    icon: '👤' },
    edit_customer:        { ar: 'تعديل عميل',                 en: 'Edit Customer',       color: 'blue',    icon: '✏️' },
    delete_customer:      { ar: 'حذف عميل',                   en: 'Delete Customer',     color: 'rose',    icon: '🗑️' },
  };
  const e = map[action];
  if (!e) return { label: action, color: 'slate', icon: '📌' };
  return { label: isAr ? e.ar : e.en, color: e.color, icon: e.icon };
};

// ══════════════════════════════════════════════════════════════
// SESSION TERMINATION OPTIONS
// ══════════════════════════════════════════════════════════════
type SessionAction = 'force_logout' | 'disable_account' | 'temp_ban_1h' | 'temp_ban_24h' | 'temp_ban_72h';

const SESSION_ACTIONS = (isAr: boolean): { id: SessionAction; label: string; desc: string; icon: React.ComponentType<any>; color: string; severity: string }[] => [
  {
    id: 'force_logout',
    label: isAr ? 'إنهاء الجلسة فوراً' : 'Force Logout Now',
    desc: isAr ? 'يُغلق الجلسة الحالية فوراً دون تعطيل الحساب — يستطيع تسجيل الدخول مجدداً' : 'Immediately ends session without disabling account — can login again',
    icon: Zap,
    color: 'amber',
    severity: 'warning'
  },
  {
    id: 'disable_account',
    label: isAr ? 'تعطيل الحساب نهائياً' : 'Disable Account Permanently',
    desc: isAr ? 'يُعطِّل الحساب ويُنهي الجلسة — لا يستطيع الدخول حتى يُعيد المدير التفعيل' : 'Disables account and ends session — cannot login until admin re-enables',
    icon: Ban,
    color: 'rose',
    severity: 'danger'
  },
  {
    id: 'temp_ban_1h',
    label: isAr ? 'حظر مؤقت — ساعة واحدة' : 'Temporary Ban — 1 Hour',
    desc: isAr ? 'يُعطِّل الحساب لمدة ساعة ثم يُعيد التفعيل تلقائياً' : 'Disables account for 1 hour then auto-re-enables',
    icon: Timer,
    color: 'orange',
    severity: 'warning'
  },
  {
    id: 'temp_ban_24h',
    label: isAr ? 'حظر مؤقت — 24 ساعة' : 'Temporary Ban — 24 Hours',
    desc: isAr ? 'يُعطِّل الحساب ليوم كامل' : 'Disables account for 24 hours',
    icon: Timer,
    color: 'orange',
    severity: 'warning'
  },
  {
    id: 'temp_ban_72h',
    label: isAr ? 'حظر مؤقت — 72 ساعة' : 'Temporary Ban — 72 Hours',
    desc: isAr ? 'يُعطِّل الحساب لثلاثة أيام كاملة' : 'Disables account for 72 hours',
    icon: Timer,
    color: 'orange',
    severity: 'warning'
  },
];

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function UserManagement() {
  const { settings } = useSettings();
  const { role, hasPermission, profile: currentUserDoc, loading: roleLoading } = useRole();
  const isAr = settings.language === 'ar';
  const t = (ar: string, en: string) => isAr ? ar : en;

  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'sessions' | 'activity' | 'wallets'>('users');

  // ── Data ─────────────────────────────────────────────────
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [walletSearch, setWalletSearch] = useState('');
  const [walletTypeFilter, setWalletTypeFilter] = useState<'all' | 'customer' | 'courier'>('all');
  const [loading, setLoading] = useState(true);

  // ── Users filters ────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPassword, setShowPassword] = useState(false);

  // ── Modals ───────────────────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionTargetUser, setSessionTargetUser] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [addLoading, setAddLoading] = useState(false);

  // ── Forms ────────────────────────────────────────────────
  const [editFormData, setEditFormData] = useState({
    fullName: '', role: '', disabled: false, commissionRate: 0, username: '', systemPin: '', monthlySalary: 0
  });
  const [addFormData, setAddFormData] = useState({
    fullName: '', username: '', email: '', password: '', systemPin: '', role: 'Employee', commissionRate: 0, monthlySalary: 0
  });

  // ── Roles ────────────────────────────────────────────────
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [roleFormData, setRoleFormData] = useState({ id: '', title: '', permissions: [] as string[] });
  const [permSearch, setPermSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // ── Activity Log ─────────────────────────────────────────
  const [logFilter, setLogFilter] = useState('all');
  const [logUserFilter, setLogUserFilter] = useState('all');
  const [logLimit, setLogLimit] = useState(50);

  // ── Confirm ──────────────────────────────────────────────
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; type: 'danger' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

  // ══════════════════════════════════════════════════════════
  // DATA FETCHING
  // ══════════════════════════════════════════════════════════
  useEffect(() => {
    if (roleLoading) return;
    const unsubRoles = onSnapshot(collection(db, 'roles'), snap =>
      setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsubRoles();
  }, [roleLoading]);

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(all.filter((u: any) => u.role !== 'Courier' && u.roleId !== 'courier' && u.role !== 'courier'));
      setLoading(false);
    }, err => handleFirestoreError(err, OperationType.LIST, 'users'));
    return unsub;
  }, [roleLoading]);

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'couriers'), snap => {
      setCouriers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [roleLoading]);

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'customers'), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [roleLoading]);

  useEffect(() => {
    if (roleLoading || !hasPermission('view_activity_log')) return;
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(200));
    const unsub = onSnapshot(q, snap =>
      setActivityLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [roleLoading]);

  // Auto-ban timer: check every minute if temp bans have expired
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      const bannedUsers = users.filter(u => u.disabled && u.tempBanUntil && u.tempBanUntil <= now);
      for (const u of bannedUsers) {
        await updateDoc(doc(db, 'users', u.id), {
          disabled: false, tempBanUntil: null, updatedAt: now
        }).catch(console.error);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [users]);

  // ══════════════════════════════════════════════════════════
  // USER ACTIONS
  // ══════════════════════════════════════════════════════════
  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setEditFormData({
      fullName: user.fullName || '', username: user.username || '',
      role: user.role || 'Employee', disabled: user.disabled || false,
      commissionRate: user.commissionRate || 0, systemPin: user.systemPin || '',
      monthlySalary: user.monthlySalary || 0
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (editFormData.username && editFormData.username !== selectedUser.username) {
      const q = query(collection(db, 'users'), where('username', '==', editFormData.username));
      const snap = await getDocs(q);
      if (!snap.empty && snap.docs[0].id !== selectedUser.id) {
        return notificationService.notify({ title: t('خطأ', 'Error'), message: t('اسم المستخدم مستخدم مسبقاً', 'Username already taken'), type: 'error', category: 'system' });
      }
    }
    const isRoot = ROOT_EMAILS.includes(selectedUser.email) || selectedUser.isRoot;
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        fullName: editFormData.fullName, username: editFormData.username,
        role: isRoot ? 'Admin' : editFormData.role,
        disabled: isRoot ? false : editFormData.disabled,
        commissionRate: editFormData.commissionRate, systemPin: editFormData.systemPin,
        monthlySalary: editFormData.monthlySalary,
        updatedAt: Date.now()
      });
      // Sync financial account name if changed
      if (editFormData.fullName !== selectedUser.fullName && selectedUser.financialAccountId) {
        await financialAccountService.updateAccountEntityName(selectedUser.id, editFormData.fullName);
      }
      // Sync monthly salary change in financial account
      if (editFormData.monthlySalary !== (selectedUser.monthlySalary || 0)) {
        await financialAccountService.updateMonthlySalary(selectedUser.id, editFormData.monthlySalary);
      }
      await activityLogService.log('edit_user', editFormData.fullName, { userId: selectedUser.id });
      notificationService.notify({ title: t('تم التحديث', 'Updated'), message: t(`تم تحديث ${editFormData.fullName}`, `${editFormData.fullName} updated`), type: 'info', category: 'system' });
      setIsEditModalOpen(false); setSelectedUser(null);
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, 'users'); }
  };

  const handleToggleStatus = async (user: any) => {
    const isRootTarget = ROOT_EMAILS.includes(user.email) || user.isRoot;
    if (isRootTarget) return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن تعطيل المسؤول الرئيسي', 'Cannot disable root admin'), type: 'error', category: 'system' });
    const action = user.disabled ? t('تفعيل', 'Enable') : t('تعطيل', 'Disable');
    setConfirmConfig({
      isOpen: true, type: user.disabled ? 'info' : 'warning',
      title: `${action} — ${user.fullName}`,
      message: t(`هل أنت متأكد من ${action} حساب ${user.fullName}؟`, `Are you sure you want to ${action.toLowerCase()} ${user.fullName}?`),
      onConfirm: async () => {
        await updateDoc(doc(db, 'users', user.id), { disabled: !user.disabled, updatedAt: Date.now() });
        await activityLogService.log(user.disabled ? 'enable_user' : 'disable_user', user.fullName, { userId: user.id });
        notificationService.notify({ title: t('تم', 'Done'), message: `${user.fullName} ${user.disabled ? t('مُفعَّل', 'enabled') : t('مُعطَّل', 'disabled')}`, type: user.disabled ? 'success' : 'warning', category: 'system' });
      }
    });
  };

  const handleDeleteUser = (id: string, name: string) => {
    const targetUser = users.find(u => u.id === id);
    if (targetUser && (ROOT_EMAILS.includes(targetUser.email) || targetUser.isRoot)) {
      return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن حذف المسؤول الرئيسي', 'Cannot delete root admin'), type: 'error', category: 'system' });
    }
    setConfirmConfig({
      isOpen: true, type: 'danger',
      title: t('حذف موظف نهائياً', 'Delete User Permanently'),
      message: t(`هل أنت متأكد من حذف ${name}؟ لا يمكن التراجع.`, `Permanently delete ${name}? This cannot be undone.`),
      onConfirm: async () => {
        await deleteDoc(doc(db, 'users', id));
        await activityLogService.log('delete_user', name, { userId: id });
        notificationService.notify({ title: t('تم الحذف', 'Deleted'), message: t(`تم حذف ${name}`, `${name} deleted`), type: 'error', category: 'system' });
      }
    });
  };

  const handleResetPassword = (user: any) => {
    setConfirmConfig({
      isOpen: true, type: 'warning',
      title: t('إعادة تعيين كلمة المرور', 'Reset Password'),
      message: t(`سيُرسَل بريد إعادة التعيين إلى ${user.email}. هل تريد المتابعة؟`, `Password reset email will be sent to ${user.email}. Continue?`),
      onConfirm: async () => {
        try {
          await sendPasswordResetEmail(auth, user.email);
          await activityLogService.log('reset_password', user.fullName, { email: user.email });
          notificationService.notify({ title: t('تم الإرسال', 'Email Sent'), message: t(`تم إرسال رابط إعادة التعيين إلى ${user.email}`, `Reset link sent to ${user.email}`), type: 'success', category: 'system' });
        } catch (err: any) {
          notificationService.notify({ title: t('خطأ', 'Error'), message: err.message, type: 'error', category: 'system' });
        }
      }
    });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault(); setAddLoading(true);
    let secondaryApp: any;
    try {
      const emailQ = query(collection(db, 'users'), where('email', '==', addFormData.email.toLowerCase()));
      if (!(await getDocs(emailQ)).empty) throw new Error(t('البريد مستخدم مسبقاً', 'Email already registered'));
      if (addFormData.username) {
        const uQ = query(collection(db, 'users'), where('username', '==', addFormData.username));
        if (!(await getDocs(uQ)).empty) throw new Error(t('اسم المستخدم مستخدم مسبقاً', 'Username already taken'));
      }
      const secondaryAppName = `Secondary-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, addFormData.email.toLowerCase(), addFormData.password);
      await setDoc(doc(db, 'users', newUser.uid), {
        fullName: addFormData.fullName, email: addFormData.email.toLowerCase(),
        username: addFormData.username, systemPin: addFormData.systemPin,
        role: addFormData.role, commissionRate: addFormData.commissionRate,
        monthlySalary: addFormData.monthlySalary,
        disabled: false, createdAt: Date.now()
      });

      // Auto-create financial account for employee (2130-xxxx) with monthly salary
      try {
        await financialAccountService.createAccountForEntity(
          'employee',
          newUser.uid,
          addFormData.fullName,
          settings.currency || 'YER',
          addFormData.monthlySalary
        );
      } catch (accErr) {
        console.warn('[UserManagement] Could not create financial account for employee:', accErr);
      }

      await activityLogService.log('add_user', addFormData.fullName, { email: addFormData.email, role: addFormData.role });
      notificationService.notify({ title: t('تم إنشاء الحساب', 'Account Created'), message: t(`تم إنشاء حساب ${addFormData.fullName}`, `${addFormData.fullName} account created`), type: 'success', category: 'system' });
      setIsAddModalOpen(false);
      setAddFormData({ fullName: '', username: '', email: '', password: '', systemPin: '', role: 'Employee', commissionRate: 0, monthlySalary: 0 });
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = t('البريد مسجل في نظام المصادقة', 'Email already in auth system');
      else if (err.code === 'auth/weak-password') msg = t('كلمة المرور ضعيفة جداً (6+ أحرف)', 'Password too weak (min 6 chars)');
      notificationService.notify({ title: t('خطأ', 'Error'), message: msg, type: 'error', category: 'system' });
    } finally {
      setAddLoading(false);
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  };

  // ══════════════════════════════════════════════════════════
  // SESSION TERMINATION — ENHANCED
  // ══════════════════════════════════════════════════════════
  const handleSessionAction = async (user: any, action: SessionAction) => {
    const isRootTarget = ROOT_EMAILS.includes(user.email) || user.isRoot;
    if (isRootTarget) {
      return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن إنهاء جلسة المسؤول الرئيسي', 'Cannot terminate root admin session'), type: 'error', category: 'system' });
    }

    const now = Date.now();
    let updatePayload: Record<string, any> = {};
    let logAction: any = 'terminate_session';
    let logDetails: Record<string, any> = { targetUserId: user.id, action };
    let successMsg = '';

    switch (action) {
      case 'force_logout':
        updatePayload = { forceLogout: true, forceLogoutAt: now, updatedAt: now };
        logAction = 'force_logout';
        successMsg = t(`تم إنهاء جلسة ${user.fullName} فوراً`, `${user.fullName}'s session terminated immediately`);
        break;
      case 'disable_account':
        updatePayload = { disabled: true, forceLogout: true, forceLogoutAt: now, updatedAt: now };
        logAction = 'disable_user';
        successMsg = t(`تم تعطيل حساب ${user.fullName} وإنهاء جلسته`, `${user.fullName}'s account disabled and session terminated`);
        break;
      case 'temp_ban_1h':
        updatePayload = { disabled: true, forceLogout: true, forceLogoutAt: now, tempBanUntil: now + 3_600_000, updatedAt: now };
        logAction = 'temp_ban';
        logDetails.duration = '1h';
        successMsg = t(`تم حظر ${user.fullName} لمدة ساعة`, `${user.fullName} banned for 1 hour`);
        break;
      case 'temp_ban_24h':
        updatePayload = { disabled: true, forceLogout: true, forceLogoutAt: now, tempBanUntil: now + 86_400_000, updatedAt: now };
        logAction = 'temp_ban';
        logDetails.duration = '24h';
        successMsg = t(`تم حظر ${user.fullName} لمدة 24 ساعة`, `${user.fullName} banned for 24 hours`);
        break;
      case 'temp_ban_72h':
        updatePayload = { disabled: true, forceLogout: true, forceLogoutAt: now, tempBanUntil: now + 259_200_000, updatedAt: now };
        logAction = 'temp_ban';
        logDetails.duration = '72h';
        successMsg = t(`تم حظر ${user.fullName} لمدة 72 ساعة`, `${user.fullName} banned for 72 hours`);
        break;
    }

    try {
      await updateDoc(doc(db, 'users', user.id), updatePayload);
      await activityLogService.log(logAction, user.fullName, logDetails);
      notificationService.notify({ title: t('تم التنفيذ', 'Action Applied'), message: successMsg, type: 'error', category: 'system' });
      setIsSessionModalOpen(false);
      setSessionTargetUser(null);
    } catch (err: any) {
      notificationService.notify({ title: t('خطأ', 'Error'), message: err.message, type: 'error', category: 'system' });
    }
  };

  // ══════════════════════════════════════════════════════════
  // ROLE ACTIONS
  // ══════════════════════════════════════════════════════════
  const handleOpenAddRole = () => { setSelectedRole(null); setRoleFormData({ id: '', title: '', permissions: [] }); setIsRoleModalOpen(true); };
  const handleOpenEditRole = (r: any) => { setSelectedRole(r); setRoleFormData({ id: r.id, title: r.title || r.id, permissions: r.permissions || [] }); setIsRoleModalOpen(true); };

  const togglePermission = (permId: string) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const toggleGroup = (group: string, checked: boolean) => {
    const permsInGroup = PERMISSION_GROUPS(isAr).find(g => g.group === group)?.perms.map(p => p.id) || [];
    setRoleFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...new Set([...prev.permissions, ...permsInGroup])]
        : prev.permissions.filter(p => !permsInGroup.includes(p))
    }));
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormData.id) return notificationService.notify({ title: t('خطأ', 'Error'), message: t('يرجى إدخال معرّف الدور', 'Please enter role ID'), type: 'error', category: 'system' });
    try {
      await setDoc(doc(db, 'roles', roleFormData.id), { title: roleFormData.title, permissions: roleFormData.permissions, updatedAt: Date.now() });
      await activityLogService.log(selectedRole ? 'edit_role' : 'add_role', roleFormData.title, { id: roleFormData.id, permCount: roleFormData.permissions.length });
      notificationService.notify({ title: t('تم الحفظ', 'Saved'), message: t(`تم حفظ دور ${roleFormData.title}`, `Role ${roleFormData.title} saved`), type: 'success', category: 'system' });
      setIsRoleModalOpen(false);
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, 'roles'); }
  };

  const handleDeleteRole = (id: string, title: string) => {
    if (id === 'Admin') return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن حذف دور المدير', 'Cannot delete Admin role'), type: 'error', category: 'system' });
    setConfirmConfig({
      isOpen: true, type: 'danger',
      title: t('حذف دور', 'Delete Role'),
      message: t(`هل أنت متأكد من حذف دور "${title}"؟`, `Delete role "${title}"?`),
      onConfirm: async () => {
        await deleteDoc(doc(db, 'roles', id));
        await activityLogService.log('delete_role', title, { id });
        notificationService.notify({ title: t('تم الحذف', 'Deleted'), message: t(`تم حذف دور ${title}`, `Role ${title} deleted`), type: 'error', category: 'system' });
      }
    });
  };

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════
  const getRoleBadgeStyle = (roleName: string) => {
    const map: Record<string, string> = {
      'Admin': 'bg-amber-950/30 text-[#d4af37] border-[#d4af37]/30',
      'Employee': 'bg-purple-950/30 text-purple-400 border-purple-900/30',
      'Accountant': 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30',
    };
    return map[roleName] || 'bg-slate-900 text-slate-400 border-slate-800';
  };

  const isUserOnline = (user: any) => !user.disabled && user.lastSeen && Date.now() - user.lastSeen < 5 * 60 * 1000;

  const getTimeSince = (ts: number) => {
    if (!ts) return t('غير معروف', 'Unknown');
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return t('الآن', 'Just now');
    if (mins < 60) return t(`منذ ${mins} د`, `${mins}m ago`);
    if (hours < 24) return t(`منذ ${hours} س`, `${hours}h ago`);
    return t(`منذ ${days} ي`, `${days}d ago`);
  };

  const getTempBanRemaining = (user: any) => {
    if (!user.tempBanUntil) return null;
    const remaining = user.tempBanUntil - Date.now();
    if (remaining <= 0) return null;
    const hrs = Math.floor(remaining / 3_600_000);
    const mins = Math.floor((remaining % 3_600_000) / 60_000);
    return t(`${hrs}س ${mins}د`, `${hrs}h ${mins}m`);
  };

  const filteredUsers = users
    .filter(u => {
      const ms = (u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(search.toLowerCase());
      const mr = roleFilter === 'all' || u.role === roleFilter;
      const mst = statusFilter === 'all' || (statusFilter === 'active' && !u.disabled) || (statusFilter === 'disabled' && u.disabled) || (statusFilter === 'online' && isUserOnline(u));
      return ms && mr && mst;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const activeSessions = users.filter(u => isUserOnline(u));

  const filteredLogs = activityLogs
    .filter(l => (logFilter === 'all' || l.action === logFilter) && (logUserFilter === 'all' || l.userId === logUserFilter))
    .slice(0, logLimit);

  const currentUserData = users.find(u => u.id === auth.currentUser?.uid);

  const getFilteredPerms = () => {
    const q = permSearch.toLowerCase();
    return PERMISSION_GROUPS(isAr).map(g => ({
      ...g,
      perms: g.perms.filter(p => !q || p.label.toLowerCase().includes(q) || p.id.includes(q))
    })).filter(g => g.perms.length > 0);
  };

  // ══════════════════════════════════════════════════════════
  // ACCESS GUARD
  // ══════════════════════════════════════════════════════════
  if (roleLoading) return (
    <div className="flex bg-[#0e0e11] h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
    </div>
  );

  if (role !== 'Admin' && !hasPermission('view_users')) return (
    <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-800 text-center">
      <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
      <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase">{t('وصول مرفوض', 'Access Denied')}</h2>
      <p className="text-slate-500">{t('هذه اللوحة مخصصة للمدير فقط', 'Restricted to administrators only')}</p>
    </div>
  );

  const tabs = [
    { id: 'users',    icon: UsersIcon,    label: t('الموظفون', 'Staff'),               count: users.length },
    { id: 'roles',    icon: Shield,       label: t('الأدوار والصلاحيات', 'Roles'),      count: roles.length },
    { id: 'sessions', icon: MonitorCheck, label: t('الجلسات النشطة', 'Active Sessions'), count: activeSessions.length, pulse: true },
    { id: 'activity', icon: FileClock,    label: t('سجل النشاط', 'Activity Log'),       count: activityLogs.length },
    { id: 'wallets',  icon: Coins,        label: t('المحافظ العهد', 'Wallets'),        count: couriers.length + customers.length }
  ] as const;

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 pb-20 font-sans selection:bg-[#d4af37]/30" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── PAGE HEADER ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-3 rounded-2xl text-[#d4af37]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">{t('إدارة المستخدمين والصلاحيات', 'User Management & Access Control')}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('تحكم شامل • موظفون • أدوار • جلسات • سجل نشاط', 'Full Control • Staff • Roles • Sessions • Audit Log')}</p>
          </div>
        </div>
        {activeTab === 'users' && (role === 'Admin' || hasPermission('add_users')) && (
          <button onClick={() => setIsAddModalOpen(true)} className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition active:scale-95 shadow-md shrink-0">
            <Plus className="w-4 h-4" /> {t('إضافة موظف', 'Add Staff Member')}
          </button>
        )}
        {activeTab === 'roles' && (role === 'Admin' || hasPermission('add_roles')) && (
          <button onClick={handleOpenAddRole} className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition active:scale-95 shadow-md shrink-0">
            <Plus className="w-4 h-4" /> {t('إنشاء دور جديد', 'Create New Role')}
          </button>
        )}
      </div>

      {/* ── CURRENT USER CARD ──────────────────────────── */}
      {currentUserData && (
        <div className="bg-gradient-to-r from-[#d4af37]/5 via-black/40 to-[#d4af37]/5 border border-[#d4af37]/20 rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4af37]/20 to-amber-900/20 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center font-black text-sm relative">
              {currentUserData.fullName?.substring(0, 2)}
              <Crown className="w-3 h-3 text-yellow-400 absolute -top-1.5 -right-1.5" />
            </div>
            <div>
              <div className="text-xs font-black text-white">{currentUserData.fullName}</div>
              <div className="text-[9px] text-[#d4af37] font-bold uppercase tracking-wider">{t('المستخدم الحالي المتصل', 'Currently Logged In')}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase ${getRoleBadgeStyle(currentUserData.role)}`}>{currentUserData.role}</span>
            <span className="px-2.5 py-1 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded-lg text-[9px] font-black uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> {t('متصل', 'Online')}
            </span>
            <span className="px-2.5 py-1 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-[9px] font-mono font-bold">@{currentUserData.username || 'not_set'}</span>
          </div>
          <div className="text-[9px] text-slate-500 font-bold hidden sm:block">{t('آخر نشاط:', 'Last seen:')} {getTimeSince(currentUserData.lastSeen)}</div>
        </div>
      )}

      {/* ── TABS NAV ────────────────────────────────────── */}
      <div className="flex gap-1 bg-black/40 border border-slate-800/50 rounded-2xl p-1.5 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex-1 justify-center ${isActive ? 'bg-gradient-to-r from-[#d4af37]/20 to-transparent text-white border border-[#d4af37]/30 shadow-inner' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}>
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#d4af37]' : ''}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black flex items-center gap-0.5 ${isActive ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-slate-800 text-slate-500'}`}>
                {(tab as any).pulse && tab.count > 0 && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>}
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 1: USERS                                      */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="bg-[#121215] border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-800/50 bg-black/30 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4`} />
              <input type="text" placeholder={t('بحث بالاسم أو البريد أو المعرف...', 'Search by name, email or username...')} value={search} onChange={e => setSearch(e.target.value)}
                className={`w-full ${isAr ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 bg-black/50 border border-slate-800 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-600 font-bold`} />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
              <option value="all">{t('جميع الأدوار', 'All Roles')}</option>
              {roles.filter(r => r.id !== 'courier' && r.id !== 'Courier').map(r => <option key={r.id} value={r.id}>{r.title || r.id}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
              <option value="all">{t('جميع الحالات', 'All Status')}</option>
              <option value="online">{t('متصل الآن', 'Online Now')}</option>
              <option value="active">{t('نشط', 'Active')}</option>
              <option value="disabled">{t('معطَّل', 'Disabled')}</option>
            </select>
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/10 border border-emerald-900/20 rounded-xl text-[10px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              {activeSessions.length} {t('متصل', 'online')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" dir={isAr ? 'rtl' : 'ltr'}>
              <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-800/50">
                <tr>
                  <th className="p-4 text-start">{t('الموظف', 'Staff Member')}</th>
                  <th className="p-4 text-start">{t('البريد', 'Email')}</th>
                  <th className="p-4 text-start">{t('الدور', 'Role')}</th>
                  <th className="p-4 text-center">{t('الراتب', 'Salary')}</th>
                  <th className="p-4 text-center">{t('عمولة%', 'Commission%')}</th>
                  <th className="p-4 text-center">{t('الرصيد المالي', 'Balance')}</th>
                  <th className="p-4 text-center">PIN</th>
                  <th className="p-4 text-center">{t('الحالة', 'Status')}</th>
                  <th className="p-4 text-center">{t('آخر ظهور', 'Last Seen')}</th>
                  <th className="p-4 text-center">{t('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-800/30 bg-black/10">
                {filteredUsers.map(user => {
                  const isRootTarget = ROOT_EMAILS.includes(user.email) || user.isRoot;
                  const online = isUserOnline(user);
                  const tempBanLeft = getTempBanRemaining(user);
                  return (
                    <tr key={user.id} className={`hover:bg-slate-900/20 transition-colors ${user.disabled ? 'opacity-60' : ''}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-xs shrink-0 relative">
                            {user.fullName?.substring(0, 2)}
                            {isRootTarget && <Crown className="w-3 h-3 text-yellow-500 absolute -top-1.5 -right-1.5 animate-bounce" />}
                            {online && <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0a0a0d]"></span>}
                          </div>
                          <div>
                            <div className="font-extrabold text-white">{user.fullName}</div>
                            <div className="text-[9px] font-mono text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <span>@{user.username || 'not_set'}</span>
                              {user.financialAccountCode && (
                                <>
                                  <span className="text-slate-700">•</span>
                                  <span className="text-[#d4af37] font-black font-mono">
                                    {user.financialAccountCode}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-400 text-[10px]" dir="ltr">{user.email}</td>
                      <td className="p-4"><span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${getRoleBadgeStyle(user.role)}`}>{user.role}</span></td>
                      <td className="p-4 text-center font-mono text-[#d4af37] font-black">{(user.monthlySalary || 0).toLocaleString()} {settings.currency || 'YER'}</td>
                      <td className="p-4 text-center font-mono text-slate-300 font-black">{user.commissionRate || 0}%</td>
                      <td className={`p-4 text-center font-mono font-black ${(user.financialBalance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(user.financialBalance || 0).toLocaleString()} {settings.currency || 'YER'}
                      </td>
                      <td className="p-4 text-center font-mono text-slate-400 font-semibold text-[11px] tracking-widest">{user.systemPin || '—'}</td>
                      <td className="p-4 text-center">
                        {user.disabled ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="bg-rose-950/20 text-rose-400 border border-rose-900/30 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">
                              {tempBanLeft ? t('حظر مؤقت', 'TEMP BAN') : t('معطَّل', 'DISABLED')}
                            </span>
                            {tempBanLeft && <span className="text-[8px] text-orange-400 font-mono font-bold">{tempBanLeft}</span>}
                          </div>
                        ) : (
                          <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">{t('نشط', 'ACTIVE')}</span>
                        )}
                      </td>
                      <td className="p-4 text-center text-[9px] text-slate-500 font-bold">{getTimeSince(user.lastSeen)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          {(role === 'Admin' || hasPermission('disable_accounts')) && (
                            <button onClick={() => handleToggleStatus(user)} title={user.disabled ? t('تفعيل', 'Enable') : t('تعطيل', 'Disable')}
                              className={`p-1.5 rounded-lg border transition-all ${user.disabled ? 'text-emerald-400 bg-emerald-950/10 border-emerald-900/30 hover:bg-emerald-950/30' : 'text-rose-400 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30'}`}>
                              {user.disabled ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {(role === 'Admin' || hasPermission('edit_users')) && (
                            <button onClick={() => handleOpenEdit(user)} title={t('تعديل', 'Edit')} className="p-1.5 rounded-lg border text-slate-400 hover:text-white bg-slate-900/50 border-slate-800 hover:border-[#d4af37]/30 transition-all">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(role === 'Admin' || hasPermission('reset_passwords')) && (
                            <button onClick={() => handleResetPassword(user)} title={t('إعادة تعيين كلمة المرور', 'Reset Password')} className="p-1.5 rounded-lg border text-amber-400 bg-amber-950/10 border-amber-900/30 hover:bg-amber-950/30 transition-all">
                              <Key className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(role === 'Admin' || hasPermission('terminate_sessions')) && !isRootTarget && online && (
                            <button onClick={() => { setSessionTargetUser(user); setIsSessionModalOpen(true); }} title={t('إنهاء الجلسة', 'End Session')} className="p-1.5 rounded-lg border text-rose-400 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30 transition-all">
                              <WifiOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(role === 'Admin' || hasPermission('delete_users')) && !isRootTarget && (
                            <button onClick={() => handleDeleteUser(user.id, user.fullName)} title={t('حذف', 'Delete')} className="p-1.5 rounded-lg border text-rose-500 bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/30 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={8} className="p-16 text-center text-slate-600 font-bold text-[10px] uppercase tracking-widest">{t('[ لا يوجد موظفون مطابقون ]', '[ no staff profiles matched ]')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 2: ROLES & PERMISSIONS                        */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map(r => {
            const usersInRole = users.filter(u => u.role === r.id).length;
            const hasAll = r.permissions?.includes('*');
            const allPerms = ALL_PERMISSIONS(isAr);
            return (
              <div key={r.id} className="bg-gradient-to-b from-[#121215] to-[#0a0a0d] border border-slate-800/50 rounded-2xl overflow-hidden hover:border-[#d4af37]/25 transition-all flex flex-col shadow-lg">
                <div className="p-4 border-b border-slate-800/40 flex justify-between items-start bg-black/20">
                  <div>
                    <h3 className="font-extrabold text-[#d4af37] text-sm mb-0.5">{r.title || r.id}</h3>
                    <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest" dir="ltr">{r.id}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-slate-500 font-bold">{usersInRole} {t('مستخدم', 'users')}</span>
                      {hasAll && <span className="bg-amber-950/20 text-[#d4af37] border border-[#d4af37]/20 px-1.5 py-0.5 rounded text-[8px] font-black">{t('صلاحيات كاملة ★', 'FULL ACCESS ★')}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(role === 'Admin' || hasPermission('edit_roles')) && (
                      <button onClick={() => handleOpenEditRole(r)} className="p-1.5 text-slate-400 border border-slate-800 bg-slate-950 hover:text-[#d4af37] hover:border-[#d4af37]/30 rounded-lg transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                    )}
                    {r.id !== 'Admin' && (role === 'Admin' || hasPermission('delete_roles')) && (
                      <button onClick={() => handleDeleteRole(r.id, r.title || r.id)} className="p-1.5 text-rose-400 border border-slate-800 bg-slate-950 hover:bg-rose-950/20 hover:border-rose-500/30 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
                <div className="p-4 flex-1">
                  <div className="text-[9px] font-black text-slate-600 mb-2 uppercase tracking-wider">{t('الصلاحيات الممنوحة:', 'Granted Permissions:')}</div>
                  {hasAll ? (
                    <div className="text-[9px] text-[#d4af37] font-bold bg-[#d4af37]/5 border border-[#d4af37]/10 rounded-lg p-2 text-center">
                      ★ {t('جميع صلاحيات النظام', 'All System Permissions')} ({allPerms.length} {t('صلاحية', 'permissions')})
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(r.permissions || []).slice(0, 8).map((pId: string) => {
                        const perm = allPerms.find(ap => ap.id === pId);
                        return <span key={pId} className="bg-slate-900/80 text-slate-300 border border-slate-800/60 px-1.5 py-0.5 rounded text-[8px] font-bold">{perm?.label || pId}</span>;
                      })}
                      {(r.permissions || []).length > 8 && (
                        <span className="bg-slate-900 text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded text-[8px] font-bold">+{(r.permissions || []).length - 8} {t('أخرى', 'more')}</span>
                      )}
                      {(!r.permissions || r.permissions.length === 0) && <span className="text-slate-600 text-[10px] italic">{t('لا توجد صلاحيات', 'No permissions assigned')}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 3: ACTIVE SESSIONS                            */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('متصلون الآن', 'Online Now'), value: activeSessions.length, color: 'emerald', Icon: MonitorCheck },
              { label: t('إجمالي الموظفين', 'Total Staff'), value: users.length, color: 'blue', Icon: UsersIcon },
              { label: t('حسابات معطَّلة', 'Disabled'), value: users.filter(u => u.disabled).length, color: 'rose', Icon: UserX },
              { label: t('حظر مؤقت', 'Temp Banned'), value: users.filter(u => u.disabled && u.tempBanUntil).length, color: 'orange', Icon: Timer },
            ].map((stat, i) => (
              <div key={i} className={`bg-black/40 border border-${stat.color}-900/20 rounded-2xl p-4 flex items-center gap-3`}>
                <stat.Icon className={`w-5 h-5 text-${stat.color}-400 shrink-0`} />
                <div>
                  <div className={`text-xl font-black text-${stat.color}-400`}>{stat.value}</div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Session Termination Info */}
          <div className="bg-amber-950/10 border border-amber-900/20 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-300/80 font-bold leading-relaxed">
              {t(
                'يعمل نظام إنهاء الجلسات بشكل فوري: عند النقر على "إجراء"، يُرسَل أمر إلى Firestore يُلتقط تلقائياً من المستخدم المستهدف خلال ثوانٍ ويُعيد توجيهه لصفحة تسجيل الدخول.',
                'Session termination works in real-time: clicking an action sends a Firestore command that the target user\'s session picks up within seconds and redirects them to login.'
              )}
            </div>
          </div>

          {/* Sessions Table */}
          <div className="bg-[#121215] border border-slate-800/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800/40 bg-black/30 flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                {t('جميع المستخدمين — حالة الجلسات', 'All Users — Session Status')}
              </h3>
              <span className="text-[9px] text-slate-500 font-bold">{t('يتجدد كل دقيقة', 'Refreshes every minute')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" dir={isAr ? 'rtl' : 'ltr'}>
                <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-800/40">
                  <tr>
                    <th className="p-4 text-start">{t('المستخدم', 'User')}</th>
                    <th className="p-4 text-start">{t('الدور', 'Role')}</th>
                    <th className="p-4 text-center">{t('آخر نشاط', 'Last Activity')}</th>
                    <th className="p-4 text-center">{t('حالة الجلسة', 'Session Status')}</th>
                    <th className="p-4 text-center">{t('إجراء الجلسة', 'Session Action')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/30">
                  {users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)).map(u => {
                    const online = isUserOnline(u);
                    const isSelf = u.id === auth.currentUser?.uid;
                    const isRoot = ROOT_EMAILS.includes(u.email) || u.isRoot;
                    const tempBanLeft = getTempBanRemaining(u);
                    return (
                      <tr key={u.id} className={`transition-colors ${online && !u.disabled ? 'hover:bg-emerald-950/5' : 'hover:bg-slate-900/10'} ${u.disabled ? 'opacity-50' : ''}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-[10px]">
                              {u.fullName?.substring(0, 2)}
                              {online && !u.disabled && <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full border border-[#0a0a0d]"></span>}
                              {isRoot && <Crown className="w-2.5 h-2.5 text-yellow-400 absolute -top-1 -right-1" />}
                            </div>
                            <div>
                              <div className="font-bold text-white text-[11px] flex items-center gap-1.5">
                                {u.fullName}
                                {isSelf && <span className="text-[8px] text-[#d4af37] font-black bg-[#d4af37]/10 border border-[#d4af37]/20 px-1.5 py-0.5 rounded">{t('أنت', 'YOU')}</span>}
                              </div>
                              <div className="text-[9px] text-slate-500 font-mono">@{u.username || u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${getRoleBadgeStyle(u.role)}`}>{u.role}</span></td>
                        <td className="p-4 text-center text-[10px] font-bold text-slate-400">{getTimeSince(u.lastSeen)}</td>
                        <td className="p-4 text-center">
                          {u.disabled ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-rose-400 text-[9px] font-black flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                {tempBanLeft ? t('حظر مؤقت', 'TEMP BAN') : t('معطَّل', 'DISABLED')}
                              </span>
                              {tempBanLeft && <span className="text-[8px] text-orange-400 font-mono font-bold">{t('يرفع خلال:', 'Lifts in:')} {tempBanLeft}</span>}
                            </div>
                          ) : online ? (
                            <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/20 px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-1 justify-center w-fit mx-auto">
                              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>{t('جلسة نشطة', 'ACTIVE SESSION')}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[9px] font-bold uppercase flex items-center gap-1 justify-center">
                              <WifiOff className="w-3 h-3" />{t('غير متصل', 'OFFLINE')}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {!isSelf && !isRoot && hasPermission('terminate_sessions') && (
                            <button
                              onClick={() => { setSessionTargetUser(u); setIsSessionModalOpen(true); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/20 text-rose-400 border border-rose-900/30 hover:bg-rose-950/40 rounded-lg text-[9px] font-black transition-all mx-auto"
                            >
                              <Zap className="w-3 h-3" /> {t('إجراء', 'Action')}
                            </button>
                          )}
                          {!isSelf && !isRoot && !hasPermission('terminate_sessions') && (
                            <span className="text-slate-700 text-[9px] font-bold">—</span>
                          )}
                          {isSelf && <span className="text-slate-600 text-[9px] font-bold">{t('جلستك', 'Your Session')}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 4: ACTIVITY LOG                               */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {!hasPermission('view_activity_log') ? (
            <div className="flex flex-col items-center justify-center p-12 bg-[#121215] border border-slate-800 rounded-2xl text-center">
              <ShieldAlert className="w-12 h-12 text-rose-500 mb-4 animate-pulse" />
              <p className="text-slate-500 text-sm font-bold">{t('ليس لديك صلاحية عرض سجل النشاط', 'No permission to view activity log')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 p-4 bg-black/30 border border-slate-800/50 rounded-2xl">
                <select value={logFilter} onChange={e => setLogFilter(e.target.value)} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
                  <option value="all">{t('جميع الأنواع', 'All Actions')}</option>
                  {['add_user','edit_user','disable_user','enable_user','delete_user','reset_password','force_logout','temp_ban','add_role','edit_role','delete_role','add_order','edit_order','delete_order','edit_delivered_order','change_exchange_rate','add_expense','add_customer'].map(a => (
                    <option key={a} value={a}>{getActionMeta(a, isAr).label}</option>
                  ))}
                </select>
                <select value={logUserFilter} onChange={e => setLogUserFilter(e.target.value)} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
                  <option value="all">{t('جميع المستخدمين', 'All Users')}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
                <select value={logLimit} onChange={e => setLogLimit(Number(e.target.value))} className="bg-black/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50">
                  {[25,50,100,200].map(n => <option key={n} value={n}>{n} {t('سجل', 'records')}</option>)}
                </select>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                  <Activity className="w-3.5 h-3.5" /> {filteredLogs.length} {t('سجل', 'records')}
                </div>
              </div>

              <div className="bg-[#121215] border border-slate-800/50 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-800/40">
                      <tr>
                        <th className="p-4 text-start">{t('النشاط', 'Action')}</th>
                        <th className="p-4 text-start">{t('الموظف', 'Staff')}</th>
                        <th className="p-4 text-start">{t('الهدف', 'Target')}</th>
                        <th className="p-4 text-start">{t('تفاصيل', 'Details')}</th>
                        <th className="p-4 text-center">{t('الوقت', 'Time')}</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-800/30">
                      {filteredLogs.map(log => {
                        const meta = getActionMeta(log.action, isAr);
                        const ts = log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp ? new Date(log.timestamp) : null;
                        return (
                          <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-${meta.color}-950/20 text-${meta.color}-400 border border-${meta.color}-900/20 text-[9px] font-black`}>
                                {meta.icon} {meta.label}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-white text-[11px]">{log.userName || '—'}</div>
                              <div className="text-[9px] text-slate-500 font-bold uppercase">{log.userRole || ''}</div>
                            </td>
                            <td className="p-4 text-slate-300 font-bold text-[11px]">{log.target || '—'}</td>
                            <td className="p-4 max-w-xs">
                              {log.details && Object.keys(log.details).length > 0 ? (
                                <div className="text-[9px] text-slate-500 font-mono truncate">
                                  {Object.entries(log.details).slice(0, 2).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' | ')}
                                </div>
                              ) : <span className="text-slate-700 text-[9px]">—</span>}
                            </td>
                            <td className="p-4 text-center text-[9px] text-slate-500 font-bold whitespace-nowrap">
                              {ts ? ts.toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredLogs.length === 0 && (
                        <tr><td colSpan={5} className="p-16 text-center text-slate-600 font-bold text-[10px] uppercase tracking-widest">{t('[ لا توجد سجلات ]', '[ no activity logs ]')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 5: SMART WALLETS                              */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'wallets' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black/40 border border-slate-800/50 p-4 rounded-2xl animate-fade-in">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-550 w-4 h-4" />
              <input 
                type="text"
                placeholder={isAr ? 'ابحث باسم العميل أو المندوب أو كوده...' : 'Search by name, phone, or custom ID...'}
                value={walletSearch}
                onChange={e => setWalletSearch(e.target.value)}
                className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
              />
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={() => setWalletTypeFilter('all')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black border transition ${walletTypeFilter === 'all' ? 'bg-[#d4af37]/20 border-[#d4af37]/30 text-[#d4af37]' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              <button 
                onClick={() => setWalletTypeFilter('courier')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black border transition ${walletTypeFilter === 'courier' ? 'bg-indigo-950/45 border-indigo-900/50 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                {isAr ? 'المناديب' : 'Couriers'}
              </button>
              <button 
                onClick={() => setWalletTypeFilter('customer')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black border transition ${walletTypeFilter === 'customer' ? 'bg-emerald-950/45 border-emerald-900/50 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                {isAr ? 'العملاء' : 'Customers'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Courier Wallets */}
            {(walletTypeFilter === 'all' || walletTypeFilter === 'courier') && (
              <div className="bg-[#121215] border border-slate-850 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                  <h3 className="font-black text-sm text-indigo-400 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#d4af37]" />
                    {isAr ? 'محافظ ومستحقات المناديب' : 'External Courier Balance Sheets'}
                  </h3>
                  <span className="font-mono text-xs text-slate-500 font-bold">COUNT: {couriers.length}</span>
                </div>
                
                <div className="space-y-2.5 overflow-y-auto max-h-[480px]">
                  {couriers
                    .filter(c => {
                      const q = walletSearch.toLowerCase();
                      return !q || (c.fullName || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.courierCustomId || '').toLowerCase().includes(q);
                    })
                    .map(c => {
                      const bal = c.wallet?.balance || c.walletBalance || 0;
                      return (
                        <div key={c.id} className="flex justify-between items-center bg-black/40 border border-slate-850 hover:border-slate-800 p-3.5 rounded-xl transition duration-200">
                          <div className="text-start">
                            <h4 className="font-extrabold text-xs text-white flex items-center gap-1.5">{c.fullName}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] bg-slate-900 border border-slate-800 text-[#d4af37] px-1.5 py-0.5 rounded font-mono font-bold">ID: {c.courierCustomId || 'ALX-CR'}</span>
                              <span className="text-[9px] text-slate-550 font-bold font-mono" dir="ltr">{c.phone}</span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-[11px] font-mono font-black text-[#d4af37]">{bal.toLocaleString()} YER</div>
                            <span className="text-[8px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/10 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-1 inline-block">{isAr ? 'رصيد عهدة محتجز' : 'Wallet Balance'}</span>
                          </div>
                        </div>
                      );
                    })}
                  {couriers.length === 0 && (
                    <div className="p-8 text-center text-slate-600 font-bold text-xs uppercase tracking-widest">[ no_couriers_matched ]</div>
                  )}
                </div>
              </div>
            )}

            {/* Customer Wallets */}
            {(walletTypeFilter === 'all' || walletTypeFilter === 'customer') && (
              <div className="bg-[#121215] border border-slate-850 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                  <h3 className="font-black text-sm text-emerald-400 flex items-center gap-2">
                    <UsersIcon className="w-4 h-4" />
                    {isAr ? 'محافظ وودائع العملاء' : 'Patron Client Wallets'}
                  </h3>
                  <span className="font-mono text-xs text-slate-500 font-bold">COUNT: {customers.length}</span>
                </div>
                
                <div className="space-y-2.5 overflow-y-auto max-h-[480px]">
                  {customers
                    .filter(c => {
                      const q = walletSearch.toLowerCase();
                      return !q || (c.fullName || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.financialAccountCode || '').toLowerCase().includes(q);
                    })
                    .map(c => {
                      const bal = c.wallet?.balance || c.walletBalance || 0;
                      return (
                        <div key={c.id} className="flex justify-between items-center bg-black/40 border border-slate-850 hover:border-slate-800 p-3.5 rounded-xl transition duration-200">
                          <div className="text-start">
                            <h4 className="font-extrabold text-xs text-white">{c.fullName}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              {c.financialAccountCode && (
                                <span className="text-[9px] bg-slate-900 border border-slate-800 text-[#d4af37] px-1.5 py-0.5 rounded font-mono font-bold">ACC: {c.financialAccountCode}</span>
                              )}
                              <span className="text-[9px] text-slate-550 font-bold font-mono" dir="ltr">{c.phone}</span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-[11px] font-mono font-black text-emerald-400">{bal.toLocaleString()} YER</div>
                            <span className="text-[8px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/10 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-1 inline-block">{isAr ? 'محفظة نشطة' : 'Active Wallet'}</span>
                          </div>
                        </div>
                      );
                    })}
                  {customers.length === 0 && (
                    <div className="p-8 text-center text-slate-600 font-bold text-xs uppercase tracking-widest">[ no_customers_matched ]</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* SESSION ACTION MODAL — ENHANCED                   */}
      {/* ══════════════════════════════════════════════════ */}
      {isSessionModalOpen && sessionTargetUser && (
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

      {/* ══════════════════════════════════════════════════ */}
      {/* ADD USER MODAL                                     */}
      {/* ══════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/20 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-800/50 flex justify-between items-center bg-black/40">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2"><Crown className="w-4 h-4 text-[#d4af37]" />{t('إضافة موظف جديد', 'Add New Staff Member')}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]" dir={isAr ? 'rtl' : 'ltr'}>
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الاسم الكامل', 'Full Name')} *</label>
                <input required type="text" value={addFormData.fullName} onChange={e => setAddFormData({...addFormData, fullName: e.target.value})} className="w-full bg-black/50 border border-slate-800 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('اسم المستخدم', 'Username')} *</label>
                  <input required type="text" placeholder="arslan_ops" value={addFormData.username} onChange={e => setAddFormData({...addFormData, username: e.target.value})} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono" dir="ltr" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('رمز PIN', 'Security PIN')}</label>
                  <input type="text" maxLength={4} placeholder="1234" value={addFormData.systemPin} onChange={e => setAddFormData({...addFormData, systemPin: e.target.value})} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-center tracking-widest" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('البريد الإلكتروني', 'Email')} *</label>
                <input required type="email" placeholder="name@company.com" value={addFormData.email} onChange={e => setAddFormData({...addFormData, email: e.target.value})} className="w-full bg-black/50 border border-slate-800 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono" dir="ltr" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('كلمة المرور', 'Password')} *</label>
                <div className="relative">
                  <input required type={showPassword ? 'text' : 'password'} value={addFormData.password} onChange={e => setAddFormData({...addFormData, password: e.target.value})} placeholder="••••••••"
                    className={`w-full bg-black/50 border border-slate-800 rounded-xl py-3 ${isAr ? 'pr-4 pl-10' : 'pl-4 pr-10'} text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono`} dir="ltr" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-500 hover:text-white`}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الدور', 'Role')}</label>
                  <select value={addFormData.role} onChange={e => setAddFormData({...addFormData, role: e.target.value})} className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold">
                    {roles.filter(r => r.id !== 'courier' && r.id !== 'Courier').map(r => <option key={r.id} value={r.id}>{r.title || r.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('نسبة العمولة%', 'Commission%')}</label>
                  <input type="number" min="0" max="100" step="0.1" value={addFormData.commissionRate} onChange={e => setAddFormData({...addFormData, commissionRate: parseFloat(e.target.value) || 0})} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الراتب الشهري', 'Monthly Salary')}</label>
                  <input type="number" min="0" value={addFormData.monthlySalary} onChange={e => setAddFormData({...addFormData, monthlySalary: parseFloat(e.target.value) || 0})} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono" />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800/50">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs">{t('إلغاء', 'Cancel')}</button>
                <button type="submit" disabled={addLoading} className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-50 text-black font-black text-xs rounded-xl shadow-md transition-all">
                  {addLoading ? t('جاري الإنشاء...', 'Creating...') : t('إنشاء الحساب', 'Create Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* EDIT USER MODAL                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/20 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-800/50 flex justify-between items-center bg-black/40">
              <h3 className="font-black text-white text-xs uppercase tracking-widest">{t('تعديل بيانات الموظف', 'Edit Staff Member')}</h3>
              <button onClick={() => { setIsEditModalOpen(false); setSelectedUser(null); }} className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الاسم الكامل', 'Full Name')}</label>
                <input required type="text" value={editFormData.fullName} onChange={e => setEditFormData({...editFormData, fullName: e.target.value})} className="w-full bg-black/50 border border-slate-800 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('اسم المستخدم', 'Username')}</label>
                  <input required type="text" value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono" dir="ltr" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">PIN</label>
                  <input type="text" maxLength={4} value={editFormData.systemPin} onChange={e => setEditFormData({...editFormData, systemPin: e.target.value})} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-center tracking-widest" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الدور', 'Role')}</label>
                  <select disabled={ROOT_EMAILS.includes(selectedUser.email) || selectedUser.isRoot} value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})} className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                    {roles.filter(r => r.id !== 'courier' && r.id !== 'Courier').map(r => <option key={r.id} value={r.id}>{r.title || r.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('عمولة%', 'Commission%')}</label>
                  <input type="number" min="0" max="100" step="0.1" value={editFormData.commissionRate} onChange={e => setEditFormData({...editFormData, commissionRate: parseFloat(e.target.value) || 0})} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('الراتب الشهري', 'Monthly Salary')}</label>
                  <input type="number" min="0" value={editFormData.monthlySalary} onChange={e => setEditFormData({...editFormData, monthlySalary: parseFloat(e.target.value) || 0})} className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono" />
                </div>
              </div>
              {!ROOT_EMAILS.includes(selectedUser.email) && !selectedUser.isRoot && (
                <div className="bg-black/30 border border-slate-800 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setEditFormData({...editFormData, disabled: !editFormData.disabled})}
                      className={`w-11 h-6 rounded-full border transition-all flex items-center relative cursor-pointer ${editFormData.disabled ? 'bg-rose-900/30 border-rose-700/40' : 'bg-slate-800 border-slate-700'}`}>
                      <span className={`w-4 h-4 rounded-full transition-all absolute ${editFormData.disabled ? 'bg-rose-400 right-1' : 'bg-slate-500 left-1'}`}></span>
                    </div>
                    <div>
                      <span className={`block text-xs font-black uppercase ${editFormData.disabled ? 'text-rose-400' : 'text-slate-400'}`}>{editFormData.disabled ? t('الحساب معطَّل', 'Account Disabled') : t('الحساب نشط', 'Account Active')}</span>
                      <span className="block text-[9px] text-slate-600 mt-0.5">{t('يمنع تسجيل الدخول فوراً', 'Instantly prevents login')}</span>
                    </div>
                  </label>
                </div>
              )}
              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800/50">
                <button type="button" onClick={() => { setIsEditModalOpen(false); setSelectedUser(null); }} className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs">{t('إلغاء', 'Cancel')}</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all">{t('حفظ التغييرات', 'Save Changes')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ROLE MODAL                                         */}
      {/* ══════════════════════════════════════════════════ */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/20 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800/50 flex justify-between items-center bg-black/40 shrink-0">
              <h3 className="font-black text-[#d4af37] text-xs uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {selectedRole ? t('تعديل صلاحيات الدور', 'Edit Role Permissions') : t('إنشاء دور جديد', 'Create New Role')}
              </h3>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveRole} className="flex flex-col flex-1 overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('اسم الدور', 'Role Name')} *</label>
                    <input required type="text" placeholder={t('مثل: مشرف المستودع', 'e.g. Warehouse Supervisor')} value={roleFormData.title} onChange={e => setRoleFormData({...roleFormData, title: e.target.value})} className="w-full border border-slate-800 rounded-xl p-3 bg-black/50 text-white focus:border-[#d4af37]/60 outline-none text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{t('المعرّف (بالإنجليزي)', 'ID (English)')} *</label>
                    <input required disabled={!!selectedRole} type="text" placeholder="Warehouse_Supervisor" value={roleFormData.id} onChange={e => setRoleFormData({...roleFormData, id: e.target.value})} className="w-full border border-slate-800 rounded-xl p-3 bg-black/50 text-white focus:border-[#d4af37]/60 outline-none text-xs font-bold font-mono disabled:opacity-40 disabled:cursor-not-allowed" dir="ltr" />
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center flex-wrap gap-2">
                  <button type="button" onClick={() => setRoleFormData(prev => ({ ...prev, permissions: ALL_PERMISSIONS(isAr).map(p => p.id) }))}
                    className="px-3 py-1.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-lg text-[9px] font-black hover:bg-[#d4af37]/20 transition-colors">
                    {t('تحديد الكل', 'Select All')}
                  </button>
                  <button type="button" onClick={() => setRoleFormData(prev => ({ ...prev, permissions: [] }))}
                    className="px-3 py-1.5 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-[9px] font-black hover:bg-slate-800 transition-colors">
                    {t('إلغاء الكل', 'Deselect All')}
                  </button>
                  <div className="flex-1 relative min-w-[140px]">
                    <Search className={`absolute ${isAr ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5`} />
                    <input type="text" placeholder={t('بحث في الصلاحيات...', 'Search permissions...')} value={permSearch} onChange={e => setPermSearch(e.target.value)}
                      className={`w-full ${isAr ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 bg-black/50 border border-slate-800 rounded-lg text-[10px] text-white font-bold outline-none focus:border-[#d4af37]/40`} />
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                    {roleFormData.permissions.length}/{ALL_PERMISSIONS(isAr).length} {t('محدد', 'selected')}
                  </span>
                </div>

                {/* Permission Groups */}
                <div className="space-y-2">
                  {getFilteredPerms().map(group => {
                    const groupPermsIds = group.perms.map(p => p.id);
                    const allChecked = groupPermsIds.every(id => roleFormData.permissions.includes(id));
                    const someChecked = groupPermsIds.some(id => roleFormData.permissions.includes(id));
                    const isExpanded = expandedGroups[group.group] !== false; // default expanded
                    return (
                      <div key={group.group} className="bg-black/30 border border-slate-800/50 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/40 flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedGroups(prev => ({ ...prev, [group.group]: !isExpanded }))}>
                          <div className="flex items-center gap-2">
                            <div onClick={e => { e.stopPropagation(); toggleGroup(group.group, !allChecked); }}
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${allChecked ? 'bg-[#d4af37] border-[#d4af37] text-black' : someChecked ? 'bg-[#d4af37]/30 border-[#d4af37]/50' : 'border-slate-700'}`}>
                              {allChecked && <CheckCircle2 className="w-3 h-3" />}
                              {someChecked && !allChecked && <div className="w-2 h-0.5 bg-[#d4af37]"></div>}
                            </div>
                            <span className="text-[10px] font-black text-slate-300">{group.group}</span>
                            <span className="text-[9px] text-slate-600 font-bold">({group.perms.filter(p => roleFormData.permissions.includes(p.id)).length}/{group.perms.length})</span>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                        {isExpanded && (
                          <div className="grid grid-cols-1 sm:grid-cols-2">
                            {group.perms.map(perm => {
                              const isChecked = roleFormData.permissions.includes(perm.id);
                              return (
                                <label key={perm.id} onClick={() => togglePermission(perm.id)}
                                  className={`flex items-center gap-3 p-3 cursor-pointer transition-all select-none border-b border-slate-800/20 last:border-0 ${isChecked ? 'bg-[#d4af37]/5' : 'bg-black/10 hover:bg-slate-900/30'}`}>
                                  <div className={`w-4.5 h-4.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-[#d4af37] border-[#d4af37] text-black' : 'border-slate-700 hover:border-slate-600'}`}>
                                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold text-white leading-none">{perm.label}</div>
                                    <div className="text-[8px] text-slate-600 font-mono mt-0.5">{perm.id}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-5 border-t border-slate-800/50 bg-black/40 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsRoleModalOpen(false)} className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs">{t('إلغاء', 'Cancel')}</button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition-all active:scale-[0.98] text-xs">
                  {t('حفظ الدور والصلاحيات', 'Save Role & Permissions')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />
    </div>
  );
}
