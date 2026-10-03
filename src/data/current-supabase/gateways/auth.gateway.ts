import type { AuthGateway } from '../../contracts/auth.gateway';
import type { AuthViewModel } from '../../../features/auth/types';
import type { CurrentUserDto, SessionState } from '../../dtos/auth.dto';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import {
  auth as legacyAuth,
  completeSignIn as completeLegacySignIn,
  onAuthStateChanged,
  signInWithPassword as verifyLegacyCredentials,
  signOut as legacySignOut,
  type User as LegacyAuthUser,
} from '../../legacy/legacy-adapter';
import {
  mapLegacyAuthUserToDto,
  mapLegacyAuthUserToSessionState,
} from '../../dtos/mappers/auth-session.mapper';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';

const mapSession = (row: Record<string, unknown>): AuthViewModel => ({ id: String(row.session_id ?? '') });

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
