export type PermissionKey =
  | '*'
  | 'view_dashboard'
  | 'view_statistics'
  | 'view_orders'
  | 'add_orders'
  | 'edit_orders'
  | 'update_order_status'
  | 'delete_orders'
  | 'delete_paid_orders'
  | 'edit_delivered_orders'
  | 'print_orders'
  | 'export_orders'
  | 'view_customers'
  | 'add_customers'
  | 'edit_customers'
  | 'delete_customers'
  | 'view_couriers'
  | 'add_couriers'
  | 'edit_couriers'
  | 'delete_couriers'
  | 'view_employees'
  | 'add_employees'
  | 'edit_employees'
  | 'delete_employees'
  | 'view_sources'
  | 'add_sources'
  | 'edit_sources'
  | 'delete_sources'
  | 'view_users'
  | 'add_users'
  | 'edit_users'
  | 'delete_users'
  | 'reset_passwords'
  | 'disable_accounts'
  | 'terminate_sessions'
  | 'view_activity_log'
  | 'view_roles'
  | 'add_roles'
  | 'edit_roles'
  | 'delete_roles'
  | 'view_finance'
  | 'add_finance'
  | 'edit_finance'
  | 'view_expenses'
  | 'view_custody'
  | 'add_expenses'
  | 'edit_expenses'
  | 'delete_expenses'
  | 'edit_exchange_rates'
  | 'view_reports'
  | 'settings'
  | 'edit_interface_settings'
  | 'edit_general_settings'
  | 'edit_order_defaults'
  | 'view_order_defaults'
  | 'edit_order_defaults_creation'
  | 'view_edit_notification_settings'
  | 'edit_company_info'
  | 'manage_whatsapp'
  | 'manage_backup'
  | 'view_notifications'
  | 'send_notifications'
  | 'manage_notifications'
  | 'notify_orders'
  | 'notify_finance'
  | 'notify_system'
  | 'view_financial_accounts'
  | 'manage_financial_accounts'
  | 'edit_profit_per_kg'
  | 'edit_cbm_shipping_rate'
  | 'view_website_management'
  | 'manage_website';

export interface PermissionDefinition {
  id: PermissionKey;
  labelAr: string;
  labelEn: string;
  category: string;
}

export const PERMISSION_CATEGORIES = {
  general: { ar: 'عام', en: 'General' },
  orders: { ar: 'الطلبات', en: 'Orders' },
  customers: { ar: 'العملاء', en: 'Customers' },
  couriers: { ar: 'المناديب', en: 'Couriers' },
  sources: { ar: 'المصادر', en: 'Order Sources' },
  staff: { ar: 'الموظفين', en: 'Staff & Roles' },
  accounting: { ar: 'المحاسبة والمالية', en: 'Accounting & Finance' },
  reports: { ar: 'التقارير', en: 'Reports' },
  admin: { ar: 'المسؤول وإعدادات النظام', en: 'System Administration' },
  notifications: { ar: 'الإشعارات وتنبيهات النظام', en: 'Notifications & Alerts' },
};

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // General Category
  { id: 'view_dashboard', labelAr: 'عرض لوحة التحكم والإحصائيات الملخصة', labelEn: 'View Dashboard & Summaries', category: 'general' },
  { id: 'view_statistics', labelAr: 'عرض الرسوم والرسوم البيانية المالية المتقدمة', labelEn: 'View Advanced Analytical Graphs', category: 'general' },

  // Orders
  { id: 'view_orders', labelAr: 'عرض سجل الطلبات', labelEn: 'View Orders list', category: 'orders' },
  { id: 'add_orders', labelAr: 'إنشاء وإضافة طلبات جديدة', labelEn: 'Create New Orders', category: 'orders' },
  { id: 'edit_orders', labelAr: 'تعديل بيانات وتفاصيل الطلب', labelEn: 'Edit Existing Orders', category: 'orders' },
  { id: 'edit_order_defaults_creation', labelAr: 'تعديل الأسعار الافتراضية عند إنشاء طلب', labelEn: 'Edit Default Prices When Creating Order', category: 'orders' },
  { id: 'update_order_status', labelAr: 'تغيير حالة الطلب فقط بحدود اللوجستيات', labelEn: 'Update Status Only', category: 'orders' },
  { id: 'delete_orders', labelAr: 'حذف وتصفية الطلبات السابقة', labelEn: 'Delete Orders', category: 'orders' },
  { id: 'delete_paid_orders', labelAr: 'تفويض حذف طلب مدفوع بالكامل', labelEn: 'Authorize Deleting Paid Orders', category: 'orders' },
  { id: 'edit_delivered_orders', labelAr: 'تعديل تفاصيل الطلب بعد وصوله للمستلم', labelEn: 'Edit Orders after Handover', category: 'orders' },
  { id: 'print_orders', labelAr: 'تصدير وتوليد فواتير للطباعة', labelEn: 'Generate & Print PDF Invoices', category: 'orders' },
  { id: 'export_orders', labelAr: 'تصدير بيانات الطلب بصيغة إلكترونية', labelEn: 'Export Excel/CSV Order datasets', category: 'orders' },

  // Customers
  { id: 'view_customers', labelAr: 'رؤية قائمة العملاء والملفات الشخصية', labelEn: 'View Customer directory', category: 'customers' },
  { id: 'add_customers', labelAr: 'تسجيل وبناء ملفات لعملاء جدد', labelEn: 'Add New Customers', category: 'customers' },
  { id: 'edit_customers', labelAr: 'تحديث بيانات وسجل العملاء', labelEn: 'Modify Customer Files', category: 'customers' },
  { id: 'delete_customers', labelAr: 'تصفية وإجراء عملية حذف للعملاء', labelEn: 'Remove Customer Dossiers', category: 'customers' },

  // Couriers
  { id: 'view_couriers', labelAr: 'رؤية كشف المناديب والحالة', labelEn: 'Check Courier Database', category: 'couriers' },
  { id: 'add_couriers', labelAr: 'توظيف وإضافة مندوب توصيل جديد', labelEn: 'Enroll New Couriers', category: 'couriers' },
  { id: 'edit_couriers', labelAr: 'تعديل نسبة أو معلومات ملف المندوب', labelEn: 'Edit Courier Contracts', category: 'couriers' },
  { id: 'delete_couriers', labelAr: 'إلغاء التعامل وحساب المندوب من الواجهة', labelEn: 'Remove Registered Couriers', category: 'couriers' },

  // Sources
  { id: 'view_sources', labelAr: 'عرض وتتبع شركات الشحن والموردين والمصادر', labelEn: 'Manage Shipping carriers & Intake sources', category: 'sources' },
  { id: 'add_sources', labelAr: 'إضافة شركة شحن أو مصدر توريد جديد', labelEn: 'Add New Carrier/Source', category: 'sources' },
  { id: 'edit_sources', labelAr: 'تعديل عقد وتعريفات المصدر والشركة', labelEn: 'Edit Carrier/Source properties', category: 'sources' },
  { id: 'delete_sources', labelAr: 'تكسير حبل الارتباط وحذف المصدر', labelEn: 'Delete Intake Carrier/Source', category: 'sources' },

  // Staff and Employees
  { id: 'view_employees', labelAr: 'رؤية كشف سجل الموظفين والمستحقات', labelEn: 'View Employees List', category: 'staff' },
  { id: 'add_employees', labelAr: 'توظيف وتسجيل موظف جديد وإنشاء حسابه المالي', labelEn: 'Enroll New Employees', category: 'staff' },
  { id: 'edit_employees', labelAr: 'تعديل بيانات وراتب الموظف', labelEn: 'Edit Employee Details & Salary', category: 'staff' },
  { id: 'delete_employees', labelAr: 'إلغاء وفصل سجل الموظف وحسابه المالي', labelEn: 'Delete Employee Records', category: 'staff' },

  // Staff and Users
  { id: 'view_users', labelAr: 'عرض شريط المستخدمين داخل المنظمة', labelEn: 'View Employee structures', category: 'staff' },
  { id: 'add_users', labelAr: 'توظيف وإضافة مستخدم للوحة التحكم', labelEn: 'Recruit New Dashboard Staff', category: 'staff' },
  { id: 'edit_users', labelAr: 'تعديل أدوار أو مسمى وظيفي للمستخدم', labelEn: 'Amend Staff metadata & Access Roles', category: 'staff' },
  { id: 'delete_users', labelAr: 'سحب رتبة وفسخ عقد حساب مستخدم', labelEn: 'Purge Dashboard Staff records', category: 'staff' },
  { id: 'reset_passwords', labelAr: 'إعادة تصفير وتعمين كلمات المرور الشخصية للموظفين', labelEn: 'Authorized Password Reset overrides', category: 'staff' },
  { id: 'disable_accounts', labelAr: 'توقيف نشاط أو تمطير حساب موظف', labelEn: 'Deactivate Staff permissions or suspend', category: 'staff' },
  { id: 'terminate_sessions', labelAr: 'فرض تسجيل خروج خارق وجبري على موظف', labelEn: 'Enforce Session Termination', category: 'staff' },
  { id: 'view_activity_log', labelAr: 'قراءة وفحص دفتر السجلات الشامل للنظام والتحركات', labelEn: 'View System activity & changes tracker log', category: 'staff' },

  // Roles
  { id: 'view_roles', labelAr: 'عرض الصلاحيات والأدوار', labelEn: 'View Roles & Permissions', category: 'staff' },
  { id: 'add_roles', labelAr: 'إنشاء أدوار وصلاحيات جديدة', labelEn: 'Create New Roles', category: 'staff' },
  { id: 'edit_roles', labelAr: 'تعديل الأدوار والصلاحيات', labelEn: 'Edit Roles & Permissions', category: 'staff' },
  { id: 'delete_roles', labelAr: 'حذف الأدوار', labelEn: 'Delete Roles', category: 'staff' },

  // Accounting and Expenses
  { id: 'view_finance', labelAr: 'عرض الدفاتر المالية وسندات القبض وبنود الصندوق', labelEn: 'View General Ledger & Cash vaults', category: 'accounting' },
  { id: 'add_finance', labelAr: 'تحرير وقبض ريالات السند المالي', labelEn: 'Issue and post Cash receipts & Vouchers', category: 'accounting' },
  { id: 'edit_finance', labelAr: 'تعديل أو تغيير بند في سند مقبوض', labelEn: 'Amend posted Auditing records', category: 'accounting' },
  { id: 'view_expenses', labelAr: 'متابعة وفلترة كشف المصروفات والمشتريات التشغيلية', labelEn: 'Inspect Business Operational Expenditure list', category: 'accounting' },
  { id: 'view_custody', labelAr: 'التلصص ومراقبة العهد المصروفة وتأرجحها مع الموظفين', labelEn: 'Review Custody balances held by staff', category: 'accounting' },
  { id: 'add_expenses', labelAr: 'صرف ريالات المصروف أو التكلفة التشغيلية', labelEn: 'Record New Expenditure receipt', category: 'accounting' },
  { id: 'edit_expenses', labelAr: 'تسوية وإقفال العهدة مع موظف والتحديث المالي المباشر', labelEn: 'Reconcile outstanding balances & settle custody', category: 'accounting' },
  { id: 'delete_expenses', labelAr: 'شطب وإبطال فاتورة من المصروفات والمدفوعات لتحديث السيولة', labelEn: 'Delete Expenditure record & reverse ledger', category: 'accounting' },
  { id: 'edit_exchange_rates', labelAr: 'تنظيم أسعار صرف وتحويل الدولار والريال السعودي بالYER', labelEn: 'Modify currency rates & exchange multipliers', category: 'accounting' },
  { id: 'view_financial_accounts', labelAr: 'عرض أرصدة الحسابات المالية وكشوفاتها', labelEn: 'View Financial Account Balances & Statements', category: 'accounting' },
  { id: 'manage_financial_accounts', labelAr: 'إدارة أرصدة الحسابات المالية وإجراء حركات تسوية يدوية', labelEn: 'Manage Financial Account Balances & Adjustments', category: 'accounting' },
  { id: 'edit_profit_per_kg', labelAr: 'تعديل نسبة الربح للكيلو لطلبات المصنع', labelEn: 'Edit Profit Per KG Rate (Factory Orders)', category: 'accounting' },
  { id: 'edit_cbm_shipping_rate', labelAr: 'تعديل سعر شحن الـ CBM لطلبات المصنع والموردين', labelEn: 'Edit CBM Shipping Rate (Factory Orders)', category: 'accounting' },

  // Reports
  { id: 'view_reports', labelAr: 'تأطير ورؤية تقارير جرد أرباح وحسابات الأنشطة', labelEn: 'Access Profit Analytics & Financial Reports', category: 'reports' },

  // Admin Settings
  { id: 'settings', labelAr: 'الولوج لقائمة الإعدادات العامة للنظام وحمايتها', labelEn: 'Access general system parameters screen', category: 'admin' },
  { id: 'edit_interface_settings', labelAr: 'إدارة وإعادة التنسيق لمظهر الواجهات والأحجام واللغة', labelEn: 'Configure themes, sizes, default locale', category: 'admin' },
  { id: 'edit_general_settings', labelAr: 'تعديل اسم النظام والعلامة التجارية والبادئات وعناوين العدادات', labelEn: 'Change System brand, prefix controls, starting seed', category: 'admin' },
  { id: 'edit_order_defaults', labelAr: 'تعديل الإعدادات الافتراضية للطلبات', labelEn: 'Edit Default Order Settings', category: 'admin' },
  { id: 'view_order_defaults', labelAr: 'عرض الإعدادات الافتراضية للطلبات', labelEn: 'View Default Order Settings', category: 'admin' },
  { id: 'edit_company_info', labelAr: 'تعديل كرت تعريف وسجل وعنوان الشركة والمستند الضريبي', labelEn: 'Update Corporate Card details & Tax Registration', category: 'admin' },
  { id: 'manage_whatsapp', labelAr: 'التحكم وحفظ مفاتيح ربط واتساب السحابي ودرجات التفعيل', labelEn: 'Configure UltraMsg/Twilio WhatsApp routing setups', category: 'admin' },
  { id: 'manage_backup', labelAr: 'التحكم وإجراء النسخ التلقائي وبناء ملفات استيراد وتوطين الكيانات والمطابقة للمدراء', labelEn: 'Perform Rebase backups: Import / Export datablocks', category: 'admin' },

  // Notifications
  { id: 'view_notifications', labelAr: 'عرض جرس الإشعارات وحالات التنبيه', labelEn: 'Display Alert system notification panel', category: 'notifications' },
  { id: 'view_edit_notification_settings', labelAr: 'عرض وتعديل إعدادات الإشعارات وقوالب WhatsApp', labelEn: 'View and Edit Notification Settings & WhatsApp Templates', category: 'notifications' },
  { id: 'send_notifications', labelAr: 'إطلاق وتجريب جرس الإشعار لمستخدمين مخصصين بشكل وهمي', labelEn: 'Send Custom Mock notifications', category: 'notifications' },
  { id: 'manage_notifications', labelAr: 'إدارة أواني التنبيهات وحذفها وإفراغ السجلات للتحسين', labelEn: 'Acknowledge, clear or delete logged notices', category: 'notifications' },
  { id: 'notify_orders', labelAr: 'استقبال وتلقي التنبيهات مع حركة كل إضافة/شحينة طلب', labelEn: 'Toggle dispatch alerts on Order activities', category: 'notifications' },
  { id: 'notify_finance', labelAr: 'استكشاف التنبيهات عند إقفال السندات والمدفوعات والمصاريف المفتوحة', labelEn: 'Toggle flash alarms on Accounting actions', category: 'notifications' },
  { id: 'notify_system', labelAr: 'الاستماع لأصوات الأمان والنسخ الاحتياطي وحماية الحذف المرفوعة', labelEn: 'Subscribe to Security events, rebase & database flags', category: 'notifications' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  Admin: ['*'],
  Employee: [
    'view_dashboard',
    'view_orders',
    'add_orders',
    'edit_orders',
    'update_order_status',
    'print_orders',
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
    'notify_orders',
    'notify_system',
  ],
  Accountant: [
    'view_dashboard',
    'view_orders',
    'view_finance',
    'add_finance',
    'edit_finance',
    'view_expenses',
    'view_custody',
    'add_expenses',
    'edit_expenses',
    'view_financial_accounts',
    'manage_financial_accounts',
    'view_reports',
    'view_sources',
    'add_sources',
    'edit_sources',
    'view_notifications',
    'notify_finance',
    'notify_system',
  ],
  Courier: [
    'view_orders',
    'update_order_status',
  ],
};
