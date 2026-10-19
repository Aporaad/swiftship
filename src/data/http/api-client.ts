import {
  ApplicationError,
  errorDetailsFromUnknown,
} from "../../shared/contracts/error.contracts";
import type { ErrorDetails } from "../../shared/contracts/error.contracts";
import type { GatewayQuery } from "../contracts/common.gateway";
import { createAccessTokenRefresher } from "./session-refresh";

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  /** مهلة القراءة المستقلة: صفحات limit=1000 تتجاوز المهلة القصيرة فتُلغى ثم تُعاد، وهذا هو انقطاع البيانات.
   *  Independent read budget: limit=1000 pages exceed a short timeout, abort, and retry — that is the data dropout. */
  readTimeoutMs?: number;
  requestIdFactory?: () => string;
  maxReadRetries?: number;
  accessTokenFactory?: () => string | null | undefined;
  /** يجدد الرمز عند 401 ثم تُعاد المحاولة مرة واحدة — افتراضيًا عبر /auth/refresh المشترك.
   *  Refreshes the token on a 401 and retries once; defaults to the shared /auth/refresh refresher. */
  refreshAccessToken?: () => Promise<string | null>;
}

export class ApiClientError extends ApplicationError {
  constructor(details: ErrorDetails) {
    super(details);
    this.name = "ApiClientError";
  }
}

interface RequestSpec {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: GatewayQuery;
  body?: unknown;
  extraHeaders?: Record<string, string>;
  /** يمنع إعادة التجديد اللانهائية: المحاولة الثانية لا مجددة لها.
   *  Stops endless refresh loops: the retried attempt never refreshes again. */
  retried?: boolean;
}

/** يبني خطأ العقد الموحد من استجابة فاشلة (يشمل تفاصيل التحقق الحقلي).
 *  Builds the unified contract error from a failed response, including field-level validation issues. */
async function apiErrorFromResponse(response: Response): Promise<ApiClientError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error responses use the same safe fallback contract.
  }
  const fallbackCode = "API_REQUEST_FAILED";
  const normalized = errorDetailsFromUnknown(body, fallbackCode);
  const requestId = normalized.requestId ?? response.headers.get("x-request-id") ?? undefined;
  return new ApiClientError({
    ...normalized,
    code: normalized.code || fallbackCode,
    message:
      normalized.code === fallbackCode
        ? `API request failed with status ${response.status}.`
        : normalized.message,
    ...(requestId ? { requestId } : {}),
  });
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly refreshAccessToken: () => Promise<string | null>;
  /** مهلتان منفصلتان: الكتابة يجب أن تُغلق سريعًا، والقراءة الكبيرة تحتاج سعة أكبر.
   *  Two separate budgets: writes must fail fast, large reads need more headroom. */
  private readonly writeTimeoutMs: number;
  private readonly readTimeoutMs: number;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.refreshAccessToken =
      options.refreshAccessToken ?? createAccessTokenRefresher(options.baseUrl);
    this.writeTimeoutMs = options.timeoutMs ?? 10_000;
    this.readTimeoutMs = options.readTimeoutMs ?? Math.max(this.writeTimeoutMs, 30_000);
  }

  async get<T>(path: string, query?: GatewayQuery): Promise<T> {
    return this.request<T>({ path, method: "GET", query });
  }

  async post<T>(path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    return this.request<T>({ path, method: "POST", body, extraHeaders });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ path, method: "PATCH", body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>({ path, method: "DELETE" });
  }

  async requestWithBodyForGateway<T>(method: "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
    return this.request<T>({ path, method, body });
  }

  /** مسار تنفيذ واحد لكل الطلبات: مهلة لكل محاولة، تجديد عند 401، وإعادة محاولة للقراءات عند 5xx.
   *  One execution path for every request: per-attempt timeout, refresh on 401, and read retry on 5xx. */
  private async request<T>(spec: RequestSpec): Promise<T> {
    const url = new URL(spec.path, this.options.baseUrl);
    for (const [key, value] of Object.entries(spec.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = spec.method === "GET"
      ? await this.readWithRetries(url, spec)
      : await this.send(url, spec);

    if (response.ok) return response.json() as Promise<T>;

    // 401: ينجح التجديد فقط إذا ملك العميل refreshToken صالحًا؛ وإلا يظهر الخطأ كما هو.
    // A 401 is retried only when the refresh genuinely succeeds; otherwise the original error surfaces.
    if (response.status === 401 && !spec.retried) {
      const token = await this.refreshAccessToken();
      if (token) {
        const retriedResponse = await this.send(url, { ...spec, retried: true });
        if (retriedResponse.ok) return retriedResponse.json() as Promise<T>;
        throw await apiErrorFromResponse(retriedResponse);
      }
    }

    throw await apiErrorFromResponse(response);
  }

  private async send(url: URL, spec: RequestSpec): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      spec.method === "GET" ? this.readTimeoutMs : this.writeTimeoutMs,
    );
    const accessToken = this.options.accessTokenFactory?.();
    try {
      return await this.fetchImpl(url, {
        method: spec.method,
        credentials: this.options.credentials ?? "include",
        headers: {
          Accept: "application/json",
          ...(spec.body === undefined ? {} : { "Content-Type": "application/json" }),
          "x-request-id": this.options.requestIdFactory?.() ?? crypto.randomUUID(),
          ...spec.extraHeaders,
          // رمز الجلسة يسبق أي ترويسة إضافية: لا يسمح للعميل بتجاوز المصادقة.
          // The session token is applied last so a caller cannot override authentication.
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /** القراءات فقط تُعاد محاولتها عند 5xx/انقطاع — الكتابات لا تُكرَّر كي لا تتضاعف العمليات.
   *  Only reads retry on 5xx/aborts; writes are never repeated so side effects cannot double-apply. */
  private async readWithRetries(url: URL, spec: RequestSpec): Promise<Response> {
    const maxRetries = Math.max(0, this.options.maxReadRetries ?? 1);
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await this.send(url, spec);
        if (response.ok || response.status < 500 || attempt === maxRetries) return response;
      } catch (error) {
        if (error instanceof ApiClientError) throw error;
        if (attempt === maxRetries) throw new ApiClientError({ code: "API_REQUEST_FAILED", message: "API request failed." });
      }
    }
    throw new ApiClientError({ code: "API_REQUEST_FAILED", message: "API request failed." });
  }
}
