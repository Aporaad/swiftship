export interface OrderFilterRecord {
  [key: string]: unknown;
}

const readText = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);
const readNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export interface OrderFilterCriteria {
  searchText: string;
  statusFilter: string;
  courierFilter: string;
  sourceFilter: string;
  sortBy: string;
}

export interface OrderFilterEntities {
  customers: OrderFilterRecord[];
  employees: OrderFilterRecord[];
  couriers: OrderFilterRecord[];
  sources: OrderFilterRecord[];
}

/**
 * Enrich order records with related party and source information.
 * This is a pure transformation: it does not mutate inputs or access UI/DB.
 */
export function enrichOrders(
  orders: OrderFilterRecord[],
  { customers, employees, couriers, sources }: OrderFilterEntities
): OrderFilterRecord[] {
  return orders.map(order => {
    const partyId =
      order.orderPartyId ||
      order.order_party_id ||
      order.customerId ||
      order.customer_id;
    const partyType =
      order.orderPartyType || order.order_party_type || "customer";
    let partyName = "";
    let partyPhone = "";
    let partyAddress = "";

    if (partyType === "employee") {
      const employee = employees.find(record => record.id === partyId);
      partyName = readText(employee?.fullName || employee?.name);
      partyPhone = readText(employee?.phone);
      partyAddress = readText(employee?.address);
    } else if (partyType === "courier") {
      const courier = couriers.find(record => record.id === partyId);
      partyName = readText(courier?.fullName || courier?.name);
      partyPhone = readText(courier?.phone);
    } else {
      const customerId = order.customerId || order.customer_id || partyId;
      const customer = customers.find(record => record.id === customerId);
      partyName = readText(customer?.fullName || customer?.name);
      partyPhone = readText(customer?.phone || customer?.mobile);
      partyAddress = readText(customer?.address);
    }

    const sourceId = order.orderSourceId || order.order_source_id;
    const source = sources.find(record => record.id === sourceId);
    const sourceName = readText(
      source?.name || order.orderSourceType || order.order_source_type
    );

    return {
      ...order,
      customerName: partyName || readText(order.customerName),
      customerPhone: partyPhone || readText(order.customerPhone),
      customerAddress: partyAddress || readText(order.customerAddress),
      orderSourceName: sourceName,
      customerId: order.customerId || order.customer_id || "",
      orderPartyId: order.orderPartyId || order.order_party_id || "",
      orderPartyType:
        order.orderPartyType || order.order_party_type || "customer",
      isStaffOrder: Boolean(order.isStaffOrder ?? order.is_staff_order ?? false),
      employeeId: order.employeeId || order.employee_id || "",
      courierId: order.courierId || order.courier_id || "",
      orderPartyAccountId:
        order.orderPartyAccountId || order.order_party_account_id || "",
      orderSourceId: order.orderSourceId || order.order_source_id || "",
      orderSourceType: order.orderSourceType || order.order_source_type || "",
      deliveryCourierId:
        order.deliveryCourierId || order.delivery_courier_id || "",
      shippingCourierId:
        order.shippingCourierId || order.shipping_courier_id || "",
    };
  });
}

/** Apply the existing search, status, courier and source rules, then sort. */
export function filterAndSortOrders(
  orders: OrderFilterRecord[],
  {
    searchText,
    statusFilter,
    courierFilter,
    sourceFilter,
    sortBy,
  }: OrderFilterCriteria
): OrderFilterRecord[] {
  return orders
    .filter(order => {
      const orderNumber = String(
        order.orderNumber || order.order_number || ""
      ).toUpperCase();
      const customerName = String(order.customerName || "").toLowerCase();
      const customerPhone = String(order.customerPhone || "");
      const trackingNumber = String(
        order.trackingNumber || order.tracking_number || ""
      ).toUpperCase();
      const query = searchText.toLowerCase();

      const matchesSearch =
        orderNumber.includes(query.toUpperCase()) ||
        customerName.includes(query) ||
        customerPhone.includes(searchText) ||
        trackingNumber.includes(query.toUpperCase());

      const matchesStatus =
        statusFilter === "all" ||
        String(order.order_status_id || order.orderStatusId) ===
          String(statusFilter) ||
        order.orderStatus === statusFilter;

      const matchesCourier =
        courierFilter === "all" ||
        order.deliveryCourierId === courierFilter ||
        order.shippingCourierId === courierFilter;

      const matchesSource =
        sourceFilter === "all" || order.orderSourceId === sourceFilter;

      return matchesSearch && matchesStatus && matchesCourier && matchesSource;
    })
    .sort((a, b) => {
      if (sortBy === "date-desc")
        return readNumber(b.createdAt) - readNumber(a.createdAt);
      if (sortBy === "date-asc") return readNumber(a.createdAt) - readNumber(b.createdAt);
      if (sortBy === "amount-desc") {
        return (
          readNumber(b.amountPaid) +
          readNumber(b.amountRemaining) -
          (readNumber(a.amountPaid) + readNumber(a.amountRemaining))
        );
      }
      return 0;
    });
}
