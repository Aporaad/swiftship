/**
 * SwiftShip System — Phase 2 Golden DTO Contracts
 * 
 * Provides canonical, immutable Golden DTO interfaces and validation functions
 * for core domain entities in SwiftShip System.
 */

import { amountOrNull, currencyCodeOrNull } from './value-primitives';

export interface GoldenCustomerDto {
  readonly customerId: string;
  readonly fullName: string;
  readonly nameAr?: string;
  readonly nameEn?: string;
  readonly accountId: string;
  readonly customerLevel: string;
  readonly isActive: boolean;
  readonly createdAt: string;
}

export interface GoldenOrderDto {
  readonly orderId: string;
  readonly trackingNumber: string;
  readonly customerId: string;
  readonly orderStatusId: string;
  readonly totalPrice: number;
  readonly currency: string;
  readonly createdAt: string;
}

export interface GoldenShipmentDto {
  readonly shipmentId: string;
  readonly trackingNumber: string;
  readonly orderId: string;
  readonly shippingCompanyId: string;
  readonly status: string;
  readonly declaredValue: number;
  readonly createdAt: string;
}

export interface GoldenUserDto {
  readonly userId: string;
  readonly username: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: string;
  readonly disabled: boolean;
  readonly createdAt: string;
}

export interface GoldenProductDto {
  readonly productId: string;
  readonly productNameAr: string;
  readonly productNameEn: string;
  readonly itemCategoryId: string;
  readonly unitPrice: number;
  readonly isAllowed: boolean;
  readonly createdAt: string;
}

export interface GoldenAccountDto {
  readonly accountId: string;
  readonly accountNumber: string;
  readonly accNameAr: string;
  readonly balance: number;
  readonly currencyId: string;
  readonly isActive: boolean;
  readonly createdAt: string;
}

function isValidIsoDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function validateGoldenCustomerDto(dto: GoldenCustomerDto): boolean {
  return (
    typeof dto.customerId === 'string' && dto.customerId.length > 0 &&
    typeof dto.fullName === 'string' && dto.fullName.length > 0 &&
    typeof dto.accountId === 'string' &&
    typeof dto.isActive === 'boolean' &&
    isValidIsoDate(dto.createdAt)
  );
}

export function validateGoldenOrderDto(dto: GoldenOrderDto): boolean {
  return (
    typeof dto.orderId === 'string' && dto.orderId.length > 0 &&
    typeof dto.trackingNumber === 'string' &&
    typeof dto.customerId === 'string' &&
    amountOrNull(dto.totalPrice) !== null &&
    currencyCodeOrNull(dto.currency) !== null &&
    isValidIsoDate(dto.createdAt)
  );
}

export function validateGoldenShipmentDto(dto: GoldenShipmentDto): boolean {
  return (
    typeof dto.shipmentId === 'string' && dto.shipmentId.length > 0 &&
    typeof dto.trackingNumber === 'string' &&
    typeof dto.orderId === 'string' &&
    amountOrNull(dto.declaredValue) !== null &&
    isValidIsoDate(dto.createdAt)
  );
}

export function validateGoldenUserDto(dto: GoldenUserDto): boolean {
  return (
    typeof dto.userId === 'string' && dto.userId.length > 0 &&
    typeof dto.username === 'string' && dto.username.length > 0 &&
    typeof dto.email === 'string' &&
    typeof dto.role === 'string' &&
    typeof dto.disabled === 'boolean' &&
    isValidIsoDate(dto.createdAt)
  );
}

export function validateGoldenProductDto(dto: GoldenProductDto): boolean {
  return (
    typeof dto.productId === 'string' && dto.productId.length > 0 &&
    typeof dto.productNameAr === 'string' &&
    amountOrNull(dto.unitPrice) !== null &&
    typeof dto.isAllowed === 'boolean' &&
    isValidIsoDate(dto.createdAt)
  );
}

export function validateGoldenAccountDto(dto: GoldenAccountDto): boolean {
  return (
    typeof dto.accountId === 'string' && dto.accountId.length > 0 &&
    typeof dto.accountNumber === 'string' &&
    amountOrNull(dto.balance) !== null &&
    typeof dto.isActive === 'boolean' &&
    isValidIsoDate(dto.createdAt)
  );
}
