import { describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import { createOrderEntityHandlers } from "./orderEntityHandlers";
import type { OrderEntityHandlersDependencies } from "./orderEntityHandlers";

function makeDependencies(
  overrides: Partial<OrderEntityHandlersDependencies> = {}
) {
  return {
    activeAddShippingIndex: null,
    createCustomerRecord: vi.fn(),
    createShippingCompanyRecord: vi.fn(),
    createSourceRecord: vi.fn(),
    customerFormData: {
      fullName: "",
      phone: "",
      email: "",
      gps_location: "",
      address: "",
      notes: "",
    },
    isAr: false,
    isSubmitting: true,
    orderCurrency: "YER",
    setActiveAddShippingIndex: vi.fn(),
    setCustomerFormData: vi.fn(),
    setFormData: vi.fn(),
    setIsAddCustomerOpen: vi.fn(),
    setIsAddShippingCompanyOpen: vi.fn(),
    setIsAddSourceOpen: vi.fn(),
    setIsSubmitting: vi.fn(),
    setShippingCompanyFormData: vi.fn(),
    setSourceFormData: vi.fn(),
    settings: {},
    shippingCompanyFormData: {
      name: "",
      contact_person: "",
      phone: "",
      tracking_url: "",
      address: "",
      notes: "",
    },
    sourceFormData: {
      source_name: "",
      type: "App",
      source_url: "",
      contact_info: "",
      location: "",
      notes: "",
    },
    updateShippingRow: vi.fn(),
    updateUpdateShippingRow: vi.fn(),
    ...overrides,
  } as unknown as OrderEntityHandlersDependencies;
}

describe("createOrderEntityHandlers", () => {
  it("prevents duplicate entity form submissions before persistence", async () => {
    const dependencies = makeDependencies();
    const handlers = createOrderEntityHandlers(dependencies);
    const event = { preventDefault: vi.fn() } as unknown as FormEvent;

    await handlers.handleAddCustomer(event);
    await handlers.handleAddSource(event);
    await handlers.handleAddShippingCompany(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(3);
    expect(dependencies.createCustomerRecord).not.toHaveBeenCalled();
    expect(dependencies.createSourceRecord).not.toHaveBeenCalled();
    expect(dependencies.createShippingCompanyRecord).not.toHaveBeenCalled();
    expect(dependencies.setIsSubmitting).not.toHaveBeenCalled();
  });
});
