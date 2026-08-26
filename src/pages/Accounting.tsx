import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from '../lib/supabase-firebase-adapter';
import { db } from '../lib/supabase-firebase-adapter';
import { useSettings } from '../context/SettingsContext';
import { useRole } from '../hooks/useRole';
import { ShieldAlert, BookOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import FinanceAccounting from '../components/FinanceAccounting';

export default function Accounting() {
  const { settings, t } = useSettings();
  const { role, hasPermission, loading: roleLoading } = useRole();
  const canViewFinance = role === 'Admin' || hasPermission('view_finance');
  const isAr = settings.language === 'ar';

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activeSubTab = queryParams.get('subtab') || undefined;

  const [expenses, setExpenses] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (roleLoading || !canViewFinance) return;

    // Fetch expenses
    const unsubExp = onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')), (snap) => {
      setExpenses(snap.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch couriers
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snap) => {
      setCouriers(snap.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch orders
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
      setOrders(snap.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubExp();
      unsubCouriers();
      unsubOrders();
      unsubCustomers();
    };
  }, [roleLoading, canViewFinance]);

  if (roleLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luxury-gold"></div>
      </div>
    );
  }

  if (!canViewFinance) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'ليس لديك صلاحية لعرض مطابقة الحسابات والقيود المحاسبية.' : 'You do not have permission to view the accounting ledger and double-entry adjustments.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start font-sans selection:bg-[#d4af37]/30">
      {/* Accounting Header */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-3 rounded-2xl text-[#d4af37]">
            <BookOpen className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">
              {isAr ? 'المحاسبة' : 'Accounting'}
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isAr ? 'القيود المحاسبية ومطابقة الحسابات • كشوف حسابات العملاء • تسوية العهد • توازن قبوضات الصندوق' : 'Double-Entry Ledger & Adjustments • Ledger audits • Courier liability accounts • Balancing sheets'}
            </p>
          </div>
        </div>
      </div>

      {/* Accounting Component */}
      <FinanceAccounting
        orders={orders}
        expenses={expenses}
        couriers={couriers}
        customers={customers}
        isAr={isAr}
        settings={settings}
        initialTab={activeSubTab}
      />
    </div>
  );
}
