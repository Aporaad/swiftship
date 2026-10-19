import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CreditCard, FileClock, Landmark, ListTree, ReceiptText, Settings2, ShieldAlert, Wallet } from 'lucide-react';
import { useRole } from '../../../hooks/useRole';
import { ApiClient } from '../../../data/http/api-client';
import GeneralEntriesTab from '../../../components/finance/GeneralEntriesTab';
import CompoundEntriesTab from '../../../components/finance/CompoundEntriesTab';
import TemporaryEntriesTab from '../../../components/finance/TemporaryEntriesTab';
import ReceiptVouchersTab from '../../../components/finance/ReceiptVouchersTab';
import PaymentVouchersTab from '../../../components/finance/PaymentVouchersTab';
import AccountMovementTab, { type FinanceAccountTransactionRow } from '../../../components/finance/AccountMovementTab';
import CustodyAdvancesTab, { type CustodyAdvanceRow } from '../../../components/finance/CustodyAdvancesTab';
import EntrySettingsTab from '../../../components/finance/EntrySettingsTab';
import PortalPaymentReviewTab from '../../../components/finance/PortalPaymentReviewTab';
import type { FinanceAccount, FinanceCurrency, FinanceEntryType, FinanceModule } from '../../../shared/contracts/finance.contracts';
import { toFinanceCurrencies } from '../../../shared/contracts/finance.contracts';
import type { FinanceEntryRow, FinancePaymentDetailRow } from '../../../components/finance/EntryWorkspaceTab';
import { asyncState, type AsyncState } from '../../../shared/contracts/ui.contracts';
import { isRecord, readString, type UnknownRecord } from '../../../shared/contracts/unknown.contracts';

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined'
      ? null
      : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

const unwrapList = (value: unknown): UnknownRecord[] => {
  const data = (value as { data?: unknown })?.data ?? value;
  if (Array.isArray(data)) return data.filter(isRecord);
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return ((data as { items: unknown[] }).items).filter(isRecord);
  }
  return [];
};

const mapRows = <T,>(value: unknown, mapper: (row: UnknownRecord) => T | null): T[] =>
  unwrapList(value).map(mapper).filter((row): row is T => row !== null);

// الـ API يقبل 1000 صف كحد أقصى لكل صفحة — the API caps every page at 1000 rows,
// so larger inventories are collected page by page instead of over-requesting.
const readAllPages = async (path: string, pageSize = 1000, maxRows = 5000): Promise<UnknownRecord[]> => {
  const rows: UnknownRecord[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const pageRows = unwrapList(
      await apiClient.get<unknown>(path, { limit: pageSize, offset }).catch(() => ({ data: [] })),
    );
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
};
const numberValue = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);
const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalString = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 ? value : undefined;
const booleanValue = (value: unknown): boolean => value === true;

type TabId = 'general' | 'compound' | 'temporary' | 'movement' | 'receipt' | 'payment' | 'portal_payment_review' | 'custody' | 'settings';

const can = (isAdmin: boolean, hasPermission: (key: string) => boolean, precise: string, legacy: string) =>
  isAdmin || hasPermission(precise) || hasPermission(legacy);

export default function FinanceEntriesPage() {
  const { role, profile, hasPermission, loading: roleLoading } = useRole();
  const isAdmin = role === 'Admin';
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [dataQuery, setDataQuery] = useState<AsyncState<null>>({ status: 'loading' });
  const loading = dataQuery.status === 'loading';
  const error = dataQuery.status === 'error' ? dataQuery.error.message : '';
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [currencies, setCurrencies] = useState<FinanceCurrency[]>([]);
  const [modules, setModules] = useState<FinanceModule[]>([]);
  const [entryTypes, setEntryTypes] = useState<FinanceEntryType[]>([]);
  const [entries, setEntries] = useState<FinanceEntryRow[]>([]);
  const [transactions, setTransactions] = useState<FinanceAccountTransactionRow[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<FinancePaymentDetailRow[]>([]);
  const [custodies, setCustodies] = useState<CustodyAdvanceRow[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    try {
      setDataQuery(asyncState.loading());
      // أي فشل في هذه القراءات يصل إلى حالة الخطأ في الأسفل — قائمة حسابات فارغة صامتة تعني واجهة معطوبة.
      // Every core read propagates to the page error state; a silently empty account list would masquerade as a working UI.
      const [currencyResult, accountResult, moduleResult, typeResult, entryResult, transResult, custodyResult, usersResult] = await Promise.all([
        apiClient.get<unknown>('/api/v1/currencies'),
        apiClient.get<unknown>('/api/v1/finance/accounts', { limit: 1000, offset: 0 }),
        apiClient.get<unknown>('/api/v1/finance/entry-modules'),
        apiClient.get<unknown>('/api/v1/finance/entry-types'),
        apiClient.get<unknown>('/api/v1/finance/entries', { limit: 500, offset: 0 }),
        readAllPages('/api/v1/finance/account-movements'),
        apiClient.get<unknown>('/api/v1/finance/custody-advances', { limit: 500, offset: 0 }),
        // أسماء منشئي القيود تزيينية فقط — فشلها لا يُسقط الدفتر، لكنها تُسجَّل.
        // Creator names only decorate rows: their failure is logged, not fatal.
        apiClient.get<unknown>('/api/v1/reporting/users', { limit: 500, offset: 0 })
          .catch((error) => { console.error('[FinanceEntriesPage] تعذر تحميل أسماء المنشئين:', error); return { data: [] }; }),
      ]);

      const uMap = new Map<string, string>();
      for (const user of unwrapList(usersResult)) {
        const userId = readString(user.userId ?? user.user_id);
        if (!userId) continue;
        uMap.set(userId, readString(user.username) || readString(user.fullName ?? user.full_name) || userId);
      }
      setUsersMap(uMap);

      // الأسماء والرموز وحالة التفعيل تصل للقوائم عبر المُحوِّل الموحّد: بدونها تُعرض المعطّلة والكود وحده.
      // Names, symbols and the active flag reach the pickers through the shared mapper.
      const loadedCurrencies = toFinanceCurrencies(unwrapList(currencyResult));
      const currencyCodeById = new Map(loadedCurrencies.map((item) => [item.id, item.code]));
      setCurrencies(loadedCurrencies);

      // الحساب الورقي القابل للقييد هو من يحمل acc_sub_id (subAccountId في الـ API)؛ العُقد الشجرية ليست حسابات.
      // A leaf posting account carries a sub-account id; hierarchy nodes are not postable.
      setAccounts(unwrapList(accountResult).map((item) => ({
        id: stringValue(item.accountId ?? item.id),
        nameAr: readString(item.accountNameAr) || readString(item.accountNameEn) || stringValue(item.accountId ?? item.id),
        nameEn: optionalString(item.accountNameEn),
        curNo: numberValue(item.currencyNo),
        currencyCode: currencyCodeById.get(numberValue(item.currencyNo)) || stringValue(item.currency) || '—',
        isActive: booleanValue(item.isActive),
        isPosting: Boolean(item.subAccountId),
        accSubId: optionalString(item.subAccountId),
        entityId: optionalString(item.entityId),
        entityType: optionalString(item.entityType),
        entityName: readString(item.entityName) || readString(item.accountNameAr) || stringValue(item.accountId ?? item.id),
        balance: numberValue(item.balance),
      })));

      setModules(unwrapList(moduleResult).map((item) => ({
        id: stringValue(item.moduleId ?? item.entry_module_id ?? item.id),
        code: stringValue(item.code),
        nameAr: stringValue(item.nameAr ?? item.name_ar),
        isActive: booleanValue(item.isActive ?? item.is_active),
      })));

      setEntryTypes(unwrapList(typeResult).map((item) => ({
        id: stringValue(item.entryTypeId ?? item.entry_type_id ?? item.id),
        moduleId: stringValue(item.moduleId ?? item.module_id),
        code: stringValue(item.code),
        nameAr: stringValue(item.nameAr ?? item.name_ar),
        isActive: booleanValue(item.isActive ?? item.is_active),
      })));

      const loadedTransactions = mapRows<FinanceAccountTransactionRow>(transResult, (item) => {
        const id = readString(item.transactionId ?? item.account_trans_id ?? item.id);
        const entryId = readString(item.entryId ?? item.main_entry_id);
        const accountId = readString(item.accountId ?? item.account_id);
        if (!id || !entryId || !accountId) return null;
        return {
          id,
          entryId,
          lineNo: numberValue(item.lineNo ?? item.line_no),
          transType: (item.transType ?? item.trans_type) === 'Credit' ? 'Credit' : 'Debit',
          accountId,
          accountCurNo: numberValue(item.accountCurrencyNo ?? item.account_cur_no),
          amount: numberValue(item.amount),
          amountOriginal: numberValue(item.amountOriginal ?? item.amount_original),
          currencyOriginalNo: numberValue(item.currencyOriginalNo ?? item.currency_original_no),
          paymentMethod: optionalString(item.paymentMethod ?? item.payment_method),
          description: readString(item.description) || '',
          orderId: optionalString(item.orderId ?? item.order_id),
          shipmentId: optionalString(item.shipmentId ?? item.shipment_id),
          createdAt: optionalString(item.createdAt ?? item.created_at),
        };
      });
      setTransactions(loadedTransactions);

      // تجميع المبلغ الاصلي والعملة الأصلية للقيد من أسطر account_trans المرافقة
      const transByEntryId = new Map<string, { amountOriginal: number; currencyOriginalNo: number }>();
      for (const t of loadedTransactions) {
        if (!transByEntryId.has(t.entryId)) {
          transByEntryId.set(t.entryId, { amountOriginal: t.amountOriginal, currencyOriginalNo: t.currencyOriginalNo });
        } else if (t.transType === 'Debit') {
          const cur = transByEntryId.get(t.entryId)!;
          transByEntryId.set(t.entryId, { amountOriginal: t.amountOriginal, currencyOriginalNo: t.currencyOriginalNo || cur.currencyOriginalNo });
        }
      }

      setEntries(mapRows<FinanceEntryRow>(entryResult, (item) => {
        const entryId = readString(item.entryId ?? item.main_entry_id ?? item.id);
        if (!entryId) return null;
        const ps = item.postingStatus ?? item.posting_status;
        const postingStatus = ps === 'posted' || ps === 'voided' ? ps : 'draft';
        const transInfo = transByEntryId.get(entryId) || { amountOriginal: 0, currencyOriginalNo: 1 };
        return {
          id: entryId,
          entryNumber: readString(item.entryNumber ?? item.entry_number) || entryId,
          moduleId: stringValue(item.moduleId ?? item.module_id),
          entryTypeId: stringValue(item.entryTypeId ?? item.entry_type_id),
          entryCategory: stringValue(item.entryCategory ?? item.entry_category),
          postingStatus,
          amountOriginal: transInfo.amountOriginal,
          currencyOriginalNo: transInfo.currencyOriginalNo,
          description: readString(item.description) || '',
          paymentMethod: optionalString(item.paymentMethod ?? item.payment_method),
          effectiveAt: optionalString(item.effectiveAt ?? item.effective_at),
          createdAt: stringValue(item.createdAt ?? item.created_at),
          updatedAt: optionalString(item.updatedAt ?? item.updated_at),
          createdByUid: optionalString(item.createdByUid ?? item.created_by_uid),
          updatedByUid: optionalString(item.updatedByUid ?? item.updated_by_uid),
          orderId: optionalString(item.orderId ?? item.order_id),
        };
      }));

      setPaymentDetails([]);

      setCustodies(mapRows<CustodyAdvanceRow>(custodyResult, (item) => {
        const id = readString(item.custodyAdvanceId ?? item.custody_advance_id ?? item.id);
        const recipientId = readString(item.recipientId ?? item.recipient_id);
        const recipientName = readString(item.recipientName ?? item.recipient_name);
        const recipientType = readString(item.recipientType ?? item.recipient_type);
        if (!id || !recipientId || !recipientName || !recipientType) return null;
        return {
          id,
          custodyNumber: stringValue(item.custodyNumber ?? item.custody_number),
          recipientId,
          recipientName,
          recipientType,
          recipientAccountId: optionalString(item.recipientAccountId ?? item.recipient_account_id),
          amountOriginal: numberValue(item.amountOriginal ?? item.amount_original),
          amountOutstanding: numberValue(item.amountOutstanding ?? item.amount_outstanding),
          currencyOriginalNo: numberValue(item.currencyOriginalNo ?? item.currency_original_no),
          status: stringValue(item.status),
          issuedAt: stringValue(item.issuedAt ?? item.issued_at),
        };
      }));

      setDataQuery(asyncState.success(null));
    } catch (cause: unknown) {
      setDataQuery(asyncState.error<null>(cause, 'FINANCE_ENTRIES_LOAD_FAILED'));
    }
  }, []);

  useEffect(() => { if (!roleLoading) void refresh(); }, [refresh, roleLoading]);

  const tabs = useMemo(() => [
    { id: 'general' as const, label: 'القيود العامة', icon: BookOpen, access: can(isAdmin, hasPermission, 'view_general_entries', 'view_finance') },
    { id: 'compound' as const, label: 'القيود المركبة', icon: ListTree, access: can(isAdmin, hasPermission, 'view_compound_entries', 'view_finance') },
    { id: 'temporary' as const, label: 'القيودالمؤقتة', icon: FileClock, access: can(isAdmin, hasPermission, 'view_temporary_entries', 'view_finance') },
    { id: 'receipt' as const, label: 'سندات القبض', icon: ReceiptText, access: can(isAdmin, hasPermission, 'view_receipt_vouchers', 'view_finance') },
    { id: 'payment' as const, label: 'سندات الصرف', icon: CreditCard, access: can(isAdmin, hasPermission, 'view_payment_vouchers', 'view_finance') },
    { id: 'portal_payment_review' as const, label: 'طلبات سداد البوابة', icon: ReceiptText, access: can(isAdmin, hasPermission, 'view_portal_payment_requests', 'view_finance') },
    { id: 'custody' as const, label: 'العهد والسلف', icon: Wallet, access: can(isAdmin, hasPermission, 'view_custody_advances', 'view_custody') },
    { id: 'movement' as const, label: 'حركة الحسابات', icon: Landmark, access: can(isAdmin, hasPermission, 'view_account_movements', 'view_financial_accounts') },
    { id: 'settings' as const, label: 'إعدادات القيود', icon: Settings2, access: can(isAdmin, hasPermission, 'view_entry_settings', 'view_auto_entries') },
  ], [hasPermission, isAdmin]);

  const createdByUid = isRecord(profile) ? readString(profile.id) || readString(profile.uid) : undefined;
  const common = { entries, accounts, currencies, modules, entryTypes, transactions, paymentDetails, createdByUid, usersMap, onChanged: refresh };

  /**
   * بناء صلاحيات التبويب حسب المعرّف والصلاحية القديمة
   * Build tab permissions by subject identifier and legacy permission
   */
  const entryPermissions = (subject: string, legacy: string) => ({
    canView:         can(isAdmin, hasPermission, `view_${subject}`,             legacy),
    canCreate:       can(isAdmin, hasPermission, `create_${subject}`,           subject.includes('payment') ? 'create_payment_vouchers' : 'add_finance'),
    canEdit:         can(isAdmin, hasPermission, `edit_${subject}`,             subject.includes('payment') ? 'edit_payment_vouchers' : 'edit_finance'),
    canPost:         can(isAdmin, hasPermission, `post_${subject}`,             can(isAdmin, hasPermission, subject === 'temporary_entries' ? 'post_temporary_entries' : 'post_financial_entries', 'add_finance') ? subject === 'temporary_entries' ? 'post_temporary_entries' : 'post_financial_entries' : 'add_finance'),
    canDelete:       can(isAdmin, hasPermission, `delete_${subject}`,           subject.includes('payment') ? 'delete_payment_vouchers' : 'edit_finance'),
    canVoid:         can(isAdmin, hasPermission, 'void_financial_entries',      'edit_finance'),
    canReverse:      can(isAdmin, hasPermission, 'reverse_financial_entries',   'edit_finance'),
    // صلاحيات جديدة — New permissions
    canPrint:        can(isAdmin, hasPermission, `print_${subject}`,            'view_finance'),
    canExport:       can(isAdmin, hasPermission, `export_${subject}`,           'view_finance'),
    canEditPosted:   can(isAdmin, hasPermission, `edit_posted_${subject}`,      'edit_finance'),
    canDeletePosted: can(isAdmin, hasPermission, `delete_posted_${subject}`,    subject.includes('payment') ? 'delete_posted_payment_vouchers' : 'edit_finance'),
    canUnpostOrder:  can(isAdmin, hasPermission, 'unpost_posted_orders',        'edit_orders'),
  });


  if (roleLoading || loading) return <div className="flex min-h-72 items-center justify-center text-sm font-bold text-slate-400">جارٍ تحميل القيود والسندات…</div>;
  if (!tabs.some((tab) => tab.access)) return <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-950/70 p-12 text-center"><ShieldAlert className="h-12 w-12 text-rose-400" /><h1 className="mt-4 text-xl font-black text-white">لا توجد صلاحية مالية</h1><p className="mt-2 text-sm text-slate-400">اطلب من المسؤول تفعيل صلاحية استعراض الواجهة المالية المناسبة.</p></div>;

  return <div className="space-y-6 pb-20" dir="rtl">
    <header className="relative overflow-hidden rounded-3xl border border-[#d4af37]/25 bg-gradient-to-l from-slate-950 via-slate-900 to-slate-950 p-6 shadow-xl">
      <div className="absolute -left-12 -top-20 h-48 w-48 rounded-full bg-[#d4af37]/10 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3"><div className="rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10 p-3 text-[#f4d870]"><BookOpen className="h-7 w-7" /></div><div><h1 className="text-2xl font-black text-white">القيود والسندات</h1><p className="mt-1 max-w-2xl text-xs text-slate-400">دفتر موحد بأعمدة مالية صريحة، وتوازن بعملة الرأس وأرصدة بعملة الحساب.</p></div></div>
        <button onClick={() => void refresh()} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">تحديث البيانات</button>
      </div>
    </header>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">{error}</div>}
    <nav className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">{tabs.filter((tab) => tab.access).map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${activeTab === tab.id ? 'bg-[#d4af37] text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}><tab.icon className="h-4 w-4" />{tab.label}</button>)}</nav>
    {activeTab === 'general'   && <GeneralEntriesTab   {...common} {...entryPermissions('general_entries',   'view_finance')} />}
    {activeTab === 'compound'  && <CompoundEntriesTab  {...common} {...entryPermissions('compound_entries',  'view_finance')} />}
    {activeTab === 'temporary' && <TemporaryEntriesTab {...common} {...entryPermissions('temporary_entries', 'view_finance')} />}
    {activeTab === 'receipt'   && <ReceiptVouchersTab  {...common} {...entryPermissions('receipt_vouchers',  'view_finance')} />}
    {activeTab === 'payment'   && <PaymentVouchersTab  {...common} {...entryPermissions('payment_vouchers',  'view_payment_vouchers')} />}
    {activeTab === 'portal_payment_review' && <PortalPaymentReviewTab isAr canReview={isAdmin || hasPermission('view_finance')} />}
    {activeTab === 'movement'  && <AccountMovementTab  lines={transactions} entries={entries} accounts={accounts} currencies={currencies} canView={can(isAdmin, hasPermission, 'view_account_movements', 'view_financial_accounts')} canExport={can(isAdmin, hasPermission, 'export_account_movements', 'view_financial_accounts')} canPrint={can(isAdmin, hasPermission, 'print_account_movements', 'view_financial_accounts')} />}
    {activeTab === 'custody'   && <CustodyAdvancesTab  items={custodies} accounts={accounts} currencies={currencies} canView={can(isAdmin, hasPermission, 'view_custody_advances', 'view_custody')} canCreate={can(isAdmin, hasPermission, 'create_custody_advances', 'create_finance')} canSettle={can(isAdmin, hasPermission, 'settle_custody_advances', 'edit_finance')} createdByUid={createdByUid} onChanged={refresh} />}
    {activeTab === 'settings'  && <EntrySettingsTab    modules={modules} entryTypes={entryTypes} canView={can(isAdmin, hasPermission, 'view_entry_settings', 'view_auto_entries')} canCreate={can(isAdmin, hasPermission, 'create_entry_settings', 'add_auto_entries')} canEdit={can(isAdmin, hasPermission, 'edit_entry_settings', 'edit_auto_entries')} canDelete={can(isAdmin, hasPermission, 'delete_entry_settings', 'delete_auto_entries')} onChanged={refresh} />}
  </div>;
}
