import { describe, expect, it } from 'vitest';
import { REGISTERED_GATEWAY_DOMAINS } from './gatewayRegistry';
import { createCurrentSupabaseGatewayRegistry } from '../current-supabase/gateways/registry';

describe('Phase 3 — Gateway Registry Contract Validation', () => {
  it('registers all 17 core feature gateway domains including browser', () => {
    expect(REGISTERED_GATEWAY_DOMAINS.length).toBe(17);
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('orders');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('customers');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('couriers');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('shipments');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('products');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('accounting');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('financeEntries');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('roles');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('users');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('auth');
    expect(REGISTERED_GATEWAY_DOMAINS).toContain('browser');
  });

  it('wires every registered domain to a concrete gateway implementation', () => {
    const registry = createCurrentSupabaseGatewayRegistry();
    for (const domain of REGISTERED_GATEWAY_DOMAINS) {
      expect(registry[domain]).toBeDefined();
    }
  });
});
