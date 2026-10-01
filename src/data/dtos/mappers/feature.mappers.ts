import {
  booleanOrDefault,
  amountOrNull,
  isJsonObject,
  isoOrNull,
  numberOrNull,
  textOrNull,
  asIsoUtc,
  convertedAmountOrNull,
  currencyCodeOrNull,
  exchangeRateOrNull,
  isoDateOrNull,
  approvalStatusOrNull,
  originalAmountOrNull,
  orderStatusOrNull,
  paymentStatusOrNull,
  postingStatusOrNull,
  shipmentStatusOrNull,
} from '../common.dto';
import type { AuthApiDto, AuthDatabaseRow } from '../auth.dto';
import type { BrowserApiDto, BrowserDatabaseRow, BrowserPageData } from '../browser.dto';
import type { UsersApiDto, UsersDatabaseRow } from '../users.dto';
import type { RolesApiDto, RolesDatabaseRow } from '../roles.dto';
import type { CustomerDetailsDatabaseRow, CustomerEntityData, CustomerFinancialSummary, CustomersApiDto, CustomersDatabaseRow, CustomerProfileData, PortalUserApiDto, PortalUserDatabaseRow } from '../customers.dto';
import type { OrderApiDto, OrderRelatedData, OrderSupplementalData, OrdersDatabaseRow } from '../orders.dto';
import type { ProductCategoryApiDto, ProductCategoryDatabaseRow, ProductsApiDto, ProductsDatabaseRow, OrderItemApiDto, OrderItemDatabaseRow, ReturnedProductApiDto, ReturnedProductDatabaseRow } from '../products.dto';
import type { AssetApiDto, AssetDatabaseRow, ShippingCompanyApiDto, ShippingCompanyDatabaseRow, SourcesApiDto, SourcesDatabaseRow } from '../sources.dto';
import type { ShipmentDatabaseRow, ShipmentsApiDto } from '../shipments.dto';
import type { CouriersApiDto, CouriersDatabaseRow, CourierProfile } from '../couriers.dto';
import type { EmployeesApiDto, EmployeesDatabaseRow } from '../employees.dto';
import type { AccountingApiDto, AccountingDatabaseRow, CurrencyApiDto, CurrencyDatabaseRow, CurrencyPriceApiDto, CurrencyPriceDatabaseRow, CustodyAdvanceApiDto, CustodyAdvanceDatabaseRow } from '../accounting.dto';
import type { AccountTransactionDatabaseRow, EntryPaymentDetailDatabaseRow, FinanceEntryDatabaseRow, FinanceEntryApiDto, FinanceEntryLineDto, FinanceEntryPaymentDetailDto } from '../finance-entries.dto';
import type { ConvertedAmount, CurrencyCode, OriginalAmount } from '../../../shared/contracts/value-primitives';
import type { ActivityLogApiDto, ActivityLogDatabaseRow, NotificationPayload, NotificationsApiDto, NotificationsDatabaseRow } from '../notifications.dto';
import type { ReportPrintTemplateData, ReportSettingsApiDto, ReportSettingsDatabaseRow, ReportTemplateApiDto, ReportTemplateDatabaseRow } from '../reports.dto';
import type { AnnouncementContent, JobApplicationData, JobRequestApiDto, JobRequestDatabaseRow, PortalTicketApiDto, PortalTicketDatabaseRow, SiteManagementApiDto, SiteManagementDatabaseRow } from '../site-management.dto';
import type { OrderOptionApiDto, OrderOptionDatabaseRow, OrderStatusApiDto, OrderStatusDatabaseRow, SettingsApiDto, SettingsDatabaseRow, SystemSettingsData, UserSettingsApiDto, UserSettingsDatabaseRow, WhatsAppSettingsApiDto, WhatsAppSettingsDatabaseRow } from '../settings.dto';

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))].sort() : [];
}

function safeRecord(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? value : {};
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function isoFromLegacy(value: unknown): ReturnType<typeof isoOrNull> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return isoOrNull(new Date(value).toISOString());
  }
  return typeof value === 'string' ? isoOrNull(value) : null;
}

function mapCustomerProfile(value: unknown): CustomerEntityData {
  const data = safeRecord(value);
  return {
    phone: textOrNull(data.phone),
    email: textOrNull(data.email),
    address: textOrNull(data.address),
    gpsLocation: textOrNull(data.gpsLocation) ?? textOrNull(data.gps_location),
    gps_location: textOrNull(data.gps_location) ?? textOrNull(data.gpsLocation),
    lat: numberOrNull(data.lat as number | string | null),
    lng: numberOrNull(data.lng as number | string | null),
    city: textOrNull(data.city),
    country: textOrNull(data.country),
    companyName: textOrNull(data.companyName) ?? textOrNull(data.company_name),
    company_name: textOrNull(data.company_name) ?? textOrNull(data.companyName),
    idNumber: textOrNull(data.idNumber) ?? textOrNull(data.id_number),
    id_number: textOrNull(data.id_number) ?? textOrNull(data.idNumber),
    maxDebt: numberOrNull((data.maxDebt ?? data.max_debt) as number | string | null),
    max_debt: numberOrNull((data.max_debt ?? data.maxDebt) as number | string | null),
    notes: textOrNull(data.notes),
    fullName: textOrNull(data.fullName),
    createdAt: typeof data.createdAt === 'string' || typeof data.createdAt === 'number' ? data.createdAt : null,
  };
}

export function mapAuthRowToDto(row: AuthDatabaseRow): AuthApiDto {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    deviceInfo: row.device_info,
    forceLogout: row.force_logout,
    createdAt: asIsoUtc(row.created_at),
    lastSeen: isoOrNull(row.last_seen),
    updatedAt: isoOrNull(row.updated_at),
  };
}

export function mapBrowserRowToDto(row: BrowserDatabaseRow): BrowserApiDto {
  const data = row.data as BrowserPageData;
  return {
    browserPageId: row.browser_page_id,
    name: data.name,
    url: data.url,
    tabColor: data.tabColor ?? null,
    isPinned: data.isPinned ?? false,
    sortOrder: data.sortOrder ?? null,
    viewMode: data.viewMode ?? null,
    autoLogin: data.autoLogin ?? false,
    category: data.category ?? null,
    sourceId: data.sourceId ?? null,
    hasSavedCredentials: Boolean(data.username || data.password),
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

export function mapUsersRowToDto(row: UsersDatabaseRow): UsersApiDto {
  return {
    userId: row.user_id,
    roleId: row.role,
    username: textOrNull(row.username),
    email: textOrNull(row.email),
    fullName: textOrNull(row.full_name),
    phone: textOrNull(row.phone),
    address: textOrNull(row.address),
    disabled: row.disabled,
    isRoot: row.is_root,
    linkedType: textOrNull(row.linked_type),
    linkedEntity: textOrNull(row.linked_entity),
    lastSeenAt: isoOrNull(row.last_seen),
    lastSeenLabel: textOrNull(row.last_seen_at),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapRolesRowToDto(row: RolesDatabaseRow): RolesApiDto {
  return {
    roleId: row.role_id,
    title: textOrNull(row.title),
    code: textOrNull(row.code),
    description: textOrNull(row.description),
    isDefault: row.is_default,
    permissions: stringList(row.permissions),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapCustomersRowToDto(
  row: CustomersDatabaseRow,
  details?: CustomerDetailsDatabaseRow | null,
  financialAccount?: CustomerFinancialSummary | null,
  portalUser?: PortalUserDatabaseRow | null,
): CustomersApiDto {
  const profile = { ...mapCustomerProfile(row.data), ...mapCustomerProfile(details?.data) };
  return {
    customerId: row.customer_id,
    fullName: textOrNull(row.full_name),
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    accountId: textOrNull(row.account_id),
    isActive: row.is_active,
    joinBy: textOrNull(row.join_by) ?? textOrNull(details?.join_by),
    referrerId: textOrNull(row.referrer_id) ?? textOrNull(details?.referrer_id),
    customerLevel: textOrNull(row.customer_level),
    profile,
    customerDetails: details ? {
      custDetailId: details.cust_detail_id,
      userUid: textOrNull(details.user_uid),
      customerId: textOrNull(details.customer_id),
      joinBy: textOrNull(details.join_by),
      referrerId: textOrNull(details.referrer_id),
      onboardingCompleted: details.onboarding_completed,
      createdAt: isoOrNull(details.created_at),
      updatedAt: isoOrNull(details.updated_at),
      createdBy: textOrNull(details.created_by),
      updatedBy: textOrNull(details.updated_by),
    } : null,
    portalAccount: portalUser ? mapPortalUserRowToDto(portalUser) : null,
    financialAccount: financialAccount ?? null,
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapPortalUserRowToDto(row: PortalUserDatabaseRow): PortalUserApiDto {
  const data = safeRecord(row.data);
  return {
    portalUserId: row.portal_user_id,
    username: textOrNull(row.username),
    email: textOrNull(row.email),
    portalRole: textOrNull(row.portal_role),
    approvalStatus: approvalStatusOrNull(row.approval_status),
    disabled: Boolean(row.disabled ?? row.is_disabled),
    linkedCustomerId: textOrNull(row.linked_customer_id),
    accountId: textOrNull(row.account_id),
    fullName: textOrNull(row.full_name) ?? textOrNull(data.fullName),
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    phone: textOrNull(data.phone),
    customerId: textOrNull(data.customerId) ?? textOrNull(row.linked_customer_id),
    hasPassword: typeof data.password === 'string' && data.password.length > 0,
    createdAt: isoFromLegacy(row.created_at ?? data.createdAt),
    updatedAt: isoFromLegacy(row.updated_at ?? data.updatedAt),
  };
}

function mapOrderSupplementalData(value: unknown): OrderSupplementalData {
  const data = safeRecord(value);
  return {
    customerName: textOrNull(data.customerName),
    recipientName: textOrNull(data.recipientName),
    customerPhone: textOrNull(data.customerPhone),
    deliveryCity: textOrNull(data.deliveryCity),
    orderSourceName: textOrNull(data.orderSourceName),
    totalPrice: numberOrNull(data.totalPrice as number | string | null),
    status: textOrNull(data.status),
    notes: textOrNull(data.notes),
    totalAmount: numberOrNull(data.totalAmount as number | string | null),
    currency: textOrNull(data.currency),
    orderCurrency: textOrNull(data.orderCurrency),
    paidCurrency: textOrNull(data.paidCurrency),
    exchangeRate: numberOrNull(data.exchangeRate as number | string | null),
    exchangeRateYER: numberOrNull(data.exchangeRateYER as number | string | null),
    exchangeRateUSD: numberOrNull(data.exchangeRateUSD as number | string | null),
    bankCommissionRate: numberOrNull(data.bankCommissionRate as number | string | null),
    bankCommissionType: textOrNull(data.bankCommissionType),
    companyProfitRate: numberOrNull(data.companyProfitRate as number | string | null),
    packagingFee: numberOrNull(data.packagingFee as number | string | null),
    sheinRedPrice: numberOrNull(data.sheinRedPrice as number | string | null),
    cartShareCode: textOrNull(data.cartShareCode),
    bankCommissionEnabled: nullableBoolean(data.bankCommissionEnabled),
    couponEnabled: nullableBoolean(data.couponEnabled),
    couponRate: numberOrNull(data.couponRate as number | string | null),
    couponValue: numberOrNull(data.couponValue as number | string | null),
    productsSum: numberOrNull(data.productsSum as number | string | null),
    packagingFeeEnabled: nullableBoolean(data.packagingFeeEnabled),
    packagingFeeRate: numberOrNull(data.packagingFeeRate as number | string | null),
    totalWeight: numberOrNull(data.totalWeight as number | string | null),
    totalCBM: numberOrNull(data.totalCBM as number | string | null),
    totalCostSAR: numberOrNull(data.totalCostSAR as number | string | null),
    totalCostYER: numberOrNull(data.totalCostYER as number | string | null),
    amountPaid: numberOrNull(data.amountPaid as number | string | null),
    amountRemaining: numberOrNull(data.amountRemaining as number | string | null),
    paymentStatus: paymentStatusOrNull(data.paymentStatus),
    homeDeliveryEnabled: nullableBoolean(data.homeDeliveryEnabled),
    viaShippingAgent: nullableBoolean(data.viaShippingAgent),
    payLater: nullableBoolean(data.payLater),
    directApprove: nullableBoolean(data.directApprove),
    paymentMethod: textOrNull(data.paymentMethod),
    cashAccountId: textOrNull(data.cashAccountId),
    bankAccountId: textOrNull(data.bankAccountId),
    bankReference: textOrNull(data.bankReference),
    cashAmount: numberOrNull(data.cashAmount as number | string | null),
    bankAmount: numberOrNull(data.bankAmount as number | string | null),
    profitPerKgRate: numberOrNull(data.profitPerKgRate as number | string | null),
    cbmShippingRateValue: numberOrNull(data.cbmShippingRateValue as number | string | null),
    addShippingEnabled: nullableBoolean(data.addShippingEnabled),
    shippingCostSAR: numberOrNull(data.shippingCostSAR as number | string | null),
    shippingCourierFeeRate: numberOrNull(data.shippingCourierFeeRate as number | string | null),
    profitSaudiSAR: numberOrNull(data.profitSaudiSAR as number | string | null),
    profitCompanySAR: numberOrNull(data.profitCompanySAR as number | string | null),
    deductSourcingCostFromCourier: nullableBoolean(data.deductSourcingCostFromCourier),
    sourcing_cost: textOrNull(data.sourcing_cost),
    sourcingCostAmount: numberOrNull(data.sourcingCostAmount as number | string | null),
    orderStatus: orderStatusOrNull(data.orderStatus),
    deliveryStatus: textOrNull(data.deliveryStatus),
    locationYemen: textOrNull(data.locationYemen),
    firedTriggers: Array.isArray(data.firedTriggers) ? data.firedTriggers.filter((item): item is string => typeof item === 'string') : null,
    shippingCompany: textOrNull(data.shippingCompany),
    externalOrderNumber: textOrNull(data.externalOrderNumber),
    deliveryCourierFee: numberOrNull(data.deliveryCourierFee as number | string | null),
    deliveryCourierFeeCurrency: textOrNull(data.deliveryCourierFeeCurrency),
    deliveryCourierFeeOrderCurrency: numberOrNull(data.deliveryCourierFeeOrderCurrency as number | string | null),
    productInsuranceFee: numberOrNull(data.productInsuranceFee as number | string | null),
    product_insurance_fee: numberOrNull(data.product_insurance_fee as number | string | null),
    orderDate: typeof data.orderDate === 'string' || typeof data.orderDate === 'number' ? data.orderDate : null,
    createdAt: typeof data.createdAt === 'string' || typeof data.createdAt === 'number' ? data.createdAt : null,
  };
}

export function mapOrdersRowToDto(row: OrdersDatabaseRow, related: OrderRelatedData = {}): OrderApiDto {
  const data = safeRecord(row.data);
  const orderData = mapOrderSupplementalData(data);
  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    trackingNumber: textOrNull(row.tracking_number),
    customerId: textOrNull(row.customer_id),
    orderStatusId: textOrNull(row.order_status_id),
    orderSourceId: textOrNull(row.order_source_id),
    orderSourceType: textOrNull(row.order_source_type),
    deliveryCourierId: textOrNull(row.delivery_courier_id),
    shippingCourierId: textOrNull(row.shipping_courier_id),
    orderPartyId: textOrNull(row.order_party_id),
    orderPartyType: row.order_party_type,
    isStaffOrder: row.is_staff_order,
    employeeId: textOrNull(row.employee_id),
    courierId: textOrNull(row.courier_id),
    orderPartyAccountId: textOrNull(row.order_party_account_id),
    createdByName: textOrNull(row.created_by_name),
    totalAmount: amountOrNull(orderData.totalAmount ?? orderData.totalPrice),
    totalPrice: amountOrNull(orderData.totalPrice ?? orderData.totalAmount),
    currency: currencyCodeOrNull(orderData.currency ?? orderData.orderCurrency),
    notes: orderData.notes ?? null,
    paymentStatus: paymentStatusOrNull(orderData.paymentStatus),
    status: orderStatusOrNull(orderData.status ?? orderData.orderStatus),
    orderDate: isoFromLegacy(orderData.orderDate ?? orderData.createdAt),
    orderData,
    customerName: textOrNull(related.customerName) ?? orderData.customerName ?? null,
    recipientName: orderData.recipientName ?? null,
    customerPhone: textOrNull(related.customerPhone) ?? orderData.customerPhone ?? null,
    deliveryCity: orderData.deliveryCity ?? null,
    orderSourceName: textOrNull(related.orderSourceName) ?? orderData.orderSourceName ?? null,
    orderParty: related.orderParty ?? null,
    items: related.items ?? [],
    shipments: related.shipments ?? [],
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapProductsRowToDto(row: ProductsDatabaseRow): ProductsApiDto {
  return {
    productId: row.product_id,
    nameAr: textOrNull(row.product_name_ar),
    nameEn: textOrNull(row.product_name_en),
    url: textOrNull(row.product_url),
    priceCurrencyId: row.product_price_currency,
    unitPrice: amountOrNull(row.unit_price),
    categoryId: textOrNull(row.item_category_id),
    isAllowed: row.is_allowed,
    cbm: numberOrNull(row.cbm),
    width: numberOrNull(row.width),
    height: numberOrNull(row.height),
    length: numberOrNull(row.length),
    weight: numberOrNull(row.weight),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapProductCategoryRowToDto(row: ProductCategoryDatabaseRow): ProductCategoryApiDto {
  return {
    categoryId: row.items_category_id,
    code: textOrNull(row.code),
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    description: textOrNull(row.description),
    hsCodeHint: textOrNull(row.hs_code_hint),
    customsPerCarton: amountOrNull(row.customs_per_carton),
    taxPerCarton: amountOrNull(row.tax_per_carton),
    otherFeesPerCarton: amountOrNull(row.other_fees_per_carton),
    customsRate: numberOrNull(row.customs_rate),
    taxRate: numberOrNull(row.tax_rate),
    feeCurrency: currencyCodeOrNull(row.fee_currency),
    requiresReview: row.requires_review,
    isActive: row.is_active,
    details: safeRecord(row.details),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapOrderItemRowToDto(row: OrderItemDatabaseRow): OrderItemApiDto {
  return {
    orderItemId: row.order_item_id,
    orderId: row.order_id,
    productId: textOrNull(row.product_id),
    productPrice: amountOrNull(row.product_price),
    productUrl: textOrNull(row.product_url),
    trackingNumber: textOrNull(row.tracking_number),
    sourceId: textOrNull(row.produc_source_id),
    sourceUrl: textOrNull(row.produc_source_url),
    cooler: textOrNull(row.product_cooler),
    note: textOrNull(row.nota),
    quantity: numberOrNull(row.quantity) ?? 0,
    totalPrice: amountOrNull(row.total_price),
    totalWeight: numberOrNull(row.total__weight),
    totalCbm: numberOrNull(row.total_cbm),
    packagingOptionId: textOrNull(row.packaging_option_id),
    packagingOptionPrice: amountOrNull(row.packaging_option_price),
    isInsured: row.is_insured,
    insuranceFee: amountOrNull(row.insurance_fee),
    status: textOrNull(row.items_status),
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapReturnedProductRowToDto(row: ReturnedProductDatabaseRow): ReturnedProductApiDto {
  return {
    returnId: row.return_id,
    orderId: row.order_id,
    orderItemId: textOrNull(row.order_item_id),
    productId: textOrNull(row.product_id),
    customerId: textOrNull(row.customer_id),
    customerName: textOrNull(row.customer_name),
    productName: textOrNull(row.product_name),
    productUrl: textOrNull(row.product_url),
    quantity: row.quantity,
    reason: textOrNull(row.return_reason),
    type: textOrNull(row.return_type),
    status: row.return_status,
    condition: textOrNull(row.return_condition),
    refundAmount: amountOrNull(row.refund_amount),
    refundCurrency: currencyCodeOrNull(row.refund_currency),
    isInsured: row.is_insured,
    insuranceRefund: amountOrNull(row.insurance_refund),
    notes: textOrNull(row.notes),
    returnedAt: isoOrNull(row.returned_at),
    processedBy: textOrNull(row.processed_by),
    processedAt: isoOrNull(row.processed_at),
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapSourcesRowToDto(row: SourcesDatabaseRow): SourcesApiDto {
  return {
    sourceId: row.source_id,
    name: textOrNull(row.name),
    type: textOrNull(row.type),
    sourceUrl: textOrNull(row.source_url),
    accountId: textOrNull(row.account_id),
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapShippingCompanyRowToDto(row: ShippingCompanyDatabaseRow): ShippingCompanyApiDto {
  return {
    shippingCompanyId: row.shipping_company_id,
    name: textOrNull(row.name),
    url: textOrNull(row.shipping_company_url),
    trackingIdPrefix: textOrNull(row.tracking_id_prefix),
    accountId: textOrNull(row.account_id),
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

export function mapAssetRowToDto(row: AssetDatabaseRow): AssetApiDto {
  return {
    assetId: row.asset_id,
    assetCode: textOrNull(row.asset_code),
    accountId: textOrNull(row.account_id),
    status: textOrNull(row.status),
    currency: textOrNull(row.currency),
    isActive: row.is_active,
    type: textOrNull(row.type),
    accountCode: textOrNull(row.account_code),
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

export function mapShipmentsRowToDto(row: ShipmentDatabaseRow): ShipmentsApiDto {
  const data = safeRecord(row.data);
  return {
    shipmentId: row.shipment_id,
    orderId: row.order_id,
    trackingNumber: textOrNull(row.tracking_number),
    shippingCompanyId: textOrNull(row.shipping_company_id),
    courierId: textOrNull(row.courier_id),
    status: shipmentStatusOrNull(row.shipment_status),
    shippingCost: numberOrNull(row.shipping_cost),
    weight: numberOrNull(row.weight),
    shippingCategoryId: textOrNull(row.shipping_category_id),
    contentCategoryId: textOrNull(row.content_category_id),
    contentCategoryName: textOrNull(row.content_category_name),
    cartonCount: numberOrNull(row.carton_count),
    customsFee: numberOrNull(row.customs_fee),
    taxFee: numberOrNull(row.tax_fee),
    otherCategoryFee: numberOrNull(row.other_category_fee),
    categoryFeesTotal: numberOrNull(row.category_fees_total),
    categoryFeeCurrency: textOrNull(row.category_fee_currency),
    shipmentData: {
      shippingType: textOrNull(data.shippingType),
      shippingSource: textOrNull(data.shippingSource),
      shippingDestination: textOrNull(data.shippingDestination),
      packagingFees: numberOrNull(data.packagingFees as number | string | null),
      shippingDate: isoDateOrNull(data.shippingDate),
      shippingDuration: textOrNull(data.shippingDuration),
      expectedArrival: isoDateOrNull(data.expectedArrival),
      deliveryDate: isoDateOrNull(data.deliveryDate),
      notes: textOrNull(data.notes),
      shippingCategoryName: textOrNull(data.shippingCategoryName),
      shippingCategoryPrice: numberOrNull(data.shippingCategoryPrice as number | string | null),
    },
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapCouriersRowToDto(row: CouriersDatabaseRow, profile: CourierProfile | null = null): CouriersApiDto {
  return {
    courierId: row.courier_id,
    fullName: textOrNull(row.full_name),
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    accountId: textOrNull(row.account_id),
    currency: textOrNull(row.currency),
    isActive: row.is_active,
    type: textOrNull(row.courier_type),
    level: textOrNull(row.courier_level),
    commissionRate: numberOrNull(row.commission_rate),
    profile,
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapEmployeesRowToDto(row: EmployeesDatabaseRow): EmployeesApiDto {
  return {
    employeeId: row.employee_id,
    accountId: textOrNull(row.account_id),
    monthlySalary: numberOrNull(row.monthly_salary),
    currency: textOrNull(row.currency),
    fullName: textOrNull(row.full_name),
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    jobType: textOrNull(row.job_type),
    commissionRate: numberOrNull(row.commission_rate),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapAccountingRowToDto(row: AccountingDatabaseRow, currencyCode?: string | null): AccountingApiDto {
  return {
    accountId: row.account_id,
    accountCode: textOrNull(row.account_code),
    accountNumber: textOrNull(row.account_number),
    accountPrefix: textOrNull(row.account_prefix),
    nameAr: textOrNull(row.acc_name_ar),
    nameEn: textOrNull(row.acc_name_en),
    type: row.type,
    entityId: textOrNull(row.entity_id),
    entityType: textOrNull(row.entity_type),
    entityName: textOrNull(row.entity_name),
    parentCode: textOrNull(row.parent_code),
    subAccountId: textOrNull(row.acc_sub_id),
    groupId: textOrNull(row.group_id),
    sequence: row.account_seq,
    currencyId: row.cur_no,
    currencyCode: currencyCodeOrNull(currencyCode ?? row.currency),
    balance: numberOrNull(row.balance) ?? 0,
    debitTotal: numberOrNull(row.debit_total) ?? 0,
    creditTotal: numberOrNull(row.credit_total) ?? 0,
    limitedBalance: numberOrNull(row.limited_balance) ?? 0,
    monthlySalary: numberOrNull(row.monthly_salary),
    isActive: row.is_active,
    notes: textOrNull(row.notes),
    lastRecalculatedAt: isoOrNull(row.last_recalculated_at),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapCurrencyRowToDto(row: CurrencyDatabaseRow): CurrencyApiDto {
  return {
    currencyId: row.cur_id,
    code: currencyCodeOrNull(row.code) ?? (row.code as CurrencyCode),
    nameAr: textOrNull(row.main_name_ar),
    subNameAr: textOrNull(row.sub_name_ar),
    nameEn: textOrNull(row.main_name_en),
    subNameEn: textOrNull(row.sub_name_en),
    symbol: textOrNull(row.symbol),
    flag: textOrNull(row.flag),
    isDefault: row.is_default,
    isActive: row.is_active,
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

export function mapCurrencyPriceRowToDto(row: CurrencyPriceDatabaseRow): CurrencyPriceApiDto {
  return {
    priceId: row.cur_price_id,
    currencyId: row.cur_no,
    price: numberOrNull(row.price) ?? 0,
    dayDate: asIsoUtc(row.day_date),
    sequence: row.seq,
  };
}

export function mapCustodyAdvanceRowToDto(row: CustodyAdvanceDatabaseRow): CustodyAdvanceApiDto {
  return {
    custodyAdvanceId: row.custody_advance_id,
    custodyNumber: textOrNull(row.custody_number),
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    recipientName: textOrNull(row.recipient_name),
    recipientAccountId: textOrNull(row.recipient_account_id),
    amountOriginal: originalAmountOrNull(row.amount_original) ?? (0 as OriginalAmount),
    currencyOriginalId: row.currency_original_no,
    amountSettled: originalAmountOrNull(row.amount_settled) ?? (0 as OriginalAmount),
    amountOutstanding: originalAmountOrNull(row.amount_outstanding) ?? (0 as OriginalAmount),
    status: row.status,
    issuedEntryId: textOrNull(row.issued_entry_id),
    settlementEntryId: textOrNull(row.settlement_entry_id),
    note: textOrNull(row.note),
    issuedAt: isoOrNull(row.issued_at),
    issuedByUserId: textOrNull(row.issued_by_uid),
    settledAt: isoOrNull(row.settled_at),
    settledByUserId: textOrNull(row.settled_by_uid),
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

export function mapAccountTransactionRowToDto(row: AccountTransactionDatabaseRow): FinanceEntryLineDto {
  return {
    transactionId: row.account_trans_id,
    lineNumber: row.line_no,
    direction: row.trans_type,
    accountId: row.account_id,
    accountCurrencyId: row.account_cur_no,
    amount: convertedAmountOrNull(row.amount) ?? (0 as ConvertedAmount),
    originalAmount: originalAmountOrNull(row.amount_original),
    originalCurrencyId: row.currency_original_no,
    conversionRate: exchangeRateOrNull(row.conversion_rate),
    entityType: textOrNull(row.entity_type),
    entityId: textOrNull(row.entity_id),
    paymentMethod: textOrNull(row.payment_method),
    description: textOrNull(row.description),
    note: textOrNull(row.note),
  };
}

export function mapEntryPaymentDetailRowToDto(row: EntryPaymentDetailDatabaseRow): FinanceEntryPaymentDetailDto {
  return {
    paymentDetailId: row.entry_payment_detail_id,
    allocationNumber: row.allocation_no,
    paymentMethod: row.payment_method,
    accountId: textOrNull(row.account_id),
    originalAmount: originalAmountOrNull(row.amount_original) ?? (0 as OriginalAmount),
    originalCurrencyId: row.currency_original_no,
    bankReference: textOrNull(row.bank_reference),
    dueAt: isoOrNull(row.due_at),
    note: textOrNull(row.note),
  };
}

export function mapFinanceEntryRowToDto(
  row: FinanceEntryDatabaseRow,
  lines: FinanceEntryLineDto[] = [],
  paymentDetails: FinanceEntryPaymentDetailDto[] = [],
): FinanceEntryApiDto {
  return {
    entryId: row.main_entry_id,
    entryNumber: textOrNull(row.entry_number),
    moduleId: textOrNull(row.module_id),
    entryTypeId: textOrNull(row.entry_type_id),
    category: textOrNull(row.entry_category),
    postingStatus: postingStatusOrNull(row.posting_status),
    description: textOrNull(row.description),
    notes: textOrNull(row.notes),
    attachments: row.attachments ?? [],
    paymentMethod: textOrNull(row.payment_method),
    orderId: textOrNull(row.order_id),
    shipmentId: textOrNull(row.shipment_id),
    custodyId: textOrNull(row.custody_id),
    automationKey: textOrNull(row.automation_key),
    autoRuleId: textOrNull(row.auto_rule_id),
    isAutomatic: row.is_automatic,
    reversesEntryId: textOrNull(row.reverses_entry_id),
    effectiveAt: isoOrNull(row.effective_at),
    postedAt: isoOrNull(row.posted_at),
    voidedAt: isoOrNull(row.voided_at),
    postedByUserId: textOrNull(row.posted_by_uid),
    voidedByUserId: textOrNull(row.voided_by_uid),
    lines,
    paymentDetails,
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

function mapNotificationPayload(value: unknown): NotificationPayload {
  const data = safeRecord(value);
  return {
    title: textOrNull(data.title),
    message: textOrNull(data.message),
    link: textOrNull(data.link),
    orderId: textOrNull(data.orderId),
    userId: textOrNull(data.userId),
    associatedUserIds: stringList(data.associatedUserIds),
    isPublic: nullableBoolean(data.isPublic),
    read: nullableBoolean(data.read),
    category: textOrNull(data.category),
    type: textOrNull(data.type),
    creatorId: textOrNull(data.creatorId),
    creatorName: textOrNull(data.creatorName),
  };
}

export function mapNotificationsRowToDto(row: NotificationsDatabaseRow): NotificationsApiDto {
  const payload = mapNotificationPayload(row.data);
  return {
    notificationId: row.notification_id,
    userId: textOrNull(row.user_id),
    category: textOrNull(row.category),
    isPublic: row.is_public,
    read: row.read,
    type: textOrNull(row.type),
    title: payload.title ?? null,
    message: payload.message ?? null,
    link: payload.link ?? null,
    orderId: payload.orderId ?? null,
    associatedUserIds: payload.associatedUserIds ?? [],
    creatorId: payload.creatorId ?? null,
    creatorName: payload.creatorName ?? null,
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapActivityLogRowToDto(row: ActivityLogDatabaseRow): ActivityLogApiDto {
  const data = safeRecord(row.data);
  return {
    activityLogId: row.activity_log_id,
    userId: textOrNull(row.user_id),
    userName: textOrNull(data.userName),
    userRole: textOrNull(data.userRole),
    action: textOrNull(row.action),
    category: textOrNull(row.category),
    target: textOrNull(row.target),
    type: textOrNull(row.type),
    details: safeRecord(data.details),
    eventAt: isoFromLegacy(data.timestamp) ?? isoOrNull(row.created_at),
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapReportsRowToDto(row: ReportTemplateDatabaseRow): ReportTemplateApiDto {
  const data = safeRecord(row.data);
  const template: ReportPrintTemplateData | null = Object.keys(data).length ? {
    headerTitleAr: String(data.headerTitleAr ?? ''),
    headerTitleEn: String(data.headerTitleEn ?? ''),
    subtitleAr: String(data.subtitleAr ?? ''),
    subtitleEn: String(data.subtitleEn ?? ''),
    footerTextAr: String(data.footerTextAr ?? ''),
    footerTextEn: String(data.footerTextEn ?? ''),
    logoUrl: String(data.logoUrl ?? ''),
    showLogo: booleanOrDefault(data.showLogo, true),
    paperSize: data.paperSize === 'A4_Landscape' || data.paperSize === '80mm' || data.paperSize === '58mm' ? data.paperSize : 'A4',
    margins: data.margins === 'none' || data.margins === 'minimal' ? data.margins : 'default',
    fontSize: data.fontSize === 'xs' || data.fontSize === 'md' || data.fontSize === 'lg' ? data.fontSize : 'sm',
    showBarcode: booleanOrDefault(data.showBarcode),
    showSignatures: booleanOrDefault(data.showSignatures),
    showDateTime: booleanOrDefault(data.showDateTime),
    showTaxId: booleanOrDefault(data.showTaxId),
    taxNumber: String(data.taxNumber ?? ''),
    primaryColor: String(data.primaryColor ?? ''),
    fontFamily: data.fontFamily === 'Cairo' || data.fontFamily === 'Inter' || data.fontFamily === 'JetBrains Mono' || data.fontFamily === 'Segoe UI' ? data.fontFamily : undefined,
    signature1Ar: textOrNull(data.signature1Ar) ?? undefined,
    signature1En: textOrNull(data.signature1En) ?? undefined,
    signature2Ar: textOrNull(data.signature2Ar) ?? undefined,
    signature2En: textOrNull(data.signature2En) ?? undefined,
    signature3Ar: textOrNull(data.signature3Ar) ?? undefined,
    signature3En: textOrNull(data.signature3En) ?? undefined,
    tableStyle: data.tableStyle === 'dashed' || data.tableStyle === 'minimal' ? data.tableStyle : 'solid',
  } : null;
  return {
    reportTemplateId: row.report_template_id,
    template,
    createdBy: textOrNull(row.created_by),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapReportSettingsRowToDto(row: ReportSettingsDatabaseRow): ReportSettingsApiDto {
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(safeRecord(row.exchange_rates))) {
    const rate = numberOrNull(value as number | string | null);
    if (rate !== null) rates[code] = rate;
  }
  return {
    reportSettingId: row.report_setting_id,
    defaultCurrency: textOrNull(row.default_currency),
    alternativeCurrency: textOrNull(row.alternative_currency),
    exchangeRates: rates,
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

function mapAnnouncementContent(value: unknown): AnnouncementContent {
  const data = safeRecord(value);
  return {
    content: textOrNull(data.content),
    body: textOrNull(data.body),
    bodyAr: textOrNull(data.bodyAr),
    bodyEn: textOrNull(data.bodyEn),
    imageUrl: textOrNull(data.imageUrl),
    actionUrl: textOrNull(data.actionUrl),
    targetAudience: textOrNull(data.targetAudience) ?? textOrNull(data.target_audience),
    target_audience: textOrNull(data.target_audience) ?? textOrNull(data.targetAudience),
    priority: textOrNull(data.priority),
    isActive: nullableBoolean(data.isActive ?? data.is_active),
    is_active: nullableBoolean(data.is_active ?? data.isActive),
    createdAt: typeof data.createdAt === 'string' || typeof data.createdAt === 'number' ? data.createdAt : null,
    created_at: typeof data.created_at === 'string' || typeof data.created_at === 'number' ? data.created_at : null,
    updatedAt: typeof data.updatedAt === 'string' || typeof data.updatedAt === 'number' ? data.updatedAt : null,
  };
}

export function mapSiteManagementRowToDto(row: SiteManagementDatabaseRow): SiteManagementApiDto {
  return {
    announcementId: row.announcement_id,
    title: textOrNull(row.title),
    content: mapAnnouncementContent(row.data),
    isActive: row.is_active,
    priority: row.priority,
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapJobRequestRowToDto(row: JobRequestDatabaseRow): JobRequestApiDto {
  const data = safeRecord(row.data);
  const application: JobApplicationData = {
    fullName: textOrNull(data.fullName),
    email: textOrNull(data.email) ?? textOrNull(row.email),
    phone: textOrNull(data.phone) ?? textOrNull(row.phone),
    jobPosition: textOrNull(data.jobPosition),
    experienceYears: numberOrNull(data.experienceYears as number | string | null),
    idNumber: textOrNull(data.idNumber),
    qualification: textOrNull(data.qualification),
    city: textOrNull(data.city),
    address: textOrNull(data.address),
    notes: textOrNull(data.notes),
    refCode: textOrNull(data.refCode) ?? textOrNull(row.ref_code),
    status: textOrNull(data.status) ?? row.status,
    createdAt: typeof data.createdAt === 'string' || typeof data.createdAt === 'number' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' || typeof data.updatedAt === 'number' ? data.updatedAt : null,
  };
  return {
    jobRequestId: row.jobs_req_id,
    email: textOrNull(row.email) ?? application.email ?? null,
    phone: textOrNull(row.phone) ?? application.phone ?? null,
    status: row.status,
    category: textOrNull(row.category),
    referenceCode: textOrNull(row.ref_code),
    application,
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapPortalTicketRowToDto(row: PortalTicketDatabaseRow): PortalTicketApiDto {
  const data = safeRecord(row.data);
  const replies = Array.isArray(data.replies) ? data.replies.flatMap((value) => {
    const reply = safeRecord(value);
    const id = textOrNull(reply.id);
    const message = textOrNull(reply.message);
    if (!id || !message) return [];
    return [{
      id,
      sender: textOrNull(reply.sender),
      message,
      createdAt: typeof reply.createdAt === 'string' || typeof reply.createdAt === 'number' ? reply.createdAt : null,
    }];
  }) : undefined;
  return {
    portalTicketId: row.portal_ticket_id,
    type: textOrNull(row.type),
    status: row.status,
    portalUserId: textOrNull(row.user_uid),
    ticket: {
      subject: textOrNull(data.subject),
      userName: textOrNull(data.userName),
      userEmail: textOrNull(data.userEmail),
      message: textOrNull(data.message),
      replies: replies ?? null,
      createdAt: typeof data.createdAt === 'string' || typeof data.createdAt === 'number' ? data.createdAt : null,
      updatedAt: typeof data.updatedAt === 'string' || typeof data.updatedAt === 'number' ? data.updatedAt : null,
    },
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

const SYSTEM_SETTING_KEYS = [
  'language','theme','fontSize','systemName','systemLogo','orderPrefix','orderStartNumber',
  'companyName','companyPhone','companyEmail','companyWebsite','companyAddress','taxId','invoiceLogo','invoiceNotes',
  'currency','currencySymbol','exchangeRateUSD','exchangeRateSAR','autoUpdateExchangeRates','exchangeRatesApiUrl',
  'lastExchangeRateUpdate','lastExchangeRateUpdateTime','lastExchangeRateUpdatedBy','customCurrencies',
  'defaultPackagingFee','defaultBankCommissionRate','defaultCompanyProfitRate','defaultDeliveryFee','defaultCourierCommissionRate',
  'defaultOrderCurrency','defaultProductInsuranceFee','defaultProductInsuranceType','defaultSheinDuration','defaultAppDuration',
  'defaultFactoryDuration','defaultYemenDeliveryDuration','defaultShippingDuration','defaultProfitPerKg','cbmShippingRate',
  'cbmShippingRateApiUrl','lastCbmRateUpdate','lastCbmRateUpdatedBy','protectSensitiveOrderDelete','userSessionTimeout',
  'autoBackupEnabled','backupSchedule','backupRetentionDays','backupCollections','backupEncrypted','lastBackup',
  'lastAutoBackupAt','backupCount','autoNotification','dashboardGridColumns','visibleMetrics',
] as const satisfies readonly (keyof SystemSettingsData)[];

function projectSettings(value: unknown): SystemSettingsData {
  const source = safeRecord(value);
  const result: Record<string, unknown> = {};
  for (const key of SYSTEM_SETTING_KEYS) {
    if (key in source) result[key] = source[key];
  }
  return result as unknown as SystemSettingsData;
}

export function mapSettingsRowToDto(row: SettingsDatabaseRow): SettingsApiDto {
  return {
    settingId: row.setting_id,
    category: textOrNull(row.category),
    settings: projectSettings(row.data),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapWhatsAppSettingsRowToDto(row: WhatsAppSettingsDatabaseRow): WhatsAppSettingsApiDto {
  const data = safeRecord(row.data);
  const config = safeRecord(data.config);
  const triggers = safeRecord(data.triggers);
  const templates = safeRecord(data.templates);
  const provider = data.provider === 'twilio' || data.provider === 'custom' ? data.provider : 'ultramsg';
  return {
    enabled: booleanOrDefault(data.enabled),
    provider,
    credentials: {
      hasToken: typeof config.token === 'string' && config.token.length > 0,
      hasInstanceId: typeof config.instanceId === 'string' && config.instanceId.length > 0,
      hasAccountSid: typeof config.accountSid === 'string' && config.accountSid.length > 0,
      sender: textOrNull(config.sender),
      hasCustomUrl: typeof config.customUrl === 'string' && config.customUrl.length > 0,
      hasCustomHeaders: typeof config.customHeaders === 'string' && config.customHeaders.length > 0,
      hasCustomBody: typeof config.customBody === 'string' && config.customBody.length > 0,
    },
    triggers: {
      onOrderCreated: booleanOrDefault(triggers.onOrderCreated),
      onOrderStatusChanged: booleanOrDefault(triggers.onOrderStatusChanged),
      onPaymentReceived: booleanOrDefault(triggers.onPaymentReceived),
    },
    templates: {
      onOrderCreated: textOrNull(templates.onOrderCreated) ?? '',
      onOrderStatusChanged: textOrNull(templates.onOrderStatusChanged) ?? '',
      onPaymentReceived: textOrNull(templates.onPaymentReceived) ?? '',
    },
  };
}

export function mapUserSettingsRowToDto(row: UserSettingsDatabaseRow): UserSettingsApiDto {
  const source = safeRecord(row.data);
  return {
    userSettingId: row.user_setting_id,
    userId: textOrNull(row.user_id),
    settings: {
      language: source.language === 'ar' || source.language === 'en' ? source.language : undefined,
      theme: source.theme === 'light' || source.theme === 'dark' ? source.theme : undefined,
      fontSize: source.fontSize === 'sm' || source.fontSize === 'md' || source.fontSize === 'lg' || source.fontSize === 'xl' ? source.fontSize : undefined,
      dashboardGridColumns: numberOrNull(source.dashboardGridColumns as number | string | null) ?? undefined,
      visibleMetrics: stringList(source.visibleMetrics),
    },
    createdAt: asIsoUtc(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

export function mapOrderStatusRowToDto(row: OrderStatusDatabaseRow): OrderStatusApiDto {
  const data = safeRecord(row.data);
  return {
    orderStatusId: row.order_status_id,
    nameAr: row.name_ar,
    nameEn: textOrNull(row.name_en),
    isFirst: row.is_first,
    isLast: row.is_last,
    sortOrder: row.sort_order,
    color: textOrNull(row.color),
    code: textOrNull(row.code),
    description: textOrNull(data.description),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}

export function mapOrderOptionRowToDto(row: OrderOptionDatabaseRow): OrderOptionApiDto {
  return {
    orderOptionId: row.order_option_id,
    type: row.type,
    nameAr: textOrNull(row.name_ar),
    nameEn: textOrNull(row.name_en),
    price: numberOrNull(row.price),
    duration: row.duration,
    details: textOrNull(row.details),
    code: textOrNull(row.code),
    isActive: row.is_active,
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: textOrNull(row.created_by),
    updatedBy: textOrNull(row.updated_by),
  };
}
