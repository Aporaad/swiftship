import React from 'react';
import CreateOrderModal from '../../../../components/orders/CreateOrderModal';
import EditOrderModal from '../../../../components/orders/EditOrderModal';
import { CustomerCreateModal, ShippingCompanyCreateModal, SourceCreateModal } from '../../../../components/entities/EntityCreateModals';
import UpdateStatusModal from '../../../../components/orders/UpdateStatusModal';
import PaymentModal from '../../../../components/orders/PaymentModal';
import OrderDetailsModal from '../../../../components/orders/OrderDetailsModal';
import OrderHistoryModal from '../../../../components/orders/OrderHistoryModal';
import DeleteOrderModal from '../../../../components/orders/DeleteOrderModal';
import ShipmentFormModal from '../../../../components/shipments/ShipmentFormModal';
import ConfirmModal from '../../../../components/ConfirmModal';

export interface OrdersPageDialogsProps {
  [key: string]: any;
}

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
  } = props;
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
  } = props;
  const createFormData = formData;
  const setCreateFormData = setOrderFormData;
  return (
    <>
      {/* CREATE ORDER LARGE MODAL واجهه نموذج انشاء طلب*/}
      <CreateOrderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        isAr={isAr}
        role={role}
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
        onCreated={(source) => setFormData((previous) => ({ ...previous, orderSourceId: source.id, orderSourceName: source.name, orderSourceType: source.type }))}
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
            setFormData((previous) => ({ ...previous, shippingCompany: company.name }));
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
        role={role}
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
