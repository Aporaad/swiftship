import React, { useEffect, useMemo, useState } from 'react';
import { Flame, ChevronDown, Plus, Minus, RotateCw, Download, Trash2, Eye, EyeOff, Copy, FileText } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, limit, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import FinanceReports from './FinanceReports';
import { notificationService } from '../services/notificationService';
import { financialAccountService } from '../services/financialAccountService';

interface FinanceAccountingProps {
  orders: any[];
  expenses: any[];
  couriers: any[];
  customers: any[];
  isAr: boolean;
  settings: any;
}

export default function FinanceAccounting({ orders, expenses, couriers, customers, isAr, settings }: FinanceAccountingProps) {
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [newAccountForm, setNewAccountForm] = useState({ entityType: '', entityId: '', entityName: '' });
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  // Real-time financial accounts sync
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  // Real-time account transactions sync
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'assets'), (snap) => {
      setAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Apply limit to recent transactions for performance, older ones can be fetched via reports or specific audits
    const q = query(
      collection(db, 'account_transactions'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAccountTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading account transactions:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), (snap) => {
      setFinancialAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const convertToYER = (amount: number, currency: string): number => {
    if (currency === 'YER') return amount;
    if (currency === 'USD') return amount * (settings.exchangeRateUSD || 535);
    if (currency === 'SAR') return amount * (settings.exchangeRateSAR || 140);
    return amount;
  };

  const ledgerEntries = useMemo(() => {
    const entries: any[] = [];

    // Use account transactions for a more accurate and centralized ledger
    accountTransactions.forEach(tx => {
      const convertedAmt = tx.amount; // amount is already in default currency (YER)
      const date = new Date(tx.createdAt || Date.now());

      let type: 'Debit' | 'Credit' = tx.type;
      let title = tx.description || tx.title;
      let party = tx.entityName;

      // In asset accounting for the Safe Box/Treasury:
      // - Payment received from customer (Credit on their account) = Debit (Inflow) for Treasury
      // - Charge to customer (Debit on their account) = Potential Revenue (not cash flow yet, usually handled by actual payments)
      // - Payment to courier/employee (Credit on their account) = Credit (Outflow) for Treasury
      // - Returning custody (Debit on courier account) = Debit (Inflow) for Treasury

      if (tx.entityType === 'customer') {
        if (tx.type === 'Credit') {
          // Cash coming in
          entries.push({
            id: `TX-${tx.id}`,
            refNumber: tx.refNumber || 'ALX-TX',
            date,
            title: isAr ? `تحصيل من العميل: ${tx.entityName}` : `Collection from customer: ${tx.entityName}`,
            notes: tx.description,
            party: tx.entityName,
            type: 'Debit',
            amount: convertedAmt,
            currency: 'YER',
            amountOriginal: tx.amountOriginal,
            currencyOriginal: tx.currencyOriginal,
            module: tx.module
          });
        }
      } else {
        if (tx.type === 'Credit') {
          // Cash going out
          entries.push({
            id: `TX-${tx.id}`,
            refNumber: tx.refNumber || 'ALX-TX',
            date,
            title: isAr ? `صرف للمستفيد: ${tx.entityName}` : `Payment to: ${tx.entityName}`,
            notes: tx.description,
            party: tx.entityName,
            type: 'Credit',
            amount: convertedAmt,
            currency: 'YER',
            amountOriginal: tx.amountOriginal,
            currencyOriginal: tx.currencyOriginal,
            module: tx.module
          });
        } else if (tx.type === 'Debit' && (tx.module === 'custody' || tx.module === 'adjustment')) {
          // Reversal/Inflow
          entries.push({
            id: `TX-${tx.id}`,
            refNumber: tx.refNumber || 'ALX-TX',
            date,
            title: isAr ? `توريد/تسوية من: ${tx.entityName}` : `Remittance/Reconcile from: ${tx.entityName}`,
            notes: tx.description,
            party: tx.entityName,
            type: 'Debit',
            amount: convertedAmt,
            currency: 'YER',
            amountOriginal: tx.amountOriginal,
            currencyOriginal: tx.currencyOriginal,
            module: tx.module
          });
        }
      }
    });

    // Fallback/Supplement with legacy expenses if they are not linked to accounts
    expenses.forEach(exp => {
      if (exp.linkedAccountId || exp.financialAccountId) return; // Skip if already handled by account_transactions

      const convertedAmt = convertToYER(exp.amount || 0, exp.currency);
      const isManualDebit = exp.notes && (exp.notes.includes('[MANUAL-DEBIT]') || exp.notes.includes('قيد تسوية مدين'));
      
      // Treat manual adjustments
      if (isManualDebit) {
        entries.push({
          id: `EXP-ADJ-${exp.id}`,
          refNumber: exp.expenseNumber || 'ALX-ADJ',
          date: exp.createdAt?.toDate ? exp.createdAt.toDate() : new Date(exp.createdAt || Date.now()),
          title: exp.notes.replace('[MANUAL-DEBIT]', '').trim(),
          notes: `${isAr ? 'ملاحظات:' : 'Notes:'} ${exp.description || ''}`,
          party: exp.recipientName || 'Finance',
          type: 'Debit', // Inflow to treasury
          amount: convertedAmt,
          currency: 'YER',
          amountOriginal: exp.amount,
          currencyOriginal: exp.currency || 'YER',
          module: 'adjustment'
        });
      } else {
        // Regular expenses = outflows (Credit)
        const convertedAmt = convertToYER(exp.amount || 0, exp.currency);
        entries.push({
          id: `EXP-OUT-${exp.id}`,
          refNumber: exp.expenseNumber || 'ALX-EXP',
          date: exp.createdAt?.toDate ? exp.createdAt.toDate() : new Date(exp.createdAt || Date.now()),
          title: exp.title || exp.description || 'Expense',
          notes: exp.description,
          party: exp.recipientName || 'Vendor',
          type: 'Credit', // Outflow from treasury
          amount: convertedAmt,
          currency: 'YER',
          amountOriginal: exp.amount,
          currencyOriginal: exp.currency || 'YER',
          module: 'expense'
        });
      }
    });

    // Sort by date descending
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [accountTransactions, expenses, isAr]);

  const treasurySummary = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;

    ledgerEntries.forEach(entry => {
      if (entry.type === 'Debit') totalInflow += entry.amount;
      if (entry.type === 'Credit') totalOutflow += entry.amount;
    });

    return {
      totalInflow,
      totalOutflow,
      netBalance: totalInflow - totalOutflow
    };
  }, [ledgerEntries]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.entityType || !newAccountForm.entityId || !newAccountForm.entityName) {
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'يرجى ملء جميع الحقول' : 'Please fill all fields',
        type: 'error'
      });
      return;
    }

    try {
      const accountCode = await financialAccountService.createAccount(
        newAccountForm.entityType as any,
        newAccountForm.entityId,
        newAccountForm.entityName
      );
      notificationService.notify({
        title: isAr ? 'تم الإنشاء' : 'Created',
        message: isAr ? `تم إنشاء حساب: ${accountCode}` : `Account created: ${accountCode}`,
        type: 'success'
      });
      setNewAccountForm({ entityType: '', entityId: '', entityName: '' });
    } catch (err: any) {
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: err.message,
        type: 'error'
      });
    }
  };

  const handleAdjustment = async () => {
    if (!selectedAccountId || !selectedAccount) {
      notificationService.notify({
        title: isAr ? 'تحذير' : 'Warning',
        message: isAr ? 'يرجى اختيار حساب' : 'Please select an account',
        type: 'warning'
      });
      return;
    }

    const adjustData = {
      adjustmentType: 'manual',
      amountInput: '',
      currency: 'YER',
      recipientName: '',
      notes: ''
    };

    const amountVal = parseFloat(adjustData.amountInput || '0');
    if (amountVal <= 0) return;

    try {
      const convertedAmt = financialAccountService.convertToDefaultCurrency(
        amountVal,
        adjustData.currency,
        settings.currency || 'YER',
        { USD: settings.exchangeRateUSD || 535, SAR: settings.exchangeRateSAR || 140 }
      );

      const notesLabel = isAr ? 'تعديل محاسبي' : 'Ledger Adjustment';
      const timestamp = Date.now();

      const payload = {
        type: 'General',
        amount: amountVal,
        currency: adjustData.currency,
        amountInDefaultCurrency: convertedAmt,
        recipientId: selectedAccount ? selectedAccount.entityId : 'adjustment',
        recipientEntityId: selectedAccount ? selectedAccount.entityId : 'adjustment',
        recipientEntityType: selectedAccount ? selectedAccount.entityType : null,
        recipientName: adjustData.recipientName || (isAr ? 'التعديلات المحاسبية' : 'Ledger Adjustments'),
        notes: notesLabel + (adjustData.notes ? ` : ${adjustData.notes}` : ''),
        status: 'Completed',
        createdByUid: auth.currentUser?.uid || 'system',
        createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        createdByName: auth.currentUser?.email?.split('@')[0] || 'Finance Auditor',
        createdAt: timestamp,
        linkedAccountId: selectedAccountId || null,
        linkedAccountCode: selectedAccount ? selectedAccount.accountCode : null,
        financialAccountId: selectedAccountId || null,
        financialAccountCode: selectedAccount ? selectedAccount.accountCode : null
      };

      await addDoc(collection(db, 'expenses'), payload);
      
      notificationService.notify({
        title: isAr ? 'تم التعديل' : 'Adjusted',
        message: isAr ? 'تم تسجيل التعديل بنجاح' : 'Adjustment recorded successfully',
        type: 'success'
      });
    } catch (err: any) {
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: err.message,
        type: 'error'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-950/50 to-green-950/50 border border-emerald-800/50 rounded-2xl p-6">
          <p className="text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-2">{isAr ? 'إجمالي التدفقات الداخلة' : 'Total Inflows'}</p>
          <p className="text-emerald-400 text-2xl font-black font-mono">{treasurySummary.totalInflow.toLocaleString()}</p>
          <p className="text-emerald-600 text-[10px] font-bold mt-1">YER</p>
        </div>
        <div className="bg-gradient-to-br from-rose-950/50 to-red-950/50 border border-rose-800/50 rounded-2xl p-6">
          <p className="text-rose-300 text-[10px] font-black uppercase tracking-wider mb-2">{isAr ? 'إجمالي التدفقات الخارجة' : 'Total Outflows'}</p>
          <p className="text-rose-400 text-2xl font-black font-mono">{treasurySummary.totalOutflow.toLocaleString()}</p>
          <p className="text-rose-600 text-[10px] font-bold mt-1">YER</p>
        </div>
        <div className="bg-gradient-to-br from-blue-950/50 to-cyan-950/50 border border-blue-800/50 rounded-2xl p-6">
          <p className="text-blue-300 text-[10px] font-black uppercase tracking-wider mb-2">{isAr ? 'الرصيد الصافي' : 'Net Balance'}</p>
          <p className={`text-2xl font-black font-mono ${
            treasurySummary.netBalance > 0 ? 'text-green-400' : treasurySummary.netBalance < 0 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {treasurySummary.netBalance.toLocaleString()}
          </p>
          <p className="text-blue-600 text-[10px] font-bold mt-1">YER</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center">
          <h3 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">{isAr ? 'دفتر الحسابات العام' : 'General Ledger'}</h3>
          <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-lg font-bold font-mono">ENTRIES: {ledgerEntries.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-black/30 text-[10px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
              <tr>
                <th className="p-3">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="p-3">{isAr ? 'المرجع' : 'Ref#'}</th>
                <th className="p-3">{isAr ? 'البيان' : 'Description'}</th>
                <th className="p-3 text-rose-400">{isAr ? 'مدين' : 'Debit'}</th>
                <th className="p-3 text-emerald-400">{isAr ? 'دائن' : 'Credit'}</th>
                <th className="p-3 text-left">{isAr ? 'الرصيد' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
              {ledgerEntries.map((entry, idx) => (
                <tr key={entry.id} className="hover:bg-slate-950/40 transition-colors">
                  <td className="p-3 text-slate-400 font-mono text-[10px]">{entry.date.toLocaleDateString(isAr ? 'ar-YE' : 'en-US')}</td>
                  <td className="p-3 font-mono text-[#d4af37] font-black text-[10px]">{entry.refNumber}</td>
                  <td className="p-3 text-white font-bold max-w-[300px] truncate">{entry.title}</td>
                  <td className="p-3 font-mono font-bold text-rose-400">{entry.type === 'Debit' ? entry.amount.toLocaleString() : '—'}</td>
                  <td className="p-3 font-mono font-bold text-emerald-400">{entry.type === 'Credit' ? entry.amount.toLocaleString() : '—'}</td>
                  <td className="p-3 text-left font-mono font-black text-white">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Accounts Section */}
      <FinanceReports 
        orders={orders}
        expenses={expenses}
        couriers={couriers}
        sources={[]}
        isAr={isAr}
        settings={settings}
      />
    </div>
  );
}
