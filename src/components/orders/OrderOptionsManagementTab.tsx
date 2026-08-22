import React, { useState } from 'react';
import {
  Package, Truck, Plus, Edit2, Trash2, Power, Search,
  CheckCircle2, AlertCircle, X, ShieldCheck, Clock, DollarSign, Layers
} from 'lucide-react';
import { useOrderOptions, OrderOptionItem, OrderOptionType } from '../../hooks/useOrderOptions';
import ConfirmModal from '../ConfirmModal';
import toast from 'react-hot-toast';

interface OrderOptionsManagementTabProps {
  isAr: boolean;
  canManage: boolean;
  orderCurrency?: string;
}

export default function OrderOptionsManagementTab({
  isAr,
  canManage,
  orderCurrency = 'SAR'
}: OrderOptionsManagementTabProps) {
  const {
    options,
    packagingOptions,
    shippingCategoryOptions,
    loading,
    addOption,
    updateOption,
    deleteOption,
    toggleOptionStatus
  } = useOrderOptions();

  // Active view tab inside options management
  const [activeSubTab, setActiveSubTab] = useState<'packaging' | 'shipping_category'>('packaging');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<OrderOptionItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [optionToDelete, setOptionToDelete] = useState<OrderOptionItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    type: OrderOptionType;
    nameAr: string;
    nameEn: string;
    price: number;
    duration: number;
    details: string;
    isActive: boolean;
    code: string;
  }>({
    type: 'packaging',
    nameAr: '',
    nameEn: '',
    price: 0,
    duration: 7,
    details: '',
    isActive: true,
    code: ''
  });

  // Open Create Modal
  const handleOpenCreate = (defaultType?: OrderOptionType) => {
    const selectedType = defaultType || activeSubTab;
    setEditingOption(null);
    setFormData({
      type: selectedType,
      nameAr: '',
      nameEn: '',
      price: 0,
      duration: selectedType === 'shipping_category' ? 7 : 0,
      details: '',
      isActive: true,
      code: ''
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (opt: OrderOptionItem) => {
    setEditingOption(opt);
    setFormData({
      type: opt.type,
      nameAr: opt.nameAr,
      nameEn: opt.nameEn,
      price: opt.price || 0,
      duration: opt.duration || 0,
      details: opt.details || '',
      isActive: opt.isActive,
      code: opt.code || ''
    });
    setIsModalOpen(true);
  };

  // Handle Submit Form (Create / Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr.trim()) {
      toast.error(isAr ? 'يرجى إدخال اسم الخيار بالعربي' : 'Please enter Arabic option name');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingOption) {
        await updateOption(editingOption.id, {
          type: formData.type,
          nameAr: formData.nameAr.trim(),
          nameEn: formData.nameEn.trim() || formData.nameAr.trim(),
          price: parseFloat(formData.price as any) || 0,
          duration: formData.type === 'shipping_category' ? (parseInt(formData.duration as any, 10) || 0) : undefined,
          details: formData.details.trim(),
          isActive: formData.isActive,
          code: formData.code.trim().toUpperCase()
        });
        toast.success(isAr ? 'تم تعديل بيانات الخيار بنجاح' : 'Option updated successfully');
      } else {
        await addOption({
          type: formData.type,
          nameAr: formData.nameAr.trim(),
          nameEn: formData.nameEn.trim() || formData.nameAr.trim(),
          price: parseFloat(formData.price as any) || 0,
          duration: formData.type === 'shipping_category' ? (parseInt(formData.duration as any, 10) || 0) : undefined,
          details: formData.details.trim(),
          isActive: formData.isActive,
          code: formData.code.trim().toUpperCase() || (formData.type === 'packaging' ? 'PKG_' + Date.now().toString().slice(-4) : 'SHP_' + Date.now().toString().slice(-4))
        });
        toast.success(isAr ? 'تم إنشاء الخيار الجديد بنجاح' : 'New option created successfully');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (isAr ? 'حدث خطأ أثناء الحفظ' : 'Failed to save option'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!optionToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteOption(optionToDelete.id);
      toast.success(isAr ? 'تم حذف الخيار بنجاح' : 'Option deleted successfully');
      setIsDeleteModalOpen(false);
      setOptionToDelete(null);
    } catch (err: any) {
      console.error(err);
      toast.error(isAr ? 'فشل حذف الخيار' : 'Failed to delete option');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = async (opt: OrderOptionItem) => {
    try {
      await toggleOptionStatus(opt.id, opt.isActive);
      toast.success(
        opt.isActive
          ? (isAr ? `تم تعطيل خيار (${opt.nameAr})` : `Disabled option (${opt.nameEn})`)
          : (isAr ? `تم تفعيل خيار (${opt.nameAr})` : `Activated option (${opt.nameEn})`)
      );
    } catch (err: any) {
      console.error(err);
      toast.error(isAr ? 'تعذر تغيير حالة الخيار' : 'Could not change status');
    }
  };

  // Current list based on active sub tab & search filter
  const currentOptionsList = (activeSubTab === 'packaging' ? packagingOptions : shippingCategoryOptions)
    .filter(o =>
      !searchQuery.trim() ||
      o.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.details || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="space-y-6 text-start font-sans animate-fade-in">

      {/* Top Banner & Control Bar */}
      <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-xl text-[#d4af37]">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-white">
                {isAr ? 'صفحة خيارات الطلب (أنواع التغليف وفئات الشحن)' : 'Order Options (Packaging & Shipping Categories)'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-bold">
              {isAr
                ? 'إدارة جميع أنواع التغليف للمنتجات وفئات الشحن للشحنات (عادي، مستعجل، طارئ) وتخصيص أسعارها وفترات التوصيل.'
                : 'Manage product packaging types and shipment speed categories (Standard, Express, Urgent) with custom pricing and lead times.'}
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => handleOpenCreate()}
              className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs px-5 py-3 rounded-2xl shadow-lg hover:shadow-yellow-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{isAr ? 'إضافة خيار طلب جديد' : 'Add New Order Option'}</span>
            </button>
          )}
        </div>

        {/* Sub-Tabs Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-850">
          <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setActiveSubTab('packaging')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer flex-1 sm:flex-none justify-center ${activeSubTab === 'packaging'
                  ? 'bg-[#d4af37] text-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Package className="w-4 h-4" />
              <span>{isAr ? 'أنواع التغليف' : 'Packaging Types'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${activeSubTab === 'packaging' ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'
                }`}>
                {packagingOptions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('shipping_category')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer flex-1 sm:flex-none justify-center ${activeSubTab === 'shipping_category'
                  ? 'bg-[#d4af37] text-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Truck className="w-4 h-4" />
              <span>{isAr ? 'فئات الشحن (عادي/مستعجل/طارئ)' : 'Shipping Categories'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${activeSubTab === 'shipping_category' ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'
                }`}>
                {shippingCategoryOptions.length}
              </span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "ابحث في الخيارات والمسميات..." : "Search options & details..."}
              className="w-full bg-slate-900 border border-slate-800 text-white font-bold text-xs rounded-2xl py-2.5 pr-9 pl-4 outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>
      </div>

      {/* Main Options Data Grid / Table */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold text-xs flex items-center justify-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-t-[#d4af37] border-slate-700 animate-spin"></div>
            <span>{isAr ? 'جاري تحميل خيارات الطلب...' : 'Loading order options...'}</span>
          </div>
        ) : currentOptionsList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Layers className="w-12 h-12 mx-auto stroke-1 text-slate-600" />
            <p className="font-black text-sm text-slate-400">
              {isAr
                ? (activeSubTab === 'packaging' ? 'لا توجد أنواع تغليف مسجلة' : 'لا توجد فئات شحن مسجلة')
                : 'No option records found'}
            </p>
            <p className="text-xs text-slate-500">
              {isAr ? 'يمكنك إضافة خيار جديد بالنقر على زر الإضافة أعلاه' : 'Click the button above to add a new option.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-black text-[11px] uppercase tracking-wider">
                  <th className="p-4 text-start">#</th>
                  <th className="p-4 text-start">{isAr ? 'اسم الخيار' : 'Option Name'}</th>
                  <th className="p-4 text-center">{isAr ? 'النوع الفئة' : 'Category Type'}</th>
                  <th className="p-4 text-center">{isAr ? 'السعر / الكلفة' : 'Price Fee'}</th>
                  {activeSubTab === 'shipping_category' && (
                    <th className="p-4 text-center">{isAr ? 'فترة الشحن (أيام)' : 'Duration (Days)'}</th>
                  )}
                  <th className="p-4 text-start">{isAr ? 'التفاصيل والوصف' : 'Details / Description'}</th>
                  <th className="p-4 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  {canManage && <th className="p-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 font-bold">
                {currentOptionsList.map((opt, idx) => (
                  <tr key={opt.id} className="hover:bg-slate-900/40 transition">
                    <td className="p-4 font-mono text-slate-500 text-center">{idx + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${opt.type === 'packaging'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                          }`}>
                          {opt.type === 'packaging' ? <Package className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="text-white font-black block text-xs">{opt.nameAr}</span>
                          <span className="text-[10px] text-slate-500 font-mono block">{opt.nameEn}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${opt.type === 'packaging'
                          ? 'bg-amber-950/40 text-amber-300 border border-amber-800/50'
                          : 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/50'
                        }`}>
                        {opt.type === 'packaging'
                          ? (isAr ? 'نوع تغليف 📦' : 'Packaging')
                          : (isAr ? 'فئة شحن 🚚' : 'Shipping Category')}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-mono text-emerald-400 font-black text-xs bg-emerald-950/20 border border-emerald-900/40 px-2.5 py-1 rounded-xl inline-block">
                        {opt.price > 0 ? `${opt.price.toLocaleString()} ${orderCurrency}` : (isAr ? 'مجاني / 0' : 'Free / 0')}
                      </span>
                    </td>
                    {activeSubTab === 'shipping_category' && (
                      <td className="p-4 text-center">
                        <span className="font-mono text-blue-400 font-black text-xs bg-blue-950/20 border border-blue-900/40 px-2.5 py-1 rounded-xl inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span>{opt.duration !== undefined ? `${opt.duration} ${isAr ? 'يوم' : 'd'}` : '—'}</span>
                        </span>
                      </td>
                    )}
                    <td className="p-4 text-slate-400 text-xs max-w-xs truncate">
                      {opt.details || <span className="text-slate-600 italic">{isAr ? 'لا توجد تفاصيل' : 'No details'}</span>}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        disabled={!canManage}
                        onClick={() => handleToggleStatus(opt)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black flex items-center justify-center gap-1.5 mx-auto transition cursor-pointer ${opt.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${opt.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                        <span>{opt.isActive ? (isAr ? 'مفعل' : 'Active') : (isAr ? 'معطل' : 'Disabled')}</span>
                      </button>
                    </td>
                    {canManage && (
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(opt)}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer"
                            title={isAr ? 'تعديل الخيار' : 'Edit Option'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setOptionToDelete(opt);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 rounded-xl transition cursor-pointer"
                            title={isAr ? 'حذف الخيار' : 'Delete Option'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Option */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-955/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleSubmitForm}
            className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl space-y-4"
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#d4af37]"></div>
                <h3 className="font-black text-white text-xs">
                  {editingOption
                    ? (isAr ? `تعديل خيار: ${editingOption.nameAr}` : `Edit Option: ${editingOption.nameEn}`)
                    : (isAr ? 'إضافة خيار جديد لجدول order_option' : 'Add New Order Option')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs font-bold">

              {/* Option Type selection */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                  {isAr ? 'نوع الخيار المضاف' : 'Option Type'} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'packaging' })}
                    className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition ${formData.type === 'packaging'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>{isAr ? 'نوع تغليف (منتجات)' : 'Packaging Type'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'shipping_category' })}
                    className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition ${formData.type === 'shipping_category'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                  >
                    <Truck className="w-4 h-4" />
                    <span>{isAr ? 'فئة شحن (شحنات)' : 'Shipping Category'}</span>
                  </button>
                </div>
              </div>

              {/* Option Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                    {isAr ? 'اسم الخيار بالعربي *' : 'Arabic Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    placeholder={formData.type === 'packaging' ? 'مثال: تغليف خشب فاخر' : 'مثال: شحن طارئ VIP'}
                    className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                    {isAr ? 'اسم الخيار بالإنجليزي' : 'English Name'}
                  </label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={formData.type === 'packaging' ? 'e.g. Wooden Packaging' : 'e.g. Express Urgent'}
                    className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Price & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                    {isAr ? `السعر / الكلفة الإضافية (${orderCurrency})` : `Price Fee (${orderCurrency})`}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-mono focus:border-[#d4af37]"
                  />
                </div>

                {formData.type === 'shipping_category' ? (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                      {isAr ? 'فترة الشحن المتوقعة (أيام)' : 'Lead Time Duration (Days)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-mono focus:border-[#d4af37]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                      {isAr ? 'رمز كودي مرجعي (اختياري)' : 'Reference Code'}
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="PKG_CUSTOM"
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-mono uppercase focus:border-[#d4af37]"
                    />
                  </div>
                )}
              </div>

              {/* Description Details */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                  {isAr ? 'التفاصيل والوصف' : 'Option Description & Notes'}
                </label>
                <textarea
                  rows={3}
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder={isAr ? 'أدخل تفاصيل ومميزات هذا الخيار...' : 'Enter details about this packaging/shipping option...'}
                  className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Status active checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#d4af37] cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-bold text-slate-300 cursor-pointer select-none">
                  {isAr ? 'تفعيل الخيار وإظهاره في قواميس إنشاء وتعديل الطلبات' : 'Activate option for order creation selection'}
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-955 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting
                  ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                  : (editingOption ? (isAr ? 'حفظ التعديلات' : 'Update Option') : (isAr ? 'إنشاء الخيار' : 'Save Option'))}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && optionToDelete && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setOptionToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title={isAr ? 'حذف خيار الطلب' : 'Delete Order Option'}
          message={isAr
            ? `هل أنت متاكد من إزالة حذف هذا الخيار النهائي: (${optionToDelete.nameAr}) من قاعدة البيانات؟`
            : `Are you sure you want to permanently delete (${optionToDelete.nameEn})?`}
          confirmText={isAr ? 'حذف نهائي' : 'Delete Option'}
          type="danger"
        />
      )}
    </div>
  );
}
