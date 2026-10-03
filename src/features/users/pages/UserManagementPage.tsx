import React, { useState, useEffect } from 'react';
import { asyncState, runMutation, type AsyncState } from '../../../shared/contracts/ui.contracts';
import {
  collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc,
  query, orderBy, limit, getDocs, where,
  sendPasswordResetEmail,
  db, handleSupabaseError, OperationType,
  initializeApp, deleteApp,
  getAuth, createUserWithEmailAndPassword
} from '../../../data/legacy/legacy-adapter';
import {
  Search, Edit2, X, Plus, UserX, UserCheck, Trash2, Users as UsersIcon,
  Shield, Eye, EyeOff, Crown, ShieldAlert, Activity, Clock,
  CheckCircle2, LogOut, Key, MonitorCheck, FileClock,
  Zap, AlertTriangle, Timer, Ban, WifiOff, Lock, Unlock,
  UserMinus, RefreshCw, ChevronDown, ChevronRight, Info,
  Coins, Truck
} from 'lucide-react';
import { useRole } from '../../../hooks/useRole';
import { useAuthSession } from '../../../features/auth/AuthSessionProvider';
import { useSettings } from '../../../context/SettingsContext';
import { notificationService } from '../../../services/notificationService';
import { activityLogService, type ActivityAction } from '../../../services/activityLogService';
import ConfirmModal from '../../../components/ConfirmModal';
import ConfirmDeletePinModal from '../../../components/ConfirmDeletePinModal';
import { financialAccountService } from '../../../services/financialAccountService';
import { DEFAULT_ROLE_PERMISSIONS } from '../../../lib/permissions';
import { useAccountBalances } from '../../../hooks/useAccountBalances';
import { AddUserModal } from '../components/AddUserModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { EditUserModal } from '../components/EditUserModal';
import { RoleFormModal } from '../components/RoleFormModal';
import { SessionActionModal } from './tabs/SessionActionModal';
import { UserManagementTabContent } from './tabs/UserManagementTabContent';

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
    group: isAr ? '📦 الطلبات والتتبع' : '📦 Orders & Tracking',
    perms: [
      { id: 'view_orders', label: isAr ? 'عرض قائمة الطلبات' : 'View Orders List' },
      { id: 'track_order', label: isAr ? 'تتبع الطلبات' : 'Access Live Order Tracking' },
      { id: 'add_orders', label: isAr ? 'إضافة الطلبات' : 'Add Orders' },
      { id: 'edit_orders', label: isAr ? 'تعديل الطلبات' : 'Edit Orders' },
      { id: 'update_order_status', label: isAr ? 'تحديث حالة الطلب فقط' : 'Update Order Status Only' },
      { id: 'delete_orders', label: isAr ? 'حذف الطلبات' : 'Delete Orders' },
      { id: 'edit_delivered_orders', label: isAr ? 'تعديل الطلبات بعد التسليم' : 'Edit Orders After Delivery' },
      { id: 'print_orders', label: isAr ? 'طباعة وتصدير الفواتير' : 'Print & Export Invoices' },
      { id: 'export_orders', label: isAr ? 'تصدير بيانات الطلبات' : 'Export Orders Data' },
      { id: 'edit_order_defaults_creation', label: isAr ? 'تعديل الأسعار الافتراضية عند إنشاء طلب' : 'Edit Default Prices When Creating Order' },
      { id: 'unpost_posted_orders', label: isAr ? 'الغاء ترحيل الطلبات المرحله' : 'Unpost Posted Orders' },
    ]

  },
  {
    group: isAr ? '⚙️ مراحل وحالات الطلب' : '⚙️ Order Status Stages',
    perms: [
      { id: 'view_order_statuses', label: isAr ? 'استعراض مراحل الطلب' : 'View Order Status Stages' },
      { id: 'add_order_statuses', label: isAr ? 'إضافة مرحلة طلب جديدة' : 'Add New Order Status Stage' },
      { id: 'edit_order_statuses', label: isAr ? 'تعديل مراحل الطلب' : 'Edit Order Status Stages' },
      { id: 'delete_order_statuses', label: isAr ? 'حذف مراحل الطلب' : 'Delete Order Status Stage' },
    ]
  },
  {
    group: isAr ? '⚡ القيود التلقائية' : '⚡ Auto Entry Rules',
    perms: [
      { id: 'view_auto_entries', label: isAr ? 'عرض القيود التلقائية' : 'View Auto Entry Rules' },
      { id: 'add_auto_entries', label: isAr ? 'إضافة قيد تلقائي' : 'Add Auto Entry Rule' },
      { id: 'edit_auto_entries', label: isAr ? 'تعديل القيود التلقائية' : 'Edit Auto Entry Rules' },
      { id: 'delete_auto_entries', label: isAr ? 'حذف قيد تلقائي' : 'Delete Auto Entry Rule' },
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
    group: isAr ? '💰 المالية العامة والحسابات' : '💰 General Finance & Accounts',
    perms: [
      { id: 'view_finance', label: isAr ? 'عرض البيانات المالية العامة' : 'View General Financial Data' },
      { id: 'add_finance', label: isAr ? 'إضافة المدفوعات والعمليات المالية' : 'Add Payments & Finance' },
      { id: 'edit_finance', label: isAr ? 'تعديل المدفوعات والعمليات المالية' : 'Edit Payments & Finance' },
      { id: 'view_expenses', label: isAr ? 'رؤية المصروفات والتكاليف' : 'View Expenses & Costs' },
      { id: 'add_expenses', label: isAr ? 'إضافة المصروفات' : 'Add Expenses' },
      { id: 'edit_expenses', label: isAr ? 'تعديل المصروفات وتسوية العهد' : 'Edit Expenses & Reconcile' },
      { id: 'delete_expenses', label: isAr ? 'حذف المصروفات' : 'Delete Expenses' },
      { id: 'edit_exchange_rates', label: isAr ? 'تعديل أسعار الصرف' : 'Edit Exchange Rates' },
      { id: 'view_financial_accounts', label: isAr ? 'عرض أرصدة وكشوفات الحسابات المالية' : 'View Financial Account Balances & Statements' },
      { id: 'manage_financial_accounts', label: isAr ? 'إدارة وتعديل أرصدة الحسابات المالية' : 'Manage Financial Account Balances & Adjustments' },
      { id: 'view_account_movements', label: isAr ? 'استعراض حركة الحسابات' : 'View Account Movements' },
      { id: 'print_account_movements', label: isAr ? 'طباعة حركة الحسابات' : 'Print Account Movements' },
      { id: 'export_account_movements', label: isAr ? 'تصدير حركة الحسابات (CSV/XLS)' : 'Export Account Movements' },
      { id: 'view_custody_advances', label: isAr ? 'عرض سجل العهد والسلف' : 'View Custody Advances' },
      { id: 'create_custody_advances', label: isAr ? 'إنشاء عهدة/سلفة جديدة' : 'Create Custody Advance' },
      { id: 'settle_custody_advances', label: isAr ? 'تسوية العهد والسلف' : 'Settle Custody Advances' },
    ]
  },
  {
    group: isAr ? '📖 القيود العامة والمركبة والمؤقتة' : '📖 General, Compound & Temp Entries',
    perms: [
      // القيود العامة
      { id: 'view_general_entries', label: isAr ? 'استعراض القيود العامة' : 'View General Entries' },
      { id: 'create_general_entries', label: isAr ? 'إنشاء قيد عام جديد' : 'Create General Entry' },
      { id: 'edit_general_entries', label: isAr ? 'تعديل مسودات القيود العامة' : 'Edit General Entry Drafts' },
      { id: 'delete_general_entries', label: isAr ? 'حذف مسودات القيود العامة' : 'Delete General Entry Drafts' },
      { id: 'post_general_entries', label: isAr ? 'ترحيل واعتماد القيود العامة' : 'Post General Entries' },
      { id: 'print_general_entries', label: isAr ? 'طباعة القيود العامة' : 'Print General Entries' },
      { id: 'export_general_entries', label: isAr ? 'تصدير القيود العامة (CSV/XLS)' : 'Export General Entries' },
      { id: 'edit_posted_general_entries', label: isAr ? 'تعديل القيود العامة المرحّلة (صلاحية خاصة)' : 'Edit Posted General Entries' },
      { id: 'delete_posted_general_entries', label: isAr ? 'حذف القيود العامة المرحّلة (صلاحية خاصة)' : 'Delete Posted General Entries' },

      // القيود المركبة
      { id: 'view_compound_entries', label: isAr ? 'استعراض القيود المركبة' : 'View Compound Entries' },
      { id: 'create_compound_entries', label: isAr ? 'إنشاء قيد مركب جديد' : 'Create Compound Entry' },
      { id: 'edit_compound_entries', label: isAr ? 'تعديل مسودات القيود المركبة' : 'Edit Compound Entry Drafts' },
      { id: 'delete_compound_entries', label: isAr ? 'حذف مسودات القيود المركبة' : 'Delete Compound Entry Drafts' },
      { id: 'post_compound_entries', label: isAr ? 'ترحيل واعتماد القيود المركبة' : 'Post Compound Entries' },
      { id: 'print_compound_entries', label: isAr ? 'طباعة القيود المركبة' : 'Print Compound Entries' },
      { id: 'export_compound_entries', label: isAr ? 'تصدير القيود المركبة (CSV/XLS)' : 'Export Compound Entries' },
      { id: 'edit_posted_compound_entries', label: isAr ? 'تعديل القيود المركبة المرحّلة (صلاحية خاصة)' : 'Edit Posted Compound Entries' },
      { id: 'delete_posted_compound_entries', label: isAr ? 'حذف القيود المركبة المرحّلة (صلاحية خاصة)' : 'Delete Posted Compound Entries' },

      // القيود المؤقتة
      { id: 'view_temporary_entries', label: isAr ? 'استعراض القيود المؤقتة' : 'View Temporary Entries' },
      { id: 'create_temporary_entries', label: isAr ? 'إنشاء قيد مؤقت جديد' : 'Create Temporary Entry' },
      { id: 'edit_temporary_entries', label: isAr ? 'تعديل القيود المؤقتة' : 'Edit Temporary Entries' },
      { id: 'delete_temporary_entries', label: isAr ? 'حذف القيود المؤقتة' : 'Delete Temporary Entries' },
      { id: 'post_temporary_entries', label: isAr ? 'ترحيل واعتماد القيود المؤقتة' : 'Post Temporary Entries' },
      { id: 'print_temporary_entries', label: isAr ? 'طباعة القيود المؤقتة' : 'Print Temporary Entries' },
      { id: 'export_temporary_entries', label: isAr ? 'تصدير القيود المؤقتة (CSV/XLS)' : 'Export Temporary Entries' },
      { id: 'edit_posted_temporary_entries', label: isAr ? 'تعديل القيود المؤقتة المرحّلة (صلاحية خاصة)' : 'Edit Posted Temporary Entries' },
      { id: 'delete_posted_temporary_entries', label: isAr ? 'حذف القيود المؤقتة المرحّلة (صلاحية خاصة)' : 'Delete Posted Temporary Entries' },

      // عمليات حساسة
      { id: 'reverse_financial_entries', label: isAr ? 'إنشاء قيود عكسية' : 'Create Reversing Entries' },
      { id: 'void_financial_entries', label: isAr ? 'إبطال القيود المرحّلة' : 'Void Posted Financial Entries' },
    ]
  },
  {
    group: isAr ? '🧾 سندات القبض والصرف' : '🧾 Receipt & Payment Vouchers',
    perms: [
      // سندات القبض
      { id: 'view_receipt_vouchers', label: isAr ? 'استعراض سندات القبض' : 'View Receipt Vouchers' },
      { id: 'create_receipt_vouchers', label: isAr ? 'إنشاء سند قبض جديد (نقدي/بنكي/متعدد)' : 'Create Receipt Voucher' },
      { id: 'edit_receipt_vouchers', label: isAr ? 'تعديل مسودات سندات القبض' : 'Edit Receipt Voucher Drafts' },
      { id: 'delete_receipt_vouchers', label: isAr ? 'حذف مسودات سندات القبض' : 'Delete Receipt Voucher Drafts' },
      { id: 'post_receipt_vouchers', label: isAr ? 'ترحيل واعتماد سندات القبض' : 'Post Receipt Vouchers' },
      { id: 'print_receipt_vouchers', label: isAr ? 'طباعة سندات القبض' : 'Print Receipt Vouchers' },
      { id: 'export_receipt_vouchers', label: isAr ? 'تصدير سندات القبض (CSV/XLS)' : 'Export Receipt Vouchers' },
      { id: 'edit_posted_receipt_vouchers', label: isAr ? 'تعديل سندات القبض المرحّلة (صلاحية خاصة)' : 'Edit Posted Receipt Vouchers' },
      { id: 'delete_posted_receipt_vouchers', label: isAr ? 'حذف سندات القبض المرحّلة (صلاحية خاصة)' : 'Delete Posted Receipt Vouchers' },

      // سندات الصرف
      { id: 'view_payment_vouchers', label: isAr ? 'استعراض سندات الصرف' : 'View Payment Vouchers' },
      { id: 'create_payment_vouchers', label: isAr ? 'إنشاء سند صرف جديد (نقدي/بنكي/متعدد)' : 'Create Payment Voucher' },
      { id: 'edit_payment_vouchers', label: isAr ? 'تعديل مسودات سندات الصرف' : 'Edit Payment Voucher Drafts' },
      { id: 'delete_payment_vouchers', label: isAr ? 'حذف مسودات سندات الصرف' : 'Delete Payment Voucher Drafts' },
      { id: 'post_payment_vouchers', label: isAr ? 'ترحيل واعتماد سندات الصرف' : 'Post Payment Vouchers' },
      { id: 'print_payment_vouchers', label: isAr ? 'طباعة سندات الصرف' : 'Print Payment Vouchers' },
      { id: 'export_payment_vouchers', label: isAr ? 'تصدير سندات الصرف (CSV/XLS)' : 'Export Payment Vouchers' },
      { id: 'edit_posted_payment_vouchers', label: isAr ? 'تعديل سندات الصرف المرحّلة (صلاحية خاصة)' : 'Edit Posted Payment Vouchers' },
      { id: 'delete_posted_payment_vouchers', label: isAr ? 'حذف سندات الصرف المرحّلة (صلاحية خاصة)' : 'Delete Posted Payment Vouchers' },
    ]
  },
  {
    group: isAr ? '⚙️ إعدادات وأنواع القيود' : '⚙️ Entry Settings & Types',
    perms: [
      { id: 'view_entry_settings', label: isAr ? 'استعراض فئات وأنواع وقواعد القيود' : 'View Entry Settings & Types' },
      { id: 'create_entry_settings', label: isAr ? 'إنشاء فئة أو نوع قيد جديد' : 'Create Entry Settings & Types' },
      { id: 'edit_entry_settings', label: isAr ? 'تعديل فئات وأنواع وقواعد القيود' : 'Edit Entry Settings & Types' },
      { id: 'delete_entry_settings', label: isAr ? 'حذف فئة أو نوع قيد' : 'Delete Entry Settings & Types' },
    ]
  },
  {
    group: isAr ? '📊 التقارير' : '📊 Reports',
    perms: [
      { id: 'view_reports', label: isAr ? 'عرض التقارير المالية' : 'View Financial Reports' },
    ]
  },
  {
    group: isAr ? '\U0001f5fa\ufe0f مصادر الشراء والتوريد' : '\U0001f5fa\ufe0f Purchase & Supply Sources',
    perms: [
      { id: 'view_sources', label: isAr ? 'عرض مصادر الشراء (تطبيقات ومصانع)' : 'View Purchase Sources (Apps & Factories)' },
      { id: 'add_sources', label: isAr ? 'إضافة مصدر شراء جديد' : 'Add New Purchase Source' },
      { id: 'edit_sources', label: isAr ? 'تعديل بيانات مصدر الشراء' : 'Edit Purchase Source' },
      { id: 'delete_sources', label: isAr ? 'حذف مصدر الشراء' : 'Delete Purchase Source' },
    ]
  },
  {
    group: isAr ? '\U0001f69b شركات الشحن والنقل' : '\U0001f69b Shipping Companies & Carriers',
    perms: [
      { id: 'view_shipping_companies', label: isAr ? 'عرض قائمة شركات الشحن والناقلين' : 'View Shipping Companies & Carriers' },
      { id: 'add_shipping_companies', label: isAr ? 'إضافة شركة شحن جديدة' : 'Add New Shipping Company' },
      { id: 'edit_shipping_companies', label: isAr ? 'تعديل بيانات شركة الشحن' : 'Edit Shipping Company' },
      { id: 'delete_shipping_companies', label: isAr ? 'حذف شركة شحن من السجل' : 'Delete Shipping Company' },
    ]
  },
  {
    group: isAr ? '🔔 الإشعارات' : '🔔 Notifications',
    perms: [
      { id: 'view_notifications', label: isAr ? 'عرض صفحة الإشعارات' : 'View Notifications' },
      { id: 'send_notifications', label: isAr ? 'إرسال إشعارات مخصصة وتجريبية' : 'Send Custom Notifications' },
      { id: 'manage_notifications', label: isAr ? 'إدارة وحذف الإشعارات' : 'Manage & Delete Notifications' },
      { id: 'view_edit_notification_settings', label: isAr ? 'عرض وتعديل إعدادات الإشعارات (قوالب WhatsApp)' : 'View & Edit Notification Settings (WhatsApp Templates)' },
      { id: 'notify_orders', label: isAr ? 'استقبال إشعارات الطلبات' : 'Receive Order Notifications' },
      { id: 'notify_finance', label: isAr ? 'استقبال إشعارات المالية' : 'Receive Finance Notifications' },
      { id: 'notify_system', label: isAr ? 'استقبال إشعارات النظام والأمان' : 'Receive System & Security Notifications' },
    ]
  },
  {
    group: isAr ? '\U0001f9d1\u200d\U0001f4bc سجل الموظفين' : '\U0001f9d1\u200d\U0001f4bc Employees Ledger',
    perms: [
      { id: 'view_employees', label: isAr ? 'عرض سجل الموظفين والرواتب' : 'View Employees & Salaries' },
      { id: 'add_employees', label: isAr ? 'إضافة موظف جديد وإنشاء حسابه' : 'Enroll New Employee & Ledger' },
      { id: 'edit_employees', label: isAr ? 'تعديل بيانات الموظف والراتب' : 'Edit Employee Details & Salary' },
      { id: 'delete_employees', label: isAr ? 'حذف الموظف وحسابه المالي' : 'Delete Employee & Financial Account' },
    ]
  },
  {
    group: isAr ? '\U0001f464 مستخدمو النظام' : '\U0001f464 System Users (Dashboard Accounts)',
    perms: [
      { id: 'view_users', label: isAr ? 'عرض قائمة مستخدمي لوحة التحكم' : 'View Dashboard User Accounts' },
      { id: 'add_users', label: isAr ? 'إنشاء حساب مستخدم جديد' : 'Create New Dashboard User' },
      { id: 'edit_users', label: isAr ? 'تعديل دور ومعلومات المستخدم' : 'Edit User Role & Info' },
      { id: 'delete_users', label: isAr ? 'حذف حساب مستخدم من النظام' : 'Delete Dashboard User Account' },
      { id: 'reset_passwords', label: isAr ? 'إعادة تعيين كلمة مرور المستخدم' : 'Reset User Password' },
      { id: 'disable_accounts', label: isAr ? 'تعطيل أو تفعيل حساب مستخدم' : 'Disable & Enable User Account' },
      { id: 'terminate_sessions', label: isAr ? 'إنهاء جلسة مستخدم إجباراً' : 'Force Terminate User Session' },
      { id: 'view_activity_log', label: isAr ? 'عرض سجل النشاط والمراجعة' : 'View Full Activity & Audit Log' },
    ]
  },
  {
    group: isAr ? '\U0001f6e1\ufe0f الأدوار والصلاحيات' : '\U0001f6e1\ufe0f Roles & Permissions',
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
      { id: 'edit_interface_settings', label: isAr ? 'إدارة التنسيق والواجهات واللغة' : 'Configure Themes & Locale' },
      { id: 'edit_general_settings', label: isAr ? 'تعديل الإعدادات العامة للنظام' : 'Edit General Settings' },
      { id: 'edit_company_info', label: isAr ? 'تعديل معلومات الشركة' : 'Edit Company Information' },
      { id: 'view_order_defaults', label: isAr ? 'عرض الإعدادات الافتراضية للطلبات' : 'View Default Order Settings' },
      { id: 'edit_order_defaults', label: isAr ? 'تعديل الإعدادات الافتراضية للطلبات' : 'Edit Default Order Settings' },
      { id: 'manage_whatsapp', label: isAr ? 'إعدادات واتساب والتنبيهات (قديم)' : 'WhatsApp & Alert Settings (Legacy)' },
      { id: 'manage_backup', label: isAr ? 'إدارة النسخ الاحتياطية' : 'Manage Backups' },
    ]
  },
];

// Flat permissions list for checking
const ALL_PERMISSIONS = (isAr: boolean) =>
  PERMISSION_GROUPS(isAr).flatMap(g => g.perms);

const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'engaporaad1@gmail.com', 'admin@swiftship.system', 'apo.1.read@gmail.com'];

// ══════════════════════════════════════════════════════════════
// ACTION LABEL MAPPING
// ══════════════════════════════════════════════════════════════
const getActionMeta = (action: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string; color: string; icon: string }> = {
    login: { ar: 'تسجيل دخول', en: 'Login', color: 'emerald', icon: '🔓' },
    logout: { ar: 'تسجيل خروج', en: 'Logout', color: 'slate', icon: '🔒' },
    add_user: { ar: 'إضافة موظف', en: 'Add User', color: 'cyan', icon: '➕' },
    edit_user: { ar: 'تعديل موظف', en: 'Edit User', color: 'blue', icon: '✏️' },
    disable_user: { ar: 'تعطيل حساب', en: 'Disable Account', color: 'rose', icon: '🚫' },
    enable_user: { ar: 'تفعيل حساب', en: 'Enable Account', color: 'emerald', icon: '✅' },
    delete_user: { ar: 'حذف موظف', en: 'Delete User', color: 'rose', icon: '🗑️' },
    reset_password: { ar: 'إعادة تعيين كلمة المرور', en: 'Reset Password', color: 'amber', icon: '🔑' },
    terminate_session: { ar: 'إنهاء جلسة', en: 'Terminate Session', color: 'rose', icon: '⛔' },
    force_logout: { ar: 'إنهاء قسري للجلسة', en: 'Force Logout', color: 'rose', icon: '⚡' },
    temp_ban: { ar: 'حظر مؤقت', en: 'Temporary Ban', color: 'orange', icon: '⏳' },
    edit_role: { ar: 'تعديل دور', en: 'Edit Role', color: 'purple', icon: '🛡️' },
    add_role: { ar: 'إضافة دور', en: 'Add Role', color: 'purple', icon: '➕' },
    delete_role: { ar: 'حذف دور', en: 'Delete Role', color: 'rose', icon: '🗑️' },
    delete_order: { ar: 'حذف طلب', en: 'Delete Order', color: 'rose', icon: '📦' },
    edit_delivered_order: { ar: 'تعديل طلب مُسلَّم', en: 'Edit Delivered Order', color: 'amber', icon: '📝' },
    change_exchange_rate: { ar: 'تغيير سعر الصرف', en: 'Change Exchange Rate', color: 'amber', icon: '💱' },
    add_expense: { ar: 'إضافة مصروف', en: 'Add Expense', color: 'orange', icon: '💸' },
    delete_expense: { ar: 'حذف مصروف', en: 'Delete Expense', color: 'rose', icon: '🗑️' },
    edit_order: { ar: 'تعديل طلب', en: 'Edit Order', color: 'blue', icon: '✏️' },
    add_order: { ar: 'إضافة طلب', en: 'Add Order', color: 'cyan', icon: '➕' },
    add_customer: { ar: 'إضافة عميل', en: 'Add Customer', color: 'cyan', icon: '👤' },
    edit_customer: { ar: 'تعديل عميل', en: 'Edit Customer', color: 'blue', icon: '✏️' },
    delete_customer: { ar: 'حذف عميل', en: 'Delete Customer', color: 'rose', icon: '🗑️' },
  };
  const e = map[action];
  if (!e) return { label: action, color: 'slate', icon: '📌' };
  return { label: isAr ? e.ar : e.en, color: e.color, icon: e.icon };
};

// ══════════════════════════════════════════════════════════════
// SESSION TERMINATION OPTIONS
// ══════════════════════════════════════════════════════════════
type SessionAction = 'force_logout' | 'disable_account' | 'temp_ban_1h' | 'temp_ban_24h' | 'temp_ban_72h';
type TabId = 'users' | 'roles' | 'sessions' | 'activity';
type DataRecord = Record<string, unknown>;
type SnapshotDoc = { id: string; data: () => DataRecord };
type SnapshotResult = { docs: SnapshotDoc[] };
type TimestampValue = number | string | { toDate: () => Date };
type ManagedUser = DataRecord & {
  id: string; fullName: string; email: string; username: string; role: string;
  roleId?: string; disabled: boolean; isRoot?: boolean; lastSeen?: number;
  tempBanUntil?: number | null; createdAt?: number; linkedType?: string | null;
  linkedEntity?: string | null; systemPin?: string; financialAccountId?: string | null;
  accountId?: string | null; financialAccountCode?: string | null;
  financialBalance?: number; financialCurrency?: string;
};
type RoleRecord = DataRecord & { id: string; title: string; permissions: string[] };
type EntityRecord = DataRecord & { id: string; fullName: string };
type AccountRecord = DataRecord & { id: string; entityId?: string; accountCode?: string; balance?: number; currency?: string };
type SessionRecord = DataRecord & { id: string; fullName: string; email: string; role: string; deviceInfo: string; lastSeen: number; last_seen: number };
type ActivityRecord = { id: string; action: string; userId?: string; userName?: string; userRole?: string; target?: string; details?: Record<string, unknown>; timestamp?: TimestampValue };
type ErrorLike = { message?: string; code?: string };

const asRecord = (value: unknown): DataRecord =>
  typeof value === 'object' && value !== null ? value as DataRecord : {};
const asString = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const asNumber = (value: unknown, fallback = 0): number => typeof value === 'number' ? value : fallback;
const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : asString(asRecord(error).message, 'Operation failed');
const toUser = (id: string, raw: DataRecord): ManagedUser => ({
  ...raw, id, fullName: asString(raw.fullName, 'User'), email: asString(raw.email),
  username: asString(raw.username), role: asString(raw.role, asString(raw.roleId, 'Employee')),
  roleId: typeof raw.roleId === 'string' ? raw.roleId : undefined,
  disabled: raw.disabled === true, isRoot: raw.isRoot === true,
  lastSeen: typeof raw.lastSeen === 'number' ? raw.lastSeen : undefined,
  tempBanUntil: typeof raw.tempBanUntil === 'number' ? raw.tempBanUntil : null,
  createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : undefined,
});
const toRole = (id: string, raw: DataRecord): RoleRecord => ({
  ...raw, id, title: asString(raw.title, id),
  permissions: Array.isArray(raw.permissions) ? raw.permissions.filter((permission): permission is string => typeof permission === 'string') : [],
});
const toEntity = (id: string, raw: DataRecord): EntityRecord => ({ ...raw, id, fullName: asString(raw.fullName, id) });
const toAccount = (id: string, raw: DataRecord): AccountRecord => ({ ...raw, id,
  entityId: typeof raw.entityId === 'string' ? raw.entityId : undefined,
  accountCode: typeof raw.accountCode === 'string' ? raw.accountCode : undefined,
  balance: typeof raw.balance === 'number' ? raw.balance : undefined,
  currency: typeof raw.currency === 'string' ? raw.currency : undefined,
});

const SESSION_ACTIONS = (isAr: boolean): { id: SessionAction; label: string; desc: string; icon: React.ComponentType; color: string; severity: string }[] => [
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
export default function UserManagementPage() {
  const { user: currentUser } = useAuthSession();
  const { settings } = useSettings();
  const { role, hasPermission, profile: currentUserDoc, loading: roleLoading, sessionId } = useRole();
  const isAr = settings.language === 'ar';
  const t = (ar: string, en: string) => isAr ? ar : en;

  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [roleActiveTab, setRoleActiveTab] = useState<string>('all');

  // ── Data ─────────────────────────────────────────────────
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);  // financial accounts for employees
  const [employeesList, setEmployeesList] = useState<EntityRecord[]>([]);
  const [couriersList, setCouriersList] = useState<EntityRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityRecord[]>([]);
  const [queryState, setQueryState] = useState<AsyncState<ManagedUser[]>>(asyncState.loading());
  const loading = queryState.status === 'loading';

  // ── Live transaction-based balances (real-time from account_trans) ────
  const liveBalances = useAccountBalances();

  // ── Users filters ────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPassword, setShowPassword] = useState(false);

  // ── Modals ───────────────────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionTargetUser, setSessionTargetUser] = useState<ManagedUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [addState, setAddState] = useState<AsyncState<void>>(asyncState.idle());
  const [editState, setEditState] = useState<AsyncState<void>>(asyncState.idle());
  const [roleState, setRoleState] = useState<AsyncState<void>>(asyncState.idle());
  const addLoading = addState.status === 'submitting';
  const editLoading = editState.status === 'submitting';
  const savingRole = roleState.status === 'submitting';
  const setAddLoading = (value: boolean) => setAddState(value ? asyncState.submitting() : asyncState.idle());
  const setEditLoading = (value: boolean) => setEditState(value ? asyncState.submitting() : asyncState.idle());
  const setSavingRole = (value: boolean) => setRoleState(value ? asyncState.submitting() : asyncState.idle());
  const addBlockRef = React.useRef(false);
  const editBlockRef = React.useRef(false);
  const roleBlockRef = React.useRef(false);

  // -- Multidevice Sessions --
  const [dbSessions, setDbSessions] = useState<SessionRecord[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 15000); // Trigger re-render to update relative time ("2 mins ago") & status dots
    return () => clearInterval(interval);
  }, []);

  // -- Direct Password Change --
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<ManagedUser | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [passwordState, setPasswordState] = useState<AsyncState<void>>(asyncState.idle());
  const passwordLoading = passwordState.status === 'submitting';
  const setPasswordLoading = (value: boolean) => setPasswordState(value ? asyncState.submitting() : asyncState.idle());

  // ── Forms ────────────────────────────────────────────────
  const [editFormData, setEditFormData] = useState({
    fullName: '', role: '', disabled: false, username: '', systemPin: '',
    linkedType: 'none', linkedEntity: ''
  });
  const [addFormData, setAddFormData] = useState({
    fullName: '', username: '', email: '', password: '', systemPin: '', role: 'Employee',
    linkedType: 'none', linkedEntity: ''
  });

  // Listen to Employees and Couriers for dynamic user linking
  useEffect(() => {
    if (roleLoading) return;
    const unsubEmp = onSnapshot(collection(db, 'employees'), (snap: SnapshotResult) => {
      setEmployeesList(snap.docs.map(d => toEntity(d.id, d.data())));
    });
    const unsubCour = onSnapshot(collection(db, 'couriers'), (snap: SnapshotResult) => {
      setCouriersList(snap.docs.map(d => toEntity(d.id, d.data())));
    });
    return () => { unsubEmp(); unsubCour(); };
  }, [roleLoading]);

  // ── Roles ────────────────────────────────────────────────
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleRecord | null>(null);
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
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger' });

  const [deletePinConfig, setDeletePinConfig] = useState({
    isOpen: false,
    entityId: '',
    entityName: ''
  });

  // ══════════════════════════════════════════════════════════
  // DATA FETCHING
  // ══════════════════════════════════════════════════════════
  useEffect(() => {
    if (roleLoading) return;
    const unsubRoles = onSnapshot(collection(db, 'roles'), (snap: SnapshotResult) => {
      const fetchedRoles = snap.docs.map(d => toRole(d.id, d.data()));
      setRoles(fetchedRoles);
    }, err => {
      console.error("[UserManagement] Error listening to roles:", err);
    });
    return () => unsubRoles();
  }, [roleLoading]);

  // Auto-initialize default roles
  useEffect(() => {
    if (roleLoading) return;
    const initRoles = async () => {
      try {
        const snap = await getDocs(collection(db, 'roles'));
        const fetchedRoles = snap.docs.map(d => toRole(d.id, d.data()));

        const defaultRoles = [
          { id: 'Admin', title: isAr ? 'مدير النظام' : 'System Admin', permissions: ['*'] },
          { id: 'Employee', title: isAr ? 'موظف' : 'Employee', permissions: DEFAULT_ROLE_PERMISSIONS['Employee'] || [] },
          { id: 'Courier', title: isAr ? 'مندوب' : 'Courier', permissions: DEFAULT_ROLE_PERMISSIONS['Courier'] || [] },
          { id: 'Accountant', title: isAr ? 'محاسب' : 'Accountant', permissions: DEFAULT_ROLE_PERMISSIONS['Accountant'] || [] }
        ];

        for (const dr of defaultRoles) {
          if (!fetchedRoles.find(r => r.id === dr.id)) {
            try {
              await setDoc(doc(db, 'roles', dr.id), {
                title: dr.title,
                permissions: dr.permissions,
                createdAt: Date.now(),
                isDefault: true
              }, { merge: true });
            } catch (err) {
              console.warn(`[UserManagement] Failed to auto-initialize role ${dr.id}:`, err);
            }
          }
        }
      } catch (err) {
        console.warn("[UserManagement] Failed to fetch roles for initialization:", err);
      }
    };
    initRoles();
  }, [roleLoading, isAr]);

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'sessions'), (snap: SnapshotResult) => {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const all = snap.docs.map(d => {
        const rawData = d.data();
        const parsedPayload: unknown = typeof rawData.data === 'string' ? JSON.parse(rawData.data) : rawData.data;
        const payload = asRecord(parsedPayload);

        const rawLastSeen = rawData.last_seen || rawData.lastSeen || payload.last_seen_at || payload.last_seen;
        let lastSeenMs = 0;
        if (typeof rawLastSeen === 'number') lastSeenMs = rawLastSeen;
        else if (typeof rawLastSeen === 'string') {
          const parsed = Date.parse(rawLastSeen);
          if (!isNaN(parsed)) lastSeenMs = parsed;
        }

        const rawEmail = asString(payload.email, asString(rawData.email));
        const fullName = asString(payload.full_name, asString(payload.fullName, asString(rawData.fullName, asString(rawData.full_name, rawEmail ? rawEmail.split('@')[0] : 'User'))));
        const email = rawEmail;
        const role = asString(payload.role, asString(rawData.role, 'Employee'));
        const deviceInfo = asString(payload.device_info, asString(payload.deviceInfo, asString(rawData.deviceInfo, asString(rawData.device_info, 'Unknown'))));

        return {
          id: d.id,
          ...rawData,
          ...payload,
          fullName,
          email,
          role,
          deviceInfo,
          lastSeen: lastSeenMs,
          last_seen: lastSeenMs,
        };
      });

      setDbSessions(all.filter((session): session is SessionRecord => session.lastSeen > 0 ? session.lastSeen > twentyFourHoursAgo : true));
    }, err => console.error("Error fetching sessions:", err));
    return unsub;
  }, [roleLoading]);

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'users'), (snap: SnapshotResult) => {
      const all = snap.docs.map(d => toUser(d.id, d.data()));
      const visibleUsers = all.filter(u => u.role !== 'Courier' && u.roleId !== 'courier' && u.role !== 'courier');
      setUsers(visibleUsers);
      setQueryState(visibleUsers.length ? asyncState.success(visibleUsers) : asyncState.empty());
    }, err => handleSupabaseError(err, OperationType.LIST, 'users'));
    return unsub;
  }, [roleLoading]);

  // ── Subscribe to financial accounts (for employee balance display) ────────────
  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'accounts'), (snap: SnapshotResult) => {
      setAccounts(snap.docs.map(d => toAccount(d.id, d.data())));
    }, (err: unknown) => console.warn('[UserManagement] Could not load accounts:', err));
    return () => unsub();
  }, [roleLoading]);

  useEffect(() => {
    if (roleLoading || !hasPermission('view_activity_log')) return;
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(200));
    const unsub = onSnapshot(q, (snap: SnapshotResult) =>
      setActivityLogs(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          action: asString(data.action),
          userId: typeof data.userId === 'string' ? data.userId : undefined,
          userName: typeof data.userName === 'string' ? data.userName : undefined,
          userRole: typeof data.userRole === 'string' ? data.userRole : undefined,
          target: typeof data.target === 'string' ? data.target : undefined,
          details: asRecord(data.details),
          timestamp: typeof data.timestamp === 'number' || typeof data.timestamp === 'string' || (typeof data.timestamp === 'object' && data.timestamp !== null && 'toDate' in data.timestamp && typeof data.timestamp.toDate === 'function') ? data.timestamp as TimestampValue : undefined,
        };
      }))
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
  const handleOpenEdit = (user: ManagedUser) => {
    setSelectedUser(user);
    setEditFormData({
      fullName: user.fullName || '', username: user.username || '',
      role: user.role || 'Employee', disabled: user.disabled || false,
      systemPin: user.systemPin || '',
      linkedType: user.linkedType || (user.linkedEntity ? 'employee' : 'none'),
      linkedEntity: user.linkedEntity || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editLoading || editBlockRef.current) return;
    if (!selectedUser) return;
    editBlockRef.current = true;
    setEditLoading(true);
    if (editFormData.username && editFormData.username !== selectedUser.username) {
      const q = query(collection(db, 'users'), where('username', '==', editFormData.username));
      const snap = await getDocs(q);
      if (!snap.empty && snap.docs[0].id !== selectedUser.id) {
        setEditLoading(false);
        editBlockRef.current = false;
        return notificationService.notify({ title: t('خطأ', 'Error'), message: t('اسم المستخدم مستخدم مسبقاً', 'Username already taken'), type: 'error', category: 'system' });
      }
    }
    const isRoot = ROOT_EMAILS.includes(selectedUser.email) || selectedUser.isRoot;
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        fullName: editFormData.fullName, username: editFormData.username,
        role: isRoot ? 'Admin' : editFormData.role,
        disabled: isRoot ? false : editFormData.disabled,
        systemPin: editFormData.systemPin,
        linkedType: editFormData.linkedType !== 'none' ? editFormData.linkedType : null,
        linkedEntity: editFormData.linkedType !== 'none' ? editFormData.linkedEntity : null,
        updatedAt: Date.now()
      });
      await activityLogService.log('edit_user', editFormData.fullName, { userId: selectedUser.id });
      notificationService.notify({ title: t('تم التحديث', 'Updated'), message: t(`تم تحديث ${editFormData.fullName}`, `${editFormData.fullName} updated`), type: 'info', category: 'system' });
      setIsEditModalOpen(false); setSelectedUser(null);
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, 'users');
    } finally {
      setEditLoading(false);
      editBlockRef.current = false;
    }
  };

  const handleToggleStatus = async (user: ManagedUser) => {
    const isRootTarget = ROOT_EMAILS.includes(user.email) || user.isRoot;
    if (isRootTarget) return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن تعطيل المسؤول الرئيسي', 'Cannot disable root admin'), type: 'error', category: 'system' });
    const action = user.disabled ? t('تفعيل', 'Enable') : t('تعطيل', 'Disable');
    setConfirmConfig({
      isOpen: true, type: user.disabled ? 'info' : 'warning',
      title: `${action} — ${user.fullName}`,
      message: t(`هل أنت متأكد من ${action} حساب ${user.fullName}؟`, `Are you sure you want to ${action.toLowerCase()} ${user.fullName}?`),
      onConfirm: async () => {
        const result = await runMutation(async () => {
          await updateDoc(doc(db, 'users', user.id), { disabled: !user.disabled, updatedAt: Date.now() });
          await activityLogService.log(user.disabled ? 'enable_user' : 'disable_user', user.fullName, { userId: user.id });
        }, setEditState);
        if (result.status === 'success-after-mutation') {
          notificationService.notify({ title: t('تم', 'Done'), message: `${user.fullName} ${user.disabled ? t('مُفعَّل', 'enabled') : t('مُعطَّل', 'disabled')}`, type: user.disabled ? 'success' : 'warning', category: 'system' });
        } else if (result.status === 'error') {
          handleSupabaseError(result.error, OperationType.UPDATE, 'users');
        }
      }
    });
  };

  const handleDeleteUser = (id: string, name: string) => {
    const targetUser = users.find(u => u.id === id);
    if (targetUser && (ROOT_EMAILS.includes(targetUser.email) || targetUser.isRoot)) {
      return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن حذف المسؤول الرئيسي', 'Cannot delete root admin'), type: 'error', category: 'system' });
    }
    setDeletePinConfig({
      isOpen: true,
      entityId: id,
      entityName: name
    });
  };

  const handleResetPassword = (user: ManagedUser) => {
    setPasswordTargetUser(user);
    setNewPasswordValue('');
    setIsPasswordModalOpen(true);
  };

  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser || !newPasswordValue) return;
    if (newPasswordValue.length < 6) {
      return notificationService.notify({
        title: t('خطأ', 'Error'),
        message: t('يجب أن تكون كلمة المرور 6 أحرف على الأقل', 'Password must be at least 6 characters'),
        type: 'error',
        category: 'system'
      });
    }
    setPasswordLoading(true);
    try {
      const response = await fetch('/api/auth/admin-change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: passwordTargetUser.id,
          newPassword: newPasswordValue
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }
      if (passwordTargetUser.email?.toLowerCase() === 'admin@swiftship.system' || passwordTargetUser.email?.toLowerCase() === 'admin') {
        try {
          const { simpleHashPassword, encryptDataLocal } = await import('../../../data/legacy/legacy-adapter');
          const hashVal = simpleHashPassword(newPasswordValue);
          const adminProfile = {
            uid: passwordTargetUser.id,
            email: 'admin@swiftship.system',
            fullName: passwordTargetUser.fullName || 'Emergency Master Admin',
            role: 'Admin',
            isRoot: true,
            disabled: false,
            createdAt: Date.now()
          };
          localStorage.setItem('swiftship_emergency_admin_hash', hashVal);
          localStorage.setItem('swiftship_emergency_admin_profile', encryptDataLocal(JSON.stringify(adminProfile), newPasswordValue));
          localStorage.setItem('swiftship_emergency_admin_pwd', newPasswordValue);
        } catch (lsErr) {
          console.warn('[UserManagement] Local storage credentials sync failed:', lsErr);
        }
      }
      await activityLogService.log('reset_password', passwordTargetUser.fullName, { email: passwordTargetUser.email, directChange: true });
      notificationService.notify({
        title: t('تم تغيير كلمة المرور', 'Password Changed'),
        message: t(`تم تغيير كلمة مرور ${passwordTargetUser.fullName} بنجاح`, `Password for ${passwordTargetUser.fullName} changed successfully`),
        type: 'success',
        category: 'system'
      });
      setIsPasswordModalOpen(false);
      setPasswordTargetUser(null);
      setNewPasswordValue('');
    } catch (err: unknown) {
      notificationService.notify({
        title: t('خطأ', 'Error'),
        message: getErrorMessage(err),
        type: 'error',
        category: 'system'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addLoading || addBlockRef.current) return;
    addBlockRef.current = true;
    setAddLoading(true);
    let secondaryApp: ReturnType<typeof initializeApp> | undefined;
    try {
      const emailQ = query(collection(db, 'users'), where('email', '==', addFormData.email.toLowerCase()));
      if (!(await getDocs(emailQ)).empty) throw new Error(t('البريد مستخدم مسبقاً', 'Email already registered'));
      if (addFormData.username) {
        const uQ = query(collection(db, 'users'), where('username', '==', addFormData.username));
        if (!(await getDocs(uQ)).empty) throw new Error(t('اسم المستخدم مستخدم مسبقاً', 'Username already taken'));
      }
      const secondaryAppName = `Secondary-${Date.now()}`;
      secondaryApp = initializeApp({}, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      const SHARED_SYSTEM_AUTH_PASSWORD = 'swiftship@system_pw_2026';
      const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, addFormData.email.toLowerCase(), SHARED_SYSTEM_AUTH_PASSWORD);

      // ══════════════════════════════════════════════════════════════════════════════
      // ISOLATION RULE: System User creation writes strictly to `users` table.
      // NEVER create a financial account or employee record upon System User creation.
      // قاعدة العزل: إدراج مستخدم النظام يكون حكراً بجدول `users` لحسابات الدخول والصلاحيات.
      // يُمنع إنشاء حساب مالي أو سجل موظف تلقائي عند إنشاء مستخدم نظام.
      // ══════════════════════════════════════════════════════════════════════════════
      await setDoc(doc(db, 'users', newUser.uid), {
        fullName: addFormData.fullName, email: addFormData.email.toLowerCase(),
        username: addFormData.username, systemPin: addFormData.systemPin,
        role: addFormData.role,
        password: addFormData.password,
        disabled: false,
        linkedType: addFormData.linkedType !== 'none' ? addFormData.linkedType : null,
        linkedEntity: addFormData.linkedType !== 'none' ? addFormData.linkedEntity : null,
        createdAt: Date.now()
      });

      await activityLogService.log('add_user', addFormData.fullName, { email: addFormData.email, role: addFormData.role });
      notificationService.notify({ title: t('تم إنشاء الحساب', 'Account Created'), message: t(`تم إنشاء حساب ${addFormData.fullName}`, `${addFormData.fullName} account created`), type: 'success', category: 'system' });
      setIsAddModalOpen(false);
      setAddFormData({ fullName: '', username: '', email: '', password: '', systemPin: '', role: 'Employee', linkedType: 'none', linkedEntity: '' });
    } catch (err: unknown) {
      const authError = asRecord(err) as ErrorLike;
      let msg = getErrorMessage(err);
      if (authError.code === 'auth/email-already-in-use') msg = t('البريد مسجل في نظام المصادقة', 'Email already in auth system');
      else if (authError.code === 'auth/weak-password') msg = t('كلمة المرور ضعيفة جداً (6+ أحرف)', 'Password too weak (min 6 chars)');
      notificationService.notify({ title: t('خطأ', 'Error'), message: msg, type: 'error', category: 'system' });
    } finally {
      setAddLoading(false);
      addBlockRef.current = false;
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  };

  // ══════════════════════════════════════════════════════════
  // SESSION TERMINATION — ENHANCED
  // ══════════════════════════════════════════════════════════
  const handleSessionAction = async (user: ManagedUser, action: SessionAction) => {
    const isRootTarget = ROOT_EMAILS.includes(user.email) || user.isRoot;
    if (isRootTarget) {
      return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن إنهاء جلسة المسؤول الرئيسي', 'Cannot terminate root admin session'), type: 'error', category: 'system' });
    }

    const now = Date.now();
    let updatePayload: DataRecord = {};
    let logAction: ActivityAction = 'terminate_session';
    let logDetails: DataRecord = { targetUserId: user.id, action };
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
    } catch (err: unknown) {
      notificationService.notify({ title: t('خطأ', 'Error'), message: getErrorMessage(err), type: 'error', category: 'system' });
    }
  };

  // ══════════════════════════════════════════════════════════
  // ROLE ACTIONS
  // ══════════════════════════════════════════════════════════
  const handleOpenAddRole = () => { setSelectedRole(null); setRoleFormData({ id: '', title: '', permissions: [] }); setIsRoleModalOpen(true); };
  const handleOpenEditRole = (r: RoleRecord) => {
    if (r.id === 'Admin') return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن تعديل صلاحيات مدير النظام', 'Cannot edit System Admin permissions'), type: 'error', category: 'system' });
    setSelectedRole(r); setRoleFormData({ id: r.id, title: r.title || r.id, permissions: r.permissions || [] }); setIsRoleModalOpen(true);
  };

  const togglePermission = (permId: string) => {
    setRoleFormData(prev => {
      const activePerms = Array.isArray(prev.permissions) ? prev.permissions : [];
      return {
        ...prev,
        permissions: activePerms.includes(permId)
          ? activePerms.filter(p => p !== permId)
          : [...activePerms, permId]
      };
    });
  };

  const toggleGroup = (groupName: string, checked: boolean) => {
    const permsInGroup = PERMISSION_GROUPS(isAr).find((g) => g.group === groupName)?.perms.map((p) => p.id) || [];
    setRoleFormData((prev) => {
      const activePerms = Array.isArray(prev.permissions) ? prev.permissions : [];
      return {
        ...prev,
        permissions: checked
          ? Array.from(new Set([...activePerms, ...permsInGroup]))
          : activePerms.filter((p) => !permsInGroup.includes(p)),
      };
    });
  };

  const ROLE_TAB_MAPPING: Record<string, string[]> = {
    all: [],
    general_orders: ['🏠 عام', '🏠 General', '📦 الطلبات والتتبع', '📦 Orders & Tracking', '⚙️ مراحل وحالات الطلب', '⚙️ Order Status Stages'],
    entries: ['📖 القيود العامة والمركبة والمؤقتة', '📖 General, Compound & Temp Entries'],
    vouchers: ['🧾 سندات القبض والصرف', '🧾 Receipt & Payment Vouchers'],
    finance_accounts: ['💰 المالية العامة والحسابات', '💰 General Finance & Accounts', '📊 التقارير', '📊 Reports'],
    people: ['👥 العملاء', '👥 Customers', '🚚 المناديب', '🚚 Couriers', '🧑‍💼 سجل الموظفين', '🧑‍💼 Employees Ledger', '👤 مستخدمو النظام', '👤 System Users (Dashboard Accounts)', '🛡️ الأدوار والصلاحيات', '🛡️ Roles & Permissions'],
    settings: ['⚡ القيود التلقائية', '⚡ Auto Entry Rules', '⚙️ إعدادات وأنواع القيود', '⚙️ Entry Settings & Types', '🗺️ مصادر الشراء والتوريد', '🗺️ Purchase & Supply Sources', '🚛 شركات الشحن والنقل', '🚛 Shipping Companies & Carriers', '🔔 الإشعارات', '🔔 Notifications', '⚙️ الإعدادات', '⚙️ Settings']
  };

  const getFilteredPerms = () => {
    let groups = PERMISSION_GROUPS(isAr);
    if (roleActiveTab !== 'all') {
      const allowedTitles = ROLE_TAB_MAPPING[roleActiveTab] || [];
      groups = groups.filter((g) => allowedTitles.includes(g.group));
    }
    if (!permSearch.trim()) return groups;
    const queryLower = permSearch.toLowerCase().trim();
    return groups
      .map((g) => ({
        ...g,
        perms: g.perms.filter(
          (p) => p.label.toLowerCase().includes(queryLower) || p.id.toLowerCase().includes(queryLower)
        ),
      }))
      .filter((g) => g.perms.length > 0);
  };

  const selectAllInActiveTab = () => {
    const currentTabGroups = getFilteredPerms();
    const permsToSelect = currentTabGroups.flatMap((g) => g.perms.map((p) => p.id));
    setRoleFormData((prev) => ({
      ...prev,
      permissions: Array.from(new Set([...(prev.permissions || []), ...permsToSelect])),
    }));
  };

  const deselectAllInActiveTab = () => {
    const currentTabGroups = getFilteredPerms();
    const permsToDeselect = new Set(currentTabGroups.flatMap((g) => g.perms.map((p) => p.id)));
    setRoleFormData((prev) => ({
      ...prev,
      permissions: (prev.permissions || []).filter((p) => !permsToDeselect.has(p)),
    }));
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRole || roleBlockRef.current) return;
    if (!roleFormData.id) return notificationService.notify({ title: t('خطأ', 'Error'), message: t('يرجى إدخال معرّف الدور', 'Please enter role ID'), type: 'error', category: 'system' });
    if (roleFormData.id === 'Admin') return notificationService.notify({ title: t('محمي', 'Protected'), message: t('لا يمكن تعديل صلاحيات مدير النظام', 'Cannot edit System Admin permissions'), type: 'error', category: 'system' });
    roleBlockRef.current = true;
    setSavingRole(true);
    try {
      await setDoc(doc(db, 'roles', roleFormData.id), { title: roleFormData.title, permissions: roleFormData.permissions, updatedAt: Date.now() });
      await activityLogService.log(selectedRole ? 'edit_role' : 'add_role', roleFormData.title, { id: roleFormData.id, permCount: roleFormData.permissions.length });
      notificationService.notify({ title: t('تم الحفظ', 'Saved'), message: t(`تم حفظ دور ${roleFormData.title}`, `Role ${roleFormData.title} saved`), type: 'success', category: 'system' });
      setIsRoleModalOpen(false);
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, 'roles');
    } finally {
      setSavingRole(false);
      roleBlockRef.current = false;
    }
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

  const isUserOnline = (user: ManagedUser) => Boolean(!user.disabled && user.lastSeen && Date.now() - user.lastSeen < 5 * 60 * 1000);

  const getTimeSince = (ts?: number) => {
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

  const getTempBanRemaining = (user: ManagedUser) => {
    if (!user.tempBanUntil) return null;
    const remaining = user.tempBanUntil - Date.now();
    if (remaining <= 0) return null;
    const hrs = Math.floor(remaining / 3_600_000);
    const mins = Math.floor((remaining % 3_600_000) / 60_000);
    return t(`${hrs}س ${mins}د`, `${hrs}h ${mins}m`);
  };

  // ── Merge each user with their live financial balance ─────────────────────────────────
  // Priority: live byCode → live byId → stored acc.balance → user.financialBalance (legacy)
  const usersWithLiveBalance = React.useMemo(() => {
    return users.map(u => {
      // Find the linked financial account (employee account: prefix 2130)
      const acc = accounts.find(a =>
        a.entityId === u.id ||
        a.id === u.financialAccountId ||
        a.id === u.accountId
      );

      const liveByCode = acc?.accountCode ? liveBalances.byCode[acc.accountCode] : undefined;
      const liveById = acc?.id ? liveBalances.byId[acc.id] : undefined;
      const liveBalance = liveByCode ?? liveById ?? (acc ? acc.balance : undefined) ?? u.financialBalance ?? 0;

      return {
        ...u,
        financialAccountId: acc?.id || u.financialAccountId || null,
        financialAccountCode: acc?.accountCode || u.financialAccountCode || null,
        financialBalance: liveBalance,
        financialCurrency: acc?.currency || u.financialCurrency || settings.currency || 'YER',
      };
    });
  }, [users, accounts, liveBalances, settings.currency]);

  const filteredUsers = usersWithLiveBalance
    .filter(u => {
      const ms = (u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(search.toLowerCase());
      const mr = roleFilter === 'all' || u.role === roleFilter;
      const mst = statusFilter === 'all' || (statusFilter === 'active' && !u.disabled) || (statusFilter === 'disabled' && u.disabled) || (statusFilter === 'online' && isUserOnline(u));
      return ms && mr && mst;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const isSessionOnline = (sess: SessionRecord) => {
    const rawLastSeen = sess.lastSeen || sess.last_seen;
    let lastSeenMs = 0;
    if (typeof rawLastSeen === 'number') lastSeenMs = rawLastSeen;
    else if (typeof rawLastSeen === 'string') {
      const parsed = Date.parse(rawLastSeen);
      if (!isNaN(parsed)) lastSeenMs = parsed;
    }
    if (!lastSeenMs) return false;
    // Heartbeat updates are every 45s; mark offline if no heartbeat for 3 minutes
    return (Date.now() - lastSeenMs) < 3 * 60 * 1000;
  };
  const onlineSessionsCount = dbSessions.filter(isSessionOnline).length;
  const activeSessions = dbSessions;

  const handleRequestTerminateSession = (session: SessionRecord) => {
    setConfirmConfig({
      isOpen: true,
      type: 'danger',
      title: t('إنهاء الجلسة المحددة', 'Terminate Selected Session'),
      message: t(`هل أنت متأكد من إنهاء جلسة ${session.fullName} على الجهاز "${session.deviceInfo || 'غير معروف'}"؟`, `Are you sure you want to terminate ${session.fullName}'s session on "${session.deviceInfo || 'Unknown'}"?`),
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'sessions', session.id), { forceLogout: true });
          await activityLogService.log('terminate_session', session.fullName, { sessionId: session.id, deviceInfo: session.deviceInfo });
          notificationService.notify({
            title: t('تم تسجيل الخروج', 'Logged Out'),
            message: t('تم إرسال أمر الخروج للجلسة بنجاح', 'Logout command sent successfully'),
            type: 'success',
            category: 'system'
          });
        } catch (err: unknown) {
          notificationService.notify({
            title: t('خطأ', 'Error'),
            message: getErrorMessage(err),
            type: 'error',
            category: 'system'
          });
        }
      }
    });
  };

  const filteredLogs = activityLogs
    .filter(l => (logFilter === 'all' || l.action === logFilter) && (logUserFilter === 'all' || l.userId === logUserFilter))
    .slice(0, logLimit);

  const currentUserData = users.find(u => u.id === currentUser?.id);



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
    { id: 'users', icon: UsersIcon, label: t('المستخدمون', 'users'), count: users.length },
    { id: 'roles', icon: Shield, label: t('الأدوار والصلاحيات', 'Roles'), count: roles.length },
    { id: 'sessions', icon: MonitorCheck, label: t('الجلسات النشطة', 'Active Sessions'), count: onlineSessionsCount, pulse: onlineSessionsCount > 0 },
    { id: 'activity', icon: FileClock, label: t('سجل النشاط', 'Activity Log'), count: activityLogs.length }
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
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex-1 justify-center ${isActive ? 'bg-gradient-to-r from-[#d4af37]/20 to-transparent text-white border border-[#d4af37]/30 shadow-inner' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}>
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#d4af37]' : ''}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black flex items-center gap-0.5 ${isActive ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-slate-800 text-slate-500'}`}>
                {'pulse' in tab && tab.pulse && tab.count > 0 && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>}
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <UserManagementTabContent
        activeTab={activeTab} isAr={isAr} t={t} hasPermission={hasPermission}
        filteredUsers={filteredUsers} search={search} setSearch={setSearch}
        roleFilter={roleFilter} setRoleFilter={setRoleFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        roles={roles} activeSessions={activeSessions}
        onlineSessionsCount={onlineSessionsCount} ROOT_EMAILS={ROOT_EMAILS}
        couriersList={couriersList} employeesList={employeesList} role={role}
        getRoleBadgeStyle={getRoleBadgeStyle} getTempBanRemaining={getTempBanRemaining}
        getTimeSince={getTimeSince} isUserOnline={isUserOnline}
        isSessionOnline={isSessionOnline} handleRequestTerminateSession={handleRequestTerminateSession}
        handleToggleStatus={handleToggleStatus} handleOpenEdit={handleOpenEdit}
        handleResetPassword={handleResetPassword} setSessionTargetUser={setSessionTargetUser}
        setIsSessionModalOpen={setIsSessionModalOpen} handleDeleteUser={handleDeleteUser}
        users={users} dbSessions={dbSessions} sessionId={sessionId}
        currentUserDoc={currentUserDoc} setConfirmConfig={setConfirmConfig}
        filteredLogs={filteredLogs} logFilter={logFilter} setLogFilter={setLogFilter}
        logUserFilter={logUserFilter} setLogUserFilter={setLogUserFilter}
        logLimit={logLimit} setLogLimit={setLogLimit} getActionMeta={getActionMeta}
        handleOpenEditRole={handleOpenEditRole} handleDeleteRole={handleDeleteRole}
        ALL_PERMISSIONS={ALL_PERMISSIONS}
      />
      <SessionActionModal
        isOpen={isSessionModalOpen} sessionTargetUser={sessionTargetUser}
        isAr={isAr} t={t} isUserOnline={isUserOnline}
        getRoleBadgeStyle={getRoleBadgeStyle} SESSION_ACTIONS={SESSION_ACTIONS}
        setIsSessionModalOpen={setIsSessionModalOpen}
        setSessionTargetUser={setSessionTargetUser}
        setConfirmConfig={setConfirmConfig} handleSessionAction={handleSessionAction}
      />
      <AddUserModal
        isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}
        isAr={isAr} t={t} addFormData={addFormData} setAddFormData={setAddFormData}
        handleAddUser={handleAddUser} addLoading={addLoading} roles={roles}
        couriersList={couriersList} employeesList={employeesList}
        showPassword={showPassword} setShowPassword={setShowPassword}
      />
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedUser(null); }}
        isAr={isAr} t={t} selectedUser={selectedUser} editFormData={editFormData}
        setEditFormData={setEditFormData} handleUpdateUser={handleUpdateUser}
        editLoading={editLoading} roles={roles} couriersList={couriersList}
        employeesList={employeesList} ROOT_EMAILS={ROOT_EMAILS}
      />
      <ChangePasswordModal
        isOpen={isPasswordModalOpen} onClose={() => { setIsPasswordModalOpen(false); setPasswordTargetUser(null); }}
        isAr={isAr} t={t} passwordTargetUser={passwordTargetUser}
        newPasswordValue={newPasswordValue} setNewPasswordValue={setNewPasswordValue}
        handleAdminChangePassword={handleAdminChangePassword} passwordLoading={passwordLoading}
      />
      <RoleFormModal
        isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)}
        selectedRole={selectedRole} roleFormData={roleFormData} setRoleFormData={setRoleFormData}
        roleActiveTab={roleActiveTab} setRoleActiveTab={setRoleActiveTab}
        permSearch={permSearch} setPermSearch={setPermSearch}
        expandedGroups={expandedGroups} setExpandedGroups={setExpandedGroups}
        selectAllInActiveTab={selectAllInActiveTab} deselectAllInActiveTab={deselectAllInActiveTab}
        getFilteredPerms={getFilteredPerms} toggleGroup={toggleGroup}
        togglePermission={togglePermission} handleSaveRole={handleSaveRole}
        savingRole={savingRole} isAr={isAr} allPermissionsCount={ALL_PERMISSIONS(isAr).length} t={t}
      />
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />

      <ConfirmDeletePinModal
        isOpen={deletePinConfig.isOpen}
        onClose={() => setDeletePinConfig({ ...deletePinConfig, isOpen: false })}
        title={isAr ? 'حذف حساب المستخدم نهائياً' : 'Delete User Account Permanently'}
        message={isAr
          ? `هل أنت متأكد من رغبتك في حذف المستخدم ${deletePinConfig.entityName}؟ هذا الإجراء سيقوم بحذف حسابه المالي وكافة قيوده ومصروفاته المرتبطة نهائياً.`
          : `Are you sure you want to permanently delete user ${deletePinConfig.entityName}? This will purge their financial account, journal transactions, and associated expenses from the database.`}
        isAr={isAr}
        onConfirm={async () => {
          await financialAccountService.purgeEntityAndFinancialFootprint('user', deletePinConfig.entityId);
          await activityLogService.log('delete_user', deletePinConfig.entityName, { userId: deletePinConfig.entityId });
          notificationService.notify({
            title: isAr ? 'تم الحذف' : 'User Deleted',
            message: isAr ? `تم حذف المستخدم ${deletePinConfig.entityName} وسجلاته المالية بنجاح` : `User ${deletePinConfig.entityName} deleted successfully`,
            type: 'warning'
          });
        }}
      />
    </div>
  );
}
