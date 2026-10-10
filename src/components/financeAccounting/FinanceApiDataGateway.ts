import { ApiClient } from "../../data/http/api-client";
import { financeAccountingDataGateway as legacyGateway } from "./FinanceAccountingDataGateway";

type ApiEnvelope<T> = { success: true; data: T; meta?: { total?: number } };
type ApiPage<T> = { items: T[]; total?: number };
type Unsubscribe = () => void;

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001",
  accessTokenFactory: () =>
    typeof sessionStorage === "undefined"
      ? null
      : (sessionStorage.getItem("alx_access_token") || sessionStorage.getItem("alx_api_access_token")),
  maxReadRetries: 0,
});

const apiCollectionPaths: Record<string, string> = {
  accounts: "/api/v1/finance/accounts",
  main_entry: "/api/v1/finance/entries",
  account_trans: "/api/v1/finance/account-movements",
  custody_advances: "/api/v1/finance/custody-advances",
  auto_entries: "/api/v1/finance/auto-entry-rules",
};

function isEnabled(): boolean {
  return import.meta.env.VITE_FINANCE_API_READS === "true" || import.meta.env.VITE_USE_HTTP_API === "true";
}

function normalizeRows(
  collectionName: string,
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (collectionName === "accounts")
    return rows.map(row => ({
      ...row,
      id: row.accountId ?? row.id,
      accountName: row.accountNameAr ?? row.accountNameEn,
    }));
  if (collectionName === "main_entry")
    return rows.map(row => ({
      ...row,
      id: row.entryId ?? row.id,
      mainEntryId: row.entryId ?? row.id,
    }));
  if (collectionName === "account_trans")
    return rows.map(row => ({
      ...row,
      id: row.transactionId ?? row.id,
      entryId: row.entryId ?? row.mainEntryId,
      type: row.transType ?? row.type,
    }));
  if (collectionName === "custody_advances")
    return rows.map(row => ({ ...row, id: row.custodyAdvanceId ?? row.id }));
  return rows.map(row => ({ ...row, id: row.autoEntryId ?? row.id }));
}

async function fetchRows<T extends Record<string, unknown>>(
  collectionName: string
): Promise<T[]> {
  const path = apiCollectionPaths[collectionName];
  if (!path)
    throw new Error(`FINANCE_API_COLLECTION_UNSUPPORTED:${collectionName}`);
  const response = await apiClient.get<ApiEnvelope<ApiPage<T>>>(path, {
    limit: 100,
    offset: 0,
  });
  const rows = Array.isArray(response.data)
    ? response.data
    : (response.data.items ?? []);
  return normalizeRows(collectionName, rows) as T[];
}

export const financeApiDataGateway = {
  isEnabled,
  subscribeCollection<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    collectionName: string,
    onData: (rows: T[]) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    const fallback = () =>
      legacyGateway.subscribeCollection(collectionName, onData, onError);
    if (!isEnabled() || !apiCollectionPaths[collectionName]) return fallback();

    let disposed = false;
    let fallbackUnsubscribe: Unsubscribe | null = null;
    const load = async () => {
      try {
        const rows = await fetchRows<T>(collectionName);
        if (!disposed) onData(rows);
      } catch (error) {
        if (!disposed && !fallbackUnsubscribe) fallbackUnsubscribe = fallback();
        if (!disposed) onError(error);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => {
      disposed = true;
      clearInterval(interval);
      fallbackUnsubscribe?.();
    };
  },

  subscribeOrderedCollection<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    collectionName: string,
    _field: string,
    onData: (rows: T[]) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    return this.subscribeCollection(collectionName, onData, onError);
  },
};
