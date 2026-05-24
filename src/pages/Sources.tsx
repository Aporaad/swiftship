import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, Edit2, X, Plus, Trash2, MapPin, ShieldAlert, RefreshCw, Crown, Globe, Truck, Phone } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { notificationService } from '../services/notificationService';
import ConfirmModal from '../components/ConfirmModal';

export default function Sources() {
  const { role, hasPermission, loading: roleLoading } = useRole();
  const { settings, t } = useSettings();
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const isAr = settings.language === 'ar';

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [formData, setFormData] = useState({
    source_name: '',
    name: '',
    type: 'App', // 'App' = Shopping Site, 'Factory' = China Factory
    source_url: '',
    contact_info: '',
    location: '',
    proforma_invoice: '',
    notes: ''
  });

  // Shipping Companies Tab State
  const [activeTab, setActiveTab] = useState<'sources' | 'shipping_companies'>('sources');
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [shippingFormData, setShippingFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    tracking_url: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'sources'), (snap) => {
      setSources(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sources');
    });
    return unsub;
  }, [roleLoading]);

  useEffect(() => {
    if (roleLoading) return;
    const unsubSec = onSnapshot(collection(db, 'shipping_companies'), (snap) => {
      setShippingCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error fetching shipping companies:", error);
    });
    return unsubSec;
  }, [roleLoading]);

  // Shipping Company Actions
  const handleOpenEditShipping = (company: any) => {
    setSelectedCompany(company);
    setShippingFormData({
      name: company.name || '',
      contact_person: company.contact_person || '',
      phone: company.phone || '',
      tracking_url: company.tracking_url || '',
      address: company.address || '',
      notes: company.notes || ''
    });
    setIsShippingModalOpen(true);
  };

  const handleOpenAddShipping = () => {
    setSelectedCompany(null);
    setShippingFormData({
      name: '',
      contact_person: '',
      phone: '',
      tracking_url: '',
      address: '',
      notes: ''
    });
    setIsShippingModalOpen(true);
  };

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...shippingFormData,
        updatedAt: Date.now()
      };

      if (selectedCompany) {
        await updateDoc(doc(db, 'shipping_companies', selectedCompany.id), payload);
        notificationService.notify({
          title: isAr ? 'تعديل شركة الشحن' : 'Shipping Company Updated',
          message: isAr ? `تم تحديث بيانات الشركة ${shippingFormData.name}` : `Shipping carrier ${shippingFormData.name} configuration updated`,
          type: 'info'
        });
      } else {
        await addDoc(collection(db, 'shipping_companies'), {
          ...payload,
          createdAt: Date.now()
        });
        notificationService.notify({
          title: isAr ? 'إضافة شركة شحن جديدة' : 'Shipping Company Added',
          message: isAr ? `تمت إضافة شركة الشحن ${shippingFormData.name} بنجاح` : `New shipping carrier ${shippingFormData.name} registered`,
          type: 'success'
        });
      }
      setIsShippingModalOpen(false);
      setSelectedCompany(null);
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في العملية' : 'Transaction Error',
        message: isAr ? 'فشلت معالجة بيانات شركة الشحن' : 'Failed to save shipping carrier details',
        type: 'error'
      });
    }
  };

  const handleDeleteShipping = async (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: isAr ? 'حذف شركة شحن' : 'Delete Shipping Company',
      message: isAr ? `هل أنت متأكد من حذف شركة الشحن ${name}؟` : `Are you sure you want to delete shipping company ${name}?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'shipping_companies', id));
          notificationService.notify({
            title: isAr ? 'تم حذف الشركة' : 'Carrier Terminated',
            message: isAr ? 'تم الحذف من الفهارس بنجاح' : 'Shipping carrier deleted successfully from index',
            type: 'warning'
          });
        } catch (err: any) {
          console.error(err);
        }
      }
    });
  };

  const handleOpenEdit = (source: any) => {
    setSelectedSource(source);
    setFormData({
      source_name: source.source_name || source.name || '',
      name: source.name || source.source_name || '',
      type: source.type || 'App',
      source_url: source.source_url || '',
      contact_info: source.contact_info || '',
      location: source.location || '',
      proforma_invoice: source.proforma_invoice || '',
      notes: source.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setSelectedSource(null);
    setFormData({
      source_name: '',
      name: '',
      type: 'App',
      source_url: '',
      contact_info: '',
      location: '',
      proforma_invoice: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        name: formData.source_name, // Dual sync for backward capability with Orders dropdown
        source_name: formData.source_name
      };

      if (selectedSource) {
        await updateDoc(doc(db, 'sources', selectedSource.id), payload);
        notificationService.notify({
          title: isAr ? 'تعديل مصدر الشراء' : 'Source Updated',
          message: isAr ? `تم تحديث المصدر الكلي ${formData.source_name}` : `Order supply source ${formData.source_name} has been updated`,
          type: 'info'
        });
      } else {
        await addDoc(collection(db, 'sources'), {
          ...payload,
          createdAt: Date.now()
        });
        notificationService.notify({
          title: isAr ? 'إضافة مصدر شراء جديد' : 'Source Added',
          message: isAr ? `تمت إضافة المصدر بنجاح برابط: ${formData.source_name}` : `New order supply source ${formData.source_name} recorded`,
          type: 'success'
        });
      }
      setIsModalOpen(false);
      setSelectedSource(null);
    } catch (err) {
      handleFirestoreError(err, selectedSource ? OperationType.UPDATE : OperationType.CREATE, 'sources');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: isAr ? 'إلغاء وفك مصدر' : 'Delete Source',
      message: isAr ? `هل أنت متأكد من فك وإلغاء المصدر ${name}؟ قد يؤثر ذلك على كشوفات حساب الطلبات القديمة.` : `Are you sure you want to delete order source ${name}? This could impact historic catalog listings.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'sources', id));
          notificationService.notify({
            title: isAr ? 'تم إلغاء المصدر' : 'Source Terminated',
            message: isAr ? 'تم الحذف من الفهارس بنجاح' : 'Order source deleted successfully from ERP indexes',
            type: 'warning'
          });
        } catch (err: any) {
          console.error(err);
          notificationService.notify({
            title: isAr ? 'خطأ في الحذف' : 'Delete Failure',
            message: isAr ? `تعذر الكشط والحذف: ${err.message}` : `Could not delete source: ${err.message}`,
            type: 'error'
          });
        }
      }
    });
  };

  const filteredSources = sources
    .filter(o => 
      o.source_name?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'name-asc') return (a.source_name || '').localeCompare(b.source_name || '');
      return 0;
    });

  if (roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  if (!hasPermission('manage_sources') && role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'صفحة قواعد المصادر وتطبيقات الشراء مخصصة لمسؤولي المشتريات والمدراء.' : 'This catalog list is restricted to Procurement and Inventory Leads.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors font-sans selection:bg-[#d4af37]/30">
      
      {/* Title block */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/3c">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            {activeTab === 'sources' ? <MapPin className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">
              {activeTab === 'sources' ? (isAr ? 'مصادر الشراء والتوريد' : 'Supply Sources') : (isAr ? 'إدارة شركات الشحن واللوجستيات' : 'Shipping Companies')}
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {activeTab === 'sources' 
                ? (isAr ? 'مواقع التسوق العالمية وشحنات المصانع الصينية وقنوات التوريد' : 'Shopper Apps • China Factories Hub')
                : (isAr ? 'قنوات تتبع وتجارة الشحن الدولي والبريد والمندوبين' : 'Carrier Channels • Tracking Portals & Logistics')
              }
            </p>
          </div>
        </div>
        <button 
          onClick={activeTab === 'sources' ? handleOpenAdd : handleOpenAddShipping}
          className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20"
        >
          <Plus className="w-4 h-4" /> 
          {activeTab === 'sources' 
            ? (isAr ? 'تقييد مصدر توريد جديد' : 'Incorporate Supply Source') 
            : (isAr ? 'إضافة شركة شحن جديدة' : 'Add Shipping Company')
          }
        </button>
      </div>

      {/* Tabs System */}
      <div className="flex gap-2 border-b border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('sources')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all duration-300 ${
            activeTab === 'sources'
              ? 'border-[#d4af37] text-white bg-[#d4af37]/5'
              : 'border-transparent text-slate-500 hover:text-white'
          }`}
        >
          {isAr ? '📦 مصادر الشراء (التوريد)' : '📦 Supply & Order Sources'}
        </button>
        <button
          onClick={() => setActiveTab('shipping_companies')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all duration-300 ${
            activeTab === 'shipping_companies'
              ? 'border-[#d4af37] text-white bg-[#d4af37]/5'
              : 'border-transparent text-slate-500 hover:text-white'
          }`}
        >
          {isAr ? '🚛 شركات الشحن والنقل' : '🚛 Shipping & Carriers'}
        </button>
      </div>

      {activeTab === 'sources' ? (
        /* Purchase Sources View */
        <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-850 bg-black/30 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder={isAr ? 'بحث سريع بفتر الفهارس عن المصدر والجهة...' : 'Filter catalog index...'} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-black/50 border border-slate-850 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-500 font-bold"
              />
            </div>

            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)} 
              className="bg-black/50 border border-slate-850 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
            >
              <option value="newest">{isAr ? 'الأحدث تقييداً' : 'Recently Logged'}</option>
              <option value="name-asc">{isAr ? 'الترتيب الأبجدي' : 'Name (A-Z)'}</option>
            </select>
          </div>

          {loading ? (
            <div className="p-20 text-center text-slate-500 font-bold font-mono tracking-widest">[ running_supply_queries ]</div>
          ) : (
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-right">
                <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="p-4">{isAr ? 'قناة المشتريات / التصنيف' : 'Source App / Class'}</th>
                    <th className="p-4">{isAr ? 'طرق وشبكات الاتصال' : 'Communication & Portal'}</th>
                    <th className="p-4">{isAr ? 'مستودعات الفوترة والموقع' : 'Base Warehouse Location'}</th>
                    <th className="p-4">{isAr ? 'ملاحظات وتوجيهات خاصة' : 'Remarks'}</th>
                    <th className="p-4 text-left">{isAr ? 'التحري والتحرير' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-850 bg-black/10">
                  {filteredSources.map(source => (
                    <tr key={source.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col text-start">
                          <span className="font-extrabold text-white text-xs">{source.source_name || source.name || 'بدون اسم'}</span>
                          <span className={`text-[8px] font-black w-max px-2 py-0.5 rounded mt-1 uppercase tracking-tighter ${source.type === 'Factory' ? 'bg-orange-950/20 text-orange-400 border border-orange-900/30' : 'bg-purple-950/20 text-purple-400 border border-purple-900/30'}`}>
                            {source.type === 'Factory' ? (isAr ? '📦 مصانع ووكلاء الصين' : '🌐 تطبيقات ومواقع شراء') : (isAr ? '🌐 تسوق وتجزئة شحن' : '⚡ Retail Application')}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-start font-medium text-slate-300">
                        {source.type === 'Factory' ? (
                          <div className="text-[11px] font-bold">
                            <span className="text-slate-500">{isAr ? 'بيانات ربط المورد:' : 'WeChat Contact:'}</span> {source.contact_info || '—'}
                          </div>
                        ) : (
                          source.source_url ? (
                            <a href={source.source_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline text-[10px] truncate max-w-xs block font-mono font-bold" dir="ltr">
                              {source.source_url}
                            </a>
                          ) : '—'
                        )}
                      </td>
                      <td className="p-4 text-start font-medium text-slate-300">
                        {source.type === 'Factory' ? (
                          <div className="text-[11px] space-y-0.5">
                            <div><span className="text-slate-500">{isAr ? 'المقر بالصين:' : 'Factory base Depot:'}</span> {source.location || '—'}</div>
                            {source.proforma_invoice && <div><span className="text-slate-500">{isAr ? 'جرد الفاتورة PI:' : 'Config PI No:'}</span> <span className="font-mono text-amber-500 tracking-tighter">{source.proforma_invoice}</span></div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px] text-start max-w-xs truncate">{source.notes || '—'}</td>
                      <td className="p-4 text-left flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEdit(source)} 
                          className="text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 border border-[#d4af37]/15 p-2 rounded-xl transition duration-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {hasPermission('delete_sources') && (
                          <button 
                            onClick={() => handleDelete(source.id, source.source_name || t('source'))} 
                            className="text-rose-500 hover:bg-rose-950/20 bg-rose-950/10 border border-rose-950/45 p-2 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSources.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                        [ no_linked_cargo_sources_found ]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* SHIPPING COMPANIES VIEW */
        <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          
          {/* Filter Toolbar for Shipping Companies */}
          <div className="p-4 border-b border-slate-850 bg-black/30 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder={isAr ? 'البحث في شركات الشحن المسجلة...' : 'Search registered shipping lines...'} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-black/50 border border-slate-850 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-500 font-bold"
              />
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-right">
              <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-850">
                <tr>
                  <th className="p-4">{isAr ? 'اسم الشركة / الفاعل' : 'Company Name'}</th>
                  <th className="p-4">{isAr ? 'خط ومسؤول الاتصال' : 'Liaison & Phone'}</th>
                  <th className="p-4">{isAr ? 'رابط التتبع واللوجستيات' : 'Tracking Portal / Link'}</th>
                  <th className="p-4">{isAr ? 'مستودعات الفروع كود' : 'Address / Depots'}</th>
                  <th className="p-4">{isAr ? 'إرشادات وملاحظات الشحن' : 'Carrier Notes'}</th>
                  <th className="p-4 text-left">{isAr ? 'التحري والتحرير' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-850 bg-black/10">
                {shippingCompanies
                  .filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.contact_person?.toLowerCase().includes(search.toLowerCase()))
                  .map(company => (
                    <tr key={company.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col text-start">
                          <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-[#d4af37]" />
                            {company.name || 'بدون اسم'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-start font-medium text-slate-300">
                        <div className="space-y-0.5">
                          <div className="text-slate-400 font-black">{company.contact_person || '—'}</div>
                          {company.phone && (
                            <div className="text-slate-500 text-[10px] font-mono flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-500" />
                              <span dir="ltr">{company.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-start">
                        {company.tracking_url ? (
                          <a 
                            href={company.tracking_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-cyan-400 hover:underline text-[10px] tracking-tight truncate max-w-xs block font-mono font-bold" 
                            dir="ltr"
                          >
                            {company.tracking_url}
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="p-4 text-start font-medium text-slate-400 max-w-xs truncate">
                        {company.address || '—'}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px] text-start max-w-xs truncate">
                        {company.notes || '—'}
                      </td>
                      <td className="p-4 text-left flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditShipping(company)} 
                          className="text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 border border-[#d4af37]/15 p-2 rounded-xl transition duration-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {hasPermission('delete_sources') && (
                          <button 
                            onClick={() => handleDeleteShipping(company.id, company.name)} 
                            className="text-rose-500 hover:bg-rose-950/20 bg-rose-950/10 border border-rose-950/45 p-2 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {shippingCompanies.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                      [ no_integrated_shipping_carriers_found ]
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Origin Purchase Sources Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {selectedSource ? (isAr ? 'تهيئة فهارس مصدر شحن' : 'Update Index Source') : (isAr ? 'تسجيل وتقييد مصدر شراء' : 'Incorporation of Source')}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-start">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'تصنيف قناة التوريد الفعلي' : 'Supply Channel Class'}</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/50 outline-none text-xs font-bold"
                >
                  <option value="App">{isAr ? 'موقع تسوق إلكتروني وتطبيق كود (شحن طرود تداول)' : 'Application shopping (Standard parcels Shein/Salla)'}</option>
                  <option value="Factory">{isAr ? 'مصنع أو مورد دولي في الصين (شحن بوزن/حجم)' : 'Direct China Manufacturer (Weighted/CBM container cargo)'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                  {formData.type === 'App' ? (isAr ? 'اسم التطبيق / موقع التسوق المعتمد' : 'Retail Source Name') : (isAr ? 'اسم المصنع أو الكيان بالصين' : 'Wholesale Manufacturer Title')}
                </label>
                <input 
                  type="text" 
                  value={formData.source_name}
                  onChange={(e) => setFormData({...formData, source_name: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  required
                />
              </div>

              {formData.type === 'App' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رابط بوابة الويب (اختياري)' : 'Electronic Web Domain URL'}</label>
                  <input 
                    type="url" 
                    value={formData.source_url}
                    onChange={(e) => setFormData({...formData, source_url: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start animate-fade-in"
                    dir="ltr"
                    placeholder="https://example.com"
                  />
                </div>
              )}

              {formData.type === 'Factory' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'بيانات المنسق والاتصال (wechat/WeChat)' : 'Liasion Details (WeChat, Mobile)'}</label>
                    <input 
                      type="text" 
                      value={formData.contact_info}
                      onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                      placeholder={isAr ? 'اسم المندوب الصيني أو معرف وي شات المعتمد' : 'Guangzhou agent WeChat ID'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'جغرافية المصنع وموقع التسليم والفرز' : 'Physical Manufacturer Depot Warehouse'}</label>
                    <input 
                      type="text" 
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                      placeholder={isAr ? 'إدراج المقاطعة أو المدينة كود' : 'Guangdong, Yiwu, warehouse details'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الفاتورة المرجعية Proforma Invoice' : 'Standard Proforma Invoice PI Ref'}</label>
                    <input 
                      type="text" 
                      value={formData.proforma_invoice}
                      onChange={(e) => setFormData({...formData, proforma_invoice: e.target.value})}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                      placeholder="PI-2026-CHN"
                    />
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'إرشادات تشغيلية وملاحظات اللوجيستي' : 'Confidential Directives annotations'}</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  rows={3}
                ></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-850">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all"
                >
                  {isAr ? 'تحديث وتأمين المصدر' : 'Publish configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipping Carrier Companies Modal */}
      {isShippingModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#d4af37]" />
                {selectedCompany ? (isAr ? 'تعديل بيانات شركة الشحن' : 'Update Shipping Carrier') : (isAr ? 'تقييد شركة شحن جديدة' : 'Add New Shipping Carrier')}
              </h3>
              <button 
                onClick={() => setIsShippingModalOpen(false)}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleShippingSubmit} className="p-6 space-y-4 text-start">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'اسم شركة الشحن الكلي' : 'Shipping Line Name'}</label>
                <input 
                  type="text" 
                  value={shippingFormData.name}
                  onChange={(e) => setShippingFormData({...shippingFormData, name: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  required
                  placeholder={isAr ? 'مثال: أرامكس، دي إتش إل، safe_ship...' : 'e.g. DHL, Aramex, Safe Ship'}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'مسؤول الاتصال / المندوب بالشركة' : 'Contact Person'}</label>
                <input 
                  type="text" 
                  value={shippingFormData.contact_person}
                  onChange={(e) => setShippingFormData({...shippingFormData, contact_person: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  placeholder={isAr ? 'اسم المندوب أو المنسق لخدمات التوصيل' : 'Account manager name'}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الهاتف/الجوال للتواصل' : 'Liaison Phone'}</label>
                <input 
                  type="text" 
                  value={shippingFormData.phone}
                  onChange={(e) => setShippingFormData({...shippingFormData, phone: e.target.value})}
                  className="w-full bg-black/50 border border-[#1e1f26] rounded-xl py-3 px-4 text-xs font-mono font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  placeholder="+9677..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رابط بوابة تتبع الشحنات المعتمد' : 'Tracking Portal Gateway URL'}</label>
                <input 
                  type="url" 
                  value={shippingFormData.tracking_url}
                  onChange={(e) => setShippingFormData({...shippingFormData, tracking_url: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  placeholder="https://track.example.com"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'مستودعات الفروع المقر والفرز' : 'Address / Depots Location'}</label>
                <input 
                  type="text" 
                  value={shippingFormData.address}
                  onChange={(e) => setShippingFormData({...shippingFormData, address: e.target.value})}
                  className="w-full bg-black/50 border border-[#1e1f26] rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  placeholder={isAr ? 'مثال: صنعاء - شارع الستين / دبي - القوز' : 'e.g. Sanaa - Main St / Guangzhou Warehouse'}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'ملاحظات وتوجيهات تشغيلية خاصة' : 'Remarks / Guidelines'}</label>
                <textarea 
                  value={shippingFormData.notes}
                  onChange={(e) => setShippingFormData({...shippingFormData, notes: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  rows={3}
                  placeholder={isAr ? 'شروط خاصة، حدود الأوزان، أسعار تداول...' : 'Pricing guidelines, limits, specific requirements'}
                ></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-850">
                <button 
                  type="button"
                  onClick={() => setIsShippingModalOpen(false)}
                  className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all"
                >
                  {isAr ? 'تحديث وتأمين جهة الشحن' : 'Publish carrier info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />
    </div>
  );
}
