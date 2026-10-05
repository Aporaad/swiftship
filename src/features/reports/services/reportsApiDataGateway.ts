import { ApiClient } from "../../../data/http/api-client";

type ApiEnvelope<T> = { success: true; data: T };
type ReportRow = Record<string, unknown> & { id: string };
type ReportsState = {
  orders: ReportRow[];
  customers: ReportRow[];
  accounts: ReportRow[];
  mainEntries: ReportRow[];
  accountTransactions: ReportRow[];
};

type ReportsStateHandlers = {
  onData: (state: ReportsState) => void;
  onError?: (error: unknown) => void;
};

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001",
  accessTokenFactory: () =>
    typeof sessionStorage === "undefined"
      ? null
      : sessionStorage.getItem("alx_api_access_token"),
  maxReadRetries: 0,
});

function enabled(): boolean {
  return import.meta.env.VITE_REPORTS_API_READS === "true";
}

async function readRows(path: string): Promise<ReportRow[]> {
  const response = await apiClient.get<ApiEnvelope<ReportRow[]>>(path, {
    limit: 100,
    offset: 0,
  });
  return Array.isArray(response.data) ? response.data : [];
}

function withId(row: Record<string, unknown>, key: string): ReportRow {
  return { ...row, id: String(row[key] ?? row.id) } as ReportRow;
}

async function load(): Promise<ReportsState> {
  const [orders, customers, accounts, mainEntries, accountTransactions] =
    await Promise.all([
      readRows("/api/v1/orders"),
      readRows("/api/v1/customers"),
      readRows("/api/v1/finance/accounts"),
      readRows("/api/v1/finance/entries"),
      readRows("/api/v1/finance/account-movements"),
    ]);
  return {
    orders: orders.map(row => withId(row, "orderId")),
    customers: customers.map(row => withId(row, "customerId")),
    accounts: accounts.map(row => withId(row, "accountId")),
    mainEntries: mainEntries.map(row => withId(row, "entryId")),
    accountTransactions: accountTransactions.map(row =>
      withId(row, "transactionId")
    ),
  };
}

export const reportsApiDataGateway = {
  isEnabled: enabled,
  subscribeCoreData(handlers: ReportsStateHandlers): () => void {
    if (!enabled()) return () => undefined;
    let disposed = false;
    const refresh = async () => {
      try {
        const state = await load();
        if (!disposed) handlers.onData(state);
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
