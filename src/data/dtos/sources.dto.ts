import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';

export interface SourcesDatabaseRow {
  source_id: string;
  name: string | null;
  type: string | null;
  source_url: string | null;
  account_id: string | null;
  name_ar: string | null;
  name_en: string | null;
  /** مضاف في migration 20261002023000 */
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface ShippingCompanyDatabaseRow {
  shipping_company_id: string;
  name: string | null;
  shipping_company_url: string | null;
  tracking_id_prefix: string | null;
  account_id: string | null;
  name_ar: string | null;
  name_en: string | null;
  // ========= الحقول المضافة في migration 20261002023000 =========
  /** عنوان الشركة */
  address: string | null;
  /** هل نشطة */
  is_active: boolean | null;
  /** رمز الشركة */
  code: string | null;
  /** رقم الدولة */
  country_id: string | null;
  /** رقم الهاتف */
  phone: string | null;
  /** البريد الإلكتروني */
  email: string | null;
  /** رابط API التتبع */
  api_url: string | null;
  /** قالب رابط التتبع */
  tracking_url_template: string | null;
  /** هل مُفعل API */
  api_enabled: boolean | null;
  /** مرجع بيانات اعتماد API (ليس البيانات نفسها) */
  api_credentials_reference: string | null;
  /** هل يدعم التتبع */
  supports_tracking: boolean | null;
  /** هل يدعم Webhook */
  supports_webhook: boolean | null;
  // ===========================================================================
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface AssetDatabaseRow {
  asset_id: string;
  created_at: string | null;
  asset_code: string | null;
  account_id: string | null;
  status: string | null;
  currency: string | null;
  is_active: boolean;
  type: string | null;
  account_code: string | null;
  name_ar: string | null;
  name_en: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface SourcesApiDto {
  sourceId: string;
  name: string | null;
  type: string | null;
  sourceUrl: string | null;
  accountId: string | null;
  nameAr: string | null;
  nameEn: string | null;
  /** مضاف في migration 20261002023000 */
  isActive: boolean | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ShippingCompanyApiDto {
  shippingCompanyId: string;
  name: string | null;
  url: string | null;
  trackingIdPrefix: string | null;
  accountId: string | null;
  nameAr: string | null;
  nameEn: string | null;
  // ========= الحقول المضافة في migration 20261002023000 =========
  /** عنوان الشركة */
  address: string | null;
  /** هل نشطة */
  isActive: boolean | null;
  /** رمز الشركة */
  code: string | null;
  /** هل يدعم التتبع */
  supportsTracking: boolean | null;
  /** هل يدعم Webhook */
  supportsWebhook: boolean | null;
  // ===========================================================================
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
}

export interface AssetApiDto {
  assetId: string;
  assetCode: string | null;
  accountId: string | null;
  status: string | null;
  currency: string | null;
  isActive: boolean;
  type: string | null;
  accountCode: string | null;
  nameAr: string | null;
  nameEn: string | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
}

export interface SourcesCreateInput {
  name: string;
  type?: string | null;
  sourceUrl?: string | null;
  accountId?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
}
export type SourcesUpdateInput = Partial<SourcesCreateInput>;
export interface ShippingCompanyCreateInput {
  name: string;
  url?: string | null;
  trackingIdPrefix?: string | null;
  accountId?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
}
export type ShippingCompanyUpdateInput = Partial<ShippingCompanyCreateInput>;
export interface AssetCreateInput {
  assetCode: string;
  accountId?: string | null;
  currency?: string | null;
  isActive?: boolean;
  type?: string | null;
  accountCode?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
}
export type AssetUpdateInput = Partial<AssetCreateInput>;
export type SourcesViewModel = Partial<SourcesApiDto> & Pick<SourcesApiDto, 'sourceId'>;
export type SourcesAudit = AuditDto;
export type AssetValue = NumericValue;
