import { describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import { createCollectOrderPaymentHandler } from "./collectOrderPaymentHandler";
import type { CollectOrderPaymentDependencies } from "./collectOrderPaymentHandler";

function makeDependencies(
  overrides: Partial<CollectOrderPaymentDependencies> = {}
) {
  return {
    activeCurrencies: [],
    couriers: [],
    customers: [],
    dbRates: {},
    employees: [],
    financialAccounts: [],
    isAr: false,
    orderCurrency: "YER",
    paymentFormData: {
      amount: "",
      method: "Cash",
      receivingAccountId: "",
      bankReference: "",
      allocations: [],
      notes: "",
      pin: "",
      paymentCurrency: "YER",
    },
    profile: null,
    selectedOrder: null,
    setIsPaymentModalOpen: vi.fn(),
    setIsSubmitting: vi.fn(),
    setPaymentFormData: vi.fn(),
    setSelectedOrder: vi.fn(),
    ...overrides,
  } as unknown as CollectOrderPaymentDependencies;
}

describe("createCollectOrderPaymentHandler", () => {
  it("does not mutate payment state or ledger when no order is selected", async () => {
    const dependencies = makeDependencies();
    const event = { preventDefault: vi.fn() } as unknown as FormEvent;

    await createCollectOrderPaymentHandler(dependencies)(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dependencies.setIsSubmitting).not.toHaveBeenCalled();
    expect(dependencies.setIsPaymentModalOpen).not.toHaveBeenCalled();
    expect(dependencies.setPaymentFormData).not.toHaveBeenCalled();
  });
});
