import { describe, expect, it, vi } from "vitest";
import { createBatchUpdateOrderStatusHandler } from "./batchUpdateOrderStatusHandler";
import type { BatchUpdateOrderStatusDependencies } from "./batchUpdateOrderStatusHandler";

function makeDependencies(
  overrides: Partial<BatchUpdateOrderStatusDependencies> = {}
) {
  return {
    auth: { currentUser: null },
    autoVoucherRules: [],
    buildOrderRates: vi.fn(),
    couriers: [],
    customers: [],
    dbRates: {},
    employees: [],
    isAr: false,
    orders: [],
    orderStatusesList: [],
    profile: null,
    selectedOrderIds: [],
    setIsBatchUpdating: vi.fn(),
    setSelectedOrderIds: vi.fn(),
    settings: {},
    updateOrderRecord: vi.fn(),
    ...overrides,
  } as unknown as BatchUpdateOrderStatusDependencies;
}

describe("createBatchUpdateOrderStatusHandler", () => {
  it("does not start a batch workflow when no order is selected", async () => {
    const dependencies = makeDependencies();

    await createBatchUpdateOrderStatusHandler(dependencies)("in_transit");

    expect(dependencies.setIsBatchUpdating).not.toHaveBeenCalled();
    expect(dependencies.updateOrderRecord).not.toHaveBeenCalled();
    expect(dependencies.setSelectedOrderIds).not.toHaveBeenCalled();
  });
});
