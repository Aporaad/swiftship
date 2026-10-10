import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('orders API gateway boundary', () => {
  it('does not import or delegate to the legacy Orders adapter', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/orders/services/ordersApiDataGateway.ts'), 'utf8');
    expect(source).not.toContain('legacyOrdersApi');
    expect(source).not.toContain('data/legacy');
    expect(source).toContain("'/api/v1/orders'");
    expect(source).toContain("'/api/v1/shipments'");
    expect(source).toContain("'/api/v1/products'");
  });

  it('rejects unsupported writes instead of silently falling back', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/orders/services/ordersApiDataGateway.ts'), 'utf8');
    expect(source).toContain('ORDERS_API_OPERATION_UNSUPPORTED');
    expect(source).not.toContain('VITE_ORDERS_API_READS');
    expect(source).not.toContain('VITE_ORDERS_API_WRITES');
  });
});
