import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from '../lib/supabase-firebase-adapter';
import { db } from '../lib/supabase-firebase-adapter';
import { useSettings } from '../context/SettingsContext';
import { 
  X, 
  Printer, 
  Wallet, 
  Coins, 
  Package, 
  Search, 
  Crown, 
  ShieldAlert, 
  Calendar, 
  TrendingUp, 
  ArrowDownRight, 
  ArrowUpLeft,
  FileText
} from 'lucide-react';
import { printContent } from '../lib/printUtils';

export default function GlobalEntityLedgerModal() {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';
  
  const [isOpen, setIsOpen] = useState(false);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<'customer' | 'courier' | null>(null);
  
  const [entityData, setEntityData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [finSearch, setFinSearch] = useState('');
  const [finModuleFilter, setFinModuleFilter] = useState<'all' | 'order' | 'expense' | 'payment' | 'transaction'>('all');

  // Register Event Listener for Global Opening
  useEffect(() => {
    const handleOpen = (e: any) => {
      const { entityId: id, entityType: type } = e.detail || {};
      if (id && type) {
        setEntityId(id);
        setEntityType(type);
        setFinSearch('');
        setFinModuleFilter('all');
        setIsOpen(true);
      }
    };

    window.addEventListener('open-entity-ledger', handleOpen);
    return () => window.removeEventListener('open-entity-ledger', handleOpen);
  }, []);

  // Sync Entity Profile & Core Financials
  useEffect(() => {
    if (!isOpen || !entityId || !entityType) {
      setEntityData(null);
      setOrders([]);
      setExpenses([]);
      setTransactions([]);
      return;
    }

    setLoading(true);

    // 1. Fetch Entity Details
    const collName = entityType === 'customer' ? 'customers' : 'couriers';
    const unsubEntity = onSnapshot(doc(db, collName, entityId), (docSnap) => {
      if (docSnap.exists()) {
        setEntityData({ id: docSnap.id, ...docSnap.data() });
      }
    }, (err) => console.error("Error fetching entity info:", err));

    // 2. Fetch Orders Realtime
    let qOrders;
    if (entityType === 'customer') {
      qOrders = query(collection(db, 'orders'), where('customerId', '==', entityId));
    } else {
      // Use direct DB column delivery_courier_id (FK) with fallback to camelCase field
      qOrders = query(collection(db, 'orders'), where('deliveryCourierId', '==', entityId));
    }

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error fetching orders:", err));

    // 3. Fetch expenses (only relevant for Couriers)
    let unsubExpenses = () => {};
    if (entityType === 'courier') {
      const qExp = query(collection(db, 'expenses'), where('recipientId', '==', entityId));
      unsubExpenses = onSnapshot(qExp, (snap) => {
        setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.error("Error fetching expenses:", err));
    }

    // 4. Fetch Ledger Account Transactions
    const qTx = query(collection(db, 'account_transactions'), where('entityId', '==', entityId));
    const unsubTx = onSnapshot(qTx, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching transactions:", err);
      setLoading(false);
    });

    return () => {
      unsubEntity();
      unsubOrders();
      unsubExpenses();
      unsubTx();
    };
  }, [isOpen, entityId, entityType]);

  if (!isOpen || !entityType || !entityId) return null;

  // Compute Chronological Ledger Items
  const getUnifiedLedger = () => {
    const ledger: any[] = [];

    if (entityType === 'customer') {
      // ----------------- CUSTOMER LEDGER GENERATOR -----------------
      orders.forEach(order => {
        const amtPaid = parseFloat(order.amountPaid || order.paidAmount || 0);
        const amtRemain = parseFloat(order.amountRemaining || 0);
        const totalCost = amtPaid + amtRemain;

        // Total Cost (Debit - customer owes this amount)
        if (totalCost > 0) {
          ledger.push({
            id: `order-charge-${order.id}`,
            date: order.createdAt || Date.now(),
            type: 'Debit',
            amount: totalCost,
            module: 'order',
            title: isAr ? 'قيمة مبيعات / رسوم شحن' : 'Sales COD Charge',
            description: isAr 
              ? `قيمة الشحنة الموكلة رقم: ${order.orderNumber || 'ALX-CR'}` 
              : `Gross COD for shipment #${order.orderNumber || 'ALX-CR'}`,
            ref: order.orderNumber || order.id
          });
        }

        // COD Paid (Credit - customer paid this amount)
        const orderPaymentTxs = transactions.filter(tx => tx.module === 'payment' && (tx.refNumber === order.orderNumber || tx.refNumber === order.id));
        const sumOfRecordedTxs = orderPaymentTxs.reduce((sum, tx) => sum + (parseFloat(tx.amountOriginal || tx.amount || 0)), 0);
        
        const unrecordedPayment = amtPaid - sumOfRecordedTxs;

        if (unrecordedPayment > 0.01) {
          ledger.push({
            id: `order-pay-${order.id}`,
            date: (order.updatedAt || order.createdAt || Date.now()) + 1,
            type: 'Credit',
            amount: unrecordedPayment,
            module: 'payment',
            title: isAr ? 'مقبوضات شحن مبدئية / غير مقيدة' : 'Initial COD Payment',
            description: isAr 
              ? `كاش سدد مسبقاً للشحنة رقم: ${order.orderNumber || 'ALX-CR'} ولم يُقيد بسند منفصل` 
              : `Legacy cash paid for shipment #${order.orderNumber || 'ALX-CR'}`,
            ref: order.orderNumber || order.id
          });
        }
      });

      // System manual/accounting transactions for customers
      transactions.forEach(tx => {
        // Prevent duplication: our order generator always adds the 'order charge' debit line
        if (tx.module === 'order') return;

        ledger.push({
          id: tx.id || `tx-${Math.random()}`,
          date: tx.createdAt || Date.now(),
          type: tx.type, // 'Debit' | 'Credit'
          amount: tx.amount || 0,
          amountOriginal: tx.amountOriginal || tx.amount || 0,
          currencyOriginal: tx.currencyOriginal || 'YER',
          module: 'transaction',
          title: tx.description ? tx.description : (isAr ? (tx.type === 'Credit' ? 'إيداع نقدي للحساب' : 'سحب / تسوية من الحساب') : (tx.type === 'Credit' ? 'Account Deposit' : 'Account Withdrawal')),
          description: isAr 
            ? `حركة حساب مركزية رقم القيد: ${tx.refNumber || tx.accountCode || 'Ledger-Tx'}`
            : `System journal entry ref: ${tx.refNumber || tx.accountCode || 'Ledger-Tx'}`,
          ref: tx.refNumber || tx.accountCode || ''
        });
      });

    } else {
      // ----------------- COURIER LEDGER GENERATOR -----------------
      transactions.forEach(tx => {
        const amtBase = parseFloat(tx.amount || 0);
        const amtOriginal = parseFloat(tx.amountOriginal || tx.amount || 0);

        // We normalize types to ensure perfect bookkeeping and auto-heal any legacy data quirks.
        let type = tx.type || 'Debit';
        let title = '';
        let category = tx.module || 'transaction';

        if (tx.module === 'custody') {
          const isSettlement = (tx.description || '').includes('تسوية') || 
                               (tx.description || '').includes('سداد') || 
                               (tx.description || '').toLowerCase().includes('settle');
          if (isSettlement) {
            type = 'Credit';
            title = isAr ? 'تسوية وسداد عهدة مالية' : 'Custody Settlement / Return';
          } else {
            type = 'Debit';
            title = isAr ? 'تسليم عهدة مالية للمندوب' : 'Custody Handed Over';
          }
        } else if (tx.module === 'order') {
          if (tx.type === 'Debit') {
            title = isAr ? 'تحصيل قيمة شحنة (كاش بعهدة المندوب)' : 'Collected COD Cargo Cash';
          } else {
            title = isAr ? 'أجور توصيل وعمولة المندوب للطلب' : 'Earned Courier Delivery Commission';
          }
        } else if (tx.module === 'expense') {
          type = 'Credit';
          title = isAr ? 'مصروف تشغيلي / أجور مسددة' : 'Operating Expense / Disbursed';
        } else if (tx.module === 'wage' || tx.module === 'salary_payment') {
          type = 'Credit';
          title = isAr ? 'صرف راتب أو مستحقات الموظف' : 'Salary / Wages Paid';
        } else {
          title = tx.description || (isAr ? 'قيد تسوية لمطابقة رصيد المندوب' : 'Corporate Ledger Adjustment');
        }

        ledger.push({
          id: tx.id || `tx-${Math.random()}`,
          date: tx.createdAt || Date.now(),
          type,
          amount: amtBase,
          amountOriginal: amtOriginal,
          currencyOriginal: tx.currencyOriginal || 'YER',
          module: category,
          title,
          description: tx.description || (isAr ? `قيد مالي رقم: ${tx.refNumber || tx.accountCode || ''}` : `Entry reference: ${tx.refNumber || tx.accountCode || ''}`),
          ref: tx.refNumber || tx.accountCode || 'GL-TX'
        });
      });
    }

    // Sort oldest to newest to compute running totals correctly
    const sorted = [...ledger].sort((a, b) => a.date - b.date);

    // Compute running balance: Debits (+) increase the outstanding balance, Credits (-) decrease it.
    let runningAccountBal = 0;
    const finalLedger = sorted.map(item => {
      if (item.type === 'Debit') {
        runningAccountBal += item.amount;
      } else {
        runningAccountBal -= item.amount;
      }

      return {
        ...item,
        runningAccountBal
      };
    });

    // Return newest first for chronological table layout
    return finalLedger.reverse();
  };

  const ledgerData = getUnifiedLedger();

  // Metrics calculation
  const getTotals = () => {
    let debits = 0;
    let credits = 0;
    ledgerData.forEach(item => {
      if (item.type === 'Debit') debits += item.amount;
      else credits += item.amount;
    });
    return { debits, credits };
  };

  const { debits, credits } = getTotals();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="bg-[#0b0b0d] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-4xl w-full h-[88vh] overflow-hidden flex flex-col relative">
        
        {/* Modal Header */}
        <div className="bg-black/40 p-5 border-b border-slate-850/80 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-[#d4af37]/20 text-[#d4af37] flex items-center justify-center font-black text-base shadow-inner">
              {entityData?.fullName ? entityData.fullName.substring(0, 2) : '?'}
            </div>
            <div className="text-start">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 leading-none">
                {entityData?.fullName || (isAr ? 'حساب مالي معلق' : 'Loading Entity...')}
                <Crown className="w-4 h-4 text-[#d4af37] animate-pulse" />
              </h2>
              <p className="text-[10px] text-[#d4af37] font-bold font-mono mt-0.5" dir="ltr">
                {entityType === 'customer' 
                  ? (isAr ? `كشف حساب عميل • ${entityData?.phone || ''}` : `Customer Statement • ${entityData?.phone || ''}`)
                  : (isAr ? `كشف حساب مندوب • ${entityData?.phone || ''}` : `Courier Statement • ${entityData?.phone || ''}`)
                }
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="bg-slate-900 hover:bg-slate-850 p-2 rounded-xl text-slate-500 hover:text-white border border-slate-800 transition duration-200"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" id="global-ledger-content">
          
          {/* Quick Metrics Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Current Account Balance Metrics */}
            <div className="bg-gradient-to-br from-[#02130a] to-[#041a10] border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                {isAr ? 'رصيد الحساب الموحد' : 'Consolidated Account Balance'}
              </span>
              <div className="font-mono font-black text-emerald-400 text-base">
                {(entityData?.financialBalance || entityData?.walletBalance || 0).toLocaleString()} {settings.currency || 'YER'}
              </div>
              <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                {isAr ? 'مزامنة تحديثات حية للنظام' : 'Live synced database balance'}
              </span>
            </div>

            {/* Total debits / allocations */}
            <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
              <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {isAr ? 'كل الحركات المدنية (-)' : 'Total Debits / Obligations'}
              </span>
              <div className="font-mono font-black text-rose-400 text-base">
                {debits.toLocaleString()} {settings.currency || 'YER'}
              </div>
              <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                {entityType === 'customer'
                  ? (isAr ? 'يشمل مبيعات ورسوم شحن معلقة' : 'Includes shipments Cod billed')
                  : (isAr ? 'يشمل عهد مستلمة وتحصيلات ميدانية' : 'Includes custody received and collected COD')
                }
              </span>
            </div>

            {/* Total credits / payments */}
            <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ArrowUpLeft className="w-3.5 h-3.5" />
                {isAr ? 'كل التوريدات الدائنية (+)' : 'Total Credits / Inflows'}
              </span>
              <div className="font-mono font-black text-emerald-400 text-base">
                {credits.toLocaleString()} {settings.currency || 'YER'}
              </div>
              <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                {entityType === 'customer'
                  ? (isAr ? 'خصومات ومدفوعات كاش موردة' : 'Payments, adjustments & deposits')
                  : (isAr ? 'تصفية عهد وأجور توصيل مكتسبة' : 'Wages earned and physical handovers')
                }
              </span>
            </div>

          </div>

          {/* Table Filters Panel */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 bg-black/45 border border-slate-850/60 rounded-2xl">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input 
                type="text"
                placeholder={isAr ? 'البحث عن حركة برقم السند أو المرجع أو البيان...' : 'Filter ledger details...'}
                value={finSearch}
                onChange={e => setFinSearch(e.target.value)}
                className="w-full bg-black/50 border border-slate-855 rounded-xl py-2 px-9 text-xs font-bold text-white focus:border-[#d4af37]/50 outline-none text-start"
              />
            </div>
            
            <select 
              value={finModuleFilter} 
              onChange={e => setFinModuleFilter(e.target.value as any)} 
              className="bg-[#0e0e11] border border-slate-820 rounded-xl py-2 px-3 text-xs font-black text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer text-start"
            >
              <option value="all">{isAr ? 'جميع المسببات التشغيلية' : 'All Activities'}</option>
              <option value="order">{isAr ? 'الطرود والشحنات' : 'Shipment COD Charges'}</option>
              {entityType === 'courier' && <option value="expense">{isAr ? 'العهد والمسحوبات والمصاريف' : 'Custody & Expenses'}</option>}
              {entityType === 'customer' && <option value="payment">{isAr ? 'مدفوعات التسوية' : 'Cash Payments'}</option>}
              <option value="transaction">{isAr ? 'القيود اليدوية والتسويات' : 'Settlement Entries'}</option>
            </select>
          </div>

          {/* Main Statement Table */}
          <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center text-start">
              <h4 className="font-black text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400 animate-pulse" />
                {isAr ? 'تفاصيل كشف الحركة المالي التراكمي' : 'CHRONOLOGICAL FINANCIAL AUDIT STATEMENT'}
              </h4>
              <span className="text-[10px] bg-emerald-950/25 text-emerald-400 border border-emerald-900/40 px-3 py-1 rounded-lg font-bold font-mono">
                {isAr ? 'مكتمل لجميع الفترات' : 'ALL PERIODS'}
              </span>
            </div>

            {loading ? (
              <div className="p-16 text-center text-slate-500 font-bold font-mono uppercase tracking-wider animate-pulse">
                [ {isAr ? 'جاري تجميع حركات الموديولات المترابطة بالتاريخ...' : 'generating_live_tracelines...'} ]
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-black/30 text-[9px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                    <tr>
                      <th className="p-3 text-start">{isAr ? 'تاريخ الحركة' : 'Posting Date'}</th>
                      <th className="p-3 text-start">{isAr ? 'التصنيف' : 'Classification'}</th>
                      <th className="p-3 text-start">{isAr ? 'البيان وشرح الحركة' : 'Description / Narrative'}</th>
                      <th className="p-3 text-start">{isAr ? 'رقم المرجع' : 'Reference Ref'}</th>
                      <th className="p-3 text-start">{isAr ? 'النوع' : 'Entry Type'}</th>
                      <th className="p-3 text-start">{isAr ? 'المبلغ (العملة الأصلية)' : 'Amount (Original Currency)'}</th>
                      <th className="p-3 text-start">{isAr ? `المبلغ (${settings.currency || 'YER'})` : `Amount (${settings.currency || 'YER'})`}</th>
                      <th className="p-3 text-left">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                    {ledgerData
                      .filter(item => {
                        const q = finSearch.toLowerCase();
                        const matchesSearch = !q || 
                          (item.title || '').toLowerCase().includes(q) || 
                          (item.description || '').toLowerCase().includes(q) || 
                          (item.ref || '').toLowerCase().includes(q);
                        const matchesModule = finModuleFilter === 'all' || item.module === finModuleFilter;
                        return matchesSearch && matchesModule;
                      })
                      .map((item, idx) => {
                        const isCredit = item.type === 'Credit';
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-3 font-mono font-bold text-[10px] text-slate-400 text-start" dir="ltr">
                              {new Date(item.date).toLocaleString(isAr ? 'ar-YE' : 'en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 text-start">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                item.module === 'order' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20' :
                                item.module === 'expense' ? 'bg-amber-955/20 text-amber-500 border border-amber-950/20' :
                                item.module === 'payment' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20' :
                                'bg-purple-950/30 text-purple-400 border border-purple-950/20'
                              }`}>
                                {item.module === 'order' ? (isAr ? 'شحنة/توصيل' : 'Shipment COD') :
                                 item.module === 'expense' ? (isAr ? 'عهدة/مصروف/أجور' : 'Disbursed') :
                                 item.module === 'payment' ? (isAr ? 'كاش مسدد' : 'COD Settled') :
                                 (isAr ? 'تسوية مركزية' : 'Journal Entry')}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-white text-start">
                              <div className="text-xs">{item.title}</div>
                              <div className="text-[9px] text-slate-550 font-normal mt-0.5">{item.description}</div>
                            </td>
                            <td className="p-3 font-mono text-[10px] text-[#d4af37] font-black text-start">{item.ref}</td>
                            <td className="p-3 text-start">
                              {isCredit ? (
                                <span className="text-[9px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2.5 py-0.5 rounded-xl font-black">{isAr ? 'إيداع / دائن (+)' : 'Credit (+)'}</span>
                              ) : (
                                <span className="text-[9px] bg-rose-955/20 text-rose-500 border border-rose-950/30 px-2.5 py-0.5 rounded-xl font-black">{isAr ? 'خصم / مدين (-)' : 'Debit (-)'}</span>
                              )}
                            </td>
                            <td className={`p-3 font-mono font-bold text-xs ${isCredit ? 'text-emerald-450' : 'text-rose-450'}`}>
                              <span>{isCredit ? '+' : '-'}{(item.amountOriginal || item.amount || 0).toLocaleString()} {item.currencyOriginal || 'YER'}</span>
                            </td>
                            <td className={`p-3 font-mono font-black text-xs ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              <span>{isCredit ? '+' : '-'}{(item.amount || 0).toLocaleString()} {settings.currency || 'YER'}</span>
                            </td>
                            <td className={`p-3 text-left font-mono font-black text-xs ${item.runningAccountBal >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                              {item.runningAccountBal.toLocaleString()} {settings.currency || 'YER'}
                            </td>
                          </tr>
                        );
                      })}
                    {ledgerData.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-16 text-center text-slate-650 italic font-bold">
                          {isAr ? '[ لم يتم تقييد حركات مالية مسجلة بالتاريخ لهذا الحساب ]' : '[ NO FINANCIAL TRANSACTIONS DISCOVERED FOR THIS ACCOUNT ]'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with stamp and print button */}
        <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-between items-center shrink-0">
          <div className="text-[9px] font-mono text-slate-500 pr-2 uppercase select-none">
            {isAr ? 'فرز مالي معتمد كشف حركي بالتاريخ • طبع تلقائي' : 'SECURE RECONCILIATION STAMP • GENERATED VIA FINANCIAL MODULE'}
          </div>
          <button 
            onClick={() => printContent(isAr ? `كشف حساب مالي - ${entityData?.fullName}` : 'Financial Statement', 'global-ledger-content', isAr)} 
            className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-md active:scale-95"
          >
            <Printer className="w-4 h-4" /> 
            {isAr ? 'طباعة كشف الحساب المصغر' : 'Print Statement'}
          </button>
        </div>

      </div>
    </div>
  );
}
