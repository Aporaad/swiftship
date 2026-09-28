import type { OrdersGateway } from '../../contracts/orders.gateway';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import type { OrdersViewModel } from '../../../features/orders/types';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';

function mapOrder(row: Record<string, unknown>): OrdersViewModel {
  return { id: String(row.order_id ?? row.id ?? '') };
}

function page<T>(items: T[], query: GatewayQuery, count: number | null): GatewayPage<T> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  return { items, limit, offset, hasMore: (count ?? offset + items.length) > offset + items.length };
}

export class CurrentSupabaseOrdersGateway implements OrdersGateway {
  async list(query: GatewayQuery = {}): Promise<GatewayPage<OrdersViewModel>> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const { data, error, count } = await supabase
      .from('orders')
      .select('order_id,order_status_id,created_at,updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw mapSupabaseError(error);
    return page((data ?? []).map((row: unknown) => mapRow(row, mapOrder)), { ...query, limit, offset }, count);
  }

  async getById(orderId: string): Promise<OrdersViewModel | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('order_id,order_status_id,created_at,updated_at')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? mapRow(data, mapOrder) : null;
  }

  async changeStatus(orderId: string, orderStatusId: string, actorId: string): Promise<OrdersViewModel> {
    const { data, error } = await supabase
      .from('orders')
      .update({ order_status_id: orderStatusId, updated_by: actorId, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .select('order_id,order_status_id,created_at,updated_at')
      .single();
    if (error) throw mapSupabaseError(error);
    return mapRow(data, mapOrder);
  }
}
