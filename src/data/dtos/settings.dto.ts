import type { IsoUtcString } from './common.dto';

export interface CustomCurrencyDto {
  id: string;
  code: string;
  name: string;
  symbol: string;
  rateToYER: number;
  flag?: string;
  isActive: boolean;
}

export type WhatsAppProvider = 'ultramsg' | 'twilio' | 'custom';

export interface WhatsAppSettingsWriteInput {
  enabled: boolean;
  provider: WhatsAppProvider;
  config: {
    token?: string;
    instanceId?: string;
    accountSid?: string;
    sender?: string;
    customUrl?: string;
    customMethod?: string;
    customHeaders?: string;
    customBody?: string;
  };
  triggers: {
    onOrderCreated: boolean;
    onOrderStatusChanged: boolean;
    onPaymentReceived: boolean;
  };
  templates: {
    onOrderCreated: string;
    onOrderStatusChanged: string;
    onPaymentReceived: string;
  };
}

/** Safe read model: never returns tokens, account SIDs, custom headers, or raw custom request bodies. */
export interface WhatsAppSettingsApiDto {
  enabled: boolean;
  provider: WhatsAppProvider;
  credentials: {
    hasToken: boolean;
    hasInstanceId: boolean;
    hasAccountSid: boolean;
    sender: string | null;
    hasCustomUrl: boolean;
    hasCustomHeaders: boolean;
    hasCustomBody: boolean;
  };
  triggers: WhatsAppSettingsWriteInput['triggers'];
  templates: WhatsAppSettingsWriteInput['templates'];
}

/** Allowlisted settings used by SettingsContext; raw JSONB is not returned. */
export interface SystemSettingsData {
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  systemName: string;
  systemLogo?: string;
  orderPrefix: string;
  orderStartNumber: number;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyAddress?: string;
  taxId: string;
  invoiceLogo?: string;
  invoiceNotes?: string;
  currency: string;
  currencySymbol: string;
  exchangeRateUSD?: number;
  exchangeRateSAR?: number;
  autoUpdateExchangeRates?: boolean;
  exchangeRatesApiUrl?: string;
  lastExchangeRateUpdate?: string;
  lastExchangeRateUpdateTime?: string;
  lastExchangeRateUpdatedBy?: string;
  customCurrencies?: CustomCurrencyDto[];
  defaultPackagingFee?: number;
  defaultBankCommissionRate?: number;
  defaultCompanyProfitRate?: number;
  defaultDeliveryFee?: number;
  defaultCourierCommissionRate?: number;
  defaultOrderCurrency?: string;
  defaultProductInsuranceFee?: number;
  defaultProductInsuranceType?: 'fixed' | 'percentage';
  defaultSheinDuration?: number;
  defaultAppDuration?: number;
  defaultFactoryDuration?: number;
  defaultYemenDeliveryDuration?: number;
  defaultShippingDuration?: number;
  defaultProfitPerKg?: number;
  cbmShippingRate?: number;
  cbmShippingRateApiUrl?: string;
  lastCbmRateUpdate?: string;
  lastCbmRateUpdatedBy?: string;
  protectSensitiveOrderDelete?: boolean;
  userSessionTimeout?: number;
  autoBackupEnabled?: boolean;
  backupSchedule?: 'daily' | 'weekly' | 'monthly' | 'manual';
  backupRetentionDays?: number;
  backupCollections?: string[];
  backupEncrypted?: boolean;
  lastBackup?: string;
  lastAutoBackupAt?: number;
  backupCount?: number;
  autoNotification?: boolean;
  dashboardGridColumns?: number;
  visibleMetrics?: string[];
}

export interface SettingsDatabaseRow {
  setting_id: string;
  data: SystemSettingsData;
  category: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface WhatsAppSettingsDatabaseRow extends Omit<SettingsDatabaseRow, 'data'> {
  data: WhatsAppSettingsWriteInput;
}
export interface UserSettingsDatabaseRow {
  user_setting_id: string;
  data: Pick<SystemSettingsData, 'language' | 'theme' | 'fontSize' | 'dashboardGridColumns' | 'visibleMetrics'>;
  created_at: string;
  user_id: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface OrderStatusDatabaseRow {
  order_status_id: string;
  name_ar: string;
  name_en: string | null;
  is_first: boolean;
  is_last: boolean;
  sort_order: number;
  color: string | null;
  code: string | null;
  data: unknown;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}
export interface OrderOptionDatabaseRow {
  order_option_id: string;
  type: string;
  name_ar: string | null;
  name_en: string | null;
  price: number | string | null;
  duration: number | null;
  details: string | null;
  code: string | null;
  is_active: boolean;
  data: unknown;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface SettingsApiDto {
  settingId: string;
  category: string | null;
  settings: SystemSettingsData;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}
export interface UserSettingsApiDto {
  userSettingId: string;
  userId: string | null;
  settings: Partial<Pick<SystemSettingsData, 'language' | 'theme' | 'fontSize' | 'dashboardGridColumns' | 'visibleMetrics'>>;
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
}
export interface OrderStatusApiDto {
  orderStatusId: string;
  nameAr: string;
  nameEn: string | null;
  isFirst: boolean;
  isLast: boolean;
  sortOrder: number;
  color: string | null;
  code: string | null;
  description: string | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}
export interface OrderOptionApiDto {
  orderOptionId: string;
  type: string;
  nameAr: string | null;
  nameEn: string | null;
  price: number | null;
  duration: number | null;
  details: string | null;
  code: string | null;
  isActive: boolean;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface SettingsCreateInput {
  category: string;
  settings: Partial<SystemSettingsData>;
}
export interface SettingsUpdateInput {
  category?: string;
  settings?: Partial<SystemSettingsData>;
}
export type SettingsViewModel = Partial<SettingsApiDto> & { id: string };
