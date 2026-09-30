import { describe, expect, it } from "vitest";
import { enrichOrders, filterAndSortOrders } from "./orderFilterService";

describe("order filter service", () => {
  it("enriches customer and source fields from legacy snake_case records without mutating input", () => {
    const order = {
      id: "order-1",
      customer_id: "customer-1",
      order_source_id: "source-1",
      order_status_id: 2,
      createdAt: 10,
    };

    const [enriched] = enrichOrders([order], {
      customers: [
        {
          id: "customer-1",
          fullName: "ليلى سالم",
          mobile: "777000111",
          address: "صنعاء",
        },
      ],
      employees: [],
      couriers: [],
      sources: [{ id: "source-1", name: "متجر الويب" }],
    });

    expect(enriched).toMatchObject({
      customerId: "customer-1",
      customerName: "ليلى سالم",
      customerPhone: "777000111",
      customerAddress: "صنعاء",
      orderSourceId: "source-1",
      orderSourceName: "متجر الويب",
      orderPartyType: "customer",
      isStaffOrder: false,
    });
    expect(order).not.toHaveProperty("customerName");
  });

  it("resolves employee parties and preserves existing display values as fallback", () => {
    const [employeeOrder, fallbackOrder] = enrichOrders(
      [
        {
          id: "employee-order",
          order_party_id: "employee-1",
          order_party_type: "employee",
        },
        {
          id: "fallback-order",
          orderPartyId: "missing",
          customerName: "Existing name",
          customerPhone: "123",
        },
      ],
      {
        customers: [],
        employees: [
          { id: "employee-1", name: "موظف", phone: "777", address: "عدن" },
        ],
        couriers: [],
        sources: [],
      }
    );

    expect(employeeOrder).toMatchObject({
      customerName: "موظف",
      customerPhone: "777",
      customerAddress: "عدن",
      orderPartyId: "employee-1",
      orderPartyType: "employee",
    });
    expect(fallbackOrder).toMatchObject({
      customerName: "Existing name",
      customerPhone: "123",
    });
  });

  it("combines search, status, courier and source filters before sorting by date", () => {
    const orders = [
      {
        id: "matching",
        orderNumber: "ALX-12",
        customerName: "Mona",
        customerPhone: "555",
        orderStatusId: 2,
        deliveryCourierId: "courier-1",
        orderSourceId: "source-1",
        createdAt: 10,
      },
      {
        id: "wrong-status",
        orderNumber: "ALX-12",
        customerName: "Mona",
        orderStatusId: 3,
        deliveryCourierId: "courier-1",
        orderSourceId: "source-1",
        createdAt: 30,
      },
      {
        id: "wrong-courier",
        orderNumber: "ALX-12",
        customerName: "Mona",
        orderStatusId: 2,
        deliveryCourierId: "courier-2",
        orderSourceId: "source-1",
        createdAt: 20,
      },
    ];

    const result = filterAndSortOrders(orders, {
      searchText: "alx-12",
      statusFilter: "2",
      courierFilter: "courier-1",
      sourceFilter: "source-1",
      sortBy: "date-desc",
    });

    expect(result.map(order => order.id)).toEqual(["matching"]);
  });

  it("sorts by total paid plus remaining amount when requested", () => {
    const result = filterAndSortOrders(
      [
        { id: "lower", createdAt: 1, amountPaid: "5", amountRemaining: "10" },
        { id: "higher", createdAt: 2, amountPaid: "20", amountRemaining: "5" },
      ],
      {
        searchText: "",
        statusFilter: "all",
        courierFilter: "all",
        sourceFilter: "all",
        sortBy: "amount-desc",
      }
    );

    expect(result.map(order => order.id)).toEqual(["higher", "lower"]);
  });
});
