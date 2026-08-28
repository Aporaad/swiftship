import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Save, Trash2 } from 'lucide-react';
import { financialEntryService, type FinancialEntryCategory, type FinancialEntryLineInput, type FinancialPaymentDetailInput, type FinancialPaymentMethod } from '../../services/financialEntryService';
import { supabase } from '../../lib/supabase-firebase-adapter';

export interface FinanceCurrency { id: number; code: string; isDefault: boolean; }
export interface FinanceAccount { id: string; nameAr: string; nameEn?: string; curNo: number; currencyCode: string; isActive: boolean; isPosting: boolean; accSubId?: string; entityId?: string; entityType?: string; entityName?: string; }
export interface FinanceModule { id: string; code: string; nameAr: string; isActive?: boolean; }
export interface FinanceEntryType { id: string; moduleId: string; code: string; nameAr: string; isActive?: boolean; }

type FormLine = { id: string; accountId: string; transType: 'Debit' | 'Credit'; amountOriginal: string; };
type PaymentDetailForm = { id: string; paymentMethod: Exclude<FinancialPaymentMethod, 'mixed'>; accountId: string; amountOriginal: string; bankReference: string; dueAt: string; note: string; };
export interface EditableEntryDraft { id: string; entryNumber: string; moduleId: string; entryTypeId: string; currencyOriginalNo: number; description: string; notes?: string; paymentMethod?: FinancialPaymentMethod; paymentDetails?: PaymentDetailForm[]; lines: Array<FormLine>; }

const METHODS: Array<{ id: FinancialPaymentMethod; label: string }> = [
  { id: 'cash', label: 'نقدًا' },
  { id: 'bank', label: 'بنك / حوالة' },
  { id: 'deferred', label: 'آجل' },
  { id: 'mixed', label: 'مختلط' },
];

const asNumber = (value: string) => Number(value || 0);
const createLine = (transType: 'Debit' | 'Credit'): FormLine => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  accountId: '',
  transType,
  amountOriginal: '',
});
const createPaymentDetail = (paymentMethod: Exclude<FinancialPaymentMethod, 'mixed'> = 'cash'): PaymentDetailForm => ({ id: `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, paymentMethod, accountId: '', amountOriginal: '', bankReference: '', dueAt: '', note: '' });

interface EntryFormProps {
  category: FinancialEntryCategory;
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  canCreate: boolean;
  canPost: boolean;
  createdByUid?: string;
  initialModuleCode?: string;
  initialTypeCode?: string;
  editingEntry?: EditableEntryDraft;
  onSaved: () => void;
  onCancel: () => void;
}

export default function EntryForm({
  category, accounts, currencies, modules, entryTypes, canCreate, canPost, createdByUid,
  initialModuleCode, initialTypeCode, editingEntry, onSaved, onCancel,
}: EntryFormProps) {
  const defaultCurrency = useMemo(() => currencies.find((currency) => currency.isDefault) || currencies[0], [currencies]);
  const initialModule = useMemo(() => modules.find((module) => module.code === initialModuleCode) || modules[0], [modules, initialModuleCode]);
  const [entryNumber, setEntryNumber] = useState(() => editingEntry?.entryNumber || `JV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-6)}`);
  const [moduleId, setModuleId] = useState(() => editingEntry?.moduleId || '');
  const [entryTypeId, setEntryTypeId] = useState(() => editingEntry?.entryTypeId || '');
  const [currencyId, setCurrencyId] = useState<number | ''>(() => editingEntry?.currencyOriginalNo || '');
  const [description, setDescription] = useState(() => editingEntry?.description || '');
  const [notes, setNotes] = useState(() => editingEntry?.notes || '');
  const [paymentMethod, setPaymentMethod] = useState<FinancialPaymentMethod>(() => editingEntry?.paymentMethod || 'cash');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailForm[]>(() => editingEntry?.paymentDetails?.length ? editingEntry.paymentDetails : [createPaymentDetail(editingEntry?.paymentMethod === 'bank' ? 'bank' : editingEntry?.paymentMethod === 'deferred' ? 'deferred' : 'cash')]);
  const [saveAsPosted, setSaveAsPosted] = useState(false);
  const [lines, setLines] = useState<FormLine[]>(() => editingEntry?.lines || (category === 'Compound'
    ? [createLine('Debit'), createLine('Credit'), createLine('Credit')]
    : [createLine('Debit'), createLine('Credit')]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!moduleId && initialModule?.id) setModuleId(initialModule.id);
    if (currencyId === '' && defaultCurrency?.id) setCurrencyId(defaultCurrency.id);
  }, [currencyId, defaultCurrency?.id, initialModule?.id, moduleId]);

  const availableTypes = useMemo(() => entryTypes.filter((type) => type.moduleId === moduleId), [entryTypes, moduleId]);
  useEffect(() => {
    const preferred = availableTypes.find((type) => type.code === initialTypeCode) || availableTypes[0];
    if (preferred && !availableTypes.some((type) => type.id === entryTypeId)) setEntryTypeId(preferred.id);
  }, [availableTypes, entryTypeId, initialTypeCode]);

  const debitTotal = lines.filter((line) => line.transType === 'Debit').reduce((sum, line) => sum + asNumber(line.amountOriginal), 0);
  const creditTotal = lines.filter((line) => line.transType === 'Credit').reduce((sum, line) => sum + asNumber(line.amountOriginal), 0);
  const balanceDifference = debitTotal - creditTotal;
  const balanced = debitTotal > 0 && balanceDifference === 0;
  const selectedCurrency = currencies.find((currency) => currency.id === currencyId);

  const updateLine = (index: number, patch: Partial<FormLine>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  };

  const updatePaymentDetail = (index: number, patch: Partial<PaymentDetailForm>) => setPaymentDetails((current) => current.map((detail, detailIndex) => detailIndex === index ? { ...detail, ...patch } : detail));
  const accountsForPaymentMethod = (method: Exclude<FinancialPaymentMethod, 'mixed'>) => accounts.filter((account) => account.isActive && account.isPosting && (method === 'cash' ? account.accSubId === '111' : method === 'bank' ? account.accSubId === '112' : true));
  const choosePaymentMethod = (method: FinancialPaymentMethod) => {
    setPaymentMethod(method);
    setPaymentDetails((current) => method === 'mixed'
      ? (current.length >= 2 ? current : [createPaymentDetail('cash'), createPaymentDetail('bank')])
      : [{ ...(current[0] || createPaymentDetail(method)), paymentMethod: method, amountOriginal: String(debitTotal) }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= (category === 'Compound' ? 3 : 2)) return;
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  };

  const resolveCrossCurrencyLine = async (line: FormLine, account: FinanceAccount, originalAmount: number): Promise<FinancialEntryLineInput> => {
    if (!selectedCurrency) throw new Error('اختر عملة رأس القيد أولًا.');
    if (account.curNo === selectedCurrency.id) {
      return { id: line.id, accountId: account.id, accountCurNo: account.curNo, transType: line.transType, amount: originalAmount, amountOriginal: originalAmount };
    }
    const accountCurrency = currencies.find((currency) => currency.id === account.curNo);
    if (!accountCurrency || (!selectedCurrency.isDefault && !accountCurrency.isDefault)) {
      throw new Error('التحويل بين عملتين غير افتراضيتين يتطلب سند صرافة مستقلًا بمراجع سعر صريحة.');
    }
    const pricedCurrency = selectedCurrency.isDefault ? accountCurrency : selectedCurrency;
    const { data, error: priceError } = await (supabase as any)
      .from('cur_price')
      .select('id, seq, price, day_date')
      .eq('cur_no', pricedCurrency.id)
      .order('day_date', { ascending: false })
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priceError || !data || Number(data.price) <= 0) {
      throw new Error(`لا يوجد سعر صرف موثق لعملة ${pricedCurrency.code}؛ لن يُحفظ القيد.`);
    }
    const accountAmount = selectedCurrency.isDefault ? originalAmount / Number(data.price) : originalAmount * Number(data.price);
    return {
      id: line.id, accountId: account.id, accountCurNo: account.curNo, transType: line.transType,
      amount: Number(accountAmount.toFixed(4)), amountOriginal: originalAmount,
      currencyPrice: { id: Number(data.id), seq: Number(data.seq) },
    };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!canCreate) return setError('ليس لديك تصريح إنشاء هذا النوع من القيود.');
    if (!selectedCurrency || !entryTypeId || !moduleId || !description.trim()) return setError('أكمل رقم القيد والفئة والنوع والعملة والبيان.');
    if (!balanced) return setError('لا يمكن الحفظ: مجموع المدين والدائن غير متساوٍ بعملة رأس القيد.');
    if (saveAsPosted && !canPost) return setError('ليس لديك تصريح اعتماد وترحيل القيد.');
    if (paymentMethod === 'mixed' && category !== 'Compound') return setError('الدفع المختلط يحتاج قيدًا مركبًا لتمثيل كل حساب قبض أو صرف بساق مستقل.');
    try {
      setSaving(true);
      const payloadLines = await Promise.all(lines.map(async (line) => {
        const account = accounts.find((candidate) => candidate.id === line.accountId);
        const amountOriginal = asNumber(line.amountOriginal);
        if (!account || !amountOriginal) throw new Error('حدد حسابًا ماليًا ومبلغًا صالحًا لكل ساق.');
        return resolveCrossCurrencyLine(line, account, amountOriginal);
      }));
      const normalizedPaymentDetails: FinancialPaymentDetailInput[] = paymentDetails.map((detail) => ({
        ...detail, amountOriginal: paymentMethod === 'mixed' ? asNumber(detail.amountOriginal) : debitTotal,
      }));
      const paymentTotal = normalizedPaymentDetails.reduce((sum, detail) => sum + detail.amountOriginal, 0);
      if (!normalizedPaymentDetails.length || normalizedPaymentDetails.some((detail) => !detail.accountId || !detail.amountOriginal)) throw new Error('حدد حسابًا ومبلغًا صحيحًا لكل تفصيل دفع.');
      if (paymentTotal !== debitTotal) throw new Error('يجب أن يساوي مجموع تفاصيل الدفع مبلغ القيد بعملة الرأس.');
      for (const detail of normalizedPaymentDetails) {
        const account = accounts.find((candidate) => candidate.id === detail.accountId);
        if (!account || !payloadLines.some((line) => line.accountId === detail.accountId)) throw new Error('حساب تفصيل الدفع يجب أن يكون حسابًا ماليًا ظاهرًا في أسطر القيد.');
        if (detail.paymentMethod === 'cash' && account.accSubId !== '111') throw new Error('طريقة النقد تحتاج حسابًا من قسم الصناديق النقدية.');
        if (detail.paymentMethod === 'bank' && account.accSubId !== '112') throw new Error('طريقة البنك تحتاج حسابًا من قسم الحسابات البنكية.');
        if (detail.paymentMethod === 'bank' && !detail.bankReference?.trim()) throw new Error('أدخل مرجع الحوالة أو العملية البنكية.');
        if (detail.paymentMethod === 'deferred' && !detail.dueAt) throw new Error('أدخل تاريخ استحقاق الدفع الآجل.');
      }
      const entryPayload = {
        entryNumber: entryNumber.trim(), moduleId, entryTypeId, entryCategory: category,
        postingStatus: saveAsPosted ? 'posted' : 'draft', amountOriginal: debitTotal,
        currencyOriginalNo: selectedCurrency.id, description: description.trim(), notes,
        paymentMethod, paymentDetails: normalizedPaymentDetails, createdByUid, lines: payloadLines,
      };
      if (editingEntry) await financialEntryService.replaceDraft(editingEntry.id, entryPayload);
      else await financialEntryService.create(entryPayload);
      onSaved();
    } catch (cause: any) {
      setError(cause?.message || 'تعذر حفظ القيد.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-5 shadow-2xl" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-white">{editingEntry ? `تعديل مسودة ${editingEntry.entryNumber}` : category === 'Compound' ? 'قيد مركب جديد' : category === 'Temp' ? 'قيد مؤقت جديد' : 'قيد عام جديد'}</h3>
          <p className="mt-1 text-xs text-slate-400">يحفظ رأس القيد وأسطره في معاملة واحدة، ولا يُعتمد غير المتوازن.</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">إلغاء</button>
      </div>

      {error && <div className="flex gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-bold text-slate-300">رقم القيد<input required value={entryNumber} onChange={(e) => setEntryNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs font-bold text-slate-300">الفئة<select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">{modules.map((module) => <option key={module.id} value={module.id}>{module.nameAr}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-300">النوع<select value={entryTypeId} onChange={(e) => setEntryTypeId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">{availableTypes.map((type) => <option key={type.id} value={type.id}>{type.nameAr}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-300">عملة الرأس<select value={currencyId} onChange={(e) => setCurrencyId(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">{currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.code}{currency.isDefault ? ' — افتراضية' : ''}</option>)}</select></label>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="text-xs font-bold text-slate-300">البيان<input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف واضح للحركة المالية" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs font-bold text-slate-300">طريقة الدفع<select value={paymentMethod} onChange={(e) => choosePaymentMethod(e.target.value as FinancialPaymentMethod)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">{METHODS.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><legend className="text-sm font-black text-cyan-100">تفاصيل طريقة الدفع</legend><p className="mt-1 text-[11px] text-slate-400">ترتبط كل طريقة بحساب وارد في أسطر القيد وبعملة الرأس نفسها.</p></div>{paymentMethod === 'mixed' && <button type="button" onClick={() => setPaymentDetails((current) => [...current, createPaymentDetail('cash')])} className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 px-2.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10"><Plus className="h-3.5 w-3.5" />إضافة توزيع</button>}</div>
        {paymentDetails.map((detail, index) => <div key={detail.id} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-6">
          <label className="text-[11px] font-bold text-slate-400">الطريقة<select disabled={paymentMethod !== 'mixed'} value={detail.paymentMethod} onChange={(e) => updatePaymentDetail(index, { paymentMethod: e.target.value as PaymentDetailForm['paymentMethod'], accountId: '' })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white disabled:opacity-60">{METHODS.filter((method) => method.id !== 'mixed').map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
          <label className="text-[11px] font-bold text-slate-400 md:col-span-2">الحساب المالي<select value={detail.accountId} onChange={(e) => updatePaymentDetail(index, { accountId: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white"><option value="">اختر حساب الوسيط</option>{accountsForPaymentMethod(detail.paymentMethod).map((account) => <option key={account.id} value={account.id}>{account.id} — {account.nameAr} ({account.currencyCode})</option>)}</select></label>
          <label className="text-[11px] font-bold text-slate-400">المبلغ<input readOnly={paymentMethod !== 'mixed'} inputMode="decimal" value={paymentMethod === 'mixed' ? detail.amountOriginal : debitTotal || ''} onChange={(e) => updatePaymentDetail(index, { amountOriginal: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white read-only:opacity-70" /></label>
          {detail.paymentMethod === 'bank' ? <label className="text-[11px] font-bold text-slate-400 md:col-span-2">مرجع الحوالة / العملية<input value={detail.bankReference} onChange={(e) => updatePaymentDetail(index, { bankReference: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white" /></label> : detail.paymentMethod === 'deferred' ? <label className="text-[11px] font-bold text-slate-400 md:col-span-2">تاريخ الاستحقاق<input type="datetime-local" value={detail.dueAt} onChange={(e) => updatePaymentDetail(index, { dueAt: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white" /></label> : <div className="md:col-span-2" />}
          {paymentMethod === 'mixed' && <button type="button" disabled={paymentDetails.length <= 2} onClick={() => setPaymentDetails((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end rounded p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-30" aria-label="حذف توزيع الدفع"><Trash2 className="h-4 w-4" /></button>}
        </div>)}
      </fieldset>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-[780px] w-full text-right text-xs">
          <thead className="bg-slate-900 text-slate-400"><tr><th className="px-3 py-3">الساق</th><th className="px-3 py-3">الحساب المالي</th><th className="px-3 py-3">العملة</th><th className="px-3 py-3">المبلغ بعملة الرأس</th><th className="px-3 py-3"></th></tr></thead>
          <tbody>{lines.map((line, index) => {
            const account = accounts.find((candidate) => candidate.id === line.accountId);
            return <tr key={line.id} className="border-t border-slate-800"><td className={`px-3 py-2 font-black ${line.transType === 'Debit' ? 'text-emerald-300' : 'text-amber-300'}`}><select value={line.transType} onChange={(e) => updateLine(index, { transType: e.target.value as FormLine['transType'] })} className="rounded bg-transparent py-1 text-inherit"><option value="Debit">مدين</option><option value="Credit">دائن</option></select></td><td className="px-3 py-2"><select value={line.accountId} onChange={(e) => updateLine(index, { accountId: e.target.value })} className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-white"><option value="">اختر حسابًا ورقيًا</option>{accounts.filter((candidate) => candidate.isActive && candidate.isPosting).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.id} — {candidate.nameAr}</option>)}</select></td><td className="px-3 py-2 text-slate-300">{account?.currencyCode || '—'}</td><td className="px-3 py-2"><input inputMode="decimal" value={line.amountOriginal} onChange={(e) => updateLine(index, { amountOriginal: e.target.value })} className="w-32 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-white" /></td><td className="px-3 py-2">{category === 'Compound' && <button type="button" aria-label="حذف الساق" onClick={() => removeLine(index)} className="rounded p-1 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>}</td></tr>;
          })}</tbody>
        </table>
      </div>
      {category === 'Compound' && <button type="button" onClick={() => setLines((current) => [...current, createLine('Debit')])} className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/10"><Plus className="h-4 w-4" />إضافة ساق</button>}

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-900 p-3 text-center text-xs font-black"><div className="text-emerald-300">المدين: {debitTotal.toLocaleString()} {selectedCurrency?.code}</div><div className="text-amber-300">الدائن: {creditTotal.toLocaleString()} {selectedCurrency?.code}</div><div className={balanced ? 'text-emerald-300' : 'text-rose-300'}>الفرق: {Math.abs(balanceDifference).toLocaleString()}</div></div>
      <label className="block text-xs font-bold text-slate-300">ملاحظات<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-16 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
      <div className="flex flex-wrap justify-end gap-3"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={saveAsPosted} onChange={(e) => setSaveAsPosted(e.target.checked)} disabled={Boolean(editingEntry) || !canPost || category === 'Temp'} />اعتماد وترحيل مباشرة</label><button disabled={saving || !canCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'جارٍ الحفظ…' : editingEntry ? 'حفظ التعديل' : 'حفظ القيد'}</button></div>
    </form>
  );
}
