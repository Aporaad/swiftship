import type { FinanceEntriesGateway } from '../../contracts/finance-entries.gateway';
import type { FinanceEntryViewModel } from '../../../features/financeEntries/types';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';

const mapEntry = (row: Record<string, unknown>): FinanceEntryViewModel => ({
  entryId: String(row.main_entry_id ?? ''),
  status: String(row.posting_status ?? ''),
});

export class CurrentSupabaseFinanceEntriesGateway implements FinanceEntriesGateway {
  async list(query: GatewayQuery = {}): Promise<GatewayPage<FinanceEntryViewModel>> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const { data, error, count } = await supabase.from('main_entry').select('main_entry_id,created_at,updated_at', { count: 'exact' }).range(offset, offset + limit - 1);
    if (error) throw mapSupabaseError(error);
    const items = (data ?? []).map((row: unknown) => mapRow(row, mapEntry));
    return { items, limit, offset, hasMore: (count ?? offset + items.length) > offset + items.length };
  }

  async getById(id: string): Promise<FinanceEntryViewModel | null> {
    const { data, error } = await supabase.from('main_entry').select('main_entry_id,created_at,updated_at').eq('main_entry_id', id).maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? mapRow(data, mapEntry) : null;
  }

  async post(entryId: string, actorId: string): Promise<FinanceEntryViewModel> {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('main_entry').update({ posting_status: 'posted', posted_by_uid: actorId, posted_at: now, updated_by_uid: actorId, updated_at: now }).eq('main_entry_id', entryId).select('main_entry_id,posting_status,created_at,updated_at').single();
    if (error) throw mapSupabaseError(error);
    return mapRow(data, mapEntry);
  }

  async reverse(entryId: string, actorId: string): Promise<FinanceEntryViewModel> {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('main_entry').update({ posting_status: 'voided', voided_by_uid: actorId, voided_at: now, updated_by_uid: actorId, updated_at: now }).eq('main_entry_id', entryId).select('main_entry_id,posting_status,created_at,updated_at').single();
    if (error) throw mapSupabaseError(error);
    return mapRow(data, mapEntry);
  }
}
