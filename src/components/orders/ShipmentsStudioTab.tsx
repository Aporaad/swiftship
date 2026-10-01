import React from 'react';
import { Truck, Activity, CheckCircle2, Search, Plus, ExternalLink, Edit2, Trash2, Layers } from 'lucide-react';
import type { OrderRecord, ShipmentRecord } from '../../features/orders/types';
import type { OrderStatusItem } from '../../hooks/useOrderStatuses';

interface ShipmentsStudioTabProps {
  isAr: boolean;
  allShipments?: ShipmentRecord[];
  shipmentSearchQuery?: string;
  setShipmentSearchQuery?: (query: string) => void;
  shipmentStatusFilter?: string;
  setShipmentStatusFilter?: (status: string) => void;
  shipmentCarrierFilter?: string;
  setShipmentCarrierFilter?: (carrier: string) => void;
  filteredShipmentsList?: ShipmentRecord[];
  orders?: OrderRecord[];
  couriers?: Array<{ id: string; fullName?: string | null; courierType?: string | null }>;
  shippingCompanies?: Array<{ id: string; name: string }>;
  orderStatusesList?: OrderStatusItem[];
  copyToClipboard?: (text: string) => void;
  handleOpenAddShipmentModal?: () => void;
  handleOpenEditShipmentModal?: (shipment: ShipmentRecord) => void;
  handleOpenShipmentHistory?: (shipment: ShipmentRecord) => void;
  handleQuickShipmentStatusChange?: (shipmentId: string, status: string) => void;
  setShipmentToDelete?: React.Dispatch<React.SetStateAction<ShipmentRecord | null>>;
  setIsDeleteShipmentModalOpen?: (isOpen: boolean) => void;
}

export const ShipmentsStudioTab = ({
  isAr,
  allShipments = [],
  shipmentSearchQuery = '',
  setShipmentSearchQuery,
  shipmentStatusFilter = 'all',
  setShipmentStatusFilter,
  shipmentCarrierFilter = 'all',
  setShipmentCarrierFilter,
  filteredShipmentsList = [],
  orders = [],
  couriers = [],
  shippingCompanies = [],
  orderStatusesList = [],
  copyToClipboard,
  handleOpenAddShipmentModal,
  handleOpenEditShipmentModal,
  handleOpenShipmentHistory,
  handleQuickShipmentStatusChange,
  setShipmentToDelete,
  setIsDeleteShipmentModalOpen,
}: ShipmentsStudioTabProps) => {
  return (
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
              {allShipments.filter((shipment) => (shipment.shipmentStatus || shipment.status) !== 'تم التسليم' && (shipment.shipmentStatus || shipment.status) !== 'ملغي').length}
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
              {allShipments.filter((shipment) => (shipment.shipmentStatus || shipment.status) === 'تم التسليم').length}
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
              {allShipments.filter((shipment) => !shipment.orderId && !shipment.order_id).length}
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
              onChange={(e) => setShipmentSearchQuery?.(e.target.value)}
              placeholder={isAr ? 'بحث برقم التتبع أو كود الطلب...' : 'Search by tracking or order code...'}
              className="w-full bg-black/40 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]"
            />
          </div>

          {/* Status Filter */}
          <select
            value={shipmentStatusFilter}
            onChange={(e) => setShipmentStatusFilter?.(e.target.value)}
            className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
            {orderStatusesList.map((st) => (
              <option key={st.id} value={st.nameAr}>{isAr ? st.nameAr : st.nameEn}</option>
            ))}
          </select>

          {/* Carrier Filter */}
          <select
            value={shipmentCarrierFilter}
            onChange={(e) => setShipmentCarrierFilter?.(e.target.value)}
            className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">{isAr ? 'جميع شركات الشحن' : 'All Carriers'}</option>
            {shippingCompanies.map((sc) => (
              <option key={sc.id} value={sc.name}>{sc.name}</option>
            ))}
          </select>
        </div>

        {handleOpenAddShipmentModal && (
          <button
            onClick={handleOpenAddShipmentModal}
            className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'إضافة شحنة جديدة' : 'Add New Shipment'}
          </button>
        )}
      </div>

      {/* Shipments Table */}
      <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-black/50 text-slate-400 font-bold border-b border-slate-850">
                <th className="p-4">{isAr ? 'رقم التتبع والحالة' : 'Tracking & Status'}</th>
                <th className="p-4">{isAr ? 'الطلب / العميل' : 'Order & Customer'}</th>
                <th className="p-4">{isAr ? 'الناقل والمندوب' : 'Carrier & Courier'}</th>
                <th className="p-4">{isAr ? 'الوزن والتكلفة' : 'Weight & Cost'}</th>
                <th className="p-4">{isAr ? 'التواريخ والمتوقع' : 'Dates'}</th>
                <th className="p-4 text-center">{isAr ? 'إجراءات التحكم' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {filteredShipmentsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-bold">
                    {isAr ? 'لا توجد شحنات مطابقة للبحث' : 'No shipments found matching filters'}
                  </td>
                </tr>
              ) : (
                filteredShipmentsList.map((ship) => {
                  const linkedOrd = orders.find((order) => order.id === (ship.orderId || ship.order_id) || order.orderNumber === (ship.orderId || ship.order_id));
                  const carrierName = ship.shippingCompany || ship.shipping_company_id || 'Aramex';
                  const courierRecord = couriers.find((courier) => courier.id === (ship.courierId || ship.courier_id));
                  const statusVal = ship.shipmentStatus || ship.status || 'في الانتظار';

                  return (
                    <tr key={ship.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4">
                        <div className="font-mono font-black text-white text-xs flex items-center gap-1.5">
                          <span>{ship.trackingNumber || ship.tracking_number || ship.id}</span>
                          {copyToClipboard && (
                            <button
                              onClick={() => copyToClipboard(ship.trackingNumber || ship.tracking_number || '')}
                              className="text-slate-500 hover:text-[#d4af37] transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusVal === 'تم التسليم' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          statusVal === 'ملغي' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                            'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30'
                          }`}>
                          {statusVal}
                        </span>
                      </td>

                      <td className="p-4">
                        {linkedOrd ? (
                          <div>
                            <span className="font-mono font-black text-[#d4af37] text-xs block">
                              {linkedOrd.orderNumber || linkedOrd.id}
                            </span>
                            <span className="text-slate-300 font-bold block text-[11px]">
                              {linkedOrd.customerName || 'عميل'}
                            </span>
                          </div>
                        ) : (
                          <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                            🔗 {isAr ? 'شحنة مستقلة' : 'Standalone Shipment'}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-white block">{carrierName}</span>
                        <span className="text-[10px] text-slate-500 font-bold block">
                          {courierRecord ? courierRecord.fullName : (isAr ? 'غير محدد' : 'Unassigned')}
                        </span>
                      </td>

                      <td className="p-4 font-mono">
                        <div className="text-slate-200 font-bold">
                          ⚖️ {ship.weight || 0} <span className="text-[10px] text-slate-500">KG</span>
                        </div>
                        <div className="text-emerald-400 text-[11px] font-bold">
                          💰 {ship.shippingCost || 0} <span className="text-[10px] text-slate-500">SAR</span>
                        </div>
                      </td>

                      <td className="p-4 text-[11px] text-slate-400">
                        <div>📅 {ship.shippingDate || '—'}</div>
                        {ship.expectedArrival && (
                          <div className="text-[#d4af37]">⏳ المتوقع: {ship.expectedArrival}</div>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1.5">
                          {handleQuickShipmentStatusChange && (
                            <select
                              value={statusVal}
                              onChange={(e) => handleQuickShipmentStatusChange(ship.id, e.target.value)}
                              className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-bold p-1 outline-none cursor-pointer"
                            >
                              {orderStatusesList.map((st) => (
                                <option key={st.id} value={st.nameAr}>{isAr ? st.nameAr : st.nameEn}</option>
                              ))}
                            </select>
                          )}

                          {handleOpenEditShipmentModal && (
                            <button
                              onClick={() => handleOpenEditShipmentModal(ship)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                              title={isAr ? 'تعديل الشحنة' : 'Edit Shipment'}
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                            </button>
                          )}

                          {handleOpenShipmentHistory && (
                            <button
                              onClick={() => handleOpenShipmentHistory(ship)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                              title={isAr ? 'السجل المالي والتشغيلي للشحنة' : 'Shipment activity ledger'}
                            >
                              <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            </button>
                          )}

                          {setIsDeleteShipmentModalOpen && (
                            <button
                              onClick={() => {
                                setShipmentToDelete?.(ship);
                                setIsDeleteShipmentModalOpen(true);
                              }}
                              className="p-1.5 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/30 text-rose-400 hover:text-white rounded-lg transition"
                              title={isAr ? 'حذف الشحنة' : 'Delete Shipment'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ShipmentsStudioTab;
