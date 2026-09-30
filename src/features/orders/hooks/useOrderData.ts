import { useEffect, useState } from 'react';
import { handleSupabaseError, OperationType } from '../../../lib/supabase';
import type { OrdersFeatureApi } from '../api';
import { legacyOrdersApi } from '../services/legacyOrdersApi';

/** Data needed by the orders page; shapes remain legacy-compatible during phase 9. */
export interface OrderDataState {
  orders: any[];
  customers: any[];
  employees: any[];
  couriers: any[];
  sources: any[];
  shippingCompanies: any[];
  financialAccounts: any[];
  allProducts: any[];
  allShipments: any[];
  autoVoucherRules: any[];
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
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allShipments, setAllShipments] = useState<any[]>([]);
  const [autoVoucherRules, setAutoVoucherRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    const unsubOrders = api.collections.orders.subscribe(
      ({ records }) => {
        setOrders(records as any[]);
        setLoading(false);
      },
      (error) => handleSupabaseError(error, OperationType.LIST, 'orders'),
    );

    const unsubCustomers = api.collections.customers.subscribe(({ records }) => {
      setCustomers(records as any[]);
    });

    const unsubEmployees = api.collections.employees.subscribe(({ records }) => {
      setEmployees(records.filter((entry: any) => !entry.disabled) as any[]);
    });

    const unsubCouriers = api.collections.couriers.subscribe(({ records }) => {
      setCouriers(records as any[]);
    });

    const unsubFinancialAccounts = api.collections.accounts.subscribe(({ records }) => {
      setFinancialAccounts(
        records
          .filter((account: any) =>
            account.isActive !== false && Boolean(account.accSubId || account.acc_sub_id),
          )
          .map((account: any) => ({
            id: account.id,
            name:
              account.accNameAr ||
              account.acc_name_ar ||
              account.accountName ||
              account.id,
            currency: account.currency || account.currencyCode || '',
            curNo: Number(account.curNo ?? account.cur_no),
            accSubId: String(account.accSubId ?? account.acc_sub_id ?? ''),
          })),
      );
    });

    const unsubSources = api.collections.sources.subscribe(({ records }) => {
      setSources(records as any[]);
    });

    const unsubAutoVoucherRules = api.collections.settings.subscribe((record) => {
      if (record && record.data) {
        setAutoVoucherRules(record.data as any[]);
      }
    });

    const unsubShippingCompanies = api.collections.shippingCompanies.subscribe(
      ({ records }) => {
        setShippingCompanies(
          records.map((record: any) => ({
            id: record.id,
            name: record.name || 'بدون اسم',
            ...record,
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
        setAllProducts(records as any[]);
      },
      (error) => handleSupabaseError(error, OperationType.LIST, 'products'),
    );

    const unsubShipments = api.collections.shipments.subscribe(
      ({ records }) => {
        setAllShipments(records as any[]);
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
