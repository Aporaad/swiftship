/**
 * ثوابت أسماء الصلاحيات الموحدة للنظام
 * Unified Permission Name Constants for SWIFTSHIP System
 *
 * هذا الملف هو المرجع الوحيد لأسماء الصلاحيات في الواجهة.
 * This file is the single source of truth for permission keys in the UI.
 *
 * قواعد الاستخدام:
 * - استخدم هذه الثوابت بدلاً من الأسماء المباشرة كـ 'edit_orders'
 * - لا يتم اتخاذ قرار الصلاحية النهائي في الواجهة — فقط إخفاء/إظهار عناصر UI
 * - التحقق النهائي يبقى في طرف الخادم
 *
 * Usage rules:
 * - Use these constants instead of magic strings like 'edit_orders'
 * - Final authorization decisions are NOT made in the UI — only UI element visibility
 * - Server-side validation remains the authoritative check
 */

// ── لوحة التحكم / Dashboard ──────────────────────────────────
export const PERM = {
  // عام / General
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_STATISTICS: 'view_statistics',

  // الطلبات / Orders
  VIEW_ORDERS: 'view_orders',
  ADD_ORDERS: 'add_orders',
  EDIT_ORDERS: 'edit_orders',
  DELETE_ORDERS: 'delete_orders',
  DELETE_PAID_ORDERS: 'delete_paid_orders',
  EDIT_DELIVERED_ORDERS: 'edit_delivered_orders',
  UPDATE_ORDER_STATUS: 'update_order_status',
  TRACK_ORDER: 'track_order',
  PRINT_ORDERS: 'print_orders',
  EXPORT_ORDERS: 'export_orders',
  EDIT_ORDER_DEFAULTS_CREATION: 'edit_order_defaults_creation',
  UNPOST_POSTED_ORDERS: 'unpost_posted_orders',

  // مراحل الطلب / Order Statuses
  VIEW_ORDER_STATUSES: 'view_order_statuses',
  ADD_ORDER_STATUSES: 'add_order_statuses',
  EDIT_ORDER_STATUSES: 'edit_order_statuses',
  DELETE_ORDER_STATUSES: 'delete_order_statuses',

  // القيود التلقائية / Auto Entries
  VIEW_AUTO_ENTRIES: 'view_auto_entries',
  ADD_AUTO_ENTRIES: 'add_auto_entries',
  EDIT_AUTO_ENTRIES: 'edit_auto_entries',
  DELETE_AUTO_ENTRIES: 'delete_auto_entries',

  // المنتجات / Products
  VIEW_PRODUCTS: 'view_products',
  ADD_PRODUCTS: 'add_products',
  EDIT_PRODUCTS: 'edit_products',
  DELETE_PRODUCTS: 'delete_products',
  VIEW_ORDER_ITEMS: 'view_order_items',
  EDIT_ORDER_ITEMS: 'edit_order_items',
  RETURN_ORDER_ITEMS: 'return_order_items',

  // العملاء / Customers
  VIEW_CUSTOMERS: 'view_customers',
  ADD_CUSTOMERS: 'add_customers',
  EDIT_CUSTOMERS: 'edit_customers',
  DELETE_CUSTOMERS: 'delete_customers',

  // المناديب / Couriers
  VIEW_COURIERS: 'view_couriers',
  ADD_COURIERS: 'add_couriers',
  EDIT_COURIERS: 'edit_couriers',
  DELETE_COURIERS: 'delete_couriers',

  // المصادر / Sources
  VIEW_SOURCES: 'view_sources',
  ADD_SOURCES: 'add_sources',
  EDIT_SOURCES: 'edit_sources',
  DELETE_SOURCES: 'delete_sources',

  // شركات الشحن / Shipping Companies
  VIEW_SHIPPING_COMPANIES: 'view_shipping_companies',
  ADD_SHIPPING_COMPANIES: 'add_shipping_companies',
  EDIT_SHIPPING_COMPANIES: 'edit_shipping_companies',
  DELETE_SHIPPING_COMPANIES: 'delete_shipping_companies',

  // الموظفون / Employees
  VIEW_EMPLOYEES: 'view_employees',
  ADD_EMPLOYEES: 'add_employees',
  EDIT_EMPLOYEES: 'edit_employees',
  DELETE_EMPLOYEES: 'delete_employees',

  // المستخدمون / Users
  VIEW_USERS: 'view_users',
  ADD_USERS: 'add_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  RESET_PASSWORDS: 'reset_passwords',
  DISABLE_ACCOUNTS: 'disable_accounts',
  TERMINATE_SESSIONS: 'terminate_sessions',
  VIEW_ACTIVITY_LOG: 'view_activity_log',

  // الأدوار / Roles
  VIEW_ROLES: 'view_roles',
  ADD_ROLES: 'add_roles',
  EDIT_ROLES: 'edit_roles',
  DELETE_ROLES: 'delete_roles',

  // المالية / Accounting
  VIEW_FINANCE: 'view_finance',
  ADD_FINANCE: 'add_finance',
  EDIT_FINANCE: 'edit_finance',
  VIEW_EXPENSES: 'view_expenses',
  VIEW_CUSTODY: 'view_custody',
  ADD_EXPENSES: 'add_expenses',
  EDIT_EXPENSES: 'edit_expenses',
  DELETE_EXPENSES: 'delete_expenses',
  EDIT_EXCHANGE_RATES: 'edit_exchange_rates',
  EDIT_PROFIT_PER_KG: 'edit_profit_per_kg',
  EDIT_CBM_SHIPPING_RATE: 'edit_cbm_shipping_rate',

  // الحسابات المالية / Financial Accounts
  VIEW_FINANCIAL_ACCOUNTS: 'view_financial_accounts',
  MANAGE_FINANCIAL_ACCOUNTS: 'manage_financial_accounts',
  VIEW_ACCOUNT_MOVEMENTS: 'view_account_movements',
  EXPORT_ACCOUNT_MOVEMENTS: 'export_account_movements',
  PRINT_ACCOUNT_MOVEMENTS: 'print_account_movements',

  // القيود العامة / General Entries
  VIEW_GENERAL_ENTRIES: 'view_general_entries',
  CREATE_GENERAL_ENTRIES: 'create_general_entries',
  EDIT_GENERAL_ENTRIES: 'edit_general_entries',
  DELETE_GENERAL_ENTRIES: 'delete_general_entries',
  PRINT_GENERAL_ENTRIES: 'print_general_entries',
  EXPORT_GENERAL_ENTRIES: 'export_general_entries',
  POST_GENERAL_ENTRIES: 'post_general_entries',
  EDIT_POSTED_GENERAL_ENTRIES: 'edit_posted_general_entries',
  DELETE_POSTED_GENERAL_ENTRIES: 'delete_posted_general_entries',

  // القيود المركبة / Compound Entries
  VIEW_COMPOUND_ENTRIES: 'view_compound_entries',
  CREATE_COMPOUND_ENTRIES: 'create_compound_entries',
  EDIT_COMPOUND_ENTRIES: 'edit_compound_entries',
  DELETE_COMPOUND_ENTRIES: 'delete_compound_entries',
  PRINT_COMPOUND_ENTRIES: 'print_compound_entries',
  EXPORT_COMPOUND_ENTRIES: 'export_compound_entries',
  POST_COMPOUND_ENTRIES: 'post_compound_entries',
  EDIT_POSTED_COMPOUND_ENTRIES: 'edit_posted_compound_entries',
  DELETE_POSTED_COMPOUND_ENTRIES: 'delete_posted_compound_entries',

  // القيود المؤقتة / Temporary Entries
  VIEW_TEMPORARY_ENTRIES: 'view_temporary_entries',
  CREATE_TEMPORARY_ENTRIES: 'create_temporary_entries',
  EDIT_TEMPORARY_ENTRIES: 'edit_temporary_entries',
  DELETE_TEMPORARY_ENTRIES: 'delete_temporary_entries',
  PRINT_TEMPORARY_ENTRIES: 'print_temporary_entries',
  EXPORT_TEMPORARY_ENTRIES: 'export_temporary_entries',
  EDIT_POSTED_TEMPORARY_ENTRIES: 'edit_posted_temporary_entries',
  DELETE_POSTED_TEMPORARY_ENTRIES: 'delete_posted_temporary_entries',

  // سندات القبض / Receipt Vouchers
  VIEW_RECEIPT_VOUCHERS: 'view_receipt_vouchers',
  CREATE_RECEIPT_VOUCHERS: 'create_receipt_vouchers',
  EDIT_RECEIPT_VOUCHERS: 'edit_receipt_vouchers',
  DELETE_RECEIPT_VOUCHERS: 'delete_receipt_vouchers',
  PRINT_RECEIPT_VOUCHERS: 'print_receipt_vouchers',
  EXPORT_RECEIPT_VOUCHERS: 'export_receipt_vouchers',
  POST_RECEIPT_VOUCHERS: 'post_receipt_vouchers',
  EDIT_POSTED_RECEIPT_VOUCHERS: 'edit_posted_receipt_vouchers',
  DELETE_POSTED_RECEIPT_VOUCHERS: 'delete_posted_receipt_vouchers',

  // سندات الصرف / Payment Vouchers
  VIEW_PAYMENT_VOUCHERS: 'view_payment_vouchers',
  CREATE_PAYMENT_VOUCHERS: 'create_payment_vouchers',
  EDIT_PAYMENT_VOUCHERS: 'edit_payment_vouchers',
  DELETE_PAYMENT_VOUCHERS: 'delete_payment_vouchers',
  PRINT_PAYMENT_VOUCHERS: 'print_payment_vouchers',
  EXPORT_PAYMENT_VOUCHERS: 'export_payment_vouchers',
  POST_PAYMENT_VOUCHERS: 'post_payment_vouchers',
  EDIT_POSTED_PAYMENT_VOUCHERS: 'edit_posted_payment_vouchers',
  DELETE_POSTED_PAYMENT_VOUCHERS: 'delete_posted_payment_vouchers',

  // العهد والسلف / Custody Advances
  VIEW_CUSTODY_ADVANCES: 'view_custody_advances',
  CREATE_CUSTODY_ADVANCES: 'create_custody_advances',
  EDIT_CUSTODY_ADVANCES: 'edit_custody_advances',
  DELETE_CUSTODY_ADVANCES: 'delete_custody_advances',
  SETTLE_CUSTODY_ADVANCES: 'settle_custody_advances',

  // إعدادات القيود / Entry Settings
  VIEW_ENTRY_SETTINGS: 'view_entry_settings',
  CREATE_ENTRY_SETTINGS: 'create_entry_settings',
  EDIT_ENTRY_SETTINGS: 'edit_entry_settings',
  DELETE_ENTRY_SETTINGS: 'delete_entry_settings',

  // الترحيل والعكس / Posting & Reversal
  POST_FINANCIAL_ENTRIES: 'post_financial_entries',
  POST_TEMPORARY_ENTRIES: 'post_temporary_entries',
  REVERSE_FINANCIAL_ENTRIES: 'reverse_financial_entries',
  VOID_FINANCIAL_ENTRIES: 'void_financial_entries',

  // التقارير / Reports
  VIEW_REPORTS: 'view_reports',

  // الإعدادات / Settings
  SETTINGS: 'settings',
  EDIT_INTERFACE_SETTINGS: 'edit_interface_settings',
  EDIT_GENERAL_SETTINGS: 'edit_general_settings',
  EDIT_ORDER_DEFAULTS: 'edit_order_defaults',
  VIEW_ORDER_DEFAULTS: 'view_order_defaults',
  EDIT_COMPANY_INFO: 'edit_company_info',
  MANAGE_WHATSAPP: 'manage_whatsapp',
  MANAGE_BACKUP: 'manage_backup',
  VIEW_EDIT_NOTIFICATION_SETTINGS: 'view_edit_notification_settings',

  // إدارة الموقع / Site Management
  VIEW_WEBSITE_MANAGEMENT: 'view_website_management',
  MANAGE_WEBSITE: 'manage_website',

  // الإشعارات / Notifications
  VIEW_NOTIFICATIONS: 'view_notifications',
  SEND_NOTIFICATIONS: 'send_notifications',
  MANAGE_NOTIFICATIONS: 'manage_notifications',
  NOTIFY_ORDERS: 'notify_orders',
  NOTIFY_FINANCE: 'notify_finance',
  NOTIFY_SYSTEM: 'notify_system',
} as const;

/** نوع مشتق من قيم ثوابت PERM — Type derived from PERM values */
export type PermissionName = typeof PERM[keyof typeof PERM];
