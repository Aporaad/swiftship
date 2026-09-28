import type { EntityGateway, GatewayPage, GatewayQuery } from '../contracts/common.gateway';
import { supabase } from './supabase.client';
import { mapRow, mapSupabaseError } from './supabase.mapper';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function normalizeQuery(query: GatewayQuery = {}) {
  return {
    limit: Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    offset: Math.max(query.offset ?? 0, 0),
  };
}

export function createTableGateway<T>(
  table: string,
  idColumn: string,
  mapper: (row: Record<string, unknown>) => T,
): EntityGateway<T> {
  return {
    async list(query = {}): Promise<GatewayPage<T>> {
      const { limit, offset } = normalizeQuery(query);
      let request = supabase
        .from(table)
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);

      if (query.search?.trim()) {
        request = request.ilike(idColumn, `%${query.search.trim()}%`);
      }

      const { data, error, count } = await request;
      if (error) throw mapSupabaseError(error);
      const items = (data ?? []).map((row: unknown) => mapRow(row, mapper));
      return { items, limit, offset, hasMore: (count ?? offset + items.length) > offset + items.length };
    },

    async getById(id: string): Promise<T | null> {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(idColumn, id)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return data ? mapRow(data, mapper) : null;
    },
  };
}
