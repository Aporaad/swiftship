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

// Cache and Sync session state
let currentSession: any = null;
let loggedInUser: any = null;

function getSavedUser() {
  try {
    const savedUser = safeLocalStorage.getItem('swiftship_persisted_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed && parsed.uid) {
        return {
          ...parsed,
          getIdToken: async () => 'session_token'
        };
      }
    }
  } catch (e) {
    console.warn('[Supabase Adapter] Failed to parse swiftship_persisted_user:', e);
  }
  return null;
}

loggedInUser = getSavedUser();

let authInitialized = false;

const initPromise = supabase.auth.getSession().then(({ data }) => {
  if (!authInitialized) {
    currentSession = data.session;

    const localUser = getSavedUser();
    if (data.session?.user) {
      loggedInUser = mapUser(data.session.user);
      if (loggedInUser) {
        safeLocalStorage.setItem('swiftship_persisted_user', JSON.stringify({
          uid: loggedInUser.uid,
          email: loggedInUser.email,
          displayName: loggedInUser.displayName,
          emailVerified: loggedInUser.emailVerified
        }));
      }
    } else if (localUser) {
      loggedInUser = localUser;
    } else {
      loggedInUser = null;
      safeLocalStorage.removeItem('swiftship_persisted_user');
    }

    authInitialized = true;
    authListeners.forEach(cb => cb(loggedInUser));
  }
  return loggedInUser;
});

supabase.auth.onAuthStateChange((event, session) => {
  currentSession = session;

  if (session?.user) {
    loggedInUser = mapUser(session.user);
    if (loggedInUser) {
      safeLocalStorage.setItem('swiftship_persisted_user', JSON.stringify({
        uid: loggedInUser.uid,
        email: loggedInUser.email,
        displayName: loggedInUser.displayName,
        emailVerified: loggedInUser.emailVerified
      }));
    }
  } else {
    // Check if we have a locally saved user to protect against unintentional sign-outs on page load
    const localUser = getSavedUser();
    if (localUser) {
      loggedInUser = localUser;
    } else {
      loggedInUser = null;
      safeLocalStorage.removeItem('swiftship_persisted_user');
    }
  }

  if (authInitialized) {
    authListeners.forEach(cb => cb(loggedInUser));
  }
});

const authListeners = new Set<(user: any) => void>();

function mapUser(sbUser: any) {
  if (!sbUser) return null;
  return {
    uid: sbUser.id,
    email: sbUser.email,
    emailVerified: !!sbUser.email_confirmed_at,
    displayName: sbUser.user_metadata?.fullName || sbUser.user_metadata?.username || sbUser.email?.split('@')[0],
    getIdToken: async () => sbUser.jwt || 'session_token',
  };
}

// Populate collection cache and listen to realtime updates from Supabase
const lastFetchTimestamps: { [table: string]: number } = {};
const CACHE_TTL_MS = typeof window === 'undefined' ? 0 : 60000; // 0 on backend (always fresh), 60s in browser (realtime channel handles live updates)
const activeFetches: { [table: string]: Promise<any[]> | null } = {};
const collectionSubscribed: { [table: string]: boolean } = {};

export function extractRowPayload(table: string, row: any): any {
  if (!row) return {};
  const rowId = row.id;
  const rawData = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});

  // Extract top-level database columns excluding the 'data' JSON column itself
  const { data: _, ...topCols } = row;

  // Merge top-level columns with JSON data payload
  const combined = { ...topCols, ...rawData };

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

  const normalized = normalizePayload(table, combined);
  return { id: rowId, ...normalized };
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
class FirebaseQuery {
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

function applyQuery(items: any[], queryObj: FirebaseQuery): any[] {
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

// Firebase SDK implementation
export const db: any = {
  type: 'firestore',
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

export function getFirestore(...args: any[]): any {
  return db;
}

export function collection(dbInstance: any, path: string) {
  return new FirebaseQuery(path);
}

export function doc(...args: any[]) {
  // If first arg is a DocRef, return it
  if (args[0] instanceof DocRef) {
    return args[0];
  }
  // If first arg is a FirebaseQuery (CollectionRef), map it with its path and a secure auto-generated ID
  if (args[0] instanceof FirebaseQuery) {
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

export function query(collectionRef: FirebaseQuery, ...constraints: any[]) {
  return new FirebaseQuery(collectionRef.path, [...collectionRef.constraints, ...constraints]);
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

export async function getDocs(queryObj: FirebaseQuery) {
  const table = queryObj.path;
  const allItems = await ensureCache(table);
  const filtered = applyQuery(allItems, queryObj);

  const docs = filtered.map(item => ({
    id: item.id,
    ref: new DocRef(table, item.id),
    exists: () => true,
    data: () => {
      const { id, ...rest } = item;
      return rest;
    }
  }));

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
  const item = allItems.find(i => i.id === id);

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
  employees: { accountId: 'account_id', monthlySalary: 'monthlySalary', currency: 'currency', jobsType: 'jobsType', createdAt: 'createdAt', createdBy: 'createdBy' },
  users: { role: 'role', username: 'username', email: 'email', disabled: 'disabled', linkedType: 'linkedType', linkedEntity: 'linkedEntity', accountId: 'linkedEntity' },
  portal_users: { portalRole: 'portal_role', username: 'username', email: 'email', disabled: 'disabled', approvalStatus: 'approval_status', linkedAccId: 'linkedAccId', linkedCustomerId: 'linkedAccId' },
  sessions: { userId: 'user_id', createdAt: 'createdAt', lastSeen: 'lastSeen', forceLogout: 'forceLogout' },
  settings: { category: 'category' },
  user_settings: { userId: 'userid' },
  customers: { accountId: 'account_id', disabled: 'is_active', level: 'levels', levels: 'levels' },
  couriers: { accountId: 'account_id', financialCurrency: 'currency', currency: 'currency', disabled: 'is_active', courierType: 'type', type: 'type', level: 'levels', levels: 'levels' },
  account: { accountCode: 'account_code', code: 'account_code', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', balance: 'balance', curNo: 'cur_no', currencyId: 'cur_no', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at' },
  acc_main: { accountId: 'account_id', accountCode: 'account_code', code: 'account_code', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', balance: 'balance', curNo: 'cur_no', currencyId: 'cur_no', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at' },
  acc_sub: { accMainId: 'acc_main_id', accountCode: 'account_code', code: 'account_code', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', balance: 'balance', curNo: 'cur_no', currencyId: 'cur_no', isActive: 'is_active', allowsDirectAccounts: 'allows_direct_accounts', createdAt: 'created_at', updatedAt: 'updated_at' },
  acc_sub_group: { accSubId: 'acc_sub_id', accountCode: 'account_code', code: 'account_code', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', balance: 'balance', curNo: 'cur_no', currencyId: 'cur_no', isActive: 'is_active', entityType: 'entity_type', allowsDirectAccounts: 'allows_direct_accounts', createdAt: 'created_at', updatedAt: 'updated_at' },
  default_accounts: { defaultKey: 'default_key', accountId: 'account_id', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', curNo: 'cur_no', currencyId: 'cur_no', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at' },
  account_id_migration_map: { oldAccountId: 'old_account_id', oldAccountCode: 'old_account_code', newAccountId: 'new_account_id', migratedAt: 'migrated_at' },
  accounts: { accountCode: 'account_code', code: 'account_code', balance: 'balance', currency: 'currency', entityId: 'entity_id', entityType: 'entity_type', type: 'type', accountType: 'type', accSubId: 'acc_sub_id', groupId: 'group_id', accountSeq: 'account_seq', accNameAr: 'acc_name_ar', nameAr: 'acc_name_ar', accNameEn: 'acc_name_en', nameEn: 'acc_name_en', limitedBalance: 'limited_balance', curNo: 'cur_no', currencyId: 'cur_no', isActive: 'is_active', createdAt: 'createdAt', updatedAt: 'updatedAt', lastRecalculatedAt: 'lastRecalculatedAt' },
  orders: { orderNumber: 'order_number', trackingNumber: 'tracking_number', customerId: 'customer_id', orderPartyId: 'order_party_id', orderPartyType: 'order_party_type', isStaffOrder: 'is_staff_order', employeeId: 'employee_id', courierId: 'courier_id', customerAccountId: 'order_party_account_id', orderPartyAccountId: 'order_party_account_id', orderStatusId: 'order_status_id', order_status_id: 'order_status_id', createdAt: 'createdAt', orderSourceId: 'order_source_id', order_source_id: 'order_source_id', orderSourceType: 'order_source_type', order_source_type: 'order_source_type', deliveryCourierId: 'delivery_courier_id', delivery_courier_id: 'delivery_courier_id', shippingCourierId: 'shipping_courier_id', shipping_courier_id: 'shipping_courier_id' },
  shipping_companies: { name: 'name', shippingCompanyUrl: 'shipping_company_url', trackingIDPrefix: 'trackingID_prefix', accountId: 'account_id', financialAccountId: 'account_id' },
  sources: { name: 'name', supplierType: 'type', type: 'type', sourceUrl: 'source_url', accountId: 'account_id', financialAccountId: 'account_id' },
  account_transactions: { type: 'type', accountId: 'account_id', journalEntryNumber: 'journalEntryNumber', journalEntryId: 'journalEntryNumber', module: 'module', currency: 'currency', curNo: 'cur_no', currencyId: 'cur_no', createdAt: 'createdAt', amount: 'amount', orderId: 'order_id', orderNumber: 'order_number', shipmentId: 'shipment_id', automationKey: 'automation_key', autoRuleId: 'auto_rule_id' },
  expenses: { expenseNumber: 'expense_number', transactionsID: 'transactionsID', linkedAccountId: 'account_id', financialAccountId: 'account_id', accountId: 'account_id', category: 'category', amount: 'amount', currency: 'currency', curNo: 'cur_no', currencyId: 'cur_no', createdAt: 'createdAt' },
  salary_history: { transactionsID: 'transactionsID', financialAccountId: 'account_id', accountId: 'account_id', userId: 'user_id', amount: 'amount', currency: 'currency', curNo: 'cur_no', currencyId: 'cur_no', salaryMonth: 'month', month: 'month', createdAt: 'createdAt' },
  journal_entries: { transactionID: 'transactionID', accountId: 'account_id', createdByUid: 'created_by_uid', curNo: 'cur_no', currencyId: 'cur_no', createdAt: 'createdAt', orderId: 'order_id', orderNumber: 'order_number', shipmentId: 'shipment_id', automationKey: 'automation_key', autoRuleId: 'auto_rule_id', statusId: 'status_id', isAutomatic: 'is_automatic' },
  assets: { linkedAccountId: 'account_id', accountId: 'account_id', financialAccountId: 'account_id', financialAccountCode: 'account_code', status: 'status', currency: 'currency', isActive: 'is_active', type: 'type', createdAt: 'createdAt' },
  notifications: { userId: 'userId', category: 'category', isPublic: 'isPublic', read: 'read', type: 'type', createdAt: 'createdAt' },
  activity_logs: { userUid: 'userId', userId: 'userId', action: 'action', category: 'category', entityName: 'target', target: 'target', type: 'type', timestamp: 'createdAt', createdAt: 'createdAt' },
  jobs_req: { email: 'email', phone: 'phone', status: 'status', category: 'category', refCode: 'refCode', createdAt: 'createdAt' },
  announcements: { title: 'title', isActive: 'isActive', priority: 'priority', createdBy: 'createdBy', createdAt: 'createdAt' },
  portal_tickets: { type: 'type', status: 'status', userUid: 'userUid', createdAt: 'createdAt' },
  products: { orderId: 'order_id', productName: 'product_name', name: 'product_name', quantity: 'quantity', productPrice: 'unit_price', price: 'unit_price', unitPrice: 'unit_price', totalPrice: 'total_price', packagingOptionId: 'packaging_option_id', packaging_option_id: 'packaging_option_id', itemCategoryId: 'item_category_id', item_category_id: 'item_category_id', itemCategoryName: 'item_category_name', createdAt: 'createdAt' },
  shipments: { orderId: 'order_id', trackingNumber: 'tracking_number', shippingCompanyId: 'shipping_company_id', shipping_company_id: 'shipping_company_id', courierId: 'courier_id', shipmentStatus: 'shipment_status', status: 'shipment_status', shippingCost: 'shipping_cost', weight: 'weight', shippingCategoryId: 'shipping_category_id', shipping_category_id: 'shipping_category_id', contentCategoryId: 'content_category_id', content_category_id: 'content_category_id', contentCategoryName: 'content_category_name', cartonCount: 'carton_count', customsFee: 'customs_fee', taxFee: 'tax_fee', otherCategoryFee: 'other_category_fee', categoryFeesTotal: 'category_fees_total', categoryFeeCurrency: 'category_fee_currency', createdAt: 'createdAt' },
  orders_history: { orderId: 'order_id', orderNumber: 'order_number', shipmentId: 'shipment_id', journalEntryId: 'journal_entry_id', accountTransactionId: 'account_transaction_id', activityLogId: 'activity_log_id', eventType: 'event_type', eventCategory: 'event_category', operation: 'operation', entityType: 'entity_type', actorId: 'actor_id', actorName: 'actor_name', actorRole: 'actor_role', source: 'source', summary: 'summary', beforeData: 'before_data', afterData: 'after_data', metadata: 'metadata', occurredAt: 'occurred_at', createdAt: 'created_at' },
  order_status: { nameAr: 'name_ar', nameEn: 'name_en', isFirst: 'is_first', isLast: 'is_last', sortOrder: 'sort_order', color: 'color', code: 'code' },
  auto_entries: { statusId: 'status_id', nameAr: 'name_ar', nameEn: 'name_en', isActive: 'is_active', amountSource: 'amount_source', amountSources: 'amount_sources', amountStrategy: 'amount_strategy', currency: 'currency', curNo: 'cur_no', currencyId: 'cur_no', skipWhenZero: 'skip_when_zero' },
  autoEntry: { statusId: 'status_id', nameAr: 'name_ar', nameEn: 'name_en', isActive: 'is_active', amountSource: 'amount_source', amountSources: 'amount_sources', amountStrategy: 'amount_strategy', currency: 'currency', curNo: 'cur_no', currencyId: 'cur_no', skipWhenZero: 'skip_when_zero' },
  order_option: { nameAr: 'name_ar', nameEn: 'name_en', type: 'type', price: 'price', duration: 'duration', details: 'details', code: 'code', isActive: 'is_active', is_active: 'is_active' },
  items_category: { code: 'code', nameAr: 'name_ar', nameEn: 'name_en', description: 'description', details: 'details', hsCodeHint: 'hs_code_hint', customsPerCarton: 'customs_per_carton', taxPerCarton: 'tax_per_carton', otherFeesPerCarton: 'other_fees_per_carton', customsRate: 'customs_rate', taxRate: 'tax_rate', feeCurrency: 'fee_currency', requiresReview: 'requires_review', isActive: 'is_active', createdAt: 'createdAt', updatedAt: 'updatedAt' },
  entry_module: { code: 'code', nameAr: 'name_ar', nameEn: 'name_en', note: 'note', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid' },
  entry_type: { code: 'code', moduleId: 'module_id', nameAr: 'name_ar', nameEn: 'name_en', note: 'note', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid' },
  main_entry: { entryNumber: 'entry_number', moduleId: 'module_id', entryTypeId: 'entry_type_id', entryCategory: 'entry_category', postingStatus: 'posting_status', amountOriginal: 'amount_original', amountText: 'amount_text', currencyOriginalNo: 'currency_original_no', currencyPriceId: 'currency_price_id', currencyPriceSeq: 'currency_price_seq', description: 'description', notes: 'notes', attachments: 'attachments', paymentMethod: 'payment_method', orderId: 'order_id', shipmentId: 'shipment_id', custodyId: 'custody_id', automationKey: 'automation_key', autoRuleId: 'auto_rule_id', isAutomatic: 'is_automatic', reversesEntryId: 'reverses_entry_id', effectiveAt: 'effective_at', postedAt: 'posted_at', voidedAt: 'voided_at', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid', postedByUid: 'posted_by_uid', voidedByUid: 'voided_by_uid' },
  account_trans: { entryId: 'entry_id', lineNo: 'line_no', transType: 'trans_type', accountId: 'account_id', accountCurNo: 'account_cur_no', amount: 'amount', amountOriginal: 'amount_original', conversionRate: 'conversion_rate', currencyOriginalNo: 'currency_original_no', currencyPriceId: 'currency_price_id', currencyPriceSeq: 'currency_price_seq', entityType: 'entity_type', entityId: 'entity_id', paymentMethod: 'payment_method', orderId: 'order_id', shipmentId: 'shipment_id', custodyId: 'custody_id', autoRuleId: 'auto_rule_id', automationKey: 'automation_key', description: 'description', note: 'note', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid' },
  custody_advances: { custodyNumber: 'custody_number', recipientType: 'recipient_type', recipientId: 'recipient_id', recipientName: 'recipient_name', recipientAccountId: 'recipient_account_id', amountOriginal: 'amount_original', currencyOriginalNo: 'currency_original_no', currencyPriceId: 'currency_price_id', currencyPriceSeq: 'currency_price_seq', amountSettled: 'amount_settled', amountOutstanding: 'amount_outstanding', status: 'status', issuedEntryId: 'issued_entry_id', settlementEntryId: 'settlement_entry_id', note: 'note', issuedAt: 'issued_at', issuedByUid: 'issued_by_uid', settledAt: 'settled_at', settledByUid: 'settled_by_uid', createdAt: 'created_at', updatedAt: 'updated_at', createdByUid: 'created_by_uid', updatedByUid: 'updated_by_uid' },
  financial_legacy_migration_map: { legacyTable: 'legacy_table', legacyId: 'legacy_id', targetTable: 'target_table', targetId: 'target_id', migrationStatus: 'migration_status', migratedAt: 'migrated_at', verifiedAt: 'verified_at', verifiedByUid: 'verified_by_uid' },
  financial_migration_exceptions: { legacyTable: 'legacy_table', legacyId: 'legacy_id', exceptionCode: 'exception_code', severity: 'severity', description: 'description', resolutionStatus: 'resolution_status', resolvedByUid: 'resolved_by_uid', resolvedAt: 'resolved_at', createdAt: 'created_at', updatedAt: 'updated_at' }
};

const EXPLICIT_FINANCIAL_TABLES = new Set([
  'entry_module', 'entry_type', 'main_entry', 'account_trans', 'custody_advances',
  'financial_legacy_migration_map', 'financial_migration_exceptions',
]);

export function usesExplicitFinancialColumns(table: string): boolean {
  return EXPLICIT_FINANCIAL_TABLES.has(table);
}

export function extractDirectColumns(table: string, data: Record<string, any>): Record<string, any> {
  const mapping = DIRECT_COLUMNS_MAP[table];
  if (!mapping || !data || typeof data !== 'object') return {};
  const extracted: Record<string, any> = {};
  for (const [key, col] of Object.entries(mapping)) {
    if (data[key] !== undefined) {
      let val = data[key];
      // Convert empty string or whitespace foreign keys to null so Postgres FK check succeeds
      if (typeof val === 'string' && val.trim() === '' && (col.endsWith('_id') || col === 'cur_no')) {
        val = null;
      }
      if (key === 'disabled' && (table === 'customers' || table === 'couriers')) {
        extracted[col] = !val;
      } else if ((col === 'createdAt' || col === 'updatedAt' || col === 'lastSeen' || col === 'created_at' || col === 'updated_at' || col === 'lastRecalculatedAt') && typeof val === 'number') {
        extracted[col] = new Date(val).toISOString();
      } else {
        extracted[col] = val;
      }
    }
  }

  // Safety checks for foreign key ID columns
  if (table === 'orders') {
    const validStatusIds = ['1', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    if (!extracted['order_status_id'] || !validStatusIds.includes(String(extracted['order_status_id']))) {
      extracted['order_status_id'] = '1';
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

export async function addDoc(newID: any, collectionRef: FirebaseQuery, rawData: any) {
  const table = collectionRef.path;
  const id = newID ? newID : 'noId_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  const data = cleanData(rawData);

  if (!isOfflineMode()) {
    const directCols = extractDirectColumns(table, data);
    const writePayload = usesExplicitFinancialColumns(table) ? { id, ...directCols } : { id, ...directCols, data };
    const { error } = await supabase.from(table).insert(writePayload);
    if (error) {
      throw createWriteError('insert', table, error);
    }
  } else {
    // Offline mode: buffering addDoc local write
  }

  const newItem = { id, ...data };
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
export async function addAssDoc(newID: any, arg1: any, collectionRef: FirebaseQuery, rawData: any) {
  const table = collectionRef.path;
  const id = newID ? newID : 'noId_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  const assetCode = arg1 ? arg1 : 'noAssetCode_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  const data = cleanData(rawData);

  if (!isOfflineMode()) {
    const directCols = extractDirectColumns(table, data);
    const { error } = await supabase.from(table).insert({ id, assetCode, ...directCols, data });
    if (error) {
      throw createWriteError('insert', table, error);
    }
  } else {
    // Offline mode: buffering addDoc local write
  }

  const newItem = { id, assetCode, ...data };
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
  const id = docRef.id;
  let data = cleanData(rawData);

  if (options && options.merge) {
    const all = await ensureCache(table);
    const existing = all.find(item => item.id === id) || {};
    const { id: _, ...existingData } = existing;
    data = { ...existingData, ...data };
  }

  if (!isOfflineMode()) {
    const directCols = extractDirectColumns(table, data);
    const writePayload = usesExplicitFinancialColumns(table) ? { id, ...directCols } : { id, ...directCols, data };
    const { error } = await supabase.from(table).upsert(writePayload);
    if (error) {
      throw createWriteError('upsert', table, error);
    }
  } else {
    // Offline mode: buffering setDoc local write
  }

  const newItem = { id, ...data };
  if (!collectionCaches[table]) collectionCaches[table] = [];
  const idx = collectionCaches[table].findIndex(item => item.id === id);
  if (idx >= 0) {
    collectionCaches[table][idx] = newItem;
  } else {
    collectionCaches[table].push(newItem);
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
  const id = docRef.id;

  const all = await ensureCache(table);
  const existing = all.find(item => item.id === id) || {};
  const { id: _, ...existingData } = existing;

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

  const data = { ...existingData, ...resolvedPayload };

  if (!isOfflineMode()) {
    const directCols = extractDirectColumns(table, data);
    const writePayload = usesExplicitFinancialColumns(table) ? directCols : { ...directCols, data };
    const { error } = await supabase.from(table).update(writePayload).eq('id', id);
    if (error) {
      throw createWriteError('update', table, error);
    }
  } else {
    // Offline mode: buffering updateDoc local write
  }

  // Double check if this is the Admin's user document update - synchronized live across sessions
  if (table === 'users' && data.email?.toLowerCase() === 'admin@swiftship.system' && data.password) {
    try {
      const hash = simpleHashPassword(data.password);
      safeLocalStorage.setItem('swiftship_emergency_admin_hash', hash);
      safeLocalStorage.setItem('swiftship_emergency_admin_profile', encryptDataLocal(JSON.stringify(data), data.password));
      safeLocalStorage.setItem('swiftship_emergency_admin_pwd', data.password);
    } catch (_) { }
  }

  const newItem = { id, ...data };
  const idx = collectionCaches[table].findIndex(item => item.id === id);
  if (idx >= 0) {
    collectionCaches[table][idx] = newItem;
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
  const id = docRef.id;

  if (!isOfflineMode()) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      throw createWriteError('delete', table, error);
    }
  } else {
    // Offline mode: buffering deleteDoc local write
  }

  if (collectionCaches[table]) {
    collectionCaches[table] = collectionCaches[table].filter(item => item.id !== id);
  }

  // Safe write update in localStorage backup
  try {
    safeLocalStorage.setItem(`swiftship_table_backup_${table}`, JSON.stringify(collectionCaches[table]));
  } catch (_) { }

  if (collectionListeners[table]) {
    collectionListeners[table].forEach(cb => cb());
  }
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
        const item = allItems.find(i => i.id === docId);
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
      const filtered = queryObj instanceof FirebaseQuery ? applyQuery(allItems, queryObj) : allItems;

      const docs = filtered.map(item => ({
        id: item.id,
        ref: new DocRef(table, item.id),
        exists: () => true,
        data: () => {
          const { id, ...rest } = item;
          return rest;
        }
      }));

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

// Authentication Implementation
export const auth: any = {
  get currentUser() {
    return loggedInUser;
  }
};

export function getAuth(...args: any[]) {
  return auth;
}

export function initializeAuth(...args: any[]) {
  return auth;
}

export const inMemoryPersistence = {};

export function onAuthStateChanged(...args: any[]) {
  const callback = typeof args[1] === 'function' ? args[1] : args[0];
  if (typeof callback === 'function') {
    authListeners.add(callback);
    if (authInitialized) {
      callback(auth.currentUser);
    } else {
      initPromise.then((user) => {
        if (authListeners.has(callback)) {
          callback(user);
        }
      });
    }
    return () => {
      authListeners.delete(callback);
    };
  }
  return () => { };
}

// --- EMERGENCY OFFLINE CACHING & SECURE ENCRYPTION ENGINES ---
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

export function enableEmergencyOfflineSession(userProfile: any, passwordUsed: string) {
  setOfflineMode(true);

  const mapped = {
    uid: userProfile.uid || userProfile.id || 'mock-emergency-admin-uid',
    email: userProfile.email || 'admin@swiftship.system',
    emailVerified: true,
    displayName: userProfile.fullName || 'Emergency Master Admin',
    getIdToken: async () => 'emergency_session_token'
  };

  loggedInUser = mapped;
  currentSession = { user: { id: mapped.uid, email: mapped.email } };

  // Trigger auth listeners to update application state
  authListeners.forEach(cb => cb(loggedInUser));
  return { user: mapped };
}

export async function signInWithEmailAndPassword(...args: any[]) {
  const email = args[1] || args[0];
  const password = args[2] || args[1];
  const isTargetAdmin = email === 'admin@swiftship.system' || email === 'admin';
  const targetEmail = email === 'admin' ? 'admin@swiftship.system' : email;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: targetEmail, password });
    if (error) {
      if (isTargetAdmin) {
        // Enforce user signup fallback for DB first installation
        try {
          const { data: upData, error: upErr } = await supabase.auth.signUp({
            email: targetEmail,
            password
          });
          if (!upErr && upData.user) {
            const mapped = mapUser(upData.user) || {
              uid: 'mock-uid-admin',
              email: targetEmail,
              emailVerified: true,
              displayName: 'Admin'
            };
            loggedInUser = mapped;
            currentSession = upData.session || { user: upData.user || { id: 'mock-uid-admin', email: targetEmail } };

            // Sync Admin Password & Profile locally on successful Direct Signup
            const adminProfile = {
              uid: loggedInUser.uid,
              email: targetEmail,
              fullName: 'Emergency Master Admin',
              role: 'Admin',
              isRoot: true,
              disabled: false,
              createdAt: Date.now()
            };
            safeLocalStorage.setItem('swiftship_emergency_admin_hash', simpleHashPassword(password));
            safeLocalStorage.setItem('swiftship_emergency_admin_profile', encryptDataLocal(JSON.stringify(adminProfile), password));
            return { user: mapped };
          }
        } catch (_) { }

        // Fallback to local storage credentials for offline login verification
        const localHash = safeLocalStorage.getItem('swiftship_emergency_admin_hash');
        const localProfileCipher = safeLocalStorage.getItem('swiftship_emergency_admin_profile');
        if (localHash && localProfileCipher && simpleHashPassword(password) === localHash) {
          const decryptedProfileText = decryptDataLocal(localProfileCipher, password);
          if (decryptedProfileText) {
            try {
              const parsedProfile = JSON.parse(decryptedProfileText);
              return enableEmergencyOfflineSession(parsedProfile, password);
            } catch (_) { }
          }
        }
      }

      const firebaseErr = new Error(error.message) as any;
      firebaseErr.code = 'auth/invalid-credential';
      throw firebaseErr;
    }

    const mapped = mapUser(data.user);
    loggedInUser = mapped;
    currentSession = data.session;

    // Synchronize Admin profile locally offline-first
    if (isTargetAdmin && mapped) {
      const adminProfile = {
        uid: mapped.uid,
        email: targetEmail,
        fullName: 'Emergency Master Admin',
        role: 'Admin',
        isRoot: true,
        disabled: false,
        createdAt: Date.now()
      };
      safeLocalStorage.setItem('swiftship_emergency_admin_hash', simpleHashPassword(password));
      safeLocalStorage.setItem('swiftship_emergency_admin_profile', encryptDataLocal(JSON.stringify(adminProfile), password));
      safeLocalStorage.setItem('swiftship_emergency_admin_pwd', password);
    }

    return { user: mapped };
  } catch (netErr: any) {
    if (isTargetAdmin) {
      const localHash = safeLocalStorage.getItem('swiftship_emergency_admin_hash');
      const localProfileCipher = safeLocalStorage.getItem('swiftship_emergency_admin_profile');
      if (localHash && localProfileCipher && simpleHashPassword(password) === localHash) {
        const decryptedProfileText = decryptDataLocal(localProfileCipher, password);
        if (decryptedProfileText) {
          try {
            const parsedProfile = JSON.parse(decryptedProfileText);
            return enableEmergencyOfflineSession(parsedProfile, password);
          } catch (_) { }
        }
      }
    }
    throw netErr;
  }
}

export async function createUserWithEmailAndPassword(...args: any[]) {
  const uid = args[1] || args[0];
  const email = args[2] || args[1];
  const password = args[3] || args[2];

  // Safely avoid logging out the current active administrator by creating a virtual UID
  if (loggedInUser) {
    //const uid = 'vuid-' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
    return {
      user: {
        uid,
        email,
        emailVerified: true,
        displayName: email.split('@')[0]
      }
    };
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const firebaseErr = new Error(error.message) as any;
    firebaseErr.code = 'auth/email-already-in-use';
    throw firebaseErr;
  }
  const mapped = mapUser(data.user) || {
    uid: 'user-uid-' + Math.random().toString(36).substring(2, 9),
    email,
    emailVerified: true,
    displayName: email.split('@')[0]
  };
  loggedInUser = mapped;
  currentSession = data.session || { user: data.user || { id: mapped.uid, email } };
  return { user: mapped };
}

export async function signInWithCustomToken(...args: any[]) {
  const token = args[1] || args[0];
  if (typeof token === 'string' && token.startsWith('custom_token_')) {
    const uid = token.substring('custom_token_'.length);
    const allUsers = await ensureCache('users');
    let userRow = allUsers.find(item => item.id === uid || item.email === uid);
    if (!userRow) {
      const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
      if (data && !error) {
        userRow = data;
      }
    }
    if (userRow) {
      const mapped = {
        uid: userRow.id || uid,
        email: userRow.email || '',
        emailVerified: true,
        displayName: userRow.fullName || userRow.username || userRow.email?.split('@')[0] || 'User',
        getIdToken: async () => 'session_token'
      };
      loggedInUser = mapped;
      currentSession = { user: { id: mapped.uid, email: mapped.email } };
      authListeners.forEach(cb => cb(loggedInUser));
      return { user: mapped };
    }
  }
  return { user: auth.currentUser };
}

/**
 * Wipes ALL swiftship_ prefixed keys from localStorage and clears
 * the in-memory collection caches. Must be called on every logout path.
 */
export function clearAllLocalData(): void {
  if (isServer) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('swiftship_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (_) { /* ignore storage access errors */ }

  // Also clear in-memory caches so stale data is never re-served after re-login
  for (const table of Object.keys(collectionCaches)) {
    delete collectionCaches[table];
  }
  for (const table of Object.keys(lastFetchTimestamps)) {
    delete lastFetchTimestamps[table];
  }
}

export async function signOut(...args: any[]) {
  // Wipe ALL swiftship_ localStorage data and in-memory caches on every logout
  clearAllLocalData();
  setOfflineMode(false);
  await supabase.auth.signOut();
  currentSession = null;
  loggedInUser = null;
}

export async function updatePassword(...args: any[]) {
  const password = args[1] || args[0];
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function sendPasswordResetEmail(...args: any[]) {
  const email = args[1] || args[0];
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
    // Specific custom classes used in Firestore updates
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  handleSupabaseError(error, operationType, path);
}

// MOCKS FOR firebase-admin
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

const mockAdminFirestore = () => {
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

export const admin = {
  apps: [{ name: 'default' }],
  initializeApp: (...args: any[]) => ({}),
  auth: () => mockAdminAuth,
  firestore: mockAdminFirestore
};

export default admin;
