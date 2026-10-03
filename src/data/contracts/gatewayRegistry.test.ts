import { describe, expect, it } from 'vitest';
import { REGISTERED_GATEWAY_DOMAINS } from './gatewayRegistry';

describe('Phase 3 — Gateway Registry Contract Validation', () => {
  it('registers all 16 core feature gateway domains', () => {
    expect(REGISTERED_GATEWAY_DOMAINS.length).toBe(16);
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
  });
});
