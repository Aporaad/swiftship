import { ApiClient } from "../../../data/http/api-client";

type ApiEnvelope<T> = { success: true; data: T };
type ReportRow = Record<string, unknown> & { id: string };
type ReportsState = {
  orders: ReportRow[];
  expenses: ReportRow[];
  couriers: ReportRow[];
  customers: ReportRow[];
  sources: ReportRow[];
  users: ReportRow[];
  accounts: ReportRow[];
  shippingCompanies: ReportRow[];
  reportTemplates: ReportRow[];
  mainEntries: ReportRow[];
  accountTransactions: ReportRow[];
};
type ReportsStateHandlers = {
  onData: (state: ReportsState) => void;
  onError?: (error: unknown) => void;
};

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001",
  accessTokenFactory: () =>
    typeof sessionStorage === "undefined"
      ? null
      : (sessionStorage.getItem("alx_access_token") || sessionStorage.getItem("alx_api_access_token")),
  maxReadRetries: 0,
});

function enabled(): boolean {
  return import.meta.env.VITE_REPORTS_API_READS === "true" || import.meta.env.VITE_USE_HTTP_API === "true";
}

async function readRows(path: string): Promise<ReportRow[]> {
  try {
    const response = await apiClient.get<ApiEnvelope<ReportRow[]>>(path, {
      limit: 100,
      offset: 0,
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.warn(
      `Reports API read failed for ${path}; returning an empty contract result.`,
      error
    );
    return [];
  }
}

function withId(row: Record<string, unknown>, key: string): ReportRow {
  return { ...row, id: String(row[key] ?? row.id) } as ReportRow;
}

async function load(): Promise<ReportsState> {
  const [
    orders,
    expenses,
    couriers,
    customers,
    sources,
    users,
    accounts,
    shippingCompanies,
    reportTemplates,
    mainEntries,
    accountTransactions,
  ] = await Promise.all([
    readRows("/api/v1/orders"),
    readRows("/api/v1/reporting/expenses"),
    readRows("/api/v1/reporting/couriers"),
    readRows("/api/v1/customers"),
    readRows("/api/v1/reporting/sources"),
    readRows("/api/v1/reporting/users"),
    readRows("/api/v1/finance/accounts"),
    readRows("/api/v1/reporting/shipping-companies"),
    readRows("/api/v1/reporting/report-templates"),
    readRows("/api/v1/finance/entries"),
    readRows("/api/v1/finance/account-movements"),
  ]);
  return {
    orders: orders.map(row => withId(row, "orderId")),
    expenses: expenses.map(row => withId(row, "expenseId")),
    couriers: couriers.map(row => withId(row, "courierId")),
    customers: customers.map(row => withId(row, "customerId")),
    sources: sources.map(row => withId(row, "sourceId")),
    users: users.map(row => withId(row, "userId")),
    accounts: accounts.map(row => withId(row, "accountId")),
    shippingCompanies: shippingCompanies.map(row =>
      withId(row, "shippingCompanyId")
    ),
    reportTemplates: reportTemplates.map(row =>
      withId(row, "reportTemplateId")
    ),
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
