import { ApiClient } from "../../data/http/api-client";

type ApiEnvelope<T> = { success: true; data: T };
type EntryPayload = Record<string, unknown>;

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001",
  accessTokenFactory: () =>
    typeof sessionStorage === "undefined"
      ? null
      : sessionStorage.getItem("alx_api_access_token"),
  maxReadRetries: 0,
});

const numericLineFields = [
  "accountCurNo",
  "amount",
  "amountOriginal",
  "currencyOriginalNo",
  "currencyPriceId",
  "currencyPriceSeq",
  "accountCurrencyPriceId",
  "accountCurrencyPriceSeq",
] as const;

function numberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function normalizeCreatePayload(payload: EntryPayload): EntryPayload {
  const {
    id: _id,
    paymentDetails: _paymentDetails,
    createdByUid: _createdByUid,
    ...entry
  } = payload;
  const lines = Array.isArray(entry.lines)
    ? entry.lines.map(rawLine => {
        const line = { ...(rawLine as EntryPayload) };
        for (const field of numericLineFields) {
          const value = numberOrUndefined(line[field]);
          if (value === undefined) delete line[field];
          else line[field] = value;
        }
        for (const field of ["id", "amountText", "amountOriginalText"])
          delete line[field];
        for (const field of [
          "entityType",
          "entityId",
          "paymentMethod",
          "orderId",
          "shipmentId",
          "custodyId",
          "description",
          "note",
        ]) {
          if (line[field] === "") delete line[field];
        }
        return line;
      })
    : [];

  const result: EntryPayload = { ...entry, lines };
  if (!result.entryNumber)
    throw new Error("رقم القيد مطلوب عند النقل إلى Finance API.");
  for (const field of [
    "notes",
    "paymentMethod",
    "orderId",
    "shipmentId",
    "custodyId",
    "automationKey",
    "autoRuleId",
  ]) {
    if (result[field] === "") delete result[field];
  }
  if (result.effectiveAt === "") delete result.effectiveAt;
  return result;
}

function unwrap<T>(response: ApiEnvelope<T>): T {
  return response.data;
}

export const financeApiWriteGateway = {
  isEnabled(): boolean {
    return import.meta.env.VITE_FINANCE_API_WRITES === "true";
  },

  async createEntry(payload: EntryPayload): Promise<EntryPayload> {
    const response = await apiClient.post<ApiEnvelope<EntryPayload>>(
      "/api/v1/finance/entries",
      normalizeCreatePayload(payload)
    );
    return unwrap(response);
  },

  async postEntry(entryId: string): Promise<EntryPayload> {
    const response = await apiClient.post<ApiEnvelope<EntryPayload>>(
      `/api/v1/finance/entries/${encodeURIComponent(entryId)}/post`,
      {}
    );
    return unwrap(response);
  },

  async reverseEntry(
    entryId: string,
    description: string,
    effectiveAt?: string
  ): Promise<EntryPayload> {
    const body = { description, ...(effectiveAt ? { effectiveAt } : {}) };
    const response = await apiClient.post<ApiEnvelope<EntryPayload>>(
      `/api/v1/finance/entries/${encodeURIComponent(entryId)}/reverse`,
      body
    );
    return unwrap(response);
  },

  async voidDraft(entryId: string): Promise<EntryPayload> {
    const response = await apiClient.post<ApiEnvelope<EntryPayload>>(
      `/api/v1/finance/entries/${encodeURIComponent(entryId)}/void`,
      {}
    );
    return unwrap(response);
  },
};
