export const ORDER_COLLECTIONS = {
  orders: 'orders',
  customers: 'customers',
  employees: 'employees',
  couriers: 'couriers',
  accounts: 'accounts',
  sources: 'sources',
  shippingCompanies: 'shipping_companies',
  products: 'products',
  orderItems: 'order_items',
  shipments: 'shipments',
  settings: 'settings',
} as const;

export const ORDER_DOCUMENTS = {
  automaticVoucherRules: 'automatic_voucher_rules',
} as const;

/** Fallback status IDs used by the current individual and batch paths; intentionally distinct. */
export const ORDER_STATUS_FALLBACKS = {
  create: '1',
  individualUpdate: 1,
  batchUpdate: 2,
} as const;

/** Existing initial form labels and enum-like values; do not normalize during the refactor. */
export const ORDER_DEFAULT_VALUES = {
  sourceType: 'App',
  shippingCompany: 'Aramex',
  shippingType: 'بري',
  paymentMethod: 'Cash',
  orderStatus: 'طلب معلق',
  deliveryStatus: 'في الانتظار',
  deliveryLocation: 'مستودع صنعاء الرئيسي',
  paymentCurrency: 'YER',
  categoryFeeCurrency: 'SAR',
} as const;
