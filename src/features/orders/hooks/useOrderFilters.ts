/**
 * useOrderFilters.ts
 * ------------------
 * Hook مسؤول عن state الخاص بفلاتر الطلبات وربطها بمنطق التحويل الخالص.
 * Owns filter state and wires it to pure order enrichment/filtering logic.
 */

import { useMemo, useState } from 'react';
import { enrichOrders, filterAndSortOrders } from '../services/orderFilterService';

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
  orders: any[];
  customers: any[];
  employees: any[];
  couriers: any[];
  sources: any[];
}

interface UseOrderFiltersResult extends OrderFilterState {
  filteredOrdersList: any[];
  enrichedOrders: any[];
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
    () => enrichOrders(orders, { customers, employees, couriers, sources }),
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
