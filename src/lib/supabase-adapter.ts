// ─── supabase-adapter.ts ────────────────────────────────────────────────────
// ⚠️ تحذير: تم تعطيل الاتصال المباشر بـ Supabase بالكامل.
// ⚠️ WARNING: All direct Supabase connections are DISABLED.
// يجب استخدام alxDataGateway.ts أو alxAuthGateway.ts بدلاً من هذا الملف.
// Use alxDataGateway.ts or alxAuthGateway.ts instead.
// ────────────────────────────────────────────────────────────────────────────

import { extractDirectColumns, getTablePrimaryKey, usesExplicitFinancialColumns } from './supabase-adapter-columns';
import { cleanData, extractRowPayload, normalizePayload, sanitizeDataPayload } from './supabase-adapter-mappers';
export { extractDirectColumns, getTablePrimaryKey, usesExplicitFinancialColumns } from './supabase-adapter-columns';
export { extractRowPayload, normalizePayload, sanitizeDataPayload } from './supabase-adapter-mappers';

/**
 * كائن وهمي (noop) يحاكي واجهة Supabase Client بدون أي اتصال حقيقي.
 * A noop stub that mimics the Supabase Client interface without any real connection.
 * يمنع أي اتصال بـ placeholder-project.supabase.co
 */
const noopSupabaseClient: any = new Proxy({}, {
  get(_target, prop) {
    // إرجاع دالة noop لأي خاصية مطلوبة
    // Return noop function for any requested property
    if (prop === 'from') {
      return (_table: string) => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null })
        }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        delete: () => ({
          eq: () => Promise.resolve({ data: null, error: null })
        }),
        eq: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
          select: () => Promise.resolve({ data: [], error: null }),
        }),
        ilike: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        limit: () => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
      });
    }
    if (prop === 'auth') {
      return {
        updateUser: () => Promise.resolve({ error: new Error('[Supabase Adapter] DISABLED: Use ALX API instead.') }),
        resetPasswordForEmail: () => Promise.resolve({ error: new Error('[Supabase Adapter] DISABLED: Use ALX API instead.') }),
      };
    }
    if (prop === 'channel') {
      return (_name: string) => ({
        on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        subscribe: () => ({ unsubscribe: () => {} }),
      });
    }
    // لأي خاصية أخرى أرجع دالة لا تفعل شيئاً
    return () => Promise.resolve(null);
  }
});

/** الحصول على عميل Supabase - معطّل الآن ويعيد الكائن الوهمي فقط */
function getSupabaseClient() {
  return noopSupabaseClient;
}

/** كائن supabase المُصدَّر - يُعيد الكائن الوهمي دائماً لمنع أي اتصال خارجي */
export const supabase = noopSupabaseClient;

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
}

/** Legacy key removed during startup/logout; persisted user objects are never restored. */
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
  };
}

function clearPersistedUser(): void {
  safeSessionStorage.removeItem(SESSION_STORAGE_KEY);
  safeLocalStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * تحديث حالة المصادقة وإعلام جميع المستمعين
 * Update auth state and notify all listeners
 */
function setLoggedInUser(user: User | null): void {
  loggedInUser = user;
  clearPersistedUser();
  if (authReady) {
    authListeners.forEach((listener) => listener(user));
  }
}

// Start unauthenticated after every page load. A cached User object is not proof of a session.
loggedInUser = null;
clearPersistedUser();

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

  // ⚠️ تم تعطيل الجلب من الشبكة عبر Supabase - النظام يعتمد على ALX API الآن
  // ⚠️ Network fetching via Supabase is DISABLED - System uses ALX API now
  // لا تُحاول الاتصال بـ Supabase - استخدم alxDataGateway.ts بدلاً من ذلك
  // Do NOT attempt Supabase connections - use alxDataGateway.ts instead
  lastFetchTimestamps[table] = Date.now(); // منع أي محاولة إعادة جلب

  // تعطيل Realtime channels تماماً
  // Realtime channels are fully disabled

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

  // ⚠️ تم تعطيل المصادقة عبر Supabase. يجب استخدام alxAuthGateway.ts
  // ⚠️ Supabase authentication is DISABLED. Use alxAuthGateway.ts (alxLogin) instead.
  console.error('[Auth] signInWithPassword via supabase-adapter is DISABLED. Use alxLogin from alxAuthGateway.ts instead.');
  const err = new Error('يرجى استخدام نظام المصادقة الجديد (alxLogin)') as any;
  err.code = 'auth/disabled';
  throw err;
}

export function completeSignIn(user: User): void {
  if (!user?.uid) throw new Error('A valid user ID is required to complete sign-in.');
  if (user.disabled) throw new Error('Disabled users cannot establish a session.');
  setLoggedInUser(user);
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
    created_at: new Date().toISOString(),
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

export async function updatePassword(_password: string) {
  // ⚠️ معطّل - استخدم ALX API بدلاً من ذلك
  // ⚠️ DISABLED - Use ALX API instead
  console.warn('[Supabase Adapter] updatePassword is DISABLED. Use ALX API password change endpoint.');
}

export async function sendPasswordResetEmail(_email: string) {
  // ⚠️ معطّل - استخدم ALX API بدلاً من ذلك
  // ⚠️ DISABLED - Use ALX API instead
  console.warn('[Supabase Adapter] sendPasswordResetEmail is DISABLED. Use ALX API password reset endpoint.');
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
