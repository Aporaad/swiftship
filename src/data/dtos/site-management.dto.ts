import type { AuditDto, IsoUtcString } from './common.dto';

export interface AnnouncementContent {
  content?: string | null;
  body?: string | null;
  bodyAr?: string | null;
  bodyEn?: string | null;
  imageUrl?: string | null;
  actionUrl?: string | null;
  targetAudience?: string | null;
  target_audience?: string | null;
  priority?: string | null;
  isActive?: boolean | null;
  is_active?: boolean | null;
  createdAt?: IsoUtcString | number | string | null;
  created_at?: IsoUtcString | number | string | null;
  updatedAt?: IsoUtcString | number | string | null;
}

export interface JobApplicationData {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobPosition?: string | null;
  experienceYears?: number | string | null;
  idNumber?: string | null;
  qualification?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  refCode?: string | null;
  status?: string | null;
  createdAt?: IsoUtcString | number | string | null;
  updatedAt?: IsoUtcString | number | string | null;
}

export interface PortalTicketReply {
  id: string;
  sender: string | null;
  message: string;
  createdAt: IsoUtcString | number | string | null;
}

export interface PortalTicketData {
  subject?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  message?: string | null;
  replies?: PortalTicketReply[] | null;
  createdAt?: IsoUtcString | number | string | null;
  updatedAt?: IsoUtcString | number | string | null;
}

export interface SiteManagementDatabaseRow {
  announcement_id: string;
  data: AnnouncementContent | null;
  created_at: string | null;
  title: string | null;
  is_active: boolean;
  priority: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface JobRequestDatabaseRow {
  jobs_req_id: string;
  data: JobApplicationData | null;
  email: string | null;
  phone: string | null;
  status: string;
  category: string | null;
  ref_code: string | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface PortalTicketDatabaseRow {
  portal_ticket_id: string;
  data: PortalTicketData | null;
  created_at: string | null;
  type: string | null;
  status: string;
  user_uid: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface SiteManagementApiDto {
  announcementId: string;
  title: string | null;
  content: AnnouncementContent;
  isActive: boolean;
  priority: string;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface JobRequestApiDto {
  jobRequestId: string;
  email: string | null;
  phone: string | null;
  status: string;
  category: string | null;
  referenceCode: string | null;
  application: JobApplicationData;
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface PortalTicketApiDto {
  portalTicketId: string;
  type: string | null;
  status: string;
  portalUserId: string | null;
  ticket: PortalTicketData;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface SiteManagementCreateInput {
  title: string;
  content?: AnnouncementContent;
  isActive?: boolean;
  priority?: string;
}
export type SiteManagementUpdateInput = Partial<SiteManagementCreateInput>;

export interface JobRequestCreateInput {
  email?: string | null;
  phone?: string | null;
  status?: string;
  category?: string | null;
  referenceCode?: string | null;
  application: JobApplicationData;
}
export type JobRequestUpdateInput = Partial<JobRequestCreateInput>;

export interface PortalTicketCreateInput {
  type: string;
  status?: string;
  portalUserId?: string | null;
  ticket: PortalTicketData;
}
export type PortalTicketUpdateInput = Partial<PortalTicketCreateInput>;

export type SiteManagementViewModel = Partial<SiteManagementApiDto> & { siteId: string };
export type SiteManagementAudit = AuditDto;
