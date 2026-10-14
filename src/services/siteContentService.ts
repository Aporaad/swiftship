/**
 * siteContentService.ts
 * خدمة محتوى الموقع (تذاكر الدعم / الإعلانات / طلبات التوظيف / طلبات البوابة) — API-only عبر alx_api.
 * Site content service — API-only through alx_api; every field arrives as a flat camelCase property.
 * لا تقرأ الخدمة أي حمولة jsonb: العقد المسطّح هو الشكل الوحيد بين الخادم والواجهة.
 * No jsonb payload is read: the flat contract is the only shape crossing the wire.
 */
import { financeApiClient, readAllFinanceRows, type ApiEnvelope } from './financeApi';

const TICKETS_PATH = '/api/v1/site/tickets';
const ANNOUNCEMENTS_PATH = '/api/v1/site/announcements';
const JOB_APPLICATIONS_PATH = '/api/v1/site/job-applications';
const PORTAL_ORDERS_PATH = '/api/v1/site/portal-orders';
const PAGE_SIZE = 500;

export interface TicketReply {
  sender: string;
  message: string;
  createdAt: number;
}

export interface SupportTicketRow {
  id: string;
  userUid: string;
  subject: string;
  message: string;
  type: string;
  status: string;
  userName: string;
  userRole: string;
  userEmail: string;
  adminResponse: string;
  replies: TicketReply[];
  createdAt: number;
  updatedAt: number;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  priority: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface JobApplicationRow {
  id: string;
  status: string;
  fullName: string;
  jobPosition: string;
  refCode: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  qualification: string;
  idNumber: string;
  notes: string;
  experienceYears: number;
  createdAt: number;
  updatedAt: number;
}

/** صفوف تبويب «طلبات الموقع» — الخادم يجهّز حقلات العرض المسطّحة فلا يقرأ المتصفح جدول الطلبات. */
export interface PortalOrderRow {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  createdAt: number;
  customerName: string;
  recipientName: string;
  customerPhone: string;
  deliveryCity: string;
  orderSourceName: string;
  orderSourceType: string;
  orderStatus: string;
  goodsDescription: string;
  totalPrice: number;
}

export interface AnnouncementInput {
  title: string;
  content: string;
  targetAudience: string;
  priority: string;
  isActive: boolean;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));

const timestamp = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const amount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** الردود تصل صفوفًا من `portal_ticket_reply`؛ تُطبَّع القيم فقط ولا يُختلق أي رد. */
function repliesOf(value: unknown): TicketReply[] {
  return (Array.isArray(value) ? value : []).map((entry) => {
    const reply = record(entry);
    return { sender: text(reply.sender), message: text(reply.message), createdAt: timestamp(reply.createdAt) };
  });
}

function mapTicket(row: Record<string, unknown>): SupportTicketRow {
  return {
    id: text(row.id),
    userUid: text(row.userUid),
    subject: text(row.subject),
    message: text(row.message),
    type: text(row.type),
    status: text(row.status) || 'open',
    userName: text(row.userName),
    userRole: text(row.userRole),
    userEmail: text(row.userEmail),
    adminResponse: text(row.adminResponse),
    replies: repliesOf(row.replies),
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  };
}

function mapAnnouncement(row: Record<string, unknown>): AnnouncementRow {
  return {
    id: text(row.id),
    title: text(row.title),
    content: text(row.content),
    targetAudience: text(row.targetAudience),
    priority: text(row.priority) || 'normal',
    isActive: row.isActive !== false,
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  };
}

function mapJobApplication(row: Record<string, unknown>): JobApplicationRow {
  return {
    id: text(row.id),
    status: text(row.status) || 'pending_review',
    fullName: text(row.fullName),
    jobPosition: text(row.jobPosition),
    refCode: text(row.refCode),
    phone: text(row.phone),
    email: text(row.email),
    city: text(row.city),
    address: text(row.address),
    qualification: text(row.qualification),
    idNumber: text(row.idNumber),
    notes: text(row.notes),
    experienceYears: amount(row.experienceYears),
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  };
}

function mapPortalOrder(row: Record<string, unknown>): PortalOrderRow {
  return {
    id: text(row.id),
    orderNumber: text(row.orderNumber),
    trackingNumber: text(row.trackingNumber),
    createdAt: timestamp(row.createdAt),
    customerName: text(row.customerName),
    recipientName: text(row.recipientName),
    customerPhone: text(row.customerPhone),
    deliveryCity: text(row.deliveryCity),
    orderSourceName: text(row.orderSourceName),
    orderSourceType: text(row.orderSourceType),
    orderStatus: text(row.orderStatus),
    goodsDescription: text(row.goodsDescription),
    totalPrice: amount(row.totalPrice),
  };
}

async function listAll<T>(path: string, map: (row: Record<string, unknown>) => T): Promise<T[]> {
  const rows = await readAllFinanceRows(path, {}, PAGE_SIZE);
  return rows.map((row) => map(row as Record<string, unknown>));
}

export const siteContentService = {
  /** تذاكر الدعم لكل البوابة — الفلترة والترقيم خادميان ولا تُقرأ الجدول كاملة من المتصفح. */
  listTickets(): Promise<SupportTicketRow[]> {
    return listAll(TICKETS_PATH, mapTicket);
  },

  /** يضيف ردًا إداريًا؛ المرسل والحالة يقرّرها الخادم فلا يستطيع العميل انتحالهما. */
  async replyToTicket(ticketId: string, message: string): Promise<SupportTicketRow> {
    const response = await financeApiClient.post<ApiEnvelope<Record<string, unknown>>>(
      `${TICKETS_PATH}/${encodeURIComponent(ticketId)}/replies`,
      { message },
    );
    return mapTicket(response?.data ?? {});
  },

  listAnnouncements(): Promise<AnnouncementRow[]> {
    return listAll(ANNOUNCEMENTS_PATH, mapAnnouncement);
  },

  async createAnnouncement(input: AnnouncementInput): Promise<AnnouncementRow> {
    const response = await financeApiClient.post<ApiEnvelope<Record<string, unknown>>>(ANNOUNCEMENTS_PATH, input);
    return mapAnnouncement(response?.data ?? {});
  },

  async updateAnnouncement(announcementId: string, patch: Partial<AnnouncementInput>): Promise<AnnouncementRow> {
    const response = await financeApiClient.patch<ApiEnvelope<Record<string, unknown>>>(
      `${ANNOUNCEMENTS_PATH}/${encodeURIComponent(announcementId)}`,
      patch,
    );
    return mapAnnouncement(response?.data ?? {});
  },

  /** تبديل الإظهار يستخدم نفس مسار التحديث حتى لا يتفرّع سلوكان للكتابة نفسها. */
  setAnnouncementActive(announcementId: string, isActive: boolean): Promise<AnnouncementRow> {
    return this.updateAnnouncement(announcementId, { isActive });
  },

  async deleteAnnouncement(announcementId: string): Promise<void> {
    await financeApiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`${ANNOUNCEMENTS_PATH}/${encodeURIComponent(announcementId)}`);
  },

  listJobApplications(): Promise<JobApplicationRow[]> {
    return listAll(JOB_APPLICATIONS_PATH, mapJobApplication);
  },

  async setJobApplicationStatus(jobRequestId: string, status: string): Promise<JobApplicationRow> {
    const response = await financeApiClient.patch<ApiEnvelope<Record<string, unknown>>>(
      `${JOB_APPLICATIONS_PATH}/${encodeURIComponent(jobRequestId)}`,
      { status },
    );
    return mapJobApplication(response?.data ?? {});
  },

  async deleteJobApplication(jobRequestId: string): Promise<void> {
    await financeApiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`${JOB_APPLICATIONS_PATH}/${encodeURIComponent(jobRequestId)}`);
  },

  /** طلبات البوابة فقط — الفلترة والترقيم خادميان بدل قراءة جدول الطلبات كاملة عبر Supabase. */
  listPortalOrders(): Promise<PortalOrderRow[]> {
    return listAll(PORTAL_ORDERS_PATH, mapPortalOrder);
  },
};
