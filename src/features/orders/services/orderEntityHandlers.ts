import type { Dispatch, FormEvent, SetStateAction } from "react";
import { handleSupabaseError, OperationType } from "../../../data/legacy/legacy-compat.ts";
import { activityLogService } from "../../../services/activityLogService";
import { financialAccountService } from "../../../services/financialAccountService";
import { notificationService } from "../../../services/notificationService";
import type {
  CustomerFormData,
  OrderFormData,
  ShippingCompanyFormData,
  SourceFormData,
} from "../types";

type EntityPayload = Record<string, unknown>;
type EntityCreator = (id: string, payload: EntityPayload) => Promise<{ id: string }>;
type SettingsRecord = { currency?: string };
type ShippingRowUpdater = (index: number, field: string, value: string) => void;

export interface OrderEntityHandlersDependencies {
  activeAddShippingIndex: number | string | null;
  createCustomerRecord: EntityCreator;
  createShippingCompanyRecord: EntityCreator;
  createSourceRecord: EntityCreator;
  customerFormData: CustomerFormData;
  isAr: boolean;
  isSubmitting: boolean;
  orderCurrency: string;
  setActiveAddShippingIndex: Dispatch<SetStateAction<number | string | null>>;
  setCustomerFormData: Dispatch<SetStateAction<CustomerFormData>>;
  setFormData: Dispatch<SetStateAction<OrderFormData>>;
  setIsAddCustomerOpen: Dispatch<SetStateAction<boolean>>;
  setIsAddShippingCompanyOpen: Dispatch<SetStateAction<boolean>>;
  setIsAddSourceOpen: Dispatch<SetStateAction<boolean>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setShippingCompanyFormData: Dispatch<SetStateAction<ShippingCompanyFormData>>;
  setSourceFormData: Dispatch<SetStateAction<SourceFormData>>;
  settings: SettingsRecord;
  shippingCompanyFormData: ShippingCompanyFormData;
  sourceFormData: SourceFormData;
  updateShippingRow: ShippingRowUpdater;
  updateUpdateShippingRow: ShippingRowUpdater;
}

export function createOrderEntityHandlers(
  dependencies: OrderEntityHandlersDependencies
) {
  const {
    activeAddShippingIndex,
    createCustomerRecord,
    createShippingCompanyRecord,
    createSourceRecord,
    customerFormData,
    isAr,
    isSubmitting,
    orderCurrency,
    setActiveAddShippingIndex,
    setCustomerFormData,
    setFormData,
    setIsAddCustomerOpen,
    setIsAddShippingCompanyOpen,
    setIsAddSourceOpen,
    setIsSubmitting,
    setShippingCompanyFormData,
    setSourceFormData,
    settings,
    shippingCompanyFormData,
    sourceFormData,
    updateShippingRow,
    updateUpdateShippingRow,
  } = dependencies;

  return {
    handleAddCustomer: async (e: FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;
      if (!customerFormData.fullName || !customerFormData.phone) return;

      setIsSubmitting(true);
      try {
        // Step 1: Create the customer document
        const { accountCode, code, accountId } =
          await financialAccountService.getNextAccountIdentifiers("customer");
        const newId = "cust_" + accountCode;
        const docRef = await createCustomerRecord(newId, {
          fullName: customerFormData.fullName,
          phone: customerFormData.phone,
          email: customerFormData.email || "",
          gps_location: customerFormData.gps_location || "",
          address: customerFormData.address || "",
          notes: customerFormData.notes || "",
          createdAt: Date.now(),
          financialBalance: 0,
          financialCurrency: settings.currency || "SAR",
        });

        // Step 2: Auto-create financial account (1130-xxxx)
        try {
          await financialAccountService.createAccountForEntity(
            "customer",
            docRef.id,
            customerFormData.fullName,
            settings.currency || "SAR"
          );
        } catch (accErr) {
          console.warn(
            "[Orders.tsx] Could not create financial account for quick-added customer:",
            accErr
          );
        }

        // Autofollow selected
        setFormData(prev => ({
          ...prev,
          customerId: docRef.id,
          customerName: customerFormData.fullName,
          customerPhone: customerFormData.phone,
          customerAddress: customerFormData.address || "",
        }));

        setIsAddCustomerOpen(false);
        setCustomerFormData({
          fullName: "",
          phone: "",
          email: "",
          gps_location: "",
          address: "",
          notes: "",
        });

        activityLogService.log("add_customer", customerFormData.fullName, {
          ...customerFormData,
        });

        notificationService.notify({
          title: isAr ? "تمت الإضافة" : "Client Created",
          message: isAr
            ? `تمت إضافة الزبون ${customerFormData.fullName} وإنشاء ملفه المالي تلقائياً`
            : `Customer ${customerFormData.fullName} added with auto-generated financial account`,
          type: "success",
          category: "system",
        });
      } catch (err: unknown) {
        console.error(err);
        handleSupabaseError(err, OperationType.CREATE, "customers");
      } finally {
        setIsSubmitting(false);
      }
    },
    handleAddSource: async (e: FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;
      if (!sourceFormData.source_name) return;

      setIsSubmitting(true);
      try {
        const srcId2 = "source_" + sourceFormData.source_name;
        const account = await financialAccountService.createAccountForEntity(
          "source",
          srcId2,
          sourceFormData.source_name,
          settings.currency || orderCurrency || "YER",
          undefined,
          {
            accountPrefix: "2140",
            parentCode: "2140",
            accountType: "Liability",
            notes: `حساب ذمم مصدر طلبات: ${sourceFormData.source_name}`,
            updateEntity: false,
          }
        );
        const docRef = await createSourceRecord(srcId2, {
          name: sourceFormData.source_name,
          source_name: sourceFormData.source_name,
          type: sourceFormData.type,
          source_url: sourceFormData.source_url,
          contact_info: sourceFormData.contact_info,
          location: sourceFormData.location,
          notes: sourceFormData.notes,
          accountId: account.id,
          createdAt: Date.now(),
        });

        // Select newly created source
        setFormData(prev => ({
          ...prev,
          orderSourceId: docRef.id,
        }));

        setIsAddSourceOpen(false);
        setSourceFormData({
          source_name: "",
          type: "App",
          source_url: "",
          contact_info: "",
          location: "",
          notes: "",
        });

        notificationService.notify({
          title: isAr ? "تمت إضافة مصدر الشراء" : "Source Created",
          message: isAr
            ? "تم تسجيل مصدر الشراء وتحديده تلقائياً"
            : "Purchase source registered and selected",
          type: "success",
          category: "system",
        });
      } catch (err) {
        console.error(err);
        notificationService.notify({
          title: isAr ? "خطأ" : "Error",
          message: isAr ? "فشل إضافة مصدر الشراء" : "Failed to register source",
          type: "error",
          category: "system",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    handleAddShippingCompany: async (e: FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;
      if (!shippingCompanyFormData.name) return;

      setIsSubmitting(true);
      try {
        const shippingCompanyId =
          "shipping_comp_" + shippingCompanyFormData.name;
        const account = await financialAccountService.createAccountForEntity(
          "shipping_company",
          shippingCompanyId,
          shippingCompanyFormData.name,
          settings.currency || orderCurrency || "YER",
          undefined,
          {
            accountPrefix: "2150",
            parentCode: "2150",
            accountType: "Liability",
            notes: `حساب ذمم شركة شحن: ${shippingCompanyFormData.name}`,
            updateEntity: false,
          }
        );
        const docRef = await createShippingCompanyRecord(shippingCompanyId, {
          name: shippingCompanyFormData.name,
          contact_person: shippingCompanyFormData.contact_person,
          phone: shippingCompanyFormData.phone,
          tracking_url: shippingCompanyFormData.tracking_url,
          address: shippingCompanyFormData.address,
          notes: shippingCompanyFormData.notes,
          accountId: account.id,
          createdAt: Date.now(),
        });

        // Select newly created shipping company
        if (activeAddShippingIndex !== null) {
          if (
            typeof activeAddShippingIndex === "string" &&
            activeAddShippingIndex.startsWith("edit-")
          ) {
            const idx = parseInt(activeAddShippingIndex.split("-")[1]);
            updateUpdateShippingRow(
              idx,
              "shippingCompany",
              shippingCompanyFormData.name
            );
          } else if (typeof activeAddShippingIndex === "number") {
            updateShippingRow(
              activeAddShippingIndex,
              "shippingCompany",
              shippingCompanyFormData.name
            );
          }
          setActiveAddShippingIndex(null);
        } else {
          setFormData(prev => ({
            ...prev,
            shippingCompany: shippingCompanyFormData.name,
          }));
        }

        setIsAddShippingCompanyOpen(false);
        setShippingCompanyFormData({
          name: "",
          contact_person: "",
          phone: "",
          tracking_url: "",
          address: "",
          notes: "",
        });

        notificationService.notify({
          title: isAr ? "تمت إضافة شركة الشحن" : "Carrier Registered",
          message: isAr
            ? "تم تسجيل شركة الشحن الجديدة بنجاح وتحديدها"
            : "Carrier registered and selected",
          type: "success",
          category: "system",
        });
      } catch (err) {
        console.error(err);
        notificationService.notify({
          title: isAr ? "خطأ" : "Error",
          message: isAr ? "فشل إضافة شركة الشحن" : "Failed to register carrier",
          type: "error",
          category: "system",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  };
}
