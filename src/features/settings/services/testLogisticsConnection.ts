import type { LogisticsSettings } from '../types';

export interface LogisticsConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function testLogisticsConnection(
  settings: LogisticsSettings,
  fetcher: typeof fetch = fetch,
): Promise<LogisticsConnectionResult> {
  const response = await fetcher('/api/tracking/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const result = await response.json() as LogisticsConnectionResult;

  if (response.ok && result.success) {
    return { success: true, message: result.message };
  }

  return { success: false, error: result.error || 'Connection failed' };
}
