import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import { notificationService } from "../../../services/notificationService";
import { createSaveShipmentHandler } from "./saveShipmentHandler";
import type { SaveShipmentDependencies } from "./saveShipmentHandler";

vi.mock("../../../services/notificationService", () => ({
  notificationService: { notify: vi.fn() },
}));

vi.mock("../../../services/itemCategoryService", () => ({
  calculateShipmentCategoryFees: vi.fn(() => ({
    cartonCount: 2,
    customsFee: 4,
    taxFee: 3,
    otherCategoryFee: 2,
    total: 9,
    currency: "USD",
  })),
}));

function makeDependencies(overrides: Partial<SaveShipmentDependencies> = {}) {
  return {
    activeItemCategories: [],
    isAr: false,
    setIsAddShipmentModalOpen: vi.fn(),
    setIsEditShipmentModalOpen: vi.fn(),
    setIsSubmitting: vi.fn(),
    setShipmentToEdit: vi.fn(),
    shipmentFormData: { trackingNumber: "" },
    shipmentToEdit: null,
    upsertShipment: vi.fn(),
    ...overrides,
  } as unknown as SaveShipmentDependencies;
}

describe("createSaveShipmentHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing tracking numbers before persistence", async () => {
    const dependencies = makeDependencies();
    const event = { preventDefault: vi.fn() } as unknown as FormEvent;

    await createSaveShipmentHandler(dependencies)(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(notificationService.notify).toHaveBeenCalledOnce();
    expect(dependencies.upsertShipment).not.toHaveBeenCalled();
    expect(dependencies.setIsSubmitting).not.toHaveBeenCalled();
  });

  it("persists the current shipment payload and closes both form dialogs on success", async () => {
    const dependencies = makeDependencies({
      activeItemCategories: [{ id: "content-1" }],
      shipmentFormData: {
        id: "shipment-1",
        orderId: "order-1",
        trackingNumber: "TRACK-1",
        shippingCompany: "carrier-1",
        shippingCompanyId: "carrier-1",
        courierId: "courier-1",
        shipmentStatus: "in_transit",
        shippingCost: 15,
        weight: 2.5,
        packagingFees: 3,
        shippingCategoryId: "shipping-category-1",
        shippingCategoryName: "Air",
        shippingCategoryPrice: 5,
        shippingType: "air",
        shippingSource: "A",
        shippingDestination: "B",
        shippingDate: "2026-09-30",
        shippingDuration: "3",
        expectedArrival: "2026-10-03",
        deliveryDate: "",
        notes: "fragile",
        contentCategoryId: "content-1",
        contentCategoryName: "Electronics",
        cartonCount: 2,
        customsFee: 0,
        taxFee: 0,
        otherCategoryFee: 0,
        categoryFeesTotal: 0,
        categoryFeeCurrency: "USD",
      },
        shipmentToEdit: { id: "shipment-1", createdAt: 123 },
      upsertShipment: vi.fn().mockResolvedValue(undefined),
    });
    const event = { preventDefault: vi.fn() } as unknown as FormEvent;

    await createSaveShipmentHandler(dependencies)(event);

    expect(dependencies.upsertShipment).toHaveBeenCalledWith(
      "shipment-1",
      expect.objectContaining({
        trackingNumber: "TRACK-1",
        shippingCompanyId: "carrier-1",
        shippingCompany: "carrier-1",
        courierId: "courier-1",
        shippingCost: 15,
        weight: 2.5,
        packagingFees: 3,
        cartonCount: 2,
        customsFee: 4,
        taxFee: 3,
        otherCategoryFee: 2,
        categoryFeesTotal: 9,
        categoryFeeCurrency: "USD",
        createdAt: 123,
      })
    );
    expect(dependencies.setIsAddShipmentModalOpen).toHaveBeenCalledWith(false);
    expect(dependencies.setIsEditShipmentModalOpen).toHaveBeenCalledWith(false);
    expect(dependencies.setShipmentToEdit).toHaveBeenCalledWith(null);
    expect(dependencies.setIsSubmitting).toHaveBeenNthCalledWith(1, true);
    expect(dependencies.setIsSubmitting).toHaveBeenLastCalledWith(false);
  });
});
