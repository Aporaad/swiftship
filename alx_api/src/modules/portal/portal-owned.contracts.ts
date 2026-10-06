export type PortalOwnedTicketType = 'inquiry' | 'suggestion' | 'complaint';
export type PortalOwnedTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface PortalTicketDto {
  id: string;
  userUid: string;
  userName: string;
  userRole: 'customer' | 'courier' | 'supplier';
  type: PortalOwnedTicketType;
  subject: string;
  message: string;
  status: PortalOwnedTicketStatus;
  adminResponse?: string;
  respondedAt?: number;
  createdAt: number;
}

export interface PortalOrderDto {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  status: string;
  orderStatus: string;
  createdAt: number;
  [customerVisibleField: string]: unknown;
}

export interface PortalCustomerDetailsDto {
  id: string;
  userUid: string;
  customerId: string;
  privacyPolicyAgreed: boolean;
  privacyPolicyAgreedAt?: number;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  location?: Record<string, unknown>;
  bodyDetails?: Record<string, unknown>;
  preferredCategories: string[];
  acquisitionSource?: Record<string, unknown>;
  joinBy: string;
  referrerId: string;
  onboardingCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export type PortalCustomerDetailsUpdateInput = ValidatedPortalCustomerDetailsUpdateInput;

export interface CreatePortalTicketRecord {
  portalUserId: string;
  userName: string;
  userRole: 'customer' | 'courier' | 'supplier';
  type: PortalOwnedTicketType;
  subject: string;
  message: string;
  ticketId: string;
  createdAt: Date;
}

export interface CreatePortalOrderItemRecord {
  id: string;
  productName: string;
  productUrl?: string | undefined;
  quantity: number;
  productPrice: number;
  weight: number;
  cbm: number;
  length: number;
  width: number;
  height: number;
  trackingNumber?: string | undefined;
}

export interface CreatePortalOrderRecord {
  orderId: string;
  orderNumber: string;
  trackingNumber: string;
  customerId: string;
  financialAccountId: string;
  portalUserId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  sourceId?: string | undefined;
  sourceName: string;
  sourceType: string;
  externalOrderNumber?: string | undefined;
  cartShareCode?: string | undefined;
  items: readonly CreatePortalOrderItemRecord[];
  orderData: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: Date;
}

export interface PortalOrderPricingSettings {
  exchangeRateYER: number;
  defaultDeliveryFeeYER: number;
  defaultCompanyProfitRate: number;
  defaultPackagingFeeSAR: number;
}

export interface PortalOwnedRepository {
  listTickets(input: { portalUserId: string; limit: number; offset: number }): Promise<readonly PortalTicketDto[]>;
  createTicket(input: CreatePortalTicketRecord): Promise<PortalTicketDto>;
  listCustomerOrders(input: { customerId: string; limit: number; offset: number }): Promise<readonly PortalOrderDto[]>;
  createCustomerOrder(input: CreatePortalOrderRecord): Promise<PortalOrderDto>;
  getCustomerOrderPricingSettings(): Promise<PortalOrderPricingSettings>;
  findActiveOrderSource(sourceId: string): Promise<{ id: string; name: string; type: string } | null>;
  getCustomerDetails(portalUserId: string): Promise<PortalCustomerDetailsDto | null>;
  saveCustomerDetails(input: {
    portalUserId: string;
    customerId: string;
    details: PortalCustomerDetailsUpdateInput;
    updatedAt: Date;
  }): Promise<PortalCustomerDetailsDto>;
}
import type { PortalCustomerDetailsUpdateInput as ValidatedPortalCustomerDetailsUpdateInput } from './portal-owned.schemas';
