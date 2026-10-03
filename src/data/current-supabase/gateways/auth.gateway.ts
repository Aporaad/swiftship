import type { AuthGateway } from '../../contracts/auth.gateway';
import type { AuthViewModel } from '../../../features/auth/types';
import type { AuthLoginProfileDto, CurrentUserDto, SessionState } from '../../dtos/auth.dto';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import {
  auth as legacyAuth,
  collection,
  completeSignIn as completeLegacySignIn,
  db,
  doc,
  getDoc,
  getDocs,
  onAuthStateChanged,
  query,
  setDoc,
  signInWithPassword as verifyLegacyCredentials,
  signOut as legacySignOut,
  where,
  type User as LegacyAuthUser,
} from '../../legacy/legacy-compat';
import {
  mapLegacyAuthUserToDto,
  mapLegacyAuthUserToSessionState,
} from '../../dtos/mappers/auth-session.mapper';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';

const ROOT_ACCOUNT_EMAILS = new Set([
  'alsrhyarslan5@gmail.com',
  'arslan.alshamari@gmail.com',
  'engaporaad1@gmail.com',
  'admin@swiftship.system',
  'apo.1.read@gmail.com',
]);

const mapSession = (row: Record<string, unknown>): AuthViewModel => ({ id: String(row.session_id ?? '') });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function profileRecord(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const nested = value.data;
  return isRecord(nested) ? { ...value, ...nested } : value;
}

function readText(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  return null;
}

function readBoolean(record: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    if (typeof record[key] === 'boolean') return record[key] as boolean;
  }
  return false;
}

function mapLoginProfile(value: unknown, fallbackId: string): AuthLoginProfileDto | null {
  const record = profileRecord(value);
  if (!record) return null;
  const systemPin = readText(record, 'systemPin', 'system_pin');
  return {
    id: readText(record, 'user_id', 'id', 'uid') ?? fallbackId,
    email: readText(record, 'email'),
    username: readText(record, 'username'),
    displayName: readText(record, 'fullName', 'full_name', 'displayName', 'display_name'),
    role: readText(record, 'role'),
    roleId: readText(record, 'roleId', 'role_id'),
    isRoot: readBoolean(record, 'isRoot', 'is_root'),
    disabled: readBoolean(record, 'disabled'),
    requiresSystemPin: systemPin !== null && systemPin.length > 0,
  };
}

function readSystemPin(value: unknown): string | null {
  const record = profileRecord(value);
  return record ? readText(record, 'systemPin', 'system_pin') : null;
}

export class CurrentSupabaseAuthGateway implements AuthGateway {
  private pendingUser: LegacyAuthUser | null = null;

  async list(query: GatewayQuery = {}): Promise<GatewayPage<AuthViewModel>> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const { data, error, count } = await supabase.from('sessions').select('session_id,user_id,created_at,last_seen,force_logout', { count: 'exact' }).range(offset, offset + limit - 1);
    if (error) throw mapSupabaseError(error);
    const items = (data ?? []).map((row: unknown) => mapRow(row, mapSession));
    return { items, limit, offset, hasMore: (count ?? offset + items.length) > offset + items.length };
  }

  async getById(id: string): Promise<AuthViewModel | null> {
    const { data, error } = await supabase.from('sessions').select('session_id,user_id,created_at,last_seen,force_logout').eq('session_id', id).maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? mapRow(data, mapSession) : null;
  }

  async authenticate(identifier: string, password: string): Promise<CurrentUserDto> {
    const { user } = await verifyLegacyCredentials(identifier, password);
    this.pendingUser = user;
    return mapLegacyAuthUserToDto(user);
  }

  async findEmailByUsername(username: string): Promise<string | null> {
    const snapshot = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
    const profile = profileRecord(snapshot.docs[0]?.data());
    return profile ? readText(profile, 'email') : null;
  }

  async getLoginProfile(userId: string): Promise<AuthLoginProfileDto | null> {
    const snapshot = await getDoc(doc(db, 'users', userId));
    return snapshot.exists() ? mapLoginProfile(snapshot.data(), userId) : null;
  }

  async ensureInitialRootProfile(userId: string): Promise<AuthLoginProfileDto | null> {
    if (!this.pendingUser || this.pendingUser.uid !== userId) {
      throw new Error('A matching credential-verified user is required.');
    }
    const email = this.pendingUser.email?.trim().toLowerCase();
    if (!email || !ROOT_ACCOUNT_EMAILS.has(email)) return null;

    await setDoc(doc(db, 'users', userId), {
      email,
      username: email.split('@')[0],
      fullName: 'System Root Administrator',
      role: 'Admin',
      isRoot: true,
      disabled: false,
      createdAt: Date.now(),
    });
    return this.getLoginProfile(userId);
  }

  async verifySystemPin(userId: string, pin: string): Promise<boolean> {
    if (!this.pendingUser || this.pendingUser.uid !== userId || pin.length === 0) return false;
    const snapshot = await getDoc(doc(db, 'users', userId));
    const expectedPin = snapshot.exists() ? readSystemPin(snapshot.data()) : null;
    return expectedPin !== null && expectedPin === pin;
  }

  completeSignIn(userId: string): void {
    if (!this.pendingUser || this.pendingUser.uid !== userId) {
      throw new Error('No matching verified sign-in is waiting for completion.');
    }
    completeLegacySignIn(this.pendingUser);
    this.pendingUser = null;
  }

  cancelPendingSignIn(): void {
    this.pendingUser = null;
  }

  async getCurrentSession(): Promise<SessionState> {
    return mapLegacyAuthUserToSessionState(legacyAuth.currentUser);
  }

  subscribeToSession(listener: (state: SessionState) => void): () => void {
    return onAuthStateChanged(legacyAuth, (user: LegacyAuthUser | null) => {
      listener(mapLegacyAuthUserToSessionState(user));
    });
  }

  async signOut(): Promise<void> {
    this.pendingUser = null;
    await legacySignOut(legacyAuth);
  }
}

export const currentSupabaseAuthGateway = new CurrentSupabaseAuthGateway();
