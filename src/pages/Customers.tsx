import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, onSnapshot, deleteDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Receipt, 
  DollarSign, 
  Package, 
  AlertCircle, 
  Crown, 
  Coins, 
  Check, 
  Printer,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { notificationService } from '../services/notificationService';
import { activityLogService } from '../services/activityLogService';
import ConfirmModal from '../components/ConfirmModal';

export default function Customers() {
  const { role, hasPermission, loading: roleLoading } = useRole();
  const { settings, t } = useSettings();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
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

  const [formData, setFormData] = useState({
    fullName: '', phone: '', email: '', gps_location: '', address: '', notes: ''
  });

  const [searchCustomerId, setSearchCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!search || search.trim().length < 3) {
      setSearchCustomerId(null);
      return;
    }
    const q1 = query(
      collection(db, 'orders'),
      where('orderNumber', '==', search.trim().toUpperCase())
    );
    getDocs(q1).then((snap) => {
      if (!snap.empty) {
        setSearchCustomerId(snap.docs[0].data().customerId || null);
      } else {
        setSearchCustomerId(null);
      }
    }).catch(err => {
      console.error(err);
      setSearchCustomerId(null);
    });
  }, [search]);

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return unsub;
  }, [roleLoading]);

  const handleOpenAdd = () => {
    setSelectedCustomer(null);
    setFormData({ fullName: '', phone: '', email: '', gps_location: '', address: '', notes: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (customer: any) => {
    setSelectedCustomer(customer);
    setFormData({
      fullName: customer.fullName || '',
      phone: customer.phone || '',
      email: customer.email || '',
      gps_location: customer.gps_location || '',
      address: customer.address || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleOpenDetails = (customer: any) => {
    setSelectedCustomer(customer);
    setShowDetailsModal(true);
    setOrdersLoading(true);
    
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', customer.id),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setCustomerOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrdersLoading(false);
    }, (err) => {
      console.error(err);
      setOrdersLoading(false);
    });

    return unsub;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCustomer) {
        await updateDoc(doc(db, 'customers', selectedCustomer.id), {
          ...formData,
          updatedAt: Date.now()
        });
        activityLogService.log('edit_customer', formData.fullName || selectedCustomer.id, { ...formData });
        notificationService.notify({
          title: isAr ? 'تحديث عميل' : 'Customer Updated',
          message: isAr ? `تم تحديث بيانات العميل ${formData.fullName}` : `Customer ${formData.fullName} has been updated`,
          type: 'info'
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          createdAt: Date.now()
        });
        activityLogService.log('add_customer', formData.fullName, { ...formData });
        notificationService.notify({
          title: isAr ? 'إضافة عميل' : 'Customer Added',
          message: isAr ? `تمت إضافة العميل الجديد ${formData.fullName}` : `New customer ${formData.fullName} added`,
          type: 'success'
        });
      }
      setShowModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: isAr ? 'حذف عميل' : 'Delete Customer',
      message: isAr ? `هل أنت متأكد من رغبتك في حذف العميل ${name}؟ لا يمكن التراجع عن ذلك.` : `Are you sure you want to delete customer ${name}? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'customers', id));
          activityLogService.log('delete_customer', name, { id });
          notificationService.notify({
            title: isAr ? 'حذف عميل' : 'Customer Deleted',
            message: isAr ? `تم حذف العميل ${name} بنجاح` : `Customer ${name} deleted successfully`,
            type: 'warning'
          });
        } catch (err: any) {
          console.error(err);
          notificationService.notify({
            title: isAr ? 'خطأ في الحذف' : 'Delete Error',
            message: isAr ? `تعذر حذف العميل: ${err.message}` : `Could not delete customer: ${err.message}`,
            type: 'error'
          });
        }
      }
    });
  };

  const filteredCustomers = customers.filter(c => 
    (c.fullName && c.fullName.toLowerCase().includes(search.toLowerCase())) || 
    (c.phone && c.phone.includes(search)) ||
    (c.id === searchCustomerId)
  );

  // Financial Stats
  const totalOrdersCount = customerOrders.length;
  const totalAmount = customerOrders.reduce((acc, o) => acc + (parseFloat(o.totalCostYER) || parseFloat(o.totalPrice) || 0), 0);
  const totalPaid = customerOrders.reduce((acc, o) => acc + (parseFloat(o.amountPaid) || parseFloat(o.paidAmount) || 0), 0);
  const totalRemaining = totalAmount - totalPaid;

  if (roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  if (!hasPermission('view_customers') && role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'هذه الصفحة مخصصة للمسؤولين عن إدارة كشوف العملاء.' : 'This page is restricted to customer ledger administrators.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors font-sans selection:bg-[#d4af37]/30">
      
      {/* Title & Header Panel */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/3c">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">{t('customers')}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isAr ? 'قاعدة بيانات عملاء النظام • تتبع العهد والديون والتوريدات ماليًا' : 'System customer database • Debt logs'}</p>
          </div>
        </div>
        {role === 'Admin' || hasPermission('add_customers') ? (
          <button 
            onClick={handleOpenAdd}
            className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20"
          >
            <Plus className="w-4 h-4" /> {isAr ? 'إضافة عميل جديد' : 'Add New Customer'}
          </button>
        ) : null}
      </div>

      {/* Main Customers Hub Grid */}
      <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Search & Tool belt */}
        <div className="p-6 border-b border-slate-850/60 bg-black/30">
          <div className="relative max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder={isAr ? 'الأبحاث والتحري الذكي باسم العميل أو جواله...' : 'Advanced query by name, code or cellphone...'} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-11 pl-4 py-3 bg-black/50 border border-slate-850 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-500 font-bold text-start transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold font-mono uppercase tracking-widest">[ running_customer_query ]</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-850">
                <tr>
                  <th className="p-4">{isAr ? 'دفتر العميل' : 'Client Profile'}</th>
                  <th className="p-4">{isAr ? 'رقم الهاتف' : 'Telephone'}</th>
                  <th className="p-4">{isAr ? 'تفاصيل العنوان السكني' : 'Settlement Location'}</th>
                  <th className="p-4 text-left">{isAr ? 'الإجراءات والتقرير' : 'Ledger Actions'}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-850/60 bg-black/10">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-950/40 transition-all">
                    <td className="p-4" onClick={() => handleOpenDetails(customer)}>
                      <div className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-xs shrink-0 group-hover:border-[#d4af37] transition-all shadow-inner">
                          {customer.fullName?.substring(0, 1) || 'U'}
                        </div>
                        <span className="font-bold text-white group-hover:text-[#d4af37] transition-colors">{customer.fullName || 'بدون اسم'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300 font-mono font-bold" dir="ltr">{customer.phone}</td>
                    <td className="p-4 text-slate-400 max-w-xs truncate">
                       <div className="font-bold text-slate-300 text-xs">{customer.address || '—'}</div>
                       {customer.gps_location && (
                         <div className="text-[10px] text-cyan-400 mt-0.5 truncate font-mono font-bold" dir="ltr">GPS: {customer.gps_location}</div>
                       )}
                    </td>
                    <td className="p-4 text-left flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenDetails(customer)} 
                        title="كشف حساب العميل والتقارير" 
                        className="text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 border border-[#d4af37]/15 p-2 rounded-xl transition duration-300"
                      >
                        <Receipt className="w-4 h-4" />
                      </button>
                      {role === 'Admin' || hasPermission('edit_customers') ? (
                        <>
                          <button 
                            onClick={() => handleOpenEdit(customer)} 
                            className="text-white hover:text-[#d4af37] bg-slate-900 border border-slate-800 p-2 rounded-xl transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {hasPermission('delete_customers') && (
                            <button 
                              onClick={() => handleDeleteCustomer(customer.id, customer.fullName || 'العميل')} 
                              className="text-rose-500 hover:bg-rose-950/20 bg-rose-950/10 border border-rose-950/45 p-2 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                      [ no_registered_customers_found ]
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal (Gold Dark UI Frame) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-850">
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {selectedCustomer ? (isAr ? 'تحديث وتأمين ملف عميل' : 'Revise Client Profile') : (isAr ? 'قرينة تسجيل عميل جديد' : 'Incorporate New Client')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-start">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الثلاثي أو الرباعي للعميل' : 'Full Patron Name'}</label>
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d4af37]" />
                  <input 
                    required 
                    placeholder={isAr ? 'أدخل اسم العميل بالكامل...' : 'e.g. Abdullah bin Ali'} 
                    type="text" 
                    value={formData.fullName} 
                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                    className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start transition-all" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الهاتف (الواتساب)' : 'Cellphone Contact'}</label>
                  <div className="relative">
                    <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      required 
                      type="text" 
                      placeholder="+967..."
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني' : 'Electronic Mail'}</label>
                  <div className="relative">
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      placeholder="client@mail.com"
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'العنوان وتفاصيل التوزيع بليمن' : 'Yemen Handover Settlement Address'}</label>
                <div className="relative">
                  <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    placeholder={isAr ? 'المدينة • المديرية • الشارع • معلم بجانب المنزل' : 'Sanaa, Haddah, behind post office'} 
                    type="text" 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                    className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رابط الموقع الجغرافي الخرائط (GPS)' : 'Google Maps Embed/URL'}</label>
                <input 
                  placeholder="https://maps.google.com/?q=..." 
                  type="text" 
                  value={formData.gps_location} 
                  onChange={e => setFormData({...formData, gps_location: e.target.value})} 
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'ملاحظات وتصنيفات إدارية خاصة' : 'Administrative Confidential Annotations'}</label>
                <textarea 
                  rows={3} 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-850">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-6 py-2.5 text-slate-400 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-black rounded-xl transition"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black text-xs font-black rounded-xl transition shadow-md"
                >
                  {isAr ? 'تأمين وحفظ البيانات' : 'Commit Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details / Report Modal (Luxury Gold Theme & Print Out) */}
      {showDetailsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c0c0f] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-4xl w-full h-[88vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-black/40 p-5 border-b border-slate-850/80 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-[#d4af37]/25 text-[#d4af37] flex items-center justify-center font-black text-lg shadow-inner">
                    {selectedCustomer.fullName?.substring(0, 1)}
                  </div>
                  <div className="text-start">
                    <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      {selectedCustomer.fullName} 
                      <Crown className="w-4 h-4 text-[#d4af37] animate-pulse" />
                    </h2>
                    <p className="text-[10px] text-[#d4af37] font-bold font-mono mt-0.5" dir="ltr">{selectedCustomer.phone}</p>
                  </div>
               </div>
               <button onClick={() => setShowDetailsModal(false)} className="bg-slate-900 hover:bg-slate-850 p-2 rounded-xl text-slate-500 hover:text-white border border-slate-800 transition duration-200"><X className="w-4.5 h-4.5" /></button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Client Ledger Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
                  <span className="text-[9px] uppercase font-black tracking-wider text-slate-500">{isAr ? 'إجمالي فواتير الحساب' : 'Total Orders'}</span>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xl font-black text-white">{totalOrdersCount} <span className="text-[10px] text-slate-500 font-normal">UNIT</span></span>
                    <Package className="w-6 h-6 text-[#d4af37]/20" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
                  <span className="text-[9px] uppercase font-black tracking-wider text-slate-500">{isAr ? 'إجمالي حساب المستحقات (القيمة)' : 'Gross Shipment value'}</span>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-base font-mono font-black text-[#d4af37]">{totalAmount.toLocaleString()} <span className="text-[9px] text-slate-500 font-sans font-normal">YER</span></span>
                    <DollarSign className="w-6 h-6 text-[#d4af37]/20" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between border-r-2 border-r-emerald-500">
                  <span className="text-[9px] uppercase font-black tracking-wider text-emerald-500">{isAr ? 'المقبوضات الموردة (المدفوعة)' : 'Collected / Liquidified'}</span>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-base font-mono font-black text-emerald-400">{totalPaid.toLocaleString()} <span className="text-[9px] text-slate-500 font-sans font-normal">YER</span></span>
                    <Receipt className="w-6 h-6 text-emerald-500/20" />
                  </div>
                </div>

                <div className={`bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between border-r-2 ${totalRemaining >= 0 ? 'border-r-rose-500' : 'border-r-cyan-500'}`}>
                  <span className="text-[9px] uppercase font-black tracking-wider text-slate-500">
                    {totalRemaining >= 0 ? (isAr ? 'المتبقي عليه للتحصيل (مديونية)' : 'Debt Balance Due') : (isAr ? 'رصيد دائن للعميل لدى الشركة' : 'Client Credit Balance')}
                  </span>
                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-base font-mono font-black ${totalRemaining >= 0 ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`}>
                      {Math.abs(totalRemaining).toLocaleString()} <span className="text-[9px] text-slate-500 font-sans font-normal">YER</span>
                    </span>
                    <AlertCircle className={`w-6 h-6 ${totalRemaining >= 0 ? 'text-rose-500/20' : 'text-cyan-500/20'}`} />
                  </div>
                </div>
              </div>

              {/* Order History Table */}
              <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
                 <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center">
                    <h4 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">{isAr ? 'سجل وكشف حساب المبيعات واللوجيستية للعميل' : 'Customer Account Orders Ledger'}</h4>
                    <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-lg font-bold font-mono">COUNT: {customerOrders.length}</span>
                 </div>
                 
                 {ordersLoading ? (
                    <div className="p-12 text-center text-slate-500 font-bold font-mono uppercase tracking-wider">[ loading_order_indexes ]</div>
                 ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-black/30 text-[10px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                          <tr>
                            <th className="p-3">{isAr ? 'رمز الطلب الموحد' : 'Request Code'}</th>
                            <th className="p-3">{isAr ? 'تاريخ المعاملة' : 'Posting Date'}</th>
                            <th className="p-3">{isAr ? 'حالة الشحن' : 'Transit Status'}</th>
                            <th className="p-3">{isAr ? 'إجمالي الرسوم' : 'Gross Total'}</th>
                            <th className="p-3 text-emerald-400">{isAr ? 'المدفوع' : 'Matured'}</th>
                            <th className="p-3 text-left">{isAr ? 'الرصيد المتبقي (الوضعية)' : 'Outstanding State'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                          {customerOrders.map(order => {
                            const tot = parseFloat(order.totalCostYER || order.totalPrice || 0);
                            const paid = parseFloat(order.amountPaid || order.paidAmount || 0);
                            const remaining = tot - paid;
                            return (
                              <tr key={order.id} className="hover:bg-slate-950/40 transition-colors">
                                <td className="p-3 font-mono font-black text-[#d4af37]">
                                  {order.orderNumber || 'ALX-XXXX-XXXX'}
                                  {order.trackingNumber && (
                                    <div className="text-[9px] text-slate-500 font-mono mt-0.5" dir="ltr">GLOBAL_TRACK: {order.trackingNumber}</div>
                                  )}
                                </td>
                                <td className="p-3 text-slate-400 font-mono text-[10px]">{new Date(order.createdAt).toLocaleDateString(isAr ? 'ar-YE' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                <td className="p-3">
                                  <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-slate-900 border border-slate-800 text-[#d4af37]">
                                    {order.orderStatus || order.order_status || 'تم تسجيل الطلب'}
                                  </span>
                                </td>
                                <td className="p-3 font-mono font-bold text-white">{tot.toLocaleString()} YER</td>
                                <td className="p-3 text-emerald-400 font-mono font-bold">{paid.toLocaleString()} YER</td>
                                <td className={`p-3 text-left font-mono font-bold ${remaining > 0 ? 'text-rose-400' : remaining < 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
                                  {remaining > 0 ? (
                                    <span>{remaining.toLocaleString()} YER [عليه]</span>
                                  ) : remaining < 0 ? (
                                    <span>{Math.abs(remaining).toLocaleString()} YER [دائن]</span>
                                  ) : (
                                    <span className="text-emerald-500 font-sans font-black uppercase tracking-widest text-[9px]">&gt; PAID_IN_FULL</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {customerOrders.length === 0 && (
                            <tr><td colSpan={6} className="p-16 text-center text-slate-600 italic font-bold select-none">[ no_orders_logged_to_this_patron ]</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                 )}
              </div>
            </div>
            
            {/* Modal Footer (with Printable actions) */}
            <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-between items-center shrink-0">
               <div className="text-[9px] font-mono text-slate-500 pr-2 uppercase select-none">
                 CONFIDENTIAL REPORT STAMP: {new Date().toLocaleString(isAr ? 'ar-YE' : 'en-US')}
               </div>
               <button 
                onClick={() => window.print()} 
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-md active:scale-95"
               >
                 <Printer className="w-4 h-4" /> {isAr ? 'طباعة كشف مالي للعميل' : 'Print Customer Statement'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Frame */}
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
