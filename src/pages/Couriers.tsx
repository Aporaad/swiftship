import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronDown, Eye, EyeOff, Trash2, Plus, Edit2, X } from 'lucide-react';

interface CourierPageProps {
  isAr: boolean;
  settings: any;
}

export default function Couriers({ isAr, settings }: CourierPageProps) {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState<any>(null);
  const [courierOrders, setCourierOrders] = useState<any[]>([]);
  const [courierExpenses, setCourierExpenses] = useState<any[]>([]);
  const [courierTransactions, setCourierTransactions] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [detailsUnsubs, setDetailsUnsubs] = useState<(() => void)[]>([]);

  // Load all couriers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'couriers'), (snap) => {
      setCouriers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleSelectCourier = (courier: any) => {
    setSelectedCourier(courier);
    setOrdersLoading(true);
    
    // Clean up previous subscriptions
    detailsUnsubs.forEach(unsub => unsub());
    setDetailsUnsubs([]);

    const qOrders = query(
      collection(db, 'orders'),
      where('courierId', '==', courier.id)
    );
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      setCourierOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setOrdersLoading(false);
    });

    const qExp = query(
      collection(db, 'expenses'),
      where('recipientId', '==', courier.id)
    );
    const unsubExpenses = onSnapshot(qExp, (snap) => {
      setCourierExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qTx = query(
      collection(db, 'account_transactions'),
      where('entityId', '==', courier.id),
      orderBy('createdAt', 'desc')
    );

    const unsubTx = onSnapshot(qTx, (snap) => {
      setCourierTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching courier transactions:", err);
    });

    setDetailsUnsubs([unsubOrders, unsubExpenses, unsubTx]);
  };

  const handleCloseDetails = () => {
    detailsUnsubs.forEach(unsub => unsub());
    setSelectedCourier(null);
    setCourierOrders([]);
    setCourierExpenses([]);
    setCourierTransactions([]);
  };

  return (
    <div className="space-y-6">
      {/* Couriers List */}
      <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center">
          <h3 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">{isAr ? 'قائمة المناديب' : 'Couriers List'}</h3>
          <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-lg font-bold">{couriers.length}</span>
        </div>
        <div className="space-y-2 p-4">
          {couriers.map(courier => (
            <div key={courier.id} className="bg-black/40 border border-slate-800 rounded-xl p-3 cursor-pointer hover:border-[#d4af37] transition-colors"
              onClick={() => handleSelectCourier(courier)}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-black text-[#d4af37]">{courier.fullName}</p>
                  <p className="text-[10px] text-slate-500">{courier.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-emerald-400">{(courier.walletBalance || 0).toLocaleString()} YER</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Courier Details Panel */}
      {selectedCourier && (
        <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center">
            <h3 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">
              {selectedCourier.fullName}
            </h3>
            <button onClick={handleCloseDetails} className="text-slate-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Financial Ledger Table */}
          <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center">
              <h4 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">{isAr ? 'سجل العمليات المالية للمندوب' : 'Courier Financial Transaction Ledger'}</h4>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-lg font-bold font-mono">TXN: {courierTransactions.length}</span>
            </div>

            {ordersLoading ? (
              <div className="p-12 text-center text-slate-500 font-bold font-mono uppercase tracking-wider">[ loading_ledger_entries ]</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-black/30 text-[10px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                    <tr>
                      <th className="p-3">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="p-3">{isAr ? 'سند/مرجع' : 'Ref'}</th>
                      <th className="p-3">{isAr ? 'البيان' : 'Particulars'}</th>
                      <th className="p-3 text-rose-400">{isAr ? 'مدين (+)' : 'Debit (+)'}</th>
                      <th className="p-3 text-emerald-400">{isAr ? 'دائن (-)' : 'Credit (-)'}</th>
                      <th className="p-3 text-left">{isAr ? 'الرصيد' : 'Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                    {courierTransactions.map(tx => {
                      const date = new Date(tx.createdAt || Date.now());
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
                    })}
                    {courierTransactions.length === 0 && (
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
