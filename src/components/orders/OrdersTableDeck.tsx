import React, { useState } from 'react';
import { Search, Filter, Download, Plus, Eye, Activity, Edit2, Truck, DollarSign, Printer, Trash2, Calendar, ChevronDown, RefreshCw } from 'lucide-react';
import { financialAccountService } from '../../services/financialAccountService';

const safeToDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const OrdersTableDeck = ({
  isAr = true,
  filteredOrders,
  filteredOrdersList: filteredOrdersListProp,
  orders = [],
  searchTerm,
  setSearchTerm,
  searchText: searchTextProp,
  setSearchText: setSearchTextProp,
  statusFilter = 'all',
  setStatusFilter = () => {},
  sourceFilter = 'all',
  setSourceFilter = () => {},
  courierFilter = 'all',
  setCourierFilter = () => {},
  canManageOrders = true,
  role = 'Admin',
  hasPermission = () => true,
  handleOpenCreateOrder,
  setIsDetailsModalOpen = () => {},
  setSelectedOrder = () => {},
  handleOpenOrderHistory = () => {},
  handleOpenEditOrder = () => {},
  handleOpenUpdateStatus = () => {},
  handleOpenCollectPayment = () => {},
  generateOrderInvoicePDF = () => {},
  settings = {},
  handleOpenDeleteOrder = () => {},
  sources = [],
  couriers = [],
  orderStatusesList = [],
  dbRates = { USD: 1, SAR: 1 },
  sortBy: sortByProp,
  setSortBy: setSortByProp,
  selectedOrderIds: selectedOrderIdsProp,
  setSelectedOrderIds: setSelectedOrderIdsProp,
  exportOrdersToPDF = () => {},
  exportOrdersToCSV = () => {},
  handleOpenBatchDelete = () => {},
  isBatchUpdating = false,
}: any) => {
  const filteredOrdersList = filteredOrdersListProp || filteredOrders || orders || [];
  const searchText = searchTextProp !== undefined ? searchTextProp : (searchTerm !== undefined ? searchTerm : '');
  const setSearchText = setSearchTextProp || setSearchTerm || (() => {});

  const [localSortBy, setLocalSortBy] = useState('date-desc');
  const sortBy = sortByProp !== undefined ? sortByProp : localSortBy;
  const setSortBy = setSortByProp || setLocalSortBy;

  const [localSelectedOrderIds, setLocalSelectedOrderIds] = useState<string[]>([]);
  const selectedOrderIds = selectedOrderIdsProp !== undefined ? selectedOrderIdsProp : localSelectedOrderIds;
  const setSelectedOrderIds = setSelectedOrderIdsProp || setLocalSelectedOrderIds;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(filteredOrdersList.map((o: any) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter((item: string) => item !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  return (
    <div className="space-y-6">
          <>
            {/* Stats Quick Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { title: isAr ? 'الطلبات النشطة اليوم' : 'Active Orders Today', val: orders.filter(o => o.orderStatus !== 'تم التسليم' && o.orderStatus !== 'ملغي').length, color: 'text-[#d4af37] bg-[#d4af37]/10' },
                { title: isAr ? 'بانتظار التوزيع لليمن' : 'In Local Dist', val: orders.filter(o => o.orderStatus === 'وصل مركز التوزيع في اليمن').length, color: 'text-amber-400 bg-amber-950/20' },
                { title: isAr ? 'شحنات سلمت بنجاح' : 'Delivered Ledger', val: orders.filter(o => o.orderStatus === 'تم التسليم').length, color: 'text-emerald-400 bg-emerald-950/20' },
                { title: isAr ? 'مبالغ معلقة للتحصيل' : 'Remaining To Collect', val: orders.reduce((sum, o) => sum + financialAccountService.convertToDefaultCurrency(parseFloat(o.amountRemaining || '0'), o.currency || 'YER', settings.currency || 'YER', { USD: o.exchangeRateUSD || dbRates.USD, SAR: o.exchangeRateSAR || dbRates.SAR }), 0).toLocaleString() + ' ' + (settings.currency || 'YER'), color: 'text-rose-400 bg-rose-950/20' }
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

              {/* Advanced Filters */}
              <div className="p-4 border-b border-slate-800 flex flex-wrap gap-3 bg-slate-950/20">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder={isAr ? "البحث بالاسم، الموحد أو الجوال..." : "Find by code, Name, Track ID..."}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full pr-9 pl-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-bold text-start"
                  />
                </div>

                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500">
                  <option value="all">{isAr ? 'جميع الحالات الكلية' : 'All States'}</option>
                  {orderStatusesList.map(st => (
                    <option key={st.id} value={String(st.id)}>{isAr ? st.nameAr : st.nameEn}</option>
                  ))}
                </select>

                <select value={courierFilter} onChange={e => setCourierFilter(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500">
                  <option value="all">{isAr ? 'جميع الكوادر والمناديب' : 'All Couriers'}</option>
                  {couriers.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName}</option>
                  ))}
                </select>

                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500">
                  <option value="date-desc">{isAr ? 'التاريخ (الأحدث)' : 'Newest'}</option>
                  <option value="date-asc">{isAr ? 'التاريخ (الأقدم)' : 'Oldest'}</option>
                  <option value="amount-desc">{isAr ? 'القيمة (الأعلى)' : 'Highest Amount'}</option>
                </select>
              </div>


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
                        exportOrdersToPDF(selectedList, isAr);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[#d4af37] rounded-xl flex items-center gap-1.5 text-xs transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {isAr ? 'طباعة المحددة (PDF)' : 'Print Selected'}
                    </button>

                    <button
                      onClick={() => {
                        const selectedList = orders.filter(o => selectedOrderIds.includes(o.id));
                        exportOrdersToCSV(selectedList, isAr);
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

              {/* Ledger Table */}
              <div className="overflow-x-auto" id="orders-ledger-table">
                <table className="w-full text-start">
                  <thead className="bg-slate-950/45 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredOrdersList.length > 0 && selectedOrderIds.length === filteredOrdersList.length}
                          onChange={handleSelectAll}
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
                    {filteredOrdersList.map((ord, idx) => (
                      <tr key={`${ord.id}-${idx}`} className="hover:bg-slate-955 transition-all">

                        {/* Checkbox Selector */}
                        <td className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(ord.id)}
                            onChange={() => handleToggleSelect(ord.id)}
                            className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-[#d4af37] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#d4af37]"
                          />
                        </td>

                        {/* Order ID */}
                        <td className="p-4">
                          <span className="font-mono font-black text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/25 px-2.5 py-0.5 rounded-lg">{ord.orderNumber || 'ALX-XXXX-XXXX'}</span>
                          <div className="text-[10px] text-slate-500 mt-1 font-semibold">{safeToDate(ord.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
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
                              onClick={() => {
                                setSelectedOrder(ord);
                                setIsDetailsModalOpen(true);
                              }}
                              className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                              title={isAr ? 'عرض الكشف والتفاصيل' : 'Order Details'}
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            </button>

                            <button
                              onClick={() => handleOpenOrderHistory(ord)}
                              className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                              title={isAr ? 'السجل المالي والتشغيلي للطلب' : 'Order activity ledger'}
                            >
                              <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            </button>

                            {/* Edit Order - Full Edit Modal */}
                            {canManageOrders && (
                              <button
                                onClick={() => handleOpenEditOrder(ord)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-[#d4af37] rounded-lg transition"
                                title={isAr ? 'تعديل بيانات الطلب بالكامل' : 'Edit Order Data'}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                              </button>
                            )}

                            {/* Update Status Modal */}
                            {canManageOrders && (
                              <button
                                onClick={() => handleOpenUpdateStatus(ord)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition"
                                title={isAr ? 'تحديث الحالة والمسارات' : 'Update Status'}
                              >
                                <Truck className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                            )}

                            {/* Collect Payment Modal */}
                            {canManageOrders && (
                              <button
                                onClick={() => handleOpenCollectPayment(ord)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"
                                title={isAr ? 'تحصيل دفعة مالية' : 'Collect Payment'}
                              >
                                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                              </button>
                            )}

                            {/* Print PDF Invoice */}
                            {(role === 'Admin' || hasPermission('print_orders')) && (
                              <button
                                onClick={() => generateOrderInvoicePDF(ord, isAr, settings)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-blue-400 rounded-lg transition"
                                title={isAr ? 'طباعة الكشف للفاتورة' : 'Print Invoice'}
                              >
                                <Printer className="w-3.5 h-3.5 text-blue-400" />
                              </button>
                            )}

                            {/* Delete Order Security Modal */}
                            {(role === 'Admin' || hasPermission('delete_orders')) && (
                              <button
                                onClick={() => handleOpenDeleteOrder(ord)}
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
            </div>
          </>
    </div>
  );
};
