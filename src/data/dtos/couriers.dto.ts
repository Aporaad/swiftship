import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';

export interface CourierProfile {
  phone: string | null;
  email: string | null;
  address: string | null;
  gpsLocation: string | null;
  courierCustomId: string | null;
  notes: string | null;
}

export interface CouriersDatabaseRow {
  courier_id: string;
  account_id: string | null;
  currency: string | null;
  is_active: boolean;
  full_name: string | null;
  name_ar: string | null;
  name_en: string | null;
  courier_type: string | null;
  courier_level: string | null;
  commission_rate: NumericValue | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface CouriersApiDto {
  courierId: string;
  fullName: string | null;
  nameAr: string | null;
  nameEn: string | null;
  accountId: string | null;
  currency: string | null;
  isActive: boolean;
  type: string | null;
  level: string | null;
  commissionRate: number | null;
  profile: CourierProfile | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CouriersCreateInput {
  fullName: string;
  nameAr?: string | null;
  nameEn?: string | null;
  accountId?: string | null;
  currency?: string | null;
  type?: string | null;
  level?: string | null;
  commissionRate?: number | null;
  profile?: CourierProfile | null;
}
export type CouriersUpdateInput = Partial<CouriersCreateInput> & { isActive?: boolean };
export type CouriersViewModel = Partial<CouriersApiDto> & { id: string };
export type CouriersAudit = AuditDto;
