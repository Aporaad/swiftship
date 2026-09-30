import { describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import { createUpdateOrderStatusHandler } from "./updateOrderStatusHandler";
import type { UpdateOrderStatusHandlerDependencies } from "./updateOrderStatusHandler";

function makeDependencies(
  overrides: Partial<UpdateOrderStatusHandlerDependencies> = {}
) {
  return {
    isSubmitting: true,
    isAr: false,
    auth: { currentUser: null },
    autoVoucherRules: [],
    buildOrderRates: vi.fn(),
    couriers: [],
    customers: [],
    dbRates: {},
    employees: [],
    getStatusByAny: vi.fn(),
    orderStatusesList: [],
    profile: null,
    selectedOrder: null,
    setIsSubmitting: vi.fn(),
    setIsUpdateModalOpen: vi.fn(),
    setSelectedOrder: vi.fn(),
    settings: {},
    shippingCompanies: [],
    sources: [],
    updateFormData: {},
    updateOrderRecord: vi.fn(),
    updateShippings: vi.fn(),
    upsertShipment: vi.fn(),
    ...overrides,
  } as unknown as UpdateOrderStatusHandlerDependencies;
}

describe("createUpdateOrderStatusHandler", () => {
  it("prevents duplicate submissions before performing status-update side effects", async () => {
    const dependencies = makeDependencies();
    const handler = createUpdateOrderStatusHandler(dependencies);
    const event = { preventDefault: vi.fn() } as unknown as FormEvent;

    await handler(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dependencies.updateOrderRecord).not.toHaveBeenCalled();
    expect(dependencies.upsertShipment).not.toHaveBeenCalled();
    expect(dependencies.setIsSubmitting).not.toHaveBeenCalled();
    expect(dependencies.setIsUpdateModalOpen).not.toHaveBeenCalled();
  });
});
