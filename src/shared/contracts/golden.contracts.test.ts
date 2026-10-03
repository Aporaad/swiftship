import { describe, expect, it } from 'vitest';
import {
  validateGoldenCustomerDto,
  validateGoldenOrderDto,
  validateGoldenShipmentDto,
  validateGoldenUserDto,
  validateGoldenProductDto,
  validateGoldenAccountDto,
  type GoldenCustomerDto,
  type GoldenOrderDto,
  type GoldenShipmentDto,
  type GoldenUserDto,
  type GoldenProductDto,
  type GoldenAccountDto,
} from './golden.contracts';

describe('Phase 2 — Golden DTO Contracts Validation', () => {
  it('validates golden customer DTO', () => {
    const valid: GoldenCustomerDto = {
      customerId: 'cust-101',
      fullName: 'Customer Ahmed',
      nameAr: 'أحمد علي',
      accountId: 'acc-5001',
      customerLevel: 'VIP',
      isActive: true,
      createdAt: '2026-10-02T00:00:00.000Z',
    };
    expect(validateGoldenCustomerDto(valid)).toBe(true);
  });

  it('validates golden order DTO', () => {
    const valid: GoldenOrderDto = {
      orderId: 'ALX-2026-1001',
      trackingNumber: 'TRK-987654',
      customerId: 'cust-101',
      orderStatusId: 'status-1',
      totalPrice: 450.50,
      currency: 'SAR',
      createdAt: '2026-10-02T00:00:00.000Z',
    };
    expect(validateGoldenOrderDto(valid)).toBe(true);
  });

  it('validates golden shipment DTO', () => {
    const valid: GoldenShipmentDto = {
      shipmentId: 'SHP-5001',
      trackingNumber: 'TRK-987654',
      orderId: 'ALX-2026-1001',
      shippingCompanyId: 'sc-1',
      status: 'IN_TRANSIT',
      declaredValue: 450.50,
      createdAt: '2026-10-02T00:00:00.000Z',
    };
    expect(validateGoldenShipmentDto(valid)).toBe(true);
  });

  it('validates golden user DTO', () => {
    const valid: GoldenUserDto = {
      userId: 'user-001',
      username: 'admin_user',
      email: 'admin@swiftship.local',
      fullName: 'System Administrator',
      role: 'Admin',
      disabled: false,
      createdAt: '2026-10-02T00:00:00.000Z',
    };
    expect(validateGoldenUserDto(valid)).toBe(true);
  });

  it('validates golden product DTO', () => {
    const valid: GoldenProductDto = {
      productId: 'prod-88',
      productNameAr: 'منتج إلكتروني',
      productNameEn: 'Electronic Item',
      itemCategoryId: 'cat-1',
      unitPrice: 199.99,
      isAllowed: true,
      createdAt: '2026-10-02T00:00:00.000Z',
    };
    expect(validateGoldenProductDto(valid)).toBe(true);
  });

  it('validates golden account DTO', () => {
    const valid: GoldenAccountDto = {
      accountId: 'acc-1001',
      accountNumber: '1101001',
      accNameAr: 'الصندوق الرئيسي',
      balance: 15400.00,
      currencyId: 'curr-1',
      isActive: true,
      createdAt: '2026-10-02T00:00:00.000Z',
    };
    expect(validateGoldenAccountDto(valid)).toBe(true);
  });

  it('rejects invalid DTOs with invalid date or currency', () => {
    const invalidOrder: GoldenOrderDto = {
      orderId: 'ALX-1',
      trackingNumber: 'TRK-1',
      customerId: 'cust-1',
      orderStatusId: '1',
      totalPrice: NaN,
      currency: 'INVALID_CURRENCY',
      createdAt: 'not-a-date',
    };
    expect(validateGoldenOrderDto(invalidOrder)).toBe(false);
  });
});
