/**
 * useOrderData.ts
 * ---------------
 * Hook مسؤول عن جلب جميع بيانات صفحة الطلبات من قاعدة البيانات.
 * Responsible for fetching all data needed by the Orders page from the database.
 *
 * يتبع مبدأ الفصل بين Business Logic وUI.
 * Follows separation of concerns between Business Logic and UI.
 */

import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  handleSupabaseError,
  OperationType,
  db,
} from '../../../lib/supabase';

/** بيانات جلب الطلبات وكافة الكيانات المرتبطة - All data fetched for the orders page */
export interface OrderDataState {
  orders: any[];
  customers: any[];
  employees: any[];
  couriers: any[];
  sources: any[];
  shippingCompanies: any[];
  financialAccounts: any[];
  allProducts: any[];
  allShipments: any[];
  autoVoucherRules: any[];
  loading: boolean;
}

/**
 * useOrderData
 * Hook يُدير اشتراكات Realtime لجميع المجموعات اللازمة لصفحة الطلبات.
 * Manages realtime subscriptions for all collections needed by the Orders page.
 *
 * @param enabled - إذا كان false لن يبدأ الجلب (يُستخدم مع roleLoading)
 */
export function useOrderData(enabled: boolean): OrderDataState {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allShipments, setAllShipments] = useState<any[]>([]);
  const [autoVoucherRules, setAutoVoucherRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // لا تبدأ الجلب إذا لم يكتمل تحميل الأدوار
    // Do not start fetching until roles are loaded
    if (!enabled) return;

    // ── اشتراك الطلبات (مرتبة من الأحدث) ──
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => handleSupabaseError(error, OperationType.LIST, 'orders'),
    );

    // ── اشتراك العملاء ──
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // ── اشتراك الموظفين (المفعّلون فقط) ──
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((entry: any) => !entry.disabled),
      );
    });

    // ── اشتراك المناديب ──
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snap) => {
      setCouriers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // ── اشتراك الحسابات المالية (الورقية المفعّلة فقط) ──
    const unsubFinancialAccounts = onSnapshot(collection(db, 'accounts'), (snap) => {
      setFinancialAccounts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (account: any) =>
              account.isActive !== false &&
              Boolean(account.accSubId || account.acc_sub_id),
          )
          .map((account: any) => ({
            id: account.id,
            name:
              account.accNameAr ||
              account.acc_name_ar ||
              account.accountName ||
              account.id,
            currency: account.currency || account.currencyCode || '',
            curNo: Number(account.curNo ?? account.cur_no),
            accSubId: String(account.accSubId ?? account.acc_sub_id ?? ''),
          })),
      );
    });

    // ── اشتراك المصادر ──
    const unsubSources = onSnapshot(collection(db, 'sources'), (snap) => {
      setSources(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // ── اشتراك قواعد القيود التلقائية ──
    const unsubAutoVoucherRules = onSnapshot(
      doc(db, 'settings', 'automatic_voucher_rules'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.data && Array.isArray(data.data)) {
            setAutoVoucherRules(data.data);
          }
        }
      },
    );

    // ── اشتراك شركات الشحن ──
    const unsubShippingCompanies = onSnapshot(
      collection(db, 'shipping_companies'),
      (snap) => {
        setShippingCompanies(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || 'بدون اسم',
            ...d.data(),
          })),
        );
      },
      (error) => {
        console.error(
          'FIRESTORE ERROR ON shipping_companies SNAPSHOT LISTENER:',
          error,
        );
      },
    );

    // ── اشتراك المنتجات ──
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setAllProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleSupabaseError(error, OperationType.LIST, 'products'),
    );

    // ── اشتراك الشحنات ──
    const unsubShipments = onSnapshot(
      collection(db, 'shipments'),
      (snap) => {
        setAllShipments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleSupabaseError(error, OperationType.LIST, 'shipments'),
    );

    // تنظيف جميع الاشتراكات عند إلغاء التركيب
    // Cleanup all subscriptions on unmount
    return () => {
      unsubOrders();
      unsubCustomers();
      unsubEmployees();
      unsubCouriers();
      unsubFinancialAccounts();
      unsubSources();
      unsubAutoVoucherRules();
      unsubShippingCompanies();
      unsubProducts();
      unsubShipments();
    };
  }, [enabled]);

  return {
    orders,
    customers,
    employees,
    couriers,
    sources,
    shippingCompanies,
    financialAccounts,
    allProducts,
    allShipments,
    autoVoucherRules,
    loading,
  };
}
