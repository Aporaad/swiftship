import { ApplicationError, errorDetailsFromUnknown } from '../../shared/contracts/error.contracts';
import type { ErrorDetails } from '../../shared/contracts/error.contracts';
import type { GatewayQuery } from '../contracts/common.gateway';

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class ApiClientError extends ApplicationError {
  constructor(details: ErrorDetails) {
    super(details);
    this.name = 'ApiClientError';
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

    const response = await this.fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // Non-JSON error responses use the same safe fallback contract.
      }

      const fallbackCode = 'API_REQUEST_FAILED';
      const normalized = errorDetailsFromUnknown(body, fallbackCode);
      const requestId = normalized.requestId ?? response.headers.get('x-request-id') ?? undefined;
      throw new ApiClientError({
        ...normalized,
        code: normalized.code || fallbackCode,
        message: normalized.code === fallbackCode
          ? `API request failed with status ${response.status}.`
          : normalized.message,
        ...(requestId ? { requestId } : {}),
      });
    }

    return response.json() as Promise<T>;
  }
}
