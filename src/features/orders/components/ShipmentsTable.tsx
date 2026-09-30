import { Activity, Edit2, ExternalLink, Trash2 } from 'lucide-react';

type ShipmentTableRow = Record<string, any> & { id: string };
type ShipmentOrderRow = Record<string, any> & { id: string };
type ShipmentCourierRow = Record<string, any> & { id: string };
type ShipmentStatusOption = {
  id: string | number;
  nameAr: string;
  nameEn: string;
};

export interface ShipmentsTableProps {
  shipments: ShipmentTableRow[];
  orders: ShipmentOrderRow[];
  couriers: ShipmentCourierRow[];
  statuses: ShipmentStatusOption[];
  isAr: boolean;
  onCopyTrackingNumber: (trackingNumber: string | undefined) => void;
  onQuickStatusChange: (shipmentId: string, status: string) => void;
  onEditShipment: (shipment: ShipmentTableRow) => void;
  onOpenHistory: (shipment: ShipmentTableRow) => void;
  onDeleteShipment: (shipment: ShipmentTableRow) => void;
}

/** Presentation-only table for filtered shipments, retaining the legacy display mapping. */
export function ShipmentsTable({
  shipments,
  orders,
  couriers,
  statuses,
  isAr,
  onCopyTrackingNumber,
  onQuickStatusChange,
  onEditShipment,
  onOpenHistory,
  onDeleteShipment,
}: ShipmentsTableProps) {
  return (
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
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-500 font-bold">
                  {isAr ? 'لا توجد شحنات مطابقة للبحث' : 'No shipments found matching filters'}
                </td>
              </tr>
            ) : (
              shipments.map((ship) => {
                const linkedOrd = orders.find(order =>
                  order.id === (ship.orderId || ship.order_id)
                  || order.orderNumber === (ship.orderId || ship.order_id),
                );
                const carrierName = ship.shippingCompany || ship.shipping_company_id || 'Aramex';
                const courierRecord = couriers.find(courier =>
                  courier.id === (ship.courierId || ship.courier_id),
                );
                const statusVal = ship.shipmentStatus || ship.status || 'في الانتظار';

                return (
                  <tr key={ship.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4">
                      <div className="font-mono font-black text-white text-xs flex items-center gap-1.5">
                        <span>{ship.trackingNumber || ship.tracking_number || ship.id}</span>
                        <button
                          onClick={() => onCopyTrackingNumber(ship.trackingNumber || ship.tracking_number)}
                          className="text-slate-500 hover:text-[#d4af37] transition"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
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
                        {/* Quick status updater */}
                        <select
                          value={statusVal}
                          onChange={(event) => onQuickStatusChange(ship.id, event.target.value)}
                          className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-bold p-1 outline-none cursor-pointer"
                        >
                          {statuses.map((status) => (
                            <option key={status.id} value={status.nameAr}>
                              {isAr ? status.nameAr : status.nameEn}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => onEditShipment(ship)}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                          title={isAr ? 'تعديل الشحنة' : 'Edit Shipment'}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                        </button>

                        <button
                          onClick={() => onOpenHistory(ship)}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                          title={isAr ? 'السجل المالي والتشغيلي للشحنة' : 'Shipment activity ledger'}
                        >
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        </button>

                        <button
                          onClick={() => onDeleteShipment(ship)}
                          className="p-1.5 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/30 text-rose-400 hover:text-white rounded-lg transition"
                          title={isAr ? 'حذف الشحنة' : 'Delete Shipment'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
  );
}
