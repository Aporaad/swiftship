// ─── PERMISSION KEYS ─────────────────────────────────────────────────────────
// Centralized permission definitions for the entire system.
// Every permission has an Arabic + English label for the Roles page UI.

export type PermissionKey =
  // Dashboard
  | 'view_dashboard'
  | 'view_analytics'
  | 'view_statistics'
  // Orders
  | 'view_orders'
  | 'add_orders'
  | 'edit_orders'
  | 'delete_orders'
  | 'delete_paid_orders'
  | 'update_order_status'
  | 'edit_delivered_orders'
  | 'print_orders'
  | 'export_orders'
  // Customers
  | 'view_customers'
  | 'add_customers'
  | 'edit_customers'
  | 'delete_customers'
  // Couriers
  | 'view_couriers'
  | 'add_couriers'
  | 'edit_couriers'
  | 'delete_couriers'
  // Sources
  | 'view_sources'
  | 'add_sources'
  | 'edit_sources'
  | 'delete_sources'
  // Finance & Expenses
  | 'view_finance'
  | 'add_finance'
  | 'edit_finance'
  | 'view_expenses'
  | 'add_expenses'
  | 'edit_expenses'
  | 'delete_expenses'
  | 'view_custody'
  | 'settle_custody'
  | 'view_reports'
  | 'manage_currencies'
  | 'edit_exchange_rates'
  // Settings
  | 'settings'
  | 'edit_interface_settings'
  | 'edit_general_settings'
  | 'edit_company_info'
  | 'edit_order_defaults'
  | 'manage_backup'
  | 'export_data'
  | 'import_data'
  // Users & Roles
  | 'view_users'
  | 'add_users'
  | 'edit_users'
  | 'disable_users'
  | 'delete_users'
  | 'manage_roles'
  | 'edit_role_permissions'
  | 'view_activity_logs'
  // Notifications
  | 'view_notifications'
  | 'send_notifications'
  | 'notify_orders'
  | 'notify_finance'
  | 'notify_system'
  | 'manage_whatsapp'
  // Admin
  | 'view_admin_panel'
  | 'force_logout_users'
  | 'manage_admin_settings'
  | 'view_system_logs'
  | 'system_pin_required';

// ─── PERMISSION LABELS (bilingual) ──────────────────────────────────────────
export const PERMISSION_LABELS: Record<PermissionKey, { ar: string; en: string }> = {
  view_dashboard:        { ar: 'عرض لوحة التحكم',           en: 'View Dashboard' },
  view_analytics:       { ar: 'عرض التحليلات',             en: 'View Analytics' },
  view_statistics:      { ar: 'عرض الإحصائيات',             en: 'View Statistics' },
  view_orders:          { ar: 'عرض الطلبات',               en: 'View Orders' },
  add_orders:           { ar: 'إضافة طلبات',               en: 'Add Orders' },
  edit_orders:          { ar: 'تعديل الطلبات',             en: 'Edit Orders' },
  delete_orders:        { ar: 'حذف الطلبات',               en: 'Delete Orders' },
  delete_paid_orders:   { ar: 'حذف الطلبات المدفوعة',      en: 'Delete Paid Orders' },
  update_order_status:  { ar: 'تحديث حالة الطلبات',        en: 'Update Order Status' },
  edit_delivered_orders:{ ar: 'تعديل الطلبات المسلمة',      en: 'Edit Delivered Orders' },
  print_orders:         { ar: 'طباعة الطلبات',             en: 'Print Orders' },
  export_orders:        { ar: 'تصدير الطلبات',             en: 'Export Orders' },
  view_customers:       { ar: 'عرض العملاء',               en: 'View Customers' },
  add_customers:        { ar: 'إضافة عملاء',               en: 'Add Customers' },
  edit_customers:       { ar: 'تعديل العملاء',             en: 'Edit Customers' },
  delete_customers:     { ar: 'حذف العملاء',               en: 'Delete Customers' },
  view_couriers:        { ar: 'عرض المناديب',              en: 'View Couriers' },
  add_couriers:         { ar: 'إضافة مناديب',              en: 'Add Couriers' },
  edit_couriers:        { ar: 'تعديل المناديب',            en: 'Edit Couriers' },
  delete_couriers:      { ar: 'حذف المناديب',              en: 'Delete Couriers' },
  view_sources:         { ar: 'عرض المصادر',               en: 'View Sources' },
  add_sources:          { ar: 'إضافة مصادر',               en: 'Add Sources' },
  edit_sources:         { ar: 'تعديل المصادر',             en: 'Edit Sources' },
  delete_sources:       { ar: 'حذف المصادر',               en: 'Delete Sources' },
  view_finance:         { ar: 'عرض المحاسبة',              en: 'View Finance' },
  add_finance:          { ar: 'إضافة حركات مالية',          en: 'Add Finance' },
  edit_finance:         { ar: 'تعديل الحركات المالية',       en: 'Edit Finance' },
  view_expenses:        { ar: 'عرض المصروفات',             en: 'View Expenses' },
  add_expenses:         { ar: 'إضافة مصروفات',             en: 'Add Expenses' },
  edit_expenses:        { ar: 'تعديل المصروفات',            en: 'Edit Expenses' },
  delete_expenses:      { ar: 'حذف المصروفات',             en: 'Delete Expenses' },
  view_custody:         { ar: 'عرض العهد',                 en: 'View Custody' },
  settle_custody:        { ar: 'تسوية العهد',               en: 'Settle Custody' },
  view_reports:         { ar: 'عرض التقارير',               en: 'View Reports' },
  manage_currencies:    { ar: 'إدارة العملات',             en: 'Manage Currencies' },
  edit_exchange_rates:  { ar: 'تعديل أسعار الصرف',          en: 'Edit Exchange Rates' },
  settings:             { ar: 'عرض الإعدادات',              en: 'View Settings' },
  edit_interface_settings:{ ar: 'تعديل إعدادات الواجهة',    en: 'Edit Interface Settings' },
  edit_general_settings:{ ar: 'تعديل الإعدادات العامة',      en: 'Edit General Settings' },
  edit_company_info:    { ar: 'تعديل بيانات الشركة',         en: 'Edit Company Info' },
  edit_order_defaults:  { ar: 'تعديل الإعدادات الافتراضية',  en: 'Edit Order Defaults' },
  manage_backup:        { ar: 'إدارة النسخ الاحتياطية',      en: 'Manage Backup' },
  export_data:          { ar: 'تصدير البيانات',             en: 'Export Data' },
  import_data:          { ar: 'استيراد البيانات',            en: 'Import Data' },
  view_users:           { ar: 'عرض المستخدمين',             en: 'View Users' },
  add_users:            { ar: 'إضافة مستخدمين',             en: 'Add Users' },
  edit_users:           { ar: 'تعديل المستخدمين',            en: 'Edit Users' },
  disable_users:        { ar: 'تعطيل المستخدمين',            en: 'Disable Users' },
  delete_users:         { ar: 'حذف المستخدمين',             en: 'Delete Users' },
  manage_roles:         { ar: 'إدارة الأدوار',              en: 'Manage Roles' },
  edit_role_permissions:{ ar: 'تعديل صلاحيات الأدوار',       en: 'Edit Role Permissions' },
  view_activity_logs:   { ar: 'عرض سجلات النشاط',           en: 'View Activity Logs' },
  view_notifications:   { ar: 'عرض الإشعارات',               en: 'View Notifications' },
  send_notifications:   { ar: 'إرسال إشعارات',               en: 'Send Notifications' },
  notify_orders:        { ar: 'إشعارات الطلبات',             en: 'Order Notifications' },
  notify_finance:       { ar: 'إشعارات المالية',             en: 'Finance Notifications' },
  notify_system:        { ar: 'إشعارات النظام',              en: 'System Notifications' },
  manage_whatsapp:      { ar: 'إدارة الواتس آب',             en: 'Manage WhatsApp' },
  view_admin_panel:     { ar: 'عرض لوحة المسؤول',            en: 'View Admin Panel' },
  force_logout_users:   { ar: 'إجبار المستخدمين على الخروج', en: 'Force Logout Users' },
  manage_admin_settings:{ ar: 'إدارة إعدادات المسؤول',       en: 'Manage Admin Settings' },
  view_system_logs:     { ar: 'عرض سجلات النظام',           en: 'View System Logs' },
  system_pin_required:  { ar: 'يتطلب رمز PIN',             en: 'System PIN Required' },
};

// ─── PERMISSION CATEGORIES ──────────────────────────────────────────────────
export const PERMISSION_CATEGORIES: Record<string, PermissionKey[]> = {
  'لوحة التحكم / Dashboard':      ['view_dashboard', 'view_analytics', 'view_statistics'],
  'الطلبات / Orders':              ['view_orders', 'add_orders', 'edit_orders', 'delete_orders', 'delete_paid_orders', 'update_order_status', 'edit_delivered_orders', 'print_orders', 'export_orders'],
  'العملاء / Customers':           ['view_customers', 'add_customers', 'edit_customers', 'delete_customers'],
  'المناديب / Couriers':           ['view_couriers', 'add_couriers', 'edit_couriers', 'delete_couriers'],
  'المصادر / Sources':             ['view_sources', 'add_sources', 'edit_sources', 'delete_sources'],
  'المالية / Finance':             ['view_finance', 'add_finance', 'edit_finance', 'view_expenses', 'add_expenses', 'edit_expenses', 'delete_expenses', 'view_custody', 'settle_custody', 'view_reports', 'manage_currencies', 'edit_exchange_rates'],
  'الإعدادات / Settings':          ['settings', 'edit_interface_settings', 'edit_general_settings', 'edit_company_info', 'edit_order_defaults', 'manage_backup', 'export_data', 'import_data'],
  'المستخدمون / Users':           ['view_users', 'add_users', 'edit_users', 'disable_users', 'delete_users', 'manage_roles', 'edit_role_permissions', 'view_activity_logs'],
  'الإشعارات / Notifications':    ['view_notifications', 'send_notifications', 'notify_orders', 'notify_finance', 'notify_system', 'manage_whatsapp'],
  'الإدارة / Admin':               ['view_admin_panel', 'force_logout_users', 'manage_admin_settings', 'view_system_logs', 'system_pin_required'],
};

// ─── DEFAULT ROLE PERMISSIONS ───────────────────────────────────────────────
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  Admin: ['*'] as any,
  Employee: [
    'view_dashboard', 'view_orders', 'add_orders', 'edit_orders', 'update_order_status',
    'print_orders', 'edit_delivered_orders',
    'view_customers', 'add_customers', 'edit_customers',
    'view_couriers', 'add_couriers', 'edit_couriers',
    'view_sources', 'add_sources', 'edit_sources',
    'view_notifications', 'notify_orders', 'notify_system',
    'export_orders',
  ],
  Accountant: [
    'view_dashboard', 'view_orders', 'view_analytics', 'view_statistics',
    'view_finance', 'add_finance', 'edit_finance',
    'view_expenses', 'add_expenses', 'edit_expenses', 'delete_expenses',
    'view_custody', 'settle_custody', 'view_reports',
    'view_sources', 'add_sources', 'edit_sources',
    'manage_currencies', 'edit_exchange_rates',
    'print_orders', 'export_orders',
  ],
  Courier: [
    'view_orders', 'update_order_status',
  ],
};
