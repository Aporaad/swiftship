import { ApiClient } from "../../../data/http/api-client";

type ApiEnvelope<T> = { success: true; data: T };
type Row = Record<string, unknown> & { id: string };

type StaffState = {
  couriers: Row[];
  employees: Row[];
  orders: Row[];
  accounts: Row[];
};

type StaffHandlers = {
  onData: (state: StaffState) => void;
  onError?: (error: unknown) => void;
};

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001",
  accessTokenFactory: () =>
    typeof sessionStorage === "undefined"
      ? null
      : sessionStorage.getItem("alx_api_access_token"),
  maxReadRetries: 0,
});

const readRows = async (path: string): Promise<Row[]> => {
  const response = await client.get<ApiEnvelope<Row[]>>(path, {
    limit: 100,
    offset: 0,
  });
  return Array.isArray(response.data) ? response.data : [];
};

const normalize = (row: Row, key: string): Row => ({
  ...row,
  id: String(row[key] ?? row.id),
});

export const staffApiDataGateway = {
  isEnabled: () => import.meta.env.VITE_STAFF_API_READS === "true",
  subscribe(handlers: StaffHandlers): () => void {
    let disposed = false;
    const refresh = async () => {
      try {
        const [couriers, employees, orders, accounts] = await Promise.all([
          readRows("/api/v1/reporting/couriers"),
          readRows("/api/v1/reporting/employees"),
          readRows("/api/v1/orders"),
          readRows("/api/v1/finance/accounts"),
        ]);
        if (!disposed) {
          handlers.onData({
            couriers: couriers.map(row => normalize(row, "courierId")),
            employees: employees.map(row => normalize(row, "employeeId")),
            orders: orders.map(row => normalize(row, "orderId")),
            accounts: accounts.map(row => normalize(row, "accountId")),
          });
        }
      } catch (error) {
        if (!disposed) handlers.onError?.(error);
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  },
};
