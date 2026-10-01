import type { IsoUtcString } from './common.dto';

export interface ReportPrintTemplateData {
  headerTitleAr: string;
  headerTitleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  footerTextAr: string;
  footerTextEn: string;
  logoUrl: string;
  showLogo: boolean;
  paperSize: 'A4' | 'A4_Landscape' | '80mm' | '58mm';
  margins: 'none' | 'minimal' | 'default';
  fontSize: 'xs' | 'sm' | 'md' | 'lg';
  showBarcode: boolean;
  showSignatures: boolean;
  showDateTime: boolean;
  showTaxId: boolean;
  taxNumber: string;
  primaryColor: string;
  fontFamily?: 'Cairo' | 'Inter' | 'JetBrains Mono' | 'Segoe UI';
  signature1Ar?: string;
  signature1En?: string;
  signature2Ar?: string;
  signature2En?: string;
  signature3Ar?: string;
  signature3En?: string;
  tableStyle?: 'solid' | 'dashed' | 'minimal';
}

export interface ReportTemplateDatabaseRow {
  report_template_id: string;
  data: ReportPrintTemplateData | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ReportSettingsDatabaseRow {
  report_setting_id: string;
  default_currency: string | null;
  alternative_currency: string | null;
  exchange_rates: unknown;
  updated_at: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface ReportTemplateApiDto {
  reportTemplateId: string;
  template: ReportPrintTemplateData | null;
  createdBy: string | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  updatedBy: string | null;
}

export interface ReportSettingsApiDto {
  reportSettingId: string;
  defaultCurrency: string | null;
  alternativeCurrency: string | null;
  exchangeRates: Readonly<Record<string, number>>;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
}

export type ReportsCreateInput = Omit<ReportTemplateApiDto, 'reportTemplateId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;
export type ReportsUpdateInput = Partial<ReportsCreateInput>;
export type ReportsViewModel = Partial<ReportTemplateApiDto> & { id: string };
