import { useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import type { FinanceAccount, FinanceCurrency } from './EntryForm';
import type { FinanceEntryRow } from './EntryWorkspaceTab';

export interface FinanceAccountTransactionRow {
  id: string;
  entryId: string;
  lineNo: number;
  transType: 'Debit' | 'Credit';
  accountId: string;
  accountCurNo: number;
  amount: number;
  amountOriginal: number;
  currencyOriginalNo: number;
  paymentMethod?: string;
  description: string;
  orderId?: string;
  shipmentId?: string;
  createdAt?: string;
}

interface Props {
  lines: FinanceAccountTransactionRow[];
  entries: FinanceEntryRow[];
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  canView: boolean;
  canExport: boolean;
  canPrint: boolean;
}

const toCsvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function AccountMovementTab({ lines, entries, accounts, currencies, canView, canExport, canPrint }: Props) {
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const currencyById = useMemo(() => new Map(currencies.map((currency) => [currency.id, currency.code])), [currencies]);
  const visible = useMemo(() => lines.filter((line) => {
    const entry = entryById.get(line.entryId);
    const text = `${line.accountId} ${accountById.get(line.accountId)?.nameAr || ''} ${entry?.entryNumber || ''} ${line.description || ''}`.toLowerCase();
    return (!accountId || line.accountId === accountId) && (!search || text.includes(search.toLowerCase()));
  }), [accountById, accountId, entryById, lines, search]);

  const accountBalance = useMemo(() => accountId ? lines.filter((line) => line.accountId === accountId).reduce((sum, line) => {
    const account = accountById.get(line.accountId);
    const normalDebit = account?.id ? !String(account.id).startsWith('2') && !String(account.id).startsWith('3') && !String(account.id).startsWith('4') : true;
    const direction = (normalDebit ? line.transType === 'Debit' : line.transType === 'Credit') ? 1 : -1;
    return sum + direction * Number(line.amount || 0);
  }, 0) : null, [accountById, accountId, lines]);

  const exportCsv = () => {
    const heading = ['رقم القيد', 'الحساب', 'نوع الساق', 'المبلغ بعملة الحساب', 'عملة الحساب', 'المبلغ الأصلي', 'عملة الرأس', 'طريقة الدفع', 'البيان'];
    const rows = visible.map((line) => [entryById.get(line.entryId)?.entryNumber, line.accountId, line.transType === 'Debit' ? 'مدين' : 'دائن', line.amount, currencyById.get(line.accountCurNo), line.amountOriginal, currencyById.get(line.currencyOriginalNo), line.paymentMethod, line.description]);
    const blob = new Blob([[heading, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `account-movements-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  if (!canView) return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center text-sm font-bold text-slate-400">لا تملك صلاحية استعراض حركة الحسابات.</div>;
  return <section className="space-y-4" dir="rtl"><header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><div><h2 className="text-lg font-black text-white">حركة الحسابات</h2><p className="mt-1 text-xs text-slate-400">كل سطر يعرض مبلغه بعملة الحساب، أما توازن السند فيبقى بعملة الرأس.</p></div><div className="flex gap-2">{canExport && <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-bold text-cyan-200"><Download className="h-4 w-4" />CSV</button>}{canPrint && <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold text-slate-200"><Printer className="h-4 w-4" />طباعة</button>}</div></header><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="">كل الحسابات الورقية</option>{accounts.filter((account) => account.isPosting).map((account) => <option key={account.id} value={account.id}>{account.id} — {account.nameAr}</option>)}</select><label className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث في السند أو البيان أو الحساب" className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pr-10 pl-3 text-sm text-white" /></label>{accountBalance !== null && <div className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-2 text-center text-xs font-black text-[#f4d870]">الرصيد: {accountBalance.toLocaleString()} {currencyById.get(accountById.get(accountId)?.curNo || 0)}</div>}</div><div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60"><table className="min-w-[1040px] w-full text-right text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="px-3 py-3">السند</th><th className="px-3 py-3">الحساب</th><th className="px-3 py-3">مدين</th><th className="px-3 py-3">دائن</th><th className="px-3 py-3">عملة الحساب</th><th className="px-3 py-3">الأصلي</th><th className="px-3 py-3">طريقة الدفع</th><th className="px-3 py-3">البيان</th></tr></thead><tbody>{visible.map((line) => <tr key={line.id} className="border-t border-slate-800 text-slate-200"><td className="px-3 py-3 font-mono text-[#d4af37]">{entryById.get(line.entryId)?.entryNumber || line.entryId}</td><td className="px-3 py-3"><div className="font-black">{accountById.get(line.accountId)?.nameAr || line.accountId}</div><div className="font-mono text-[10px] text-slate-500">{line.accountId}</div></td><td className="px-3 py-3 font-black text-emerald-300">{line.transType === 'Debit' ? Number(line.amount).toLocaleString() : '—'}</td><td className="px-3 py-3 font-black text-amber-300">{line.transType === 'Credit' ? Number(line.amount).toLocaleString() : '—'}</td><td className="px-3 py-3">{currencyById.get(line.accountCurNo) || '—'}</td><td className="px-3 py-3">{Number(line.amountOriginal).toLocaleString()} {currencyById.get(line.currencyOriginalNo)}</td><td className="px-3 py-3">{line.paymentMethod || '—'}</td><td className="max-w-80 px-3 py-3">{line.description}</td></tr>)}{visible.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">لا توجد حركة مطابقة.</td></tr>}</tbody></table></div></section>;
}
