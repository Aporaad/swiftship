import { DIRECT_COLUMNS_MAP, getTablePrimaryKey } from './supabase-adapter-columns';

/**
 * تنظيف حقل data وتجريده من الحقول المكررة التي توجد كأعمدة أساسية في الجدول
 * Sanitize data JSONB column payload by removing fields that exist as explicit relational columns
 */
export function sanitizeDataPayload(table: string, data: Record<string, any>): Record<string, any> {
  if (!data || typeof data !== 'object') return data;
  const clean = { ...data };

  // 1. Remove standard timestamp & system columns from JSON data if they are direct table columns
  const commonSystemKeys = [
    'id', 'created_at', 'createdAt', 'updated_at', 'updatedAt',
    'created_by', 'createdBy', 'updated_by', 'updatedBy',
    'is_active', 'isActive', 'user_id', 'userId',
    'customer_id', 'customerId', 'order_id', 'orderId',
    'account_id', 'accountId', 'status_id', 'statusId'
  ];
  commonSystemKeys.forEach(k => delete clean[k]);

  // Financial truth is the canonical account_id plus ledger-derived balances.
  // Never recreate the retired duplicated financial fields in JSON payloads.
  ['financialAccountId', 'financialAccountCode', 'financialBalance',
    'financial_account_id', 'financial_account_code', 'financial_balance']
    .forEach(k => delete clean[k]);

  // 2. Remove table-specific mapped direct columns
  const tableMapping = DIRECT_COLUMNS_MAP[table];
  if (tableMapping) {
    for (const [jsKey, colName] of Object.entries(tableMapping)) {
      delete clean[jsKey];
      delete clean[colName];
    }
  }

  // 3. Special handling for orders, products, and shipments
  if (table === 'orders') {
    const extraKeys = ['items', 'products', 'shippingDetails', 'shippings'];
    extraKeys.forEach(k => delete clean[k]);
  }

  return clean;
}

export function extractRowPayload(table: string, row: any): any {
  if (!row) return {};
  const pkCol = getTablePrimaryKey(table);
  const rowId = row[pkCol] || row.id || row.product_id || row.items_id || row.cur_id;
  const rawData = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});

  // Extract top-level database columns excluding the 'data' JSON column itself
  const { data: _, ...topCols } = row;

  // تنظيف الحقول المكررة من data لمنع تداخل الاستعلامات
  // Sanitize raw data payload to eliminate duplicate fields
  const sanitizedData = sanitizeDataPayload(table, rawData);

  // Merge top-level columns with JSON data payload
  const combined = { ...topCols, ...sanitizedData };

  // Map database columns to JS properties and vice versa
  const mapping = DIRECT_COLUMNS_MAP[table];
  if (mapping) {
    for (const [jsKey, colName] of Object.entries(mapping)) {
      if (combined[colName] !== undefined && combined[jsKey] === undefined) {
        if (colName === 'is_active' && jsKey === 'disabled') {
          combined[jsKey] = !combined[colName];
        } else {
          combined[jsKey] = combined[colName];
        }
      }
      if (combined[jsKey] !== undefined && combined[colName] === undefined) {
        combined[colName] = combined[jsKey];
      }
    }
  }

  // Automatic aliases for common field names
  if (combined.name_ar && !combined.nameAr) combined.nameAr = combined.name_ar;
  if (combined.nameAr && !combined.name_ar) combined.name_ar = combined.nameAr;
  if (combined.name_en && !combined.nameEn) combined.nameEn = combined.name_en;
  if (combined.nameEn && !combined.name_en) combined.name_en = combined.nameEn;
  if (combined.is_active !== undefined && combined.isActive === undefined) combined.isActive = !!combined.is_active;
  if (combined.isActive !== undefined && combined.is_active === undefined) combined.is_active = !!combined.isActive;

  // Primary key explicit field aliases
  if (table === 'products') {
    if (rowId && !combined.product_id) combined.product_id = rowId;
    if (rowId && !combined.productId) combined.productId = rowId;
  } else if (table === 'order_items') {
    if (rowId && !combined.items_id) combined.items_id = rowId;
    if (rowId && !combined.itemsId) combined.itemsId = rowId;
  }

  // Compatibility aliases for account_trans and main_entry
  // تحديث aliases: العمود أصبح main_entry_id بعد إعادة التسمية في DB
  // Updated aliases: column was renamed to main_entry_id in DB
  if (table === 'account_trans') {
    if (combined.account_id && !combined.accountId) combined.accountId = combined.account_id;
    if (combined.accountId && !combined.account_id) combined.account_id = combined.accountId;
    // دعم الاسم القديم entry_id للتوافق مع البيانات التاريخية
    // Legacy support for old entry_id field name (now renamed to main_entry_id)
    if (combined.main_entry_id && !combined.entryId) combined.entryId = combined.main_entry_id;
    if (combined.entry_id && !combined.entryId) combined.entryId = combined.entry_id;
    if (combined.entryId && !combined.main_entry_id) combined.main_entry_id = combined.entryId;
    if (combined.trans_type && !combined.transType) combined.transType = combined.trans_type;
    if (combined.transType && !combined.trans_type) combined.trans_type = combined.transType;
    if (combined.transType && !combined.type) combined.type = combined.transType;
    if (combined.type && !combined.transType) combined.transType = combined.type;
    if (combined.amount_original !== undefined && combined.amountOriginal === undefined) combined.amountOriginal = Number(combined.amount_original);
    if (combined.amountOriginal !== undefined && combined.amount_original === undefined) combined.amount_original = Number(combined.amountOriginal);
    if (combined.account_cur_no !== undefined && combined.accountCurNo === undefined) combined.accountCurNo = Number(combined.account_cur_no);
    if (combined.accountCurNo !== undefined && combined.account_cur_no === undefined) combined.account_cur_no = Number(combined.accountCurNo);
    if (combined.currency_original_no !== undefined && combined.currencyOriginalNo === undefined) combined.currencyOriginalNo = Number(combined.currency_original_no);
    if (combined.currencyOriginalNo !== undefined && combined.currency_original_no === undefined) combined.currency_original_no = Number(combined.currencyOriginalNo);
    if (combined.order_id && !combined.orderId) combined.orderId = combined.order_id;
    if (combined.orderId && !combined.order_id) combined.order_id = combined.orderId;
    if (combined.shipment_id && !combined.shipmentId) combined.shipmentId = combined.shipment_id;
    if (combined.shipmentId && !combined.shipment_id) combined.shipment_id = combined.shipmentId;
    if (combined.payment_method && !combined.paymentMethod) combined.paymentMethod = combined.payment_method;
    if (combined.paymentMethod && !combined.payment_method) combined.payment_method = combined.paymentMethod;
    if (combined.created_at && !combined.createdAt) combined.createdAt = combined.created_at;
    if (combined.createdAt && !combined.created_at) combined.created_at = combined.createdAt;
  }

  if (table === 'main_entry') {
    if (combined.entry_number && !combined.entryNumber) combined.entryNumber = combined.entry_number;
    if (combined.entryNumber && !combined.entry_number) combined.entry_number = combined.entryNumber;
    if (combined.entry_number && !combined.journalEntryNumber) combined.journalEntryNumber = combined.entry_number;
    if (combined.posting_status && !combined.postingStatus) combined.postingStatus = combined.posting_status;
    if (combined.postingStatus && !combined.posting_status) combined.posting_status = combined.postingStatus;
    if (combined.postingStatus && !combined.status) combined.status = combined.postingStatus;
    if (combined.module_id && !combined.moduleId) combined.moduleId = combined.module_id;
    if (combined.module_id && !combined.module) combined.module = combined.module_id;
    if (combined.entry_type_id && !combined.entryTypeId) combined.entryTypeId = combined.entry_type_id;
    if (combined.effective_at && !combined.effectiveAt) combined.effectiveAt = combined.effective_at;
    if (combined.created_at && !combined.createdAt) combined.createdAt = combined.created_at;
    if (combined.createdAt && !combined.created_at) combined.created_at = combined.createdAt;
  }

  if (table === 'account_trans') {
    const typeVal = combined.trans_type || combined.transType || combined.type;
    if (typeVal) {
      combined.trans_type = typeVal;
      combined.transType = typeVal;
      combined.type = typeVal;
    }
  }

  if (table === 'accounts') {
    if (!combined.entityName) combined.entityName = combined.entity_name || combined.accNameAr || combined.acc_name_ar || combined.acc_name_en || '';
    if (!combined.accountNumber) combined.accountNumber = combined.account_number || (combined.accountSeq ? String(combined.accountSeq).padStart(4, '0') : (combined.accountCode ? String(combined.accountCode).split('-')[1] : ''));
    if (!combined.accountPrefix) combined.accountPrefix = combined.account_prefix || (combined.accountCode ? String(combined.accountCode).split('-')[0] : '');
    if (!combined.parentCode) combined.parentCode = combined.groupId || combined.accSubId || combined.accountPrefix || '';
    if (combined.debitTotal === undefined) combined.debitTotal = 0;
    if (combined.creditTotal === undefined) combined.creditTotal = 0;
  }

  const normalized = normalizePayload(table, combined);
  return { id: rowId, [pkCol]: rowId, ...normalized };
}

// Helpers
export function normalizePayload(table: string, payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;

  // Specific normalization for 'roles' permissions field
  if (table === 'roles' && payload.permissions) {
    if (typeof payload.permissions === 'object' && !Array.isArray(payload.permissions)) {
      payload.permissions = Object.values(payload.permissions);
    }
  }

  // Generic object-to-array conversion for objects representing array maps (e.g. { "0": "...", "1": "..." })
  if (Array.isArray(payload)) {
    return payload.map(item => normalizePayload(table, item));
  }

  const keys = Object.keys(payload);
  for (const k of keys) {
    const val = payload[k];
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        payload[k] = val.map(item => normalizePayload(table, item));
      } else {
        const subKeys = Object.keys(val);
        const isArrayMap = subKeys.length > 0 && subKeys.every(key => !isNaN(Number(key)));
        if (isArrayMap) {
          payload[k] = Object.values(val).map(item => normalizePayload(table, item));
        } else {
          payload[k] = normalizePayload(table, val);
        }
      }
    }
  }

  return payload;
}

export function cleanData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanData(item));
  }
  if (typeof obj === 'object') {
    if (obj._methodName === 'serverTimestamp') {
      return Date.now();
    }
    // Specific custom classes used in PostgreSQL updates
    if (obj.constructor?.name === 'IncrementValue' || obj.constructor?.name === 'ArrayUnionValue') {
      return obj;
    }
    const clean: any = {};
    for (const k of Object.keys(obj)) {
      clean[k] = cleanData(obj[k]);
    }
    return clean;
  }
  return obj;
}
