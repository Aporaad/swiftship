import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, WalletCards } from 'lucide-react';
import { financialEntryService, type FinancialPaymentMethod } from '../../services/financialEntryService';
import type { FinanceAccount, FinanceCurrency } from './EntryForm';

export interface CustodyAdvanceRow {
  id: string; custodyNumber: string; recipientId: string; recipientName: string; recipientType: string; recipientAccountId?: string;
  amountOriginal: number; amountOutstanding: number; currencyOriginalNo: number; status: string; issuedAt: string;
}
interface Props {
  items: CustodyAdvanceRow[]; accounts: FinanceAccount[]; currencies: FinanceCurrency[]; canView: boolean;
  canCreate: boolean; canSettle: boolean; createdByUid?: string; onChanged: () => void;
}
type RecipientType = 'employee' | 'courier' | 'customer' | 'supplier' | 'other';
const methods: Array<{ id: Exclude<FinancialPaymentMethod, 'mixed'>; label: string }> = [
  { id: 'cash', label: 'نقدًا' }, { id: 'bank', label: 'بنك/حوالة' },
];
const accountEntityTypeFor = (recipientType: RecipientType) => recipientType === 'supplier' ? 'source' : recipientType;
const recipientTypeLabel: Record<RecipientType, string> = { courier: 'مندوب', employee: 'موظف', customer: 'عميل', supplier: 'مورد / مصدر', other: 'طرف خارجي آخر' };

export default function CustodyAdvancesTab({ items, accounts, currencies, canView, canCreate, canSettle, createdByUid, onChanged }: Props) {
  const [mode, setMode] = useState<'none' | 'create' | 'settle'>('none');
  const [selected, setSelected] = useState<CustodyAdvanceRow | null>(null);
  const [recipientAccountId, setRecipientAccountId] = useState('');
  const [recipientReference, setRecipientReference] = useState('');
  const [fundingAccountId, setFundingAccountId] = useState('');
  const [number, setNumber] = useState(() => `CUS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}`);
  const [amount, setAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('courier');
  const [currencyNo, setCurrencyNo] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<FinancialPaymentMethod>('cash');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currencyById = useMemo(() => new Map(currencies.map((currency) => [currency.id, currency.code])), [currencies]);
  const selectedRecipientAccount = accounts.find((account) => account.id === recipientAccountId);
  const recipientAccounts = useMemo(() => accounts.filter((account) => account.isPosting && account.isActive && account.entityId && account.entityType === accountEntityTypeFor(recipientType)), [accounts, recipientType]);
  const sameCurrencyAccounts = accounts.filter((account) => account.isPosting && account.isActive && (!currencyNo || account.curNo === currencyNo) && (paymentMethod === 'cash' ? account.accSubId === '111' : paymentMethod === 'bank' ? account.accSubId === '112' : false));
  const recipientEntityId = recipientType === 'other' ? recipientReference.trim() : selectedRecipientAccount?.entityId || '';
  const resolvedRecipientName = recipientType === 'other' ? recipientName.trim() : selectedRecipientAccount?.entityName || selectedRecipientAccount?.nameAr || '';

  const resetCreate = () => {
    setMode('none'); setAmount(''); setNote(''); setRecipientAccountId(''); setRecipientReference(''); setRecipientName(''); setFundingAccountId('');
  };
  const selectRecipientAccount = (accountId: string) => {
    setRecipientAccountId(accountId);
    const account = accounts.find((item) => item.id === accountId);
    if (account) setCurrencyNo(account.curNo);
  };
  const createAdvance = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const parsedAmount = Number(amount || 0);
    const recipient = accounts.find((account) => account.id === recipientAccountId);
    const funding = accounts.find((account) => account.id === fundingAccountId);
    if (!canCreate) return setError('ليس لديك تصريح إنشاء العهد والسلف.');
    if (!recipient || !funding || !number.trim() || !recipientEntityId || !resolvedRecipientName || !currencyNo || parsedAmount <= 0) {
      return setError('أكمل رقم العهدة والطرف الحقيقي وحسابه وحساب التمويل والمبلغ والعملة.');
    }
    if (recipientType !== 'other' && (recipient.entityType !== accountEntityTypeFor(recipientType) || recipient.entityId !== recipientEntityId)) {
      return setError('الحساب المختار لا يرتبط بنوع وكيان المستلم المحددين.');
    }
    if (recipient.curNo !== currencyNo || funding.curNo !== currencyNo) return setError('في هذا النموذج يجب أن تطابق عملة حسابي العهدة عملتها؛ استخدم سند صرافة مستقلًا للتحويل.');
    try {
      setBusy(true);
      await financialEntryService.createCustodyAdvance({
        custodyNumber: number, recipientType, recipientId: recipientEntityId, recipientName: resolvedRecipientName, recipientAccountId: recipient.id,
        amountOriginal: parsedAmount, currencyOriginalNo: currencyNo, note, createdByUid,
      }, {
        entryNumber: `ISS-${number}`, moduleId: 'module_custody', entryTypeId: 'type_custody_issue', entryCategory: 'General', postingStatus: 'posted',
        description: `إصدار عهدة ${number} إلى ${resolvedRecipientName}`, notes: note, paymentMethod, createdByUid,
        lines: [
          { accountId: recipient.id, accountCurNo: recipient.curNo, currencyOriginalNo: currencyNo, transType: 'Debit', amount: parsedAmount, amountOriginal: parsedAmount, entityType: recipientType, entityId: recipientEntityId },
          { accountId: funding.id, accountCurNo: funding.curNo, currencyOriginalNo: currencyNo, transType: 'Credit', amount: parsedAmount, amountOriginal: parsedAmount, paymentMethod },
        ],
        paymentDetails: [{ paymentMethod: paymentMethod as Exclude<FinancialPaymentMethod, 'mixed'>, accountId: funding.id, amountOriginal: parsedAmount, dueAt }],
      });
      resetCreate(); onChanged();
    } catch (cause: any) { setError(cause?.message || 'تعذر إنشاء العهدة.'); } finally { setBusy(false); }
  };

  const settleAdvance = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const parsedAmount = Number(amount || 0);
    const receiving = accounts.find((account) => account.id === fundingAccountId);
    const recipient = selected?.recipientAccountId ? accounts.find((account) => account.id === selected.recipientAccountId) : undefined;
    if (!selected || !recipient || !receiving || parsedAmount <= 0) return setError('اختر العهدة وحساب استلام التسوية وأدخل مبلغًا صالحًا.');
    if (!canSettle) return setError('ليس لديك تصريح تسوية العهد والسلف.');
    if (parsedAmount > selected.amountOutstanding) return setError('مبلغ التسوية أكبر من المتبقي من العهدة.');
    if (recipient.curNo !== selected.currencyOriginalNo || receiving.curNo !== selected.currencyOriginalNo) return setError('يجب أن تطابق حسابات التسوية عملة العهدة؛ لا يُنشأ تحويل ضمن تسوية العهدة.');
    try {
      setBusy(true);
      await financialEntryService.settleCustodyAdvance(selected.id, {
        entryNumber: `SET-${selected.custodyNumber}-${Date.now().toString().slice(-5)}`, moduleId: 'module_custody', entryTypeId: 'type_custody_settlement', entryCategory: 'General', postingStatus: 'posted',
        description: `تسوية عهدة ${selected.custodyNumber}`, notes: note, paymentMethod, createdByUid,
        lines: [
          { accountId: receiving.id, accountCurNo: receiving.curNo, currencyOriginalNo: selected.currencyOriginalNo, transType: 'Debit', amount: parsedAmount, amountOriginal: parsedAmount, paymentMethod },
          { accountId: recipient.id, accountCurNo: recipient.curNo, currencyOriginalNo: selected.currencyOriginalNo, transType: 'Credit', amount: parsedAmount, amountOriginal: parsedAmount, entityType: selected.recipientType, entityId: selected.recipientId },
        ],
        paymentDetails: [{ paymentMethod: paymentMethod as Exclude<FinancialPaymentMethod, 'mixed'>, accountId: receiving.id, amountOriginal: parsedAmount, dueAt }],
      }, createdByUid);
      setMode('none'); setSelected(null); setAmount(''); setNote(''); onChanged();
    } catch (cause: any) { setError(cause?.message || 'تعذر تسوية العهدة.'); } finally { setBusy(false); }
  };

  const openSettle = (item: CustodyAdvanceRow) => { setSelected(item); setCurrencyNo(item.currencyOriginalNo); setAmount(''); setFundingAccountId(''); setNote(''); setDueAt(''); setMode('settle'); };
  if (!canView) return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center text-sm font-bold text-slate-400">لا تملك صلاحية استعراض العهد والسلف.</div>;
  return <section className="space-y-4" dir="rtl">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><div><h2 className="text-lg font-black text-white">العهد والسلف</h2><p className="mt-1 text-xs text-slate-400">يرتبط المستلم بكيانه الفعلي وحسابه المالي، ثم ينشأ قيد الإصدار أو التسوية ذريًا.</p></div>{canCreate && <button onClick={() => { setMode(mode === 'create' ? 'none' : 'create'); setCurrencyNo(currencies.find((currency) => currency.isDefault)?.id || currencies[0]?.id || ''); }} className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-black text-slate-950"><Plus className="h-4 w-4" />عهدة / سلفة جديدة</button>}</header>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
    {mode === 'create' && <form onSubmit={createAdvance} className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-5 md:grid-cols-2">
      <label className="text-xs font-bold text-slate-300">رقم العهدة<input value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" /></label>
      <label className="text-xs font-bold text-slate-300">نوع المستلم<select value={recipientType} onChange={(e) => { setRecipientType(e.target.value as RecipientType); setRecipientAccountId(''); setRecipientReference(''); setRecipientName(''); }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"><option value="courier">مندوب</option><option value="employee">موظف</option><option value="customer">عميل</option><option value="supplier">مورد / مصدر</option><option value="other">أخرى</option></select></label>
      {recipientType === 'other' ? <><label className="text-xs font-bold text-slate-300">معرّف الطرف الخارجي<input value={recipientReference} onChange={(e) => setRecipientReference(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" /></label><label className="text-xs font-bold text-slate-300">اسم الطرف الخارجي<input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" /></label></> : <label className="text-xs font-bold text-slate-300 md:col-span-2">الطرف المستلم وحسابه المالي<select value={recipientAccountId} onChange={(e) => selectRecipientAccount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"><option value="">اختر {recipientTypeLabel[recipientType]} من الحسابات المرتبطة</option>{recipientAccounts.map((account) => <option key={account.id} value={account.id}>{account.entityName || account.nameAr} — {account.id} ({account.currencyCode})</option>)}</select></label>}
      {recipientType === 'other' && <label className="text-xs font-bold text-slate-300 md:col-span-2">الحساب المالي للطرف الخارجي<select value={recipientAccountId} onChange={(e) => selectRecipientAccount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"><option value="">اختر حساب الطرف الخارجي</option>{accounts.filter((account) => account.isPosting && account.isActive).map((account) => <option key={account.id} value={account.id}>{account.id} — {account.nameAr} ({account.currencyCode})</option>)}</select></label>}
      <label className="text-xs font-bold text-slate-300">عملة العهدة<select value={currencyNo} onChange={(e) => setCurrencyNo(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white">{currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.code}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-300">حساب تمويل العهدة<select value={fundingAccountId} onChange={(e) => setFundingAccountId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"><option value="">اختر الصندوق/البنك</option>{sameCurrencyAccounts.map((account) => <option key={account.id} value={account.id}>{account.id} — {account.nameAr}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-300">المبلغ<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" /></label>
      <label className="text-xs font-bold text-slate-300">طريقة الدفع<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as FinancialPaymentMethod)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white">{methods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-300 md:col-span-2">ملاحظة<textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 min-h-16 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" /></label>
      <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={resetCreate} className="rounded-lg px-3 py-2 text-sm text-slate-300">إلغاء</button><button disabled={busy} className="rounded-lg bg-[#d4af37] px-4 py-2 text-sm font-black text-slate-950">{busy ? 'جارٍ الحفظ…' : 'إصدار العهدة'}</button></div>
    </form>}
    {mode === 'settle' && selected && <form onSubmit={settleAdvance} className="grid gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 md:grid-cols-2"><div className="md:col-span-2 text-sm font-black text-emerald-200">تسوية {selected.custodyNumber} — المتبقي {selected.amountOutstanding.toLocaleString()} {currencyById.get(selected.currencyOriginalNo)}</div><label className="text-xs font-bold text-slate-300">مبلغ التسوية<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" /></label><label className="text-xs font-bold text-slate-300">حساب استلام التسوية<select value={fundingAccountId} onChange={(e) => setFundingAccountId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"><option value="">اختر صندوقًا أو بنكًا</option>{sameCurrencyAccounts.map((account) => <option key={account.id} value={account.id}>{account.id} — {account.nameAr}</option>)}</select></label><label className="text-xs font-bold text-slate-300">طريقة الاستلام<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as FinancialPaymentMethod)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white">{methods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label><label className="text-xs font-bold text-slate-300">ملاحظة<textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" /></label><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setMode('none')} className="rounded-lg px-3 py-2 text-sm text-slate-300">إلغاء</button><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950"><CheckCircle2 className="h-4 w-4" />{busy ? 'جارٍ التسوية…' : 'تأكيد التسوية'}</button></div></form>}
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60"><table className="min-w-[820px] w-full text-right text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="px-4 py-3">رقم العهدة</th><th className="px-4 py-3">المستلم</th><th className="px-4 py-3">الأصل</th><th className="px-4 py-3">المتبقي</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">إجراء</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-800 text-slate-200"><td className="px-4 py-3 font-mono font-black text-[#d4af37]">{item.custodyNumber}</td><td className="px-4 py-3">{item.recipientName}<span className="mr-2 text-slate-500">{item.recipientType}</span></td><td className="px-4 py-3">{item.amountOriginal.toLocaleString()} {currencyById.get(item.currencyOriginalNo)}</td><td className="px-4 py-3 font-black text-amber-200">{item.amountOutstanding.toLocaleString()}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-800 px-2 py-1">{item.status === 'open' ? 'مفتوحة' : item.status === 'partial' ? 'جزئية' : item.status === 'settled' ? 'مسددة' : item.status}</span></td><td className="px-4 py-3">{item.amountOutstanding > 0 && canSettle ? <button onClick={() => openSettle(item)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1.5 font-bold text-emerald-200 hover:bg-emerald-500/10"><WalletCards className="h-3.5 w-3.5" />تسوية</button> : '—'}</td></tr>)}{!items.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">لا توجد عهد أو سلف حالية.</td></tr>}</tbody></table></div>
  </section>;
}
