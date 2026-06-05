import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronDown, Eye, EyeOff, Trash2, Plus, Edit2, X } from 'lucide-react';

interface CustomerPageProps {
  isAr: boolean;
  settings: any;
}

export default function Customers({ isAr, settings }: CustomerPageProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Load all customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setOrdersLoading(true);

    const qOrders = query(
      collection(db, 'orders'),
      where('customerId', '==', customer.id)
    );
    const unsub = onSnapshot(qOrders, (snap) => {
      setCustomerOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setOrdersLoading(false);
    });

    const qTx = query(
      collection(db, 'account_transactions'),
      where('entityId', '==', customer.id),
      orderBy('createdAt', 'desc')
    );

    const unsubTx = onSnapshot(qTx, (snap) => {
      setCustomerTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error(err);
    });

    return () => {
      unsub();
      unsubTx();
    };
  };

  const handleCloseDetails = () => {
    setSelectedCustomer(null);
    setCustomerOrders([]);
    setCustomerTransactions([]);
  };

  return (
    <div className="space-y-6">
      {/* Customers List */}
      <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center">
          <h3 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">{isAr ? 'قائمة العملاء' : 'Customers List'}</h3>
          <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-lg font-bold">{customers.length}</span>
        </div>
        <div className="space-y-2 p-4">
          {customers.map(customer => (
            <div key={customer.id} className="bg-black/40 border border-slate-800 rounded-xl p-3 cursor-pointer hover:border-[#d4af37] transition-colors"
              onClick={() => handleSelectCustomer(customer)}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-black text-[#d4af37]">{customer.fullName}</p>
                  <p className="text-[10px] text-slate-500">{customer.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-emerald-400">{(customer.financialBalance || 0).toLocaleString()} YER</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Details Panel */}
      {selectedCustomer && (
        <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center">
            <h3 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">
              {selectedCustomer.fullName}
            </h3>
            <button onClick={handleCloseDetails} className="text-slate-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Tabs for History */}
          <div className="flex gap-2 mb-4 bg-black/40 p-1 rounded-xl w-max" style={{ marginLeft: '1rem', marginTop: '1rem' }}>
            <button className="px-4 py-1.5 rounded-lg text-[10px] font-black bg-[#d4af37] text-black">
              {isAr ? 'سجل العمليات المالية' : 'Financial Ledger'}
            </button>
          </div>

          {/* Financial Ledger Table */}
          <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center">
              <h4 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">{isAr ? 'كشف الحساب المالي التفصيلي للعميل' : 'Detailed Customer Financial Statement'}</h4>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-lg font-bold font-mono">TXN: {customerTransactions.length}</span>
            </div>
            
            {ordersLoading ? (
              <div className="p-12 text-center text-slate-500 font-bold font-mono uppercase tracking-wider">[ loading_ledger_entries ]</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-black/30 text-[10px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                    <tr>
                      <th className="p-3">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="p-3">{isAr ? 'سند/مرجع' : 'Ref Number'}</th>
                      <th className="p-3">{isAr ? 'البيان' : 'Description'}</th>
                      <th className="p-3 text-rose-400">{isAr ? 'مدين (+)' : 'Debit (+)'}</th>
                      <th className="p-3 text-emerald-400">{isAr ? 'دائن (-)' : 'Credit (-)'}</th>
                      <th className="p-3 text-left">{isAr ? 'الرصيد' : 'Running Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                    {(() => {
                      let runningBalance = 0;
                      const sortedTxs = [...customerTransactions].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

                      return sortedTxs.reverse().map((tx, idx) => {
                        const date = new Date(tx.createdAt || Date.now());
                        // Calculate balance for this row (simplified for view)
                        // In real logic we'd need to compute it from oldest to newest
                        const rowBalance = tx.balanceAfter || 0;

                        return (
                          <tr key={tx.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-3 text-slate-400 font-mono text-[10px]">{date.toLocaleDateString(isAr ? 'ar-YE' : 'en-US')}</td>
                            <td className="p-3">
                              <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[9px] font-mono">
                                {tx.refNumber}
                              </span>
                            </td>
                            <td className="p-3 text-white font-bold max-w-[200px] truncate">{tx.description}</td>
                            <td className="p-3 font-mono font-bold text-rose-400">
                              {tx.type === 'Debit' ? `+${tx.amountOriginal.toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-400">
                              {tx.type === 'Credit' ? `-${tx.amountOriginal.toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 text-left font-mono font-black text-white">
                              {tx.balanceAfter ? tx.balanceAfter.toLocaleString() : '—'}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    {customerTransactions.length === 0 && (
                      <tr><td colSpan={6} className="p-16 text-center text-slate-600 italic font-bold select-none">[ no_financial_transactions_logged ]</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
