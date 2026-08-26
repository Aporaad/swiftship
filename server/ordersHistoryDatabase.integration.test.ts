import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const runIntegration = process.env.RUN_SUPABASE_INTEGRATION === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

type OrderRow = {
  id: string;
  order_number: string | null;
  data: Record<string, unknown> | null;
};

describeIntegration('orders_history database integration', () => {
  let client: SupabaseClient;
  let order: OrderRow;
  let originalData: Record<string, unknown>;
  let marker: string;
  let activityLogId: string;
  let automationKey: string;
  let automaticJournalIds: string[];

  beforeAll(async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for database integration tests.');

    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client
      .from('orders')
      .select('id, order_number, data')
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('At least one order is required for the orders_history integration test.');

    order = data as OrderRow;
    originalData = { ...(order.data || {}) };
    marker = `orders-history-test-${randomUUID()}`;
    activityLogId = `orders_history_test_${randomUUID()}`;
    automationKey = `auto-voucher:test:${order.id}:${randomUUID()}`;
    automaticJournalIds = [];
  });

  afterAll(async () => {
    if (!client || !order) return;

    await client.from('activity_logs').delete().eq('id', activityLogId);
    if (automaticJournalIds.length > 0) await client.from('journal_entries').delete().in('id', automaticJournalIds);
    await client.from('orders').update({ data: originalData }).eq('id', order.id);

    const { data: testHistory } = await client
      .from('orders_history')
      .select('id, metadata')
      .eq('order_id', order.id)
      .order('occurred_at', { ascending: false })
      .limit(20);

    const testHistoryIds = (testHistory || [])
      .filter((row: any) => {
        const change = row.metadata?.changes?.['data.ordersHistoryIntegrationMarker'];
        return change?.before === marker || change?.after === marker || row.metadata?.automationKey === automationKey;
      })
      .map((row: any) => row.id);

    if (testHistoryIds.length > 0) await client.from('orders_history').delete().in('id', testHistoryIds);
  });

  it('records one canonical order event when an edit_order activity is also inserted', async () => {
    const { error: orderError } = await client
      .from('orders')
      .update({ data: { ...originalData, ordersHistoryIntegrationMarker: marker } })
      .eq('id', order.id);
    expect(orderError).toBeNull();

    const { error: activityError } = await client.from('activity_logs').insert({
      id: activityLogId,
      action: 'edit_order',
      target: order.order_number || order.id,
      category: 'orders',
      type: 'integration_test',
      data: { details: { orderId: order.id, orderNumber: order.order_number } },
    });
    expect(activityError).toBeNull();

    const { data: history, error: historyError } = await client
      .from('orders_history')
      .select('id, event_type, activity_log_id, metadata')
      .eq('order_id', order.id)
      .order('occurred_at', { ascending: false })
      .limit(20);
    expect(historyError).toBeNull();

    const markerEvents = (history || []).filter((row: any) => row.metadata?.changes?.['data.ordersHistoryIntegrationMarker']?.after === marker);
    expect(markerEvents).toHaveLength(1);
    expect(markerEvents[0].event_type).toBe('order.updated');
    expect((history || []).some((row: any) => row.activity_log_id === activityLogId)).toBe(false);
  });

  it('enforces foreign keys for orders_history order_id and shipment_id', async () => {
    const baseRow = {
      event_type: 'integration.constraint_probe',
      event_category: 'integration_test',
      operation: 'insert',
      entity_type: 'test',
      source: 'vitest',
      summary: 'Foreign-key integration probe',
      before_data: {},
      after_data: {},
      metadata: {},
    };

    const { error: badOrderError } = await client.from('orders_history').insert({
      ...baseRow,
      id: `bad_order_${randomUUID()}`,
      order_id: `missing-order-${randomUUID()}`,
    });
    expect(badOrderError?.code).toBe('23503');

    const { error: badShipmentError } = await client.from('orders_history').insert({
      ...baseRow,
      id: `bad_shipment_${randomUUID()}`,
      shipment_id: `missing-shipment-${randomUUID()}`,
    });
    expect(badShipmentError?.code).toBe('23503');
  });

  it('prevents a second automatic voucher for the same execution key and writes one explicit audit event', async () => {
    const firstJournalId = `auto_journal_${randomUUID()}`;
    const duplicateJournalId = `auto_journal_${randomUUID()}`;
    automaticJournalIds.push(firstJournalId, duplicateJournalId);

    const automaticVoucher = {
      id: firstJournalId,
      order_id: order.id,
      order_number: order.order_number,
      automation_key: automationKey,
      auto_rule_id: 'integration_auto_rule',
      status_id: 2,
      is_automatic: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        automationKey,
        autoRuleId: 'integration_auto_rule',
        statusId: 2,
      },
    };

    const { error: firstError } = await client.from('journal_entries').insert(automaticVoucher);
    expect(firstError).toBeNull();

    const { error: duplicateError } = await client.from('journal_entries').insert({
      ...automaticVoucher,
      id: duplicateJournalId,
    });
    expect(duplicateError?.code).toBe('23505');

    const { data: history, error: historyError } = await client
      .from('orders_history')
      .select('event_type, summary, metadata')
      .eq('order_id', order.id)
      .eq('event_type', 'financial.automatic_voucher')
      .order('occurred_at', { ascending: false })
      .limit(20);
    expect(historyError).toBeNull();
    const matchingEvents = (history || []).filter((row: any) => row.metadata?.automationKey === automationKey);
    expect(matchingEvents).toHaveLength(1);
    expect(matchingEvents[0].summary).toBe('تم تنفيذ قيد طلب تلقائي');
  });
});
