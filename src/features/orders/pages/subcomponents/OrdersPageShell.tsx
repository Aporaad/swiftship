import React from 'react';
import { Activity, AlertCircle, Boxes, CheckCircle2, Layers, MapPin, Package, Plus, Printer, Search, Trash2, Truck } from 'lucide-react';
import Tracking from '../../../shipments/pages/TrackingPage';
import { financialAccountService } from '../../../../services/financialAccountService';
import { exportOrdersToPDF, exportOrdersToCSV, generateOrderInvoicePDF } from '../../../../reports';
import { safeToDate } from '../../../../data/legacy/legacy-adapter';
import OrderStatusManagementTab from '../../../../components/OrderStatusManagementTab';
import OrderOptionsManagementTab from '../../../../components/orders/OrderOptionsManagementTab';
import ItemCategoriesManagementTab from '../../../../components/orders/ItemCategoriesManagementTab';
import ProductsManagementTab from '../../../../components/orders/ProductsManagementTab';
import { OrdersTable } from '../../components/OrdersTable';
import { OrderFilters } from '../../components/OrderFilters';
import { ShipmentsTable } from '../../components/ShipmentsTable';
import type { OrderRecord, OrdersTab, ShipmentRecord } from '../../types';
import type { ExchangeRates } from '../../../../services/currencyService';
import type { Settings } from '../../../../context/SettingsContext';

type StatusRecord = { id: string | number; nameAr: string; nameEn: string; sortOrder?: number };
type CourierRecord = { id: string; fullName?: string };
type ShippingCompanyRecord = { id: string; name: string };
type SettingsRecord = Settings;

type OrdersPageShellProps = {
  children?: React.ReactNode;
  isAr: boolean;
  t: (key: string) => string;
  role: string;
  hasPermission: (permission: string) => boolean;
  filteredOrdersList: OrderRecord[];
  canAddOrders: boolean;
  resetCreateForm: () => void;
  setIsAddModalOpen: (open: boolean) => void;
  ordersTab: string;
  setOrdersTab: (tab: OrdersTab) => void;
  orders: OrderRecord[];
  allProducts: Array<{ id?: string }>;
  allShipments: ShipmentRecord[];
  canTrackOrders: boolean;
  canViewOrderStatuses: boolean;
  orderStatusesList: StatusRecord[];
  orderOptionsList: Array<{ id?: string }>;
  activeItemCategories: Array<{ id?: string }>;
  canManageOrders: boolean;
  orderCurrency: string;
  searchText: string;
  setSearchText: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  courierFilter: string;
  setCourierFilter: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  shipmentSearchQuery: string;
  setShipmentSearchQuery: (value: string) => void;
  shipmentStatusFilter: string;
  setShipmentStatusFilter: (value: string) => void;
  shipmentCarrierFilter: string;
  setShipmentCarrierFilter: (value: string) => void;
  shippingCompanies: ShippingCompanyRecord[];
  handleOpenAddShipmentModal: () => void;
  filteredShipmentsList: ShipmentRecord[];
  couriers: CourierRecord[];
  copyToClipboard: (value: string | undefined) => void;
  handleQuickShipmentStatusChange: (shipmentId: string, status: string) => void;
  handleOpenEditShipmentModal: (shipment: ShipmentRecord) => void;
  handleOpenShipmentHistory: (shipment: ShipmentRecord) => void;
  setShipmentToDelete: (shipment: ShipmentRecord) => void;
  setIsDeleteShipmentModalOpen: (open: boolean) => void;
  selectedOrderIds: string[];
  exportOrdersToPDF?: (orders: OrderRecord[], isAr: boolean) => void;
  exportOrdersToCSV?: (orders: OrderRecord[], isAr: boolean) => void;
  handleOpenBatchDelete: () => void;
  isBatchUpdating: boolean;
  setSelectedOrderIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleSelectAll: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleToggleSelect: (id: string) => void;
  handleOpenOrderHistory: (order: OrderRecord) => void;
  handleOpenEditOrder: (order: OrderRecord) => void;
  handleOpenUpdateStatus: (order: OrderRecord) => void;
  handleOpenCollectPayment: (order: OrderRecord) => void;
  setSelectedOrder: (order: OrderRecord | null) => void;
  setIsDetailsModalOpen: (open: boolean) => void;
  generateOrderInvoicePDF?: (order: OrderRecord, isAr: boolean, settings: SettingsRecord) => void;
  handleOpenDeleteOrder: (order: OrderRecord) => void;
  settings: SettingsRecord;
  dbRates: ExchangeRates;
};

export function OrdersPageShell(props: OrdersPageShellProps) {
  const {
    children,
    isAr,
    t,
    role,
    hasPermission,
    filteredOrdersList,
    canAddOrders,
    resetCreateForm,
    setIsAddModalOpen,
    ordersTab,
    setOrdersTab,
    orders,
    allProducts,
    allShipments,
    canTrackOrders,
    canViewOrderStatuses,
    orderStatusesList,
    orderOptionsList,
    activeItemCategories,
    canManageOrders,
    orderCurrency,
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    courierFilter,
    setCourierFilter,
    sortBy,
    setSortBy,
    shipmentSearchQuery,
    setShipmentSearchQuery,
    shipmentStatusFilter,
    setShipmentStatusFilter,
    shipmentCarrierFilter,
    setShipmentCarrierFilter,
    shippingCompanies,
    handleOpenAddShipmentModal,
    filteredShipmentsList,
    couriers,
    copyToClipboard,
    handleQuickShipmentStatusChange,
    handleOpenEditShipmentModal,
    handleOpenShipmentHistory,
    setShipmentToDelete,
    setIsDeleteShipmentModalOpen,
    selectedOrderIds,
    exportOrdersToPDF: exportSelectedOrdersToPDF = exportOrdersToPDF,
    exportOrdersToCSV: exportSelectedOrdersToCSV = exportOrdersToCSV,
    handleOpenBatchDelete,
    isBatchUpdating,
    setSelectedOrderIds,
    handleSelectAll,
    handleToggleSelect,
    handleOpenOrderHistory,
    handleOpenEditOrder,
    handleOpenUpdateStatus,
    handleOpenCollectPayment,
    setSelectedOrder,
    setIsDetailsModalOpen,
    generateOrderInvoicePDF: printOrderInvoice = generateOrderInvoicePDF,
    handleOpenDeleteOrder,
    settings,
    dbRates,
  } = props;

  return (
    <div className="space-y-6 pb-20 text-start transition-colors">
      {/* Title block */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/35">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Package className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-start">
            <h1 className="text-xl font-black text-white leading-none mb-1">{t('orders')}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isAr ? 'ادارة الطلبات • ادارة الشحنات  • تتبع الطلبات • اداره مراحل الطلب والقيود التلقائيه ' : 'Invoice maker • Ledger & Profit divisions'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {(role === 'Admin' || hasPermission('print_orders')) && (
            <button
              onClick={() => exportSelectedOrdersToPDF(filteredOrdersList, isAr)}
              className="bg-slate-950 hover:bg-slate-900 border border-[#d4af37]/25 text-[#d4af37] px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" /> {isAr ? 'طباعة تقرير PDF' : 'PDF Report'}
            </button>
          )}

          {(role === 'Admin' || hasPermission('export_orders')) && (
            <button
              onClick={() => exportSelectedOrdersToCSV(filteredOrdersList, isAr)}
              className="bg-slate-950 hover:bg-slate-905 border border-emerald-900 text-emerald-400 px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
            >
              <Activity className="w-4 h-4" /> {isAr ? 'تصدير CSV' : 'Export CSV'}
            </button>
          )}

          {canAddOrders && (
            <button
              onClick={() => {
                resetCreateForm();
                setIsAddModalOpen(true);
              }}
              className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {isAr ? 'طلب جديدة' : 'New Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Primary View Switcher Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setOrdersTab('orders')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'orders'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Package className="w-4 h-4" />
          {isAr ? '📦  الطلبات' : '📦 Orders & Invoices'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setOrdersTab('products')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'products'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Boxes className="w-4 h-4 text-emerald-400" />
          {isAr ? '🧾 المنتجات' : '🧾 Products'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">{allProducts.length}</span>
        </button>

        <button
          onClick={() => setOrdersTab('shipments')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'shipments'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Truck className="w-4 h-4" />
          {isAr ? '🚚 الشحنات' : '🚚 Shipments Management Studio'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
            {allShipments.length}
          </span>
        </button>

        {canTrackOrders && (
          <button
            onClick={() => setOrdersTab('tracking')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'tracking'
              ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
              }`}
          >
            <MapPin className="w-4 h-4" />
            {isAr ? '📍 التتبع' : '📍 Live Tracking & Telemetry'}
          </button>
        )}

        {canViewOrderStatuses && (
          <button
            onClick={() => setOrdersTab('statuses')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'statuses'
              ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
              }`}
          >
            <Layers className="w-4 h-4" />
            {isAr ? '⚙️ حالات الطلب والقيود التلقائية' : '⚙️ Order Statuses & Auto Rules'}
            <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
              {orderStatusesList.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setOrdersTab('options')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'options'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Package className="w-4 h-4 text-amber-400" />
          {isAr ? '✨التغليف وفئات الشحن' : '✨ Order Options (order_option)'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
            {orderOptionsList.length}
          </span>
        </button>

        <button
          onClick={() => setOrdersTab('item-categories')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'item-categories'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          {isAr ? '🏷️ فئات الأصناف' : '🏷️ Item Categories'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">{activeItemCategories.length}</span>
        </button>
      </div>

      {ordersTab === 'products' ? (
        <ProductsManagementTab
          isAr={isAr}
          canManage={canManageOrders}
          orderCurrency={orderCurrency}
        />
      ) : ordersTab === 'item-categories' ? (
        <ItemCategoriesManagementTab isAr={isAr} canManage={canManageOrders} />
      ) : ordersTab === 'options' ? (
        /* Order Options Management Tab (order_option) */
        <OrderOptionsManagementTab isAr={isAr} canManage={canManageOrders} orderCurrency={orderCurrency} />
      ) : ordersTab === 'statuses' ? (
        /* Order Statuses & Auto Entries Management Tab */
        <OrderStatusManagementTab isAr={isAr} />
      ) : ordersTab === 'tracking' ? (
        /* Live Tracking View */
        <div className="bg-[#121215] border border-slate-850 p-2 sm:p-6 rounded-3xl shadow-xl">
          <Tracking />
        </div>
      ) : ordersTab === 'shipments' ? (
        /* Shipments Management Studio View */
        <div className="space-y-6">
          {/* Shipments Studio Header Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase">{isAr ? 'إجمالي الشحنات' : 'Total Shipments'}</span>
                <span className="text-xl font-black text-white font-mono mt-0.5 block">{allShipments.length}</span>
              </div>
              <div className="p-3 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-2xl text-[#d4af37]">
                <Truck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase">{isAr ? 'شحنات جارية' : 'In-Transit'}</span>
                <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">
                  {allShipments.filter(s => (s.shipmentStatus || s.status) !== 'تم التسليم' && (s.shipmentStatus || s.status) !== 'ملغي').length}
                </span>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase">{isAr ? 'شحنات سلمت' : 'Delivered'}</span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
                  {allShipments.filter(s => (s.shipmentStatus || s.status) === 'تم التسليم').length}
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase">{isAr ? 'شحنات مستقلة (بدون طلب)' : 'Standalone Shipments'}</span>
                <span className="text-xl font-black text-cyan-400 font-mono mt-0.5 block">
                  {allShipments.filter(s => !s.orderId && !s.order_id).length}
                </span>
              </div>
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Shipments Studio Toolbar */}
          <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex flex-wrap justify-between items-center gap-3">
            <div className="flex flex-wrap gap-2 items-center flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-500 absolute top-3 right-3" />
                <input
                  type="text"
                  value={shipmentSearchQuery}
                  onChange={(e) => setShipmentSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث برقم التتبع أو كود الطلب...' : 'Search by tracking or order code...'}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Status Filter */}
              <select
                value={shipmentStatusFilter}
                onChange={(e) => setShipmentStatusFilter(e.target.value)}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                {orderStatusesList.map(st => (
                  <option key={st.id} value={st.nameAr}>{isAr ? st.nameAr : st.nameEn}</option>
                ))}
              </select>

              {/* Carrier Filter */}
              <select
                value={shipmentCarrierFilter}
                onChange={(e) => setShipmentCarrierFilter(e.target.value)}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">{isAr ? 'جميع شركات الشحن' : 'All Carriers'}</option>
                {shippingCompanies.map(sc => (
                  <option key={sc.id} value={sc.name}>{sc.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenAddShipmentModal}
              className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'إضافة شحنة جديدة' : 'Add New Shipment'}
            </button>
          </div>

          <ShipmentsTable
            shipments={filteredShipmentsList}
            orders={orders}
            couriers={couriers}
            statuses={orderStatusesList}
            isAr={isAr}
            onCopyTrackingNumber={copyToClipboard}
            onQuickStatusChange={handleQuickShipmentStatusChange}
            onEditShipment={handleOpenEditShipmentModal}
            onOpenHistory={handleOpenShipmentHistory}
            onDeleteShipment={(shipment) => {
              setShipmentToDelete(shipment);
              setIsDeleteShipmentModalOpen(true);
            }}
          />
        </div>
      )
        // orders list with filters
        : (
          /* Orders View & Filters */
          <>
            {/* Stats Quick Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { title: isAr ? 'الطلبات النشطة اليوم' : 'Active Orders Today', val: orders.filter(o => o.orderStatus !== 'تم التسليم' && o.orderStatus !== 'ملغي').length, color: 'text-[#d4af37] bg-[#d4af37]/10' },
                { title: isAr ? 'بانتظار التوزيع لليمن' : 'In Local Dist', val: orders.filter(o => o.orderStatus === 'وصل مركز التوزيع في اليمن').length, color: 'text-amber-400 bg-amber-950/20' },
                { title: isAr ? 'شحنات سلمت بنجاح' : 'Delivered Ledger', val: orders.filter(o => o.orderStatus === 'تم التسليم').length, color: 'text-emerald-400 bg-emerald-950/20' },
                { title: isAr ? 'مبالغ معلقة للتحصيل' : 'Remaining To Collect', val: orders.reduce((sum, o) => sum + financialAccountService.convertToDefaultCurrency(parseFloat(String(o.amountRemaining || '0')), o.currency || 'YER', settings.currency || 'YER', { USD: o.exchangeRateUSD || dbRates.USD, SAR: o.exchangeRateSAR || dbRates.SAR }), 0).toLocaleString() + ' ' + (settings.currency || 'YER'), color: 'text-rose-400 bg-rose-950/20' }
              ].map((k, i) => (
                <div key={i} className="bg-gradient-to-b from-[#0d0d10] to-[#070709] border border-[#d4af37]/15 p-4 rounded-2xl relative overflow-hidden shadow-md">
                  <div className="absolute right-0 top-0 w-16 h-16 bg-gradient-to-br from-[#d4af37]/5 to-transparent rounded-full blur-xl"></div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-1 uppercase tracking-wider">{k.title}</span>
                  <span className={`text-xl font-mono font-black ${k.color.split(' ')[0]}`}>{k.val}</span>
                </div>
              ))}
            </div>

            {/* Filter and Table Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">

              <OrderFilters
                isAr={isAr}
                searchText={searchText}
                onSearchTextChange={setSearchText}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                courierFilter={courierFilter}
                onCourierFilterChange={setCourierFilter}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                orderStatuses={orderStatusesList}
                couriers={couriers}
              />

              {/* Batch Actions Bar */}
              {selectedOrderIds.length > 0 && (
                <div className="p-3 bg-[#d4af37]/10 border-b border-[#d4af37]/20 flex flex-wrap items-center justify-between gap-3 text-xs font-bold animate-fade-in">
                  <div className="flex items-center gap-2 text-white">
                    <span className="bg-[#d4af37] text-black px-2.5 py-0.5 rounded-lg font-mono font-black">
                      {selectedOrderIds.length}
                    </span>
                    <span>{isAr ? 'طلب محدد' : 'orders selected'}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        const selectedList = orders.filter(o => selectedOrderIds.includes(o.id));
                        exportSelectedOrdersToPDF(selectedList, isAr);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[#d4af37] rounded-xl flex items-center gap-1.5 text-xs transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {isAr ? 'طباعة المحددة (PDF)' : 'Print Selected'}
                    </button>

                    <button
                      onClick={() => {
                        const selectedList = orders.filter(o => selectedOrderIds.includes(o.id));
                        exportSelectedOrdersToCSV(selectedList, isAr);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 rounded-xl flex items-center gap-1.5 text-xs transition cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      {isAr ? 'تصدير المحددة (CSV)' : 'Export Selected'}
                    </button>

                    {role === 'Admin' && (
                      <button
                        onClick={handleOpenBatchDelete}
                        disabled={isBatchUpdating}
                        className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 rounded-xl flex items-center gap-1.5 text-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isAr ? `حذف المحددة (${selectedOrderIds.length})` : `Delete selected (${selectedOrderIds.length})`}
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedOrderIds([])}
                      className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition cursor-pointer"
                    >
                      {isAr ? 'إلغاء التحديد' : 'Deselect All'}
                    </button>
                  </div>
                </div>
              )}

              <OrdersTable
                orders={filteredOrdersList}
                selectedOrderIds={selectedOrderIds}
                orderStatusesList={orderStatusesList}
                isAr={isAr}
                canManageOrders={canManageOrders}
                canPrintOrders={role === 'Admin' || hasPermission('print_orders')}
                canDeleteOrders={role === 'Admin' || hasPermission('delete_orders')}
                onSelectAll={handleSelectAll}
                onToggleSelect={handleToggleSelect}
                onViewDetails={(order) => {
                  setSelectedOrder(order);
                  setIsDetailsModalOpen(true);
                }}
                onOpenOrderHistory={handleOpenOrderHistory}
                onEditOrder={handleOpenEditOrder}
                onUpdateStatus={handleOpenUpdateStatus}
                onCollectPayment={handleOpenCollectPayment}
                onPrintInvoice={(order) => printOrderInvoice(order, isAr, settings)}
                onDeleteOrder={handleOpenDeleteOrder}
                formatCreatedAt={(value) =>
                  (safeToDate(value) ?? new Date()).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')
                }
              />
            </div>
          </>
        )}

      {children}
    </div>
  );
}
