/**
 * EntryWorkspaceTab - لوحة العمل للقيود والسندات
 *
 * التحديثات الجديدة:
 * 1. دعم أزرار السندات الستة المخصصة (نقدي / بنكي / متعدد) لكل من واجهتي سندات القبض وسندات الصرف.
 * 2. فتح المودال مع تعيين نوع السند والأنواع التلقائية وتمرير اسم المستخدم الحقيقي.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, Edit3, FilePlus2, ReceiptText, RotateCcw, Trash2, X, XCircle, BookOpen, Layers, Wallet, Building, CreditCard } from 'lucide-react';
import { financialEntryService, type FinancialEntryCategory } from '../../services/financialEntryService';

import GeneralEntryForm from './forms/GeneralEntryForm';
import CompoundEntryForm from './forms/CompoundEntryForm';
import VoucherEntryForm from './forms/VoucherEntryForm';

export interface FinanceAccount {
  id: string;
  nameAr: string;
  nameEn?: string;
  curNo: number;
  currencyCode: string;
  isActive: boolean;
  isPosting: boolean;
  accSubId?: string;
  entityId?: string;
  entityType?: string;
}

export interface FinanceCurrency { id: number; code: string; isDefault: boolean; }
export interface FinanceModule { id: string; code: string; nameAr: string; isActive?: boolean; }
export interface FinanceEntryType { id: string; moduleId: string; code: string; nameAr: string; isActive?: boolean; }

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

export interface FinancePaymentDetailRow {
  id: string;
  entryId: string;
  paymentMethod: 'cash' | 'bank' | 'deferred';
  accountId: string;
  amountOriginal: number;
  bankReference?: string;
  dueAt?: string;
  note?: string;
}

interface Props {
  title: string;
  description: string;
  category: FinancialEntryCategory;
  permittedTypeCodes?: string[];
  initialModuleCode?: string;
  initialTypeCode?: string;
  buttonLabel?: string;
  isVoucherMode?: boolean;
  voucherType?: 'receipt' | 'payment';
  entries: FinanceEntryRow[];
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  transactions: Array<{ id: string; entryId: string; accountId: string; transType: 'Debit' | 'Credit'; amountOriginal: number; lineDescription?: string }>;
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

const paymentMethodLabel: Record<string, string> = {
  cash: 'نقدًا',
  bank: 'بنك',
  deferred: 'آجل',
  mixed: 'مختلط',
};

const statusStyle: Record<string, string> = {
  posted: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  voided: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  draft:  'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const statusLabel: Record<string, string> = {
  posted: 'مرحّل',
  voided: 'مبطل',
  draft:  'مسودة',
};

export default function EntryWorkspaceTab({
  title,
  description,
  category,
  permittedTypeCodes,
  initialModuleCode,
  initialTypeCode,
  buttonLabel,
  isVoucherMode = false,
  voucherType,
  entries,
  accounts,
  currencies,
  modules,
  entryTypes,
  transactions,
  paymentDetails,
  canView,
  canCreate,
  canEdit,
  canPost,
  canDelete,
  canVoid,
  canReverse,
  createdByUid,
  onChanged,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [selectedVoucherSubKind, setSelectedVoucherSubKind] = useState<'cash' | 'bank' | 'multi'>('cash');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const currencyById = useMemo(
    () => new Map(currencies.map((c) => [c.id, c.code])),
    [currencies]
  );
  const typeById = useMemo(
    () => new Map(entryTypes.map((t) => [t.id, t])),
    [entryTypes]
  );

  const visibleEntries = useMemo(() =>
    entries.filter((entry) => {
      if (category === 'Temp') return entry.entryCategory === 'Temp';
      if (entry.entryCategory !== category) return false;
      return !permittedTypeCodes?.length || permittedTypeCodes.includes(typeById.get(entry.entryTypeId)?.code || '');
    }),
    [category, entries, permittedTypeCodes, typeById]
  );

  const formTypes = useMemo(
    () => entryTypes.filter((t) => t.isActive !== false && (!permittedTypeCodes?.length || permittedTypeCodes.includes(t.code))),
    [entryTypes, permittedTypeCodes]
  );

  const formModules = useMemo(
    () => modules.filter((m) => m.isActive !== false && formTypes.some((t) => t.moduleId === m.id)),
    [formTypes, modules]
  );

  const openNewVoucher = (subKind: 'cash' | 'bank' | 'multi') => {
    setSelectedVoucherSubKind(subKind);
    setEditingEntry(null);
    setShowModal(true);
  };

  const openNew = () => {
    setSelectedVoucherSubKind('cash');
    setEditingEntry(null);
    setShowModal(true);
  };

  const openEdit = (entry: FinanceEntryRow) => {
    const draftLines = transactions
      .filter((l) => l.entryId === entry.id)
      .map((l) => ({
        id: l.id,
        accountId: l.accountId,
        transType: l.transType,
        amountOriginal: String(l.amountOriginal),
        lineDescription: l.lineDescription || '',
      }));

    if (draftLines.length < 2) {
      setError('لا يمكن تعديل مسودة بلا ساقين محاسبيتين مكتملتين.');
      return;
    }

    setEditingEntry({
      id: entry.id,
      entryNumber: entry.entryNumber,
      moduleId: entry.moduleId,
      entryTypeId: entry.entryTypeId,
      currencyOriginalNo: entry.currencyOriginalNo,
      description: entry.description,
      paymentMethod: entry.paymentMethod as any,
      paymentDetails: paymentDetails
        .filter((d) => d.entryId === entry.id)
        .map((d) => ({
          id: d.id,
          paymentMethod: d.paymentMethod as any,
          accountId: d.accountId,
          amountOriginal: String(d.amountOriginal),
          bankReference: d.bankReference || '',
          dueAt: d.dueAt ? new Date(d.dueAt).toISOString().slice(0, 16) : '',
          note: d.note || '',
        })),
      lines: draftLines,
    });
    setShowModal(true);
  };

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

  const runSensitiveAction = async (entry: FinanceEntryRow, action: 'delete' | 'void' | 'reverse') => {
    const prompts = {
      delete: `سيُحذف نهائيًا القيد المسودة ${entry.entryNumber}. هل تريد المتابعة؟`,
      void: `سيُبطل القيد ${entry.entryNumber} ولن يمكن إعادة تفعيله. هل تريد المتابعة؟`,
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

  const closeModal = () => {
    setShowModal(false);
    setEditingEntry(null);
  };

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center text-sm font-bold text-slate-400">
        لا تملك صلاحية استعراض هذا التبويب.
      </div>
    );
  }

  const modalTitle = editingEntry
    ? `تعديل سجل: ${editingEntry.entryNumber}`
    : isVoucherMode
      ? (voucherType === 'payment'
          ? (selectedVoucherSubKind === 'cash' ? 'سند صرف نقدي جديد' : selectedVoucherSubKind === 'bank' ? 'سند صرف بنكي جديد' : 'سند صرف متعدد جديد')
          : (selectedVoucherSubKind === 'cash' ? 'سند قبض نقدي جديد' : selectedVoucherSubKind === 'bank' ? 'سند قبض بنكي جديد' : 'سند قبض متعدد جديد'))
      : buttonLabel || 'قيد جديد';

  return (
    <section className="space-y-4" dir="rtl">
      {/* ── رأس التبويب والأزرار ── */}
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        {canCreate && (
          isVoucherMode ? (
            /* أزرار السندات الستة المخصصة حسب الواجهة (قبض / صرف) */
            <div className="flex flex-wrap items-center gap-2">
              {voucherType === 'payment' ? (
                <>
                  <button
                    onClick={() => openNewVoucher('cash')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md transition"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>سند صرف نقدي جديد</span>
                  </button>

                  <button
                    onClick={() => openNewVoucher('bank')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-black text-white shadow-md transition"
                  >
                    <Building className="h-4 w-4" />
                    <span>سند صرف بنكي جديد</span>
                  </button>

                  <button
                    onClick={() => openNewVoucher('multi')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-3.5 py-2 text-xs font-black text-white shadow-md transition"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>سند صرف متعدد جديد</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openNewVoucher('cash')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md transition"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>سند قبض نقدي جديد</span>
                  </button>

                  <button
                    onClick={() => openNewVoucher('bank')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-black text-white shadow-md transition"
                  >
                    <Building className="h-4 w-4" />
                    <span>سند قبض بنكي جديد</span>
                  </button>

                  <button
                    onClick={() => openNewVoucher('multi')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-3.5 py-2 text-xs font-black text-white shadow-md transition"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>سند قبض متعدد جديد</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 shadow-lg transition"
            >
              <FilePlus2 className="h-4 w-4" />
              {buttonLabel || 'قيد جديد'}
            </button>
          )
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* ── جدول عرض القيود والسندات ── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
        <table className="min-w-[820px] w-full text-right text-xs">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">السند / القيد</th>
              <th className="px-4 py-3">البيان العام</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">المبلغ</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visibleEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-900/40 transition text-slate-200">
                <td className="px-4 py-3 font-mono font-black text-amber-400">{entry.entryNumber}</td>
                <td className="max-w-72 px-4 py-3">{entry.description}</td>
                <td className="px-4 py-3 text-slate-300">{typeById.get(entry.entryTypeId)?.nameAr || '—'}</td>
                <td className="px-4 py-3 font-mono font-black text-white">
                  {Number(entry.amountOriginal).toLocaleString()}{' '}
                  <span className="text-slate-500 text-[10px]">{currencyById.get(entry.currencyOriginalNo) || ''}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusStyle[entry.postingStatus] || statusStyle.draft}`}>
                    {statusLabel[entry.postingStatus] || entry.postingStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {entry.postingStatus === 'draft' && canEdit && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => openEdit(entry)}
                        className="rounded-lg border border-sky-500/30 p-1.5 text-sky-200 hover:bg-sky-500/10"
                        title="تعديل المسودة"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {entry.postingStatus === 'draft' && canPost && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => postEntry(entry.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/10"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        اعتماد
                      </button>
                    )}
                    {entry.postingStatus === 'draft' && canVoid && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => void runSensitiveAction(entry, 'void')}
                        className="rounded-lg border border-rose-500/30 p-1.5 text-rose-200 hover:bg-rose-500/10"
                        title="إبطال المسودة"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {entry.postingStatus === 'draft' && canDelete && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => void runSensitiveAction(entry, 'delete')}
                        className="rounded-lg border border-rose-500/30 p-1.5 text-rose-200 hover:bg-rose-500/10"
                        title="حذف المسودة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {entry.postingStatus === 'posted' && canReverse && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => void runSensitiveAction(entry, 'reverse')}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 px-2 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-500/10"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        عكس
                      </button>
                    )}
                    {entry.postingStatus === 'voided' && (
                      <ReceiptText className="h-4 w-4 text-slate-600" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visibleEntries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  لا توجد سجلات ضمن هذا التبويب.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ════════════════════════════════════════════
          النافذة المنبثقة للنموذج (Modal)
          ════════════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-4 md:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity duration-300"
            onClick={closeModal}
          />
          {/* محتوى المودال الأفقِي بحجم متناسق وهامش مريح من اليمين واليسار */}
          <div
            className="relative z-10 w-full max-w-[92vw] lg:max-w-[88vw] xl:max-w-[1380px] 2xl:max-w-[1480px] max-h-[92vh] mx-auto flex flex-col rounded-3xl border border-slate-700/90 bg-slate-950 shadow-2xl overflow-hidden transition-all duration-300 ring-1 ring-slate-800"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 sm:px-6 py-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-400">
                  {isVoucherMode ? <ReceiptText className="h-5 w-5" /> : category === 'Compound' ? <Layers className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">{modalTitle}</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">معالجة وحفظ البيانات المالية في النظام بشكل آمن ومحاسبي</p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-3 sm:p-5 md:p-6 flex-1">
              {isVoucherMode ? (
                <VoucherEntryForm
                  voucherType={voucherType || 'receipt'}
                  voucherSubKind={selectedVoucherSubKind}
                  accounts={accounts}
                  currencies={currencies}
                  modules={formModules}
                  entryTypes={formTypes}
                  canCreate={editingEntry ? canEdit : canCreate}
                  canPost={canPost}
                  createdByUid={createdByUid}
                  initialModuleCode={initialModuleCode}
                  initialTypeCode={initialTypeCode}
                  editingEntry={editingEntry || undefined}
                  onCancel={closeModal}
                  onSaved={() => {
                    closeModal();
                    onChanged();
                  }}
                />
              ) : category === 'Compound' ? (
                <CompoundEntryForm
                  accounts={accounts}
                  currencies={currencies}
                  modules={formModules}
                  entryTypes={formTypes}
                  canCreate={editingEntry ? canEdit : canCreate}
                  canPost={canPost}
                  createdByUid={createdByUid}
                  initialModuleCode={initialModuleCode}
                  initialTypeCode={initialTypeCode}
                  editingEntry={editingEntry || undefined}
                  onCancel={closeModal}
                  onSaved={() => {
                    closeModal();
                    onChanged();
                  }}
                />
              ) : (
                <GeneralEntryForm
                  category={category}
                  accounts={accounts}
                  currencies={currencies}
                  modules={formModules}
                  entryTypes={formTypes}
                  canCreate={editingEntry ? canEdit : canCreate}
                  canPost={canPost}
                  createdByUid={createdByUid}
                  initialModuleCode={initialModuleCode}
                  initialTypeCode={initialTypeCode}
                  editingEntry={editingEntry || undefined}
                  onCancel={closeModal}
                  onSaved={() => {
                    closeModal();
                    onChanged();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
