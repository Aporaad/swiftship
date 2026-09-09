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
  CheckCircle2,
  ChevronDown,
  Edit2,
  Filter,
  Package,
  PackageX,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
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
  processed_at: '',
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
}: ReturnedProductsTabProps) {
  const { role, hasPermission, profile } = useRole();

  // ────────── State: البيانات - Data ──────────
  const [returns, setReturns] = useState<ReturnedProduct[]>([]);
  const [loading, setLoading] = useState(true);

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
    setFormData(emptyReturnForm());
    setIsFormOpen(true);
  };

  // ────────── فتح نموذج التعديل - Open Edit Form ──────────
  const openEditForm = (ret: ReturnedProduct) => {
    setEditingReturn(ret);
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
      is_insured: ret.is_insured || false,
      insurance_refund: ret.insurance_refund || 0,
      notes: ret.notes || '',
      returned_at: ret.returned_at ? ret.returned_at.split('T')[0] : new Date().toISOString().split('T')[0],
      processed_by: ret.processed_by || '',
      processed_at: ret.processed_at || '',
    });
    setIsFormOpen(true);
  };

  // ────────── حفظ المرتجع - Save Return ──────────
  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name?.trim() && !formData.customer_id) {
      toast.error(isAr ? 'اسم العميل مطلوب' : 'Customer name is required');
      return;
    }
    if (!formData.product_name?.trim()) {
      toast.error(isAr ? 'اسم المنتج مطلوب' : 'Product name is required');
      return;
    }

    setSubmitting(true);
    try {
      const currentUser = profile?.displayName || profile?.email || 'system';

      if (editingReturn) {
        // تحديث مرتجع موجود - Update existing return
        await updateDoc(doc(db, 'returned_products', editingReturn.return_id), {
          ...formData,
          quantity: Math.max(1, Number(formData.quantity) || 1),
          refund_amount: Math.max(0, Number(formData.refund_amount) || 0),
          insurance_refund: formData.is_insured ? Math.max(0, Number(formData.insurance_refund) || 0) : 0,
          is_insured: Boolean(formData.is_insured),
          updated_at: new Date().toISOString(),
          updated_by: currentUser,
        });
        toast.success(isAr ? 'تم تحديث المرتجع بنجاح' : 'Return updated successfully');
      } else {
        // إنشاء مرتجع جديد - Create new return
        const return_id = 'ret_' + Math.random().toString(36).substring(2, 11);
        await addDoc(return_id, collection(db, 'returned_products'), {
          return_id,
          ...formData,
          quantity: Math.max(1, Number(formData.quantity) || 1),
          refund_amount: Math.max(0, Number(formData.refund_amount) || 0),
          insurance_refund: formData.is_insured ? Math.max(0, Number(formData.insurance_refund) || 0) : 0,
          is_insured: Boolean(formData.is_insured),
          return_status: formData.return_status || 'معلق',
          return_type: formData.return_type || 'استرداد',
          return_condition: formData.return_condition || 'مستخدم',
          returned_at: formData.returned_at || new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          created_by: currentUser,
          updated_at: new Date().toISOString(),
          updated_by: currentUser,
        });
        toast.success(isAr ? 'تم إضافة المرتجع بنجاح' : 'Return added successfully');
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
              {RETURN_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* فلتر النوع - Type filter */}
            <select
              id="returns-type-filter"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className={inp + ' max-w-[140px]'}
            >
              <option value="all">{isAr ? 'كل الأنواع' : 'All types'}</option>
              {RETURN_TYPE_LIST.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* فلتر الحالة الفيزيائية - Condition filter */}
            <select
              id="returns-condition-filter"
              value={conditionFilter}
              onChange={e => setConditionFilter(e.target.value)}
              className={inp + ' max-w-[140px]'}
            >
              <option value="all">{isAr ? 'كل الحالات' : 'All conditions'}</option>
              {RETURN_CONDITION_LIST.map(c => <option key={c} value={c}>{c}</option>)}
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
              ) : filteredReturns.map(ret => (
                <tr key={ret.return_id} className="hover:bg-slate-900/40 transition-colors group">

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
                          {RETURN_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
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
        <div className="fixed inset-0 z-[1000000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveReturn}
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#121215] border border-rose-500/30 rounded-3xl shadow-2xl"
          >
            {/* رأس النموذج - Form header */}
            <header className="p-5 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#121215] z-10">
              <div>
                <h3 className="text-white font-black flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  {editingReturn
                    ? (isAr ? 'تعديل بيانات المرتجع' : 'Edit Return Record')
                    : (isAr ? 'إضافة مرتجع جديد' : 'Add New Return')}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isAr
                    ? 'أدخل تفاصيل المنتج المرتجع والسبب وقيمة الاسترداد'
                    : 'Enter returned product details, reason, and refund amount'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-5 space-y-4">

              {/* معلومات الطلب والعميل - Order & Customer info */}
              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase">
                  {isAr ? '📦 معلومات الطلب والعميل' : '📦 Order & Customer Info'}
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <FieldLabel label={isAr ? 'رقم الطلب' : 'Order Number'}>
                    <input
                      value={formData.order_id || ''}
                      onChange={e => setFormData(f => ({ ...f, order_id: e.target.value }))}
                      className={inp}
                      placeholder={isAr ? 'مثال: ALX-2609-1001' : 'e.g. ALX-2609-1001'}
                    />
                  </FieldLabel>
                  <FieldLabel label={isAr ? 'اسم العميل *' : 'Customer Name *'}>
                    <input
                      required
                      value={formData.customer_name || ''}
                      onChange={e => setFormData(f => ({ ...f, customer_name: e.target.value }))}
                      className={inp}
                      placeholder={isAr ? 'اسم العميل' : 'Customer name'}
                    />
                  </FieldLabel>
                </div>
              </div>

              {/* معلومات المنتج - Product info */}
              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase">
                  {isAr ? '🏷️ معلومات المنتج' : '🏷️ Product Info'}
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <FieldLabel label={isAr ? 'اسم المنتج *' : 'Product Name *'}>
                    <input
                      required
                      value={formData.product_name || ''}
                      onChange={e => setFormData(f => ({ ...f, product_name: e.target.value }))}
                      className={inp}
                      placeholder={isAr ? 'اسم المنتج' : 'Product name'}
                    />
                  </FieldLabel>
                  <FieldLabel label={isAr ? 'الكمية' : 'Quantity'}>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity || 1}
                      onChange={e => setFormData(f => ({ ...f, quantity: Number(e.target.value) }))}
                      className={inp}
                    />
                  </FieldLabel>
                  <FieldLabel label={isAr ? 'رابط المنتج' : 'Product URL'}>
                    <input
                      type="url"
                      value={formData.product_url || ''}
                      onChange={e => setFormData(f => ({ ...f, product_url: e.target.value }))}
                      className={inp}
                      placeholder="https://..."
                    />
                  </FieldLabel>
                  <FieldLabel label={isAr ? 'حالة المنتج المُرتجع' : 'Product Condition'}>
                    <select
                      value={formData.return_condition || 'مستخدم'}
                      onChange={e => setFormData(f => ({ ...f, return_condition: e.target.value as ReturnCondition }))}
                      className={inp}
                    >
                      {RETURN_CONDITION_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FieldLabel>
                </div>
              </div>

              {/* تفاصيل الإرجاع - Return details */}
              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase">
                  {isAr ? '🔄 تفاصيل الإرجاع' : '🔄 Return Details'}
                </h4>
                <div className="grid md:grid-cols-3 gap-3">
                  <FieldLabel label={isAr ? 'نوع الإرجاع' : 'Return Type'}>
                    <select
                      value={formData.return_type || 'استرداد'}
                      onChange={e => setFormData(f => ({ ...f, return_type: e.target.value as ReturnType }))}
                      className={inp}
                    >
                      {RETURN_TYPE_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FieldLabel>
                  <FieldLabel label={isAr ? 'حالة المرتجع' : 'Return Status'}>
                    <select
                      value={formData.return_status || 'معلق'}
                      onChange={e => setFormData(f => ({ ...f, return_status: e.target.value as ReturnStatus }))}
                      className={inp}
                    >
                      {RETURN_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
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
                <FieldLabel label={isAr ? 'سبب الإرجاع *' : 'Return Reason *'}>
                  <textarea
                    required
                    rows={2}
                    value={formData.return_reason || ''}
                    onChange={e => setFormData(f => ({ ...f, return_reason: e.target.value }))}
                    className={inp + ' resize-none'}
                    placeholder={isAr ? 'اكتب سبب الإرجاع التفصيلي…' : 'Describe the return reason in detail…'}
                  />
                </FieldLabel>
              </div>

              {/* الاسترداد المالي - Financial refund */}
              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase">
                  {isAr ? '💰 الاسترداد المالي' : '💰 Financial Refund'}
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
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
                <div className="flex items-center gap-3 p-2 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                  <input
                    type="checkbox"
                    id="return-is-insured"
                    checked={Boolean(formData.is_insured)}
                    onChange={e => setFormData(f => ({ ...f, is_insured: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <label htmlFor="return-is-insured" className="text-xs text-cyan-300 font-bold cursor-pointer">
                    <ShieldCheck className="w-3.5 h-3.5 inline ml-1" />
                    {isAr ? 'المنتج مؤمن — أضف مبلغ استرداد التأمين' : 'Product is insured — Add insurance refund'}
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

              {/* ملاحظات - Notes */}
              <FieldLabel label={isAr ? 'ملاحظات إضافية' : 'Additional Notes'}>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  className={inp + ' resize-none'}
                  placeholder={isAr ? 'أي ملاحظات إضافية…' : 'Any additional notes…'}
                />
              </FieldLabel>

              {/* أزرار الحفظ والإلغاء - Save & Cancel buttons */}
              <div className="flex justify-end gap-3 pt-2">
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
            </div>
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
