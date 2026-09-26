-- =============================================================================
-- Migration: 202609170001_rename_primary_keys_to_table_id.sql
-- Description: إعادة تسمية المفاتيح الرئيسية (Primary Keys) من `id` إلى
--              `[table_singular]_id` لجميع جداول النظام العامة.
--              Rename all `id` PKs to `[singular_table_name]_id` across all
--              public schema tables, updating all FK constraints accordingly.
-- Author: Antigravity AI
-- Date: 2026-09-17
-- Rules: snake_case for DB, camelCase for System/TypeScript
-- =============================================================================

BEGIN;

-- =============================================================================
-- الخطوة 0: تعطيل مؤقت للتريجرات الخاصة بنا لتجنب مشاكل أثناء الهجرة
-- Step 0: Temporarily disable relevant triggers to avoid conflicts during migration
-- =============================================================================
SET session_replication_role = 'replica';

-- =============================================================================
-- الخطوة 1: حذف جميع قيود المفاتيح الأجنبية (FK) المرتبطة بـ `id`
-- Step 1: Drop all FK constraints that reference `id` columns to be renamed
-- The order matters: child tables first, then parent tables
-- =============================================================================

-- حذف FK المرتبطة بـ users.id
ALTER TABLE public.account_trans      DROP CONSTRAINT IF EXISTS account_trans_created_by_uid_fkey;
ALTER TABLE public.account_trans      DROP CONSTRAINT IF EXISTS account_trans_updated_by_uid_fkey;
ALTER TABLE public.activity_logs      DROP CONSTRAINT IF EXISTS "activity_logs_userId_fkey";
ALTER TABLE public.announcements      DROP CONSTRAINT IF EXISTS "announcements_createdBy_fkey";
ALTER TABLE public.custody_advances   DROP CONSTRAINT IF EXISTS custody_advances_created_by_uid_fkey;
ALTER TABLE public.custody_advances   DROP CONSTRAINT IF EXISTS custody_advances_issued_by_uid_fkey;
ALTER TABLE public.custody_advances   DROP CONSTRAINT IF EXISTS custody_advances_settled_by_uid_fkey;
ALTER TABLE public.custody_advances   DROP CONSTRAINT IF EXISTS custody_advances_updated_by_uid_fkey;
ALTER TABLE public.entry_module       DROP CONSTRAINT IF EXISTS entry_module_created_by_uid_fkey;
ALTER TABLE public.entry_module       DROP CONSTRAINT IF EXISTS entry_module_updated_by_uid_fkey;
ALTER TABLE public.entry_payment_details DROP CONSTRAINT IF EXISTS entry_payment_details_created_by_uid_fkey;
ALTER TABLE public.entry_payment_details DROP CONSTRAINT IF EXISTS entry_payment_details_updated_by_uid_fkey;
ALTER TABLE public.entry_type         DROP CONSTRAINT IF EXISTS entry_type_created_by_uid_fkey;
ALTER TABLE public.entry_type         DROP CONSTRAINT IF EXISTS entry_type_updated_by_uid_fkey;
ALTER TABLE public.financial_legacy_migration_map DROP CONSTRAINT IF EXISTS financial_legacy_migration_map_verified_by_uid_fkey;
ALTER TABLE public.financial_migration_exceptions DROP CONSTRAINT IF EXISTS financial_migration_exceptions_resolved_by_uid_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_created_by_uid_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_posted_by_uid_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_updated_by_uid_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_voided_by_uid_fkey;
ALTER TABLE public.salary_history     DROP CONSTRAINT IF EXISTS salary_history_user_id_fkey;
ALTER TABLE public.sessions           DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE public.user_settings      DROP CONSTRAINT IF EXISTS "user_settings_userId_fkey";
ALTER TABLE public.user_settings      DROP CONSTRAINT IF EXISTS "user_settings_portal_userId_fkey";
ALTER TABLE public.users              DROP CONSTRAINT IF EXISTS user_roleId_fkey;

-- حذف FK المرتبطة بـ orders.id
ALTER TABLE public.account_trans      DROP CONSTRAINT IF EXISTS account_trans_order_id_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_order_id_fkey;
ALTER TABLE public.order_items        DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.orders_history     DROP CONSTRAINT IF EXISTS orders_history_order_id_fkey;
ALTER TABLE public.shipments          DROP CONSTRAINT IF EXISTS shipments_order_id_fkey;

-- حذف FK المرتبطة بـ customers.id
ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

-- حذف FK المرتبطة بـ employees.id
ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_employee_id_fkey;

-- حذف FK المرتبطة بـ couriers.id
ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_courier_id_fkey;
ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_delivery_courier_id_fkey;
ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_shipping_courier_id_fkey;

-- حذف FK المرتبطة بـ shipments.id
ALTER TABLE public.account_trans      DROP CONSTRAINT IF EXISTS account_trans_shipment_id_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_shipment_id_fkey;
ALTER TABLE public.orders_history     DROP CONSTRAINT IF EXISTS orders_history_shipment_id_fkey;

-- حذف FK المرتبطة بـ accounts.id
ALTER TABLE public.account_trans      DROP CONSTRAINT IF EXISTS account_trans_account_id_fkey;
ALTER TABLE public.assets             DROP CONSTRAINT IF EXISTS assets_account_id_fkey;
ALTER TABLE public.couriers           DROP CONSTRAINT IF EXISTS couriers_account_id_fkey;
ALTER TABLE public.customers          DROP CONSTRAINT IF EXISTS customers_account_id_fkey;
ALTER TABLE public.default_accounts   DROP CONSTRAINT IF EXISTS default_accounts_account_id_fkey;
ALTER TABLE public.employees          DROP CONSTRAINT IF EXISTS employees_account_id_fkey;
ALTER TABLE public.entry_payment_details DROP CONSTRAINT IF EXISTS entry_payment_details_account_id_fkey;
ALTER TABLE public.expenses           DROP CONSTRAINT IF EXISTS expenses_account_id_fkey;
ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_order_party_account_id_fkey;
ALTER TABLE public.salary_history     DROP CONSTRAINT IF EXISTS salary_history_account_id_fkey;
ALTER TABLE public.shipping_companies DROP CONSTRAINT IF EXISTS shipping_companies_account_id_fkey;
ALTER TABLE public.sources            DROP CONSTRAINT IF EXISTS sources_account_id_fkey;
ALTER TABLE public.custody_advances   DROP CONSTRAINT IF EXISTS custody_advances_recipient_account_id_fkey;

-- حذف FK المرتبطة بـ main_entry.id
ALTER TABLE public.account_trans      DROP CONSTRAINT IF EXISTS account_trans_entry_id_fkey;
ALTER TABLE public.custody_advances   DROP CONSTRAINT IF EXISTS custody_advances_issued_entry_id_fkey;
ALTER TABLE public.custody_advances   DROP CONSTRAINT IF EXISTS custody_advances_settlement_entry_id_fkey;
ALTER TABLE public.entry_payment_details DROP CONSTRAINT IF EXISTS entry_payment_details_entry_id_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_reverses_entry_id_fkey;
ALTER TABLE public.orders_history     DROP CONSTRAINT IF EXISTS orders_history_main_entry_id_fkey;

-- حذف FK المرتبطة بـ custody_advances.id
ALTER TABLE public.account_trans      DROP CONSTRAINT IF EXISTS account_trans_custody_id_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_custody_id_fkey;

-- حذف FK المرتبطة بـ roles.id
-- users.role -> roles.id (تم حذفها بالأعلى مع users)

-- حذف FK المرتبطة بـ sources.id
ALTER TABLE public.order_items        DROP CONSTRAINT IF EXISTS order_items_produc_source_id_fkey;
ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_order_source_id_fkey;

-- حذف FK المرتبطة بـ order_status.id
ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_order_status_id_fkey;

-- حذف FK المرتبطة بـ items_category.id
ALTER TABLE public.products           DROP CONSTRAINT IF EXISTS products_item_category_id_fkey;
ALTER TABLE public.shipments          DROP CONSTRAINT IF EXISTS shipments_content_category_id_fkey;

-- حذف FK المرتبطة بـ entry_module.id
ALTER TABLE public.entry_type         DROP CONSTRAINT IF EXISTS entry_type_module_id_fkey;
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_module_id_fkey;

-- حذف FK المرتبطة بـ entry_type.id
ALTER TABLE public.main_entry         DROP CONSTRAINT IF EXISTS main_entry_entry_type_id_fkey;

-- حذف FK المرتبطة بـ order_option.id
ALTER TABLE public.order_items        DROP CONSTRAINT IF EXISTS order_items_packaging_option_id_fkey;

-- حذف FK المرتبطة بـ portal_users.id
ALTER TABLE public.portal_tickets     DROP CONSTRAINT IF EXISTS "portal_tickets_portal_userId_fkey";

-- حذف FK المرتبطة بـ acc_main.id
ALTER TABLE public.acc_sub            DROP CONSTRAINT IF EXISTS acc_sub_acc_main_id_fkey;

-- حذف FK المرتبطة بـ acc_sub.id
ALTER TABLE public.acc_sub_group      DROP CONSTRAINT IF EXISTS acc_sub_group_acc_sub_id_fkey;
ALTER TABLE public.accounts           DROP CONSTRAINT IF EXISTS accounts_acc_sub_id_fkey;

-- حذف FK المرتبطة بـ acc_sub_group.id
ALTER TABLE public.accounts           DROP CONSTRAINT IF EXISTS accounts_group_id_fkey;

-- حذف FK المرتبطة بـ account.id (جدول account المالي)
ALTER TABLE public.acc_main           DROP CONSTRAINT IF EXISTS acc_main_account_id_fkey;

-- حذف FK المرتبطة بـ order_items.items_id (يُعاد تسميتها لـ order_item_id)
ALTER TABLE public.returned_products  DROP CONSTRAINT IF EXISTS returned_products_order_item_id_fkey;

-- =============================================================================
-- الخطوة 2: إعادة تسمية الـ PKs في الجداول (ترتيب: الجداول المستقلة أولاً)
-- Step 2: Rename PKs - independent/leaf tables first, then parent tables
-- =============================================================================

-- --- جداول مستقلة (Independent Tables) ---

-- roles: id -> role_id
ALTER TABLE public.roles RENAME COLUMN id TO role_id;

-- order_status: id -> order_status_id
ALTER TABLE public.order_status RENAME COLUMN id TO order_status_id;

-- order_option: id -> order_option_id
ALTER TABLE public.order_option RENAME COLUMN id TO order_option_id;

-- items_category: id -> items_category_id
ALTER TABLE public.items_category RENAME COLUMN id TO items_category_id;

-- settings: id -> setting_id
ALTER TABLE public.settings RENAME COLUMN id TO setting_id;

-- report_settings: id -> report_setting_id
ALTER TABLE public.report_settings RENAME COLUMN id TO report_setting_id;

-- report_templates: id -> report_template_id
ALTER TABLE public.report_templates RENAME COLUMN id TO report_template_id;

-- browser_pages: id -> browser_page_id
ALTER TABLE public.browser_pages RENAME COLUMN id TO browser_page_id;

-- whatsapp_logs: id -> whatsapp_log_id
ALTER TABLE public.whatsapp_logs RENAME COLUMN id TO whatsapp_log_id;

-- notifications: id -> notification_id
ALTER TABLE public.notifications RENAME COLUMN id TO notification_id;

-- jobs_req: id -> jobs_req_id
ALTER TABLE public.jobs_req RENAME COLUMN id TO jobs_req_id;

-- announcements: id -> announcement_id
ALTER TABLE public.announcements RENAME COLUMN id TO announcement_id;

-- --- account: id -> account_id (الجدول المالي الهرمي المستقل) ---
ALTER TABLE public.account RENAME COLUMN id TO account_id;

-- --- acc_main: id -> acc_main_id ---
ALTER TABLE public.acc_main RENAME COLUMN id TO acc_main_id;

-- --- acc_sub: id -> acc_sub_id ---
ALTER TABLE public.acc_sub RENAME COLUMN id TO acc_sub_id;

-- --- acc_sub_group: id -> acc_sub_group_id ---
ALTER TABLE public.acc_sub_group RENAME COLUMN id TO acc_sub_group_id;

-- --- entry_module: id -> entry_module_id ---
ALTER TABLE public.entry_module RENAME COLUMN id TO entry_module_id;

-- --- entry_type: id -> entry_type_id ---
ALTER TABLE public.entry_type RENAME COLUMN id TO entry_type_id;

-- --- users: id -> user_id ---
ALTER TABLE public.users RENAME COLUMN id TO user_id;

-- --- portal_users: id -> portal_user_id ---
ALTER TABLE public.portal_users RENAME COLUMN id TO portal_user_id;

-- --- sessions: id -> session_id ---
ALTER TABLE public.sessions RENAME COLUMN id TO session_id;

-- --- accounts: id -> account_id (جدول الحسابات الرئيسي) ---
ALTER TABLE public.accounts RENAME COLUMN id TO account_id;

-- --- sources: id -> source_id ---
ALTER TABLE public.sources RENAME COLUMN id TO source_id;

-- --- shipping_companies: id -> shipping_company_id ---
ALTER TABLE public.shipping_companies RENAME COLUMN id TO shipping_company_id;

-- --- customers: id -> customer_id ---
ALTER TABLE public.customers RENAME COLUMN id TO customer_id;

-- --- employees: id -> employee_id ---
ALTER TABLE public.employees RENAME COLUMN id TO employee_id;

-- --- couriers: id -> courier_id ---
ALTER TABLE public.couriers RENAME COLUMN id TO courier_id;

-- --- assets: id -> asset_id ---
ALTER TABLE public.assets RENAME COLUMN id TO asset_id;

-- --- products: product_id يبقى كما هو (بالفعل صحيح) ---
-- products.product_id is already correctly named, no change needed

-- --- orders: id -> order_id ---
ALTER TABLE public.orders RENAME COLUMN id TO order_id;

-- --- shipments: id -> shipment_id ---
ALTER TABLE public.shipments RENAME COLUMN id TO shipment_id;

-- --- order_items: items_id -> order_item_id ---
ALTER TABLE public.order_items RENAME COLUMN items_id TO order_item_id;

-- --- returned_products: return_id يبقى كما هو (بالفعل صحيح) ---
-- returned_products.return_id is already correctly named, no change needed

-- --- main_entry: id -> main_entry_id ---
ALTER TABLE public.main_entry RENAME COLUMN id TO main_entry_id;

-- --- account_trans: id -> account_trans_id ---
ALTER TABLE public.account_trans RENAME COLUMN id TO account_trans_id;

-- --- custody_advances: id -> custody_advance_id ---
ALTER TABLE public.custody_advances RENAME COLUMN id TO custody_advance_id;

-- --- orders_history: id -> orders_history_id ---
ALTER TABLE public.orders_history RENAME COLUMN id TO orders_history_id;

-- --- activity_logs: id -> activity_log_id ---
ALTER TABLE public.activity_logs RENAME COLUMN id TO activity_log_id;

-- --- auto_entries: id -> auto_entry_id ---
ALTER TABLE public.auto_entries RENAME COLUMN id TO auto_entry_id;

-- --- entry_payment_details: id -> entry_payment_detail_id ---
ALTER TABLE public.entry_payment_details RENAME COLUMN id TO entry_payment_detail_id;

-- --- expenses: id -> expense_id ---
ALTER TABLE public.expenses RENAME COLUMN id TO expense_id;

-- --- salary_history: id -> salary_history_id ---
ALTER TABLE public.salary_history RENAME COLUMN id TO salary_history_id;

-- --- cust_details: id -> cust_detail_id ---
ALTER TABLE public.cust_details RENAME COLUMN id TO cust_detail_id;

-- --- portal_tickets: id -> portal_ticket_id ---
ALTER TABLE public.portal_tickets RENAME COLUMN id TO portal_ticket_id;

-- --- user_settings: id -> user_setting_id ---
ALTER TABLE public.user_settings RENAME COLUMN id TO user_setting_id;

-- --- default_accounts: id -> default_account_id ---
ALTER TABLE public.default_accounts RENAME COLUMN id TO default_account_id;

-- --- account_id_migration_map: id -> migration_map_id ---
ALTER TABLE public.account_id_migration_map RENAME COLUMN id TO migration_map_id;

-- --- financial_migration_exceptions: id -> migration_exception_id ---
ALTER TABLE public.financial_migration_exceptions RENAME COLUMN id TO migration_exception_id;

-- =============================================================================
-- الخطوة 3: إعادة إنشاء قيود المفاتيح الأجنبية (FK Constraints)
-- Step 3: Recreate all FK constraints using the new column names
-- =============================================================================

-- FK المرتبطة بـ users.user_id
ALTER TABLE public.account_trans
  ADD CONSTRAINT account_trans_created_by_uid_fkey
  FOREIGN KEY (created_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.account_trans
  ADD CONSTRAINT account_trans_updated_by_uid_fkey
  FOREIGN KEY (updated_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(user_id);

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(user_id);

ALTER TABLE public.custody_advances
  ADD CONSTRAINT custody_advances_created_by_uid_fkey
  FOREIGN KEY (created_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.custody_advances
  ADD CONSTRAINT custody_advances_issued_by_uid_fkey
  FOREIGN KEY (issued_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.custody_advances
  ADD CONSTRAINT custody_advances_settled_by_uid_fkey
  FOREIGN KEY (settled_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.custody_advances
  ADD CONSTRAINT custody_advances_updated_by_uid_fkey
  FOREIGN KEY (updated_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.entry_module
  ADD CONSTRAINT entry_module_created_by_uid_fkey
  FOREIGN KEY (created_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.entry_module
  ADD CONSTRAINT entry_module_updated_by_uid_fkey
  FOREIGN KEY (updated_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.entry_payment_details
  ADD CONSTRAINT entry_payment_details_created_by_uid_fkey
  FOREIGN KEY (created_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.entry_payment_details
  ADD CONSTRAINT entry_payment_details_updated_by_uid_fkey
  FOREIGN KEY (updated_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.entry_type
  ADD CONSTRAINT entry_type_created_by_uid_fkey
  FOREIGN KEY (created_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.entry_type
  ADD CONSTRAINT entry_type_updated_by_uid_fkey
  FOREIGN KEY (updated_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.financial_legacy_migration_map
  ADD CONSTRAINT financial_legacy_migration_map_verified_by_uid_fkey
  FOREIGN KEY (verified_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.financial_migration_exceptions
  ADD CONSTRAINT financial_migration_exceptions_resolved_by_uid_fkey
  FOREIGN KEY (resolved_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_created_by_uid_fkey
  FOREIGN KEY (created_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_posted_by_uid_fkey
  FOREIGN KEY (posted_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_updated_by_uid_fkey
  FOREIGN KEY (updated_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_voided_by_uid_fkey
  FOREIGN KEY (voided_by_uid) REFERENCES public.users(user_id);

ALTER TABLE public.salary_history
  ADD CONSTRAINT salary_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(user_id);

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(user_id);

ALTER TABLE public.users
  ADD CONSTRAINT user_role_id_fkey
  FOREIGN KEY (role) REFERENCES public.roles(role_id);

-- FK المرتبطة بـ portal_users.portal_user_id
ALTER TABLE public.portal_tickets
  ADD CONSTRAINT portal_tickets_portal_user_id_fkey
  FOREIGN KEY (user_uid) REFERENCES public.portal_users(portal_user_id);

-- FK المرتبطة بـ user_settings (مزدوجة: users & portal_users)
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_user_id_fkey
  FOREIGN KEY (userid) REFERENCES public.users(user_id);

-- FK المرتبطة بـ orders.order_id
ALTER TABLE public.account_trans
  ADD CONSTRAINT account_trans_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(order_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(order_id);

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(order_id);

ALTER TABLE public.orders_history
  ADD CONSTRAINT orders_history_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(order_id);

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(order_id);

-- FK المرتبطة بـ customers.customer_id
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);

-- FK المرتبطة بـ employees.employee_id
ALTER TABLE public.orders
  ADD CONSTRAINT orders_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);

-- FK المرتبطة بـ couriers.courier_id
ALTER TABLE public.orders
  ADD CONSTRAINT orders_courier_id_fkey
  FOREIGN KEY (courier_id) REFERENCES public.couriers(courier_id);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_courier_id_fkey
  FOREIGN KEY (delivery_courier_id) REFERENCES public.couriers(courier_id);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_courier_id_fkey
  FOREIGN KEY (shipping_courier_id) REFERENCES public.couriers(courier_id);

-- FK المرتبطة بـ shipments.shipment_id
ALTER TABLE public.account_trans
  ADD CONSTRAINT account_trans_shipment_id_fkey
  FOREIGN KEY (shipment_id) REFERENCES public.shipments(shipment_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_shipment_id_fkey
  FOREIGN KEY (shipment_id) REFERENCES public.shipments(shipment_id);

ALTER TABLE public.orders_history
  ADD CONSTRAINT orders_history_shipment_id_fkey
  FOREIGN KEY (shipment_id) REFERENCES public.shipments(shipment_id);

-- FK المرتبطة بـ accounts.account_id
ALTER TABLE public.account_trans
  ADD CONSTRAINT account_trans_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.assets
  ADD CONSTRAINT assets_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.default_accounts
  ADD CONSTRAINT default_accounts_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.employees
  ADD CONSTRAINT employees_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.entry_payment_details
  ADD CONSTRAINT entry_payment_details_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_party_account_id_fkey
  FOREIGN KEY (order_party_account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.salary_history
  ADD CONSTRAINT salary_history_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.shipping_companies
  ADD CONSTRAINT shipping_companies_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.sources
  ADD CONSTRAINT sources_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(account_id);

ALTER TABLE public.custody_advances
  ADD CONSTRAINT custody_advances_recipient_account_id_fkey
  FOREIGN KEY (recipient_account_id) REFERENCES public.accounts(account_id);

-- FK المرتبطة بـ main_entry.main_entry_id
ALTER TABLE public.account_trans
  ADD CONSTRAINT account_trans_entry_id_fkey
  FOREIGN KEY (entry_id) REFERENCES public.main_entry(main_entry_id);

ALTER TABLE public.custody_advances
  ADD CONSTRAINT custody_advances_issued_entry_id_fkey
  FOREIGN KEY (issued_entry_id) REFERENCES public.main_entry(main_entry_id);

ALTER TABLE public.custody_advances
  ADD CONSTRAINT custody_advances_settlement_entry_id_fkey
  FOREIGN KEY (settlement_entry_id) REFERENCES public.main_entry(main_entry_id);

ALTER TABLE public.entry_payment_details
  ADD CONSTRAINT entry_payment_details_entry_id_fkey
  FOREIGN KEY (entry_id) REFERENCES public.main_entry(main_entry_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_reverses_entry_id_fkey
  FOREIGN KEY (reverses_entry_id) REFERENCES public.main_entry(main_entry_id);

ALTER TABLE public.orders_history
  ADD CONSTRAINT orders_history_main_entry_id_fkey
  FOREIGN KEY (main_entry_id) REFERENCES public.main_entry(main_entry_id);

-- FK المرتبطة بـ custody_advances.custody_advance_id
ALTER TABLE public.account_trans
  ADD CONSTRAINT account_trans_custody_id_fkey
  FOREIGN KEY (custody_id) REFERENCES public.custody_advances(custody_advance_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_custody_id_fkey
  FOREIGN KEY (custody_id) REFERENCES public.custody_advances(custody_advance_id);

-- FK المرتبطة بـ sources.source_id
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_produc_source_id_fkey
  FOREIGN KEY (produc_source_id) REFERENCES public.sources(source_id);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_source_id_fkey
  FOREIGN KEY (order_source_id) REFERENCES public.sources(source_id);

-- FK المرتبطة بـ order_status.order_status_id
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_id_fkey
  FOREIGN KEY (order_status_id) REFERENCES public.order_status(order_status_id);

-- FK المرتبطة بـ items_category.items_category_id
ALTER TABLE public.products
  ADD CONSTRAINT products_item_category_id_fkey
  FOREIGN KEY (item_category_id) REFERENCES public.items_category(items_category_id);

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_content_category_id_fkey
  FOREIGN KEY (content_category_id) REFERENCES public.items_category(items_category_id);

-- FK المرتبطة بـ entry_module.entry_module_id
ALTER TABLE public.entry_type
  ADD CONSTRAINT entry_type_module_id_fkey
  FOREIGN KEY (module_id) REFERENCES public.entry_module(entry_module_id);

ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_module_id_fkey
  FOREIGN KEY (module_id) REFERENCES public.entry_module(entry_module_id);

-- FK المرتبطة بـ entry_type.entry_type_id
ALTER TABLE public.main_entry
  ADD CONSTRAINT main_entry_entry_type_id_fkey
  FOREIGN KEY (entry_type_id) REFERENCES public.entry_type(entry_type_id);

-- FK المرتبطة بـ order_option.order_option_id
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_packaging_option_id_fkey
  FOREIGN KEY (packaging_option_id) REFERENCES public.order_option(order_option_id);

-- FK المرتبطة بـ account.account_id (الجدول المالي الهرمي)
ALTER TABLE public.acc_main
  ADD CONSTRAINT acc_main_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.account(account_id);

-- FK المرتبطة بـ acc_main.acc_main_id
ALTER TABLE public.acc_sub
  ADD CONSTRAINT acc_sub_acc_main_id_fkey
  FOREIGN KEY (acc_main_id) REFERENCES public.acc_main(acc_main_id);

-- FK المرتبطة بـ acc_sub.acc_sub_id
ALTER TABLE public.acc_sub_group
  ADD CONSTRAINT acc_sub_group_acc_sub_id_fkey
  FOREIGN KEY (acc_sub_id) REFERENCES public.acc_sub(acc_sub_id);

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_acc_sub_id_fkey
  FOREIGN KEY (acc_sub_id) REFERENCES public.acc_sub(acc_sub_id);

-- FK المرتبطة بـ acc_sub_group.acc_sub_group_id
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.acc_sub_group(acc_sub_group_id);

-- FK المرتبطة بـ order_items.order_item_id
ALTER TABLE public.returned_products
  ADD CONSTRAINT returned_products_order_item_id_fkey
  FOREIGN KEY (order_item_id) REFERENCES public.order_items(order_item_id);

-- =============================================================================
-- الخطوة 4: إعادة إنشاء وتحديث دوال PL/pgSQL المرتبطة بالـ PKs الجديدة
-- Step 4: Update all functions/RPCs that reference old `id` column names
-- =============================================================================

-- 4.1: تحديث دالة حذف الطلبات الذرية (delete_orders_with_dependents)
-- تستخدم `id` من جدول orders -> الآن `order_id`
CREATE OR REPLACE FUNCTION public.delete_orders_with_dependents(
  p_order_ids UUID[],
  p_deleted_by_uid UUID
)
RETURNS TABLE(deleted_order_id UUID, success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- التحقق من صلاحية المستخدم / Authorization check
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = p_deleted_by_uid
    AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: user % is not active', p_deleted_by_uid;
  END IF;

  FOREACH v_order_id IN ARRAY p_order_ids
  LOOP
    BEGIN
      -- حذف التبعيات أولاً / Delete dependents first
      DELETE FROM public.orders_history WHERE order_id = v_order_id;
      DELETE FROM public.order_items     WHERE order_id = v_order_id;
      DELETE FROM public.shipments       WHERE order_id = v_order_id;
      DELETE FROM public.account_trans   WHERE order_id = v_order_id;
      DELETE FROM public.main_entry      WHERE order_id = v_order_id;
      DELETE FROM public.orders          WHERE order_id = v_order_id;

      deleted_order_id := v_order_id;
      success          := TRUE;
      message          := 'deleted successfully';
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      deleted_order_id := v_order_id;
      success          := FALSE;
      message          := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- 4.2: تحديث دالة سجل تاريخ الطلبات (orders_history_from_orders)
-- استخدام `order_id` بدلاً من `id`
CREATE OR REPLACE FUNCTION public.orders_history_from_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.orders_history (
      order_id,
      old_status_id,
      new_status_id,
      changed_by,
      changed_at,
      notes
    ) VALUES (
      NEW.order_id,
      OLD.order_status_id,
      NEW.order_status_id,
      NEW.updated_by,
      NOW(),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

-- إعادة ربط التريجر / Reattach trigger
DROP TRIGGER IF EXISTS trg_orders_history_from_orders ON public.orders;
CREATE TRIGGER trg_orders_history_from_orders
  AFTER UPDATE OF order_status_id ON public.orders
  FOR EACH ROW
  WHEN (OLD.order_status_id IS DISTINCT FROM NEW.order_status_id)
  EXECUTE FUNCTION public.orders_history_from_orders();

-- 4.3: تحديث دالة sync_account_balance_after_financial_trans
-- تستخدم account_trans.id -> account_trans_id
CREATE OR REPLACE FUNCTION public.sync_account_balance_after_financial_trans()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- تحديد الحساب المتأثر / Get affected account
  IF TG_OP = 'DELETE' THEN
    v_account_id := OLD.account_id;
  ELSE
    v_account_id := NEW.account_id;
  END IF;

  -- إعادة حساب الرصيد من account_trans / Recalculate balance from account_trans
  UPDATE public.accounts
  SET balance = (
    SELECT COALESCE(SUM(
      CASE
        WHEN at2.side = 'debit'  THEN  at2.amount_local
        WHEN at2.side = 'credit' THEN -at2.amount_local
        ELSE 0
      END
    ), 0)
    FROM public.account_trans at2
    JOIN public.main_entry me ON me.main_entry_id = at2.entry_id
    WHERE at2.account_id = v_account_id
    AND me.status = 'posted'
  )
  WHERE account_id = v_account_id;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- الخطوة 5: إعادة تفعيل التريجرات
-- Step 5: Re-enable triggers
-- =============================================================================
SET session_replication_role = 'origin';

-- =============================================================================
-- الخطوة 6: تحديث سياسات RLS لاستخدام الأعمدة الجديدة
-- Step 6: Update RLS policies to use new column names
-- =============================================================================

-- سياسات جدول users
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role = r.role_id
      WHERE u.user_id = auth.uid()
      AND r.is_admin = TRUE
    )
  );

-- سياسات جدول sessions
DROP POLICY IF EXISTS "Users manage own sessions" ON public.sessions;
CREATE POLICY "Users manage own sessions" ON public.sessions
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- الخطوة 7: تحديث سيكوينسات وقيم DEFAULT إن وجدت
-- Step 7: Update sequences and DEFAULT values if any
-- =============================================================================
-- لا توجد سيكوينسات تحتاج تحديث لأن الـ PKs من نوع UUID مع gen_random_uuid()
-- No sequences need updating as all PKs are UUID with gen_random_uuid()

COMMIT;

-- =============================================================================
-- التحقق النهائي / Final Verification
-- =============================================================================
DO $$
DECLARE
  v_tables_with_old_id INTEGER;
BEGIN
  -- التحقق من عدم وجود أعمدة PK اسمها `id` في الجداول العامة
  -- Verify no tables still have PK column named `id` (except system/migration tables)
  SELECT COUNT(*) INTO v_tables_with_old_id
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND kcu.table_schema = 'public'
    AND kcu.column_name = 'id'
    AND kcu.table_name NOT IN (
      'financial_legacy_migration_map',  -- PK مركب / Composite PK
      'cur_price'                        -- PK مركب / Composite PK
    );

  IF v_tables_with_old_id > 0 THEN
    RAISE WARNING 'تحذير: لا تزال هناك % جداول تحتوي على عمود PK اسمه id', v_tables_with_old_id;
  ELSE
    RAISE NOTICE 'نجح التحقق: لا توجد جداول بعمود PK اسمه id - تمت إعادة التسمية بنجاح 100%%';
  END IF;
END;
$$;
