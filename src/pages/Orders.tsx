import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, orderBy, query, where, addDoc, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, safeToDate } from '../lib/firebase';
import { useSettings } from '../context/SettingsContext';
import { useRole } from '../hooks/useRole';
import { notificationService } from '../services/notificationService';
import { whatsappService } from '../services/whatsappService';
import ConfirmModal from '../components/ConfirmModal';
import { 
  Plus, Search, Edit2, Truck, Activity, Trash2, DollarSign, 
  CreditCard, Printer, Calculator, Package, MapPin, X, AlertCircle, RefreshCw, UserPlus, Eye
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export default function Orders() {
  const { settings, t } = useSettings();
  const { role, hasPermission, profile, loading: roleLoading } = useRole();
  const isAr = settings.language === 'ar';

  // Core Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    proforma_invoice: '',
    notes: ''
  });

  // Focus Orders States
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
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

  // Multi-item sub table state for creation
  const [items, setItems] = useState<any[]>([
    { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, trackingNumber: '' }
  ]);

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
    notes: ''
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
    address: '',
    notes: ''
  });

  useEffect(() => {
    if (roleLoading) return;

    // Fetch orders synchronized
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

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

  // Handle URL query parameter ?new=true to automatically open Create Order modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setIsAddModalOpen(true);
      // Clean up the URL parameter silently
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

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

  // Auto-generate unified smart code: ALX-YYMM-NNNN
  const generateSmartOrderCode = async () => {
    const now = new Date();
    const YY = String(now.getFullYear()).slice(-2);
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `ALX-${YY}${MM}`;

    try {
      const q = query(
        collection(db, 'orders'),
        where('orderNumber', '>=', prefix),
        where('orderNumber', '<=', prefix + '-\uF8FF')
      );
      const snap = await getDocs(q);
      const curCount = snap.docs.length;
      const nextNum = 1001 + curCount;
      return `${prefix}-${nextNum}`;
    } catch (err) {
      console.warn("Exception getting order count, using random placeholder:", err);
      return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  };

  // Helper calculation values
  const computeCalculations = () => {
    // 1. Compute total products prices
    const productsSum = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.productPrice || 0)), 0);
    const totalWeight = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.weight || 0)), 0);
    const totalCBM = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.cbm || 0)), 0);

    let priceSAR = productsSum;
    let shippingCostSAR = 0;

    if (formData.orderSourceType === 'Factory') {
      // China Factory calculation formula
      // standard weight shipping fee = Weight kilograms * 19 SAR
      const weightCost = totalWeight * 19;
      // cbm standard shipping fee = CBM volume * 1400 SAR (or CBM param rate)
      const cbmCost = totalCBM * 1400; 
      shippingCostSAR = Math.max(weightCost, cbmCost);
    } else {
      // General shopping apps (e.g., Shein, Taobao etc.)
      // Shein red price can override pricing calculations
      if (formData.sheinRedPrice && parseFloat(formData.sheinRedPrice as any) > 0) {
        priceSAR = parseFloat(formData.sheinRedPrice as any);
      }
      // Automatic 12% commission added to order cost
      shippingCostSAR = priceSAR * (formData.companyProfitRate / 100);
    }

    // Taxes (usually 15% or bank commission of 3%)
    const bankCommissionSAR = priceSAR * (formData.bankCommissionRate / 100);
    const totalOrderSAR = priceSAR + shippingCostSAR + bankCommissionSAR + parseFloat(formData.packagingFee || 0);
    
    // Convert to YER for payment
    const exchange = formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER;
    const totalOrderYER = totalOrderSAR * exchange;

    // Remaining
    const valPaid = parseFloat(formData.amountPaid as any) || 0;
    const remainingYER = totalOrderYER - valPaid;

    // Profit split: Saudi partner gets 30%, ALX company gets remaining
    const rawProfitSAR = shippingCostSAR + parseFloat(formData.packagingFee || 0) - (formData.orderSourceType === 'Factory' ? (totalWeight * 10) : 0); // hypothetical expenses
    const profitSaudiSAR = rawProfitSAR * 0.3;
    const profitCompanySAR = rawProfitSAR * 0.7;

    return {
      productsSum,
      totalWeight,
      totalCBM,
      priceSAR,
      shippingCostSAR,
      bankCommissionSAR,
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
    if (!formData.customerId) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'الرجاء اختيار العميل أولاً' : 'Please select a customer first',
        type: 'error'
      });
    }

    setLoading(true);
    try {
      const orderNumber = await generateSmartOrderCode();
      const currentCalcs = computeCalculations();

      const payStatus = currentCalcs.remainingYER <= 0 
        ? 'Paid' 
        : parseFloat(formData.amountPaid as any) > 0 
        ? 'Partial Paid' 
        : 'Unpaid';

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
        companyProfitRate: formData.companyProfitRate,
        packagingFee: parseFloat(formData.packagingFee as any) || 0,
        sheinRedPrice: parseFloat(formData.sheinRedPrice as any) || 0,

        // Calculated values
        totalWeight: currentCalcs.totalWeight,
        totalCBM: currentCalcs.totalCBM,
        totalCostSAR: currentCalcs.totalOrderSAR,
        totalCostYER: currentCalcs.totalOrderYER,
        amountPaid: parseFloat(formData.amountPaid as any) || 0,
        amountRemaining: currentCalcs.remainingYER,
        paymentStatus: payStatus,

        // Profit distribution
        profitSaudiSAR: currentCalcs.profitSaudiSAR,
        profitCompanySAR: currentCalcs.profitCompanySAR,

        // Items nested list
        items,

        // Shipping details nested list
        shippingDetails: shippings || [],

        // Lifecycles status
        orderStatus: 'تم تسجيل الطلب',
        deliveryStatus: 'في الانتظار',
        locationYemen: 'مركز التوزيع الرئيسي',
        
        createdByEmail: auth.currentUser?.email || 'admin',
        createdByName: profile?.fullName || 'Root Admin',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await addDoc(collection(db, 'orders'), payload);

      // Trigger automatic receipt alerts/notifications
      await notificationService.notify({
        title: isAr ? 'نجاح التسجيل الفاتورة' : 'Registered Successfully',
        message: isAr ? `تم تسجيل الفاتورة برقم موحد: ${orderNumber}` : `Saved order with code: ${orderNumber}`,
        type: 'success'
      });

      // Automatically dispatch real WhatsApp message based on active templates and config
      try {
        await whatsappService.triggerNotification('onOrderCreated', payload);
      } catch (whatsappErr) {
        console.error('Failed to trigger real WhatsApp on order creation:', whatsappErr);
      }

      // Automatically dispatch simulated API dispatch status for WhatsApp + SMS in logs/panel
      const remainingVal = parseFloat(String(payload.amountRemaining || '0'));
      const totalCostYERVal = parseFloat(String(payload.totalCostYER || '0'));
      const smsMessage = isAr 
        ? `عزيزنا العميل ${payload.customerName}، تم تأكيد طلبك رقم: (${orderNumber}) بنجاح. حالة الشحنة: (${payload.orderStatus}). تتبع مع: ${payload.shippingCompany}، تتبع رقم: ${payload.trackingNumber || 'قيد الرفع'}. القيمة الإجمالية: ${totalCostYERVal.toLocaleString()} YER، المتبقي: ${remainingVal.toLocaleString()} YER.`
        : `Dear ${payload.customerName}, your order ${orderNumber} has been confirmed. Status: ${payload.orderStatus}. Track with ${payload.shippingCompany}: ${payload.trackingNumber || 'Pending'}. Total: ${totalCostYERVal.toLocaleString()} YER, Remaining: ${remainingVal.toLocaleString()} YER.`;

      await notificationService.notify({
        title: isAr ? '📲 إرسال تلقائي (WhatsApp + SMS)' : '📲 Automatic WhatsApp / SMS Dispatcher',
        message: smsMessage,
        type: 'success',
        orderId: orderNumber
      });

      setIsAddModalOpen(false);
      resetCreateForm();
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: 'Error',
        message: 'Could not create order document due to a write blocker.',
        type: 'error'
      });
    } finally {
      setLoading(false);
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
      deliveryCourierFee: 4000,
      currency: 'SAR',
      exchangeRateYER: 390,
      exchangeRateUSD: 535,
      bankCommissionRate: 3,
      companyProfitRate: 12,
      packagingFee: 0,
      sheinRedPrice: 0,
      amountPaid: 0,
      paymentMethod: 'Cash',
      notes: ''
    });
    setItems([{ productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, trackingNumber: '' }]);
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

  // Nested quick-add customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerFormData.fullName || !customerFormData.phone) return;

    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        fullName: customerFormData.fullName,
        phone: customerFormData.phone,
        address: customerFormData.address,
        notes: customerFormData.notes,
        createdAt: Date.now()
      });

      // Autofollow selected
      setFormData(prev => ({
        ...prev,
        customerId: docRef.id,
        customerName: customerFormData.fullName,
        customerPhone: customerFormData.phone,
        customerAddress: customerFormData.address
      }));

      setIsAddCustomerOpen(false);
      setCustomerFormData({ fullName: '', phone: '', address: '', notes: '' });

      notificationService.notify({
        title: isAr ? 'تمت الإضافة' : 'Client Created',
        message: isAr ? 'تم تسجيل الزبون وتحميل ملفه في الفاتورة' : 'Customer created and attached',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Nested quick-add purchase source
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceFormData.source_name) return;

    try {
      const docRef = await addDoc(collection(db, 'sources'), {
        name: sourceFormData.source_name,
        source_name: sourceFormData.source_name,
        type: sourceFormData.type,
        source_url: sourceFormData.source_url,
        contact_info: sourceFormData.contact_info,
        location: sourceFormData.location,
        proforma_invoice: sourceFormData.proforma_invoice,
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
        proforma_invoice: '',
        notes: ''
      });

      notificationService.notify({
        title: isAr ? 'تمت إضافة مصدر الشراء' : 'Source Created',
        message: isAr ? 'تم تسجيل مصدر الشراء وتحديده تلقائياً' : 'Purchase source registered and selected',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'فشل إضافة مصدر الشراء' : 'Failed to register source',
        type: 'error'
      });
    }
  };

  // Nested quick-add shipping company
  const handleAddShippingCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingCompanyFormData.name) return;

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
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'فشل إضافة شركة الشحن' : 'Failed to register carrier',
        type: 'error'
      });
    }
  };

  // Add payments to unpaid order
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const paidVal = parseFloat(paymentFormData.amount) || 0;
    if (paidVal <= 0) return;

    // MANDATORY FINANCIAL SECURITY PIN VERIFICATION (Section 12 of system documentation)
    const systemPin = profile?.systemPin || '000000';
    if (!paymentFormData.pin || paymentFormData.pin.trim() !== systemPin.trim()) {
      notificationService.notify({
        title: isAr ? 'خطأ في المصادقة والـ PIN السري' : 'Verification Denied',
        message: isAr ? 'رمز الـ PIN المالي للموظف غير صحيح! فشل ترحيل وقبض السند المالي.' : 'Employee security PIN is incorrect! Settle payment rejected.',
        type: 'error'
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

      // Insert transaction history in notifications or payments
      notificationService.notify({
        title: isAr ? 'تم الدفع بنجاح' : 'Payment Recorded',
        message: isAr ? `تم تحصيل مبلغ ${paidVal.toLocaleString()} ريال ومزامنته للعميل` : `Added payment of ${paidVal}`,
        type: 'success'
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
    }
  };

  // Update logistics status
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        orderStatus: updateFormData.orderStatus,
        deliveryStatus: updateFormData.deliveryStatus,
        locationYemen: updateFormData.locationYemen,
        internalNotes: updateFormData.internalNotes,
        shippingCourierId: updateFormData.shippingCourierId || '',
        deliveryCourierId: updateFormData.deliveryCourierId || '',
        shippingDetails: updateShippings || [],
        updatedAt: Date.now()
      });

      await notificationService.notify({
        title: isAr ? 'حالة التحديث' : 'Status Updated',
        message: isAr ? 'تم تحديث البيانات اللوجيستية للشحنة وترحيلها' : 'Logistic parameters recorded',
        type: 'info'
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
      const remainingVal = parseFloat(selectedOrder.amountRemaining || '0');
      const smsMessage = isAr 
        ? `عزيزنا العميل ${selectedOrder.customerName}، تم تحديث حالة شحنتك رقم: (${selectedOrder.orderNumber || selectedOrder.id}) إلى: *${updateFormData.orderStatus}*. وموقع الشحنة حالياً: *${updateFormData.locationYemen || 'قيد النقل'}*. المتبقي عليك: ${remainingVal.toLocaleString()} YER. شكراً لتعاملك معنا.`
        : `Dear ${selectedOrder.customerName}, the status of your order (${selectedOrder.orderNumber || selectedOrder.id}) update to: *${updateFormData.orderStatus}*. Current position: *${updateFormData.locationYemen || 'In-transit'}*. Bal: ${remainingVal.toLocaleString()} YER. Thank you for choosing us!`;

      await notificationService.notify({
        title: isAr ? '📲 تحديث تلقائي (WhatsApp + SMS)' : '📲 Auto Status WhatsApp / SMS Sent',
        message: smsMessage,
        type: 'success',
        orderId: selectedOrder.orderNumber || selectedOrder.id
      });

      setIsUpdateModalOpen(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Items handling
  const addItemRow = () => {
    setItems([...items, { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, trackingNumber: '' }]);
  };

  const updateItemRow = (idx: number, field: string, val: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    setItems(updated);
  };

  const removeItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  // Shipping details handling
  const addShippingRow = () => {
    setShippings([...shippings, {
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
    }]);
  };

  const updateShippingRow = (idx: number, field: string, val: any) => {
    const updated = [...shippings];
    updated[idx] = { ...updated[idx], [field]: val };
    setShippings(updated);
  };

  const removeShippingRow = (idx: number) => {
    if (shippings.length === 1) {
      setShippings([]);
      return;
    }
    setShippings(shippings.filter((_, i) => i !== idx));
  };

  const addUpdateShippingRow = () => {
    setUpdateShippings([...updateShippings, {
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
    }]);
  };

  const updateUpdateShippingRow = (idx: number, field: string, val: any) => {
    const updated = [...updateShippings];
    updated[idx] = { ...updated[idx], [field]: val };
    setUpdateShippings(updated);
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
      type: 'success'
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
      const promises = selectedOrderIds.map(orderId => {
        const defaultLocation = newStatus === 'وصل مستودع السعودية' ? 'مستودع السعودية للتعبئة' : 
                                newStatus === 'وصل مركز التوزيع في اليمن' ? 'مستودع صنعاء الرئيسي' : 'قيد النقل';
        return updateDoc(doc(db, 'orders', orderId), {
          orderStatus: newStatus,
          locationYemen: defaultLocation,
          updatedAt: Date.now()
        });
      });
      await Promise.all(promises);
      
      // Dispatch real WhatsApp notifications for each order status change in the batch
      try {
        selectedOrderIds.forEach(async (orderId) => {
          const fullOrder = orders.find(o => o.id === orderId);
          if (fullOrder) {
            const defaultLocation = newStatus === 'وصل مستودع السعودية' ? 'مستودع السعودية للتعبئة' : 
                                    newStatus === 'وصل مركز التوزيع في اليمن' ? 'مستودع صنعاء الرئيسي' : 'قيد النقل';
            const updatedOrderObj = {
              ...fullOrder,
              orderStatus: newStatus,
              locationYemen: defaultLocation
            };
            await whatsappService.triggerNotification('onOrderStatusChanged', updatedOrderObj);
          }
        });
      } catch (whatsappErr) {
        console.error('Failed to dispatch batch WhatsApp notifications:', whatsappErr);
      }

      notificationService.notify({
        title: isAr ? 'تم التحديث بنجاح' : 'Batch Status Updated',
        message: isAr 
          ? `تم تغيير حالة عدد ${selectedOrderIds.length} شحنات إلى: [ ${newStatus} ]` 
          : `Updated status of ${selectedOrderIds.length} orders to: [ ${newStatus} ]`,
        type: 'success'
      });
      setSelectedOrderIds([]);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في التحديث' : 'Batch Update Error',
        message: err.message || 'Error executing batch action',
        type: 'error'
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
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Top banner block (luxury charcoal gray)
    doc.setFillColor(15, 15, 18);
    doc.rect(0, 0, 210, 36, 'F');
    
    // Gold separator strip
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 36, 210, 2, 'F');
    
    // Header texts
    doc.setTextColor(212, 175, 55);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('AL-XPRESS LOGISTICS LEDGER', 15, 16);
    
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.text('SMART FREIGHT TRACKING & FINANCIAL LEDGERS', 15, 23);
    
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(7);
    doc.text(`Generated: ${new Date().toLocaleString()} | User: ${profile?.fullName || profile?.email || 'Administrator'}`, 15, 29);
    
    // Quick statistics summary block
    doc.setFillColor(245, 245, 247);
    doc.roundedRect(12, 44, 186, 22, 3, 3, 'F');
    
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text('TOTAL DECLARED REVENUE', 20, 51);
    doc.text('TOTAL LOAD COUNT', 85, 51);
    doc.text('PENDING CASH BALANCE', 140, 51);
    
    // Calculate metrics
    const totalRevenue = filteredOrdersList.reduce((sum, o) => sum + parseFloat(o.totalCostYER || 0), 0);
    const pendingBalance = filteredOrdersList.reduce((sum, o) => sum + parseFloat(o.amountRemaining || 0), 0);
    
    doc.setFontSize(11);
    doc.setTextColor(15, 15, 18);
    doc.text(`${totalRevenue.toLocaleString()} YER`, 20, 59);
    doc.text(`${filteredOrdersList.length} Orders`, 85, 59);
    doc.text(`${pendingBalance.toLocaleString()} YER`, 140, 59);
    
    // Headers of main data grid
    doc.setFillColor(24, 24, 27);
    doc.rect(12, 72, 186, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.text('SMART ID', 15, 77);
    doc.text('CUSTOMER / ACCOUNT', 48, 77);
    doc.text('ROUTE STATUS', 105, 77);
    doc.text('COST (YER)', 150, 77);
    doc.text('BAL (YER)', 175, 77);
    
    let yIdx = 87;
    // Walk through sorted & filtered list
    filteredOrdersList.forEach((ord, index) => {
      // PDF line limit per page
      if (yIdx > 275) {
        doc.addPage();
        
        // Dynamic continued header
        doc.setFillColor(15, 15, 18);
        doc.rect(0, 0, 210, 18, 'F');
        doc.setFillColor(212, 175, 55);
        doc.rect(0, 18, 210, 1.5, 'F');
        doc.setTextColor(212, 175, 55);
        doc.setFontSize(10);
        doc.setFont('Helvetica', 'bold');
        doc.text('AL-XPRESS LOGISTICS LEDGER (CONTINUED)', 15, 11);
        
        doc.setFillColor(24, 24, 27);
        doc.rect(12, 24, 186, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('SMART ID', 15, 29);
        doc.text('CUSTOMER / ACCOUNT', 48, 29);
        doc.text('ROUTE STATUS', 105, 29);
        doc.text('COST (YER)', 150, 29);
        doc.text('BAL (YER)', 175, 29);
        
        yIdx = 39;
      }
      
      // Zebra alternate background striping
      if (index % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(12, yIdx - 4.5, 186, 8, 'F');
      }
      
      doc.setTextColor(40, 40, 43);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      
      // Order Smart ID
      doc.setFont('Helvetica', 'bold');
      doc.text(ord.orderNumber || 'ALX-PENDING', 15, yIdx);
      doc.setFont('Helvetica', 'normal');
      
      // Customer Account transliterated nicely
      const customerText = transliterateArabic(ord.customerName || 'Walk-In Customer');
      doc.text(customerText.length > 28 ? `${customerText.substring(0, 26)}...` : customerText, 48, yIdx);
      
      // Status
      const statusLabel = ord.orderStatus || 'Pending';
      const transliteratedStatus = transliterateArabic(statusLabel);
      doc.text(transliteratedStatus, 105, yIdx);
      
      // Total Cost
      const costRaw = parseFloat(ord.totalCostYER || 0);
      doc.text(costRaw.toLocaleString(), 150, yIdx);
      
      // Remaining Bal
      const balRaw = parseFloat(ord.amountRemaining || 0);
      if (balRaw > 0) {
        doc.setTextColor(190, 40, 40);
        doc.setFont('Helvetica', 'bold');
        doc.text(balRaw.toLocaleString(), 175, yIdx);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(40, 40, 43);
      } else {
        doc.setTextColor(16, 124, 65);
        doc.text('PAID', 175, yIdx);
        doc.setTextColor(40, 40, 43);
      }
      
      // Grid bottom indicator divider
      doc.setDrawColor(235, 235, 240);
      doc.setLineWidth(0.15);
      doc.line(12, yIdx + 3.5, 198, yIdx + 3.5);
      
      yIdx += 8.5;
    });
    
    // Page footer indicator block
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(6.5);
    doc.setFont('Helvetica', 'normal');
    doc.text('System generated administrative logistics report. Confidential document designed for Al-Xpress Corp ledger.', 15, 288);
    doc.text(`Doc Ref: ALX-${new Date().getFullYear()}/LEDG`, 175, 288);
    
    doc.save(`AlXpress_Orders_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
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
        o.totalCostYER || 0,
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
  };

  const filteredOrdersList = orders
    .filter(o => {
      const num = (o.orderNumber || '').toUpperCase();
      const customer = (o.customerName || '').toLowerCase();
      const phone = (o.customerPhone || '');
      const track = (o.trackingNumber || '').toUpperCase();
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
      if (sortBy === 'amount-desc') return (b.totalCostYER || 0) - (a.totalCostYER || 0);
      return 0;
    });

  if (loading || roleLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 font-bold">
        {isAr ? 'جاري تحميل الدفتر اللوجيستي والمحاسبي...' : 'Loading logistic ledger...'}
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
          <button 
            onClick={exportOrdersToPDF}
            className="bg-slate-950 hover:bg-slate-900 border border-[#d4af37]/25 text-[#d4af37] px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" /> {isAr ? 'طباعة تقرير PDF' : 'PDF Report'}
          </button>
          
          <button 
            onClick={exportOrdersToCSV}
            className="bg-slate-950 hover:bg-slate-905 border border-emerald-900 text-emerald-400 px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
          >
            <Activity className="w-4 h-4" /> {isAr ? 'تصدير CSV' : 'Export CSV'}
          </button>

          <button 
            onClick={() => {
              resetCreateForm();
              setIsAddModalOpen(true);
            }}
            className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {isAr ? 'فاتورة جديدة' : 'New Invoice'}
          </button>
        </div>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: isAr ? 'الطلبات النشطة اليوم' : 'Active Orders Today', val: orders.filter(o => o.orderStatus !== 'تم التسليم' && o.orderStatus !== 'ملغي').length, color: 'text-[#d4af37] bg-[#d4af37]/10' },
          { title: isAr ? 'بانتظار التوزيع لليمن' : 'In Local Dist', val: orders.filter(o => o.orderStatus === 'وصل مركز التوزيع في اليمن').length, color: 'text-amber-400 bg-amber-950/20' },
          { title: isAr ? 'شحنات سلمت بنجاح' : 'Delivered Ledger', val: orders.filter(o => o.orderStatus === 'تم التسليم').length, color: 'text-emerald-400 bg-emerald-950/20' },
          { title: isAr ? 'مبالغ معلقة للتحصيل' : 'Remaining To Collect', val: orders.reduce((sum, o) => sum + (parseFloat(o.amountRemaining || '0')), 0).toLocaleString() + ' YER', color: 'text-rose-400 bg-rose-950/20' }
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
        <div className="overflow-x-auto">
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
              {filteredOrdersList.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-955 transition-all">
                  
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
                      <span className="font-bold text-white text-xs">{ord.customerName}</span>
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
                    <div className="flex flex-col space-y-0.5">
                      <div className="font-mono text-slate-200 font-semibold">
                        {isAr ? 'الإجمالي: ' : 'Total: '}{parseFloat(ord.totalCostYER || 0).toLocaleString()} <span className="text-[10px] text-slate-500">YER</span>
                      </div>
                      <div className="font-mono text-emerald-400 text-[11px]">
                        {isAr ? 'المدفوع: ' : 'Paid: '}{parseFloat(ord.amountPaid || 0).toLocaleString()} YER
                      </div>
                      {parseFloat(ord.amountRemaining || 0) > 0 ? (
                        <div className="font-mono text-rose-450 text-[11px] font-bold">
                          {isAr ? 'المتبقي: ' : 'Remaining: '}{parseFloat(ord.amountRemaining).toLocaleString()} YER
                        </div>
                      ) : (
                        <span className="text-[9px] bg-emerald-950/20 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded font-black max-w-max uppercase tracking-tighter mt-0.5">{isAr ? 'مسدد بالكامل' : 'Paid in Full'}</span>
                      )}
                    </div>
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

                    {/* Payment handler */}
                    {parseFloat(ord.amountRemaining || 0) > 0 && (
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

                    {/* Status updates */}
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
                        setUpdateShippings(ord.shippingDetails || []);
                        setIsUpdateModalOpen(true);
                      }}
                      className="bg-slate-805 text-slate-305 hover:text-white px-2.5 py-1.5 rounded-lg transition-all text-[10px] flex items-center gap-1 font-bold border border-slate-750 cursor-pointer"
                      title={isAr ? 'تعديل المسار والتوجيه اللوجيستي' : 'Update state'}
                    >
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      {isAr ? 'اللوجستيات' : 'Update'}
                    </button>

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

          <button 
            id="batch-deselect-btn"
            onClick={() => setSelectedOrderIds([])}
            disabled={isBatchUpdating}
            className="text-xs text-rose-400 hover:text-rose-300 font-black cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-rose-950/20 active:scale-95 transition"
          >
            {isAr ? 'إلغاء التحديد الكلي' : 'Deselect All'}
          </button>
        </div>
      )}

      {/* CREATE ORDER LARGE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl my-8 overflow-hidden shadow-[0_0_50px_rgba(8,145,178,0.15)] flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-white text-base">
                {isAr ? 'إنشاء فاتورة بوصل شحنة ومسار مالي' : 'Create Freight Invoice'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-start">
              
              {/* Debt Alerts */}
              {customerUnpaidAlert !== null && (
                <div className="p-4 bg-red-950/40 border-2 border-red-900 text-red-400 rounded-2xl flex items-center gap-3 animate-pulse">
                  <AlertCircle className="w-6 h-6 shrink-0 text-red-500" />
                  <span className="font-black text-xs leading-relaxed">
                    {isAr 
                      ? `⚠️ تنبيه ديون معلقة: يوجد للعميل الحالي ديون غير محصلة ومستحقة بذمته بإجمالي: [ ${customerUnpaidAlert.toLocaleString()} ريال يمني ].`
                      : `⚠️ Outstanding Balances Warning: This client has outstanding pending balances totalling [ YER ${customerUnpaidAlert.toLocaleString()} ].`}
                  </span>
                </div>
              )}

              {/* Sub grid details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Customer Section */}
                <div className="space-y-4 bg-slate-950/20 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400">{isAr ? 'العميل المستلم' : 'Receiver Customer'}</label>
                    <button 
                      type="button"
                      onClick={() => setIsAddCustomerOpen(true)}
                      className="text-xs font-black text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {isAr ? 'إضافة عميل جديد ➕' : 'Quick add customer'}
                    </button>
                  </div>
                  <select
                    required
                    value={formData.customerId}
                    onChange={(e) => setFormData({...formData, customerId: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                  >
                    <option value="">{isAr ? '-- اختر العميل من هنا --' : '-- Choose Customer --'}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.fullName} ({c.phone})</option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-400 font-bold">
                    <div>{isAr ? 'الجوال: ' : 'Phone: '} <span className="font-mono text-slate-200">{formData.customerPhone || '—'}</span></div>
                    <div>{isAr ? 'العنوان: ' : 'Address: '} <span className="text-slate-200">{formData.customerAddress || '—'}</span></div>
                  </div>
                </div>

                 {/* 2. Source and Logistics */}
                 <div className="space-y-4 bg-slate-950/20 border border-slate-800 p-5 rounded-2xl">
                   <span className="block text-xs font-black text-slate-400">{isAr ? 'مصدر ونوع الطلب' : 'Order Source type'}</span>
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <div className="flex justify-between items-center mb-1.5 flex-row-reverse">
                         <button
                           type="button"
                           onClick={() => setIsAddSourceOpen(true)}
                           className="text-[10px] font-black text-cyan-400 hover:underline flex items-center gap-0.5"
                         >
                           ➕ {isAr ? 'جديد' : 'New'}
                         </button>
                         <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider text-start">
                           {isAr ? 'مصدر الشراء' : 'Order Source'}
                         </label>
                       </div>
                       <select
                         required
                         value={formData.orderSourceId}
                         onChange={(e) => setFormData({...formData, orderSourceId: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                       >
                         <option value="">{isAr ? '-- اختر المصدر --' : '-- Choose Source --'}</option>
                         {sources.map(s => (
                           <option key={s.id} value={s.id}>{s.name || s.source_name} {s.type ? `(${s.type})` : ''}</option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                         {isAr ? 'رقم الفاتورة الأصلي' : 'Orig. Invoice Ref'}
                       </label>
                       <input 
                         type="text"
                         value={formData.externalOrderNumber}
                         onChange={(e) => setFormData({...formData, externalOrderNumber: e.target.value})}
                         placeholder={isAr ? "رقم الفاتورة الأصلي (سلة...)" : "Invoice reference ID"}
                         className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                       />
                     </div>
                   </div>

                   <div>
                     <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                       {isAr ? 'رقم التتبع الدولي' : 'Global Tracking Code'}
                     </label>
                     <input 
                       type="text"
                       value={formData.trackingNumber}
                       onChange={(e) => setFormData({...formData, trackingNumber: e.target.value})}
                       placeholder={isAr ? "رقم التتبع الدولي (DHL...)" : "Global Tracking ID"}
                       className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                     />
                   </div>
                 </div>

              </div>

              {/* Items Section */}
              <div className="space-y-3 bg-slate-950/10 border border-slate-850 p-5 rounded-2xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-white">{isAr ? 'محتويات الشحنة والمنتجات التفصيلية' : 'Freight Cargo contents'}</span>
                  <button 
                    type="button"
                    onClick={addItemRow}
                    className="bg-cyan-600/10 hover:bg-cyan-650/20 text-cyan-400 px-3 py-1 rounded-lg text-[10px] font-black transition-all"
                  >
                    ➕ {isAr ? 'إدراج بند منتج' : 'Add Item'}
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end border-b border-slate-850 pb-3 md:pb-0 md:border-none p-2.5 bg-slate-950/20 rounded-xl">
                      
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                          {isAr ? 'اسم المنتج أو الرابط' : 'Item Name / Link'}
                        </label>
                        <input 
                          required
                          type="text"
                          value={item.productName || ''}
                          onChange={(e) => updateItemRow(idx, 'productName', e.target.value)}
                          placeholder={isAr ? "اسم المنتج أو الرابط..." : "Item specifications"}
                          className="w-full bg-slate-950 border border-slate-815 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] text-start"
                        />
                      </div>
 
                      <div className="grid grid-cols-3 gap-2 md:col-span-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-center">
                            {isAr ? 'السعر (SAR)' : 'Price'}
                          </label>
                          <input 
                            required
                            type="number"
                            value={item.productPrice || 0}
                            onChange={(e) => updateItemRow(idx, 'productPrice', parseFloat(e.target.value) || 0)}
                            placeholder={isAr ? "السعر" : "Price"}
                            className="w-full bg-slate-950 border border-slate-815 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-center">
                            {isAr ? 'الكمية' : 'Qty'}
                          </label>
                          <input 
                            required
                            type="number"
                            value={item.quantity || 1}
                            onChange={(e) => updateItemRow(idx, 'quantity', parseInt(e.target.value) || 0)}
                            placeholder={isAr ? "الكمية" : "Qty"}
                            className="w-full bg-slate-950 border border-slate-815 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-center">
                            {isAr ? 'الوزن (KG)' : 'KG'}
                          </label>
                          <input 
                            type="number"
                            step="any"
                            value={item.weight || 0}
                            onChange={(e) => updateItemRow(idx, 'weight', parseFloat(e.target.value) || 0)}
                            placeholder={isAr ? "الوزن (KG)" : "KG"}
                            disabled={formData.orderSourceType !== 'Factory'}
                            className="w-full bg-slate-950 border border-slate-815 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center disabled:opacity-50"
                          />
                        </div>
                      </div>
 
                      <div className="flex justify-between md:justify-end items-end col-span-1 gap-2 pb-0.5">
                        {formData.orderSourceType === 'Factory' ? (
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-center">
                              CBM
                            </label>
                            <input 
                              type="number"
                              step="any"
                              value={item.cbm || 0}
                              onChange={(e) => updateItemRow(idx, 'cbm', parseFloat(e.target.value) || 0)}
                              placeholder="CBM"
                              className="w-16 bg-slate-950 border border-slate-815 text-white rounded-xl p-2 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                        ) : <div className="w-16"></div>}
                        <button 
                          type="button" 
                          onClick={() => removeItemRow(idx)}
                          className="text-rose-500 hover:text-white hover:bg-rose-600 p-2.5 rounded-xl transition-all mb-[1px]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Details Section */}
              <div className="space-y-4 bg-slate-950/10 border border-slate-850 p-5 rounded-2xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <div className="flex flex-col text-start">
                    <span className="text-xs font-black text-white">{isAr ? 'تفاصيل شحنات المسار اللوجيستي' : 'Shipping Tracks & Manifests'}</span>
                    <span className="text-[10px] text-slate-500 font-bold mt-0.5">{isAr ? 'يمكنك إدراج أكثر من مسار شحن للطلب الواحد' : 'Add multiple independent cargo shipments for this order'}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={addShippingRow}
                    className="bg-emerald-600/10 hover:bg-emerald-650/20 text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                  >
                    ➕ {isAr ? 'إضافة تفاصيل شحن' : 'Add Shipment Section'}
                  </button>
                </div>

                <div className="space-y-4">
                  {shippings && shippings.map((sh, idx) => (
                    <div key={sh.id || idx} className="bg-slate-950/25 p-4 rounded-xl border border-slate-850 space-y-3 relative">
                      {/* Sub-header / title */}
                      <div className="flex justify-between items-center border-b border-slate-850/60 pb-2">
                        <span className="text-[11px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2 py-0.5 rounded">
                          {isAr ? `الشحنة #${idx + 1}` : `Shipment #${idx + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeShippingRow(idx)}
                          className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/10 transition-all font-bold text-[10px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isAr ? 'حذف هذه الشحنة' : 'Remove Segment'}
                        </button>
                      </div>

                      {/* Input fields grid */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]">
                        {/* 1. Shipping Type */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'نوع مسار الشحن (بري/جوي/بحري)' : 'Transit Mode (Land/Air/Sea)'}</label>
                          <select
                            value={sh.shippingType || 'بري'}
                            onChange={(e) => updateShippingRow(idx, 'shippingType', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold"
                          >
                            <option value="بري">{isAr ? 'بري - Overland Cargo' : 'Land - Overland Cargo'}</option>
                            <option value="جوي">{isAr ? 'جوي - Air Freight' : 'Air - Air Freight'}</option>
                            <option value="بحري">{isAr ? 'بحري - Ocean Cargo' : 'Sea - Ocean Cargo'}</option>
                          </select>
                        </div>

                        {/* 2. Shipping Company */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-slate-400">{isAr ? 'اسم الناقل / شركة الشحن' : 'Carrier/Shipping Company'}</label>
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

                        {/* 3. Shipping Source */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'مصدر الشحن (بلد التصدير)' : 'Shipment Source (Country)'}</label>
                          <input
                            type="text"
                            required
                            value={sh.shippingSource || ''}
                            onChange={(e) => updateShippingRow(idx, 'shippingSource', e.target.value)}
                            placeholder={isAr ? "مثال: الصين، دبي، الرياض" : "e.g. China, Dubai"}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold placeholder-slate-600"
                          />
                        </div>

                        {/* 4. Shipping Destination */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'وجهة الشحن (مكان الاستقبال)' : 'Shipment Destination'}</label>
                          <input
                            type="text"
                            required
                            value={sh.shippingDestination || ''}
                            onChange={(e) => updateShippingRow(idx, 'shippingDestination', e.target.value)}
                            placeholder={isAr ? "مثال: صنعاء، عدن، تعز" : "e.g. Sana'a, Aden"}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold placeholder-slate-600"
                          />
                        </div>

                        {/* 5. Shipping Date */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'تاريخ تسليم الشحنة للناقل' : 'Shipping Handover Date'}</label>
                          <input
                            type="date"
                            value={sh.shippingDate || ''}
                            onChange={(e) => updateShippingRow(idx, 'shippingDate', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans font-bold"
                          />
                        </div>

                        {/* 6. Shipping Duration */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'المدة التقديرية (أيام/أسابيع)' : 'Transit Duration (Estimated)'}</label>
                          <input
                            type="text"
                            value={sh.shippingDuration || ''}
                            onChange={(e) => updateShippingRow(idx, 'shippingDuration', e.target.value)}
                            placeholder={isAr ? "مثال: 10-15 يوم" : "e.g. 10-15 days"}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold placeholder-slate-600"
                          />
                        </div>

                        {/* 7. Expected Arrival */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'موعد التوصيل المتوقع لليمن' : 'Expected Arrival Date'}</label>
                          <input
                            type="text"
                            value={sh.expectedArrival || ''}
                            onChange={(e) => updateShippingRow(idx, 'expectedArrival', e.target.value)}
                            placeholder={isAr ? "مثال: نهاية الشهر، 30 مايو" : "e.g. end of May"}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold placeholder-slate-600"
                          />
                        </div>

                        {/* 8. Delivery Date */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'تاريخ التسليم الفعلي المكتمل' : 'Actual Completed Delivery Date'}</label>
                          <input
                            type="date"
                            value={sh.deliveryDate || ''}
                            onChange={(e) => updateShippingRow(idx, 'deliveryDate', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans font-bold"
                          />
                        </div>

                        {/* 9. Shipping Cost */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'أجرة وتكاليف النقل (ريال سعودي)' : 'Shipping Cargo Cost (SAR)'}</label>
                          <input
                            type="number"
                            required
                            value={sh.shippingCost || ''}
                            onChange={(e) => updateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono font-bold"
                          />
                        </div>

                        {/* 10. Packaging Fees */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'أجور التغليف والصناديق (ريال سعودي)' : 'Packaging Fees (SAR)'}</label>
                          <input
                            type="number"
                            value={sh.packagingFees || ''}
                            onChange={(e) => updateShippingRow(idx, 'packagingFees', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {shippings.length === 0 && (
                    <p className="text-center text-slate-550 text-[10px] py-4 bg-slate-950/20 rounded-xl border border-dashed border-slate-850 font-bold">
                      {isAr ? 'لم يتم إضافة تفاصيل شحن حتى الآن. اضغط على الزر بالأعلى لإدراج تفاصيل الشحن.' : 'No shipping items added yet. Click above to append.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Advanced Costs Parameters Formula */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/20 border border-slate-800 p-6 rounded-2xl text-[11px] font-bold text-slate-400">
                
                {/* Left controls */}
                <div className="space-y-3 col-span-2 grid grid-cols-2 gap-3 self-center">
                  
                  {formData.orderSourceType !== 'Factory' && (
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1">
                        {isAr ? 'سعر شي إن الأحمر (إن وجد)' : 'SHEIN Red Price (if any)'}
                      </label>
                      <input 
                        type="number" 
                        value={formData.sheinRedPrice || ''}
                        onChange={(e) => setFormData({...formData, sheinRedPrice: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px]"
                        placeholder="0.00"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1">{isAr ? 'رسوم التغليف (ريال سعودي)' : 'KSA Wrapping Fee'}</label>
                    <input 
                      type="number" 
                      value={formData.packagingFee || ''}
                      onChange={(e) => setFormData({...formData, packagingFee: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1">{isAr ? 'العملة والتحصيل المالي' : 'Collection Currency'}</label>
                    <select 
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none text-[11px]"
                    >
                      <option value="SAR">{isAr ? 'ريال سعودي' : 'SAR'}</option>
                      <option value="USD">{isAr ? 'دولار امريكي' : 'USD'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1">{isAr ? 'سعر الصرف (ريال يمني)' : 'Exchange Rate (YER)'}</label>
                    <input 
                      type="number" 
                      value={formData.currency === 'USD' ? formData.exchangeRateUSD : formData.exchangeRateYER}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        if (formData.currency === 'USD') {
                          setFormData({...formData, exchangeRateUSD: val});
                        } else {
                          setFormData({...formData, exchangeRateYER: val});
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1">{isAr ? 'موظف التعبئة والتجميع (سعودي)' : 'Aggregator Courier'}</label>
                    <select 
                      value={formData.shippingCourierId}
                      onChange={(e) => setFormData({...formData, shippingCourierId: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none text-[11px]"
                    >
                      <option value="">{isAr ? '-- اختر موظف التعبئة والتجميع --' : '-- Choose Aggregator --'}</option>
                      {couriers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1">{isAr ? 'مندوب التوزيع النهائي (اليمن)' : 'Yemen Driver'}</label>
                    <select 
                      value={formData.deliveryCourierId}
                      onChange={(e) => setFormData({...formData, deliveryCourierId: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none text-[11px]"
                    >
                      <option value="">{isAr ? '-- اختر مندوب التوزيع النهائي --' : '-- Choose Yemen Driver --'}</option>
                      {couriers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest block leading-none mb-1">{isAr ? 'رسوم التوصيل لليمن (ريال يمني)' : 'Delivery Courier Fee (YER)'}</label>
                    <input 
                      type="number" 
                      value={formData.deliveryCourierFee || ''}
                      onChange={(e) => setFormData({...formData, deliveryCourierFee: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-mono text-[11px]"
                    />
                  </div>

                </div>

                {/* Computational Formula Summary */}
                <div className="p-4 bg-slate-955 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                  <span className="text-[10px] text-slate-500 font-bold block pb-1 border-b border-slate-800 uppercase tracking-wider">{isAr ? 'خلاصة كشف الحساب والتقرير اللوجيستي' : 'Audit Summary'}</span>
                  
                  <div className="flex justify-between">
                    <span>{isAr ? 'إجمالي المنتجات المستوردة:' : 'Import Cargo Subtotal:'}</span>
                    <span className="font-mono text-white">{calcs.productsSum.toLocaleString()} SAR</span>
                  </div>

                  {formData.orderSourceType === 'Factory' && (
                    <div className="flex justify-between">
                      <span>{isAr ? 'بيانات الشحن للمصانع:' : 'Cargo weights/volume:'}</span>
                      <span className="font-mono text-amber-400">
                        {calcs.totalWeight} KG | {calcs.totalCBM} CBM
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>{isAr ? 'تكاليف ومكسب النقل والشحن:' : 'Company Freight Service:'}</span>
                    <span className="font-mono text-white">{calcs.shippingCostSAR.toLocaleString()} SAR</span>
                  </div>

                  <div className="flex justify-between">
                    <span>{isAr ? 'عمولة البوابات البنكية (3%):' : 'Aggregate Bank Fee (3%):'}</span>
                    <span className="font-mono text-white">{calcs.bankCommissionSAR.toLocaleString()} SAR</span>
                  </div>

                  <div className="flex justify-between pt-1 border-t border-slate-850 text-emerald-400">
                    <span className="font-bold">{isAr ? 'الإجمالي بالريال اليمني:' : 'Total due in YER:'}</span>
                    <span className="font-black font-mono text-sm">
                      {Math.ceil(calcs.totalOrderYER).toLocaleString()} YER
                    </span>
                  </div>

                  {/* Prepayment info input */}
                  <div className="pt-2 border-t border-slate-850 space-y-2">
                    <label className="text-[10px] text-slate-500 block font-bold uppercase">{isAr ? 'المقدار المدفوع مقدماً / كاش (ريال يمني)' : 'Cash paid advance YER'}</label>
                    <input 
                      type="number"
                      value={formData.amountPaid || ''}
                      onChange={(e) => setFormData({...formData, amountPaid: parseFloat(e.target.value) || 0})}
                      placeholder="0.00 YER"
                      className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs font-black rounded-xl p-2 outline-none text-center"
                    />

                    <div className="flex justify-between pt-1 font-bold text-rose-400">
                      <span>{isAr ? 'المديونية المتبقية للدفع:' : 'Outstanding remaining balance:'}</span>
                      <span className="font-mono">{Math.ceil(calcs.remainingYER).toLocaleString()} YER</span>
                    </div>
                  </div>

                </div>

              </div>

              {/* Action commands */}
              <div className="pt-6 border-t border-slate-850 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all font-bold text-xs">{isAr ? 'إلغاء النافذة' : 'Cancel'}</button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all text-sm">{isAr ? 'حفظ وترحيل الفاتورة وإرسالReceipt' : 'Deploy Freight cargo'}</button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER NESTED MODAL */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 bg-slate-955 flex justify-between items-center text-xs font-black text-white">
              <span>{isAr ? 'تسجيل زبون سريع في الدفتر' : 'Quick Register Customer'}</span>
              <button onClick={() => setIsAddCustomerOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-1 rounded-lg"><Plus className="w-4 h-4 rotate-45" /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-5 space-y-4 text-start">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'اسم الزبون الكامل' : 'FullName'}</label>
                <input required type="text" value={customerFormData.fullName || ''} onChange={e => setCustomerFormData({...customerFormData, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'رقم جوال العميل الواتساب' : 'WhatsApp/Phone'}</label>
                <input required type="text" value={customerFormData.phone || ''} onChange={e => setCustomerFormData({...customerFormData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-mono font-bold" placeholder="e.g. 777123456" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'العنوان الإقليمي' : 'Regional Depot'}</label>
                <input type="text" value={customerFormData.address || ''} onChange={e => setCustomerFormData({...customerFormData, address: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" placeholder={isAr ? "مثال: صنعاء - حدة" : "District"} />
              </div>
              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="p-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all">{isAr ? 'تأكيد الحفظ' : 'Confirm Save'}</button>
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
                  onChange={(e) => setSourceFormData({...sourceFormData, type: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold"
                >
                  <option value="App">{isAr ? 'موقع تسوق إلكتروني / تطبيق' : 'Retail Application/Website'}</option>
                  <option value="Factory">{isAr ? 'مصنع أو مورد بالصين' : 'Direct China Manufacturer'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'اسم المصدر / التطبيق' : 'Source Name'}</label>
                <input required type="text" value={sourceFormData.source_name || ''} onChange={e => setSourceFormData({...sourceFormData, source_name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
              </div>

              {sourceFormData.type === 'App' && (
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'رابط الويب بوابة (اختياري)' : 'URL Link'}</label>
                  <input type="url" value={sourceFormData.source_url || ''} onChange={e => setSourceFormData({...sourceFormData, source_url: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-mono font-bold" placeholder="https://example.com" />
                </div>
              )}

              {sourceFormData.type === 'Factory' && (
                <>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'بيانات المورد / WeChat' : 'WeChat Contact'}</label>
                    <input type="text" value={sourceFormData.contact_info || ''} onChange={e => setSourceFormData({...sourceFormData, contact_info: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'جغرافية المصنع / التسليم' : 'Depot Location'}</label>
                    <input type="text" value={sourceFormData.location || ''} onChange={e => setSourceFormData({...sourceFormData, location: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
                  </div>
                </>
              )}

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button type="button" onClick={() => setIsAddSourceOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="p-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all">{isAr ? 'تأكيد الحفظ' : 'Confirm Save'}</button>
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
                <input required type="text" value={shippingCompanyFormData.name || ''} onChange={e => setShippingCompanyFormData({...shippingCompanyFormData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" placeholder="e.g Aramex, Safe Ship" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'مسؤول الاتصال' : 'Contact Person'}</label>
                <input type="text" value={shippingCompanyFormData.contact_person || ''} onChange={e => setShippingCompanyFormData({...shippingCompanyFormData, contact_person: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-bold" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'رقم الهاتف/الجوال' : 'Phone No.'}</label>
                <input type="text" value={shippingCompanyFormData.phone || ''} onChange={e => setShippingCompanyFormData({...shippingCompanyFormData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-mono font-bold" placeholder="+967..." />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAr ? 'بوابة تتبع الشحنات الويب' : 'Tracking Portal Link'}</label>
                <input type="url" value={shippingCompanyFormData.tracking_url || ''} onChange={e => setShippingCompanyFormData({...shippingCompanyFormData, tracking_url: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-white text-xs font-mono font-bold" placeholder="https://..." />
              </div>
              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button type="button" onClick={() => setIsAddShippingCompanyOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="p-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all">{isAr ? 'تأكيد الحفظ' : 'Confirm Save'}</button>
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
                      onChange={e => setUpdateFormData({...updateFormData, orderStatus: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs"
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
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-500 block mb-1">{isAr ? 'مكان التواجد لليمن' : 'Yemen Spot'}</label>
                    <input 
                      type="text" 
                      value={updateFormData.locationYemen} 
                      onChange={e => setUpdateFormData({...updateFormData, locationYemen: e.target.value})} 
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 block mb-1">{isAr ? 'ملاحظات وتنبيهات داخلية للموزع' : 'Internal notes'}</label>
                    <textarea 
                      rows={2}
                      value={updateFormData.internalNotes} 
                      onChange={e => setUpdateFormData({...updateFormData, internalNotes: e.target.value})} 
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Assign Couriers/Employees */}
              <div className="pt-4 border-t border-slate-805 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 block mb-1">
                    {isAr ? 'موظف التعبئة والتجميع' : 'Packaging & Assembly employee'}
                  </label>
                  <select 
                    value={updateFormData.shippingCourierId}
                    onChange={(e) => setUpdateFormData({...updateFormData, shippingCourierId: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs font-bold"
                  >
                    <option value="">{isAr ? '-- اختر موظف التعبئة والتجميع --' : '-- Choose Aggregator --'}</option>
                    {couriers.map(c => (
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
                    onChange={(e) => setUpdateFormData({...updateFormData, deliveryCourierId: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none text-xs font-bold"
                  >
                    <option value="">{isAr ? '-- اختر مندوب التوزيع النهائي --' : '-- Choose Final Courier --'}</option>
                    {couriers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Edit Shipping Details Subtable */}
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
                    <div key={sh.id || idx} className="bg-slate-955 p-4 rounded-xl border border-slate-800 space-y-3 relative">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <span className="text-[10px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2 py-0.5 rounded">
                          {isAr ? `الشحنة #${idx + 1}` : `Shipment #${idx + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeUpdateShippingRow(idx)}
                          className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/10 transition-all font-bold text-[10px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isAr ? 'حذف' : 'Remove'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                        {/* Shipping Type */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'نوع مسار الشحن (بري/جوي/بحري)' : 'Transit Mode (Land/Air/Sea)'}</label>
                          <select
                            value={sh.shippingType || 'بري'}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingType', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-xs"
                          >
                            <option value="بري">{isAr ? 'بري - Overland Cargo' : 'Land - Overland Cargo'}</option>
                            <option value="جوي">{isAr ? 'جوي - Air Freight' : 'Air - Air Freight'}</option>
                            <option value="بحري">{isAr ? 'بحري - Ocean Cargo' : 'Sea - Ocean Cargo'}</option>
                          </select>
                        </div>

                        {/* Shipping Company */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-slate-400">{isAr ? 'اسم الناقل / شركة الشحن' : 'Carrier/Shipping Company'}</label>
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
                          </div>
                          <select
                            value={sh.shippingCompany || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingCompany', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-xs"
                          >
                            <option value="">{isAr ? '-- اختر شركة شحن --' : '-- Choose carrier --'}</option>
                            {shippingCompanies.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Shipping Source */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'مصدر الشحن (بلد التصدير)' : 'Shipment Source (Country)'}</label>
                          <input
                            type="text"
                            required
                            value={sh.shippingSource || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingSource', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-xs"
                          />
                        </div>

                        {/* Shipping Destination */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'وجهة الشحن (مكان الاستقبال)' : 'Shipment Destination'}</label>
                          <input
                            type="text"
                            required
                            value={sh.shippingDestination || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingDestination', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-xs"
                          />
                        </div>

                        {/* Shipping Date */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'تاريخ تسليم الشحنة للناقل' : 'Shipping Handover Date'}</label>
                          <input
                            type="date"
                            value={sh.shippingDate || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingDate', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans font-bold text-xs"
                          />
                        </div>

                        {/* Shipping Duration */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'المدة التقديرية (أيام/أسابيع)' : 'Transit Duration (Estimated)'}</label>
                          <input
                            type="text"
                            value={sh.shippingDuration || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingDuration', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-xs"
                          />
                        </div>

                        {/* Expected Arrival */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'موعد التوصيل المتوقع لليمن' : 'Expected Arrival Date'}</label>
                          <input
                            type="text"
                            value={sh.expectedArrival || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'expectedArrival', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-xs"
                          />
                        </div>

                        {/* Delivery Date */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'تاريخ التسليم الفعلي المكتمل' : 'Actual Completed Delivery Date'}</label>
                          <input
                            type="date"
                            value={sh.deliveryDate || ''}
                            onChange={(e) => updateUpdateShippingRow(idx, 'deliveryDate', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans font-bold text-xs"
                          />
                        </div>

                        {/* Shipping Cost */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'أجرة وتكاليف النقل (ريال سعودي)' : 'Shipping Cargo Cost (SAR)'}</label>
                          <input
                            type="number"
                            required
                            value={sh.shippingCost || 0}
                            onChange={(e) => updateUpdateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono font-bold text-xs"
                          />
                        </div>

                        {/* Packaging Fees */}
                        <div>
                          <label className="block text-slate-400 mb-1">{isAr ? 'أجور التغليف والصناديق (ريال سعودي)' : 'Packaging Fees (SAR)'}</label>
                          <input
                            type="number"
                            value={sh.packagingFees || 0}
                            onChange={(e) => updateUpdateShippingRow(idx, 'packagingFees', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono font-bold text-xs"
                          />
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

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setIsUpdateModalOpen(false)} className="px-5 py-2 hover:bg-slate-800 text-slate-400 rounded-lg">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all">{isAr ? 'حفظ وترحيل التغييرات' : 'Update settings'}</button>
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
                  onChange={e => setPaymentFormData({...paymentFormData, amount: e.target.value})}
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
                  onChange={e => setPaymentFormData({...paymentFormData, pin: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 text-yellow-500 font-mono text-sm font-black p-3 rounded-xl outline-none text-center tracking-widest"
                  placeholder="••••"
                />
                <p className="text-[9px] text-slate-500 mt-1">{isAr ? 'اكتب الـ PIN الخاص بك المخزن في ملف الموظف لتفويض المعاملة.' : 'Enter your professional profile PIN to authorize transaction.'}</p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPaymentFormData({ amount: '', method: 'Cash', notes: '', pin: '' });
                }} className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all">{isAr ? 'تأكيد ترحيل القبض' : 'Settle payment'}</button>
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
                    <button 
                      onClick={() => copyToClipboard(selectedOrder.trackingNumber || selectedOrder.orderNumber || '')}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg border border-slate-705 flex items-center gap-1.5 font-bold cursor-pointer transition text-[10px]"
                    >
                      {isAr ? 'نسخ رمز التتبع الموحد' : 'Copy Tracking ID'}
                    </button>
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
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-slate-955 border border-slate-800 p-2.5 rounded-lg flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-bold">{isAr ? 'إجمالي قيمة الفاتورة' : 'Total Invoice Due'}</span>
                    <span className="font-mono text-white text-xs font-black mt-1">{(parseFloat(selectedOrder.totalCostYER) || 0).toLocaleString()} YER</span>
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
                            <td className="p-2.5 text-white font-bold">{it.productName || (isAr ? `طرد رقم ${index+1}` : `Cargo item ${index+1}`)}</td>
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
                          <div className={`absolute -right-[23px] md:-right-[35px] top-1.5 w-4 h-4 rounded-full border-4 border-slate-900 z-10 flex items-center justify-center transition-all ${
                            isDelivered ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'
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
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 ${
                                  isDelivered 
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
                                <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'تاريخ تسليم الشحنة للناقل' : 'Handover Date'}</span>
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
                </div>
              )}

            </div>

            {/* Footer buttons */}
            <div className="p-4 bg-slate-955 border-t border-slate-850 flex justify-end gap-2 shrink-0">
              <button 
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedOrder(null);
                }} 
                className="px-5 py-2.5 bg-slate-850 text-slate-455 hover:text-white rounded-xl transition font-bold"
              >
                {isAr ? 'إغلاق نافذة التفاصيل' : 'Close Details'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
