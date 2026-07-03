import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import { useSettings } from '../context/SettingsContext';
import { whatsappService } from '../services/whatsappService';
import { 
  X, 
  Search, 
  User, 
  Package, 
  DollarSign, 
  Truck, 
  AlertTriangle, 
  ExternalLink,
  ShieldCheck,
  MapPin,
  Globe,
  Wallet,
  FileText,
  RefreshCw,
  Phone,
  Mail,
  ArrowLeft,
  ArrowRight,
  Crown,
  Settings
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
}

type SearchCategory = 'all' | 'orders' | 'users' | 'customers' | 'couriers' | 'sources' | 'expenses' | 'accounting' | 'system';

export default function GlobalSearchModal({ isOpen, onClose, searchQuery }: GlobalSearchModalProps) {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';
  const navigate = useNavigate();
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [activeTab, setActiveTab] = useState<SearchCategory>('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // DB datasets
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [couriersData, setCouriersData] = useState<any[]>([]);
  const [sourcesData, setSourcesData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [accountsData, setAccountsData] = useState<any[]>([]);
  const [journalData, setJournalData] = useState<any[]>([]);
  const [salaryData, setSalaryData] = useState<any[]>([]);
  const [rolesData, setRolesData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);

  const fetchAllSystemData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'couriers')),
        getDocs(collection(db, 'sources')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'accounts')),
        getDocs(collection(db, 'journal_entries')),
        getDocs(collection(db, 'salary_history')),
        getDocs(collection(db, 'roles')),
        getDocs(query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(100)))
      ]);

      const dataSet: any[] = results.map(res => res.status === 'fulfilled' ? res.value : null);

      const [
        ordersSnap, 
        usersSnap, 
        customersSnap, 
        couriersSnap, 
        sourcesSnap, 
        expensesSnap,
        accountsSnap,
        journalSnap,
        salarySnap,
        rolesSnap,
        activitySnap
      ] = dataSet;

      if (ordersSnap) setOrdersData(ordersSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'order', ...d.data() })));
      if (usersSnap) setUsersData(usersSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'user', ...d.data() })));
      if (customersSnap) setCustomersData(customersSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'customer', ...d.data() })));
      if (couriersSnap) setCouriersData(couriersSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'courier', ...d.data() })));
      if (sourcesSnap) setSourcesData(sourcesSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'source', ...d.data() })));
      if (expensesSnap) setExpensesData(expensesSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'expense', ...d.data() })));
      if (accountsSnap) setAccountsData(accountsSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'account', ...d.data() })));
      if (journalSnap) setJournalData(journalSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'journal', ...d.data() })));
      if (salarySnap) setSalaryData(salarySnap.docs.map((d: any) => ({ id: d.id, _searchType: 'salary', ...d.data() })));
      if (rolesSnap) setRolesData(rolesSnap.docs.map((d: any) => ({ id: d.id, _searchType: 'role', ...d.data() })));
      if (activitySnap) setActivityData(activitySnap.docs.map((d: any) => ({ id: d.id, _searchType: 'activity', ...d.data() })));
    } catch (err) {
      console.error("Error pre-loading system search data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLocalQuery(searchQuery);
      fetchAllSystemData();
    } else {
      setOrdersData([]);
      setUsersData([]);
      setCustomersData([]);
      setCouriersData([]);
      setSourcesData([]);
      setExpensesData([]);
      setAccountsData([]);
      setJournalData([]);
      setSalaryData([]);
      setRolesData([]);
      setActivityData([]);
      setSelectedItem(null);
    }
  }, [isOpen, searchQuery]);

  if (!isOpen) return null;

  // Filter lists based on clean user text
  const cleanText = localQuery.trim().toLowerCase();

  const matchedOrders = ordersData.filter(ord => {
    if (!cleanText) return true;
    return (
      String(ord.orderNumber || '').toLowerCase().includes(cleanText) ||
      String(ord.customerName || '').toLowerCase().includes(cleanText) ||
      String(ord.customerPhone || '').toLowerCase().includes(cleanText) ||
      String(ord.trackingNumber || '').toLowerCase().includes(cleanText) ||
      String(ord.externalOrderNumber || '').toLowerCase().includes(cleanText) ||
      String(ord.shippingCompany || '').toLowerCase().includes(cleanText) ||
      String(ord.orderSource || '').toLowerCase().includes(cleanText) ||
      String(ord.orderStatus || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedUsers = usersData.filter(u => {
    if (!cleanText) return true;
    return (
      String(u.fullName || '').toLowerCase().includes(cleanText) ||
      String(u.username || '').toLowerCase().includes(cleanText) ||
      String(u.email || '').toLowerCase().includes(cleanText) ||
      String(u.role || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedCustomers = customersData.filter(c => {
    if (!cleanText) return true;
    return (
      String(c.fullName || '').toLowerCase().includes(cleanText) ||
      String(c.phone || '').toLowerCase().includes(cleanText) ||
      String(c.email || '').toLowerCase().includes(cleanText) ||
      String(c.address || '').toLowerCase().includes(cleanText) ||
      String(c.notes || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedCouriers = couriersData.filter(cr => {
    if (!cleanText) return true;
    return (
      String(cr.fullName || '').toLowerCase().includes(cleanText) ||
      String(cr.phone || '').toLowerCase().includes(cleanText) ||
      String(cr.email || '').toLowerCase().includes(cleanText) ||
      String(cr.address || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedSources = sourcesData.filter(s => {
    if (!cleanText) return true;
    return (
      String(s.source_name || '').toLowerCase().includes(cleanText) ||
      String(s.location || '').toLowerCase().includes(cleanText) ||
      String(s.contact_info || '').toLowerCase().includes(cleanText) ||
      String(s.notes || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedExpenses = expensesData.filter(ex => {
    if (!cleanText) return true;
    return (
      String(ex.recipientName || '').toLowerCase().includes(cleanText) ||
      String(ex.notes || '').toLowerCase().includes(cleanText) ||
      String(ex.createdByName || '').toLowerCase().includes(cleanText) ||
      String(ex.amount || '').toLowerCase().includes(cleanText) ||
      String(ex.type || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedAccounts = accountsData.filter(a => {
    if (!cleanText) return true;
    return (
      String(a.accountCode || '').toLowerCase().includes(cleanText) ||
      String(a.entityName || '').toLowerCase().includes(cleanText) ||
      String(a.entityType || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedJournal = journalData.filter(j => {
    if (!cleanText) return true;
    return (
      String(j.entryNumber || '').toLowerCase().includes(cleanText) ||
      String(j.description || '').toLowerCase().includes(cleanText) ||
      String(j.debitAccountName || '').toLowerCase().includes(cleanText) ||
      String(j.creditAccountName || '').toLowerCase().includes(cleanText) ||
      String(j.amount || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedSalary = salaryData.filter(s => {
    if (!cleanText) return true;
    return (
      String(s.employeeName || '').toLowerCase().includes(cleanText) ||
      String(s.salaryMonth || '').toLowerCase().includes(cleanText) ||
      String(s.voucherCode || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedRoles = rolesData.filter(r => {
    if (!cleanText) return true;
    return (
      String(r.nameAr || '').toLowerCase().includes(cleanText) ||
      String(r.nameEn || '').toLowerCase().includes(cleanText) ||
      String(r.description || '').toLowerCase().includes(cleanText)
    );
  });

  const matchedActivity = activityData.filter(act => {
    if (!cleanText) return true;
    return (
      String(act.action || '').toLowerCase().includes(cleanText) ||
      String(act.performedBy || '').toLowerCase().includes(cleanText) ||
      String(act.details || '').toLowerCase().includes(cleanText)
    );
  });

  const systemFeatures = [
    { id: 'dashboard', nameAr: 'لوحة التحكم', nameEn: 'Dashboard', path: '/' },
    { id: 'orders', nameAr: 'إدارة الطلبات', nameEn: 'Order Management', path: '/orders' },
    { id: 'customers', nameAr: 'العملاء', nameEn: 'Customers', path: '/customers' },
    { id: 'sources', nameAr: 'مصادر الطلبات', nameEn: 'Order Sources', path: '/sources' },
    { id: 'users', nameAr: 'المستخدمين', nameEn: 'Users', path: '/users' },
    { id: 'couriers', nameAr: 'المناديب', nameEn: 'Couriers', path: '/couriers' },
    { id: 'roles', nameAr: 'الصلاحيات والأدوار', nameEn: 'Roles & Permissions', path: '/roles' },
    { id: 'settings', nameAr: 'الإعدادات', nameEn: 'Settings', path: '/settings' },
    { id: 'expenses', nameAr: 'المصروفات والعهد', nameEn: 'Expenses & Custody', path: '/expenses' },
    { id: 'accounting', nameAr: 'المحاسبة والقيود', nameEn: 'Accounting & Ledger', path: '/accounting' },
    { id: 'reports', nameAr: 'التقارير والإحصائيات', nameEn: 'Reports & Statistics', path: '/reports' },
    { id: 'notifications', nameAr: 'الإشعارات', nameEn: 'Notifications', path: '/notifications' },
    { id: 'salary-history', nameAr: 'سجل الرواتب', nameEn: 'Salary History', path: '/salary-history' },
  ];

  const matchedFeatures = systemFeatures.filter(f => {
    if (!cleanText) return true;
    return (
      (f.nameAr || '').toLowerCase().includes(cleanText) ||
      (f.nameEn || '').toLowerCase().includes(cleanText)
    );
  });

  // Combined Results list
  const combinedResults = [
    ...matchedOrders.map(o => ({ ...o, _displayType: isAr ? 'شحنة/طلب' : 'Order', _color: 'cyan' })),
    ...matchedUsers.map(u => ({ ...u, _displayType: isAr ? 'موظف' : 'Staff', _color: 'purple' })),
    ...matchedCustomers.map(c => ({ ...c, _displayType: isAr ? 'عميل كلي' : 'Customer', _color: 'emerald' })),
    ...matchedCouriers.map(cr => ({ ...cr, _displayType: isAr ? 'مندوب توزيع' : 'Courier', _color: 'amber' })),
    ...matchedSources.map(s => ({ ...s, _displayType: isAr ? 'مصدر توريد' : 'Source', _color: 'blue' })),
    ...matchedExpenses.map(ex => ({ ...ex, _displayType: isAr ? 'حركة مالية' : 'Finance', _color: 'rose' })),
    ...matchedAccounts.map(a => ({ ...a, _displayType: isAr ? 'حساب مالي' : 'Account', _color: 'indigo' })),
    ...matchedJournal.map(j => ({ ...j, _displayType: isAr ? 'قيد محاسبي' : 'Journal Entry', _color: 'violet' })),
    ...matchedSalary.map(s => ({ ...s, _displayType: isAr ? 'سند راتب' : 'Salary Record', _color: 'lime' })),
    ...matchedRoles.map(r => ({ ...r, _displayType: isAr ? 'صلاحية/دور' : 'Role', _color: 'fuchsia' })),
    ...matchedFeatures.map(f => ({ ...f, _searchType: 'system', _displayType: isAr ? 'واجهة/قسم' : 'System Feature', _color: 'gold' })),
  ];

  // Helper translations and colors
  const formatStatus = (status: string) => {
    const translation: Record<string, string> = {
      'تم تسجيل الطلب': isAr ? 'تم تسجيل الطلب' : 'Registered',
      'وصل مستودع السعودية': isAr ? 'وصل مستودع السعودية' : 'Saudi HUB',
      'جاري الشحن لليمن': isAr ? 'جاري الشحن لليمن' : 'Yemen Transit',
      'في التخليص الجمركي': isAr ? 'التخليص الجمركي' : 'Customs',
      'وصل مركز التوزيع في اليمن': isAr ? 'وصل مركز التوزيع باليمن' : 'Yemen HUB',
      'مع المندوب للتوصيل': isAr ? 'مع المندوب للتوصيل 🚚' : 'Out for Delivery',
      'تم التسليم': isAr ? 'تم التسليم وتفصيل العهد' : 'Delivered & Settled',
      'ملغي': isAr ? 'ملغي' : 'Cancelled',
      'Pending': isAr ? 'تم تسجيل الطلب' : 'Registered',
      'Shipped': isAr ? 'جاري الشحن لليمن' : 'Yemen Transit',
      'In Transit': isAr ? 'جاري الشحن لليمن' : 'Yemen Transit',
      'Processing': isAr ? 'تم تسجيل الطلب' : 'Registered',
      'In Local Warehouse': isAr ? 'وصل مركز التوزيع باليمن' : 'Yemen HUB',
      'Out For Delivery': isAr ? 'مع المندوب للتوصيل 🚚' : 'Out for Delivery',
      'Delivered': isAr ? 'تم التسليم بنجاح ✅' : 'Delivered Successfully',
      'Cancelled': isAr ? 'ملغي ❌' : 'Cancelled'
    };
    return translation[status] || status;
  };

  const getRoleLabel = (role: string) => {
    const translation: Record<string, string> = {
      'admin': isAr ? 'مدير النظام 👑' : 'System Owner',
      'Admin': isAr ? 'مدير النظام 👑' : 'System Owner',
      'courier': isAr ? 'مندوب توصيل 🚚' : 'Delivery Courier',
      'Courier': isAr ? 'مندوب توصيل 🚚' : 'Delivery Courier',
      'staff': isAr ? 'موظف تشغيل 👥' : 'Operations Staff',
      'Staff': isAr ? 'موظف تشغيل 👥' : 'Operations Staff',
    };
    return translation[role] || role;
  };

  const getWhatsAppUrl = (order: any) => {
    if (!order) return '#';
    const text = isAr 
      ? `مرحباً عميلنا الكريم ${order.customerName || ''}،\nنود إفادتك بأن حالة طلبك رقم: (${order.orderNumber || ''}) هي حالياً: *${order.orderStatus || order.order_status || 'قيد المعالجة'}*.\n\n🚚 شركة الشحن: ${order.shippingCompany || order.carrier || '—'}\n📌 رقم التتبع الدولي: ${order.trackingNumber || '—'}\n💵 القيمة الإجمالية: ${((parseFloat(order.amountPaid) || 0) + (parseFloat(order.amountRemaining) || 0)).toLocaleString()} ريال يمني\n💳 المدفوع: ${parseFloat(order.amountPaid || '0').toLocaleString()} YER\n⚠️ المتبقي: ${parseFloat(order.amountRemaining || '0').toLocaleString()} YER\n\nشكراً لتعاملك مع alx!`
      : `Hello customer ${order.customerName || ''},\nWe would like to inform you that your order (${order.orderNumber || ''}) status is: *${order.orderStatus || order.order_status || 'Processing'}*.\n\n🚚 Shipping Company: ${order.shippingCompany || order.carrier || '—'}\n📌 International Tracking: ${order.trackingNumber || '—'}\n💵 Total Amount: ${((parseFloat(order.amountPaid) || 0) + (parseFloat(order.amountRemaining) || 0)).toLocaleString()} YER\n💳 Paid: ${parseFloat(order.amountPaid || '0').toLocaleString()} YER\n⚠️ Remaining: ${parseFloat(order.amountRemaining || '0').toLocaleString()} YER\n\nThank you for choosing alx!`;
    return `https://api.whatsapp.com/send?phone=${order.customerPhone || ''}&text=${encodeURIComponent(text)}`;
  };

  const handleSendWhatsApp = async (order: any) => {
    if (!order || !order.customerPhone) {
      toast.error(isAr ? 'لا يوجد رقم هاتف مسجل للعميل!' : 'No registered customer phone number found!');
      return;
    }
    setSendingWhatsapp(true);
    const text = isAr 
      ? `مرحباً عميلنا الكريم ${order.customerName || ''}،\nنود إفادتك بأن حالة طلبك رقم: (${order.orderNumber || ''}) هي حالياً: *${order.orderStatus || order.order_status || 'قيد المعالجة'}*.\n\n🚚 شركة الشحن: ${order.shippingCompany || order.carrier || '—'}\n📌 رقم التتبع الدولي: ${order.trackingNumber || '—'}\n💵 القيمة الإجمالية: ${((parseFloat(order.amountPaid) || 0) + (parseFloat(order.amountRemaining) || 0)).toLocaleString()} ريال يمني\n💳 المدفوع: ${parseFloat(order.amountPaid || '0').toLocaleString()} YER\n⚠️ المتبقي: ${parseFloat(order.amountRemaining || '0').toLocaleString()} YER\n\nشكراً لتعاملك مع alx!`
      : `Hello customer ${order.customerName || ''},\nWe would like to inform you that your order (${order.orderNumber || ''}) status is: *${order.orderStatus || order.order_status || 'Processing'}*.\n\n🚚 Shipping Company: ${order.shippingCompany || order.carrier || '—'}\n📌 International Tracking: ${order.trackingNumber || '—'}\n💵 Total Amount: ${((parseFloat(order.amountPaid) || 0) + (parseFloat(order.amountRemaining) || 0)).toLocaleString()} YER\n💳 Paid: ${parseFloat(order.amountPaid || '0').toLocaleString()} YER\n⚠️ Remaining: ${parseFloat(order.amountRemaining || '0').toLocaleString()} YER\n\nThank you for choosing alx!`;

    try {
      const result = await whatsappService.sendDirect(
        order.customerPhone,
        text,
        order.orderNumber || order.id,
        'manual_search_share'
      );
      
      if (result && result.success) {
        toast.success(isAr ? 'تم إرسال إشعار WhatsApp التلقائي للعميل بنجاح! 📲✅' : 'WhatsApp notification auto-sent successfully! 📲✅');
      } else {
        toast.error(isAr 
          ? `فشل إرسال الإشعار التلقائي: ${result?.errorMsg || result?.status || 'تأكد من إعدادات بوابة WhatsApp'}` 
          : `Auto-dispatch failed: ${result?.errorMsg || result?.status || 'Verify WhatsApp configuration'}`
        );
      }
    } catch (err: any) {
      console.error('Error invoking send-whatsapp:', err);
      toast.error(isAr ? 'حدث خطأ غير متوقع أثناء مخاطبة خادم الإرسال للواتساب' : 'Unexpected error invoking WhatsApp dispatch gateway');
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const currentFilteredSet = (() => {
    switch (activeTab) {
      case 'orders': return matchedOrders.map(o => ({ ...o, _displayType: isAr ? 'شحنة/طلب' : 'Order', _color: 'cyan' }));
      case 'users': return matchedUsers.map(u => ({ ...u, _displayType: isAr ? 'موظف' : 'Staff', _color: 'purple' }));
      case 'customers': return matchedCustomers.map(c => ({ ...c, _displayType: isAr ? 'عميل كلي' : 'Customer', _color: 'emerald' }));
      case 'couriers': return matchedCouriers.map(cr => ({ ...cr, _displayType: isAr ? 'مندوب توزيع' : 'Courier', _color: 'amber' }));
      case 'sources': return matchedSources.map(s => ({ ...s, _displayType: isAr ? 'مصدر توريد' : 'Source', _color: 'blue' }));
      case 'expenses': return matchedExpenses.map(ex => ({ ...ex, _displayType: isAr ? 'حركة مالية' : 'Finance', _color: 'rose' }));
      case 'accounting': return [
        ...matchedAccounts.map(a => ({ ...a, _displayType: isAr ? 'حساب مالي' : 'Account', _color: 'indigo' })),
        ...matchedJournal.map(j => ({ ...j, _displayType: isAr ? 'قيد محاسبي' : 'Journal Entry', _color: 'violet' })),
        ...matchedSalary.map(s => ({ ...s, _displayType: isAr ? 'سند راتب' : 'Salary Record', _color: 'lime' }))
      ];
      case 'system': return [
        ...matchedRoles.map(r => ({ ...r, _displayType: isAr ? 'صلاحية/دور' : 'Role', _color: 'fuchsia' })),
        ...matchedFeatures.map(f => ({ ...f, _searchType: 'system', _displayType: isAr ? 'واجهة/قسم' : 'System Feature', _color: 'gold' })),
        ...matchedActivity.slice(0, 50).map(act => ({ ...act, _searchType: 'activity', _displayType: isAr ? 'سجل عمليات' : 'Activity Log', _color: 'slate' }))
      ];
      default: return combinedResults;
    }
  })();

  const tabItems: { key: SearchCategory; ar: string; en: string; count: number; color: string }[] = [
    { key: 'all', ar: 'الكل', en: 'All', count: combinedResults.length, color: 'luxury-gold' },
    { key: 'orders', ar: 'الطلبات', en: 'Orders', count: matchedOrders.length, color: 'cyan-400' },
    { key: 'users', ar: 'الموظفين', en: 'Staff', count: matchedUsers.length, color: 'purple-400' },
    { key: 'customers', ar: 'العملاء', en: 'Customers', count: matchedCustomers.length, color: 'emerald-400' },
    { key: 'couriers', ar: 'المندوبين', en: 'Couriers', count: matchedCouriers.length, color: 'amber-400' },
    { key: 'accounting', ar: 'المحاسبة', en: 'Accounting', count: matchedAccounts.length + matchedJournal.length + matchedSalary.length, color: 'indigo-400' },
    { key: 'expenses', ar: 'المصروفات', en: 'Expenses', count: matchedExpenses.length, color: 'rose-400' },
    { key: 'system', ar: 'النظام', en: 'System', count: matchedRoles.length + matchedFeatures.length + Math.min(50, matchedActivity.length), color: 'gold-400' }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <Package className="w-4 h-4 text-cyan-400" />;
      case 'user': return <ShieldCheck className="w-4 h-4 text-purple-400" />;
      case 'customer': return <User className="w-4 h-4 text-emerald-400" />;
      case 'courier': return <Truck className="w-4 h-4 text-amber-400" />;
      case 'source': return <Globe className="w-4 h-4 text-blue-400" />;
      case 'expense': return <Wallet className="w-4 h-4 text-rose-400" />;
      case 'account': return <DollarSign className="w-4 h-4 text-indigo-400" />;
      case 'journal': return <FileText className="w-4 h-4 text-violet-400" />;
      case 'salary': return <Wallet className="w-4 h-4 text-lime-400" />;
      case 'role': return <ShieldCheck className="w-4 h-4 text-fuchsia-400" />;
      case 'activity': return <RefreshCw className="w-4 h-4 text-slate-400" />;
      case 'system': return <Settings className="w-4 h-4 text-gold-400" />;
      default: return <Search className="w-4 h-4 text-[#d4af37]" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in text-start select-none">
      <div className="bg-[#0b0b0d] border border-slate-800/80 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] text-slate-300">
        
        {/* Header Bar */}
        <div className="p-6 border-b border-[#d4af37]/10 flex justify-between items-center bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-2xl text-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.1)]">
              <Search className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-white text-lg tracking-wide">
                {isAr ? 'البحث العالمي الفوري الذكي ⚡' : 'Smart Universal Fast Search ⚡'}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] mt-0.5">
                {isAr 
                  ? 'ابحث عبر كافة أركان النظام: الطلبات • الموظفين • المندوبين • العملاء والشركاء والمصروفات' 
                  : 'Search everything: orders, staff profiles, couriers, global customers, sources and ledger entries'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllSystemData}
              title={isAr ? 'مزامنة وتحديث البيانات' : 'Force reload system indices'}
              className="text-slate-500 hover:text-emerald-400 bg-slate-900 border border-slate-800/60 p-2.5 rounded-xl transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-white bg-slate-900 border border-slate-800/60 p-2.5 rounded-xl transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Real-time Input Field */}
        <div className="p-4 bg-black/20 border-b border-slate-800/60 flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder={isAr ? 'اكتب أي كلمة، رقم هاتف، رقم طلب، أو اسم للبحث الفوري وبنتائج حقيقية...' : 'Type order ID, phone number, name or keyword for 0ms lookup...'}
              className="w-full bg-[#050506] border border-[#d4af37]/25 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37] placeholder:text-slate-600 font-bold text-start"
              dir={isAr ? 'rtl' : 'ltr'}
              autoFocus
            />
            {cleanText && (
              <button
                onClick={() => setLocalQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold"
              >
                {isAr ? 'مسح' : 'Clear'}
              </button>
            )}
          </div>
        </div>

        {/* Split Screen Dashboard Area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Panel: Search results list hierarchy & tab selectors */}
          <div className="w-full md:w-[380px] shrink-0 border-r border-slate-800/70 flex flex-col bg-black/10">
            
            {/* Scrollable Horizontal Tabs Row */}
            <div className="p-3 border-b border-slate-800/50 flex gap-2 overflow-x-auto custom-scrollbar shrink-0 select-none">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelectedItem(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wide shrink-0 transition-all border flex items-center gap-1.5 ${
                    activeTab === tab.key
                      ? 'bg-[#d4af37]/10 text-white border-[#d4af37] shadow-[inset_0_0_10px_rgba(212,175,55,0.05)]'
                      : 'bg-[#0a0a0c] text-slate-400 border-slate-800/70 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span>{isAr ? tab.ar : tab.en}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono ${
                    activeTab === tab.key ? 'bg-[#d4af37] text-black font-extrabold' : 'bg-slate-900 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Results list body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center select-none">
                  <div className="h-8 w-8 animate-spin rounded border-2 border-[#d4af37]/20 border-t-[#d4af37] mb-3"></div>
                  <span className="font-bold text-xs">{isAr ? 'جاري فهرسة ومزامنة قواعد البيانات...' : 'Indexing databases...'}</span>
                </div>
              ) : currentFilteredSet.length === 0 ? (
                <div className="text-center py-20 text-slate-600 font-bold flex flex-col items-center select-none">
                  <AlertTriangle className="w-10 h-10 text-slate-800 mb-2" />
                  <p className="text-slate-400 text-xs">{isAr ? 'لا توجد نتائج مطابقة لمدخلات البحث.' : 'No matched records.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-black px-1 pb-1">
                    <span>{isAr ? 'العنصر المكتشف' : 'Found Object'}</span>
                    <span>{currentFilteredSet.length} {isAr ? 'تحت التصفية' : 'Filtered'}</span>
                  </div>
                  
                  {currentFilteredSet.map((item) => {
                    const type = item._searchType;
                    const isSelected = selectedItem && selectedItem.id === item.id && selectedItem._searchType === type;
                    return (
                      <div
                        key={`${type}-${item.id}`}
                        onClick={() => setSelectedItem(item)}
                        className={`w-full p-3.5 rounded-xl transition-all duration-300 text-start flex items-center justify-between gap-3 border cursor-pointer relative ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#d4af37]/15 to-[#0b0b0d] border-[#d4af37] shadow-[inset_3px_0_10px_rgba(212,175,55,0.04)]'
                            : 'bg-[#08080a] hover:bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            isSelected ? 'bg-[#d4af37]/20' : 'bg-slate-950 border border-slate-800/60'
                          }`}>
                            {getIcon(type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                              {/* Primary Badge or ID display */}
                              <span className="text-[9px] font-mono font-black text-[#d4af37] tracking-wider uppercase">
                                {type === 'order' ? (item.orderNumber || item.id) : item._displayType}
                              </span>
                              <span className="text-[8px] text-slate-500 font-bold">
                                {type === 'order' && formatStatus(item.orderStatus || item.order_status)}
                                {type === 'user' && getRoleLabel(item.role)}
                                {type === 'expense' && `${item.amount} ${item.currency || 'YER'}`}
                                {type === 'customer' && (isAr ? 'ملف نشط' : 'Active')}
                                {type === 'courier' && (isAr ? 'تأدية عهدة' : 'Courier')}
                                {type === 'source' && (item.type || 'App')}
                              </span>
                            </div>
                            
                            <p className="text-xs font-black text-white truncate">
                              {type === 'order' && item.customerName}
                              {type === 'user' && item.fullName}
                              {type === 'customer' && item.fullName}
                              {type === 'courier' && item.fullName}
                              {type === 'source' && (item.source_name || item.name)}
                              {type === 'expense' && (item.notes ? item.notes.substring(0, 30) + '...' : item.recipientName || (isAr ? 'مصروف عام' : 'Expense'))}
                              {type === 'account' && item.entityName}
                              {type === 'journal' && item.description}
                              {type === 'salary' && item.employeeName}
                              {type === 'role' && (isAr ? item.nameAr : item.nameEn)}
                              {type === 'system' && (isAr ? item.nameAr : item.nameEn)}
                              {type === 'activity' && item.action}
                            </p>
                            
                            <p className="text-[10px] text-slate-500 font-semibold truncate font-mono mt-0.5">
                              {type === 'order' && item.customerPhone}
                              {type === 'user' && `@${item.username || 'user'}`}
                              {type === 'customer' && item.phone}
                              {type === 'courier' && item.phone}
                              {type === 'source' && (item.location || '—')}
                              {type === 'expense' && `${isAr ? 'بواسطة' : 'By'}: ${item.createdByName || '—'}`}
                              {type === 'account' && item.accountCode}
                              {type === 'journal' && item.entryNumber}
                              {type === 'salary' && item.salaryMonth}
                              {type === 'role' && item.id}
                              {type === 'system' && item.path}
                              {type === 'activity' && item.performedBy}
                            </p>
                          </div>
                        </div>

                        {/* Arrow Link to specific page layout */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            let targetPath = '/';
                            if (type === 'order') targetPath = '/orders';
                            else if (type === 'user') targetPath = '/users';
                            else if (type === 'customer') targetPath = '/customers';
                            else if (type === 'courier') targetPath = '/couriers';
                            else if (type === 'source') targetPath = '/sources';
                            else if (type === 'expense') targetPath = '/expenses';
                            else if (type === 'account') targetPath = '/accounting';
                            else if (type === 'journal') targetPath = '/accounting';
                            else if (type === 'salary') targetPath = '/salary-history';
                            else if (type === 'role') targetPath = '/roles';
                            else if (type === 'system') targetPath = item.path;
                            else if (type === 'activity') targetPath = '/settings';
                            
                            navigate(targetPath, { state: { selectedId: item.id } });
                            onClose();
                          }}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-[#d4af37]/25 border border-slate-800/80 hover:border-[#d4af37]/50 text-slate-400 hover:text-white transition-all shrink-0 ml-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center group"
                          title={isAr ? 'ذهاب للواجهة الخاصة بها' : 'Navigate to page'}
                        >
                          {isAr ? (
                            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                          ) : (
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: High fidelity details interactive deck */}
          <div className="flex-1 h-full overflow-y-auto p-6 bg-slate-950/30 custom-scrollbar min-h-0 flex flex-col justify-between">
            {!selectedItem ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 select-none">
                <Crown className="w-14 h-14 text-slate-800 rotate-12 mb-4 animate-bounce" />
                <h4 className="font-extrabold text-white text-sm uppercase tracking-widest">{isAr ? 'شاشة تفاصيل الكيان الموحد 📊' : 'Unified Entity Panel 📊'}</h4>
                <p className="text-xs text-slate-500 font-bold max-w-sm mt-2">
                  {isAr 
                    ? 'اختر أي طلب أو موظف أو عميل أو حركة مالية من نتائج البحث على اليسار لعرض البطاقة التفاعلية والتحكم والولوج السريع للمفاتيح' 
                    : 'Select any order, staff, customer, courier or transaction on the left index to inspect complete data metrics instantly'}
                </p>
                
                {/* Micro metrics count details for administrative awareness */}
                <div className="grid grid-cols-3 gap-3 max-w-sm w-full mt-8 pt-6 border-t border-slate-800/60 font-sans text-start">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900">
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider block mb-0.5">{isAr ? 'الطلبات' : 'Orders'}</span>
                    <span className="text-sm font-mono font-black text-white">{ordersData.length}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900">
                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-wider block mb-0.5">{isAr ? 'الموظفين' : 'Staff'}</span>
                    <span className="text-sm font-mono font-black text-white">{usersData.length}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900">
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider block mb-0.5">{isAr ? 'العملاء' : 'Cust'}</span>
                    <span className="text-sm font-mono font-black text-white">{customersData.length}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 flex-1 flex flex-col justify-between h-full">
                
                <div className="space-y-6">
                  {/* Dynamic Top Stat Bar */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                        {getIcon(selectedItem._searchType)}
                      </div>
                      <div>
                        <span className="text-[9px] font-black tracking-widest text-[#d4af37] uppercase block leading-none mb-1">
                          {isAr ? 'نوع الكيان المحدد • ' : 'Matched Entity ID • '}{selectedItem._displayType}
                        </span>
                        <span className="text-base font-mono font-black text-white leading-none">
                          {selectedItem._searchType === 'order' ? (selectedItem.orderNumber || selectedItem.id) : (selectedItem.fullName || selectedItem.source_name || selectedItem.id.substring(0, 15).toUpperCase())}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-bold">{isAr ? 'الحالة المعيارية:' : 'Metric State:'}</span>
                      <span className="px-3.5 py-1 rounded-xl text-[11px] font-black bg-slate-900 border border-slate-800 text-white shadow-sm">
                        {selectedItem._searchType === 'order' && formatStatus(selectedItem.orderStatus || selectedItem.order_status)}
                        {selectedItem._searchType === 'user' && getRoleLabel(selectedItem.role)}
                        {selectedItem._searchType === 'customer' && (isAr ? 'نشط بالنظام' : 'Active Customer')}
                        {selectedItem._searchType === 'courier' && (isAr ? 'مسجل ومصرح للخدمة' : 'Authorized Courier')}
                        {selectedItem._searchType === 'source' && (selectedItem.type || 'App')}
                        {selectedItem._searchType === 'expense' && (selectedItem.type || 'General')}
                      </span>
                    </div>
                  </div>

                  {/* CUSTOM PREVIEW DECKS ACCORDING TO TYPE */}

                  {/* 1️⃣ ORDER DETAILS PREVIEW */}
                  {selectedItem._searchType === 'order' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-start">
                      
                      {/* Customer Info Card */}
                      <div className="bg-slate-950/40 border border-slate-800/80 p-4.5 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2.5">
                          <User className="w-4.5 h-4.5 text-cyan-400" />
                          <span className="font-extrabold text-xs text-white">{isAr ? 'بيانات العميل المتصل' : 'Customer Account'}</span>
                        </div>
                        <div className="space-y-2 text-xs text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'الاسم الكامل:' : 'Full Name:'}</span>
                            <span className="font-extrabold text-[#d4af37]">{selectedItem.customerName || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'رقم الهاتف:' : 'Phone:'}</span>
                            <span className="font-mono text-white font-bold">{selectedItem.customerPhone || '—'}</span>
                          </div>
                          <div className="flex justify-between flex-wrap gap-1">
                            <span className="text-slate-500 font-black w-full">{isAr ? 'العنوان الأساسي:' : 'Address:'}</span>
                            <span className="text-slate-200 text-left w-full pl-2 block bg-slate-950/20 p-2 rounded-lg border border-slate-900">{selectedItem.customerAddress || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Shipment & Tracker Info */}
                      <div className="bg-slate-950/40 border border-slate-800/80 p-4.5 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2.5">
                          <Truck className="w-4.5 h-4.5 text-amber-400" />
                          <span className="font-extrabold text-xs text-white">{isAr ? 'بيانات الشحن واللوجستيات' : 'Carrier Tracking'}</span>
                        </div>
                        <div className="space-y-2 text-xs text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'شركة الشحن:' : 'Carrier:'}</span>
                            <span className="font-extrabold text-white">{selectedItem.shippingCompany || selectedItem.carrier || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'رقم التتبع الدولي:' : 'Tracking Code:'}</span>
                            <span className="font-mono text-amber-400 font-black">{selectedItem.trackingNumber || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'رقم الفاتورة الخارجية:' : 'Original Invoice:'}</span>
                            <span className="font-mono text-slate-400">{selectedItem.externalOrderNumber || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'المصدر المعتمد:' : 'Supplier Node:'}</span>
                            <span className="font-bold text-white">{selectedItem.orderSource || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Financial Metrics */}
                      <div className="bg-slate-950/40 border border-slate-800/80 p-4.5 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2.5">
                          <DollarSign className="w-4.5 h-4.5 text-emerald-400" />
                          <span className="font-extrabold text-xs text-white">{isAr ? 'البيانات والمواقف المالية' : 'Financials'}</span>
                        </div>
                        <div className="space-y-2 text-xs text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'إجمالي التكلفة (ريال يمني):' : 'Total Price YER:'}</span>
                            <span className="font-bold text-white font-mono">{((parseFloat(selectedItem.amountPaid) || 0) + (parseFloat(selectedItem.amountRemaining) || 0)).toLocaleString()} YER</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'التكلفة بالعملة الأجنبية:' : 'Total Cost Code:'}</span>
                            <span className="font-mono text-slate-400">{selectedItem.totalCost || selectedItem.customerPrice || 0} {selectedItem.currency || 'SAR'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'المبلغ المدفوع مقدماً:' : 'Amount Paid:'}</span>
                            <span className="font-bold text-emerald-400 font-mono">{parseFloat(selectedItem.amountPaid || '0').toLocaleString()} YER</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-800/40 pt-2 text-sm leading-relaxed">
                            <span className="text-rose-400 font-black">{isAr ? 'المبلغ المتبقي المعلق:' : 'Balance Due:'}</span>
                            <span className="font-black text-rose-400 font-mono">{parseFloat(selectedItem.amountRemaining || '0').toLocaleString()} YER</span>
                          </div>
                        </div>
                      </div>

                      {/* Yemen Delivery Handler */}
                      <div className="bg-slate-950/40 border border-slate-800/80 p-4.5 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2.5">
                          <Truck className="w-4.5 h-4.5 text-purple-400" />
                          <span className="font-extrabold text-xs text-white">{isAr ? 'تفويض والتسليم المحلي باليمن' : 'Yemen Courier Custody'}</span>
                        </div>
                        <div className="space-y-2 text-xs text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'المندوب المحلي:' : 'Assigned Courier:'}</span>
                            <span className="font-extrabold text-purple-400">{selectedItem.deliveryCourierName || selectedItem.courierName || (isAr ? 'بانتظار التعيين' : 'Unassigned')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'رسوم توصيل المندوب:' : 'Delivery Fee:'}</span>
                            <span className="font-mono text-white">{selectedItem.deliveryCourierFee || 0} YER</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-black">{isAr ? 'حالة السداد المحققة:' : 'Settlement Status:'}</span>
                            <span className="font-bold text-white">{selectedItem.paymentStatus || (isAr ? 'لم تسدد بعد' : 'Unsettled')}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* 2️⃣ STAFF USER PREVIEW */}
                  {selectedItem._searchType === 'user' && (
                    <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-3xl space-y-4 max-w-2xl text-start">
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                        <ShieldCheck className="w-5 h-5 text-purple-400" />
                        <h4 className="font-extrabold text-sm text-white">{isAr ? 'بيانات وإدارة حساب الموظف' : 'Staff Credentials file'}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'الاسم الكامل:' : 'Full Legal Name:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2 rounded-xl text-white font-bold">{selectedItem.fullName || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'اسم المستخدم للدخول وبوابة البن:' : 'System Username:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2 rounded-xl text-purple-300 font-mono font-bold">@{selectedItem.username || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'البريد الإلكتروني الأساسي:' : 'Registration Email:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2 rounded-xl text-slate-300 font-mono">{selectedItem.email || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'الرتبة والمسؤولية الإدارية:' : 'Role Class Privilege:'}</label>
                          <div className="bg-black/40 border border-[#d4af37]/10 p-2 rounded-xl text-[#d4af37] font-black">{getRoleLabel(selectedItem.role)}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'رمز التعريف السريع PIN (كاشير/تتبع):' : 'System PIN Password:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2 rounded-xl text-amber-500 font-mono font-bold">{selectedItem.systemPin || (isAr ? 'غير محدد' : 'Not Set')}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'نسبة العمولة الافتراضية للوساطة:' : 'Default commission rate:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2 rounded-xl text-emerald-400 font-mono font-bold">{selectedItem.commissionRate || 0}%</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3️⃣ CUSTOMER FILE PREVIEW */}
                  {selectedItem._searchType === 'customer' && (
                    <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-3xl space-y-4 max-w-2xl text-start">
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                        <User className="w-5 h-5 text-emerald-400" />
                        <h4 className="font-extrabold text-sm text-white">{isAr ? 'الملف الشخصي الشامل للعميل' : 'Customer Master Profile'}</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'اسم العميل بالكامل:' : 'Customer Name:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-white font-extrabold">{selectedItem.fullName || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'رقم الهاتف للتواصل والدعم:' : 'Primary Contact Phone:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-emerald-400 font-mono font-bold">{selectedItem.phone || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'البريد الإلكتروني:' : 'Email address:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-300 font-semibold">{selectedItem.email || (isAr ? 'لا يوجد بريد مسجل' : 'No email registered')}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'إحداثيات تحديد الموقع GPS:' : 'GPS coordinates for delivery:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-cyan-400 font-mono">
                            {selectedItem.gps_location || selectedItem.gpsLocation || (isAr ? 'غير محدد' : 'No GPS set')}
                          </div>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-slate-500 font-black block">{isAr ? 'العنوان وتفاصيل السكن للتوزيع:' : 'Shipping & Home Address:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-200">{selectedItem.address || (isAr ? 'لا يوجد عنوان تفصيلي مكتوب' : 'No written address is logged')}</div>
                        </div>
                        {selectedItem.notes && (
                          <div className="space-y-1 sm:col-span-2">
                            <label className="text-slate-500 font-black block">{isAr ? 'ملاحظات وتفضيلات العميل:' : 'Special customer preferences/notes:'}</label>
                            <div className="bg-amber-950/15 border border-amber-900/20 p-3 rounded-xl text-slate-300 italic">"{selectedItem.notes}"</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4️⃣ COURIER DETAILS PREVIEW */}
                  {selectedItem._searchType === 'courier' && (
                    <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-3xl space-y-4 max-w-2xl text-start">
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                        <Truck className="w-5 h-5 text-amber-400" />
                        <h4 className="font-extrabold text-sm text-white">{isAr ? 'المواقف والعهد المالية لمندوب التوصيل' : 'Courier Custody & Handling File'}</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'اسم المندوب المعتمد ومسؤول السداد:' : 'Courier Full Name:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-[#d4af37] font-extrabold">{selectedItem.fullName || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'هاتف التواصل المباشر/الواتس:' : 'Direct Contact Phone:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-white font-mono font-extrabold">{selectedItem.phone || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'البريد الالكتروني الرسمي:' : 'Courier Official Email:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-300 font-mono">{selectedItem.email || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'مركز العمل والتوزيع الرئيسي:' : 'Regional Depot Location:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-200">{selectedItem.address || (isAr ? 'اليمن (رئيسي)' : 'Yemen (Core HUB)')}</div>
                        </div>
                        
                        <div className="p-4 sm:col-span-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                            <span className="font-black text-xs text-white uppercase tracking-wider">{isAr ? 'السجل والذمم المالية والعهد المعلقة' : 'Outstanding Liabilities & Balances'}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-bold leading-normal">
                            {isAr 
                              ? 'يرجى مراجعة صفحة المحاسبة والمصروفات لمطابقة ودراسة المبالغ المالية المسلمة بذمة المندوب كعهدة لتجنب أي فروقات بالخزينة.'
                              : 'Ensure matching this delegate record inside the main Accounting sheet to settle outstanding liquid funds securely.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5️⃣ SUPPLIER SOURCE DETAILS PREVIEW */}
                  {selectedItem._searchType === 'source' && (
                    <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-3xl space-y-4 max-w-2xl text-start">
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                        <Globe className="w-5 h-5 text-blue-400" />
                        <h4 className="font-extrabold text-sm text-white">{isAr ? 'مصدر التوريد وقنوات المشتريات المستهدفة' : 'Supplier Procurement Station'}</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'اسم المصدر / الموقع:' : 'Procurement Station name:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-white font-extrabold">{selectedItem.source_name || selectedItem.name}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'التصنيف كـ مصنع أو تطبيق رقمي:' : 'Source Purchase Type:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-blue-400 font-bold">{selectedItem.type || 'App'}</div>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-slate-500 font-black block">{isAr ? 'الرابط المباشر للمنصة (تصفح):' : 'Direct browse URL:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-300 font-mono truncate">
                            {selectedItem.source_url ? (
                              <a 
                                href={selectedItem.source_url.startsWith('http') ? selectedItem.source_url : `https://${selectedItem.source_url}`}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                className="text-blue-400 hover:underline flex items-center gap-1.5"
                              >
                                {selectedItem.source_url} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            ) : '—'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'بيانات التواصل / الوكيل بالمنشأ:' : 'Broker or Direct Contacts:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-200">{selectedItem.contact_info || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'موقع مستودع الاستلام باليمن أو الصين:' : 'Hub Country / Depot City:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-200">{selectedItem.location || '—'}</div>
                        </div>
                        {selectedItem.notes && (
                          <div className="space-y-1 sm:col-span-2">
                            <label className="text-slate-500 font-black block">{isAr ? 'تفاصيل شراء أو ملاحظات:' : 'Logistics details / specific notes:'}</label>
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-slate-400 italic">"{selectedItem.notes}"</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 6️⃣ EXPENSE / FINANCIAL TRANSACTION PREVIEW */}
                  {selectedItem._searchType === 'expense' && (
                    <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-3xl space-y-4 max-w-2xl text-start">
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                        <Wallet className="w-5 h-5 text-rose-400" />
                        <h4 className="font-extrabold text-sm text-white">{isAr ? 'حركة المصروفات والعهدة المالية بالدفاتر' : 'Spent transaction details'}</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'قيمة المبلغ المصروف بالعملة المستهدفة:' : 'Total Spent Funds volume:'}</label>
                          <div className="bg-rose-950/30 border border-rose-500/20 p-2.5 rounded-xl text-rose-400 font-black font-mono text-sm">
                            {parseFloat(selectedItem.amount || '0').toLocaleString()} {selectedItem.currency || 'YER'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'تصنيف السند المالي كاش أو عهدة:' : 'Ledger Book Category:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-white font-extrabold">{selectedItem.type || 'General'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'المسلم إليه / المستحق بالرئيسي:' : 'Recipient person / organization:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-white font-extrabold">{selectedItem.recipientName || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 font-black block">{isAr ? 'تاريخ التدوين والتسجيل بالخزينة:' : 'Financial registration timestamp:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-400 font-mono">
                            {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—'}
                          </div>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-slate-500 font-black block">{isAr ? 'أمين الصندوق أو الموقع الموثق للعملية:' : 'Secured logging operator details:'}</label>
                          <div className="bg-black/40 border border-slate-900 p-2.5 rounded-xl text-slate-300">
                            {selectedItem.createdByName || '—'} • <span className="text-[11px] text-slate-500 font-mono font-bold">@{selectedItem.createdByEmail || '—'}</span>
                          </div>
                        </div>
                        {selectedItem.notes && (
                          <div className="space-y-1 sm:col-span-2">
                            <label className="text-slate-500 font-black block">{isAr ? 'مستند أو سبب الصرف التفصيلي بالقيود:' : 'Descriptive purpose explaining notes:'}</label>
                            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 text-slate-300">"{selectedItem.notes}"</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* Interactive Dynamic Action Deck at custom footer */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-black/40 p-4 rounded-2xl">
                  {/* WhatsApp Support integrations based on entity */}
                  {selectedItem._searchType === 'order' && (
                    <button
                      type="button"
                      disabled={sendingWhatsapp}
                      onClick={() => handleSendWhatsApp(selectedItem)}
                      className={`font-extrabold text-white px-4 py-2.5 rounded-xl transition-all text-xs flex items-center gap-2 shadow-md shadow-emerald-950 ${
                        sendingWhatsapp 
                          ? 'bg-slate-700 cursor-not-allowed opacity-70' 
                          : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      {sendingWhatsapp ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin shrink-0"></div>
                      ) : (
                        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397 0 12.008 0c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 12.003-11.95 12.003-1.999-.001-3.959-.5-5.717-1.447L0 24zm6.59-4.861c1.72 1.02 3.419 1.558 5.411 1.559 5.541 0 10.054-4.515 10.057-10.057.002-2.685-1.042-5.21-2.945-7.111C17.26 1.63 14.734 1.586 12.005 1.586c-5.546 0-10.062 4.515-10.066 10.059-.001 1.93.501 3.81 1.456 5.484L2.378 21.98l4.269-1.121z"/></svg>
                      )}
                      <span>
                        {sendingWhatsapp 
                          ? (isAr ? 'جاري إرسال الإشعار التلقائي للعميل...' : 'Sending notification via WhatsApp...') 
                          : (isAr ? 'إرسال بيانات الحالة والمبلغ المعلق للعميل' : 'Notify customer via WhatsApp')
                        }
                      </span>
                    </button>
                  )}

                  {selectedItem._searchType === 'customer' && (
                    <div className="flex gap-2">
                      {selectedItem.phone && (
                        <>
                          <a
                            href={`tel:${selectedItem.phone}`}
                            className="bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold text-white px-4.5 py-2.5 rounded-xl transition-all text-xs flex items-center gap-2 shrink-0"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            {isAr ? 'اتصال بالرقم' : 'Call customer'}
                          </a>
                          <a
                            href={`https://api.whatsapp.com/send?phone=${selectedItem.phone}`}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="bg-emerald-600 hover:bg-emerald-500 font-extrabold text-white px-4.5 py-2.5 rounded-xl transition-all text-xs flex items-center gap-2 shadow-md shadow-emerald-950 shrink-0"
                          >
                            {isAr ? 'محادثة واتساب' : 'WhatsApp customer'}
                          </a>
                        </>
                      )}
                    </div>
                  )}

                  {selectedItem._searchType === 'courier' && (
                    <div className="flex gap-2">
                      {selectedItem.phone && (
                        <>
                          <a
                            href={`tel:${selectedItem.phone}`}
                            className="bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold text-white px-4.5 py-2.5 rounded-xl transition-all text-xs flex items-center gap-2 shrink-0"
                          >
                            <Phone className="w-3.5 h-3.5 text-amber-400" />
                            {isAr ? 'اتصال بالمندوب' : 'Call courier'}
                          </a>
                          <a
                            href={`https://api.whatsapp.com/send?phone=${selectedItem.phone}`}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="bg-emerald-600 hover:bg-emerald-500 font-extrabold text-white px-4.5 py-2.5 rounded-xl transition-all text-xs flex items-center gap-2 shadow-md shadow-emerald-950 shrink-0"
                          >
                            {isAr ? 'واتس المندوب' : 'WhatsApp courier'}
                          </a>
                        </>
                      )}
                    </div>
                  )}

                  {selectedItem._searchType === 'user' && selectedItem.email && (
                    <a
                      href={`mailto:${selectedItem.email}`}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold text-white px-4.5 py-2.5 rounded-xl transition-all text-xs flex items-center gap-2 shadow-sm"
                    >
                      <Mail className="w-4 h-4 text-purple-400" />
                      {isAr ? 'إرسال بريد رسمي' : 'Send administrative email'}
                    </a>
                  )}

                  {selectedItem._searchType === 'source' && selectedItem.source_url && (
                    <a
                      href={selectedItem.source_url.startsWith('http') ? selectedItem.source_url : `https://${selectedItem.source_url}`}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="bg-blue-600 hover:bg-blue-500 font-bold text-white px-4.5 py-2.5 rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-md shadow-blue-950"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {isAr ? 'زيارة رابط المنصة' : 'Visit Supplier link'}
                    </a>
                  )}

                  <button
                    onClick={() => setSelectedItem(null)}
                    className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl transition-all text-xs font-bold"
                  >
                    {isAr ? 'فك النطاق / تفريغ' : 'Deselect Content'}
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Outer Panel Close Button */}
        <div className="p-4 border-t border-slate-800 bg-[#070709] flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 font-black px-6 py-2.5 rounded-xl transition-all text-xs shadow-md"
          >
            {isAr ? 'إغلاق اللوحة الشاملة' : 'Close Dashboard Panel'}
          </button>
        </div>

      </div>
    </div>
  );
}
