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

export type PortalPaymentRequestStatus = 'pending_verification' | 'settled' | 'rejected';
export type PortalPaymentMethod = 'cash' | 'transfer' | 'wallet' | 'check';
export interface PortalPaymentRequestDto {
  id: string;
  amount: number;
  currency: 'YER' | 'USD' | 'SAR';
  paymentMethod: PortalPaymentMethod;
  reference?: string;
  notes?: string;
  status: PortalPaymentRequestStatus;
  financeEntryId?: string;
  reviewNote?: string;
  createdAt: number;
  reviewedAt?: number;
}
export interface PortalPaymentReviewQueueItem extends PortalPaymentRequestDto {
  portalUserId: string;
  customerName: string;
  customerEmail: string;
  financialAccountId: string;
}

export interface PortalLedgerEntryDto {
  transactionId: string;
  entryId: string;
  entryNumber: string;
  transType: string;
  accountId: string;
  amount: number;
  amountOriginal: number;
  currencyOriginalNo: number;
  paymentMethod?: string;
  description?: string;
  note?: string;
  createdAt: number;
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
  listPaymentRequests(input: { portalUserId: string; limit: number; offset: number }): Promise<readonly PortalPaymentRequestDto[]>;
  listCustomerLedger(input: { financialAccountId: string; limit: number; offset: number }): Promise<readonly PortalLedgerEntryDto[]>;
  listPaymentRequestsForReview(input: { limit: number; offset: number }): Promise<readonly PortalPaymentReviewQueueItem[]>;
  createPaymentRequest(input: {
    paymentRequestId: string;
    portalUserId: string;
    amount: number;
    currency: 'YER' | 'USD' | 'SAR';
    paymentMethod: PortalPaymentMethod;
    reference?: string | undefined;
    notes?: string | undefined;
    idempotencyKey: string;
    requestHash: string;
    createdAt: Date;
  }): Promise<PortalPaymentRequestDto>;
  settlePaymentRequest(input: {
    paymentRequestId: string;
    financeEntryId: string;
    reviewerId: string;
    reviewedAt: Date;
  }): Promise<PortalPaymentRequestDto>;
  rejectPaymentRequest(input: {
    paymentRequestId: string;
    reviewerId: string;
    reviewNote: string;
    reviewedAt: Date;
  }): Promise<PortalPaymentRequestDto>;
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
