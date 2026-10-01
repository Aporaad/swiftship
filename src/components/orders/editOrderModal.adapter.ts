export type EditOrderRow = Record<string, unknown>;

export interface EditOrderSnapshot {
  id: string;
  orderNumber?: string;
  orderCurrency?: string;
  currency?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  orderPartyId?: string;
  orderPartyType?: string;
  isStaffOrder?: boolean;
  employeeId?: string;
  courierId?: string;
  order_party_account_id?: string;
  orderPartyAccountId?: string;
  orderSourceId?: string;
  orderSourceName?: string;
  orderSourceType?: string;
  externalOrderNumber?: string;
  trackingNumber?: string;
  shippingCompany?: string;
  shippingCourierId?: string;
  deliveryCourierId?: string;
  deliveryCourierFee?: number;
  deliveryCourierFeeCurrency?: string;
  exchangeRateYER?: number;
  exchangeRateUSD?: number;
  bankCommissionRate?: number;
  companyProfitRate?: number;
  packagingFee?: number;
  sheinRedPrice?: number;
  amountPaid?: number;
  paymentMethod?: string;
  cashAccountId?: string;
  cash_account_id?: string;
  bankAccountId?: string;
  bank_account_id?: string;
  bankReference?: string;
  bank_reference?: string;
  cashAmount?: number;
  cash_amount?: number;
  bankAmount?: number;
  bank_amount?: number;
  notes?: string;
  createdByName?: string;
  created_by_name?: string;
  items: EditOrderRow[];
  shippingDetails: EditOrderRow[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  return typeof record[key] === 'boolean' ? record[key] : undefined;
}

function readRows(value: unknown): EditOrderRow[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function adaptEditOrderSnapshot(value: unknown): EditOrderSnapshot | null {
  const record = asRecord(value);
  const id = readString(record, 'id', 'order_id');
  if (!id) return null;

  return {
    id,
    orderNumber: readString(record, 'orderNumber', 'order_number'),
    orderCurrency: readString(record, 'orderCurrency', 'order_currency'),
    currency: readString(record, 'currency'),
    customerId: readString(record, 'customerId', 'customer_id'),
    customerName: readString(record, 'customerName', 'customer_name'),
    customerPhone: readString(record, 'customerPhone', 'customer_phone'),
    customerAddress: readString(record, 'customerAddress', 'customer_address'),
    orderPartyId: readString(record, 'orderPartyId', 'order_party_id'),
    orderPartyType: readString(record, 'orderPartyType', 'order_party_type'),
    isStaffOrder: readBoolean(record, 'isStaffOrder'),
    employeeId: readString(record, 'employeeId', 'employee_id'),
    courierId: readString(record, 'courierId', 'courier_id'),
    order_party_account_id: readString(record, 'order_party_account_id'),
    orderPartyAccountId: readString(record, 'orderPartyAccountId'),
    orderSourceId: readString(record, 'orderSourceId', 'order_source_id'),
    orderSourceName: readString(record, 'orderSourceName', 'order_source_name'),
    orderSourceType: readString(record, 'orderSourceType', 'order_source_type'),
    externalOrderNumber: readString(record, 'externalOrderNumber', 'external_order_number'),
    trackingNumber: readString(record, 'trackingNumber', 'tracking_number'),
    shippingCompany: readString(record, 'shippingCompany', 'shipping_company'),
    shippingCourierId: readString(record, 'shippingCourierId', 'shipping_courier_id'),
    deliveryCourierId: readString(record, 'deliveryCourierId', 'delivery_courier_id'),
    deliveryCourierFee: readNumber(record, 'deliveryCourierFee', 'delivery_courier_fee'),
    deliveryCourierFeeCurrency: readString(record, 'deliveryCourierFeeCurrency', 'delivery_courier_fee_currency'),
    exchangeRateYER: readNumber(record, 'exchangeRateYER', 'exchange_rate_yer'),
    exchangeRateUSD: readNumber(record, 'exchangeRateUSD', 'exchange_rate_usd'),
    bankCommissionRate: readNumber(record, 'bankCommissionRate', 'bank_commission_rate'),
    companyProfitRate: readNumber(record, 'companyProfitRate', 'company_profit_rate'),
    packagingFee: readNumber(record, 'packagingFee', 'packaging_fee'),
    sheinRedPrice: readNumber(record, 'sheinRedPrice', 'shein_red_price'),
    amountPaid: readNumber(record, 'amountPaid', 'amount_paid'),
    paymentMethod: readString(record, 'paymentMethod', 'payment_method'),
    cashAccountId: readString(record, 'cashAccountId'),
    cash_account_id: readString(record, 'cash_account_id'),
    bankAccountId: readString(record, 'bankAccountId'),
    bank_account_id: readString(record, 'bank_account_id'),
    bankReference: readString(record, 'bankReference'),
    bank_reference: readString(record, 'bank_reference'),
    cashAmount: readNumber(record, 'cashAmount'),
    cash_amount: readNumber(record, 'cash_amount'),
    bankAmount: readNumber(record, 'bankAmount'),
    bank_amount: readNumber(record, 'bank_amount'),
    notes: readString(record, 'notes'),
    createdByName: readString(record, 'createdByName'),
    created_by_name: readString(record, 'created_by_name'),
    items: readRows(record.items),
    shippingDetails: readRows(record.shippingDetails ?? record.shipping_details),
  };
}
