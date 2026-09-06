/**
 * ProductsManagementTab.tsx
 * واجهة إدارة المنتجات الرئيسية وحركة المنتجات (بنود الطلبات)
 * Two-tab interface: Master Products Catalog + Product Movements (order_items)
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp, Boxes, Edit2, ExternalLink, PackagePlus,
  Search, Trash2, X, RefreshCw, RotateCcw, Eye, ShieldCheck,
  ChevronDown, Filter, Package, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';
import { addDoc, collection, db, deleteDoc, doc, onSnapshot, updateDoc } from '../../lib/supabase';
import { useItemCategories } from '../../hooks/useItemCategories';
import { useExchangeRates } from '../../hooks/useExchangeRates';
import { useRole } from '../../hooks/useRole';

// ────────────────────── Types ──────────────────────

/** نوع المنتج الرئيسي - Master product record */
type MasterProduct = {
  product_id: string;
  product_name_ar?: string;
  product_name_en?: string;
  product_url?: string;
  unit_price?: number;
  item_category_id?: string;
  is_allowed?: boolean;
  cbm?: number;
  width?: number;
  height?: number;
  length?: number;
  weight?: number;
  created_at?: string;
  created_by?: string;
  // For backwards compatibility with old data
  productName?: string;
  name?: string;
  productPrice?: number;
};

/** نوع بند الطلب - Order line item record */
type OrderItem = {
  items_id: string;
  order_id?: string;
  product_id?: string;
  product_price?: number;
  product_url?: string;
  tracking_number?: string;
  produc_source_id?: string;
  product_cooler?: string;
  nota?: string;
  quantity?: number;
  total_price?: number;
  total__weight?: number;
  total_cbm?: number;
  packaging_option_id?: string;
  packaging_option_price?: number;
  is_insured?: boolean;
  insurance_fee?: number;
  items_status?: string;
  created_at?: string;
  created_by?: string;
};

/** أنماط نموذج المنتج الرئيسي - Form for master product */
type ProductForm = {
  product_name_ar: string;
  product_name_en: string;
  product_url: string;
  unit_price: number;
  item_category_id: string;
  is_allowed: boolean;
  cbm: number;
  width: number;
  height: number;
  length: number;
  weight: number;
};

const emptyProductForm = (): ProductForm => ({
  product_name_ar: '', product_name_en: '', product_url: '',
  unit_price: 0, item_category_id: '', is_allowed: true,
  cbm: 0, width: 0, height: 0, length: 0, weight: 0,
});

/** حالات بند الطلب - Order item statuses */
const ITEM_STATUS_LIST = [
  'قيد الطلب', 'محجوز بالميناء', 'تم مصادرته', 'وصل المخزن', 'تم التسليم', 'مرتجع'
];

// ────────────────────── Helpers ──────────────────────

const inp = 'w-full bg-black/35 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60';

const FieldLabel = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-1">
    <span className="block text-[10px] text-slate-500 font-black">{label}</span>
    {children}
  </label>
);

// ────────────────────── Component ──────────────────────

export default function ProductsManagementTab({
  isAr,
  canManage,
  orderCurrency = 'SAR',
}: {
  isAr: boolean;
  canManage: boolean;
  orderCurrency?: string;
}) {
  const { role, hasPermission } = useRole();
  const { categories } = useItemCategories();
  const { activeCurrencies } = useExchangeRates();

  // ── تبويب نشط: المنتجات الرئيسية أم حركة المنتجات ──
  // Active sub-tab: Master Products or Product Movements
  const [activeSubTab, setActiveSubTab] = useState<'master' | 'movements'>('master');

  // ──────────── Master Products State ────────────
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [orderItemCounts, setOrderItemCounts] = useState<Record<string, number>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productAllowedFilter, setProductAllowedFilter] = useState<'all' | 'allowed' | 'blocked'>('all');
  const [productSortBy, setProductSortBy] = useState<'newest' | 'name' | 'price'>('newest');
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<MasterProduct | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm());
  const [submittingProduct, setSubmittingProduct] = useState(false);

  // ──────────── Order Items (Movements) State ────────────
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemSearch, setItemSearch] = useState('');
  const [itemStatusFilter, setItemStatusFilter] = useState('all');
  const [returningItem, setReturningItem] = useState<OrderItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<OrderItem | null>(null);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [itemStatusEdit, setItemStatusEdit] = useState('');

  // ──────────── جلب المنتجات الرئيسية ────────────
  // Fetch master products from 'products' table
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap: any) => {
      setProducts(snap.docs.map((d: any) => ({ product_id: d.id, ...d.data() })));
      setLoadingProducts(false);
    }, () => setLoadingProducts(false));
    return () => unsub?.();
  }, []);

  // ──────────── جلب بنود الطلبات ────────────
  // Fetch order items from 'order_items' table
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'order_items'), (snap: any) => {
      const items = snap.docs.map((d: any) => ({ items_id: d.id, ...d.data() }));
      setOrderItems(items);
      setLoadingItems(false);

      // احتساب عدد الطلبات لكل منتج رئيسي
      // Count order_items per master product
      const counts: Record<string, number> = {};
      items.forEach((it: OrderItem) => {
        if (it.product_id) {
          counts[it.product_id] = (counts[it.product_id] || 0) + 1;
        }
      });
      setOrderItemCounts(counts);
    }, () => setLoadingItems(false));
    return () => unsub?.();
  }, []);

  // ──────────── فلترة المنتجات الرئيسية ────────────
  const filteredProducts = useMemo(() => products.filter(p => {
    const name = (p.product_name_ar || p.productName || p.name || '').toLowerCase();
    const nameEn = (p.product_name_en || '').toLowerCase();
    const query = productSearch.toLowerCase();
    const matchesSearch = !query || name.includes(query) || nameEn.includes(query);
    const matchesCat = productCategoryFilter === 'all' || p.item_category_id === productCategoryFilter;
    const matchesAllowed = productAllowedFilter === 'all'
      ? true
      : productAllowedFilter === 'allowed'
        ? p.is_allowed !== false
        : p.is_allowed === false;
    return matchesSearch && matchesCat && matchesAllowed;
  }).sort((a, b) => {
    if (productSortBy === 'name') return (a.product_name_ar || '').localeCompare(b.product_name_ar || '', 'ar');
    if (productSortBy === 'price') return (b.unit_price || 0) - (a.unit_price || 0);
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  }), [products, productSearch, productCategoryFilter, productAllowedFilter, productSortBy]);

  // ──────────── فلترة حركات المنتجات ────────────
  const filteredItems = useMemo(() => orderItems.filter(it => {
    const query = itemSearch.toLowerCase();
    const matchesSearch = !query
      || (it.order_id || '').toLowerCase().includes(query)
      || (it.product_cooler || '').toLowerCase().includes(query)
      || (it.tracking_number || '').toLowerCase().includes(query)
      || (it.product_id || '').toLowerCase().includes(query);
    const matchesStatus = itemStatusFilter === 'all' || it.items_status === itemStatusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    [orderItems, itemSearch, itemStatusFilter]);

  // ──────────── دوال نموذج المنتج الرئيسي ────────────
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm(emptyProductForm());
    setIsProductModalOpen(true);
  };

  const openEditProduct = (p: MasterProduct) => {
    setEditingProduct(p);
    setProductForm({
      product_name_ar: p.product_name_ar || p.productName || p.name || '',
      product_name_en: p.product_name_en || '',
      product_url: p.product_url || '',
      unit_price: Number(p.unit_price || p.productPrice || 0),
      item_category_id: p.item_category_id || '',
      is_allowed: p.is_allowed !== false,
      cbm: Number(p.cbm || 0),
      width: Number(p.width || 0),
      height: Number(p.height || 0),
      length: Number(p.length || 0),
      weight: Number(p.weight || 0),
    });
    setIsProductModalOpen(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.product_name_ar.trim()) {
      toast.error(isAr ? 'اسم المنتج العربي مطلوب' : 'Arabic product name is required');
      return;
    }
    setSubmittingProduct(true);
    try {
      const payload = {
        product_name_ar:  productForm.product_name_ar.trim(),
        product_name_en:  productForm.product_name_en.trim() || productForm.product_name_ar.trim(),
        product_url:      productForm.product_url.trim(),
        unit_price:       Math.max(0, Number(productForm.unit_price) || 0),
        item_category_id: productForm.item_category_id || null,
        is_allowed:       productForm.is_allowed,
        cbm:              Math.max(0, Number(productForm.cbm) || 0),
        width:            Math.max(0, Number(productForm.width) || 0),
        height:           Math.max(0, Number(productForm.height) || 0),
        length:           Math.max(0, Number(productForm.length) || 0),
        weight:           Math.max(0, Number(productForm.weight) || 0),
        updated_at:       new Date().toISOString(),
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.product_id), payload);
      } else {
        const newId = 'prod_' + Math.random().toString(36).substring(2, 11);
        await addDoc(newId, collection(db, 'products'), {
          product_id: newId, ...payload, created_at: new Date().toISOString(),
        });
      }
      toast.success(isAr ? 'تم حفظ المنتج' : 'Product saved');
      setIsProductModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر حفظ المنتج' : 'Could not save product'));
    } finally {
      setSubmittingProduct(false);
    }
  };

  const deleteProduct = async (p: MasterProduct) => {
    try {
      await deleteDoc(doc(db, 'products', p.product_id));
      toast.success(isAr ? 'تم حذف المنتج' : 'Product deleted');
      setDeletingProduct(null);
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر حذف المنتج' : 'Could not delete product'));
    }
  };

  // ──────────── إرجاع بند مؤمن ────────────
  // Return an insured order item – sets status to 'مرتجع'
  const returnItem = async (item: OrderItem) => {
    if (!item.is_insured) {
      toast.error(isAr ? 'لا يمكن إرجاع منتج غير مؤمن' : 'Only insured items can be returned');
      return;
    }
    try {
      await updateDoc(doc(db, 'order_items', item.items_id), {
        items_status: 'مرتجع',
        updated_at: new Date().toISOString(),
      });
      toast.success(isAr ? 'تم إرجاع المنتج وتغيير حالته إلى مرتجع' : 'Item returned successfully');
      setReturningItem(null);
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر إرجاع المنتج' : 'Return failed'));
    }
  };

  // ──────────── تحديث حالة بند الطلب ────────────
  const updateItemStatus = async (item: OrderItem, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'order_items', item.items_id), {
        items_status: newStatus,
        updated_at: new Date().toISOString(),
      });
      toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      setEditingItem(null);
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر تحديث الحالة' : 'Update failed'));
    }
  };

  // ──────────── حذف بند طلب ────────────
  const deleteItem = async (item: OrderItem) => {
    try {
      await deleteDoc(doc(db, 'order_items', item.items_id));
      toast.success(isAr ? 'تم حذف بند الطلب' : 'Order item deleted');
      setDeletingItem(null);
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'تعذر الحذف' : 'Delete failed'));
    }
  };

  // ──────────── لون حالة البند ────────────
  const statusColor = (status?: string) => {
    if (status === 'تم التسليم') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    if (status === 'مرتجع') return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
    if (status === 'تم مصادرته' || status === 'محجوز بالميناء') return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
    return 'bg-slate-800 text-slate-400';
  };

  const money = (v: unknown) => `${Number(v || 0).toLocaleString()} ${orderCurrency}`;

  const canViewProducts   = role === 'Admin' || hasPermission('view_products');
  const canEditProducts   = role === 'Admin' || hasPermission('edit_products');
  const canDeleteProducts = role === 'Admin' || hasPermission('delete_products');
  const canViewItems      = role === 'Admin' || hasPermission('view_order_items');
  const canEditItems      = role === 'Admin' || hasPermission('edit_order_items');
  const canReturnItem     = role === 'Admin' || hasPermission('return_order_items');

  // ════════════════ RENDER ════════════════
  return (
    <div className="space-y-5 text-start animate-fade-in" data-testid="products-management-tab">

      {/* ── رأس القسم والعنوان ── Section header */}
      <section className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37]">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg text-white font-black">
                {isAr ? 'إدارة المنتجات' : 'Products Management'}
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-1">
                {isAr
                  ? 'كتالوج المنتجات الرئيسية وحركتها عبر الطلبات.'
                  : 'Master product catalog and their movements across orders.'}
              </p>
            </div>
          </div>

          {/* أزرار التبويب الفرعي - Sub-tab buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSubTab('master')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${activeSubTab === 'master'
                ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              <Package className="w-3.5 h-3.5" />
              {isAr ? 'المنتجات الرئيسية' : 'Master Products'}
              <span className="bg-black/20 px-1.5 py-0.5 rounded font-mono text-[10px]">
                {products.length}
              </span>
            </button>
            <button
              onClick={() => setActiveSubTab('movements')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${activeSubTab === 'movements'
                ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              <Activity className="w-3.5 h-3.5" />
              {isAr ? 'حركة المنتجات' : 'Product Movements'}
              <span className="bg-black/20 px-1.5 py-0.5 rounded font-mono text-[10px]">
                {orderItems.length}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════ */}
      {/* TAB 1: كتالوج المنتجات الرئيسية             */}
      {/* ════════════════════════════════════════════ */}
      {activeSubTab === 'master' && (
        <section className="space-y-4 animate-fade-in">
          {/* أدوات البحث والفلاتر وزر الإضافة */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 flex-1 items-center">
              {/* بحث */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث بالاسم…' : 'Search by name…'}
                  className={`${inp} pr-9`}
                />
              </div>
              {/* فلتر الفئة */}
              <select
                value={productCategoryFilter}
                onChange={e => setProductCategoryFilter(e.target.value)}
                className={inp + ' max-w-[160px]'}
              >
                <option value="all">{isAr ? 'كل الفئات' : 'All categories'}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{isAr ? c.nameAr : c.nameEn}</option>
                ))}
              </select>
              {/* فلتر مسموح/محظور */}
              <select
                value={productAllowedFilter}
                onChange={e => setProductAllowedFilter(e.target.value as any)}
                className={inp + ' max-w-[140px]'}
              >
                <option value="all">{isAr ? 'الكل' : 'All'}</option>
                <option value="allowed">{isAr ? 'مسموح' : 'Allowed'}</option>
                <option value="blocked">{isAr ? 'محظور' : 'Blocked'}</option>
              </select>
              {/* ترتيب */}
              <button
                onClick={() => setProductSortBy(s => s === 'newest' ? 'name' : s === 'name' ? 'price' : 'newest')}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[#d4af37] hover:bg-slate-800 transition"
                title={isAr ? 'تغيير الترتيب' : 'Change sort'}
              >
                <ArrowDownUp className="w-4 h-4" />
              </button>
            </div>
            {(canManage || canEditProducts) && (
              <button
                onClick={openCreateProduct}
                className="bg-gradient-to-r from-[#d4af37] to-yellow-600 text-black rounded-2xl px-5 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer"
              >
                <PackagePlus className="w-4 h-4" />
                {isAr ? 'إضافة منتج' : 'Add Product'}
              </button>
            )}
          </div>

          {/* جدول المنتجات الرئيسية */}
          <div className="bg-slate-950/45 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex justify-between text-xs">
              <span className="font-black text-slate-300">
                {isAr ? 'المنتجات الظاهرة' : 'Visible Products'}
              </span>
              <span className="text-[#d4af37] font-mono font-black">{filteredProducts.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead className="bg-black/30 text-slate-500 text-[10px] uppercase">
                  <tr>
                    <th className="p-3 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                    <th className="p-3 text-start">{isAr ? 'الفئة' : 'Category'}</th>
                    <th className="p-3 text-start">{isAr ? 'السعر' : 'Price'}</th>
                    <th className="p-3 text-start">{isAr ? 'الوزن / CBM' : 'Weight / CBM'}</th>
                    <th className="p-3 text-center">{isAr ? 'عدد الطلبات' : 'Orders'}</th>
                    <th className="p-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loadingProducts ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-500">
                      {isAr ? 'جارٍ تحميل المنتجات…' : 'Loading products…'}
                    </td></tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-500">
                      {isAr ? 'لا توجد منتجات مطابقة' : 'No matching products'}
                    </td></tr>
                  ) : filteredProducts.map(p => {
                    const catName = categories.find(c => c.id === p.item_category_id);
                    const orderCount = orderItemCounts[p.product_id] || 0;
                    return (
                      <tr key={p.product_id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3">
                          <div className="font-black text-white">
                            {p.product_name_ar || p.productName || p.name || '—'}
                          </div>
                          {p.product_name_en && (
                            <div className="text-[10px] text-slate-500">{p.product_name_en}</div>
                          )}
                          {p.product_url && (
                            <a href={p.product_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-cyan-400 text-[10px] mt-0.5">
                              <ExternalLink className="w-3 h-3" />
                              {isAr ? 'الرابط' : 'Link'}
                            </a>
                          )}
                        </td>
                        <td className="p-3 text-cyan-300 text-xs">
                          {catName ? (isAr ? catName.nameAr : catName.nameEn) : '—'}
                        </td>
                        <td className="p-3 font-mono text-amber-300">
                          {money(p.unit_price || p.productPrice)}
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          <div>{Number(p.weight || 0).toLocaleString()} kg</div>
                          <div className="text-[10px]">{Number(p.cbm || 0).toFixed(3)} CBM</div>
                        </td>
                        <td className="p-3 text-center">
                          {orderCount > 0 ? (
                            <button
                              onClick={() => { setItemSearch(p.product_id); setActiveSubTab('movements'); }}
                              className="bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] px-2 py-0.5 rounded-lg font-mono font-black text-[11px] cursor-pointer hover:bg-[#d4af37]/20 transition"
                              title={isAr ? 'عرض حركة هذا المنتج' : 'View product movements'}
                            >
                              {orderCount} {isAr ? 'طلب' : 'orders'}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${p.is_allowed !== false
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
                            {p.is_allowed !== false
                              ? (isAr ? 'مسموح' : 'Allowed')
                              : (isAr ? 'محظور' : 'Blocked')}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            {(canManage || canEditProducts) && (
                              <button
                                onClick={() => openEditProduct(p)}
                                className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition"
                                title={isAr ? 'تعديل' : 'Edit'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(canManage || canDeleteProducts) && (
                              <button
                                onClick={() => setDeletingProduct(p)}
                                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                                title={isAr ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB 2: حركة المنتجات (order_items)          */}
      {/* ════════════════════════════════════════════ */}
      {activeSubTab === 'movements' && (
        <section className="space-y-4 animate-fade-in">
          {/* أدوات البحث والفلاتر */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 flex-1 items-center">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                <input
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث برقم الطلب أو المنتج أو التتبع…' : 'Search by order, product or tracking…'}
                  className={`${inp} pr-9`}
                />
              </div>
              <select
                value={itemStatusFilter}
                onChange={e => setItemStatusFilter(e.target.value)}
                className={inp + ' max-w-[180px]'}
              >
                <option value="all">{isAr ? 'جميع الحالات' : 'All statuses'}</option>
                {ITEM_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {itemSearch && (
                <button
                  onClick={() => setItemSearch('')}
                  className="p-2 rounded-xl bg-rose-900/20 border border-rose-800/30 text-rose-400 hover:bg-rose-900 transition text-[10px] font-bold"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-bold">
              {isAr ? `إجمالي الحركات: ${filteredItems.length}` : `Total movements: ${filteredItems.length}`}
            </div>
          </div>

          {/* جدول حركات المنتجات */}
          <div className="bg-slate-950/45 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1000px]">
                <thead className="bg-black/30 text-slate-500 text-[10px] uppercase">
                  <tr>
                    <th className="p-3 text-start">{isAr ? 'رقم الطلب' : 'Order'}</th>
                    <th className="p-3 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                    <th className="p-3 text-start">{isAr ? 'الكمية والقيمة' : 'Qty & Value'}</th>
                    <th className="p-3 text-start">{isAr ? 'الوزن / CBM' : 'Weight / CBM'}</th>
                    <th className="p-3 text-center">{isAr ? 'مؤمن' : 'Insured'}</th>
                    <th className="p-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loadingItems ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-500">
                      {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                    </td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-500">
                      {isAr ? 'لا توجد حركات مطابقة' : 'No matching movements'}
                    </td></tr>
                  ) : filteredItems.map(item => {
                    // إيجاد اسم المنتج الرئيسي
                    const masterProd = products.find(p => p.product_id === item.product_id);
                    const displayName = item.product_cooler
                      || masterProd?.product_name_ar || masterProd?.productName || '—';

                    return (
                      <tr key={item.items_id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3">
                          <div className="font-mono font-black text-[#d4af37]">
                            {item.order_id || '—'}
                          </div>
                          {item.tracking_number && (
                            <div className="text-[10px] text-slate-500">{item.tracking_number}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-white">{displayName}</div>
                          {item.product_url && (
                            <a href={item.product_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-cyan-400 text-[10px]">
                              <ExternalLink className="w-3 h-3" />
                              {isAr ? 'رابط المنتج' : 'Product link'}
                            </a>
                          )}
                        </td>
                        <td className="p-3 font-mono">
                          <div className="text-white">{Number(item.quantity || 0).toLocaleString()} {isAr ? 'قطعة' : 'pcs'}</div>
                          <div className="text-amber-300">
                            {money(item.total_price)}
                          </div>
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          <div>{Number(item.total__weight || 0).toLocaleString()} kg</div>
                          <div className="text-[10px]">{Number(item.total_cbm || 0).toFixed(3)} CBM</div>
                        </td>
                        <td className="p-3 text-center">
                          {item.is_insured ? (
                            <div>
                              <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 justify-center">
                                <ShieldCheck className="w-3 h-3" />
                                {isAr ? 'مؤمن' : 'Insured'}
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {money(item.insurance_fee)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {editingItem?.items_id === item.items_id ? (
                            <div className="flex items-center gap-1 justify-center">
                              <select
                                value={itemStatusEdit}
                                onChange={e => setItemStatusEdit(e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-white rounded-lg text-[10px] p-1 outline-none"
                              >
                                {ITEM_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button
                                onClick={() => updateItemStatus(item, itemStatusEdit)}
                                className="p-1 bg-emerald-600 rounded text-white text-[10px]"
                              >✓</button>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="p-1 bg-slate-700 rounded text-white text-[10px]"
                              >✕</button>
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusColor(item.items_status)}`}>
                              {item.items_status || 'قيد الطلب'}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            {/* تعديل الحالة */}
                            {(canManage || canEditItems) && editingItem?.items_id !== item.items_id && (
                              <button
                                onClick={() => { setEditingItem(item); setItemStatusEdit(item.items_status || 'قيد الطلب'); }}
                                className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition"
                                title={isAr ? 'تعديل الحالة' : 'Edit status'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* إرجاع المنتج المؤمن */}
                            {(canManage || canReturnItem) && item.is_insured && item.items_status !== 'مرتجع' && (
                              <button
                                onClick={() => setReturningItem(item)}
                                className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
                                title={isAr ? 'إرجاع المنتج (مؤمن)' : 'Return insured item'}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* حذف البند */}
                            {(canManage || canEditItems) && (
                              <button
                                onClick={() => setDeletingItem(item)}
                                className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                                title={isAr ? 'حذف البند' : 'Delete item'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ════════════ نافذة إنشاء / تعديل منتج رئيسي ════════════ */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[1000000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={saveProduct}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#121215] border border-[#d4af37]/30 rounded-3xl shadow-2xl"
          >
            <header className="p-5 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#121215] z-10">
              <div>
                <h3 className="text-white font-black">
                  {editingProduct
                    ? (isAr ? 'تعديل المنتج الرئيسي' : 'Edit Master Product')
                    : (isAr ? 'إضافة منتج رئيسي' : 'Add Master Product')}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isAr
                    ? 'يُحفظ في جدول products الرئيسي بدون ربط بطلب.'
                    : 'Saved in master products table, no order link.'}
                </p>
              </div>
              <button type="button" onClick={() => setIsProductModalOpen(false)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <FieldLabel label={isAr ? 'اسم المنتج (عربي) *' : 'Product Name (Arabic) *'}>
                  <input required value={productForm.product_name_ar}
                    onChange={e => setProductForm(f => ({ ...f, product_name_ar: e.target.value }))}
                    className={inp} />
                </FieldLabel>
                <FieldLabel label={isAr ? 'اسم المنتج (إنجليزي)' : 'Product Name (English)'}>
                  <input value={productForm.product_name_en}
                    onChange={e => setProductForm(f => ({ ...f, product_name_en: e.target.value }))}
                    className={inp} />
                </FieldLabel>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <FieldLabel label={isAr ? 'الفئة' : 'Category'}>
                  <select
                    value={productForm.item_category_id}
                    onChange={e => setProductForm(f => ({ ...f, item_category_id: e.target.value }))}
                    className={inp}
                  >
                    <option value="">{isAr ? 'بدون فئة' : 'No category'}</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{isAr ? c.nameAr : c.nameEn}</option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label={isAr ? 'سعر الوحدة' : 'Unit Price'}>
                  <input type="number" min="0" step="0.01"
                    value={productForm.unit_price}
                    onChange={e => setProductForm(f => ({ ...f, unit_price: Number(e.target.value) || 0 }))}
                    className={inp} />
                </FieldLabel>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                <FieldLabel label={isAr ? 'الوزن (كجم)' : 'Weight (kg)'}>
                  <input type="number" min="0" step="0.001"
                    value={productForm.weight}
                    onChange={e => setProductForm(f => ({ ...f, weight: Number(e.target.value) || 0 }))}
                    className={inp} />
                </FieldLabel>
                <FieldLabel label={isAr ? 'الطول' : 'Length'}>
                  <input type="number" min="0" step="0.01"
                    value={productForm.length}
                    onChange={e => setProductForm(f => ({ ...f, length: Number(e.target.value) || 0 }))}
                    className={inp} />
                </FieldLabel>
                <FieldLabel label={isAr ? 'العرض' : 'Width'}>
                  <input type="number" min="0" step="0.01"
                    value={productForm.width}
                    onChange={e => setProductForm(f => ({ ...f, width: Number(e.target.value) || 0 }))}
                    className={inp} />
                </FieldLabel>
                <FieldLabel label={isAr ? 'الارتفاع' : 'Height'}>
                  <input type="number" min="0" step="0.01"
                    value={productForm.height}
                    onChange={e => setProductForm(f => ({ ...f, height: Number(e.target.value) || 0 }))}
                    className={inp} />
                </FieldLabel>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <FieldLabel label="CBM">
                  <input type="number" min="0" step="0.001"
                    value={productForm.cbm}
                    onChange={e => setProductForm(f => ({ ...f, cbm: Number(e.target.value) || 0 }))}
                    className={inp} />
                </FieldLabel>
                <FieldLabel label={isAr ? 'رابط المنتج' : 'Product URL'}>
                  <input type="url" value={productForm.product_url}
                    onChange={e => setProductForm(f => ({ ...f, product_url: e.target.value }))}
                    className={inp} />
                </FieldLabel>
              </div>

              {/* مفتاح تفعيل/تعطيل المنتج */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setProductForm(f => ({ ...f, is_allowed: !f.is_allowed }))}
                  className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${productForm.is_allowed ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full m-0.5 transition-transform ${productForm.is_allowed ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-xs font-bold text-slate-300">
                  {isAr
                    ? (productForm.is_allowed ? 'مسموح للاستخدام في الطلبات' : 'محظور من الطلبات')
                    : (productForm.is_allowed ? 'Allowed in orders' : 'Blocked from orders')}
                </span>
              </label>
            </div>

            <footer className="p-5 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button disabled={submittingProduct}
                className="px-5 py-2 rounded-xl text-xs font-black bg-[#d4af37] text-black disabled:opacity-60">
                {submittingProduct
                  ? (isAr ? 'جارٍ الحفظ…' : 'Saving…')
                  : (isAr ? 'حفظ المنتج' : 'Save Product')}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* ════════════ نافذة تأكيد حذف منتج رئيسي ════════════ */}
      <ConfirmModal
        isOpen={Boolean(deletingProduct)}
        onClose={() => setDeletingProduct(null)}
        onConfirm={() => deletingProduct && deleteProduct(deletingProduct)}
        title={isAr ? 'حذف المنتج الرئيسي' : 'Delete Master Product'}
        message={isAr
          ? `سيتم حذف المنتج "${deletingProduct?.product_name_ar || deletingProduct?.productName}" نهائياً.`
          : `Permanently delete "${deletingProduct?.product_name_ar || deletingProduct?.productName}".`}
        confirmText={isAr ? 'حذف' : 'Delete'}
        type="danger"
      />

      {/* ════════════ نافذة تأكيد إرجاع بند مؤمن ════════════ */}
      <ConfirmModal
        isOpen={Boolean(returningItem)}
        onClose={() => setReturningItem(null)}
        onConfirm={() => returningItem && returnItem(returningItem)}
        title={isAr ? 'إرجاع المنتج المؤمن' : 'Return Insured Item'}
        message={isAr
          ? `سيتم تغيير حالة البند إلى "مرتجع". التأمين: ${money(returningItem?.insurance_fee)}`
          : `Item status will change to "Returned". Insurance: ${money(returningItem?.insurance_fee)}`}
        confirmText={isAr ? 'تأكيد الإرجاع' : 'Confirm Return'}
        type="warning"
      />

      {/* ════════════ نافذة تأكيد حذف بند طلب ════════════ */}
      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={() => deletingItem && deleteItem(deletingItem)}
        title={isAr ? 'حذف بند الطلب' : 'Delete Order Item'}
        message={isAr
          ? `سيتم حذف البند "${deletingItem?.product_cooler || deletingItem?.items_id}" نهائياً.`
          : `Permanently delete item "${deletingItem?.product_cooler || deletingItem?.items_id}".`}
        confirmText={isAr ? 'حذف' : 'Delete'}
        type="danger"
      />
    </div>
  );
}
