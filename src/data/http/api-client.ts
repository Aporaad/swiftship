import {
  ApplicationError,
  errorDetailsFromUnknown,
} from "../../shared/contracts/error.contracts";
import type { ErrorDetails } from "../../shared/contracts/error.contracts";
import type { GatewayQuery } from "../contracts/common.gateway";

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  requestIdFactory?: () => string;
  maxReadRetries?: number;
  accessTokenFactory?: () => string | null | undefined;
}

export class ApiClientError extends ApplicationError {
  constructor(details: ErrorDetails) {
    super(details);
    this.name = "ApiClientError";
  }
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async get<T>(path: string, query?: GatewayQuery): Promise<T> {
    const url = new URL(path, this.options.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const maxRetries = Math.max(0, this.options.maxReadRetries ?? 1);
    let response: Response | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.options.timeoutMs ?? 10000
      );
      try {
        const accessToken = this.options.accessTokenFactory?.();
        response = await this.fetchImpl(url, {
          method: "GET",
          credentials: this.options.credentials ?? "include",
          headers: {
            Accept: "application/json",
            "x-request-id":
              this.options.requestIdFactory?.() ?? crypto.randomUUID(),
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok || response.status < 500 || attempt === maxRetries)
          break;
      } catch {
        clearTimeout(timeout);
        if (attempt === maxRetries) {
          throw new ApiClientError({
            code: "API_REQUEST_FAILED",
            message: "API request failed.",
          });
        }
      }
    }
    if (response === null)
      throw new ApiClientError({
        code: "API_REQUEST_FAILED",
        message: "API request failed.",
      });
    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // Non-JSON error responses use the same safe fallback contract.
      }

      const fallbackCode = "API_REQUEST_FAILED";
      const normalized = errorDetailsFromUnknown(body, fallbackCode);
      const requestId =
        normalized.requestId ??
        response.headers.get("x-request-id") ??
        undefined;
      throw new ApiClientError({
        ...normalized,
        code: normalized.code || fallbackCode,
        message:
          normalized.code === fallbackCode
            ? `API request failed with status ${response.status}.`
            : normalized.message,
        ...(requestId ? { requestId } : {}),
      });
    }

    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(path, this.options.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 10000
    );
    try {
      const accessToken = this.options.accessTokenFactory?.();
      const response = await this.fetchImpl(url, {
        method: "POST",
        credentials: this.options.credentials ?? "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-request-id":
            this.options.requestIdFactory?.() ?? crypto.randomUUID(),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        let responseBody: unknown = null;
        try {
          responseBody = await response.json();
        } catch {
          // Keep the safe API error contract for non-JSON responses.
        }
        const normalized = errorDetailsFromUnknown(
          responseBody,
          "API_REQUEST_FAILED"
        );
        throw new ApiClientError({
          ...normalized,
          code: normalized.code || "API_REQUEST_FAILED",
          message:
            normalized.message ||
            `API request failed with status ${response.status}.`,
        });
      }
      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError({
        code: "API_REQUEST_FAILED",
        message: "API request failed.",
      });
    }
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.requestWithBody<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.requestWithBody<T>('DELETE', path);
  }

  private async requestWithBody<T>(method: 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const url = new URL(path, this.options.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10000);
    try {
      const accessToken = this.options.accessTokenFactory?.();
      const response = await this.fetchImpl(url, {
        method,
        credentials: this.options.credentials ?? 'include',
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          'x-request-id': this.options.requestIdFactory?.() ?? crypto.randomUUID(),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        let responseBody: unknown = null;
        try {
          responseBody = await response.json();
        } catch {
          // Keep the safe API error contract for non-JSON responses.
        }
        const normalized = errorDetailsFromUnknown(responseBody, 'API_REQUEST_FAILED');
        throw new ApiClientError({
          ...normalized,
          code: normalized.code || 'API_REQUEST_FAILED',
          message: normalized.message || `API request failed with status ${response.status}.`,
        });
      }
      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError({ code: 'API_REQUEST_FAILED', message: 'API request failed.' });
    }
  }
}
