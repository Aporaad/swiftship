// Comprehensive permission system for SwiftShip
export type PermissionKey =
  // Dashboard & Analytics
  | 'view_dashboard'
  | 'view_analytics'
  | 'view_statistics'

  // Orders Management
  | 'view_orders'
  | 'add_orders'
  | 'edit_orders'
  | 'delete_orders'
  | 'delete_paid_orders'
  | 'update_order_status'
  | 'print_orders'
  | 'export_orders'

  // Customers Management
  | 'view_customers'
  | 'add_customers'
  | 'edit_customers'
  | 'delete_customers'

  // Couriers Management
  | 'view_couriers'
  | 'add_couriers'
  | 'edit_couriers'
  | 'delete_couriers'

  // Sources Management
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
  | 'manage_currencies'
  | 'edit_exchange_rates'

  // System Settings
  | 'view_settings'
  | 'edit_interface_settings'
  | 'edit_general_settings'
  | 'edit_company_info'
  | 'edit_order_defaults'
  | 'edit_exchange_rates'
  | 'manage_backup'
  | 'export_data'
  | 'import_data'

  // Users & Roles Management
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
  | 'manage_whatsapp'

  // Admin Only
  | 'view_admin_panel'
  | 'force_logout_users'
  | 'manage_admin_settings'
  | 'view_system_logs'
  | 'system_pin_required';

export interface RolePermissions {
  Admin: PermissionKey[];
  Accountant: PermissionKey[];
  Employee: PermissionKey[];
  Courier: PermissionKey[];
}

export const PERMISSION_DEFAULTS: RolePermissions = {
  Admin: ['*'], // Wildcard for all permissions
  Accountant: [
    'view_dashboard',
    'view_analytics',
    'view_statistics',
    'view_orders',
    'view_finance',
    'add_finance',
    'edit_finance',
    'view_expenses',
    'add_expenses',
    'edit_expenses',
    'view_customers',
    'view_couriers',
    'view_sources',
    'add_sources',
    'edit_sources',
    'manage_currencies',
    'edit_exchange_rates',
    'view_settings',
    'view_users',
    'view_activity_logs',
  ],
  Employee: [
    'view_dashboard',
    'view_orders',
    'add_orders',
    'edit_orders',
    'update_order_status',
    'print_orders',
    'export_orders',
    'view_customers',
    'add_customers',
    'edit_customers',
    'view_couriers',
    'add_couriers',
    'edit_couriers',
    'view_sources',
    'add_sources',
    'edit_sources',
    'view_notifications',
    'send_notifications',
    'view_settings',
    'view_activity_logs',
  ],
  Courier: [
    'view_orders',
    'update_order_status',
  ],
};

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, { ar: string; en: string }> = {
  // Dashboard
  view_dashboard: { ar: 'عرض لوحة المعلومات', en: 'View Dashboard' },
  view_analytics: { ar: 'عرض التحليلات', en: 'View Analytics' },
  view_statistics: { ar: 'عرض الإحصائيات', en: 'View Statistics' },

  // Orders
  view_orders: { ar: 'عرض الطلبات', en: 'View Orders' },
  add_orders: { ar: 'إضافة طلبات جديدة', en: 'Add New Orders' },
  edit_orders: { ar: 'تعديل الطلبات', en: 'Edit Orders' },
  delete_orders: { ar: 'حذف الطلبات', en: 'Delete Orders' },
  delete_paid_orders: { ar: 'حذف الطلبات المدفوعة', en: 'Delete Paid Orders' },
  update_order_status: { ar: 'تحديث حالة الطلبات', en: 'Update Order Status' },
  print_orders: { ar: 'طباعة الطلبات', en: 'Print Orders' },
  export_orders: { ar: 'تصدير الطلبات', en: 'Export Orders' },

  // Customers
  view_customers: { ar: 'عرض العملاء', en: 'View Customers' },
  add_customers: { ar: 'إضافة عملاء جدد', en: 'Add Customers' },
  edit_customers: { ar: 'تعديل بيانات العملاء', en: 'Edit Customer Data' },
  delete_customers: { ar: 'حذف العملاء', en: 'Delete Customers' },

  // Couriers
  view_couriers: { ar: 'عرض المناديب', en: 'View Couriers' },
  add_couriers: { ar: 'إضافة مناديب جدد', en: 'Add Couriers' },
  edit_couriers: { ar: 'تعديل بيانات المناديب', en: 'Edit Couriers' },
  delete_couriers: { ar: 'حذف المناديب', en: 'Delete Couriers' },

  // Sources
  view_sources: { ar: 'عرض المصادر', en: 'View Sources' },
  add_sources: { ar: 'إضافة مصادر جديدة', en: 'Add Sources' },
  edit_sources: { ar: 'تعديل المصادر', en: 'Edit Sources' },
  delete_sources: { ar: 'حذف المصادر', en: 'Delete Sources' },

  // Finance
  view_finance: { ar: 'عرض المحاسبة', en: 'View Finance' },
  add_finance: { ar: 'إضافة حركات مالية', en: 'Add Financial Records' },
  edit_finance: { ar: 'تعديل الحركات المالية', en: 'Edit Financial Records' },
  view_expenses: { ar: 'عرض المصروفات', en: 'View Expenses' },
  add_expenses: { ar: 'إضافة مصروفات', en: 'Add Expenses' },
  edit_expenses: { ar: 'تعديل المصروفات', en: 'Edit Expenses' },
  delete_expenses: { ar: 'حذف المصروفات', en: 'Delete Expenses' },
  manage_currencies: { ar: 'إدارة العملات', en: 'Manage Currencies' },
  edit_exchange_rates: { ar: 'تعديل أسعار الصرف', en: 'Edit Exchange Rates' },

  // Settings
  view_settings: { ar: 'عرض الإعدادات', en: 'View Settings' },
  edit_interface_settings: { ar: 'تعديل إعدادات الواجهة', en: 'Edit Interface Settings' },
  edit_general_settings: { ar: 'تعديل الإعدادات العامة', en: 'Edit General Settings' },
  edit_company_info: { ar: 'تعديل بيانات الشركة', en: 'Edit Company Info' },
  edit_order_defaults: { ar: 'تعديل إعدادات الطلبات الافتراضية', en: 'Edit Order Defaults' },
  manage_backup: { ar: 'إدارة النسخ الاحتياطية', en: 'Manage Backups' },
  export_data: { ar: 'تصدير البيانات', en: 'Export Data' },
  import_data: { ar: 'استيراد البيانات', en: 'Import Data' },

  // Users & Roles
  view_users: { ar: 'عرض المستخدمين', en: 'View Users' },
  add_users: { ar: 'إضافة مستخدمين جدد', en: 'Add Users' },
  edit_users: { ar: 'تعديل بيانات المستخدمين', en: 'Edit Users' },
  disable_users: { ar: 'تعطيل حسابات المستخدمين', en: 'Disable User Accounts' },
  delete_users: { ar: 'حذف المستخدمين', en: 'Delete Users' },
  manage_roles: { ar: 'إدارة الأدوار', en: 'Manage Roles' },
  edit_role_permissions: { ar: 'تعديل صلاحيات الأدوار', en: 'Edit Role Permissions' },
  view_activity_logs: { ar: 'عرض سجلات النشاط', en: 'View Activity Logs' },

  // Notifications
  view_notifications: { ar: 'عرض الإشعارات', en: 'View Notifications' },
  send_notifications: { ar: 'إرسال إشعارات', en: 'Send Notifications' },
  manage_whatsapp: { ar: 'إدارة إعدادات الواتس آب', en: 'Manage WhatsApp' },

  // Admin
  view_admin_panel: { ar: 'عرض لوحة المسؤول', en: 'View Admin Panel' },
  force_logout_users: { ar: 'إجبار المستخدمين على تسجيل الخروج', en: 'Force Logout Users' },
  manage_admin_settings: { ar: 'إدارة إعدادات النظام المتقدمة', en: 'Manage Admin Settings' },
  view_system_logs: { ar: 'عرض سجلات النظام', en: 'View System Logs' },
  system_pin_required: { ar: 'يتطلب رمز PIN النظام', en: 'System PIN Required' },
};
