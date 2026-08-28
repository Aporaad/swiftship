import { useMemo, useState } from 'react';
import { CheckCircle2, Edit3, FilePlus2, ReceiptText, RotateCcw, Trash2, XCircle } from 'lucide-react';
import EntryForm, { type EditableEntryDraft, type FinanceAccount, type FinanceCurrency, type FinanceEntryType, type FinanceModule } from './EntryForm';
import { financialEntryService, type FinancialEntryCategory } from '../../services/financialEntryService';

export interface FinanceEntryRow {
  id: string;
  entryNumber: string;
  moduleId: string;
  entryTypeId: string;
  entryCategory: string;
  postingStatus: 'draft' | 'posted' | 'voided';
  amountOriginal: number;
  currencyOriginalNo: number;
  description: string;
  paymentMethod?: string;
  effectiveAt?: string;
  createdAt?: string;
}
export interface FinancePaymentDetailRow { id: string; entryId: string; paymentMethod: 'cash' | 'bank' | 'deferred'; accountId: string; amountOriginal: number; bankReference?: string; dueAt?: string; note?: string; }

interface Props {
  title: string;
  description: string;
  category: FinancialEntryCategory;
  permittedTypeCodes?: string[];
  initialModuleCode?: string;
  initialTypeCode?: string;
  entries: FinanceEntryRow[];
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  transactions: Array<{ id: string; entryId: string; accountId: string; transType: 'Debit' | 'Credit'; amountOriginal: number; }>;
  paymentDetails: FinancePaymentDetailRow[];
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canPost: boolean;
  canDelete: boolean;
  canVoid: boolean;
  canReverse: boolean;
  createdByUid?: string;
  onChanged: () => void;
}

const paymentMethodLabel: Record<string, string> = { cash: 'نقدًا', bank: 'بنك', deferred: 'آجل', mixed: 'مختلط' };

export default function EntryWorkspaceTab({
  title, description, category, permittedTypeCodes, initialModuleCode, initialTypeCode, entries, accounts, currencies, modules, entryTypes, transactions,
  paymentDetails,
  canView, canCreate, canEdit, canPost, canDelete, canVoid, canReverse, createdByUid, onChanged,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditableEntryDraft | null>(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const currencyById = useMemo(() => new Map(currencies.map((currency) => [currency.id, currency.code])), [currencies]);
  const typeById = useMemo(() => new Map(entryTypes.map((type) => [type.id, type])), [entryTypes]);
  const visibleEntries = useMemo(() => entries.filter((entry) => {
    if (category === 'Temp') return entry.entryCategory === 'Temp';
    if (entry.entryCategory !== category) return false;
    return !permittedTypeCodes?.length || permittedTypeCodes.includes(typeById.get(entry.entryTypeId)?.code || '');
  }), [category, entries, permittedTypeCodes, typeById]);
  const formTypes = useMemo(() => entryTypes.filter((type) => type.isActive !== false && (!permittedTypeCodes?.length || permittedTypeCodes.includes(type.code))), [entryTypes, permittedTypeCodes]);
  const formModules = useMemo(() => modules.filter((module) => module.isActive !== false && formTypes.some((type) => type.moduleId === module.id)), [formTypes, modules]);

  const postEntry = async (entryId: string) => {
    if (!canPost) return;
    try {
      setBusyId(entryId);
      setError('');
      await financialEntryService.post(entryId, createdByUid);
      onChanged();
    } catch (cause: any) {
      setError(cause?.message || 'تعذر اعتماد القيد.');
    } finally {
      setBusyId('');
    }
  };

  const openEdit = (entry: FinanceEntryRow) => {
    const draftLines = transactions.filter((line) => line.entryId === entry.id).map((line) => ({
      id: line.id,
      accountId: line.accountId,
      transType: line.transType,
      amountOriginal: String(line.amountOriginal),
    }));
    if (draftLines.length < 2) {
      setError('لا يمكن تعديل مسودة بلا ساقين محاسبيتين مكتملتين.');
      return;
    }
    setEditingEntry({
      id: entry.id, entryNumber: entry.entryNumber, moduleId: entry.moduleId, entryTypeId: entry.entryTypeId,
      currencyOriginalNo: entry.currencyOriginalNo, description: entry.description,
      paymentMethod: entry.paymentMethod as any,
      paymentDetails: paymentDetails.filter((detail) => detail.entryId === entry.id).map((detail) => ({
        id: detail.id, paymentMethod: detail.paymentMethod, accountId: detail.accountId, amountOriginal: String(detail.amountOriginal),
        bankReference: detail.bankReference || '', dueAt: detail.dueAt ? new Date(detail.dueAt).toISOString().slice(0, 16) : '', note: detail.note || '',
      })),
      lines: draftLines,
    });
    setShowForm(true);
  };

  const runSensitiveAction = async (entry: FinanceEntryRow, action: 'delete' | 'void' | 'reverse') => {
    const prompts = {
      delete: `سيُحذف نهائيًا القيد المسودة ${entry.entryNumber}. هل تريد المتابعة؟`,
      void: `سيُبطل القيد المسودة ${entry.entryNumber} ولن يمكن إعادة تفعيله. هل تريد المتابعة؟`,
      reverse: `سيُنشأ قيد عكسي مرحّل للقيد ${entry.entryNumber}. هل تريد المتابعة؟`,
    };
    if (!window.confirm(prompts[action])) return;
    try {
      setBusyId(entry.id);
      setError('');
      if (action === 'delete') await financialEntryService.deleteDraft(entry.id);
      if (action === 'void') await financialEntryService.voidDraft(entry.id, createdByUid);
      if (action === 'reverse') {
        const reversalNumber = window.prompt('رقم القيد العكسي', `REV-${entry.entryNumber}`)?.trim();
        if (!reversalNumber) return;
        await financialEntryService.reverse(entry.id, reversalNumber, createdByUid);
      }
      onChanged();
    } catch (cause: any) {
      setError(cause?.message || 'تعذر تنفيذ الإجراء المالي.');
    } finally {
      setBusyId('');
    }
  };

  if (!canView) return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center text-sm font-bold text-slate-400">لا تملك صلاحية استعراض هذا التبويب.</div>;

  return <section className="space-y-4" dir="rtl">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div><h2 className="text-lg font-black text-white">{title}</h2><p className="mt-1 text-xs text-slate-400">{description}</p></div>
      {canCreate && <button onClick={() => { setEditingEntry(null); setShowForm((value) => !value); }} className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-black text-slate-950"><FilePlus2 className="h-4 w-4" />{showForm ? 'إغلاق النموذج' : 'قيد جديد'}</button>}
    </header>
    {showForm && <EntryForm key={editingEntry?.id || 'new'} category={category} accounts={accounts} currencies={currencies} modules={formModules} entryTypes={formTypes} canCreate={editingEntry ? canEdit : canCreate} canPost={canPost} createdByUid={createdByUid} initialModuleCode={initialModuleCode} initialTypeCode={initialTypeCode} editingEntry={editingEntry || undefined} onCancel={() => { setShowForm(false); setEditingEntry(null); }} onSaved={() => { setShowForm(false); setEditingEntry(null); onChanged(); }} />}
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60"><table className="min-w-[820px] w-full text-right text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="px-4 py-3">السند</th><th className="px-4 py-3">البيان</th><th className="px-4 py-3">النوع</th><th className="px-4 py-3">الطريقة</th><th className="px-4 py-3">المبلغ</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">الإجراءات</th></tr></thead><tbody>{visibleEntries.map((entry) => <tr key={entry.id} className="border-t border-slate-800 text-slate-200"><td className="px-4 py-3 font-mono font-black text-[#d4af37]">{entry.entryNumber}</td><td className="max-w-72 px-4 py-3">{entry.description}</td><td className="px-4 py-3 text-slate-300">{typeById.get(entry.entryTypeId)?.nameAr || '—'}</td><td className="px-4 py-3">{paymentMethodLabel[entry.paymentMethod || ''] || '—'}</td><td className="px-4 py-3 font-black">{Number(entry.amountOriginal).toLocaleString()} <span className="text-slate-500">{currencyById.get(entry.currencyOriginalNo) || ''}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 font-bold ${entry.postingStatus === 'posted' ? 'bg-emerald-500/15 text-emerald-300' : entry.postingStatus === 'voided' ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>{entry.postingStatus === 'posted' ? 'مرحّل' : entry.postingStatus === 'voided' ? 'مبطل' : 'مسودة'}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{entry.postingStatus === 'draft' && canEdit && <button disabled={busyId === entry.id} onClick={() => openEdit(entry)} className="rounded-lg border border-sky-500/30 p-1.5 text-sky-200 hover:bg-sky-500/10" title="تعديل المسودة"><Edit3 className="h-3.5 w-3.5" /></button>}{entry.postingStatus === 'draft' && canPost && <button disabled={busyId === entry.id} onClick={() => postEntry(entry.id)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1.5 font-bold text-emerald-200 hover:bg-emerald-500/10"><CheckCircle2 className="h-3.5 w-3.5" />اعتماد</button>}{entry.postingStatus === 'draft' && canVoid && <button disabled={busyId === entry.id} onClick={() => void runSensitiveAction(entry, 'void')} className="rounded-lg border border-rose-500/30 p-1.5 text-rose-200 hover:bg-rose-500/10" title="إبطال المسودة"><XCircle className="h-3.5 w-3.5" /></button>}{entry.postingStatus === 'draft' && canDelete && <button disabled={busyId === entry.id} onClick={() => void runSensitiveAction(entry, 'delete')} className="rounded-lg border border-rose-500/30 p-1.5 text-rose-200 hover:bg-rose-500/10" title="حذف المسودة"><Trash2 className="h-3.5 w-3.5" /></button>}{entry.postingStatus === 'posted' && canReverse && <button disabled={busyId === entry.id} onClick={() => void runSensitiveAction(entry, 'reverse')} className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 px-2 py-1.5 font-bold text-sky-200 hover:bg-sky-500/10"><RotateCcw className="h-3.5 w-3.5" />عكس</button>}{entry.postingStatus === 'voided' && <ReceiptText className="h-4 w-4 text-slate-600" />}</div></td></tr>)}{visibleEntries.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">لا توجد قيود ضمن هذا التبويب.</td></tr>}</tbody></table></div>
  </section>;
}
