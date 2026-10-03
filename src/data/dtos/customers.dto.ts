import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';
import type { ApprovalStatus } from '../../shared/contracts/value-primitives';

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
  // account_id: حُذف في migration 20261002023000 — لا يُستخدم بعد الآن
  full_name: string | null;
  name_ar: string | null;
  name_en: string | null;
  // ========= الحقول المستخرجة من data JSONB (migration 20261002023000) =========
  /** نوع المستخدم */
  type: string | null;
  /** رقم الهاتف */
  phone: string | null;
  /** ملاحظات */
  notes: string | null;
  /** رابط صورة الملف الشخصي */
  profile_image_url: string | null;
  /** رابط السجل التجاري */
  commercial_register_url: string | null;
  /** رابط وثيقة الهوية */
  identity_doc_url: string | null;
  /** هل اكتمل التأهيل */
  onboarding_completed: boolean | null;
  /** كلمة المرور — لا تُرسل أبداً إلى API — يجب ترحيلها إلى password_hash */
  password: string | null;
  // ===========================================================================
  /** بيانات JSONB legacy — للسجلات القديمة فقط */
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
  approvalStatus: ApprovalStatus | null;
  disabled: boolean;
  linkedCustomerId: string | null;
  fullName: string | null;
  nameAr: string | null;
  nameEn: string | null;
  phone: string | null;
  type: string | null;
  notes: string | null;
  profileImageUrl: string | null;
  commercialRegisterUrl: string | null;
  identityDocUrl: string | null;
  onboardingCompleted: boolean | null;
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
  approvalStatus?: ApprovalStatus;
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
  // ========= الحقول المستخرجة من data JSONB (migration 20261002023000) =========
  /** مصدر الاكتساب */
  acquisition_source: string | null;
  /** الفئات المفضلة */
  preferred_categories: string[] | null;
  /** تفاصيل الجسم */
  body_details: Record<string, unknown> | null;
  /** موقع جغرافي */
  location: Record<string, unknown> | null;
  /** العنوان */
  address: string | null;
  // ===========================================================================
  /** بيانات JSONB legacy — للسجلات القديمة فقط */
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
  // ========= الحقول المستخرجة من data JSONB (migration 20261002023000) =========
  age: number | null;
  city: string | null;
  company_name: string | null;
  country: string | null;
  gender: string | null;
  gps_location: string | null;
  id_number: string | null;
  max_debt: number | null;
  notes: string | null;
  privacy_policy_agreed: boolean | null;
  privacy_policy_agreed_at: string | null;
  // ===========================================================================
  created_at: string | null;
  updated_at: string | null;
  /** بيانات JSONB legacy — للسجلات القديمة فقط */
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
