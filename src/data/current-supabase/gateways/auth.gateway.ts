import type { AuthGateway } from '../../contracts/auth.gateway';
import type { AuthViewModel } from '../../../features/auth/types';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';

const mapSession = (row: Record<string, unknown>): AuthViewModel => ({ id: String(row.session_id ?? '') });

export class CurrentSupabaseAuthGateway implements AuthGateway {
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

  async getCurrentSession(): Promise<AuthViewModel | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw mapSupabaseError(error);
    return data.session ? { id: data.session.user.id } : null;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw mapSupabaseError(error);
  }
}
