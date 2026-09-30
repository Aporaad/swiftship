import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../../context/SettingsContext';
import { useRole } from '../../../hooks/useRole';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import { useOrderStatuses } from '../../../hooks/useOrderStatuses';
import { useOrderOptions } from '../../../hooks/useOrderOptions';
import { useItemCategories } from '../../../hooks/useItemCategories';
import { buildOrderParties, findOrderParty, toOrderPartyPayload } from '../../../services/orderPartyService';

// Icons
import {
  Package, ShoppingCart, Truck, Activity, Settings as SettingsIcon,
  Layers
} from 'lucide-react';

// Hooks (Separation of Business Logic from UI)
import { useOrderData } from '../hooks/useOrderData';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { useOrderFormState } from '../hooks/useOrderFormState';

import {
  OrdersDeckPageTab,
  ShipmentsStudioPageTab,
  ProductsManagementPageTab,
  ItemCategoriesManagementPageTab,
  OrderOptionsManagementPageTab,
  OrderStatusManagementPageTab,
  LiveTrackingPageTab
} from './tabs';

// Modals
import CreateOrderModal from '../../../components/orders/CreateOrderModal';
import EditOrderModal from '../../../components/orders/EditOrderModal';
import OrderDetailsModal from '../../../components/orders/OrderDetailsModal';
import OrderHistoryModal from '../../../components/orders/OrderHistoryModal';
import UpdateStatusModal from '../../../components/orders/UpdateStatusModal';
import PaymentModal from '../../../components/orders/PaymentModal';

export default function OrdersPage() {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';
  const { role, hasPermission, loading: roleLoading } = useRole();
  const location = useLocation();
  const { activeCurrencies, rates: dbRates } = useExchangeRates();
  const { statuses: orderStatusesList } = useOrderStatuses();
  const { packagingOptions, shippingCategoryOptions } = useOrderOptions();
  const { activeCategories: activeItemCategories } = useItemCategories();

  // Tab State
  const [ordersTab, setOrdersTab] = useState<'orders' | 'products' | 'shipments' | 'tracking' | 'statuses' | 'options' | 'item-categories'>('orders');

  // Handle URL query tabs
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'products') setOrdersTab('products');
    else if (tab === 'tracking') setOrdersTab('tracking');
    else if (tab === 'shipments') setOrdersTab('shipments');
    else if (tab === 'statuses') setOrdersTab('statuses');
    else if (tab === 'options') setOrdersTab('options');
    else if (tab === 'item-categories') setOrdersTab('item-categories');
  }, [location.search]);

  // Business Logic Hooks
  const {
    orders,
    customers,
    employees,
    couriers,
    sources,
    shippingCompanies,
    financialAccounts,
    allProducts,
    allShipments,
    loading: dataLoading
  } = useOrderData(!roleLoading);

  const orderCurrency = settings.defaultOrderCurrency || settings.currency || 'SAR';
  const formState = useOrderFormState(orderCurrency, settings.currency || 'YER');

  const {
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    courierFilter,
    setCourierFilter,
    sourceFilter,
    setSourceFilter,
    sortBy,
    setSortBy,
    filteredOrdersList
  } = useOrderFilters({ orders, customers, employees, couriers, sources });

  // Shipments Filter State
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState('');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('all');

  const filteredShipmentsList = useMemo(() => {
    return allShipments.filter(ship => {
      const q = shipmentSearchQuery.toLowerCase();
      const matchesSearch = !q || (ship.trackingNumber || ship.id || '').toLowerCase().includes(q);
      const matchesStatus = shipmentStatusFilter === 'all' || (ship.shipmentStatus || ship.status) === shipmentStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allShipments, shipmentSearchQuery, shipmentStatusFilter]);

  // Modal Control States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isOrderHistoryModalOpen, setIsOrderHistoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isAddShippingCompanyOpen, setIsAddShippingCompanyOpen] = useState(false);
  const [activeAddShippingIndex, setActiveAddShippingIndex] = useState<any>(null);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const canManageOrders = role === 'Admin' || hasPermission('manage_orders');
  const canEditOrderDefaultsCreation = role === 'Admin' || hasPermission('edit_order_defaults_creation');

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  const orderParties = useMemo(
    () => buildOrderParties(customers, employees, couriers),
    [customers, employees, couriers]
  );

  const selectedOrderParty = useMemo(
    () => findOrderParty(formState.formData, customers, employees, couriers),
    [formState.formData.customerId, formState.formData.orderPartyId, formState.formData.orderPartyType, customers, employees, couriers]
  );

  const filteredCustomersList = useMemo(() => {
    if (!customerSearchQuery.trim()) return [];
    return customers.filter(c =>
      (c.fullName || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      (c.phone || '').toLowerCase().includes(customerSearchQuery.toLowerCase())
    );
  }, [customerSearchQuery, customers]);

  const selectCustomer = (c: any) => {
    formState.setFormData(prev => ({
      ...prev,
      customerId: c.id,
      customerName: c.fullName || '',
      customerPhone: c.phone || '',
      customerAddress: c.address || '',
      orderPartyId: c.id,
      orderPartyType: 'customer',
      isStaffOrder: false,
      employeeId: '',
      courierId: '',
      orderPartyAccountId: c.financialAccountId || c.accountId || ''
    }));
    setCustomerSearchQuery('');
  };

  const clearSelectedCustomer = () => {
    formState.setFormData(prev => ({
      ...prev,
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderPartyId: '',
      employeeId: '',
      courierId: '',
      orderPartyAccountId: ''
    }));
  };

  const selectOrderParty = (party: any) => {
    formState.setFormData(prev => ({ ...prev, ...toOrderPartyPayload(party) }));
    setCustomerSearchQuery('');
  };

  const setIsStaffOrder = (val: boolean) => {
    clearSelectedCustomer();
    formState.setFormData(prev => ({ ...prev, isStaffOrder: val, orderPartyType: val ? 'employee' : 'customer' }));
  };

  return (
    <div className="space-y-6 pb-12 font-sans dir-rtl">

      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-slate-850 p-6 rounded-3xl">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-[#d4af37]" />
            {isAr ? 'إدارة الطلبات والعمليات اللوجستية' : 'Orders & Freight Management Studio'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAr ? 'متابعة الشحنات والطلبات، الإحصائيات الحية، وتتبع عمليات التسليم' : 'Monitor shipments, orders, live analytics, and delivery routes'}
          </p>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex bg-slate-955 p-1.5 rounded-2xl border border-slate-850 overflow-x-auto">
          {[
            { id: 'orders', label: isAr ? 'جدول الطلبات' : 'Orders Deck', icon: ShoppingCart },
            { id: 'shipments', label: isAr ? 'أستوديو الشحنات' : 'Shipments Studio', icon: Truck },
            { id: 'products', label: isAr ? 'إدارة المنتجات' : 'Products', icon: Package },
            { id: 'item-categories', label: isAr ? 'فئات المنتجات' : 'Categories', icon: Layers },
            { id: 'options', label: isAr ? 'إعدادات الطلبات' : 'Order Options', icon: SettingsIcon },
            { id: 'statuses', label: isAr ? 'حالات الطلبات' : 'Statuses', icon: Activity },
            { id: 'tracking', label: isAr ? 'التتبع المباشر' : 'Live Tracking', icon: Activity },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setOrdersTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${ordersTab === tab.id ? 'bg-[#d4af37] text-black' : 'text-slate-400 hover:text-white'}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}
      {ordersTab === 'products' ? (
        <ProductsManagementPageTab isAr={isAr} canManage={canManageOrders} orderCurrency={settings.currency || 'YER'} />
      ) : ordersTab === 'item-categories' ? (
        <ItemCategoriesManagementPageTab isAr={isAr} canManage={canManageOrders} />
      ) : ordersTab === 'options' ? (
        <OrderOptionsManagementPageTab isAr={isAr} canManage={canManageOrders} orderCurrency={settings.currency || 'YER'} />
      ) : ordersTab === 'statuses' ? (
        <OrderStatusManagementPageTab isAr={isAr} />
      ) : ordersTab === 'tracking' ? (
        <LiveTrackingPageTab />
      ) : ordersTab === 'shipments' ? (
        <ShipmentsStudioPageTab
          isAr={isAr}
          allShipments={allShipments}
          shipmentSearchTerm={shipmentSearchQuery}
          setShipmentSearchTerm={setShipmentSearchQuery}
          shipmentStatusFilter={shipmentStatusFilter}
          setShipmentStatusFilter={setShipmentStatusFilter}
          filteredShipmentsList={filteredShipmentsList}
          orders={orders}
          couriers={couriers}
          copyToClipboard={copyToClipboard}
        />
      ) : (
        <OrdersDeckPageTab
          isAr={isAr}
          filteredOrders={filteredOrdersList}
          orders={orders}
          searchTerm={searchText}
          setSearchTerm={setSearchText}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          courierFilter={courierFilter}
          setCourierFilter={setCourierFilter}
          canManageOrders={canManageOrders}
          role={role}
          hasPermission={hasPermission}
          handleOpenCreateOrder={() => setIsAddModalOpen(true)}
          setIsDetailsModalOpen={setIsDetailsModalOpen}
          setSelectedOrder={setSelectedOrder}
          handleOpenOrderHistory={(ord: any) => { setSelectedOrder(ord); setIsOrderHistoryModalOpen(true); }}
          handleOpenEditOrder={(ord: any) => { setSelectedOrder(ord); setIsEditOrderModalOpen(true); }}
          handleOpenUpdateStatus={(ord: any) => { setSelectedOrder(ord); setIsUpdateModalOpen(true); }}
          handleOpenCollectPayment={(ord: any) => { setSelectedOrder(ord); setIsPaymentModalOpen(true); }}
          generateOrderInvoicePDF={() => {}}
          settings={settings}
          handleOpenDeleteOrder={(ord: any) => { setSelectedOrder(ord); setIsDeleteModalOpen(true); }}
          sources={sources}
          couriers={couriers}
        />
      )}


      {/* MODALS */}
      {isAddModalOpen && (
        <CreateOrderModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          isAr={isAr}
          role={role}
          hasPermission={hasPermission}
          canEditOrderDefaultsCreation={canEditOrderDefaultsCreation}
          isSubmitting={isSubmitting}
          formData={formState.formData}
          setFormData={formState.setFormData}
          previewOrderNumber="ALX-AUTO"
          customerProfileStats={null}
          orderParties={orderParties}
          selectedOrderParty={selectedOrderParty}
          isStaffOrder={formState.formData.isStaffOrder}
          setIsStaffOrder={setIsStaffOrder}
          selectOrderParty={selectOrderParty}
          customerSearchQuery={customerSearchQuery}
          setCustomerSearchQuery={setCustomerSearchQuery}
          filteredCustomers={filteredCustomersList}
          selectCustomer={selectCustomer}
          clearSelectedCustomer={clearSelectedCustomer}
          setIsAddCustomerOpen={setIsAddCustomerOpen}
          setCustomerFormData={formState.setCustomerFormData}
          setIsAddSourceOpen={setIsAddSourceOpen}
          sources={sources}
          cartShareCode={formState.cartShareCode}
          setCartShareCode={formState.setCartShareCode}
          items={formState.items}
          addItemRow={formState.addItemRow}
          updateItemRow={formState.updateItemRow}
          removeItemRow={formState.removeItemRow}
          bankCommissionEnabled={formState.bankCommissionEnabled}
          setBankCommissionEnabled={formState.setBankCommissionEnabled}
          bankCommissionType={formState.bankCommissionType}
          setBankCommissionType={formState.setBankCommissionType}
          bankCommissionRate={formState.bankCommissionRate}
          setBankCommissionRate={formState.setBankCommissionRate}
          couponEnabled={formState.couponEnabled}
          setCouponEnabled={formState.setCouponEnabled}
          couponRate={formState.couponRate}
          setCouponRate={formState.setCouponRate}
          addShippingEnabled={formState.addShippingEnabled}
          setAddShippingEnabled={formState.setAddShippingEnabled}
          shippings={formState.shippings}
          addShippingRow={formState.addShippingRow}
          updateShippingRow={formState.updateShippingRow}
          removeShippingRow={formState.removeShippingRow}
          shippingCompanies={shippingCompanies}
          setIsAddShippingCompanyOpen={setIsAddShippingCompanyOpen}
          setActiveAddShippingIndex={setActiveAddShippingIndex}
          packagingFeeEnabled={formState.packagingFeeEnabled}
          setPackagingFeeEnabled={formState.setPackagingFeeEnabled}
          packagingFeeRate={formState.packagingFeeRate}
          setPackagingFeeRate={formState.setPackagingFeeRate}
          couriers={couriers}
          profitPerKgRate={formState.profitPerKgRate}
          setProfitPerKgRate={formState.setProfitPerKgRate}
          cbmShippingRateValue={formState.cbmShippingRateValue}
          setCbmShippingRateValue={formState.setCbmShippingRateValue}
          settings={settings}
          calcs={{}}
          activeCurrencies={activeCurrencies}
          financialAccounts={financialAccounts}
          packagingOptions={packagingOptions}
          shippingCategoryOptions={shippingCategoryOptions}
          itemCategories={activeItemCategories}
          homeDeliveryEnabled={formState.homeDeliveryEnabled}
          setHomeDeliveryEnabled={formState.setHomeDeliveryEnabled}
          viaShippingAgent={formState.viaShippingAgent}
          setViaShippingAgent={formState.setViaShippingAgent}
          payLater={formState.payLater}
          setPayLater={formState.setPayLater}
          directApprove={formState.directApprove}
          setDirectApprove={formState.setDirectApprove}
          orderStatuses={orderStatusesList}
          handleCreateOrder={(e) => { e.preventDefault(); setIsAddModalOpen(false); }}
        />
      )}

      {isEditOrderModalOpen && selectedOrder && (
        <EditOrderModal
          isOpen={isEditOrderModalOpen}
          onClose={() => setIsEditOrderModalOpen(false)}
          orderToEdit={selectedOrder}
          customers={customers}
          employees={employees}
          sources={sources}
          couriers={couriers}
          shippingCompanies={shippingCompanies}
          activeCurrencies={activeCurrencies}
          financialAccounts={financialAccounts}
          packagingOptions={packagingOptions}
          shippingCategoryOptions={shippingCategoryOptions}
          itemCategories={activeItemCategories}
          settings={settings}
          isAr={isAr}
        />
      )}

      {isUpdateModalOpen && selectedOrder && (
        <UpdateStatusModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          selectedOrder={selectedOrder}
          updateFormData={formState.updateFormData}
          setUpdateFormData={formState.setUpdateFormData}
          updateShippings={formState.updateShippings}
          setUpdateShippings={formState.setUpdateShippings}
          orderStatusesList={orderStatusesList}
          couriers={couriers}
          canManageOrders={canManageOrders}
          isSubmitting={isSubmitting}
          isAr={isAr}
          onSubmit={(e) => { e.preventDefault(); setIsUpdateModalOpen(false); }}
          setIsAddShippingCompanyOpen={setIsAddShippingCompanyOpen}
          setActiveAddShippingIndex={setActiveAddShippingIndex}
          shippingCompanies={shippingCompanies}
          role={role}
          hasPermission={hasPermission}
        />
      )}

      {isPaymentModalOpen && selectedOrder && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          selectedOrder={selectedOrder}
          paymentFormData={formState.paymentFormData}
          setPaymentFormData={formState.setPaymentFormData}
          isSubmitting={isSubmitting}
          isAr={isAr}
          financialAccounts={financialAccounts}
          activeCurrencies={activeCurrencies}
          dbRates={dbRates}
          onSubmit={(e) => { e.preventDefault(); setIsPaymentModalOpen(false); }}
        />
      )}

      {isDetailsModalOpen && selectedOrder && (
        <OrderDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          selectedOrder={selectedOrder}
          isAr={isAr}
          settings={settings}
          orderStatusesList={orderStatusesList}
        />
      )}

      {isOrderHistoryModalOpen && selectedOrder && (
        <OrderHistoryModal
          isOpen={isOrderHistoryModalOpen}
          onClose={() => setIsOrderHistoryModalOpen(false)}
          context={{
            orderId: selectedOrder.id,
            label: selectedOrder.orderNumber || selectedOrder.id,
            entityType: 'order'
          }}
          isAr={isAr}
        />
      )}

    </div>
  );
}

