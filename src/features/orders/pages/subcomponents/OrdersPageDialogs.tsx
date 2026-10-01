import React from 'react';
import CreateOrderModal, { type CreateOrderModalProps } from '../../../../components/orders/CreateOrderModal';
import EditOrderModal from '../../../../components/orders/EditOrderModal';
import { CustomerCreateModal, ShippingCompanyCreateModal, SourceCreateModal } from '../../../../components/entities/EntityCreateModals';
import UpdateStatusModal from '../../../../components/orders/UpdateStatusModal';
import PaymentModal from '../../../../components/orders/PaymentModal';
import OrderDetailsModal from '../../../../components/orders/OrderDetailsModal';
import OrderHistoryModal from '../../../../components/orders/OrderHistoryModal';
import DeleteOrderModal from '../../../../components/orders/DeleteOrderModal';
import ShipmentFormModal from '../../../../components/shipments/ShipmentFormModal';
import ConfirmModal from '../../../../components/ConfirmModal';
import type { ItemCategory } from '../../../../services/itemCategoryService';
import type { ItemRow, OrderFormData, PaymentFormData, ShippingRow, ShipmentFormData, UpdateFormData } from '../../types';
import type { OrderDataState } from '../../hooks/useOrderData';
import type { OrderHistoryContext } from '../../../../services/orderHistoryService';
import type { OrderStatusItem } from '../../../../hooks/useOrderStatuses';
import type { Currency } from '../../../../services/currencyService';

export interface OrdersPageDialogsProps {
  [key: string]: unknown;
}

type CreateDialogProps = CreateOrderModalProps;

type DialogValues = Record<string, unknown> & {
  [key: string]: unknown;
  isAddModalOpen: boolean; setIsAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isEditOrderModalOpen: boolean; setIsEditOrderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  orderToEdit: OrderDataState['orders'][number] | null; setOrderToEdit: React.Dispatch<React.SetStateAction<OrderDataState['orders'][number] | null>>;
  isAddCustomerOpen: boolean; setIsAddCustomerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAddSourceOpen: boolean; setIsAddSourceOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAddShippingCompanyOpen: boolean; setIsAddShippingCompanyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAr: boolean; settings: CreateDialogProps['settings']; employees: OrderDataState['employees']; customers: OrderDataState['customers']; sources: CreateDialogProps['sources'];
  customerFormData: CreateDialogProps['setCustomerFormData'] extends React.Dispatch<React.SetStateAction<infer T>> ? T : never; setCustomerFormData: CreateDialogProps['setCustomerFormData'];
  selectOrderParty: CreateDialogProps['selectOrderParty']; setFormData: React.Dispatch<React.SetStateAction<OrderFormData>>;
  activeAddShippingIndex: number | string | null; updateUpdateShippingRow: (...args: unknown[]) => unknown; updateShippingRow: (...args: unknown[]) => unknown;
  setActiveAddShippingIndex: React.Dispatch<React.SetStateAction<number | string | null>>; shippingCompanyFormData: Record<string, string>;
  isUpdateModalOpen: boolean; setIsUpdateModalOpen: React.Dispatch<React.SetStateAction<boolean>>; selectedOrder: OrderDataState['orders'][number] | null;
  updateFormData: UpdateFormData; setUpdateFormData: React.Dispatch<React.SetStateAction<UpdateFormData>>; updateShippings: ShippingRow[];
  setUpdateShippings: React.Dispatch<React.SetStateAction<ShippingRow[]>>; orderStatusesList: OrderStatusItem[]; couriers: OrderDataState['couriers']; canManageOrders: boolean; isSubmitting: boolean;
  handleUpdateStatus: (...args: unknown[]) => unknown; shippingCompanies: OrderDataState['shippingCompanies']; role: string | null; hasPermission: (permission: string) => boolean;
  isPaymentModalOpen: boolean; setIsPaymentModalOpen: React.Dispatch<React.SetStateAction<boolean>>; paymentFormData: React.ComponentProps<typeof PaymentModal>['paymentFormData'];
  setPaymentFormData: React.ComponentProps<typeof PaymentModal>['setPaymentFormData']; financialAccounts: OrderDataState['financialAccounts']; activeCurrencies: Currency[]; dbRates: NonNullable<React.ComponentProps<typeof PaymentModal>['dbRates']>;
  handleCollectPayment: (...args: unknown[]) => unknown; setSelectedOrder: React.Dispatch<React.SetStateAction<OrderDataState['orders'][number] | null>>;
  isDetailsModalOpen: boolean; setIsDetailsModalOpen: React.Dispatch<React.SetStateAction<boolean>>; orderHistoryContext: OrderHistoryContext | null; isOrderHistoryOpen: boolean;
  setIsOrderHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>; setOrderHistoryContext: React.Dispatch<React.SetStateAction<OrderHistoryContext | null>>;
  isDeleteModalOpen: boolean; orderToDelete: OrderDataState['orders'][number] | null; setOrderToDelete: React.Dispatch<React.SetStateAction<OrderDataState['orders'][number] | null>>; ordersPendingDelete: OrderDataState['orders'][number][];
  isBatchUpdating: boolean; deletePin: string; deleteError: string; setDeletePin: React.Dispatch<React.SetStateAction<string>>; setDeleteError: React.Dispatch<React.SetStateAction<string>>;
  setIsDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>; setOrdersPendingDelete: React.Dispatch<React.SetStateAction<OrderDataState['orders'][number][]>>; handleVerifyDeletePin: () => unknown;
  isAddShipmentModalOpen: boolean; isEditShipmentModalOpen: boolean; shipmentFormData: ShipmentFormData; setShipmentFormData: React.Dispatch<React.SetStateAction<ShipmentFormData>>; orders: OrderDataState['orders'][number][];
  shippingCategoryOptions: ItemCategory[]; activeItemCategories: ItemCategory[]; handleSaveShipmentSubmit: (...args: unknown[]) => unknown;
  setIsAddShipmentModalOpen: React.Dispatch<React.SetStateAction<boolean>>; setIsEditShipmentModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDeleteShipmentModalOpen: boolean; setIsDeleteShipmentModalOpen: React.Dispatch<React.SetStateAction<boolean>>; shipmentToDelete: { id: string; trackingNumber?: string | null } | null; handleDeleteShipmentSubmit: () => unknown;
  canEditOrderDefaultsCreation: boolean; formData: OrderFormData; previewOrderNumber: string; customerProfileStats: CreateDialogProps['customerProfileStats']; orderParties: CreateDialogProps['orderParties']; selectedOrderParty: CreateDialogProps['selectedOrderParty'];
  setIsStaffOrder: CreateDialogProps['setIsStaffOrder']; customerSearchQuery: string; setCustomerSearchQuery: (value: string) => void; filteredCustomers: CreateDialogProps['filteredCustomers']; selectCustomer: CreateDialogProps['selectCustomer'];
  clearSelectedCustomer: CreateDialogProps['clearSelectedCustomer']; cartShareCode: string; setCartShareCode: (value: string) => void; items: CreateDialogProps['items']; addItemRow: () => void; updateItemRow: CreateDialogProps['updateItemRow']; removeItemRow: (idx: number) => void;
  bankCommissionEnabled: boolean; setBankCommissionEnabled: (value: boolean) => void; bankCommissionType: 'percentage' | 'fixed'; setBankCommissionType: (value: 'percentage' | 'fixed') => void; bankCommissionRate: number; setBankCommissionRate: (value: number) => void;
  couponEnabled: boolean; setCouponEnabled: (value: boolean) => void; couponRate: number; setCouponRate: (value: number) => void; addShippingEnabled: boolean; setAddShippingEnabled: (value: boolean) => void; shippings: CreateDialogProps['shippings']; addShippingRow: () => void; removeShippingRow: CreateDialogProps['removeShippingRow'];
  packagingFeeEnabled: boolean; setPackagingFeeEnabled: (value: boolean) => void; packagingFeeRate: number; setPackagingFeeRate: (value: number) => void; profitPerKgRate: number; setProfitPerKgRate: (value: number) => void; cbmShippingRateValue: number; setCbmShippingRateValue: (value: number) => void; calcs: CreateDialogProps['calcs']; packagingOptions: NonNullable<CreateDialogProps['packagingOptions']>; itemCategories: NonNullable<CreateDialogProps['itemCategories']>;
  homeDeliveryEnabled: boolean; setHomeDeliveryEnabled: (value: boolean) => void; viaShippingAgent: boolean; setViaShippingAgent: (value: boolean) => void; payLater: boolean; setPayLater: (value: boolean) => void; directApprove: boolean; setDirectApprove: (value: boolean) => void; handleCreateOrder: CreateDialogProps['handleCreateOrder'];
};

export function OrdersPageDialogs(props: OrdersPageDialogsProps) {
  const {
    isAddModalOpen,
    setIsAddModalOpen,
    isEditOrderModalOpen,
    setIsEditOrderModalOpen,
    orderToEdit,
    setOrderToEdit,
    isAddCustomerOpen,
    setIsAddCustomerOpen,
    isAddSourceOpen,
    setIsAddSourceOpen,
    isAddShippingCompanyOpen,
    setIsAddShippingCompanyOpen,
    isAr,
    settings,
    employees,
    customers,
    sources,
    customerFormData,
    setCustomerFormData,
    selectOrderParty,
    setFormData,
    activeAddShippingIndex,
    updateUpdateShippingRow,
    updateShippingRow,
    setActiveAddShippingIndex,
    shippingCompanyFormData,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    selectedOrder,
    updateFormData,
    setUpdateFormData,
    updateShippings,
    setUpdateShippings,
    orderStatusesList,
    couriers,
    canManageOrders,
    isSubmitting,
    handleUpdateStatus,
    setActiveAddShippingIndex: setActiveShippingIndex = setActiveAddShippingIndex,
    shippingCompanies,
    role,
    hasPermission,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    paymentFormData,
    setPaymentFormData,
    financialAccounts,
    activeCurrencies,
    dbRates,
    handleCollectPayment,
    setSelectedOrder,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    orderHistoryContext,
    isOrderHistoryOpen,
    setIsOrderHistoryOpen,
    setOrderHistoryContext,
    orderStatusesList: detailsOrderStatuses = orderStatusesList,
    isDeleteModalOpen,
    orderToDelete,
    setOrderToDelete,
    ordersPendingDelete,
    isBatchUpdating,
    deletePin,
    deleteError,
    setDeletePin,
    setDeleteError,
    setIsDeleteModalOpen,
    setOrdersPendingDelete,
    handleVerifyDeletePin,
    isAddShipmentModalOpen,
    isEditShipmentModalOpen,
    shipmentFormData,
    setShipmentFormData,
    orders,
    shippingCategoryOptions,
    activeItemCategories,
    handleSaveShipmentSubmit,
    setIsAddShipmentModalOpen,
    setIsEditShipmentModalOpen,
    isDeleteShipmentModalOpen,
    setIsDeleteShipmentModalOpen,
    shipmentToDelete,
    handleDeleteShipmentSubmit,
    // CreateOrderModal props are spread as an explicit pass-through below.
  } = props as unknown as DialogValues;
  const {
    canEditOrderDefaultsCreation,
    formData,
    setFormData: setOrderFormData,
    previewOrderNumber,
    customerProfileStats,
    orderParties,
    selectedOrderParty,
    setIsStaffOrder,
    customerSearchQuery,
    setCustomerSearchQuery,
    filteredCustomers,
    selectCustomer,
    clearSelectedCustomer,
    cartShareCode,
    setCartShareCode,
    items,
    addItemRow,
    updateItemRow,
    removeItemRow,
    bankCommissionEnabled,
    setBankCommissionEnabled,
    bankCommissionType,
    setBankCommissionType,
    bankCommissionRate,
    setBankCommissionRate,
    couponEnabled,
    setCouponEnabled,
    couponRate,
    setCouponRate,
    addShippingEnabled,
    setAddShippingEnabled,
    shippings,
    addShippingRow,
    updateShippingRow: updateCreateShippingRow,
    removeShippingRow,
    packagingFeeEnabled,
    setPackagingFeeEnabled,
    packagingFeeRate,
    setPackagingFeeRate,
    profitPerKgRate,
    setProfitPerKgRate,
    cbmShippingRateValue,
    setCbmShippingRateValue,
    calcs,
    packagingOptions,
    shippingCategoryOptions: createShippingCategoryOptions,
    itemCategories,
    homeDeliveryEnabled,
    setHomeDeliveryEnabled,
    viaShippingAgent,
    setViaShippingAgent,
    payLater,
    setPayLater,
    directApprove,
    setDirectApprove,
    handleCreateOrder,
  } = props as unknown as DialogValues;
  const createFormData = formData;
  const setCreateFormData = setOrderFormData;
  return (
    <>
      {/* CREATE ORDER LARGE MODAL واجهه نموذج انشاء طلب*/}
      <CreateOrderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        isAr={isAr}
        role={role || ''}
        hasPermission={hasPermission}
        canEditOrderDefaultsCreation={canEditOrderDefaultsCreation}
        isSubmitting={isSubmitting}
        formData={createFormData}
        setFormData={setCreateFormData}
        previewOrderNumber={previewOrderNumber}
        customerProfileStats={customerProfileStats}
        orderParties={orderParties}
        selectedOrderParty={selectedOrderParty}
        isStaffOrder={Boolean(formData.isStaffOrder)}
        setIsStaffOrder={setIsStaffOrder}
        selectOrderParty={selectOrderParty}
        customerSearchQuery={customerSearchQuery}
        setCustomerSearchQuery={setCustomerSearchQuery}
        filteredCustomers={filteredCustomers}
        selectCustomer={selectCustomer}
        clearSelectedCustomer={clearSelectedCustomer}
        setIsAddCustomerOpen={setIsAddCustomerOpen}
        setCustomerFormData={setCustomerFormData}
        setIsAddSourceOpen={setIsAddSourceOpen}
        sources={sources}
        cartShareCode={cartShareCode}
        setCartShareCode={setCartShareCode}
        items={items}
        addItemRow={addItemRow}
        updateItemRow={updateItemRow}
        removeItemRow={removeItemRow}
        bankCommissionEnabled={bankCommissionEnabled}
        setBankCommissionEnabled={setBankCommissionEnabled}
        bankCommissionType={bankCommissionType}
        setBankCommissionType={setBankCommissionType}
        bankCommissionRate={bankCommissionRate}
        setBankCommissionRate={setBankCommissionRate}
        couponEnabled={couponEnabled}
        setCouponEnabled={setCouponEnabled}
        couponRate={couponRate}
        setCouponRate={setCouponRate}
        addShippingEnabled={addShippingEnabled}
        setAddShippingEnabled={setAddShippingEnabled}
        shippings={shippings}
        addShippingRow={addShippingRow}
        updateShippingRow={updateCreateShippingRow}
        removeShippingRow={removeShippingRow}
        shippingCompanies={shippingCompanies}
        setIsAddShippingCompanyOpen={setIsAddShippingCompanyOpen}
        setActiveAddShippingIndex={setActiveShippingIndex}
        packagingFeeEnabled={packagingFeeEnabled}
        setPackagingFeeEnabled={setPackagingFeeEnabled}
        packagingFeeRate={packagingFeeRate}
        setPackagingFeeRate={setPackagingFeeRate}
        couriers={couriers}
        profitPerKgRate={profitPerKgRate}
        setProfitPerKgRate={setProfitPerKgRate}
        cbmShippingRateValue={cbmShippingRateValue}
        setCbmShippingRateValue={setCbmShippingRateValue}
        settings={settings}
        calcs={calcs}
        activeCurrencies={activeCurrencies}
        financialAccounts={financialAccounts}
        packagingOptions={packagingOptions}
        shippingCategoryOptions={createShippingCategoryOptions}
        itemCategories={activeItemCategories}
        homeDeliveryEnabled={homeDeliveryEnabled}
        setHomeDeliveryEnabled={setHomeDeliveryEnabled}
        viaShippingAgent={viaShippingAgent}
        setViaShippingAgent={setViaShippingAgent}
        payLater={payLater}
        setPayLater={setPayLater}
        directApprove={directApprove}
        setDirectApprove={setDirectApprove}
        orderStatuses={orderStatusesList}
        handleCreateOrder={handleCreateOrder}
      />

      {/* EDIT ORDER FULL DATA MODAL واجهة نموذج تعديل بيانات الطلب */}
      <EditOrderModal
        isOpen={isEditOrderModalOpen}
        onClose={() => {
          setIsEditOrderModalOpen(false);
          setOrderToEdit(null);
        }}
        orderToEdit={orderToEdit}
        customers={customers}
        employees={employees}
        sources={sources}
        couriers={couriers}
        shippingCompanies={shippingCompanies}
        activeCurrencies={activeCurrencies}
        packagingOptions={packagingOptions}
        shippingCategoryOptions={shippingCategoryOptions}
        itemCategories={activeItemCategories}
        settings={settings}
        isAr={isAr}
      />


      <CustomerCreateModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        isAr={isAr}
        settings={settings}
        initialName={customerFormData.fullName}
        onCreated={(customer) => {
          void selectOrderParty({ id: customer.id, type: 'customer', name: customer.fullName, phone: customer.phone, email: customer.email, accountId: customer.accountId, raw: customer });
          setCustomerFormData({ fullName: '', phone: '', email: '', gps_location: '', address: '', notes: '' });
        }}
      />
      <SourceCreateModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        isAr={isAr}
        settings={settings}
        onCreated={(source) => setFormData((previous: OrderFormData) => ({ ...previous, orderSourceId: source.id, orderSourceName: source.name, orderSourceType: source.type }))}
      />
      <ShippingCompanyCreateModal
        isOpen={isAddShippingCompanyOpen}
        onClose={() => setIsAddShippingCompanyOpen(false)}
        isAr={isAr}
        settings={settings}
        onCreated={(company) => {
          if (activeAddShippingIndex !== null) {
            if (typeof activeAddShippingIndex === 'string' && activeAddShippingIndex.startsWith('edit-')) {
              updateUpdateShippingRow(parseInt(activeAddShippingIndex.split('-')[1]), 'shippingCompany', company.name);
            } else if (typeof activeAddShippingIndex === 'number') {
              updateShippingRow(activeAddShippingIndex, 'shippingCompany', company.name);
            }
            setActiveAddShippingIndex(null);
          } else {
            setFormData((previous: OrderFormData) => ({ ...previous, shippingCompany: company.name }));
          }
        }}
      />

      {/* UPDATE STATUS MODAL نموذج تحديث حاله ومسار الطلب */}
      <UpdateStatusModal
        isOpen={isUpdateModalOpen}
        selectedOrder={selectedOrder}
        updateFormData={updateFormData}
        setUpdateFormData={setUpdateFormData}
        updateShippings={updateShippings}
        setUpdateShippings={setUpdateShippings}
        orderStatusesList={orderStatusesList}
        couriers={couriers}
        canManageOrders={canManageOrders}
        isSubmitting={isSubmitting}
        isAr={isAr}
        onClose={() => setIsUpdateModalOpen(false)}
        onSubmit={handleUpdateStatus}
        setIsAddShippingCompanyOpen={setIsAddShippingCompanyOpen}
        setActiveAddShippingIndex={setActiveShippingIndex}
        shippingCompanies={shippingCompanies}
        role={role || ''}
        hasPermission={hasPermission}
      />

      {/* COLLECT PAYMENT MODAL نموذج تحصيل دفعة مالية من العميل*/}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        selectedOrder={selectedOrder}
        paymentFormData={paymentFormData}
        setPaymentFormData={setPaymentFormData}
        isSubmitting={isSubmitting}
        isAr={isAr}
        financialAccounts={financialAccounts}
        activeCurrencies={activeCurrencies}
        dbRates={dbRates}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedOrder(null);
        }}
        onSubmit={handleCollectPayment}
      />

      {/* ORDER DETAILS MODAL كشف الفاتورة المطبوعة وتتبع كود الشحنة*/}
      <OrderDetailsModal
        isOpen={isDetailsModalOpen}
        selectedOrder={selectedOrder}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedOrder(null);
        }}
        isAr={isAr}
        settings={settings}
        orderStatusesList={orderStatusesList}
      />

      <OrderHistoryModal
        isOpen={isOrderHistoryOpen}
        context={orderHistoryContext}
        onClose={() => {
          setIsOrderHistoryOpen(false);
          setOrderHistoryContext(null);
        }}
        isAr={isAr}
      />

      {/* DELETE ORDER SECURITY PIN MODAL نموذج تاكيد الحذف*/}
      <DeleteOrderModal
        isOpen={isDeleteModalOpen}
        orderToDelete={orderToDelete}
        orderCount={ordersPendingDelete.length || 1}
        isDeleting={isBatchUpdating}
        deletePin={deletePin}
        deleteError={deleteError}
        setDeletePin={setDeletePin}
        setDeleteError={setDeleteError}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setOrderToDelete(null);
          setOrdersPendingDelete([]);
          setDeleteError('');
        }}
        onVerify={handleVerifyDeletePin}
        isAr={isAr}
      />



      {/* Add / Edit Shipment Modal نموذج انشاء/تعديل شحنه*/}
      <ShipmentFormModal
        isOpen={isAddShipmentModalOpen || isEditShipmentModalOpen}
        isEdit={isEditShipmentModalOpen}
        shipmentFormData={shipmentFormData}
        setShipmentFormData={setShipmentFormData}
        orders={orders}
        shippingCompanies={shippingCompanies}
        couriers={couriers}
        shippingCategoryOptions={shippingCategoryOptions}
        itemCategories={activeItemCategories}
        orderStatusesList={orderStatusesList}
        isSubmitting={isSubmitting}
        isAr={isAr}
        onClose={() => {
          setIsAddShipmentModalOpen(false);
          setIsEditShipmentModalOpen(false);
        }}
        onSubmit={handleSaveShipmentSubmit}
      />


      {/* Delete Shipment Confirm Modal نموذج تاكيد حذف شحنه*/}
      {isDeleteShipmentModalOpen && shipmentToDelete && (
        <ConfirmModal
          isOpen={isDeleteShipmentModalOpen}
          onClose={() => setIsDeleteShipmentModalOpen(false)}
          onConfirm={handleDeleteShipmentSubmit}
          title={isAr ? 'حذف الشحنة' : 'Delete Shipment'}
          message={isAr ? `هل أنت تأكد من حذف الشحنة رقم: (${shipmentToDelete.trackingNumber || shipmentToDelete.id})؟` : `Delete shipment ${shipmentToDelete.trackingNumber || shipmentToDelete.id}?`}
          confirmText={isAr ? 'حذف نهائي' : 'Delete'}
          type="danger"
        />
      )}

    </>
  );
}
