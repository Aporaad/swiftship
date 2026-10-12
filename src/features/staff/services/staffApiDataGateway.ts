import { ApiClient } from "../../../data/http/api-client";

type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta?: { total?: number };
};
type Row = Record<string, unknown> & { id: string };
type CourierWriteInput = {
  courierId?: string;
  fullName: string;
  nameAr?: string;
  nameEn?: string;
  courierType?: string;
  commissionRate?: number;
  currency?: string;
  isActive?: boolean;
  accountId?: string;
  phone?: string;
  email?: string;
  address?: string;
  gpsLocation?: string;
  notes?: string;
};
type EmployeeWriteInput = {
  employeeId?: string;
  fullName: string;
  nameAr?: string;
  nameEn?: string;
  jobType?: string;
  monthlySalary?: number;
  commissionRate?: number;
  currency?: string;
  accountId?: string;
  phone?: string;
  email?: string;
  disabled?: boolean;
  address?: string;
  gpsLocation?: string;
  notes?: string;
};
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
type StaffReadOptions = {
  includeEmployees?: boolean;
  includeOrders?: boolean;
  includeAccounts?: boolean;
};

const PAGE_SIZE = 1_000;
const MAX_ROWS = 20_000;

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001",
  accessTokenFactory: () =>
    typeof sessionStorage === "undefined"
      ? null
      : (sessionStorage.getItem("alx_access_token") || sessionStorage.getItem("alx_api_access_token")),
  maxReadRetries: 0,
});

async function readRows(path: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const response = await client.get<ApiEnvelope<Row[]>>(path, { limit: PAGE_SIZE, offset });
    const page = Array.isArray(response.data) ? response.data : [];
    rows.push(...page);
    const total = Number(response.meta?.total ?? rows.length);
    if (page.length < PAGE_SIZE || rows.length >= total) break;
  }
  return rows;
}

const normalize = (row: Row, key: string): Row => ({
  ...row,
  id: String(row[key] ?? row.id),
});

const normalizeCourier = (row: Row): Row => ({
  ...normalize(row, "courierId"),
  phone: String(row.phone ?? ""),
  email: String(row.email ?? ""),
  address: String(row.address ?? ""),
  gpsLocation: String(row.gpsLocation ?? ""),
  notes: String(row.notes ?? ""),
  courierType: row.courierType ?? row.type ?? "local",
  courierLevel: row.courierLevel ?? row.level ?? "",
  disabled: row.isActive === false,
});

const normalizeEmployee = (row: Row): Row => ({
  ...normalize(row, "employeeId"),
  phone: String(row.phone ?? ""),
  email: String(row.email ?? ""),
  address: String(row.address ?? ""),
  gpsLocation: String(row.gpsLocation ?? row.gps_location ?? ""),
  notes: String(row.notes ?? ""),
  jobsType: String(row.jobType ?? row.jobsType ?? "إداري"),
  jobType: String(row.jobType ?? row.jobsType ?? "إداري"),
  disabled: Boolean(row.disabled),
});

export const staffApiDataGateway = {
  isEnabled: () => import.meta.env.VITE_STAFF_API_READS === "true" || import.meta.env.VITE_USE_HTTP_API === "true",
  isWriteEnabled: () => import.meta.env.VITE_STAFF_API_WRITES === "true" || import.meta.env.VITE_USE_HTTP_API === "true",

  async createCourier(input: CourierWriteInput): Promise<Row> {
    const response = await client.post<ApiEnvelope<Row>>("/api/v1/operations/couriers", input);
    return normalizeCourier(response.data);
  },

  async updateCourier(courierId: string, input: Partial<CourierWriteInput>): Promise<Row> {
    const response = await client.patch<ApiEnvelope<Row>>(
      `/api/v1/operations/couriers/${encodeURIComponent(courierId)}`,
      input,
    );
    return normalizeCourier(response.data);
  },

  async deleteCourier(courierId: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(
      `/api/v1/operations/couriers/${encodeURIComponent(courierId)}`,
    );
  },

  async createEmployee(input: EmployeeWriteInput): Promise<Row> {
    const response = await client.post<ApiEnvelope<Row>>("/api/v1/operations/employees", input);
    return normalizeEmployee(response.data);
  },

  async updateEmployee(employeeId: string, input: Partial<EmployeeWriteInput>): Promise<Row> {
    const response = await client.patch<ApiEnvelope<Row>>(
      `/api/v1/operations/employees/${encodeURIComponent(employeeId)}`,
      input,
    );
    return normalizeEmployee(response.data);
  },

  async deleteEmployee(employeeId: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(
      `/api/v1/operations/employees/${encodeURIComponent(employeeId)}`,
    );
  },

  subscribe(handlers: StaffHandlers, options: StaffReadOptions = {}): () => void {
    let disposed = false;
    const refresh = async () => {
      try {
        const [couriers, employees, orders, accounts] = await Promise.all([
          readRows("/api/v1/reporting/couriers"),
          options.includeEmployees === false ? Promise.resolve([]) : readRows("/api/v1/reporting/employees"),
          options.includeOrders === false ? Promise.resolve([]) : readRows("/api/v1/orders"),
          options.includeAccounts === false ? Promise.resolve([]) : readRows("/api/v1/finance/accounts"),
        ]);
        if (!disposed) {
          handlers.onData({
            couriers: couriers.map(normalizeCourier),
            employees: employees.map(normalizeEmployee),
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
