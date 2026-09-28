import type { GatewayQuery } from '../contracts/common.gateway';

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
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
    if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
    return response.json() as Promise<T>;
  }
}
