/**
 * useOrderFilters.ts
 * ------------------
 * Hook مسؤول عن تصفية وفرز قائمة الطلبات.
 * Responsible for filtering and sorting the orders list.
 *
 * يفصل منطق الفلترة عن واجهة المستخدم.
 * Separates filtering logic from UI.
 */

import { useState, useMemo } from 'react';

/** حالة الفلترة والبحث - Filter and search state */
export interface OrderFilterState {
  searchText: string;
  setSearchText: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  courierFilter: string;
  setCourierFilter: (v: string) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
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

/**
 * useOrderFilters
 * Hook يُدير فلترة الطلبات وإثراءها ببيانات الكيانات المرتبطة.
 * Manages orders filtering and enrichment with related entity data.
 */
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

  /**
   * إثراء قائمة الطلبات ببيانات العميل والمصدر من المصفوفات المحملة مسبقاً.
   * Enrich orders with customer/employee/courier data and source name.
   */
  const enrichedOrders = useMemo(
    () =>
      orders.map((o) => {
        const partyId = o.orderPartyId || o.order_party_id || o.customerId || o.customer_id;
        const partyType = o.orderPartyType || o.order_party_type || 'customer';
        let partyName = '';
        let partyPhone = '';
        let partyAddress = '';

        if (partyType === 'employee') {
          const emp = employees.find((e: any) => e.id === partyId);
          partyName = emp?.fullName || emp?.name || '';
          partyPhone = emp?.phone || '';
          partyAddress = emp?.address || '';
        } else if (partyType === 'courier') {
          const cou = couriers.find((c: any) => c.id === partyId);
          partyName = cou?.fullName || cou?.name || '';
          partyPhone = cou?.phone || '';
        } else {
          const custId = o.customerId || o.customer_id || partyId;
          const cust = customers.find((c: any) => c.id === custId);
          partyName = cust?.fullName || cust?.name || '';
          partyPhone = cust?.phone || cust?.mobile || '';
          partyAddress = cust?.address || '';
        }

        const srcId = o.orderSourceId || o.order_source_id;
        const src = sources.find((s: any) => s.id === srcId);
        const srcName = src?.name || o.orderSourceType || o.order_source_type || '';

        return {
          ...o,
          customerName: partyName || o.customerName || '',
          customerPhone: partyPhone || o.customerPhone || '',
          customerAddress: partyAddress || o.customerAddress || '',
          orderSourceName: srcName,
          // توحيد الأعمدة المباشرة
          customerId: o.customerId || o.customer_id || '',
          orderPartyId: o.orderPartyId || o.order_party_id || '',
          orderPartyType: o.orderPartyType || o.order_party_type || 'customer',
          isStaffOrder: o.isStaffOrder ?? o.is_staff_order ?? false,
          employeeId: o.employeeId || o.employee_id || '',
          courierId: o.courierId || o.courier_id || '',
          orderPartyAccountId: o.orderPartyAccountId || o.order_party_account_id || '',
          orderSourceId: o.orderSourceId || o.order_source_id || '',
          orderSourceType: o.orderSourceType || o.order_source_type || '',
          deliveryCourierId: o.deliveryCourierId || o.delivery_courier_id || '',
          shippingCourierId: o.shippingCourierId || o.shipping_courier_id || '',
        };
      }),
    [orders, customers, employees, couriers, sources],
  );

  /**
   * قائمة الطلبات المصفّاة والمرتّبة.
   * Filtered and sorted orders list.
   */
  const filteredOrdersList = useMemo(() => {
    return enrichedOrders
      .filter((o) => {
        const num = String(o.orderNumber || o.order_number || '').toUpperCase();
        const customer = String(o.customerName || '').toLowerCase();
        const phone = String(o.customerPhone || '');
        const track = String(o.trackingNumber || o.tracking_number || '').toUpperCase();
        const q = searchText.toLowerCase();

        const matchSearch =
          num.includes(q.toUpperCase()) ||
          customer.includes(q) ||
          phone.includes(searchText) ||
          track.includes(q.toUpperCase());

        const matchStatus =
          statusFilter === 'all' ||
          String(o.order_status_id || o.orderStatusId) === String(statusFilter) ||
          o.orderStatus === statusFilter;

        const matchCourier =
          courierFilter === 'all' ||
          o.deliveryCourierId === courierFilter ||
          o.shippingCourierId === courierFilter;

        const matchSource =
          sourceFilter === 'all' || o.orderSourceId === sourceFilter;

        return matchSearch && matchStatus && matchCourier && matchSource;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return (b.createdAt || 0) - (a.createdAt || 0);
        if (sortBy === 'date-asc') return (a.createdAt || 0) - (b.createdAt || 0);
        if (sortBy === 'amount-desc')
          return (
            parseFloat(b.amountPaid || 0) +
            parseFloat(b.amountRemaining || 0) -
            (parseFloat(a.amountPaid || 0) + parseFloat(a.amountRemaining || 0))
          );
        return 0;
      });
  }, [enrichedOrders, searchText, statusFilter, courierFilter, sourceFilter, sortBy]);

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
