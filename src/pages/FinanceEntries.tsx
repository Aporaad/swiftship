import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CreditCard, FileClock, Landmark, ListTree, ReceiptText, Settings2, ShieldAlert, Wallet } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase-firebase-adapter';
import GeneralEntriesTab from '../components/finance/GeneralEntriesTab';
import CompoundEntriesTab from '../components/finance/CompoundEntriesTab';
import TemporaryEntriesTab from '../components/finance/TemporaryEntriesTab';
import ReceiptVouchersTab from '../components/finance/ReceiptVouchersTab';
import PaymentVouchersTab from '../components/finance/PaymentVouchersTab';
import AccountMovementTab, { type FinanceAccountTransactionRow } from '../components/finance/AccountMovementTab';
import CustodyAdvancesTab, { type CustodyAdvanceRow } from '../components/finance/CustodyAdvancesTab';
import EntrySettingsTab from '../components/finance/EntrySettingsTab';
import type { FinanceAccount, FinanceCurrency, FinanceEntryType, FinanceModule } from '../components/finance/EntryForm';
import type { FinanceEntryRow, FinancePaymentDetailRow } from '../components/finance/EntryWorkspaceTab';

type TabId = 'general' | 'compound' | 'temporary' | 'movement' | 'receipt' | 'payment' | 'custody' | 'settings';

const can = (isAdmin: boolean, hasPermission: (key: any) => boolean, precise: string, legacy: string) =>
  isAdmin || hasPermission(precise as any) || hasPermission(legacy as any);

export default function FinanceEntries() {
  const { role, profile, hasPermission, loading: roleLoading } = useRole();
  const isAdmin = role === 'Admin';
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      setLoading(true);
      setError('');
      const [currencyResult, accountResult, moduleResult, typeResult, entryResult, transResult, paymentDetailResult, custodyResult, usersResult] = await Promise.all([
        (supabase as any).from('currency').select('cur_id, code, isDefault').eq('isActive', true).order('cur_id'),
        (supabase as any).from('accounts').select('id, acc_name_ar, acc_name_en, cur_no, is_active, acc_sub_id, entity_id, entity_type').order('id'),
        (supabase as any).from('entry_module').select('id, code, name_ar, is_active').order('name_ar'),
        (supabase as any).from('entry_type').select('id, module_id, code, name_ar, is_active').order('name_ar'),
        (supabase as any).from('main_entry').select('id, entry_number, module_id, entry_type_id, entry_category, posting_status, description, payment_method, effective_at, created_at, updated_at, created_by_uid, updated_by_uid, order_id').order('effective_at', { ascending: false }).limit(500),
        (supabase as any).from('account_trans').select('id, entry_id, line_no, trans_type, account_id, account_cur_no, amount, amount_original, currency_original_no, payment_method, description, order_id, shipment_id, created_at').order('created_at', { ascending: false }).limit(1500),
        (supabase as any).from('entry_payment_details').select('id, entry_id, payment_method, account_id, amount_original, bank_reference, due_at, note').order('entry_id').order('allocation_no').limit(1500),
        (supabase as any).from('custody_advances').select('id, custody_number, recipient_id, recipient_name, recipient_type, recipient_account_id, amount_original, amount_outstanding, currency_original_no, status, issued_at').order('issued_at', { ascending: false }).limit(500),
        (supabase as any).from('users').select('id, username, data').limit(500),
      ]);
      const failure = [currencyResult, accountResult, moduleResult, typeResult, entryResult, transResult, paymentDetailResult, custodyResult].find((result: any) => result.error)?.error;
      if (failure) throw new Error(failure.message || String(failure));

      const uMap = new Map<string, string>();
      for (const u of usersResult.data || []) {
        const uName = u.username || u.data?.fullName || u.data?.fullNameAr || u.id;
        uMap.set(u.id, uName);
      }
      setUsersMap(uMap);

      const loadedCurrencies = (currencyResult.data || []).map((item: any) => ({ id: Number(item.cur_id), code: item.code, isDefault: Boolean(item.isDefault) }));
      const currencyCodeById = new Map(loadedCurrencies.map((item) => [item.id, item.code]));
      setCurrencies(loadedCurrencies);
      setAccounts((accountResult.data || []).map((item: any) => ({
        id: item.id, nameAr: item.acc_name_ar || item.id, nameEn: item.acc_name_en,
        curNo: Number(item.cur_no), currencyCode: currencyCodeById.get(Number(item.cur_no)) || '—',
        isActive: Boolean(item.is_active), isPosting: Boolean(item.acc_sub_id), accSubId: item.acc_sub_id || undefined, entityId: item.entity_id || undefined,
        entityType: item.entity_type || undefined, entityName: item.acc_name_ar || item.acc_name_en || item.id,
      })));
      setModules((moduleResult.data || []).map((item: any) => ({ id: item.id, code: item.code, nameAr: item.name_ar, isActive: Boolean(item.is_active) })));
      setEntryTypes((typeResult.data || []).map((item: any) => ({ id: item.id, moduleId: item.module_id, code: item.code, nameAr: item.name_ar, isActive: Boolean(item.is_active) })));

      const loadedTransactions = (transResult.data || []).map((item: any) => ({
        id: item.id, entryId: item.entry_id, lineNo: Number(item.line_no), transType: item.trans_type,
        accountId: item.account_id, accountCurNo: Number(item.account_cur_no), amount: Number(item.amount),
        amountOriginal: Number(item.amount_original), currencyOriginalNo: Number(item.currency_original_no),
        paymentMethod: item.payment_method, description: item.description, orderId: item.order_id, shipmentId: item.shipment_id, createdAt: item.created_at,
      }));
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

      setEntries((entryResult.data || []).map((item: any) => {
        const transInfo = transByEntryId.get(item.id) || { amountOriginal: 0, currencyOriginalNo: 1 };
        return {
          id: item.id, entryNumber: item.entry_number, moduleId: item.module_id, entryTypeId: item.entry_type_id,
          entryCategory: item.entry_category, postingStatus: item.posting_status, amountOriginal: transInfo.amountOriginal,
          currencyOriginalNo: transInfo.currencyOriginalNo, description: item.description, paymentMethod: item.payment_method,
          effectiveAt: item.effective_at, createdAt: item.created_at, updatedAt: item.updated_at,
          createdByUid: item.created_by_uid, updatedByUid: item.updated_by_uid, orderId: item.order_id,
        };
      }));
      setPaymentDetails((paymentDetailResult.data || []).map((item: any) => ({
        id: item.id, entryId: item.entry_id, paymentMethod: item.payment_method, accountId: item.account_id,
        amountOriginal: Number(item.amount_original), bankReference: item.bank_reference, dueAt: item.due_at, note: item.note,
      })));
      setCustodies((custodyResult.data || []).map((item: any) => ({
        id: item.id, custodyNumber: item.custody_number, recipientId: item.recipient_id, recipientName: item.recipient_name, recipientType: item.recipient_type,
        recipientAccountId: item.recipient_account_id, amountOriginal: Number(item.amount_original), amountOutstanding: Number(item.amount_outstanding),
        currencyOriginalNo: Number(item.currency_original_no), status: item.status, issuedAt: item.issued_at,
      })));
    } catch (cause: any) {
      setError(cause?.message || 'تعذر تحميل بيانات القيود الجديدة.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!roleLoading) void refresh(); }, [refresh, roleLoading]);

  const tabs = useMemo(() => [
    { id: 'general' as const, label: 'القيود العامة', icon: BookOpen, access: can(isAdmin, hasPermission, 'view_general_entries', 'view_finance') },
    { id: 'compound' as const, label: 'القيود المركبة', icon: ListTree, access: can(isAdmin, hasPermission, 'view_compound_entries', 'view_finance') },
    { id: 'temporary' as const, label: 'القيودالمؤقتة', icon: FileClock, access: can(isAdmin, hasPermission, 'view_temporary_entries', 'view_finance') },
    { id: 'receipt' as const, label: 'سندات القبض', icon: ReceiptText, access: can(isAdmin, hasPermission, 'view_receipt_vouchers', 'view_finance') },
    { id: 'payment' as const, label: 'سندات الصرف', icon: CreditCard, access: can(isAdmin, hasPermission, 'view_payment_vouchers', 'view_expenses') },
    { id: 'custody' as const, label: 'العهد والسلف', icon: Wallet, access: can(isAdmin, hasPermission, 'view_custody_advances', 'view_custody') },
    { id: 'movement' as const, label: 'حركة الحسابات', icon: Landmark, access: can(isAdmin, hasPermission, 'view_account_movements', 'view_financial_accounts') },
    { id: 'settings' as const, label: 'إعدادات القيود', icon: Settings2, access: can(isAdmin, hasPermission, 'view_entry_settings', 'view_auto_entries') },
  ], [hasPermission, isAdmin]);

  const createdByUid = (profile as any)?.id || (profile as any)?.uid || undefined;
  const common = { entries, accounts, currencies, modules, entryTypes, transactions, paymentDetails, createdByUid, usersMap, onChanged: refresh };

  /**
   * بناء صلاحيات التبويب حسب المعرّف والصلاحية القديمة
   * Build tab permissions by subject identifier and legacy permission
   */
  const entryPermissions = (subject: string, legacy: string) => ({
    canView:         can(isAdmin, hasPermission, `view_${subject}`,             legacy),
    canCreate:       can(isAdmin, hasPermission, `create_${subject}`,           subject.includes('payment') ? 'add_expenses' : 'add_finance'),
    canEdit:         can(isAdmin, hasPermission, `edit_${subject}`,             subject.includes('payment') ? 'edit_expenses' : 'edit_finance'),
    canPost:         can(isAdmin, hasPermission, `post_${subject}`,             can(isAdmin, hasPermission, subject === 'temporary_entries' ? 'post_temporary_entries' : 'post_financial_entries', 'add_finance') ? subject === 'temporary_entries' ? 'post_temporary_entries' : 'post_financial_entries' : 'add_finance'),
    canDelete:       can(isAdmin, hasPermission, `delete_${subject}`,           subject.includes('payment') ? 'delete_expenses' : 'edit_finance'),
    canVoid:         can(isAdmin, hasPermission, 'void_financial_entries',      'edit_finance'),
    canReverse:      can(isAdmin, hasPermission, 'reverse_financial_entries',   'edit_finance'),
    // صلاحيات جديدة — New permissions
    canPrint:        can(isAdmin, hasPermission, `print_${subject}`,            'view_finance'),
    canExport:       can(isAdmin, hasPermission, `export_${subject}`,           'view_finance'),
    canEditPosted:   can(isAdmin, hasPermission, `edit_posted_${subject}`,      'edit_finance'),
    canDeletePosted: can(isAdmin, hasPermission, `delete_posted_${subject}`,    subject.includes('payment') ? 'delete_expenses' : 'edit_finance'),
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
    {activeTab === 'payment'   && <PaymentVouchersTab  {...common} {...entryPermissions('payment_vouchers',  'view_expenses')} />}
    {activeTab === 'movement'  && <AccountMovementTab  lines={transactions} entries={entries} accounts={accounts} currencies={currencies} canView={can(isAdmin, hasPermission, 'view_account_movements', 'view_financial_accounts')} canExport={can(isAdmin, hasPermission, 'export_account_movements', 'view_financial_accounts')} canPrint={can(isAdmin, hasPermission, 'print_account_movements', 'view_financial_accounts')} />}
    {activeTab === 'custody'   && <CustodyAdvancesTab  items={custodies} accounts={accounts} currencies={currencies} canView={can(isAdmin, hasPermission, 'view_custody_advances', 'view_custody')} canCreate={can(isAdmin, hasPermission, 'create_custody_advances', 'add_expenses')} canSettle={can(isAdmin, hasPermission, 'settle_custody_advances', 'edit_expenses')} createdByUid={createdByUid} onChanged={refresh} />}
    {activeTab === 'settings'  && <EntrySettingsTab    modules={modules} entryTypes={entryTypes} canView={can(isAdmin, hasPermission, 'view_entry_settings', 'view_auto_entries')} canCreate={can(isAdmin, hasPermission, 'create_entry_settings', 'add_auto_entries')} canEdit={can(isAdmin, hasPermission, 'edit_entry_settings', 'edit_auto_entries')} canDelete={can(isAdmin, hasPermission, 'delete_entry_settings', 'delete_auto_entries')} onChanged={refresh} />}
  </div>;
}
