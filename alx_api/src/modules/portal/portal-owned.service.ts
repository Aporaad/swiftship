import { randomBytes, randomUUID } from 'node:crypto';
import type { PortalAuthService } from './portal-auth.service';
import { calculatePortalOrderPricing } from './portal-order-pricing';
import type {
  PortalOwnedRepository,
  PortalCustomerDetailsDto,
  PortalOrderDto,
  PortalTicketDto,
  CreatePortalOrderItemRecord,
} from './portal-owned.contracts';
import type {
  PortalCustomerDetailsUpdateInput,
  PortalOrderCreateInput,
  PortalTicketCreateInput,
} from './portal-owned.schemas';

export class PortalOwnedServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = 'PortalOwnedServiceError';
  }
}

function requireEntityLink(value: string | undefined, code: string, message: string): string {
  if (!value) throw new PortalOwnedServiceError(409, code, message);
  return value;
}

function orderNumber(now: Date): string {
  const yearMonth = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `ALX-${yearMonth}-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export class PortalOwnedService {
  constructor(
    private readonly auth: PortalAuthService,
    private readonly repository: PortalOwnedRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listTickets(input: { portalUserId: string; limit: number; offset: number }): Promise<readonly PortalTicketDto[]> {
    return this.repository.listTickets(input);
  }

  async createTicket(input: { portalUserId: string; ticket: PortalTicketCreateInput }): Promise<PortalTicketDto> {
    const profile = await this.auth.profile(input.portalUserId);
    const createdAt = this.now();
    return this.repository.createTicket({
      portalUserId: profile.portalUserId,
      userName: profile.fullName,
      userRole: profile.role,
      ...input.ticket,
      ticketId: `tkt_${randomUUID()}`,
      createdAt,
    });
  }

  async getCustomerDetails(portalUserId: string): Promise<PortalCustomerDetailsDto | null> {
    const profile = await this.auth.profile(portalUserId);
    if (profile.role !== 'customer') {
      throw new PortalOwnedServiceError(403, 'PORTAL_CUSTOMER_ROLE_REQUIRED', 'هذه البيانات متاحة لحساب العميل فقط.');
    }
    requireEntityLink(profile.linkedCustomerId, 'PORTAL_CUSTOMER_LINK_MISSING', 'لم يكتمل ربط حساب العميل بعد.');
    return this.repository.getCustomerDetails(profile.portalUserId);
  }

  async saveCustomerDetails(input: {
    portalUserId: string;
    details: PortalCustomerDetailsUpdateInput;
  }): Promise<PortalCustomerDetailsDto> {
    const profile = await this.auth.profile(input.portalUserId);
    if (profile.role !== 'customer') {
      throw new PortalOwnedServiceError(403, 'PORTAL_CUSTOMER_ROLE_REQUIRED', 'هذه البيانات متاحة لحساب العميل فقط.');
    }
    const customerId = requireEntityLink(
      profile.linkedCustomerId,
      'PORTAL_CUSTOMER_LINK_MISSING',
      'لم يكتمل ربط حساب العميل بعد.',
    );
    try {
      return await this.repository.saveCustomerDetails({
        portalUserId: profile.portalUserId,
        customerId,
        details: input.details,
        updatedAt: this.now(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'CUSTOMER_PRIVACY_AGREEMENT_REQUIRED') {
        throw new PortalOwnedServiceError(400, error.message, 'الموافقة على سياسة الخصوصية مطلوبة لإكمال الملف.');
      }
      if (error instanceof Error && error.message === 'CUSTOMER_LOCATION_REQUIRED') {
        throw new PortalOwnedServiceError(400, error.message, 'يجب إكمال الموقع الجغرافي قبل إتمام onboarding.');
      }
      throw error;
    }
  }

  async listCustomerOrders(input: { portalUserId: string; limit: number; offset: number }): Promise<readonly PortalOrderDto[]> {
    const profile = await this.auth.profile(input.portalUserId);
    if (profile.role !== 'customer') {
      throw new PortalOwnedServiceError(403, 'PORTAL_CUSTOMER_ROLE_REQUIRED', 'هذه الخدمة متاحة لحساب العميل فقط.');
    }
    const customerId = requireEntityLink(
      profile.linkedCustomerId,
      'PORTAL_CUSTOMER_LINK_MISSING',
      'لم يكتمل ربط حساب العميل بعد.',
    );
    return this.repository.listCustomerOrders({ customerId, limit: input.limit, offset: input.offset });
  }

  async createCustomerOrder(input: {
    portalUserId: string;
    idempotencyKey: string;
    order: PortalOrderCreateInput;
  }): Promise<PortalOrderDto> {
    const profile = await this.auth.profile(input.portalUserId);
    if (profile.role !== 'customer') {
      throw new PortalOwnedServiceError(403, 'PORTAL_CUSTOMER_ROLE_REQUIRED', 'هذه الخدمة متاحة لحساب العميل فقط.');
    }
    if (profile.approvalStatus !== 'approved') {
      throw new PortalOwnedServiceError(403, 'PORTAL_CUSTOMER_NOT_APPROVED', 'يجب اعتماد الحساب قبل إرسال طلب جديد.');
    }

    const customerId = requireEntityLink(
      profile.linkedCustomerId,
      'PORTAL_CUSTOMER_LINK_MISSING',
      'لم يكتمل ربط حساب العميل بعد.',
    );
    const financialAccountId = requireEntityLink(
      profile.financialAccountId,
      'PORTAL_FINANCIAL_ACCOUNT_LINK_MISSING',
      'لم يكتمل ربط الحساب المالي للعميل بعد.',
    );
    const idempotencyKey = input.idempotencyKey.trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new PortalOwnedServiceError(400, 'INVALID_IDEMPOTENCY_KEY', 'مفتاح الطلب غير صالح.');
    }

    const selectedSource = input.order.orderSourceId
      ? await this.repository.findActiveOrderSource(input.order.orderSourceId)
      : null;
    if (input.order.orderSourceId && !selectedSource) {
      throw new PortalOwnedServiceError(400, 'PORTAL_ORDER_SOURCE_NOT_ACTIVE', 'مصدر الطلب المحدد غير متاح.');
    }
    const sourceType = selectedSource?.type ?? 'App';
    const pricingSettings = await this.repository.getCustomerOrderPricingSettings();
    const pricing = calculatePortalOrderPricing({
      items: input.order.items,
      packagingType: input.order.packagingType,
      isUrgent: input.order.isUrgent,
      sourceType,
    }, pricingSettings);

    const createdAt = this.now();
    const createdAtMs = createdAt.getTime();
    const number = orderNumber(createdAt);
    const trackingNumber = number;
    const items: CreatePortalOrderItemRecord[] = input.order.items.map((item) => ({
      id: `item_${randomUUID()}`,
      productName: item.productName,
      ...(item.productUrl ? { productUrl: item.productUrl } : {}),
      quantity: item.quantity,
      productPrice: item.productPrice,
      weight: item.weight ?? 0,
      cbm: item.cbm ?? 0,
      length: item.length ?? 0,
      width: item.width ?? 0,
      height: item.height ?? 0,
      ...(item.trackingNumber ? { trackingNumber: item.trackingNumber } : {}),
    }));
    const goodsDescription = items.map((item) => `${item.productName} (${item.quantity})`).join('، ');
    const orderData: Record<string, unknown> = {
      portalApiSchemaVersion: 1,
      orderNumber: number,
      trackingNumber,
      customerId,
      customerName: profile.fullName,
      customerPhone: profile.phone,
      customerAddress: profile.address ?? '',
      customerEmail: profile.email,
      customerUid: profile.portalUserId,
      portalUid: profile.portalUserId,
      recipientName: profile.fullName,
      recipientPhone: profile.phone,
      orderSourceId: selectedSource?.id ?? '',
      orderSourceName: selectedSource?.name ?? 'تطبيق عام',
      orderSourceType: sourceType,
      externalOrderNumber: input.order.externalOrderNumber ?? '',
      cartShareCode: input.order.cartShareCode ?? '',
      items,
      goodsDescription,
      totalWeight: pricing.totalWeight,
      totalCBM: pricing.totalCBM,
      packagingType: input.order.packagingType,
      packagingFee: pricing.packagingFeeSAR,
      isUrgent: input.order.isUrgent,
      packageType: input.order.packageType,
      currency: 'SAR',
      productsSum: pricing.productsSum,
      shippingCostSAR: pricing.shippingCostSAR,
      companyProfitSAR: pricing.companyProfitSAR,
      totalCostSAR: pricing.totalCostSAR,
      exchangeRateYER: pricing.exchangeRateYER,
      deliveryCourierFee: pricing.deliveryCourierFeeYER,
      totalCostYER: pricing.totalCostYER,
      amountPaid: 0,
      amountRemaining: pricing.totalCostYER,
      paymentStatus: 'Unpaid',
      paymentMethod: input.order.paymentMethod ?? 'Cash',
      orderStatus: 'معلق',
      status: 'pending',
      source: 'web_portal',
      orderSource: 'web_portal',
      customerEstimate: {
        totalCostSAR: pricing.totalCostSAR,
        totalCostYER: pricing.totalCostYER,
        requiresStaffReview: true,
      },
      customerNote: input.order.notes ?? '',
      createdByUid: profile.portalUserId,
      createdByName: `${profile.fullName} (بوابة العميل)`,
      createdAt: createdAtMs,
      updatedAt: createdAtMs,
    };

    return this.repository.createCustomerOrder({
      orderId: `ord_${randomUUID()}`,
      orderNumber: number,
      trackingNumber,
      customerId,
      financialAccountId,
      portalUserId: profile.portalUserId,
      customerName: profile.fullName,
      customerPhone: profile.phone,
      customerEmail: profile.email,
      customerAddress: profile.address ?? '',
      ...(selectedSource ? { sourceId: selectedSource.id } : {}),
      sourceName: selectedSource?.name ?? 'تطبيق عام',
      sourceType,
      ...(input.order.externalOrderNumber ? { externalOrderNumber: input.order.externalOrderNumber } : {}),
      ...(input.order.cartShareCode ? { cartShareCode: input.order.cartShareCode } : {}),
      items,
      orderData,
      idempotencyKey: `portal-order:${profile.portalUserId}:${idempotencyKey}`,
      createdAt,
    });
  }
}
