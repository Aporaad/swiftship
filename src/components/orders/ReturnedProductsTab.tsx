/**
 * ReturnedProductsTab.tsx
 * تبويبة إدارة المنتجات المرتجعة من العملاء
 * Tab for managing returned products from customers
 *
 * الميزات:
 * - عرض جدول المرتجعات مع فلترة وبحث متقدم
 * - إحصائيات ملخصة أعلى الجدول
 * - نموذج إضافة/تعديل مرتجع كامل
 * - تغيير حالة المرتجع مع تسجيل من قام بالمعالجة
 * - حذف المرتجع مع تأكيد
 *
 * Features:
 * - Table with advanced filtering and search
 * - Summary statistics at top
 * - Full add/edit return form
 * - Status update with processing tracking
 * - Delete with confirmation
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownUp,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Edit2,
  ExternalLink,
  Filter,
  Layers,
  Package,
  PackageX,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  TrendingDown,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';
import { addDoc, collection, db, deleteDoc, doc, onSnapshot, updateDoc } from '../../lib/supabase';
import { useRole } from '../../hooks/useRole';
import {
  RETURN_CONDITION_LIST,
  RETURN_STATUS_LIST,
  RETURN_TYPE_LIST,
  ReturnCondition,
  ReturnedProduct,
  ReturnStatus,
  ReturnType,
  calculateReturnStats,
} from '../../services/returnedProductService';

// ────────────────────── Types & Constants ──────────────────────

/** نموذج بيانات المرتجع الفارغ - Empty return form data */
const emptyReturnForm = (): Omit<ReturnedProduct, 'return_id' | 'created_at' | 'updated_at'> => ({
  order_id: '',
  order_item_id: '',
  product_id: '',
  customer_id: '',
  customer_name: '',
  product_name: '',
  product_url: '',
  quantity: 1,
  return_reason: '',
  return_type: 'استرداد',
  return_status: 'معلق',
  return_condition: 'مستخدم',
  refund_amount: 0,
  refund_currency: 'YER',
  is_insured: false,
  insurance_refund: 0,
  notes: '',
  returned_at: new Date().toISOString().split('T')[0],
  processed_by: '',
  processed_at: undefined,
});

// ────────────────────── Helpers ──────────────────────

/** نمط حقل الإدخال المشترك - Shared input field style */
const inp =
  'w-full bg-black/35 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60 transition';

/** مكوّن تسمية الحقل - Field label component */
const FieldLabel = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-1">
    <span className="block text-[10px] text-slate-500 font-black">{label}</span>
    {children}
  </label>
);

/**
 * الحصول على لون حالة المرتجع - Get status color classes
 */
const getStatusColor = (status?: string) => {
  switch (status) {
    case 'مكتمل':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    case 'مقبول':
      return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
    case 'مرفوض':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
    case 'معلق':
    default:
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
  }
};

/**
 * الحصول على لون نوع الإرجاع - Get return type color
 */
const getTypeColor = (type?: string) => {
  switch (type) {
    case 'استبدال':
      return 'bg-blue-500/10 text-blue-400';
    case 'استرداد':
      return 'bg-purple-500/10 text-purple-400';
    case 'إصلاح':
      return 'bg-orange-500/10 text-orange-400';
    default:
      return 'bg-slate-800 text-slate-400';
  }
};

/**
 * الحصول على أيقونة الحالة - Get status icon
 */
const StatusIcon = ({ status }: { status?: string }) => {
  switch (status) {
    case 'مكتمل':
      return <CheckCircle2 className="w-3 h-3" />;
    case 'مقبول':
      return <CheckCircle2 className="w-3 h-3" />;
    case 'مرفوض':
      return <XCircle className="w-3 h-3" />;
    case 'معلق':
    default:
      return <AlertCircle className="w-3 h-3" />;
  }
};

// ────────────────────── Component Props ──────────────────────

interface ReturnedProductsTabProps {
  isAr: boolean;
  canManage: boolean;
  orderCurrency?: string;
  /** قائمة الطلبات للبحث والاختيار منها - Orders list for search */
  orders?: any[];
  /** قائمة العملاء للبحث والاختيار منهم - Customers list for search */
  customers?: any[];
  /** قائمة المنتجات الرئيسية - Master products list */
  masterProducts?: any[];
  /** قائمة بنود الطلبات (حركة المنتجات) - Order items list */
  orderItems?: any[];
}

// ────────────────────── Main Component ──────────────────────

/**
 * تبويبة إدارة المنتجات المرتجعة
 * Returned Products Management Tab
 */
export default function ReturnedProductsTab({
  isAr,
  canManage,
  orderCurrency = 'YER',
  orders = [],
  customers = [],
  masterProducts = [],
  orderItems: propOrderItems = [],
}: ReturnedProductsTabProps) {
  const { role, hasPermission, profile } = useRole();

  // ────────── State: البيانات - Data ──────────
  const [returns, setReturns] = useState<ReturnedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // ────────── State: الطلبات وبنود الطلبات الداخلية - Internal Orders & Items ──────────
  const [internalOrders, setInternalOrders] = useState<any[]>([]);
  const [internalOrderItems, setInternalOrderItems] = useState<any[]>([]);

  // جلب الطلبات في حال لم يتم تمريرها كخاصية
  useEffect(() => {
    if (!orders || orders.length === 0) {
      const unsub = onSnapshot(collection(db, 'orders'), (snap: any) => {
        setInternalOrders(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub?.();
    }
  }, [orders]);

  // جلب بنود الطلبات في حال لم يتم تمريرها كخاصية
  useEffect(() => {
    if (!propOrderItems || propOrderItems.length === 0) {
      const unsub = onSnapshot(collection(db, 'order_items'), (snap: any) => {
        setInternalOrderItems(snap.docs.map((d: any) => ({ items_id: d.id, ...d.data() })));
      });
      return () => unsub?.();
    }
  }, [propOrderItems]);

  const allOrders = useMemo(() => {
    return orders && orders.length > 0 ? orders : internalOrders;
  }, [orders, internalOrders]);

  const allOrderItems = useMemo(() => {
    return propOrderItems && propOrderItems.length > 0 ? propOrderItems : internalOrderItems;
  }, [propOrderItems, internalOrderItems]);

  // ────────── State: الفلاتر والبحث - Filters & Search ──────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount'>('newest');

  // ────────── State: النوافذ - Modals ──────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState<ReturnedProduct | null>(null);
  const [deletingReturn, setDeletingReturn] = useState<ReturnedProduct | null>(null);
  const [quickStatusItem, setQuickStatusItem] = useState<ReturnedProduct | null>(null);
  const [quickStatusValue, setQuickStatusValue] = useState<ReturnStatus>('معلق');

  // ────────── State: اختيار الطلب والمنتج في نموذج الإرجاع ──────────
  // Mandatory order and product selection state in return modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedOrderItem, setSelectedOrderItem] = useState<any | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // قائمة الطلبات المفلترة داخل نافذة إضافة المرتجع
  const modalFilteredOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) {
      return allOrders.slice(0, 40);
    }
    const q = orderSearchQuery.toLowerCase().trim();
    return allOrders.filter((o: any) => {
      const num = String(o.orderNumber || o.order_number || o.id || '').toLowerCase();
      const cust = String(o.customerName || o.customer_name || '').toLowerCase();
      const phone = String(o.customerPhone || o.customer_phone || o.phone || '').toLowerCase();
      return num.includes(q) || cust.includes(q) || phone.includes(q);
    });
  }, [allOrders, orderSearchQuery]);

  // قائمة منتجات الطلب المختار تلقائياً
  const selectedOrderProducts = useMemo(() => {
    if (!selectedOrder) return [];
    const ordId = selectedOrder.id;
    const ordNum = selectedOrder.orderNumber || selectedOrder.order_number;

    const directItems = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    const matchedItems = allOrderItems.filter((it: any) => {
      return (ordId && it.order_id === ordId) || (ordNum && it.order_id === ordNum);
    });

    const map = new Map<string, any>();
    directItems.forEach((it: any, idx: number) => {
      const key = it.items_id || it.id || `direct_${idx}`;
      map.set(key, it);
    });
    matchedItems.forEach((it: any) => {
      const key = it.items_id || it.id;
      if (key) map.set(key, it);
    });

    return Array.from(map.values());
  }, [selectedOrder, allOrderItems]);

  // اختيار طلب من القائمة
  const handleSelectOrder = (order: any) => {
    setSelectedOrder(order);
    setSelectedOrderItem(null);
    const ordNo = order.orderNumber || order.order_number || order.id || '';
    const custId = order.customerId || order.customer_id || '';
    const custName = order.customerName || order.customer_name || order.customer || 'عميل';
    const cur = order.currency || orderCurrency || 'YER';

    setFormData(f => ({
      ...f,
      order_id: ordNo,
      customer_id: custId,
      customer_name: custName,
      refund_currency: cur,
      // تفريغ المنتج السابق
      order_item_id: '',
      product_id: '',
      product_name: '',
      product_url: '',
      quantity: 1,
      refund_amount: 0,
      is_insured: false,
      insurance_refund: 0,
    }));
  };

  // اختيار منتج من منتجات الطلب
  const handleSelectOrderItem = (item: any) => {
    setSelectedOrderItem(item);
    const pName = item.product_cooler || item.product_name || item.productName || 'منتج';
    const pUrl = item.product_url || item.productUrl || '';
    const pId = item.product_id || item.productId || '';
    const itemId = item.items_id || item.id || '';
    const isInsured = Boolean(item.is_insured);
    const insFee = Number(item.insurance_fee || 0);
    const qty = Math.max(1, Number(item.quantity) || 1);
    const totalPrice = Number(item.total_price || (item.product_price ? item.product_price * qty : 0));

    setFormData(f => ({
      ...f,
      order_item_id: itemId,
      product_id: pId,
      product_name: pName,
      product_url: pUrl,
      quantity: 1,
      refund_amount: totalPrice,
      is_insured: isInsured,
      insurance_refund: insFee,
    }));
  };

  // ────────── State: النموذج - Form ──────────
  const [formData, setFormData] = useState(emptyReturnForm());
  const [submitting, setSubmitting] = useState(false);

  // ────────── الصلاحيات - Permissions ──────────
  const can_view = role === 'Admin' || hasPermission('view_returned_products') || canManage;
  const can_add = role === 'Admin' || hasPermission('add_returned_products') || canManage;
  const can_edit = role === 'Admin' || hasPermission('edit_returned_products') || canManage;
  const can_delete = role === 'Admin' || hasPermission('delete_returned_products') || canManage;

  // ────────── جلب البيانات - Data Fetching ──────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'returned_products'), (snap: any) => {
      const data = snap.docs.map((d: any) => ({ return_id: d.id, ...d.data() }));
      setReturns(data);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub?.();
  }, []);

  // ────────── فلترة البيانات - Data Filtering ──────────
  const filteredReturns = useMemo(() => {
    let result = [...returns];

    // فلتر البحث - Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.product_name || '').toLowerCase().includes(q) ||
        (r.order_id || '').toLowerCase().includes(q) ||
        (r.return_reason || '').toLowerCase().includes(q)
      );
    }

    // فلتر الحالة - Status filter
    if (statusFilter !== 'all') {
      result = result.filter(r => r.return_status === statusFilter);
    }

    // فلتر النوع - Type filter
    if (typeFilter !== 'all') {
      result = result.filter(r => r.return_type === typeFilter);
    }

    // فلتر الحالة الفيزيائية - Condition filter
    if (conditionFilter !== 'all') {
      result = result.filter(r => r.return_condition === conditionFilter);
    }

    // فلتر التاريخ - Date filter
    if (dateFrom) {
      result = result.filter(r => (r.returned_at || '') >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(r => (r.returned_at || '') <= dateTo + 'T23:59:59');
    }

    // الترتيب - Sorting
    result.sort((a, b) => {
      if (sortBy === 'amount') {
        const amtA = (Number(a.refund_amount) || 0) + (Number(a.insurance_refund) || 0);
        const amtB = (Number(b.refund_amount) || 0) + (Number(b.insurance_refund) || 0);
        return amtB - amtA;
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      // newest (default)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return result;
  }, [returns, searchQuery, statusFilter, typeFilter, conditionFilter, dateFrom, dateTo, sortBy]);

  /** إحصائيات المرتجعات - Returns statistics */
  const stats = useMemo(() => calculateReturnStats(filteredReturns), [filteredReturns]);

  // ────────── فتح نموذج الإضافة - Open Add Form ──────────
  const openAddForm = () => {
    setEditingReturn(null);
    setSelectedOrder(null);
    setSelectedOrderItem(null);
    setOrderSearchQuery('');
    setFormData(emptyReturnForm());
    setIsFormOpen(true);
  };

  // ────────── فتح نموذج التعديل - Open Edit Form ──────────
  const openEditForm = (ret: ReturnedProduct) => {
    setEditingReturn(ret);
    // البحث عن الطلب المرتبط
    const matched = allOrders.find(
      (o: any) => o.id === ret.order_id || o.orderNumber === ret.order_id || o.order_number === ret.order_id
    );
    setSelectedOrder(matched || null);

    // البحث عن بند الطلب المرتبط
    const matchedItem = allOrderItems.find(
      (it: any) => ret.order_item_id && (it.items_id === ret.order_item_id || it.id === ret.order_item_id)
    );
    setSelectedOrderItem(matchedItem || null);
    setOrderSearchQuery('');

    setFormData({
      order_id: ret.order_id || '',
      order_item_id: ret.order_item_id || '',
      product_id: ret.product_id || '',
      customer_id: ret.customer_id || '',
      customer_name: ret.customer_name || '',
      product_name: ret.product_name || '',
      product_url: ret.product_url || '',
      quantity: ret.quantity || 1,
      return_reason: ret.return_reason || '',
      return_type: ret.return_type || 'استرداد',
      return_status: ret.return_status || 'معلق',
      return_condition: ret.return_condition || 'مستخدم',
      refund_amount: ret.refund_amount || 0,
      refund_currency: ret.refund_currency || 'YER',
      is_insured: Boolean(ret.is_insured),
      insurance_refund: ret.insurance_refund || 0,
      notes: ret.notes || '',
      returned_at: ret.returned_at ? String(ret.returned_at).split('T')[0] : new Date().toISOString().split('T')[0],
      processed_by: ret.processed_by || '',
      processed_at: ret.processed_at || '',
    });
    setIsFormOpen(true);
  };

  // ────────── حفظ المرتجع - Save Return ──────────
  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. التحقق الإجباري من اختيار الطلب
    if (!formData.order_id?.trim()) {
      toast.error(isAr ? 'يجب اختيار الطلب من قائمة الطلبات أولاً (إجباري)' : 'Please select an order first (mandatory)');
      return;
    }

    // 2. التحقق الإجباري من اختيار المنتج
    if (!formData.product_name?.trim()) {
      toast.error(isAr ? 'يجب اختيار المنتج المرتجع من قائمة منتجات الطلب (إجباري)' : 'Please select a returned product from the order items (mandatory)');
      return;
    }

    // 3. التحقق الإجباري من سبب الإرجاع
    if (!formData.return_reason?.trim()) {
      toast.error(isAr ? 'سبب الإرجاع إجباري' : 'Return reason is required');
      return;
    }

    setSubmitting(true);
    try {
      const currentUser = profile?.displayName || profile?.email || 'system';
      const nowIso = new Date().toISOString();
      const returnedAtIso = formData.returned_at?.trim()
        ? (formData.returned_at.includes('T') ? formData.returned_at : new Date(formData.returned_at).toISOString())
        : nowIso;
      const processedAtIso = formData.processed_at?.trim()
        ? (formData.processed_at.includes('T') ? formData.processed_at : new Date(formData.processed_at).toISOString())
        : null;

      if (editingReturn) {
        // تحديث مرتجع موجود - Update existing return
        await updateDoc(doc(db, 'returned_products', editingReturn.return_id), {
          ...formData,
          order_id: formData.order_id?.trim() || null,
          order_item_id: formData.order_item_id?.trim() || null,
          product_id: formData.product_id?.trim() || null,
          customer_id: formData.customer_id?.trim() || null,
          processed_by: formData.processed_by?.trim() || null,
          processed_at: processedAtIso,
          returned_at: returnedAtIso,
          quantity: Math.max(1, Number(formData.quantity) || 1),
          refund_amount: Math.max(0, Number(formData.refund_amount) || 0),
          insurance_refund: formData.is_insured ? Math.max(0, Number(formData.insurance_refund) || 0) : 0,
          is_insured: Boolean(formData.is_insured),
          updated_at: nowIso,
          updated_by: currentUser,
        });
        toast.success(isAr ? 'تم تحديث المرتجع بنجاح' : 'Return updated successfully');
      } else {
        // إنشاء مرتجع جديد - Create new return
        const return_id = 'ret_' + Math.random().toString(36).substring(2, 11);
        await addDoc(return_id, collection(db, 'returned_products'), {
          return_id,
          ...formData,
          order_id: formData.order_id?.trim() || null,
          order_item_id: formData.order_item_id?.trim() || null,
          product_id: formData.product_id?.trim() || null,
          customer_id: formData.customer_id?.trim() || null,
          processed_by: formData.processed_by?.trim() || null,
          processed_at: processedAtIso,
          returned_at: returnedAtIso,
          quantity: Math.max(1, Number(formData.quantity) || 1),
          refund_amount: Math.max(0, Number(formData.refund_amount) || 0),
          insurance_refund: formData.is_insured ? Math.max(0, Number(formData.insurance_refund) || 0) : 0,
          is_insured: Boolean(formData.is_insured),
          return_status: formData.return_status || 'معلق',
          return_type: formData.return_type || 'استرداد',
          return_condition: formData.return_condition || 'مستخدم',
          created_at: nowIso,
          created_by: currentUser,
          updated_at: nowIso,
          updated_by: currentUser,
        });

        // إذا كان مرتبطاً ببند طلب محدد، يتم تحديث حالته في جدول حركة المنتجات إلى 'مرتجع' تلقائياً
        if (formData.order_item_id) {
          try {
            await updateDoc(doc(db, 'order_items', formData.order_item_id), {
              items_status: 'مرتجع',
              updated_at: new Date().toISOString(),
            });
          } catch (itemErr) {
            console.warn('Could not update order_items status:', itemErr);
          }
        }

        toast.success(isAr ? 'تم إضافة المرتجع بنجاح وتحديث السجلات' : 'Return added successfully');
      }
      setIsFormOpen(false);
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر حفظ المرتجع' : 'Could not save return'));
    } finally {
      setSubmitting(false);
    }
  };

  // ────────── تحديث الحالة السريع - Quick Status Update ──────────
  const handleQuickStatusSave = async () => {
    if (!quickStatusItem) return;
    try {
      const currentUser = profile?.displayName || profile?.email || 'system';
      const now = new Date().toISOString();

      await updateDoc(doc(db, 'returned_products', quickStatusItem.return_id), {
        return_status: quickStatusValue,
        processed_by: quickStatusValue !== 'معلق' ? currentUser : null,
        processed_at: quickStatusValue !== 'معلق' ? now : null,
        updated_at: now,
        updated_by: currentUser,
      });

      toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      setQuickStatusItem(null);
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر تحديث الحالة' : 'Update failed'));
    }
  };

  // ────────── حذف المرتجع - Delete Return ──────────
  const handleDelete = async () => {
    if (!deletingReturn) return;
    try {
      await deleteDoc(doc(db, 'returned_products', deletingReturn.return_id));
      toast.success(isAr ? 'تم حذف المرتجع' : 'Return deleted');
      setDeletingReturn(null);
      setIsDeleteConfirmOpen(false);
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر الحذف' : 'Delete failed'));
    }
  };

  /** مسح جميع الفلاتر - Clear all filters */
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setConditionFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || typeFilter !== 'all' ||
    conditionFilter !== 'all' || dateFrom || dateTo;

  const money = (amount: unknown, currency?: string) =>
    `${Number(amount || 0).toLocaleString()} ${currency || orderCurrency}`;

  // ════════════════ RENDER ════════════════
  return (
    <div className="space-y-5 text-start animate-fade-in" data-testid="returned-products-tab">

      {/* ── إحصائيات ملخصة - Summary Statistics ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* إجمالي المرتجعات */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'إجمالي المرتجعات' : 'Total Returns'}
            </span>
            <span className="text-xl font-black text-white font-mono mt-0.5 block">{stats.total}</span>
          </div>
          <div className="p-2.5 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-xl text-[#d4af37]">
            <PackageX className="w-4 h-4" />
          </div>
        </div>

        {/* معلق */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'معلق' : 'Pending'}
            </span>
            <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">{stats.pending}</span>
          </div>
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>

        {/* مقبول */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'مقبول' : 'Accepted'}
            </span>
            <span className="text-xl font-black text-cyan-400 font-mono mt-0.5 block">{stats.accepted}</span>
          </div>
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* مكتمل */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'مكتمل' : 'Completed'}
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">{stats.completed}</span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* إجمالي الاسترداد */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'إجمالي الاسترداد' : 'Total Refunds'}
            </span>
            <span className="text-sm font-black text-rose-400 font-mono mt-0.5 block">
              {money(stats.total_refund_amount)}
            </span>
          </div>
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── شريط الأدوات: البحث والفلاتر - Toolbar ── */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2 flex-1 items-center">

            {/* بحث نصي - Text search */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
              <input
                id="returns-search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'ابحث باسم العميل أو المنتج أو الطلب…' : 'Search by customer, product or order…'}
                className={`${inp} pr-9`}
              />
            </div>

            {/* فلتر الحالة - Status filter */}
            <select
              id="returns-status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={inp + ' max-w-[150px]'}
            >
              <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
              {RETURN_STATUS_LIST.map((s, idx) => <option key={`ret-status-filter-${idx}`} value={s}>{s}</option>)}
            </select>

            {/* فلتر النوع - Type filter */}
            <select
              id="returns-type-filter"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className={inp + ' max-w-[140px]'}
            >
              <option value="all">{isAr ? 'كل الأنواع' : 'All types'}</option>
              {RETURN_TYPE_LIST.map((t, idx) => <option key={`ret-type-filter-${idx}`} value={t}>{t}</option>)}
            </select>

            {/* فلتر الحالة الفيزيائية - Condition filter */}
            <select
              id="returns-condition-filter"
              value={conditionFilter}
              onChange={e => setConditionFilter(e.target.value)}
              className={inp + ' max-w-[140px]'}
            >
              <option value="all">{isAr ? 'كل الحالات' : 'All conditions'}</option>
              {RETURN_CONDITION_LIST.map((c, idx) => <option key={`ret-cond-filter-${idx}`} value={c}>{c}</option>)}
            </select>

            {/* زر تغيير الترتيب - Sort button */}
            <button
              id="returns-sort-toggle"
              onClick={() => setSortBy(s => s === 'newest' ? 'oldest' : s === 'oldest' ? 'amount' : 'newest')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[#d4af37] hover:bg-slate-800 transition"
              title={isAr ? 'تغيير الترتيب' : 'Change sort'}
            >
              <ArrowDownUp className="w-4 h-4" />
            </button>

            {/* مسح الفلاتر - Clear filters */}
            {hasActiveFilters && (
              <button
                id="returns-clear-filters"
                onClick={clearFilters}
                className="p-2 rounded-xl bg-rose-900/20 border border-rose-800/30 text-rose-400 hover:bg-rose-900 transition text-[10px] font-bold flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                {isAr ? 'مسح' : 'Clear'}
              </button>
            )}
          </div>

          {/* زر الإضافة - Add button */}
          {(canManage || can_add) && (
            <button
              id="returns-add-btn"
              onClick={openAddForm}
              className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-2xl px-5 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer transition shadow-lg shadow-rose-900/20"
            >
              <RotateCcw className="w-4 h-4" />
              {isAr ? 'إضافة مرتجع' : 'Add Return'}
            </button>
          )}
        </div>

        {/* فلاتر التاريخ - Date range filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-bold">{isAr ? 'من:' : 'From:'}</span>
            <input
              id="returns-date-from"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className={inp + ' max-w-[160px]'}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-bold">{isAr ? 'إلى:' : 'To:'}</span>
            <input
              id="returns-date-to"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={inp + ' max-w-[160px]'}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-bold ml-auto">
            {isAr
              ? `إجمالي الظاهر: ${filteredReturns.length} من ${returns.length}`
              : `Showing: ${filteredReturns.length} of ${returns.length}`}
          </span>
        </div>
      </div>

      {/* ── جدول المرتجعات - Returns Table ── */}
      <div className="bg-slate-950/45 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-black text-slate-300 text-xs flex items-center gap-2">
            <PackageX className="w-4 h-4 text-rose-400" />
            {isAr ? 'سجل المنتجات المرتجعة' : 'Returned Products Log'}
          </span>
          <span className="text-rose-400 font-mono font-black text-xs">{filteredReturns.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead className="bg-black/30 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="p-3 text-start">{isAr ? 'العميل' : 'Customer'}</th>
                <th className="p-3 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                <th className="p-3 text-start">{isAr ? 'رقم الطلب' : 'Order'}</th>
                <th className="p-3 text-start">{isAr ? 'سبب الإرجاع' : 'Return Reason'}</th>
                <th className="p-3 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
                <th className="p-3 text-center">{isAr ? 'النوع' : 'Type'}</th>
                <th className="p-3 text-start">{isAr ? 'مبلغ الاسترداد' : 'Refund'}</th>
                <th className="p-3 text-center">{isAr ? 'الحالة الفيزيائية' : 'Condition'}</th>
                <th className="p-3 text-center">{isAr ? 'حالة المرتجع' : 'Status'}</th>
                <th className="p-3 text-center">{isAr ? 'تاريخ الإرجاع' : 'Return Date'}</th>
                <th className="p-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-16 text-center">
                    <PackageX className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <div className="text-slate-500 font-bold text-sm">
                      {isAr ? 'لا توجد مرتجعات مطابقة' : 'No matching returns found'}
                    </div>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-3 text-[#d4af37] text-xs font-bold hover:underline"
                      >
                        {isAr ? 'مسح الفلاتر' : 'Clear filters'}
                      </button>
                    )}
                  </td>
                </tr>
              ) : filteredReturns.map((ret, idx) => (
                <tr key={ret.return_id || `ret-${idx}`} className="hover:bg-slate-900/40 transition-colors group">

                  {/* العميل */}
                  <td className="p-3">
                    <div className="font-bold text-white">{ret.customer_name || '—'}</div>
                    {ret.customer_id && (
                      <div className="text-[10px] text-slate-500 font-mono">{ret.customer_id}</div>
                    )}
                  </td>

                  {/* المنتج */}
                  <td className="p-3">
                    <div className="font-bold text-cyan-300">{ret.product_name || '—'}</div>
                    {ret.product_url && (
                      <a
                        href={ret.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-400 hover:underline"
                      >
                        {isAr ? 'رابط' : 'Link'}
                      </a>
                    )}
                  </td>

                  {/* رقم الطلب */}
                  <td className="p-3">
                    <span className="font-mono text-[#d4af37] font-black text-[11px]">
                      {ret.order_id || '—'}
                    </span>
                  </td>

                  {/* سبب الإرجاع */}
                  <td className="p-3">
                    <div className="text-slate-300 max-w-[150px] truncate" title={ret.return_reason}>
                      {ret.return_reason || '—'}
                    </div>
                    {ret.notes && (
                      <div className="text-[10px] text-slate-500 truncate max-w-[150px]" title={ret.notes}>
                        {ret.notes}
                      </div>
                    )}
                  </td>

                  {/* الكمية */}
                  <td className="p-3 text-center">
                    <span className="font-mono font-black text-white">{ret.quantity || 1}</span>
                  </td>

                  {/* النوع */}
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${getTypeColor(ret.return_type)}`}>
                      {ret.return_type || '—'}
                    </span>
                  </td>

                  {/* مبلغ الاسترداد */}
                  <td className="p-3">
                    <div className="font-mono text-amber-300 font-black">
                      {money(ret.refund_amount, ret.refund_currency)}
                    </div>
                    {ret.is_insured && Number(ret.insurance_refund) > 0 && (
                      <div className="text-[10px] text-cyan-400 flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        {money(ret.insurance_refund, ret.refund_currency)}
                      </div>
                    )}
                  </td>

                  {/* الحالة الفيزيائية */}
                  <td className="p-3 text-center">
                    <span className="text-[10px] text-slate-400 font-bold">
                      {ret.return_condition || '—'}
                    </span>
                  </td>

                  {/* حالة المرتجع */}
                  <td className="p-3 text-center">
                    {quickStatusItem?.return_id === ret.return_id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <select
                          value={quickStatusValue}
                          onChange={e => setQuickStatusValue(e.target.value as ReturnStatus)}
                          className="bg-slate-900 border border-slate-700 text-white rounded-lg text-[10px] p-1 outline-none"
                        >
                          {RETURN_STATUS_LIST.map((s, idx) => <option key={`ret-status-quick-${idx}`} value={s}>{s}</option>)}
                        </select>
                        <button
                          onClick={handleQuickStatusSave}
                          className="p-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-[10px] transition"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setQuickStatusItem(null)}
                          className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-[10px] transition"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 justify-center w-fit mx-auto cursor-pointer ${getStatusColor(ret.return_status)}`}
                        onClick={() => {
                          if (can_edit) {
                            setQuickStatusItem(ret);
                            setQuickStatusValue(ret.return_status || 'معلق');
                          }
                        }}
                        title={can_edit ? (isAr ? 'انقر لتغيير الحالة' : 'Click to change status') : undefined}
                      >
                        <StatusIcon status={ret.return_status} />
                        {ret.return_status || 'معلق'}
                      </span>
                    )}
                  </td>

                  {/* تاريخ الإرجاع */}
                  <td className="p-3 text-center">
                    <div className="font-mono text-slate-400 text-[10px]">
                      {ret.returned_at ? new Date(ret.returned_at).toLocaleDateString('ar-SA') : '—'}
                    </div>
                    {ret.processed_by && (
                      <div className="text-[10px] text-slate-600">
                        {isAr ? 'بواسطة:' : 'by:'} {ret.processed_by}
                      </div>
                    )}
                  </td>

                  {/* الإجراءات */}
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {/* تعديل */}
                      {(canManage || can_edit) && (
                        <button
                          id={`edit-return-${ret.return_id}`}
                          onClick={() => openEditForm(ret)}
                          className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title={isAr ? 'تعديل' : 'Edit'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* حذف */}
                      {(canManage || can_delete) && (
                        <button
                          id={`delete-return-${ret.return_id}`}
                          onClick={() => { setDeletingReturn(ret); setIsDeleteConfirmOpen(true); }}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title={isAr ? 'حذف' : 'Delete'}
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

      {/* ════════════ نافذة إضافة/تعديل مرتجع ════════════ */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[1000000] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-8 overflow-y-auto">
          <form
            onSubmit={handleSaveReturn}
            className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[86vh] flex flex-col bg-[#121215] border border-rose-500/30 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto"
          >
            {/* رأس النموذج الثابت - Fixed Form Header */}
            <header className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-800 flex justify-between items-center bg-[#151518] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-black text-sm sm:text-base flex items-center gap-2 flex-wrap">
                    {editingReturn
                      ? (isAr ? 'تعديل بيانات المرتجع' : 'Edit Return Record')
                      : (isAr ? 'إضافة مرتجع جديد' : 'Add New Return')}
                    {selectedOrder && (
                      <span className="text-[11px] font-mono font-bold bg-slate-800 text-amber-300 px-2 py-0.5 rounded-md border border-slate-700">
                        {selectedOrder.orderNumber || selectedOrder.order_number || selectedOrder.id}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isAr
                      ? 'أدخل تفاصيل المنتج المرتجع وسبب الإرجاع ومبالغ الاسترداد والتأمين'
                      : 'Enter returned product details, reason, and refund amount'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* محتوى النموذج القابل للتمرير بمرونة - Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-5">

              {/* 1. اختيار الطلب (إجباري) - Mandatory Order Selection */}
              <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-400 uppercase flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-400" />
                    {isAr ? '1. اختيار الطلب (إجباري)' : '1. Select Order (Mandatory)'}
                  </h4>
                  {selectedOrder && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      {isAr ? 'تم تحديد الطلب ✓' : 'Order Selected ✓'}
                    </span>
                  )}
                </div>

                {/* في حال تم اختيار طلب مسبقاً */}
                {selectedOrder ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                          {selectedOrder.orderNumber || selectedOrder.order_number || selectedOrder.id}
                        </span>
                        <span className="text-sm font-bold text-amber-300">
                          {selectedOrder.customerName || selectedOrder.customer_name || selectedOrder.customer || formData.customer_name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                        <span>
                          {isAr ? 'إجمالي الطلب:' : 'Total:'}{' '}
                          <strong className="text-slate-200 font-mono">
                            {selectedOrder.totalAmount || selectedOrder.total_amount || 0}{' '}
                            {selectedOrder.currency || orderCurrency}
                          </strong>
                        </span>
                        {(selectedOrder.customerPhone || selectedOrder.phone) && (
                          <span>📞 {selectedOrder.customerPhone || selectedOrder.phone}</span>
                        )}
                        {selectedOrder.createdAt && (
                          <span>📅 {String(selectedOrder.createdAt).split('T')[0]}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(null);
                        setSelectedOrderItem(null);
                        setFormData(f => ({
                          ...f,
                          order_id: '',
                          customer_id: '',
                          customer_name: '',
                          order_item_id: '',
                          product_id: '',
                          product_name: '',
                          product_url: '',
                        }));
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex-shrink-0 self-start sm:self-center"
                    >
                      {isAr ? 'تغيير الطلب' : 'Change Order'}
                    </button>
                  </div>
                ) : (
                  /* في حال لم يتم اختيار طلب بعد - قائمة البحث والاختيار */
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={orderSearchQuery}
                        onChange={e => setOrderSearchQuery(e.target.value)}
                        placeholder={isAr ? 'ابحث برقم الطلب (مثال: ALX-...) أو اسم العميل أو الهاتف...' : 'Search by order #, customer name, phone...'}
                        className={inp + ' pr-9 text-xs'}
                        autoFocus
                      />
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/50">
                      {modalFilteredOrders.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          {isAr ? 'لم يتم العثور على طلبات مطابقة للبحث' : 'No matching orders found'}
                        </div>
                      ) : (
                        modalFilteredOrders.map((ord: any) => {
                          const oNum = ord.orderNumber || ord.order_number || ord.id;
                          const cName = ord.customerName || ord.customer_name || ord.customer || (isAr ? 'عميل' : 'Customer');
                          const cPhone = ord.customerPhone || ord.customer_phone || ord.phone || '';
                          const oTotal = ord.totalAmount || ord.total_amount || 0;
                          const oCur = ord.currency || orderCurrency;

                          return (
                            <div
                              key={`modal-order-${ord.id || oNum}`}
                              onClick={() => handleSelectOrder(ord)}
                              className="p-3 bg-slate-800/40 hover:bg-amber-500/10 hover:border-amber-500/40 border border-slate-700/50 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 group"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-amber-300 group-hover:text-amber-200">
                                    {oNum}
                                  </span>
                                  <span className="text-xs font-bold text-white">
                                    {cName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                  {cPhone && <span>📞 {cPhone}</span>}
                                  {ord.createdAt && <span>📅 {String(ord.createdAt).split('T')[0]}</span>}
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="text-xs font-black text-slate-200 block">
                                  {oTotal} {oCur}
                                </span>
                                <span className="text-[11px] text-amber-400 font-bold group-hover:underline">
                                  {isAr ? 'اختر الطلب ←' : 'Select →'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="text-xs text-rose-400 flex items-center gap-1.5 pt-1 font-bold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {isAr
                        ? 'ملاحظة: اختيار الطلب إجباري لتعبئة منتجاته وبيانات العميل تلقائياً.'
                        : 'Note: Selecting an order is required to automatically populate its items and customer.'}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. اختيار المنتج المرتجع من الطلب تلقائياً (إجباري) */}
              <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-cyan-400 uppercase flex items-center gap-2">
                    <Package className="w-4 h-4 text-cyan-400" />
                    {isAr ? '2. اختيار المنتج المرتجع من الطلب (إجباري)' : '2. Select Return Product from Order (Mandatory)'}
                  </h4>
                  {formData.product_name && (
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      {isAr ? 'تم تحديد المنتج ✓' : 'Product Selected ✓'}
                    </span>
                  )}
                </div>

                {!selectedOrder ? (
                  <div className="p-4 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl text-center text-xs text-slate-500">
                    {isAr
                      ? '🔒 يرجى اختيار الطلب من القائمة أعلاه أولاً لعرض المنتجات الخاصة به تلقائياً.'
                      : '🔒 Please select an order from above first to display its items automatically.'}
                  </div>
                ) : selectedOrderProducts.length === 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                      {isAr
                        ? 'لم يتم العثور على منتجات مسجلة في بنود هذا الطلب مباشرة. يمكنك إدخال اسم المنتج يدوياً:'
                        : 'No direct items found for this order. You can enter the product name manually:'}
                    </div>
                    <FieldLabel label={isAr ? 'اسم المنتج *' : 'Product Name *'}>
                      <input
                        required
                        value={formData.product_name || ''}
                        onChange={e => setFormData(f => ({ ...f, product_name: e.target.value }))}
                        className={inp}
                        placeholder={isAr ? 'اسم المنتج المرتجع' : 'Returned product name'}
                      />
                    </FieldLabel>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                      {isAr
                        ? `انقر على المنتج المرتجع من قائمة منتجات الطلب (${selectedOrderProducts.length} منتجات):`
                        : `Click to select the returned product (${selectedOrderProducts.length} items):`}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {selectedOrderProducts.map((item: any, idx: number) => {
                        const pName = item.product_cooler || item.product_name || item.productName || (isAr ? 'منتج غير محدد' : 'Unnamed Item');
                        const pQty = item.quantity || 1;
                        const pPrice = item.total_price || item.product_price || 0;
                        const isIns = Boolean(item.is_insured);
                        const isCurrentSelected =
                          (formData.order_item_id && (formData.order_item_id === item.items_id || formData.order_item_id === item.id)) ||
                          formData.product_name === pName;

                        return (
                          <div
                            key={`ord-prod-${item.items_id || item.id || idx}`}
                            onClick={() => handleSelectOrderItem(item)}
                            className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                              isCurrentSelected
                                ? 'bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400'
                                : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition ${
                                  isCurrentSelected ? 'bg-cyan-500 text-black' : 'border border-slate-600 text-transparent'
                                }`}
                              >
                                ✓
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-white">{pName}</h5>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span>{isAr ? 'الكمية:' : 'Qty:'} <strong className="text-slate-200">{pQty}</strong></span>
                                  <span>•</span>
                                  <span>{isAr ? 'السعر:' : 'Price:'} <strong className="text-slate-200">{pPrice} {formData.refund_currency}</strong></span>
                                  {isIns && (
                                    <span className="text-cyan-300 font-bold bg-cyan-500/20 px-1.5 py-0.2 rounded text-[9px]">
                                      🛡️ {isAr ? 'مؤمن' : 'Insured'}
                                    </span>
                                  )}
                                  {item.items_status && (
                                    <span className="text-slate-300 bg-slate-700 px-1.5 py-0.2 rounded text-[9px]">
                                      {item.items_status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <span
                                className={`text-[11px] font-bold px-2 py-1 rounded-lg ${
                                  isCurrentSelected
                                    ? 'bg-cyan-500 text-black'
                                    : 'bg-slate-700/60 text-slate-300'
                                }`}
                              >
                                {isCurrentSelected ? (isAr ? 'تم الاختيار ✓' : 'Selected ✓') : (isAr ? 'اختيار' : 'Select')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* حقول المنتج المختار بتوزيع شبكي متجاوب */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                      <div className="sm:col-span-2">
                        <FieldLabel label={isAr ? 'اسم المنتج المرتجع *' : 'Selected Product Name *'}>
                          <input
                            required
                            value={formData.product_name || ''}
                            onChange={e => setFormData(f => ({ ...f, product_name: e.target.value }))}
                            className={inp}
                            placeholder={isAr ? 'اسم المنتج المرتجع' : 'Returned product name'}
                          />
                        </FieldLabel>
                      </div>
                      <FieldLabel label={isAr ? 'الكمية المرتجعة' : 'Return Quantity'}>
                        <input
                          type="number"
                          min="1"
                          max={selectedOrderItem?.quantity || 999}
                          value={formData.quantity || 1}
                          onChange={e => setFormData(f => ({ ...f, quantity: Number(e.target.value) }))}
                          className={inp}
                        />
                      </FieldLabel>
                      <FieldLabel label={isAr ? 'حالة المنتج المُرتجع' : 'Product Condition'}>
                        <select
                          value={formData.return_condition || 'مستخدم'}
                          onChange={e => setFormData(f => ({ ...f, return_condition: e.target.value as ReturnCondition }))}
                          className={inp}
                        >
                          {RETURN_CONDITION_LIST.map((c, idx) => (
                            <option key={`ret-cond-form-${idx}`} value={c}>{c}</option>
                          ))}
                        </select>
                      </FieldLabel>
                    </div>

                    <FieldLabel label={isAr ? 'رابط المنتج' : 'Product URL'}>
                      <input
                        type="url"
                        value={formData.product_url || ''}
                        onChange={e => setFormData(f => ({ ...f, product_url: e.target.value }))}
                        className={inp}
                        placeholder="https://..."
                      />
                    </FieldLabel>
                  </div>
                )}
              </div>

              {/* 3 & 4. تفاصيل الإرجاع والاسترداد المالي جنباً إلى جنب على الشاشات الواسعة */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* 3. تفاصيل وإجراءات الإرجاع - Return Details */}
                <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-rose-400 uppercase flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-rose-400" />
                      {isAr ? '3. تفاصيل وإجراءات الإرجاع' : '3. Return Details & Status'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FieldLabel label={isAr ? 'نوع الإرجاع' : 'Return Type'}>
                        <select
                          value={formData.return_type || 'استرداد'}
                          onChange={e => setFormData(f => ({ ...f, return_type: e.target.value as ReturnType }))}
                          className={inp}
                        >
                          {RETURN_TYPE_LIST.map((t, idx) => (
                            <option key={`ret-type-form-${idx}`} value={t}>{t}</option>
                          ))}
                        </select>
                      </FieldLabel>
                      <FieldLabel label={isAr ? 'حالة المرتجع' : 'Return Status'}>
                        <select
                          value={formData.return_status || 'معلق'}
                          onChange={e => setFormData(f => ({ ...f, return_status: e.target.value as ReturnStatus }))}
                          className={inp}
                        >
                          {RETURN_STATUS_LIST.map((s, idx) => (
                            <option key={`ret-status-form-${idx}`} value={s}>{s}</option>
                          ))}
                        </select>
                      </FieldLabel>
                      <FieldLabel label={isAr ? 'تاريخ الإرجاع' : 'Return Date'}>
                        <input
                          type="date"
                          value={formData.returned_at ? String(formData.returned_at).split('T')[0] : ''}
                          onChange={e => setFormData(f => ({ ...f, returned_at: e.target.value }))}
                          className={inp}
                        />
                      </FieldLabel>
                    </div>
                  </div>

                  <FieldLabel label={isAr ? 'سبب الإرجاع *' : 'Return Reason *'}>
                    <textarea
                      required
                      rows={3}
                      value={formData.return_reason || ''}
                      onChange={e => setFormData(f => ({ ...f, return_reason: e.target.value }))}
                      className={inp + ' resize-none'}
                      placeholder={isAr ? 'اكتب سبب الإرجاع بالتفصيل (مثل: عيب مصنعي، مقاس غير مناسب)...' : 'Describe the return reason in detail...'}
                    />
                  </FieldLabel>
                </div>

                {/* 4. الاسترداد المالي والتأمين - Financial Refund & Insurance */}
                <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-emerald-400 uppercase flex items-center gap-2">
                      <span className="text-emerald-400">💰</span>
                      {isAr ? '4. الاسترداد المالي والتأمين' : '4. Financial Refund & Insurance'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FieldLabel label={isAr ? 'مبلغ الاسترداد' : 'Refund Amount'}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.refund_amount || 0}
                          onChange={e => setFormData(f => ({ ...f, refund_amount: Number(e.target.value) }))}
                          className={inp}
                        />
                      </FieldLabel>
                      <FieldLabel label={isAr ? 'عملة الاسترداد' : 'Refund Currency'}>
                        <select
                          value={formData.refund_currency || 'YER'}
                          onChange={e => setFormData(f => ({ ...f, refund_currency: e.target.value }))}
                          className={inp}
                        >
                          <option value="YER">YER — ريال يمني</option>
                          <option value="SAR">SAR — ريال سعودي</option>
                          <option value="USD">USD — دولار أمريكي</option>
                        </select>
                      </FieldLabel>
                    </div>

                    {/* التأمين - Insurance */}
                    <div className="flex items-center gap-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                      <input
                        type="checkbox"
                        id="return-is-insured"
                        checked={Boolean(formData.is_insured)}
                        onChange={e => setFormData(f => ({ ...f, is_insured: e.target.checked }))}
                        className="w-4 h-4 accent-cyan-500 cursor-pointer"
                      />
                      <label htmlFor="return-is-insured" className="text-xs text-cyan-300 font-bold cursor-pointer">
                        <ShieldCheck className="w-3.5 h-3.5 inline ml-1 text-cyan-400" />
                        {isAr ? 'المنتج مؤمن — تفعيل استرداد رسوم التأمين' : 'Product is insured — Enable insurance refund'}
                      </label>
                    </div>
                    {formData.is_insured && (
                      <FieldLabel label={isAr ? 'مبلغ استرداد التأمين' : 'Insurance Refund Amount'}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.insurance_refund || 0}
                          onChange={e => setFormData(f => ({ ...f, insurance_refund: Number(e.target.value) }))}
                          className={inp}
                        />
                      </FieldLabel>
                    )}
                  </div>

                  {/* شريط الإجمالي المسترد */}
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-300">
                    <span>{isAr ? 'إجمالي المسترد المتوقع للعميل:' : 'Total Expected Refund:'}</span>
                    <span className="text-base font-black text-white font-mono">
                      {(Number(formData.refund_amount) || 0) + (formData.is_insured ? Number(formData.insurance_refund) || 0 : 0)}{' '}
                      {formData.refund_currency}
                    </span>
                  </div>
                </div>

              </div>

              {/* ملاحظات إضافية - Notes */}
              <FieldLabel label={isAr ? 'ملاحظات إضافية' : 'Additional Notes'}>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  className={inp + ' resize-none'}
                  placeholder={isAr ? 'أي ملاحظات إضافية حول فحص المنتج أو سياسة الإرجاع…' : 'Any additional notes…'}
                />
              </FieldLabel>

            </div>

            {/* شريط الأزرار السفلي الثابت - Fixed Form Footer */}
            <footer className="px-5 sm:px-7 py-3.5 sm:py-4 border-t border-slate-800 bg-[#151518] flex items-center justify-between gap-3 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <span>{isAr ? 'إجمالي الاسترداد المتوقع:' : 'Expected Refund:'}</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {(Number(formData.refund_amount) || 0) + (formData.is_insured ? Number(formData.insurance_refund) || 0 : 0)}{' '}
                  {formData.refund_currency}
                </span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition text-xs font-bold disabled:opacity-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {isAr ? 'جارٍ الحفظ…' : 'Saving…'}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      {isAr ? 'حفظ المرتجع' : 'Save Return'}
                    </>
                  )}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}

      {/* ════════════ نافذة تأكيد الحذف ════════════ */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setDeletingReturn(null); }}
        onConfirm={handleDelete}
        title={isAr ? 'حذف المرتجع' : 'Delete Return'}
        message={
          isAr
            ? `هل أنت متأكد من حذف سجل المرتجع للمنتج "${deletingReturn?.product_name || ''}" من العميل "${deletingReturn?.customer_name || ''}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete the return record for "${deletingReturn?.product_name || ''}" from "${deletingReturn?.customer_name || ''}"? This action cannot be undone.`
        }
        confirmText={isAr ? 'حذف نهائي' : 'Delete'}
        type="danger"
      />
    </div>
  );
}
