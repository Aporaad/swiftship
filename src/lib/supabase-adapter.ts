import { createClient } from '@supabase/supabase-js';

// ── قراءة lazy للمتغيرات حتى تعمل بعد تحميل dotenv ────────────────────────
// لا تُقرأ كثوابت عالمية عند تهيئة الموديول — استخدم دوال getter
function getSupabaseUrl(): string {
  return (typeof process !== 'undefined' && (
    process.env?.VITE_SUPABASE_URL ||
    process.env?.SUPABASE_URL
  )) ||
    ((import.meta as any).env?.VITE_SUPABASE_URL) ||
    "";
}

function getSupabaseAnonKey(): string {
  return (typeof process !== 'undefined' && (
    process.env?.VITE_SUPABASE_ANON_KEY ||
    process.env?.SUPABASE_ANON_KEY
  )) ||
    ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    "";
}

let actualSupabaseClient: any = null;

function getSupabaseClient() {
  if (!actualSupabaseClient) {
    const resolvedUrl = getSupabaseUrl();
    const resolvedKey = getSupabaseAnonKey();

    if (!resolvedUrl || resolvedUrl === "https://placeholder-project.supabase.co") {
      console.warn('[Supabase Adapter] Warning: Supabase URL is missing or placeholder. Environment variables might not be loaded yet.');
    }

    actualSupabaseClient = createClient(
      resolvedUrl || "https://placeholder-project.supabase.co",
      resolvedKey || "placeholder-key"
    );
  }
  return actualSupabaseClient;
}

export const supabase = new Proxy({}, {
  get(target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
}) as any;

const isServer = typeof window === 'undefined';

const safeLocalStorage = {
  getItem(key: string): string | null {
    if (isServer) return null;
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (isServer) return;
    try {
      localStorage.setItem(key, value);
    } catch (_) { }
  },
  removeItem(key: string): void {
    if (isServer) return;
    try {
      localStorage.removeItem(key);
    } catch (_) { }
  }
};

const safeSessionStorage = {
  getItem(key: string): string | null {
    if (isServer) return null;
    try {
      return sessionStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (isServer) return;
    try {
      sessionStorage.setItem(key, value);
    } catch (_) { }
  },
  removeItem(key: string): void {
    if (isServer) return;
    try {
      sessionStorage.removeItem(key);
    } catch (_) { }
  }
};

function isOfflineMode(): boolean {
  if (isServer) return false;
  return !!(window as any).__isOfflineMode;
}

function setOfflineMode(value: boolean) {
  if (isServer) return;
  if (value) {
    (window as any).__isOfflineMode = true;
  } else {
    try {
      delete (window as any).__isOfflineMode;
    } catch (_) {
      (window as any).__isOfflineMode = undefined;
    }
  }
}

// Hold local cache of collections for in-memory querying to ensure fast, real-time reactive updates
const collectionCaches: { [table: string]: any[] } = {};
const collectionListeners: { [table: string]: Set<() => void> } = {};

// ─── نظام المصادقة المخصص - يعتمد كلياً على جدول public.users ──────────────
// Authentication system - uses public.users table exclusively (NOT supabase.auth)
export interface User {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  // حقول إضافية من public.users
  username?: string | null;
  role?: string | null;
  isRoot?: boolean;
  disabled?: boolean;
  systemPin?: string | null;
}

/** مفتاح تخزين الجلسة في localStorage */
const SESSION_STORAGE_KEY = 'swiftship_persisted_user';

const authListeners = new Set<(user: User | null) => void>();
let loggedInUser: User | null = null;
let authReady = false;

/**
 * تحويل سجل public.users إلى كائن User للنظام
 * Maps a public.users record to the application User object
 */
function mapPublicUser(row: any): User | null {
  if (!row) return null;
  return {
    uid: row.user_id || row.id || row.uid,
    email: row.email ?? null,
    emailVerified: true, // جميع المستخدمين في public.users تم التحقق منهم
    displayName: row.full_name || row.fullName || row.username || (row.email ? row.email.split('@')[0] : null),
    username: row.username ?? null,
    role: row.role ?? null,
    isRoot: !!row.is_root || !!row.isRoot,
    disabled: !!row.disabled,
    systemPin: row.system_pin || row.systemPin || null,
  };
}

/**
 * استرجاع المستخدم المحفوظ من sessionStorage (مستمر أثناء التحديث F5 وممحو عند إغلاق التبويب)
 * Retrieve the persisted user from sessionStorage (persists across reload, cleared on tab close)
 */
function getSavedUser(): User | null {
  try {
    const saved = safeSessionStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.uid) return parsed as User;
    }
  } catch (e) {
    console.warn('[Supabase Adapter] Failed to parse persisted user:', e);
  }
  // تنظيف مفتاح localStorage القديم لمنع أي استمرار تلقائي للجلسة عند فتح المتصفح من جديد
  safeLocalStorage.removeItem(SESSION_STORAGE_KEY);
  return null;
}

/**
 * حفظ بيانات المستخدم في sessionStorage بدلاً من localStorage
 * Persist user session data to sessionStorage
 */
function persistUser(user: User | null): void {
  if (user) {
    safeSessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    safeLocalStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    safeSessionStorage.removeItem(SESSION_STORAGE_KEY);
    safeLocalStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

/**
 * تحديث حالة المصادقة وإعلام جميع المستمعين
 * Update auth state and notify all listeners
 */
function setLoggedInUser(user: User | null): void {
  loggedInUser = user;
  persistUser(user);
  if (authReady) {
    authListeners.forEach((listener) => listener(user));
  }
}

// تهيئة الجلسة عند تحميل الموديول من localStorage
// Initialize session from localStorage on module load
loggedInUser = getSavedUser();

// تعيين authReady بشكل غير متزامن حتى تكتمل تهيئة الكاش
// Set authReady asynchronously after a minimal delay
const authReadyPromise = Promise.resolve().then(() => {
  authReady = true;
  authListeners.forEach((listener) => listener(loggedInUser));
  return loggedInUser;
});

export const auth: any = {
  get currentUser(): User | null { return loggedInUser; },
  signOut: async () => signOut(),
  getUserByEmail: async (email: string) => mockAdminAuth.getUserByEmail(email),
  createUser: async (properties: any) => mockAdminAuth.createUser(properties),
  createCustomToken: async (uid: string) => mockAdminAuth.createCustomToken(uid),
};

export function getAuth(...args: any[]) {
  return auth;
}

export function onAuthStateChanged(...args: any[]) {
  const callback = typeof args[1] === 'function' ? args[1] : (typeof args[0] === 'function' ? args[0] : () => { });
  authListeners.add(callback);
  if (authReady) callback(loggedInUser);
  else void authReadyPromise.then((user) => {
    if (authListeners.has(callback)) callback(user);
  });
  return () => { authListeners.delete(callback); };
}

// Populate collection cache and listen to realtime updates from Supabase
const lastFetchTimestamps: { [table: string]: number } = {};
const CACHE_TTL_MS = typeof window === 'undefined' ? 0 : 60000; // 0 on backend (always fresh), 60s in browser (realtime channel handles live updates)
const activeFetches: { [table: string]: Promise<any[]> | null } = {};
const collectionSubscribed: { [table: string]: boolean } = {};

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

/**
 * إثراء بيانات الطلب ديناميكياً بالأصناف والشحنات المجلوبة من الجداول المخصصة
 * Dynamically enrich order object with items and shipping details from products & shipments tables
 */
export function enrichOrderPayload(item: any): any {
  if (!item || typeof item !== 'object') return item;
  const orderId = item.id;
  const orderNum = item.order_number || item.orderNumber;

  const orderItemsCache = collectionCaches['order_items'] || collectionCaches['products'] || [];
  const matchedOrderItems = orderItemsCache.filter((oi: any) =>
    (oi.order_id && (oi.order_id === orderId || oi.order_id === orderNum)) ||
    (oi.orderId && (oi.orderId === orderId || oi.orderId === orderNum))
  );

  const shipmentsCache = collectionCaches['shipments'] || [];
  const matchedShipments = shipmentsCache.filter((s: any) =>
    (s.order_id && (s.order_id === orderId || s.order_id === orderNum)) ||
    (s.orderId && (s.orderId === orderId || s.orderId === orderNum))
  );

  return {
    ...item,
    items: matchedOrderItems,
    products: matchedOrderItems,
    orderItems: matchedOrderItems,
    shippingDetails: matchedShipments,
    shippings: matchedShipments
  };
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

async function ensureCache(table: string): Promise<any[]> {
  const now = Date.now();
  const lastFetch = lastFetchTimestamps[table] || 0;
  const isStale = (now - lastFetch > CACHE_TTL_MS) || (lastFetch === 0);

  if (!collectionCaches[table]) {
    // 1. Try to load from localStorage cache first so it's instantly available or when offline
    try {
      const savedData = safeLocalStorage.getItem(`swiftship_table_backup_${table}`);
      if (savedData) {
        collectionCaches[table] = JSON.parse(savedData);
      }
    } catch (e) {
      console.warn(`[Supabase Adapter] Error parsing cached local storage backup for ${table}:`, e);
    }

    if (!collectionCaches[table]) {
      collectionCaches[table] = [];
    }
  }

  // Pre-load products, order_items and shipments when fetching orders to ensure relational fields items and shippingDetails are populated
  if (table === 'orders' && !isOfflineMode()) {
    Promise.all([ensureCache('products'), ensureCache('order_items'), ensureCache('shipments')]).catch(() => { });
  }

  // 2. Fetch from network ONLY if cache is stale or has never fetched
  if (isStale && !isOfflineMode()) {
    if (!activeFetches[table]) {
      activeFetches[table] = (async () => {
        try {
          const { data, error } = await supabase.from(table).select('*');
          // Always mark fetch timestamp to prevent infinite network retry loops on empty or 404 tables
          lastFetchTimestamps[table] = Date.now();

          if (error) {
            console.warn(`[Supabase Adapter] Failed to load table ${table} from remote: ${error.message}. Falling back to offline/local cache.`);
          } else {
            collectionCaches[table] = (data || []).map(row => extractRowPayload(table, row));

            // Update local backup
            try {
              safeLocalStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(collectionCaches[table]));
            } catch (lsErr) {
              console.warn(`[Supabase Adapter] Saving backup failed for ${table}:`, lsErr);
            }

            // Notify listeners that remote network data has loaded successfully
            if (collectionListeners[table]) {
              collectionListeners[table].forEach(cb => cb());
            }
          }
        } catch (e: any) {
          lastFetchTimestamps[table] = Date.now();
          console.warn(`[Supabase Adapter] Network/Database exception reading table ${table}: ${e.message}`);
        } finally {
          activeFetches[table] = null;
        }
        return collectionCaches[table];
      })();
    }
    await activeFetches[table];
  }

  // 3. Dynamic realtime subscription per collection using channels, only active when online and not subscribed yet
  if (!collectionSubscribed[table] && !isOfflineMode()) {
    collectionSubscribed[table] = true;
    try {
      supabase
        .channel(`realtime:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
          const cache = collectionCaches[table] || [];
          const rowId = payload.new?.id || payload.old?.id;

          if (payload.eventType === 'DELETE') {
            collectionCaches[table] = cache.filter(item => item.id !== rowId);
          } else if (payload.new) {
            const newItem = extractRowPayload(table, payload.new);
            const index = cache.findIndex(item => item.id === rowId);
            if (index >= 0) {
              cache[index] = newItem;
            } else {
              cache.push(newItem);
            }
          }
          // Save updated live data to localStorage backup
          try {
            safeLocalStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(collectionCaches[table]));
          } catch (_) { }

          if (collectionListeners[table]) {
            collectionListeners[table].forEach(cb => cb());
          }
        })
        .subscribe();
    } catch (rtErr: any) {
      console.warn(`[Supabase Adapter] Realtime channel setup failed for ${table}:`, rtErr.message);
      collectionSubscribed[table] = false;
    }
  }

  return collectionCaches[table] || [];
}

// In-Memory query and constraint filtering layer
class SupabaseQuery {
  path: string;
  constraints: any[] = [];
  constructor(path: string, constraints: any[] = []) {
    this.path = path;
    this.constraints = constraints;
  }
}

class DocRef {
  type = 'doc';
  path: string;
  id: string;
  constructor(path: string, id: string) {
    this.path = path;
    this.id = id;
  }
}

function applyQuery(items: any[], queryObj: SupabaseQuery): any[] {
  let filtered = [...items];

  const evaluateCondition = (item: any, cond: any): boolean => {
    const val = item[cond.field];
    const compare = cond.value;

    switch (cond.op) {
      case '==':
        return val === compare;
      case '!=':
        return val !== compare;
      case '>':
        return val > compare;
      case '>=':
        return val >= compare;
      case '<':
        return val < compare;
      case '<=':
        return val <= compare;
      case 'array-contains':
        return Array.isArray(val) && val.includes(compare);
      case 'in':
        return Array.isArray(compare) && compare.includes(val);
      default:
        return true;
    }
  };

  for (const c of queryObj.constraints) {
    if (c.type === 'where') {
      filtered = filtered.filter(item => evaluateCondition(item, c));
    } else if (c.type === 'or') {
      filtered = filtered.filter(item => {
        return c.conditions.some((cond: any) => evaluateCondition(item, cond));
      });
    }
  }

  // Handle orderBy
  const sortConstraints = queryObj.constraints.filter(c => c.type === 'orderBy');
  if (sortConstraints.length > 0) {
    filtered.sort((a, b) => {
      for (const s of sortConstraints) {
        const valA = a[s.field];
        const valB = b[s.field];
        if (valA !== valB) {
          const order = s.direction === 'desc' ? -1 : 1;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          return valA > valB ? order : -order;
        }
      }
      return 0;
    });
  }

  // Handle limit
  const limitConstraint = queryObj.constraints.find(c => c.type === 'limit');
  if (limitConstraint) {
    filtered = filtered.slice(0, limitConstraint.value);
  }

  return filtered;
}

export interface User {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  getIdToken?: () => Promise<string>;
}

// Supabase document-style API adapter implementation
export const db: any = {
  type: 'supabase',
  collection(path: string) {
    return {
      doc(id: string) {
        const ref = new DocRef(path, id);
        return {
          id,
          path: `${path}/${id}`,
          set: async (docData: any, options?: any) => {
            await setDoc(ref, docData, options);
          },
          update: async (docData: any) => {
            await updateDoc(ref, docData);
          },
          get: async () => {
            return await getDoc(ref);
          },
          delete: async () => {
            await deleteDoc(ref);
          }
        };
      }
    };
  }
};

export function initializeApp(...args: any[]): any {
  return {
    name: 'default',
    options: {},
    automaticDataCollectionEnabled: false
  };
}

export function deleteApp(...args: any[]): any {
  return Promise.resolve();
}

export function cert(...args: any[]): any {
  return { cert: true };
}

export function getPostgreSQL(...args: any[]): any {
  return db;
}

export function getFirestore(...args: any[]): any {
  return db;
}

export const inMemoryPersistence = 'inMemory';

export function initializeAuth(...args: any[]): any {
  return auth;
}

/**
 * تسجيل الدخول بالبريد الإلكتروني أو اسم المستخدم وكلمة المرور من جدول public.users
 * Sign in using email/username and password from the public.users table
 */
export async function signInWithPassword(emailOrUsername: string, pass: string): Promise<{ user: User }> {
  // تطبيع المدخل - تحويل 'admin' إلى البريد الافتراضي
  // Normalize input - convert 'admin' to the default admin email
  const normalizedInput = emailOrUsername.trim().toLowerCase();
  const isEmail = normalizedInput.includes('@');

  // الاستعلام من جدول public.users مباشرة بالبريد أو اسم المستخدم
  // Query directly from public.users table by email or username
  let query = supabase.from('users').select('*');
  if (isEmail) {
    query = query.eq('email', normalizedInput);
  } else {
    // البحث باسم المستخدم مع عدم حساسية الحروف
    // Search by username (case-insensitive)
    query = query.ilike('username', normalizedInput);
  }
  const { data: rows, error } = await query.limit(1);

  if (error) {
    console.error('[Auth] Error querying public.users:', error);
    const err = new Error('حدث خطأ في الاتصال بقاعدة البيانات') as any;
    err.code = 'auth/network-error';
    throw err;
  }

  const row = rows?.[0];
  if (!row) {
    const err = new Error('المستخدم غير موجود') as any;
    err.code = 'auth/user-not-found';
    throw err;
  }

  // التحقق من كلمة المرور (مطابقة نصية مباشرة)
  // Verify password (direct string match against stored password)
  if (row.password !== pass) {
    const err = new Error('بيانات الدخول غير صحيحة') as any;
    err.code = 'auth/invalid-credential';
    throw err;
  }

  // بناء كائن المستخدم وحفظ الجلسة
  // Build user object and persist session
  const user = mapPublicUser(row);
  if (!user) {
    const err = new Error('فشل في تحليل بيانات المستخدم') as any;
    err.code = 'auth/internal-error';
    throw err;
  }

  setLoggedInUser(user);
  return { user };
}

/**
 * دالة متوافقة مع نمط Firebase (تستخدم signInWithPassword داخلياً)
 * Firebase-compatible signature - delegates to signInWithPassword
 */
export async function signInWithEmailAndPassword(authInstance: any, email: string, pass: string): Promise<any> {
  return signInWithPassword(email, pass);
}

export async function createUserWithEmailAndPassword(authInstance: any, email: string, pass: string): Promise<any> {
  // إنشاء مستخدم جديد في public.users
  // Create new user in public.users
  const newId = 'usr_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  const { data, error } = await supabase.from('users').insert({
    id: newId,
    email,
    password: pass,
    role: 'Customer',
    disabled: false,
    created_at: Date.now(),
  }).select('*').single();

  if (error) {
    const err = new Error(error.message) as any;
    err.code = 'auth/email-already-in-use';
    throw err;
  }

  const user = mapPublicUser(data);
  setLoggedInUser(user);
  return { user };
}

export function collection(dbInstance: any, path: string) {
  return new SupabaseQuery(path);
}

export function doc(...args: any[]) {
  // If first arg is a DocRef, return it
  if (args[0] instanceof DocRef) {
    return args[0];
  }
  // If first arg is a SupabaseQuery (CollectionRef), map it with its path and a secure auto-generated ID
  if (args[0] instanceof SupabaseQuery) {
    const id = args[1] || (Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11));
    return new DocRef(args[0].path, id);
  }
  // doc(db, 'id') or doc('table', 'id') or doc(db, 'table', 'id')
  if (args.length === 2 && typeof args[1] === 'string') {
    const parts = args[1].split('/');
    if (parts.length >= 2) {
      return new DocRef(parts[0], parts[1]);
    }
    return new DocRef(args[1], "");
  }
  if (args.length === 3 && typeof args[1] === 'string' && typeof args[2] === 'string') {
    return new DocRef(args[1], args[2]);
  }
  const mainPath = typeof args[1] === 'string' ? args[1] : (typeof args[0] === 'string' ? args[0] : 'unknown');
  const subId = typeof args[2] === 'string' ? args[2] : '';
  return new DocRef(mainPath, subId);
}

export function query(collectionRef: SupabaseQuery, ...constraints: any[]) {
  return new SupabaseQuery(collectionRef.path, [...collectionRef.constraints, ...constraints]);
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(value: number) {
  return { type: 'limit', value };
}

export function or(...conditions: any[]) {
  return { type: 'or', conditions };
}

export async function getDocs(queryObj: SupabaseQuery) {
  const table = queryObj.path;
  const allItems = await ensureCache(table);
  const filtered = applyQuery(allItems, queryObj);

  const docs = filtered.map(rawItem => {
    const item = table === 'orders' ? enrichOrderPayload(rawItem) : rawItem;
    return {
      id: item.id,
      ref: new DocRef(table, item.id),
      exists: () => true,
      data: () => {
        const { id, ...rest } = item;
        return rest;
      }
    };
  });

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: any) => docs.forEach(cb)
  };
}

export async function getDoc(docRef: DocRef) {
  const table = docRef.path;
  const id = docRef.id;
  const allItems = await ensureCache(table);
  const rawItem = allItems.find(i => i.id === id);
  const item = (table === 'orders' && rawItem) ? enrichOrderPayload(rawItem) : rawItem;

  return {
    id,
    exists: () => !!item,
    data: () => {
      if (!item) return undefined;
      const { id: _, ...rest } = item;
      return rest;
    }
  };
}

export async function getDocFromServer(docRef: DocRef) {
  return getDoc(docRef);
}

const DIRECT_COLUMNS_MAP: Record<string, Record<string, string>> = {
  employees: { fullName: 'full_name', nameAr: 'name_ar', nameEn: 'name_en', accountId: 'account_id', monthlySalary: 'monthly_salary', currency: 'currency', jobsType: 'job_type', jobType: 'job_type', createdAt: 'created_at', createdBy: 'created_by' },
  users: { role: 'role', username: 'username', email: 'email', disabled: 'disabled', linkedType: 'linked_type', linkedEntity: 'linked_entity', fullName: 'full_name', password: 'password', systemPin: 'system_pin', isRoot: 'is_root', phone: 'phone', address: 'address', createdAt: 'created_at', updatedAt: 'updated_at', lastSeen: 'last_seen', lastSeenAt: 'last_seen_at' },
  portal_users: { portalRole: 'portal_role', username: 'username', email: 'email', disabled: 'disabled', isDisabled: 'is_disabled', approvalStatus: 'approval_status', linkedCustomerId: 'linked_customer_id', accountId: 'account_id', fullName: 'full_name', nameAr: 'name_ar', nameEn: 'name_en' },
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
      } else if ((table === 'users' || table === 'items_category' || table === 'order_option' || table === 'cust_details') && (col === 'createdAt' || col === 'updatedAt' || col === 'lastSeen' || col === 'created_at' || col === 'updated_at')) {
        if (typeof val === 'string') {
          const parsed = Date.parse(val);
          extracted[col] = isNaN(parsed) ? (Number(val) || Date.now()) : Math.floor(parsed);
        } else if (typeof val === 'number') {
          extracted[col] = Math.floor(val);
        } else {
          extracted[col] = val;
        }
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

export function createWriteError(operation: 'insert' | 'upsert' | 'update' | 'delete', table: string, error: any): Error {
  const writeError = new Error(`[Supabase Adapter] ${operation} failed on table ${table}: ${error?.message || 'Unknown database write error'}`);
  (writeError as any).code = error?.code;
  (writeError as any).cause = error;
  return writeError;
}

export async function addDoc(newID: any, collectionRef: SupabaseQuery, rawData: any) {
  const table = collectionRef.path;
  const pkCol = getTablePrimaryKey(table);
  let id = newID ? String(newID) : 'noId_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);

  // Uniqueness check against cached items to prevent duplicate primary key violations
  const cache = collectionCaches[table] || [];
  if (cache.some((item: any) => String(item.id) === id || String(item[pkCol]) === id)) {
    id = `${id}_${Math.random().toString(36).substring(2, 6)}`;
  }
  const rawClean = cleanData(rawData);
  const data = sanitizeDataPayload(table, rawClean);

  if (!isOfflineMode()) {
    const directCols = extractDirectColumns(table, rawClean);
    const writePayload = usesExplicitFinancialColumns(table) ? { [pkCol]: id, ...directCols } : { [pkCol]: id, ...directCols, data };
    const { error } = await supabase.from(table).insert(writePayload);
    if (error) {
      const isRlsError = error?.code === '42501' || String(error?.message || '').toLowerCase().includes('row-level security');
      if (isRlsError) {
        console.warn(`[Supabase Adapter] RLS warning on ${table}: ${error?.message}. Local cache preserved.`);
      } else {
        throw createWriteError('insert', table, error);
      }
    }
  } else {
    // Offline mode: buffering addDoc local write
  }

  const newItem = extractRowPayload(table, { [pkCol]: id, id, ...extractDirectColumns(table, rawClean), data });
  if (!collectionCaches[table]) collectionCaches[table] = [];
  collectionCaches[table].push(newItem);

  // إعلام استماع الطلبات عند إضافة منتج أو شحنة جديدة
  // Notify orders listeners when a product or shipment is added
  if ((table === 'products' || table === 'order_items' || table === 'shipments') && collectionListeners['orders']) {
    collectionListeners['orders'].forEach(cb => cb());
  }

  // Safe write update in localStorage backup
  try {
    safeLocalStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(collectionCaches[table]));
  } catch (_) { }

  if (collectionListeners[table]) {
    collectionListeners[table].forEach(cb => cb());
  }

  return { id };
}

export async function addAssDoc(newID: any, arg1: any, collectionRef: SupabaseQuery, rawData: any) {
  const table = collectionRef.path;
  const pkCol = getTablePrimaryKey(table);
  const id = newID ? newID : 'noId_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  const assetCode = arg1 ? arg1 : 'noAssetCode_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  const rawClean = cleanData(rawData);
  const data = sanitizeDataPayload(table, rawClean);

  if (!isOfflineMode()) {
    const directCols = extractDirectColumns(table, rawClean);
    const writePayload = usesExplicitFinancialColumns(table)
      ? { [pkCol]: id, assetCode, ...directCols }
      : { [pkCol]: id, assetCode, ...directCols, data };
    const { error } = await supabase.from(table).insert(writePayload);
    if (error) {
      throw createWriteError('insert', table, error);
    }
  } else {
    // Offline mode: buffering addDoc local write
  }

  const newItem = extractRowPayload(table, { [pkCol]: id, id, assetCode, ...extractDirectColumns(table, rawClean), data });
  if (!collectionCaches[table]) collectionCaches[table] = [];
  collectionCaches[table].push(newItem);

  // Safe write update in localStorage backup
  try {
    safeLocalStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(collectionCaches[table]));
  } catch (_) { }

  if (collectionListeners[table]) {
    collectionListeners[table].forEach(cb => cb());
  }

  return { id };
}

export async function setDoc(docRef: DocRef, rawData: any, options?: any) {
  const table = docRef.path;
  const pkCol = getTablePrimaryKey(table);
  const id = docRef.id;
  let rawClean = cleanData(rawData);

  if (options && options.merge) {
    const all = await ensureCache(table);
    const existing = all.find(item => item.id === id || item[pkCol] === id) || {};
    const { id: _, [pkCol]: __, ...existingData } = existing;
    rawClean = { ...existingData, ...rawClean };
  }
  const data = sanitizeDataPayload(table, rawClean);

  if (!isOfflineMode()) {
    const directCols = extractDirectColumns(table, rawClean);
    const writePayload = usesExplicitFinancialColumns(table) ? { [pkCol]: id, ...directCols } : { [pkCol]: id, ...directCols, data };
    const { error } = await supabase.from(table).upsert(writePayload);
    if (error) {
      const isRlsError = error?.code === '42501' || String(error?.message || '').toLowerCase().includes('row-level security');
      if (isRlsError) {
        console.warn(`[Supabase Adapter] RLS warning on ${table}: ${error?.message}. Local cache preserved.`);
      } else {
        throw createWriteError('upsert', table, error);
      }
    }
  } else {
    // Offline mode: buffering setDoc local write
  }

  const newItem = extractRowPayload(table, { [pkCol]: id, id, ...extractDirectColumns(table, rawClean), data });
  if (!collectionCaches[table]) collectionCaches[table] = [];
  const idx = collectionCaches[table].findIndex(item => item.id === id || item[pkCol] === id);
  if (idx >= 0) {
    collectionCaches[table][idx] = newItem;
  } else {
    collectionCaches[table].push(newItem);
  }

  // إعلام استماع الطلبات عند تعديل منتج أو شحنة
  // Notify orders listeners when a product or shipment is updated
  if ((table === 'products' || table === 'order_items' || table === 'shipments') && collectionListeners['orders']) {
    collectionListeners['orders'].forEach(cb => cb());
  }

  // Safe write update in localStorage backup
  try {
    safeLocalStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(collectionCaches[table]));
  } catch (_) { }

  if (collectionListeners[table]) {
    collectionListeners[table].forEach(cb => cb());
  }
}

class IncrementValue {
  amount: number;
  constructor(amount: number) {
    this.amount = amount;
  }
}

export function increment(amount: number) {
  return new IncrementValue(amount);
}

class ArrayUnionValue {
  _methodName = 'arrayUnion';
  elements: any[];
  constructor(elements: any[]) {
    this.elements = elements;
  }
}

export function arrayUnion(...elements: any[]) {
  return new ArrayUnionValue(elements);
}

export async function updateDoc(docRef: DocRef, rawData: any) {
  const table = docRef.path;
  const pkCol = getTablePrimaryKey(table);
  const id = docRef.id;

  const all = await ensureCache(table);
  const existing = all.find(item => item.id === id || item[pkCol] === id) || {};
  const { id: _, [pkCol]: __, ...existingData } = existing;

  const resolvedPayload: any = {};
  for (const k of Object.keys(rawData)) {
    const val = rawData[k];
    if (val instanceof IncrementValue) {
      const currentVal = parseFloat(existingData[k]) || 0;
      resolvedPayload[k] = currentVal + val.amount;
    } else if (val instanceof ArrayUnionValue) {
      const currentArr = Array.isArray(existingData[k]) ? existingData[k] : [];
      resolvedPayload[k] = [...currentArr, ...val.elements.filter((e: any) => !currentArr.includes(e))];
    } else {
      resolvedPayload[k] = cleanData(val);
    }
  }

  // دمج البيانات السابقة مع التحديث لتجنب مسح أي حقول من كائن data في PostgreSQL عند التحديث الجزئي
  // Merge existing document fields with update payload to prevent wiping JSONB data column on partial update
  const rawClean = { ...existingData, ...resolvedPayload };
  const data = sanitizeDataPayload(table, rawClean);

  if (!isOfflineMode()) {
    const directCols = extractDirectColumns(table, rawClean);
    const writePayload = usesExplicitFinancialColumns(table) ? directCols : { ...directCols, data };
    const { error } = await supabase.from(table).update(writePayload).eq(pkCol, id);
    if (error) {
      const isRlsError = error?.code === '42501' || String(error?.message || '').toLowerCase().includes('row-level security');
      if (isRlsError) {
        console.warn(`[Supabase Adapter] RLS warning on ${table}: ${error?.message}. Local cache preserved.`);
      } else {
        throw createWriteError('update', table, error);
      }
    }
  } else {
    // Offline mode: buffering updateDoc local write
  }


  const newItem = extractRowPayload(table, { [pkCol]: id, id, ...extractDirectColumns(table, rawClean), data });
  const idx = collectionCaches[table].findIndex(item => item.id === id || item[pkCol] === id);
  if (idx >= 0) {
    collectionCaches[table][idx] = newItem;
  }

  // إعلام استماع الطلبات عند تحديث منتج أو شحنة
  // Notify orders listeners when a product or shipment is updated
  if ((table === 'products' || table === 'order_items' || table === 'shipments') && collectionListeners['orders']) {
    collectionListeners['orders'].forEach(cb => cb());
  }

  // Safe write update in localStorage backup
  try {
    safeLocalStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(collectionCaches[table]));
  } catch (_) { }

  if (collectionListeners[table]) {
    collectionListeners[table].forEach(cb => cb());
  }
}

export async function deleteDoc(docRef: DocRef) {
  const table = docRef.path;
  const pkCol = getTablePrimaryKey(table);
  const id = docRef.id;

  if (!isOfflineMode()) {
    const { error } = await supabase.from(table).delete().eq(pkCol, id);
    if (error) {
      throw createWriteError('delete', table, error);
    }
  } else {
    // Offline mode: buffering deleteDoc local write
  }

  if (collectionCaches[table]) {
    collectionCaches[table] = collectionCaches[table].filter(item => item.id !== id && item[pkCol] !== id);
  }

  // Safe write update in localStorage backup
  try {
    safeLocalStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(collectionCaches[table]));
  } catch (_) { }

  if (collectionListeners[table]) {
    collectionListeners[table].forEach(cb => cb());
  }
}

/**
 * إعادة استعلام المجموعات من خادم Supabase وإعادة بناء الذاكرة المؤقتة وإشعار المستمعين
 * Force refetch a collection table from Supabase, update cache, and trigger active listeners
 */
export async function refetchCollection(table: string): Promise<any[]> {
  delete lastFetchTimestamps[table];
  delete collectionCaches[table];
  delete activeFetches[table];
  const items = await ensureCache(table);
  if (collectionListeners[table]) {
    collectionListeners[table].forEach(cb => cb());
  }
  return items;
}

/**
 * تحديث الذاكرة المؤقتة فورياً بعد حذف طلبات عبر إجراء RPC وإشعار كافة الواجهات بالاختفاء الفوري
 * Instantly update local in-memory cache after order deletion RPC and trigger reactive UI listeners
 */
export function notifyOrderDeletionInCache(orderIds: string[]) {
  if (!orderIds || !orderIds.length) return;
  const idsSet = new Set(orderIds.map(id => String(id || '').trim()).filter(Boolean));

  // 1. إزالة الطلبات المحذوفة من كاش الطلبات وتحديث التخزين المحلي
  // Remove deleted orders from orders cache and update localStorage backup
  if (collectionCaches['orders']) {
    collectionCaches['orders'] = collectionCaches['orders'].filter(order =>
      !idsSet.has(String(order.id || '').trim()) &&
      !idsSet.has(String(order.order_number || order.orderNumber || '').trim())
    );
    try {
      safeLocalStorage.setItem('swiftship_table_backup_orders', JSON.stringify(collectionCaches['orders']));
    } catch (_) { }
  }

  // 2. إزالة الشحنات المرتبطة من كاش الشحنات
  // Remove linked shipments from shipments cache
  if (collectionCaches['shipments']) {
    collectionCaches['shipments'] = collectionCaches['shipments'].filter(s =>
      !idsSet.has(String(s.order_id || s.orderId || '').trim())
    );
    try {
      safeLocalStorage.setItem('swiftship_table_backup_shipments', JSON.stringify(collectionCaches['shipments']));
    } catch (_) { }
  }

  // 3. إزالة بنود الطلب من كاش order_items
  // Remove linked order items from order_items cache
  if (collectionCaches['order_items']) {
    collectionCaches['order_items'] = collectionCaches['order_items'].filter(item =>
      !idsSet.has(String(item.order_id || item.orderId || '').trim())
    );
    try {
      safeLocalStorage.setItem('swiftship_table_backup_order_items', JSON.stringify(collectionCaches['order_items']));
    } catch (_) { }
  }

  // 4. إعادة ضبط التوقيتات للجداول المتأثرة لإلزام المزامنة الشبكية التالية
  // Invalidate fetch timestamps for affected relational tables
  ['orders', 'shipments', 'order_items', 'products', 'main_entry', 'account_trans', 'notifications', 'whatsapp_logs', 'orders_history'].forEach(table => {
    delete lastFetchTimestamps[table];
    delete activeFetches[table];
  });

  // 5. إشعار جميع المستمعين المتصلين بجداول الطلبات والشحنات والبنود للتحديث الفوري بالواجهة
  // Trigger all active snapshot listeners for orders, shipments, order_items, and products
  ['orders', 'shipments', 'order_items', 'products'].forEach(table => {
    if (collectionListeners[table]) {
      collectionListeners[table].forEach(cb => cb());
    }
  });
}

// Mock Batch write functionality
class MockWriteBatch {
  operations: Array<() => Promise<void>> = [];

  set(docRef: DocRef, data: any, options?: any) {
    this.operations.push(() => setDoc(docRef, data, options));
  }

  update(docRef: DocRef, data: any) {
    this.operations.push(() => updateDoc(docRef, data));
  }

  delete(docRef: DocRef) {
    this.operations.push(() => deleteDoc(docRef));
  }

  async commit() {
    for (const op of this.operations) {
      await op();
    }
  }
}

export function writeBatch(...args: any[]) {
  return new MockWriteBatch();
}

export function serverTimestamp() {
  return Date.now();
}

export function onSnapshot(
  queryObj: any,
  callback: (snapshot: any) => void,
  errorCallback?: (error: any) => void
) {
  if (queryObj instanceof DocRef) {
    const table = queryObj.path;
    const docId = queryObj.id;

    const docListener = async () => {
      try {
        const allItems = await ensureCache(table);
        const rawItem = allItems.find(i => i.id === docId);
        const item = (table === 'orders' && rawItem) ? enrichOrderPayload(rawItem) : rawItem;
        callback({
          id: docId,
          exists: () => !!item,
          data: () => {
            if (!item) return undefined;
            const { id: _, ...rest } = item;
            return rest;
          }
        });
      } catch (err) {
        if (errorCallback) errorCallback(err);
      }
    };

    if (!collectionListeners[table]) {
      collectionListeners[table] = new Set();
    }
    collectionListeners[table].add(docListener);
    docListener();

    return () => {
      if (collectionListeners[table]) {
        collectionListeners[table].delete(docListener);
      }
    };
  }

  const table = queryObj.path;
  const listener = async () => {
    try {
      const allItems = await ensureCache(table);
      const filtered = queryObj instanceof SupabaseQuery ? applyQuery(allItems, queryObj) : allItems;

      const docs = filtered.map(rawItem => {
        const item = table === 'orders' ? enrichOrderPayload(rawItem) : rawItem;
        return {
          id: item.id,
          ref: new DocRef(table, item.id),
          exists: () => true,
          data: () => {
            const { id, ...rest } = item;
            return rest;
          }
        };
      });

      callback({
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (cb: any) => docs.forEach(cb),
        docChanges: () => []
      });
    } catch (err) {
      if (errorCallback) errorCallback(err);
    }
  };

  if (!collectionListeners[table]) {
    collectionListeners[table] = new Set();
  }
  collectionListeners[table].add(listener);
  listener();

  return () => {
    if (collectionListeners[table]) {
      collectionListeners[table].delete(listener);
    }
  };
}

/** Clear only cached application data. Supabase Auth remains the source of truth for identity. */
export function clearAllLocalData(): void {
  if (!isServer) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('swiftship_table_backup_')) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch (_) { }
  }
  for (const table of Object.keys(collectionCaches)) delete collectionCaches[table];
  for (const table of Object.keys(lastFetchTimestamps)) delete lastFetchTimestamps[table];
}

// ملاحظة: تم تعريف signInWithPassword أعلى في الملف (سطر 660) وتستعلم من public.users
// Note: signInWithPassword is defined earlier in this file (line ~660) and uses public.users
// لا تعيد تعريفها هنا - تم حذف التعريف المكرر الذي يستخدم supabase.auth

export async function signUpWithPassword(email: string, password: string) {
  return createUserWithEmailAndPassword(null, email.trim().toLowerCase(), password);
}

/**
 * تسجيل الخروج - مسح بيانات الجلسة من localStorage
 * Sign out - clears session from localStorage only (no supabase.auth dependency)
 */
export async function signOut(...args: any[]) {
  clearAllLocalData();
  setLoggedInUser(null);
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// Date parsing helper
export function safeToDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
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

function cleanData(obj: any): any {
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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('[Supabase query/mutation error]:', error, operationType, path);
}

export function handlePostgreSQLError(error: unknown, operationType: OperationType, path: string | null) {
  handleSupabaseError(error, operationType, path);
}

// Mock Admin utilities for Supabase
const mockAdminAuth = {
  getUserByEmail: async (email: string) => {
    const allUsers = await ensureCache('users');
    const userRow = allUsers.find(item => item.email === email);
    if (userRow) {
      return { uid: userRow.id, email: userRow.email };
    }
    const err = new Error('User not found') as any;
    err.code = 'auth/user-not-found';
    throw err;
  },
  createUser: async (properties: any) => {
    const email = properties.email;
    const uid = Math.random().toString(36).substring(2, 11);
    return { uid, email };
  },
  createCustomToken: async (uid: string) => {
    return `custom_token_${uid}`;
  }
};

const mockAdminPostgreSQL = () => {
  return {
    collection: (path: string) => {
      return {
        doc: (id: string) => {
          return {
            set: async (docData: any, options?: any) => {
              await setDoc(new DocRef(path, id), docData, options);
            }
          };
        }
      };
    }
  };
};

export function encryptDataLocal(text: string, key: string): string {
  let result = '';
  const cleanKey = key || 'swiftship_emergency_core_system_salt';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = cleanKey.charCodeAt(i % cleanKey.length);
    result += String.fromCharCode(charCode ^ keyChar);
  }
  return btoa(unescape(encodeURIComponent(result)));
}

export function decryptDataLocal(cipherText: string, key: string): string {
  try {
    const cleanKey = key || 'swiftship_emergency_core_system_salt';
    const text = decodeURIComponent(escape(atob(cipherText)));
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = cleanKey.charCodeAt(i % cleanKey.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  } catch (e) {
    return '';
  }
}

export function simpleHashPassword(message: string): string {
  let hash = 0;
  const input = message || '';
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return 'emergency_hash_v1_' + Math.abs(hash).toString(16) + '_' + input.length;
}

export const admin = {
  apps: [{ name: 'default' }],
  initializeApp: (...args: any[]) => ({}),
  auth: () => mockAdminAuth,
  supabase: mockAdminPostgreSQL,
  firestore: mockAdminPostgreSQL
};

export default admin;
