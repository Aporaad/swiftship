import { ApiClient } from './api-client';
import type { SettingsApiDto, UserSettingsApiDto, SystemSettingsData } from '../dtos/settings.dto';

export interface ApiCurrencyDto {
  currencyId: number;
  code: string;
  mainNameAr: string;
  subNameAr: string | null;
  mainNameEn: string | null;
  subNameEn: string | null;
  symbol: string;
  flag: string | null;
  isDefault: boolean;
  isActive: boolean;
  currentPrice: number | null;
  lastSeq: number | null;
  lastUpdateBy: string | null;
  lastUpdateDate: string | null;
}

type ApiEnvelope<T> = { success: true; data: T };
const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

export const settingsCurrenciesApiGateway = {
  async getSettings(category: 'general' | 'logistics' | 'whatsapp'): Promise<SettingsApiDto> {
    const response = await client.get<ApiEnvelope<SettingsApiDto>>(`/api/v1/settings/${category}`);
    return response.data;
  },
  async updateSettings(category: 'general' | 'logistics' | 'whatsapp', settings: Partial<SystemSettingsData>): Promise<SettingsApiDto> {
    const response = await client.patch<ApiEnvelope<SettingsApiDto>>(`/api/v1/settings/${category}`, { settings });
    return response.data;
  },
  async getUserSettings(): Promise<UserSettingsApiDto> {
    const response = await client.get<ApiEnvelope<UserSettingsApiDto>>('/api/v1/settings/user');
    return response.data;
  },
  async updateUserSettings(settings: Partial<Pick<SystemSettingsData, 'language' | 'theme' | 'fontSize' | 'dashboardGridColumns' | 'visibleMetrics'>>): Promise<UserSettingsApiDto> {
    const response = await client.patch<ApiEnvelope<UserSettingsApiDto>>('/api/v1/settings/user', { settings });
    return response.data;
  },
  async listCurrencies(activeOnly = true): Promise<ApiCurrencyDto[]> {
    const response = await client.get<ApiEnvelope<ApiCurrencyDto[]>>(`/api/v1/currencies?activeOnly=${activeOnly ? 'true' : 'false'}`);
    return response.data;
  },
  async addCurrencyRate(currencyId: number, price: number): Promise<unknown> {
    const response = await client.post<ApiEnvelope<unknown>>(`/api/v1/currencies/${currencyId}/rates`, { price });
    return response.data;
  },
};
