export class CbmRateNotFoundError extends Error {
  constructor() {
    super('CBM_RATE_NOT_FOUND');
    this.name = 'CbmRateNotFoundError';
  }
}

interface CbmRateResponse {
  cbm_rate?: unknown;
  rate?: unknown;
  value?: unknown;
  price?: unknown;
}

export async function fetchCbmRateFromApi(
  apiUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const response = await fetcher(apiUrl);
  if (!response.ok) {
    throw new Error('API request failed');
  }

  const data = await response.json() as CbmRateResponse;
  const rate = data.cbm_rate || data.rate || data.value || data.price;
  const parsedRate = Number.parseFloat(String(rate));

  if (!rate || Number.isNaN(parsedRate)) {
    throw new CbmRateNotFoundError();
  }

  return parsedRate;
}
