import type { ChangeEvent } from 'react';
import { Activity, DollarSign, Edit2, Eye, Printer, Trash2, Truck } from 'lucide-react';

type OrdersTableRow = Record<string, any> & { id: string };
type OrderStatusRow = {
  id?: unknown;
  sortOrder?: unknown;
  nameAr?: string;
  nameEn?: string;
};

export interface OrdersTableProps {
  orders: OrdersTableRow[];
  selectedOrderIds: string[];
  orderStatusesList: OrderStatusRow[];
  isAr: boolean;
  canManageOrders: boolean;
  canPrintOrders: boolean;
  canDeleteOrders: boolean;
  onSelectAll: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleSelect: (orderId: string) => void;
  onViewDetails: (order: OrdersTableRow) => void;
  onOpenOrderHistory: (order: OrdersTableRow) => void;
  onEditOrder: (order: OrdersTableRow) => void;
  onUpdateStatus: (order: OrdersTableRow) => void;
  onCollectPayment: (order: OrdersTableRow) => void;
  onPrintInvoice: (order: OrdersTableRow) => void;
  onDeleteOrder: (order: OrdersTableRow) => void;
  formatCreatedAt: (value: unknown) => string;
}

/** Presentation-only table for the live, enriched and filtered orders list. */
export function OrdersTable({
  orders,
  selectedOrderIds,
  orderStatusesList,
  isAr,
  canManageOrders,
  canPrintOrders,
  canDeleteOrders,
  onSelectAll,
  onToggleSelect,
  onViewDetails,
  onOpenOrderHistory,
  onEditOrder,
  onUpdateStatus,
  onCollectPayment,
  onPrintInvoice,
  onDeleteOrder,
  formatCreatedAt,
}: OrdersTableProps) {
  return (
    <div className="overflow-x-auto" id="orders-ledger-table">
      <table className="w-full text-start">
        <thead className="bg-slate-950/45 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
          <tr>
            <th className="p-4 w-12 text-center">
              <input
                type="checkbox"
                checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                onChange={onSelectAll}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-[#d4af37] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#d4af37]"
              />
            </th>
            <th className="p-4">{isAr ? 'رقم الطلب الموحد' : 'Smart Code'}</th>
            <th className="p-4">{isAr ? 'العميل والحساب' : 'Customer Account'}</th>
            <th className="p-4">{isAr ? 'الحالة اللوجيستية ' : 'Logistics Route'}</th>
            <th className="p-4">{isAr ? 'القيم والمديونية والوضع المالي' : 'Financial Info'}</th>
            <th className="p-4 text-left">{isAr ? 'إجراءات ترحيل' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-850 text-xs text-slate-300">
          {orders.map((ord, idx) => (
            <tr key={`${ord.id}-${idx}`} className="hover:bg-slate-955 transition-all">
              {/* Checkbox Selector */}
              <td className="p-4 w-12 text-center">
                <input
                  type="checkbox"
                  checked={selectedOrderIds.includes(ord.id)}
                  onChange={() => onToggleSelect(ord.id)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-[#d4af37] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#d4af37]"
                />
              </td>

              {/* Order ID */}
              <td className="p-4">
                <span className="font-mono font-black text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/25 px-2.5 py-0.5 rounded-lg">{ord.orderNumber || 'ALX-XXXX-XXXX'}</span>
                <div className="text-[10px] text-slate-500 mt-1 font-semibold">{formatCreatedAt(ord.createdAt)}</div>
              </td>

              {/* Customer */}
              <td className="p-4 text-start">
                <div className="flex flex-col">
                  <span
                    onClick={() => {
                      if (ord.customerId) {
                        window.dispatchEvent(new CustomEvent('open-entity-ledger', {
                          detail: { entityId: ord.customerId, entityType: 'customer' }
                        }));
                      }
                    }}
                    className="font-bold text-white text-xs hover:text-[#d4af37] cursor-pointer underline decoration-dotted decoration-[#d4af37]/40 transition-colors"
                  >
                    {ord.customerName}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 mt-0.5">{ord.customerPhone}</span>
                </div>
              </td>

              {/* Logistics Status */}
              <td className="p-4 text-start">
                <div className="flex flex-col space-y-1">
                  {(() => {
                    const currentStatusItem = orderStatusesList.find(s => s.sortOrder == ord.order_status_id || s.sortOrder == ord.order_status_id || s.id == ord.order_status_id);
                    return (
                      <span className="px-2.5 py-0.5 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/5 text-[#d4af37] font-bold max-w-max text-[10px]">
                        {ord.order_status_id + ' : ' + (isAr ? currentStatusItem?.nameAr : currentStatusItem?.nameEn) /*مهم: هنا يجب جلب اسم المرحله من جدول المراحل بناء على رقم المرحله*/}
                      </span>
                    );
                  })()}

                  <span className="text-[10px] text-slate-500 font-bold">{ord.orderSourceName || ord.orderSourceType}</span>
                </div>
              </td>

              {/* Financial status */}
              <td className="p-4 text-start">
                {(() => {
                  const paidTotal = parseFloat(ord.amountPaid || 0);
                  const remainVal = parseFloat(ord.amountRemaining || 0);
                  const totalFinal = paidTotal + remainVal;

                  return (
                    <div className="flex flex-col space-y-0.5">
                      <div className="font-mono text-slate-200 font-semibold">
                        {isAr ? 'الإجمالي: ' : 'Total: '}{Math.ceil(totalFinal).toLocaleString()} <span className="text-[10px] text-slate-500"> {ord.currency}</span>
                      </div>
                      <div className="font-mono text-emerald-400 text-[11px]">
                        {isAr ? 'المدفوع: ' : 'Paid: '}{Math.ceil(paidTotal).toLocaleString()} {ord.currency}
                      </div>
                      {Math.ceil(remainVal) > 0 ? (
                        <div className="font-mono text-rose-455 text-[11px] font-bold">
                          {isAr ? 'المتبقي: ' : 'Remaining: '}{Math.ceil(remainVal).toLocaleString()}  {ord.currency}
                        </div>
                      ) : Math.ceil(remainVal) < 0 ? (
                        <div className="font-mono text-amber-500 text-[11px] font-bold">
                          {isAr ? 'فائض حساب: ' : 'Overpaid: '}{Math.abs(Math.ceil(remainVal)).toLocaleString()}  {ord.currency}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </td>
              <td className="p-4 text-center">
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  {/* Eye - Details & Tracking Modal */}
                  <button
                    onClick={() => onViewDetails(ord)}
                    className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                    title={isAr ? 'عرض الكشف والتفاصيل' : 'Order Details'}
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  </button>

                  <button
                    onClick={() => onOpenOrderHistory(ord)}
                    className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                    title={isAr ? 'السجل المالي والتشغيلي للطلب' : 'Order activity ledger'}
                  >
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  </button>

                  {/* Edit Order - Full Edit Modal */}
                  {canManageOrders && (
                    <button
                      onClick={() => onEditOrder(ord)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-[#d4af37] rounded-lg transition"
                      title={isAr ? 'تعديل بيانات الطلب بالكامل' : 'Edit Order Data'}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                    </button>
                  )}

                  {/* Update Status Modal */}
                  {canManageOrders && (
                    <button
                      onClick={() => onUpdateStatus(ord)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition"
                      title={isAr ? 'تحديث الحالة والمسارات' : 'Update Status'}
                    >
                      <Truck className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  )}

                  {/* Collect Payment Modal */}
                  {canManageOrders && (
                    <button
                      onClick={() => onCollectPayment(ord)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"
                      title={isAr ? 'تحصيل دفعة مالية' : 'Collect Payment'}
                    >
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                  )}

                  {/* Print PDF Invoice */}
                  {canPrintOrders && (
                    <button
                      onClick={() => onPrintInvoice(ord)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-blue-400 rounded-lg transition"
                      title={isAr ? 'طباعة الكشف للفاتورة' : 'Print Invoice'}
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                  )}

                  {/* Delete Order Security Modal */}
                  {canDeleteOrders && (
                    <button
                      onClick={() => onDeleteOrder(ord)}
                      className="p-1.5 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/30 text-rose-400 hover:text-white rounded-lg transition"
                      title={isAr ? 'حذف الطلب نهائياً' : 'Delete Order'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
