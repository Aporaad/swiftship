/**
 * useOrderFilters.ts
 * ------------------
 * Hook مسؤول عن state الخاص بفلاتر الطلبات وربطها بمنطق التحويل الخالص.
 * Owns filter state and wires it to pure order enrichment/filtering logic.
 */

import { useMemo, useState } from 'react';
import { enrichOrders, filterAndSortOrders } from '../services/orderFilterService';
import type { OrderFeatureRecord } from '../types';

type LegacyFilterRecord = Record<string, unknown>;

/** حالة الفلترة والبحث - Filter and search state */
export interface OrderFilterState {
  searchText: string;
  setSearchText: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  courierFilter: string;
  setCourierFilter: (value: string) => void;
  sourceFilter: string;
  setSourceFilter: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
}

interface UseOrderFiltersOptions {
  orders: OrderFeatureRecord[];
  customers: LegacyFilterRecord[];
  employees: LegacyFilterRecord[];
  couriers: LegacyFilterRecord[];
  sources: LegacyFilterRecord[];
}

interface UseOrderFiltersResult extends OrderFilterState {
  filteredOrdersList: LegacyFilterRecord[];
  enrichedOrders: LegacyFilterRecord[];
}

export function useOrderFilters({
  orders,
  customers,
  employees,
  couriers,
  sources,
}: UseOrderFiltersOptions): UseOrderFiltersResult {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  const enrichedOrders = useMemo(
    () => enrichOrders(orders.map((order) => ({ ...order })), { customers, employees, couriers, sources }),
    [orders, customers, employees, couriers, sources],
  );

  const filteredOrdersList = useMemo(
    () => filterAndSortOrders(enrichedOrders, {
      searchText,
      statusFilter,
      courierFilter,
      sourceFilter,
      sortBy,
    }),
    [enrichedOrders, searchText, statusFilter, courierFilter, sourceFilter, sortBy],
  );

  return {
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    courierFilter,
    setCourierFilter,
    sourceFilter,
    setSourceFilter,
    sortBy,
    setSortBy,
    filteredOrdersList,
    enrichedOrders,
  };
}
