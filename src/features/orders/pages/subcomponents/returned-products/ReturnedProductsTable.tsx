import React from 'react';
import { Edit2, PackageX, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { RETURN_STATUS_LIST } from '../../../../../services/returnedProductService';
import type { ReturnStatus, ReturnedProduct } from '../../../../../services/returnedProductService';
import { getStatusColor, getTypeColor, StatusIcon } from './helpers';

export interface ReturnedProductsTableProps {
  isAr: boolean; loading: boolean; filteredReturns: ReturnedProduct[];
  hasActiveFilters: boolean | string; clearFilters: () => void;
  money: (amount: unknown, currency?: string) => string;
  quickStatusItem: ReturnedProduct | null; quickStatusValue: ReturnStatus;
  setQuickStatusItem: (value: ReturnedProduct | null) => void; setQuickStatusValue: (value: ReturnStatus) => void;
  handleQuickStatusSave: () => void; canEdit: boolean; canManage: boolean; canDelete: boolean;
  openEditForm: (ret: ReturnedProduct) => void; setDeletingReturn: (ret: ReturnedProduct) => void; setIsDeleteConfirmOpen: (value: boolean) => void;
}

export function ReturnedProductsTable({ isAr, loading, filteredReturns, hasActiveFilters, clearFilters, money, quickStatusItem, quickStatusValue, setQuickStatusItem, setQuickStatusValue, handleQuickStatusSave, canEdit, canManage, canDelete, openEditForm, setDeletingReturn, setIsDeleteConfirmOpen }: ReturnedProductsTableProps) {
  return (
    <>
      {/* ── جدول المرتجعات - Returns Table ── */}
      <div className="bg-slate-950/45 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-black text-slate-300 text-xs flex items-center gap-2">
            <PackageX className="w-4 h-4 text-rose-400" />
            {isAr ? 'سجل المنتجات المرتجعة' : 'Returned Products Log'}
          </span>
          <span className="text-rose-400 font-mono font-black text-xs">{filteredReturns.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead className="bg-black/30 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="p-3 text-start">{isAr ? 'العميل' : 'Customer'}</th>
                <th className="p-3 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                <th className="p-3 text-start">{isAr ? 'رقم الطلب' : 'Order'}</th>
                <th className="p-3 text-start">{isAr ? 'سبب الإرجاع' : 'Return Reason'}</th>
                <th className="p-3 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
                <th className="p-3 text-center">{isAr ? 'النوع' : 'Type'}</th>
                <th className="p-3 text-start">{isAr ? 'مبلغ الاسترداد' : 'Refund'}</th>
                <th className="p-3 text-center">{isAr ? 'الحالة الفيزيائية' : 'Condition'}</th>
                <th className="p-3 text-center">{isAr ? 'حالة المرتجع' : 'Status'}</th>
                <th className="p-3 text-center">{isAr ? 'تاريخ الإرجاع' : 'Return Date'}</th>
                <th className="p-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-16 text-center">
                    <PackageX className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <div className="text-slate-500 font-bold text-sm">
                      {isAr ? 'لا توجد مرتجعات مطابقة' : 'No matching returns found'}
                    </div>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-3 text-[#d4af37] text-xs font-bold hover:underline"
                      >
                        {isAr ? 'مسح الفلاتر' : 'Clear filters'}
                      </button>
                    )}
                  </td>
                </tr>
              ) : filteredReturns.map((ret, idx) => (
                <tr key={ret.return_id || `ret-${idx}`} className="hover:bg-slate-900/40 transition-colors group">

                  {/* العميل */}
                  <td className="p-3">
                    <div className="font-bold text-white">{ret.customer_name || '—'}</div>
                    {ret.customer_id && (
                      <div className="text-[10px] text-slate-500 font-mono">{ret.customer_id}</div>
                    )}
                  </td>

                  {/* المنتج */}
                  <td className="p-3">
                    <div className="font-bold text-cyan-300">{ret.product_name || '—'}</div>
                    {ret.product_url && (
                      <a
                        href={ret.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-400 hover:underline"
                      >
                        {isAr ? 'رابط' : 'Link'}
                      </a>
                    )}
                  </td>

                  {/* رقم الطلب */}
                  <td className="p-3">
                    <span className="font-mono text-[#d4af37] font-black text-[11px]">
                      {ret.order_id || '—'}
                    </span>
                  </td>

                  {/* سبب الإرجاع */}
                  <td className="p-3">
                    <div className="text-slate-300 max-w-[150px] truncate" title={ret.return_reason}>
                      {ret.return_reason || '—'}
                    </div>
                    {ret.notes && (
                      <div className="text-[10px] text-slate-500 truncate max-w-[150px]" title={ret.notes}>
                        {ret.notes}
                      </div>
                    )}
                  </td>

                  {/* الكمية */}
                  <td className="p-3 text-center">
                    <span className="font-mono font-black text-white">{ret.quantity || 1}</span>
                  </td>

                  {/* النوع */}
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${getTypeColor(ret.return_type)}`}>
                      {ret.return_type || '—'}
                    </span>
                  </td>

                  {/* مبلغ الاسترداد */}
                  <td className="p-3">
                    <div className="font-mono text-amber-300 font-black">
                      {money(ret.refund_amount, ret.refund_currency)}
                    </div>
                    {ret.is_insured && Number(ret.insurance_refund) > 0 && (
                      <div className="text-[10px] text-cyan-400 flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        {money(ret.insurance_refund, ret.refund_currency)}
                      </div>
                    )}
                  </td>

                  {/* الحالة الفيزيائية */}
                  <td className="p-3 text-center">
                    <span className="text-[10px] text-slate-400 font-bold">
                      {ret.return_condition || '—'}
                    </span>
                  </td>

                  {/* حالة المرتجع */}
                  <td className="p-3 text-center">
                    {quickStatusItem?.return_id === ret.return_id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <select
                          value={quickStatusValue}
                          onChange={e => setQuickStatusValue(e.target.value as ReturnStatus)}
                          className="bg-slate-900 border border-slate-700 text-white rounded-lg text-[10px] p-1 outline-none"
                        >
                          {RETURN_STATUS_LIST.map((s, idx) => <option key={`ret-status-quick-${idx}`} value={s}>{s}</option>)}
                        </select>
                        <button
                          onClick={handleQuickStatusSave}
                          className="p-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-[10px] transition"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setQuickStatusItem(null)}
                          className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-[10px] transition"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 justify-center w-fit mx-auto cursor-pointer ${getStatusColor(ret.return_status)}`}
                        onClick={() => {
                          if (canEdit) {
                            setQuickStatusItem(ret);
                            setQuickStatusValue(ret.return_status || 'معلق');
                          }
                        }}
                        title={canEdit ? (isAr ? 'انقر لتغيير الحالة' : 'Click to change status') : undefined}
                      >
                        <StatusIcon status={ret.return_status} />
                        {ret.return_status || 'معلق'}
                      </span>
                    )}
                  </td>

                  {/* تاريخ الإرجاع */}
                  <td className="p-3 text-center">
                    <div className="font-mono text-slate-400 text-[10px]">
                      {ret.returned_at ? new Date(ret.returned_at).toLocaleDateString('ar-SA') : '—'}
                    </div>
                    {ret.processed_by && (
                      <div className="text-[10px] text-slate-600">
                        {isAr ? 'بواسطة:' : 'by:'} {ret.processed_by}
                      </div>
                    )}
                  </td>

                  {/* الإجراءات */}
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {/* تعديل */}
                      {(canManage || canEdit) && (
                        <button
                          id={`edit-return-${ret.return_id}`}
                          onClick={() => openEditForm(ret)}
                          className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title={isAr ? 'تعديل' : 'Edit'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* حذف */}
                      {(canManage || canDelete) && (
                        <button
                          id={`delete-return-${ret.return_id}`}
                          onClick={() => { setDeletingReturn(ret); setIsDeleteConfirmOpen(true); }}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title={isAr ? 'حذف' : 'Delete'}
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
  );
}
