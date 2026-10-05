import { ApiClient } from "../../../../data/http/api-client";

type ApiEnvelope<T> = { success: true; data: T };
type Row = Record<string, unknown> & { id: string };
type DashboardHandlers = {
  setCustomersCount: (count: number) => void;
  setCouriers: (couriers: Row[]) => void;
  setCouriersCount: (count: number) => void;
  setOrders: (orders: Row[]) => void;
  setRealLogs: (logs: Row[]) => void;
  setFinancialAccounts: (accounts: Row[]) => void;
  setExpensesCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
};

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001",
  accessTokenFactory: () =>
    typeof sessionStorage === "undefined"
      ? null
      : sessionStorage.getItem("alx_api_access_token"),
  maxReadRetries: 0,
});

const readRows = async (path: string): Promise<Row[]> => {
  try {
    const response = await apiClient.get<ApiEnvelope<Row[]>>(path, {
      limit: 150,
      offset: 0,
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.warn(`Dashboard API read failed for ${path}.`, error);
    return [];
  }
};

const withId = (row: Row, key: string): Row => ({
  ...row,
  id: String(row[key] ?? row.id),
});

export function subscribeDashboardApiData(
  handlers: DashboardHandlers
): () => void {
  let disposed = false;
  const refresh = async () => {
    const [orders, couriers, customers, accounts, logs, expenses] =
      await Promise.all([
        readRows("/api/v1/orders"),
        readRows("/api/v1/reporting/couriers"),
        readRows("/api/v1/customers"),
        readRows("/api/v1/finance/accounts"),
        readRows("/api/v1/reporting/activity-logs"),
        readRows("/api/v1/reporting/expenses"),
      ]);
    if (disposed) return;
    handlers.setOrders(orders.map(row => withId(row, "orderId")));
    handlers.setCouriers(couriers.map(row => withId(row, "courierId")));
    handlers.setCouriersCount(couriers.length);
    handlers.setCustomersCount(customers.length);
    handlers.setFinancialAccounts(
      accounts.map(row => withId(row, "accountId"))
    );
    handlers.setRealLogs(logs.map(row => withId(row, "activityLogId")));
    handlers.setExpensesCount(expenses.length);
    handlers.setLoading(false);
  };
  void refresh();
  const interval = setInterval(() => void refresh(), 30_000);
  return () => {
    disposed = true;
    clearInterval(interval);
  };
}
