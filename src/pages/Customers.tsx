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
  HelpCircle,
  Wallet,
  TrendingUp
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { notificationService } from '../services/notificationService';
import { activityLogService } from '../services/activityLogService';
import { financialAccountService } from '../services/financialAccountService';
import ConfirmModal from '../components/ConfirmModal';

export default function Customers() {
  const { role, hasPermission, loading: roleLoading } = useRole();
  const { settings, t } = useSettings();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const isAr = settings.language === 'ar';

  const [detailTab, setDetailTab] = useState<'logistics' | 'financial'>('logistics');
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [finSearch, setFinSearch] = useState('');
  const [finModuleFilter, setFinModuleFilter] = useState<'all' | 'order' | 'expense' | 'payment' | 'custody'>('all');

  useEffect(() => {
    if (!selectedCustomer || !showDetailsModal) {
      setCustomerTransactions([]);
      return;
    }

    const qTx = query(
      collection(db, 'account_transactions'),
      where('entityId', '==', selectedCustomer.id)
    );
    const unsubTx = onSnapshot(qTx, (snap) => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomerTransactions(txs);
    }, (err) => {
      console.error("Error fetching transactions for customer:", err);
    });

    return () => unsubTx();
  }, [selectedCustomer, showDetailsModal]);

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
    setDetailTab('logistics');
    setFinSearch('');
    setFinModuleFilter('all');
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
    if (submitting) return;
    setSubmitting(true);
    try {
      if (selectedCustomer) {
        await updateDoc(doc(db, 'customers', selectedCustomer.id), {
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          gps_location: formData.gps_location,
          address: formData.address,
          notes: formData.notes,
          updatedAt: Date.now()
        });
        // Update account name if it changed
        if (formData.fullName !== selectedCustomer.fullName && selectedCustomer.financialAccountId) {
          await financialAccountService.updateAccountEntityName(selectedCustomer.id, formData.fullName);
        }
        activityLogService.log('edit_customer', formData.fullName || selectedCustomer.id, { ...formData });
        notificationService.notify({
          title: isAr ? 'تحديث عميل' : 'Customer Updated',
          message: isAr ? `تم تحديث بيانات العميل ${formData.fullName}` : `Customer ${formData.fullName} has been updated`,
          type: 'info'
        });
      } else {
        // Step 1: Create the customer document
        const newCustomerRef = await addDoc(collection(db, 'customers'), {
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          gps_location: formData.gps_location,
          address: formData.address,
          notes: formData.notes,
          createdAt: Date.now()
        });

        // Step 2: Auto-create financial account (1130-xxxx)
        try {
          await financialAccountService.createAccountForEntity(
            'customer',
            newCustomerRef.id,
            formData.fullName,
            settings.currency || 'SAR'
          );
        } catch (accErr) {
          console.warn('[Customers] Could not create financial account:', accErr);
        }

        activityLogService.log('add_customer', formData.fullName, { ...formData });
        notificationService.notify({
          title: isAr ? 'إضافة عميل' : 'Customer Added',
          message: isAr 
            ? `تمت إضافة العميل ${formData.fullName} وإنشاء حسابه المالي تلقائياً` 
            : `Customer ${formData.fullName} added with auto-generated financial account`,
          type: 'success'
        });
      }
      setShowModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    } finally {
      setSubmitting(false);
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

  const getCustomerUnifiedLedger = () => {
    const ledger: any[] = [];

    // 1. Add orders as Double-Entry debits/credits
    customerOrders.forEach(order => {
      const amtPaid = parseFloat(order.amountPaid || order.paidAmount || 0);
      const amtRemain = parseFloat(order.amountRemaining || 0);
      const totalCost = amtPaid + amtRemain;

      // Total Cost (Debit - customer owes this amount)
      if (totalCost > 0) {
        ledger.push({
          id: `order-charge-${order.id}`,
          date: order.createdAt || Date.now(),
          type: 'Debit',
          amount: totalCost,
          module: 'order',
          title: isAr ? 'قيمة مبيعات / رسوم شحن' : 'Sales COD Charge',
          description: isAr 
            ? `قيمة الشحنة الموكلة رقم: ${order.orderNumber || 'ALX-CR'} (توجيه محلي)` 
            : `Gross COD for shipment #${order.orderNumber || 'ALX-CR'}`,
          ref: order.orderNumber || order.id
        });
      }

      // COD Paid (Credit - customer paid this amount)
      const orderPaymentTxs = customerTransactions.filter(tx => tx.module === 'payment' && (tx.refNumber === order.orderNumber || tx.refNumber === order.id));
      const sumOfRecordedTxs = orderPaymentTxs.reduce((sum, tx) => sum + (parseFloat(tx.amountOriginal || tx.amount || 0)), 0);
      
      const unrecordedPayment = amtPaid - sumOfRecordedTxs;

      if (unrecordedPayment > 0.01) {
        ledger.push({
          id: `order-pay-${order.id}`,
          date: (order.updatedAt || order.createdAt || Date.now()) + 1,
          type: 'Credit',
          amount: unrecordedPayment,
          module: 'payment',
          title: isAr ? 'مقبوضات شحن مبدئية / غير مقيدة' : 'Initial COD Payment',
          description: isAr 
            ? `كاش سدد مسبقاً للشحنة رقم: ${order.orderNumber || 'ALX-CR'} ولم يُقيد بسند منفصل` 
            : `Legacy cash paid for shipment #${order.orderNumber || 'ALX-CR'}`,
          ref: order.orderNumber || order.id
        });
      }
    });

    // 2. Add ledger system transactions (deposits, manual entries from back-office)
    customerTransactions.forEach(tx => {
      // Prevent duplication: our order generator always adds the 'order charge' debit line
      if (tx.module === 'order') return;

      ledger.push({
        id: tx.id || `tx-${Math.random()}`,
        date: tx.createdAt || Date.now(),
        type: tx.type, // 'Debit' | 'Credit'
        amount: tx.amount || 0,
        module: tx.module || 'transaction',
        title: tx.description ? tx.description : (isAr ? (tx.type === 'Credit' ? 'إيداع نقدي للحساب' : 'سحب / تسوية من الحساب') : (tx.type === 'Credit' ? 'Account Deposit' : 'Account Withdrawal')),
        description: isAr 
          ? `حركة حساب مركزية رقم القيد: ${tx.refNumber || tx.accountCode || 'Ledger-Tx'}`
          : `System journal entry ref: ${tx.refNumber || tx.accountCode || 'Ledger-Tx'}`,
        ref: tx.refNumber || tx.accountCode || ''
      });
    });

    // Sort oldest to newest to compute running balances correctly
    const sorted = [...ledger].sort((a, b) => a.date - b.date);

    // Compute running totals
    let runningAccountBal = 0; // Credit increases balance (+), Debit decreases balance (-)
    let runningFinancialBal = 0; // Customer accounts: Debit (+ owing), Credit (- paying)

    const finalLedger = sorted.map(item => {
      if (item.type === 'Debit') {
        runningFinancialBal += item.amount;
        runningAccountBal -= item.amount;
      } else {
        runningFinancialBal -= item.amount;
        runningAccountBal += item.amount;
      }

      return {
        ...item,
        runningAccountBal,
        runningFinancialBal
      };
    });

    // Return newest-first for the display timeline
    return finalLedger.reverse();
  };

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
                  <th className="p-4">{isAr ? 'إجمالي الأرصدة' : 'Total Balances'}</th>
                  <th className="p-4">{isAr ? 'الحساب المالي' : 'Financial Account'}</th>
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
                    <td className="p-4 text-right">
                      <div className="flex flex-col gap-0.5 text-right font-mono font-bold text-xs text-emerald-400">
                        <span>{(customer.wallet?.balance || customer.walletBalance || 0).toLocaleString()} YER</span>
                        <span className="text-[9px] text-slate-500 font-sans font-normal">{isAr ? 'رصيد الحساب الجاري' : 'Current Ledger Balance'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {customer.financialAccountCode ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-black text-[#d4af37] text-[10px] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded-lg w-max">
                            {customer.financialAccountCode}
                          </span>
                          <span className={`text-[10px] font-bold font-mono ${
                            (customer.financialBalance || 0) > 0 ? 'text-rose-400' :
                            (customer.financialBalance || 0) < 0 ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            {(customer.financialBalance || 0) > 0 ? '▲' : (customer.financialBalance || 0) < 0 ? '▼' : '●'} {Math.abs(customer.financialBalance || 0).toLocaleString()} {customer.financialCurrency || settings.currency}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-bold font-mono">— {isAr ? 'لا يوجد حساب' : 'No account'}</span>
                      )}
                    </td>
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
                    <td colSpan={5} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
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
          <form onSubmit={handleSubmit} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-md w-full flex flex-col max-h-[90vh] overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {selectedCustomer ? (isAr ? 'تحديث وتأمين ملف عميل' : 'Revise Client Profile') : (isAr ? 'قرينة تسجيل عميل جديد' : 'Incorporate New Client')}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-550 hover:text-white bg-slate-900 border border-slate-800 p-1 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-start">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  rows={2} 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-850 rounded-xl transition text-xs"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                disabled={submitting}
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black text-xs font-black rounded-xl transition shadow-md active:scale-95 disabled:opacity-40"
              >
                {submitting ? (isAr ? 'جاري الحفظ والربط...' : 'Processing...') : (isAr ? 'تأمين وحفظ البيانات' : 'Commit Ledger')}
              </button>
            </div>
          </form>
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

              {/* Financial Account Info Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedCustomer.financialAccountCode && (
                  <div className="bg-gradient-to-r from-[#0e0e11] to-[#070708] border border-[#d4af37]/25 rounded-2xl p-4 flex items-center justify-between shadow">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#d4af37]/10 border border-[#d4af37]/20 p-2.5 rounded-xl">
                        <Wallet className="w-5 h-5 text-[#d4af37]" />
                      </div>
                      <div className="text-start">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">{isAr ? 'رقم الحساب المالي' : 'Financial Account Code'}</div>
                        <div className="font-mono font-black text-[#d4af37] text-sm">{selectedCustomer.financialAccountCode}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">{isAr ? 'الرصيد الحالي' : 'Current Balance'}</div>
                      <div className={`font-mono font-black text-base ${
                        (selectedCustomer.financialBalance || 0) > 0 ? 'text-rose-400' :
                        (selectedCustomer.financialBalance || 0) < 0 ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {(selectedCustomer.financialBalance || 0) > 0 ? isAr ? 'مدين: ' : 'Debit: ' : 
                         (selectedCustomer.financialBalance || 0) < 0 ? isAr ? 'دائن: ' : 'Credit: ' : ''}
                        {Math.abs(selectedCustomer.financialBalance || 0).toLocaleString()} {selectedCustomer.financialCurrency || settings.currency}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-gradient-to-r from-[#010c06] to-[#04160a] border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between shadow">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/25 p-2.5 rounded-xl text-emerald-400">
                      <Coins className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-start">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">{isAr ? 'الرصيد الكلي المتاح' : 'Total Client Available Balance'}</div>
                      <div className="font-mono font-black text-emerald-400 text-sm">{(selectedCustomer?.walletBalance || selectedCustomer?.wallet?.balance || 0).toLocaleString()} YER</div>
                    </div>
                  </div>
                  <div className="text-right font-sans">
                    <span className="text-[9px] bg-emerald-950/25 border border-emerald-900/40 text-emerald-400 font-bold px-2 py-1 rounded-md">LIVE</span>
                  </div>
                </div>
              </div>

              {/* Tab Selector for logistics vs wallet ledger */}
              <div className="flex bg-black/35 border border-slate-850/50 p-1 rounded-2xl gap-2 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setDetailTab('logistics')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    detailTab === 'logistics'
                      ? 'bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]'
                      : 'border border-transparent text-slate-500 hover:text-slate-350'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  {isAr ? 'سجل عمليات الشحنات واللوجيستيات' : 'Sales & Logistics Statement'}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('financial')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    detailTab === 'financial'
                      ? 'bg-emerald-950/20 border border-emerald-900/30 text-emerald-400'
                      : 'border border-transparent text-slate-500 hover:text-slate-350'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  {isAr ? 'كشف الحساب المالي التفصيلي' : 'Detailed Financial Ledger'}
                </button>
              </div>

              {detailTab === 'logistics' ? (
                <>
                  {/* Client Ledger Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between text-start">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500">{isAr ? 'إجمالي فواتير الحساب' : 'Total Orders'}</span>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xl font-black text-white">{totalOrdersCount} <span className="text-[10px] text-slate-500 font-normal">UNIT</span></span>
                        <Package className="w-6 h-6 text-[#d4af37]/20" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between text-start">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500">{isAr ? 'إجمالي حساب المستحقات (القيمة)' : 'Gross Shipment value'}</span>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-base font-mono font-black text-[#d4af37]">{totalAmount.toLocaleString()} <span className="text-[9px] text-slate-500 font-sans font-normal">YER</span></span>
                        <DollarSign className="w-6 h-6 text-[#d4af37]/20" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between border-r-2 border-r-emerald-500 text-start">
                      <span className="text-[9px] uppercase font-black tracking-wider text-emerald-500">{isAr ? 'المقبوضات الموردة (المدفوعة)' : 'Collected / Liquidified'}</span>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-base font-mono font-black text-emerald-400">{totalPaid.toLocaleString()} <span className="text-[9px] text-slate-500 font-sans font-normal">YER</span></span>
                        <Receipt className="w-6 h-6 text-emerald-500/20" />
                      </div>
                    </div>

                    <div className={`bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between border-r-2 text-start ${totalRemaining >= 0 ? 'border-r-rose-500' : 'border-r-cyan-500'}`}>
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
                     <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center text-start">
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
                </>
              ) : (
                <div className="space-y-4 text-start">
                  
                  {/* Ledger Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 p-4 bg-black/45 border border-slate-850/60 rounded-2xl">
                    <div className="relative flex-1">
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                      <input 
                        type="text"
                        placeholder={isAr ? 'البحث عن حركة بالرقم المرجعي أو البيان دائن/مدين...' : 'Filter ledger entries...'}
                        value={finSearch}
                        onChange={e => setFinSearch(e.target.value)}
                        className="w-full bg-black/50 border border-slate-850 rounded-xl py-2 px-9 text-xs font-bold text-white focus:border-[#d4af37]/50 outline-none text-start"
                      />
                    </div>
                    
                    <select 
                      value={finModuleFilter} 
                      onChange={e => setFinModuleFilter(e.target.value as any)} 
                      className="bg-[#0e0e11] border border-slate-820 rounded-xl py-2 px-3 text-xs font-black text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer text-start"
                    >
                      <option value="all">{isAr ? 'كل قنوات موديولات الحركة' : 'All Ledger Modules'}</option>
                      <option value="order">{isAr ? 'قيمة الرسوم (مبيعات/شحن)' : 'Shipment COD Charges (Debit)'}</option>
                      <option value="payment">{isAr ? 'الكاش المحصل (مدفوعات شحن)' : 'Cash COD Collections (Credit)'}</option>
                      <option value="transaction">{isAr ? 'الإيداعات والقيود المركزية الحركية' : 'Central Bookkeeping (Manual/Direct)'}</option>
                    </select>
                  </div>

                  {/* Unified Chronological Ledger Table */}
                  <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center text-start">
                      <h4 className="font-black text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <Coins className="w-4 h-4 text-emerald-400 animate-pulse" />
                        {isAr ? 'كشف حركة الحساب المالي التفصيلي التراكمي' : 'CHRONOLOGICAL FINANCIAL ACCOUNT AUDIT'}
                      </h4>
                      <span className="text-[10px] bg-emerald-950/25 text-emerald-450 border border-emerald-900/40 px-3 py-1 rounded-lg font-bold font-mono">
                        YER LEDGER
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-black/30 text-[9px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                          <tr>
                            <th className="p-3">{isAr ? 'التاريخ والوقت الحقيقي' : 'Posting Timeline'}</th>
                            <th className="p-3">{isAr ? 'التصنيف / الموديول' : 'Module Classification'}</th>
                            <th className="p-3">{isAr ? 'بيان وشرح الحركة المالية الحركية' : 'Journal Explanation / Narrative'}</th>
                            <th className="p-3">{isAr ? 'المرجع / السند' : 'Audit Link / Ref'}</th>
                            <th className="p-3">{isAr ? 'طبيعة القيد' : 'Entry Type'}</th>
                            <th className="p-3">{isAr ? 'القيمة المالية' : 'Amount'}</th>
                            <th className="p-3 text-left">{isAr ? 'الرصيد المتدرج للمنشأة' : 'Running Entity Balance'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                          {getCustomerUnifiedLedger()
                            .filter(item => {
                              const q = finSearch.toLowerCase();
                              const matchesSearch = !q || 
                                (item.title || '').toLowerCase().includes(q) || 
                                (item.description || '').toLowerCase().includes(q) || 
                                (item.ref || '').toLowerCase().includes(q);
                              const matchesModule = finModuleFilter === 'all' || item.module === finModuleFilter;
                              return matchesSearch && matchesModule;
                            })
                            .map((item, idx) => {
                              const isCredit = item.type === 'Credit';
                              return (
                                <tr key={item.id || idx} className="hover:bg-slate-950/40 transition-colors">
                                  <td className="p-3 font-mono font-bold text-[10px] text-slate-400 text-start" dir="ltr">
                                    {new Date(item.date).toLocaleString(isAr ? 'ar-YE' : 'en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-3 text-start">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                      item.module === 'order' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20' :
                                      item.module === 'payment' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20' :
                                      'bg-amber-955/20 text-amber-500 border border-amber-950/20'
                                    }`}>
                                      {item.module === 'order' ? (isAr ? 'قيمة مبيعات وتوصيل' : 'SalesCOD-Dr') :
                                       item.module === 'payment' ? (isAr ? 'تحصيل كاش مسدد' : 'COD Settled-Cr') :
                                       (isAr ? 'إيداع/تعديل' : 'Journal Entry')}
                                    </span>
                                  </td>
                                  <td className="p-3 font-bold text-white text-start">
                                    <div className="text-xs">{item.title}</div>
                                    <div className="text-[9px] text-slate-500 font-normal mt-0.5">{item.description}</div>
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-[#d4af37] font-black text-start">{item.ref}</td>
                                  <td className="p-3 text-start">
                                    {isCredit ? (
                                      <span className="text-[9px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2.5 py-0.5 rounded-xl font-black">{isAr ? 'قيد دائن (+)' : 'Credit (+)'}</span>
                                    ) : (
                                      <span className="text-[9px] bg-rose-955/20 text-rose-500 border border-rose-950/30 px-2.5 py-0.5 rounded-xl font-black">{isAr ? 'قيد مدين (-)' : 'Debit (-)'}</span>
                                    )}
                                  </td>
                                  <td className={`p-3 font-mono font-black text-xs ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isCredit ? '+' : '-'}{item.amount.toLocaleString()} YER
                                  </td>
                                  <td className={`p-3 text-left font-mono font-black text-xs ${item.runningAccountBal >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                                    {item.runningAccountBal.toLocaleString()} YER
                                  </td>
                                </tr>
                              );
                            })}
                          
                          {getCustomerUnifiedLedger().length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-16 text-center text-slate-650 italic font-bold">
                                {isAr ? '[ لم يتم تسجيل أي حركات مالية على هذا الحساب ]' : '[ NO FINANCIAL TRANSACTIONS REGISTERED ON THIS ACCOUNT ]'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
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
