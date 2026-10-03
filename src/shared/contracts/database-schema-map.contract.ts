/**
 * SwiftShip System — Phase 1 Database Schema Contract Registry
 * 
 * Maps canonical TypeScript DTO properties to PostgreSQL snake_case columns
 * for database tables in the system based on actual database metadata.
 */

export interface TableColumnMapping {
  readonly tableName: string;
  readonly primaryKey: string;
  readonly foreignKeys: ReadonlyArray<{ readonly column: string; readonly targetTable: string }>;
  readonly columns: ReadonlyArray<string>;
}

export const SYSTEM_DATABASE_SCHEMA_REGISTRY: ReadonlyArray<TableColumnMapping> = [
  {
    tableName: 'orders',
    primaryKey: 'order_id',
    foreignKeys: [
      { column: 'customer_id', targetTable: 'customers' },
      { column: 'employee_id', targetTable: 'employees' },
      { column: 'courier_id', targetTable: 'couriers' },
      { column: 'order_status_id', targetTable: 'order_status' },
      { column: 'order_source_id', targetTable: 'sources' },
      { column: 'order_party_account_id', targetTable: 'accounts' },
    ],
    columns: [
      'order_id', 'data', 'order_number', 'tracking_number', 'customer_id', 
      'order_status1', 'created_at', 'order_status_id', 'order_source_id', 
      'order_source_type', 'delivery_courier_id', 'shipping_courier_id', 
      'order_party_id', 'order_party_type', 'is_staff_order', 'employee_id', 
      'courier_id', 'order_party_account_id', 'created_by_name', 'updated_at', 
      'updated_by', 'created_by'
    ],
  },
  {
    tableName: 'shipments',
    primaryKey: 'shipment_id',
    foreignKeys: [
      { column: 'order_id', targetTable: 'orders' },
      { column: 'shipping_company_id', targetTable: 'shipping_companies' },
      { column: 'courier_id', targetTable: 'couriers' },
      { column: 'content_category_id', targetTable: 'items_category' },
    ],
    columns: [
      'shipment_id', 'order_id', 'tracking_number', 'shipping_company_id', 
      'courier_id', 'shipment_status', 'shipping_cost', 'weight', 'data', 
      'created_at', 'shipping_category_id', 'content_category_id', 
      'content_category_name', 'carton_count', 'customs_fee', 'tax_fee', 
      'other_category_fee', 'category_fees_total', 'category_fee_currency', 
      'updated_at', 'created_by', 'updated_by', 'shipping_type', 
      'shipping_source', 'shipping_destination', 'shipping_date', 
      'shipping_duration', 'expected_arrival', 'delivery_date'
    ],
  },
  {
    tableName: 'customers',
    primaryKey: 'customer_id',
    foreignKeys: [{ column: 'account_id', targetTable: 'accounts' }],
    columns: [
      'customer_id', 'account_id', 'is_active', 'join_by', 'referrer_id', 
      'full_name', 'name_ar', 'name_en', 'customer_level', 'created_at', 
      'updated_at', 'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'couriers',
    primaryKey: 'courier_id',
    foreignKeys: [{ column: 'account_id', targetTable: 'accounts' }],
    columns: [
      'courier_id', 'account_id', 'currency', 'is_active', 'full_name', 
      'name_ar', 'name_en', 'courier_type', 'courier_level', 'commission_rate', 
      'created_at', 'updated_at', 'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'employees',
    primaryKey: 'employee_id',
    foreignKeys: [{ column: 'account_id', targetTable: 'accounts' }],
    columns: [
      'employee_id', 'account_id', 'monthly_salary', 'currency', 'created_at', 
      'created_by', 'full_name', 'name_ar', 'name_en', 'job_type', 
      'commission_rate', 'updated_at', 'updated_by'
    ],
  },
  {
    tableName: 'products',
    primaryKey: 'product_id',
    foreignKeys: [{ column: 'item_category_id', targetTable: 'items_category' }],
    columns: [
      'product_id', 'product_name_ar', 'product_name_en', 'product_url', 
      'product_price_currency', 'unit_price', 'item_category_id', 'is_allowed', 
      'cbm', 'width', 'height', 'length', 'weight', 'created_at', 'created_by', 
      'updated_at', 'updated_by'
    ],
  },
  {
    tableName: 'users',
    primaryKey: 'user_id',
    foreignKeys: [],
    columns: [
      'user_id', 'role', 'username', 'email', 'disabled', 'linked_type', 
      'linked_entity', 'full_name', 'password', 'system_pin', 'is_root', 
      'phone', 'address', 'created_at', 'updated_at', 'last_seen', 
      'last_seen_at', 'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'sessions',
    primaryKey: 'session_id',
    foreignKeys: [{ column: 'user_id', targetTable: 'users' }],
    columns: [
      'session_id', 'user_id', 'created_at', 'last_seen', 'force_logout', 
      'device_info', 'role', 'full_name', 'email', 'updated_at', 'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'accounts',
    primaryKey: 'account_id',
    foreignKeys: [
      { column: 'acc_sub_id', targetTable: 'acc_sub' },
      { column: 'group_id', targetTable: 'acc_sub_group' }
    ],
    columns: [
      'account_id', 'account_code', 'currency', 'entity_id', 'type', 'acc_sub_id', 
      'group_id', 'entity_type', 'account_seq', 'acc_name_ar', 'acc_name_en', 
      'limited_balance', 'cur_no', 'is_active', 'created_at', 'updated_at', 
      'last_recalculated_at', 'balance', 'account_number', 'account_prefix', 
      'entity_name', 'debit_total', 'credit_total', 'parent_code', 'notes', 
      'monthly_salary', 'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'main_entry',
    primaryKey: 'main_entry_id',
    foreignKeys: [
      { column: 'module_id', targetTable: 'entry_module' },
      { column: 'entry_type_id', targetTable: 'entry_type' },
      { column: 'order_id', targetTable: 'orders' },
      { column: 'shipment_id', targetTable: 'shipments' },
      { column: 'custody_id', targetTable: 'custody_advances' }
    ],
    columns: [
      'main_entry_id', 'entry_number', 'module_id', 'entry_type_id', 
      'entry_category', 'posting_status', 'description', 'notes', 'attachments', 
      'payment_method', 'order_id', 'shipment_id', 'custody_id', 'automation_key', 
      'auto_rule_id', 'is_automatic', 'reverses_entry_id', 'effective_at', 
      'posted_at', 'voided_at', 'created_at', 'updated_at', 'created_by_uid', 
      'updated_by_uid', 'posted_by_uid', 'voided_by_uid', 'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'account_trans',
    primaryKey: 'account_trans_id',
    foreignKeys: [
      { column: 'main_entry_id', targetTable: 'main_entry' },
      { column: 'account_id', targetTable: 'accounts' },
      { column: 'order_id', targetTable: 'orders' },
      { column: 'shipment_id', targetTable: 'shipments' },
      { column: 'custody_id', targetTable: 'custody_advances' }
    ],
    columns: [
      'account_trans_id', 'main_entry_id', 'line_no', 'trans_type', 'account_id', 
      'account_cur_no', 'amount', 'amount_original', 'currency_original_no', 
      'currency_price_id', 'currency_price_seq', 'entity_type', 'entity_id', 
      'payment_method', 'order_id', 'shipment_id', 'custody_id', 'auto_rule_id', 
      'automation_key', 'description', 'note', 'created_at', 'updated_at', 
      'created_by_uid', 'updated_by_uid', 'conversion_rate', 'amount_original_text', 
      'account_currency_price_id', 'account_currency_price_seq', 'amount_text', 
      'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'orders_history',
    primaryKey: 'orders_history_id',
    foreignKeys: [
      { column: 'order_id', targetTable: 'orders' },
      { column: 'shipment_id', targetTable: 'shipments' },
      { column: 'main_entry_id', targetTable: 'main_entry' },
    ],
    columns: [
      'orders_history_id', 'order_id', 'order_number', 'shipment_id', 
      'activity_log_id', 'event_type', 'event_category', 'operation', 
      'entity_type', 'actor_id', 'actor_name', 'actor_role', 'source', 
      'summary', 'before_data', 'after_data', 'metadata', 'occurred_at', 
      'created_at', 'main_entry_id', 'account_trans_count', 'updated_at', 
      'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'items_category',
    primaryKey: 'items_category_id',
    foreignKeys: [],
    columns: [
      'items_category_id', 'code', 'name_ar', 'name_en', 'description', 
      'hs_code_hint', 'customs_per_carton', 'tax_per_carton', 'other_fees_per_carton', 
      'customs_rate', 'tax_rate', 'fee_currency', 'requires_review', 'is_active', 
      'details', 'created_at', 'updated_at', 'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'order_items',
    primaryKey: 'order_item_id',
    foreignKeys: [
      { column: 'order_id', targetTable: 'orders' },
      { column: 'product_id', targetTable: 'products' },
      { column: 'produc_source_id', targetTable: 'sources' },
      { column: 'packaging_option_id', targetTable: 'order_option' },
    ],
    columns: [
      'order_item_id', 'order_id', 'product_id', 'product_price', 'product_url', 
      'tracking_number', 'produc_source_id', 'produc_source_url', 'product_cooler', 
      'nota', 'quantity', 'total_price', 'total__weight', 'total_cbm', 
      'packaging_option_id', 'packaging_option_price', 'is_insured', 'insurance_fee', 
      'items_status', 'created_at', 'created_by', 'updated_at', 'updated_by'
    ],
  },
  {
    tableName: 'returned_products',
    primaryKey: 'return_id',
    foreignKeys: [
      { column: 'order_id', targetTable: 'orders' },
      { column: 'order_item_id', targetTable: 'order_items' },
      { column: 'product_id', targetTable: 'products' },
      { column: 'customer_id', targetTable: 'customers' },
    ],
    columns: [
      'return_id', 'order_id', 'order_item_id', 'product_id', 'customer_id', 
      'customer_name', 'product_name', 'product_url', 'quantity', 'return_reason', 
      'return_type', 'return_status', 'return_condition', 'refund_amount', 
      'refund_currency', 'is_insured', 'insurance_refund', 'notes', 'returned_at', 
      'processed_by', 'processed_at', 'created_at', 'created_by', 'updated_at', 'updated_by'
    ],
  },
  {
    tableName: 'custody_advances',
    primaryKey: 'custody_advance_id',
    foreignKeys: [
      { column: 'recipient_account_id', targetTable: 'accounts' },
      { column: 'issued_entry_id', targetTable: 'main_entry' },
      { column: 'settlement_entry_id', targetTable: 'main_entry' },
    ],
    columns: [
      'custody_advance_id', 'custody_number', 'recipient_type', 'recipient_id', 
      'recipient_name', 'recipient_account_id', 'amount_original', 'currency_original_no', 
      'currency_price_id', 'currency_price_seq', 'amount_settled', 'amount_outstanding', 
      'status', 'issued_entry_id', 'settlement_entry_id', 'note', 'issued_at', 
      'issued_by_uid', 'settled_at', 'settled_by_uid', 'created_at', 'updated_at', 
      'created_by_uid', 'updated_by_uid', 'created_by', 'updated_by'
    ],
  },
  {
    tableName: 'sources',
    primaryKey: 'source_id',
    foreignKeys: [{ column: 'account_id', targetTable: 'accounts' }],
    columns: ['source_id', 'name', 'type', 'source_url', 'account_id', 'name_ar', 'name_en', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  },
  {
    tableName: 'shipping_companies',
    primaryKey: 'shipping_company_id',
    foreignKeys: [{ column: 'account_id', targetTable: 'accounts' }],
    columns: ['shipping_company_id', 'name', 'shipping_company_url', 'tracking_id_prefix', 'account_id', 'name_ar', 'name_en', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  },
  {
    tableName: 'roles',
    primaryKey: 'role_id',
    foreignKeys: [],
    columns: ['role_id', 'title', 'is_default', 'permissions', 'created_at', 'updated_at', 'created_by', 'updated_by', 'code', 'description'],
  },
];
