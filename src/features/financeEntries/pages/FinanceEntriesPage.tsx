import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CreditCard, FileClock, Landmark, ListTree, ReceiptText, Settings2, ShieldAlert, Wallet } from 'lucide-react';
import { useRole } from '../../../hooks/useRole';
import { supabase } from '../../../data/legacy/legacy-compat.ts';
import GeneralEntriesTab from '../../../components/finance/GeneralEntriesTab';
import CompoundEntriesTab from '../../../components/finance/CompoundEntriesTab';
import TemporaryEntriesTab from '../../../components/finance/TemporaryEntriesTab';
import ReceiptVouchersTab from '../../../components/finance/ReceiptVouchersTab';
import PaymentVouchersTab from '../../../components/finance/PaymentVouchersTab';
import AccountMovementTab, { type FinanceAccountTransactionRow } from '../../../components/finance/AccountMovementTab';
import CustodyAdvancesTab, { type CustodyAdvanceRow } from '../../../components/finance/CustodyAdvancesTab';
import EntrySettingsTab from '../../../components/finance/EntrySettingsTab';
import type { FinanceAccount, FinanceCurrency, FinanceEntryType, FinanceModule } from '../../../shared/contracts/finance.contracts';
import type { FinanceEntryRow, FinancePaymentDetailRow } from '../../../components/finance/EntryWorkspaceTab';
import { asyncState, type AsyncState } from '../../../shared/contracts/ui.contracts';
import { isRecord, readString, type UnknownRecord } from '../../../shared/contracts/unknown.contracts';

type FinanceTable = 'currency' | 'accounts' | 'entry_module' | 'entry_type' | 'main_entry' | 'account_trans' | 'entry_payment_details' | 'custody_advances' | 'users';
interface FinanceQueryResult { data: unknown[] | null; error: unknown | null }
interface FinanceQuery extends PromiseLike<FinanceQueryResult> {
  select(columns: string): FinanceQuery;
  eq(column: string, value: unknown): FinanceQuery;
  order(column: string, options?: { ascending?: boolean }): FinanceQuery;
  limit(count: number): FinanceQuery;
}
interface FinanceSupabaseClient { from(table: FinanceTable): FinanceQuery }

const financeClient = supabase as unknown as FinanceSupabaseClient;
const rows = (value: unknown): UnknownRecord[] => Array.isArray(value) ? value.filter(isRecord) : [];
const mapRows = <T,>(value: unknown, mapper: (row: UnknownRecord) => T | null): T[] =>
  rows(value).map(mapper).filter((row): row is T => row !== null);
const numberValue = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);
const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalString = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 ? value : undefined;
const booleanValue = (value: unknown): boolean => value === true;
const rowError = (value: unknown): string => isRecord(value) && typeof value.message === 'string' ? value.message : 'Database request failed';

type TabId = 'general' | 'compound' | 'temporary' | 'movement' | 'receipt' | 'payment' | 'custody' | 'settings';

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
      const [currencyResult, accountResult, moduleResult, typeResult, entryResult, transResult, paymentDetailResult, custodyResult, usersResult] = await Promise.all([
        financeClient.from('currency').select('cur_id, code, is_default, is_active').eq('is_active', true).order('cur_id'),
        financeClient.from('accounts').select('account_id, acc_name_ar, acc_name_en, cur_no, is_active, acc_sub_id, entity_id, entity_type').order('account_id'),
        financeClient.from('entry_module').select('entry_module_id, code, name_ar, is_active').order('name_ar'),
        financeClient.from('entry_type').select('entry_type_id, module_id, code, name_ar, is_active').order('name_ar'),
        financeClient.from('main_entry').select('main_entry_id, entry_number, module_id, entry_type_id, entry_category, posting_status, description, payment_method, effective_at, created_at, updated_at, created_by_uid, updated_by_uid, order_id').order('effective_at', { ascending: false }).limit(500),
        financeClient.from('account_trans').select('account_trans_id, main_entry_id, line_no, trans_type, account_id, account_cur_no, amount, amount_original, currency_original_no, payment_method, description, order_id, shipment_id, created_at').order('created_at', { ascending: false }).limit(1500),
        financeClient.from('entry_payment_details').select('entry_payment_detail_id, main_entry_id, payment_method, account_id, amount_original, bank_reference, due_at, note').order('main_entry_id').order('allocation_no').limit(1500),
        financeClient.from('custody_advances').select('custody_advance_id, custody_number, recipient_id, recipient_name, recipient_type, recipient_account_id, amount_original, amount_outstanding, currency_original_no, status, issued_at').order('issued_at', { ascending: false }).limit(500),
        financeClient.from('users').select('user_id, username, full_name').limit(500),
      ]);
      const failure = [currencyResult, accountResult, moduleResult, typeResult, entryResult, transResult, paymentDetailResult, custodyResult, usersResult].find((result) => result.error !== null)?.error;
      if (failure) throw new Error(rowError(failure));

      const uMap = new Map<string, string>();
      for (const user of rows(usersResult.data)) {
        const userId = readString(user.user_id);
        if (!userId) continue;
        uMap.set(userId, readString(user.username) || readString(user.full_name) || userId);
      }
      setUsersMap(uMap);

      const loadedCurrencies = rows(currencyResult.data).map((item) => ({ id: numberValue(item.cur_id), code: stringValue(item.code), isDefault: booleanValue(item.is_default) }));
      const currencyCodeById = new Map(loadedCurrencies.map((item: { id: number; code: string }) => [item.id, item.code]));
      setCurrencies(loadedCurrencies);
      setAccounts(rows(accountResult.data).map((item) => ({
        id: stringValue(item.account_id), nameAr: readString(item.acc_name_ar) || readString(item.acc_name_en) || stringValue(item.account_id), nameEn: optionalString(item.acc_name_en),
        curNo: numberValue(item.cur_no), currencyCode: currencyCodeById.get(numberValue(item.cur_no)) || '—',
        isActive: booleanValue(item.is_active), isPosting: Boolean(item.acc_sub_id), accSubId: optionalString(item.acc_sub_id), entityId: optionalString(item.entity_id),
        entityType: optionalString(item.entity_type), entityName: readString(item.acc_name_ar) || readString(item.acc_name_en) || stringValue(item.account_id),
      })));
      setModules(rows(moduleResult.data).map((item) => ({ id: stringValue(item.entry_module_id), code: stringValue(item.code), nameAr: stringValue(item.name_ar), isActive: booleanValue(item.is_active) })));
      setEntryTypes(rows(typeResult.data).map((item) => ({ id: stringValue(item.entry_type_id), moduleId: stringValue(item.module_id), code: stringValue(item.code), nameAr: stringValue(item.name_ar), isActive: booleanValue(item.is_active) })));

      const loadedTransactions = mapRows<FinanceAccountTransactionRow>(transResult.data, (item) => {
        const id = readString(item.account_trans_id);
        const entryId = readString(item.main_entry_id);
        const accountId = readString(item.account_id);
        if (!id || !entryId || !accountId) return null;
        return {
        id, entryId, lineNo: numberValue(item.line_no), transType: item.trans_type === 'Credit' ? 'Credit' : 'Debit',
        accountId, accountCurNo: numberValue(item.account_cur_no), amount: numberValue(item.amount),
        amountOriginal: numberValue(item.amount_original), currencyOriginalNo: numberValue(item.currency_original_no),
        paymentMethod: optionalString(item.payment_method), description: readString(item.description) || '', orderId: optionalString(item.order_id), shipmentId: optionalString(item.shipment_id), createdAt: optionalString(item.created_at),
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

      setEntries(mapRows<FinanceEntryRow>(entryResult.data, (item) => {
        const entryId = readString(item.main_entry_id);
        if (!entryId) return null;
        const postingStatus = item.posting_status === 'posted' || item.posting_status === 'voided' ? item.posting_status : 'draft';
        const transInfo = transByEntryId.get(entryId) || { amountOriginal: 0, currencyOriginalNo: 1 };
        return {
          id: entryId, entryNumber: readString(item.entry_number) || entryId, moduleId: stringValue(item.module_id), entryTypeId: stringValue(item.entry_type_id),
          entryCategory: stringValue(item.entry_category), postingStatus, amountOriginal: transInfo.amountOriginal,
          currencyOriginalNo: transInfo.currencyOriginalNo, description: readString(item.description) || '', paymentMethod: optionalString(item.payment_method),
          effectiveAt: optionalString(item.effective_at), createdAt: stringValue(item.created_at), updatedAt: optionalString(item.updated_at),
          createdByUid: optionalString(item.created_by_uid), updatedByUid: optionalString(item.updated_by_uid), orderId: optionalString(item.order_id),
        };
      }));
      setPaymentDetails(mapRows<FinancePaymentDetailRow>(paymentDetailResult.data, (item) => {
        const id = readString(item.entry_payment_detail_id);
        const entryId = readString(item.main_entry_id);
        const accountId = readString(item.account_id);
        const method = item.payment_method;
        if (!id || !entryId || !accountId || (method !== 'cash' && method !== 'bank' && method !== 'deferred')) return null;
        return {
        id, entryId, paymentMethod: method, accountId,
        amountOriginal: numberValue(item.amount_original), bankReference: optionalString(item.bank_reference), dueAt: optionalString(item.due_at), note: optionalString(item.note),
        };
      }));
      setCustodies(mapRows<CustodyAdvanceRow>(custodyResult.data, (item) => {
        const id = readString(item.custody_advance_id);
        const recipientId = readString(item.recipient_id);
        const recipientName = readString(item.recipient_name);
        const recipientType = readString(item.recipient_type);
        if (!id || !recipientId || !recipientName || !recipientType) return null;
        return {
        id, custodyNumber: stringValue(item.custody_number), recipientId, recipientName, recipientType,
        recipientAccountId: optionalString(item.recipient_account_id), amountOriginal: numberValue(item.amount_original), amountOutstanding: numberValue(item.amount_outstanding),
        currencyOriginalNo: numberValue(item.currency_original_no), status: stringValue(item.status), issuedAt: stringValue(item.issued_at),
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
    {activeTab === 'movement'  && <AccountMovementTab  lines={transactions} entries={entries} accounts={accounts} currencies={currencies} canView={can(isAdmin, hasPermission, 'view_account_movements', 'view_financial_accounts')} canExport={can(isAdmin, hasPermission, 'export_account_movements', 'view_financial_accounts')} canPrint={can(isAdmin, hasPermission, 'print_account_movements', 'view_financial_accounts')} />}
    {activeTab === 'custody'   && <CustodyAdvancesTab  items={custodies} accounts={accounts} currencies={currencies} canView={can(isAdmin, hasPermission, 'view_custody_advances', 'view_custody')} canCreate={can(isAdmin, hasPermission, 'create_custody_advances', 'create_finance')} canSettle={can(isAdmin, hasPermission, 'settle_custody_advances', 'edit_finance')} createdByUid={createdByUid} onChanged={refresh} />}
    {activeTab === 'settings'  && <EntrySettingsTab    modules={modules} entryTypes={entryTypes} canView={can(isAdmin, hasPermission, 'view_entry_settings', 'view_auto_entries')} canCreate={can(isAdmin, hasPermission, 'create_entry_settings', 'add_auto_entries')} canEdit={can(isAdmin, hasPermission, 'edit_entry_settings', 'edit_auto_entries')} canDelete={can(isAdmin, hasPermission, 'delete_entry_settings', 'delete_auto_entries')} onChanged={refresh} />}
  </div>;
}
