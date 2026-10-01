import type { Dispatch, FormEvent, SetStateAction } from "react";
import { calculateShipmentCategoryFees, type ItemCategory } from "../../../services/itemCategoryService";
import { notificationService } from "../../../services/notificationService";
import type { ShipmentFeatureRecord, ShipmentFormData } from "../types";

const toNumber = (value: unknown): number => typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) || 0 : 0;
type ShipmentMutation = (id: string, payload: Record<string, unknown>) => Promise<unknown>;

export interface SaveShipmentDependencies<T extends ShipmentFeatureRecord = ShipmentFeatureRecord> {
  activeItemCategories: Array<Partial<ItemCategory> & Pick<ItemCategory, 'id'>>;
  isAr: boolean;
  setIsAddShipmentModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsEditShipmentModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setShipmentToEdit: Dispatch<SetStateAction<T | null>>;
  shipmentFormData: ShipmentFormData;
  shipmentToEdit: ShipmentFeatureRecord | null;
  upsertShipment: (
    id: string,
    payload: Record<string, unknown>
  ) => Promise<unknown>;
}

export function createSaveShipmentHandler<T extends ShipmentFeatureRecord>(
  dependencies: SaveShipmentDependencies<T>
) {
  const {
    activeItemCategories,
    isAr,
    setIsAddShipmentModalOpen,
    setIsEditShipmentModalOpen,
    setIsSubmitting,
    setShipmentToEdit,
    shipmentFormData,
    shipmentToEdit,
    upsertShipment,
  } = dependencies;

  return async (e: FormEvent) => {
    e.preventDefault();
    if (!shipmentFormData.trackingNumber) {
      return notificationService.notify({
        title: isAr ? "خطأ" : "Error",
        message: isAr
          ? "يرجى إدخال رقم التتبع للشحنة"
          : "Please enter tracking number",
        type: "error",
      });
    }

    setIsSubmitting(true);
    try {
      const shipId =
        shipmentFormData.id ||
        "sh_" + Math.random().toString(36).substring(2, 11);
      const contentCategory = activeItemCategories.find(
        category => category.id === shipmentFormData.contentCategoryId
      );
      const categoryFees = calculateShipmentCategoryFees(
        contentCategory,
        shipmentFormData.cartonCount
      );
      const payload = {
        id: shipId,
        orderId: shipmentFormData.orderId || "",
        trackingNumber: shipmentFormData.trackingNumber,
        shippingCompanyId: shipmentFormData.shippingCompany,
        shippingCompany: shipmentFormData.shippingCompany,
        courierId: shipmentFormData.courierId || "",
        shipmentStatus: shipmentFormData.shipmentStatus,
        shippingCost: toNumber(shipmentFormData.shippingCost) || 0,
        weight: toNumber(shipmentFormData.weight) || 0,
        packagingFees: toNumber(shipmentFormData.packagingFees) || 0,
        shippingCategoryId: shipmentFormData.shippingCategoryId || "",
        shippingCategoryName: shipmentFormData.shippingCategoryName || "",
        shippingCategoryPrice:
          toNumber(shipmentFormData.shippingCategoryPrice) || 0,
        shippingType: shipmentFormData.shippingType,
        shippingSource: shipmentFormData.shippingSource,
        shippingDestination: shipmentFormData.shippingDestination,
        shippingDate: shipmentFormData.shippingDate,
        shippingDuration: shipmentFormData.shippingDuration,
        expectedArrival: shipmentFormData.expectedArrival,
        deliveryDate: shipmentFormData.deliveryDate,
        notes: shipmentFormData.notes,
        contentCategoryId: shipmentFormData.contentCategoryId || "",
        contentCategoryName: shipmentFormData.contentCategoryName || "",
        cartonCount: categoryFees.cartonCount,
        customsFee: categoryFees.customsFee,
        taxFee: categoryFees.taxFee,
        otherCategoryFee: categoryFees.otherCategoryFee,
        categoryFeesTotal: categoryFees.total,
        categoryFeeCurrency: categoryFees.currency,
        createdAt: shipmentToEdit?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await upsertShipment(shipId, payload);

      notificationService.notify({
        title: isAr ? "تم الحفظ" : "Saved",
        message: isAr
          ? "تم حفظ سجل الشحنة بنجاح"
          : "Shipment record saved successfully",
        type: "success",
      });

      setIsAddShipmentModalOpen(false);
      setIsEditShipmentModalOpen(false);
      setShipmentToEdit(null);
    } catch (err: unknown) {
      console.error(err);
      notificationService.notify({
        title: isAr ? "خطأ" : "Error",
        message: err instanceof Error ? err.message : "Could not save shipment",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
}
