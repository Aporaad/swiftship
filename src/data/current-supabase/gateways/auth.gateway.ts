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
import { mapRow } from '../supabase.mapper';
import { alxListSessions } from '../../../lib/alxAuthGateway';

const ROOT_ACCOUNT_EMAILS = new Set([
  'alsrhyarslan5@gmail.com',
  'arslan.alshamari@gmail.com',
  'engaporaad1@gmail.com',
  'admin@swiftship.system',
  'apo.1.read@gmail.com',
]);

const mapSession = (row: Record<string, unknown>): AuthViewModel => ({
  id: String(row.sessionId ?? row.session_id ?? ''),
  sessionId: String(row.sessionId ?? row.session_id ?? ''),
  userId: String(row.userId ?? row.user_id ?? ''),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * ملفات المستخدمين أعمدة مسطّحة حقيقية (full_name/system_pin/…)، فلا يُفكّ أي غلاف payload هنا.
 * User profiles are flat first-class columns (full_name/system_pin/...), so no payload wrapper is unwrapped.
 * تستدعي الطبقات العلوية snapshot.data() من وثيقة المحلي — وهذا يبقى لأن ليس عمود في قاعدة البيانات.
 * Callers still use snapshot.data() from the local document shim; that is not a database column.
 */
function profileRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
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

  // الجلسات تُقرأ من alx_api وحده: جدول public.sessions أُسقط في الترحيل 0040 ولا مصدر آخر له.
  // Sessions come only from alx_api: public.sessions is dropped by migration 0040 and has no other source.
  async list(query: GatewayQuery = {}): Promise<GatewayPage<AuthViewModel>> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const items = (await alxListSessions()).map((row) => mapRow(row, mapSession));
    const paged = items.slice(offset, offset + limit);
    return { items: paged, limit, offset, hasMore: items.length > offset + paged.length };
  }

  async getById(id: string): Promise<AuthViewModel | null> {
    const session = (await alxListSessions()).find((row) => String(row.sessionId ?? row.session_id ?? '') === id);
    return session ? mapRow(session, mapSession) : null;
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
