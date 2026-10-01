import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { errorEnvelope, hasPermission, publicCourierDto, publicCustomerDto, requestIdFrom } from './api-foundation';

describe('Phase 13 — system API foundation contracts', () => {
  it('creates a bounded request id and safe error envelope', () => {
    const req = { header: (name: string) => name === 'x-request-id' ? 'req-contract-42' : undefined } as unknown as Pick<Request, 'header'>;
    expect(requestIdFrom(req)).toBe('req-contract-42');
    expect(errorEnvelope('AUTH_REQUIRED', 'req-contract-42')).toEqual({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'تعذر تنفيذ الطلب حالياً.',
        details: [],
        requestId: 'req-contract-42',
      },
    });
  });

  it('maps customer and courier rows without secrets or raw database payloads', () => {
    const customer = publicCustomerDto('customer-1', {
      full_name: 'Visible Name',
      account_id: 'account-1',
      password: 'must-not-leak',
      data: { phone: '+967000000000', fullName: 'Nested Name' },
    });
    const courier = publicCourierDto('courier-1', {
      full_name: 'Courier Name',
      commission_rate: 12.5,
      password: 'must-not-leak',
      data: { phone: '+967000000000' },
    });
    expect(customer).toMatchObject({ customerId: 'customer-1', fullName: 'Visible Name', accountId: 'account-1' });
    expect(courier).toMatchObject({ courierId: 'courier-1', fullName: 'Courier Name', commissionRate: 12.5 });
    expect(JSON.stringify(customer)).not.toContain('password');
    expect(JSON.stringify(customer)).not.toContain('+967000000000');
    expect(JSON.stringify(courier)).not.toContain('password');
    expect(JSON.stringify(courier)).not.toContain('+967000000000');
  });

  it('allows admins and explicit read permissions only', () => {
    expect(hasPermission({ role: 'Admin', permissions: new Set() }, 'customers:read')).toBe(true);
    expect(hasPermission({ role: 'Staff', permissions: new Set(['customers:read']) }, 'customers:read')).toBe(true);
    expect(hasPermission({ role: 'Staff', permissions: new Set(['couriers:read']) }, 'customers:read')).toBe(false);
  });
});
