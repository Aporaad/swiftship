import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Boxes, Edit2, ExternalLink, PackagePlus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';
import { addDoc, collection, db, deleteDoc, doc, onSnapshot, updateDoc } from '../../lib/supabase';
import { useItemCategories } from '../../hooks/useItemCategories';
import { useExchangeRates } from '../../hooks/useExchangeRates';

type ProductRecord = {
  id: string;
  orderId?: string;
  trackingNumber?: string;
  productName?: string;
  name?: string;
  sku?: string;
  description?: string;
  quantity?: number;
  productPrice?: number;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  cbm?: number;
  productUrl?: string;
  packagingOptionId?: string;
  packagingOptionName?: string;
  packagingOptionPrice?: number;
  itemCategoryId?: string;
  itemCategoryName?: string;
  notes?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
};

type ProductForm = Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalPrice'>;
const emptyForm = (): ProductForm => ({
  orderId: '', trackingNumber: '', productName: '', sku: '', description: '', quantity: 1, productPrice: 0,
  currency: 'SAR', weight: 0, length: 0, width: 0, height: 0, cbm: 0, productUrl: '',
  packagingOptionId: '', packagingOptionName: '', packagingOptionPrice: 0, itemCategoryId: '', itemCategoryName: '', notes: '',
});

export default function ProductsManagementTab({ isAr, canManage, orderCurrency = 'SAR' }: { isAr: boolean; canManage: boolean; orderCurrency?: string }) {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'price' | 'weight'>('newest');
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [deleting, setDeleting] = useState<ProductRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { categories } = useItemCategories();
  const { activeCurrencies } = useExchangeRates();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot: any) => {
      setProducts(snapshot.docs.map((entry: any) => ({ id: entry.id, ...entry.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe?.();
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [product.productName, product.name, product.sku, product.orderId, product.trackingNumber, product.itemCategoryName]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    const matchesCategory = categoryFilter === 'all' || product.itemCategoryId === categoryFilter;
    const matchesOrder = !orderFilter.trim() || String(product.orderId || '').toLowerCase().includes(orderFilter.trim().toLowerCase());
    return matchesSearch && matchesCategory && matchesOrder;
  }).sort((first, second) => {
    if (sortBy === 'name') return String(first.productName || first.name || '').localeCompare(String(second.productName || second.name || ''), 'ar');
    if (sortBy === 'price') return Number(second.totalPrice || second.productPrice || 0) - Number(first.totalPrice || first.productPrice || 0);
    if (sortBy === 'weight') return Number(second.weight || 0) - Number(first.weight || 0);
    return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
  }), [products, search, categoryFilter, orderFilter, sortBy]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm(), currency: orderCurrency }); setIsModalOpen(true); };
  const openEdit = (product: ProductRecord) => {
    setEditing(product);
    setForm({ ...emptyForm(), ...product, productName: product.productName || product.name || '', productPrice: Number(product.productPrice ?? product.unitPrice ?? 0) });
    setIsModalOpen(true);
  };

  const selectCategory = (id: string) => {
    const category = categories.find((entry) => entry.id === id);
    setForm({ ...form, itemCategoryId: id, itemCategoryName: category?.nameAr || category?.nameEn || '' });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.productName?.trim()) { toast.error(isAr ? 'اسم المنتج مطلوب' : 'Product name is required'); return; }
    setSubmitting(true);
    try {
      const quantity = Math.max(0, Number(form.quantity) || 0);
      const productPrice = Math.max(0, Number(form.productPrice) || 0);
      const payload = {
        ...form,
        productName: form.productName.trim(), name: form.productName.trim(), sku: form.sku?.trim() || '', description: form.description?.trim() || '',
        orderId: form.orderId?.trim() || '', trackingNumber: form.trackingNumber?.trim() || '', quantity, productPrice, unitPrice: productPrice,
        totalPrice: quantity * productPrice, currency: form.currency || orderCurrency,
        weight: Math.max(0, Number(form.weight) || 0), length: Math.max(0, Number(form.length) || 0), width: Math.max(0, Number(form.width) || 0), height: Math.max(0, Number(form.height) || 0), cbm: Math.max(0, Number(form.cbm) || 0),
        productUrl: form.productUrl?.trim() || '', packagingOptionId: form.packagingOptionId?.trim() || '', packagingOptionName: form.packagingOptionName?.trim() || '', packagingOptionPrice: Math.max(0, Number(form.packagingOptionPrice) || 0), notes: form.notes?.trim() || '', updatedAt: Date.now(),
      };
      if (editing) await updateDoc(doc(db, 'products', editing.id), payload);
      else {
        const id = `prod_${Math.random().toString(36).substring(2, 11)}`;
        await addDoc(id, collection(db, 'products'), { ...payload, createdAt: Date.now() });
      }
      toast.success(isAr ? 'تم حفظ المنتج' : 'Product saved');
      setIsModalOpen(false);
    } catch (error: any) { toast.error(error?.message || (isAr ? 'تعذر حفظ المنتج' : 'Could not save product')); }
    finally { setSubmitting(false); }
  };

  const money = (value: unknown, currency?: string) => `${Number(value || 0).toLocaleString()} ${currency || orderCurrency}`;
  const field = (label: string, child: React.ReactNode) => <label className="space-y-1"><span className="block text-[10px] text-slate-500 font-black">{label}</span>{child}</label>;
  const input = 'w-full bg-black/35 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60';

  return <div className="space-y-5 text-start animate-fade-in" data-testid="products-management-tab">
    <section className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3"><div className="p-2.5 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37]"><Boxes className="w-5 h-5" /></div><div><h2 className="text-lg text-white font-black">{isAr ? 'إدارة المنتجات' : 'Products Management'}</h2><p className="text-xs text-slate-400 font-bold mt-1">{isAr ? 'إدارة المنتجات المسجلة وربطها بالطلبات والفئات والتتبع والتكلفة والأبعاد.' : 'Manage recorded products with their order, category, tracking, cost and dimensions.'}</p></div></div>
        {canManage && <button onClick={openCreate} className="bg-gradient-to-r from-[#d4af37] to-yellow-600 text-black rounded-2xl px-5 py-3 text-xs font-black flex items-center justify-center gap-2"><PackagePlus className="w-4 h-4" />{isAr ? 'إضافة منتج' : 'Add product'}</button>}
      </div>
      <div className="grid lg:grid-cols-4 gap-3 pt-4 mt-4 border-t border-slate-800">
        <div className="relative lg:col-span-2"><Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isAr ? 'ابحث بالمنتج أو SKU أو الطلب أو التتبع…' : 'Search product, SKU, order or tracking…'} className={`${input} pr-10`} /></div>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={input}><option value="all">{isAr ? 'كل الفئات' : 'All categories'}</option>{categories.map((category) => <option key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>)}</select>
        <div className="flex gap-2"><input value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} placeholder={isAr ? 'رقم الطلب' : 'Order ID'} className={input} /><button onClick={() => setSortBy(sortBy === 'newest' ? 'name' : sortBy === 'name' ? 'price' : sortBy === 'price' ? 'weight' : 'newest')} className="shrink-0 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[#d4af37]" title={isAr ? 'تغيير الفرز' : 'Change sort'}><ArrowDownUp className="w-4 h-4" /></button></div>
      </div>
    </section>

    <section className="bg-slate-950/45 border border-slate-800 rounded-3xl overflow-hidden"><div className="px-5 py-3 border-b border-slate-800 flex justify-between text-xs"><span className="font-black text-slate-300">{isAr ? 'المنتجات الظاهرة' : 'Visible products'}</span><span className="text-[#d4af37] font-mono font-black">{visibleProducts.length}</span></div><div className="overflow-x-auto"><table className="w-full text-xs min-w-[1120px]"><thead className="bg-black/30 text-slate-500 text-[10px] uppercase"><tr><th className="p-3 text-start">{isAr ? 'المنتج' : 'Product'}</th><th className="p-3 text-start">{isAr ? 'الطلب والتتبع' : 'Order & tracking'}</th><th className="p-3 text-start">{isAr ? 'الفئة' : 'Category'}</th><th className="p-3 text-start">{isAr ? 'الكمية والقيمة' : 'Quantity & value'}</th><th className="p-3 text-start">{isAr ? 'الوزن والأبعاد' : 'Weight & dimensions'}</th><th className="p-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th></tr></thead><tbody className="divide-y divide-slate-800/80">{loading ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">{isAr ? 'جارٍ تحميل المنتجات…' : 'Loading products…'}</td></tr> : visibleProducts.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">{isAr ? 'لا توجد منتجات مطابقة' : 'No matching products'}</td></tr> : visibleProducts.map((product) => <tr key={product.id} className="hover:bg-slate-900/40"><td className="p-3"><div className="font-black text-white">{product.productName || product.name || '—'}</div><div className="mt-1 text-[10px] text-slate-500">{product.sku || '—'} {product.productUrl && <a href={product.productUrl} target="_blank" rel="noreferrer" className="inline-flex ms-1 text-cyan-400"><ExternalLink className="w-3 h-3" /></a>}</div></td><td className="p-3"><div className="font-mono text-slate-300">{product.orderId || '—'}</div><div className="mt-1 text-[10px] text-slate-500">{product.trackingNumber || '—'}</div></td><td className="p-3"><div className="text-cyan-300">{product.itemCategoryName || '—'}</div></td><td className="p-3"><div className="font-mono text-white">{Number(product.quantity || 0).toLocaleString()}</div><div className="mt-1 text-amber-300 font-mono">{money(product.totalPrice ?? (Number(product.quantity || 0) * Number(product.productPrice || product.unitPrice || 0)), product.currency)}</div></td><td className="p-3"><div className="font-mono text-slate-300">{Number(product.weight || 0).toLocaleString()} kg</div><div className="mt-1 text-[10px] text-slate-500">{product.length || 0}×{product.width || 0}×{product.height || 0} · {Number(product.cbm || 0).toFixed(3)} CBM</div></td><td className="p-3"><div className="flex justify-end gap-1">{canManage && <><button onClick={() => openEdit(product)} className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => setDeleting(product)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button></>}</div></td></tr>)}</tbody></table></div></section>

    {isModalOpen && <div className="fixed inset-0 z-[1000000] bg-slate-950 p-4 flex items-center justify-center"><form onSubmit={save} className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#121215] border border-[#d4af37]/30 rounded-3xl shadow-2xl"><header className="p-5 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#121215] z-10"><div><h3 className="text-white font-black">{editing ? (isAr ? 'تعديل المنتج' : 'Edit product') : (isAr ? 'إضافة منتج' : 'Add product')}</h3><p className="text-[10px] text-slate-500 mt-1">{isAr ? 'تُحفظ بيانات المنتج في جدول products وتبقى مرتبطة برقم الطلب عند تحديده.' : 'Product data is saved to products and remains linked to its order when supplied.'}</p></div><button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X /></button></header><div className="p-5 space-y-5"><div className="grid md:grid-cols-3 gap-3">{field(isAr ? 'اسم المنتج *' : 'Product name *', <input required value={form.productName || ''} onChange={(event) => setForm({ ...form, productName: event.target.value })} className={input} />)}{field('SKU', <input value={form.sku || ''} onChange={(event) => setForm({ ...form, sku: event.target.value })} className={input} />)}{field(isAr ? 'رقم الطلب' : 'Order ID', <input value={form.orderId || ''} onChange={(event) => setForm({ ...form, orderId: event.target.value })} className={input} />)}</div><div className="grid md:grid-cols-3 gap-3">{field(isAr ? 'رقم التتبع' : 'Tracking number', <input value={form.trackingNumber || ''} onChange={(event) => setForm({ ...form, trackingNumber: event.target.value })} className={input} />)}{field(isAr ? 'الفئة' : 'Category', <select value={form.itemCategoryId || ''} onChange={(event) => selectCategory(event.target.value)} className={input}><option value="">{isAr ? 'بدون فئة' : 'No category'}</option>{categories.map((category) => <option key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>)}</select>)}{field(isAr ? 'العملة' : 'Currency', <select value={form.currency || orderCurrency} onChange={(event) => setForm({ ...form, currency: event.target.value })} className={input}><option value={orderCurrency}>{orderCurrency}</option>{activeCurrencies.filter((currency) => currency.code !== orderCurrency).map((currency) => <option key={currency.cur_id} value={currency.code}>{currency.code}</option>)}</select>)}</div><div className="grid md:grid-cols-3 gap-3">{field(isAr ? 'الكمية' : 'Quantity', <input type="number" min="0" step="0.01" value={form.quantity ?? 0} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) || 0 })} className={input} />)}{field(isAr ? 'سعر الوحدة' : 'Unit price', <input type="number" min="0" step="0.01" value={form.productPrice ?? 0} onChange={(event) => setForm({ ...form, productPrice: Number(event.target.value) || 0 })} className={input} />)}{field(isAr ? 'إجمالي المنتج' : 'Product total', <div className="rounded-xl border border-slate-800 bg-slate-950 py-2.5 px-3 text-xs font-mono text-[#d4af37]">{money(Number(form.quantity || 0) * Number(form.productPrice || 0), form.currency)}</div>)}</div><div className="grid md:grid-cols-4 gap-3">{field(isAr ? 'الوزن (كجم)' : 'Weight (kg)', <input type="number" min="0" step="0.001" value={form.weight ?? 0} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) || 0 })} className={input} />)}{field(isAr ? 'الطول' : 'Length', <input type="number" min="0" step="0.01" value={form.length ?? 0} onChange={(event) => setForm({ ...form, length: Number(event.target.value) || 0 })} className={input} />)}{field(isAr ? 'العرض' : 'Width', <input type="number" min="0" step="0.01" value={form.width ?? 0} onChange={(event) => setForm({ ...form, width: Number(event.target.value) || 0 })} className={input} />)}{field(isAr ? 'الارتفاع' : 'Height', <input type="number" min="0" step="0.01" value={form.height ?? 0} onChange={(event) => setForm({ ...form, height: Number(event.target.value) || 0 })} className={input} />)}</div><div className="grid md:grid-cols-3 gap-3">{field('CBM', <input type="number" min="0" step="0.001" value={form.cbm ?? 0} onChange={(event) => setForm({ ...form, cbm: Number(event.target.value) || 0 })} className={input} />)}{field(isAr ? 'اسم خيار التغليف' : 'Packaging option', <input value={form.packagingOptionName || ''} onChange={(event) => setForm({ ...form, packagingOptionName: event.target.value })} className={input} />)}{field(isAr ? 'رسوم التغليف' : 'Packaging fee', <input type="number" min="0" step="0.01" value={form.packagingOptionPrice ?? 0} onChange={(event) => setForm({ ...form, packagingOptionPrice: Number(event.target.value) || 0 })} className={input} />)}</div>{field(isAr ? 'رابط المنتج' : 'Product URL', <input type="url" value={form.productUrl || ''} onChange={(event) => setForm({ ...form, productUrl: event.target.value })} className={input} />)}{field(isAr ? 'الوصف والملاحظات' : 'Description & notes', <textarea rows={3} value={form.notes || form.description || ''} onChange={(event) => setForm({ ...form, notes: event.target.value, description: event.target.value })} className={input} />)}</div><footer className="p-5 border-t border-slate-800 flex justify-end gap-2"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-400">{isAr ? 'إلغاء' : 'Cancel'}</button><button disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-black bg-[#d4af37] text-black">{submitting ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ المنتج' : 'Save product')}</button></footer></form></div>}
    <ConfirmModal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={async () => { if (!deleting) return; try { await deleteDoc(doc(db, 'products', deleting.id)); toast.success(isAr ? 'تم حذف المنتج' : 'Product deleted'); setDeleting(null); } catch (error: any) { toast.error(error?.message || (isAr ? 'تعذر حذف المنتج' : 'Could not delete product')); } }} title={isAr ? 'حذف المنتج' : 'Delete product'} message={isAr ? `سيتم حذف المنتج ${deleting?.productName || deleting?.name || ''} نهائيًا.` : `Permanently delete ${deleting?.productName || deleting?.name || ''}.`} confirmText={isAr ? 'حذف' : 'Delete'} type="danger" />
  </div>;
}
