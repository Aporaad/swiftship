import React, { useState, useEffect, useRef, useMemo } from 'react'; // استيراد التفاعلات لاجل عرض البيانات 
import { useLocation } from 'react-router-dom'; // استيراد الموقع لاجل عرض البيانات  
import CopyToClipboard from '../components/CopyToClipboard'; // استيراد نسخ النص لاجل النسخ 
import { collection, onSnapshot, orderBy, query, where, addDoc, setDoc, doc, updateDoc, getDoc, getDocs, deleteDoc, db, auth, handleSupabaseError, OperationType, safeToDate } from '../lib/supabase'; // استيراد قاعدة البيانات
import { useSettings } from '../context/SettingsContext'; // استيراد الإعدادات
import { useRole } from '../hooks/useRole'; // استيراد الأدوار
import { notificationService } from '../services/notificationService'; // استيراد خدمات الإشعارات
import toast from 'react-hot-toast'; // استيراد خدمات الإشعارات لاجل عرض الاشعارات 
import { activityLogService } from '../services/activityLogService'; // استيراد خدمات السجلات لاجل كتابة السجلات 
import { whatsappService } from '../services/whatsappService'; // استيراد خدمات الواتساب لاجل ارسال الرسائل 
import ConfirmModal from '../components/ConfirmModal'; // استيراد النافذة التاكيدية لاجل الحذف  
import Tracking from './Tracking'; // استيراد تتبع الطلبات لاجل عرض تتبع الطلبات 
import { financialAccountService } from '../services/financialAccountService'; // استيراد خدمات الحسابات المالية لاجل عرض الحسابات المالية 
import { financialEntryService, type FinancialPaymentMethod } from '../services/financialEntryService';
import {
  Plus, Search, Edit2, Truck, Activity, Trash2, DollarSign,
  CreditCard, Printer, Calculator, Package, MapPin, X, AlertCircle, RefreshCw, UserPlus, Eye,
  User, Mail, Phone, Coins, Calendar, ExternalLink, Filter, Layers, CheckCircle2, Boxes
} from 'lucide-react'; // استيراد الايقونات لاجل عرض الايقونات 
import { jsPDF } from 'jspdf'; // استيراد جافاسكريبت لاجل عرض البيانات 
import { printContent } from '../lib/printUtils'; // استيراد الطباعة لاجل عرض البيانات 
import QRCode from 'qrcode'; // استيراد رمز الاستجابة السريعة لاجل عرض رمز الاستجابة السريعة 
import { useOrderStatuses } from '../hooks/useOrderStatuses'; // استيراد حالات الطلبات لاجل عرض حالات الطلبات 
import { autoEntryService } from '../services/autoEntryService'; // استيراد خدمات القيد التلقائي لاجل عرض القيد التلقائي 
import { orderHistoryService } from '../services/orderHistoryService';
import { getProcessedStatusIds, planOrderStatusTransition } from '../services/orderLifecycleService';
import OrderStatusManagementTab from '../components/OrderStatusManagementTab'; // استيراد تبويبات حالات الطلبات لاجل عرض تبويبات حالات الطلبات 
import { useExchangeRates } from '../hooks/useExchangeRates'; // استيراد اسعار الصرف لاجل عرض اسعار الصرف 
import { useOrderOptions } from '../hooks/useOrderOptions'; // استيراد خيارات الطلب (أنواع التغليف وفئات الشحن)
import OrderOptionsManagementTab from '../components/orders/OrderOptionsManagementTab'; // استيراد واجهة إدارة خيارات الطلب
import { useItemCategories } from '../hooks/useItemCategories';
import { calculateShipmentCategoryFees } from '../services/itemCategoryService';
import ItemCategoriesManagementTab from '../components/orders/ItemCategoriesManagementTab';
import ProductsManagementTab from '../components/orders/ProductsManagementTab';
import OrderHistoryModal from '../components/orders/OrderHistoryModal'; // استيراد سجل تدقيق الطلبات والشحنات
import { buildOrderParties, findOrderParty, toOrderPartyPayload, type OrderParty } from '../services/orderPartyService';
import { calculateOrderPaymentTotals } from '../services/orderCurrencyService';
import { deleteOrdersWithDependents, type OrderDeletionSummary } from '../services/orderDeletionService';

// استيراد وحدات التقارير والنماذج المنفصلة
import { generateOrderInvoicePDF, exportOrdersToPDF, exportOrdersToCSV } from '../reports';
import ShipmentFormModal from '../components/shipments/ShipmentFormModal';
import PaymentModal from '../components/orders/PaymentModal';
import DeleteOrderModal from '../components/orders/DeleteOrderModal';
import OrderDetailsModal from '../components/orders/OrderDetailsModal';
import UpdateStatusModal from '../components/orders/UpdateStatusModal';
import CreateOrderModal from '../components/orders/CreateOrderModal';
import EditOrderModal from '../components/orders/EditOrderModal';
import { CustomerCreateModal, ShippingCompanyCreateModal, SourceCreateModal } from '../components/entities/EntityCreateModals';

export default function Orders() { // دالة عرض الطلبات 
  const { settings, t } = useSettings(); // استيراد الإعدادات لاجل عرض الإعدادات 
  const { activeCurrencies, rates: dbRates } = useExchangeRates(); // استيراد اسعار الصرف لاجل عرض اسعار الصرف 
  const { role, hasPermission, profile, loading: roleLoading } = useRole();  // استيراد الأدوار لاجل عرض الأدوار 
  const { statuses: orderStatusesList, getStatusByName, getStatusById, getStatusByAny, getNextStatus } = useOrderStatuses(); // استيراد حالات الطلبات لاجل عرض حالات الطلبات 
  const canManageOrders = role === 'Admin' || hasPermission('edit_orders'); //  القدرة على ادارة الطلبات 
  const canAddOrders = role === 'Admin' || hasPermission('add_orders'); //  القدرة على اضافة الطلبات 
  const canEditOrderDefaultsCreation = role === 'Admin' || hasPermission('edit_order_defaults_creation'); //  القدرة على تعديل الطلبات الافتراضية 
  const canTrackOrders = role === 'Admin' || hasPermission('track_order'); //  القدرة على تتبع الطلبات 
  const canViewOrderStatuses = role === 'Admin' || hasPermission('view_order_statuses') || hasPermission('view_auto_entries'); //  القدرة على عرض حالات الطلبات 
  const isAr = settings.language === 'ar'; //  اللغة العربية 
  const orderCurrency = settings.defaultOrderCurrency || settings.currency || 'SAR'; // العملة الافتراضية المعينة لأسعار الطلبات

  // Core Data States 
  const [orders, setOrders] = useState<any[]>([]); //  متغير مكونات الحاله الخاص ب الطلبات 
  const [customers, setCustomers] = useState<any[]>([]); //  متغير مكونات الحاله الخاص ب العملاء 
  const [employees, setEmployees] = useState<any[]>([]); // الموظفون المتاحون كطرف للطلب
  const [couriers, setCouriers] = useState<any[]>([]); //  متغير مكونات الحاله الخاص ب ال مندوبين  
  const [sources, setSources] = useState<any[]>([]); //  متغير مكونات الحاله الخاص ب المصادر 
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]); //  متغير مكونات الحاله الخاص ب شركات الشحن 
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]); // الحسابات المالية الورقية المتاحة للقبض
  const [loading, setLoading] = useState(true); //  متغير مكونات الحاله الخاص ب التحميل 
  const [isSubmitting, setIsSubmitting] = useState(false); //  متغير مكونات الحاله الخاص ب الارسال 

  // Modals & Panels States 
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); //  متغير مكونات الحاله الخاص ب فتح النافذة الاضافية 
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false); // نافذة تعديل بيانات الطلب الكلية
  const [orderToEdit, setOrderToEdit] = useState<any>(null); // الطلب المحدد للتعديل الكامل
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false); //  متغير مكونات الحاله الخاص ب فتح النافذة التعديل 
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false); //  متغير مكونات الحاله الخاص ب فتح نافذة الدفع 
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false); //  متغير مكونات الحاله الخاص ب فتح نافذة التفاصيل 
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false); // نافذة سجل تدقيق الطلب أو الشحنة
  const [orderHistoryContext, setOrderHistoryContext] = useState<any>(null); // العنصر المعروض سجله
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false); //  متغير مكونات الحاله الخاص ب فتح نافذة اضافة عميل 
  const [isAddShippingCompanyOpen, setIsAddShippingCompanyOpen] = useState(false); //  متغير مكونات الحاله الخاص ب فتح نافذة اضافة شركة شحن 
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false); //  متغير مكونات الحاله الخاص ب فتح نافذة اضافة مصدر 
  const [activeAddShippingIndex, setActiveAddShippingIndex] = useState<number | string | null>(null); //  متغير مكونات الحاله الخاص ب اضافة شركة شحن 

  // Form Data for newly created Inline Shipping Company --نموذج بيانات شركة الشحن الجديدة 
  const [shippingCompanyFormData, setShippingCompanyFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    tracking_url: '',
    address: '',
    notes: ''
  });

  // Form Data for newly created Inline Source of Purchase --نموذج بيانات مصدر الشحنة الجديدة  
  const [sourceFormData, setSourceFormData] = useState({
    source_name: '',
    type: 'App',
    source_url: '',
    contact_info: '',
    location: '',
    notes: ''
  });

  // Focus Orders States
  const [selectedOrder, setSelectedOrder] = useState<any>(null); //   متغير مكونات حالة الطلب المحدد ويستخدم لعرض تفاصيل الطلب   
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]); //   متغير مكونات حالة الطلبات المحددة ويستخدم ل تحديث جماعي   
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); //   متغير مكونات حالة حذف الطلب ويستخدم ل حذف جماعي   
  const [orderToDelete, setOrderToDelete] = useState<any>(null); //   متغير مكونات حالة الطلب المراد حذفه ويستخدم ل حذف جماعي   
  const [ordersPendingDelete, setOrdersPendingDelete] = useState<any[]>([]); // الطلبات التي أكد المدير حذفها في العملية الحالية
  const [deletePin, setDeletePin] = useState(''); //   متغير مكونات حالة رمز الحذف ويستخدم ل حذف جماعي   
  const [deleteError, setDeleteError] = useState(''); //   متغير مكونات حالة خطأ الحذف ويستخدم ل حذف جماعي   
  const [isBatchUpdating, setIsBatchUpdating] = useState(false); //  تحديث جماعي
  const [customerUnpaidAlert, setCustomerUnpaidAlert] = useState<number | null>(null); //  تنبيه العميل غير المدفوع 

  // Ref for QR Code
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null); //  رمز الاستجابة السريعة

  // Filters State
  const [searchText, setSearchText] = useState(''); //  البحث في الطلبات
  const [statusFilter, setStatusFilter] = useState('all'); //  حالة الطلب
  const [courierFilter, setCourierFilter] = useState('all'); //  مندوب الشحن
  const [sourceFilter, setSourceFilter] = useState('all'); //  مصدر الشحنة 
  const [sortBy, setSortBy] = useState('date-desc'); //  ترتيب الطلبات 

  const [autoVoucherRules, setAutoVoucherRules] = useState<any[]>([]); //  قواعد القيد التلقائي 

  // Dedicated Products & Shipments Collections State 
  const [allProducts, setAllProducts] = useState<any[]>([]); // جميع المنتجات  
  const [allShipments, setAllShipments] = useState<any[]>([]); // جميع الشحنات 

  const location = useLocation(); //  الموقع

  const { options: orderOptionsList, packagingOptions, shippingCategoryOptions } = useOrderOptions();
  const { activeCategories: activeItemCategories } = useItemCategories();

  // تبويبات الطلبات ويستخدم ل عرض الطلبات و الشحنات و تتبع و حالات الطلبات والخيارات (أنواع التغليف وفئات الشحن)
  const [ordersTab, setOrdersTab] = useState<'orders' | 'products' | 'shipments' | 'tracking' | 'statuses' | 'options' | 'item-categories'>(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'products') return 'products';
    if (tab === 'shipments') return 'shipments';
    if (tab === 'tracking' && (role === 'Admin' || hasPermission('track_order'))) return 'tracking';
    if ((tab === 'statuses' || tab === 'order-statuses') && (role === 'Admin' || hasPermission('view_order_statuses') || hasPermission('view_auto_entries'))) return 'statuses';
    if (tab === 'options' || tab === 'order-options' || tab === 'order_option') return 'options';
    if (tab === 'item-categories' || tab === 'items-category' || tab === 'items_category') return 'item-categories';
    return 'orders';
  });

  // تحديث تبويبات الطلبات  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'products' && ordersTab !== 'products') {
      setOrdersTab('products');
    } else if (tab === 'tracking' && canTrackOrders && ordersTab !== 'tracking') {
      setOrdersTab('tracking');
    } else if (tab === 'shipments' && ordersTab !== 'shipments') {
      setOrdersTab('shipments');
    } else if ((tab === 'statuses' || tab === 'order-statuses') && canViewOrderStatuses && ordersTab !== 'statuses') {
      setOrdersTab('statuses');
    } else if ((tab === 'options' || tab === 'order-options' || tab === 'order_option') && ordersTab !== 'options') {
      setOrdersTab('options');
    } else if ((tab === 'item-categories' || tab === 'items-category' || tab === 'items_category') && ordersTab !== 'item-categories') {
      setOrdersTab('item-categories');
    } else if (ordersTab === 'tracking' && !canTrackOrders) {
      setOrdersTab('orders');
    } else if (ordersTab === 'statuses' && !canViewOrderStatuses) {
      setOrdersTab('orders');
    }
  }, [location.search, canTrackOrders, canViewOrderStatuses, ordersTab]);

  // Dedicated Shipments Studio Filters & Modals
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState('');// البحث عن الشحنة 
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('all'); // حالة الشحنة 
  const [shipmentCarrierFilter, setShipmentCarrierFilter] = useState('all'); // شركة الشحن
  const [shipmentCourierFilter, setShipmentCourierFilter] = useState('all'); // مندوب الشحن 

  // Shipments CRUD Modals State
  const [isAddShipmentModalOpen, setIsAddShipmentModalOpen] = useState(false); //  إضافة شحنة جديدة 
  const [isEditShipmentModalOpen, setIsEditShipmentModalOpen] = useState(false); //  تعديل الشحنة 
  const [isDeleteShipmentModalOpen, setIsDeleteShipmentModalOpen] = useState(false); //  حذف الشحنة 
  const [shipmentToEdit, setShipmentToEdit] = useState<any>(null); //  تعديل الشحنة 
  const [shipmentToDelete, setShipmentToDelete] = useState<any>(null); //  حذف الشحنة 

  //بيانات الشحنة 
  const [shipmentFormData, setShipmentFormData] = useState({
    id: '',
    orderId: '', // Optional! Can be empty for standalone shipment
    trackingNumber: '',
    shippingCompany: 'shein_shipping',
    shippingCompanyId: 'shein_shipping',
    courierId: '',
    shippingType: 'no_shipping',
    shippingSource: '',
    shippingDestination: 'no_shipping',
    shipmentStatus: 'في الانتظار',
    shippingCost: 0,
    weight: 0,
    packagingFees: 0,
    shippingCategoryId: '',
    shippingCategoryName: '',
    shippingCategoryPrice: 0,
    shippingDate: new Date().toISOString().split('T')[0],
    shippingDuration: '15',
    expectedArrival: '',
    deliveryDate: '',
    notes: '',
    contentCategoryId: '',
    contentCategoryName: '',
    cartonCount: 0,
    customsFee: 0,
    taxFee: 0,
    otherCategoryFee: 0,
    categoryFeesTotal: 0,
    categoryFeeCurrency: 'SAR'
  });

  // Multi-item sub table state for creation -- جدول المنتجات المتعددة في الطلب 
  const [items, setItems] = useState<any[]>([
    { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, length: 0, width: 0, height: 0, trackingNumber: '' }
  ]);

  // Order Upgrade states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');// البحث عن العميل  ويستخدم لترقية الطلب 
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);//عرض تفاصيل العميل  
  const [previewOrderNumber, setPreviewOrderNumber] = useState('');// داله ارجاع رقم الطلب الذي سوف يتم تحديثه    

  // Products Adjustments
  const [bankCommissionEnabled, setBankCommissionEnabled] = useState(false);//تفعيل العمولة البنكية  
  const [bankCommissionRate, setBankCommissionRate] = useState(3);//نسبة العمولة البنكية  
  const [bankCommissionType, setBankCommissionType] = useState<'percentage' | 'fixed'>('percentage');//نوع العمولة البنكية   
  const [couponEnabled, setCouponEnabled] = useState(false);//متغير زر الكوبون
  const [couponRate, setCouponRate] = useState(0);//سعر الكوبون ويستخدم لترقية الطلب  
  const [cartShareCode, setCartShareCode] = useState('');//كود الكوبون ويستخدم لترقية الطلب  

  // New States for order source types
  const [addShippingEnabled, setAddShippingEnabled] = useState(false);//متغير تفعيل الشحن ويستخدم لتحديد هل الطلب يحتوي على شحن ام لا  
  const [profitPerKgRate, setProfitPerKgRate] = useState(19);//قيمة الربح لكل كيلو جرام ويستخدم في حالة نوع مصدر الطلب = تطبيقات 
  const [cbmShippingRateValue, setCbmShippingRateValue] = useState(1400);//قيمة الشحن لكل متر مكعب ويستخدم في حاله نوع مصدر الطلب = مصانع 

  // Shipping packaging fee state
  const [packagingFeeEnabled, setPackagingFeeEnabled] = useState(false);//متغير تفعيل رسوم التغليف  على مستوى الشحن  
  const [packagingFeeRate, setPackagingFeeRate] = useState(0);//رسوم التغليف على مستوى الشحن

  // ====== حالات الخيارات الجديدة الثلاثة لإنشاء الطلب ======
  // New feature states for order creation: home delivery, pay later, direct approve

  /** هل التوصيل للمنزل مفعل؟ (يُظهر حقول المندوب اليمني ورسوم التوصيل)
   *  Is home delivery enabled? (shows Yemen courier & delivery fee fields) */
  const [homeDeliveryEnabled, setHomeDeliveryEnabled] = useState(false);

  /** هل الشحن عبر مندوب مفعل؟ (يُظهر حقول موظف التعبئة والتجميع والعمولة)
   *  Is via shipping agent enabled? (shows Saudi aggregator & commission fee fields) */
  const [viaShippingAgent, setViaShippingAgent] = useState(false);

  /** هل الدفع لاحقاً مفعل؟ (يُخفي حقول الدفع ويحفظ الطلب بحالة 1 كـ "لم يتم الدفع")
   *  Is pay later enabled? (hides payment fields, saves order at status 1 as Unpaid) */
  const [payLater, setPayLater] = useState(false);

  /** هل الحفظ والاعتماد المباشر مفعل؟ (يحفظ الطلب بحالة الطلب الثالثة مباشرة)
   *  Is direct approve enabled? (saves order directly at status stage 3 = Approved) */
  const [directApprove, setDirectApprove] = useState(false);


  // Pre-generate preview order number when modal opens and populate settings defaults 
  // تم توليد رقم الطلب مسبقا عند فتح النافذة وملء الاعدادات الافتراضية 
  useEffect(() => {
    if (isAddModalOpen) {
      generateSmartOrderCode().then(code => setPreviewOrderNumber(code));
      //متغيرات ثابته افتراضيه متعلقة بالطلب مثل العمله ونوع العمله وسعر الصرف
      setFormData(prev => ({
        ...prev,
        currency: orderCurrency,
        exchangeRate: dbRates[orderCurrency] || 1,
        // جلب سعر صرف العملة الافتراضية للطلب من الإعدادات (ديناميكي من DB)
        exchangeRateYER: dbRates[orderCurrency] || 1,
        // سعر صرف الدولار من DB (ديناميكي)
        exchangeRateUSD: dbRates['USD'] || 1,
        bankCommissionRate: settings.defaultBankCommissionRate ?? 3,
        companyProfitRate: settings.defaultCompanyProfitRate ?? 12,
        packagingFee: settings.defaultPackagingFee ?? 0,
        deliveryCourierFee: settings.defaultDeliveryFee ?? 4000,
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        orderPartyId: '',
        orderPartyType: 'customer',
        isStaffOrder: false,
        employeeId: '',
        courierId: '',
        orderPartyAccountId: '',
        orderSourceId: '',
        orderSourceName: '',
        externalOrderNumber: '',
        trackingNumber: '',
        amountPaid: 0,
        notes: ''
      }));
      //متغيرات ثابته افتراضيه متعلقة بالمنتجات  مثل اسم المنتج ورابط المنتج وسعر المنتج والوزن والحجم والطول والعرض والارتفاع ورقم التتبع
      setItems([
        { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, length: 0, width: 0, height: 0, trackingNumber: '' }
      ]);
      //متغيرات ثابته افتراضيه عند فتح النافذه متعلقة بالشحن مثل نوع الشحن وشركة الشحن
      setShippings([
        {
          id: 'shipp_' + Math.random().toString(36).substr(2, 9),//مهم: يتم تغييرها الى تسلسل بالترتيب حسب اخر تحديث
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
          packagingFees: 0,
          contentCategoryId: '',
          contentCategoryName: '',
          cartonCount: 0,
          customsFee: 0,
          taxFee: 0,
          otherCategoryFee: 0,
          categoryFeesTotal: 0,
          categoryFeeCurrency: 'SAR'
        }
      ]);
      setProfitPerKgRate(settings.defaultProfitPerKg ?? 19);//متغير لنسبه الربح لكل كيلو جرام
      setCbmShippingRateValue(settings.defaultCbmShippingRate ?? 1400);//متغير لسعر الشحن لكل متر مكعب
      setAddShippingEnabled(false);//متغير لتفعيل الشحن 
    }
  }, [isAddModalOpen, settings]);

  // Multiple shipping details sub table state
  //متغيرات  متعلقة بالجدول الفرعي للشحن مثل نوع الشحن وشركة الشحن
  const [shippings, setShippings] = useState<any[]>([
    {
      id: Math.random().toString(36).substr(2, 9),//مهم: يتم تغييرها الى تسلسل بالترتيب حسب تسلسل اخر شحنه
      shippingType: 'بري',
      shippingCompany: 'Aramex',
      shippingSource: '',
      shippingDestination: '',
      shippingDate: '',
      shippingDuration: '',
      expectedArrival: '',
      deliveryDate: '',
      shippingCost: 0,
      packagingFees: 0,
      contentCategoryId: '',
      contentCategoryName: '',
      cartonCount: 0,
      customsFee: 0,
      taxFee: 0,
      otherCategoryFee: 0,
      categoryFeesTotal: 0,
      categoryFeeCurrency: 'SAR'
    }
  ]);

  const [updateShippings, setUpdateShippings] = useState<any[]>([]);//متغير حاله يستخدم لتحديث الشحنات 

  // Order Create Form Data 
  // بيانات نموذج إنشاء الطلب 
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    orderPartyId: '',
    orderPartyType: 'customer',
    isStaffOrder: false,
    employeeId: '',
    courierId: '',
    orderPartyAccountId: '',
    orderSourceId: '',
    orderSourceName: '',
    orderSourceType: 'App', // App or Factory
    externalOrderNumber: '', // Original Code / Salla Number
    trackingNumber: '', // Global tracking ID
    addShippingEnabled: false,
    shippingCompany: 'Aramex', // Aramex, DHL, SafePost

    // Courier Links
    shippingCourierId: '', // Saudi courier
    shippingCourierFeeRate: 30, // Saudi courier fee/commission rate (%)
    deliveryCourierId: '', // Yemen courier
    deliveryCourierFee: 4000, // Yemen flat delivery rate in YER
    deliveryCourierFeeCurrency: settings.currency || 'YER',

    // Rates & Commissions
    orderCurrency,
    currency: orderCurrency,
    exchangeRate: 1, // Selected currency exchange rate
    exchangeRateYER: 140, // Dynamic rate from DB
    exchangeRateUSD: 1, // Dynamic rate from DB
    bankCommissionRate: 3, // default 3%
    companyProfitRate: 12, // default 12% profit for general Apps
    packagingFee: 0, // customized packaging fee
    sheinRedPrice: 0, // SHEIN red price overrides

    // Prepayment info
    amountPaid: 0,
    paymentMethod: 'Cash',
    notes: '',
    deductSourcingCostFromCourier: false,
    sourcing_cost: 'system'
  });

  // Edit / Update State 
  const [updateFormData, setUpdateFormData] = useState({
    orderStatus: 'طلب معلق',
    deliveryStatus: 'في الانتظار',
    locationYemen: 'مستودع صنعاء الرئيسي',
    internalNotes: '',
    shippingCourierId: '',
    deliveryCourierId: ''
  });

  // New Payment State 
  const [paymentFormData, setPaymentFormData] = useState<{
    amount: string; method: 'Cash' | 'Bank' | 'Deferred' | 'Mixed'; receivingAccountId: string; bankReference: string;
    allocations: Array<{ id: string; method: 'Cash' | 'Bank'; amount: string; receivingAccountId: string; bankReference: string }>;
    notes: string; pin: string; paymentCurrency?: string; voucherDate?: string; voucherNumber?: string;
  }>({
    amount: '',
    method: 'Cash',
    receivingAccountId: '',
    bankReference: '',
    allocations: [],
    notes: '',
    pin: '',
    paymentCurrency: 'YER',
    voucherDate: '',
    voucherNumber: ''
  });

  // Nested Add Customer Form
  const [customerFormData, setCustomerFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    gps_location: '',
    address: '',
    notes: ''
  });

  //قسم الجلب من الداتا بيز 
  // Fetch orders synchronized 
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

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((entry: any) => !entry.disabled));
    });

    // Fetch couriers
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snap) => {
      setCouriers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubFinancialAccounts = onSnapshot(collection(db, 'accounts'), (snap) => {
      setFinancialAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((account: any) => account.isActive !== false && Boolean(account.accSubId || account.acc_sub_id))
        .map((account: any) => ({
          id: account.id,
          name: account.accNameAr || account.acc_name_ar || account.accountName || account.id,
          currency: account.currency || account.currencyCode || '',
          curNo: Number(account.curNo ?? account.cur_no),
          accSubId: String(account.accSubId ?? account.acc_sub_id ?? ''),
        })));
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
      const list = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || 'بدون اسم', ...doc.data() }));
      setShippingCompanies(list);
    }, (error) => {
      console.error("FIRESTORE ERROR ON shipping_companies SNAPSHOT LISTENER IN ORDERS.tsx:", error);
    });

    // Fetch products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setAllProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleSupabaseError(error, OperationType.LIST, 'products'));
    const sourcing_cost = '';

    // Fetch shipments
    const unsubShipments = onSnapshot(collection(db, 'shipments'), (snap) => {
      setAllShipments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleSupabaseError(error, OperationType.LIST, 'shipments'));

    return () => {
      unsubOrders();
      unsubCustomers();
      unsubEmployees();
      unsubCouriers();
      unsubFinancialAccounts();
      unsubSources();
      unsubAutoVoucherRules();
      unsubShippingCompanies();
      unsubProducts();
      unsubShipments();
      sourcing_cost;
    };
  }, [roleLoading]);

  // Auto-seed default shipping companies if they do not exist
  // داله انشاء شركات شحن افتراضيه تم تعليقها ولاتقم باظهاره ابدا
  /*useEffect(() => {
    if (roleLoading) return;

    const seedDefaultCarriers = async () => {
      try {
        const defaults = ['Aramex', 'DHL', 'SafePost', 'Yemen Express'];
        const querySnapshot = await getDocs(collection(db, 'shipping_companies'));
        const existingNames = new Set(
          querySnapshot.docs.map(doc => (doc.data().id || '').trim().toLowerCase())
        );

        for (const carrier of defaults) {
          if (!existingNames.has(carrier.toLowerCase())) {
            await addDoc(carrier, collection(db, 'shipping_companies'), {
              name: carrier,
              contact_person: isAr ? 'الناقل الرسمي' : 'Default Carrier',
              phone: '',
              tracking_url: '',
              address: '',
              notes: isAr ? 'تمت الإضافة تلقائياً كشركة شحن افتراضية' : 'Auto-seeded default carrier',
              createdAt: Date.now()
            });
          }
        }
      } catch (err) {
        console.error("Error seeding default carriers:", err);
      }
    };

    seedDefaultCarriers();
  }, [roleLoading]);*/

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
    if (formData.customerId && formData.orderPartyType === 'customer') {
      const custOrders = orders.filter(o => o.customerId === formData.customerId);
      const totalUnpaid = custOrders.reduce((sum, o) => sum + (parseFloat(o.amountRemaining || '0')), 0);
      if (totalUnpaid > 0 && !loading) {
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
  }, [formData.customerId, formData.orderPartyType, orders, customers]);

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
      let maxNum = 0;
      snap.docs.forEach(docSnap => {
        const orderNum = docSnap.data()?.orderNumber;
        if (orderNum) {
          const parts = String(orderNum).split('-');
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
      const nextNum = maxNum > 0 ? Math.max(startNum, maxNum + 1) : startNum;
      return `${prefix}-${nextNum}`;
    } catch (err) {
      console.warn("Exception getting order count, using random placeholder:", err);
      return `${prefix}-${Math.floor(startNum + Math.random() * 9000)}`;
    }
  };

  // Smart Customer Search & Stats Upgrade -- البحث عن عميل داخل  القائمه 
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return [];
    return customers.filter(c =>
      (c.fullName || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      (c.phone || '').toLowerCase().includes(customerSearchQuery.toLowerCase())
    );
  }, [customerSearchQuery, customers]);

  const orderParties = useMemo(
    () => buildOrderParties(customers, employees, couriers),
    [customers, employees, couriers],
  );

  const selectedOrderParty = useMemo(
    () => findOrderParty(formData, customers, employees, couriers),
    [formData.customerId, formData.orderPartyId, formData.orderPartyType, customers, employees, couriers],
  );

  // Get customers stats --  احصائيات العميل 
  const customerProfileStats = useMemo(() => {
    if (!formData.customerId || formData.orderPartyType !== 'customer') return null;
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

  // Select customer from search results -- اختيار العميل من نتائج البحث 
  const selectCustomer = (c: any) => {
    setFormData(prev => ({
      ...prev,
      customerId: c.id,
      customerName: c.fullName || '',
      customerPhone: c.phone || '',
      customerAddress: c.address || '',
      orderPartyId: c.id,
      orderPartyType: 'customer',
      isStaffOrder: false,
      employeeId: '',
      courierId: '',
      orderPartyAccountId: c.financialAccountId || c.accountId || ''
    }));
    setCustomerSearchQuery('');
  };

  // Clear selected customer -- مسح العميل المحدد
  const clearSelectedCustomer = () => {
    setFormData(prev => ({
      ...prev,
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderPartyId: '',
      employeeId: '',
      courierId: '',
      orderPartyAccountId: ''
    }));
  };

  const setIsStaffOrder = (value: boolean) => {
    clearSelectedCustomer();
    setFormData((prev) => ({ ...prev, isStaffOrder: value, orderPartyType: value ? 'employee' : 'customer' }));
  };

  const ensureOrderPartyFinancialAccount = async (party: OrderParty): Promise<OrderParty> => {
    if (party.financialAccountId) return party;
    const entityType = party.type === 'employee' ? 'employee' : party.type === 'courier' ? 'courier' : 'customer';
    const account = await financialAccountService.createAccountForEntity(entityType, party.id, party.name, settings.currency || 'YER');
    return { ...party, financialAccountId: account.id, financialAccountCode: account.accountCode };
  };

  const selectOrderParty = async (party: OrderParty) => {
    try {
      const resolved = await ensureOrderPartyFinancialAccount(party);
      setFormData((prev) => ({ ...prev, ...toOrderPartyPayload(resolved) }));
      setCustomerSearchQuery('');
    } catch (error: any) {
      notificationService.notify({ title: isAr ? 'تعذر ربط الحساب المالي' : 'Financial account link failed', message: error?.message || (isAr ? 'تعذر تجهيز الحساب المالي لطرف الطلب.' : 'Unable to prepare the party financial account.'), type: 'error', category: 'order' });
    }
  };

  /**
   * buildOrderRates — بناء خريطة أسعار الصرف الكاملة لطلب محدد.
   * تُدمج أسعار الطلب المحفوظة (كـ override) مع آخر أسعار من DB.
   * يُستخدم بدلاً من { USD: ..., SAR: ... } في كل عمليات التحويل.
   *
   * @param order - كائن الطلب (يحتوي على exchangeRateYER, exchangeRateUSD, currency)
   * @returns خريطة أسعار كاملة { [code]: rate_vs_base }
   */
  const buildOrderRates = (order?: any) => {
    // ابدأ بالأسعار الحالية من DB
    const rates = { ...dbRates };
    if (!order) return rates;

    // أضف/اعزز بأسعار الطلب المحفوظة وقت الإنشاء
    const orderCurrency = order.currency || settings.currency || 'SAR';
    if (order.exchangeRateYER && order.exchangeRateYER > 0) {
      rates[orderCurrency] = order.exchangeRateYER;
    }
    if (order.exchangeRateUSD && order.exchangeRateUSD > 0) {
      rates['USD'] = order.exchangeRateUSD;
    }
    return rates;
  };

  // generateOrderInvoicePDF is imported from '../reports' (see line 28)



  // Helper calculation values حساب جميع التكاليف 
  const computeCalculations = () => {
    // 1. Compute total products prices حساب سعر المنتجات
    const productsSum = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.productPrice || 0)), 0);

    // Auto-calculate CBM for each item if dimensions are provided حساب الحجم المكعب للمنتج الواحد 
    items.forEach(i => {
      if (formData.orderSourceType === 'Factory') {
        const length = parseFloat(i.length || 0);
        const width = parseFloat(i.width || 0);
        const height = parseFloat(i.height || 0);
        if (length > 0 && width > 0 && height > 0) {
          i.cbm = parseFloat(((length * width * height) / 1000000).toFixed(6));  // معادلة حساب حجم  CBM
        }
      }
    });


    // حساب الوزن الكلي  = ضرب الكمية  مع الوزن 
    const totalWeight = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.weight || 0)), 0);

    // حساب الحجم المكعب الكلي = ضرب الكمية  مع الحجم المكعب 
    const totalCBM = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.cbm || 0)), 0);

    // حساب إجمالي رسوم تأمين المنتجات
    const itemsInsuranceSum = items.reduce((sum: number, i: any) => sum + (i.isInsured ? (parseFloat(i.insuranceFee) || 0) : 0), 0);

    //Apply Bank Commission to products cost حساب العمولة البنكية
    const bankCommValue = bankCommissionEnabled
      ? (bankCommissionType === 'percentage'
        ? (productsSum * (parseFloat(bankCommissionRate as any) / 100))
        : (parseFloat(bankCommissionRate as any) || 0))
      : 0;

    //  حساب كوبون    
    const couponValue = couponEnabled ? couponRate : 0; // couponRate is now treated as a fixed amount in SAR

    const totalProductsCostWithAdjustments = productsSum - couponValue; // حساب التكلفة الكلية للمنتجات مع الخصم 
    //مهم: بدلا من الاعتماد على الريال السعودي كعمله ثابته للطلب يجب انشاء حقل في الاعدادت للتعيين عمله افتراضيه للطلب وبتم اخذ العمله منها بدلا من الريال السعودي 
    let priceSAR = totalProductsCostWithAdjustments;// سعر المنتجات بالريال السعودي
    let shippingCostSAR = 0;  // تكلفة الشحن بالريال السعودي
    let profitCompanySAR = 0; // ربح الشركة بالريال السعودي 
    let profitSaudiSAR = 0; // ربح السعودية بالريال السعودي 
    let totalOrderSAR = 0; // الاجمالي الكلي بالريال السعودي

    // Sum up shipping cost from shippings table
    // packagingFeeRate is now a fixed SAR amount (not a percentage)
    // مجموع تكلفه الشحن = مجموع تكاليف الشحن + رسوم التغليف (رسوم التغليف تضاف لكل طلب على حده ) 
    const shippingsCostSum = shippings.reduce((sum, s) => sum + parseFloat(s.shippingCost || 0) + parseFloat(s.packagingFees || 0), 0);
    const shippingPackagingFixed = packagingFeeEnabled ? (parseFloat(packagingFeeRate as any) || 0) : 0;
    const totalShippingsCost = shippingsCostSum + shippingPackagingFixed;

    //----------------------------------------------
    // حساب التكاليف في مصدر شحن شي ان
    if (formData.orderSourceType === 'SHEIN') {
      const redPrice = parseFloat(formData.sheinRedPrice as any) || 0;// سعر المنتج في شي ان الاحمر
      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0;// رسوم التغليف الثابته
      priceSAR = redPrice;//سعر المنتجات بالريال السعودي 
      shippingCostSAR = 0;// تكلفة الشحن 
      // Customer pays SHEIN Red Price + packaging fee + insurance fee
      totalOrderSAR = redPrice + generalPackagingFee + itemsInsuranceSum;// الاجمالي الكلي بالريال السعودي 

      // ربح الشركه قبل احتساب الشحن وعموله المناديب  = سعر المنتج في شي ان الاحمر  -  (تكلفه المنتج + العمولة البنكية + رسوم التغليف ) 
      const rawProfitSAR = redPrice - (productsSum + bankCommValue + generalPackagingFee);

      const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId); //جلب معرف مندوب الشحن السعودي
      const saudiRate = (saudiCourier && saudiCourier.commissionRate !== undefined) ? parseFloat(saudiCourier.commissionRate) : 0; // جلب نسبه عموله مندوب الشحن السعودي      
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100);//ربح المندوب السعودي  = ربح الشركه الصافي  *  نسبه ربح المندوب 

      // Coupon amount is added entirely to the company profit
      // كوبون الخصم يضاف بالكامل الى ربح الشركه
      // ربح الشركه الكلي بعد احتساب عموله المندوب واضافه مبلغ الكوبون = ربح الشركه الصافي  -  ربح المندوب السعودي   + كوبون الخصم 
      profitCompanySAR = (rawProfitSAR - profitSaudiSAR) + couponValue;
    }
    //----------------------------------------------
    // حساب التكاليف في مصادر الشحن للمصانع
    else if (formData.orderSourceType === 'Factory') {
      const rawProfitSAR = totalWeight * (parseFloat(profitPerKgRate as any) || 0); //ربح الشركه للمصانع =  الوزن الكلي *  سعر الربح لكل كيلو 

      // Use the shipping cost from the shippings table (which is filled automatically based on formula and is editable)
      // جلب تكلفه الشحن من جدول الشحنات (الذي يتم ملؤه تلقائيا بناء على الصيغة وهو قابل للتعديل)
      shippingCostSAR = totalShippingsCost; // تكلفه الشحن النهائيه بالسعودي  = مجموع تكاليف الشحن + رسوم التغليف 

      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0; // رسوم التغليف الثابته
      //  الاجمالي الكلي بالريال السعودي = سعر المنتجات + ربح الشركه + تكلفه الشحن + رسوم التغليف العامه + رسوم التامين
      totalOrderSAR = productsSum + rawProfitSAR + shippingCostSAR + generalPackagingFee + itemsInsuranceSum;

      const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId);//جلب معرف مندوب الشحن السعودي 
      const saudiRate = (saudiCourier && saudiCourier.commissionRate !== undefined) ? parseFloat(saudiCourier.commissionRate) : 0; // جلب نسبه عموله مندوب الشحن السعودي 
      profitSaudiSAR = rawProfitSAR * (saudiRate / 100); // ربح المندوب السعودي = ربح الشركه الافتراضي  * نسبه ربح المندوب 
      // ربح الشركه النهائي بالسعوديه  = ربح الشركه الافتراضي  -  ربح المندوب السعودي   + كوبون الخصم 
      profitCompanySAR = (rawProfitSAR - profitSaudiSAR) + couponValue;
    }
    //----------------------------------------------
    // حساب التكاليف في مصدر التطبيق
    else {
      // Shopping (App)
      let rawProfitSAR = productsSum * ((parseFloat(formData.companyProfitRate as any) || 12) / 100);
      // Deduct bank commission from profit -- جلب العموله البنكيه وخصمها من ربح الشركه 
      rawProfitSAR = rawProfitSAR - bankCommValue;

      // تكلفه الشحن : اذا عدد الشحنات اكبر من 0 فان التكلفه = مجموع تكاليف الشحن 
      shippingCostSAR = (addShippingEnabled || shippings.length > 0) ? totalShippingsCost : 0;
      //جلب رسوم التغليف العامه الخاصه بالشركه  
      const generalPackagingFee = parseFloat(formData.packagingFee as any) || 0;

      // ربح الشركه الاصلي = اجمالي تكلفه المنتجات * نسبه الربح الافتراضيه للطلبات من نوع تطبيقات 
      const originalRawProfitSAR = productsSum * ((parseFloat(formData.companyProfitRate as any) || 12) / 100);

      // سعر البيع للعميل = سعر المنتجات + ربح الشركه الافتراضي قبل خصم العموله البنكيه  + تكلفه الشحن + رسوم التغليف العامه + كوبون الخصم + رسوم تأمين المنتجات 
      totalOrderSAR = productsSum + originalRawProfitSAR + shippingCostSAR + generalPackagingFee + couponValue + itemsInsuranceSum;

      // احتساب ربح المندوب السعودي فقط إذا كان خيار "عبر مندوب شحن" مفعّلاً ومحدداً
      // Calculate Saudi courier profit only if viaShippingAgent toggle is enabled
      if (viaShippingAgent && formData.shippingCourierId) {
        const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId);
        const saudiRate = (formData.shippingCourierFeeRate !== undefined && formData.shippingCourierFeeRate !== null)
          ? (parseFloat(formData.shippingCourierFeeRate as any) || 0)
          : ((saudiCourier && saudiCourier.commissionRate !== undefined) ? parseFloat(saudiCourier.commissionRate) : 30);
        profitSaudiSAR = rawProfitSAR * (saudiRate / 100);
      } else {
        profitSaudiSAR = 0;
      }

      // ربح الشركه النهائي  = ربح الشركه الافتراضي بعد خصم العموله البنكيه  -  ربح المندوب السعودي  + كوبون الخصم 
      profitCompanySAR = (rawProfitSAR - profitSaudiSAR) + couponValue;
    }
    //----------------------------------------------

    // احتساب رسوم التوصيل لليمن فقط إذا كان خيار "توصيل للمنزل" مفعّلاً
    // Calculate Yemen delivery fee only if homeDeliveryEnabled is true
    const deliveryFeeRaw = homeDeliveryEnabled ? (parseFloat(formData.deliveryCourierFee as any) || 0) : 0;
    const paymentCurrency = formData.currency || orderCurrency;
    const deliveryFeeCurrency = formData.deliveryCourierFeeCurrency || settings.currency || 'YER';
    const currencyTotals = calculateOrderPaymentTotals({
      orderSubtotal: totalOrderSAR,
      deliveryFeeOriginal: deliveryFeeRaw,
      deliveryFeeCurrency,
      orderCurrency,
      paymentCurrency,
      rates: dbRates,
    });
    const totalOrderYER = currencyTotals.totalPaymentCurrency;
    const sourcingCostAmount =
      (formData.orderSourceType === 'App' || formData.orderSourceType === 'Factory')
        ? totalProductsCostWithAdjustments + shippingCostSAR
        : totalProductsCostWithAdjustments;

    const valPaid = parseFloat(formData.amountPaid as any) || 0;
    const remainingYER = totalOrderYER - valPaid;

    return {
      productsSum,
      itemsInsuranceSum,
      totalProductsCostWithAdjustments,
      totalWeight,
      totalCBM,
      priceSAR,
      shippingCostSAR,
      bankCommissionSAR: bankCommValue,
      couponValue,
      totalOrderSAR: currencyTotals.totalOrderCurrency,
      totalOrderYER,
      remainingYER,
      deliveryCourierFeeOrderCurrency: currencyTotals.deliveryFeeOrderCurrency,
      deliveryCourierFeeCurrency: deliveryFeeCurrency,
      paymentExchangeRate: currencyTotals.paymentExchangeRate,
      profitSaudiSAR,
      profitCompanySAR,
      sourcingCostAmount,
    };
  };

  const calcs = computeCalculations();// حساب التكاليف بناء على المتغيرات المدخله من قبل المستخدم 

  // Handle order creation نموذج انشاء طلب 
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.orderPartyId) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'الرجاء اختيار طرف الطلب أولاً' : 'Please select an order party first',
        type: 'error',
        category: 'order'
      });
    }

    const currentCalcs = computeCalculations();
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

      // ====== تحديد حالة الدفع بناءً على خيار "الدفع لاحقاً" أو المبلغ المدفوع ======
      // Determine payment status based on payLater toggle or paid amount
      let payStatus: string;
      if (payLater) {
        // الدفع لاحقاً: حالة الدفع دائماً "لم يتم الدفع"
        // Pay later: always set payment status to Unpaid
        payStatus = 'Unpaid';
      } else if (currentCalcs.remainingYER <= 0) {
        payStatus = 'Paid'; // دفع كامل
      } else if (parseFloat(formData.amountPaid as any) > 0) {
        payStatus = 'Partial Paid'; // دفع جزئي
      } else {
        payStatus = 'Unpaid'; // لم يتم الدفع
      }

      // ====== تحديد ID حالة الطلب بناءً على الخيارات الثلاثة ======
      // Determine order status ID based on payLater, directApprove and paid amount
      // المنطق: directApprove => حالة 3 | payLater => حالة 1 | دفع موجود => حالة 2 | بدون دفع => حالة 1
      // Logic: directApprove => stage 3 | payLater => stage 1 | paid > 0 => stage 2 | else => stage 1
      const computedOrderStatusId = (() => {
        // ترتيب الأولوية: الاعتماد المباشر > الدفع لاحقاً > مدفوع/غير مدفوع
        // Priority: direct approve > pay later > paid/unpaid
        if (directApprove) {
          // البحث عن الحالة ذات الترتيب 3 من جدول حالات الطلب
          // Find status with sortOrder/id = 3 from order statuses table
          const stage3 = orderStatusesList.find((s: any) => s.id === 3 || s.sortOrder === 3);
          return stage3 ? String(stage3.id) : '3';
        }
        if (payLater) {
          // حالة البداية (الأولى) من جدول حالات الطلب
          // First stage from order statuses table
          const stage1 = orderStatusesList.find((s: any) => s.id === 1 || s.isFirst === true || s.sortOrder === 1);
          return stage1 ? String(stage1.id) : '1';
        }
        // المنطق الافتراضي: إذا تم الدفع => الحالة الثانية، وإلا => الأولى
        // Default: paid amount present => stage 2 else stage 1
        if (parseFloat(formData.amountPaid as any) > 0) {
          const stage2 = orderStatusesList.find((s: any) => s.id === 2 || s.sortOrder === 2);
          return stage2 ? String(stage2.id) : '2';
        }
        const stage1 = orderStatusesList.find((s: any) => s.id === 1 || s.isFirst === true || s.sortOrder === 1);
        return stage1 ? String(stage1.id) : '1';
      })();

      const initialFiredTriggers = [''];
      if (parseFloat(formData.amountPaid as any) > 0 && !payLater) {
        initialFiredTriggers.push('order_down_payment');//مهم:هذا قيد دفعه من العميل
      }

      // ====== نص حالة الطلب (نصي) بناءً على الخيارات ======
      // Order status text based on options
      const orderStatusText = (() => {
        if (directApprove) return isAr ? 'معتمد' : 'Approved';
        if (payLater) return isAr ? 'طلب معلق' : 'Pending Order';
        if (parseFloat(formData.amountPaid as any) > 0) {
          const stage2 = orderStatusesList.find((s: any) => s.id === 2 || s.sortOrder === 2);
          return stage2 ? (isAr ? stage2.nameAr : stage2.nameEn) : (isAr ? 'تم الدفع ولم يتسجل' : 'Paid Not Registered');
        }
        return isAr ? 'طلب معلق' : 'Pending Order';
      })();

      const payload = {
        // أعمدة مباشرة - ترتبط بـ DIRECT_COLUMNS_MAP لتُكتب في الأعمدة الأساسية وتُحذف من data
        // Direct columns - mapped via DIRECT_COLUMNS_MAP to base columns, excluded from data
        orderNumber,
        trackingNumber: formData.trackingNumber || orderNumber,
        customerId: formData.customerId || '',
        orderPartyId: formData.orderPartyId || formData.customerId || '',
        orderPartyType: formData.orderPartyType || 'customer',
        isStaffOrder: Boolean(formData.isStaffOrder),
        employeeId: formData.employeeId || null,
        courierId: formData.courierId || null,
        orderPartyAccountId: formData.orderPartyAccountId || null,
        // تحديد ID حالة الطلب ديناميكياً بناءً على payLater و directApprove
        // Dynamic order status ID based on payLater & directApprove options
        orderStatusId: computedOrderStatusId,
        order_status_id: computedOrderStatusId,
        orderSourceId: formData.orderSourceId || null,
        orderSourceType: formData.orderSourceType || null,
        deliveryCourierId: homeDeliveryEnabled ? (formData.deliveryCourierId || null) : null,
        delivery_courier_id: homeDeliveryEnabled ? (formData.deliveryCourierId || null) : null,
        shippingCourierId: viaShippingAgent ? (formData.shippingCourierId || null) : null,
        shipping_courier_id: viaShippingAgent ? (formData.shippingCourierId || null) : null,
        createdByName: profile?.fullName || 'Root Admin',
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.fullName || 'Root Admin',

        // بيانات مالية وحسابية - تُخزَّن في data لأنها ليست أعمدة مباشرة
        // Financial & calculation data - stored in data column (no direct column)
        currency: orderCurrency,
        orderCurrency,
        paidCurrency: formData.currency,
        exchangeRate: currentCalcs.paymentExchangeRate,
        exchangeRateYER: formData.exchangeRateYER,
        exchangeRateUSD: formData.exchangeRateUSD,
        bankCommissionRate: formData.bankCommissionRate,
        bankCommissionType,
        companyProfitRate: formData.companyProfitRate,
        packagingFee: parseFloat(formData.packagingFee as any) || 0,
        sheinRedPrice: parseFloat(formData.sheinRedPrice as any) || 0,
        cartShareCode,
        bankCommissionEnabled,
        couponEnabled,
        couponRate,
        couponValue: currentCalcs.couponValue,
        productsSum: currentCalcs.productsSum,
        packagingFeeEnabled,
        packagingFeeRate,
        totalWeight: currentCalcs.totalWeight,
        totalCBM: currentCalcs.totalCBM,
        totalCostSAR: currentCalcs.totalOrderSAR,
        totalCostYER: currentCalcs.totalOrderYER,
        amountPaid: parseFloat(formData.amountPaid as any) || 0,
        amountRemaining: currentCalcs.remainingYER,
        paymentStatus: payStatus,
        // حفظ خيارات الحفظ الإضافية في سجل الطلب
        // Save extra order creation options in the order record
        homeDeliveryEnabled: homeDeliveryEnabled,
        viaShippingAgent: viaShippingAgent,
        payLater: payLater,
        directApprove: directApprove,
        paymentMethod: payLater ? 'Deferred' : ((formData as any).paymentMethod || 'Cash'),
        cashAccountId: (formData as any).cashAccountId || null,
        bankAccountId: (formData as any).bankAccountId || null,
        bankReference: (formData as any).bankReference || '',
        cashAmount: parseFloat((formData as any).cashAmount as any) || 0,
        bankAmount: parseFloat((formData as any).bankAmount as any) || 0,
        profitPerKgRate: parseFloat(profitPerKgRate as any) || 19,
        cbmShippingRateValue: parseFloat(cbmShippingRateValue as any) || 1400,
        addShippingEnabled,
        shippingCostSAR: currentCalcs.shippingCostSAR,
        shippingCourierFeeRate: viaShippingAgent ? (parseFloat(formData.shippingCourierFeeRate as any) || 0) : 0,
        profitSaudiSAR: viaShippingAgent ? currentCalcs.profitSaudiSAR : 0,
        profitCompanySAR: currentCalcs.profitCompanySAR,
        deductSourcingCostFromCourier: viaShippingAgent ? Boolean(formData.deductSourcingCostFromCourier) : false,
        sourcing_cost: (viaShippingAgent && formData.deductSourcingCostFromCourier) ? 'courier' : 'system',
        sourcingCostAmount: currentCalcs.sourcingCostAmount,
        // نص حالة الطلب يأخذ بعين الاعتبار الاعتماد المباشر والدفع لاحقاً
        // Order status text respects directApprove and payLater
        orderStatus: orderStatusText,
        deliveryStatus: 'في الانتظار',
        locationYemen: 'في الانتظار',
        firedTriggers: initialFiredTriggers,
        shippingCompany: formData.shippingCompany,
        externalOrderNumber: formData.externalOrderNumber,
        deliveryCourierFee: homeDeliveryEnabled ? (parseFloat(formData.deliveryCourierFee as any) || 0) : 0,
        deliveryCourierFeeCurrency: currentCalcs.deliveryCourierFeeCurrency,
        deliveryCourierFeeOrderCurrency: currentCalcs.deliveryCourierFeeOrderCurrency,
        productInsuranceFee: currentCalcs.itemsInsuranceSum,
        product_insurance_fee: currentCalcs.itemsInsuranceSum,
        createdAt: Date.now(),
      };
      //حفظ الطلب في جدول الطلب
      await addDoc(payload.orderNumber, collection(db, 'orders'), payload);


      // ─── حفظ المنتجات الرئيسية في products ثم بنود الطلب في order_items ───
      // Save master products in 'products' table (only if brand new item with no product_id),
      // then save each order line item in 'order_items' referencing the master product.
      if (items && items.length > 0) {
        // إيجاد cur_id لعملة الطلب الافتراضية من جدول currency لاستخدامه في product_price_currency
        // Look up cur_id for the default order currency to use as product_price_currency FK
        const orderCurrencyRecord = activeCurrencies?.find(
          (c: any) => String(c.code || '').toUpperCase() === String(orderCurrency || '').toUpperCase()
        );
        const orderCurrencyId = orderCurrencyRecord?.cur_id || orderCurrencyRecord?.code || null;

        for (const item of items) {
          const qty = parseFloat(item.quantity || 1);
          const unitPrice = parseFloat(item.productPrice || item.price || item.unitPrice || 0);
          const weight = parseFloat(item.weight || 0);
          const cbm = parseFloat(item.cbm || 0);
          const isInsured = Boolean(item.isInsured);
          const insuranceFee = isInsured ? (parseFloat(item.insuranceFee) || 0) : 0;

          // ── التحقق من معرف المنتج: إذا كان المنتج موجود مسبقاً (product_id مملوء) فلا تنشئه مجدداً ──
          // Check if item has an existing master product_id - if yes, skip creating new master product
          let masterProductId = (
            item.product_id ||
            item.productId ||
            null
          );
          // تنظيف المعرف الفارغ أو غير الصالح
          // Sanitize empty or invalid product_id
          if (masterProductId && typeof masterProductId === 'string') {
            masterProductId = masterProductId.trim() || null;
          }

          if (!masterProductId) {
            // ── منتج جديد: أنشئه في products مع تعبئة جميع الحقول والعملة الافتراضية ──
            // Brand new product: create in products table with all fields and order currency FK
            masterProductId = 'prod_' + Math.random().toString(36).substring(2, 11);
            await addDoc(masterProductId, collection(db, 'products'), {
              product_id: masterProductId,
              product_name_ar: item.productName || item.name || 'منتج',
              product_name_en: item.productNameEn || item.productName || item.name || 'Product',
              product_url: item.productUrl || '',
              // تعبئة مرجع عملة السعر بـ cur_id من جدول العملات
              // Populate currency FK with cur_id from currency table matching order default currency
              product_price_currency: orderCurrencyId,
              unit_price: unitPrice,
              item_category_id: item.itemCategoryId || item.item_category_id || null,
              is_allowed: true,
              cbm: cbm,
              width: parseFloat(item.width || 0),
              height: parseFloat(item.height || 0),
              length: parseFloat(item.length || 0),
              weight: weight,
              created_at: new Date().toISOString(),
              created_by: profile?.fullName || 'system',
              updated_at: new Date().toISOString(),
              updated_by: profile?.fullName || 'system',
            });
          }
          // إذا كان masterProductId موجوداً مسبقاً → لا يتم إنشاء أي سجل جديد في products
          // If masterProductId already exists → skip inserting into products, use existing reference

          // ── حفظ بند الطلب في order_items مرتبطاً بالطلب والمنتج الرئيسي ──
          // Save order line item in 'order_items' linked to order & master product
          const itemId = 'item_' + Math.random().toString(36).substring(2, 11);
          await addDoc(itemId, collection(db, 'order_items'), {
            items_id: itemId,
            order_id: payload.orderNumber,
            product_id: masterProductId,
            product_price: unitPrice,
            product_url: item.productUrl || '',
            tracking_number: item.trackingNumber || '',
            produc_source_id: formData.orderSourceId || null,
            produc_source_url: item.productUrl || '',
            product_cooler: item.productName || item.name || 'منتج',
            nota: item.notes || item.description || '',
            quantity: qty,
            total_price: qty * unitPrice,
            total__weight: weight * qty,
            total_cbm: cbm * qty,
            packaging_option_id: item.packagingOptionId || null,
            packaging_option_price: parseFloat(item.packagingOptionPrice || 0),
            is_insured: isInsured,
            insurance_fee: insuranceFee,
            items_status: 'قيد الطلب',
            created_at: new Date().toISOString(),
            created_by: profile?.fullName || 'system',
            updated_at: new Date().toISOString(),
            updated_by: profile?.fullName || 'system',
          });
        }
      }


      // حفظ شحنات الطلب في جدول الشحنات
      // Save order shipments to dedicated shipments table - always save if shippings exist
      const shippingsToSave = (shippings || []).filter((s: any) => s && (s.shippingCompany || s.trackingNumber || s.shippingCost));
      for (const ship of shippingsToSave) {
        const shipId = ship.id || ('sh_' + Math.random().toString(36).substring(2, 11));
        await addDoc(shipId, collection(db, 'shipments'), {
          id: shipId,
          // ربط الشحنة بالطلب عبر رقم الطلب (المفتاح الأجنبي)
          order_id: payload.orderNumber,
          orderId: payload.orderNumber,
          tracking_number: ship.trackingNumber || payload.trackingNumber || payload.orderNumber,
          trackingNumber: ship.trackingNumber || payload.trackingNumber || payload.orderNumber,
          shipping_company_id: ship.shippingCompany || payload.shippingCompany || 'Aramex',
          shippingCompanyId: ship.shippingCompany || payload.shippingCompany || 'Aramex',
          courier_id: formData.deliveryCourierId || formData.shippingCourierId || null,
          courierId: formData.deliveryCourierId || formData.shippingCourierId || null,
          shipment_status: ship.shipmentStatus || 'طلب معلق',
          shipmentStatus: ship.shipmentStatus || 'طلب معلق',
          shipping_cost: parseFloat(ship.shippingCost || 0),
          shippingCost: parseFloat(ship.shippingCost || 0),
          weight: parseFloat(ship.weight || 0),
          shipping_category_id: ship.shippingCategoryId || ship.shipping_category_id || null,
          shippingCategoryId: ship.shippingCategoryId || ship.shipping_category_id || null,
          content_category_id: ship.contentCategoryId || ship.content_category_id || null,
          contentCategoryId: ship.contentCategoryId || ship.content_category_id || null,
          content_category_name: ship.contentCategoryName || ship.content_category_name || '',
          contentCategoryName: ship.contentCategoryName || ship.content_category_name || '',
          carton_count: parseFloat(ship.cartonCount || 0),
          cartonCount: parseFloat(ship.cartonCount || 0),
          customs_fee: parseFloat(ship.customsFee || 0),
          customsFee: parseFloat(ship.customsFee || 0),
          tax_fee: parseFloat(ship.taxFee || 0),
          taxFee: parseFloat(ship.taxFee || 0),
          other_category_fee: parseFloat(ship.otherCategoryFee || 0),
          otherCategoryFee: parseFloat(ship.otherCategoryFee || 0),
          category_fees_total: parseFloat(ship.categoryFeesTotal || 0),
          categoryFeesTotal: parseFloat(ship.categoryFeesTotal || 0),
          category_fee_currency: ship.categoryFeeCurrency || '',
          categoryFeeCurrency: ship.categoryFeeCurrency || '',
          createdAt: Date.now()
        });
      }

      // Ensure system accounts exist
      let systemAccs: Record<string, string> = {};
      try {
        systemAccs = await financialAccountService.ensureSystemAccounts(settings.currency || 'SAR');
      } catch (err) {
        console.error('Could not ensure system accounts:', err);
      }

      // --- Financial Account Impact ---
      const customerRecord = selectedOrderParty?.raw || customers.find(c => c.id === formData.customerId);
      const courierRecord = couriers.find(c => c.id === formData.shippingCourierId);
      const linkedAccountId = formData.orderPartyAccountId || customerRecord?.financialAccountId || customerRecord?.accountId;
      const linkedAccountCode = customerRecord?.financialAccountCode || customerRecord?.accountCode;

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

          //const customerRecord = customers.find(c => c.id === payload.customerId);
          /*await autoEntryService.executeAutoEntriesForStatus(
            payload.orderStatusId || '1',
            payload, {
            customer: customerRecord,
            courier: courierRecord,
            sourcing_cost: payload.sourcing_cost,
            isAr,
            rawAmountOverride: convertedOrderAmount,
            profileName: profile?.fullName || 'Root Admin'
          }
          );*/

          const paidVal = parseFloat(formData.amountPaid as any) || 0;
          const paidCurrency = formData.currency;
          if (paidVal > 0) {
            const convertedPaid = financialAccountService.convertToDefaultCurrency(
              paidVal,
              'YER',
              settings.currency || 'YER',
              { paidCurrency: formData.exchangeRateUSD, SAR: formData.exchangeRateYER }
            );

            //const customerRecord = customers.find(c => c.id === payload.customerId);
            await autoEntryService.executeAutoEntriesForStatus(
              payload.orderStatusId || '1',
              payload, {
              customer: customerRecord,
              orderParty: customerRecord,
              sourcing_cost: payload.sourcing_cost,
              courier: courierRecord,
              isAr,
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
      //  financialAccountService.convertToDefaultCurrency(
      //   sourcingCostAmount,
      //   'SAR',
      //   settings.currency || 'YER',
      //   dbRates
      // );

      // شرط خصم تكلفه المنتجات و الشحن من حساب المندوب في حاله التكاليف عليه  وخصمها من الشركه في حاله الشحن الداخلي
      /*if (formData.deductSourcingCostFromCourier && formData.shippingCourierId) {
        const saudiCourier = couriers.find(c => c.id === formData.shippingCourierId);
        if (saudiCourier && saudiCourier.financialAccountId) {
          try {
            const isSourcing = saudiCourier.courierType === 'sourcing';
            const courierCurrency = saudiCourier.financialCurrency || 'YER';

            const amountInCourierCurrency = financialAccountService.convertToDefaultCurrency(
              sourcingCostAmount,
              'SAR',
              courierCurrency,
              dbRates
            );

            await autoEntryService.executeAutoEntriesForStatus(
              payload.orderStatusId || '1',
              payload, {
              customer: customerRecord,
              sourcing_cost: payload.sourcing_cost,
              courier: courierRecord,
              isAr,
              rawAmountOverride: amountInCourierCurrency,
              amountOriginal: sourcingCostAmount,
              currencyOriginal: 'SAR',
              profileName: profile?.fullName || 'Root Admin'
            }
            );

            // Automatically settle pending custodies تنقيص العهده
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
          await autoEntryService.executeAutoEntriesForStatus(
            payload.orderStatusId || '1',
            payload, {
            customer: customerRecord,
            sourcing_cost: payload.sourcing_cost,
            courier: courierRecord,
            isAr,
            rawAmountOverride:sourcingCostAmount,
            amountOriginal: sourcingCostAmount,
            currencyOriginal: 'SAR',
            profileName: profile?.fullName || 'Root Admin'
          }
          );
        } catch (e) {
          console.error('Failed to deduct sourcing from system account', e);
        }
      }*/

      // Record Packaging Fees Credit
      const shippingsCostSum = shippings.reduce((sum, s) => sum + parseFloat(s.shippingCost || 0) + parseFloat(s.packagingFees || 0), 0);
      // packagingFeeRate is now a fixed SAR amount (not percentage)
      /*const shippingPackagingFixed = packagingFeeEnabled ? (parseFloat(packagingFeeRate as any) || 0) : 0;
      const packagingFeeSAR = parseFloat(formData.packagingFee as any || 0);


      if (packagingFeeSAR > 0 && systemAccs['sys_packaging_fees']) {
        try {
          const pkgConverted = financialAccountService.convertToDefaultCurrency(
            packagingFeeSAR,
            'SAR',
            settings.currency || 'YER',
            dbRates
          );
          await autoEntryService.executeAutoEntriesForStatus(
            payload.orderStatusId || '1',
            payload, {
            customer: customerRecord,
            courier: courierRecord,
            sourcing_cost: payload.sourcing_cost,
            isAr,
            rawAmountOverride: pkgConverted,
            amountOriginal: packagingFeeSAR,
            currencyOriginal: 'SAR',
            profileName: profile?.fullName || 'Root Admin'
          }
          );
        } catch (e) {
          console.error('Failed to log packaging fee', e);
        }
      }*/

      // Record Shipping Cost Debit (for any order type with shipping cost)
      // Only apply if deduction on courier is not set, and shipping costs are not merged with product costs
      // قيد تنفيذ الشحن على الشركه عند الشحن من التطبيق ويزيد مصاريف الشركه
      /*if (
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
            dbRates
          );
          await autoEntryService.executeAutoEntriesForStatus(
            payload.orderStatusId || '1',
            payload, {
            isAr,
            rawAmountOverride: shipCostConverted,
            amountOriginal: currentCalcs.shippingCostSAR,
            currencyOriginal: 'SAR',
            profileName: profile?.fullName || 'Root Admin'
          }
          );
        } catch (e) {
          console.error('Failed to log shipping cost', e);
        }
      }*/

      // Record Company Profit and Saudi Partner Profit will be recorded upon designated logistics statuses (handled in Update Status).
      // Removed direct ledger creation for couriers and company profit from here to prevent duplicates.
      // Removed Yemen delivery driver wage creation here to prevent duplicates (handled on "تم التسليم").

      const selectedCustomer = customers.find(c => c.id === payload.customerId || c.id === payload.orderPartyId);
      const customerDisplayName = selectedCustomer ? (selectedCustomer.name || selectedCustomer.nameAr || selectedCustomer.nameEn || 'عميل') : (formData.customerName || 'عميل');

      // Log the order creation to activity log
      activityLogService.log('add_order', payload.orderNumber || 'New Order', {
        orderId: payload.orderNumber,
        orderNumber: payload.orderNumber,
        customer: customerDisplayName,
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
        await whatsappService.triggerNotification('onOrderCreated', { ...payload, customerName: customerDisplayName });
      } catch (whatsappErr) {
        console.error('Failed to trigger real WhatsApp on order creation:', whatsappErr);
      }

      // Automatically dispatch simulated API dispatch status for WhatsApp + SMS in logs/panel
      const remainingVal = parseFloat(String(payload.amountRemaining || '0'));
      const totalCostYERVal = parseFloat(String(payload.amountPaid || '0')) + parseFloat(String(payload.amountRemaining || '0'));
      const smsMessage = isAr
        ? `عزيزنا العميل ${customerDisplayName}، تم تأكيد طلبك رقم: (${orderNumber}) بنجاح. حالة الشحنة: (${payload.orderStatus}). تتبع مع: ${payload.shippingCompany}، تتبع رقم: ${payload.trackingNumber || 'قيد الرفع'}. القيمة الإجمالية: ${totalCostYERVal.toLocaleString()} YER، المتبقي: ${remainingVal.toLocaleString()} YER.`
        : `Dear ${customerDisplayName}, your order ${orderNumber} has been confirmed. Status: ${payload.orderStatus}. Track with ${payload.shippingCompany}: ${payload.trackingNumber || 'Pending'}. Total: ${totalCostYERVal.toLocaleString()} YER, Remaining: ${remainingVal.toLocaleString()} YER.`;

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

  // اعاده تعبئه نموذج انشاء طلب  
  const resetCreateForm = () => {
    setFormData({
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderPartyId: '',
      orderPartyType: 'customer',
      isStaffOrder: false,
      employeeId: '',
      courierId: '',
      orderPartyAccountId: '',
      orderSourceId: '',
      orderSourceName: '',
      orderSourceType: 'App',
      externalOrderNumber: '',
      trackingNumber: '',
      shippingCompany: 'Aramex',
      addShippingEnabled: false,
      shippingCourierId: '',
      shippingCourierFeeRate: settings.defaultCourierCommissionRate ?? 30,
      deliveryCourierId: '',
      deliveryCourierFee: settings.defaultDeliveryFee ?? 4000,
      deliveryCourierFeeCurrency: settings.currency || 'YER',
      orderCurrency,
      currency: orderCurrency,
      exchangeRate: 1,
      exchangeRateYER: dbRates[orderCurrency] || 1,
      exchangeRateUSD: dbRates['USD'] || 1,
      bankCommissionRate: settings.defaultBankCommissionRate ?? 3,
      companyProfitRate: settings.defaultCompanyProfitRate ?? 12,
      packagingFee: settings.defaultPackagingFee ?? 0,
      sheinRedPrice: 0,
      amountPaid: 0,
      paymentMethod: 'Cash',
      notes: '',
      deductSourcingCostFromCourier: false,
      sourcing_cost: 'system',
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
        id: Math.random().toString(36).substr(2, 9),//مهم: يجب تغييرها الى تسلسل مرتب
        shippingType: 'بري',
        shippingCompany: 'Aramex',
        shippingSource: '',
        shippingDestination: '',
        shippingDate: '',
        shippingDuration: '',
        expectedArrival: '',
        deliveryDate: '',
        shippingCost: 0,
        packagingFees: 0,
        contentCategoryId: '',
        contentCategoryName: '',
        cartonCount: 0,
        customsFee: 0,
        taxFee: 0,
        otherCategoryFee: 0,
        categoryFeesTotal: 0,
        categoryFeeCurrency: 'SAR'
      }
    ]);
    // إعادة تعيين الخيارات الجديدة الثلاثة عند إغلاق النموذج
    // Reset three new feature checkboxes when form is reset
    setHomeDeliveryEnabled(false);
    setPayLater(false);
    setDirectApprove(false);
  };

  // Delete Orders with Admin PIN Verification. The SQL procedure executes all dependent deletes atomically.
  const openOrderDeletionModal = (candidates: any[]) => {
    if (role !== 'Admin') {
      toast.error(isAr ? 'حذف الطلبات مخصص للمدراء فقط.' : 'Order deletion is restricted to administrators.');
      return;
    }
    const uniqueCandidates = [...new Map(candidates.filter(Boolean).map((order) => [String(order.id), order])).values()];
    if (!uniqueCandidates.length) return;
    setOrdersPendingDelete(uniqueCandidates);
    setOrderToDelete(uniqueCandidates[0]);
    setDeletePin('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };
  const handleDeleteOrderClick = (order: any) => openOrderDeletionModal([order]);
  const handleOpenBatchDelete = () => openOrderDeletionModal(orders.filter((order) => selectedOrderIds.includes(String(order.id))));

  // حذف الطلبات من قاعدة البيانات: لا تنفذ الواجهة أي حذف مباشر لجدول orders.
  const executeDeleteOrder = async () => {
    const targets = ordersPendingDelete.length ? ordersPendingDelete : orderToDelete ? [orderToDelete] : [];
    if (!targets.length) return;
    try {
      setIsBatchUpdating(true);
      const result: OrderDeletionSummary = await deleteOrdersWithDependents(targets.map((order) => String(order.id)));

      // تبقى activity_logs عمدًا، ويضاف لها أثر تشغيلي جديد لا يعتمد على سجل الطلب المحذوف.
      targets.forEach((order) => {
        activityLogService.log('delete_order', order.orderNumber || order.id, {
          customerName: order.customerName,
          totalCostYER: order.totalCostYER,
          cascadeDeletion: result,
        });
      });

      notificationService.notify({
        title: isAr ? 'تم حذف الطلبات' : 'Orders deleted',
        message: isAr
          ? `تم حذف ${result.orders} طلبًا مع ${result.shipments} شحنة و${result.journalEntries} قيدًا مرتبطًا.`
          : `${result.orders} orders, ${result.shipments} shipments, and ${result.journalEntries} linked entries were deleted.`,
        type: 'warning',
        category: 'order'
      });

      setSelectedOrderIds((previous) => previous.filter((id) => !targets.some((order) => String(order.id) === String(id))));
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      setOrdersPendingDelete([]);
      setDeletePin('');
      setDeleteError('');
    } catch (err: any) {
      const message = err?.message || (isAr ? 'تعذر حذف الطلبات المحددة.' : 'Unable to delete the selected orders.');
      setDeleteError(isAr ? `فشل حذف الطلبات: ${message}` : `Order deletion failed: ${message}`);
    } finally {
      setIsBatchUpdating(false);
    }
  };
  // التحقق من رمز الـ PIN لحذف الطلب أو مجموعة الطلبات.
  const handleVerifyDeletePin = () => {
    const systemPin = profile?.systemPin || '000000';
    if (deletePin.trim() === systemPin.trim()) executeDeleteOrder();
    else setDeleteError(isAr ? 'رمز الـ PIN غير صحيح' : 'Invalid security PIN');
  };

  // Nested quick-add customer
  // مهم: يتم استخدام نموذج انشاء عميل من واجهة العملاء  "../page/Customers.tsx" مع تعديلات طفيفه وعدم تكرار الاكواد هنا مره اخرى
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!customerFormData.fullName || !customerFormData.phone) return;

    setIsSubmitting(true);
    try {
      // Step 1: Create the customer document
      const { accountCode, code, accountId } =
        await financialAccountService.getNextAccountIdentifiers('customer');
      const newId = 'cust_' + accountCode;
      const docRef = await addDoc(newId, collection(db, 'customers'), {
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
  // مهم: يتم استخدام نموذج انشاء مصدر من واجهة المصادر "../page/Sources.tsx" مع تعديلات طفيفه وعدم تكرار الاكواد هنا مره اخرى
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!sourceFormData.source_name) return;

    setIsSubmitting(true);
    try {
      const srcId2 = 'source_' + sourceFormData.source_name
      const account = await financialAccountService.createAccountForEntity(
        'source',
        srcId2,
        sourceFormData.source_name,
        settings.currency || orderCurrency || 'YER',
        undefined,
        { accountPrefix: '2140', parentCode: '2140', accountType: 'Liability', notes: `حساب ذمم مصدر طلبات: ${sourceFormData.source_name}`, updateEntity: false },
      );
      const docRef = await addDoc(srcId2, collection(db, 'sources'), {
        name: sourceFormData.source_name,
        source_name: sourceFormData.source_name,
        type: sourceFormData.type,
        source_url: sourceFormData.source_url,
        contact_info: sourceFormData.contact_info,
        location: sourceFormData.location,
        notes: sourceFormData.notes,
        accountId: account.id,
        financialAccountId: account.id,
        financialAccountCode: account.accountCode,
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
  // مهم: يتم استخدام نموذج انشاء شركة شحن من واجهة شركات الشحن "../page/ShippingCompanies.tsx" مع تعديلات طفيفه وعدم تكرار الاكواد هنا مره اخرى
  const handleAddShippingCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!shippingCompanyFormData.name) return;

    setIsSubmitting(true);
    try {
      const shippingCompanyId = 'shipping_comp_' + shippingCompanyFormData.name;
      const account = await financialAccountService.createAccountForEntity(
        'shipping_company',
        shippingCompanyId,
        shippingCompanyFormData.name,
        settings.currency || orderCurrency || 'YER',
        undefined,
        { accountPrefix: '2150', parentCode: '2150', accountType: 'Liability', notes: `حساب ذمم شركة شحن: ${shippingCompanyFormData.name}`, updateEntity: false },
      );
      const docRef = await addDoc(shippingCompanyId, collection(db, 'shipping_companies'), {
        name: shippingCompanyFormData.name,
        contact_person: shippingCompanyFormData.contact_person,
        phone: shippingCompanyFormData.phone,
        tracking_url: shippingCompanyFormData.tracking_url,
        address: shippingCompanyFormData.address,
        notes: shippingCompanyFormData.notes,
        accountId: account.id,
        financialAccountId: account.id,
        financialAccountCode: account.accountCode,
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

  // توافق مؤقت للاستدعاءات القديمة: لا توجد كتابة بديلة خارج المعاملة الذرية.
  const handleAddPayment = (e: React.FormEvent) => handleCollectPayment(e);

  // Update logistics status
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedOrder) return;

    setIsSubmitting(true);
    try {
      const currentStatus = selectedOrder.orderStatus || 'طلب معلق';
      const newStatus = updateFormData.orderStatus;
      const firedTriggers = selectedOrder.firedTriggers || [];
      const newFiredTriggers = [...firedTriggers];

      const currentStatusItem = getStatusByAny(
        selectedOrder.order_status_id || selectedOrder.orderStatusId || currentStatus,
      ) || orderStatusesList[0];
      const newStatusItem = getStatusByAny(newStatus) || orderStatusesList[0];

      const currentStageId = currentStatusItem?.id || 1;
      const newStageId = newStatusItem?.id || 1;
      const statusHistory = await orderHistoryService.listForContext({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        entityType: 'order',
        label: selectedOrder.orderNumber || selectedOrder.id,
      });
      const transitionPlan = planOrderStatusTransition(
        orderStatusesList,
        currentStageId,
        newStageId,
        getProcessedStatusIds(statusHistory),
      );
      if (!transitionPlan.allowed) {
        const messages: Record<string, string> = {
          same_status: isAr ? 'هذه الحالة مسجلة للطلب بالفعل؛ لن يعاد تنفيذ التحديث أو القيود.' : 'This status is already recorded for the order.',
          backward_transition: isAr ? 'لا يمكن إرجاع الطلب إلى مرحلة سابقة بعد تنفيذ مرحلة لاحقة.' : 'An order cannot move back to a previously passed stage.',
          status_previously_processed: isAr ? 'سبق تنفيذ هذه المرحلة للطلب وفق سجل التدقيق؛ تم منع التكرار.' : 'This stage was already processed according to the audit history.',
          unknown_status: isAr ? 'تعذر التحقق من ترتيب الحالة. يرجى مراجعة إعدادات المراحل.' : 'Unable to validate the status sequence. Please review stage settings.',
        };
        toast.error(messages[transitionPlan.reason || 'unknown_status']);
        return;
      }

      const remainingVal = parseFloat(selectedOrder.amountRemaining || '0');
      const courierId = updateFormData.deliveryCourierId || selectedOrder.deliveryCourierId;
      const shippingCourierId = updateFormData.shippingCourierId || selectedOrder.shippingCourierId;

      let extraUpdateFields: any = {};

      //مهم: استدعاء مرحله الطلب  بال id وليس الاسم
      const getStageIdByName = (statusName: string) => {
        const item = orderStatusesList.find(s => s.nameAr === statusName || s.nameEn === statusName || s.code === statusName);
        return item ? item.id : 0;
      };

      // Helper to check if a trigger should fire based on stage sequence
      //داله للتحقق من مرحله الطلب هل هي مطلوبه لترسيل الاشعار ام لا
      const shouldFire = (triggerId: string, minStatus: string) => {
        if (firedTriggers.includes(triggerId)) return false;
        if (newStatus === 'ملغي' || newStatusItem?.code === 'cancelled') return false;

        const minStageId = getStageIdByName(minStatus);
        return newStageId >= minStageId;
      };
      //مهم: يجب استدعاء حاله او مرحله الطلب بواسطه ال id مثل1 الاسم pending وليس "معلق"
      // Status change trigger - to prevent duplicate notifications
      const statusTriggerId = `status_notified_${newStatus}`;
      const isAlreadyNotified = firedTriggers.includes(statusTriggerId);
      const selectedOrderParty = findOrderParty(selectedOrder, customers, employees, couriers);
      const selectedOrderPartyRaw = selectedOrderParty?.raw || null;
      const selectedOrderAccountId = selectedOrder.orderPartyAccountId
        || selectedOrder.order_party_account_id
        || selectedOrderParty?.financialAccountId
        || selectedOrderPartyRaw?.financialAccountId
        || selectedOrderPartyRaw?.accountId
        || null;

      // Pending Portal Order Approval Trigger (order_charge & order_down_payment)
      if ((currentStatus === 'معلق' || selectedOrder.status === 'pending') && newStatus !== 'معلق' && newStatus !== 'ملغي') {
        const customerRecord = selectedOrderPartyRaw;
        if (customerRecord && selectedOrderAccountId) {
          try {
            if (!firedTriggers.includes('order_charge')) {
              const totalBilledOriginal = parseFloat(selectedOrder.totalCostYER || selectedOrder.totalOrderYER || '0');
              const convertedOrderAmount = financialAccountService.convertToDefaultCurrency(
                totalBilledOriginal,
                'YER',
                settings.currency || 'YER',
                dbRates
              );

              await financialAccountService.triggerAutomaticVoucher(
                'order_charge',
                selectedOrder,
                {
                  customer: customerRecord,
                  orderParty: selectedOrderParty,
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
                dbRates
              );

              await financialAccountService.triggerAutomaticVoucher(
                'order_down_payment',
                selectedOrder,
                {
                  customer: customerRecord,
                  orderParty: selectedOrderParty,
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
          const exchangeRate = parseFloat(selectedOrder.exchangeRateYER || dbRates.SAR || 1);
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
              buildOrderRates(selectedOrder)
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
              await addDoc(commissionNumber, collection(db, 'expenses'), commissionPayload);
            }

            if (linkedAccountId) {
              try {
                await financialAccountService.triggerAutomaticVoucher('courier_commission', selectedOrder, {
                  courier: courierRecord,
                  orderParty: selectedOrderParty,
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
          { USD: selectedOrder.exchangeRateUSD || dbRates.USD, SAR: selectedOrder.exchangeRateYER || dbRates.SAR }
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
          await addDoc(expenseNumber, collection(db, 'expenses'), custodyPayload);
        }

        const customerRecord = selectedOrderPartyRaw;
        if (linkedAccountId && selectedOrderAccountId) {
          try {
            await financialAccountService.triggerAutomaticVoucher('custody_payment', selectedOrder, {
              courier: { financialAccountId: linkedAccountId, financialAccountCode: linkedAccountCode },
              customer: customerRecord,
              orderParty: selectedOrderParty,
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
      const deliveryFee = parseFloat(selectedOrder.deliveryCourierFee || '0');
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
          { USD: selectedOrder.exchangeRateUSD || dbRates.USD, SAR: selectedOrder.exchangeRateYER || dbRates.SAR }
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
          await addDoc(wageNumber, collection(db, 'expenses'), wagePayload);
        }

        if (linkedAccountId) {
          try {
            await financialAccountService.triggerAutomaticVoucher('delivery_wage', selectedOrder, {
              courier: { financialAccountId: linkedAccountId, financialAccountCode: linkedAccountCode },
              orderParty: selectedOrderParty,
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
            dbRates
          );

          await financialAccountService.triggerAutomaticVoucher('company_profit', selectedOrder, {
            orderParty: selectedOrderParty,
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

      // Execute automatic entries for every missed stage in order, not only the final stage.
      if (transitionPlan.stagesToProcess.length > 0) {
        try {
          const deliveryCourierRecord = couriers.find(c => c.id === courierId);
          const shippingCourierRecord = couriers.find(c => c.id === shippingCourierId);
          const courierRecord = deliveryCourierRecord || shippingCourierRecord;
          const customerRecord = selectedOrderPartyRaw;
          const purchaseSource = sources.find(source => source.id === selectedOrder.orderSourceId || source.id === selectedOrder.order_source_id);
          const shippingCompany = shippingCompanies.find(company =>
            company.id === selectedOrder.shippingCompanyId
            || company.id === selectedOrder.shipping_company_id
            || company.name === selectedOrder.shippingCompany,
          );
          for (const stage of transitionPlan.stagesToProcess) {
            await autoEntryService.executeAutoEntriesForStatus(stage.id, selectedOrder, {
              courier: courierRecord,
              deliveryCourier: deliveryCourierRecord,
              shippingCourier: shippingCourierRecord,
              customer: customerRecord,
              orderParty: selectedOrderParty,
              purchaseSource,
              shippingCompany,
              sourcing_cost: selectedOrder.sourcing_cost,
              isAr,
              profileName: profile?.fullName || 'User Logistics Update',
            });
          }
        } catch (autoErr) {
          console.warn('[Orders] Auto entry execution exception on status update:', autoErr);
        }
      }

      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        orderStatusId: String(newStatusItem?.id || '1'),
        order_status_id: newStatusItem?.id || 1,
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

      // Sync updateShippings to shipments collection
      if (updateShippings && updateShippings.length > 0) {
        for (const ship of updateShippings) {
          const shipId = ship.id || ('sh_' + Math.random().toString(36).substring(2, 11));
          await setDoc(doc(db, 'shipments', shipId), {
            id: shipId,
            orderId: selectedOrder.id,
            trackingNumber: ship.trackingNumber || selectedOrder.trackingNumber || selectedOrder.id,
            shippingCompanyId: ship.shippingCompany || selectedOrder.shippingCompany || 'Aramex',
            shippingCompany: ship.shippingCompany || selectedOrder.shippingCompany || 'Aramex',
            courierId: updateFormData.deliveryCourierId || updateFormData.shippingCourierId || selectedOrder.deliveryCourierId || '',
            shipmentStatus: updateFormData.orderStatus || ship.shipmentStatus || 'معلق  ',
            shippingCost: parseFloat(ship.shippingCost || 0),
            weight: parseFloat(ship.weight || 0),
            shippingCategoryId: ship.shippingCategoryId || '',
            shippingCategoryName: ship.shippingCategoryName || '',
            shippingCategoryPrice: parseFloat(ship.shippingCategoryPrice || 0),
            contentCategoryId: ship.contentCategoryId || '',
            contentCategoryName: ship.contentCategoryName || '',
            cartonCount: Math.max(0, parseFloat(ship.cartonCount || 0)),
            customsFee: Math.max(0, parseFloat(ship.customsFee || 0)),
            taxFee: Math.max(0, parseFloat(ship.taxFee || 0)),
            otherCategoryFee: Math.max(0, parseFloat(ship.otherCategoryFee || 0)),
            categoryFeesTotal: Math.max(0, parseFloat(ship.categoryFeesTotal || 0)),
            categoryFeeCurrency: ship.categoryFeeCurrency || 'SAR',
            shippingType: ship.shippingType || 'بري',
            shippingSource: ship.shippingSource || '',
            shippingDestination: ship.shippingDestination || '',
            shippingDate: ship.shippingDate || '',
            shippingDuration: ship.shippingDuration || '',
            expectedArrival: ship.expectedArrival || '',
            deliveryDate: ship.deliveryDate || '',
            packagingFees: parseFloat(ship.packagingFees || 0),
            updatedAt: Date.now()
          });
        }
      }

      activityLogService.log('edit_order', selectedOrder.orderNumber || selectedOrder.id, {
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber || selectedOrder.id,
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
  // اضافه صف جديد الى المنتجات
  const addItemRow = () => {
    setItems([...items, { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, length: 0, width: 0, height: 0, trackingNumber: '' }]);
  };
  // تعديل صف من المنتجات
  const updateItemRow = (idx: number, field: string, val: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };
  // حذف صف من المنتجات
  const removeItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  // Shipping details handling
  // اضافه صف جديد الى بيانات الشحنات
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
      packagingFees: 0,
      contentCategoryId: '',
      contentCategoryName: '',
      cartonCount: 0,
      customsFee: 0,
      taxFee: 0,
      otherCategoryFee: 0,
      categoryFeesTotal: 0,
      categoryFeeCurrency: 'SAR'
      // Note: deliveryDate is NOT stored per-row; it's shown in the order details view as a computed field
    }]);
    if (formData.orderSourceType === 'App') {
      setAddShippingEnabled(true);
    }
  };
  // تعديل صف بيانات الشحنات
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
  // تحديث  مدة الشحن عند تغيير نوع الشحن
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
  //  حساب تكلفة الشحن تلقائيا من المصنع ودمجها مع صف الشحن الرئيسي
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
  // حذف صف بيانات الشحن
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
  // اضافه صف جديد الى بيانات الشحنات
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
  // تعديل صف بيانات الشحن
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
  // حذف صف بيانات الشحن
  const removeUpdateShippingRow = (idx: number) => {
    setUpdateShippings(updateShippings.filter((_, i) => i !== idx));
  };




  // QR code rendering effect
  // رمز الاستجابة السريعة الخاص بالطلب
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

  //  نسخ رمز التتبع
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
  // تحديد متعدد
  const handleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrdersList.length && filteredOrdersList.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrdersList.map(o => o.id));
    }
  };
  // تحديد طلب واحد
  const handleToggleSelect = (id: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // ─── Modal Opener Helpers ────────────────────────────────────────────────────
  const handleOpenEditOrder = (ord: any) => {
    setOrderToEdit(ord);
    setIsEditOrderModalOpen(true);
  };

  const handleOpenUpdateStatus = (ord: any) => {
    setSelectedOrder(ord);
    setUpdateFormData({
      orderStatus: ord.orderStatus || ord.order_status || '',
      deliveryStatus: ord.deliveryStatus || 'في الانتظار',
      locationYemen: ord.locationYemen || 'مستودع صنعاء الرئيسي',
      internalNotes: ord.internalNotes || ord.notes || '',
      shippingCourierId: ord.shippingCourierId || ord.courier_id || '',
      deliveryCourierId: ord.deliveryCourierId || ''
    });
    setUpdateShippings(ord.shippingDetails || ord.shippings || []);
    setIsUpdateModalOpen(true);
  };

  const handleOpenCollectPayment = (ord: any) => {
    setSelectedOrder(ord);
    const ordCur = (ord.paidCurrency || ord.currency || ord.orderCurrency || 'YER').toUpperCase();
    setPaymentFormData({
      amount: String(ord.amountRemaining || ''),
      method: ord.paymentMethod || 'Cash',
      receivingAccountId: '',
      bankReference: '',
      allocations: [],
      notes: '',
      pin: '',
      paymentCurrency: ordCur
    });
    setIsPaymentModalOpen(true);
  };

  const handleOpenDeleteOrder = (ord: any) => openOrderDeletionModal([ord]);

  // تحصيل دفعة مالية من العميل
  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsSubmitting(true);
    try {
      const amountNum = parseFloat(paymentFormData.amount) || 0;
      if (amountNum <= 0) {
        toast.error(isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter valid amount');
        return;
      }
      const paymentCurrency = (paymentFormData.paymentCurrency || selectedOrder.paidCurrency || selectedOrder.currency || selectedOrder.orderCurrency || orderCurrency || 'YER').toUpperCase();
      const defaultOrderCurrency = String(selectedOrder.paidCurrency || selectedOrder.currency || selectedOrder.orderCurrency || 'YER').toUpperCase();

      // تحويل مبلغ الدفعة من عملة الدفع إلى عملة الطلب الأساسية لمقارنتها وتحديث أرصدة الطلب في قاعدة البيانات
      const orderPaymentAmountInOrderCurrency = paymentCurrency === defaultOrderCurrency
        ? amountNum
        : financialAccountService.convertToTargetCurrency(
          amountNum,
          paymentCurrency,
          defaultOrderCurrency,
          dbRates
        );

      // التحقق من أن مبلغ الدفعة بعملة الدفع لا يتجاوز المتبقي للطلب بعملة الدفع
      const remainingBeforePayment = parseFloat(selectedOrder.amountRemaining || 0);
      const orderRemainingInPaymentCurrency = paymentCurrency === defaultOrderCurrency
        ? remainingBeforePayment
        : financialAccountService.convertToTargetCurrency(
          remainingBeforePayment,
          defaultOrderCurrency,
          paymentCurrency,
          dbRates
        );

      if (amountNum > orderRemainingInPaymentCurrency + 0.05) {
        toast.error(
          isAr
            ? `المبلغ يتجاوز المتبقي للطلب (${orderRemainingInPaymentCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${paymentCurrency})`
            : `Amount exceeds remaining order balance (${orderRemainingInPaymentCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${paymentCurrency})`
        );
        return;
      }

      const currencyRecord = activeCurrencies.find((c: any) => String(c.code).toUpperCase() === paymentCurrency) || { cur_id: 1, code: paymentCurrency };
      const orderParty = findOrderParty(selectedOrder, customers, employees, couriers);
      const partyAccountId = selectedOrder.orderPartyAccountId || selectedOrder.order_party_account_id || orderParty?.financialAccountId || orderParty?.raw?.financialAccountId || orderParty?.raw?.accountId;
      const partyAccount = financialAccounts.find((account: any) => account.id === partyAccountId);
      if (paymentFormData.method === 'Deferred') {
        toast.error(isAr ? 'الدفع الآجل ليس قبضًا فعليًا؛ أنشئ سندًا آجلًا مستقلًا ثم سجل التحصيل عند الاستلام.' : 'Deferred payment is not a collection; record it in a separate deferred voucher.');
        return;
      }
      const rawAllocations = paymentFormData.method === 'Mixed'
        ? paymentFormData.allocations
        : [{ id: 'single', method: paymentFormData.method as 'Cash' | 'Bank', amount: String(amountNum), receivingAccountId: paymentFormData.receivingAccountId, bankReference: paymentFormData.bankReference }];
      if (!currencyRecord || !partyAccount || !rawAllocations.length) {
        toast.error(isAr ? 'حدد حساب الطرف وحساب أو حسابات التحصيل وعملة الدفع قبل التحصيل' : 'Select the party, collection account(s), and payment currency first');
        return;
      }
      const allocations = rawAllocations.map((allocation) => ({
        ...allocation,
        amount: Number(allocation.amount || 0),
        account: financialAccounts.find((account: any) => account.id === allocation.receivingAccountId),
        paymentMethod: allocation.method === 'Bank' ? 'bank' as FinancialPaymentMethod : 'cash' as FinancialPaymentMethod,
      }));
      if (allocations.some((allocation) => !allocation.account || allocation.amount <= 0)) {
        toast.error(isAr ? 'أكمل حساب ومبلغ كل توزيع تحصيل.' : 'Complete a positive amount and account for each allocation.');
        return;
      }
      if (paymentFormData.method === 'Mixed' && (allocations.length < 2 || Math.abs(allocations.reduce((sum, allocation) => sum + allocation.amount, 0) - amountNum) > 0.01)) {
        toast.error(isAr ? 'يجب أن يحتوي القبض المختلط على توزيعين على الأقل وأن يساوي مجموعهما مبلغ التحصيل.' : 'Mixed collection needs at least two allocations totaling the collection amount.');
        return;
      }
      if (allocations.some((allocation) => allocation.paymentMethod === 'bank' && !allocation.bankReference?.trim())) {
        toast.error(isAr ? 'أدخل مرجع كل حوالة بنكية.' : 'Enter a reference for each bank transfer.');
        return;
      }
      if (allocations.some((allocation) => allocation.paymentMethod === 'cash' && allocation.account.accSubId !== '111') || allocations.some((allocation) => allocation.paymentMethod === 'bank' && allocation.account.accSubId !== '112')) {
        toast.error(isAr ? 'يتطلب النقد حساب صندوق ويتطلب البنك حسابًا بنكيًا وفق شجرة الحسابات.' : 'Cash requires a cash-box account and bank requires a bank account.');
        return;
      }
      const paymentMethod: FinancialPaymentMethod = paymentFormData.method === 'Mixed' ? 'mixed' : allocations[0].paymentMethod;

      const lines = [
        ...allocations.map((allocation) => {
          const isSameCur = Number(allocation.account.curNo) === Number(currencyRecord.cur_id);
          const lineAmount = isSameCur
            ? Number(allocation.amount || 0)
            : financialAccountService.convertToTargetCurrency(
              Number(allocation.amount || 0),
              paymentCurrency,
              allocation.account.currency || 'YER',
              dbRates
            );
          return {
            accountId: allocation.account.id,
            accountCurNo: Number(allocation.account.curNo),
            currencyOriginalNo: Number(currencyRecord.cur_id),
            transType: 'Debit' as const,
            amount: lineAmount,
            amountOriginal: Number(allocation.amount || 0),
            paymentMethod: allocation.paymentMethod
          };
        }),
        {
          accountId: partyAccount.id,
          accountCurNo: Number(partyAccount.curNo),
          currencyOriginalNo: Number(currencyRecord.cur_id),
          transType: 'Credit' as const,
          amount: Number(partyAccount.curNo) === Number(currencyRecord.cur_id)
            ? Number(amountNum)
            : financialAccountService.convertToTargetCurrency(
              Number(amountNum),
              paymentCurrency,
              partyAccount.currency || 'YER',
              dbRates
            ),
          amountOriginal: Number(amountNum),
          entityType: selectedOrder.orderPartyType || 'customer',
          entityId: selectedOrder.orderPartyId || selectedOrder.customerId
        },
      ];

      await financialEntryService.recordOrderPayment(selectedOrder.id, orderPaymentAmountInOrderCurrency, {
        entryNumber: `RCPT-${selectedOrder.orderNumber || selectedOrder.id}-${Date.now().toString().slice(-6)}`,
        moduleId: 'module_orders',
        entryTypeId: 'type_order_payment',
        entryCategory: paymentMethod === 'mixed' ? 'Compound' : 'General',
        postingStatus: 'posted',
        description: `${isAr ? 'تحصيل دفعة للطلب' : 'Order payment collection'} ${selectedOrder.orderNumber || selectedOrder.id}`,
        notes: paymentFormData.notes || '',
        paymentMethod,
        orderId: selectedOrder.id,
        createdByUid: profile?.id || profile?.uid,
        lines,
        paymentDetails: allocations.map((allocation) => ({
          paymentMethod: allocation.paymentMethod === 'bank' ? 'bank' as const : 'cash' as const,
          accountId: allocation.account.id,
          amountOriginal: Number(allocation.amount || 0),
          bankReference: allocation.bankReference || ''
        })),
      }, profile?.id || profile?.uid);

      toast.success(isAr ? 'تم تحصيل الدفعة بنجاح' : 'Payment collected successfully');
      setIsPaymentModalOpen(false);
      setSelectedOrder(null);
      setPaymentFormData({ amount: '', method: 'Cash', receivingAccountId: '', bankReference: '', allocations: [], notes: '', pin: '', paymentCurrency: 'YER' });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error collecting payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // تحديث حالة الطلب
  const handleBatchUpdateStatus = async (newStatus: string) => {
    if (selectedOrderIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const promises = selectedOrderIds.map(async (orderId) => {
        // مهم: يجب استبدال البيانات الثابته للحالات بالحالات الموجوده في جدول حالات الطلب order_status 
        const defaultLocation = newStatus === 'وصل مستودع السعودية' ? 'مستودع السعودية للتعبئة' :
          newStatus === 'وصل مركز التوزيع في اليمن' ? 'مستودع صنعاء الرئيسي' : 'قيد النقل';

        const ord = orders.find(o => o.id === orderId);
        if (!ord) return;

        const firedTriggers = ord.firedTriggers || [];
        const newFiredTriggers = [...firedTriggers];

        const ordStatus = ord.orderStatus || 'معلق'; /*مهم: هنا يجب جلب اسم المرحله من جدول المراحل بناء على رقم المرحله*/
        const currentStatusItem = orderStatusesList.find(s => s.nameAr === ordStatus || s.nameEn === ordStatus);
        const newStatusItem = orderStatusesList.find(s => s.nameAr === newStatus || s.nameEn === newStatus) || orderStatusesList[0];

        const currentStageId = currentStatusItem?.id || 1;
        const newStageId = newStatusItem?.id || 1;

        const remainingVal = parseFloat(ord.amountRemaining || '0');
        const courierId = ord.deliveryCourierId;
        const shippingCourierId = ord.shippingCourierId;
        const orderParty = findOrderParty(ord, customers, employees, couriers);
        const orderPartyRaw = orderParty?.raw || null;
        const orderPartyAccountId = ord.orderPartyAccountId
          || ord.order_party_account_id
          || orderParty?.financialAccountId
          || orderPartyRaw?.financialAccountId
          || orderPartyRaw?.accountId
          || null;

        let extraUpdateFields: any = {};

        const getStageIdByName = (statusName: string) => {
          const item = orderStatusesList.find(s => s.nameAr === statusName || s.nameEn === statusName || s.code === statusName);
          return item ? item.id : 0;
        };

        const shouldFire = (triggerId: string, minStatus: string) => {
          if (firedTriggers.includes(triggerId)) return false;
          if (newStatus === 'ملغي' || newStatusItem?.code === 'cancelled') return false;
          const minStageId = getStageIdByName(minStatus);
          return newStageId >= minStageId;
        };

        // 1. courier_commission trigger
        if (shouldFire('courier_commission', 'وصل مركز التوزيع في اليمن') && shippingCourierId) {
          const courierRecord = couriers.find(c => c.id === shippingCourierId);
          if (courierRecord) {
            const isSourcing = courierRecord.courierType === 'sourcing';
            const exchangeRate = parseFloat(ord.exchangeRateYER || dbRates.SAR || 1);
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
                buildOrderRates(ord)
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
                await addDoc(commissionNumber, collection(db, 'expenses'), commissionPayload);
              }

              if (linkedAccountId) {
                try {
                  await financialAccountService.triggerAutomaticVoucher('courier_commission', ord, {
                    courier: courierRecord,
                    orderParty,
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
            { USD: ord.exchangeRateUSD || dbRates.USD, SAR: ord.exchangeRateYER || dbRates.SAR }
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
            await addDoc(expenseNumber, collection(db, 'expenses'), custodyPayload);
          }

          const customerRecord = orderPartyRaw;
          if (linkedAccountId && orderPartyAccountId) {
            try {
              await financialAccountService.triggerAutomaticVoucher('custody_payment', ord, {
                courier: { financialAccountId: linkedAccountId, financialAccountCode: linkedAccountCode },
                customer: customerRecord,
                orderParty,
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
            { USD: ord.exchangeRateUSD || dbRates.USD, SAR: ord.exchangeRateYER || dbRates.SAR }
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
            await addDoc(wageNumber, collection(db, 'expenses'), wagePayload);
          }

          if (linkedAccountId) {
            try {
              await financialAccountService.triggerAutomaticVoucher('delivery_wage', ord, {
                courier: { financialAccountId: linkedAccountId, financialAccountCode: linkedAccountCode },
                orderParty,
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
              dbRates
            );

            await financialAccountService.triggerAutomaticVoucher('company_profit', ord, {
              orderParty,
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

        if (newStatusItem?.id) {
          try {
            const courierRecord = couriers.find(c => c.id === ord.deliveryCourierId || c.id === ord.shippingCourierId);
            const customerRecord = orderPartyRaw;
            await autoEntryService.executeAutoEntriesForStatus(newStatusItem.id, ord, {
              courier: courierRecord,
              customer: customerRecord,
              orderParty,
              isAr,
              profileName: profile?.fullName || 'Batch Logistics Update'
            });
          } catch (autoErr) {
            console.warn('[Orders] Batch auto entry execution exception:', autoErr);
          }
        }

        await updateDoc(doc(db, 'orders', orderId), {
          orderStatusId: String(newStatusItem?.id || '2'),
          order_status_id: newStatusItem?.id || 2,
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
  // ── Shipments Management Studio Helpers ──
  const handleOpenOrderHistory = (order: any) => {
    setOrderHistoryContext({
      entityType: 'order',
      orderId: order.id,
      orderNumber: order.orderNumber || order.order_number || order.id,
      label: order.orderNumber || order.order_number || order.id
    });
    setIsOrderHistoryOpen(true);
  };

  const handleOpenShipmentHistory = (shipment: any) => {
    const orderReference = shipment.orderId || shipment.order_id || '';
    const linkedOrder = orders.find((order) => order.id === orderReference || order.orderNumber === orderReference || order.order_number === orderReference);
    setOrderHistoryContext({
      entityType: 'shipment',
      shipmentId: shipment.id,
      orderId: linkedOrder?.id,
      orderNumber: linkedOrder?.orderNumber || linkedOrder?.order_number || orderReference,
      label: shipment.trackingNumber || shipment.tracking_number || shipment.id
    });
    setIsOrderHistoryOpen(true);
  };

  // اضافة شحنه جديده
  const handleOpenAddShipmentModal = () => {
    setShipmentFormData({
      id: '',
      orderId: '',
      trackingNumber: '',
      shippingCompany: 'no',
      shippingCompanyId: 'no',
      courierId: '',
      shippingType: 'بري',
      shippingSource: '',
      shippingDestination: 'اليمن',
      shipmentStatus: 'في الانتظار',
      shippingCost: 0,
      weight: 0,
      packagingFees: 0,
      shippingCategoryId: '',
      shippingCategoryName: '',
      shippingCategoryPrice: 0,
      shippingDate: new Date().toISOString().split('T')[0],
      shippingDuration: '15',
      expectedArrival: '',
      deliveryDate: '',
      notes: '',
      contentCategoryId: '',
      contentCategoryName: '',
      cartonCount: 0,
      customsFee: 0,
      taxFee: 0,
      otherCategoryFee: 0,
      categoryFeesTotal: 0,
      categoryFeeCurrency: 'SAR'
    });
    setIsAddShipmentModalOpen(true);
  };
  // تعديل بيانات الشحنه
  const handleOpenEditShipmentModal = (shipment: any) => {
    setShipmentToEdit(shipment);
    setShipmentFormData({
      id: shipment.id,
      orderId: shipment.orderId || shipment.order_id || '',
      trackingNumber: shipment.trackingNumber || shipment.tracking_number || '',
      shippingCompany: shipment.shippingCompany || shipment.shipping_company_id || 'no',
      shippingCompanyId: shipment.shippingCompanyId || shipment.shipping_company_id || 'no',
      courierId: shipment.courierId || shipment.courier_id || '',
      shippingType: shipment.shippingType || 'بري',
      shippingSource: shipment.shippingSource || '',
      shippingDestination: shipment.shippingDestination || 'اليمن',
      shipmentStatus: shipment.shipmentStatus || shipment.status || 'في الانتظار',
      shippingCost: shipment.shippingCost || 0,
      weight: shipment.weight || 0,
      packagingFees: shipment.packagingFees || 0,
      shippingCategoryId: shipment.shippingCategoryId || shipment.shipping_category_id || '',
      shippingCategoryName: shipment.shippingCategoryName || '',
      shippingCategoryPrice: shipment.shippingCategoryPrice || 0,
      shippingDate: shipment.shippingDate || '',
      shippingDuration: shipment.shippingDuration || '15',
      expectedArrival: shipment.expectedArrival || '',
      deliveryDate: shipment.deliveryDate || '',
      notes: shipment.notes || '',
      contentCategoryId: shipment.contentCategoryId || shipment.content_category_id || '',
      contentCategoryName: shipment.contentCategoryName || '',
      cartonCount: shipment.cartonCount || shipment.carton_count || 0,
      customsFee: shipment.customsFee || shipment.customs_fee || 0,
      taxFee: shipment.taxFee || shipment.tax_fee || 0,
      otherCategoryFee: shipment.otherCategoryFee || shipment.other_category_fee || 0,
      categoryFeesTotal: shipment.categoryFeesTotal || shipment.category_fees_total || 0,
      categoryFeeCurrency: shipment.categoryFeeCurrency || shipment.category_fee_currency || ''
    });
    setIsEditShipmentModalOpen(true);
  };
  // حفظ بيانات الشحنه
  const handleSaveShipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentFormData.trackingNumber) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'يرجى إدخال رقم التتبع للشحنة' : 'Please enter tracking number',
        type: 'error'
      });
    }

    setIsSubmitting(true);
    try {
      const shipId = shipmentFormData.id || ('sh_' + Math.random().toString(36).substring(2, 11));
      const contentCategory = activeItemCategories.find((category) => category.id === shipmentFormData.contentCategoryId);
      const categoryFees = calculateShipmentCategoryFees(contentCategory, shipmentFormData.cartonCount);
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
        shippingCategoryId: shipmentFormData.shippingCategoryId || '',
        shippingCategoryName: shipmentFormData.shippingCategoryName || '',
        shippingCategoryPrice: parseFloat(shipmentFormData.shippingCategoryPrice as any) || 0,
        shippingType: shipmentFormData.shippingType,
        shippingSource: shipmentFormData.shippingSource,
        shippingDestination: shipmentFormData.shippingDestination,
        shippingDate: shipmentFormData.shippingDate,
        shippingDuration: shipmentFormData.shippingDuration,
        expectedArrival: shipmentFormData.expectedArrival,
        deliveryDate: shipmentFormData.deliveryDate,
        notes: shipmentFormData.notes,
        contentCategoryId: shipmentFormData.contentCategoryId || '',
        contentCategoryName: shipmentFormData.contentCategoryName || '',
        cartonCount: categoryFees.cartonCount,
        customsFee: categoryFees.customsFee,
        taxFee: categoryFees.taxFee,
        otherCategoryFee: categoryFees.otherCategoryFee,
        categoryFeesTotal: categoryFees.total,
        categoryFeeCurrency: categoryFees.currency,
        createdAt: shipmentToEdit?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'shipments', shipId), payload);

      notificationService.notify({
        title: isAr ? 'تم الحفظ' : 'Saved',
        message: isAr ? 'تم حفظ سجل الشحنة بنجاح' : 'Shipment record saved successfully',
        type: 'success'
      });

      setIsAddShipmentModalOpen(false);
      setIsEditShipmentModalOpen(false);
      setShipmentToEdit(null);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: err.message || 'Could not save shipment',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  // تعديل حالة الشحنه بسرعة
  const handleQuickShipmentStatusChange = async (shipmentId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'shipments', shipmentId), {
        shipmentStatus: newStatus,
        updatedAt: Date.now()
      });
      notificationService.notify({
        title: isAr ? 'تم تحديث الحالة' : 'Status Updated',
        message: isAr ? `تم تعديل حالة الشحنة إلى: ${newStatus}` : `Shipment status updated to: ${newStatus}`,
        type: 'success'
      });
    } catch (err: any) {
      console.error('Failed to quick update shipment status:', err);
    }
  };
  // حذف بيانات الشحنه
  const handleDeleteShipmentSubmit = async () => {
    if (!shipmentToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shipments', shipmentToDelete.id));
      notificationService.notify({
        title: isAr ? 'تم الحذف' : 'Deleted',
        message: isAr ? 'تم حذف سجل الشحنة بنجاح' : 'Shipment record deleted',
        type: 'success'
      });
      setIsDeleteShipmentModalOpen(false);
      setShipmentToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete shipment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered shipments list for Shipments Studio tab
  const filteredShipmentsList = useMemo(() => {
    return allShipments.filter(sh => {
      const trk = String(sh.trackingNumber || sh.tracking_number || '').toLowerCase();
      const ordId = String(sh.orderId || sh.order_id || '').toLowerCase();
      const q = shipmentSearchQuery.trim().toLowerCase();

      if (q && !trk.includes(q) && !ordId.includes(q)) return false;
      if (shipmentStatusFilter !== 'all' && (sh.shipmentStatus || sh.status) !== shipmentStatusFilter) return false;
      if (shipmentCarrierFilter !== 'all' && (sh.shippingCompany || sh.shipping_company_id) !== shipmentCarrierFilter) return false;
      if (shipmentCourierFilter !== 'all' && (sh.courierId || sh.courier_id) !== shipmentCourierFilter) return false;

      return true;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allShipments, shipmentSearchQuery, shipmentStatusFilter, shipmentCarrierFilter, shipmentCourierFilter]);

  //اريد اضافه جدول مخصص لحالات الطلب في قاده البيانات وضافه واجهه مخصصه لاداره الحالات 
  // مهم:يجب استبدال الداتا الثابته للحالات بالبيانات الموجوده بجدول الحالات order_status
  // const formatStatusLabel = (status: string) => {
  //   const translationAr: Record<string, string> = {
  //     'تم تسجيل الطلب': 'تم تسجيل الطلب',
  //     'وصل مستودع السعودية': 'وصل مستودع السعودية',
  //     'جاري الشحن لليمن': 'جاري الشحن لليمن',
  //     'في التخليص الجمركي': 'في التخليص الجمركي',
  //     'وصل مركز التوزيع في اليمن': 'وصل مركز التوزيع في اليمن',
  //     'مع المندوب للتوصيل': 'مع المندوب للتوصيل',
  //     'تم التسليم': 'تم التسليم',
  //     'ملغي': 'ملغي'
  //   };
  //   return isAr ? (translationAr[status] || status) : status;
  // };

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





  // إثراء قائمة الطلبات ببيانات العميل والمصدر من المصفوفات المحملة مسبقاً
  // Enrich each order with customer name/phone and source name from loaded arrays
  const enrichedOrders = orders.map(o => {
    const partyId = o.orderPartyId || o.order_party_id || o.customerId || o.customer_id;
    const partyType = o.orderPartyType || o.order_party_type || 'customer';
    let partyName = '';
    let partyPhone = '';
    let partyAddress = '';
    if (partyType === 'employee') {
      const emp = employees.find((e: any) => e.id === partyId);
      partyName = emp?.fullName || emp?.name || '';
      partyPhone = emp?.phone || '';
      partyAddress = emp?.address || '';
    } else if (partyType === 'courier') {
      const cou = couriers.find((c: any) => c.id === partyId);
      partyName = cou?.fullName || cou?.name || '';
      partyPhone = cou?.phone || '';
    } else {
      const custId = o.customerId || o.customer_id || partyId;
      const cust = customers.find((c: any) => c.id === custId);
      partyName = cust?.fullName || cust?.name || '';
      partyPhone = cust?.phone || cust?.mobile || '';
      partyAddress = cust?.address || '';
    }
    const srcId = o.orderSourceId || o.order_source_id;
    const src = sources.find((s: any) => s.id === srcId);
    const srcName = src?.name || o.orderSourceType || o.order_source_type || '';
    return {
      ...o,
      // عرض بيانات الطرف والعميل ديناميكياً من الجداول المرتبطة
      customerName: partyName || o.customerName || '',
      customerPhone: partyPhone || o.customerPhone || '',
      customerAddress: partyAddress || o.customerAddress || '',
      // عرض اسم المصدر ديناميكياً من جدول المصادر
      orderSourceName: srcName,
      // أعمدة مباشرة للاستعلام
      customerId: o.customerId || o.customer_id || '',
      orderPartyId: o.orderPartyId || o.order_party_id || '',
      orderPartyType: o.orderPartyType || o.order_party_type || 'customer',
      isStaffOrder: o.isStaffOrder ?? o.is_staff_order ?? false,
      employeeId: o.employeeId || o.employee_id || '',
      courierId: o.courierId || o.courier_id || '',
      orderPartyAccountId: o.orderPartyAccountId || o.order_party_account_id || '',
      orderSourceId: o.orderSourceId || o.order_source_id || '',
      orderSourceType: o.orderSourceType || o.order_source_type || '',
      deliveryCourierId: o.deliveryCourierId || o.delivery_courier_id || '',
      shippingCourierId: o.shippingCourierId || o.shipping_courier_id || '',
    };
  });

  const filteredOrdersList = enrichedOrders
    .filter(o => {
      const num = String(o.orderNumber || o.order_number || '').toUpperCase();
      const customer = String(o.customerName || '').toLowerCase();
      const phone = String(o.customerPhone || '');
      const track = String(o.trackingNumber || o.tracking_number || '').toUpperCase();
      const q = searchText.toLowerCase();

      const matchSearch = num.includes(q.toUpperCase()) || customer.includes(q) || phone.includes(searchText) || track.includes(q.toUpperCase());
      const matchStatus = statusFilter === 'all' || String(o.order_status_id || o.orderStatusId) === String(statusFilter) || o.orderStatus === statusFilter;

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
  // اشعار تحميل الطلبات
  if (loading || roleLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 font-bold">
        {isAr ? 'جاري تحميل الطلبات...' : 'Loading logistic ledger...'}
      </div>
    );
  }

  // Page Guard: requires view_orders
  // اشعار عدم صلاحية عرض الطلبات
  if (role !== 'Admin' && !hasPermission('view_orders')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-800 shadow-xl text-center select-none">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide">{isAr ? 'وصول مقيد' : 'Access Denied'}</h2>
        <p className="text-slate-500 max-w-md">{isAr ? 'لا تملك صلاحية عرض الطلبات. تواصل مع مديرك لطلب الصلاحية.' : 'You do not have permission to view orders. Contact your administrator.'}</p>
      </div>
    );
  }

  // واجهة المستخدم لعرض الطلبات
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
              {isAr ? 'ادارة الطلبات • ادارة الشحنات  • تتبع الطلبات • اداره مراحل الطلب والقيود التلقائيه ' : 'Invoice maker • Ledger & Profit divisions'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {(role === 'Admin' || hasPermission('print_orders')) && (
            <button
              onClick={() => exportOrdersToPDF(filteredOrdersList, isAr)}
              className="bg-slate-950 hover:bg-slate-900 border border-[#d4af37]/25 text-[#d4af37] px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" /> {isAr ? 'طباعة تقرير PDF' : 'PDF Report'}
            </button>
          )}

          {(role === 'Admin' || hasPermission('export_orders')) && (
            <button
              onClick={() => exportOrdersToCSV(filteredOrdersList, isAr)}
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
              <Plus className="w-4 h-4" /> {isAr ? 'طلب جديدة' : 'New Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Primary View Switcher Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setOrdersTab('orders')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'orders'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Package className="w-4 h-4" />
          {isAr ? '📦  الطلبات' : '📦 Orders & Invoices'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setOrdersTab('products')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'products'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Boxes className="w-4 h-4 text-emerald-400" />
          {isAr ? '🧾 المنتجات' : '🧾 Products'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">{allProducts.length}</span>
        </button>

        <button
          onClick={() => setOrdersTab('shipments')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'shipments'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Truck className="w-4 h-4" />
          {isAr ? '🚚 الشحنات' : '🚚 Shipments Management Studio'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
            {allShipments.length}
          </span>
        </button>

        {canTrackOrders && (
          <button
            onClick={() => setOrdersTab('tracking')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'tracking'
              ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
              }`}
          >
            <MapPin className="w-4 h-4" />
            {isAr ? '📍 التتبع' : '📍 Live Tracking & Telemetry'}
          </button>
        )}

        {canViewOrderStatuses && (
          <button
            onClick={() => setOrdersTab('statuses')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'statuses'
              ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
              }`}
          >
            <Layers className="w-4 h-4" />
            {isAr ? '⚙️ حالات الطلب والقيود التلقائية' : '⚙️ Order Statuses & Auto Rules'}
            <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
              {orderStatusesList.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setOrdersTab('options')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'options'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Package className="w-4 h-4 text-amber-400" />
          {isAr ? '✨التغليف وفئات الشحن' : '✨ Order Options (order_option)'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
            {orderOptionsList.length}
          </span>
        </button>

        <button
          onClick={() => setOrdersTab('item-categories')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${ordersTab === 'item-categories'
            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-102'
            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
            }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          {isAr ? '🏷️ فئات الأصناف' : '🏷️ Item Categories'}
          <span className="bg-black/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">{activeItemCategories.length}</span>
        </button>
      </div>

      {ordersTab === 'products' ? (
        <ProductsManagementTab isAr={isAr} canManage={canManageOrders} orderCurrency={orderCurrency} />
      ) : ordersTab === 'item-categories' ? (
        <ItemCategoriesManagementTab isAr={isAr} canManage={canManageOrders} />
      ) : ordersTab === 'options' ? (
        /* Order Options Management Tab (order_option) */
        <OrderOptionsManagementTab isAr={isAr} canManage={canManageOrders} orderCurrency={orderCurrency} />
      ) : ordersTab === 'statuses' ? (
        /* Order Statuses & Auto Entries Management Tab */
        <OrderStatusManagementTab isAr={isAr} />
      ) : ordersTab === 'tracking' ? (
        /* Live Tracking View */
        <div className="bg-[#121215] border border-slate-850 p-2 sm:p-6 rounded-3xl shadow-xl">
          <Tracking />
        </div>
      ) : ordersTab === 'shipments' ? (
        /* Shipments Management Studio View */
        <div className="space-y-6">
          {/* Shipments Studio Header Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase">{isAr ? 'إجمالي الشحنات' : 'Total Shipments'}</span>
                <span className="text-xl font-black text-white font-mono mt-0.5 block">{allShipments.length}</span>
              </div>
              <div className="p-3 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-2xl text-[#d4af37]">
                <Truck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase">{isAr ? 'شحنات جارية' : 'In-Transit'}</span>
                <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">
                  {allShipments.filter(s => (s.shipmentStatus || s.status) !== 'تم التسليم' && (s.shipmentStatus || s.status) !== 'ملغي').length}
                </span>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase">{isAr ? 'شحنات سلمت' : 'Delivered'}</span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
                  {allShipments.filter(s => (s.shipmentStatus || s.status) === 'تم التسليم').length}
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase">{isAr ? 'شحنات مستقلة (بدون طلب)' : 'Standalone Shipments'}</span>
                <span className="text-xl font-black text-cyan-400 font-mono mt-0.5 block">
                  {allShipments.filter(s => !s.orderId && !s.order_id).length}
                </span>
              </div>
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Shipments Studio Toolbar */}
          <div className="bg-[#121215] border border-slate-850 p-4 rounded-3xl flex flex-wrap justify-between items-center gap-3">
            <div className="flex flex-wrap gap-2 items-center flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-500 absolute top-3 right-3" />
                <input
                  type="text"
                  value={shipmentSearchQuery}
                  onChange={(e) => setShipmentSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث برقم التتبع أو كود الطلب...' : 'Search by tracking or order code...'}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Status Filter */}
              <select
                value={shipmentStatusFilter}
                onChange={(e) => setShipmentStatusFilter(e.target.value)}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                {orderStatusesList.map(st => (
                  <option key={st.id} value={st.nameAr}>{isAr ? st.nameAr : st.nameEn}</option>
                ))}
              </select>

              {/* Carrier Filter */}
              <select
                value={shipmentCarrierFilter}
                onChange={(e) => setShipmentCarrierFilter(e.target.value)}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">{isAr ? 'جميع شركات الشحن' : 'All Carriers'}</option>
                {shippingCompanies.map(sc => (
                  <option key={sc.id} value={sc.name}>{sc.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenAddShipmentModal}
              className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'إضافة شحنة جديدة' : 'Add New Shipment'}
            </button>
          </div>

          {/* Shipments Table */}
          <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-black/50 text-slate-400 font-bold border-b border-slate-850">
                    <th className="p-4">{isAr ? 'رقم التتبع والحالة' : 'Tracking & Status'}</th>
                    <th className="p-4">{isAr ? 'الطلب / العميل' : 'Order & Customer'}</th>
                    <th className="p-4">{isAr ? 'الناقل والمندوب' : 'Carrier & Courier'}</th>
                    <th className="p-4">{isAr ? 'الوزن والتكلفة' : 'Weight & Cost'}</th>
                    <th className="p-4">{isAr ? 'التواريخ والمتوقع' : 'Dates'}</th>
                    <th className="p-4 text-center">{isAr ? 'إجراءات التحكم' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {filteredShipmentsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-500 font-bold">
                        {isAr ? 'لا توجد شحنات مطابقة للبحث' : 'No shipments found matching filters'}
                      </td>
                    </tr>
                  ) : (
                    filteredShipmentsList.map((ship) => {
                      const linkedOrd = orders.find(o => o.id === (ship.orderId || ship.order_id) || o.orderNumber === (ship.orderId || ship.order_id));
                      const carrierName = ship.shippingCompany || ship.shipping_company_id || 'Aramex';
                      const courierRecord = couriers.find(c => c.id === (ship.courierId || ship.courier_id));
                      const statusVal = ship.shipmentStatus || ship.status || 'في الانتظار';

                      return (
                        <tr key={ship.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4">
                            <div className="font-mono font-black text-white text-xs flex items-center gap-1.5">
                              <span>{ship.trackingNumber || ship.tracking_number || ship.id}</span>
                              <button
                                onClick={() => copyToClipboard(ship.trackingNumber || ship.tracking_number)}
                                className="text-slate-500 hover:text-[#d4af37] transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                            <span className={`mt-1 inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusVal === 'تم التسليم' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                              statusVal === 'ملغي' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                                'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30'
                              }`}>
                              {statusVal}
                            </span>
                          </td>

                          <td className="p-4">
                            {linkedOrd ? (
                              <div>
                                <span className="font-mono font-black text-[#d4af37] text-xs block">
                                  {linkedOrd.orderNumber || linkedOrd.id}
                                </span>
                                <span className="text-slate-300 font-bold block text-[11px]">
                                  {linkedOrd.customerName || 'عميل'}
                                </span>
                              </div>
                            ) : (
                              <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                🔗 {isAr ? 'شحنة مستقلة' : 'Standalone Shipment'}
                              </span>
                            )}
                          </td>

                          <td className="p-4">
                            <span className="font-bold text-white block">{carrierName}</span>
                            <span className="text-[10px] text-slate-500 font-bold block">
                              {courierRecord ? courierRecord.fullName : (isAr ? 'غير محدد' : 'Unassigned')}
                            </span>
                          </td>

                          <td className="p-4 font-mono">
                            <div className="text-slate-200 font-bold">
                              ⚖️ {ship.weight || 0} <span className="text-[10px] text-slate-500">KG</span>
                            </div>
                            <div className="text-emerald-400 text-[11px] font-bold">
                              💰 {ship.shippingCost || 0} <span className="text-[10px] text-slate-500">SAR</span>
                            </div>
                          </td>

                          <td className="p-4 text-[11px] text-slate-400">
                            <div>📅 {ship.shippingDate || '—'}</div>
                            {ship.expectedArrival && (
                              <div className="text-[#d4af37]">⏳ المتوقع: {ship.expectedArrival}</div>
                            )}
                          </td>

                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-1.5">
                              {/* Quick status updater */}
                              <select
                                value={statusVal}
                                onChange={(e) => handleQuickShipmentStatusChange(ship.id, e.target.value)}
                                className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-bold p-1 outline-none cursor-pointer"
                              >
                                {orderStatusesList.map(st => (
                                  <option key={st.id} value={st.nameAr}>{isAr ? st.nameAr : st.nameEn}</option>
                                ))}
                              </select>

                              <button
                                onClick={() => handleOpenEditShipmentModal(ship)}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                                title={isAr ? 'تعديل الشحنة' : 'Edit Shipment'}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                              </button>

                              <button
                                onClick={() => handleOpenShipmentHistory(ship)}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                                title={isAr ? 'السجل المالي والتشغيلي للشحنة' : 'Shipment activity ledger'}
                              >
                                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                              </button>

                              <button
                                onClick={() => {
                                  setShipmentToDelete(ship);
                                  setIsDeleteShipmentModalOpen(true);
                                }}
                                className="p-1.5 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/30 text-rose-400 hover:text-white rounded-lg transition"
                                title={isAr ? 'حذف الشحنة' : 'Delete Shipment'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
        // orders list with filters
        : (
          /* Orders View & Filters */
          <>
            {/* Stats Quick Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { title: isAr ? 'الطلبات النشطة اليوم' : 'Active Orders Today', val: orders.filter(o => o.orderStatus !== 'تم التسليم' && o.orderStatus !== 'ملغي').length, color: 'text-[#d4af37] bg-[#d4af37]/10' },
                { title: isAr ? 'بانتظار التوزيع لليمن' : 'In Local Dist', val: orders.filter(o => o.orderStatus === 'وصل مركز التوزيع في اليمن').length, color: 'text-amber-400 bg-amber-950/20' },
                { title: isAr ? 'شحنات سلمت بنجاح' : 'Delivered Ledger', val: orders.filter(o => o.orderStatus === 'تم التسليم').length, color: 'text-emerald-400 bg-emerald-950/20' },
                { title: isAr ? 'مبالغ معلقة للتحصيل' : 'Remaining To Collect', val: orders.reduce((sum, o) => sum + financialAccountService.convertToDefaultCurrency(parseFloat(o.amountRemaining || '0'), o.currency || 'YER', settings.currency || 'YER', { USD: o.exchangeRateUSD || dbRates.USD, SAR: o.exchangeRateSAR || dbRates.SAR }), 0).toLocaleString() + ' ' + (settings.currency || 'YER'), color: 'text-rose-400 bg-rose-950/20' }
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
                  {orderStatusesList.map(st => (
                    <option key={st.id} value={String(st.id)}>{isAr ? st.nameAr : st.nameEn}</option>
                  ))}
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


              {/* Batch Actions Bar */}
              {selectedOrderIds.length > 0 && (
                <div className="p-3 bg-[#d4af37]/10 border-b border-[#d4af37]/20 flex flex-wrap items-center justify-between gap-3 text-xs font-bold animate-fade-in">
                  <div className="flex items-center gap-2 text-white">
                    <span className="bg-[#d4af37] text-black px-2.5 py-0.5 rounded-lg font-mono font-black">
                      {selectedOrderIds.length}
                    </span>
                    <span>{isAr ? 'طلب محدد' : 'orders selected'}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        const selectedList = orders.filter(o => selectedOrderIds.includes(o.id));
                        exportOrdersToPDF(selectedList, isAr);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[#d4af37] rounded-xl flex items-center gap-1.5 text-xs transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {isAr ? 'طباعة المحددة (PDF)' : 'Print Selected'}
                    </button>

                    <button
                      onClick={() => {
                        const selectedList = orders.filter(o => selectedOrderIds.includes(o.id));
                        exportOrdersToCSV(selectedList, isAr);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 rounded-xl flex items-center gap-1.5 text-xs transition cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      {isAr ? 'تصدير المحددة (CSV)' : 'Export Selected'}
                    </button>

                    {role === 'Admin' && (
                      <button
                        onClick={handleOpenBatchDelete}
                        disabled={isBatchUpdating}
                        className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 rounded-xl flex items-center gap-1.5 text-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isAr ? `حذف المحددة (${selectedOrderIds.length})` : `Delete selected (${selectedOrderIds.length})`}
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedOrderIds([])}
                      className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition cursor-pointer"
                    >
                      {isAr ? 'إلغاء التحديد' : 'Deselect All'}
                    </button>
                  </div>
                </div>
              )}

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
                      <th className="p-4">{isAr ? 'الحالة اللوجيستية ' : 'Logistics Route'}</th>
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
                            {(() => {
                              const currentStatusItem = orderStatusesList.find(s => s.sortOrder == ord.order_status_id || s.sortOrder == ord.order_status_id || s.id == ord.order_status_id);
                              return (
                                <span className="px-2.5 py-0.5 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/5 text-[#d4af37] font-bold max-w-max text-[10px]">
                                  {ord.order_status_id + ' : ' + (isAr ? currentStatusItem?.nameAr : currentStatusItem?.nameEn) /*مهم: هنا يجب جلب اسم المرحله من جدول المراحل بناء على رقم المرحله*/}
                                </span>
                              );
                            })()}

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
                                  {isAr ? 'الإجمالي: ' : 'Total: '}{Math.ceil(totalFinal).toLocaleString()} <span className="text-[10px] text-slate-500"> {ord.currency}</span>
                                </div>
                                <div className="font-mono text-emerald-400 text-[11px]">
                                  {isAr ? 'المدفوع: ' : 'Paid: '}{Math.ceil(paidTotal).toLocaleString()} {ord.currency}
                                </div>
                                {Math.ceil(remainVal) > 0 ? (
                                  <div className="font-mono text-rose-455 text-[11px] font-bold">
                                    {isAr ? 'المتبقي: ' : 'Remaining: '}{Math.ceil(remainVal).toLocaleString()}  {ord.currency}
                                  </div>
                                ) : Math.ceil(remainVal) < 0 ? (
                                  <div className="font-mono text-amber-500 text-[11px] font-bold">
                                    {isAr ? 'فائض حساب: ' : 'Overpaid: '}{Math.abs(Math.ceil(remainVal)).toLocaleString()}  {ord.currency}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Eye - Details & Tracking Modal */}
                            <button
                              onClick={() => {
                                setSelectedOrder(ord);
                                setIsDetailsModalOpen(true);
                              }}
                              className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                              title={isAr ? 'عرض الكشف والتفاصيل' : 'Order Details'}
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            </button>

                            <button
                              onClick={() => handleOpenOrderHistory(ord)}
                              className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
                              title={isAr ? 'السجل المالي والتشغيلي للطلب' : 'Order activity ledger'}
                            >
                              <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            </button>

                            {/* Edit Order - Full Edit Modal */}
                            {canManageOrders && (
                              <button
                                onClick={() => handleOpenEditOrder(ord)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-[#d4af37] rounded-lg transition"
                                title={isAr ? 'تعديل بيانات الطلب بالكامل' : 'Edit Order Data'}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                              </button>
                            )}

                            {/* Update Status Modal */}
                            {canManageOrders && (
                              <button
                                onClick={() => handleOpenUpdateStatus(ord)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition"
                                title={isAr ? 'تحديث الحالة والمسارات' : 'Update Status'}
                              >
                                <Truck className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                            )}

                            {/* Collect Payment Modal */}
                            {canManageOrders && (
                              <button
                                onClick={() => handleOpenCollectPayment(ord)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"
                                title={isAr ? 'تحصيل دفعة مالية' : 'Collect Payment'}
                              >
                                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                              </button>
                            )}

                            {/* Print PDF Invoice */}
                            {(role === 'Admin' || hasPermission('print_orders')) && (
                              <button
                                onClick={() => generateOrderInvoicePDF(ord, isAr, settings)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-blue-400 rounded-lg transition"
                                title={isAr ? 'طباعة الكشف للفاتورة' : 'Print Invoice'}
                              >
                                <Printer className="w-3.5 h-3.5 text-blue-400" />
                              </button>
                            )}

                            {/* Delete Order Security Modal */}
                            {(role === 'Admin' || hasPermission('delete_orders')) && (
                              <button
                                onClick={() => handleOpenDeleteOrder(ord)}
                                className="p-1.5 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/30 text-rose-400 hover:text-white rounded-lg transition"
                                title={isAr ? 'حذف الطلب نهائياً' : 'Delete Order'}
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
        )}

      {/* CREATE ORDER LARGE MODAL واجهه نموذج انشاء طلب*/}
      <CreateOrderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        isAr={isAr}
        role={role}
        hasPermission={hasPermission}
        canEditOrderDefaultsCreation={canEditOrderDefaultsCreation}
        isSubmitting={isSubmitting}
        formData={formData}
        setFormData={setFormData}
        previewOrderNumber={previewOrderNumber}
        customerProfileStats={customerProfileStats}
        orderParties={orderParties}
        selectedOrderParty={selectedOrderParty}
        isStaffOrder={Boolean(formData.isStaffOrder)}
        setIsStaffOrder={setIsStaffOrder}
        selectOrderParty={selectOrderParty}
        customerSearchQuery={customerSearchQuery}
        setCustomerSearchQuery={setCustomerSearchQuery}
        filteredCustomers={filteredCustomers}
        selectCustomer={selectCustomer}
        clearSelectedCustomer={clearSelectedCustomer}
        setIsAddCustomerOpen={setIsAddCustomerOpen}
        setCustomerFormData={setCustomerFormData}
        setIsAddSourceOpen={setIsAddSourceOpen}
        sources={sources}
        cartShareCode={cartShareCode}
        setCartShareCode={setCartShareCode}
        items={items}
        addItemRow={addItemRow}
        updateItemRow={updateItemRow}
        removeItemRow={removeItemRow}
        bankCommissionEnabled={bankCommissionEnabled}
        setBankCommissionEnabled={setBankCommissionEnabled}
        bankCommissionType={bankCommissionType}
        setBankCommissionType={setBankCommissionType}
        bankCommissionRate={bankCommissionRate}
        setBankCommissionRate={setBankCommissionRate}
        couponEnabled={couponEnabled}
        setCouponEnabled={setCouponEnabled}
        couponRate={couponRate}
        setCouponRate={setCouponRate}
        addShippingEnabled={addShippingEnabled}
        setAddShippingEnabled={setAddShippingEnabled}
        shippings={shippings}
        addShippingRow={addShippingRow}
        updateShippingRow={updateShippingRow}
        removeShippingRow={removeShippingRow}
        shippingCompanies={shippingCompanies}
        setIsAddShippingCompanyOpen={setIsAddShippingCompanyOpen}
        setActiveAddShippingIndex={setActiveAddShippingIndex}
        packagingFeeEnabled={packagingFeeEnabled}
        setPackagingFeeEnabled={setPackagingFeeEnabled}
        packagingFeeRate={packagingFeeRate}
        setPackagingFeeRate={setPackagingFeeRate}
        couriers={couriers}
        profitPerKgRate={profitPerKgRate}
        setProfitPerKgRate={setProfitPerKgRate}
        cbmShippingRateValue={cbmShippingRateValue}
        setCbmShippingRateValue={setCbmShippingRateValue}
        settings={settings}
        calcs={calcs}
        activeCurrencies={activeCurrencies}
        financialAccounts={financialAccounts}
        packagingOptions={packagingOptions}
        shippingCategoryOptions={shippingCategoryOptions}
        itemCategories={activeItemCategories}
        homeDeliveryEnabled={homeDeliveryEnabled}
        setHomeDeliveryEnabled={setHomeDeliveryEnabled}
        viaShippingAgent={viaShippingAgent}
        setViaShippingAgent={setViaShippingAgent}
        payLater={payLater}
        setPayLater={setPayLater}
        directApprove={directApprove}
        setDirectApprove={setDirectApprove}
        orderStatuses={orderStatusesList}
        handleCreateOrder={handleCreateOrder}
      />

      {/* EDIT ORDER FULL DATA MODAL واجهة نموذج تعديل بيانات الطلب */}
      <EditOrderModal
        isOpen={isEditOrderModalOpen}
        onClose={() => {
          setIsEditOrderModalOpen(false);
          setOrderToEdit(null);
        }}
        orderToEdit={orderToEdit}
        customers={customers}
        employees={employees}
        sources={sources}
        couriers={couriers}
        shippingCompanies={shippingCompanies}
        activeCurrencies={activeCurrencies}
        packagingOptions={packagingOptions}
        shippingCategoryOptions={shippingCategoryOptions}
        itemCategories={activeItemCategories}
        settings={settings}
        isAr={isAr}
      />


      <CustomerCreateModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        isAr={isAr}
        settings={settings}
        initialName={customerFormData.fullName}
        onCreated={(customer) => {
          void selectOrderParty({ id: customer.id, type: 'customer', name: customer.fullName, phone: customer.phone, email: customer.email, financialAccountId: customer.financialAccountId, financialAccountCode: customer.financialAccountCode, raw: customer });
          setCustomerFormData({ fullName: '', phone: '', email: '', gps_location: '', address: '', notes: '' });
        }}
      />
      <SourceCreateModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        isAr={isAr}
        settings={settings}
        onCreated={(source) => setFormData((previous) => ({ ...previous, orderSourceId: source.id, orderSourceName: source.name, orderSourceType: source.type }))}
      />
      <ShippingCompanyCreateModal
        isOpen={isAddShippingCompanyOpen}
        onClose={() => setIsAddShippingCompanyOpen(false)}
        isAr={isAr}
        settings={settings}
        onCreated={(company) => {
          if (activeAddShippingIndex !== null) {
            if (typeof activeAddShippingIndex === 'string' && activeAddShippingIndex.startsWith('edit-')) {
              updateUpdateShippingRow(parseInt(activeAddShippingIndex.split('-')[1]), 'shippingCompany', company.name);
            } else if (typeof activeAddShippingIndex === 'number') {
              updateShippingRow(activeAddShippingIndex, 'shippingCompany', company.name);
            }
            setActiveAddShippingIndex(null);
          } else {
            setFormData((previous) => ({ ...previous, shippingCompany: company.name }));
          }
        }}
      />

      {/* Deprecated local quick-add markup retained temporarily but never rendered. */}
      {false && isAddCustomerOpen && (
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



      {/* QUICK ADD SHIPPING COMPANY NESTED MODAL نموذج انشاء شركه جديده*/}
      {false && isAddShippingCompanyOpen && (
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

      {/* UPDATE STATUS MODAL نموذج تحديث حاله ومسار الطلب */}
      <UpdateStatusModal
        isOpen={isUpdateModalOpen}
        selectedOrder={selectedOrder}
        updateFormData={updateFormData}
        setUpdateFormData={setUpdateFormData}
        updateShippings={updateShippings}
        setUpdateShippings={setUpdateShippings}
        orderStatusesList={orderStatusesList}
        couriers={couriers}
        canManageOrders={canManageOrders}
        isSubmitting={isSubmitting}
        isAr={isAr}
        onClose={() => setIsUpdateModalOpen(false)}
        onSubmit={handleUpdateStatus}
        setIsAddShippingCompanyOpen={setIsAddShippingCompanyOpen}
        setActiveAddShippingIndex={setActiveAddShippingIndex}
        shippingCompanies={shippingCompanies}
        role={role}
        hasPermission={hasPermission}
      />

      {/* COLLECT PAYMENT MODAL نموذج تحصيل دفعة مالية من العميل*/}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        selectedOrder={selectedOrder}
        paymentFormData={paymentFormData}
        setPaymentFormData={setPaymentFormData}
        isSubmitting={isSubmitting}
        isAr={isAr}
        financialAccounts={financialAccounts}
        activeCurrencies={activeCurrencies}
        dbRates={dbRates}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedOrder(null);
        }}
        onSubmit={handleCollectPayment}
      />

      {/* ORDER DETAILS MODAL كشف الفاتورة المطبوعة وتتبع كود الشحنة*/}
      <OrderDetailsModal
        isOpen={isDetailsModalOpen}
        selectedOrder={selectedOrder}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedOrder(null);
        }}
        isAr={isAr}
        settings={settings}
        orderStatusesList={orderStatusesList}
      />

      <OrderHistoryModal
        isOpen={isOrderHistoryOpen}
        context={orderHistoryContext}
        onClose={() => {
          setIsOrderHistoryOpen(false);
          setOrderHistoryContext(null);
        }}
        isAr={isAr}
      />

      {/* DELETE ORDER SECURITY PIN MODAL نموذج تاكيد الحذف*/}
      <DeleteOrderModal
        isOpen={isDeleteModalOpen}
        orderToDelete={orderToDelete}
        orderCount={ordersPendingDelete.length || 1}
        isDeleting={isBatchUpdating}
        deletePin={deletePin}
        deleteError={deleteError}
        setDeletePin={setDeletePin}
        setDeleteError={setDeleteError}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setOrderToDelete(null);
          setOrdersPendingDelete([]);
          setDeleteError('');
        }}
        onVerify={handleVerifyDeletePin}
        isAr={isAr}
      />



      {/* Add / Edit Shipment Modal نموذج انشاء/تعديل شحنه*/}
      <ShipmentFormModal
        isOpen={isAddShipmentModalOpen || isEditShipmentModalOpen}
        isEdit={isEditShipmentModalOpen}
        shipmentFormData={shipmentFormData}
        setShipmentFormData={setShipmentFormData}
        orders={orders}
        shippingCompanies={shippingCompanies}
        couriers={couriers}
        shippingCategoryOptions={shippingCategoryOptions}
        itemCategories={activeItemCategories}
        orderStatusesList={orderStatusesList}
        isSubmitting={isSubmitting}
        isAr={isAr}
        onClose={() => {
          setIsAddShipmentModalOpen(false);
          setIsEditShipmentModalOpen(false);
        }}
        onSubmit={handleSaveShipmentSubmit}
      />


      {/* Delete Shipment Confirm Modal نموذج تاكيد حذف شحنه*/}
      {isDeleteShipmentModalOpen && shipmentToDelete && (
        <ConfirmModal
          isOpen={isDeleteShipmentModalOpen}
          onClose={() => setIsDeleteShipmentModalOpen(false)}
          onConfirm={handleDeleteShipmentSubmit}
          title={isAr ? 'حذف الشحنة' : 'Delete Shipment'}
          message={isAr ? `هل أنت تأكد من حذف الشحنة رقم: (${shipmentToDelete.trackingNumber || shipmentToDelete.id})؟` : `Delete shipment ${shipmentToDelete.trackingNumber || shipmentToDelete.id}?`}
          confirmText={isAr ? 'حذف نهائي' : 'Delete'}
          type="danger"
        />
      )}

    </div>
  );
}
