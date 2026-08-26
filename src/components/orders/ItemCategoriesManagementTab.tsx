import { useState } from 'react';
import { Edit2, Layers3, Plus, Power, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';
import { useItemCategories } from '../../hooks/useItemCategories';
import { ItemCategory } from '../../services/itemCategoryService';
import { useExchangeRates } from '../../hooks/useExchangeRates';

interface ItemCategoriesManagementTabProps {
  isAr: boolean;
  canManage: boolean;
}

type CategoryForm = Omit<ItemCategory, 'id' | 'createdAt' | 'updatedAt'>;

const emptyForm = (): CategoryForm => ({
  code: '', nameAr: '', nameEn: '', description: '', hsCodeHint: '',
  customsPerCarton: 0, taxPerCarton: 0, otherFeesPerCarton: 0,
  customsRate: 0, taxRate: 0, feeCurrency: 'SAR', requiresReview: false, isActive: true, details: {},
});

export default function ItemCategoriesManagementTab({ isAr, canManage }: ItemCategoriesManagementTabProps) {
  const { categories, loading, addCategory, updateCategory, deleteCategory, toggleCategoryStatus } = useItemCategories();
  const { activeCurrencies } = useExchangeRates();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled' | 'review'>('all');
  const [editing, setEditing] = useState<ItemCategory | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<ItemCategory | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visible = categories.filter((category) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [category.nameAr, category.nameEn, category.code, category.description, category.hsCodeHint]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    const matchesFilter = filter === 'all' || (filter === 'active' && category.isActive)
      || (filter === 'disabled' && !category.isActive) || (filter === 'review' && category.requiresReview);
    return matchesSearch && matchesFilter;
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setIsModalOpen(true); };
  const openEdit = (category: ItemCategory) => {
    setEditing(category);
    setForm({
      code: category.code, nameAr: category.nameAr, nameEn: category.nameEn, description: category.description,
      hsCodeHint: category.hsCodeHint || '', customsPerCarton: category.customsPerCarton, taxPerCarton: category.taxPerCarton,
      otherFeesPerCarton: category.otherFeesPerCarton, customsRate: category.customsRate, taxRate: category.taxRate,
      feeCurrency: category.feeCurrency, requiresReview: category.requiresReview, isActive: category.isActive, details: category.details || {},
    });
    setIsModalOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nameAr.trim() || !form.code.trim()) {
      toast.error(isAr ? 'اسم الفئة بالعربية والكود مطلوبان' : 'Arabic name and code are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(), nameAr: form.nameAr.trim(), nameEn: form.nameEn.trim() || form.nameAr.trim(),
        description: form.description.trim(), hsCodeHint: form.hsCodeHint?.trim() || '',
        customsPerCarton: Number(form.customsPerCarton) || 0, taxPerCarton: Number(form.taxPerCarton) || 0,
        otherFeesPerCarton: Number(form.otherFeesPerCarton) || 0, customsRate: Number(form.customsRate) || 0, taxRate: Number(form.taxRate) || 0,
      };
      if (editing) await updateCategory(editing.id, payload);
      else await addCategory(payload);
      toast.success(isAr ? 'تم حفظ فئة الصنف' : 'Item category saved');
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error?.message || (isAr ? 'تعذر حفظ الفئة' : 'Could not save category'));
    } finally { setSubmitting(false); }
  };

  const price = (value: number, currency: string) => `${Number(value || 0).toLocaleString()} ${currency}`;

  return (
    <div className="space-y-5 text-start animate-fade-in" data-testid="item-categories-management-tab">
      <section className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37]"><Layers3 className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg text-white font-black">{isAr ? 'فئات الأصناف ورسوم الشحن' : 'Item Categories & Shipment Fees'}</h2>
              <p className="text-xs text-slate-400 font-bold mt-1 max-w-3xl">
                {isAr ? 'تُستخدم الفئة لتصنيف المنتجات ولحساب رسوم الجمارك والضرائب للشحنة فقط بحسب عدد الكراتين. القيم النظامية قابلة للتعديل ويجب اعتمادها من الجهة المختصة.' : 'Categories classify products and calculate shipment-only customs and tax fees by carton count. Regulatory rates remain editable and require official approval.'}
              </p>
            </div>
          </div>
          {canManage && <button onClick={openCreate} className="bg-gradient-to-r from-[#d4af37] to-yellow-600 text-black rounded-2xl px-5 py-3 text-xs font-black flex items-center justify-center gap-2"><Plus className="w-4 h-4" />{isAr ? 'إضافة فئة صنف' : 'Add item category'}</button>}
        </div>
        <div className="flex flex-col md:flex-row gap-3 pt-4 mt-4 border-t border-slate-800">
          <div className="relative flex-1"><Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isAr ? 'ابحث بالاسم أو الكود أو الوصف أو HS…' : 'Search name, code, description or HS…'} className="w-full bg-black/35 text-white border border-slate-800 rounded-xl py-2.5 pr-10 pl-3 text-xs font-bold outline-none" /></div>
          <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {(['all', 'active', 'disabled', 'review'] as const).map((key) => <button key={key} onClick={() => setFilter(key)} className={`px-3 py-2 rounded-lg text-[10px] font-black ${filter === key ? 'bg-[#d4af37] text-black' : 'text-slate-400 hover:text-white'}`}>{key === 'all' ? (isAr ? 'الكل' : 'All') : key === 'active' ? (isAr ? 'نشط' : 'Active') : key === 'disabled' ? (isAr ? 'معطّل' : 'Disabled') : (isAr ? 'مراجعة' : 'Review')}</button>)}
          </div>
        </div>
      </section>

      <section className="bg-slate-950/45 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex justify-between text-xs"><span className="font-black text-slate-300">{isAr ? 'الفئات الظاهرة' : 'Visible categories'}</span><span className="text-[#d4af37] font-mono font-black">{visible.length}</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1040px]">
            <thead className="bg-black/30 text-slate-500 text-[10px] uppercase"><tr><th className="p-3 text-start">{isAr ? 'الفئة' : 'Category'}</th><th className="p-3 text-start">HS</th><th className="p-3 text-start">{isAr ? 'جمارك/كرتون' : 'Customs/carton'}</th><th className="p-3 text-start">{isAr ? 'ضريبة/كرتون' : 'Tax/carton'}</th><th className="p-3 text-start">{isAr ? 'رسوم أخرى' : 'Other fees'}</th><th className="p-3 text-start">{isAr ? 'الحالة' : 'Status'}</th><th className="p-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th></tr></thead>
            <tbody className="divide-y divide-slate-800/80">{loading ? <tr><td className="p-8 text-center text-slate-500" colSpan={7}>{isAr ? 'جارٍ تحميل الفئات…' : 'Loading categories…'}</td></tr> : visible.length === 0 ? <tr><td className="p-8 text-center text-slate-500" colSpan={7}>{isAr ? 'لا توجد فئات مطابقة' : 'No matching categories'}</td></tr> : visible.map((category) => <tr key={category.id} className="hover:bg-slate-900/40"><td className="p-3"><div className="font-black text-white">{isAr ? category.nameAr : category.nameEn}</div><div className="text-[10px] text-slate-500 mt-1">{category.code} · {category.description || '—'}</div></td><td className="p-3 font-mono text-slate-400">{category.hsCodeHint || '—'}</td><td className="p-3 font-mono text-amber-300">{price(category.customsPerCarton, category.feeCurrency)}</td><td className="p-3 font-mono text-blue-300">{price(category.taxPerCarton, category.feeCurrency)}</td><td className="p-3 font-mono text-purple-300">{price(category.otherFeesPerCarton, category.feeCurrency)}</td><td className="p-3"><div className="flex gap-1 flex-wrap">{!category.isActive && <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400">{isAr ? 'معطّلة' : 'Disabled'}</span>}{category.requiresReview && <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />{isAr ? 'مراجعة' : 'Review'}</span>}{category.isActive && !category.requiresReview && <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">{isAr ? 'نشطة' : 'Active'}</span>}</div></td><td className="p-3"><div className="flex justify-end gap-1">{canManage && <><button onClick={() => openEdit(category)} className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg" title={isAr ? 'تعديل' : 'Edit'}><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => toggleCategoryStatus(category)} className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg" title={isAr ? 'تعطيل/تفعيل' : 'Disable/enable'}><Power className="w-3.5 h-3.5" /></button><button onClick={() => setDeleting(category)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg" title={isAr ? 'حذف' : 'Delete'}><Trash2 className="w-3.5 h-3.5" /></button></>}</div></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {isModalOpen && <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={save} className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[#121215] border border-[#d4af37]/30 rounded-3xl shadow-2xl"><header className="p-5 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#121215] z-10"><div><h3 className="text-white font-black">{editing ? (isAr ? 'تعديل فئة الصنف' : 'Edit item category') : (isAr ? 'إضافة فئة صنف' : 'Add item category')}</h3><p className="text-[10px] text-slate-500 mt-1">{isAr ? 'أدخل الرسوم لكل كرتون فقط بعد مراجعة اللوائح المعتمدة.' : 'Enter per-carton fees only after verifying approved regulations.'}</p></div><button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X /></button></header><div className="p-5 space-y-5"><div className="grid md:grid-cols-3 gap-3"><Field label={isAr ? 'الكود *' : 'Code *'}><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" /></Field><Field label={isAr ? 'الاسم بالعربية *' : 'Arabic name *'}><input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" /></Field><Field label={isAr ? 'الاسم بالإنجليزية' : 'English name'}><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="input" /></Field></div><div className="grid md:grid-cols-3 gap-3"><Field label={isAr ? 'تلميح رمز HS' : 'HS code hint'}><input value={form.hsCodeHint || ''} onChange={(e) => setForm({ ...form, hsCodeHint: e.target.value })} className="input" /></Field><Field label={isAr ? 'عملة الرسوم' : 'Fee currency'}><select value={form.feeCurrency} onChange={(e) => setForm({ ...form, feeCurrency: e.target.value })} className="input"><option value="SAR">SAR</option>{activeCurrencies.filter((currency) => currency.code !== 'SAR').map((currency) => <option key={currency.cur_id} value={currency.code}>{currency.code} — {isAr ? currency.main_nameAR : currency.main_nameEn}</option>)}</select></Field><Field label={isAr ? 'تفاصيل وصفية' : 'Description'}><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" /></Field></div><div className="grid md:grid-cols-3 gap-3"><NumberField label={isAr ? 'جمارك لكل كرتون' : 'Customs per carton'} value={form.customsPerCarton} onChange={(customsPerCarton) => setForm({ ...form, customsPerCarton })} /><NumberField label={isAr ? 'ضريبة لكل كرتون' : 'Tax per carton'} value={form.taxPerCarton} onChange={(taxPerCarton) => setForm({ ...form, taxPerCarton })} /><NumberField label={isAr ? 'رسوم أخرى لكل كرتون' : 'Other fees per carton'} value={form.otherFeesPerCarton} onChange={(otherFeesPerCarton) => setForm({ ...form, otherFeesPerCarton })} /></div><div className="grid md:grid-cols-2 gap-3"><NumberField label={isAr ? 'معدل جمركي مرجعي %' : 'Reference customs rate %'} value={form.customsRate} onChange={(customsRate) => setForm({ ...form, customsRate })} /><NumberField label={isAr ? 'معدل ضريبي مرجعي %' : 'Reference tax rate %'} value={form.taxRate} onChange={(taxRate) => setForm({ ...form, taxRate })} /></div><div className="flex flex-wrap gap-5 bg-slate-950/60 p-4 rounded-2xl border border-slate-800"><label className="text-xs font-bold text-slate-300 flex gap-2 items-center"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />{isAr ? 'الفئة نشطة' : 'Category active'}</label><label className="text-xs font-bold text-amber-300 flex gap-2 items-center"><input type="checkbox" checked={form.requiresReview} onChange={(e) => setForm({ ...form, requiresReview: e.target.checked })} />{isAr ? 'تحتاج مراجعة تنظيمية' : 'Requires regulatory review'}</label></div></div><footer className="p-5 border-t border-slate-800 flex justify-end gap-2"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-400">{isAr ? 'إلغاء' : 'Cancel'}</button><button disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-black bg-[#d4af37] text-black">{submitting ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ الفئة' : 'Save category')}</button></footer></form></div>}
      <ConfirmModal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={async () => { if (!deleting) return; try { await deleteCategory(deleting.id); toast.success(isAr ? 'تم حذف الفئة' : 'Category deleted'); setDeleting(null); } catch (error: any) { toast.error(error?.message || (isAr ? 'تعذر الحذف؛ قد تكون الفئة مستخدمة' : 'Cannot delete; category may be in use')); } }} title={isAr ? 'حذف فئة الصنف' : 'Delete item category'} message={isAr ? `سيتم حذف الفئة ${deleting?.nameAr || ''} نهائيًا إذا لم تكن مرتبطة بمنتج أو شحنة.` : `Delete ${deleting?.nameEn || ''} only if it is not used by products or shipments.`} confirmText={isAr ? 'حذف' : 'Delete'} type="danger" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><span className="block text-[10px] text-slate-500 font-black">{label}</span>{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className="input font-mono" /></Field>; }
