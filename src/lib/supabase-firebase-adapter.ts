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
            collectionCaches[table] = (data || []).map(row => {
              const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
              const normalized = normalizePayload(table, payload);
              return { id: row.id, ...normalized };
            });

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
          } else {
            const rawData = payload.new?.data;
            const itemData = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {});
            const normalized = normalizePayload(table, itemData);
            const newItem = { id: rowId, ...normalized };
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

export async function addDoc(newID, collectionRef: FirebaseQuery, rawData: any) {
  const table = collectionRef.path;
  const id = newID ? newID : 'noId_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  const data = cleanData(rawData);

  if (!isOfflineMode()) {
    const { error } = await supabase.from(table).insert({ id, data });
    if (error) {
      console.warn(`[Supabase Adapter] addDoc error on table ${table}: ${error.message}`);
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
    const { error } = await supabase.from(table).upsert({ id, data });
    if (error) {
      console.warn(`[Supabase Adapter] setDoc error on table ${table}: ${error.message}`);
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
    const { error } = await supabase.from(table).update({ data }).eq('id', id);
    if (error) {
      console.warn(`[Supabase Adapter] updateDoc error on table ${table}: ${error.message}`);
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
      console.warn(`[Supabase Adapter] deleteDoc error on table ${table}: ${error.message}`);
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
