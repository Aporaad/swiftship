import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, Download, Edit3, FileSpreadsheet, FileText, FolderPlus, Layers3, Loader2, Maximize2, Minimize2, Plus, Printer, Search, Settings2, Trash2, Upload, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { addDoc, collection, db, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from '../lib/supabase-firebase-adapter';
import { accountingHierarchyService, hierarchyCodeRules, type HierarchyCodeKind } from '../services/accountingHierarchyService';
import { useAccountBalances } from '../hooks/useAccountBalances';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { calculateAccountingTreeBalances, getRecordCurrencyCode, type TreeNodeBalance } from '../services/accountingTreeBalanceService';
import { buildImportedTreePayload, createKnownTreeNodes, validateAccountingTreeImport, type AccountingImportLevel } from '../services/accountingTreeFileService';
import { printContent as basePrintContent } from '../lib/printUtils';
import * as XLSX from 'xlsx';

type EditorKind = 'account' | 'main' | 'sub' | 'group' | 'ledger' | 'default';

interface Props {
  isAr: boolean;
  canEdit: boolean;
}

const NATURES = [
  { value: 'Asset', ar: 'أصل / مدين', en: 'Asset / Debit' },
  { value: 'Liability', ar: 'التزام / دائن', en: 'Liability / Credit' },
  { value: 'Equity', ar: 'حقوق ملكية / دائن', en: 'Equity / Credit' },
  { value: 'Revenue', ar: 'إيراد / دائن', en: 'Revenue / Credit' },
  { value: 'Expense', ar: 'مصروف / مدين', en: 'Expense / Debit' },
];

const ENTITY_TYPES = [
  { value: '', ar: 'بدون ربط تلقائي', en: 'No automatic binding' },
  { value: 'customer', ar: 'العملاء', en: 'Customers' },
  { value: 'employee', ar: 'الموظفون', en: 'Employees' },
  { value: 'courier', ar: 'المناديب', en: 'Couriers' },
  { value: 'source', ar: 'مصادر الطلبات', en: 'Order sources' },
  { value: 'shipping_company', ar: 'شركات الشحن', en: 'Shipping companies' },
  { value: 'asset', ar: 'الأصول الثابتة', en: 'Fixed assets' },
  { value: 'system', ar: 'حسابات النظام', en: 'System accounts' },
];

const DEFAULT_KEYS = [
  'sys_cash_account', 'sys_orders_cost', 'sys_profit_account', 'sys_delivery_cost',
  'sys_sourcing_cost', 'sys_packaging_fees', 'sys_shipping_costs', 'sys_local_shipping',
];

const TYPE_PRESENTATION: Record<string, { labelAr: string; labelEn: string; icon: string; row: string; badge: string; accent: string }> = {
  Asset: { labelAr: 'أصول', labelEn: 'Assets', icon: 'أ', row: 'border-sky-500/20 bg-sky-500/[0.06] hover:bg-sky-500/[0.12]', badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300', accent: 'text-sky-300' },
  Liability: { labelAr: 'خصوم', labelEn: 'Liabilities', icon: 'خ', row: 'border-amber-500/20 bg-amber-500/[0.06] hover:bg-amber-500/[0.12]', badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300', accent: 'text-amber-300' },
  Equity: { labelAr: 'حقوق ملكية', labelEn: 'Equity', icon: 'م', row: 'border-violet-500/20 bg-violet-500/[0.06] hover:bg-violet-500/[0.12]', badge: 'border-violet-400/30 bg-violet-400/10 text-violet-300', accent: 'text-violet-300' },
  Revenue: { labelAr: 'إيرادات', labelEn: 'Revenue', icon: 'إ', row: 'border-emerald-500/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', accent: 'text-emerald-300' },
  Expense: { labelAr: 'مصروفات', labelEn: 'Expenses', icon: 'ص', row: 'border-rose-500/20 bg-rose-500/[0.06] hover:bg-rose-500/[0.12]', badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300', accent: 'text-rose-300' },
};
const defaultTypePresentation = TYPE_PRESENTATION.Asset;

const read = (record: any, camel: string, snake: string) => record?.[camel] ?? record?.[snake];
const recordName = (record: any, isAr: boolean) => String(read(record, isAr ? 'accNameAr' : 'accNameEn', isAr ? 'acc_name_ar' : 'acc_name_en') || record?.entityName || record?.accountCode || record?.id || '—');
const recordCode = (record: any) => String(read(record, 'accountCode', 'account_code') || record?.code || record?.id || '').trim();
const isActive = (record: any) => record?.isActive !== false && record?.is_active !== false;

export default function AccountingHierarchyManagement({ isAr, canEdit }: Props) {
  const [activeTab, setActiveTab] = useState<'tree' | 'defaults'>('tree');
  const [roots, setRoots] = useState<any[]>([]);
  const [mains, setMains] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [defaultAccounts, setDefaultAccounts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [defaultSearch, setDefaultSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editorKind, setEditorKind] = useState<EditorKind | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [isUnifiedAccountCreate, setIsUnifiedAccountCreate] = useState(false);
  const [deleting, setDeleting] = useState<{ table: string; item: any } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<any>({});
  const [statementAccount, setStatementAccount] = useState<any | null>(null);
  const [statementTransactions, setStatementTransactions] = useState<any[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<{ rows: any[]; errors: string[]; warnings: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [printSections, setPrintSections] = useState<Record<string, boolean>>({});
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const liveBalances = useAccountBalances();
  const { currencies: exchangeCurrencies, loading: exchangeRatesLoading } = useExchangeRates();
  useEffect(() => {
    const subscribe = (table: string, setItems: (items: any[]) => void) => onSnapshot(collection(db, table), (snapshot: any) => {
      setItems(snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() })));
    }, (listenerError: any) => setError(listenerError?.message || (isAr ? 'تعذر تحميل بيانات الحسابات.' : 'Unable to load accounting data.')));
    const sources: Array<[string, (items: any[]) => void]> = [
      ['account', setRoots], ['acc_main', setMains], ['acc_sub', setSubs], ['acc_sub_group', setGroups],
      ['accounts', setAccounts], ['default_accounts', setDefaultAccounts], ['currency', setCurrencies],
    ];
    const unsubs = sources.map(([table, setItems]) => subscribe(table, setItems));
    return () => { unsubs.forEach((unsubscribe) => unsubscribe()); };
  }, [isAr]);

  const dataLoadState: string = 'ready';
  const activeCurrencies = useMemo(() => currencies.filter(isActive), [currencies]);
  const postingAccounts = useMemo(() => accountingHierarchyService.filterPostingAccounts(accounts, true), [accounts]);
  const defaultCurrencyId = activeCurrencies.find((currency) => currency.isDefault || currency.is_default)?.cur_id || activeCurrencies[0]?.cur_id || '';
  const defaultCurrencyCode = useMemo(() => String(exchangeCurrencies.find((currency) => currency.isDefault)?.code || activeCurrencies.find((currency) => currency.isDefault || currency.is_default)?.code || '').toUpperCase(), [activeCurrencies, exchangeCurrencies]);
  const currencyCode = (record: any) => getRecordCurrencyCode(record, exchangeCurrencies.length ? exchangeCurrencies : activeCurrencies, defaultCurrencyCode) || '—';
  const formatMoney = (value: unknown) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const treeBalances = useMemo(() => calculateAccountingTreeBalances({
    roots, mains, subs, groups, accounts: postingAccounts, currencies: exchangeCurrencies,
    liveBalances: { byId: liveBalances.byId, byCode: liveBalances.byCode },
  }), [roots, mains, subs, groups, postingAccounts, exchangeCurrencies, liveBalances.byId, liveBalances.byCode]);
  const formatBalance = (value: number | null | undefined) => value === null || value === undefined ? '—' : formatMoney(value);
  const balanceFor = (level: AccountingImportLevel, id: string): TreeNodeBalance | undefined => {
    if (level === 'account') return treeBalances.rootBalances[id];
    if (level === 'main') return treeBalances.mainBalances[id];
    if (level === 'sub') return treeBalances.subBalances[id];
    if (level === 'group') return treeBalances.groupBalances[id];
    return treeBalances.ledgerBalances[id];
  };
  const balanceSummary = (balance: TreeNodeBalance | undefined) => {
    if (!balance) return <span className="font-mono text-xs text-slate-500">—</span>;
    const isSystemCurrency = balance.currency === treeBalances.defaultCurrency;
    return <div className="text-end">
      <div className="font-mono text-xs font-black text-slate-100">{formatBalance(balance.nativeBalance)} <span className="text-[10px] text-slate-400">{balance.currency || '—'}</span></div>
      {!isSystemCurrency && <div className={`mt-0.5 font-mono text-[10px] ${balance.systemBalance === null ? 'text-amber-300' : 'text-emerald-300'}`}>{balance.systemBalance === null ? (isAr ? 'سعر الصرف غير متاح' : 'Exchange rate unavailable') : `${formatMoney(balance.systemBalance)} ${treeBalances.defaultCurrency}`}</div>}
      {balance.includesConvertedChildren && <div className="mt-0.5 text-[9px] text-slate-500"></div>}
    </div>;
  };
  const exportRows = useMemo(() => {
    const makeRow = (level: AccountingImportLevel, item: any, parentId: string | null, type?: string) => {
      const balance = balanceFor(level, String(item.id));
      return {
        level,
        id: String(item.id),
        accountCode: recordCode(item),
        accNameAr: read(item, 'accNameAr', 'acc_name_ar') || '',
        accNameEn: read(item, 'accNameEn', 'acc_name_en') || '',
        parentId: parentId || '',
        accountType: type || read(item, 'accountType', 'account_type') || item.type || '',
        currency: currencyCode(item),
        curNo: read(item, 'curNo', 'cur_no') || '',
        isActive: isActive(item),
        entityType: read(item, 'entityType', 'entity_type') || '',
        entityId: read(item, 'entityId', 'entity_id') || '',
        limitedBalance: read(item, 'limitedBalance', 'limited_balance') || 0,
        nativeBalance: balance?.nativeBalance ?? '',
        nativeBalanceCurrency: balance?.currency || '',
        systemBalance: balance?.systemBalance ?? '',
        systemCurrency: treeBalances.defaultCurrency,
        accountSeq: read(item, 'accountSeq', 'account_seq') || '',
        memberCount: balance?.memberCount ?? 0,
      };
    };
    return [
      ...roots.map((root) => makeRow('account', root, null, read(root, 'accountType', 'account_type'))),
      ...mains.map((main) => makeRow('main', main, read(main, 'accountId', 'account_id'))),
      ...subs.map((sub) => makeRow('sub', sub, read(sub, 'accMainId', 'acc_main_id'))),
      ...groups.map((group) => makeRow('group', group, read(group, 'accSubId', 'acc_sub_id'))),
      ...postingAccounts.map((account) => makeRow('ledger', account, read(account, 'groupId', 'group_id') || read(account, 'accSubId', 'acc_sub_id'), account.type || account.accountType)),
    ];
  }, [roots, mains, subs, groups, postingAccounts, treeBalances]);
  const printableRows = useMemo(() => {
    const selectedRoots = new Set(roots.filter((root) => printSections[String(root.id)] !== false).map((root) => String(root.id)));
    const rootByMain = new Map(mains.map((main) => [String(main.id), String(read(main, 'accountId', 'account_id'))]));
    const rootBySub = new Map(subs.map((sub) => [String(sub.id), rootByMain.get(String(read(sub, 'accMainId', 'acc_main_id'))) || '']));
    const rootByGroup = new Map(groups.map((group) => [String(group.id), rootBySub.get(String(read(group, 'accSubId', 'acc_sub_id'))) || '']));
    const rootByLedger = new Map(postingAccounts.map((account) => [String(account.id), rootBySub.get(String(read(account, 'accSubId', 'acc_sub_id'))) || '']));
    return exportRows.filter((row) => {
      const rootId = row.level === 'account' ? row.id
        : row.level === 'main' ? rootByMain.get(row.id)
          : row.level === 'sub' ? rootBySub.get(row.id)
            : row.level === 'group' ? rootByGroup.get(row.id)
              : rootByLedger.get(row.id);
      return Boolean(rootId && selectedRoots.has(rootId));
    });
  }, [roots, mains, subs, groups, postingAccounts, exportRows, printSections]);
  const downloadBlob = (body: BlobPart, fileName: string, contentType: string) => {
    const url = URL.createObjectURL(new Blob([body], { type: contentType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const exportTree = (format: 'csv' | 'xlsx') => {
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    if (format === 'csv') {
      downloadBlob(`\uFEFF${XLSX.utils.sheet_to_csv(sheet)}`, 'accounting-tree.csv', 'text/csv;charset=utf-8');
    } else {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, isAr ? 'شجرة الحسابات' : 'Chart of Accounts');
      XLSX.writeFile(workbook, 'accounting-tree.xls', { bookType: 'biff8' });
    }
  };
  const printTree = () => {
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
    const toneByType: Record<string, string> = { Asset: '#2563eb', Liability: '#d97706', Equity: '#7c3aed', Revenue: '#059669', Expense: '#e11d48' };
    const rows = printableRows.map((row) => {
      const tone = toneByType[String(row.accountType)] || '#475569';
      const nativeTone = Number(row.nativeBalance) < 0 ? '#dc2626' : '#047857';
      const systemTone = Number(row.systemBalance) < 0 ? '#dc2626' : '#0369a1';
      const status = row.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive');
      return `<tr><td><span style="display:inline-block;padding:3px 6px;border-radius:6px;background:${tone}18;color:${tone};font-weight:700">${escapeHtml(row.level)}</span></td><td class="font-mono" style="color:${tone};font-weight:700">${escapeHtml(row.accountCode)}</td><td style="font-weight:700">${escapeHtml(row.accNameAr)}</td><td>${escapeHtml(row.accNameEn)}</td><td class="font-mono">${escapeHtml(row.parentId)}</td><td><span style="color:${tone};font-weight:700">${escapeHtml(row.accountType)}</span></td><td><span style="color:${row.isActive ? '#047857' : '#64748b'};font-weight:700">${status}</span></td><td class="font-mono">${escapeHtml(row.entityType || '—')} ${escapeHtml(row.entityId || '')}</td><td class="font-mono" style="color:#b45309">${escapeHtml(row.currency)}</td><td class="font-mono" style="color:${nativeTone};font-weight:700">${escapeHtml(row.nativeBalance)} ${escapeHtml(row.nativeBalanceCurrency)}</td><td class="font-mono" style="color:${systemTone};font-weight:700">${escapeHtml(row.systemBalance)} ${escapeHtml(row.systemCurrency)}</td><td class="font-mono">${escapeHtml(row.limitedBalance)}</td><td class="font-mono">${escapeHtml(row.memberCount)}</td></tr>`;
    }).join('');
    basePrintContent(
      isAr ? 'شجرة الحسابات المالية' : 'Financial chart of accounts',
      `<div dir="${isAr ? 'rtl' : 'ltr'}"><div class="header"><h1>${isAr ? 'شجرة الحسابات المالية' : 'Financial Chart of Accounts'}</h1><p>${isAr ? `الأرصدة المجمعة بعملة النظام: ${treeBalances.defaultCurrency || '—'} · الأقسام المطبوعة: ${roots.filter((root) => printSections[String(root.id)] !== false).length}` : `Aggregated balances in the system currency: ${treeBalances.defaultCurrency || '—'} · printed sections: ${roots.filter((root) => printSections[String(root.id)] !== false).length}`}</p></div><table style="font-size:9px"><thead><tr><th>${isAr ? 'المستوى' : 'Level'}</th><th>${isAr ? 'الكود' : 'Code'}</th><th>${isAr ? 'الاسم العربي' : 'Arabic name'}</th><th>${isAr ? 'الاسم الإنجليزي' : 'English name'}</th><th>${isAr ? 'الأب' : 'Parent'}</th><th>${isAr ? 'النوع' : 'Type'}</th><th>${isAr ? 'الحالة' : 'Status'}</th><th>${isAr ? 'الكيان' : 'Entity'}</th><th>${isAr ? 'العملة' : 'Currency'}</th><th>${isAr ? 'الرصيد الأصلي' : 'Native balance'}</th><th>${isAr ? 'بعملة النظام' : 'System balance'}</th><th>${isAr ? 'سقف الرصيد' : 'Limit'}</th><th>${isAr ? 'عدد الحسابات' : 'Accounts'}</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      isAr,
    );
  };
  const printContent = (..._args: unknown[]) => printTree();
  const inspectImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
      const preview = validateAccountingTreeImport(rawRows, {
        currencies: activeCurrencies,
        existingNodes: createKnownTreeNodes({ roots, mains, subs, groups, accounts }),
      });
      if (!rawRows.length) preview.errors.push(isAr ? 'الملف لا يحتوي صفوفًا قابلة للاستيراد.' : 'The selected file has no importable rows.');
      setImportPreview(preview);
    } catch (fileError: any) {
      setError(fileError?.message || (isAr ? 'تعذر قراءة الملف. استخدم CSV أو XLS أو XLSX.' : 'Unable to read the file. Use CSV, XLS, or XLSX.'));
    }
  };
  const executeImport = async () => {
    if (!canEdit || !importPreview || importPreview.errors.length || !importPreview.rows.length) return;
    const created: Array<{ table: string; id: string }> = [];
    const nodes = new Map(createKnownTreeNodes({ roots, mains, subs, groups, accounts }).map((node) => [node.id, node]));
    const tableByLevel: Record<AccountingImportLevel, string> = { account: 'account', main: 'acc_main', sub: 'acc_sub', group: 'acc_sub_group', ledger: 'accounts' };
    try {
      setImporting(true);
      for (const row of importPreview.rows) {
        const table = tableByLevel[row.level];
        const payload = buildImportedTreePayload(row, nodes);
        await addDoc(row.id, collection(db, table), payload);
        created.push({ table, id: row.id });
        nodes.set(row.id, { id: row.id, level: row.level, parentId: row.parentId, accountType: row.accountType, accSubId: row.level === 'group' ? row.parentId || undefined : undefined });
      }
      setImportPreview(null);
    } catch (importError: any) {
      await Promise.all(created.reverse().map(async (createdRow) => {
        try { await deleteDoc(doc(db, createdRow.table, createdRow.id)); } catch (_) { /* preserving original error is more useful to the operator */ }
      }));
      setError(importError?.message || (isAr ? 'تعذر استيراد الشجرة؛ أُجري تراجع عن السجلات التي أضيفت أثناء المحاولة.' : 'The tree import failed; records added during this attempt were rolled back.'));
    } finally {
      setImporting(false);
    }
  };
  const rootsForSelectedNature = useMemo(() => roots.filter((root) => !form.accountType || read(root, 'accountType', 'account_type') === form.accountType), [roots, form.accountType]);
  const selectedRoot = roots.find((root) => root.id === form.accountId);
  const availableMains = mains.filter((main) => read(main, 'accountId', 'account_id') === form.accountId);
  const selectedMain = mains.find((main) => main.id === form.accMainId);
  const availableSubs = subs.filter((sub) => read(sub, 'accMainId', 'acc_main_id') === form.accMainId);
  const selectedSub = subs.find((sub) => sub.id === form.accSubId);
  const availableGroups = groups.filter((group) => read(group, 'accSubId', 'acc_sub_id') === form.accSubId);
  const selectedGroup = groups.find((group) => group.id === form.groupId);

  const matches = (item: any) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [recordCode(item), read(item, 'accNameAr', 'acc_name_ar'), read(item, 'accNameEn', 'acc_name_en'), item.entityName, item.entityId]
      .some((value) => String(value || '').toLowerCase().includes(term));
  };
  const toggle = (id: string) => setExpanded((previous) => ({ ...previous, [id]: !previous[id] }));
  const expandAll = () => setExpanded(Object.fromEntries([...roots, ...mains, ...subs, ...groups].map((item) => [item.id, true])));
  const collapseAll = () => setExpanded(Object.fromEntries([...roots, ...mains, ...subs, ...groups].map((item) => [item.id, false])));
  const openStatement = async (account: any) => {
    setStatementAccount(account);
    setStatementTransactions([]);
    setStatementLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'account_trans'), where('accountId', '==', account.id), orderBy('createdAt', 'desc')));
      setStatementTransactions(snapshot.docs.map((entry: any) => ({ id: entry.id, ...entry.data() })));
    } catch (statementError: any) {
      setError(statementError?.message || (isAr ? 'تعذر تحميل كشف الحساب.' : 'Unable to load the account statement.'));
    } finally {
      setStatementLoading(false);
    }
  };
  const tableFor = (kind: EditorKind) => kind === 'account' ? 'account' : kind === 'main' ? 'acc_main' : kind === 'sub' ? 'acc_sub' : kind === 'group' ? 'acc_sub_group' : kind === 'ledger' ? 'accounts' : 'default_accounts';
  const recordsFor = (kind: EditorKind) => kind === 'account' ? roots : kind === 'main' ? mains : kind === 'sub' ? subs : kind === 'group' ? groups : kind === 'ledger' ? accounts : defaultAccounts;

  const resolveParents = (item?: any, parent?: any) => {
    let accountId = read(item, 'accountId', 'account_id') || parent?.accountId || '';
    let accMainId = read(item, 'accMainId', 'acc_main_id') || parent?.accMainId || '';
    let accSubId = read(item, 'accSubId', 'acc_sub_id') || parent?.accSubId || '';
    let groupId = read(item, 'groupId', 'group_id') || parent?.groupId || '';
    if (groupId && !accSubId) accSubId = read(groups.find((group) => group.id === groupId), 'accSubId', 'acc_sub_id') || '';
    if (accSubId && !accMainId) accMainId = read(subs.find((sub) => sub.id === accSubId), 'accMainId', 'acc_main_id') || '';
    if (accMainId && !accountId) accountId = read(mains.find((main) => main.id === accMainId), 'accountId', 'account_id') || '';
    return { accountId, accMainId, accSubId, groupId };
  };

  const suggestCode = (kind: EditorKind, parent: any = {}) => {
    const parents = resolveParents(undefined, parent);
    if (kind === 'account') return hierarchyCodeRules.nextRootCode(roots);
    if (kind === 'main') return hierarchyCodeRules.nextChildCode(recordCode(roots.find((root) => root.id === parents.accountId)), mains.filter((main) => read(main, 'accountId', 'account_id') === parents.accountId));
    if (kind === 'sub') return hierarchyCodeRules.nextChildCode(recordCode(mains.find((main) => main.id === parents.accMainId)), subs.filter((sub) => read(sub, 'accMainId', 'acc_main_id') === parents.accMainId));
    if (kind === 'group') return hierarchyCodeRules.nextChildCode(recordCode(subs.find((sub) => sub.id === parents.accSubId)), groups.filter((group) => read(group, 'accSubId', 'acc_sub_id') === parents.accSubId));
    if (kind === 'ledger') {
      const prefix = hierarchyCodeRules.postingPrefix(recordCode(subs.find((sub) => sub.id === parents.accSubId)), recordCode(groups.find((group) => group.id === parents.groupId)) || undefined);
      const siblings = accounts.filter((account) => parents.groupId ? read(account, 'groupId', 'group_id') === parents.groupId : read(account, 'accSubId', 'acc_sub_id') === parents.accSubId && !read(account, 'groupId', 'group_id'));
      return hierarchyCodeRules.formatPostingCode(prefix, hierarchyCodeRules.nextPostingSequence(prefix, siblings));
    }
    return '';
  };

  const openEditor = (kind: EditorKind, item?: any, parent?: any, unifiedCreate = false) => {
    setError('');
    setEditing(item || null);
    setIsUnifiedAccountCreate((unifiedCreate || (kind === 'account' && !item && !parent)) && !item && kind !== 'default');
    setEditorKind(kind);
    const parents = resolveParents(item, parent);
    const root = roots.find((entry) => entry.id === parents.accountId);
    const suppliedCode = recordCode(item) || parent?.suggestedCode || (() => { try { return suggestCode(kind, parents); } catch { return ''; } })();
    const selectedCodePrefix = kind === 'ledger' ? suppliedCode.split('-')[0] : '';
    setDefaultSearch('');
    setForm({
      id: item?.id || '',
      accountCode: suppliedCode,
      accNameAr: read(item, 'accNameAr', 'acc_name_ar') || '',
      accNameEn: read(item, 'accNameEn', 'acc_name_en') || '',
      accountType: read(item, 'accountType', 'account_type') || item?.type || read(root, 'accountType', 'account_type') || parent?.accountType || 'Asset',
      ...parents,
      entityType: read(item, 'entityType', 'entity_type') || read(groups.find((group) => group.id === parents.groupId), 'entityType', 'entity_type') || '',
      entityId: read(item, 'entityId', 'entity_id') || '',
      accountSeq: read(item, 'accountSeq', 'account_seq') || (selectedCodePrefix ? Number(suppliedCode.split('-')[1]) || '' : ''),
      limitedBalance: read(item, 'limitedBalance', 'limited_balance') || 0,
      curNo: read(item, 'curNo', 'cur_no') || parent?.curNo || defaultCurrencyId,
      accountRefId: read(item, 'accountId', 'account_id') || '',
      defaultKey: read(item, 'defaultKey', 'default_key') || DEFAULT_KEYS.find((key) => !defaultAccounts.some((entry) => read(entry, 'defaultKey', 'default_key') === key)) || '',
      isActive: isActive(item),
      allowsDirectAccounts: read(item, 'allowsDirectAccounts', 'allows_direct_accounts') !== false,
    });
  };
  const switchUnifiedAccountKind = (kind: Exclude<EditorKind, 'default'>) => {
    if (!isUnifiedAccountCreate || editing) return;
    setEditorKind(kind);
    setForm((previous: any) => {
      const next = {
        ...previous,
        accountCode: '',
        accountSeq: '',
        ...(kind === 'account' ? { accountId: '', accMainId: '', accSubId: '', groupId: '' } : {}),
      };
      try {
        next.accountCode = suggestCode(kind, next);
        if (kind === 'ledger' && next.accountCode.includes('-')) next.accountSeq = Number(next.accountCode.split('-')[1]);
      } catch (_) { /* a parent is selected later, then updateParent suggests the code */ }
      return next;
    });
  };

  const updateParent = (field: 'accountId' | 'accMainId' | 'accSubId' | 'groupId', value: string) => {
    const next: any = { ...form, [field]: value };
    if (field === 'accountId') { next.accMainId = ''; next.accSubId = ''; next.groupId = ''; const root = roots.find((entry) => entry.id === value); next.accountType = read(root, 'accountType', 'account_type') || form.accountType; }
    if (field === 'accMainId') { next.accSubId = ''; next.groupId = ''; }
    if (field === 'accSubId') next.groupId = '';
    if (field === 'groupId') next.entityType = read(groups.find((group) => group.id === value), 'entityType', 'entity_type') || next.entityType;
    if (!editing && editorKind && editorKind !== 'default') {
      try { next.accountCode = suggestCode(editorKind, next); } catch { /* parent path remains incomplete until selected */ }
      if (editorKind === 'ledger' && next.accountCode?.includes('-')) next.accountSeq = Number(next.accountCode.split('-')[1]);
    }
    setForm(next);
  };

  const validateForm = (): string | null => {
    if (!editorKind) return 'لم يتم تحديد نوع السجل.';
    if (editorKind === 'default') {
      if (!form.defaultKey || !form.accountRefId) return isAr ? 'اختر مفتاحًا نظاميًا وحسابًا ماليًا ورقيًا.' : 'Choose a system key and a posting account.';
      if (!postingAccounts.some((account) => account.id === form.accountRefId)) return isAr ? 'الحساب الافتراضي يجب أن يكون حسابًا ماليًا نشطًا.' : 'The default must reference an active posting account.';
      return null;
    }
    const code = String(form.accountCode || '').trim();
    if (!code || !String(form.accNameAr || '').trim()) return isAr ? 'أكمل الكود والاسم العربي قبل الحفظ.' : 'Complete the code and Arabic name before saving.';
    if (editorKind === 'main' && !form.accountId) return isAr ? 'اختر الحساب الرئيسي الأب أولاً.' : 'Select the root account first.';
    if (editorKind === 'sub' && !form.accMainId) return isAr ? 'اختر الحساب الفرعي الأب أولاً.' : 'Select the parent subaccount first.';
    if (editorKind === 'group' && !form.accSubId) return isAr ? 'اختر الحساب الجزئي الأب أولاً.' : 'Select the detail account first.';
    if (editorKind === 'ledger' && !form.accSubId) return isAr ? 'اختر الحساب الجزئي الذي سيتبع له الحساب المالي.' : 'Select the detail account for this posting account.';
    if (editorKind === 'ledger' && form.groupId && !availableGroups.some((group) => group.id === form.groupId)) return isAr ? 'المجموعة المختارة لا تتبع للحساب الجزئي المحدد.' : 'The selected group does not belong to the selected detail account.';
    const kindForCode = (editorKind === 'account' ? 'account' : editorKind === 'main' ? 'main' : editorKind === 'sub' ? 'sub' : editorKind === 'group' ? 'group' : 'ledger') as HierarchyCodeKind;
    const codeError = hierarchyCodeRules.validateCode(kindForCode, code, {
      accountCode: recordCode(selectedRoot), mainCode: recordCode(selectedMain), subCode: recordCode(selectedSub), groupCode: recordCode(selectedGroup),
    });
    if (codeError) return codeError;
    if (recordsFor(editorKind).some((record) => record.id !== editing?.id && recordCode(record) === code)) return isAr ? 'الكود المحاسبي مستخدم بالفعل في هذا المستوى.' : 'The accounting code is already in use at this level.';
    if (editorKind === 'ledger' && Number(form.limitedBalance || 0) < 0) return isAr ? 'سقف الرصيد قيمة موجبة أو صفر فقط.' : 'The balance limit must be zero or a positive value.';
    return null;
  };

  const save = async () => {
    if (!editorKind || !canEdit) return setError(isAr ? 'لا تملك صلاحية تعديل الحسابات.' : 'You do not have permission to edit accounts.');
    const validationError = validateForm();
    if (validationError) return setError(validationError);
    const table = tableFor(editorKind);
    const code = String(form.accountCode || '').trim();
    const selectedCurrency = activeCurrencies.find((currency) => Number(currency.cur_id) === Number(form.curNo));
    const common = { accountCode: code, accNameAr: String(form.accNameAr || '').trim(), accNameEn: String(form.accNameEn || '').trim(), curNo: form.curNo ? Number(form.curNo) : null, isActive: Boolean(form.isActive) };
    let payload: any;
    if (editorKind === 'account') payload = { ...common, accountType: form.accountType };
    else if (editorKind === 'main') payload = { ...common, accountId: form.accountId };
    else if (editorKind === 'sub') payload = { ...common, accMainId: form.accMainId, allowsDirectAccounts: Boolean(form.allowsDirectAccounts) };
    else if (editorKind === 'group') payload = { ...common, accSubId: form.accSubId, entityType: form.entityType || null, allowsDirectAccounts: Boolean(form.allowsDirectAccounts) };
    else if (editorKind === 'ledger') {
      const accountSeq = Number(form.accountSeq || String(code).split('-')[1]);
      payload = {
        ...common, id: editing?.id || code, accSubId: form.accSubId, groupId: form.groupId || null,
        entityType: form.entityType || null, entityId: form.entityId || null, accountSeq,
        accountPrefix: code.split('-')[0], accountNumber: String(accountSeq).padStart(4, '0'),
        limitedBalance: Math.max(0, Number(form.limitedBalance || 0)), balance: Number(editing?.balance || 0),
        type: read(selectedRoot, 'accountType', 'account_type') || form.accountType, entityName: String(form.accNameAr || '').trim(), currency: selectedCurrency?.code || editing?.currency || null,
      };
    } else {
      const selected = postingAccounts.find((account) => account.id === form.accountRefId);
      payload = {
        id: editing?.id || String(form.defaultKey), defaultKey: form.defaultKey, accountId: form.accountRefId,
        accNameAr: String(form.accNameAr || selected?.accNameAr || selected?.entityName || form.defaultKey),
        accNameEn: String(form.accNameEn || selected?.accNameEn || selected?.entityName || form.defaultKey),
        curNo: form.curNo ? Number(form.curNo) : read(selected, 'curNo', 'cur_no') || null, isActive: Boolean(form.isActive),
      };
    }
    try {
      setSaving(true);
      if (editing) await updateDoc(doc(db, table, editing.id), payload);
      else await addDoc(editorKind === 'default' ? String(form.defaultKey) : editorKind === 'ledger' ? code : code, collection(db, table), payload);
      setEditorKind(null); setEditing(null);
    } catch (saveError: any) {
      setError(saveError?.message || (isAr ? 'تعذر حفظ السجل.' : 'Unable to save the record.'));
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    try { await deleteDoc(doc(db, deleting.table, deleting.item.id)); setDeleting(null); }
    catch (deleteError: any) { setError(deleteError?.message || (isAr ? 'تعذر حذف السجل المرتبط.' : 'Unable to delete linked record.')); setDeleting(null); }
  };

  const branchAction = (kind: EditorKind, parent: any) => {
    try { openEditor(kind, undefined, { ...parent, suggestedCode: suggestCode(kind, parent) }); }
    catch (suggestionError: any) { setError(suggestionError?.message || (isAr ? 'تعذر توليد الكود.' : 'Unable to generate the code.')); }
  };
  const renderActions = (table: string, item: any, kind: EditorKind) => canEdit ? <div className="flex items-center gap-1 shrink-0"><button onClick={() => openEditor(kind, item)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#d4af37] hover:bg-[#d4af37]/10" title={isAr ? 'تعديل' : 'Edit'}><Edit3 size={14} /></button><button onClick={() => setDeleting({ table, item })} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10" title={isAr ? 'حذف' : 'Delete'}><Trash2 size={14} /></button></div> : null;
  const compareByAccountingCode = (left: any, right: any) => recordCode(left).localeCompare(recordCode(right), undefined, { numeric: true, sensitivity: 'base' });
  const codeBadge = (item: any, size: 'root' | 'branch' | 'leaf' = 'branch') =>
    <span className={size === 'root' ? 'inline-flex rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/15 px-2 py-0.5 font-mono text-base font-black tracking-wide text-[#f6d56a] shadow-[0_0_14px_rgba(212,175,55,0.12)]'
      : size === 'leaf' ? 'inline-flex rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 font-mono text-sm font-black tracking-wide text-[#f0d576]'
        : 'inline-flex rounded-md border border-sky-400/25 bg-sky-400/10 px-1.5 py-0.5 font-mono text-sm font-black tracking-wide text-sky-200'}>{recordCode(item)}</span>;
  const renderLeaf = (item: any, depth: number) => {
    if (!matches(item)) return null;
    const limit = Number(read(item, 'limitedBalance', 'limited_balance') || 0);
    const presentation = TYPE_PRESENTATION[String(item.type || item.accountType || '')] || defaultTypePresentation;
    const accountCurrency = currencyCode(item);
    const balance = balanceFor('ledger', String(item.id));
    return <div key={item.id} className={`group flex flex-col gap-1.5 rounded-xl border p-2 transition-colors sm:flex-row sm:items-center ${presentation.row}`} style={{ marginInlineStart: `${depth * 16}px` }}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-black ${presentation.badge}`}><CircleDollarSign size={13} /></div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-bold text-slate-50">{recordName(item, isAr)}</span><span className={`rounded border px-1 py-0.5 text-[9px] font-bold ${presentation.badge}`}>{isAr ? presentation.labelAr : presentation.labelEn}</span>{codeBadge(item, 'leaf')}{item.entityName && item.entityName !== recordName(item, isAr) ? <span className="text-[10px] text-slate-400">{item.entityName}</span> : null}</div></div>
      <div className="grid grid-cols-2 gap-1.5 sm:min-w-[180px]"><div className="rounded border border-white/5 bg-black/20 px-2 py-1"><div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{isAr ? 'العملة' : 'Currency'}</div><div className="mt-0.5 font-mono text-[10px] font-bold text-slate-200">{accountCurrency}</div></div><div className="rounded border border-white/5 bg-black/20 px-2 py-1"><div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{isAr ? 'الرصيد' : 'Balance'}</div>{balanceSummary(balance)}</div></div>
      <div className="flex items-center justify-end gap-0.5">{limit > 0 && <span className="me-1 rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[9px] font-bold text-amber-300">{isAr ? `حد ${formatMoney(limit)}` : `Limit ${formatMoney(limit)}`}</span>}<button onClick={() => openStatement(item)} className={`rounded-lg border p-1.5 transition-colors ${presentation.badge}`} title={isAr ? 'عرض كشف الحساب' : 'View account statement'} aria-label={isAr ? `كشف حساب ${recordName(item, isAr)}` : `Statement for ${recordName(item, isAr)}`}><FileText size={12} /></button>{renderActions('accounts', item, 'ledger')}</div>
    </div>;
  };
  const renderGroup = (item: any, depth: number) => {
    const children = postingAccounts.filter((account) => read(account, 'groupId', 'group_id') === item.id).sort(compareByAccountingCode); const visible = matches(item) || children.some(matches); if (!visible) return null; const opened = expanded[item.id] !== false; const balance = balanceFor('group', String(item.id));
    return <div key={item.id} style={{ marginInlineStart: `${depth * 18}px` }}><div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-slate-900/40 border border-slate-800/80"><button onClick={() => toggle(item.id)} className="text-slate-400">{opened ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><Layers3 size={16} className="text-violet-400" /><div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-200">{recordName(item, isAr)}</div><div className="mt-1 flex flex-wrap items-center gap-2">{codeBadge(item)}<span className="text-[10px] text-slate-500">{children.length} {isAr ? 'حسابات مالية' : 'posting accounts'}</span></div></div><div className="rounded-lg border border-white/5 bg-black/20 px-2 py-1">{balanceSummary(balance)}</div>{canEdit && <button onClick={() => branchAction('ledger', { accSubId: read(item, 'accSubId', 'acc_sub_id'), groupId: item.id, curNo: read(item, 'curNo', 'cur_no') })} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10" title={isAr ? 'حساب مالي جديد' : 'New posting account'}><Plus size={14} /></button>}{renderActions('acc_sub_group', item, 'group')}</div>{opened && children.map((child) => renderLeaf(child, depth + 1))}</div>;
  };
  const renderSub = (item: any, depth: number) => {
    const childGroups = groups.filter((group) => read(group, 'accSubId', 'acc_sub_id') === item.id).sort(compareByAccountingCode); const directAccounts = postingAccounts.filter((account) => !read(account, 'groupId', 'group_id') && read(account, 'accSubId', 'acc_sub_id') === item.id).sort(compareByAccountingCode); const visible = matches(item) || childGroups.some(matches) || directAccounts.some(matches); if (!visible) return null; const opened = expanded[item.id] !== false; const balance = balanceFor('sub', String(item.id));
    return <div key={item.id} style={{ marginInlineStart: `${depth * 18}px` }}><div className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-slate-800/60"><button onClick={() => toggle(item.id)} className="text-slate-400">{opened ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><FolderPlus size={16} className="text-sky-400" /><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-200">{recordName(item, isAr)}</div><div className="mt-1">{codeBadge(item)}</div></div><div className="rounded-lg border border-white/5 bg-black/20 px-2 py-1">{balanceSummary(balance)}</div>{canEdit && <><button onClick={() => branchAction('group', { accSubId: item.id, curNo: read(item, 'curNo', 'cur_no') })} className="p-1.5 rounded-lg text-violet-400 hover:bg-violet-500/10" title={isAr ? 'مجموعة جديدة' : 'New group'}><Layers3 size={14} /></button><button onClick={() => branchAction('ledger', { accSubId: item.id, curNo: read(item, 'curNo', 'cur_no') })} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10" title={isAr ? 'حساب مالي جديد' : 'New posting account'}><Plus size={14} /></button></>}{renderActions('acc_sub', item, 'sub')}</div>{opened && <>{childGroups.map((child) => renderGroup(child, depth + 1))}{directAccounts.map((child) => renderLeaf(child, depth + 1))}</>}</div>;
  };
  const renderMain = (item: any, depth: number) => { const children = subs.filter((sub) => read(sub, 'accMainId', 'acc_main_id') === item.id).sort(compareByAccountingCode); const visible = matches(item) || children.some(matches); if (!visible) return null; const opened = expanded[item.id] !== false; const balance = balanceFor('main', String(item.id)); return <div key={item.id} style={{ marginInlineStart: `${depth * 18}px` }}><div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-slate-900/50 border border-slate-800/70"><button onClick={() => toggle(item.id)} className="text-slate-400">{opened ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><FolderPlus size={16} className="text-amber-400" /><div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-100">{recordName(item, isAr)}</div><div className="mt-1">{codeBadge(item)}</div></div><div className="rounded-lg border border-white/5 bg-black/20 px-2 py-1">{balanceSummary(balance)}</div>{canEdit && <button onClick={() => branchAction('sub', { accountId: read(item, 'accountId', 'account_id'), accMainId: item.id, curNo: read(item, 'curNo', 'cur_no') })} className="p-1.5 rounded-lg text-sky-400 hover:bg-sky-500/10" title={isAr ? 'حساب جزئي جديد' : 'New detail account'}><Plus size={14} /></button>}{renderActions('acc_main', item, 'main')}</div>{opened && children.map((child) => renderSub(child, depth + 1))}</div>; };
  const renderRoot = (item: any) => {
    const children = mains.filter((main) => read(main, 'accountId', 'account_id') === item.id).sort(compareByAccountingCode);
    const visible = matches(item) || children.some(matches);
    if (!visible) return null;
    const opened = expanded[item.id] !== false;
    const accountType = String(read(item, 'accountType', 'account_type') || 'Asset');
    const presentation = TYPE_PRESENTATION[accountType] || defaultTypePresentation;
    const descendantSubIds = new Set(subs.filter((sub) => children.some((main) => main.id === read(sub, 'accMainId', 'acc_main_id'))).map((sub) => sub.id));
    const descendantCount = postingAccounts.filter((account) => descendantSubIds.has(read(account, 'accSubId', 'acc_sub_id'))).length;
    const balance = balanceFor('account', String(item.id));
    return <div key={item.id} className={`overflow-hidden rounded-2xl border ${presentation.row}`}><div className="flex items-center gap-3 px-4 py-3"><button onClick={() => toggle(item.id)} className={`rounded-lg p-1 transition-colors hover:bg-black/20 ${presentation.accent}`} aria-label={opened ? (isAr ? 'طيّ الفرع' : 'Collapse branch') : (isAr ? 'توسيع الفرع' : 'Expand branch')}>{opened ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button><div className={`flex h-9 w-9 items-center justify-center rounded-xl border font-black ${presentation.badge}`}><Layers3 size={18} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-white">{recordName(item, isAr)}</h3><span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${presentation.badge}`}>{isAr ? presentation.labelAr : presentation.labelEn}</span></div><div className="mt-2 flex flex-wrap items-center gap-2">{codeBadge(item, 'root')}<span className="text-[10px] text-slate-400">{descendantCount} {isAr ? 'حسابات مالية' : 'posting accounts'}</span></div></div><div className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-1.5">{balanceSummary(balance)}</div>{canEdit && <button onClick={() => branchAction('main', { accountId: item.id, accountType, curNo: read(item, 'curNo', 'cur_no') })} className={`rounded-lg p-2 transition-colors hover:bg-black/20 ${presentation.accent}`} title={isAr ? 'حساب فرعي جديد' : 'New subaccount'}><Plus size={15} /></button>}{renderActions('account', item, 'account')}</div>{opened && <div className="border-t border-white/10 p-2">{children.map((child) => renderMain(child, 1))}</div>}</div>;
  };

  const selector = (label: string, value: string, options: any[], onChange: (value: string) => void, placeholder: string) => <label className="text-xs text-slate-400">{label}<select value={value || ''} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{recordCode(option)} — {recordName(option, isAr)}</option>)}</select></label>;
  const defaultAccountOptions = postingAccounts.filter((account) => !defaultSearch.trim() || `${recordCode(account)} ${recordName(account, isAr)} ${account.entityName || ''}`.toLowerCase().includes(defaultSearch.trim().toLowerCase()));
  const codeHint = editorKind === 'ledger' && selectedSub ? `${hierarchyCodeRules.postingPrefix(recordCode(selectedSub), recordCode(selectedGroup) || undefined)}-0001` : '';
  const statementDebitTotal = statementTransactions.filter((transaction) => (transaction.transType || transaction.trans_type || transaction.type) === 'Debit').reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  const statementCreditTotal = statementTransactions.filter((transaction) => (transaction.transType || transaction.trans_type || transaction.type) === 'Credit').reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

  return <section className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-black/25 border border-[#d4af37]/20 rounded-2xl p-4"><div><h2 className="font-black text-white text-lg">{isAr ? 'شجرة الحسابات المالية' : 'Financial Chart of Accounts'}</h2><p className="text-xs text-slate-500">{isAr ? 'القيد مسموح للحسابات المالية النشطة فقط؛.' : 'Only active posting accounts may be posted to; codes follow the selected parent path.'}</p></div><div className="flex gap-2"><button onClick={() => setActiveTab('tree')} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === 'tree' ? 'bg-[#d4af37] text-black' : 'bg-slate-900 text-slate-300'}`}>{isAr ? 'الشجرة' : 'Tree'}</button><button onClick={() => setActiveTab('defaults')} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === 'defaults' ? 'bg-[#d4af37] text-black' : 'bg-slate-900 text-slate-300'}`}><Settings2 size={14} className="inline me-1" />{isAr ? 'الحسابات الافتراضية' : 'Default accounts'}</button></div></div>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
    <div id="accounting-tree-print-content" className="hidden" dir={isAr ? 'rtl' : 'ltr'}><div className="header"><h1>{isAr ? 'شجرة الحسابات المالية' : 'Financial Chart of Accounts'}</h1><p>{isAr ? `الأرصدة المجمعة بعملة النظام: ${treeBalances.defaultCurrency || '—'}` : `Aggregated balances in system currency: ${treeBalances.defaultCurrency || '—'}`}</p></div><table><thead><tr><th>{isAr ? 'المستوى' : 'Level'}</th><th>{isAr ? 'الكود' : 'Code'}</th><th>{isAr ? 'الاسم العربي' : 'Arabic name'}</th><th>{isAr ? 'الاسم الإنجليزي' : 'English name'}</th><th>{isAr ? 'الأب' : 'Parent'}</th><th>{isAr ? 'الرصيد الأصلي' : 'Native balance'}</th><th>{isAr ? 'بعملة النظام' : 'System balance'}</th></tr></thead><tbody>{printableRows.map((row) => <tr key={`${row.level}-${row.id}`}><td>{row.level}</td><td>{row.accountCode}</td><td>{row.accNameAr}</td><td>{row.accNameEn}</td><td>{row.parentId}</td><td>{row.nativeBalance} {row.nativeBalanceCurrency}</td><td>{row.systemBalance} {row.systemCurrency}</td></tr>)}</tbody></table></div>
    {activeTab === 'tree' && <><div className="rounded-2xl border border-slate-800 bg-black/20 p-3"><div className="mb-2 flex items-center justify-between gap-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{isAr ? 'ملخص المعادلة المحاسبية' : 'Accounting equation summary'}</div><div className="font-mono text-[10px] text-slate-500">{treeBalances.defaultCurrency || '—'}</div></div>{exchangeRatesLoading || liveBalances.loading ? <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" />{isAr ? 'جارٍ احتساب الأرصدة وأسعار الصرف...' : 'Calculating balances and exchange rates...'}</div> : <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono text-slate-400"><span className="font-black text-indigo-400">{isAr ? 'أصول' : 'Assets'} {formatBalance(treeBalances.totals.assets)}</span><span className="font-black text-slate-600">=</span><span className="text-amber-400">{isAr ? 'خصوم' : 'Liab'} {formatBalance(treeBalances.totals.liab)}</span><span className="text-slate-700">+</span><span className="text-[#d4af37]">{isAr ? 'رأس المال' : 'Capital'} {formatBalance(treeBalances.totals.capital)}</span><span className="text-slate-700">+</span><span className={Number(treeBalances.totals.netIncome || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{isAr ? 'صافي الدخل' : 'Net income'} {treeBalances.totals.netIncome !== null && treeBalances.totals.netIncome >= 0 ? '+' : ''}{formatBalance(treeBalances.totals.netIncome)}</span><span className="font-black text-slate-600">=</span><span className={`font-black ${treeBalances.totals.isBalanced ? 'text-emerald-400' : 'text-rose-400'}`}>{formatBalance(treeBalances.totals.rightSide)} {treeBalances.defaultCurrency || '—'} {treeBalances.totals.isBalanced ? '✓' : '✗'}</span>{treeBalances.totals.hasMissingExchangeRate && <span className="basis-full text-center text-amber-300">{isAr ? 'لا يمكن اعتماد المعادلة حتى يُسجل سعر صرف لكل عملة مستخدمة.' : 'The equation cannot be relied on until every used currency has a recorded exchange rate.'}</span>}</div>}</div><div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs text-slate-400"><span className="font-black text-slate-100">{postingAccounts.length}</span> {isAr ? 'حسابًا ماليًا ورقيًا نشطًا ضمن الشجرة' : 'active posting accounts in the hierarchy'}</div><div className="flex flex-wrap gap-2"><button onClick={expandAll} className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-200 transition-colors hover:bg-sky-400/20"><Maximize2 size={14} /></button><button onClick={collapseAll} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/70 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"><Minimize2 size={14} /></button><button onClick={() => printContent(isAr ? 'شجرة الحسابات المالية' : 'Financial chart of accounts', 'accounting-tree-print-content', isAr)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/70 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"><Printer size={14} />{isAr ? 'طباعة' : 'Print'}</button><button onClick={() => setPrintDialogOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-2 text-xs font-bold text-[#f0d576] transition-colors hover:bg-[#d4af37]/20"><Printer size={14} />{isAr ? ' طباعة مخصصة' : 'Choose print sections'}</button><button onClick={() => exportTree('csv')} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-400/20"><Download size={14} />CSV</button><button onClick={() => exportTree('xlsx')} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-400/20"><FileSpreadsheet size={14} />XLS</button>{canEdit && <><input ref={importInputRef} onChange={inspectImportFile} accept=".csv,.xls,.xlsx" type="file" className="hidden" /><button onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-2 text-xs font-bold text-[#f0d576] transition-colors hover:bg-[#d4af37]/20"><Upload size={14} />{isAr ? 'استيراد' : 'Import'}</button></>}</div></div></>}
    {activeTab === 'tree' ? <><div className="flex flex-col sm:flex-row gap-3 justify-between"><div className="relative max-w-md flex-1"><Search size={16} className="absolute start-3 top-3 text-slate-500" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={isAr ? 'ابحث بالاسم، الكود أو الكيان...' : 'Search name, code, or entity...'} className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 ps-9 pe-3 text-sm text-white outline-none focus:border-[#d4af37]" /></div>{canEdit && <button onClick={() => openEditor('account')} className="rounded-xl bg-[#d4af37] text-black px-4 py-2.5 text-sm font-black"><Plus size={16} className="inline me-1" />{isAr ? 'حساب جديد' : 'New account'}</button>}</div><div className="space-y-3">{dataLoadState === 'loading' && <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 p-10 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" />{isAr ? 'جارٍ تحميل الحسابات المالية من قاعدة البيانات...' : 'Loading financial accounts from the database...'}</div>}{dataLoadState === 'ready' && roots.slice().sort((a, b) => recordCode(a).localeCompare(recordCode(b))).map(renderRoot)}{dataLoadState === 'ready' && roots.length === 0 && <div className="p-12 text-center border border-dashed border-rose-500/50 rounded-2xl text-rose-300">{isAr ? 'لم تصل عقد شجرة الحسابات من قاعدة البيانات. راجع رسالة الخطأ أعلاه.' : 'No hierarchy nodes were returned from the database. Review the error above.'}</div>}{dataLoadState === 'ready' && roots.length > 0 && postingAccounts.length === 0 && <div className="p-6 text-center border border-dashed border-amber-500/40 rounded-2xl text-amber-200">{isAr ? 'تم تحميل الشجرة ولكن لم يُرجع مصدر البيانات أي حسابات مالية ورقية نشطة.' : 'The hierarchy loaded, but the data source returned no active posting accounts.'}</div>}</div></> : <><div className="flex justify-between items-center"><p className="text-sm text-slate-400">{isAr ? 'اربط مفاتيح النظام بحسابات مالية ورقية نشطة فقط.' : 'Map system keys to active posting accounts only.'}</p>{canEdit && <button onClick={() => openEditor('default')} className="rounded-xl bg-[#d4af37] text-black px-4 py-2.5 text-sm font-black"><Plus size={16} className="inline me-1" />{isAr ? 'حساب افتراضي' : 'Default account'}</button>}</div><div className="rounded-2xl border border-slate-800 overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-900/80 text-slate-400 text-xs"><tr><th className="p-3 text-start">{isAr ? 'المفتاح' : 'Key'}</th><th className="p-3 text-start">{isAr ? 'الحساب المالي' : 'Posting account'}</th><th className="p-3 text-start">{isAr ? 'الحالة' : 'Status'}</th><th className="p-3"></th></tr></thead><tbody>{defaultAccounts.slice().sort((a, b) => String(read(a, 'defaultKey', 'default_key')).localeCompare(String(read(b, 'defaultKey', 'default_key')))).map((entry) => { const account = postingAccounts.find((item) => item.id === read(entry, 'accountId', 'account_id')); return <tr key={entry.id} className="border-t border-slate-800/80"><td className="p-3 font-mono text-[#d4af37]">{read(entry, 'defaultKey', 'default_key')}</td><td className="p-3 text-slate-200">{account ? `${recordCode(account)} — ${recordName(account, isAr)}` : <span className="text-rose-400">{isAr ? 'حساب غير متاح' : 'Unavailable account'}</span>}</td><td className="p-3">{isActive(entry) ? <CheckCircle2 size={16} className="text-emerald-400" /> : <span className="text-slate-500">—</span>}</td><td className="p-3">{renderActions('default_accounts', entry, 'default')}</td></tr>; })}{defaultAccounts.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-500">{isAr ? 'لا توجد حسابات افتراضية مرتبطة بعد.' : 'No default accounts have been mapped yet.'}</td></tr>}</tbody></table></div></>}
    {printDialogOpen && <div className="fixed inset-0 z-[1140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={isAr ? 'اختيار أقسام طباعة الشجرة' : 'Choose chart sections to print'}><div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-slate-950 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5"><div><h3 className="font-black text-white">{isAr ? 'اختيار أقسام الطباعة' : 'Choose print sections'}</h3><p className="mt-1 text-xs text-slate-400">{isAr ? 'اختر الأقسام الرئيسية المطلوب تضمين كل فروعها وحساباتها في التقرير.' : 'Select root sections to include all of their branches and accounts in the report.'}</p></div><button onClick={() => setPrintDialogOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X /></button></div><div className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="text-xs text-slate-400"><span className="font-mono font-black text-[#f0d576]">{printableRows.length}</span> {isAr ? 'صفًا سيظهر في التقرير' : 'rows will appear in the report'}</div><div className="flex gap-2"><button onClick={() => setPrintSections(Object.fromEntries(roots.map((root) => [String(root.id), true])))} className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200">{isAr ? 'تحديد الكل' : 'Select all'}</button><button onClick={() => setPrintSections(Object.fromEntries(roots.map((root) => [String(root.id), false])))} className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200">{isAr ? 'إلغاء الكل' : 'Clear all'}</button></div></div><div className="space-y-2">{roots.slice().sort((a, b) => recordCode(a).localeCompare(recordCode(b))).map((root) => { const type = String(read(root, 'accountType', 'account_type') || 'Asset'); const presentation = TYPE_PRESENTATION[type] || defaultTypePresentation; const balance = balanceFor('account', String(root.id)); return <label key={root.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors ${printSections[String(root.id)] !== false ? presentation.row : 'border-slate-800 bg-slate-900/40 opacity-70'}`}><input type="checkbox" checked={printSections[String(root.id)] !== false} onChange={(event) => setPrintSections((previous) => ({ ...previous, [String(root.id)]: event.target.checked }))} className="h-4 w-4 accent-[#d4af37]" /><div className="min-w-0 flex-1"><div className="font-bold text-slate-100">{recordName(root, isAr)}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{recordCode(root)} · {isAr ? presentation.labelAr : presentation.labelEn}</div></div><div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">{balanceSummary(balance)}</div></label>; })}</div></div><div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/80 p-4"><button onClick={() => setPrintDialogOpen(false)} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-100">{isAr ? 'إلغاء' : 'Cancel'}</button><button onClick={() => { setPrintDialogOpen(false); printContent(); }} disabled={printableRows.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-black text-black disabled:opacity-50"><Printer size={15} />{isAr ? 'طباعة المحدد' : 'Print selected'}</button></div></div></div>}
    {importPreview && <div className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={isAr ? 'معاينة استيراد شجرة الحسابات' : 'Chart tree import preview'}><div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-slate-950 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5"><div><h3 className="font-black text-white">{isAr ? 'معاينة استيراد شجرة الحسابات' : 'Chart tree import preview'}</h3><p className="mt-1 text-xs text-slate-400">{isAr ? 'لن تُستورد الأرصدة أو القيود. لا يمكن الاستمرار قبل معالجة جميع الأخطاء.' : 'Balances and journal entries are never imported. All errors must be resolved before continuing.'}</p></div><button onClick={() => setImportPreview(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X /></button></div><div className="min-h-0 flex-1 overflow-auto p-5"><div className="grid grid-cols-3 gap-2"><div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">{isAr ? 'صفوف صالحة' : 'Valid rows'}</div><div className="mt-1 font-mono text-lg font-black text-emerald-300">{importPreview.rows.length}</div></div><div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3"><div className="text-[10px] uppercase text-rose-200/70">{isAr ? 'أخطاء' : 'Errors'}</div><div className="mt-1 font-mono text-lg font-black text-rose-300">{importPreview.errors.length}</div></div><div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><div className="text-[10px] uppercase text-amber-200/70">{isAr ? 'تحذيرات' : 'Warnings'}</div><div className="mt-1 font-mono text-lg font-black text-amber-300">{importPreview.warnings.length}</div></div></div>{importPreview.errors.length > 0 && <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4"><div className="text-sm font-bold text-rose-200">{isAr ? 'يجب معالجة الأخطاء التالية:' : 'Resolve the following errors:'}</div><ul className="mt-2 space-y-1 text-xs text-rose-100">{importPreview.errors.slice(0, 50).map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul></div>}{importPreview.warnings.length > 0 && <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="text-sm font-bold text-amber-200">{isAr ? 'تحذيرات الاستيراد:' : 'Import warnings:'}</div><ul className="mt-2 space-y-1 text-xs text-amber-100">{importPreview.warnings.slice(0, 50).map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul></div>}<div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[740px] text-xs"><thead className="bg-slate-900/80 text-slate-400"><tr><th className="p-3 text-start">{isAr ? 'المستوى' : 'Level'}</th><th className="p-3 text-start">{isAr ? 'الكود' : 'Code'}</th><th className="p-3 text-start">{isAr ? 'الاسم' : 'Name'}</th><th className="p-3 text-start">{isAr ? 'الأب' : 'Parent'}</th><th className="p-3 text-start">{isAr ? 'العملة' : 'Currency'}</th></tr></thead><tbody>{importPreview.rows.slice(0, 30).map((row) => <tr key={`${row.level}-${row.id}`} className="border-t border-slate-800"><td className="p-3 text-slate-300">{row.level}</td><td className="p-3 font-mono text-[#f0d576]">{row.accountCode}</td><td className="p-3 text-slate-100">{row.accNameAr}</td><td className="p-3 font-mono text-slate-400">{row.parentId || '—'}</td><td className="p-3 font-mono text-slate-300">{row.currency}</td></tr>)}</tbody></table></div>{importPreview.rows.length > 30 && <p className="mt-2 text-center text-xs text-slate-500">{isAr ? `يُعرض أول 30 صفًا من أصل ${importPreview.rows.length}.` : `Showing the first 30 of ${importPreview.rows.length} rows.`}</p>}</div><div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/80 p-4"><button onClick={() => setImportPreview(null)} disabled={importing} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-100 disabled:opacity-60">{isAr ? 'إلغاء' : 'Cancel'}</button><button onClick={executeImport} disabled={importing || importPreview.errors.length > 0 || importPreview.rows.length === 0} className="rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50">{importing ? (isAr ? 'جارٍ الاستيراد...' : 'Importing...') : (isAr ? 'تأكيد الاستيراد' : 'Confirm import')}</button></div></div></div>}
    {editorKind && <div className="fixed inset-0 z-[1000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true"><div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#d4af37]/30 bg-slate-950 shadow-2xl"><div className="flex items-center justify-between px-5 py-4 border-b border-slate-800"><h3 className="font-black text-white">{editing ? (isAr ? 'تعديل' : 'Edit') : (isAr ? 'إضافة' : 'Add')} {editorKind === 'account' ? (isAr ? 'حساب رئيسي' : 'root account') : editorKind === 'main' ? (isAr ? 'حساب فرعي' : 'subaccount') : editorKind === 'sub' ? (isAr ? 'حساب جزئي' : 'detail account') : editorKind === 'group' ? (isAr ? 'مجموعة حسابات' : 'account group') : editorKind === 'ledger' ? (isAr ? 'حساب مالي' : 'posting account') : (isAr ? 'حساب افتراضي' : 'default account')}</h3><button onClick={() => setEditorKind(null)} className="text-slate-400 hover:text-white"><X /></button></div><div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
      {isUnifiedAccountCreate && !editing && <div className="md:col-span-2 rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-4"><label className="text-xs font-bold text-[#f0d576]">{isAr ? 'نوع الحساب الجديد' : 'New account type'}<select value={editorKind || 'account'} onChange={(event) => switchUnifiedAccountKind(event.target.value as Exclude<EditorKind, 'default'>)} className="mt-2 w-full rounded-xl border border-[#d4af37]/30 bg-slate-950 p-2.5 text-white"><option value="account">{isAr ? 'حساب رئيسي — أصل/خصم/ملكية/إيراد/مصروف' : 'Root account — Asset/Liability/Equity/Revenue/Expense'}</option><option value="main">{isAr ? 'حساب فرعي' : 'Subaccount'}</option><option value="sub">{isAr ? 'حساب جزئي' : 'Detail account'}</option><option value="group">{isAr ? 'مجموعة حسابات جزئية' : 'Account subgroup'}</option><option value="ledger">{isAr ? 'حساب مالي ورقي' : 'Posting account'}</option></select></label><p className="mt-2 text-[11px] text-slate-400">{isAr ? 'الكود يتولد تلقائيا على حسب اختيارك.' : 'Only fields and relations required by the selected account type are shown; the code is suggested after its parent is selected.'}</p></div>}
      {editorKind === 'default' ? <><label className="text-xs text-slate-400">{isAr ? 'المفتاح النظامي' : 'System key'}<input list="default-account-keys" value={form.defaultKey} disabled={Boolean(editing)} onChange={(event) => setForm({ ...form, defaultKey: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white disabled:opacity-60" /><datalist id="default-account-keys">{DEFAULT_KEYS.map((key) => <option key={key} value={key} />)}</datalist></label><label className="text-xs text-slate-400">{isAr ? 'بحث في الحسابات المالية' : 'Search posting accounts'}<div className="relative mt-1"><Search size={15} className="absolute start-3 top-3 text-slate-500" /><input value={defaultSearch} onChange={(event) => setDefaultSearch(event.target.value)} placeholder={isAr ? 'الاسم أو الكود...' : 'Name or code...'} className="w-full rounded-xl bg-slate-900 border border-slate-700 ps-9 p-2.5 text-white" /></div></label><label className="text-xs text-slate-400 md:col-span-2">{isAr ? 'الحساب المالي' : 'Posting account'}<select value={form.accountRefId} onChange={(event) => { const account = postingAccounts.find((item) => item.id === event.target.value); setForm({ ...form, accountRefId: event.target.value, accNameAr: account?.accNameAr || account?.entityName || form.accNameAr, accNameEn: account?.accNameEn || account?.entityName || form.accNameEn, curNo: read(account, 'curNo', 'cur_no') || form.curNo }); }} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"><option value="">{isAr ? 'اختر حسابًا ماليًا نشطًا' : 'Select an active posting account'}</option>{defaultAccountOptions.map((account) => <option key={account.id} value={account.id}>{recordCode(account)} — {recordName(account, isAr)}</option>)}</select></label></> : <>
        {editorKind !== 'account' && <label className="text-xs text-slate-400">{isAr ? 'طبيعة الحساب' : 'Account nature'}<select value={form.accountType} onChange={(event) => { const type = event.target.value; setForm({ ...form, accountType: type, accountId: '', accMainId: '', accSubId: '', groupId: '' }); }} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white">{NATURES.map((nature) => <option key={nature.value} value={nature.value}>{isAr ? nature.ar : nature.en}</option>)}</select></label>}
        {editorKind === 'account' && <label className="text-xs text-slate-400">{isAr ? 'طبيعة الحساب' : 'Account nature'}<select value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white">{NATURES.map((nature) => <option key={nature.value} value={nature.value}>{isAr ? nature.ar : nature.en}</option>)}</select></label>}
        {editorKind !== 'account' && selector(isAr ? 'الحساب الرئيسي الأب' : 'Root account', form.accountId, rootsForSelectedNature, (value) => updateParent('accountId', value), isAr ? 'اختر الحساب الرئيسي' : 'Select root account')}
        {(editorKind === 'sub' || editorKind === 'group' || editorKind === 'ledger') && selector(isAr ? 'الحساب الفرعي الأب' : 'Parent subaccount', form.accMainId, availableMains, (value) => updateParent('accMainId', value), isAr ? 'اختر الحساب الفرعي' : 'Select parent subaccount')}
        {(editorKind === 'group' || editorKind === 'ledger') && selector(isAr ? 'الحساب الجزئي الأب' : 'Parent detail account', form.accSubId, availableSubs, (value) => updateParent('accSubId', value), isAr ? 'اختر الحساب الجزئي' : 'Select detail account')}
        {editorKind === 'ledger' && selector(isAr ? 'المجموعة الجزئية (اختيارية)' : 'Subgroup (optional)', form.groupId, availableGroups, (value) => updateParent('groupId', value), isAr ? 'بدون مجموعة' : 'No subgroup')}
        <label className="text-xs text-slate-400">{isAr ? 'الكود المحاسبي' : 'Accounting code'}<input value={form.accountCode} onChange={(event) => setForm({ ...form, accountCode: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white" />{codeHint && <span className="mt-1 block text-[10px] text-slate-500">{isAr ? `الصيغة المتوقعة: ${codeHint}` : `Expected format: ${codeHint}`}</span>}</label>
        <label className="text-xs text-slate-400">{isAr ? 'الاسم العربي' : 'Arabic name'}<input value={form.accNameAr} onChange={(event) => setForm({ ...form, accNameAr: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white" /></label><label className="text-xs text-slate-400">{isAr ? 'الاسم الإنجليزي' : 'English name'}<input value={form.accNameEn} onChange={(event) => setForm({ ...form, accNameEn: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white" /></label><label className="text-xs text-slate-400">{isAr ? 'العملة المرجعية' : 'Currency reference'}<select value={form.curNo || ''} onChange={(event) => setForm({ ...form, curNo: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"><option value="">{isAr ? 'عملة النظام الافتراضية' : 'System default currency'}</option>{activeCurrencies.map((currency) => <option key={currency.cur_id} value={currency.cur_id}>{currency.code} — {currency.main_nameAR || currency.mainNameAR || currency.main_nameEn || currency.mainNameEn}</option>)}</select></label>
        {editorKind === 'group' && <label className="text-xs text-slate-400">{isAr ? 'ربط الإنشاء التلقائي' : 'Automatic entity binding'}<select value={form.entityType} onChange={(event) => setForm({ ...form, entityType: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white">{ENTITY_TYPES.map((entity) => <option key={entity.value} value={entity.value}>{isAr ? entity.ar : entity.en}</option>)}</select></label>}
        {editorKind === 'ledger' && <><label className="text-xs text-slate-400">{isAr ? 'نوع ربط الحساب' : 'Account binding type'}<select value={form.entityType} onChange={(event) => setForm({ ...form, entityType: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white">{ENTITY_TYPES.map((entity) => <option key={entity.value} value={entity.value}>{isAr ? entity.ar : entity.en}</option>)}</select></label><label className="text-xs text-slate-400">{isAr ? 'معرف الكيان (اختياري)' : 'Entity ID (optional)'}<input value={form.entityId} onChange={(event) => setForm({ ...form, entityId: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white" /></label><label className="text-xs text-slate-400">{isAr ? 'حد الرصيد الطبيعي' : 'Natural balance limit'}<input type="number" min="0" value={form.limitedBalance} onChange={(event) => setForm({ ...form, limitedBalance: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white" /></label><label className="text-xs text-slate-400">{isAr ? 'تسلسل الحساب' : 'Account sequence'}<input type="number" min="1" max="9999" value={form.accountSeq} onChange={(event) => setForm({ ...form, accountSeq: event.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white" /></label></>}
        {(editorKind === 'sub' || editorKind === 'group') && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={Boolean(form.allowsDirectAccounts)} onChange={(event) => setForm({ ...form, allowsDirectAccounts: event.target.checked })} />{isAr ? 'السماح بحسابات مالية مباشرة' : 'Allow direct posting accounts'}</label>}
      </>}
      <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={Boolean(form.isActive)} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />{isAr ? 'نشط' : 'Active'}</label>
    </div><div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-800"><button onClick={() => setEditorKind(null)} className="px-4 py-2 text-sm rounded-xl bg-slate-900 text-slate-300">{isAr ? 'إلغاء' : 'Cancel'}</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-xl bg-[#d4af37] text-black font-black disabled:opacity-60">{saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}</button></div></div></div>}
    {statementAccount && <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={isAr ? 'كشف الحساب' : 'Account statement'}><div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1120] shadow-2xl"><div className="border-b border-slate-800 bg-slate-950/80 p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-black text-white"><FileText size={18} className="text-[#d4af37]" />{isAr ? 'كشف حساب مالي' : 'Financial account statement'}</div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 font-mono text-xs text-[#f0d576]">{recordCode(statementAccount)}</span><span className="font-bold text-slate-100">{recordName(statementAccount, isAr)}</span><span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${(TYPE_PRESENTATION[String(statementAccount.type || statementAccount.accountType || '')] || defaultTypePresentation).badge}`}>{isAr ? (TYPE_PRESENTATION[String(statementAccount.type || statementAccount.accountType || '')] || defaultTypePresentation).labelAr : (TYPE_PRESENTATION[String(statementAccount.type || statementAccount.accountType || '')] || defaultTypePresentation).labelEn}</span></div></div><button onClick={() => setStatementAccount(null)} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white" title={isAr ? 'إغلاق' : 'Close'}><X /></button></div><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4"><div className="rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/5 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{isAr ? 'الرصيد الحالي' : 'Current balance'}</div><div className="mt-1 font-mono text-base font-black text-[#f0d576]">{formatMoney(statementAccount.balance)} {currencyCode(statementAccount)}</div></div><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/70">{isAr ? 'إجمالي المدين' : 'Total debit'}</div><div className="mt-1 font-mono text-base font-black text-emerald-300">{formatMoney(statementDebitTotal)} {currencyCode(statementAccount)}</div></div><div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-rose-300/70">{isAr ? 'إجمالي الدائن' : 'Total credit'}</div><div className="mt-1 font-mono text-base font-black text-rose-300">{formatMoney(statementCreditTotal)} {currencyCode(statementAccount)}</div></div><div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{isAr ? 'عدد الحركات' : 'Transactions'}</div><div className="mt-1 font-mono text-base font-black text-white">{statementTransactions.length}</div></div></div></div><div className="min-h-0 flex-1 overflow-auto p-4">{statementLoading ? <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400"><Loader2 size={20} className="animate-spin" />{isAr ? 'جارٍ تحميل كشف الحساب...' : 'Loading statement...'}</div> : <table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-slate-950 text-xs text-slate-400"><tr><th className="p-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th><th className="p-3 text-start">{isAr ? 'المرجع' : 'Reference'}</th><th className="p-3 text-start">{isAr ? 'البيان' : 'Description'}</th><th className="p-3 text-start">{isAr ? 'الوحدة' : 'Module'}</th><th className="p-3 text-end text-emerald-300">{isAr ? 'مدين' : 'Debit'}</th><th className="p-3 text-end text-rose-300">{isAr ? 'دائن' : 'Credit'}</th></tr></thead><tbody>{statementTransactions.map((transaction) => <tr key={transaction.id} className="border-t border-slate-800/80 transition-colors hover:bg-slate-800/50"><td className="p-3 font-mono text-xs text-slate-400">{transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString(isAr ? 'ar-YE' : undefined) : '—'}</td><td className="p-3 font-mono text-xs text-[#f0d576]">{transaction.entryNumber || transaction.entry_number || transaction.refNumber || transaction.journalEntryNumber || '—'}</td><td className="max-w-[260px] p-3 text-xs text-slate-200">{transaction.description || '—'}</td><td className="p-3"><span className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-400">{transaction.module || transaction.moduleId || '—'}</span></td><td className="p-3 text-end font-mono text-xs font-bold text-emerald-300">{(transaction.transType || transaction.trans_type || transaction.type) === 'Debit' ? `${formatMoney(transaction.amount)} ${transaction.currency || currencyCode(statementAccount)}` : '—'}</td><td className="p-3 text-end font-mono text-xs font-bold text-rose-300">{(transaction.transType || transaction.trans_type || transaction.type) === 'Credit' ? `${formatMoney(transaction.amount)} ${transaction.currency || currencyCode(statementAccount)}` : '—'}</td></tr>)}{statementTransactions.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-sm text-slate-500">{isAr ? 'لا توجد حركات مسجلة على هذا الحساب.' : 'No transactions are recorded for this account.'}</td></tr>}</tbody></table>}</div><div className="flex justify-end border-t border-slate-800 bg-slate-950/80 p-4"><button onClick={() => setStatementAccount(null)} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-100 transition-colors hover:bg-slate-700">{isAr ? 'إغلاق' : 'Close'}</button></div></div></div>}
    <ConfirmModal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} title={isAr ? 'حذف حساب أو عقدة' : 'Delete account or node'} message={isAr ? 'لا يمكن الحذف عند وجود حسابات أو سجلات مرتبطة. هل تريد المتابعة؟' : 'Deletion is blocked when dependent records exist. Continue?'} confirmText={isAr ? 'حذف' : 'Delete'} type="danger" />
  </section>;
}
