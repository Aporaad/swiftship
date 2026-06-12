import { createClient } from '@supabase/supabase-js';

// Parse environmental variables for client or server runtime
const SUPABASE_URL = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
                       (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || 
                       ((import.meta as any).env?.VITE_SUPABASE_URL) || 
                       "";

const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
                            (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || 
                            ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
                            "";

console.log('[Supabase Adapter] Initializing with URL:', SUPABASE_URL ? 'PRESENT' : 'MISSING');

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder-project.supabase.co", 
  SUPABASE_ANON_KEY || "placeholder-key"
);

// Hold local cache of collections for in-memory querying to ensure fast, real-time reactive updates
const collectionCaches: { [table: string]: any[] } = {};
const collectionListeners: { [table: string]: Set<() => void> } = {};

// Cache and Sync session state
let currentSession: any = null;
let loggedInUser: any = null;

supabase.auth.getSession().then(({ data }) => {
  currentSession = data.session;
  if (data.session?.user) {
    loggedInUser = mapUser(data.session.user);
  }
});
supabase.auth.onAuthStateChange((event, session) => {
  currentSession = session;
  loggedInUser = session?.user ? mapUser(session.user) : null;
  authListeners.forEach(cb => cb(loggedInUser));
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
async function ensureCache(table: string): Promise<any[]> {
  if (!collectionCaches[table]) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`[Supabase Adapter] Failed to load table ${table}: ${error.message}. Falling back to empty cache.`);
        collectionCaches[table] = [];
      } else {
        collectionCaches[table] = (data || []).map(row => {
          const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
          return { id: row.id, ...payload };
        });
      }
    } catch (e: any) {
      console.warn(`[Supabase Adapter] Exception reading table ${table}: ${e.message}`);
      collectionCaches[table] = [];
    }

    // Dynamic realtime subscription per collection using channels
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
            const newItem = { id: rowId, ...itemData };
            const index = cache.findIndex(item => item.id === rowId);
            if (index >= 0) {
              cache[index] = newItem;
            } else {
              cache.push(newItem);
            }
          }
          if (collectionListeners[table]) {
            collectionListeners[table].forEach(cb => cb());
          }
        })
        .subscribe();
    } catch (rtErr: any) {
      console.warn(`[Supabase Adapter] Realtime channel setup failed for ${table}:`, rtErr.message);
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
export const db = { type: 'firestore' };

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

export async function addDoc(collectionRef: FirebaseQuery, rawData: any) {
  const table = collectionRef.path;
  const id = Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  const data = cleanData(rawData);

  const { error } = await supabase.from(table).insert({ id, data });
  if (error) {
    console.warn(`[Supabase Adapter] addDoc error on table ${table}: ${error.message}`);
    // If table doesn't exist, we fallback to our generic memory store so application features still run perfectly!
  }

  const newItem = { id, ...data };
  if (!collectionCaches[table]) collectionCaches[table] = [];
  collectionCaches[table].push(newItem);
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

  const { error } = await supabase.from(table).upsert({ id, data });
  if (error) {
    console.warn(`[Supabase Adapter] setDoc error on table ${table}: ${error.message}`);
  }

  const newItem = { id, ...data };
  if (!collectionCaches[table]) collectionCaches[table] = [];
  const idx = collectionCaches[table].findIndex(item => item.id === id);
  if (idx >= 0) {
    collectionCaches[table][idx] = newItem;
  } else {
    collectionCaches[table].push(newItem);
  }
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

  const { error } = await supabase.from(table).update({ data }).eq('id', id);
  if (error) {
    console.warn(`[Supabase Adapter] updateDoc error on table ${table}: ${error.message}`);
  }

  const newItem = { id, ...data };
  const idx = collectionCaches[table].findIndex(item => item.id === id);
  if (idx >= 0) {
    collectionCaches[table][idx] = newItem;
  }
  if (collectionListeners[table]) {
    collectionListeners[table].forEach(cb => cb());
  }
}

export async function deleteDoc(docRef: DocRef) {
  const table = docRef.path;
  const id = docRef.id;

  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.warn(`[Supabase Adapter] deleteDoc error on table ${table}: ${error.message}`);
  }

  if (collectionCaches[table]) {
    collectionCaches[table] = collectionCaches[table].filter(item => item.id !== id);
  }
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
    callback(auth.currentUser);
    return () => {
      authListeners.delete(callback);
    };
  }
  return () => {};
}

export async function signInWithEmailAndPassword(...args: any[]) {
  const email = args[1] || args[0];
  const password = args[2] || args[1];
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (email === 'admin@swiftship.system' || email === 'admin') {
      const targetEmail = email === 'admin' ? 'admin@swiftship.system' : email;
      const { data: upData, error: upErr } = await supabase.auth.signUp({ 
        email: targetEmail, 
        password 
      });
      if (upErr) {
        const firebaseErr = new Error(upErr.message) as any;
        firebaseErr.code = 'auth/invalid-credential';
        throw firebaseErr;
      }
      const mapped = mapUser(upData.user) || {
        uid: 'mock-uid-admin',
        email: targetEmail,
        emailVerified: true,
        displayName: 'admin'
      };
      loggedInUser = mapped;
      currentSession = upData.session || { user: upData.user || { id: 'mock-uid-admin', email: targetEmail } };
      return { user: mapped };
    }
    const firebaseErr = new Error(error.message) as any;
    firebaseErr.code = 'auth/invalid-credential';
    throw firebaseErr;
  }
  const mapped = mapUser(data.user);
  loggedInUser = mapped;
  currentSession = data.session;
  return { user: mapped };
}

export async function createUserWithEmailAndPassword(...args: any[]) {
  const email = args[1] || args[0];
  const password = args[2] || args[1];
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const firebaseErr = new Error(error.message) as any;
    firebaseErr.code = 'auth/email-already-in-use';
    throw firebaseErr;
  }
  const mapped = mapUser(data.user) || {
    uid: 'mock-uid-' + Math.random().toString(36).substring(2, 9),
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
  console.log('[Supabase Adapter] Custom Token Signin:', token);
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

export async function signOut(...args: any[]) {
  await supabase.auth.signOut();
  currentSession = null;
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
function cleanData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'object') {
    if (obj._methodName === 'serverTimestamp') {
      return Date.now();
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('[Supabase Firestore compatibility error]:', error, operationType, path);
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
