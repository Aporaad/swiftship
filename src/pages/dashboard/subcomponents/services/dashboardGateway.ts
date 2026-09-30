import { collection, onSnapshot, query, orderBy, limit } from '../../../../lib/supabase-adapter';
import { db, safeToDate } from '../../../../lib/supabase-adapter';

type DashboardGatewayHandlers = {
  setCustomersCount: (count: number) => void;
  setCouriers: (couriers: any[]) => void;
  setCouriersCount: (count: number) => void;
  setOrders: (orders: any[]) => void;
  setRealLogs: (logs: any[]) => void;
  setFinancialAccounts: (accounts: any[]) => void;
  setLoading: (loading: boolean) => void;
};

export function subscribeDashboardData(handlers: DashboardGatewayHandlers): () => void {
  const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
    handlers.setCustomersCount(snap.docs.length);
  });

  const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snap) => {
    handlers.setCouriersCount(snap.docs.length);
    const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() as any }));
    handlers.setCouriers(list);
  });

  const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(150));
  const unsubOrders = onSnapshot(qOrders, (snap) => {
    const allOrders = snap.docs.map((doc) => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        ...d,
        createdAt: safeToDate(d.createdAt),
      };
    });
    handlers.setOrders(allOrders);
    handlers.setLoading(false);
  }, (err) => {
    console.error(err);
    handlers.setLoading(false);
  });

  const qLogs = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(5));
  const unsubLogs = onSnapshot(qLogs, (snap) => {
    const logs = snap.docs.map((doc) => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        ...d,
        createdAt: safeToDate(d.timestamp),
      };
    });
    handlers.setRealLogs(logs);
  }, (err) => {
    console.warn('Activity logs subscript error (expected first run):', err);
  });

  const unsubAccounts = onSnapshot(collection(db, 'accounts'), (snap) => {
    handlers.setFinancialAccounts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }, (err) => {
    console.warn('Accounts subscript error:', err);
  });

  return () => {
    unsubCustomers();
    unsubCouriers();
    unsubOrders();
    unsubLogs();
    unsubAccounts();
  };
}
