import { mapAccountRow } from "../../services/financeApi";
import { ApiClient } from "../../data/http/api-client";

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

const PAGE_SIZE = 1_000;
const MAX_ROWS = 20_000;

const apiCollectionPaths: Record<string, string> = {
  accounts: "/api/v1/finance/accounts",
  main_entry: "/api/v1/finance/entries",
  account_trans: "/api/v1/finance/account-movements",
  custody_advances: "/api/v1/finance/custody-advances",
  auto_entries: "/api/v1/finance/auto-entry-rules",
};

function isEnabled(): boolean {
  return true;
}

/**
 * يوحّد صفوف الحسابات القادمة من alx_api على شكل واحد تعرفه نماذج القيود والسندات.
 * Normalizes API account rows into the shape the entry/voucher forms filter on: a leaf posting
 * account is one that carries a sub-account id (acc_sub_id), never a hierarchy node.
 */
function normalizeAccountRow(row: Record<string, unknown>): Record<string, unknown> {
  const account = mapAccountRow(row) as unknown as Record<string, unknown>;
  const accSubId = String(account.accSubId ?? "").trim();
  return {
    ...account,
    accSubId: accSubId || undefined,
    isPosting: accSubId.length > 0,
    isHierarchyNode: accSubId.length === 0,
    name: account.accNameAr || account.entityName || account.id,
    accountName: account.accNameAr || account.accNameEn || account.id,
  };
}

function normalizeRows(
  collectionName: string,
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (collectionName === "accounts") return rows.map(normalizeAccountRow);
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
      module: row.module ?? row.entryCategory,
      refNumber: row.refNumber ?? row.entryNumber,
    }));
  if (collectionName === "custody_advances")
    return rows.map(row => ({ ...row, id: row.custodyAdvanceId ?? row.id }));
  return rows.map(row => ({ ...row, id: row.autoEntryId ?? row.id }));
}

function movementsPath(accountId: string): string {
  return `/api/v1/finance/accounts/${encodeURIComponent(accountId)}/movements`;
}

async function fetchAllPages<T extends Record<string, unknown>>(
  path: string,
  query: Record<string, string | number | boolean | undefined> = {}
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const response = await apiClient.get<ApiEnvelope<ApiPage<T>>>(path, {
      ...query,
      limit: PAGE_SIZE,
      offset,
    });
    const page = Array.isArray(response.data)
      ? response.data
      : (response.data.items ?? []);
    rows.push(...page);
    const total = Number(response.meta?.total ?? rows.length);
    if (page.length < PAGE_SIZE || rows.length >= total) break;
  }
  return rows;
}

async function fetchRows<T extends Record<string, unknown>>(
  collectionName: string
): Promise<T[]> {
  const path = apiCollectionPaths[collectionName];
  if (!path)
    throw new Error(`FINANCE_API_COLLECTION_UNSUPPORTED:${collectionName}`);
  const rows = await fetchAllPages<T>(path, collectionName === "accounts" ? { includeInactive: true } : {});
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
    if (!isEnabled()) {
      void Promise.resolve().then(() => onError(new Error("FINANCE_API_REQUIRED")));
      return () => undefined;
    }
    if (!apiCollectionPaths[collectionName]) {
      void Promise.resolve().then(() => onError(new Error(`FINANCE_API_COLLECTION_UNSUPPORTED:${collectionName}`)));
      return () => undefined;
    }

    let disposed = false;
    const load = async () => {
      try {
        const rows = await fetchRows<T>(collectionName);
        if (!disposed) onData(rows);
      } catch (error) {
        if (!disposed) onError(error);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => {
      disposed = true;
      clearInterval(interval);
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

  /**
   * جلب حركات حساب مالي محدد مرة واحدة عبر API
   * Fetch transactions for a specific financial account once via API
   */
  async getAccountTransactions(accountId: string): Promise<Record<string, unknown>[]> {
    const rows = await fetchAllPages(movementsPath(accountId));
    return normalizeRows("account_trans", rows);
  },

  subscribeAccountMovements(
    accountId: string,
    onData: (rows: Record<string, unknown>[]) => void,
    onError: (error: unknown) => void,
  ): Unsubscribe {
    let disposed = false;
    const load = async () => {
      try {
        const rows = await fetchAllPages(movementsPath(accountId));
        if (!disposed) onData(normalizeRows("account_trans", rows));
      } catch (error) {
        if (!disposed) onError(error);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  },
};
