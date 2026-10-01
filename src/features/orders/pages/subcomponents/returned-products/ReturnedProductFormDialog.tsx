import React from 'react';
import { AlertCircle, Package, RefreshCw, RotateCcw, Search, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { RETURN_CONDITION_LIST, RETURN_STATUS_LIST, RETURN_TYPE_LIST } from '../../../../../services/returnedProductService';
import type { ReturnCondition, ReturnType as ReturnedType, ReturnedProduct, ReturnStatus } from '../../../../../services/returnedProductService';
import type { ReturnOrder, ReturnOrderItem } from './types';
import { FieldLabel } from './helpers';
import { RETURN_INPUT_CLASS_NAME } from './constants';

type ReturnFormData = {
  order_id?: string;
  customer_id?: string;
  customer_name?: string;
  order_item_id?: string;
  product_id?: string;
  product_name?: string;
  product_url?: string;
  quantity?: number;
  return_condition?: ReturnCondition;
  return_type?: ReturnedType;
  return_status?: ReturnStatus;
  returned_at?: string;
  return_reason?: string;
  refund_amount?: number;
  refund_currency?: string;
  is_insured?: boolean;
  insurance_refund?: number;
  notes?: string;
};
export interface ReturnedProductFormDialogProps {
  isOpen: boolean; isAr: boolean; orderCurrency: string; inp?: string;
  editingReturn: ReturnedProduct | null; selectedOrder: ReturnOrder | null; selectedOrderProducts: ReturnOrderItem[]; selectedOrderItem: ReturnOrderItem | null;
  setSelectedOrder: (order: ReturnOrder | null) => void; setSelectedOrderItem: (item: ReturnOrderItem | null) => void;
  setIsFormOpen: (open: boolean) => void; handleSaveReturn: (event: React.FormEvent) => void;
  modalFilteredOrders: ReturnOrder[]; orderSearchQuery: string; setOrderSearchQuery: (value: string) => void; handleSelectOrder: (order: ReturnOrder) => void;
  formData: ReturnFormData; setFormData: React.Dispatch<React.SetStateAction<ReturnFormData>>; handleSelectOrderItem: (item: ReturnOrderItem) => void;
  submitting: boolean;
}

export function ReturnedProductFormDialog({ isOpen, isAr, orderCurrency, inp = RETURN_INPUT_CLASS_NAME, editingReturn, selectedOrder, selectedOrderProducts, selectedOrderItem, setSelectedOrder, setSelectedOrderItem, setIsFormOpen, handleSaveReturn, modalFilteredOrders, orderSearchQuery, setOrderSearchQuery, handleSelectOrder, formData, setFormData, handleSelectOrderItem, submitting }: ReturnedProductFormDialogProps) {
  if (!isOpen) return null;
  return (
        <div className="fixed inset-0 z-[1000000] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-8 overflow-y-auto">
          <form
            onSubmit={handleSaveReturn}
            className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[86vh] flex flex-col bg-[#121215] border border-rose-500/30 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto"
          >
            {/* رأس النموذج الثابت - Fixed Form Header */}
            <header className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-800 flex justify-between items-center bg-[#151518] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-black text-sm sm:text-base flex items-center gap-2 flex-wrap">
                    {editingReturn
                      ? (isAr ? 'تعديل بيانات المرتجع' : 'Edit Return Record')
                      : (isAr ? 'إضافة مرتجع جديد' : 'Add New Return')}
                    {selectedOrder && (
                      <span className="text-[11px] font-mono font-bold bg-slate-800 text-amber-300 px-2 py-0.5 rounded-md border border-slate-700">
                        {selectedOrder.orderNumber || selectedOrder.order_number || selectedOrder.id}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isAr
                      ? 'أدخل تفاصيل المنتج المرتجع وسبب الإرجاع ومبالغ الاسترداد والتأمين'
                      : 'Enter returned product details, reason, and refund amount'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* محتوى النموذج القابل للتمرير بمرونة - Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-5">

              {/* 1. اختيار الطلب (إجباري) - Mandatory Order Selection */}
              <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-400 uppercase flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-400" />
                    {isAr ? '1. اختيار الطلب (إجباري)' : '1. Select Order (Mandatory)'}
                  </h4>
                  {selectedOrder && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      {isAr ? 'تم تحديد الطلب ✓' : 'Order Selected ✓'}
                    </span>
                  )}
                </div>

                {/* في حال تم اختيار طلب مسبقاً */}
                {selectedOrder ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                          {selectedOrder.orderNumber || selectedOrder.order_number || selectedOrder.id}
                        </span>
                        <span className="text-sm font-bold text-amber-300">
                          {selectedOrder.customerName || selectedOrder.customer_name || selectedOrder.customer || formData.customer_name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                        <span>
                          {isAr ? 'إجمالي الطلب:' : 'Total:'}{' '}
                          <strong className="text-slate-200 font-mono">
                            {selectedOrder.totalAmount || selectedOrder.total_amount || 0}{' '}
                            {selectedOrder.currency || orderCurrency}
                          </strong>
                        </span>
                        {(selectedOrder.customerPhone || selectedOrder.phone) && (
                          <span>📞 {selectedOrder.customerPhone || selectedOrder.phone}</span>
                        )}
                        {selectedOrder.createdAt && (
                          <span>📅 {String(selectedOrder.createdAt).split('T')[0]}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(null);
                        setSelectedOrderItem(null);
                        setFormData((f) => ({
                          ...f,
                          order_id: '',
                          customer_id: '',
                          customer_name: '',
                          order_item_id: '',
                          product_id: '',
                          product_name: '',
                          product_url: '',
                        }));
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex-shrink-0 self-start sm:self-center"
                    >
                      {isAr ? 'تغيير الطلب' : 'Change Order'}
                    </button>
                  </div>
                ) : (
                  /* في حال لم يتم اختيار طلب بعد - قائمة البحث والاختيار */
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={orderSearchQuery}
                        onChange={e => setOrderSearchQuery(e.target.value)}
                        placeholder={isAr ? 'ابحث برقم الطلب (مثال: ALX-...) أو اسم العميل أو الهاتف...' : 'Search by order #, customer name, phone...'}
                        className={inp + ' pr-9 text-xs'}
                        autoFocus
                      />
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/50">
                      {modalFilteredOrders.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          {isAr ? 'لم يتم العثور على طلبات مطابقة للبحث' : 'No matching orders found'}
                        </div>
                      ) : (
                        modalFilteredOrders.map((ord: ReturnOrder) => {
                          const oNum = ord.orderNumber || ord.order_number || ord.id;
                          const cName = ord.customerName || ord.customer_name || ord.customer || (isAr ? 'عميل' : 'Customer');
                          const cPhone = ord.customerPhone || ord.customer_phone || ord.phone || '';
                          const oTotal = ord.totalAmount || ord.total_amount || 0;
                          const oCur = ord.currency || orderCurrency;

                          return (
                            <div
                              key={`modal-order-${ord.id || oNum}`}
                              onClick={() => handleSelectOrder(ord)}
                              className="p-3 bg-slate-800/40 hover:bg-amber-500/10 hover:border-amber-500/40 border border-slate-700/50 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 group"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-amber-300 group-hover:text-amber-200">
                                    {oNum}
                                  </span>
                                  <span className="text-xs font-bold text-white">
                                    {cName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                  {cPhone && <span>📞 {cPhone}</span>}
                                  {ord.createdAt && <span>📅 {String(ord.createdAt).split('T')[0]}</span>}
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="text-xs font-black text-slate-200 block">
                                  {oTotal} {oCur}
                                </span>
                                <span className="text-[11px] text-amber-400 font-bold group-hover:underline">
                                  {isAr ? 'اختر الطلب ←' : 'Select →'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="text-xs text-rose-400 flex items-center gap-1.5 pt-1 font-bold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {isAr
                        ? 'ملاحظة: اختيار الطلب إجباري لتعبئة منتجاته وبيانات العميل تلقائياً.'
                        : 'Note: Selecting an order is required to automatically populate its items and customer.'}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. اختيار المنتج المرتجع من الطلب تلقائياً (إجباري) */}
              <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-cyan-400 uppercase flex items-center gap-2">
                    <Package className="w-4 h-4 text-cyan-400" />
                    {isAr ? '2. اختيار المنتج المرتجع من الطلب (إجباري)' : '2. Select Return Product from Order (Mandatory)'}
                  </h4>
                  {formData.product_name && (
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      {isAr ? 'تم تحديد المنتج ✓' : 'Product Selected ✓'}
                    </span>
                  )}
                </div>

                {!selectedOrder ? (
                  <div className="p-4 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl text-center text-xs text-slate-500">
                    {isAr
                      ? '🔒 يرجى اختيار الطلب من القائمة أعلاه أولاً لعرض المنتجات الخاصة به تلقائياً.'
                      : '🔒 Please select an order from above first to display its items automatically.'}
                  </div>
                ) : selectedOrderProducts.length === 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                      {isAr
                        ? 'لم يتم العثور على منتجات مسجلة في بنود هذا الطلب مباشرة. يمكنك إدخال اسم المنتج يدوياً:'
                        : 'No direct items found for this order. You can enter the product name manually:'}
                    </div>
                    <FieldLabel label={isAr ? 'اسم المنتج *' : 'Product Name *'}>
                      <input
                        required
                        value={formData.product_name || ''}
                        onChange={e => setFormData((f) => ({ ...f, product_name: e.target.value }))}
                        className={inp}
                        placeholder={isAr ? 'اسم المنتج المرتجع' : 'Returned product name'}
                      />
                    </FieldLabel>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                      {isAr
                        ? `انقر على المنتج المرتجع من قائمة منتجات الطلب (${selectedOrderProducts.length} منتجات):`
                        : `Click to select the returned product (${selectedOrderProducts.length} items):`}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {selectedOrderProducts.map((item: ReturnOrderItem, idx: number) => {
                        const pName = item.product_cooler || item.product_name || item.productName || (isAr ? 'منتج غير محدد' : 'Unnamed Item');
                        const pQty = item.quantity || 1;
                        const pPrice = item.total_price || item.product_price || 0;
                        const isIns = Boolean(item.is_insured);
                        const isCurrentSelected =
                          (formData.order_item_id && (formData.order_item_id === item.items_id || formData.order_item_id === item.id)) ||
                          formData.product_name === pName;

                        return (
                          <div
                            key={`ord-prod-${item.items_id || item.id || idx}`}
                            onClick={() => handleSelectOrderItem(item)}
                            className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                              isCurrentSelected
                                ? 'bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400'
                                : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition ${
                                  isCurrentSelected ? 'bg-cyan-500 text-black' : 'border border-slate-600 text-transparent'
                                }`}
                              >
                                ✓
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-white">{pName}</h5>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span>{isAr ? 'الكمية:' : 'Qty:'} <strong className="text-slate-200">{pQty}</strong></span>
                                  <span>•</span>
                                  <span>{isAr ? 'السعر:' : 'Price:'} <strong className="text-slate-200">{pPrice} {formData.refund_currency}</strong></span>
                                  {isIns && (
                                    <span className="text-cyan-300 font-bold bg-cyan-500/20 px-1.5 py-0.2 rounded text-[9px]">
                                      🛡️ {isAr ? 'مؤمن' : 'Insured'}
                                    </span>
                                  )}
                                  {item.items_status && (
                                    <span className="text-slate-300 bg-slate-700 px-1.5 py-0.2 rounded text-[9px]">
                                      {item.items_status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <span
                                className={`text-[11px] font-bold px-2 py-1 rounded-lg ${
                                  isCurrentSelected
                                    ? 'bg-cyan-500 text-black'
                                    : 'bg-slate-700/60 text-slate-300'
                                }`}
                              >
                                {isCurrentSelected ? (isAr ? 'تم الاختيار ✓' : 'Selected ✓') : (isAr ? 'اختيار' : 'Select')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* حقول المنتج المختار بتوزيع شبكي متجاوب */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                      <div className="sm:col-span-2">
                        <FieldLabel label={isAr ? 'اسم المنتج المرتجع *' : 'Selected Product Name *'}>
                          <input
                            required
                            value={formData.product_name || ''}
                            onChange={e => setFormData((f) => ({ ...f, product_name: e.target.value }))}
                            className={inp}
                            placeholder={isAr ? 'اسم المنتج المرتجع' : 'Returned product name'}
                          />
                        </FieldLabel>
                      </div>
                      <FieldLabel label={isAr ? 'الكمية المرتجعة' : 'Return Quantity'}>
                        <input
                          type="number"
                          min="1"
                          max={selectedOrderItem?.quantity || 999}
                          value={formData.quantity || 1}
                          onChange={e => setFormData((f) => ({ ...f, quantity: Number(e.target.value) }))}
                          className={inp}
                        />
                      </FieldLabel>
                      <FieldLabel label={isAr ? 'حالة المنتج المُرتجع' : 'Product Condition'}>
                        <select
                          value={formData.return_condition || 'مستخدم'}
                          onChange={e => setFormData((f) => ({ ...f, return_condition: e.target.value as ReturnCondition }))}
                          className={inp}
                        >
                          {RETURN_CONDITION_LIST.map((c, idx) => (
                            <option key={`ret-cond-form-${idx}`} value={c}>{c}</option>
                          ))}
                        </select>
                      </FieldLabel>
                    </div>

                    <FieldLabel label={isAr ? 'رابط المنتج' : 'Product URL'}>
                      <input
                        type="url"
                        value={formData.product_url || ''}
                        onChange={e => setFormData((f) => ({ ...f, product_url: e.target.value }))}
                        className={inp}
                        placeholder="https://..."
                      />
                    </FieldLabel>
                  </div>
                )}
              </div>

              {/* 3 & 4. تفاصيل الإرجاع والاسترداد المالي جنباً إلى جنب على الشاشات الواسعة */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* 3. تفاصيل وإجراءات الإرجاع - Return Details */}
                <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-rose-400 uppercase flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-rose-400" />
                      {isAr ? '3. تفاصيل وإجراءات الإرجاع' : '3. Return Details & Status'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FieldLabel label={isAr ? 'نوع الإرجاع' : 'Return Type'}>
                        <select
                          value={formData.return_type || 'استرداد'}
                          onChange={e => setFormData((f) => ({ ...f, return_type: e.target.value as ReturnedType }))}
                          className={inp}
                        >
                          {RETURN_TYPE_LIST.map((t, idx) => (
                            <option key={`ret-type-form-${idx}`} value={t}>{t}</option>
                          ))}
                        </select>
                      </FieldLabel>
                      <FieldLabel label={isAr ? 'حالة المرتجع' : 'Return Status'}>
                        <select
                          value={formData.return_status || 'معلق'}
                          onChange={e => setFormData((f) => ({ ...f, return_status: e.target.value as ReturnStatus }))}
                          className={inp}
                        >
                          {RETURN_STATUS_LIST.map((s, idx) => (
                            <option key={`ret-status-form-${idx}`} value={s}>{s}</option>
                          ))}
                        </select>
                      </FieldLabel>
                      <FieldLabel label={isAr ? 'تاريخ الإرجاع' : 'Return Date'}>
                        <input
                          type="date"
                          value={formData.returned_at ? String(formData.returned_at).split('T')[0] : ''}
                          onChange={e => setFormData((f) => ({ ...f, returned_at: e.target.value }))}
                          className={inp}
                        />
                      </FieldLabel>
                    </div>
                  </div>

                  <FieldLabel label={isAr ? 'سبب الإرجاع *' : 'Return Reason *'}>
                    <textarea
                      required
                      rows={3}
                      value={formData.return_reason || ''}
                      onChange={e => setFormData((f) => ({ ...f, return_reason: e.target.value }))}
                      className={inp + ' resize-none'}
                      placeholder={isAr ? 'اكتب سبب الإرجاع بالتفصيل (مثل: عيب مصنعي، مقاس غير مناسب)...' : 'Describe the return reason in detail...'}
                    />
                  </FieldLabel>
                </div>

                {/* 4. الاسترداد المالي والتأمين - Financial Refund & Insurance */}
                <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-emerald-400 uppercase flex items-center gap-2">
                      <span className="text-emerald-400">💰</span>
                      {isAr ? '4. الاسترداد المالي والتأمين' : '4. Financial Refund & Insurance'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FieldLabel label={isAr ? 'مبلغ الاسترداد' : 'Refund Amount'}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.refund_amount || 0}
                          onChange={e => setFormData((f) => ({ ...f, refund_amount: Number(e.target.value) }))}
                          className={inp}
                        />
                      </FieldLabel>
                      <FieldLabel label={isAr ? 'عملة الاسترداد' : 'Refund Currency'}>
                        <select
                          value={formData.refund_currency || 'YER'}
                          onChange={e => setFormData((f) => ({ ...f, refund_currency: e.target.value }))}
                          className={inp}
                        >
                          <option value="YER">YER — ريال يمني</option>
                          <option value="SAR">SAR — ريال سعودي</option>
                          <option value="USD">USD — دولار أمريكي</option>
                        </select>
                      </FieldLabel>
                    </div>

                    {/* التأمين - Insurance */}
                    <div className="flex items-center gap-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                      <input
                        type="checkbox"
                        id="return-is-insured"
                        checked={Boolean(formData.is_insured)}
                        onChange={e => setFormData((f) => ({ ...f, is_insured: e.target.checked }))}
                        className="w-4 h-4 accent-cyan-500 cursor-pointer"
                      />
                      <label htmlFor="return-is-insured" className="text-xs text-cyan-300 font-bold cursor-pointer">
                        <ShieldCheck className="w-3.5 h-3.5 inline ml-1 text-cyan-400" />
                        {isAr ? 'المنتج مؤمن — تفعيل استرداد رسوم التأمين' : 'Product is insured — Enable insurance refund'}
                      </label>
                    </div>
                    {formData.is_insured && (
                      <FieldLabel label={isAr ? 'مبلغ استرداد التأمين' : 'Insurance Refund Amount'}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.insurance_refund || 0}
                          onChange={e => setFormData((f) => ({ ...f, insurance_refund: Number(e.target.value) }))}
                          className={inp}
                        />
                      </FieldLabel>
                    )}
                  </div>

                  {/* شريط الإجمالي المسترد */}
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-300">
                    <span>{isAr ? 'إجمالي المسترد المتوقع للعميل:' : 'Total Expected Refund:'}</span>
                    <span className="text-base font-black text-white font-mono">
                      {(Number(formData.refund_amount) || 0) + (formData.is_insured ? Number(formData.insurance_refund) || 0 : 0)}{' '}
                      {formData.refund_currency}
                    </span>
                  </div>
                </div>

              </div>

              {/* ملاحظات إضافية - Notes */}
              <FieldLabel label={isAr ? 'ملاحظات إضافية' : 'Additional Notes'}>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={e => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  className={inp + ' resize-none'}
                  placeholder={isAr ? 'أي ملاحظات إضافية حول فحص المنتج أو سياسة الإرجاع…' : 'Any additional notes…'}
                />
              </FieldLabel>

            </div>

            {/* شريط الأزرار السفلي الثابت - Fixed Form Footer */}
            <footer className="px-5 sm:px-7 py-3.5 sm:py-4 border-t border-slate-800 bg-[#151518] flex items-center justify-between gap-3 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <span>{isAr ? 'إجمالي الاسترداد المتوقع:' : 'Expected Refund:'}</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {(Number(formData.refund_amount) || 0) + (formData.is_insured ? Number(formData.insurance_refund) || 0 : 0)}{' '}
                  {formData.refund_currency}
                </span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition text-xs font-bold disabled:opacity-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {isAr ? 'جارٍ الحفظ…' : 'Saving…'}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      {isAr ? 'حفظ المرتجع' : 'Save Return'}
                    </>
                  )}
                </button>
              </div>
            </footer>
          </form>
        </div>
  );
}
