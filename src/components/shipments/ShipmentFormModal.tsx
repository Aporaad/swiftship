import React from 'react';
import { Truck, X, Plus } from 'lucide-react';
import { doc, setDoc, deleteDoc, updateDoc, db } from '../../lib/supabase';
import { notificationService } from '../../services/notificationService';
import { activityLogService } from '../../services/activityLogService';
import ConfirmModal from '../ConfirmModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShipmentFormData {
  id: string;
  orderId: string;
  trackingNumber: string;
  shippingCompany: string;
  shippingCompanyId: string;
  courierId: string;
  shippingType: string;
  shippingSource: string;
  shippingDestination: string;
  shipmentStatus: string;
  shippingCost: number;
  weight: number;
  packagingFees: number;
  shippingDate: string;
  shippingDuration: string;
  expectedArrival: string;
  deliveryDate: string;
  notes: string;
  shippingCategoryId?: string;
  shippingCategoryName?: string;
  shippingCategoryPrice?: number;
}

interface ShipmentFormModalProps {
  isOpen?: boolean;
  isEdit?: boolean;
  isAddOpen?: boolean;
  isEditOpen?: boolean;
  isDeleteOpen?: boolean;
  shipmentToEdit?: any;
  shipmentToDelete?: any;
  shipmentFormData: ShipmentFormData;
  setShipmentFormData: (data: ShipmentFormData) => void;
  onClose: () => void;
  onCloseDelete?: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  orders: any[];
  couriers: any[];
  shippingCompanies: any[];
  shippingCategoryOptions?: any[];
  orderStatusesList: any[];
  isAr: boolean;
  isSubmitting: boolean;
  setIsSubmitting?: (v: boolean) => void;
}


// ─── Component ────────────────────────────────────────────────────────────────

export default function ShipmentFormModal({
  isOpen: propIsOpen,
  isEdit: propIsEdit,
  isAddOpen,
  isEditOpen,
  isDeleteOpen,
  shipmentToEdit,
  shipmentToDelete,
  shipmentFormData,
  setShipmentFormData,
  onClose,
  onCloseDelete,
  onSubmit: propOnSubmit,
  orders,
  couriers,
  shippingCompanies,
  shippingCategoryOptions = [],
  orderStatusesList,
  isAr,
  isSubmitting,
  setIsSubmitting,
}: ShipmentFormModalProps) {

  // ─── حفظ / تعديل الشحنة ──────────────────────────────────────────────────

  const handleSaveShipmentSubmit = async (e: React.FormEvent) => {
    if (propOnSubmit) {
      return propOnSubmit(e);
    }
    e.preventDefault();
    if (!shipmentFormData.trackingNumber) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'يرجى إدخال رقم التتبع للشحنة' : 'Please enter tracking number',
        type: 'error'
      });
    }

    if (setIsSubmitting) setIsSubmitting(true);
    try {
      const shipId = shipmentFormData.id || ('sh_' + Math.random().toString(36).substring(2, 11));
      const payload = {
        id: shipId,
        orderId: shipmentFormData.orderId || '',
        trackingNumber: shipmentFormData.trackingNumber,
        shippingCompanyId: shipmentFormData.shippingCompany,
        shippingCompany: shipmentFormData.shippingCompany,
        courierId: shipmentFormData.courierId || '',
        shipmentStatus: shipmentFormData.shipmentStatus,
        shippingCost: parseFloat(shipmentFormData.shippingCost as any) || 0,
        weight: parseFloat(shipmentFormData.weight as any) || 0,
        packagingFees: parseFloat(shipmentFormData.packagingFees as any) || 0,
        shippingType: shipmentFormData.shippingType,
        shippingSource: shipmentFormData.shippingSource,
        shippingDestination: shipmentFormData.shippingDestination,
        shippingDate: shipmentFormData.shippingDate,
        shippingDuration: shipmentFormData.shippingDuration,
        expectedArrival: shipmentFormData.expectedArrival,
        deliveryDate: shipmentFormData.deliveryDate,
        notes: shipmentFormData.notes,
        shippingCategoryId: shipmentFormData.shippingCategoryId || '',
        shippingCategoryName: shipmentFormData.shippingCategoryName || '',
        shippingCategoryPrice: parseFloat(shipmentFormData.shippingCategoryPrice as any) || 0,
        createdAt: shipmentToEdit?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'shipments', shipId), payload);

      notificationService.notify({
        title: isAr ? 'تم الحفظ' : 'Saved',
        message: isAr ? 'تم حفظ سجل الشحنة بنجاح' : 'Shipment record saved successfully',
        type: 'success'
      });

      onClose();
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: err.message || 'Could not save shipment',
        type: 'error'
      });
    } finally {
      if (setIsSubmitting) setIsSubmitting(false);
    }
  };

  // ─── حذف الشحنة ───────────────────────────────────────────────────────────

  const handleDeleteShipmentSubmit = async () => {
    if (!shipmentToDelete) return;
    if (setIsSubmitting) setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shipments', shipmentToDelete.id));
      notificationService.notify({
        title: isAr ? 'تم الحفظ' : 'Deleted',
        message: isAr ? 'تم حذف سجل الشحنة بنجاح' : 'Shipment record deleted',
        type: 'success'
      });
      if (onCloseDelete) onCloseDelete();
    } catch (err: any) {
      console.error('Failed to delete shipment:', err);
    } finally {
      if (setIsSubmitting) setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const isModalOpen = propIsOpen !== undefined ? propIsOpen : (isAddOpen || isEditOpen);
  const isEditMode = propIsEdit !== undefined ? propIsEdit : isEditOpen;

  if (!isModalOpen && !isDeleteOpen) return null;

  return (
    <>
      {/* نموذج إضافة / تعديل شحنة */}
      {isModalOpen && (

        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-start">
          <form
            onSubmit={handleSaveShipmentSubmit}
            className="bg-[#121215] border border-[#d4af37]/30 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#d4af37]" />
                <h3 className="font-black text-white text-xs uppercase tracking-widest">
                  {isEditOpen
                    ? (isAr ? 'تعديل تفاصيل الشحنة' : 'Edit Shipment Details')
                    : (isAr ? 'إضافة شحنة جديدة' : 'Add New Shipment')}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-500 hover:text-white p-1.5 bg-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">

              {/* الطلب المرتبط (اختياري) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase">
                  {isAr ? 'الطلب المرتبط بالشحنة (اختياري)' : 'Linked Order (Optional)'}
                </label>
                <select
                  value={shipmentFormData.orderId}
                  onChange={(e) => setShipmentFormData({ ...shipmentFormData, orderId: e.target.value })}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold cursor-pointer"
                >
                  <option value="">{isAr ? '-- شحنة مستقلة (بدون طلب) --' : '-- Standalone Shipment (No Order) --'}</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      [{o.orderNumber || o.id}] - {o.customerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* رقم التتبع */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase">
                  {isAr ? 'رقم التتبع *' : 'Tracking Number *'}
                </label>
                <input
                  type="text"
                  required
                  value={shipmentFormData.trackingNumber}
                  onChange={(e) => setShipmentFormData({ ...shipmentFormData, trackingNumber: e.target.value })}
                  placeholder="e.g. ARAMEX-9923841"
                  className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold font-mono"
                />
              </div>

              {/* شركة الشحن والمندوب */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'شركة الشحن' : 'Carrier'}
                  </label>
                  <select
                    value={shipmentFormData.shippingCompany}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, shippingCompany: e.target.value })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold cursor-pointer"
                  >
                    {shippingCompanies.map(sc => (
                      <option key={sc.id} value={sc.name}>{sc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'مندوب التوصيل' : 'Courier'}
                  </label>
                  <select
                    value={shipmentFormData.courierId}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, courierId: e.target.value })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold cursor-pointer"
                  >
                    <option value="">{isAr ? '-- غير محدد --' : '-- Unassigned --'}</option>
                    {couriers.map(c => (
                      <option key={c.id} value={c.id}>{c.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* الحالة ونوع الشحن */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'حالة الشحنة' : 'Shipment Status'}
                  </label>
                  <select
                    value={shipmentFormData.shipmentStatus}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, shipmentStatus: e.target.value })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold cursor-pointer"
                  >
                    {orderStatusesList.map(st => (
                      <option key={st.id} value={st.nameAr}>{isAr ? st.nameAr : st.nameEn}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'نوع الشحن' : 'Shipping Type'}
                  </label>
                  <select
                    value={shipmentFormData.shippingType}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, shippingType: e.target.value })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold cursor-pointer"
                  >
                    <option value="بري">{isAr ? 'بري' : 'Land'}</option>
                    <option value="جوي">{isAr ? 'جوي' : 'Air'}</option>
                    <option value="بحري">{isAr ? 'بحري' : 'Sea'}</option>
                  </select>
                </div>
              </div>

              {/* فئة الشحن (عادي/مستعجل/طارئ) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-[#d4af37] uppercase flex items-center gap-1">
                  {isAr ? 'فئة الشحن السرعة (order_option)' : 'Shipping Category'}
                </label>
                <select
                  value={shipmentFormData.shippingCategoryId || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const foundOpt = shippingCategoryOptions?.find((o: any) => o.id === selectedId);
                    setShipmentFormData({
                      ...shipmentFormData,
                      shippingCategoryId: selectedId,
                      shippingCategoryName: foundOpt ? (isAr ? foundOpt.nameAr : foundOpt.nameEn) : '',
                      shippingCategoryPrice: foundOpt ? (parseFloat(foundOpt.price) || 0) : 0,
                      shippingDuration: foundOpt?.duration !== undefined ? String(foundOpt.duration) : shipmentFormData.shippingDuration
                    });
                  }}
                  className="w-full bg-black/40 border border-[#d4af37]/30 text-cyan-300 rounded-xl p-3 outline-none font-bold cursor-pointer focus:border-[#d4af37]"
                >
                  <option value="">{isAr ? '-- عادي (بدون تخصيص) --' : '-- Standard --'}</option>
                  {(shippingCategoryOptions || []).map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {isAr ? cat.nameAr : cat.nameEn} {cat.duration ? `(${cat.duration} ${isAr ? 'أيام' : 'days'})` : ''} {cat.price > 0 ? `(+${cat.price} SAR)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* الوزن وتكلفة الشحن */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'الوزن (كجم)' : 'Weight (KG)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={shipmentFormData.weight}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, weight: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'تكلفة الشحن (SAR)' : 'Shipping Cost (SAR)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={shipmentFormData.shippingCost}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, shippingCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold font-mono"
                  />
                </div>
              </div>

              {/* مكان التصدير والوجهة */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'مكان التصدير' : 'Shipping Source'}
                  </label>
                  <input
                    type="text"
                    value={shipmentFormData.shippingSource}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, shippingSource: e.target.value })}
                    placeholder={isAr ? 'الصين، دبي...' : 'China, Dubai...'}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'الوجهة' : 'Destination'}
                  </label>
                  <input
                    type="text"
                    value={shipmentFormData.shippingDestination}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, shippingDestination: e.target.value })}
                    placeholder={isAr ? 'اليمن، صنعاء...' : 'Yemen, Sanaa...'}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold"
                  />
                </div>
              </div>

              {/* تاريخ الشحن والوصول المتوقع */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'تاريخ الشحن' : 'Shipping Date'}
                  </label>
                  <input
                    type="date"
                    value={shipmentFormData.shippingDate}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, shippingDate: e.target.value })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                    {isAr ? 'المتوقع لوصولها' : 'Expected Arrival'}
                  </label>
                  <input
                    type="date"
                    value={shipmentFormData.expectedArrival}
                    onChange={(e) => setShipmentFormData({ ...shipmentFormData, expectedArrival: e.target.value })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold"
                  />
                </div>
              </div>

              {/* ملاحظات */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase">
                  {isAr ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={shipmentFormData.notes}
                  onChange={(e) => setShipmentFormData({ ...shipmentFormData, notes: e.target.value })}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 outline-none text-white font-bold"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 font-bold bg-slate-900 border border-slate-800 rounded-xl text-xs"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow transition disabled:opacity-50"
              >
                {isSubmitting
                  ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                  : (isAr ? 'حفظ سجل الشحنة' : 'Save Shipment')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* نموذج تأكيد حذف الشحنة */}
      {isDeleteOpen && shipmentToDelete && (
        <ConfirmModal
          isOpen={isDeleteOpen}
          onClose={onCloseDelete}
          onConfirm={handleDeleteShipmentSubmit}
          title={isAr ? 'حذف الشحنة' : 'Delete Shipment'}
          message={isAr
            ? `هل أنت تأكد من حذف الشحنة رقم: (${shipmentToDelete.trackingNumber || shipmentToDelete.id})؟`
            : `Delete shipment ${shipmentToDelete.trackingNumber || shipmentToDelete.id}?`}
          confirmText={isAr ? 'حذف نهائي' : 'Delete'}
          type="danger"
        />
      )}
    </>
  );
}
