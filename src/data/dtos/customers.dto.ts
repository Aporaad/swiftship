import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';

/** Allowlisted customer profile fields read and written by the legacy customer screens/services. */
export interface CustomerProfileData {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gpsLocation?: string | null;
  gps_location?: string | null;
  lat?: NumericValue | null;
  lng?: NumericValue | null;
  city?: string | null;
  country?: string | null;
  companyName?: string | null;
  company_name?: string | null;
  idNumber?: string | null;
  id_number?: string | null;
  maxDebt?: NumericValue | null;
  max_debt?: NumericValue | null;
  notes?: string | null;
  createdAt?: IsoUtcString | number | string | null;
}

export interface CustomerEntityData extends CustomerProfileData {
  fullName?: string | null;
  createdAt?: IsoUtcString | number | string | null;
}

/** Raw storage shape is internal only; password must never be copied to an API DTO. */
export interface PortalUserDatabaseData {
  password?: string | null;
  fullName?: string | null;
  phone?: string | null;
  customerId?: string | null;
  createdAt?: IsoUtcString | number | string | null;
  updatedAt?: IsoUtcString | number | string | null;
}

export interface PortalUserDatabaseRow {
  portal_user_id: string;
  username: string | null;
  email: string | null;
  portal_role: string | null;
  approval_status: 'approved' | 'pending_approval' | 'rejected' | string | null;
  disabled: boolean | null;
  is_disabled: boolean | null;
  linked_customer_id: string | null;
  account_id: string | null;
  full_name: string | null;
  name_ar: string | null;
  name_en: string | null;
  data: PortalUserDatabaseData | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface PortalUserApiDto {
  portalUserId: string;
  username: string | null;
  email: string | null;
  portalRole: string | null;
  approvalStatus: string | null;
  disabled: boolean;
  linkedCustomerId: string | null;
  accountId: string | null;
  fullName: string | null;
  nameAr: string | null;
  nameEn: string | null;
  phone: string | null;
  customerId: string | null;
  hasPassword: boolean;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
}

export interface PortalUserCreateInput {
  username: string;
  email: string;
  password: string;
  portalRole?: string;
  approvalStatus?: 'approved' | 'pending_approval' | 'rejected';
  disabled?: boolean;
  linkedCustomerId?: string | null;
  accountId?: string | null;
  fullName?: string | null;
  phone?: string | null;
  customerId?: string | null;
}

export interface CustomersDatabaseRow {
  customer_id: string;
  account_id: string | null;
  is_active: boolean;
  join_by: string | null;
  referrer_id: string | null;
  full_name: string | null;
  name_ar: string | null;
  name_en: string | null;
  customer_level: string | null;
  data?: CustomerEntityData | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface CustomerDetailsDatabaseRow {
  cust_detail_id: string;
  user_uid: string | null;
  customer_id: string | null;
  join_by: string | null;
  referrer_id: string | null;
  onboarding_completed: boolean;
  created_at: string | null;
  updated_at: string | null;
  data: CustomerProfileData | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface CustomerDetailsApiDto {
  custDetailId: string;
  userUid: string | null;
  customerId: string | null;
  joinBy: string | null;
  referrerId: string | null;
  onboardingCompleted: boolean;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CustomerFinancialSummary {
  accountId: string | null;
  accountCode: string | null;
  balance: NumericValue | null;
  currency: string | null;
}

export interface CustomersApiDto {
  customerId: string;
  fullName: string | null;
  nameAr: string | null;
  nameEn: string | null;
  accountId: string | null;
  isActive: boolean;
  joinBy: string | null;
  referrerId: string | null;
  customerLevel: string | null;
  profile: CustomerProfileData;
  customerDetails: CustomerDetailsApiDto | null;
  portalAccount: PortalUserApiDto | null;
  financialAccount: CustomerFinancialSummary | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CustomersCreateInput {
  fullName: string;
  nameAr?: string | null;
  nameEn?: string | null;
  accountId?: string | null;
  isActive?: boolean;
  joinBy?: string | null;
  referrerId?: string | null;
  customerLevel?: string | null;
  profile?: CustomerProfileData;
  portalAccount?: PortalUserCreateInput;
}

export type CustomersUpdateInput = Partial<CustomersCreateInput>;
export type CustomersViewModel = Partial<CustomersApiDto> & { id: string };
export type CustomersAudit = AuditDto;
