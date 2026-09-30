/**
 * permissionGroups.ts
 * تعريف المجموعات والصلاحيات في صفحة إدارة المستخدمين
 * Permission groups definitions for User Management
 */

export const PERMISSION_GROUPS = (isAr: boolean) => [
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
      { id: 'delete_order_statuses', label: isAr ? 'حذف مرحلة طلب' : 'Delete Order Status Stage' },
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
      { id: 'view_general_entries', label: isAr ? 'استعراض القيود العامة' : 'View General Entries' },
      { id: 'create_general_entries', label: isAr ? 'إنشاء قيد عام جديد' : 'Create General Entry' },
      { id: 'edit_general_entries', label: isAr ? 'تعديل مسودات القيود العامة' : 'Edit General Entry Drafts' },
      { id: 'delete_general_entries', label: isAr ? 'حذف مسودات القيود العامة' : 'Delete General Entry Drafts' },
      { id: 'post_general_entries', label: isAr ? 'ترحيل واعتماد القيود العامة' : 'Post General Entries' },
      { id: 'print_general_entries', label: isAr ? 'طباعة القيود العامة' : 'Print General Entries' },
      { id: 'export_general_entries', label: isAr ? 'تصدير القيود العامة (CSV/XLS)' : 'Export General Entries' },
      { id: 'edit_posted_general_entries', label: isAr ? 'تعديل القيود العامة المرحّلة (صلاحية خاصة)' : 'Edit Posted General Entries' },
      { id: 'delete_posted_general_entries', label: isAr ? 'حذف القيود العامة المرحّلة (صلاحية خاصة)' : 'Delete Posted General Entries' },

      { id: 'view_compound_entries', label: isAr ? 'استعراض القيود المركبة' : 'View Compound Entries' },
      { id: 'create_compound_entries', label: isAr ? 'إنشاء قيد مركب جديد' : 'Create Compound Entry' },
      { id: 'edit_compound_entries', label: isAr ? 'تعديل مسودات القيود المركبة' : 'Edit Compound Entry Drafts' },
      { id: 'delete_compound_entries', label: isAr ? 'حذف مسودات القيود المركبة' : 'Delete Compound Entry Drafts' },
      { id: 'post_compound_entries', label: isAr ? 'ترحيل واعتماد القيود المركبة' : 'Post Compound Entries' },
      { id: 'print_compound_entries', label: isAr ? 'طباعة القيود المركبة' : 'Print Compound Entries' },
      { id: 'export_compound_entries', label: isAr ? 'تصدير القيود المركبة (CSV/XLS)' : 'Export Compound Entries' },
      { id: 'edit_posted_compound_entries', label: isAr ? 'تعديل القيود المركبة المرحّلة (صلاحية خاصة)' : 'Edit Posted Compound Entries' },
      { id: 'delete_posted_compound_entries', label: isAr ? 'حذف القيود المركبة المرحّلة (صلاحية خاصة)' : 'Delete Posted Compound Entries' },

      { id: 'view_temporary_entries', label: isAr ? 'استعراض القيود المؤقتة' : 'View Temporary Entries' },
      { id: 'create_temporary_entries', label: isAr ? 'إنشاء قيد مؤقت جديد' : 'Create Temporary Entry' },
      { id: 'edit_temporary_entries', label: isAr ? 'تعديل القيود المؤقتة' : 'Edit Temporary Entries' },
      { id: 'delete_temporary_entries', label: isAr ? 'حذف القيود المؤقتة' : 'Delete Temporary Entries' },
      { id: 'post_temporary_entries', label: isAr ? 'ترحيل واعتماد القيود المؤقتة' : 'Post Temporary Entries' },
      { id: 'print_temporary_entries', label: isAr ? 'طباعة القيود المؤقتة' : 'Print Temporary Entries' },
      { id: 'export_temporary_entries', label: isAr ? 'تصدير القيود المؤقتة (CSV/XLS)' : 'Export Temporary Entries' },
      { id: 'edit_posted_temporary_entries', label: isAr ? 'تعديل القيود المؤقتة المرحّلة (صلاحية خاصة)' : 'Edit Posted Temporary Entries' },
      { id: 'delete_posted_temporary_entries', label: isAr ? 'حذف القيود المؤقتة المرحّلة (صلاحية خاصة)' : 'Delete Posted Temporary Entries' },

      { id: 'reverse_financial_entries', label: isAr ? 'إنشاء قيود عكسية' : 'Create Reversing Entries' },
      { id: 'void_financial_entries', label: isAr ? 'إبطال القيود المرحّلة' : 'Void Posted Financial Entries' },
    ]
  },
  {
    group: isAr ? '🧾 سندات القبض والصرف' : '🧾 Receipt & Payment Vouchers',
    perms: [
      { id: 'view_receipt_vouchers', label: isAr ? 'استعراض سندات القبض' : 'View Receipt Vouchers' },
      { id: 'create_receipt_vouchers', label: isAr ? 'إنشاء سند قبض جديد (نقدي/بنكي/متعدد)' : 'Create Receipt Voucher' },
      { id: 'edit_receipt_vouchers', label: isAr ? 'تعديل مسودات سندات القبض' : 'Edit Receipt Voucher Drafts' },
      { id: 'delete_receipt_vouchers', label: isAr ? 'حذف مسودات سندات القبض' : 'Delete Receipt Voucher Drafts' },
      { id: 'post_receipt_vouchers', label: isAr ? 'ترحيل واعتماد سندات القبض' : 'Post Receipt Vouchers' },
      { id: 'print_receipt_vouchers', label: isAr ? 'طباعة سندات القبض' : 'Print Receipt Vouchers' },
      { id: 'export_receipt_vouchers', label: isAr ? 'تصدير سندات القبض (CSV/XLS)' : 'Export Receipt Vouchers' },
      { id: 'edit_posted_receipt_vouchers', label: isAr ? 'تعديل سندات القبض المرحّلة (صلاحية خاصة)' : 'Edit Posted Receipt Vouchers' },
      { id: 'delete_posted_receipt_vouchers', label: isAr ? 'حذف سندات القبض المرحّلة (صلاحية خاصة)' : 'Delete Posted Receipt Vouchers' },

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
    group: isAr ? '🗺️ مصادر الشراء والتوريد' : '🗺️ Purchase & Supply Sources',
    perms: [
      { id: 'view_sources', label: isAr ? 'عرض مصادر الشراء (تطبيقات ومصانع)' : 'View Purchase Sources (Apps & Factories)' },
      { id: 'add_sources', label: isAr ? 'إضافة مصدر شراء جديد' : 'Add New Purchase Source' },
      { id: 'edit_sources', label: isAr ? 'تعديل بيانات مصدر الشراء' : 'Edit Purchase Source' },
      { id: 'delete_sources', label: isAr ? 'حذف مصدر الشراء' : 'Delete Purchase Source' },
    ]
  },
  {
    group: isAr ? '🚛 شركات الشحن والنقل' : '🚛 Shipping Companies & Carriers',
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
    group: isAr ? '🧑‍💼 سجل الموظفين' : '🧑‍💼 Employees Ledger',
    perms: [
      { id: 'view_employees', label: isAr ? 'عرض سجل الموظفين والرواتب' : 'View Employees & Salaries' },
      { id: 'add_employees', label: isAr ? 'إضافة موظف جديد وإنشاء حسابه' : 'Enroll New Employee & Ledger' },
      { id: 'edit_employees', label: isAr ? 'تعديل بيانات الموظف والراتب' : 'Edit Employee Details & Salary' },
      { id: 'delete_employees', label: isAr ? 'حذف الموظف وحسابه المالي' : 'Delete Employee & Financial Account' },
    ]
  },
  {
    group: isAr ? '👤 مستخدمو النظام' : '👤 System Users (Dashboard Accounts)',
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

export const ALL_PERMISSIONS = (isAr: boolean) =>
  PERMISSION_GROUPS(isAr).flatMap(g => g.perms);
