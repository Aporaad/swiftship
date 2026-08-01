import React, { useState, useEffect, useRef, useMemo } from 'react';
import CopyToClipboard from '../components/CopyToClipboard';
import { collection, onSnapshot, orderBy, query, where, addDoc, doc, updateDoc, getDoc, getDocs, deleteDoc, db, auth, handleSupabaseError, OperationType, safeToDate } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
import { useRole } from '../hooks/useRole';
import { notificationService } from '../services/notificationService';
import toast from 'react-hot-toast';
import { activityLogService } from '../services/activityLogService';
import { whatsappService } from '../services/whatsappService';
import ConfirmModal from '../components/ConfirmModal';
import { financialAccountService } from '../services/financialAccountService';
import {
  Plus, Search, Edit2, Truck, Activity, Trash2, DollarSign,
  CreditCard, Printer, Calculator, Package, MapPin, X, AlertCircle, RefreshCw, UserPlus, Eye,
  User, Mail, Phone, Coins, Calendar
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { printContent } from '../lib/printUtils';
import QRCode from 'qrcode';

const ORDER_STATUS_FLOW = [
  'معلق',
  'تم تسجيل الطلب',
  'وصل مستودع السعودية',
  'جاري الشحن لليمن',
  'في التخليص الجمركي',
  'وصل مركز التوزيع في اليمن',
  'مع المندوب للتوصيل',
  'تم التسليم'
];

export default function Orders() {
  const { settings, t } = useSettings();
  const { role, hasPermission, profile, loading: roleLoading } = useRole();
  const canManageOrders = role === 'Admin' || hasPermission('edit_orders');
  const canAddOrders = role === 'Admin' || hasPermission('add_orders');
  const canEditOrderDefaultsCreation = role === 'Admin' || hasPermission('edit_order_defaults_creation');
  const isAr = settings.language === 'ar';

  // Core Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Panels States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddShippingCompanyOpen, setIsAddShippingCompanyOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [activeAddShippingIndex, setActiveAddShippingIndex] = useState<number | string | null>(null);

  // Form Data for newly created Inline Shipping Company
  const [shippingCompanyFormData, setShippingCompanyFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    tracking_url: '',
    address: '',
    notes: ''
  });

  // Form Data for newly created Inline Source of Purchase
  const [sourceFormData, setSourceFormData] = useState({
    source_name: '',
    type: 'App',
    source_url: '',
    contact_info: '',
    location: '',
    notes: ''
  });

  // Focus Orders States
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [customerUnpaidAlert, setCustomerUnpaidAlert] = useState<number | null>(null);

  // Ref for QR Code
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filters State
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  const [autoVoucherRules, setAutoVoucherRules] = useState<any[]>([]);

  // Multi-item sub table state for creation
  const [items, setItems] = useState<any[]>([
    { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, length: 0, width: 0, height: 0, trackingNumber: '' }
  ]);

  // Order Upgrade states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);
  const [previewOrderNumber, setPreviewOrderNumber] = useState('');

  // Products Adjustments
  const [bankCommissionEnabled, setBankCommissionEnabled] = useState(false);
  const [bankCommissionRate, setBankCommissionRate] = useState(3);
  const [bankCommissionType, setBankCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [couponEnabled, setCouponEnabled] = useState(false);
  const [couponRate, setCouponRate] = useState(0);
  const [cartShareCode, setCartShareCode] = useState('');

  // New States for order source types
  const [addShippingEnabled, setAddShippingEnabled] = useState(false);
  const [profitPerKgRate, setProfitPerKgRate] = useState(19);
  const [cbmShippingRateValue, setCbmShippingRateValue] = useState(1400);

  // Shipping packaging fee state
  const [packagingFeeEnabled, setPackagingFeeEnabled] = useState(false);
  const [packagingFeeRate, setPackagingFeeRate] = useState(0);

  // Pre-generate preview order number when modal opens and populate settings defaults
  useEffect(() => {
    if (isAddModalOpen) {
      generateSmartOrderCode().then(code => setPreviewOrderNumber(code));
      setFormData(prev => ({
        ...prev,
        currency: settings.currency || 'SAR',
        exchangeRateYER: settings.exchangeRateSAR || 140,
        exchangeRateUSD: settings.exchangeRateUSD || 535,
        bankCommissionRate: settings.defaultBankCommissionRate ?? 3,
        companyProfitRate: settings.defaultCompanyProfitRate ?? 12,
        packagingFee: settings.defaultPackagingFee ?? 0,
        deliveryCourierFee: settings.defaultDeliveryFee ?? 4000,
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        orderSourceId: '',
        orderSourceName: '',
        externalOrderNumber: '',
        trackingNumber: '',
        amountPaid: 0,
        notes: ''
      }));
      setItems([
        { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, length: 0, width: 0, height: 0, trackingNumber: '' }
      ]);
      setShippings([
        {
          id: Math.random().toString(36).substr(2, 9),
          shippingType: 'بري',
          shippingCompany: 'Aramex',
          shippingSource: '',
          shippingDestination: '',
          shippingDate: new Date().toISOString().split('T')[0],
          shippingDuration: String(
            formData.orderSourceType === 'SHEIN' ? (settings.defaultSheinDuration ?? 12) :
              formData.orderSourceType === 'Factory' ? (settings.defaultFactoryDuration ?? 20) :
                formData.orderSourceType === 'App' ? (settings.defaultAppDuration ?? 10) :
                  (settings.defaultShippingDuration ?? 15)
          ),
          expectedArrival: (() => {
            const dur = formData.orderSourceType === 'SHEIN' ? (settings.defaultSheinDuration ?? 12) :
              formData.orderSourceType === 'Factory' ? (settings.defaultFactoryDuration ?? 20) :
                formData.orderSourceType === 'App' ? (settings.defaultAppDuration ?? 10) :
                  (settings.defaultShippingDuration ?? 15);
            const d = new Date();
            d.setDate(d.getDate() + dur);
            return d.toISOString().split('T')[0];
          })(),
          deliveryDate: '',
          shippingCost: 0,
          packagingFees: 0
        }
      ]);
      setProfitPerKgRate(settings.defaultProfitPerKg ?? 19);
      setCbmShippingRateValue(settings.defaultCbmShippingRate ?? 1400);
      setAddShippingEnabled(false);
    }
  }, [isAddModalOpen, settings]);

  // Multiple shipping details sub table state
  const [shippings, setShippings] = useState<any[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      shippingType: 'بري',
      shippingCompany: 'Aramex',
      shippingSource: '',
      shippingDestination: '',
      shippingDate: '',
      shippingDuration: '',
      expectedArrival: '',
      deliveryDate: '',
      shippingCost: 0,
      packagingFees: 0
    }
  ]);

  const [updateShippings, setUpdateShippings] = useState<any[]>([]);

  // Order Create Form Data 
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    orderSourceId: '',
    orderSourceName: '',
    orderSourceType: 'App', // App or Factory
    externalOrderNumber: '', // Original Code / Salla Number
    trackingNumber: '', // Global tracking ID
    shippingCompany: 'Aramex', // Aramex, DHL, SafePost

    // Courier Links
    shippingCourierId: '', // Saudi courier
    deliveryCourierId: '', // Yemen courier
    deliveryCourierFee: 4000, // Yemen flat delivery rate in YER

    // Rates & Commissions
    currency: 'SAR',
    exchangeRateYER: 390, // YER to SAR default exchange
    exchangeRateUSD: 535, // YER to USD default exchange
    bankCommissionRate: 3, // default 3%
    companyProfitRate: 12, // default 12% profit for general Apps
    packagingFee: 0, // customized packaging fee
    sheinRedPrice: 0, // SHEIN red price overrides

    // Prepayment info
    amountPaid: 0,
    paymentMethod: 'Cash',
    notes: '',
    deductSourcingCostFromCourier: false
  });

  // Edit / Update State 
  const [updateFormData, setUpdateFormData] = useState({
    orderStatus: 'تم تسجيل الطلب',
    deliveryStatus: 'في الانتظار',
    locationYemen: 'مستودع صنعاء الرئيسي',
    internalNotes: '',
    shippingCourierId: '',
    deliveryCourierId: ''
  });

  // New Payment State 
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    method: 'Cash',
    notes: '',
    pin: ''
  });

  // Nested Add Customer Form
  const [customerFormData, setCustomerFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    gps_location: '',
    address: '',
    notes: '',
    walletBalance: 0
  });

  useEffect(() => {
    if (roleLoading) return;

    // Fetch orders synchronized
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleSupabaseError(error, OperationType.LIST, 'orders'));

    // Fetch customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch couriers
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snap) => {
      setCouriers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch order sources
    const unsubSources = onSnapshot(collection(db, 'sources'), (snap) => {
      setSources(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    // Fetch Auto Voucher Rules
    const unsubAutoVoucherRules = onSnapshot(doc(db, 'settings', 'automatic_voucher_rules'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d && d.data && Array.isArray(d.data)) {
          setAutoVoucherRules(d.data);
        }
      }
    });

    // Fetch shipping companies
    const unsubShippingCompanies = onSnapshot(collection(db, 'shipping_companies'), (snap) => {
      console.log("SHIPPING COMPANIES SNAPSHOT RECEIVED, COUNT:", snap.size);
      const list = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || 'بدون اسم', ...doc.data() }));
      console.log("SHIPPING COMPANIES FETCHED IN ORDERS.tsx:", list);
      setShippingCompanies(list);
    }, (error) => {
      console.error("FIRESTORE ERROR ON shipping_companies SNAPSHOT LISTENER IN ORDERS.tsx:", error);
    });

    return () => {
      unsubOrders();
      unsubCustomers();
      unsubCouriers();
      unsubSources();
      unsubAutoVoucherRules();
      unsubShippingCompanies();
    };
  }, [roleLoading]);

  // Auto-seed default shipping companies if they do not exist
  useEffect(() => {
    if (roleLoading) return;

    const seedDefaultCarriers = async () => {
      try {
        const defaults = ['Aramex', 'DHL', 'SafePost', 'Yemen Express'];
        const querySnapshot = await getDocs(collection(db, 'shipping_companies'));
        const existingNames = new Set(
          querySnapshot.docs.map(doc => (doc.data().name || '').trim().toLowerCase())
        );

        for (const carrier of defaults) {
          if (!existingNames.has(carrier.toLowerCase())) {
            await addDoc(collection(db, 'shipping_companies'), {
              name: carrier,
              contact_person: isAr ? 'الناقل الرسمي' : 'Default Carrier',
              phone: '',
              tracking_url: '',
              address: '',
              notes: isAr ? 'تمت الإضافة تلقائياً كشركة شحن افتراضية' : 'Auto-seeded default carrier',
              createdAt: Date.now()
            });
            console.log(`Auto-seeded default carrier in DB: ${carrier}`);
          }
        }
      } catch (err) {
        console.error("Error seeding default carriers:", err);
      }
    };

    seedDefaultCarriers();
  }, [roleLoading]);

  // Handle URL query parameter ?new=true or ?id=ORDER_ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newFlag = params.get('new');
    const orderId = params.get('id');

    if (newFlag === 'true') {
      setIsAddModalOpen(true);
      // Clean up the URL parameter silently
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    } else if (orderId && orders.length > 0) {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
        setIsDetailsModalOpen(true);
        // Clean up URL
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [orders]);

  // Handle customer unpaid alert
  useEffect(() => {
    if (formData.customerId) {
      const custOrders = orders.filter(o => o.customerId === formData.customerId);
      const totalUnpaid = custOrders.reduce((sum, o) => sum + (parseFloat(o.amountRemaining || '0')), 0);
      if (totalUnpaid > 0) {
        setCustomerUnpaidAlert(totalUnpaid);
      } else {
        setCustomerUnpaidAlert(null);
      }

      // Autofill customer profile
      const custRecord = customers.find(c => c.id === formData.customerId);
      if (custRecord) {
        setFormData(prev => ({
          ...prev,
          customerName: custRecord.fullName || '',
          customerPhone: custRecord.phone || '',
          customerAddress: custRecord.address || ''
        }));
      }
    } else {
      setCustomerUnpaidAlert(null);
    }
  }, [formData.customerId, orders, customers]);

  // Track original source configuration
  useEffect(() => {
    if (formData.orderSourceId) {
      const src = sources.find(s => s.id === formData.orderSourceId);
      if (src) {
        setFormData(prev => ({
          ...prev,
          orderSourceName: src.name || '',
          orderSourceType: src.type || 'App'
        }));
      }
    }
  }, [formData.orderSourceId, sources]);

  // Auto-generate unified smart code: [Prefix]-YYMM-[Number]
  const generateSmartOrderCode = async () => {
    const now = new Date();
    const YY = String(now.getFullYear()).slice(-2);
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const prefixStr = settings.orderPrefix || 'ALX';
    const startNum = settings.orderStartNumber || 1001;
    const prefix = `${prefixStr}-${YY}${MM}`;

    try {
      const q = query(
        collection(db, 'orders'),
        where('orderNumber', '>=', prefix),
        where('orderNumber', '<=', prefix + '-\uF8FF')
      );
      const snap = await getDocs(q);
      const curCount = snap.docs.length;
      const nextNum = startNum + curCount;
      return `${prefix}-${nextNum}`;
    } catch (err) {
      console.warn("Exception getting order count, using random placeholder:", err);
      return `${prefix}-${Math.floor(startNum + Math.random() * 9000)}`;
    }
  };

  // Smart Customer Search & Stats Upgrade
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return [];
    return customers.filter(c =>
      (c.fullName || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      (c.phone || '').toLowerCase().includes(customerSearchQuery.toLowerCase())
    );
  }, [customerSearchQuery, customers]);

  const customerProfileStats = useMemo(() => {
    if (!formData.customerId) return null;
    const cust = customers.find(c => c.id === formData.customerId);
    if (!cust) return null;

    const custOrders = orders.filter(o => o.customerId === formData.customerId);
    const totalOrdersCount = custOrders.length;
    const totalOutstandingDebt = custOrders.reduce((sum, o) => sum + parseFloat(o.amountRemaining || '0'), 0);
    const lastOrder = custOrders[0];
    const lastOrderDate = lastOrder ? (lastOrder.createdAt && typeof lastOrder.createdAt.toDate === 'function' ? lastOrder.createdAt.toDate() : new Date(lastOrder.createdAt || Date.now())) : null;

    let tier = 'Regular';
    if (totalOrdersCount >= 5 && totalOutstandingDebt === 0) tier = 'VIP';
    else if (totalOutstandingDebt > 0) tier = 'Debt';

    return {
      customer: cust,
      totalOrdersCount,
      totalOutstandingDebt,
      lastOrderDate,
      tier
    };
  }, [formData.customerId, customers, orders]);

  const selectCustomer = (c: any) => {
    setFormData(prev => ({
      ...prev,
      customerId: c.id,
      customerName: c.fullName || '',
      customerPhone: c.phone || '',
      customerAddress: c.address || ''
    }));
    setCustomerSearchQuery('');
  };

  const clearSelectedCustomer = () => {
    setFormData(prev => ({
      ...prev,
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerAddress: ''
    }));
  };

  const generateOrderInvoicePDF = (order: any) => {
    if (!order) return;
    
    const invoiceHtml = `
      <div style="font-family: 'Cairo', sans-serif; color: #111;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px double #d4af37; padding-bottom: 20px;">
          <div>
            <h1 style="margin: 0; color: #111; font-size: 28px;">${isAr ? 'فاتورة ضريبية' : 'Tax Invoice'}</h1>
            <p style="margin: 8px 0; font-size: 14px;"><strong>${isAr ? 'رقم الطلب' : 'Order #'}:</strong> <span style="font-family: monospace;">${order.orderNumber || '—'}</span></p>
            <p style="margin: 8px 0; font-size: 14px;"><strong>${isAr ? 'التاريخ' : 'Date'}:</strong> ${new Date(order.createdAt || Date.now()).toLocaleDateString()}</p>
          </div>
          <div style="text-align: right;">
             <h2 style="margin: 0; color: #d4af37; font-size: 24px;">${settings.systemName || settings.companyName || 'AL-XPRESS'}</h2>
             <p style="margin: 5px 0; font-size: 13px;">${settings.companyPhone || ''}</p>
             <p style="margin: 5px 0; font-size: 13px;">${settings.companyEmail || ''}</p>
             <p style="margin: 5px 0; font-size: 13px;">${settings.companyAddress || ''}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px;">
          <div style="background: #f8f8fa; padding: 20px; border-radius: 12px; border-right: 4px solid #d4af37;">
            <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 16px;">${isAr ? 'بيانات العميل المستلم' : 'Bill To (Recipient)'}</h3>
            <p style="margin: 8px 0;"><strong>${isAr ? 'الاسم' : 'Name'}:</strong> ${order.customerName || '—'}</p>
            <p style="margin: 8px 0;"><strong>${isAr ? 'الهاتف' : 'Phone'}:</strong> ${order.customerPhone || '—'}</p>
            <p style="margin: 8px 0;"><strong>${isAr ? 'العنوان' : 'Address'}:</strong> ${order.customerAddress || '—'}</p>
          </div>
          <div style="background: #f8f8fa; padding: 20px; border-radius: 12px; border-right: 4px solid #334155;">
            <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 16px;">${isAr ? 'تفاصيل الشحن واللوجستيات' : 'Shipping & Logistics'}</h3>
            <p style="margin: 8px 0;"><strong>${isAr ? 'الحالة' : 'Status'}:</strong> ${order.orderStatus || '—'}</p>
            <p style="margin: 8px 0;"><strong>${isAr ? 'المصدر' : 'Source'}:</strong> ${order.orderSourceName || '—'}</p>
            <p style="margin: 8px 0;"><strong>${isAr ? 'رقم التتبع' : 'Tracking'}:</strong> <span style="font-family: monospace;">${order.trackingNumber || '—'}</span></p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background: #1e293b; color: white;">
              <th style="padding: 12px; border: 1px solid #334155; text-align: ${isAr ? 'right' : 'left'};">${isAr ? 'وصف المنتج' : 'Item Description'}</th>
              <th style="padding: 12px; border: 1px solid #334155; text-align: center;">${isAr ? 'الكمية' : 'Qty'}</th>
              <th style="padding: 12px; border: 1px solid #334155; text-align: center;">${isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
              <th style="padding: 12px; border: 1px solid #334155; text-align: center;">${isAr ? 'الإجمالي' : 'Subtotal'}</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).length > 0 ? (order.items || []).map((item: any) => `
              <tr>
                <td style="padding: 12px; border: 1px solid #eee;">${item.productName || item.name || '—'}</td>
                <td style="padding: 12px; border: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
                <td style="padding: 12px; border: 1px solid #eee; text-align: center;">${(parseFloat(item.productPrice || item.price || 0)).toLocaleString()} SAR</td>
                <td style="padding: 12px; border: 1px solid #eee; text-align: center;">${((item.quantity || 1) * (parseFloat(item.productPrice || item.price || 0))).toLocaleString()} SAR</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="4" style="padding: 20px; text-align: center; color: #999;">${isAr ? 'لا توجد أصناف مسجلة' : 'No items registered'}</td>
              </tr>
            `}
          </tbody>
        </table>

        <div style="margin-right: auto; margin-left: ${isAr ? '0' : 'auto'}; width: 350px; background: #f8f8fa; padding: 20px; border-radius: 12px; border: 1px solid #eee;">
           <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
             <span style="font-weight: 700;">${isAr ? 'إجمالي المنتجات (SAR):' : 'Products Total (SAR):'}</span>
             <span>${(order.totalCostSAR || 0).toLocaleString()} SAR</span>
           </div>
           ${parseFloat(order.shippingCostSAR || 0) > 0 ? `
           <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
             <span>${isAr ? 'تكلفة الشحن الدولي (SAR):' : 'International Shipping (SAR):'}</span>
             <span>${parseFloat(order.shippingCostSAR || 0).toLocaleString()} SAR</span>
           </div>` : ''}
           <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px; font-weight: 800; font-size: 18px; color: #111;">
             <span>${isAr ? 'الإجمالي الكلي (YER):' : 'Grand Total (YER):'}</span>
             <span>${(parseFloat(order.amountPaid || 0) + parseFloat(order.amountRemaining || 0)).toLocaleString()} YER</span>
           </div>
           <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #059669; font-weight: 800;">
             <span>${isAr ? 'المبلغ المدفوع (YER):' : 'Amount Paid (YER):'}</span>
             <span>${parseFloat(order.amountPaid || 0).toLocaleString()} YER</span>
           </div>
           <div style="display: flex; justify-content: space-between; margin-top: 5px; color: #dc2626; font-weight: 800; font-size: 20px; border-top: 2px solid #dc2626; padding-top: 10px;">
             <span>${isAr ? 'المبلغ المتبقي (YER):' : 'Balance Due (YER):'}</span>
             <span>${parseFloat(order.amountRemaining || 0).toLocaleString()} YER</span>
           </div>
        </div>
        
        <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
          <p>${settings.invoiceNotes || (isAr ? 'شكراً لتعاملكم معنا! تم إنشاء هذه الفاتورة آلياً.' : 'Thank you for your business! Generated automatically.')}</p>
        </div>
      </div>
    `;

    printContent(isAr ? 'فاتورة طلب' : 'Order Invoice', invoiceHtml, isAr);
    activityLogService.log('export_orders_pdf', order.orderNumber || order.id, { singleOrder: true });
  };

  // Helper calculation values
  const computeCalculations = () => {
    // 1. Compute total products prices
    const productsSum = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.productPrice || 0)), 0);

    // Auto-calculate CBM for each item if dimensions are provided
    items.forEach(i => {
      if (formData.orderSourceType === 'Factory') {
        const length = parseFloat(i.length || 0);
        const width = parseFloat(i.width || 0);
        const height = parseFloat(i.height || 0);
        if (length > 0 && width > 0 && height > 0) {
          i.cbm = parseFloat(((length * width * height) / 1000000).toFixed(6));
        }
      }
    });

    const totalWeight = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.weight || 0)), 0);
    const totalCBM = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.cbm || 0)), 0);

    // Apply Bank Commission and Coupon to products cost
    const bankCommValue = bankCommissionEnabled 
      ? (bankCommissionType === 'percentage' 
          ? (productsSum * (parseFloat(bankCommissionRate as any) / 100)) 
          : (parseFloat(bankCommissionRate as any) || 0)) 
      : 0;
    const couponValue = couponEnabled ? couponRate : 0; // couponRate is now treated as a fixed amount in SAR
    const totalProductsCostWithAdjustments = productsSum - couponValue;

    let priceSAR = totalProductsCostWithAdjustments;
    let shippingCostSAR = 0;
    let profitCompanySAR = 0;
    let profitSaudiSAR = 0;
    let totalOrderSAR = 0;

    // Sum up shipping cost from shippings table
    // packagingFeeRate is now a fixed SAR amount (not a percentage)
    const shippingsCostSum = shippings.reduce((sum, s) => sum + parseFloat(s.shippingCost || 0) + parseFloat(s.packagingFees || 0), 0);
    const shippingPackagingFixed = packagingFeeEnabled ? (parseFloat(packagingFeeRate as any) || 0) : 0;
    const totalShippingsCost = shippingsCostSum + shippingPackagingFixed;

    if (formData.orderSourceType === 'SHEIN') {
      const redPrice = parseFloat(formData.sheinRedPrice as any) || 0;
      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0;
      priceSAR = redPrice;
      shippingCostSAR = 0;
      // Customer pays SHEIN Red Price + packaging fee (coupon is not deducted from what customer pays)
      totalOrderSAR = redPrice + generalPackagingFee;

      const rawProfitSAR = redPrice - (productsSum + bankCommValue + generalPackagingFee);
      const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId);
      const saudiRate = (saudiCourier && saudiCourier.commissionRate !== undefined) ? parseFloat(saudiCourier.commissionRate) : 0;
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      // Coupon amount is added entirely to the company profit
      profitCompanySAR = (rawProfitSAR - profitSaudiSAR) + couponValue;
    } else if (formData.orderSourceType === 'Factory') {
      const rawProfitSAR = totalWeight * (parseFloat(profitPerKgRate as any) || 0);

      // Use the shipping cost from the shippings table (which is filled automatically based on formula and is editable)
      shippingCostSAR = totalShippingsCost;

      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0;
      totalOrderSAR = productsSum + rawProfitSAR + shippingCostSAR + generalPackagingFee;

      const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId);
      const saudiRate = (saudiCourier && saudiCourier.commissionRate !== undefined) ? parseFloat(saudiCourier.commissionRate) : 0;
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      profitCompanySAR = (rawProfitSAR - profitSaudiSAR) + couponValue;
    } else {
      // Shopping (App)
      let rawProfitSAR = productsSum * ((parseFloat(formData.companyProfitRate as any) || 12) / 100);
      // Deduct bank commission from profit
      rawProfitSAR = rawProfitSAR - bankCommValue;

      shippingCostSAR = (addShippingEnabled || shippings.length > 0) ? totalShippingsCost : 0;
      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0;
      // Customer pays productsSum + raw profit BEFORE bank deduction (Wait, if customer pays original raw profit, then total is productsSum + originalRawProfit... But we just deducted it. Let's recalculate what the customer pays)
      // Actually, if Bank Commission is DEDUCTED from profit, it means the customer pays the original price.
      const originalRawProfitSAR = productsSum * ((parseFloat(formData.companyProfitRate as any) || 12) / 100);
      totalOrderSAR = productsSum + originalRawProfitSAR + shippingCostSAR + generalPackagingFee;

      const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId);
      const saudiRate = (saudiCourier && saudiCourier.commissionRate !== undefined) ? parseFloat(saudiCourier.commissionRate) : 30;
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      profitCompanySAR = (rawProfitSAR - profitSaudiSAR) + couponValue;
    }

    // Convert to YER for payment
    const exchange = formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER;
    const baseTotalOrderYER = totalOrderSAR * exchange;

    // Delivery courier fee (flat fee in YER)
    const deliveryCourierFee = parseFloat(formData.deliveryCourierFee as any) || 0;

    // The grand total YER includes everything.
    const totalOrderYER = baseTotalOrderYER + deliveryCourierFee;

    // Remaining in YER: Total in YER (which includes delivery fee) - Amount Paid
    const valPaid = parseFloat(formData.amountPaid as any) || 0;
    const remainingYER = totalOrderYER - valPaid;

    return {
      productsSum,
      totalProductsCostWithAdjustments,
      totalWeight,
      totalCBM,
      priceSAR,
      shippingCostSAR,
      bankCommissionSAR: bankCommValue,
      couponValue,
      totalOrderSAR,
      totalOrderYER,
      remainingYER,
      profitSaudiSAR,
      profitCompanySAR
    };
  };

  const calcs = computeCalculations();

  // Handle order creation
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.customerId) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'الرجاء اختيار العميل أولاً' : 'Please select a customer first',
        type: 'error',
        category: 'order'
      });
    }

    const currentCalcs = computeCalculations();
    const productsSumYER = currentCalcs.productsSum * (formData.currency === 'USD' ? (parseFloat(formData.exchangeRateUSD as any) || 535) : (parseFloat(formData.exchangeRateYER as any) || 140));
    const paidAmount = parseFloat(formData.amountPaid as any) || 0;

    // First requirement: Deleted the condition that cash paid amount cannot be less than original products cost. Any amount is allowed.

    if (formData.orderSourceType === 'SHEIN') {
      const redPrice = parseFloat(formData.sheinRedPrice as any) || 0;
      const productsSum = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.productPrice || 0)), 0);
      const couponValue = couponEnabled ? couponRate : 0;
      if (redPrice < (productsSum - couponValue)) {
        return notificationService.notify({
          title: isAr ? 'خطأ في التحقق' : 'Validation Error',
          message: isAr ? 'السعر الأحمر لـ SHEIN يجب ألا يقل عن إجمالي تكلفة المنتجات الأصلي بعد الخصم' : 'SHEIN Red Price cannot be less than the total products cost after discount',
          type: 'error',
          category: 'order'
        });
      }
    }

    setIsSubmitting(true);
    try {
      const orderNumber = await generateSmartOrderCode();
      const currentCalcs = computeCalculations();

      const payStatus = currentCalcs.remainingYER <= 0
        ? 'Paid'
        : parseFloat(formData.amountPaid as any) > 0
          ? 'Partial Paid'
          : 'Unpaid';

      const initialFiredTriggers = ['order_charge'];
      if (parseFloat(formData.amountPaid as any) > 0) {
        initialFiredTriggers.push('order_down_payment');
      }

      const payload = {
        orderNumber,
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerAddress: formData.customerAddress,
        orderSourceId: formData.orderSourceId,
        orderSourceName: formData.orderSourceName,
        orderSourceType: formData.orderSourceType,
        externalOrderNumber: formData.externalOrderNumber,
        trackingNumber: formData.trackingNumber || orderNumber,
        shippingCompany: formData.shippingCompany,
 
        // Couriers
        shippingCourierId: formData.shippingCourierId,
        deliveryCourierId: formData.deliveryCourierId,
        deliveryCourierFee: parseFloat(formData.deliveryCourierFee as any) || 0,
 
        // Financial definitions
        currency: formData.currency,
        exchangeRateYER: formData.exchangeRateYER,
        exchangeRateUSD: formData.exchangeRateUSD,
        bankCommissionRate: formData.bankCommissionRate,
        bankCommissionType,
        companyProfitRate: formData.companyProfitRate,
        packagingFee: parseFloat(formData.packagingFee as any) || 0,
        sheinRedPrice: parseFloat(formData.sheinRedPrice as any) || 0,
 
        // New fields
        cartShareCode,
        bankCommissionEnabled,
        couponEnabled,
        couponRate,
        couponValue: currentCalcs.couponValue,
        productsSum: currentCalcs.productsSum,
        packagingFeeEnabled,
        packagingFeeRate,
 
        // Calculated values
        totalWeight: currentCalcs.totalWeight,
        totalCBM: currentCalcs.totalCBM,
        totalCostSAR: currentCalcs.totalOrderSAR,
        totalCostYER: currentCalcs.totalOrderYER,
        amountPaid: parseFloat(formData.amountPaid as any) || 0,
        amountRemaining: currentCalcs.remainingYER,
        paymentStatus: payStatus,
 
        // Add details from source types
        profitPerKgRate: parseFloat(profitPerKgRate as any) || 19,
        cbmShippingRateValue: parseFloat(cbmShippingRateValue as any) || 1400,
        addShippingEnabled: addShippingEnabled,
        shippingCostSAR: currentCalcs.shippingCostSAR,
 
        // Profit distribution
        profitSaudiSAR: currentCalcs.profitSaudiSAR,
        profitCompanySAR: currentCalcs.profitCompanySAR,
 
        // Items nested list
        items,
 
        // Shipping details nested list
        shippingDetails: formData.orderSourceType === 'SHEIN' ? [] : (shippings || []),
 
        // Lifecycles status
        orderStatus: 'تم تسجيل الطلب',
        deliveryStatus: 'في الانتظار',
        locationYemen: 'مركز التوزيع الرئيسي',
        firedTriggers: initialFiredTriggers,

        createdByEmail: auth.currentUser?.email || 'admin',
        createdByName: profile?.fullName || 'Root Admin',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await addDoc(collection(db, 'orders'), payload);

      // Ensure system accounts exist
      let systemAccs: Record<string, string> = {};
      try {
        systemAccs = await financialAccountService.ensureSystemAccounts(settings.currency || 'SAR');
      } catch (err) {
        console.error('Could not ensure system accounts:', err);
      }

      // --- Financial Account Impact ---
      const customerRecord = customers.find(c => c.id === formData.customerId);
      const linkedAccountId = customerRecord?.financialAccountId;
      const linkedAccountCode = customerRecord?.financialAccountCode;

      if (linkedAccountId) {
        try {
          const accountExists = await financialAccountService.getAccountById(linkedAccountId);
          if (!accountExists) {
            console.error('[Orders] Financial account missing in DB, skipping transaction:', linkedAccountId);
            return;
          }

          const totalBilledOriginal = currentCalcs.totalOrderYER;
          const convertedOrderAmount = financialAccountService.convertToDefaultCurrency(
            totalBilledOriginal,
            'YER',
            settings.currency || 'YER',
            { USD: formData.exchangeRateUSD, SAR: formData.exchangeRateYER }
          );

          await financialAccountService.triggerAutomaticVoucher(
            'order_charge',
            { orderNumber },
            {
              customer: customerRecord,
              isAr,
              rawAmount: convertedOrderAmount,
              profileName: profile?.fullName || 'Root Admin'
            }
          );

          const paidVal = parseFloat(formData.amountPaid as any) || 0;
          if (paidVal > 0) {
            const convertedPaid = financialAccountService.convertToDefaultCurrency(
              paidVal,
              'YER',
              settings.currency || 'YER',
              { USD: formData.exchangeRateUSD, SAR: formData.exchangeRateYER }
            );

            await financialAccountService.triggerAutomaticVoucher(
              'order_down_payment',
              { orderNumber },
              {
                customer: customerRecord,
                isAr,
                rawAmount: convertedPaid,
                profileName: profile?.fullName || 'Root Admin'
              }
            );
          }
        } catch (txErr) {
          console.error('[Orders] Error registering financial account transactions:', txErr);
        }
      }

      // For App and Factory orders with shipping: sourcing cost = products cost + shipping cost - coupon discount
      const sourcingCostAmount = (formData.orderSourceType === 'App' || formData.orderSourceType === 'Factory')
        ? currentCalcs.totalProductsCostWithAdjustments + currentCalcs.shippingCostSAR
        : currentCalcs.totalProductsCostWithAdjustments;

      const sourcingCostConverted = financialAccountService.convertToDefaultCurrency(
        sourcingCostAmount,
        'SAR',
        settings.currency || 'YER',
        { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
      );

      if (formData.deductSourcingCostFromCourier && formData.shippingCourierId) {
        const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId);
        if (saudiCourier && saudiCourier.financialAccountId) {
          try {
            const isSourcing = saudiCourier.courierType === 'sourcing';
            const courierCurrency = saudiCourier.financialCurrency || 'YER';

            const amountInCourierCurrency = financialAccountService.convertToDefaultCurrency(
              sourcingCostAmount,
              'SAR',
              courierCurrency,
              { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
            );

            await financialAccountService.triggerAutomaticVoucher(
              'sourcing_cost_courier',
              { orderNumber },
              {
                courier: saudiCourier,
                isAr,
                rawAmount: amountInCourierCurrency,
                amountOriginal: sourcingCostAmount,
                currencyOriginal: 'SAR',
                profileName: profile?.fullName || 'Root Admin'
              }
            );

            // Automatically settle pending custodies
            await financialAccountService.settlePendingCustodies(
              saudiCourier.id,
              amountInCourierCurrency,
              courierCurrency
            );
          } catch (e) {
            console.error('Failed to deduct sourcing from courier', e);
          }
        }
      } else if (systemAccs['sys_sourcing_cost']) {
        // Debit Sourcing Costs Account (Instead of Courier)
        try {
          await financialAccountService.triggerAutomaticVoucher(
            'sourcing_cost_system',
            { orderNumber },
            {
              isAr,
              rawAmount: sourcingCostConverted,
              amountOriginal: sourcingCostAmount,
              currencyOriginal: 'SAR',
              profileName: profile?.fullName || 'Root Admin'
            }
          );
        } catch (e) {
          console.error('Failed to deduct sourcing from system account', e);
        }
      }

      // Record Packaging Fees Credit
      const shippingsCostSum = shippings.reduce((sum, s) => sum + parseFloat(s.shippingCost || 0) + parseFloat(s.packagingFees || 0), 0);
      // packagingFeeRate is now a fixed SAR amount (not percentage)
      const shippingPackagingFixed = packagingFeeEnabled ? (parseFloat(packagingFeeRate as any) || 0) : 0;
      const packagingFeeSAR = parseFloat(formData.packagingFee as any || 0);

      if (packagingFeeSAR > 0 && systemAccs['sys_packaging_fees']) {
        try {
          const pkgConverted = financialAccountService.convertToDefaultCurrency(
            packagingFeeSAR,
            'SAR',
            settings.currency || 'YER',
            { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
          );
          await financialAccountService.triggerAutomaticVoucher(
            'packaging_fee',
            { orderNumber },
            {
              isAr,
              rawAmount: pkgConverted,
              amountOriginal: packagingFeeSAR,
              currencyOriginal: 'SAR',
              profileName: profile?.fullName || 'Root Admin'
            }
          );
        } catch (e) {
          console.error('Failed to log packaging fee', e);
        }
      }

      // Record Shipping Cost Debit (for any order type with shipping cost)
      // Only apply if deduction on courier is not set, and shipping costs are not merged with product costs
      if (
        currentCalcs.shippingCostSAR > 0 && 
        systemAccs['sys_shipping_costs'] && 
        !formData.deductSourcingCostFromCourier &&
        formData.orderSourceType !== 'SHEIN' &&
        formData.orderSourceType !== 'App' &&
        formData.orderSourceType !== 'Factory'
      ) {
        try {
          const shipCostConverted = financialAccountService.convertToDefaultCurrency(
            currentCalcs.shippingCostSAR,
            'SAR',
            settings.currency || 'YER',
            { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
          );
          await financialAccountService.triggerAutomaticVoucher(
            'international_shipping',
            { orderNumber },
            {
              isAr,
              rawAmount: shipCostConverted,
              amountOriginal: currentCalcs.shippingCostSAR,
              currencyOriginal: 'SAR',
              profileName: profile?.fullName || 'Root Admin'
            }
          );
        } catch (e) {
          console.error('Failed to log shipping cost', e);
        }
      }

      // Record Company Profit and Saudi Partner Profit will be recorded upon designated logistics statuses (handled in Update Status).
      // Removed direct ledger creation for couriers and company profit from here to prevent duplicates.
      // Removed Yemen delivery driver wage creation here to prevent duplicates (handled on "تم التسليم").

      // Log the order creation to activity log
      activityLogService.log('add_order', payload.orderNumber || 'New Order', {
        customer: payload.customerName,
        total: payload.totalCostYER,
        status: payload.orderStatus
      });

      // Trigger automatic receipt alerts/notifications
      await notificationService.notify({
        title: isAr ? 'نجاح التسجيل الفاتورة' : 'Registered Successfully',
        message: isAr ? `تم تسجيل الفاتورة برقم موحد: ${orderNumber}` : `Saved order with code: ${orderNumber}`,
        type: 'success',
        category: 'order',
        orderId: orderNumber
      });

      // Automatically dispatch real WhatsApp message based on active templates and config
      try {
        await whatsappService.triggerNotification('onOrderCreated', payload);
      } catch (whatsappErr) {
        console.error('Failed to trigger real WhatsApp on order creation:', whatsappErr);
      }

      // Automatically dispatch simulated API dispatch status for WhatsApp + SMS in logs/panel
      const remainingVal = parseFloat(String(payload.amountRemaining || '0'));
      const totalCostYERVal = parseFloat(String(payload.amountPaid || '0')) + parseFloat(String(payload.amountRemaining || '0'));
      const smsMessage = isAr
        ? `عزيزنا العميل ${payload.customerName}، تم تأكيد طلبك رقم: (${orderNumber}) بنجاح. حالة الشحنة: (${payload.orderStatus}). تتبع مع: ${payload.shippingCompany}، تتبع رقم: ${payload.trackingNumber || 'قيد الرفع'}. القيمة الإجمالية: ${totalCostYERVal.toLocaleString()} YER، المتبقي: ${remainingVal.toLocaleString()} YER.`
        : `Dear ${payload.customerName}, your order ${orderNumber} has been confirmed. Status: ${payload.orderStatus}. Track with ${payload.shippingCompany}: ${payload.trackingNumber || 'Pending'}. Total: ${totalCostYERVal.toLocaleString()} YER, Remaining: ${remainingVal.toLocaleString()} YER.`;

      await notificationService.notify({
        title: isAr ? '📲 إرسال تلقائي (WhatsApp + SMS)' : '📲 Automatic WhatsApp / SMS Dispatcher',
        message: smsMessage,
        type: 'success',
        orderId: orderNumber,
        category: 'order'
      });

      setIsAddModalOpen(false);
      resetCreateForm();
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: 'Error',
        message: 'Could not create order document due to a write blocker.',
        type: 'error',
        category: 'order'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setFormData({
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderSourceId: '',
      orderSourceName: '',
      orderSourceType: 'App',
      externalOrderNumber: '',
      trackingNumber: '',
      shippingCompany: 'Aramex',
      shippingCourierId: '',
      deliveryCourierId: '',
      deliveryCourierFee: settings.defaultDeliveryFee ?? 4000,
      currency: settings.currency || 'SAR',
      exchangeRateYER: settings.exchangeRateSAR || 140,
      exchangeRateUSD: settings.exchangeRateUSD || 535,
      bankCommissionRate: settings.defaultBankCommissionRate ?? 3,
      companyProfitRate: settings.defaultCompanyProfitRate ?? 12,
      packagingFee: settings.defaultPackagingFee ?? 0,
      sheinRedPrice: 0,
      amountPaid: 0,
      paymentMethod: 'Cash',
      notes: '',
      deductSourcingCostFromCourier: false
    });
    setItems([{ productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, length: 0, width: 0, height: 0, trackingNumber: '' }]);
    setCustomerSearchQuery('');
    setSelectedCustomerProfile(null);
    setBankCommissionEnabled(false);
    setBankCommissionRate(3);
    setCouponEnabled(false);
    setCouponRate(0);
    setCartShareCode('');
    setPackagingFeeEnabled(false);
    setPackagingFeeRate(0);
    setShippings([
      {
        id: Math.random().toString(36).substr(2, 9),
        shippingType: 'بري',
        shippingCompany: 'Aramex',
        shippingSource: '',
        shippingDestination: '',
        shippingDate: '',
        shippingDuration: '',
        expectedArrival: '',
        deliveryDate: '',
        shippingCost: 0,
        packagingFees: 0
      }
    ]);
  };

  // Delete Order with Admin PIN Verification (Requirement 4: Security Settings)
  const handleDeleteOrderClick = (order: any) => {
    if (role !== 'Admin') {
      alert(isAr ? 'عذراً، حذف الطلبات مخصص للمدراء فقط' : 'Order deletion is restricted to Administrators.');
      return;
    }

    // Prevent deletion if status is beyond "تم تسجيل الطلب" / "Pending" or any payments exist
    const isSensitive = (order.orderStatus !== 'تم تسجيل الطلب' && order.orderStatus !== 'Pending' && order.orderStatus !== 'تم تسجيل الطلب (قيد المعالجة)') ||
      parseFloat(order.amountPaid || 0) > 0;

    if (isSensitive && settings.protectSensitiveOrderDelete) {
      setOrderToDelete(order);
      setDeletePin('');
      setDeleteError('');
      setIsDeleteModalOpen(true);
    } else {
      if (window.confirm(isAr
        ? `هل أنت متأكد من حذف الطلب رقم ${order.orderNumber || order.id}؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Are you sure you want to delete order ${order.orderNumber || order.id}? This action cannot be undone.`
      )) {
        executeDeleteOrder(order);
      }
    }
  };

  const executeDeleteOrder = async (order: any) => {
    try {
      await deleteDoc(doc(db, 'orders', order.id));

      activityLogService.log('delete_order', order.orderNumber || order.id, {
        customerName: order.customerName,
        totalCostYER: order.totalCostYER
      });

      notificationService.notify({
        title: isAr ? 'تم حذف الطلب' : 'Order Deleted',
        message: isAr
          ? `تم حذف الطلب رقم ${order.orderNumber || order.id} بنجاح`
          : `Order ${order.orderNumber || order.id} has been deleted`,
        type: 'warning',
        category: 'order'
      });

      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
    } catch (err: any) {
      alert(isAr ? 'فشل حذف الطلب: ' + err.message : 'Failed to delete order: ' + err.message);
    }
  };

  const handleVerifyDeletePin = () => {
    const systemPin = profile?.systemPin || '000000';
    if (deletePin.trim() === systemPin.trim()) {
      executeDeleteOrder(orderToDelete);
    } else {
      setDeleteError(isAr ? 'رمز الـ PIN غير صحيح' : 'Invalid security PIN');
    }
  };

  // Nested quick-add customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!customerFormData.fullName || !customerFormData.phone) return;

    setIsSubmitting(true);
    try {
      // Step 1: Create the customer document
      const docRef = await addDoc(collection(db, 'customers'), {
        fullName: customerFormData.fullName,
        phone: customerFormData.phone,
        email: customerFormData.email || '',
        gps_location: customerFormData.gps_location || '',
        address: customerFormData.address || '',
        notes: customerFormData.notes || '',
        createdAt: Date.now(),
        financialBalance: 0,
        financialCurrency: settings.currency || 'SAR'
      });

      // Step 2: Auto-create financial account (1130-xxxx)
      try {
        await financialAccountService.createAccountForEntity(
          'customer',
          docRef.id,
          customerFormData.fullName,
          settings.currency || 'SAR'
        );
      } catch (accErr) {
        console.warn('[Orders.tsx] Could not create financial account for quick-added customer:', accErr);
      }

      // Autofollow selected
      setFormData(prev => ({
        ...prev,
        customerId: docRef.id,
        customerName: customerFormData.fullName,
        customerPhone: customerFormData.phone,
        customerAddress: customerFormData.address || ''
      }));

      setIsAddCustomerOpen(false);
      setCustomerFormData({
        fullName: '',
        phone: '',
        email: '',
        gps_location: '',
        address: '',
        notes: ''
      });

      activityLogService.log('add_customer', customerFormData.fullName, { ...customerFormData });

      notificationService.notify({
        title: isAr ? 'تمت الإضافة' : 'Client Created',
        message: isAr
          ? `تمت إضافة الزبون ${customerFormData.fullName} وإنشاء ملفه المالي تلقائياً`
          : `Customer ${customerFormData.fullName} added with auto-generated financial account`,
        type: 'success',
        category: 'system'
      });
    } catch (err: any) {
      console.error(err);
      handleSupabaseError(err, OperationType.CREATE, 'customers');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Nested quick-add purchase source
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!sourceFormData.source_name) return;

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'sources'), {
        name: sourceFormData.source_name,
        source_name: sourceFormData.source_name,
        type: sourceFormData.type,
        source_url: sourceFormData.source_url,
        contact_info: sourceFormData.contact_info,
        location: sourceFormData.location,
        notes: sourceFormData.notes,
        createdAt: Date.now()
      });

      // Select newly created source
      setFormData(prev => ({
        ...prev,
        orderSourceId: docRef.id
      }));

      setIsAddSourceOpen(false);
      setSourceFormData({
        source_name: '',
        type: 'App',
        source_url: '',
        contact_info: '',
        location: '',
        notes: ''
      });

      notificationService.notify({
        title: isAr ? 'تمت إضافة مصدر الشراء' : 'Source Created',
        message: isAr ? 'تم تسجيل مصدر الشراء وتحديده تلقائياً' : 'Purchase source registered and selected',
        type: 'success',
        category: 'system'
      });
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'فشل إضافة مصدر الشراء' : 'Failed to register source',
        type: 'error',
        category: 'system'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Nested quick-add shipping company
  const handleAddShippingCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!shippingCompanyFormData.name) return;

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'shipping_companies'), {
        name: shippingCompanyFormData.name,
        contact_person: shippingCompanyFormData.contact_person,
        phone: shippingCompanyFormData.phone,
        tracking_url: shippingCompanyFormData.tracking_url,
        address: shippingCompanyFormData.address,
        notes: shippingCompanyFormData.notes,
        createdAt: Date.now()
      });

      // Select newly created shipping company
      if (activeAddShippingIndex !== null) {
        if (typeof activeAddShippingIndex === 'string' && activeAddShippingIndex.startsWith('edit-')) {
          const idx = parseInt(activeAddShippingIndex.split('-')[1]);
          updateUpdateShippingRow(idx, 'shippingCompany', shippingCompanyFormData.name);
        } else if (typeof activeAddShippingIndex === 'number') {
          updateShippingRow(activeAddShippingIndex, 'shippingCompany', shippingCompanyFormData.name);
        }
        setActiveAddShippingIndex(null);
      } else {
        setFormData(prev => ({
          ...prev,
          shippingCompany: shippingCompanyFormData.name
        }));
      }

      setIsAddShippingCompanyOpen(false);
      setShippingCompanyFormData({
        name: '',
        contact_person: '',
        phone: '',
        tracking_url: '',
        address: '',
        notes: ''
      });

      notificationService.notify({
        title: isAr ? 'تمت إضافة شركة الشحن' : 'Carrier Registered',
        message: isAr ? 'تم تسجيل شركة الشحن الجديدة بنجاح وتحديدها' : 'Carrier registered and selected',
        type: 'success',
        category: 'system'
      });
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'فشل إضافة شركة الشحن' : 'Failed to register carrier',
        type: 'error',
        category: 'system'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add payments to unpaid order
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedOrder) return;
    const paidVal = parseFloat(paymentFormData.amount) || 0;
    if (paidVal <= 0) return;

    setIsSubmitting(true);

    // MANDATORY FINANCIAL SECURITY PIN VERIFICATION (Section 12 of system documentation)
    const systemPin = profile?.systemPin || '000000';
    if (!paymentFormData.pin || paymentFormData.pin.trim() !== systemPin.trim()) {
      notificationService.notify({
        title: isAr ? 'خطأ في المصادقة والـ PIN السري' : 'Verification Denied',
        message: isAr ? 'رمز الـ PIN المالي للموظف غير صحيح! فشل ترحيل وقبض السند المالي.' : 'Employee security PIN is incorrect! Settle payment rejected.',
        type: 'error',
        category: 'system'
      });
      return;
    }

    const remaining = parseFloat(selectedOrder.amountRemaining || 0) - paidVal;
    const newPaid = parseFloat(selectedOrder.amountPaid || 0) + paidVal;

    let targetStatus = 'Partial Paid';
    if (remaining <= 0) {
      targetStatus = 'Paid';
    }

    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        amountPaid: newPaid,
        amountRemaining: Math.max(0, remaining),
        paymentStatus: targetStatus,
        updatedAt: Date.now()
      });

      // --- Financial Account Impact ---
      const customerRecord = customers.find(c => c.id === selectedOrder.customerId);
      const linkedAccountId = customerRecord?.financialAccountId;
      const linkedAccountCode = customerRecord?.financialAccountCode;

      if (linkedAccountId) {
        try {
          const convertedPaid = financialAccountService.convertToDefaultCurrency(
            paidVal,
            'YER',
            settings.currency || 'YER',
            { USD: selectedOrder.exchangeRateUSD || settings.exchangeRateUSD, SAR: selectedOrder.exchangeRateYER || settings.exchangeRateSAR }
          );

          const systemAccs = await financialAccountService.ensureSystemAccounts('YER');

          await financialAccountService.triggerAutomaticVoucher(
            'order_payment',
            { orderNumber: selectedOrder.orderNumber },
            {
              customer: customerRecord,
              isAr,
              rawAmount: convertedPaid,
              profileName: profile?.fullName || 'Root Admin'
            }
          );
        } catch (txErr) {
          console.error('[Orders] Error registering payment transaction on financial account:', txErr);
        }
      }

      activityLogService.log('add_payment', selectedOrder.orderNumber || selectedOrder.id, {
        amount: paidVal,
        method: paymentFormData.method,
        remaining: Math.max(0, remaining)
      });

      // Insert transaction history in notifications or payments
      notificationService.notify({
        title: isAr ? 'تم الدفع بنجاح' : 'Payment Recorded',
        message: isAr ? `تم تحصيل مبلغ ${paidVal.toLocaleString()} ريال ومزامنته للعميل` : `Added payment of ${paidVal}`,
        type: 'success',
        category: 'finance',
        orderId: selectedOrder.orderNumber || selectedOrder.id
      });

      // Dispatch real WhatsApp payment receipt notification
      try {
        const payloadObject = {
          ...selectedOrder,
          amountPaid: newPaid,
          amountRemaining: Math.max(0, remaining)
        };
        await whatsappService.triggerNotification('onPaymentReceived', payloadObject, {
          '{amountPaid}': paidVal.toLocaleString(),
          '{totalCostSaved}': newPaid.toLocaleString()
        });
      } catch (whatsappErr) {
        console.error('Failed to trigger real WhatsApp on payment post:', whatsappErr);
      }

      setIsPaymentModalOpen(false);
      setSelectedOrder(null);
      setPaymentFormData({ amount: '', method: 'Cash', notes: '', pin: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update logistics status
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedOrder) return;

    setIsSubmitting(true);
    try {
      const currentStatus = selectedOrder.orderStatus || 'تم تسجيل الطلب';
      const newStatus = updateFormData.orderStatus;
      const firedTriggers = selectedOrder.firedTriggers || [];
      const newFiredTriggers = [...firedTriggers];
      
      const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus);
      const newIndex = ORDER_STATUS_FLOW.indexOf(newStatus);
      
      const remainingVal = parseFloat(selectedOrder.amountRemaining || '0');
      const courierId = updateFormData.deliveryCourierId || selectedOrder.deliveryCourierId;
      const shippingCourierId = updateFormData.shippingCourierId || selectedOrder.shippingCourierId;
      
      let extraUpdateFields: any = {};

      // Helper to check if a trigger should fire
      const shouldFire = (triggerId: string, minStatus: string) => {
        if (firedTriggers.includes(triggerId)) return false;
        if (newStatus === 'ملغي') return false;
        
        const minIndex = ORDER_STATUS_FLOW.indexOf(minStatus);
        const newIndex = ORDER_STATUS_FLOW.indexOf(newStatus);
        // Fire if new status is at or beyond the required status
        return newIndex >= minIndex;
      };

      // Status change trigger - to prevent duplicate notifications
      const statusTriggerId = `status_notified_${newStatus}`;
      const isAlreadyNotified = firedTriggers.includes(statusTriggerId);

      // Pending Portal Order Approval Trigger (order_charge & order_down_payment)
      if ((currentStatus === 'معلق' || selectedOrder.status === 'pending') && newStatus !== 'معلق' && newStatus !== 'ملغي') {
        const customerRecord = customers.find(c => c.id === selectedOrder.customerId);
        if (customerRecord && customerRecord.financialAccountId) {
          try {
            if (!firedTriggers.includes('order_charge')) {
              const totalBilledOriginal = parseFloat(selectedOrder.totalCostYER || selectedOrder.totalOrderYER || '0');
              const convertedOrderAmount = financialAccountService.convertToDefaultCurrency(
                totalBilledOriginal,
                'YER',
                settings.currency || 'YER',
                { USD: selectedOrder.exchangeRateUSD || 535, SAR: selectedOrder.exchangeRateYER || 390 }
              );

              await financialAccountService.triggerAutomaticVoucher(
                'order_charge',
                { orderNumber: selectedOrder.orderNumber },
                {
                  customer: customerRecord,
                  isAr,
                  rawAmount: convertedOrderAmount,
                  profileName: profile?.fullName || 'Admin Approval'
                }
              );
              newFiredTriggers.push('order_charge');
            }

            const paidVal = parseFloat(selectedOrder.amountPaid || '0');
            if (paidVal > 0 && !firedTriggers.includes('order_down_payment')) {
              const convertedPaid = financialAccountService.convertToDefaultCurrency(
                paidVal,
                'YER',
                settings.currency || 'YER',
                { USD: selectedOrder.exchangeRateUSD || 535, SAR: selectedOrder.exchangeRateYER || 390 }
              );

              await financialAccountService.triggerAutomaticVoucher(
                'order_down_payment',
                { orderNumber: selectedOrder.orderNumber },
                {
                  customer: customerRecord,
                  isAr,
                  rawAmount: convertedPaid,
                  profileName: profile?.fullName || 'Admin Approval'
                }
              );
              newFiredTriggers.push('order_down_payment');
            }
          } catch (txErr) {
            console.error('[Orders] Error posting financial transactions on portal order approval:', txErr);
          }
        }
        extraUpdateFields.status = 'accepted';
      }

      if (isAlreadyNotified && newStatus !== 'ملغي' && newStatus !== currentStatus) {
        toast.error(isAr 
          ? `تنبيه: تم إرسال إشعار بهذه الحالة (${newStatus}) للعميل مسبقاً. لن يتم تكرار الإرسال.` 
          : `Warning: A notification for this status (${newStatus}) has already been sent. WhatsApp will not be resent.`
        );
      }

      // 1. courier_commission trigger
      if (shouldFire('courier_commission', 'وصل مركز التوزيع في اليمن') && shippingCourierId) {
        const courierRecord = couriers.find(c => c.id === shippingCourierId);
        if (courierRecord) {
          const isSourcing = courierRecord.courierType === 'sourcing';
          const exchangeRate = parseFloat(selectedOrder.exchangeRateYER || settings.exchangeRateYER || 390);
          const commissionProfitOriginal = parseFloat(selectedOrder.profitSaudiSAR || '0');
          const commissionProfit = isSourcing ? commissionProfitOriginal : (commissionProfitOriginal * exchangeRate);
          const finalCurrency = isSourcing ? 'SAR' : 'YER';

          if (commissionProfit > 0) {
            const YY = String(new Date().getFullYear()).slice(-2);
            const MM = String(new Date().getMonth() + 1).padStart(2, '0');
            const commissionNumber = `COM-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;
            const courierName = courierRecord.fullName;
            const linkedAccountId = courierRecord.financialAccountId || null;
            const linkedAccountCode = courierRecord.financialAccountCode || null;

            const convertedCommission = financialAccountService.convertToDefaultCurrency(
              commissionProfit,
              finalCurrency,
              settings.currency || 'YER',
              { USD: selectedOrder.exchangeRateUSD || settings.exchangeRateUSD, SAR: selectedOrder.exchangeRateYER || settings.exchangeRateSAR }
            );

            const commissionRule = autoVoucherRules.find(r => r.id === 'courier_commission');
            if (!commissionRule || commissionRule.isActive !== false) {
              const commissionPayload = {
                expenseNumber: commissionNumber,
                category: 'wage',
                type: 'Wage',
                amount: commissionProfit,
                currency: finalCurrency,
                amountInDefaultCurrency: convertedCommission,
                recipientId: shippingCourierId,
                recipientEntityId: shippingCourierId,
                recipientEntityType: 'courier',
                recipientName: courierName,
                linkedAccountId,
                linkedAccountCode,
                notes: isAr
                  ? `عمولة شحن تلقائية (${courierRecord.commissionRate}%) للطلب رقم: ${selectedOrder.orderNumber}`
                  : `Auto-commission (${courierRecord.commissionRate}%) for order: ${selectedOrder.orderNumber}`,
                status: 'Approved',
                createdByUid: auth.currentUser?.uid || 'system',
                createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
                createdByName: profile?.fullName || 'System Auto-Commission',
                createdAt: Date.now()
              };
              await addDoc(collection(db, 'expenses'), commissionPayload);
            }

            if (linkedAccountId) {
              try {
                await financialAccountService.triggerAutomaticVoucher('courier_commission', selectedOrder, {
                  courier: courierRecord,
                  isAr,
                  rawAmount: convertedCommission,
                  amountOriginal: commissionProfit,
                  currencyOriginal: finalCurrency,
                  expenseNumber: commissionNumber,
                  profileName: profile?.fullName || 'System Auto-Commission'
                });
              } catch (txErr) {
                console.warn('[Orders] Could not record commission wage:', txErr);
              }
            }
            newFiredTriggers.push('courier_commission');
          }
        }
      }

      // 2. custody_payment trigger
      if (shouldFire('custody_payment', 'مع المندوب للتوصيل') && remainingVal > 0 && courierId) {
        const YY = String(new Date().getFullYear()).slice(-2);
        const MM = String(new Date().getMonth() + 1).padStart(2, '0');
        const expenseNumber = `EXP-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;

        const courierRecord = couriers.find(c => c.id === courierId);
        const courierName = courierRecord ? courierRecord.fullName : (isAr ? 'مندوب توصيل' : 'Delivery Courier');
        const linkedAccountId = courierRecord?.financialAccountId || null;
        const linkedAccountCode = courierRecord?.financialAccountCode || null;

        const convertedRemainingVal = financialAccountService.convertToDefaultCurrency(
          remainingVal,
          'YER',
          settings.currency || 'YER',
          { USD: selectedOrder.exchangeRateUSD || settings.exchangeRateUSD, SAR: selectedOrder.exchangeRateYER || settings.exchangeRateSAR }
        );

        const custodyRule = autoVoucherRules.find(r => r.id === 'custody_payment');
        if (!custodyRule || custodyRule.isActive !== false) {
          const custodyPayload = {
            expenseNumber,
            category: 'custody',
            type: 'Custody',
            amount: remainingVal,
            currency: 'YER',
            amountInDefaultCurrency: convertedRemainingVal,
            recipientId: courierId,
            recipientEntityId: courierId,
            recipientEntityType: 'courier',
            recipientName: courierName,
            linkedAccountId,
            linkedAccountCode,
            notes: isAr
              ? `عهدة تلقائية مرحلة من تسليم الطلب رقم: ${selectedOrder.orderNumber}`
              : `Auto-custody generated from delivery of order: ${selectedOrder.orderNumber}`,
            status: 'Pending',
            createdByUid: auth.currentUser?.uid || 'system',
            createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
            createdByName: profile?.fullName || 'System Auto-Custody',
            createdAt: Date.now()
          };
          await addDoc(collection(db, 'expenses'), custodyPayload);
        }

        const customerRecord = customers.find(c => c.id === selectedOrder.customerId);
        if (linkedAccountId && customerRecord?.financialAccountId) {
          try {
            await financialAccountService.triggerAutomaticVoucher('custody_payment', selectedOrder, {
              courier: { financialAccountId: linkedAccountId, financialAccountCode: linkedAccountCode },
              customer: customerRecord,
              isAr,
              rawAmount: convertedRemainingVal,
              amountOriginal: remainingVal,
              currencyOriginal: 'YER',
              expenseNumber,
              profileName: profile?.fullName || 'System Auto-Custody'
            });
          } catch (txErr) {
            console.warn('[Orders] Could not record auto-custody/payment:', txErr);
          }
        }

        extraUpdateFields = {
          ...extraUpdateFields,
          amountPaid: parseFloat(selectedOrder.amountPaid || '0') + remainingVal,
          amountRemaining: 0,
          paymentStatus: 'Paid'
        };
        newFiredTriggers.push('custody_payment');
      }

      // 3. delivery_wage trigger
      const deliveryFee = parseFloat(selectedOrder.deliveryCourierFee || updateFormData.deliveryCourierFee || '0');
      if (shouldFire('delivery_wage', 'تم التسليم') && courierId && deliveryFee > 0) {
        const YY = String(new Date().getFullYear()).slice(-2);
        const MM = String(new Date().getMonth() + 1).padStart(2, '0');
        const wageNumber = `WGE-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;

        const courierRecord = couriers.find(c => c.id === courierId);
        const courierName = courierRecord ? courierRecord.fullName : (isAr ? 'مندوب توصيل' : 'Delivery Courier');
        const linkedAccountId = courierRecord?.financialAccountId || null;
        const linkedAccountCode = courierRecord?.financialAccountCode || null;

        const convertedFee = financialAccountService.convertToDefaultCurrency(
          deliveryFee,
          'YER',
          settings.currency || 'YER',
          { USD: selectedOrder.exchangeRateUSD || settings.exchangeRateUSD, SAR: selectedOrder.exchangeRateYER || settings.exchangeRateSAR }
        );

        const wageRule = autoVoucherRules.find(r => r.id === 'delivery_wage');
        if (!wageRule || wageRule.isActive !== false) {
          const wagePayload = {
            expenseNumber: wageNumber,
            category: 'wage',
            type: 'Wage',
            amount: deliveryFee,
            currency: 'YER',
            amountInDefaultCurrency: convertedFee,
            recipientId: courierId,
            recipientEntityId: courierId,
            recipientEntityType: 'courier',
            recipientName: courierName,
            linkedAccountId,
            linkedAccountCode,
            notes: isAr
              ? `أجور توصيل تلقائية لتسليم الطلب رقم: ${selectedOrder.orderNumber}`
              : `Auto-wage for delivery of order: ${selectedOrder.orderNumber}`,
            status: 'Approved',
            createdByUid: auth.currentUser?.uid || 'system',
            createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
            createdByName: profile?.fullName || 'System Auto-Wage',
            createdAt: Date.now()
          };
          await addDoc(collection(db, 'expenses'), wagePayload);
        }

        if (linkedAccountId) {
          try {
            await financialAccountService.triggerAutomaticVoucher('delivery_wage', selectedOrder, {
              courier: { financialAccountId: linkedAccountId, financialAccountCode: linkedAccountCode },
              isAr,
              rawAmount: convertedFee,
              amountOriginal: deliveryFee,
              currencyOriginal: 'YER',
              expenseNumber: wageNumber,
              profileName: profile?.fullName || 'System Auto-Wage'
            });
          } catch (txErr) {
            console.warn('[Orders] Could not record delivery wage:', txErr);
          }
        }
        newFiredTriggers.push('delivery_wage');
      }

      // 4. company_profit trigger
      if (shouldFire('company_profit', 'تم التسليم') && parseFloat(selectedOrder.profitCompanySAR || '0') > 0) {
        try {
          const profitValSAR = parseFloat(selectedOrder.profitCompanySAR || '0');
          const profitConverted = financialAccountService.convertToDefaultCurrency(
            profitValSAR,
            'SAR',
            settings.currency || 'YER',
            { USD: selectedOrder.exchangeRateUSD || settings.exchangeRateUSD || 535, SAR: selectedOrder.exchangeRateYER || settings.exchangeRateSAR || 140 }
          );

          await financialAccountService.triggerAutomaticVoucher('company_profit', selectedOrder, {
            isAr,
            rawAmount: profitConverted,
            amountOriginal: profitValSAR,
            currencyOriginal: 'SAR',
            profileName: profile?.fullName || 'System Auto-Profit'
          });
          newFiredTriggers.push('company_profit');
        } catch (e) {
          console.warn('[Orders] Could not record company profit:', e);
        }
      }

      if (!isAlreadyNotified && newStatus !== 'ملغي') {
        newFiredTriggers.push(statusTriggerId);
      }

      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        orderStatus: updateFormData.orderStatus,
        deliveryStatus: updateFormData.deliveryStatus,
        locationYemen: updateFormData.locationYemen,
        internalNotes: updateFormData.internalNotes,
        shippingCourierId: updateFormData.shippingCourierId || '',
        deliveryCourierId: updateFormData.deliveryCourierId || '',
        shippingDetails: updateShippings || [],
        firedTriggers: newFiredTriggers,
        updatedAt: Date.now(),
        ...extraUpdateFields
      });

      activityLogService.log('edit_order', selectedOrder.orderNumber || selectedOrder.id, {
        previousStatus: selectedOrder.orderStatus,
        newStatus: updateFormData.orderStatus,
        deliveryStatus: updateFormData.deliveryStatus,
        locationYemen: updateFormData.locationYemen
      });

      if (!isAlreadyNotified && newStatus !== 'ملغي') {
        await notificationService.notify({
          title: isAr ? 'حالة التحديث' : 'Status Updated',
          message: isAr ? 'تم تحديث البيانات اللوجيستية للشحنة وترحيلها' : 'Logistic parameters recorded',
          type: 'info',
          category: 'order',
          orderId: selectedOrder.orderNumber || selectedOrder.id
        });

        // Automatically dispatch real WhatsApp status update message
        try {
          const payloadObject = {
            ...selectedOrder,
            orderStatus: updateFormData.orderStatus,
            locationYemen: updateFormData.locationYemen
          };
          await whatsappService.triggerNotification('onOrderStatusChanged', payloadObject);
        } catch (whatsappErr) {
          console.error('Failed to trigger real WhatsApp status update:', whatsappErr);
        }

        // Automatically dispatch simulated status update notification via WhatsApp + SMS
        const smsMessage = isAr
          ? `عزيزنا العميل ${selectedOrder.customerName}، تم تحديث حالة شحنتك رقم: (${selectedOrder.orderNumber || selectedOrder.id}) إلى: *${updateFormData.orderStatus}*. وموقع الشحنة حالياً: *${updateFormData.locationYemen || 'قيد النقل'}*. المتبقي عليك: ${remainingVal.toLocaleString()} YER. شكراً لتعاملك معنا.`
          : `Dear ${selectedOrder.customerName}, the status of your order (${selectedOrder.orderNumber || selectedOrder.id}) update to: *${updateFormData.orderStatus}*. Current position: *${updateFormData.locationYemen || 'In-transit'}*. Bal: ${remainingVal.toLocaleString()} YER. Thank you for choosing us!`;

        await notificationService.notify({
          title: isAr ? '📲 تحديث تلقائي (WhatsApp + SMS)' : '📲 Auto Status WhatsApp / SMS Sent',
          message: smsMessage,
          type: 'success',
          orderId: selectedOrder.orderNumber || selectedOrder.id,
          category: 'order'
        });
      } else if (newStatus !== 'ملغي') {
        // Just a simple local notification for the admin that it was updated but no messages sent
        await notificationService.notify({
          title: isAr ? 'تحديث صامت' : 'Silent Update',
          message: isAr ? 'تم تحديث البيانات (بدون إرسال إشعارات للعميل لتكرار الحالة)' : 'Data updated (no customer notifications sent for repeated status)',
          type: 'info',
          category: 'system'
        });
      }

      setIsUpdateModalOpen(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Items handling
  const addItemRow = () => {
    setItems([...items, { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, length: 0, width: 0, height: 0, trackingNumber: '' }]);
  };

  const updateItemRow = (idx: number, field: string, val: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const removeItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  // Shipping details handling
  const addShippingRow = () => {
    const today = new Date().toISOString().split('T')[0];
    const defaultDuration =
      formData.orderSourceType === 'SHEIN' ? (settings.defaultSheinDuration ?? 12) :
        formData.orderSourceType === 'Factory' ? (settings.defaultFactoryDuration ?? 20) :
          (settings.defaultAppDuration ?? 10);
    const arrivalDate = new Date();
    arrivalDate.setDate(arrivalDate.getDate() + defaultDuration);
    const expectedArrival = arrivalDate.toISOString().split('T')[0];
    setShippings([...shippings, {
      id: Math.random().toString(36).substr(2, 9),
      shippingType: 'بري',
      shippingCompany: 'Aramex',
      shippingSource: '',
      shippingDestination: '',
      shippingDate: today,
      shippingDuration: String(defaultDuration),
      expectedArrival,
      shippingCost: 0,
      packagingFees: 0
      // Note: deliveryDate is NOT stored per-row; it's shown in the order details view as a computed field
    }]);
    if (formData.orderSourceType === 'App') {
      setAddShippingEnabled(true);
    }
  };


  const updateShippingRow = (idx: number, fieldOrObj: string | Record<string, any>, val?: any) => {
    setShippings(prev => {
      const updated = [...prev];
      if (typeof fieldOrObj === 'string') {
        updated[idx] = { ...updated[idx], [fieldOrObj]: val };
        if (fieldOrObj === 'shippingCost') {
          updated[idx]._isCalculated = false;
        }
      } else {
        updated[idx] = { ...updated[idx], ...fieldOrObj };
        if ('shippingCost' in fieldOrObj) {
          updated[idx]._isCalculated = false;
        }
      }
      return updated;
    });
  };

  // Update shipping durations when orderSourceType changes
  useEffect(() => {
    if (isAddModalOpen) {
      const defaultDuration =
        formData.orderSourceType === 'SHEIN' ? (settings.defaultSheinDuration ?? 12) :
          formData.orderSourceType === 'Factory' ? (settings.defaultFactoryDuration ?? 20) :
            formData.orderSourceType === 'App' ? (settings.defaultAppDuration ?? 10) :
              (settings.defaultShippingDuration ?? 15);

      setShippings(prev => {
        return prev.map(sh => {
          // If the shipping duration is empty or matches one of the defaults, we update it
          const isDurationDefault =
            !sh.shippingDuration ||
            sh.shippingDuration === String(settings.defaultSheinDuration ?? 12) ||
            sh.shippingDuration === String(settings.defaultFactoryDuration ?? 20) ||
            sh.shippingDuration === String(settings.defaultAppDuration ?? 10) ||
            sh.shippingDuration === String(settings.defaultShippingDuration ?? 15);

          if (isDurationDefault) {
            const newDuration = String(defaultDuration);
            let expected = sh.expectedArrival || '';
            if (sh.shippingDate) {
              const dateObj = new Date(sh.shippingDate);
              dateObj.setDate(dateObj.getDate() + defaultDuration);
              expected = dateObj.toISOString().split('T')[0];
            }
            return {
              ...sh,
              shippingDuration: newDuration,
              expectedArrival: expected
            };
          }
          return sh;
        });
      });
    }
  }, [formData.orderSourceType, settings, isAddModalOpen]);


  // Auto-calculate shipping cost for Factory and sync with primary shipping row
  useEffect(() => {
    if (formData.orderSourceType === 'Factory') {
      const totalCBM = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.cbm || 0)), 0);
      const cbmShippingRateUSD = parseFloat(cbmShippingRateValue as any) || 0;
      const cbmShippingUSD = totalCBM * cbmShippingRateUSD;
      const exUSD = parseFloat(formData.exchangeRateUSD as any) || 535;
      const exYER = parseFloat(formData.exchangeRateYER as any) || 140;
      const calculatedShippingCostSAR = Math.round((cbmShippingUSD * exUSD) / exYER) || 0;

      setShippings(prev => {
        if (!prev || prev.length === 0) return prev;
        const firstRow = prev[0];
        const isUnmodified = firstRow._isCalculated !== false;
        if (isUnmodified && firstRow.shippingCost !== calculatedShippingCostSAR) {
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            shippingCost: calculatedShippingCostSAR,
            _isCalculated: true
          };
          return updated;
        }
        return prev;
      });
    }
  }, [formData.orderSourceType, items, cbmShippingRateValue, formData.exchangeRateUSD, formData.exchangeRateYER]);

  const removeShippingRow = (idx: number) => {
    if (shippings.length === 1) {
      setShippings([]);
      if (formData.orderSourceType === 'App') {
        setAddShippingEnabled(false);
      }
      return;
    }
    setShippings(shippings.filter((_, i) => i !== idx));
  };

  const addUpdateShippingRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setUpdateShippings([...updateShippings, {
      id: Math.random().toString(36).substr(2, 9),
      shippingType: 'بري',
      shippingCompany: 'Aramex',
      shippingSource: '',
      shippingDestination: '',
      shippingDate: today,
      shippingDuration: '',
      expectedArrival: '',
      shippingCost: 0,
      packagingFees: 0
    }]);
  };

  const updateUpdateShippingRow = (idx: number, fieldOrObj: string | Record<string, any>, val?: any) => {
    setUpdateShippings(prev => {
      const updated = [...prev];
      if (typeof fieldOrObj === 'string') {
        updated[idx] = { ...updated[idx], [fieldOrObj]: val };
      } else {
        updated[idx] = { ...updated[idx], ...fieldOrObj };
      }
      return updated;
    });
  };

  const removeUpdateShippingRow = (idx: number) => {
    setUpdateShippings(updateShippings.filter((_, i) => i !== idx));
  };




  // QR code rendering effect
  useEffect(() => {
    if (isDetailsModalOpen && selectedOrder && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        selectedOrder.trackingNumber || selectedOrder.orderNumber || '',
        {
          width: 140,
          margin: 1.5,
          color: {
            dark: '#030712',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR code generation error:', error);
        }
      );
    }
  }, [isDetailsModalOpen, selectedOrder]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    notificationService.notify({
      title: isAr ? 'تم النسخ' : 'Copied',
      message: isAr ? 'تم نسخ رمز التتبع بنجاح للحافظة' : 'Tracking number copied to clipboard',
      type: 'success',
      category: 'system'
    });
  };

  // Multi-select features
  const handleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrdersList.length && filteredOrdersList.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrdersList.map(o => o.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchUpdateStatus = async (newStatus: string) => {
    if (selectedOrderIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const promises = selectedOrderIds.map(async (orderId) => {
        const defaultLocation = newStatus === 'وصل مستودع السعودية' ? 'مستودع السعودية للتعبئة' :
          newStatus === 'وصل مركز التوزيع في اليمن' ? 'مستودع صنعاء الرئيسي' : 'قيد النقل';

        const ord = orders.find(o => o.id === orderId);
        if (!ord) return;

        const firedTriggers = ord.firedTriggers || [];
        const newFiredTriggers = [...firedTriggers];
        
        const currentIndex = ORDER_STATUS_FLOW.indexOf(ord.orderStatus || 'تم تسجيل الطلب');
        const newIndex = ORDER_STATUS_FLOW.indexOf(newStatus);
        
        const remainingVal = parseFloat(ord.amountRemaining || '0');
        const courierId = ord.deliveryCourierId;
        const shippingCourierId = ord.shippingCourierId;

        let extraUpdateFields: any = {};

        const shouldFire = (triggerId: string, minStatus: string) => {
          if (firedTriggers.includes(triggerId)) return false;
          if (newStatus === 'ملغي') return false;
          const minIndex = ORDER_STATUS_FLOW.indexOf(minStatus);
          return newIndex >= minIndex;
        };

        // 1. courier_commission trigger
        if (shouldFire('courier_commission', 'وصل مركز التوزيع في اليمن') && shippingCourierId) {
          const courierRecord = couriers.find(c => c.id === shippingCourierId);
          if (courierRecord) {
            const isSourcing = courierRecord.courierType === 'sourcing';
            const exchangeRate = parseFloat(ord.exchangeRateYER || settings.exchangeRateYER || 390);
            const commissionProfitOriginal = parseFloat(ord.profitSaudiSAR || '0');
            const commissionProfit = isSourcing ? commissionProfitOriginal : (commissionProfitOriginal * exchangeRate);
            const finalCurrency = isSourcing ? 'SAR' : 'YER';

            if (commissionProfit > 0) {
              const YY = String(new Date().getFullYear()).slice(-2);
              const MM = String(new Date().getMonth() + 1).padStart(2, '0');
              const commissionNumber = `COM-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;
              const courierName = courierRecord.fullName;
              const linkedAccountId = courierRecord.financialAccountId || null;
              const linkedAccountCode = courierRecord.financialAccountCode || null;

              const convertedCommission = financialAccountService.convertToDefaultCurrency(
                commissionProfit,
                finalCurrency,
                settings.currency || 'YER',
                { USD: ord.exchangeRateUSD || settings.exchangeRateUSD, SAR: ord.exchangeRateYER || settings.exchangeRateSAR }
              );

              const commissionRule = autoVoucherRules.find(r => r.id === 'courier_commission');
              if (!commissionRule || commissionRule.isActive !== false) {
                const commissionPayload = {
                  expenseNumber: commissionNumber,
                  category: 'wage',
                  type: 'Wage',
                  amount: commissionProfit,
                  currency: finalCurrency,
                  amountInDefaultCurrency: convertedCommission,
                  recipientId: shippingCourierId,
                  recipientEntityId: shippingCourierId,
                  recipientEntityType: 'courier',
                  recipientName: courierName,
                  linkedAccountId,
                  linkedAccountCode,
                  notes: isAr
                    ? `عمولة شحن تلقائية (${courierRecord.commissionRate}%) للطلب رقم: ${ord.orderNumber}`
                    : `Auto-commission (${courierRecord.commissionRate}%) for order: ${ord.orderNumber}`,
                  status: 'Approved',
                  createdByUid: auth.currentUser?.uid || 'system',
                  createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
                  createdByName: profile?.fullName || 'System Auto-Commission',
                  createdAt: Date.now()
                };
                await addDoc(collection(db, 'expenses'), commissionPayload);
              }

              if (linkedAccountId) {
                try {
                  await financialAccountService.triggerAutomaticVoucher('courier_commission', ord, {
                    courier: courierRecord,
                    isAr,
                    rawAmount: convertedCommission,
                    expenseNumber: commissionNumber,
                    profileName: profile?.fullName || 'System Auto-Commission'
                  });
                } catch (txErr) {
                  console.warn('[Orders] Could not record commission wage in batch:', txErr);
                }
              }
              newFiredTriggers.push('courier_commission');
            }
          }
        }

        // 2. custody_payment trigger
        if (shouldFire('custody_payment', 'مع المندوب للتوصيل') && remainingVal > 0 && courierId) {
          const YY = String(new Date().getFullYear()).slice(-2);
          const MM = String(new Date().getMonth() + 1).padStart(2, '0');
          const expenseNumber = `EXP-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;

          const courierRecord = couriers.find(c => c.id === courierId);
          const courierName = courierRecord ? courierRecord.fullName : (isAr ? 'مندوب توصيل' : 'Delivery Courier');
          const linkedAccountId = courierRecord?.financialAccountId || null;
          const linkedAccountCode = courierRecord?.financialAccountCode || null;

          const convertedRemainingVal = financialAccountService.convertToDefaultCurrency(
            remainingVal,
            'YER',
            settings.currency || 'YER',
            { USD: ord.exchangeRateUSD || settings.exchangeRateUSD, SAR: ord.exchangeRateYER || settings.exchangeRateSAR }
          );

          const custodyRule = autoVoucherRules.find(r => r.id === 'custody_payment');
          if (!custodyRule || custodyRule.isActive !== false) {
            const custodyPayload = {
              expenseNumber,
              category: 'custody',
              type: 'Custody',
              amount: remainingVal,
              currency: 'YER',
              amountInDefaultCurrency: convertedRemainingVal,
              recipientId: courierId,
              recipientEntityId: courierId,
              recipientEntityType: 'courier',
              recipientName: courierName,
              linkedAccountId,
              linkedAccountCode,
              notes: isAr
                ? `عهدة تلقائية مرحلة من تسليم الطلب رقم: ${ord.orderNumber}`
                : `Auto-custody generated from delivery of order: ${ord.orderNumber}`,
              status: 'Pending',
              createdByUid: auth.currentUser?.uid || 'system',
              createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
              createdByName: profile?.fullName || 'System Auto-Custody',
              createdAt: Date.now()
            };
            await addDoc(collection(db, 'expenses'), custodyPayload);
          }

          const customerRecord = customers.find(c => c.id === ord.customerId);
          if (linkedAccountId && customerRecord?.financialAccountId) {
            try {
              await financialAccountService.triggerAutomaticVoucher('custody_payment', ord, {
                courier: { financialAccountId: linkedAccountId, financialAccountCode: linkedAccountCode },
                customer: customerRecord,
                isAr,
                rawAmount: convertedRemainingVal,
                expenseNumber,
                profileName: profile?.fullName || 'System Auto-Custody'
              });
            } catch (txErr) {
              console.warn('[Orders] Could not record auto-custody/payment in batch:', txErr);
            }
          }

          extraUpdateFields = {
            ...extraUpdateFields,
            amountPaid: parseFloat(ord.amountPaid || '0') + remainingVal,
            amountRemaining: 0,
            paymentStatus: 'Paid'
          };
          newFiredTriggers.push('custody_payment');
        }

        // 3. delivery_wage trigger
        const deliveryFee = parseFloat(ord.deliveryCourierFee || '0');
        if (shouldFire('delivery_wage', 'تم التسليم') && courierId && deliveryFee > 0) {
          const YY = String(new Date().getFullYear()).slice(-2);
          const MM = String(new Date().getMonth() + 1).padStart(2, '0');
          const wageNumber = `WGE-${YY}${MM}-${Math.floor(1000 + Math.random() * 9000)}`;

          const courierRecord = couriers.find(c => c.id === courierId);
          const courierName = courierRecord ? courierRecord.fullName : (isAr ? 'مندوب توصيل' : 'Delivery Courier');
          const linkedAccountId = courierRecord?.financialAccountId || null;
          const linkedAccountCode = courierRecord?.financialAccountCode || null;

          const convertedFee = financialAccountService.convertToDefaultCurrency(
            deliveryFee,
            'YER',
            settings.currency || 'YER',
            { USD: ord.exchangeRateUSD || settings.exchangeRateUSD, SAR: ord.exchangeRateYER || settings.exchangeRateSAR }
          );

          const wageRule = autoVoucherRules.find(r => r.id === 'delivery_wage');
          if (!wageRule || wageRule.isActive !== false) {
            const wagePayload = {
              expenseNumber: wageNumber,
              category: 'wage',
              type: 'Wage',
              amount: deliveryFee,
              currency: 'YER',
              amountInDefaultCurrency: convertedFee,
              recipientId: courierId,
              recipientEntityId: courierId,
              recipientEntityType: 'courier',
              recipientName: courierName,
              linkedAccountId,
              linkedAccountCode,
              notes: isAr
                ? `أجور توصيل تلقائية لتسليم الطلب رقم: ${ord.orderNumber}`
                : `Auto-wage for delivery of order: ${ord.orderNumber}`,
              status: 'Approved',
              createdByUid: auth.currentUser?.uid || 'system',
              createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
              createdByName: profile?.fullName || 'System Auto-Wage',
              createdAt: Date.now()
            };
            await addDoc(collection(db, 'expenses'), wagePayload);
          }

          if (linkedAccountId) {
            try {
              await financialAccountService.triggerAutomaticVoucher('delivery_wage', ord, {
                courier: { financialAccountId: linkedAccountId, financialAccountCode: linkedAccountCode },
                isAr,
                rawAmount: convertedFee,
                expenseNumber: wageNumber,
                profileName: profile?.fullName || 'System Auto-Wage'
              });
            } catch (txErr) {
              console.warn('[Orders] Could not record delivery wage in batch:', txErr);
            }
          }
          newFiredTriggers.push('delivery_wage');
        }

        // 4. company_profit trigger
        if (shouldFire('company_profit', 'تم التسليم') && parseFloat(ord.profitCompanySAR || '0') > 0) {
          try {
            const profitValSAR = parseFloat(ord.profitCompanySAR || '0');
            const profitConverted = financialAccountService.convertToDefaultCurrency(
              profitValSAR,
              'SAR',
              settings.currency || 'YER',
              { USD: ord.exchangeRateUSD || settings.exchangeRateUSD || 535, SAR: ord.exchangeRateYER || settings.exchangeRateSAR || 140 }
            );

            await financialAccountService.triggerAutomaticVoucher('company_profit', ord, {
              isAr,
              rawAmount: profitConverted,
              profileName: profile?.fullName || 'System Auto-Profit'
            });
            newFiredTriggers.push('company_profit');
          } catch (e) {
            console.warn('[Orders] Could not record company profit in batch:', e);
          }
        }

        const statusTriggerId = `status_notified_${newStatus}`;
        const isAlreadyNotified = firedTriggers.includes(statusTriggerId);

        if (isAlreadyNotified && newStatus !== 'ملغي') {
          // Just skip firing but maybe log or notify once per batch if needed
          // For batch, we don't want to show 100 toasts, so we'll just handle it in the final notification message
        }

        if (!isAlreadyNotified && newStatus !== 'ملغي') {
          newFiredTriggers.push(statusTriggerId);
        }

        await updateDoc(doc(db, 'orders', orderId), {
          orderStatus: newStatus,
          locationYemen: defaultLocation,
          firedTriggers: newFiredTriggers,
          updatedAt: Date.now(),
          ...extraUpdateFields
        });

        // Dispatch real WhatsApp notifications for each order status change in the batch
        if (!isAlreadyNotified && newStatus !== 'ملغي') {
          try {
            const updatedOrderObj = {
              ...ord,
              orderStatus: newStatus,
              locationYemen: defaultLocation
            };
            await whatsappService.triggerNotification('onOrderStatusChanged', updatedOrderObj);
          } catch (whatsappErr) {
            console.error('Failed to dispatch batch WhatsApp notification:', whatsappErr);
          }
        }
      });
      await Promise.all(promises);

      activityLogService.log('edit_order', `Batch update`, {
        orderIds: selectedOrderIds,
        newStatus: newStatus
      });

      notificationService.notify({
        title: isAr ? 'تم التحديث بنجاح' : 'Batch Status Updated',
        message: isAr
          ? `تم تغيير حالة عدد ${selectedOrderIds.length} شحنات إلى: [ ${newStatus} ] (تم تجاوز الإشعارات للحالات المتكررة)`
          : `Updated status of ${selectedOrderIds.length} orders to: [ ${newStatus} ] (Duplicate notifications skipped)`,
        type: 'success',
        category: 'order'
      });
      setSelectedOrderIds([]);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في التحديث' : 'Batch Update Error',
        message: err.message || 'Error executing batch action',
        type: 'error',
        category: 'order'
      });
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const formatStatusLabel = (status: string) => {
    const translationAr: Record<string, string> = {
      'تم تسجيل الطلب': 'تم تسجيل الطلب',
      'وصل مستودع السعودية': 'وصل مستودع السعودية',
      'جاري الشحن لليمن': 'جاري الشحن لليمن',
      'في التخليص الجمركي': 'في التخليص الجمركي',
      'وصل مركز التوزيع في اليمن': 'وصل مركز التوزيع في اليمن',
      'مع المندوب للتوصيل': 'مع المندوب للتوصيل',
      'تم التسليم': 'تم التسليم',
      'ملغي': 'ملغي'
    };
    return isAr ? (translationAr[status] || status) : status;
  };

  const transliterateArabic = (text: string): string => {
    if (!text) return '';
    const mapping: Record<string, string> = {
      'أ': 'A', 'ا': 'A', 'ب': 'B', 'ت': 'T', 'ث': 'Th', 'ج': 'J', 'ح': 'H', 'خ': 'Kh',
      'د': 'D', 'ذ': 'Dh', 'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'Sh', 'ص': 'S', 'ض': 'D',
      'ط': 'T', 'ظ': 'Dh', 'ع': 'A', 'غ': 'Gh', 'ف': 'F', 'ق': 'Q', 'ك': 'K', 'ل': 'L',
      'م': 'M', 'ن': 'N', 'ه': 'H', 'و': 'W', 'ي': 'Y', 'ى': 'Y', 'ة': 'h', 'ئ': 'Y',
      'ؤ': 'W', ' ': ' ', 'ﻻ': 'La', 'لأ': 'La'
    };
    return text.split('').map(char => mapping[char] || char).join('');
  };

  const exportOrdersToPDF = () => {
    const reportTitle = isAr ? 'كشف حركة الشحنات والطلبيات' : 'Logistics Orders Ledger';
    printContent(reportTitle, 'orders-ledger-table', isAr);
    
    activityLogService.log('export_orders_pdf', `Orders list report`, {
      count: filteredOrdersList.length
    });
  };

  const exportOrdersToCSV = () => {
    const headers = [
      isAr ? 'رقم الطلب' : 'Smart Code',
      isAr ? 'التاريخ' : 'Created At',
      isAr ? 'اسم العميل' : 'Customer Name',
      isAr ? 'هاتف العميل' : 'Customer Phone',
      isAr ? 'حالة الطلب' : 'Status',
      isAr ? 'تأكيد الحساب' : 'Source Node',
      isAr ? 'تكلفة التوصيل (ريال)' : 'Cost YER',
      isAr ? 'المدفوع كاش (ريال)' : 'Paid YER',
      isAr ? 'المتبقي ذمة (ريال)' : 'Balance YER'
    ];

    const csvLines = [headers.join(',')];

    filteredOrdersList.forEach(o => {
      const row = [
        `"${o.orderNumber || ''}"`,
        `"${new Date(o.createdAt || Date.now()).toLocaleDateString()}"`,
        `"${(o.customerName || '').replace(/"/g, '""')}"`,
        `"${o.customerPhone || ''}"`,
        `"${o.orderStatus || ''}"`,
        `"${o.orderSourceName || o.orderSourceType || ''}"`,
        (parseFloat(o.amountPaid || 0) + parseFloat(o.amountRemaining || 0)),
        o.amountPaid || 0,
        o.amountRemaining || 0
      ];
      csvLines.push(row.join(','));
    });

    const csvContent = "\uFEFF" + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AlXpress_Orders_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    activityLogService.log('export_orders_csv', `Orders list CSV`, {
      count: filteredOrdersList.length
    });
  };

  const filteredOrdersList = orders
    .filter(o => {
      const num = String(o.orderNumber || '').toUpperCase();
      const customer = String(o.customerName || '').toLowerCase();
      const phone = String(o.customerPhone || '');
      const track = String(o.trackingNumber || '').toUpperCase();
      const q = searchText.toLowerCase();

      const matchSearch = num.includes(q.toUpperCase()) || customer.includes(q) || phone.includes(searchText) || track.includes(q.toUpperCase());
      const matchStatus = statusFilter === 'all' || o.orderStatus === statusFilter;
      const matchCourier = courierFilter === 'all' || o.deliveryCourierId === courierFilter || o.shippingCourierId === courierFilter;
      const matchSource = sourceFilter === 'all' || o.orderSourceId === sourceFilter;

      return matchSearch && matchStatus && matchCourier && matchSource;
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'date-asc') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === 'amount-desc') return ((parseFloat(b.amountPaid || 0) + parseFloat(b.amountRemaining || 0))) - ((parseFloat(a.amountPaid || 0) + parseFloat(a.amountRemaining || 0)));
      return 0;
    });

  if (loading || roleLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 font-bold">
        {isAr ? 'جاري تحميل الدفتر اللوجيستي والمحاسبي...' : 'Loading logistic ledger...'}
      </div>
    );
  }

  // Page Guard: requires view_orders
  if (role !== 'Admin' && !hasPermission('view_orders')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-800 shadow-xl text-center select-none">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide">{isAr ? 'وصول مقيد' : 'Access Denied'}</h2>
        <p className="text-slate-500 max-w-md">{isAr ? 'لا تملك صلاحية عرض الطلبات. تواصل مع مديرك لطلب الصلاحية.' : 'You do not have permission to view orders. Contact your administrator.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors">

      {/* Title block */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/35">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Package className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-start">
            <h1 className="text-xl font-black text-white leading-none mb-1">{t('orders')}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isAr ? 'إنشاء الفواتير • الشحنات النشطة • حسابات المتبقي ومشاركة الأرباح' : 'Invoice maker • Ledger & Profit divisions'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {(role === 'Admin' || hasPermission('print_orders')) && (
            <button
              onClick={exportOrdersToPDF}
              className="bg-slate-950 hover:bg-slate-900 border border-[#d4af37]/25 text-[#d4af37] px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" /> {isAr ? 'طباعة تقرير PDF' : 'PDF Report'}
            </button>
          )}

          {(role === 'Admin' || hasPermission('export_orders')) && (
            <button
              onClick={exportOrdersToCSV}
              className="bg-slate-950 hover:bg-slate-905 border border-emerald-900 text-emerald-400 px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
            >
              <Activity className="w-4 h-4" /> {isAr ? 'تصدير CSV' : 'Export CSV'}
            </button>
          )}

          {canAddOrders && (
            <button
              onClick={() => {
                resetCreateForm();
                setIsAddModalOpen(true);
              }}
              className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {isAr ? 'فاتورة جديدة' : 'New Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: isAr ? 'الطلبات النشطة اليوم' : 'Active Orders Today', val: orders.filter(o => o.orderStatus !== 'تم التسليم' && o.orderStatus !== 'ملغي').length, color: 'text-[#d4af37] bg-[#d4af37]/10' },
          { title: isAr ? 'بانتظار التوزيع لليمن' : 'In Local Dist', val: orders.filter(o => o.orderStatus === 'وصل مركز التوزيع في اليمن').length, color: 'text-amber-400 bg-amber-950/20' },
          { title: isAr ? 'شحنات سلمت بنجاح' : 'Delivered Ledger', val: orders.filter(o => o.orderStatus === 'تم التسليم').length, color: 'text-emerald-400 bg-emerald-950/20' },
          { title: isAr ? 'مبالغ معلقة للتحصيل' : 'Remaining To Collect', val: orders.reduce((sum, o) => sum + financialAccountService.convertToDefaultCurrency(parseFloat(o.amountRemaining || '0'), o.currency || 'YER', settings.currency || 'YER', { USD: o.exchangeRateUSD || settings.exchangeRateUSD, SAR: o.exchangeRateSAR || settings.exchangeRateSAR }), 0).toLocaleString() + ' ' + (settings.currency || 'YER'), color: 'text-rose-400 bg-rose-950/20' }
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
            <option value="تم تسجيل الطلب">{isAr ? 'تم تسجيل الطلب' : 'Pending'}</option>
            <option value="وصل مستودع السعودية">{isAr ? 'وصل مستودع السعودية' : 'In KSA Depot'}</option>
            <option value="جاري الشحن لليمن">{isAr ? 'جاري الشحن لليمن' : 'In Route'}</option>
            <option value="وصل مركز التوزيع في اليمن">{isAr ? 'وصل مركز التوزيع' : 'In Yemen Center'}</option>
            <option value="تم التسليم">{isAr ? 'تم التسليم المسجلة' : 'Delivered'}</option>
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
                <th className="p-4">{isAr ? 'القنوات اللوجيستية والوضع' : 'Logistics Route'}</th>
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
                      <span className="px-2.5 py-0.5 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/5 text-[#d4af37] font-bold max-w-max text-[10px]">
                        {formatStatusLabel(ord.orderStatus)}
                      </span>
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
                            {isAr ? 'الإجمالي: ' : 'Total: '}{Math.ceil(totalFinal).toLocaleString()} <span className="text-[10px] text-slate-500">YER</span>
                          </div>
                          <div className="font-mono text-emerald-400 text-[11px]">
                            {isAr ? 'المدفوع: ' : 'Paid: '}{Math.ceil(paidTotal).toLocaleString()} YER
                          </div>
                          {Math.ceil(remainVal) > 0 ? (
                            <div className="font-mono text-rose-450 text-[11px] font-bold">
                              {isAr ? 'المتبقي: ' : 'Remaining: '}{Math.ceil(remainVal).toLocaleString()} YER
                            </div>
                          ) : Math.ceil(remainVal) < 0 ? (
                            <div className="font-mono text-amber-500 text-[11px] font-bold">
                              {isAr ? 'فائض حساب: ' : 'Overpaid: '}{Math.abs(Math.ceil(remainVal)).toLocaleString()} YER
                            </div>
                          ) : (
                            <span className="text-[9px] bg-emerald-950/20 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded font-black max-w-max uppercase tracking-tighter mt-0.5">{isAr ? 'مسدد بالكامل' : 'Paid in Full'}</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-left flex justify-end gap-2 items-center">

                    {/* View Details / QR */}
                    <button
                      onClick={() => {
                        setSelectedOrder(ord);
                        setIsDetailsModalOpen(true);
                      }}
                      className="bg-slate-800 text-[#d4af37] hover:text-white hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-all text-[10px] flex items-center gap-1 font-bold border border-slate-700 cursor-pointer"
                      title={isAr ? 'عرض التفاصيل والباركود / رمز التتبع' : 'View order & QR tracking'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {isAr ? 'التفاصيل' : 'Details'}
                    </button>

                    {/* Payment handler — requires add_finance */}
                    {parseFloat(ord.amountRemaining || 0) > 0 && (role === 'Admin' || hasPermission('add_finance')) && (
                      <button
                        onClick={() => {
                          setSelectedOrder(ord);
                          setPaymentFormData({ amount: '', method: 'Cash', notes: '', pin: '' });
                          setIsPaymentModalOpen(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 text-[10px] cursor-pointer"
                        title={isAr ? 'تحصيل دفعة مالية' : 'Post payment'}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        {isAr ? 'قبض دفعة' : 'Collect'}
                      </button>
                    )}

                    {/* Status updates — requires edit_orders or update_order_status; delivered orders require edit_delivered_orders */}
                    {(role === 'Admin' || hasPermission('edit_orders') || hasPermission('update_order_status')) &&
                      (ord.orderStatus !== 'تم التسليم' || role === 'Admin' || hasPermission('edit_delivered_orders')) && (
                        <button
                          onClick={() => {
                            setSelectedOrder(ord);
                            setUpdateFormData({
                              orderStatus: ord.orderStatus || 'تم تسجيل الطلب',
                              deliveryStatus: ord.deliveryStatus || 'في الانتظار',
                              locationYemen: ord.locationYemen || 'مستودع صنعاء الرئيسي',
                              internalNotes: ord.internalNotes || '',
                              shippingCourierId: ord.shippingCourierId || '',
                              deliveryCourierId: ord.deliveryCourierId || ''
                            });
                            let initialShippings = ord.shippingDetails || [];
                            if (ord.orderSourceType === 'SHEIN') {
                              const isDefaultOrEmpty = initialShippings.length === 1 &&
                                !initialShippings[0].shippingSource &&
                                !initialShippings[0].shippingDestination &&
                                (initialShippings[0].shippingCost === 0 || !initialShippings[0].shippingCost);
                              if (isDefaultOrEmpty || initialShippings.length === 0) {
                                initialShippings = [];
                              }
                            }
                            setUpdateShippings(initialShippings);
                            setIsUpdateModalOpen(true);
                          }}
                          className="bg-slate-805 text-slate-305 hover:text-white px-2.5 py-1.5 rounded-lg transition-all text-[10px] flex items-center gap-1 font-bold border border-slate-750 cursor-pointer"
                          title={isAr ? 'تعديل المسار والتوجيه اللوجيستي' : 'Update state'}
                        >
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          {isAr ? 'اللوجستيات' : 'Update'}
                        </button>
                      )}

                    {(role === 'Admin' || hasPermission('delete_orders')) && (
                      <button
                        onClick={() => handleDeleteOrderClick(ord)}
                        className="bg-rose-950/20 text-rose-400 hover:bg-rose-900 hover:text-white px-2.5 py-1.5 rounded-lg transition-all text-[10px] flex items-center gap-1 font-bold border border-rose-900/30 cursor-pointer"
                        title={isAr ? 'حذف هذا الطلب نهائياً' : 'Delete Order'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isAr ? 'حذف' : 'Delete'}
                      </button>
                    )}

                  </td>

                </tr>
              ))}
              {filteredOrdersList.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-bold">
                    {isAr ? 'لا يوجد طلبيات مسجلة تطابق محددات البحث.' : 'No invoices matched query.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Floating Action Bar for Batch Updates */}
      {selectedOrderIds.length > 0 && (
        <div id="batch-actions-bar" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-905 border-2 border-[#d4af37]/50 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] px-5 py-4 flex items-center gap-4 flex-wrap whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full col-span-1 bg-yellow-500 animate-pulse"></span>
            <span className="text-white text-xs font-black">
              {isAr
                ? `تم تحديد ${selectedOrderIds.length} فواتير`
                : `${selectedOrderIds.length} invoices selected`}
            </span>
          </div>

          <div className="h-6 w-[1px] bg-slate-800"></div>

          {/* Status Selection and Action */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px] font-bold">
              {isAr ? 'تحديث الحالة الكلية:' : 'Change status:'}
            </span>
            <select
              id="batch-status-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBatchUpdateStatus(e.target.value);
                  e.target.value = ""; // Reset after trigger
                }
              }}
              disabled={isBatchUpdating}
              className="bg-slate-950 border border-slate-750 text-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-500 disabled:opacity-50 cursor-pointer"
            >
              <option value="" disabled>{isAr ? '-- اختر الحالة --' : '-- Choose status --'}</option>
              <option value="تم تسجيل الطلب">{isAr ? 'تم تسجيل الطلب (قيد المعالجة)' : 'Pending'}</option>
              <option value="وصل مستودع السعودية">{isAr ? 'وصل مستودع السعودية للتعبئة' : 'Delivered to KSA Depot'}</option>
              <option value="جاري الشحن لليمن">{isAr ? 'جاري الشحن والنقل لليمن' : 'In Route to Yemen'}</option>
              <option value="وصل مركز التوزيع في اليمن">{isAr ? 'وصل مركز التوزيع في اليمن' : 'Arrived Yemen Center'}</option>
              <option value="تم التسليم">{isAr ? 'تم التسليم النهائي مع العميل' : 'Delivered & Complete'}</option>
              <option value="ملغي">{isAr ? 'ملغي بالكامل' : 'Cancelled'}</option>
            </select>
          </div>

          <div className="h-6 w-[1px] bg-slate-800"></div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                // A quick way to ensure data is forcefully synced
                const btn = document.getElementById('batch-deselect-btn');
                if (btn) {
                  const originalText = btn.innerText;
                  window.dispatchEvent(new Event('reload-orders'));
                  setTimeout(() => window.location.reload(), 300);
                }
              }}
              disabled={isBatchUpdating}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-black cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-cyan-950/20 active:scale-95 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isAr ? 'تحديث البيانات' : 'Refresh Data'}
            </button>

            <button
              id="batch-deselect-btn"
              onClick={() => setSelectedOrderIds([])}
              disabled={isBatchUpdating}
              className="text-xs text-rose-400 hover:text-rose-300 font-black cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-rose-950/20 active:scale-95 transition"
            >
              {isAr ? 'إلغاء التحديد الكلي' : 'Deselect All'}
            </button>
          </div>
        </div>
      )}

      {/* CREATE ORDER LARGE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl my-8 overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-white text-base">
                {isAr ? 'إنشاء فاتورة بوصل شحنة ومسار مالي متكامل' : 'Create Freight Invoice'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* Financial Widget Bar (3 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-800 bg-slate-950/50 p-4 gap-4">
              {/* Box 1: Outstanding Debt */}
              <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-red-500/10 text-red-500 rounded-xl"><AlertCircle className="w-5 h-5" /></div>
                <div className="text-start">
                  <span className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">{isAr ? 'ديون العميل السابقة' : 'Customer Outstanding Debt'}</span>
                  <span className="text-sm font-mono font-black text-red-400">
                    {customerProfileStats ? customerProfileStats.totalOutstandingDebt.toLocaleString() : '0'} YER
                  </span>
                </div>
              </div>

              {/* Box 2: Amount Paid */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-[#d4af37] rounded-xl"><CreditCard className="w-5 h-5" /></div>
                <div className="text-start">
                  <span className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">{isAr ? 'المقبوض كاش (هذا الطلب)' : 'Amount Paid (Current Order)'}</span>
                  <span className="text-sm font-mono font-black text-emerald-400">
                    {(parseFloat(formData.amountPaid as any) || 0).toLocaleString()} YER
                  </span>
                </div>
              </div>

              {/* Box 3: Company Profit */}
              <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl"><DollarSign className="w-5 h-5" /></div>
                <div className="text-start">
                  <span className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">{isAr ? 'رسوم اخرى' : 'Other Fees'}</span>
                  <span className="text-sm font-mono font-black text-blue-400">
                    {calcs.profitCompanySAR.toLocaleString()} SAR
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-start">

              {/* Debt Alert Warning Banner */}
              {customerProfileStats && customerProfileStats.totalOutstandingDebt > 0 && (
                <div className="p-4 bg-red-950/30 border border-red-900 text-red-400 rounded-2xl flex items-center gap-3 animate-pulse">
                  <AlertCircle className="w-6 h-6 shrink-0 text-red-500" />
                  <span className="font-black text-xs leading-relaxed">
                    {isAr
                      ? `⚠️ تنبيه ديون معلقة: يوجد للعميل الحالي ديون غير محصلة ومستحقة بذمته بقيمة: [ ${customerProfileStats.totalOutstandingDebt.toLocaleString()} ريال يمني ].`
                      : `⚠️ Outstanding Balances Warning: This client has outstanding pending balances of [ YER ${customerProfileStats.totalOutstandingDebt.toLocaleString()} ].`}
                  </span>
                </div>
              )}

              {/* Grid 1: Customer Section + Logistics Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. Customer Selection & Activity Profile */}
                <div className="space-y-4 bg-slate-950/30 border border-slate-800 p-5 rounded-3xl relative">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400">{isAr ? 'العميل المستلم' : 'Receiver Customer'}</label>
                    {(role === 'Admin' || hasPermission('add_customers')) && (
                      <button
                        type="button"
                        onClick={() => setIsAddCustomerOpen(true)}
                        className="text-xs font-black text-[#d4af37] hover:underline flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {isAr ? 'إضافة عميل جديد ➕' : 'Quick add customer'}
                      </button>
                    )}
                  </div>

                  {/* Smart Search Input */}
                  {!formData.customerId ? (
                    <div className="relative">
                      <Search className="absolute right-3 top-3 text-slate-500 w-4 h-4" />
                      <input
                        type="text"
                        placeholder={isAr ? "ابحث عن عميل بالاسم أو رقم الجوال..." : "Search customer by name or phone..."}
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2.5 pr-9 pl-4 outline-none font-bold text-xs"
                      />

                      {/* Dropdown Results */}
                      {customerSearchQuery.trim() !== '' && (
                        <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-800">
                          {filteredCustomers.length > 0 ? (
                            filteredCustomers.map(c => (
                              <button
                                type="button"
                                key={c.id}
                                onClick={() => selectCustomer(c)}
                                className="w-full text-start p-3 text-xs hover:bg-slate-800 text-white font-bold flex justify-between items-center"
                              >
                                <span>{c.fullName}</span>
                                <span className="font-mono text-slate-500">{c.phone}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-xs text-slate-500 font-bold flex justify-between items-center">
                              <span>{isAr ? '🟢 عميل جديد' : '🟢 New Customer'}</span>
                              {(role === 'Admin' || hasPermission('add_customers')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomerFormData(prev => ({
                                      ...prev,
                                      fullName: customerSearchQuery,
                                    }));
                                    setIsAddCustomerOpen(true);
                                  }}
                                  className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-3 py-1 rounded-lg text-[10px]"
                                >
                                  {isAr ? 'إضافة الآن' : 'Create Now'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Selected Customer Activity Card */
                    <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[#d4af37]/5 rounded-full -mr-8 -mt-8"></div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-white">{formData.customerName}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formData.customerPhone}</p>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          {customerProfileStats?.tier === 'VIP' && (
                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-2 py-0.5 rounded text-[8px] font-black uppercase">VIP Client</span>
                          )}
                          {customerProfileStats?.tier === 'Debt' && (
                            <span className="bg-red-500/10 text-red-500 border border-red-500/25 px-2 py-0.5 rounded text-[8px] font-black uppercase">Has Debt</span>
                          )}
                          {customerProfileStats?.tier === 'Regular' && (
                            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Regular</span>
                          )}
                          <button
                            type="button"
                            onClick={clearSelectedCustomer}
                            className="bg-slate-800 text-slate-400 hover:text-white p-1 rounded-lg transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-850/50">
                        <div>{isAr ? 'إجمالي الطلبات:' : 'Total orders:'} <span className="text-slate-300 font-mono">{customerProfileStats?.totalOrdersCount}</span></div>
                        <div>{isAr ? 'آخر طلب:' : 'Last order:'} <span className="text-slate-300 font-mono">{customerProfileStats?.lastOrderDate ? customerProfileStats.lastOrderDate.toLocaleDateString() : '—'}</span></div>
                        <div className="col-span-2">{isAr ? 'العنوان الأساسي:' : 'Address:'} <span className="text-slate-300">{formData.customerAddress || '—'}</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Logistics & Purchase Metadata */}
                <div className="space-y-4 bg-slate-950/30 border border-slate-800 p-5 rounded-3xl">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Auto generated order code (preview) */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                        {isAr ? 'رقم الطلب الموحد' : 'Unified Order Code'}
                      </label>
                      <input
                        type="text"
                        disabled
                        value={previewOrderNumber}
                        className="w-full bg-slate-950/50 border border-slate-805 text-[#d4af37] rounded-xl p-3 outline-none font-black text-xs text-center font-mono"
                      />
                    </div>
                    {/* Order creation date */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                        {isAr ? 'تاريخ الفاتورة' : 'Invoice Date'}
                      </label>
                      <input
                        type="text"
                        disabled
                        value={new Date().toLocaleDateString(isAr ? 'ar-YE' : 'en-US')}
                        className="w-full bg-slate-950/50 border border-slate-805 text-slate-300 rounded-xl p-3 outline-none font-bold text-xs text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Order Source */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5 flex-row-reverse">
                        {(role === 'Admin' || hasPermission('add_sources')) && (
                          <button
                            type="button"
                            onClick={() => setIsAddSourceOpen(true)}
                            className="text-[10px] font-black text-[#d4af37] hover:underline flex items-center gap-0.5"
                          >
                            ➕ {isAr ? 'جديد' : 'New'}
                          </button>
                        )}
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider text-start">
                          {isAr ? 'مصدر الشراء' : 'Order Source'}
                        </label>
                      </div>
                      <select
                        required
                        value={formData.orderSourceId}
                        onChange={(e) => setFormData({ ...formData, orderSourceId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                      >
                        <option value="">{isAr ? '-- اختر المصدر --' : '-- Choose Source --'}</option>
                        {sources.map(s => (
                          <option key={s.id} value={s.id}>{s.name || s.source_name} {s.type ? `(${s.type})` : ''}</option>
                        ))}
                      </select>
                    </div>

                    {/* Salla / Store reference ID */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                        {isAr ? 'رقم الفاتورة الأصلي (سلة...)' : 'Orig. Store Reference'}
                      </label>
                      <input
                        type="text"
                        value={formData.externalOrderNumber}
                        onChange={(e) => setFormData({ ...formData, externalOrderNumber: e.target.value })}
                        placeholder={isAr ? "رقم الفاتورة الأصلي" : "Invoice ID"}
                        className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Tracking ID */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                        {isAr ? 'رقم التتبع الدولي' : 'Global Tracking Code'}
                      </label>
                      <input
                        type="text"
                        value={formData.trackingNumber}
                        onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                        placeholder={isAr ? "رقم التتبع الدولي (DHL...)" : "Global Tracking ID"}
                        className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                      />
                    </div>

                    {/* Cart Share Code (Electronic shopping carts) */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                        {isAr ? 'كود السلة الموحد (Cart Code)' : 'Cart Share Code'}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={cartShareCode}
                          onChange={(e) => setCartShareCode(e.target.value)}
                          placeholder={isAr ? "كود السلة" : "Cart Code"}
                          className="flex-1 bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                        />
                        {cartShareCode && (
                          <button
                            type="button"
                            onClick={() => window.open(`https://cart.shop/share/${cartShareCode}`, '_blank')}
                            className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-2.5 rounded-xl text-xs flex items-center justify-center transition"
                            title={isAr ? 'فتح رابط السلة' : 'Open cart URL'}
                          >
                            <Package className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Section 2: Products & Factory specifications */}
              <div className="space-y-3 bg-slate-950/20 border border-slate-850 p-5 rounded-3xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="text-start">
                    <span className="text-xs font-black text-white block">{isAr ? 'محتويات الشحنة والمنتجات التفصيلية' : 'Freight Cargo Contents'}</span>
                    <span className="text-[10px] text-slate-500 font-bold">{isAr ? 'قم بإدخال بيانات المنتج وعناصره بالتفصيل' : 'Define detailed products lists for weight & calculation'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="bg-cyan-600/10 hover:bg-cyan-650/20 text-cyan-400 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all"
                  >
                    ➕ {isAr ? 'إدراج بند منتج' : 'Add Item Row'}
                  </button>
                </div>

                {/* Grid Header labels for desktop */}
                <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-black text-slate-500 uppercase tracking-wider pb-1 px-2.5">
                  <div className="col-span-3 text-start">{isAr ? 'اسم المنتج أو الرابط' : 'Item Name / Link'}</div>
                  <div className="col-span-2 text-center">{isAr ? 'السعر (SAR)' : 'Price (SAR)'}</div>
                  <div className="col-span-1 text-center">{isAr ? 'الكمية' : 'Qty'}</div>
                  {formData.orderSourceType === 'Factory' ? (
                    <>
                      <div className="col-span-1 text-center">{isAr ? 'وزن (KG)' : 'Weight'}</div>
                      <div className="col-span-1 text-center">CBM</div>
                      <div className="col-span-1 text-center">{isAr ? 'طول' : 'L'}</div>
                      <div className="col-span-1 text-center">{isAr ? 'عرض' : 'W'}</div>
                      <div className="col-span-1 text-center">{isAr ? 'ارتفاع' : 'H'}</div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-2 text-center">{isAr ? 'رابط المنتج' : 'URL Link'}</div>
                      <div className="col-span-3 text-center">{isAr ? 'رقم التتبع للمنتج' : 'Product Tracking'}</div>
                    </>
                  )}
                  <div className="col-span-1 text-center">{isAr ? 'حذف' : 'Del'}</div>
                </div>

                <div className="space-y-2.5">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5 bg-slate-900/40 border border-slate-850/50 rounded-2xl">

                      {/* Name */}
                      <div className="col-span-3">
                        <input
                          required
                          type="text"
                          value={item.productName || ''}
                          onChange={(e) => updateItemRow(idx, 'productName', e.target.value)}
                          placeholder={isAr ? "اسم المنتج..." : "Product Name"}
                          className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] text-start"
                        />
                      </div>

                      {/* Price */}
                      <div className="col-span-2">
                        <input
                          required
                          type="number"
                          value={item.productPrice || 0}
                          onChange={(e) => updateItemRow(idx, 'productPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] font-mono text-center"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="col-span-1">
                        <input
                          required
                          type="number"
                          value={item.quantity || 1}
                          onChange={(e) => updateItemRow(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] font-mono text-center"
                        />
                      </div>

                      {/* Source Type switch fields */}
                      {formData.orderSourceType === 'Factory' ? (
                        <>
                          {/* Weight */}
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.weight ?? ''}
                              onChange={(e) => updateItemRow(idx, 'weight', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          {/* CBM */}
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.cbm ?? ''}
                              onChange={(e) => updateItemRow(idx, 'cbm', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          {/* Length */}
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.length ?? ''}
                              onChange={(e) => {
                                const newL = e.target.value;
                                const w = parseFloat(item.width || 0);
                                const h = parseFloat(item.height || 0);
                                updateItemRow(idx, 'length', newL);
                                updateItemRow(idx, 'cbm', parseFloat(((parseFloat(newL || '0') * w * h) / 1000000).toFixed(6)));
                              }}
                              placeholder="L"
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          {/* Width */}
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.width ?? ''}
                              onChange={(e) => {
                                const newW = e.target.value;
                                const l = parseFloat(item.length || 0);
                                const h = parseFloat(item.height || 0);
                                updateItemRow(idx, 'width', newW);
                                updateItemRow(idx, 'cbm', parseFloat(((l * parseFloat(newW || '0') * h) / 1000000).toFixed(6)));
                              }}
                              placeholder="W"
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          {/* Height */}
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.height ?? ''}
                              onChange={(e) => {
                                const newH = e.target.value;
                                const l = parseFloat(item.length || 0);
                                const w = parseFloat(item.width || 0);
                                updateItemRow(idx, 'height', newH);
                                updateItemRow(idx, 'cbm', parseFloat(((l * w * parseFloat(newH || '0')) / 1000000).toFixed(6)));
                              }}
                              placeholder="H"
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Product URL */}
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.productUrl || ''}
                              onChange={(e) => updateItemRow(idx, 'productUrl', e.target.value)}
                              placeholder={isAr ? "رابط المنتج..." : "Product Link"}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] text-start"
                            />
                          </div>
                          {/* Tracking Number */}
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={item.trackingNumber || ''}
                              onChange={(e) => updateItemRow(idx, 'trackingNumber', e.target.value)}
                              placeholder={isAr ? "كود تتبع الطرد للمنتج" : "Item Tracking Number"}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 outline-none font-bold text-[11px] text-start font-mono"
                            />
                          </div>
                        </>
                      )}

                      {/* Remove Button */}
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length === 1}
                          className="text-rose-500 hover:text-white hover:bg-rose-600/20 p-2 rounded-xl transition disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

                {/* Adjustments row: Bank Commission & Coupon discounts */}
                {(formData.orderSourceType === 'App' || formData.orderSourceType === 'SHEIN') && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-850/65">
                    {/* Bank Commission Checkbox & Rate */}
                    {formData.orderSourceType === 'App' || formData.orderSourceType === 'SHEIN' ? (
                      <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded-2xl border border-slate-850">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="bank-comm-check"
                            checked={bankCommissionEnabled}
                            onChange={(e) => setBankCommissionEnabled(e.target.checked)}
                            className="rounded bg-slate-950 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <label
                            htmlFor="bank-comm-check"
                            className={`text-[11px] font-bold text-slate-350 cursor-pointer`}
                          >
                            {isAr ? 'عمولة البنك' : 'Bank Commission'}
                          </label>
                        </div>
                        {bankCommissionEnabled && (
                          <div className="flex items-center gap-2">
                            <select
                              value={bankCommissionType}
                              onChange={(e) => setBankCommissionType(e.target.value as 'percentage' | 'fixed')}
                              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl p-1 text-[10px] focus:ring-[#d4af37] focus:border-[#d4af37]"
                            >
                              <option value="percentage">{isAr ? 'نسبة (%)' : 'Percentage (%)'}</option>
                              <option value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                            </select>
                            <input
                              type="number"
                              value={bankCommissionRate}
                              onChange={(e) => setBankCommissionRate(parseFloat(e.target.value) || 0)}
                              className="w-16 bg-slate-950 border border-slate-800 text-white rounded-xl p-1 text-center font-mono font-bold text-[10px] focus:ring-[#d4af37] focus:border-[#d4af37]"
                              placeholder={bankCommissionType === 'percentage' ? '%' : 'SAR'}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="hidden md:block"></div>
                    )}

                    {/* Coupon Discount Checkbox & Rate */}
                    <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-850">
                      <input
                        type="checkbox"
                        id="coupon-check"
                        checked={couponEnabled}
                        onChange={(e) => setCouponEnabled(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="coupon-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">{isAr ? 'كوبون خصم (مبلغ)' : 'Coupon Discount (Amount)'}</label>
                      {couponEnabled && (
                        <input
                          type="number"
                          value={couponRate}
                          onChange={(e) => setCouponRate(parseFloat(e.target.value) || 0)}
                          className="w-16 bg-slate-950 border border-slate-800 text-white rounded-xl p-1 text-center font-mono font-bold text-[10px]"
                          placeholder="0.00"
                        />
                      )}
                    </div>

                    {/* Add Shipping Checkbox */}
                    {formData.orderSourceType === 'App' ? (
                      <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-850">
                        <input
                          type="checkbox"
                          id="add-shipping-check"
                          checked={addShippingEnabled}
                          onChange={(e) => setAddShippingEnabled(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="add-shipping-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">{isAr ? 'إضافة شحن للطلب' : 'Add Shipping Costs'}</label>
                      </div>
                    ) : (
                      <div className="hidden md:block"></div>
                    )}
                  </div>
                )}

                {/* Subtotals calculations summary */}
                {(formData.orderSourceType === 'App' || formData.orderSourceType === 'SHEIN') && (
                  <div className="pt-2 flex justify-between text-[11px] font-bold text-slate-500 border-t border-slate-850/50 mt-2">
                    <div>
                      {isAr ? 'إجمالي المنتجات الأصلي:' : 'Original Products Subtotal:'}{' '}
                      <span className="font-mono text-slate-300">{calcs.productsSum.toLocaleString()} SAR</span>
                    </div>
                    {couponEnabled && (
                      <div>
                        {isAr ? 'الإجمالي بعد التعديل (الخصم/العمولة):' : 'Adjusted Products Subtotal (Discount/Comm):'}{' '}
                        <span className="font-mono text-emerald-400 font-black">{calcs.totalProductsCostWithAdjustments.toLocaleString()} SAR</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Factory specifics: Total weight and volume */}
                {formData.orderSourceType === 'Factory' && (
                  <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-2xl flex justify-between text-[11px] font-bold text-slate-400 mt-2">
                    <div>
                      {isAr ? 'إجمالي الوزن:' : 'Total Weight:'}{' '}
                      <span className="font-mono text-amber-500 font-black">{calcs.totalWeight.toLocaleString()} {isAr ? 'كجم' : 'kg'}</span>
                    </div>
                    <div>
                      {isAr ? 'إجمالي الحجم:' : 'Total Volume:'}{' '}
                      <span className="font-mono text-blue-400 font-black">{calcs.totalCBM.toFixed(6)} CBM</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Shipping manifestation details */}
              {formData.orderSourceType !== 'SHEIN' && (formData.orderSourceType !== 'App' || addShippingEnabled) && (
                <div className="space-y-4 bg-slate-950/20 border border-slate-850 p-5 rounded-3xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
                    <div className="text-start">
                      <span className="text-xs font-black text-white block">{isAr ? 'تفاصيل شحنات المسار اللوجيستي' : 'Shipping Manifest Tracks'}</span>
                      <span className="text-[10px] text-slate-500 font-bold mt-0.5">{isAr ? 'أدخل مسارات الشحن المعتمدة لهذا الطرد للتدقيق' : 'Define transport companies and costs for delivery tracks'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={addShippingRow}
                      className="bg-emerald-600/10 hover:bg-emerald-650/20 text-emerald-400 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1"
                    >
                      ➕ {isAr ? 'إضافة تفاصيل شحن' : 'Add Shipping Track'}
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {shippings && shippings.map((sh, idx) => (
                      <div key={sh.id || idx} className="bg-slate-900/40 p-4 rounded-2xl border border-slate-850 space-y-3 relative">
                        {/* Segment title and remove action */}
                        <div className="flex justify-between items-center border-b border-slate-850/50 pb-2">
                          <span className="text-[10px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2 py-0.5 rounded">
                            {isAr ? `مسار الشحن #${idx + 1}` : `Shipping Track #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeShippingRow(idx)}
                            className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/10 transition-all font-bold text-[10px] flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isAr ? 'إلغاء المسار' : 'Delete Segment'}
                          </button>
                        </div>

                        {/* Manifest inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-start font-bold">
                          {/* 1. Mode */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'نوع الشحن' : 'Mode'}</label>
                            <select
                              value={sh.shippingType || 'بري'}
                              onChange={(e) => updateShippingRow(idx, 'shippingType', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold"
                            >
                              <option value="بري">{isAr ? 'Overland بري' : 'Land - Overland'}</option>
                              <option value="جوي">{isAr ? 'Air Freight جوي' : 'Air - Air Freight'}</option>
                              <option value="بحري">{isAr ? 'Ocean Cargo بحري' : 'Sea - Ocean Cargo'}</option>
                            </select>
                          </div>

                          {/* 2. Carrier company */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-slate-400">{isAr ? 'شركة الشحن' : 'Carrier'}</label>
                              {(role === 'Admin' || hasPermission('add_sources')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveAddShippingIndex(idx);
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
                              onChange={(e) => updateShippingRow(idx, 'shippingCompany', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold"
                            >
                              <option value="">{isAr ? '-- اختر شركة شحن --' : '-- Choose carrier --'}</option>
                              {shippingCompanies.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* 3. Tracking Number */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'رقم التتبع للشحنة' : 'Tracking Number'}</label>
                            <input
                              type="text"
                              value={sh.trackingNumber || ''}
                              onChange={(e) => updateShippingRow(idx, 'trackingNumber', e.target.value)}
                              placeholder={isAr ? "رقم التتبع المخصص للشحنة" : "Cargo tracking ID"}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono placeholder-slate-650"
                            />
                          </div>

                          {/* 4. Shipping Cost */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'أجرة وتكاليف النقل (ريال سعودي)' : 'Shipping Cost (SAR)'}</label>
                            <input
                              type="number"
                              required
                              value={sh.shippingCost || 0}
                              onChange={(e) => updateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-950 border border-slate-800 text-[#d4af37] rounded-xl p-2.5 outline-none font-mono"
                            />
                          </div>

                          {/* 5. Origin */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'مكان التصدير' : 'Source'}</label>
                            <input
                              type="text"
                              required
                              value={sh.shippingSource || ''}
                              onChange={(e) => updateShippingRow(idx, 'shippingSource', e.target.value)}
                              placeholder={isAr ? "مثال: الصين، دبي" : "Source country"}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none placeholder-slate-600"
                            />
                          </div>

                          {/* 6. Destination */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'مكان الاستلام' : 'Destination'}</label>
                            <input
                              type="text"
                              required
                              value={sh.shippingDestination || ''}
                              onChange={(e) => updateShippingRow(idx, 'shippingDestination', e.target.value)}
                              placeholder={isAr ? "مثال: مستودع صنعاء" : "Destination depot"}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none placeholder-slate-600"
                            />
                          </div>

                          {/* 7. Dispatch / Departure Date - defaults to today, editable, with calendar picker */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'تاريخ انطلاق الشحن' : 'Dispatch Date'}</label>
                            <div className="relative">
                              <input
                                type="date"
                                id={`dispatch-date-${idx}`}
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
                                  updateShippingRow(idx, { shippingDate: newDate, expectedArrival: expected });
                                }}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans pr-9"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById(`dispatch-date-${idx}`);
                                  if (el) (el as HTMLInputElement).showPicker?.();
                                }}
                                className="absolute inset-y-0 end-2.5 flex items-center text-slate-500 hover:text-[#d4af37] transition"
                              >
                                <Calendar className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* 8. Transit Duration - auto-filled from settings by source type, editable */}
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
                                  updateShippingRow(idx, { shippingDuration: durationVal, expectedArrival: expected });
                                }}
                                placeholder={isAr ? "مثال: 12 يوم" : "e.g. 12"}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none placeholder-slate-655 font-mono pr-9"
                              />
                              <span className="absolute inset-y-0 end-2.5 flex items-center text-slate-600 text-[10px] font-bold pointer-events-none">
                                {isAr ? 'يوم' : 'd'}
                              </span>
                            </div>
                          </div>

                          {/* 9. Expected Arrival - auto-calculated from dispatch date + duration, editable */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'موعد الوصول المتوقع' : 'Expected Arrival'}</label>
                            <div className="relative">
                              <input
                                type="date"
                                id={`expected-date-${idx}`}
                                value={sh.expectedArrival || ''}
                                onChange={(e) => updateShippingRow(idx, 'expectedArrival', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans pr-9"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById(`expected-date-${idx}`);
                                  if (el) (el as HTMLInputElement).showPicker?.();
                                }}
                                className="absolute inset-y-0 end-2.5 flex items-center text-slate-500 hover:text-emerald-400 transition"
                              >
                                <Calendar className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* 10. Packaging Fees (SAR fixed amount) */}
                          <div className="col-span-2">
                            <label className="block text-slate-500 mb-1">{isAr ? 'أجور التغليف والصناديق (SAR)' : 'Packaging Fees (SAR)'}</label>
                            <input
                              type="number"
                              value={sh.packagingFees || 0}
                              onChange={(e) => updateShippingRow(idx, 'packagingFees', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Show CBM under shipping rows for Factory */}
                  {formData.orderSourceType === 'Factory' && (
                    <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-2xl flex justify-between text-[11px] font-bold text-slate-400 mt-2 text-start">
                      <div>
                        {isAr ? 'إجمالي الـ CBM للمنتجات:' : 'Total Products CBM:'}{' '}
                        <span className="font-mono text-blue-400 font-black">{calcs.totalCBM.toFixed(6)} m³</span>
                      </div>
                    </div>
                  )}

                  {/* Carrier packaging fee - fixed SAR amount added to shipping cost */}
                  <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-850 mt-3 text-start">
                    <input
                      type="checkbox"
                      id="packaging-fee-check"
                      checked={packagingFeeEnabled}
                      onChange={(e) => setPackagingFeeEnabled(e.target.checked)}
                      //disabled={!canEditOrderDefaultsCreation}
                      className="rounded bg-slate-950 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <label
                      htmlFor="packaging-fee-check"
                      className={`text-[11px] font-bold text-slate-350 ${!canEditOrderDefaultsCreation ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isAr ? 'إضافة رسوم تغليف شركة الشحن (ريال ثابت)' : 'Add carrier packaging fee (fixed SAR)'}
                    </label>
                    {packagingFeeEnabled && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={packagingFeeRate}
                          onChange={(e) => canEditOrderDefaultsCreation && setPackagingFeeRate(parseFloat(e.target.value) || 0)}
                          disabled={!canEditOrderDefaultsCreation}
                          className="w-20 bg-slate-950 border border-slate-800 text-white rounded-xl p-1.5 text-center font-mono font-bold text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-slate-500 font-bold">SAR</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 4: Couriers & Local Logistics Drivers */}
              <div className="space-y-4 bg-slate-955/20 border border-slate-800 p-5 rounded-3xl">
                <span className="block text-xs font-black text-white text-start mb-2">{isAr ? 'المناديب واللوجستيات الميدانية' : 'Field Logistics Drivers'}</span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-start font-bold">
                  {/* Saudi Courier */}
                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'موظف التعبئة والتجميع (سعودي)' : 'Saudi Partner Aggregator'}</label>
                    <select
                      value={formData.shippingCourierId}
                      onChange={(e) => setFormData({ ...formData, shippingCourierId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-855 text-white rounded-xl p-3 outline-none text-[11px] font-bold"
                    >
                      <option value="">{isAr ? '-- اختر موظف التجميع --' : '-- Choose Aggregator --'}</option>
                      {couriers.filter(c => c.courierType === 'sourcing').map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </select>

                    {/* Display commission rate indicator */}
                    {formData.shippingCourierId && (
                      <div className="text-[10px] text-[#d4af37] font-bold mt-1">
                        {isAr ? 'عمولة الشريك المحددة:' : 'Aggregator rate:'}{' '}
                        <span className="font-mono">
                          {(() => {
                            const found = couriers.find(c => c.id === formData.shippingCourierId);
                            return found && found.commissionRate !== undefined ? found.commissionRate : '30';
                          })()}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Yemen Driver */}
                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'مندوب التوزيع النهائي (اليمن)' : 'Yemen Delivery Driver'}</label>
                    <select
                      value={formData.deliveryCourierId}
                      onChange={(e) => setFormData({ ...formData, deliveryCourierId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-855 text-white rounded-xl p-3 outline-none text-[11px] font-bold"
                    >
                      <option value="">{isAr ? '-- اختر مندوب التوصيل --' : '-- Choose Yemen Driver --'}</option>
                      {couriers.filter(c => c.courierType === 'local' || !c.courierType).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Yemen Driver Flat Fee */}
                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'رسوم التوصيل لليمن (ريال يمني)' : 'Delivery Courier Fee (YER)'}</label>
                    <input
                      type="number"
                      value={formData.deliveryCourierFee}
                      onChange={(e) => setFormData({ ...formData, deliveryCourierFee: parseFloat(e.target.value) || 0 })}
                      disabled={!canEditOrderDefaultsCreation}
                      className="w-full bg-slate-950 border border-slate-855 text-white rounded-xl p-3 outline-none font-mono text-xs text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Financial calculations parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/30 border border-slate-800 p-6 rounded-3xl text-[11px] font-bold text-slate-400 text-start">

                {/* Inputs for pricing parameters */}
                <div className="space-y-4 col-span-2 grid grid-cols-2 gap-3 self-start">

                  {formData.orderSourceType === 'SHEIN' && (
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1.5">
                        {isAr ? 'سعر شي إن الأحمر (SAR)' : 'SHEIN Red Price (SAR)'}
                      </label>
                      <input
                        type="number"
                        value={formData.sheinRedPrice || ''}
                        onChange={(e) => setFormData({ ...formData, sheinRedPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px]"
                        placeholder="0.00"
                      />
                      {formData.sheinRedPrice > 0 && formData.sheinRedPrice < calcs.productsSum && (
                        <p className="text-[9px] text-red-500 mt-1 font-bold">
                          {isAr ? '⚠️ السعر الأحمر يجب ألا يقل عن تكلفة المنتجات' : '⚠️ Red price cannot be less than products cost'}
                        </p>
                      )}
                    </div>
                  )}

                  {formData.orderSourceType === 'Factory' && (
                    <>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1.5">
                          {isAr ? 'نسبة الربح للكيلو (SAR/كجم)' : 'Profit Rate per KG (SAR/kg)'}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={profitPerKgRate}
                          onChange={(e) => setProfitPerKgRate(parseFloat(e.target.value) || 0)}
                          disabled={!canEditOrderDefaultsCreation}
                          className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1.5 font-bold">
                          {isAr ? 'سعر شحن الـ CBM (دولار USD/m³)' : 'CBM Shipping Rate (USD/m³)'}
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="any"
                            value={cbmShippingRateValue}
                            onChange={(e) => setCbmShippingRateValue(parseFloat(e.target.value) || 0)}
                            disabled={!canEditOrderDefaultsCreation}
                            className="flex-1 bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {settings.cbmShippingRateApiUrl && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(settings.cbmShippingRateApiUrl!);
                                  if (!res.ok) throw new Error('API request failed');
                                  const data = await res.json();
                                  const rate = data.cbm_rate || data.rate || data.value || data.price;
                                  if (rate && !isNaN(parseFloat(rate))) {
                                    setCbmShippingRateValue(parseFloat(rate));
                                    alert(isAr ? `✅ تم جلب سعر CBM الجديد: ${rate} USD/m³` : `✅ New CBM rate fetched: ${rate} USD/m³`);
                                  } else {
                                    throw new Error(isAr ? 'لم يتم العثور على سعر CBM' : 'CBM rate not found');
                                  }
                                } catch (err: any) {
                                  alert((isAr ? '❌ خطأ: ' : '❌ Error: ') + err.message);
                                }
                              }}
                              disabled={!canEditOrderDefaultsCreation}
                              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl text-xs flex items-center justify-center transition"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1.5">{isAr ? 'رسوم تغليف وشحن محلي (SAR)' : 'KSA Wrapping Fee and local shipping (SAR)'}</label>
                    <input
                      type="number"
                      value={formData.packagingFee || ''}
                      onChange={(e) => setFormData({ ...formData, packagingFee: parseFloat(e.target.value) || 0 })}
                      disabled={!canEditOrderDefaultsCreation}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1.5">{isAr ? 'العملة والتحصيل المالي' : 'Collection Currency'}</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none text-[11px]"
                    >
                      <option value="SAR">{isAr ? 'ريال سعودي' : 'SAR'}</option>
                      <option value="USD">{isAr ? 'دولار امريكي' : 'USD'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1.5">{isAr ? 'سعر الصرف (ريال يمني)' : 'Exchange Rate (YER)'}</label>
                    <input
                      type="number"
                      value={formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        if (formData.currency === 'USD') {
                          setFormData({ ...formData, exchangeRateUSD: val });
                        } else {
                          setFormData({ ...formData, exchangeRateYER: val });
                        }
                      }}
                      disabled={!canEditOrderDefaultsCreation}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px] text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="md:col-span-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-900/40 p-3 rounded-xl border border-slate-800 hover:bg-slate-900 transition">
                      <input
                        type="checkbox"
                        checked={formData.deductSourcingCostFromCourier || false}
                        onChange={(e) => setFormData({ ...formData, deductSourcingCostFromCourier: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-[#d4af37] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#d4af37]"
                      />
                      <span className="text-[11px] font-bold text-slate-300">{isAr ? 'خصم تكاليف شراء المنتجات من حساب مندوب التجميع حالاً' : 'Deduct Orignal Products Cost from Collecting Courier Liability Now'}</span>
                    </label>
                  </div>
                </div>

                {/* Audit summary calculations details panel */}
                <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 shadow-xl space-y-4 text-xs mt-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#d4af37]/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
                    <Calculator className="w-4 h-4 text-[#d4af37]" />
                    <span className="text-[11px] text-slate-300 font-extrabold uppercase tracking-widest">{isAr ? 'خلاصة كشف الحساب المالي (مفصل)' : 'Detailed Financial Audit Report'}</span>
                  </div>

                  <div className="space-y-3">
                    {/* Products Cost */}
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="font-medium">{isAr ? 'قيمة المنتجات الأصلية:' : 'Original Products Subtotal:'}</span>
                      <div className="text-right">
                        <span className="font-mono text-white block">{calcs.productsSum.toLocaleString()} SAR</span>
                        <span className="font-mono text-[9px] text-slate-500 block">{(calcs.productsSum * (formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER)).toLocaleString()} YER</span>
                      </div>
                    </div>

                    {/* Bank Commission section */}
                    {bankCommissionEnabled && calcs.bankCommissionSAR > 0 && (
                      <div className="flex justify-between items-center text-amber-500/80">
                        <span className="font-medium">
                          {isAr 
                            ? `عمولة البنك (${bankCommissionType === 'percentage' ? bankCommissionRate + '%' : bankCommissionRate + ' SAR'}):` 
                            : `Bank Fee (${bankCommissionType === 'percentage' ? bankCommissionRate + '%' : bankCommissionRate + ' SAR'}):`}
                        </span>
                        <div className="text-right">
                          <span className="font-mono block">-{calcs.bankCommissionSAR.toLocaleString()} SAR</span>
                          <span className="font-mono text-[9px] opacity-70 block">-{(calcs.bankCommissionSAR * (formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER)).toLocaleString()} YER</span>
                        </div>
                      </div>
                    )}

                    {/* Coupon Discount */}
                    {couponEnabled && calcs.couponValue > 0 && (
                      <div className="flex justify-between items-center text-rose-400/90">
                        <span className="font-medium">{isAr ? 'كوبون الخصم النشط (مبلغ):' : 'Active Coupon Discount (Amount):'}</span>
                        <div className="text-right">
                          <span className="font-mono block">-{calcs.couponValue.toLocaleString()} SAR</span>
                          <span className="font-mono text-[9px] opacity-70 block">-{(calcs.couponValue * (formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER)).toLocaleString()} YER</span>
                        </div>
                      </div>
                    )}

                    {/* Adjusted Products Price */}
                    <div className="flex justify-between items-center text-slate-350 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50">
                      <span className="text-[10px] font-bold">{isAr ? 'إجمالي المنتجات المعدل:' : 'Adjusted Products Total:'}</span>
                      <div className="text-right">
                        <span className="font-mono text-emerald-100 block">{calcs.totalProductsCostWithAdjustments.toLocaleString()} SAR</span>
                        <span className="font-mono text-[9px] text-slate-500 block">{(calcs.totalProductsCostWithAdjustments * (formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER)).toLocaleString()} YER</span>
                      </div>
                    </div>

                    {/* Factory specifics OR ordinary shipping fee */}
                    {(formData.orderSourceType === 'Factory' || calcs.shippingCostSAR > 0) && (
                      <div className="pt-2 border-t border-slate-800/50 space-y-3">
                        <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">{isAr ? 'تفاصيل أجور الشحن والنقل الدولي' : 'Logistics & Freight Cost'}</span>

                        {formData.orderSourceType === 'Factory' && (
                          <div className="flex items-center gap-4 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                            <div className="flex-1">
                              <span className="block text-[9px] text-slate-500 uppercase">{isAr ? 'الوزن الفعلي (كجم)' : 'Weight (KG)'}</span>
                              <span className="font-mono text-amber-500/90 font-bold">{calcs.totalWeight}</span>
                            </div>
                            <div className="w-[1px] h-6 bg-slate-800"></div>
                            <div className="flex-1">
                              <span className="block text-[9px] text-slate-500 uppercase">{isAr ? 'الحجم الفعلي (CBM)' : 'Volume (CBM)'}</span>
                              <span className="font-mono text-blue-400/90 font-bold">{calcs.totalCBM}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-slate-350">
                          <span className="font-medium">{isAr ? 'تكلفة النقل والشحن الدولي:' : 'International Freight Fee:'}</span>
                          <div className="text-right">
                            <span className="font-mono text-white block">{calcs.shippingCostSAR.toLocaleString()} SAR</span>
                            <span className="font-mono text-[9px] text-slate-500 block">{(calcs.shippingCostSAR * (formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER)).toLocaleString()} YER</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* KSA Packaging Fee */}
                    {parseFloat(formData.packagingFee as any) > 0 && (
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="font-medium">{isAr ? 'رسوم التغليف العامة:' : 'General Packaging Fee:'}</span>
                        <div className="text-right">
                          <span className="font-mono text-white block">{parseFloat(formData.packagingFee as any).toLocaleString()} SAR</span>
                          <span className="font-mono text-[9px] text-slate-500 block">{(parseFloat(formData.packagingFee as any) * (formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER)).toLocaleString()} YER</span>
                        </div>
                      </div>
                    )}

                    {/* Pre-computation Exchanged amount */}
                    <div className="pt-4 border-t border-slate-800/80">
                      <div className="flex justify-between items-center text-slate-400 bg-[#d4af37]/5 p-3 rounded-xl border border-[#d4af37]/20">
                        <div>
                          <span className="block font-bold text-[11px] text-[#d4af37]">{isAr ? 'مجموع التكلفة الإجمالية (خارجياً):' : 'Foreign Grand Total:'}</span>
                          <span className="block text-[9px] text-yellow-600/70 mt-0.5">{isAr ? `تُحسب بسعر صرف: ${formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER} YER` : `At exchange rate: ${formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER} YER`}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-white text-sm font-black block">{calcs.totalOrderSAR.toLocaleString()} SAR</span>
                          <span className="font-mono text-[10px] text-[#d4af37] block mt-0.5 font-bold">{(calcs.totalOrderSAR * (formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER)).toLocaleString()} YER</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-slate-300 pt-3">
                      <span className="font-medium">{isAr ? 'المقدار المستحق للمندوب (توصيل يمني):' : 'Local Courier/Yemen Delivery Fee:'}</span>
                      <span className="font-mono text-white bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg">+{parseFloat(formData.deliveryCourierFee as any).toLocaleString()} YER</span>
                    </div>

                    {/* Final Grand Total */}
                    <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-dashed border-emerald-900/40 pb-3">
                      <span className="font-black text-emerald-400/90 text-xs">{isAr ? 'المبلغ النهائي والمستحق إجمالاً:' : 'Final Estimated Due Amount:'}</span>
                      <span className="font-black font-mono text-emerald-400 text-lg bg-emerald-950/20 px-3 py-1 rounded-xl border border-emerald-900/40 shadow-inner">
                        {Math.ceil(calcs.totalOrderYER).toLocaleString()} YER
                      </span>
                    </div>
                  </div>

                  {/* Payment & Receipts panel */}
                  <div className="pt-4 border-t-2 border-slate-800 space-y-4">
                    <div className="flex flex-col space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold flex justify-between items-center">
                        <span className="text-[#d4af37]">{isAr ? 'االدفعة المقدمة / كاش (ريال يمني)' : 'Cash/Advance Payment (YER)'}</span>
                        <div className="flex gap-1.5 text-[9px]">
                          <button type="button" onClick={() => setFormData({ ...formData, amountPaid: 0 })} className="px-2.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer">0</button>
                          <button type="button" onClick={() => setFormData({ ...formData, amountPaid: Math.ceil(calcs.totalOrderYER) })} className="px-2.5 py-0.5 rounded border border-emerald-800/40 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 transition cursor-pointer">{isAr ? 'سداد الكل' : 'Pay All'}</button>
                        </div>
                      </label>
                      <div className="relative group">
                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50 group-focus-within:text-emerald-400 transition-colors" />
                        <input
                          type="number"
                          value={formData.amountPaid || ''}
                          onChange={(e) => setFormData({ ...formData, amountPaid: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-950/50 border border-slate-700 focus:border-emerald-500/50 text-emerald-400 font-black rounded-xl py-3 pl-10 pr-4 outline-none font-mono text-sm shadow-inner transition-colors"
                          placeholder="0.00 YER"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-2">
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                        <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">{isAr ? 'حالة السداد الآلية' : 'Payment Status'}</span>
                        {Math.ceil(calcs.remainingYER) <= 0 ? (
                          <span className="text-emerald-400 font-black flex items-center gap-1.5 text-xs"><Package className="w-3.5 h-3.5" />{isAr ? 'فاتورة مدفوعة' : 'PAID'}</span>
                        ) : parseFloat(formData.amountPaid as any) > 0 ? (
                          <span className="text-amber-500 font-black flex items-center gap-1.5 text-xs"><AlertCircle className="w-3.5 h-3.5" />{isAr ? 'دفع جزئي' : 'PARTIAL'}</span>
                        ) : (
                          <span className="text-rose-500 font-black flex items-center gap-1.5 text-xs"><AlertCircle className="w-3.5 h-3.5" />{isAr ? 'مديونية غير مسددة' : 'UNPAID'}</span>
                        )}
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                        <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">{isAr ? 'بوابة الدفع' : 'Pay Method'}</span>
                        <select
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                          className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
                        >
                          <option value="Cash" className="bg-slate-900">{isAr ? 'نقد كاش' : 'Cash'}</option>
                          <option value="Bank Transfer" className="bg-slate-900">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                      <span className="font-extrabold text-[#d4af37] text-[11px]">{isAr ? 'المديونية المتبقية للدفع:' : 'Outstanding Debt:'}</span>
                      <span className="font-mono text-sm font-black text-rose-500">{Math.ceil(calcs.remainingYER).toLocaleString()} YER</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action commands */}
              <div className="pt-6 border-t border-slate-850 flex justify-end gap-3 shrink-0">
                <button type="button" disabled={isSubmitting} onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all font-bold text-xs disabled:opacity-50">{isAr ? 'إلغاء النافذة' : 'Cancel'}</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all text-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وترحيل الفاتورة وإرسال' : 'Deploy Freight cargo')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER NESTED MODAL */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center text-xs font-black text-white">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <UserPlus className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تسجيل عميل جديد ومطابقة الحساب بالكامل' : 'Quick Register Customer'}
              </span>
              <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-5 space-y-4 text-start overflow-y-auto max-h-[85vh]">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                  {isAr ? 'الاسم الثلاثي أو الرباعي للعميل' : 'Full Patron Name'} *
                </label>
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d4af37]" />
                  <input
                    required
                    tabIndex={1}
                    placeholder={isAr ? 'أدخل اسم العميل بالكامل...' : 'e.g. Abdullah bin Ali'}
                    type="text"
                    value={customerFormData.fullName}
                    onChange={e => setCustomerFormData({ ...customerFormData, fullName: e.target.value })}
                    className="w-full bg-black/50 border border-slate-800 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none text-start transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                    {isAr ? 'رقم الهاتف (الواتساب)' : 'Cellphone Contact'} *
                  </label>
                  <div className="relative">
                    <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      required
                      tabIndex={2}
                      type="text"
                      placeholder="+967..."
                      value={customerFormData.phone}
                      onChange={e => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                      className="w-full bg-black/50 border border-slate-800 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono text-start"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                    {isAr ? 'البريد الإلكتروني' : 'Electronic Mail'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      tabIndex={3}
                      type="email"
                      placeholder="client@mail.com"
                      value={customerFormData.email}
                      onChange={e => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                      className="w-full bg-black/50 border border-slate-800 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono text-start"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                  {isAr ? 'العنوان وتفاصيل التوزيع بليمن' : 'Yemen Handover Settlement Address'}
                </label>
                <div className="relative">
                  <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    tabIndex={4}
                    placeholder={isAr ? 'المدينة • المديرية • الشارع • معلم بجانب المنزل' : 'Sanaa, Haddah, behind post office'}
                    type="text"
                    value={customerFormData.address}
                    onChange={e => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                    className="w-full bg-black/50 border border-slate-800 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none text-start"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                  {isAr ? 'رابط الموقع الجغرافي الخرائط (GPS)' : 'Google Maps Embed/URL'}
                </label>
                <input
                  tabIndex={5}
                  placeholder="https://maps.google.com/?q=..."
                  type="text"
                  value={customerFormData.gps_location}
                  onChange={e => setCustomerFormData({ ...customerFormData, gps_location: e.target.value })}
                  className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none font-mono text-start"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                  {isAr ? 'ملاحظات وتصنيفات إدارية خاصة' : 'Administrative Confidential Annotations'}
                </label>
                <textarea
                  tabIndex={7}
                  rows={2}
                  value={customerFormData.notes}
                  onChange={e => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                  className="w-full bg-black/50 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none text-start"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-5 py-2 text-slate-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-black rounded-xl transition disabled:opacity-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تأكيد الحفظ' : 'Confirm Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD PURCHASE SOURCE NESTED MODAL */}
      {isAddSourceOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 bg-slate-955 flex justify-between items-center text-xs font-black text-white">
              <span>{isAr ? 'تقييد مصدر شراء جديد' : 'Incorporate Purchase Source'}</span>
              <button type="button" onClick={() => setIsAddSourceOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-1 rounded-lg">
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddSource} className="p-5 space-y-4 text-start">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'تصنيف قناة التوريد' : 'Class of channel'}</label>
                <select
                  value={sourceFormData.type}
                  onChange={(e) => setSourceFormData({ ...sourceFormData, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold"
                >
                  <option value="SHEIN">{isAr ? 'موقع SHEIN' : 'SHEIN Website'}</option>
                  <option value="App">{isAr ? 'موقع تسوق إلكتروني / تطبيق' : 'Retail Application/Website'}</option>
                  <option value="Factory">{isAr ? 'مصنع أو مورد بالصين' : 'Direct China Manufacturer'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'اسم المصدر / التطبيق' : 'Source Name'}</label>
                <input required type="text" value={sourceFormData.source_name || ''} onChange={e => setSourceFormData({ ...sourceFormData, source_name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
              </div>

              {sourceFormData.type === 'App' && (
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'رابط الويب بوابة (اختياري)' : 'URL Link'}</label>
                  <input type="url" value={sourceFormData.source_url || ''} onChange={e => setSourceFormData({ ...sourceFormData, source_url: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-mono font-bold" placeholder="https://example.com" />
                </div>
              )}

              {sourceFormData.type === 'Factory' && (
                <>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'بيانات المورد / WeChat' : 'WeChat Contact'}</label>
                    <input type="text" value={sourceFormData.contact_info || ''} onChange={e => setSourceFormData({ ...sourceFormData, contact_info: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'جغرافية المصنع / التسليم' : 'Depot Location'}</label>
                    <input type="text" value={sourceFormData.location || ''} onChange={e => setSourceFormData({ ...sourceFormData, location: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
                  </div>
                </>
              )}

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button type="button" disabled={isSubmitting} onClick={() => setIsAddSourceOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg disabled:opacity-50">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={isSubmitting} className="p-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تأكيد الحفظ' : 'Confirm Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD SHIPPING COMPANY NESTED MODAL */}
      {isAddShippingCompanyOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 bg-slate-955 flex justify-between items-center text-xs font-black text-white">
              <span>{isAr ? 'تقييد شركة شحن جديدة' : 'Add New Carrier'}</span>
              <button type="button" onClick={() => setIsAddShippingCompanyOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-1 rounded-lg">
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddShippingCompany} className="p-5 space-y-4 text-start">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'اسم شركة الشحن' : 'Shipping Carrier Name'}</label>
                <input required type="text" value={shippingCompanyFormData.name || ''} onChange={e => setShippingCompanyFormData({ ...shippingCompanyFormData, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" placeholder="e.g Aramex, Safe Ship" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'مسؤول الاتصال' : 'Contact Person'}</label>
                <input type="text" value={shippingCompanyFormData.contact_person || ''} onChange={e => setShippingCompanyFormData({ ...shippingCompanyFormData, contact_person: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'رقم الهاتف/الجوال' : 'Phone No.'}</label>
                <input type="text" value={shippingCompanyFormData.phone || ''} onChange={e => setShippingCompanyFormData({ ...shippingCompanyFormData, phone: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-mono font-bold" placeholder="+967..." />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'بوابة تتبع الشحنات الويب' : 'Tracking Portal Link'}</label>
                <input type="url" value={shippingCompanyFormData.tracking_url || ''} onChange={e => setShippingCompanyFormData({ ...shippingCompanyFormData, tracking_url: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-mono font-bold" placeholder="https://..." />
              </div>
              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button type="button" disabled={isSubmitting} onClick={() => setIsAddShippingCompanyOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg disabled:opacity-50">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={isSubmitting} className="p-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تأكيد الحفظ' : 'Confirm Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {isUpdateModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden text-start shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center text-xs font-black text-white shrink-0">
              <span>{isAr ? 'تحديث المسار والوجهة والوضع اللوجيستي' : 'Freight updates'}</span>
              <button onClick={() => setIsUpdateModalOpen(false)} className="text-slate-400 bg-slate-800 p-1 rounded-lg"><Plus className="w-4 h-4 rotate-45" /></button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-6 space-y-6 text-xs font-bold text-slate-300 overflow-y-auto custom-scrollbar flex-1">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-500 block mb-1">{isAr ? 'رمز الطلب الفريد' : 'Order smart key'}</label>
                    <span className="font-mono text-cyan-400 font-black text-sm">{selectedOrder.orderNumber}</span>
                  </div>

                  <div>
                    <label className="block text-slate-500 block mb-1">{isAr ? 'حالة الطلب اللوجيستية الإجمالية' : 'Logistics status'}</label>
                    <select
                      value={updateFormData.orderStatus}
                      onChange={e => setUpdateFormData({ ...updateFormData, orderStatus: e.target.value })}
                      className={`w-full bg-slate-950 border text-white rounded-xl p-3 outline-none text-xs transition-colors ${
                        (selectedOrder.firedTriggers || []).includes(`status_notified_${updateFormData.orderStatus}`)
                          ? 'border-yellow-500/50 focus:border-yellow-500'
                          : 'border-slate-800'
                      }`}
                    >
                      <option value="تم تسجيل الطلب">{isAr ? 'تم تسجيل الطلب واستخلاص الفاتورة' : 'Invoice saved'}</option>
                      <option value="وصل مستودع السعودية">{isAr ? 'وصل مستودع السعودية للتعبئة' : 'Arrived Saudi packaging HUB'}</option>
                      <option value="جاري الشحن لليمن">{isAr ? 'جاري الشحن لليمن براً / جوأً' : 'Shipped/Transit to Yemen'}</option>
                      <option value="في التخليص الجمركي">{isAr ? 'في التخليص الجمركي والأوراق' : 'Customs clearance'}</option>
                      <option value="وصل مركز التوزيع في اليمن">{isAr ? 'وصل مركز التوزيع والفرز النهائي' : 'Arrived final depot'}</option>
                      <option value="مع المندوب للتوصيل">{isAr ? 'مع المندوب بانتظار التسليم' : 'Out for Yemen delivery'}</option>
                      <option value="تم التسليم">{isAr ? 'تم التسليم وتفصيل العهد الموردة' : 'Delivered successfully'}</option>
                      <option value="ملغي">{isAr ? 'ملغي' : 'Cancelled'}</option>
                    </select>
                    {(selectedOrder.firedTriggers || []).includes(`status_notified_${updateFormData.orderStatus}`) && updateFormData.orderStatus !== 'ملغي' && (
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
                    <label className="block text-slate-500 block mb-1">{isAr ? 'مكان التواجد لليمن' : 'Yemen Spot'}</label>
                    <input
                      type="text"
                      value={updateFormData.locationYemen}
                      onChange={e => setUpdateFormData({ ...updateFormData, locationYemen: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs"
                    />
                  </div>

                  {canManageOrders && (
                    <div>
                      <label className="block text-slate-500 block mb-1">{isAr ? 'ملاحظات وتنبيهات داخلية للموزع' : 'Internal notes'}</label>
                      <textarea
                        rows={2}
                        value={updateFormData.internalNotes}
                        onChange={e => setUpdateFormData({ ...updateFormData, internalNotes: e.target.value })}
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
                    <label className="block text-slate-500 block mb-1">
                      {isAr ? 'موظف التعبئة والتجميع' : 'Packaging & Assembly employee'}
                    </label>
                    <select
                      value={updateFormData.shippingCourierId}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, shippingCourierId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs font-bold"
                    >
                      <option value="">{isAr ? '-- اختر موظف التعبئة والتجميع --' : '-- Choose Aggregator --'}</option>
                      {couriers.filter(c => c.courierType === 'sourcing').map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 block mb-1">
                      {isAr ? 'مندوب التوزيع النهائي' : 'Yemen Delivery Courier'}
                    </label>
                    <select
                      value={updateFormData.deliveryCourierId}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, deliveryCourierId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs font-bold"
                    >
                      <option value="">{isAr ? '-- اختر مندوب التوزيع النهائي --' : '-- Choose Final Courier --'}</option>
                      {couriers.filter(c => c.courierType === 'local' || !c.courierType).map(c => (
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
                      className="bg-emerald-600/10 hover:bg-emerald-650/20 text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                    >
                      ➕ {isAr ? 'إضافة تفاصيل شحن' : 'Add Segment'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {updateShippings && updateShippings.map((sh, idx) => (
                      <div key={sh.id || idx} className="bg-slate-900/40 p-4 rounded-2xl border border-slate-850 space-y-3 relative text-start">
                        {/* Segment title and remove action */}
                        <div className="flex justify-between items-center border-b border-slate-850/50 pb-2">
                          <span className="text-[10px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2 py-0.5 rounded">
                            {isAr ? `مسار الشحن #${idx + 1}` : `Shipping Track #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeUpdateShippingRow(idx)}
                            className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/10 transition-all font-bold text-[10px] flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isAr ? 'إلغاء المسار' : 'Delete Segment'}
                          </button>
                        </div>

                        {/* Manifest inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-start font-bold">
                          {/* 1. Mode */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'نوع الشحن' : 'Mode'}</label>
                            <select
                              value={sh.shippingType || 'بري'}
                              onChange={(e) => updateUpdateShippingRow(idx, 'shippingType', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold"
                            >
                              <option value="بري">{isAr ? 'Overland بري' : 'Land - Overland'}</option>
                              <option value="جوي">{isAr ? 'Air Freight جوي' : 'Air - Air Freight'}</option>
                              <option value="بحري">{isAr ? 'Ocean Cargo بحري' : 'Sea - Ocean Cargo'}</option>
                            </select>
                          </div>

                          {/* 2. Carrier company */}
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
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold"
                            >
                              <option value="">{isAr ? '-- اختر شركة شحن --' : '-- Choose carrier --'}</option>
                              {shippingCompanies.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* 3. Tracking Number */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'رقم التتبع للشحنة' : 'Tracking Number'}</label>
                            <input
                              type="text"
                              value={sh.trackingNumber || ''}
                              onChange={(e) => updateUpdateShippingRow(idx, 'trackingNumber', e.target.value)}
                              placeholder={isAr ? "رقم التتبع المخصص للشحنة" : "Cargo tracking ID"}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono placeholder-slate-650"
                            />
                          </div>

                          {/* 4. Shipping Cost */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'أجرة وتكاليف النقل (ريال سعودي)' : 'Shipping Cost (SAR)'}</label>
                            <input
                              type="number"
                              required
                              value={sh.shippingCost || 0}
                              onChange={(e) => updateUpdateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-950 border border-slate-800 text-[#d4af37] rounded-xl p-2.5 outline-none font-mono"
                            />
                          </div>

                          {/* 5. Origin */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'مكان التصدير' : 'Source'}</label>
                            <input
                              type="text"
                              required
                              value={sh.shippingSource || ''}
                              onChange={(e) => updateUpdateShippingRow(idx, 'shippingSource', e.target.value)}
                              placeholder={isAr ? "مثال: الصين، دبي" : "Source country"}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none placeholder-slate-600"
                            />
                          </div>

                          {/* 6. Destination */}
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'مكان الاستلام' : 'Destination'}</label>
                            <input
                              type="text"
                              required
                              value={sh.shippingDestination || ''}
                              onChange={(e) => updateUpdateShippingRow(idx, 'shippingDestination', e.target.value)}
                              placeholder={isAr ? "مثال: مستودع صنعاء" : "Destination depot"}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none placeholder-slate-600"
                            />
                          </div>

                          {/* 7. Dispatch / Departure Date */}
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

                          {/* 8. Transit Duration */}
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
                                placeholder={isAr ? "مثال: 12 يوم" : "e.g. 12"}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none placeholder-slate-655 font-mono pr-9"
                              />
                              <span className="absolute inset-y-0 end-2.5 flex items-center text-slate-600 text-[10px] font-bold pointer-events-none">
                                {isAr ? 'يوم' : 'd'}
                              </span>
                            </div>
                          </div>

                          {/* 9. Expected Arrival */}
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

                          {/* 10. Packaging Fees (SAR fixed amount) */}
                          <div className="col-span-2">
                            <label className="block text-slate-500 mb-1">{isAr ? 'أجور التغليف والصناديق (SAR)' : 'Packaging Fees (SAR)'}</label>
                            <input
                              type="number"
                              value={sh.packagingFees || 0}
                              onChange={(e) => updateUpdateShippingRow(idx, 'packagingFees', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono"
                            />
                          </div>

                          {/* 11. Delivery Date */}
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
                      <p className="text-center text-slate-550 text-[10px] py-4 bg-slate-950/20 rounded-xl border border-dashed border-slate-850 font-bold">
                        {isAr ? 'لم يتم إضافة تفاصيل شحن للطلب بعد.' : 'No shipping items added yet.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2 shrink-0">
                <button type="button" disabled={isSubmitting} onClick={() => setIsUpdateModalOpen(false)} className="px-5 py-2 hover:bg-slate-800 text-slate-400 rounded-lg disabled:opacity-50">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وترحيل التغييرات' : 'Update settings')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* COLLECT PAYMENT MODAL */}
      {isPaymentModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden text-start shadow-xl">
            <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center text-xs font-black text-white">
              <span>{isAr ? 'تحصيل دفعة مالية وقبض من العميل' : 'Post payment ledger'}</span>
              <button onClick={() => {
                setIsPaymentModalOpen(false);
                setPaymentFormData({ amount: '', method: 'Cash', notes: '', pin: '' });
              }} className="text-slate-400 bg-slate-800 p-1 rounded-lg"><Plus className="w-4 h-4 rotate-45" /></button>
            </div>

            <form onSubmit={handleAddPayment} className="p-6 space-y-4 text-xs font-bold text-slate-300 font-sans">
              <div>
                <label className="block text-slate-500 mb-1">{isAr ? 'رقم الطلب' : 'Smart order code'}</label>
                <span className="font-mono text-[#d4af37] font-black text-sm">{selectedOrder.orderNumber}</span>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{isAr ? 'إجمالي المتبقي للتحصيل' : 'Total dues left'}</label>
                <span className="font-mono text-rose-400 font-extrabold text-base">{parseFloat(selectedOrder.amountRemaining || 0).toLocaleString()} YER</span>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{isAr ? 'المقدار المحصل المقبوض الآن (ريال يمني)' : 'Collection amount in YER'}</label>
                <input
                  required
                  type="number"
                  step="any"
                  value={paymentFormData.amount}
                  onChange={e => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-sm font-black p-3 rounded-xl outline-none text-center"
                  placeholder="0.00 YER"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 text-amber-500 flex items-center gap-1">
                  <span>{isAr ? 'رمز الـ PIN المالي الثنائي للتحقق' : 'Security PIN authorization'}</span>
                  <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1.5 py-0.2 rounded font-sans uppercase">MANDATORY</span>
                </label>
                <input
                  required
                  type="password"
                  maxLength={6}
                  pattern="^[0-9]{4,6}$"
                  title={isAr ? "رمز PIN سري من 4 إلى 6 أرقام" : "A 4-6 digit security PIN code"}
                  value={paymentFormData.pin}
                  onChange={e => setPaymentFormData({ ...paymentFormData, pin: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-yellow-500 font-mono text-sm font-black p-3 rounded-xl outline-none text-center tracking-widest"
                  placeholder="••••"
                />
                <p className="text-[9px] text-slate-500 mt-1">{isAr ? 'اكتب الـ PIN الخاص بك المخزن في ملف الموظف لتفويض المعاملة.' : 'Enter your professional profile PIN to authorize transaction.'}</p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" disabled={isSubmitting} onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPaymentFormData({ amount: '', method: 'Cash', notes: '', pin: '' });
                }} className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg disabled:opacity-50">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (isAr ? 'جاري التحصيل...' : 'Settling...') : (isAr ? 'تأكيد ترحيل القبض' : 'Settle payment')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ORDER DETAILS & QR SCANNER MODAL */}
      {isDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden text-start shadow-xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center text-xs font-black text-white">
              <span>{isAr ? 'تفاصيل الفاتورة وتتبع الشحنة الرقمي' : 'Invoice Details & Tracking Profile'}</span>
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedOrder(null);
                }}
                className="text-slate-400 bg-slate-800 p-1 rounded-lg cursor-pointer hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-350 text-xs custom-scrollbar">

              {/* QR Code and Key Track IDs Section */}
              <div className="bg-slate-955 border border-[#d4af37]/20 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-6">

                {/* QR Code Draw Area */}
                <div className="bg-white p-3 rounded-2xl shadow-lg border-2 border-[#d4af37] flex flex-col items-center justify-center shrink-0">
                  <canvas ref={qrCanvasRef} className="w-[140px] h-[140px]"></canvas>
                  <span className="text-[10px] text-slate-500 font-black tracking-tight mt-1.5 uppercase select-all">
                    {selectedOrder.trackingNumber || selectedOrder.orderNumber || ''}
                  </span>
                </div>

                {/* Key Labels & Action Copier */}
                <div className="flex-1 space-y-2 text-center md:text-start w-full">
                  <span className="text-[9px] text-[#d4af37] bg-[#d4af37]/10 font-black px-2 py-0.5 rounded-full uppercase tracking-widest inline-block">
                    {isAr ? 'رمز تتبع الشحنة الموحد' : 'Logistic Courier Tracking Key'}
                  </span>

                  <h4 className="text-white text-lg font-black tracking-tight select-all">
                    {selectedOrder.trackingNumber || selectedOrder.orderNumber || 'ALX-XXXX-XXXX'}
                  </h4>

                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {isAr
                      ? 'امسح الرمز السريع (QR) أعلاه بواسطة كاميرا الكاشير أو الموزع للوصول اللوجستي وتحديث حالة الطرد بسرعة خاطفة.'
                      : 'Scan the quick QR code with courier scanner terminal to instantly register driver dispatch status.'}
                  </p>

                  <div className="pt-1 flex flex-wrap justify-center md:justify-start gap-2">
                    <CopyToClipboard 
                      text={selectedOrder.trackingNumber || selectedOrder.orderNumber || ''} 
                      showIconOnly={false} 
                      label={isAr ? 'نسخ رمز التتبع الموحد' : 'Copy Tracking ID'}
                      labelCopied={isAr ? 'تم نسخ الرمز!' : 'Copied Tracking ID!'}
                      className="px-4 py-2.5 text-[11px] rounded-xl font-black"
                    />
                  </div>
                </div>

              </div>

              {/* General Order Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-3 bg-slate-950/20 p-4 border border-slate-800/60 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-850 pb-1">
                    {isAr ? 'الزبون والحساب' : 'Customer Account'}
                  </span>
                  <div className="space-y-1">
                    <div className="text-slate-400 font-bold">{isAr ? 'الاسم الائتماني:' : 'Client Name:'} <span className="text-white">{selectedOrder.customerName}</span></div>
                    <div className="text-slate-400 font-bold">{isAr ? 'رقم الهاتف:' : 'Phone Key:'} <span className="text-white font-mono select-all">{selectedOrder.customerPhone}</span></div>
                    {selectedOrder.locationYemen && (
                      <div className="text-slate-400 font-bold">{isAr ? 'أماكن التوصيل لليمن:' : 'Yemen Destination:'} <span className="text-white font-mono">{selectedOrder.locationYemen}</span></div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 bg-slate-950/20 p-4 border border-slate-800/60 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-850 pb-1">
                    {isAr ? 'البيانات اللوجيتسية' : 'Logistics Route'}
                  </span>
                  <div className="space-y-1">
                    <div className="text-slate-400 font-bold">{isAr ? 'حالة الشحنة الطردية:' : 'Cargo Current State:'} <span className="text-[#d4af37] font-black">{formatStatusLabel(selectedOrder.orderStatus)}</span></div>
                    <div className="text-slate-400 font-bold">{isAr ? 'قناة التعبئة والمصدر:' : 'Sales Cargo Source:'} <span className="text-white">{selectedOrder.orderSourceName || selectedOrder.orderSourceType}</span></div>
                    <div className="text-slate-400 font-bold">{isAr ? 'تاريخ المعاملة:' : 'Invoice Date:'} <span className="text-white font-mono">{safeToDate(selectedOrder.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</span></div>
                  </div>
                </div>

              </div>

              {/* Financial Balance Status Card */}
              <div className="bg-slate-955 border border-slate-800 p-4 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-850 pb-1">
                  {isAr ? 'كشف الرصيد وتفاصيل السداد المالي' : 'Financial breakdown'}
                </span>

                {/* Cost Breakdown Details */}
                <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-400 mb-3 border-b border-slate-850 pb-3">
                  <div className="flex justify-between">
                    <span>{isAr ? 'تكلفة المنتجات الأصلية:' : 'Original Products:'}</span>
                    <span className="text-slate-300 font-mono">
                      {(selectedOrder.productsSum !== undefined
                        ? selectedOrder.productsSum
                        : (parseFloat(selectedOrder.totalCostSAR) - parseFloat(selectedOrder.profitCompanySAR || 0) - parseFloat(selectedOrder.shippingCostSAR || 0) - parseFloat(selectedOrder.packagingFee || 0))
                      ).toLocaleString()} SAR
                    </span>
                  </div>
                  {selectedOrder.couponEnabled && (parseFloat(selectedOrder.couponRate) > 0) && (
                    <div className="flex justify-between text-rose-450/90">
                      <span>{isAr ? 'كوبون الخصم للمشتريات (مبلغ):' : 'Purchase Coupon Discount:'}</span>
                      <span className="font-mono">-{parseFloat(selectedOrder.couponRate).toLocaleString()} SAR</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.shippingCostSAR || '0') > 0 && (
                    <div className="flex justify-between">
                      <span>{isAr ? 'تكلفة الشحن والتخليص:' : 'Shipping Cost:'}</span>
                      <span className="text-slate-300 font-mono">{parseFloat(selectedOrder.shippingCostSAR).toLocaleString()} SAR</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.profitCompanySAR || '0') > 0 && (
                    <div className="flex justify-between">
                      <span>{isAr ? 'عمولة التطبيق (أرباح الشركة):' : 'App Commission (Profit):'}</span>
                      <span className="text-slate-300 font-mono">{parseFloat(selectedOrder.profitCompanySAR).toLocaleString()} SAR</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.packagingFee || '0') > 0 && (
                    <div className="flex justify-between">
                      <span>{isAr ? 'رسوم التغليف:' : 'Packaging Fee:'}</span>
                      <span className="text-slate-300 font-mono">{parseFloat(selectedOrder.packagingFee).toLocaleString()} SAR</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.deliveryCourierFee || '0') > 0 && (
                    <div className="flex justify-between text-yellow-400/80">
                      <span>{isAr ? 'أجرة التوصيل الداخلي:' : 'Internal Delivery Wage:'}</span>
                      <span className="font-mono">{parseFloat(selectedOrder.deliveryCourierFee).toLocaleString()} YER</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-slate-955 border border-slate-800 p-2.5 rounded-lg flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-bold">{isAr ? 'إجمالي قيمة الفاتورة' : 'Total Invoice Due'}</span>
                    <span className="font-mono text-white text-xs font-black mt-1">{((parseFloat(selectedOrder.amountPaid) || 0) + (parseFloat(selectedOrder.amountRemaining) || 0)).toLocaleString()} YER</span>
                  </div>
                  <div className="bg-emerald-950/10 border border-emerald-950/20 p-2.5 rounded-lg flex flex-col justify-between">
                    <span className="text-[10px] text-emerald-400 font-bold">{isAr ? 'المقدار المقبوض' : 'Settled Balance'}</span>
                    <span className="font-mono text-emerald-400 text-xs font-black mt-1">{(parseFloat(selectedOrder.amountPaid) || 0).toLocaleString()} YER</span>
                  </div>
                  <div className="bg-rose-950/10 border border-rose-950/20 p-2.5 rounded-lg flex flex-col justify-between">
                    <span className="text-[10px] text-rose-455 font-bold">{isAr ? 'المديونية المتبقية' : 'Remaining Arrears'}</span>
                    <span className="font-mono text-rose-455 text-xs font-black mt-1">{(parseFloat(selectedOrder.amountRemaining) || 0).toLocaleString()} YER</span>
                  </div>
                </div>
              </div>

              {/* Items Table inside current ledger */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block pb-1 border-b border-slate-850">
                    {isAr ? 'تفاصيل المشتريات ومشتملات الطرد' : 'Cargo manifests & items'}
                  </span>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden pr-2">
                    <table className="w-full text-start text-[11px]">
                      <thead className="bg-slate-955 text-slate-500 font-black text-[10px] border-b border-slate-850">
                        <tr>
                          <th className="p-2.5 text-right">{isAr ? 'المنتج' : 'Product'}</th>
                          <th className="p-2.5 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
                          <th className="p-2.5 text-center">{isAr ? 'رابط المنتج' : 'Link'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {selectedOrder.items.map((it: any, index: number) => (
                          <tr key={index}>
                            <td className="p-2.5 text-white font-bold">{it.productName || (isAr ? `طرد رقم ${index + 1}` : `Cargo item ${index + 1}`)}</td>
                            <td className="p-2.5 text-center font-mono text-slate-300 font-bold">{it.quantity || 1}</td>
                            <td className="p-2.5 text-center">
                              {it.productUrl ? (
                                <a href={it.productUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-white underline font-bold">{isAr ? 'الرابط خارجي' : 'External link'}</a>
                              ) : <span className="text-slate-650">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Shipping Details Tracks Timeline */}
              {selectedOrder.shippingDetails && selectedOrder.shippingDetails.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Truck className="w-5 h-5 text-[#d4af37]" />
                    <span className="text-xs font-black text-white uppercase tracking-widest block">
                      {isAr ? 'مسارات الشحن وتفاصيل الترانزيت اللوجستي' : 'Logistics Manifests & Shipping Steps'}
                    </span>
                  </div>

                  <div className="relative border-r-2 border-slate-800 mr-2 md:mr-4 pr-4 md:pr-6 space-y-6 py-2 animate-fade-in text-start">
                    {selectedOrder.shippingDetails.map((sh: any, index: number) => {
                      const isDelivered = !!sh.deliveryDate;
                      const hasSea = sh.shippingType === 'بحري';
                      const hasAir = sh.shippingType === 'جوي';
                      const hasLand = sh.shippingType === 'بري' || !sh.shippingType;

                      let typeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                      let typeIcon = '🚛';
                      let typeLabel = isAr ? 'شحن بري - مقطورات لوجستية' : 'Overland Cargo';
                      if (hasAir) {
                        typeColor = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
                        typeIcon = '✈️';
                        typeLabel = isAr ? 'شحن جوي - كيجو سريع' : 'Air Freight';
                      } else if (hasSea) {
                        typeColor = 'bg-indigo-500/10 text-indigo-400 border border-indigo-505/20';
                        typeIcon = '🚢';
                        typeLabel = isAr ? 'شحن بحري - حاويات اقتصادية' : 'Ocean Cargo';
                      }

                      return (
                        <div key={index} className="relative group">
                          {/* Timeline dot */}
                          <div className={`absolute -right-[23px] md:-right-[35px] top-1.5 w-4 h-4 rounded-full border-4 border-slate-900 z-10 flex items-center justify-center transition-all ${isDelivered ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'
                            }`} />

                          {/* Shipment Glass Card */}
                          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition duration-300 shadow-md">

                            {/* Card Header Type and Delivery status */}
                            <div className="flex justify-between items-center flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-[#d4af37] bg-[#d4af37]/5 px-2.5 py-1 rounded-lg border border-[#d4af37]/20">
                                  {isAr ? `الشحنة #${index + 1}` : `Shipment #${index + 1}`}
                                </span>
                                <span className="text-sm font-black text-slate-200">{sh.shippingCompany}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Shipping Mode Badge */}
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 ${typeColor}`}>
                                  <span>{typeIcon}</span>
                                  <span>{typeLabel}</span>
                                </span>

                                {/* Delivered vs Transit Badge */}
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 ${isDelivered
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-505/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                                  }`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                  <span>{isDelivered ? (isAr ? 'تم التسليم والمطابقة' : 'Delivered & Matched') : (isAr ? 'تحت الترانزيت 🕒' : 'In Transit 🕒')}</span>
                                </span>
                              </div>
                            </div>

                            {/* Beautiful Route Indicator */}
                            <div className="grid grid-cols-7 items-center bg-slate-950/40 p-3 rounded-2xl border border-slate-850/60 text-center">
                              <div className="col-span-3 text-start px-2">
                                <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">{isAr ? 'من (مصدر التصدير)' : 'Origin Point'}</span>
                                <span className="text-white font-extrabold text-sm flex items-center gap-1">
                                  📍 {sh.shippingSource || (isAr ? 'بلد المصدر' : 'Source')}
                                </span>
                              </div>
                              <div className="col-span-1 flex flex-col items-center justify-center">
                                <span className="text-xs font-black text-slate-650">➔</span>
                              </div>
                              <div className="col-span-3 text-start px-2 border-r border-slate-850 pr-4">
                                <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">{isAr ? 'إلى (وجهة الاستقبال)' : 'Destination Point'}</span>
                                <span className="text-[#d4af37] font-extrabold text-sm flex items-center gap-1">
                                  🏁 {sh.shippingDestination || (isAr ? 'البلد المستقبل' : 'Destination')}
                                </span>
                              </div>
                            </div>

                            {/* Dates & Logistics KPIs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/20 p-3.5 rounded-xl text-[11px] border border-slate-850/30">
                              <div>
                                <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'تاريخ انطلاق الشحن' : 'Dispatch Date'}</span>
                                <span className="text-slate-300 font-black font-mono">{sh.shippingDate || '—'}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'المدة المقدرة للنقل' : 'Transit Duration'}</span>
                                <span className="text-slate-300 font-bold bg-slate-800/40 px-2 py-0.5 rounded-md inline-block">{sh.shippingDuration || (isAr ? 'غير محدد' : 'N/A')}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'الوصول المتوقع لليمن' : 'Expected Arrival'}</span>
                                <span className="text-slate-300 font-extrabold">{sh.expectedArrival || '—'}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'تاريخ الاستلام الفعلي' : 'Actual Completion'}</span>
                                <span className={`font-mono font-black ${isDelivered ? 'text-emerald-400 bg-emerald-950/10 px-2.5 py-0.5 rounded-md inline-block' : 'text-slate-500 font-bold'}`}>
                                  {sh.deliveryDate ? sh.deliveryDate : (isAr ? 'قيد الانتظار ⏳' : 'Pending ⏳')}
                                </span>
                              </div>
                            </div>

                            {/* Costs Manifest Breakdown */}
                            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[11px] font-mono flex-wrap gap-2 bg-slate-950/30 -mx-5 -mb-5 p-4 rounded-b-2xl">
                              <div className="flex gap-4">
                                <div className="text-start">
                                  <span className="text-slate-500 font-sans text-[10px] block">{isAr ? 'أجرة النقل:' : 'Freight Cost:'}</span>
                                  <span className="text-white font-extrabold text-xs">
                                    {(parseFloat(sh.shippingCost) || 0).toLocaleString()} <span className="text-[10px] font-normal font-sans">SAR</span>
                                  </span>
                                </div>
                                {sh.packagingFees ? (
                                  <div className="text-start border-r border-slate-800 pr-4">
                                    <span className="text-slate-500 font-sans text-[10px] block">{isAr ? 'أجور التغليف والصناديق:' : 'Packaging Fees:'}</span>
                                    <span className="text-slate-300 font-bold text-xs">
                                      {(parseFloat(sh.packagingFees) || 0).toLocaleString()} <span className="text-[10px] font-normal font-sans">SAR</span>
                                    </span>
                                  </div>
                                ) : null}
                              </div>

                              <div className="text-end bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850">
                                <span className="text-[9px] text-slate-500 font-sans block leading-none mb-1">{isAr ? 'إجمالي تكاليف هذه الشحنة:' : 'Segment Total Fees:'}</span>
                                <span className="text-emerald-400 font-black text-sm">
                                  {((parseFloat(sh.shippingCost) || 0) + (parseFloat(sh.packagingFees) || 0)).toLocaleString()}{' '}
                                  <span className="text-[10px] font-sans">SAR</span>
                                </span>
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Yemen Delivery Summary - computed total: shipping durations + Yemen delivery duration */}
                  {(() => {
                    const totalTransitDays = (selectedOrder.shippingDetails || []).reduce(
                      (sum: number, s: any) => sum + (parseInt(s.shippingDuration) || 0), 0
                    );
                    const yemenDuration = settings.defaultYemenDeliveryDuration ?? 5;
                    const totalExpected = totalTransitDays + yemenDuration;
                    // Find the last dispatch date from shipping details
                    const lastDispatch = (selectedOrder.shippingDetails || []).reduce((latest: string, s: any) => {
                      return s.shippingDate > latest ? s.shippingDate : latest;
                    }, '');
                    let yemenArrivalDate = '';
                    if (lastDispatch) {
                      const d = new Date(lastDispatch);
                      d.setDate(d.getDate() + totalExpected);
                      yemenArrivalDate = d.toISOString().split('T')[0];
                    }
                    return (
                      <div className="p-4 bg-slate-950/60 border border-[#d4af37]/20 rounded-2xl text-[11px] font-bold mt-2">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                          <Truck className="w-4 h-4 text-[#d4af37]" />
                          <span className="text-[10px] text-[#d4af37] font-black uppercase tracking-widest">
                            {isAr ? 'ملخص التسليم النهائي لليمن' : 'Yemen Final Delivery Summary'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <span className="text-[9px] text-slate-500 block mb-1">{isAr ? 'مجموع أيام الشحن:' : 'Total Transit Days:'}</span>
                            <span className="font-mono text-amber-400 font-black">{totalTransitDays} {isAr ? 'يوم' : 'd'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block mb-1">{isAr ? 'مدة التوصيل لليمن (إعدادات):' : 'Yemen Delivery (Settings):'}</span>
                            <span className="font-mono text-blue-400 font-black">{yemenDuration} {isAr ? 'يوم' : 'd'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block mb-1">{isAr ? 'المدة الإجمالية المتوقعة:' : 'Total Expected Duration:'}</span>
                            <span className="font-mono text-emerald-400 font-black text-sm">{totalExpected} {isAr ? 'يوم' : 'days'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block mb-1">{isAr ? 'تاريخ التسليم لليمن المتوقع:' : 'Est. Yemen Arrival:'}</span>
                            <span className="font-mono text-[#d4af37] font-black">{yemenArrivalDate || '—'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}

            </div>

            {/* Footer buttons */}
            <div className="p-4 bg-slate-955 border-t border-slate-850 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => generateOrderInvoicePDF(selectedOrder)}
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black rounded-xl transition font-extrabold flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Printer className="w-4 h-4" />
                {isAr ? '🖨️ إصدار فاتورة للعميل' : 'Print Invoice PDF'}
              </button>
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedOrder(null);
                }}
                className="px-5 py-2.5 bg-slate-850 text-slate-455 hover:text-white rounded-xl transition font-bold text-xs"
              >
                {isAr ? 'إغلاق نافذة التفاصيل' : 'Close Details'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DELETE ORDER SECURITY PIN MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/30 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col">
            <div className="p-4 bg-rose-950/20 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-rose-450 text-sm flex items-center gap-2">
                ⚠️ {isAr ? 'حذف طلب حساس ومحمي' : 'Sensitive Order Deletion'}
              </h3>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setOrderToDelete(null);
                }}
                className="bg-slate-800 text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-bold text-slate-350 text-center">
              <p className="text-slate-400 leading-relaxed text-center">
                {isAr
                  ? 'هذا الطلب يحتوي على مدفوعات مسجلة أو تخطت حالته التثبيت الأولي. يرجى إدخال الرمز السري الشخصي للمدير (System PIN) للمتابعة.'
                  : 'This order has payments recorded or is advanced in the logistics process. Please enter your personal System PIN to confirm deletion.'}
              </p>

              {deleteError && (
                <div className="bg-rose-950/30 text-rose-400 p-2.5 rounded-xl border border-rose-900/30 font-mono text-center">
                  {deleteError}
                </div>
              )}

              <input
                type="password"
                value={deletePin}
                onChange={(e) => {
                  setDeletePin(e.target.value);
                  setDeleteError('');
                }}
                className="block w-full px-4 py-3 bg-black border border-slate-850 rounded-xl text-white outline-none focus:border-rose-500 text-center font-mono text-xl tracking-[0.5em]"
                placeholder="••••••"
                maxLength={10}
                autoFocus
              />
            </div>

            <div className="p-4 bg-slate-950/30 border-t border-slate-850 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setOrderToDelete(null);
                }}
                className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl font-bold hover:text-white transition text-xs cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleVerifyDeletePin}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black transition text-xs cursor-pointer"
              >
                {isAr ? 'تأكيد الحذف النهائي' : 'Verify & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
