import { useEffect, useState } from 'react';
import { handleSupabaseError, OperationType } from '../../../data/legacy/legacy-adapter';
import { runQuery, type AsyncState } from '../../../shared/contracts/ui.contracts';
import type {
  CouriersViewModel,
} from '../../../data/dtos/couriers.dto';
import type {
  CustomersViewModel,
} from '../../../data/dtos/customers.dto';
import type {
  EmployeesViewModel,
} from '../../../data/dtos/employees.dto';
import type {
  ProductsViewModel,
} from '../../../data/dtos/products.dto';
import type {
  ShippingCompanyApiDto,
  SourcesViewModel,
} from '../../../data/dtos/sources.dto';
import type {
  ShipmentsViewModel,
} from '../../../data/dtos/shipments.dto';
import type { OrdersFeatureApi } from '../api';
import { legacyOrdersApi } from '../services/legacyOrdersApi';
import type { OrderRecord, ShipmentRecord } from '../types';

type LegacyEntityFields = {
  [key: string]: unknown;
  id: string;
  name?: string;
  fullName?: string;
  phone?: string;
  address?: string;
  entityId?: string | null;
  entityType?: string | null;
  disabled?: boolean;
  order_id?: string;
  order_number?: string;
  shipmentStatus?: string | null;
  shipment_id?: string;
  tracking_number?: string | null;
};

type CustomerRecord = Omit<CustomersViewModel, 'fullName'> &
  LegacyEntityFields & { fullName?: string };
type EmployeeRecord = Omit<EmployeesViewModel, 'fullName'> &
  LegacyEntityFields & { fullName?: string };
type CourierRecord = Omit<CouriersViewModel, 'fullName'> &
  LegacyEntityFields & { fullName?: string };
type SourceRecord = SourcesViewModel & LegacyEntityFields;
type ShippingCompanyRecord = Partial<ShippingCompanyApiDto> &
  LegacyEntityFields & { name: string };
type ProductRecord = ProductsViewModel & LegacyEntityFields;

type FinancialAccountRecord = LegacyEntityFields & {
  id: string;
  name: string;
  currency: string;
  curNo: number;
  accSubId: string;
  acc_sub_id?: string;
  accNameAr?: string | null;
  acc_name_ar?: string | null;
  accountName?: string | null;
  currencyCode?: string | null;
  cur_no?: number | string | null;
  balance?: number | string | null;
  accountType?: string | null;
  isActive?: boolean;
  is_active?: boolean;
};

type AutoVoucherRule = Record<string, unknown> & { id?: string };
type EntityRecord = Record<string, unknown> & { id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEntityRecord(value: unknown): value is EntityRecord {
  return isRecord(value) && typeof value.id === 'string';
}

function isCustomerRecord(value: unknown): value is CustomerRecord {
  return isEntityRecord(value);
}

function isEmployeeRecord(value: unknown): value is EmployeeRecord {
  return isEntityRecord(value);
}

function isCourierRecord(value: unknown): value is CourierRecord {
  return isEntityRecord(value);
}

function isOrderRecord(value: unknown): value is OrderRecord {
  return isEntityRecord(value);
}

function parseOrderRecord(value: unknown): OrderRecord | null {
  if (!isEntityRecord(value)) return null;
  const orderStatusId = value.orderStatusId;
  const amountRemaining = value.amountRemaining;
  const createdAt = value.createdAt;
  return {
    ...value,
    id: value.id,
    orderStatus: readText(value.orderStatus) ?? undefined,
    status: readText(value.status) ?? undefined,
    orderNumber: readText(value.orderNumber) ?? undefined,
    customerId: readText(value.customerId) ?? undefined,
    orderStatusId:
      typeof orderStatusId === 'string' || typeof orderStatusId === 'number'
        ? orderStatusId
        : undefined,
    orderSourceName: readText(value.orderSourceName) ?? undefined,
    orderSourceType: readText(value.orderSourceType) ?? undefined,
    customerName: readText(value.customerName) ?? undefined,
    customerPhone: readText(value.customerPhone) ?? undefined,
    amountPaid:
      typeof value.amountPaid === 'string' || typeof value.amountPaid === 'number'
        ? value.amountPaid
        : undefined,
    amountRemaining:
      typeof amountRemaining === 'string'
        ? amountRemaining
        : typeof amountRemaining === 'number'
          ? String(amountRemaining)
          : amountRemaining === null
            ? null
            : undefined,
    currency: readText(value.currency) ?? undefined,
    exchangeRateUSD:
      typeof value.exchangeRateUSD === 'number' ? value.exchangeRateUSD : undefined,
    exchangeRateSAR:
      typeof value.exchangeRateSAR === 'number' ? value.exchangeRateSAR : undefined,
    createdAt:
      typeof createdAt === 'string' || typeof createdAt === 'number' ? createdAt : undefined,
  };
}

function parseShipmentRecord(value: unknown): ShipmentRecord | null {
  if (!isEntityRecord(value)) return null;
  return {
    ...value,
    id: value.id,
    status: readText(value.status) ?? undefined,
    shipmentStatus: readText(value.shipmentStatus) ?? undefined,
    shippingCompany: readText(value.shippingCompany) ?? undefined,
    courier_id: readText(value.courier_id) ?? undefined,
    orderId: readText(value.orderId) ?? undefined,
    createdAt: readNumber(value.createdAt),
  };
}

function isRuleRecord(value: unknown): value is AutoVoucherRule {
  return isRecord(value);
}

function isRuleRecordArray(value: unknown): value is AutoVoucherRule[] {
  return Array.isArray(value) && value.every(isRuleRecord);
}

function readText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number(value === null ? null : undefined);
}

/** Data needed by the orders page; shapes remain legacy-compatible during phase 9. */
export interface OrderDataState {
  orders: OrderRecord[];
  customers: CustomerRecord[];
  employees: EmployeeRecord[];
  couriers: CourierRecord[];
  sources: SourceRecord[];
  shippingCompanies: ShippingCompanyRecord[];
  financialAccounts: FinancialAccountRecord[];
  allProducts: ProductRecord[];
  allShipments: ShipmentRecord[];
  autoVoucherRules: AutoVoucherRule[];
  loading: boolean;
}

/**
 * Subscribe to the same legacy collections and transform their snapshots exactly as
 * OrdersPage previously did. The injected API makes the data boundary replaceable
 * without changing realtime timing or payload aliases.
 */
export function useOrderData(
  enabled: boolean,
  api: OrdersFeatureApi = legacyOrdersApi,
): OrderDataState {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [couriers, setCouriers] = useState<CourierRecord[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompanyRecord[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountRecord[]>([]);
  const [allProducts, setAllProducts] = useState<ProductRecord[]>([]);
  const [allShipments, setAllShipments] = useState<ShipmentRecord[]>([]);
  const [autoVoucherRules, setAutoVoucherRules] = useState<AutoVoucherRule[]>([]);
  const [ordersQuery, setOrdersQuery] = useState<AsyncState<OrderRecord[]>>({ status: 'loading' });
  const loading = ordersQuery.status === 'loading';

  useEffect(() => {
    if (!enabled) return;

    const unsubOrders = api.collections.orders.subscribe(
      ({ records }) => {
        const parsedOrders = records.flatMap((record) => {
          const parsed = parseOrderRecord(record);
          return parsed ? [parsed] : [];
        });
        void runQuery(async () => parsedOrders, (state) => {
          setOrdersQuery(state);
          if (state.status === 'success') setOrders(state.data);
        });
      },
      (error) => handleSupabaseError(error, OperationType.LIST, 'orders'),
    );

    const unsubCustomers = api.collections.customers.subscribe(({ records }) => {
      setCustomers(records.filter(isCustomerRecord));
    });

    const unsubEmployees = api.collections.employees.subscribe(({ records }) => {
      setEmployees(records.filter(isEmployeeRecord).filter((entry) => !entry.disabled));
    });

    const unsubCouriers = api.collections.couriers.subscribe(({ records }) => {
      setCouriers(records.filter(isCourierRecord));
    });

    const unsubFinancialAccounts = api.collections.accounts.subscribe(({ records }) => {
      setFinancialAccounts(
        records
          .filter(isEntityRecord)
          .filter((account) =>
            account.isActive !== false &&
            Boolean(account.accSubId || account.acc_sub_id),
          )
          .map((account) => ({
            ...account,
            id: account.id,
            name:
              readText(account.accNameAr) ||
              readText(account.acc_name_ar) ||
              readText(account.accountName) ||
              account.id,
            currency: readText(account.currency) || readText(account.currencyCode) || '',
            curNo: readNumber(account.curNo ?? account.cur_no),
            accSubId: String(account.accSubId ?? account.acc_sub_id ?? ''),
          })),
      );
    });

    const unsubSources = api.collections.sources.subscribe(({ records }) => {
      setSources(
        records.filter(isEntityRecord).map((record) => ({
          ...record,
          sourceId: readText(record.sourceId) || record.id,
          name: readText(record.name) || undefined,
          type: readText(record.type),
        })),
      );
    });

    const unsubAutoVoucherRules = api.collections.settings.subscribe((record) => {
      if (record && isRuleRecordArray(record.data)) {
        setAutoVoucherRules(record.data);
      }
    });

    const unsubShippingCompanies = api.collections.shippingCompanies.subscribe(
      ({ records }) => {
        setShippingCompanies(
          records.filter(isEntityRecord).map((record) => ({
            ...record,
            id: record.id,
            name: readText(record.name) || 'بدون اسم',
          })),
        );
      },
      (error) => {
        console.error(
          'FIRESTORE ERROR ON shipping_companies SNAPSHOT LISTENER IN ORDERS.tsx:',
          error,
        );
      },
    );

    const unsubProducts = api.collections.products.subscribe(
      ({ records }) => {
        setAllProducts(
          records.filter(isEntityRecord).map((record) => ({
            ...record,
            productId: readText(record.productId) || record.id,
          })),
        );
      },
      (error) => handleSupabaseError(error, OperationType.LIST, 'products'),
    );

    const unsubShipments = api.collections.shipments.subscribe(
      ({ records }) => {
        setAllShipments(records.flatMap((record) => {
          const parsed = parseShipmentRecord(record);
          return parsed ? [parsed] : [];
        }));
      },
      (error) => handleSupabaseError(error, OperationType.LIST, 'shipments'),
    );

    return () => {
      unsubOrders();
      unsubCustomers();
      unsubEmployees();
      unsubCouriers();
      unsubFinancialAccounts();
      unsubSources();
      unsubAutoVoucherRules();
      unsubShippingCompanies();
      unsubProducts();
      unsubShipments();
    };
  }, [api, enabled]);

  return {
    orders,
    customers,
    employees,
    couriers,
    sources,
    shippingCompanies,
    financialAccounts,
    allProducts,
    allShipments,
    autoVoucherRules,
    loading,
  };
}
