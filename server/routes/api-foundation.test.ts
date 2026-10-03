import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  errorEnvelope,
  hasPermission,
  publicAccountDto,
  publicCourierDto,
  publicCurrentUserDto,
  publicCustomerDto,
  publicMainEntryDto,
  publicOrderDto,
  publicProductDto,
  publicShipmentDto,
  requestIdFrom,
} from './api-foundation';

describe('Phase 13 — system API foundation contracts', () => {
  it('creates a bounded request id and safe error envelope', () => {
    const req = {
      header: (name: string) => name === 'x-request-id' ? 'req-contract-42' : undefined,
    } as unknown as Pick<Request, 'header'>;

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

    // تحقق من الحقول الظاهرة / verify visible fields
    expect(customer).toMatchObject({ customerId: 'customer-1', fullName: 'Visible Name', accountId: 'account-1' });
    expect(courier).toMatchObject({ courierId: 'courier-1', fullName: 'Courier Name', commissionRate: 12.5 });

    // تحقق من عدم تسريب البيانات الحساسة / verify no secret leakage
    expect(JSON.stringify(customer)).not.toContain('password');
    expect(JSON.stringify(customer)).not.toContain('+967000000000');
    expect(JSON.stringify(courier)).not.toContain('password');
    expect(JSON.stringify(courier)).not.toContain('+967000000000');
  });

  it('maps order, shipment, product, account, and main entry rows correctly', () => {
    const order = publicOrderDto('ord-1', {
      order_id: 'ALX-101',
      tracking_number: 'TRK-900',
      customer_name: 'Customer A',
      total_price: 1500,
      currency: 'SAR',
    });
    const shipment = publicShipmentDto('shp-1', {
      shipment_id: 'SHP-101',
      tracking_number: 'TRK-900',
      status: 'DELIVERED',
      declared_value: 1500,
    });
    const product = publicProductDto('prod-1', {
      product_id: 'PROD-101',
      product_name_ar: 'منتج تجريبي',
      unit_price: 250,
      is_allowed: true,
    });
    const account = publicAccountDto('acc-1', {
      account_number: '1101',
      acc_name_ar: 'الصندوق',
      balance: 5000,
    });
    const entry = publicMainEntryDto('ent-1', {
      entry_number: 'JV-2026-001',
      entry_date: '2026-10-02',
      posting_status: 'posted',
    });

    expect(order).toMatchObject({ orderId: 'ALX-101', trackingNumber: 'TRK-900', customerName: 'Customer A', totalPrice: 1500 });
    expect(shipment).toMatchObject({ shipmentId: 'SHP-101', trackingNumber: 'TRK-900', status: 'DELIVERED', declaredValue: 1500 });
    expect(product).toMatchObject({ productId: 'PROD-101', productNameAr: 'منتج تجريبي', unitPrice: 250, isAllowed: true });
    expect(account).toMatchObject({ accountNumber: '1101', accNameAr: 'الصندوق', balance: 5000 });
    expect(entry).toMatchObject({ entryNumber: 'JV-2026-001', entryDate: '2026-10-02', postingStatus: 'posted' });
  });

  it('maps current user without password, token, or systemPin', () => {
    const dto = publicCurrentUserDto({
      userId: 'user-1',
      role: 'Staff',
      email: 'user@example.com',
      fullName: 'Test User',
      permissions: new Set(['customers:read', 'couriers:read']),
    });

    // تحقق من الحقول العامة / verify public fields
    expect(dto).toMatchObject({
      userId: 'user-1',
      role: 'Staff',
      email: 'user@example.com',
      fullName: 'Test User',
    });
    expect(Array.isArray(dto.permissions)).toBe(true);

    // تحقق من عدم تسريب الأسرار / verify no secret leakage
    expect(JSON.stringify(dto)).not.toContain('password');
    expect(JSON.stringify(dto)).not.toContain('token');
    expect(JSON.stringify(dto)).not.toContain('systemPin');
  });

  it('allows admins, empty permission (auth-only), and explicit read permissions only', () => {
    // Admin يملك كل الصلاحيات دائماً / Admin always has all permissions
    expect(hasPermission({ role: 'Admin', permissions: new Set() }, 'customers:read')).toBe(true);

    // empty permission = مصادقة فقط لأي دور / auth-only for any role
    expect(hasPermission({ role: 'Staff', permissions: new Set() }, '')).toBe(true);

    // Staff مع صلاحية صريحة / Staff with explicit permission
    expect(hasPermission({ role: 'Staff', permissions: new Set(['customers:read']) }, 'customers:read')).toBe(true);

    // Staff بدون الصلاحية المطلوبة / Staff without required permission
    expect(hasPermission({ role: 'Staff', permissions: new Set(['couriers:read']) }, 'customers:read')).toBe(false);
  });
});

