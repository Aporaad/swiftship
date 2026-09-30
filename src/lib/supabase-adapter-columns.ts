export const DIRECT_COLUMNS_MAP: Record<string, Record<string, string>> = {
  employees: { fullName: 'full_name', nameAr: 'name_ar', nameEn: 'name_en', accountId: 'account_id', monthlySalary: 'monthly_salary', currency: 'currency', jobsType: 'job_type', jobType: 'job_type', createdAt: 'created_at', createdBy: 'created_by' },
  users: { role: 'role', username: 'username', email: 'email', disabled: 'disabled', linkedType: 'linked_type', linkedEntity: 'linked_entity', fullName: 'full_name', password: 'password', systemPin: 'system_pin', isRoot: 'is_root', phone: 'phone', address: 'address', createdAt: 'created_at', updatedAt: 'updated_at', lastSeen: 'last_seen', lastSeenAt: 'last_seen_at' },
  portal_users: { portalRole: 'portal_role', username: 'username', email: 'email', disabled: 'disabled', isDisabled: 'is_disabled', approvalStatus: 'approval_status', linkedCustomerId: 'linked_customer_id', accountId: 'account_id', fullName: 'full_name', nameAr: 'name_ar', nameEn: 'name_en' },
  roles: { title: 'title', isDefault: 'is_default', permissions: 'permissions', createdAt: 'created_at', updatedAt: 'updated_at', createdBy: 'created_by', updatedBy: 'updated_by' },
  sessions: { userId: 'user_id', fullName: 'full_name', email: 'email', role: 'role', deviceInfo: 'device_info', createdAt: 'created_at', lastSeen: 'last_seen', forceLogout: 'force_logout' },
  settings: { category: 'category' },
  user_settings: { userId: 'user_id' },
  customers: { fullName: 'full_name', nameAr: 'name_ar', nameEn: 'name_en', accountId: 'account_id', disabled: 'is_active', level: 'customer_level', customerLevel: 'customer_level', levels: 'customer_level' },
  couriers: { fullName: 'full_name', nameAr: 'name_ar', nameEn: 'name_en', accountId: 'account_id', financialCurrency: 'currency', currency: 'currency', disabled: 'is_active', courierType: 'courier_type', type: 'courier_type', level: 'courier_level', levels: 'courier_level' },
  account: { accountCode: 'account_code', code: 'account_code', account_code: 'account_code', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', acc_name_ar: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', acc_name_en: 'acc_name_en', balance: 'balance', curNo: 'cur_no', currencyId: 'cur_no', cur_no: 'cur_no', isActive: 'is_active', is_active: 'is_active', accountType: 'account_type', account_type: 'account_type', createdAt: 'created_at', updatedAt: 'updated_at' },
  acc_main: { accountId: 'account_id', account_id: 'account_id', accountCode: 'account_code', code: 'account_code', account_code: 'account_code', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', acc_name_ar: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', acc_name_en: 'acc_name_en', balance: 'balance', curNo: 'cur_no', currencyId: 'cur_no', cur_no: 'cur_no', isActive: 'is_active', is_active: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at' },
  acc_sub: { accMainId: 'acc_main_id', acc_main_id: 'acc_main_id', accountCode: 'account_code', code: 'account_code', account_code: 'account_code', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', acc_name_ar: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', acc_name_en: 'acc_name_en', balance: 'balance', curNo: 'cur_no', currencyId: 'cur_no', cur_no: 'cur_no', isActive: 'is_active', is_active: 'is_active', allowsDirectAccounts: 'allows_direct_accounts', allows_direct_accounts: 'allows_direct_accounts', createdAt: 'created_at', updatedAt: 'updated_at' },
  acc_sub_group: { accSubId: 'acc_sub_id', acc_sub_id: 'acc_sub_id', accountCode: 'account_code', code: 'account_code', account_code: 'account_code', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', acc_name_ar: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', acc_name_en: 'acc_name_en', balance: 'balance', curNo: 'cur_no', currencyId: 'cur_no', cur_no: 'cur_no', isActive: 'is_active', is_active: 'is_active', entityType: 'entity_type', entity_type: 'entity_type', allowsDirectAccounts: 'allows_direct_accounts', allows_direct_accounts: 'allows_direct_accounts', createdAt: 'created_at', updatedAt: 'updated_at' },
  default_accounts: { defaultKey: 'default_key', default_key: 'default_key', accountId: 'account_id', account_id: 'account_id', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', acc_name_ar: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', acc_name_en: 'acc_name_en', curNo: 'cur_no', currencyId: 'cur_no', cur_no: 'cur_no', isActive: 'is_active', is_active: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at' },
  account_id_migration_map: { oldAccountId: 'old_account_id', oldAccountCode: 'old_account_code', newAccountId: 'new_account_id', migratedAt: 'migrated_at' },
  accounts: { accountCode: 'account_code', code: 'account_code', balance: 'balance', currency: 'currency', entityId: 'entity_id', entityType: 'entity_type', type: 'type', accountType: 'type', accSubId: 'acc_sub_id', groupId: 'group_id', accountSeq: 'account_seq', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', limitedBalance: 'limited_balance', curNo: 'cur_no', currencyId: 'cur_no', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at', lastRecalculatedAt: 'last_recalculated_at', accountNumber: 'account_number', accountPrefix: 'account_prefix', entityName: 'entity_name', notes: 'notes' },
  orders: { orderNumber: 'order_number', trackingNumber: 'tracking_number', customerId: 'customer_id', orderPartyId: 'order_party_id', orderPartyType: 'order_party_type', isStaffOrder: 'is_staff_order', employeeId: 'employee_id', courierId: 'courier_id', orderPartyAccountId: 'order_party_account_id', orderStatusId: 'order_status_id', order_status_id: 'order_status_id', createdAt: 'created_at', orderSourceId: 'order_source_id', order_source_id: 'order_source_id', orderSourceType: 'order_source_type', order_source_type: 'order_source_type', deliveryCourierId: 'delivery_courier_id', delivery_courier_id: 'delivery_courier_id', shippingCourierId: 'shipping_courier_id', shipping_courier_id: 'shipping_courier_id', createdByName: 'created_by_name', created_by_name: 'created_by_name', updatedAt: 'updated_at', updated_at: 'updated_at', updatedBy: 'updated_by', updated_by: 'updated_by' },
  shipping_companies: { name: 'name', nameAr: 'name_ar', nameEn: 'name_en', shippingCompanyUrl: 'shipping_company_url', trackingIDPrefix: 'tracking_id_prefix', trackingID_prefix: 'tracking_id_prefix', accountId: 'account_id' },
  sources: { name: 'name', nameAr: 'name_ar', nameEn: 'name_en', supplierType: 'type', type: 'type', sourceUrl: 'source_url', accountId: 'account_id' },
  salary_history: { transactionsID: 'transactions_id', financialAccountId: 'account_id', accountId: 'account_id', userId: 'user_id', amount: 'amount', currency: 'currency', curNo: 'cur_no', currencyId: 'cur_no', salaryMonth: 'month', month: 'month', createdAt: 'created_at' },
  assets: { nameAr: 'name_ar', nameEn: 'name_en', linkedAccountId: 'account_id', accountId: 'account_id', status: 'status', currency: 'currency', isActive: 'is_active', assetCode: 'asset_code', type: 'type', createdAt: 'created_at' },
  notifications: { userId: 'user_id', category: 'category', isPublic: 'is_public', read: 'read', type: 'type', createdAt: 'created_at' },
  activity_logs: { userUid: 'user_id', userId: 'user_id', action: 'action', category: 'category', entityName: 'target', target: 'target', type: 'type', timestamp: 'created_at', createdAt: 'created_at' },
  jobs_req: { email: 'email', phone: 'phone', status: 'status', category: 'category', refCode: 'ref_code', createdAt: 'created_at' },
  announcements: { title: 'title', isActive: 'is_active', priority: 'priority', createdBy: 'created_by', createdAt: 'created_at' },
  portal_tickets: { type: 'type', status: 'status', userUid: 'user_uid', createdAt: 'created_at' },
  products: { productId: 'product_id', product_id: 'product_id', productNameAr: 'product_name_ar', product_name_ar: 'product_name_ar', productNameEn: 'product_name_en', product_name_en: 'product_name_en', productUrl: 'product_url', product_url: 'product_url', productPriceCurrency: 'product_price_currency', product_price_currency: 'product_price_currency', unitPrice: 'unit_price', unit_price: 'unit_price', itemCategoryId: 'item_category_id', item_category_id: 'item_category_id', isAllowed: 'is_allowed', is_allowed: 'is_allowed', cbm: 'cbm', width: 'width', height: 'height', length: 'length', weight: 'weight', createdAt: 'created_at', created_at: 'created_at', createdBy: 'created_by', created_by: 'created_by', updatedAt: 'updated_at', updated_at: 'updated_at', updatedBy: 'updated_by', updated_by: 'updated_by' },
  order_items: { orderItemId: 'order_item_id', order_item_id: 'order_item_id', itemsId: 'order_item_id', items_id: 'order_item_id', orderId: 'order_id', order_id: 'order_id', productId: 'product_id', product_id: 'product_id', productPrice: 'product_price', product_price: 'product_price', productUrl: 'product_url', product_url: 'product_url', trackingNumber: 'tracking_number', tracking_number: 'tracking_number', producSourceId: 'produc_source_id', produc_source_id: 'produc_source_id', producSourceUrl: 'produc_source_url', produc_source_url: 'produc_source_url', productCooler: 'product_cooler', product_cooler: 'product_cooler', nota: 'nota', quantity: 'quantity', totalPrice: 'total_price', total_price: 'total_price', totalWeight: 'total__weight', total_weight: 'total__weight', total__weight: 'total__weight', totalCbm: 'total_cbm', total_cbm: 'total_cbm', packagingOptionId: 'packaging_option_id', packaging_option_id: 'packaging_option_id', packagingOptionPrice: 'packaging_option_price', packaging_option_price: 'packaging_option_price', isInsured: 'is_insured', is_insured: 'is_insured', insuranceFee: 'insurance_fee', insurance_fee: 'insurance_fee', itemsStatus: 'items_status', items_status: 'items_status', createdAt: 'created_at', created_at: 'created_at', createdBy: 'created_by', created_by: 'created_by', updatedAt: 'updated_at', updated_at: 'updated_at', updatedBy: 'updated_by', updated_by: 'updated_by' },
  shipments: { orderId: 'order_id', trackingNumber: 'tracking_number', shippingCompanyId: 'shipping_company_id', shipping_company_id: 'shipping_company_id', courierId: 'courier_id', shipmentStatus: 'shipment_status', status: 'shipment_status', shippingCost: 'shipping_cost', weight: 'weight', shippingCategoryId: 'shipping_category_id', shipping_category_id: 'shipping_category_id', contentCategoryId: 'content_category_id', content_category_id: 'content_category_id', contentCategoryName: 'content_category_name', cartonCount: 'carton_count', customsFee: 'customs_fee', taxFee: 'tax_fee', otherCategoryFee: 'other_category_fee', categoryFeesTotal: 'category_fees_total', categoryFeeCurrency: 'category_fee_currency', createdAt: 'created_at' },
  orders_history: { orderId: 'order_id', orderNumber: 'order_number', shipmentId: 'shipment_id', mainEntryId: 'main_entry_id', main_entry_id: 'main_entry_id', accountTransCount: 'account_trans_count', journalEntryId: 'journal_entry_id', accountTransactionId: 'account_transaction_id', activityLogId: 'activity_log_id', eventType: 'event_type', eventCategory: 'event_category', operation: 'operation', entityType: 'entity_type', actorId: 'actor_id', actorName: 'actor_name', actorRole: 'actor_role', source: 'source', summary: 'summary', beforeData: 'before_data', afterData: 'after_data', metadata: 'metadata', occurredAt: 'occurred_at', createdAt: 'created_at' },
  order_status: { nameAr: 'name_ar', nameEn: 'name_en', isFirst: 'is_first', isLast: 'is_last', sortOrder: 'sort_order', color: 'color', code: 'code' },
  auto_entries: { statusId: 'status_id', nameAr: 'name_ar', nameEn: 'name_en', isActive: 'is_active', amountSource: 'amount_source', amountSources: 'amount_sources', amountStrategy: 'amount_strategy', currency: 'currency', curNo: 'cur_no', currencyId: 'cur_no', skipWhenZero: 'skip_when_zero' },
  autoEntry: { statusId: 'status_id', nameAr: 'name_ar', nameEn: 'name_en', isActive: 'is_active', amountSource: 'amount_source', amountSources: 'amount_sources', amountStrategy: 'amount_strategy', currency: 'currency', curNo: 'cur_no', currencyId: 'cur_no', skipWhenZero: 'skip_when_zero' },
  order_option: { nameAr: 'name_ar', nameEn: 'name_en', type: 'type', price: 'price', duration: 'duration', details: 'details', code: 'code', isActive: 'is_active', is_active: 'is_active' },
  items_category: { code: 'code', nameAr: 'name_ar', nameEn: 'name_en', description: 'description', details: 'details', hsCodeHint: 'hs_code_hint', customsPerCarton: 'customs_per_carton', taxPerCarton: 'tax_per_carton', otherFeesPerCarton: 'other_fees_per_carton', customsRate: 'customs_rate', taxRate: 'tax_rate', feeCurrency: 'fee_currency', requiresReview: 'requires_review', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at' },
  entry_module: { code: 'code', nameAr: 'name_ar', nameEn: 'name_en', note: 'note', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid' },
  entry_type: { code: 'code', moduleId: 'module_id', nameAr: 'name_ar', nameEn: 'name_en', note: 'note', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid' },
  main_entry: { entryNumber: 'entry_number', moduleId: 'module_id', entryTypeId: 'entry_type_id', entryCategory: 'entry_category', postingStatus: 'posting_status', amountOriginal: 'amount_original', amountText: 'amount_text', currencyOriginalNo: 'currency_original_no', currencyPriceId: 'currency_price_id', currencyPriceSeq: 'currency_price_seq', description: 'description', notes: 'notes', attachments: 'attachments', paymentMethod: 'payment_method', orderId: 'order_id', shipmentId: 'shipment_id', custodyId: 'custody_id', automationKey: 'automation_key', autoRuleId: 'auto_rule_id', isAutomatic: 'is_automatic', reversesEntryId: 'reverses_entry_id', effectiveAt: 'effective_at', postedAt: 'posted_at', voidedAt: 'voided_at', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid', postedByUid: 'posted_by_uid', voidedByUid: 'voided_by_uid' },
  // تحديث: عمود entry_id تم إعادة تسميته إلى main_entry_id في DB
  // Updated: entry_id column was renamed to main_entry_id in DB
  account_trans: { entryId: 'main_entry_id', lineNo: 'line_no', transType: 'trans_type', accountId: 'account_id', accountCurNo: 'account_cur_no', amount: 'amount', amountOriginal: 'amount_original', conversionRate: 'conversion_rate', currencyOriginalNo: 'currency_original_no', currencyPriceId: 'currency_price_id', currencyPriceSeq: 'currency_price_seq', entityType: 'entity_type', entityId: 'entity_id', paymentMethod: 'payment_method', orderId: 'order_id', shipmentId: 'shipment_id', custodyId: 'custody_id', autoRuleId: 'auto_rule_id', automationKey: 'automation_key', description: 'description', note: 'note', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid' },
  custody_advances: { custodyNumber: 'custody_number', recipientType: 'recipient_type', recipientId: 'recipient_id', recipientName: 'recipient_name', recipientAccountId: 'recipient_account_id', amountOriginal: 'amount_original', currencyOriginalNo: 'currency_original_no', currencyPriceId: 'currency_price_id', currencyPriceSeq: 'currency_price_seq', amountSettled: 'amount_settled', amountOutstanding: 'amount_outstanding', status: 'status', issuedEntryId: 'issued_entry_id', settlementEntryId: 'settlement_entry_id', note: 'note', issuedAt: 'issued_at', issuedByUid: 'issued_by_uid', settledAt: 'settled_at', settledByUid: 'settled_by_uid', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid' },
  financial_legacy_migration_map: { legacyTable: 'legacy_table', legacyId: 'legacy_id', targetTable: 'target_table', targetId: 'target_id', migrationStatus: 'migration_status', migratedAt: 'migrated_at', verifiedAt: 'verified_at', verifiedByUid: 'verified_by_uid' },
  financial_migration_exceptions: { legacyTable: 'legacy_table', legacyId: 'legacy_id', exceptionCode: 'exception_code', severity: 'severity', description: 'description', resolutionStatus: 'resolution_status', resolvedByUid: 'resolved_by_uid', resolvedAt: 'resolved_at', createdAt: 'created_at', updatedAt: 'updated_at' },
  returned_products: { returnId: 'return_id', return_id: 'return_id', orderId: 'order_id', order_id: 'order_id', orderItemId: 'order_item_id', order_item_id: 'order_item_id', productId: 'product_id', product_id: 'product_id', customerId: 'customer_id', customer_id: 'customer_id', customerName: 'customer_name', customer_name: 'customer_name', productName: 'product_name', product_name: 'product_name', productUrl: 'product_url', product_url: 'product_url', quantity: 'quantity', returnReason: 'return_reason', return_reason: 'return_reason', returnType: 'return_type', return_type: 'return_type', returnStatus: 'return_status', return_status: 'return_status', returnCondition: 'return_condition', return_condition: 'return_condition', refundAmount: 'refund_amount', refund_amount: 'refund_amount', refundCurrency: 'refund_currency', refund_currency: 'refund_currency', isInsured: 'is_insured', is_insured: 'is_insured', insuranceRefund: 'insurance_refund', insurance_refund: 'insurance_refund', notes: 'notes', returnedAt: 'returned_at', returned_at: 'returned_at', processedBy: 'processed_by', processed_by: 'processed_by', processedAt: 'processed_at', processed_at: 'processed_at', createdAt: 'created_at', created_at: 'created_at', createdBy: 'created_by', created_by: 'created_by', updatedAt: 'updated_at', updated_at: 'updated_at', updatedBy: 'updated_by', updated_by: 'updated_by' }
};

// خريطة أسماء أعمدة المفاتيح الرئيسية للجداول التي تستخدم مسميات مخصصة للنظام
// Primary key column map for tables post PK-rename
const TABLE_PRIMARY_KEY_MAP: Record<string, string> = {
  products: 'product_id',
  order_items: 'order_item_id',
  currency: 'cur_id',
  returned_products: 'return_id',
  orders: 'order_id',
  customers: 'customer_id',
  users: 'user_id',
  employees: 'employee_id',
  couriers: 'courier_id',
  shipments: 'shipment_id',
  accounts: 'account_id',
  account: 'account_id',
  acc_main: 'acc_main_id',
  acc_sub: 'acc_sub_id',
  acc_sub_group: 'acc_sub_group_id',
  default_accounts: 'default_account_id',
  main_entry: 'main_entry_id',
  account_trans: 'account_trans_id',
  roles: 'role_id',
  announcements: 'announcement_id',
  activity_logs: 'activity_log_id',
  notifications: 'notification_id',
  salary_history: 'salary_history_id',
  assets: 'asset_id',
  sources: 'source_id',
  shipping_companies: 'shipping_company_id',
  portal_users: 'portal_user_id',
  portal_tickets: 'portal_ticket_id',
  jobs_req: 'jobs_req_id',
  cust_details: 'cust_detail_id',
  auto_entries: 'auto_entry_id',
  autoEntry: 'auto_entry_id',
  entry_module: 'entry_module_id',
  entry_type: 'entry_type_id',
  entry_payment_details: 'entry_payment_detail_id',
  custody_advances: 'custody_advance_id',
  orders_history: 'orders_history_id',
  report_settings: 'report_setting_id',
  report_templates: 'report_template_id',
  sessions: 'session_id',
  settings: 'setting_id',
  user_settings: 'user_setting_id',
  whatsapp_logs: 'whatsapp_log_id',
  order_option: 'order_option_id',
  order_status: 'order_status_id',
  items_category: 'items_category_id',
  cur_price: 'cur_price_id',
};

export function getTablePrimaryKey(table: string): string {
  return TABLE_PRIMARY_KEY_MAP[table] || `${table.endsWith('s') ? table.slice(0, -1) : table}_id`;
}

// قائمة الجداول المالية العلاقاتية ذات الأعمدة المباشرة فقط (بدون حقل data jsonb)
// Relational financial tables using explicit columns only (no data jsonb column)
const EXPLICIT_FINANCIAL_TABLES = new Set([
  'account', 'acc_main', 'acc_sub', 'acc_sub_group', 'default_accounts', 'account_id_migration_map',
  'accounts', 'entry_module', 'entry_type', 'main_entry', 'account_trans', 'custody_advances',
  'financial_legacy_migration_map', 'financial_migration_exceptions', 'users', 'products', 'order_items',
  'returned_products', 'sessions',
  // These entity tables no longer have a data JSONB column after phase 8.
  'customers', 'couriers', 'employees', 'sources', 'shipping_companies', 'assets'
  //  'announcements', 'portal_users', 'sources',
  // 'couriers', 'customers', 'employees', 'activity_logs', 'notifications', 'jobs_req', 'portal_tickets',
  // 'shipments', 'orders_history', 'order_status', 'auto_entries', 'shipping_companies', 'assets',
]);

export function usesExplicitFinancialColumns(table: string): boolean {
  return EXPLICIT_FINANCIAL_TABLES.has(table);
}

/**
 * استخراج الأعمدة المباشرة المجهزة لقاعدة البيانات بنظافة وأمان
 * Safely extract direct relational columns for Supabase REST queries
 */
export function extractDirectColumns(table: string, data: Record<string, any>): Record<string, any> {
  const mapping = DIRECT_COLUMNS_MAP[table];
  if (!mapping || !data || typeof data !== 'object') return {};
  const extracted: Record<string, any> = {};
  for (const [key, col] of Object.entries(mapping)) {
    let val: any = undefined;
    if (data[key] !== undefined) {
      val = data[key];
    } else if (data[col] !== undefined) {
      val = data[col];
    }

    if (val !== undefined) {
      // تحويل المفاتيح الأجنبية الفارغة أو المسافات والتواريخ الفارغة إلى null لتفادي أخطاء القيود والأنواع بقاعدة البيانات
      // Convert empty string or whitespace foreign keys, dates, and timestamps to null so Postgres FK & type check succeeds
      if (typeof val === 'string' && val.trim() === '') {
        if (
          col.endsWith('_id') ||
          col === 'cur_no' ||
          col.endsWith('_at') ||
          col.endsWith('At') ||
          col.endsWith('_date') ||
          col.endsWith('Date')
        ) {
          val = null;
        }
      }
      if (key === 'disabled' && (table === 'customers' || table === 'couriers')) {
        extracted[col] = !val;
      } else if (
        col.endsWith('_at') ||
        col.endsWith('At') ||
        col.endsWith('_date') ||
        col.endsWith('Date') ||
        col === 'lastRecalculatedAt' ||
        col === 'effective_at' ||
        col === 'posted_at' ||
        col === 'voided_at' ||
        col === 'processed_at' ||
        col === 'returned_at'
      ) {
        if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
          extracted[col] = null;
        } else if (typeof val === 'number') {
          extracted[col] = new Date(val).toISOString();
        } else if (typeof val === 'string') {
          const trimmed = val.trim();
          if (/^\d+$/.test(trimmed)) {
            extracted[col] = new Date(Number(trimmed)).toISOString();
          } else {
            const parsed = Date.parse(trimmed);
            extracted[col] = !isNaN(parsed) ? new Date(parsed).toISOString() : null;
          }
        } else {
          extracted[col] = val;
        }
      } else {
        extracted[col] = val;
      }
    }
  }

  // Safety checks for foreign key ID columns
  if (table === 'orders') {
    const rawStatus = extracted['order_status_id'];
    if (rawStatus === undefined || rawStatus === null || String(rawStatus).trim() === '' || String(rawStatus).trim() === '0') {
      extracted['order_status_id'] = '1';
    } else {
      extracted['order_status_id'] = String(rawStatus);
    }
    if (typeof extracted['customer_id'] === 'string' && extracted['customer_id'].trim() === '') {
      extracted['customer_id'] = null;
    }
    if (typeof extracted['order_source_id'] === 'string' && extracted['order_source_id'].trim() === '') {
      extracted['order_source_id'] = null;
    }
    if (typeof extracted['delivery_courier_id'] === 'string' && extracted['delivery_courier_id'].trim() === '') {
      extracted['delivery_courier_id'] = null;
    }
    if (typeof extracted['shipping_courier_id'] === 'string' && extracted['shipping_courier_id'].trim() === '') {
      extracted['shipping_courier_id'] = null;
    }
  }

  return extracted;
}
