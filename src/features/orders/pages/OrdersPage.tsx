import React, { useState, useEffect, useRef, useMemo } from 'react'; // استيراد التفاعلات لاجل عرض البيانات 
import { useLocation } from 'react-router-dom'; // استيراد الموقع لاجل عرض البيانات  
import CopyToClipboard from '../../../components/CopyToClipboard'; // استيراد نسخ النص لاجل النسخ 
import { useSettings } from '../../../context/SettingsContext'; // استيراد الإعدادات
import { useRole } from '../../../hooks/useRole'; // استيراد الأدوار
import { useAuthSession } from '../../../features/auth/AuthSessionProvider';
import { notificationService } from '../../../services/notificationService'; // استيراد خدمات الإشعارات
import toast from 'react-hot-toast'; // استيراد خدمات الإشعارات لاجل عرض الاشعارات 
import { activityLogService } from '../../../services/activityLogService'; // استيراد خدمات السجلات لاجل كتابة السجلات 
import { whatsappService } from '../../../services/whatsappService'; // استيراد خدمات الواتساب لاجل ارسال الرسائل 
import ConfirmModal from '../../../components/ConfirmModal'; // استيراد النافذة التاكيدية لاجل الحذف  
import Tracking from '../../shipments/pages/TrackingPage'; // استيراد تتبع الطلبات لاجل عرض تتبع الطلبات 
import { financialAccountService } from '../../../services/financialAccountService'; // استيراد خدمات الحسابات المالية لاجل عرض الحسابات المالية 
import {
  Plus, Search, Edit2, Truck, Activity, Trash2, DollarSign,
  CreditCard, Printer, Calculator, Package, MapPin, X, AlertCircle, RefreshCw, UserPlus, Eye,
  User, Mail, Phone, Coins, Calendar, ExternalLink, Filter, Layers, CheckCircle2, Boxes
} from 'lucide-react'; // استيراد الايقونات لاجل عرض الايقونات 
import { jsPDF } from 'jspdf'; // استيراد جافاسكريبت لاجل عرض البيانات 
import { printContent } from '../../../lib/printUtils'; // استيراد الطباعة لاجل عرض البيانات 
import QRCode from 'qrcode'; // استيراد رمز الاستجابة السريعة لاجل عرض رمز الاستجابة السريعة 
import { useOrderStatuses } from '../../../hooks/useOrderStatuses'; // استيراد حالات الطلبات لاجل عرض حالات الطلبات 
import { autoEntryService } from '../../../services/autoEntryService'; // استيراد خدمات القيد التلقائي لاجل عرض القيد التلقائي 
import { orderHistoryService } from '../../../services/orderHistoryService';
import { getProcessedStatusIds, planOrderStatusTransition } from '../../../services/orderLifecycleService';
import OrderStatusManagementTab from '../../../components/OrderStatusManagementTab'; // استيراد تبويبات حالات الطلبات لاجل عرض تبويبات حالات الطلبات 
import { useExchangeRates } from '../../../hooks/useExchangeRates'; // استيراد اسعار الصرف لاجل عرض اسعار الصرف 
import { useOrderOptions } from '../../../hooks/useOrderOptions'; // استيراد خيارات الطلب (أنواع التغليف وفئات الشحن)
import OrderOptionsManagementTab from '../../../components/orders/OrderOptionsManagementTab'; // استيراد واجهة إدارة خيارات الطلب
import { useItemCategories } from '../../../hooks/useItemCategories';
import ItemCategoriesManagementTab from '../../../components/orders/ItemCategoriesManagementTab';
import ProductsManagementTab from '../../../components/orders/ProductsManagementTab';
import type {
  CustomerFormData,
  OrderFormData,
  OrdersTab,
  PaymentFormData,
  ShippingCompanyFormData,
  SourceFormData,
  ShipmentFormData,
  UpdateFormData,
} from '../types';
import OrderHistoryModal from '../../../components/orders/OrderHistoryModal'; // استيراد سجل تدقيق الطلبات والشحنات
import { buildOrderParties, findOrderParty, toOrderPartyPayload, type OrderParty } from '../../../services/orderPartyService';
import { calculateOrderPaymentTotals } from '../../../services/orderCurrencyService';
import { deleteOrdersWithDependents, type OrderDeletionSummary } from '../../../services/orderDeletionService';
import { ORDER_STATUS_FALLBACKS } from '../constants/orders.constants';
import { ORDER_TAB_QUERY_ALIASES } from '../constants/orderTabAliases';
import { createOrderHandler } from '../services/createOrderHandler';
import { createOrderEntityHandlers } from '../services/orderEntityHandlers';
import { createSmartOrderCodeGenerator } from '../services/generateSmartOrderCode';
import { createSaveShipmentHandler } from '../services/saveShipmentHandler';
import { createCollectOrderPaymentHandler } from '../services/collectOrderPaymentHandler';
import { createBatchUpdateOrderStatusHandler } from '../services/batchUpdateOrderStatusHandler';
import { createUpdateOrderStatusHandler } from '../services/updateOrderStatusHandler';
import { useOrderData } from '../hooks/useOrderData';
import { useOrderFormState } from '../hooks/useOrderFormState';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { useOrderCalculations } from '../hooks/useOrderCalculations';
import { useOrderMutations } from '../hooks/useOrderMutations';
import { OrdersTable } from '../components/OrdersTable';
import { OrderFilters } from '../components/OrderFilters';
import { ShipmentsTable } from '../components/ShipmentsTable';
import { OrdersPageShell } from './subcomponents/OrdersPageShell';
import { OrdersPageDialogs } from './subcomponents/OrdersPageDialogs';

// استيراد وحدات التقارير والنماذج المنفصلة
import { generateOrderInvoicePDF, exportOrdersToPDF, exportOrdersToCSV } from '../../../reports';
import ShipmentFormModal from '../../../components/shipments/ShipmentFormModal';
import PaymentModal from '../../../components/orders/PaymentModal';
import DeleteOrderModal from '../../../components/orders/DeleteOrderModal';
import OrderDetailsModal from '../../../components/orders/OrderDetailsModal';
import UpdateStatusModal from '../../../components/orders/UpdateStatusModal';
import CreateOrderModal from '../../../components/orders/CreateOrderModal';
import EditOrderModal from '../../../components/orders/EditOrderModal';
import { CustomerCreateModal, ShippingCompanyCreateModal, SourceCreateModal } from '../../../components/entities/EntityCreateModals';

export default function OrdersPage() { // دالة عرض الطلبات 
  const { legacyAuth: auth } = useAuthSession();
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

  // Realtime feature data is owned by the read hook; the page composes it with UI state.
  const {
    orders,
    customers,
    employees,
    couriers,
    sources,
    shippingCompanies,
    financialAccounts,
    allProducts,
    allShipments,
    autoVoucherRules,
    loading,
  } = useOrderData(!roleLoading);
  const {
    formData, setFormData, items, setItems, shippings, setShippings, updateShippings, setUpdateShippings,
    updateFormData, setUpdateFormData, paymentFormData, setPaymentFormData, customerFormData, setCustomerFormData,
    shippingCompanyFormData, setShippingCompanyFormData, sourceFormData, setSourceFormData,
    bankCommissionEnabled, setBankCommissionEnabled, bankCommissionRate, setBankCommissionRate,
    bankCommissionType, setBankCommissionType, couponEnabled, setCouponEnabled, couponRate, setCouponRate,
    cartShareCode, setCartShareCode, addShippingEnabled, setAddShippingEnabled, profitPerKgRate,
    setProfitPerKgRate, cbmShippingRateValue, setCbmShippingRateValue, packagingFeeEnabled,
    setPackagingFeeEnabled, packagingFeeRate, setPackagingFeeRate, homeDeliveryEnabled,
    setHomeDeliveryEnabled, viaShippingAgent, setViaShippingAgent, payLater, setPayLater,
    directApprove, setDirectApprove, resetCreateForm: resetOrderFormState,
  } = useOrderFormState(orderCurrency, settings.currency || 'YER');

  const orderMutationActions = useOrderMutations();
  const {
    createOrderRecord,
    updateOrderRecord,
    createCustomerRecord,
    createSourceRecord,
    createShippingCompanyRecord,
    createProductRecord,
    createOrderItem,
    createShipmentRecord,
    upsertShipment,
    updateShipmentStatus,
    deleteShipment,
    findOrdersByNumberPrefix,
  } = orderMutationActions;
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


  // Form Data for newly created Inline Source of Purchase --نموذج بيانات مصدر الشحنة الجديدة  


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

  const {
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    courierFilter,
    setCourierFilter,
    sourceFilter,
    setSourceFilter,
    sortBy,
    setSortBy,
    enrichedOrders,
    filteredOrdersList,
  } = useOrderFilters({ orders, customers, employees, couriers, sources });

  const location = useLocation(); //  الموقع

  const { options: orderOptionsList, packagingOptions, shippingCategoryOptions } = useOrderOptions();
  const { activeCategories: activeItemCategories } = useItemCategories();

  // تبويبات الطلبات ويستخدم ل عرض الطلبات و الشحنات و تتبع و حالات الطلبات والخيارات (أنواع التغليف وفئات الشحن)
  const [ordersTab, setOrdersTab] = useState<OrdersTab>(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'products') return 'products';
    if (tab === 'shipments') return 'shipments';
    if (tab === 'tracking' && (role === 'Admin' || hasPermission('track_order'))) return 'tracking';
    if (ORDER_TAB_QUERY_ALIASES.statuses.includes(tab || '') && (role === 'Admin' || hasPermission('view_order_statuses') || hasPermission('view_auto_entries'))) return 'statuses';
    if (ORDER_TAB_QUERY_ALIASES.options.includes(tab || '')) return 'options';
    if (ORDER_TAB_QUERY_ALIASES.itemCategories.includes(tab || '')) return 'item-categories';
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
    } else if (ORDER_TAB_QUERY_ALIASES.statuses.includes(tab || '') && canViewOrderStatuses && ordersTab !== 'statuses') {
      setOrdersTab('statuses');
    } else if (ORDER_TAB_QUERY_ALIASES.options.includes(tab || '') && ordersTab !== 'options') {
      setOrdersTab('options');
    } else if (ORDER_TAB_QUERY_ALIASES.itemCategories.includes(tab || '') && ordersTab !== 'item-categories') {
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
  const [shipmentFormData, setShipmentFormData] = useState<ShipmentFormData>({
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


  // Order Upgrade states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');// البحث عن العميل  ويستخدم لترقية الطلب 
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);//عرض تفاصيل العميل  
  const [previewOrderNumber, setPreviewOrderNumber] = useState('');// داله ارجاع رقم الطلب الذي سوف يتم تحديثه    

  // Products Adjustments
  //تفعيل العمولة البنكية
  //نسبة العمولة البنكية
  //نوع العمولة البنكية
  //متغير زر الكوبون
  //سعر الكوبون ويستخدم لترقية الطلب
  //كود الكوبون ويستخدم لترقية الطلب

  // New States for order source types
  //متغير تفعيل الشحن ويستخدم لتحديد هل الطلب يحتوي على شحن ام لا
  //قيمة الربح لكل كيلو جرام ويستخدم في حالة نوع مصدر الطلب = تطبيقات
  //قيمة الشحن لكل متر مكعب ويستخدم في حاله نوع مصدر الطلب = مصانع

  // Shipping packaging fee state
  //متغير تفعيل رسوم التغليف  على مستوى الشحن
  //رسوم التغليف على مستوى الشحن

  // ====== حالات الخيارات الجديدة الثلاثة لإنشاء الطلب ======
  // New feature states for order creation: home delivery, pay later, direct approve

  /** هل التوصيل للمنزل مفعل؟ (يُظهر حقول المندوب اليمني ورسوم التوصيل)
   *  Is home delivery enabled? (shows Yemen courier & delivery fee fields) */


  /** هل الشحن عبر مندوب مفعل؟ (يُظهر حقول موظف التعبئة والتجميع والعمولة)
   *  Is via shipping agent enabled? (shows Saudi aggregator & commission fee fields) */


  /** هل الدفع لاحقاً مفعل؟ (يُخفي حقول الدفع ويحفظ الطلب بحالة 1 كـ "لم يتم الدفع")
   *  Is pay later enabled? (hides payment fields, saves order at status 1 as Unpaid) */


  /** هل الحفظ والاعتماد المباشر مفعل؟ (يحفظ الطلب بحالة الطلب الثالثة مباشرة)
   *  Is direct approve enabled? (saves order directly at status stage 3 = Approved) */



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


  //متغير حاله يستخدم لتحديث الشحنات

  // Order Create Form Data 
  // بيانات نموذج إنشاء الطلب 


  // Edit / Update State 


  // New Payment State


  // Nested Add Customer Form


  // Realtime listeners and snapshot-to-view mapping live in useOrderData.

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
    const generateSmartOrderCode = createSmartOrderCodeGenerator({
    settings,
    findOrdersByNumberPrefix,
  });;

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
    if (party.accountId) return party;
    const entityType = party.type === 'employee' ? 'employee' : party.type === 'courier' ? 'courier' : 'customer';
    const account = await financialAccountService.createAccountForEntity(entityType, party.id, party.name, settings.currency || 'YER');
    return { ...party, accountId: account.id };
  };

  const selectOrderParty = async (party: OrderParty) => {
    try {
      const resolved = await ensureOrderPartyFinancialAccount(party);
      setFormData((prev) => ({ ...prev, ...toOrderPartyPayload(resolved) }));
      setCustomerSearchQuery('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (isAr ? 'تعذر تجهيز الحساب المالي لطرف الطلب.' : 'Unable to prepare the party financial account.');
      notificationService.notify({ title: isAr ? 'تعذر ربط الحساب المالي' : 'Financial account link failed', message, type: 'error', category: 'order' });
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

  // generateOrderInvoicePDF is imported from '../../../reports' (see line 28)



  const calcs = useOrderCalculations({
    formData,
    items,
    shippings,
    bankCommissionRate,
    bankCommissionType,
    bankCommissionEnabled,
    couponEnabled,
    couponRate,
    packagingFeeEnabled,
    packagingFeeRate,
    homeDeliveryEnabled,
    viaShippingAgent,
    addShippingEnabled,
    profitPerKgRate,
    cbmShippingRateValue,
    dbRates,
    couriers,
    orderCurrency,
    systemCurrency: settings.currency,
  });
  const computeCalculations = () => calcs; // Retains existing handler call sites during extraction.

    const resetCreateForm = () => {
    resetOrderFormState(orderCurrency, settings.currency || 'YER', settings, dbRates);
    setCustomerSearchQuery('');
    setSelectedCustomerProfile(null);
  };;

  // Create order business workflow is injected from the feature service.
  const handleCreateOrder = createOrderHandler({
    isSubmitting,
    isAr,
    formData,
    settings,
    profile,
    customers,
    couriers,
    orderStatusesList,
    activeCurrencies,
    selectedOrderParty,
    items,
    shippings,
    orderCurrency,
    bankCommissionType,
    cartShareCode,
    bankCommissionEnabled,
    packagingFeeEnabled,
    packagingFeeRate,
    addShippingEnabled,
    couponEnabled,
    couponRate,
    cbmShippingRateValue,
    profitPerKgRate,
    directApprove,
    homeDeliveryEnabled,
    payLater,
    viaShippingAgent,
    mutations: orderMutationActions,
    computeCalculations,
    generateSmartOrderCode,
    resetCreateForm,
    setIsSubmitting,
    setIsAddModalOpen,
  });

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
  ;

  // Nested quick-add purchase source
  // مهم: يتم استخدام نموذج انشاء مصدر من واجهة المصادر "../page/Sources.tsx" مع تعديلات طفيفه وعدم تكرار الاكواد هنا مره اخرى
  ;

  // Nested quick-add shipping company
  // مهم: يتم استخدام نموذج انشاء شركة شحن من واجهة شركات الشحن "../page/ShippingCompanies.tsx" مع تعديلات طفيفه وعدم تكرار الاكواد هنا مره اخرى
  ;

  // توافق مؤقت للاستدعاءات القديمة: لا توجد كتابة بديلة خارج المعاملة الذرية.
  const handleAddPayment = (e: React.FormEvent) => handleCollectPayment(e);

  // Update logistics status
  const handleUpdateStatus = createUpdateOrderStatusHandler({
    isSubmitting,
    isAr,
    auth,
    autoVoucherRules,
    buildOrderRates,
    couriers,
    customers,
    dbRates,
    employees,
    getStatusByAny,
    orderStatusesList,
    profile,
    selectedOrder,
    setIsSubmitting,
    setIsUpdateModalOpen,
    setSelectedOrder,
    settings,
    shippingCompanies,
    sources,
    updateFormData,
    updateOrderRecord,
    updateShippings,
    upsertShipment,
  });

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
      const totalCBM = items.reduce((sum, i) => sum + (parseFloat(String(i.quantity || 0)) * parseFloat(String(i.cbm || 0))), 0);
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

  const { handleAddCustomer, handleAddSource, handleAddShippingCompany } = createOrderEntityHandlers({
    activeAddShippingIndex,
    createCustomerRecord,
    createShippingCompanyRecord,
    createSourceRecord,
    customerFormData,
    isAr,
    isSubmitting,
    orderCurrency,
    setActiveAddShippingIndex,
    setCustomerFormData,
    setFormData,
    setIsAddCustomerOpen,
    setIsAddShippingCompanyOpen,
    setIsAddSourceOpen,
    setIsSubmitting,
    setShippingCompanyFormData,
    setSourceFormData,
    settings,
    shippingCompanyFormData,
    sourceFormData,
    updateShippingRow,
    updateUpdateShippingRow,
  });
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
  const handleCollectPayment = createCollectOrderPaymentHandler({
    activeCurrencies,
    couriers,
    customers,
    dbRates,
    employees,
    financialAccounts,
    isAr,
    orderCurrency,
    paymentFormData,
    profile,
    selectedOrder,
    setIsPaymentModalOpen,
    setIsSubmitting,
    setPaymentFormData,
    setSelectedOrder,
  });;

  // تحديث حالة الطلب
  const handleBatchUpdateStatus = createBatchUpdateOrderStatusHandler({
    auth,
    autoVoucherRules,
    buildOrderRates,
    couriers,
    customers,
    dbRates,
    employees,
    isAr,
    orders,
    orderStatusesList,
    profile,
    selectedOrderIds,
    setIsBatchUpdating,
    setSelectedOrderIds,
    settings,
    updateOrderRecord,
  });;
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
    const handleSaveShipmentSubmit = createSaveShipmentHandler({
    activeItemCategories,
    isAr,
    setIsAddShipmentModalOpen,
    setIsEditShipmentModalOpen,
    setIsSubmitting,
    setShipmentToEdit,
    shipmentFormData,
    shipmentToEdit,
    upsertShipment,
  });;
  // تعديل حالة الشحنه بسرعة
  const handleQuickShipmentStatusChange = async (shipmentId: string, newStatus: string) => {
    try {
      await updateShipmentStatus(shipmentId, newStatus);
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
      await deleteShipment(shipmentToDelete.id);
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

  return (
    <OrdersPageShell
      isAr={isAr}
      t={t}
      role={role}
      hasPermission={hasPermission}
      filteredOrdersList={filteredOrdersList}
      canAddOrders={canAddOrders}
      resetCreateForm={resetCreateForm}
      setIsAddModalOpen={setIsAddModalOpen}
      ordersTab={ordersTab}
      setOrdersTab={setOrdersTab}
      orders={orders}
      allProducts={allProducts}
      allShipments={allShipments}
      canTrackOrders={canTrackOrders}
      canViewOrderStatuses={canViewOrderStatuses}
      orderStatusesList={orderStatusesList}
      orderOptionsList={orderOptionsList}
      activeItemCategories={activeItemCategories}
      canManageOrders={canManageOrders}
      orderCurrency={orderCurrency}
      searchText={searchText}
      setSearchText={setSearchText}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      courierFilter={courierFilter}
      setCourierFilter={setCourierFilter}
      sortBy={sortBy}
      setSortBy={setSortBy}
      shipmentSearchQuery={shipmentSearchQuery}
      setShipmentSearchQuery={setShipmentSearchQuery}
      shipmentStatusFilter={shipmentStatusFilter}
      setShipmentStatusFilter={setShipmentStatusFilter}
      shipmentCarrierFilter={shipmentCarrierFilter}
      setShipmentCarrierFilter={setShipmentCarrierFilter}
      shippingCompanies={shippingCompanies}
      handleOpenAddShipmentModal={handleOpenAddShipmentModal}
      filteredShipmentsList={filteredShipmentsList}
      couriers={couriers}
      copyToClipboard={copyToClipboard}
      handleQuickShipmentStatusChange={handleQuickShipmentStatusChange}
      handleOpenEditShipmentModal={handleOpenEditShipmentModal}
      handleOpenShipmentHistory={handleOpenShipmentHistory}
      setShipmentToDelete={setShipmentToDelete}
      setIsDeleteShipmentModalOpen={setIsDeleteShipmentModalOpen}
      selectedOrderIds={selectedOrderIds}
      handleOpenBatchDelete={handleOpenBatchDelete}
      isBatchUpdating={isBatchUpdating}
      setSelectedOrderIds={setSelectedOrderIds}
      handleSelectAll={handleSelectAll}
      handleToggleSelect={handleToggleSelect}
      handleOpenOrderHistory={handleOpenOrderHistory}
      handleOpenEditOrder={handleOpenEditOrder}
      handleOpenUpdateStatus={handleOpenUpdateStatus}
      handleOpenCollectPayment={handleOpenCollectPayment}
      setSelectedOrder={setSelectedOrder}
      setIsDetailsModalOpen={setIsDetailsModalOpen}
      handleOpenDeleteOrder={handleOpenDeleteOrder}
      settings={settings}
      dbRates={dbRates}
    >
      <OrdersPageDialogs
        {...{
          isAddModalOpen, setIsAddModalOpen, isEditOrderModalOpen, setIsEditOrderModalOpen,
          orderToEdit, setOrderToEdit, isAddCustomerOpen, setIsAddCustomerOpen, isAddSourceOpen,
          setIsAddSourceOpen, isAddShippingCompanyOpen, setIsAddShippingCompanyOpen, isAr, settings,
          employees, customers, sources, customerFormData, setCustomerFormData, selectOrderParty, setFormData, activeAddShippingIndex,
          updateUpdateShippingRow, updateShippingRow, setActiveAddShippingIndex, shippingCompanyFormData,
          isUpdateModalOpen, setIsUpdateModalOpen, selectedOrder, setSelectedOrder, updateFormData, setUpdateFormData, updateShippings,
          setUpdateShippings, orderStatusesList, couriers, canManageOrders, isSubmitting,
          handleUpdateStatus, shippingCompanies, role, hasPermission, isPaymentModalOpen,
          paymentFormData, setPaymentFormData, financialAccounts, activeCurrencies, dbRates,
          handleCollectPayment, setIsPaymentModalOpen, isDetailsModalOpen, setIsDetailsModalOpen, orderHistoryContext,
          isOrderHistoryOpen, setIsOrderHistoryOpen, setOrderHistoryContext, isDeleteModalOpen,
          orderToDelete, setOrderToDelete, ordersPendingDelete, isBatchUpdating, deletePin, deleteError, setDeletePin,
          setDeleteError, handleVerifyDeletePin, setIsDeleteModalOpen, setOrdersPendingDelete, isAddShipmentModalOpen, isEditShipmentModalOpen,
          shipmentFormData, setShipmentFormData, orders, shippingCategoryOptions, activeItemCategories,
          handleSaveShipmentSubmit, setIsAddShipmentModalOpen, setIsEditShipmentModalOpen, isDeleteShipmentModalOpen, setIsDeleteShipmentModalOpen, shipmentToDelete, handleDeleteShipmentSubmit,
          canEditOrderDefaultsCreation, formData, previewOrderNumber, customerProfileStats, orderParties,
          selectedOrderParty, setIsStaffOrder, customerSearchQuery, setCustomerSearchQuery, filteredCustomers,
          selectCustomer, clearSelectedCustomer, cartShareCode, setCartShareCode, items, addItemRow,
          updateItemRow, removeItemRow, bankCommissionEnabled, setBankCommissionEnabled, bankCommissionType,
          setBankCommissionType, bankCommissionRate, setBankCommissionRate, couponEnabled, setCouponEnabled,
          couponRate, setCouponRate, addShippingEnabled, setAddShippingEnabled, shippings, addShippingRow,
          removeShippingRow, packagingFeeEnabled,
          setPackagingFeeEnabled, packagingFeeRate, setPackagingFeeRate, profitPerKgRate, setProfitPerKgRate,
          cbmShippingRateValue, setCbmShippingRateValue, calcs, packagingOptions, itemCategories: activeItemCategories,
          homeDeliveryEnabled, setHomeDeliveryEnabled, viaShippingAgent, setViaShippingAgent, payLater,
          setPayLater, directApprove, setDirectApprove, handleCreateOrder,
        }}
      />
    </OrdersPageShell>
  );

}
