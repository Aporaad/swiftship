/**
 * EntryWorkspaceTab — لوحة عمل القيود والسندات
 * Entry Workspace Tab - Main Component for Entries Display & Management
 *
 * الميزات الشاملة / Comprehensive Features:
 * ─────────────────────────────────────────
 * 1. إخفاء غير المرحّلة عن واجهاتها وإظهارها في تبويب المؤقتة فقط
 *    Hide unposted entries from their tabs; show only in Temporary tab
 * 2. إحصائيات مختصرة أعلى الواجهة (عدد كلي، مرحّل، مؤقت، مبطل، مجاميع مبالغ)
 *    Summary statistics bar (totals, counts by status, amount sums)
 * 3. بحث نصي حر + فلاتر متعددة (حالة، طريقة دفع، فترة، نطاق مبلغ، عملة، وحدة، نوع)
 *    Free text search + multiple filters
 * 4. فرز حسب: تاريخ، رقم قيد، مبلغ، حالة
 *    Sort by: date, entry number, amount, status
 * 5. طباعة PDF / تصدير CSV / تصدير XLS
 *    Print PDF / Export CSV / Export XLS
 * 6. أزرار إجراءات لكل سجل: تفاصيل، تعديل، ترحيل، حذف
 *    Per-row action buttons: Details, Edit, Post, Delete
 * 7. تعديل وحذف القيود المرحّلة مشروط بصلاحيات canEditPosted / canDeletePosted
 *    Edit/Delete posted entries gated by canEditPosted / canDeletePosted
 * 8. نافذة تفاصيل كاملة مع كشف حساب منبثق
 *    Full details modal with account ledger popup
 */

import { useMemo, useState } from 'react';
import {
  BookOpen, Building, CheckCircle2, CreditCard, Download, Edit3,
  Eye, FilePlus2, Layers, ReceiptText, RotateCcw, Search,
  SlidersHorizontal, Trash2, Wallet, X, XCircle, ArrowUpDown,
  FileSpreadsheet, Printer, TrendingUp, TrendingDown, Hash, RefreshCw,
} from 'lucide-react';
import { financialEntryService, type FinancialEntryCategory } from '../../services/financialEntryService';

import GeneralEntryForm from './forms/GeneralEntryForm';
import CompoundEntryForm from './forms/CompoundEntryForm';
import VoucherEntryForm from './forms/VoucherEntryForm';
import EntryDetailsModal, { type EntryTransactionLine } from './EntryDetailsModal';
import EntryDeleteConfirmModal from './EntryDeleteConfirmModal';

// ── أنواع البيانات ── Types
export interface FinanceAccount {
  id: string; nameAr: string; nameEn?: string; curNo: number; currencyCode: string;
  isActive: boolean; isPosting: boolean; accSubId?: string; entityId?: string;
  entityType?: string; entityName?: string;
}
export interface FinanceCurrency { id: number; code: string; isDefault: boolean; }
export interface FinanceModule { id: string; code: string; nameAr: string; isActive?: boolean; }
export interface FinanceEntryType { id: string; moduleId: string; code: string; nameAr: string; isActive?: boolean; }

export interface FinanceEntryRow {
  id: string; entryNumber: string; moduleId: string; entryTypeId: string;
  entryCategory: string; postingStatus: 'draft' | 'posted' | 'voided';
  amountOriginal: number; currencyOriginalNo: number; description: string;
  paymentMethod?: string; effectiveAt?: string; createdAt?: string;
}

export interface FinancePaymentDetailRow {
  id: string; entryId: string; paymentMethod: 'cash' | 'bank' | 'deferred';
  accountId: string; amountOriginal: number; bankReference?: string;
  dueAt?: string; note?: string;
}

// ── Props ──
interface Props {
  title: string; description: string;
  category: FinancialEntryCategory;
  permittedTypeCodes?: string[];
  initialModuleCode?: string; initialTypeCode?: string;
  buttonLabel?: string;
  isVoucherMode?: boolean; voucherType?: 'receipt' | 'payment';
  entries: FinanceEntryRow[];
  accounts: FinanceAccount[]; currencies: FinanceCurrency[];
  modules: FinanceModule[]; entryTypes: FinanceEntryType[];
  transactions: Array<{
    id: string; entryId: string; lineNo?: number; accountId: string;
    accountCurNo?: number; amount?: number;
    transType: 'Debit' | 'Credit'; amountOriginal: number;
    currencyOriginalNo?: number; paymentMethod?: string;
    description?: string; lineDescription?: string;
    orderId?: string; shipmentId?: string;
  }>;
  paymentDetails: FinancePaymentDetailRow[];
  canView: boolean; canCreate: boolean; canEdit: boolean; canPost: boolean;
  canDelete: boolean; canVoid: boolean; canReverse: boolean;
  canPrint?: boolean; canExport?: boolean;
  canEditPosted?: boolean;   // تعديل المرحّل — Edit posted entries
  canDeletePosted?: boolean; // حذف المرحّل — Delete posted entries
  createdByUid?: string;
  onChanged: () => void;
}

// ── ثوابت التسميات ── Label Constants
const paymentMethodLabel: Record<string, string> = {
  cash: 'نقدًا', bank: 'بنك', deferred: 'آجل', mixed: 'مختلط',
};
const statusStyle: Record<string, string> = {
  posted: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  voided: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  draft: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};
const statusLabel: Record<string, string> = {
  posted: 'مرحّل', voided: 'مبطل', draft: 'مسودة',
};
const statusFilterOptions = [
  { value: '', label: 'كل الحالات' },
  { value: 'posted', label: 'مرحّل' },
  { value: 'draft', label: 'مسودة' },
  { value: 'voided', label: 'مبطل' },
];
const sortOptions = [
  { value: 'date_desc', label: 'الأحدث أولاً' },
  { value: 'date_asc', label: 'الأقدم أولاً' },
  { value: 'number_desc', label: 'رقم القيد تنازلياً' },
  { value: 'number_asc', label: 'رقم القيد تصاعدياً' },
  { value: 'amount_desc', label: 'الأعلى مبلغاً' },
  { value: 'amount_asc', label: 'الأقل مبلغاً' },
  { value: 'status', label: 'حسب الحالة' },
];

// ── أداة تصدير CSV ── CSV Export Helper
const toCsvCell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
const rowToCsv = (cols: unknown[]) => cols.map(toCsvCell).join(',');

// ── أداة تصدير XLS ── XLS Export Helper (HTML table trick)
function exportXls(filename: string, headers: string[], rows: string[][]) {
  const tableHtml = `<table><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  const blob = new Blob(['\ufeff', tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

// ── المكوّن الرئيسي ── Main Component
export default function EntryWorkspaceTab({
  title, description, category, permittedTypeCodes,
  initialModuleCode, initialTypeCode, buttonLabel,
  isVoucherMode = false, voucherType,
  entries, accounts, currencies, modules, entryTypes,
  transactions, paymentDetails,
  canView, canCreate, canEdit, canPost, canDelete, canVoid, canReverse,
  canPrint = false, canExport = false,
  canEditPosted = false, canDeletePosted = false,
  createdByUid, onChanged,
}: Props) {

  // ── حالة واجهة المستخدم ── UI State
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [selectedVoucherSubKind, setSelectedVoucherSubKind] = useState<'cash' | 'bank' | 'multi'>('cash');
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [error, setError] = useState('');

  // حالة نوافذ التفاصيل والحذف — Details & Delete modal state
  const [detailsEntry, setDetailsEntry] = useState<FinanceEntryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceEntryRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── إجراءات التحديد المتعدد ── Multi-select handlers
  const handleSelectAll = () => {
    if (selectedEntryIds.length === visibleEntries.length && visibleEntries.length > 0) {
      setSelectedEntryIds([]);
    } else {
      setSelectedEntryIds(visibleEntries.map((e) => e.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedEntryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ── حذف جماعي ── Bulk Delete
  const handleBatchDelete = async () => {
    if (selectedEntryIds.length === 0) return;
    if (!window.confirm(`هل أنت تأكد من رغبتك في حذف ${selectedEntryIds.length} قيد/سند بشكل نهائي مع كافة أطرافها وحركاتها التابعة؟`)) return;

    try {
      setIsBatchProcessing(true);
      setError('');
      for (const id of selectedEntryIds) {
        const target = baseEntries.find((e) => e.id === id);
        if (target?.postingStatus === 'posted') {
          await financialEntryService.deletePosted(id, createdByUid);
        } else {
          await financialEntryService.deleteDraft(id);
        }
      }
      setSelectedEntryIds([]);
      onChanged();
    } catch (cause: any) {
      setError(cause?.message || 'تعذر إجراء الحذف الجماعي للقيود.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // ── ترحيل جماعي ── Bulk Post
  const handleBatchPost = async () => {
    if (selectedEntryIds.length === 0 || !canPost) return;
    if (!window.confirm(`هل أنت تأكد من ترحيل ${selectedEntryIds.length} قيد/سند؟`)) return;

    try {
      setIsBatchProcessing(true);
      setError('');
      for (const id of selectedEntryIds) {
        const target = baseEntries.find((e) => e.id === id);
        if (target?.postingStatus === 'draft') {
          await financialEntryService.post(id, createdByUid);
        }
      }
      setSelectedEntryIds([]);
      onChanged();
    } catch (cause: any) {
      setError(cause?.message || 'تعذر إجراء الترحيل الجماعي للقيود.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // حالة الفلاتر والبحث — Filters & Search state
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayMethod, setFilterPayMethod] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterModuleId, setFilterModuleId] = useState('');
  const [filterTypeId, setFilterTypeId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAmtMin, setFilterAmtMin] = useState('');
  const [filterAmtMax, setFilterAmtMax] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  // ── خرائط بحث سريعة ── Lookup Maps
  const currencyById = useMemo(() => new Map(currencies.map((c) => [c.id, c.code])), [currencies]);
  const typeById = useMemo(() => new Map(entryTypes.map((t) => [t.id, t])), [entryTypes]);
  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // ── قوائم منسدلة للفلاتر ── Filter dropdown lists
  const formTypes = useMemo(
    () => entryTypes.filter((t) => t.isActive !== false && (!permittedTypeCodes?.length || permittedTypeCodes.includes(t.code))),
    [entryTypes, permittedTypeCodes]
  );
  const formModules = useMemo(
    () => modules.filter((m) => m.isActive !== false && formTypes.some((t) => t.moduleId === m.id)),
    [formTypes, modules]
  );

  // ── منطق الفلترة الأساسي: إخفاء المسودات عن واجهاتها الأصلية ──
  // Core filter logic: hide drafts from their own tabs, only show in Temp tab
  const baseEntries = useMemo(() => {
    return entries.filter((entry) => {
      // تبويب المؤقتة يعرض كل القيود غير المرحّلة بغض النظر عن نوعها
      // Temporary tab shows ALL draft entries regardless of their original type
      if (category === 'Temp') {
        return entry.postingStatus === 'draft';
      }
      // باقي التبويبات تعرض فقط المرحّلة أو المبطلة من نوعها المحدد
      // Other tabs show only posted/voided entries matching their category
      if (entry.postingStatus === 'draft') return false;
      if (entry.entryCategory !== category) return false;
      return !permittedTypeCodes?.length || permittedTypeCodes.includes(typeById.get(entry.entryTypeId)?.code || '');
    });
  }, [category, entries, permittedTypeCodes, typeById]);

  // ── الفلاتر والبحث والفرز ──
  // Apply search, filters, sorting
  const visibleEntries = useMemo(() => {
    let list = baseEntries;

    // بحث نصي — Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) => {
        const typeName = typeById.get(e.entryTypeId)?.nameAr?.toLowerCase() || '';
        const modName = moduleById.get(e.moduleId)?.nameAr?.toLowerCase() || '';
        return e.entryNumber.toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          typeName.includes(q) || modName.includes(q);
      });
    }
    // فلتر الحالة — Status filter
    if (filterStatus) list = list.filter((e) => e.postingStatus === filterStatus);
    // فلتر طريقة الدفع — Payment method filter
    if (filterPayMethod) list = list.filter((e) => e.paymentMethod === filterPayMethod);
    // فلتر العملة — Currency filter
    if (filterCurrency) list = list.filter((e) => String(e.currencyOriginalNo) === filterCurrency);
    // فلتر الوحدة — Module filter
    if (filterModuleId) list = list.filter((e) => e.moduleId === filterModuleId);
    // فلتر النوع — Type filter
    if (filterTypeId) list = list.filter((e) => e.entryTypeId === filterTypeId);
    // فلتر الفترة — Date range filter
    if (filterDateFrom) list = list.filter((e) => (e.effectiveAt || e.createdAt || '') >= filterDateFrom);
    if (filterDateTo) list = list.filter((e) => (e.effectiveAt || e.createdAt || '') <= filterDateTo + 'T23:59:59');
    // فلتر نطاق المبلغ — Amount range filter
    if (filterAmtMin) list = list.filter((e) => Number(e.amountOriginal) >= Number(filterAmtMin));
    if (filterAmtMax) list = list.filter((e) => Number(e.amountOriginal) <= Number(filterAmtMax));

    // الفرز — Sorting
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return (a.effectiveAt || a.createdAt || '').localeCompare(b.effectiveAt || b.createdAt || '');
        case 'date_desc': return (b.effectiveAt || b.createdAt || '').localeCompare(a.effectiveAt || a.createdAt || '');
        case 'number_asc': return a.entryNumber.localeCompare(b.entryNumber);
        case 'number_desc': return b.entryNumber.localeCompare(a.entryNumber);
        case 'amount_asc': return Number(a.amountOriginal) - Number(b.amountOriginal);
        case 'amount_desc': return Number(b.amountOriginal) - Number(a.amountOriginal);
        case 'status': return (statusLabel[a.postingStatus] || '').localeCompare(statusLabel[b.postingStatus] || '');
        default: return (b.effectiveAt || b.createdAt || '').localeCompare(a.effectiveAt || a.createdAt || '');
      }
    });
    return list;
  }, [baseEntries, search, filterStatus, filterPayMethod, filterCurrency, filterModuleId, filterTypeId, filterDateFrom, filterDateTo, filterAmtMin, filterAmtMax, sortBy, typeById, moduleById]);

  // ── الإحصائيات ── Statistics
  const stats = useMemo(() => {
    const postedList = baseEntries.filter((e) => e.postingStatus === 'posted');
    const draftList = baseEntries.filter((e) => e.postingStatus === 'draft');
    const voidedList = baseEntries.filter((e) => e.postingStatus === 'voided');
    const totalAmount = postedList.reduce((s, e) => s + Number(e.amountOriginal), 0);
    return { total: baseEntries.length, posted: postedList.length, draft: draftList.length, voided: voidedList.length, totalAmount };
  }, [baseEntries]);

  // ── بناء بيانات التصدير ── Export Data Builder
  const buildExportRows = () => visibleEntries.map((e) => [
    e.entryNumber,
    typeById.get(e.entryTypeId)?.nameAr || '—',
    e.entryCategory,
    statusLabel[e.postingStatus] || e.postingStatus,
    String(Number(e.amountOriginal)),
    currencyById.get(e.currencyOriginalNo) || '—',
    paymentMethodLabel[e.paymentMethod || ''] || e.paymentMethod || '—',
    e.description || '',
    e.effectiveAt ? new Date(e.effectiveAt).toLocaleDateString('ar-EG') : '',
  ]);
  const exportHeaders = ['رقم القيد', 'النوع', 'الفئة', 'الحالة', 'المبلغ', 'العملة', 'طريقة الدفع', 'البيان', 'التاريخ'];

  const exportCsv = () => {
    const rows = buildExportRows();
    const blob = new Blob([[rowToCsv(exportHeaders), ...rows.map(rowToCsv)].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${title}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const exportXlsFile = () => exportXls(`${title}-${new Date().toISOString().slice(0, 10)}.xls`, exportHeaders, buildExportRows());
  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = buildExportRows();
    const tableHtml = `
      <html dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;font-size:11px;direction:rtl}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 8px;text-align:right}
      th{background:#f0f0f0;font-weight:bold}h2{margin-bottom:8px}</style></head>
      <body><h2>${title}</h2><p>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
      <table><tr>${exportHeaders.map((h) => `<th>${h}</th>`).join('')}</tr>
      ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
      </table></body></html>`;
    w.document.write(tableHtml);
    w.document.close();
    w.print();
  };

  // ── فتح نموذج التعديل ── Open Edit Form
  const openEdit = (entry: FinanceEntryRow) => {
    const draftLines = transactions
      .filter((l) => l.entryId === entry.id)
      .map((l) => ({
        id: l.id, accountId: l.accountId, transType: l.transType,
        amountOriginal: String(l.amountOriginal), lineDescription: l.lineDescription || l.description || '',
      }));
    if (draftLines.length < 2) { setError('لا يمكن تعديل قيد بلا ساقين محاسبيتين مكتملتين.'); return; }
    setEditingEntry({
      id: entry.id, entryNumber: entry.entryNumber, moduleId: entry.moduleId,
      entryTypeId: entry.entryTypeId, currencyOriginalNo: entry.currencyOriginalNo,
      description: entry.description, paymentMethod: entry.paymentMethod as any,
      paymentDetails: paymentDetails.filter((d) => d.entryId === entry.id).map((d) => ({
        id: d.id, paymentMethod: d.paymentMethod as any, accountId: d.accountId,
        amountOriginal: String(d.amountOriginal), bankReference: d.bankReference || '',
        dueAt: d.dueAt ? new Date(d.dueAt).toISOString().slice(0, 16) : '', note: d.note || '',
      })),
      lines: draftLines,
    });
    setShowModal(true);
  };

  const openNew = () => { setSelectedVoucherSubKind('cash'); setEditingEntry(null); setShowModal(true); };
  const openNewVoucher = (sub: 'cash' | 'bank' | 'multi') => { setSelectedVoucherSubKind(sub); setEditingEntry(null); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingEntry(null); };

  // ── ترحيل القيد ── Post Entry
  const postEntry = async (entryId: string) => {
    if (!canPost) return;
    try { setBusyId(entryId); setError(''); await financialEntryService.post(entryId, createdByUid); onChanged(); }
    catch (cause: any) { setError(cause?.message || 'تعذر اعتماد القيد.'); }
    finally { setBusyId(''); }
  };

  // ── حذف القيد (مسودة أو مرحّل) ── Delete Entry
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true); setError('');
      if (deleteTarget.postingStatus === 'posted') {
        await financialEntryService.deletePosted(deleteTarget.id, createdByUid);
      } else {
        await financialEntryService.deleteDraft(deleteTarget.id);
      }
      onChanged();
    } catch (cause: any) { setError(cause?.message || 'تعذر حذف القيد.'); }
    finally { setDeleteLoading(false); setDeleteTarget(null); }
  };

  // ── إبطال أو عكس ── Void / Reverse
  const runSensitiveAction = async (entry: FinanceEntryRow, action: 'void' | 'reverse') => {
    const prompts = {
      void: `سيُبطل القيد ${entry.entryNumber} ولن يمكن إعادة تفعيله. هل تريد المتابعة؟`,
      reverse: `سيُنشأ قيد عكسي مرحّل للقيد ${entry.entryNumber}. هل تريد المتابعة؟`,
    };
    if (!window.confirm(prompts[action])) return;
    try {
      setBusyId(entry.id); setError('');
      if (action === 'void') await financialEntryService.voidDraft(entry.id, createdByUid);
      if (action === 'reverse') {
        const num = window.prompt('رقم القيد العكسي', `REV-${entry.entryNumber}`)?.trim();
        if (!num) return;
        await financialEntryService.reverse(entry.id, num, createdByUid);
      }
      onChanged();
    } catch (cause: any) { setError(cause?.message || 'تعذر تنفيذ الإجراء.'); }
    finally { setBusyId(''); }
  };

  // ── تجميع أسطر التفاصيل ── Build Details Lines
  const buildDetailLines = (entryId: string): EntryTransactionLine[] =>
    transactions.filter((l) => l.entryId === entryId).map((l) => ({
      id: l.id, entryId: l.entryId, lineNo: l.lineNo ?? 0,
      transType: l.transType, accountId: l.accountId,
      accountCurNo: l.accountCurNo ?? 0, amount: l.amount ?? 0,
      amountOriginal: l.amountOriginal, currencyOriginalNo: l.currencyOriginalNo ?? 0,
      paymentMethod: l.paymentMethod, description: l.description || l.lineDescription,
      orderId: l.orderId, shipmentId: l.shipmentId,
    }));

  // ── إذا لم تكن هناك صلاحية عرض ──
  if (!canView) return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center text-sm font-bold text-slate-400">
      لا تملك صلاحية استعراض هذا التبويب.
    </div>
  );

  // ── عنوان نافذة الإنشاء/التعديل ──
  const modalTitle = editingEntry
    ? `تعديل: ${editingEntry.entryNumber}`
    : isVoucherMode
      ? (voucherType === 'payment'
        ? (selectedVoucherSubKind === 'cash' ? 'سند صرف نقدي جديد' : selectedVoucherSubKind === 'bank' ? 'سند صرف بنكي جديد' : 'سند صرف متعدد جديد')
        : (selectedVoucherSubKind === 'cash' ? 'سند قبض نقدي جديد' : selectedVoucherSubKind === 'bank' ? 'سند قبض بنكي جديد' : 'سند قبض متعدد جديد'))
      : buttonLabel || 'قيد جديد';

  return (
    <section className="space-y-4" dir="rtl">

      {/* ────────────────────────────────────────────
          رأس التبويب المدمج مع شريط الإحصائيات المصغر
          Compact Tab Header with Inline Mini Statistics
          ──────────────────────────────────────────── */}
      <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* الجانب الأيمن: العنوان + شريط الإحصائيات المصغر المدمج */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-base font-black text-white leading-none">{title}</h2>
              <p className="mt-1 text-[11px] text-slate-400">{description}</p>
            </div>

            {/* شريط الإحصائيات المصغر الأنيق بجانب الاسم — Compact Inline Stats */}
            <div className="flex items-center flex-wrap gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-bold">
              <span className="flex items-center gap-1 text-slate-300">
                <Hash className="h-3 w-3 text-slate-400" />
                <span>الكل:</span>
                <span className="font-mono font-black text-white">{stats.total}</span>
              </span>

              <span className="text-slate-700">|</span>

              <span className="flex items-center gap-1 text-emerald-300">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>مرحّل:</span>
                <span className="font-mono font-black">{stats.posted}</span>
              </span>

              {stats.draft > 0 && (
                <>
                  <span className="text-slate-700">|</span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <RefreshCw className="h-3 w-3 text-amber-400" />
                    <span>مؤقت:</span>
                    <span className="font-mono font-black">{stats.draft}</span>
                  </span>
                </>
              )}

              {stats.voided > 0 && (
                <>
                  <span className="text-slate-700">|</span>
                  <span className="flex items-center gap-1 text-rose-300">
                    <XCircle className="h-3 w-3 text-rose-400" />
                    <span>مبطل:</span>
                    <span className="font-mono font-black">{stats.voided}</span>
                  </span>
                </>
              )}

              <span className="text-slate-700">|</span>

              <span className="flex items-center gap-1 text-[#f4d870]">
                <TrendingUp className="h-3 w-3 text-[#f4d870]" />
                <span>المبلغ:</span>
                <span className="font-mono font-black">
                  {stats.totalAmount.toLocaleString()}
                </span>
              </span>
            </div>
          </div>

          {/* الجانب الأيسر: أزرار التصدير والطباعة والإنشاء */}
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <>
                <button onClick={exportCsv} className="inline-flex items-center gap-1 rounded-xl border border-cyan-500/30 px-2.5 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/10 transition" title="تصدير CSV">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button onClick={exportXlsFile} className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/30 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10 transition" title="تصدير XLS">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> XLS
                </button>
              </>
            )}
            {canPrint && (
              <button onClick={printPdf} className="inline-flex items-center gap-1 rounded-xl border border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 transition" title="طباعة PDF">
                <Printer className="h-3.5 w-3.5" /> طباعة
              </button>
            )}

            {canCreate && (
              isVoucherMode ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {voucherType === 'payment' ? (
                    <>
                      <button onClick={() => openNewVoucher('cash')} className="inline-flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950 shadow-md transition">
                        <Wallet className="h-3.5 w-3.5" /> صرف نقدي
                      </button>
                      <button onClick={() => openNewVoucher('bank')} className="inline-flex items-center gap-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-black text-white shadow-md transition">
                        <Building className="h-3.5 w-3.5" /> صرف بنكي
                      </button>
                      <button onClick={() => openNewVoucher('multi')} className="inline-flex items-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-black text-white shadow-md transition">
                        <CreditCard className="h-3.5 w-3.5" /> صرف متعدد
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openNewVoucher('cash')} className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-black text-slate-950 shadow-md transition">
                        <Wallet className="h-3.5 w-3.5" /> قبض نقدي
                      </button>
                      <button onClick={() => openNewVoucher('bank')} className="inline-flex items-center gap-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-black text-white shadow-md transition">
                        <Building className="h-3.5 w-3.5" /> قبض بنكي
                      </button>
                      <button onClick={() => openNewVoucher('multi')} className="inline-flex items-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-black text-white shadow-md transition">
                        <CreditCard className="h-3.5 w-3.5" /> قبض متعدد
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-[#d4af37] hover:bg-[#f4d870] px-3.5 py-1.5 text-xs font-black text-slate-950 shadow-lg transition">
                  <FilePlus2 className="h-3.5 w-3.5" /> {buttonLabel || 'قيد جديد'}
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────
          شريط البحث والفلاتر — Search & Filters Bar
          ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* بحث نصي — Text Search */}
          <label className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم القيد أو البيان أو النوع…"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pr-10 pl-3 text-sm text-white placeholder:text-slate-500 focus:border-[#d4af37]/50 focus:outline-none"
            />
          </label>
          {/* فرز — Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white focus:outline-none">
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* زر تبديل الفلاتر — Toggle Filters */}
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${showFilters ? 'border-[#d4af37]/40 bg-[#d4af37]/10 text-[#f4d870]' : 'border-slate-700 text-slate-400 hover:text-white'}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> الفلاتر
            {(filterStatus || filterPayMethod || filterCurrency || filterModuleId || filterTypeId || filterDateFrom || filterDateTo || filterAmtMin || filterAmtMax) && (
              <span className="rounded-full bg-[#d4af37] text-slate-950 text-[9px] font-black px-1.5 py-0.5">●</span>
            )}
          </button>
          {/* مسح الفلاتر — Clear Filters */}
          {(search || filterStatus || filterPayMethod || filterCurrency || filterModuleId || filterTypeId || filterDateFrom || filterDateTo || filterAmtMin || filterAmtMax) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterPayMethod(''); setFilterCurrency(''); setFilterModuleId(''); setFilterTypeId(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterAmtMin(''); setFilterAmtMax(''); }}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10 transition"
            >
              <X className="h-3.5 w-3.5" /> مسح
            </button>
          )}
        </div>

        {/* لوحة الفلاتر الموسعة — Advanced Filters Panel */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
            {/* الحالة — Status */}
            <FilterSelect label="الحالة" value={filterStatus} onChange={setFilterStatus} options={statusFilterOptions} />
            {/* طريقة الدفع — Payment Method */}
            <FilterSelect label="طريقة الدفع" value={filterPayMethod} onChange={setFilterPayMethod} options={[
              { value: '', label: 'كل الطرق' },
              { value: 'cash', label: 'نقدًا' },
              { value: 'bank', label: 'بنك' },
              { value: 'deferred', label: 'آجل' },
              { value: 'mixed', label: 'مختلط' },
            ]} />
            {/* العملة — Currency */}
            <FilterSelect label="العملة" value={filterCurrency} onChange={setFilterCurrency} options={[
              { value: '', label: 'كل العملات' },
              ...currencies.map((c) => ({ value: String(c.id), label: c.code })),
            ]} />
            {/* الوحدة — Module */}
            <FilterSelect label="الوحدة (Module)" value={filterModuleId} onChange={setFilterModuleId} options={[
              { value: '', label: 'كل الوحدات' },
              ...formModules.map((m) => ({ value: m.id, label: m.nameAr })),
            ]} />
            {/* النوع — Type */}
            <FilterSelect label="النوع (Type)" value={filterTypeId} onChange={setFilterTypeId} options={[
              { value: '', label: 'كل الأنواع' },
              ...formTypes.map((t) => ({ value: t.id, label: t.nameAr })),
            ]} />
            {/* التاريخ من — Date From */}
            <div>
              <div className="mb-1 text-[10px] font-bold text-slate-500">من تاريخ</div>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:outline-none" />
            </div>
            {/* التاريخ إلى — Date To */}
            <div>
              <div className="mb-1 text-[10px] font-bold text-slate-500">إلى تاريخ</div>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:outline-none" />
            </div>
            {/* نطاق المبلغ — Amount Range */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <div className="mb-1 text-[10px] font-bold text-slate-500">المبلغ (من)</div>
                <input type="number" value={filterAmtMin} onChange={(e) => setFilterAmtMin(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:outline-none" />
              </div>
              <div className="flex-1">
                <div className="mb-1 text-[10px] font-bold text-slate-500">المبلغ (إلى)</div>
                <input type="number" value={filterAmtMax} onChange={(e) => setFilterAmtMax(e.target.value)} placeholder="∞" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:outline-none" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* رسالة الخطأ — Error Message */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="rounded-lg p-1 hover:bg-rose-500/20"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ────────────────────────────────────────────
          شريط الإجراءات الجماعية — Batch Actions Bar
          ──────────────────────────────────────────── */}
      {selectedEntryIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          <div className="flex items-center gap-2 font-bold text-xs">
            <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-slate-950 font-black">
              {selectedEntryIds.length}
            </span>
            <span>قيود/سندات محددة</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canPost && (
              <button
                disabled={isBatchProcessing}
                onClick={handleBatchPost}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-black text-slate-950 transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> ترحيل المحدد
              </button>
            )}
            {(canDelete || canDeletePosted) && (
              <button
                disabled={isBatchProcessing}
                onClick={handleBatchDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-black text-white transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> حذف المحدد
              </button>
            )}
            <button
              onClick={() => setSelectedEntryIds([])}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
            >
              <X className="h-3.5 w-3.5" /> إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────
          نتيجة الفلترة — Filter Result Count
          ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500">
          يعرض <span className="font-bold text-slate-300">{visibleEntries.length}</span> من{' '}
          <span className="font-bold text-slate-300">{baseEntries.length}</span> سجل
        </span>
      </div>

      {/* ────────────────────────────────────────────
          جدول القيود — Entries Table
          ──────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
        <table className="min-w-[900px] w-full text-right text-xs">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-3 py-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={visibleEntries.length > 0 && selectedEntryIds.length === visibleEntries.length}
                  onChange={handleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-[#d4af37] focus:ring-0"
                />
              </th>
              <th className="px-4 py-3">رقم القيد</th>
              <th className="px-4 py-3">البيان</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">المبلغ</th>
              <th className="px-4 py-3">طريقة الدفع</th>
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visibleEntries.map((entry) => (
              <tr key={entry.id} className={`hover:bg-slate-900/40 transition text-slate-200 ${selectedEntryIds.includes(entry.id) ? 'bg-amber-500/5' : ''}`}>
                <td className="px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedEntryIds.includes(entry.id)}
                    onChange={() => handleToggleSelect(entry.id)}
                    className="rounded border-slate-700 bg-slate-900 text-[#d4af37] focus:ring-0"
                  />
                </td>
                {/* رقم القيد — Entry Number */}
                <td className="px-4 py-3 font-mono font-black text-[#f4d870] whitespace-nowrap">
                  {entry.entryNumber}
                </td>
                {/* البيان — Description */}
                <td className="max-w-64 px-4 py-3 truncate" title={entry.description}>
                  {entry.description || '—'}
                </td>
                {/* النوع — Type */}
                <td className="px-4 py-3 text-slate-300">{typeById.get(entry.entryTypeId)?.nameAr || '—'}</td>
                {/* المبلغ — Amount */}
                <td className="px-4 py-3 font-mono font-black text-white whitespace-nowrap">
                  {Number(entry.amountOriginal).toLocaleString()}
                  <span className="mr-1 text-slate-500 text-[10px]">{" " + currencyById.get(entry.currencyOriginalNo)}</span>
                </td>
                {/* طريقة الدفع — Payment Method */}
                <td className="px-4 py-3 text-slate-400">{paymentMethodLabel[entry.paymentMethod || ''] || '—'}</td>
                {/* التاريخ — Date */}
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                  {entry.effectiveAt ? new Date(entry.effectiveAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                </td>
                {/* الحالة — Status */}
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusStyle[entry.postingStatus] || statusStyle.draft}`}>
                    {statusLabel[entry.postingStatus] || entry.postingStatus}
                  </span>
                </td>
                {/* الإجراءات — Actions */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {/* زر التفاصيل — Details Button */}
                    <button
                      onClick={() => setDetailsEntry(entry)}
                      className="rounded-lg border border-slate-600 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      title="تفاصيل القيد"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>

                    {/* زر التعديل للمسودة — Edit Draft Button */}
                    {entry.postingStatus === 'draft' && canEdit && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => openEdit(entry)}
                        className="rounded-lg border border-sky-500/30 p-1.5 text-sky-200 hover:bg-sky-500/10 transition"
                        title="تعديل المسودة"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* زر تعديل المرحّل — Edit Posted Button (special permission) */}
                    {entry.postingStatus === 'posted' && canEditPosted && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => openEdit(entry)}
                        className="rounded-lg border border-violet-500/30 p-1.5 text-violet-200 hover:bg-violet-500/10 transition"
                        title="تعديل القيد المرحّل (صلاحية خاصة)"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* زر الترحيل للمسودة — Post Draft Button */}
                    {entry.postingStatus === 'draft' && canPost && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => postEntry(entry.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/10 transition"
                        title="ترحيل القيد"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        ترحيل
                      </button>
                    )}

                    {/* زر الإبطال للمسودة — Void Draft Button */}
                    {entry.postingStatus === 'draft' && canVoid && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => void runSensitiveAction(entry, 'void')}
                        className="rounded-lg border border-rose-500/30 p-1.5 text-rose-200 hover:bg-rose-500/10 transition"
                        title="إبطال المسودة"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* زر حذف المسودة — Delete Draft Button */}
                    {entry.postingStatus === 'draft' && canDelete && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => setDeleteTarget(entry)}
                        className="rounded-lg border border-rose-500/30 p-1.5 text-rose-200 hover:bg-rose-500/10 transition"
                        title="حذف المسودة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* زر حذف المرحّل — Delete Posted Button (special permission) */}
                    {entry.postingStatus === 'posted' && canDeletePosted && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => setDeleteTarget(entry)}
                        className="rounded-lg border border-rose-600/40 p-1.5 text-rose-300 hover:bg-rose-600/15 transition"
                        title="حذف القيد المرحّل (صلاحية خاصة)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* زر عكس المرحّل — Reverse Posted Button */}
                    {entry.postingStatus === 'posted' && canReverse && (
                      <button
                        disabled={busyId === entry.id}
                        onClick={() => void runSensitiveAction(entry, 'reverse')}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 px-2 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-500/10 transition"
                        title="قيد عكسي"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        عكس
                      </button>
                    )}

                    {/* مبطل — Voided Indicator */}
                    {entry.postingStatus === 'voided' && (
                      <span title="مبطل"><ReceiptText className="h-4 w-4 text-slate-600" /></span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visibleEntries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  {baseEntries.length === 0 ? 'لا توجد سجلات ضمن هذا التبويب.' : 'لا توجد سجلات تطابق معايير البحث أو الفلترة.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ════════════════════════════════════════════
          نافذة إنشاء/تعديل القيد — Entry Form Modal
          ════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-[92vw] lg:max-w-[88vw] xl:max-w-[1380px] 2xl:max-w-[1480px] max-h-[92vh] mx-auto flex flex-col rounded-3xl border border-slate-700/90 bg-slate-950 shadow-2xl overflow-hidden ring-1 ring-slate-800" dir="rtl">
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
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 sm:p-5 md:p-6 flex-1">
              {isVoucherMode ? (
                <VoucherEntryForm
                  voucherType={voucherType || 'receipt'} voucherSubKind={selectedVoucherSubKind}
                  accounts={accounts} currencies={currencies} modules={formModules} entryTypes={formTypes}
                  canCreate={editingEntry ? canEdit : canCreate} canPost={canPost}
                  createdByUid={createdByUid} initialModuleCode={initialModuleCode}
                  initialTypeCode={initialTypeCode} editingEntry={editingEntry || undefined}
                  onCancel={closeModal} onSaved={() => { closeModal(); onChanged(); }}
                />
              ) : category === 'Compound' ? (
                <CompoundEntryForm
                  accounts={accounts} currencies={currencies} modules={formModules} entryTypes={formTypes}
                  canCreate={editingEntry ? canEdit : canCreate} canPost={canPost}
                  createdByUid={createdByUid} initialModuleCode={initialModuleCode}
                  initialTypeCode={initialTypeCode} editingEntry={editingEntry || undefined}
                  onCancel={closeModal} onSaved={() => { closeModal(); onChanged(); }}
                />
              ) : (
                <GeneralEntryForm
                  category={category} accounts={accounts} currencies={currencies}
                  modules={formModules} entryTypes={formTypes}
                  canCreate={editingEntry ? canEdit : canCreate} canPost={canPost}
                  createdByUid={createdByUid} initialModuleCode={initialModuleCode}
                  initialTypeCode={initialTypeCode} editingEntry={editingEntry || undefined}
                  onCancel={closeModal} onSaved={() => { closeModal(); onChanged(); }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          نافذة التفاصيل — Details Modal
          ════════════════════════════════════════════ */}
      {detailsEntry && (
        <EntryDetailsModal
          entry={detailsEntry}
          lines={buildDetailLines(detailsEntry.id)}
          accounts={accounts}
          currencies={currencies}
          modules={modules}
          entryTypes={entryTypes}
          onClose={() => setDetailsEntry(null)}
        />
      )}

      {/* ════════════════════════════════════════════
          نافذة تأكيد الحذف — Delete Confirm Modal
          ════════════════════════════════════════════ */}
      {deleteTarget && (
        <EntryDeleteConfirmModal
          entry={deleteTarget}
          isPosted={deleteTarget.postingStatus === 'posted'}
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// مكوّنات مساعدة — Helper Components
// ─────────────────────────────────────────────

/** بطاقة الإحصاء — Stat Card */
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <div>
        <div className={`text-base font-black ${color}`}>{value.toLocaleString()}</div>
        <div className="text-[10px] font-bold text-slate-500">{label}</div>
      </div>
    </div>
  );
}

/** عنصر قائمة منسدلة لفلتر — Filter Select */
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold text-slate-500">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#d4af37]/50">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
