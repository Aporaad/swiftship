import { useEffect, useMemo, useState } from 'react';
import { Edit2, FileText, Settings, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { collection, db, doc, onSnapshot, updateDoc } from '../lib/supabase-firebase-adapter';
import { autoEntryService } from '../services/autoEntryService';
import { useAutoVoucherRules } from '../hooks/useAutoVoucherRules';

interface AutoVoucherRulesManagerProps {
  isAr: boolean;
  settings: any;
}

const dynamicOptions = [
  { id: 'payment_account_linked', labelAr: '💳 حساب الدفع المختار بالطلب (صندوق/بنك/متعدد)', labelEn: 'Selected payment account (Cash/Bank/Mixed)' },
  { id: 'customer_linked', labelAr: 'حساب طرف الطلب المرتبط (عميل/موظف/مندوب)', labelEn: 'Linked order-party account' },
  { id: 'courier_linked', labelAr: 'حساب المندوب المرتبط', labelEn: 'Linked courier account' },
  { id: 'delivery_courier_linked', labelAr: 'حساب مندوب التوصيل', labelEn: 'Delivery courier account' },
  { id: 'shipping_courier_linked', labelAr: 'حساب مندوب الشحن', labelEn: 'Shipping courier account' },
  { id: 'purchase_source_linked', labelAr: 'حساب مصدر الطلب المرتبط', labelEn: 'Linked order-source account' },
  { id: 'shipping_company_linked', labelAr: 'حساب شركة الشحن المرتبطة', labelEn: 'Linked shipping-company account' },
  { id: 'product_cost_source', labelAr: 'مصدر تكلفة المنتجات أو حساب تكاليف الطلب', labelEn: 'Product-cost source or order-cost account' },
  { id: 'order_cost_account', labelAr: 'حساب تكاليف الطلبات الافتراضي', labelEn: 'Default order-cost account' },
];

const read = (record: any, camel: string, snake: string) => record?.[camel] ?? record?.[snake];
const defaultKey = (record: any) => String(read(record, 'defaultKey', 'default_key') || record?.id || '');
const defaultName = (record: any, isAr: boolean) => String(read(record, isAr ? 'accNameAr' : 'accNameEn', isAr ? 'acc_name_ar' : 'acc_name_en') || defaultKey(record));

export default function AutoVoucherRulesManager({ isAr }: AutoVoucherRulesManagerProps) {
  const { rules, loading } = useAutoVoucherRules();
  const [defaultAccounts, setDefaultAccounts] = useState<any[]>([]);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editDescAr, setEditDescAr] = useState('');
  const [editDescEn, setEditDescEn] = useState('');
  const [editDebitType, setEditDebitType] = useState<'system' | 'dynamic'>('system');
  const [editDebitSystemId, setEditDebitSystemId] = useState('');
  const [editDebitDynamicId, setEditDebitDynamicId] = useState('customer_linked');
  const [editCreditType, setEditCreditType] = useState<'system' | 'dynamic'>('system');
  const [editCreditSystemId, setEditCreditSystemId] = useState('');
  const [editCreditDynamicId, setEditCreditDynamicId] = useState('customer_linked');
  /** ترحيل القيد: true = ترحيل فوري (posted)، false = مسودة فقط (draft) */
  /** Auto-post toggle: true = post immediately, false = save as draft only */
  const [editAutoPost, setEditAutoPost] = useState(true);

  useEffect(() => {
    autoEntryService.ensureAutoEntries().catch((seedError) => setError(seedError?.message || 'تعذر تجهيز قواعد القيود التلقائية.'));
    return onSnapshot(collection(db, 'default_accounts'), (snapshot: any) => {
      setDefaultAccounts(snapshot.docs.map((entry: any) => ({ id: entry.id, ...entry.data() })));
    }, (listenerError: any) => setError(listenerError?.message || 'تعذر تحميل الحسابات الافتراضية.'));
  }, []);

  const activeDefaults = useMemo(() => defaultAccounts.filter((entry) => entry.isActive !== false && entry.is_active !== false), [defaultAccounts]);
  const labelForDynamic = (id: string) => dynamicOptions.find((option) => option.id === id)?.[isAr ? 'labelAr' : 'labelEn'] || id;

  const handleToggleRuleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'auto_entries', ruleId), { isActive: !currentStatus, updatedAt: Date.now() });
    } catch (toggleError: any) {
      setError(toggleError?.message || (isAr ? 'تعذر تعديل حالة القاعدة.' : 'Unable to update the rule status.'));
    }
  };

  const handleOpenEdit = (rule: any) => {
    setError('');
    setEditingRule(rule);
    setEditDescAr(rule.descriptionTempAr || '');
    setEditDescEn(rule.descriptionTempEn || '');
    const debit = rule.debitAccount || {};
    const credit = rule.creditAccount || {};
    setEditDebitType(debit.type === 'dynamic' ? 'dynamic' : 'system');
    setEditDebitDynamicId(debit.id || 'customer_linked');
    setEditDebitSystemId(debit.defaultKey || debit.id || '');
    setEditCreditType(credit.type === 'dynamic' ? 'dynamic' : 'system');
    setEditCreditDynamicId(credit.id || 'customer_linked');
    setEditCreditSystemId(credit.defaultKey || credit.id || '');
    // تهيئة قيمة ترحيل القيد من القاعدة (افتراضي: true) — init autoPost from rule (default: true)
    setEditAutoPost(rule.autoPost !== false);
  };

  const systemConfig = (key: string) => {
    const binding = activeDefaults.find((entry) => defaultKey(entry) === key);
    if (!binding) throw new Error(isAr ? 'اختر حسابًا افتراضيًا نشطًا من القائمة.' : 'Select an active default account from the list.');
    return { id: key, defaultKey: key, code: '', name: defaultName(binding, isAr), type: 'system' };
  };

  const dynamicConfig = (id: string) => ({ id, code: '', name: labelForDynamic(id), type: 'dynamic' });

  const handleSaveRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingRule) return;
    setIsSaving(true);
    setError('');
    try {
      const debitAccount = editDebitType === 'system' ? systemConfig(editDebitSystemId) : dynamicConfig(editDebitDynamicId);
      const creditAccount = editCreditType === 'system' ? systemConfig(editCreditSystemId) : dynamicConfig(editCreditDynamicId);
      await updateDoc(doc(db, 'auto_entries', editingRule.id), {
        descriptionTempAr: editDescAr,
        descriptionTempEn: editDescEn,
        debitAccount,
        creditAccount,
        // حفظ خيار ترحيل القيد — save autoPost preference
        autoPost: editAutoPost,
        updatedAt: Date.now(),
      });
      setEditingRule(null);
    } catch (saveError: any) {
      setError(saveError?.message || (isAr ? 'تعذر حفظ قاعدة القيد التلقائي.' : 'Unable to save the automatic-voucher rule.'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderAccount = (account: any) => <div className="min-w-0"><span className="font-mono text-[9.5px] font-black text-[#d4af37] block truncate">{account?.defaultKey || account?.code || account?.id || '—'}</span><span className="text-xs font-bold text-slate-300 block truncate mt-0.5">{account?.name || '—'}</span></div>;
  const renderConfig = (side: 'debit' | 'credit') => {
    const type = side === 'debit' ? editDebitType : editCreditType;
    const setType = side === 'debit' ? setEditDebitType : setEditCreditType;
    const systemId = side === 'debit' ? editDebitSystemId : editCreditSystemId;
    const setSystemId = side === 'debit' ? setEditDebitSystemId : setEditCreditSystemId;
    const dynamicId = side === 'debit' ? editDebitDynamicId : editCreditDynamicId;
    const setDynamicId = side === 'debit' ? setEditDebitDynamicId : setEditCreditDynamicId;
    const tone = side === 'debit' ? 'emerald' : 'rose';
    return <div className="border border-slate-850 bg-black/20 p-4 rounded-2xl space-y-3"><span className={`text-${tone}-400 text-[10.5px] font-black uppercase tracking-wider block`}>{side === 'debit' ? (isAr ? 'الطرف المدين' : 'Debit account') : (isAr ? 'الطرف الدائن' : 'Credit account')}</span><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setType('system')} className={`py-2 text-[10.5px] font-black rounded-lg border transition ${type === 'system' ? `bg-${tone}-500/10 border-${tone}-500/40 text-${tone}-400` : 'bg-black/35 border-slate-800 text-slate-500'}`}>{isAr ? 'حساب افتراضي' : 'Default account'}</button><button type="button" onClick={() => setType('dynamic')} className={`py-2 text-[10.5px] font-black rounded-lg border transition ${type === 'dynamic' ? `bg-${tone}-500/10 border-${tone}-500/40 text-${tone}-400` : 'bg-black/35 border-slate-800 text-slate-500'}`}>{isAr ? 'طرف ديناميكي' : 'Dynamic party'}</button></div>{type === 'system' ? <select required value={systemId} onChange={(event) => setSystemId(event.target.value)} className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold"><option value="">{isAr ? '-- اختر حسابًا افتراضيًا نشطًا --' : '-- Select active default account --'}</option>{activeDefaults.map((entry) => <option key={entry.id} value={defaultKey(entry)}>{defaultKey(entry)} — {defaultName(entry, isAr)}</option>)}</select> : <select value={dynamicId} onChange={(event) => setDynamicId(event.target.value)} className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold">{dynamicOptions.map((option) => <option key={option.id} value={option.id}>{isAr ? option.labelAr : option.labelEn}</option>)}</select>}</div>;
  };

  return <div className="space-y-6 text-start">
    <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl shadow"><div className="flex items-start gap-4"><div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-3 rounded-2xl text-[#d4af37] shrink-0"><Settings className="w-5 h-5" /></div><div><h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">{isAr ? 'إدارة القيود التلقائية' : 'Automatic Voucher Rules'}</h3><p className="text-xs text-slate-450 leading-relaxed">{isAr ? 'تُحفظ القواعد في جدول القيود التلقائية وتستخدم مفاتيح الحسابات الافتراضية المدارة من دليل الحسابات. لا يعتمد التنفيذ على كود حساب نظامي ثابت.' : 'Rules are stored in auto entries and resolve managed default-account keys from the chart of accounts.'}</p></div></div></div>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 flex justify-between"><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}
    {loading && <div className="text-sm text-slate-500">{isAr ? 'جارٍ تحميل القواعد...' : 'Loading rules...'}</div>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">{rules.map((rule) => <div key={rule.id} className={`bg-gradient-to-br from-[#121215] to-[#08080a] border rounded-3xl p-5 shadow-xl flex flex-col justify-between ${rule.isActive ? 'border-slate-850' : 'border-rose-950/40 opacity-75'}`}><div className="space-y-4"><div className="flex justify-between items-start gap-2"><div><span className="text-[10px] uppercase font-mono font-black text-[#d4af37] tracking-widest bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded-md">{rule.id}</span><h4 className="text-sm font-extrabold text-white mt-2">{isAr ? rule.nameAr : rule.nameEn}</h4></div><div className="flex flex-col gap-1.5 items-end"><button type="button" onClick={() => handleToggleRuleActive(rule.id, rule.isActive)} className="transition active:scale-95 shrink-0">{rule.isActive ? <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-xl"><ToggleRight className="w-4 h-4" />{isAr ? 'نشط' : 'ACTIVE'}</span> : <span className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-black px-2.5 py-1 rounded-xl"><ToggleLeft className="w-4 h-4" />{isAr ? 'موقوف' : 'DISABLED'}</span>}</button>{/* شارة ترحيل القيد — autoPost status badge */}{rule.autoPost !== false ? <span className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-[9px] font-black px-2 py-0.5 rounded-lg">{isAr ? '⚡ مرحَّل فوراً' : '⚡ Auto Posted'}</span> : <span className="flex items-center gap-1 bg-slate-700/30 border border-slate-700/40 text-slate-400 text-[9px] font-black px-2 py-0.5 rounded-lg">{isAr ? '📋 مسودة فقط' : '📋 Draft Only'}</span>}</div></div><div className="bg-black/30 p-3 rounded-2xl border border-slate-900 text-xs text-slate-200">{isAr ? rule.descriptionTempAr : rule.descriptionTempEn}</div><div className="grid grid-cols-2 gap-3"><div className="bg-slate-950/55 border border-slate-900 p-3 rounded-2xl"><span className="text-[9.5px] font-black text-emerald-400 block mb-1">{isAr ? 'مدين' : 'DEBIT'}</span>{renderAccount(rule.debitAccount)}</div><div className="bg-slate-950/55 border border-slate-900 p-3 rounded-2xl"><span className="text-[9.5px] font-black text-rose-400 block mb-1">{isAr ? 'دائن' : 'CREDIT'}</span>{renderAccount(rule.creditAccount)}</div></div></div><div className="pt-4 border-t border-slate-900 mt-4 flex justify-end"><button type="button" onClick={() => handleOpenEdit(rule)} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 px-3.5 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1"><Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />{isAr ? 'تعديل القاعدة' : 'Configure rule'}</button></div></div>)}</div>
    {editingRule && <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[1000] text-start" role="dialog" aria-modal="true"><form onSubmit={handleSaveRule} className="bg-[#121215] border border-[#d4af37]/25 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"><div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-[#d4af37]" /><h3 className="font-black text-white text-xs uppercase tracking-widest">{isAr ? 'تحديث قاعدة القيد التلقائي' : 'Update automatic voucher rule'}</h3></div><button type="button" onClick={() => setEditingRule(null)} className="text-slate-500 hover:text-white p-1.5 bg-slate-900 border border-slate-800 rounded-lg"><X className="w-4 h-4" /></button></div><div className="p-6 overflow-y-auto space-y-4 flex-1"><p className="text-xs text-slate-400">{editingRule.id}</p><label className="block text-[10px] font-black text-slate-400">{isAr ? 'بيان القيد بالعربية' : 'Arabic narration'}<input required value={editDescAr} onChange={(event) => setEditDescAr(event.target.value)} className="mt-1 w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs" /></label><label className="block text-[10px] font-black text-slate-400">{isAr ? 'بيان القيد بالإنجليزية' : 'English narration'}<input required value={editDescEn} onChange={(event) => setEditDescEn(event.target.value)} className="mt-1 w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs" /></label>{/* زر تبديل ترحيل القيد — Auto Post Toggle */}<div className="flex items-center justify-between bg-black/30 border border-slate-850 rounded-2xl p-3.5"><div><p className="text-[10.5px] font-black text-white">{isAr ? 'ترحيل القيد التلقائي' : 'Auto-Post Entry'}</p><p className="text-[9.5px] text-slate-500 mt-0.5">{isAr ? 'عند التفعيل يتم ترحيل القيد فوراً، وإلا يُحفظ كمسودة' : 'When enabled, entries are posted immediately; otherwise saved as draft'}</p></div><button type="button" onClick={() => setEditAutoPost(!editAutoPost)} className={`relative w-12 h-6 rounded-full transition-all duration-200 border ${editAutoPost ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-slate-800 border-slate-700'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 shadow ${editAutoPost ? 'right-0.5 bg-cyan-400' : 'left-0.5 bg-slate-500'}`} /></button></div>{renderConfig('debit')}{renderConfig('credit')}</div><div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3"><button type="button" onClick={() => setEditingRule(null)} className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 rounded-xl text-xs">{isAr ? 'إلغاء' : 'Cancel'}</button><button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-[#d4af37] text-black font-black text-xs rounded-xl disabled:opacity-40">{isSaving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ القاعدة' : 'Save rule')}</button></div></form></div>}
  </div>;
}
