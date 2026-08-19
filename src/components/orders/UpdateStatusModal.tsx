import React from 'react';
import { Plus, AlertCircle, Calendar, Trash2 } from 'lucide-react';

interface UpdateStatusModalProps {
  isOpen: boolean;
  selectedOrder: any;
  updateFormData: any;
  setUpdateFormData: (data: any) => void;
  updateShippings: any[];
  setUpdateShippings: (shippings: any[]) => void;
  orderStatusesList: any[];
  couriers: any[];
  canManageOrders: boolean;
  isSubmitting: boolean;
  isAr: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  setIsAddShippingCompanyOpen: (open: boolean) => void;
  setActiveAddShippingIndex: (index: any) => void;
  shippingCompanies: any[];
  role: string;
  hasPermission: (perm: string) => boolean;
}

export default function UpdateStatusModal({
  isOpen,
  selectedOrder,
  updateFormData,
  setUpdateFormData,
  updateShippings,
  setUpdateShippings,
  orderStatusesList,
  couriers,
  canManageOrders,
  isSubmitting,
  isAr,
  onClose,
  onSubmit,
  setIsAddShippingCompanyOpen,
  setActiveAddShippingIndex,
  shippingCompanies,
  role,
  hasPermission,
}: UpdateStatusModalProps) {
  if (!isOpen || !selectedOrder) return null;

  const addUpdateShippingRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setUpdateShippings([
      ...(updateShippings || []),
      {
        id: Math.random().toString(36).substring(2, 11),
        shippingType: 'بري',
        shippingCompany: 'Aramex',
        shippingSource: '',
        shippingDestination: '',
        shippingDate: today,
        shippingDuration: '',
        expectedArrival: '',
        shippingCost: 0,
        packagingFees: 0,
      },
    ]);
  };

  const updateUpdateShippingRow = (idx: number, fieldOrObj: string | Record<string, any>, val?: any) => {
    setUpdateShippings((updateShippings || []).map((sh, i) => {
      if (i !== idx) return sh;
      if (typeof fieldOrObj === 'string') {
        return { ...sh, [fieldOrObj]: val };
      }
      return { ...sh, ...fieldOrObj };
    }));
  };

  const removeUpdateShippingRow = (idx: number) => {
    setUpdateShippings((updateShippings || []).filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden text-start shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center text-xs font-black text-white shrink-0">
          <span>{isAr ? 'تحديث حاله ومسار الطلب' : 'Freight updates'}</span>
          <button onClick={onClose} className="text-slate-400 bg-slate-800 p-1 rounded-lg">
            <Plus className="w-4 h-4 rotate-45" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6 text-xs font-bold text-slate-300 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="block text-slate-500 mb-1">{isAr ? 'رمز الطلب الفريد' : 'Order smart key'}</label>
                <span className="font-mono text-cyan-400 font-black text-sm">{selectedOrder.orderNumber}</span>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{isAr ? 'حالة الطلب اللوجيستية الإجمالية' : 'Logistics status'}</label>
                <select
                  value={updateFormData.orderStatus}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, orderStatus: e.target.value })}
                  className={`w-full bg-slate-950 border text-white rounded-xl p-3 outline-none text-xs transition-colors ${
                    (selectedOrder.firedTriggers || []).includes(`status_notified_${updateFormData.orderStatus}`)
                      ? 'border-yellow-500/50 focus:border-yellow-500'
                      : 'border-slate-800'
                  }`}
                >
                  {orderStatusesList.map((st) => (
                    <option key={st.id} value={st.nameAr}>
                      {isAr ? st.nameAr : st.nameEn}
                    </option>
                  ))}
                </select>
                {(selectedOrder.firedTriggers || []).includes(`status_notified_${updateFormData.orderStatus}`) &&
                  updateFormData.orderStatus !== 'ملغي' && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2 text-yellow-500 text-[10px] animate-pulse">
                      <AlertCircle className="w-3 h-3" />
                      <span>
                        {isAr
                          ? 'لقد وصل الطلب لهذه الحالة مسبقاً. لن يتم تكرار القيود المحاسبية أو إرسال إشعارات للعميل.'
                          : 'This status was already reached. Financial entries and customer notifications will not be repeated.'}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-500 mb-1">{isAr ? 'مكان التواجد لليمن' : 'Yemen Spot'}</label>
                <input
                  type="text"
                  value={updateFormData.locationYemen}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, locationYemen: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs"
                />
              </div>

              {canManageOrders && (
                <div>
                  <label className="block text-slate-500 mb-1">{isAr ? 'ملاحظات وتنبيهات داخلية للموزع' : 'Internal notes'}</label>
                  <textarea
                    rows={2}
                    value={updateFormData.internalNotes}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, internalNotes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Assign Couriers/Employees */}
          {canManageOrders && (
            <div className="pt-4 border-t border-slate-805 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 mb-1">
                  {isAr ? 'موظف التعبئة والتجميع' : 'Packaging & Assembly employee'}
                </label>
                <select
                  value={updateFormData.shippingCourierId}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, shippingCourierId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs font-bold"
                >
                  <option value="">{isAr ? '-- اختر موظف التعبئة والتجميع --' : '-- Choose Aggregator --'}</option>
                  {couriers
                    .filter((c) => c.courierType === 'sourcing')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">
                  {isAr ? 'مندوب التوزيع النهائي' : 'Yemen Delivery Courier'}
                </label>
                <select
                  value={updateFormData.deliveryCourierId}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, deliveryCourierId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs font-bold"
                >
                  <option value="">{isAr ? '-- اختر مندوب التوزيع النهائي --' : '-- Choose Final Courier --'}</option>
                  {couriers
                    .filter((c) => c.courierType === 'local' || !c.courierType)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Edit Shipping Details Subtable */}
          {canManageOrders && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex flex-col text-start">
                  <span className="text-xs font-black text-white">{isAr ? 'تفاصيل شحنات المسار اللوجيستي' : 'Shipping Tracks & Manifests'}</span>
                  <span className="text-[10px] text-slate-500 font-bold mt-0.5">{isAr ? 'يمكنك تحديث وإضافة مسارات الشحن للطلب' : 'Update or add new shipping segments'}</span>
                </div>
                <button
                  type="button"
                  onClick={addUpdateShippingRow}
                  className="bg-emerald-600/10 hover:bg-emerald-650/20 text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                >
                  ➕ {isAr ? 'إضافة تفاصيل شحن' : 'Add Segment'}
                </button>
              </div>

              <div className="space-y-4">
                {updateShippings &&
                  updateShippings.map((sh, idx) => (
                    <div key={sh.id || idx} className="bg-slate-900/40 p-4 rounded-2xl border border-slate-850 space-y-3 relative text-start">
                      <div className="flex justify-between items-center border-b border-slate-850/50 pb-2">
                        <span className="text-[10px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2 py-0.5 rounded">
                          {isAr ? `مسار الشحن #${idx + 1}` : `Shipping Track #${idx + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeUpdateShippingRow(idx)}
                          className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/10 transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isAr ? 'إلغاء المسار' : 'Delete Segment'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-start font-bold">
                        <div>
                          <label className="block text-slate-500 mb-1">{isAr ? 'نوع الشحن' : 'Mode'}</label>
                          <select
                            value={sh.shippingType || 'بري'}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingType', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold cursor-pointer"
                          >
                            <option value="بري">{isAr ? 'Overland بري' : 'Land - Overland'}</option>
                            <option value="جوي">{isAr ? 'Air Freight جوي' : 'Air - Air Freight'}</option>
                            <option value="بحري">{isAr ? 'Ocean Cargo بحري' : 'Sea - Ocean Cargo'}</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-slate-400">{isAr ? 'شركة الشحن' : 'Carrier'}</label>
                            {(role === 'Admin' || hasPermission('add_sources')) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveAddShippingIndex(`edit-${idx}`);
                                  setIsAddShippingCompanyOpen(true);
                                }}
                                className="text-[10px] font-black text-cyan-400 hover:underline flex items-center gap-0.5"
                              >
                                ➕ {isAr ? 'جديدة' : 'New'}
                              </button>
                            )}
                          </div>
                          <select
                            value={sh.shippingCompany || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingCompany', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold cursor-pointer"
                          >
                            {shippingCompanies.map((sc) => (
                              <option key={sc.id} value={sc.name}>
                                {sc.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{isAr ? 'بلد المصدر (مكان التصدير)' : 'Origin Source'}</label>
                          <input
                            type="text"
                            value={sh.shippingSource || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingSource', e.target.value)}
                            placeholder={isAr ? 'مثال: الصين، الرياض...' : 'e.g. China'}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{isAr ? 'الوجهة (البلد المستقبل)' : 'Destination Point'}</label>
                          <input
                            type="text"
                            value={sh.shippingDestination || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingDestination', e.target.value)}
                            placeholder={isAr ? 'مثال: صنعاء، عدن...' : 'e.g. Sanaa'}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{isAr ? 'تكلفة أجور النقل (SAR)' : 'Freight Shipping Fee (SAR)'}</label>
                          <input
                            type="number"
                            value={sh.shippingCost || 0}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{isAr ? 'تاريخ انطلاق الشحن' : 'Dispatch Date'}</label>
                          <div className="relative">
                            <input
                              type="date"
                              id={`upd-dispatch-date-${idx}`}
                              value={sh.shippingDate || ''}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                let expected = sh.expectedArrival || '';
                                if (newDate && sh.shippingDuration) {
                                  const days = parseInt(sh.shippingDuration);
                                  if (!isNaN(days)) {
                                    const dateObj = new Date(newDate);
                                    dateObj.setDate(dateObj.getDate() + days);
                                    expected = dateObj.toISOString().split('T')[0];
                                  }
                                }
                                updateUpdateShippingRow(idx, { shippingDate: newDate, expectedArrival: expected });
                              }}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans pr-9"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`upd-dispatch-date-${idx}`);
                                if (el) (el as HTMLInputElement).showPicker?.();
                              }}
                              className="absolute inset-y-0 end-2.5 flex items-center text-slate-500 hover:text-[#d4af37] transition"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{isAr ? 'المدة التقديرية (أيام)' : 'Transit Duration (Days)'}</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={sh.shippingDuration || ''}
                              onChange={(e) => {
                                const durationVal = e.target.value;
                                let expected = sh.expectedArrival || '';
                                if (sh.shippingDate && durationVal) {
                                  const days = parseInt(durationVal);
                                  if (!isNaN(days)) {
                                    const dateObj = new Date(sh.shippingDate);
                                    dateObj.setDate(dateObj.getDate() + days);
                                    expected = dateObj.toISOString().split('T')[0];
                                  }
                                }
                                updateUpdateShippingRow(idx, { shippingDuration: durationVal, expectedArrival: expected });
                              }}
                              placeholder={isAr ? 'مثال: 12 يوم' : 'e.g. 12'}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none placeholder-slate-655 font-mono pr-9"
                            />
                            <span className="absolute inset-y-0 end-2.5 flex items-center text-slate-600 text-[10px] font-bold pointer-events-none">
                              {isAr ? 'يوم' : 'd'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{isAr ? 'موعد الوصول المتوقع' : 'Expected Arrival'}</label>
                          <div className="relative">
                            <input
                              type="date"
                              id={`upd-expected-date-${idx}`}
                              value={sh.expectedArrival || ''}
                              onChange={(e) => updateUpdateShippingRow(idx, 'expectedArrival', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans pr-9"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`upd-expected-date-${idx}`);
                                if (el) (el as HTMLInputElement).showPicker?.();
                              }}
                              className="absolute inset-y-0 end-2.5 flex items-center text-slate-500 hover:text-emerald-400 transition"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-slate-500 mb-1">{isAr ? 'أجور التغليف والصناديق (SAR)' : 'Packaging Fees (SAR)'}</label>
                          <input
                            type="number"
                            value={sh.packagingFees || 0}
                            onChange={(e) => updateUpdateShippingRow(idx, 'packagingFees', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{isAr ? 'تاريخ التسليم الفعلي المكتمل' : 'Actual Completed Delivery Date'}</label>
                          <div className="relative">
                            <input
                              type="date"
                              id={`upd-delivery-date-${idx}`}
                              value={sh.deliveryDate || ''}
                              onChange={(e) => updateUpdateShippingRow(idx, 'deliveryDate', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans pr-9"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`upd-delivery-date-${idx}`);
                                if (el) (el as HTMLInputElement).showPicker?.();
                              }}
                              className="absolute inset-y-0 end-2.5 flex items-center text-slate-500 hover:text-emerald-400 transition"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                {(!updateShippings || updateShippings.length === 0) && (
                  <p className="text-center text-slate-550 text-[10px] py-4 bg-slate-955 rounded-xl border border-dashed border-slate-850 font-bold">
                    {isAr ? 'لم يتم إضافة تفاصيل شحن للطلب بعد.' : 'No shipping items added yet.'}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2 hover:bg-slate-800 text-slate-400 rounded-lg disabled:opacity-50"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وترحيل التغييرات' : 'Update settings')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
