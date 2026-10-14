/**
 * siteContentService.test.ts
 * اختبارات خدمة محتوى الموقع — التأكد أن القراءة والتحريك يبقيان على alx_api بلا أي وصول مباشر للقاعدة.
 * Site content service tests — every read and write goes through alx_api, never direct database access.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

// عميل HTTP المشترك هو موضع الربط الوحيد؛ تُموّه هنا فتقرأ الخدمة وقارئ الصفحات من نفس السطور المموّهة.
vi.mock('../data/http/app-api-client', () => ({
  appApiClient: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.delete },
}));

import { siteContentService } from './siteContentService';

/** غلاف استجابة alx_api: القوائم مصفوفة في `data` والكتابة كائن واحد. */
const listEnvelope = (data: unknown[]) => ({ success: true as const, data, requestId: 'r1', meta: { total: data.length } });
const rowEnvelope = (data: Record<string, unknown>) => ({ success: true as const, data, requestId: 'r1' });

/** صفحة واحدة أقصر من حجم الصفحة ⇒ يتوقف قارئ الصفحات عند أول استجابة. */
const firstPage = (rows: unknown[]) => Promise.resolve(listEnvelope(rows));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('siteContentService reads', () => {
  it('lists tickets through the site endpoint using only the flat fields', async () => {
    mocks.get.mockImplementation(() =>
      firstPage([
        {
          id: 'tkt_1',
          userUid: 'pu_1',
          subject: 'تأخر شحنة',
          message: 'سؤال',
          type: 'order',
          status: 'open',
          userName: 'عميل تجريبي',
          userRole: 'customer',
          userEmail: 'c@example.test',
          adminResponse: 'تم',
          replies: [{ sender: 'Admin Support', message: 'تم', createdAt: 12 }],
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_001,
        },
      ]),
    );

    const tickets = await siteContentService.listTickets();

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/site/tickets', expect.objectContaining({ limit: 500, offset: 0 }));
    expect(tickets[0]).toMatchObject({
      id: 'tkt_1',
      status: 'open',
      userName: 'عميل تجريبي',
      userEmail: 'c@example.test',
      replies: [{ sender: 'Admin Support', message: 'تم', createdAt: 12 }],
    });
    // لا مفاتيح أرشيف: الصف فيه حقلات العقد المسطّح فقط.
    expect(Object.keys(tickets[0] ?? {})).not.toContain('data');
  });

  it('defaults a blank ticket status to open instead of rendering an unknown state', async () => {
    mocks.get.mockImplementation(() => firstPage([{ id: 'tkt_2', status: '' }]));
    const [ticket] = await siteContentService.listTickets();
    expect(ticket?.status).toBe('open');
  });

  it('maps announcements from their flat content and audience columns', async () => {
    mocks.get.mockImplementation(() =>
      firstPage([
        {
          id: 'ann_1',
          title: 'تحديث',
          content: 'نص',
          targetAudience: 'courier',
          priority: 'urgent',
          isActive: true,
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        },
      ]),
    );

    const [announcement] = await siteContentService.listAnnouncements();

    expect(announcement).toMatchObject({
      id: 'ann_1',
      title: 'تحديث',
      content: 'نص',
      priority: 'urgent',
      targetAudience: 'courier',
      isActive: true,
    });
  });

  it('reads job applications without inventing missing applicant fields', async () => {
    mocks.get.mockImplementation(() =>
      firstPage([{ id: 'job_1', status: '', fullName: 'مندوب', jobPosition: '', experienceYears: null, createdAt: '2026-10-01T08:00:00.000Z', updatedAt: null }]),
    );

    const [application] = await siteContentService.listJobApplications();

    expect(application).toMatchObject({ id: 'job_1', status: 'pending_review', fullName: 'مندوب', jobPosition: '', experienceYears: 0, updatedAt: 0 });
    expect(application?.createdAt).toBe(Date.parse('2026-10-01T08:00:00.000Z'));
  });

  it('reads portal orders from the site endpoint instead of the whole orders table', async () => {
    mocks.get.mockImplementation(() =>
      firstPage([
        {
          id: 'ord_1',
          orderNumber: 'ORD-1',
          trackingNumber: 'TRK-1',
          createdAt: '2026-10-02T08:00:00.000Z',
          customerName: 'عميل البوابة',
          recipientName: '',
          customerPhone: '',
          deliveryCity: '',
          orderSourceName: 'تطبيق عام',
          orderSourceType: 'App',
          orderStatus: 'معلق',
          goodsDescription: 'ساعة (1)',
          totalPrice: 45_000,
        },
      ]),
    );

    const [order] = await siteContentService.listPortalOrders();

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/site/portal-orders', expect.objectContaining({ limit: 500, offset: 0 }));
    expect(order).toMatchObject({
      id: 'ord_1',
      customerName: 'عميل البوابة',
      orderSourceName: 'تطبيق عام',
      orderStatus: 'معلق',
      goodsDescription: 'ساعة (1)',
      totalPrice: 45_000,
      createdAt: Date.parse('2026-10-02T08:00:00.000Z'),
    });
    // الحقل الفارغ يبقى فارغًا بدل اختلاق مدينة أو هاتف.
    expect(order?.deliveryCity).toBe('');
  });
});

describe('siteContentService writes', () => {
  it('posts only the reply message so the server owns sender and status', async () => {
    mocks.post.mockResolvedValue(rowEnvelope({ id: "tkt_1", status: "in_progress", replies: [] }));

    await siteContentService.replyToTicket('tkt/1', 'رد إداري');

    expect(mocks.post).toHaveBeenCalledWith('/api/v1/site/tickets/tkt%2F1/replies', { message: 'رد إداري' });
  });

  it('creates, patches, toggles and deletes announcements on the site endpoint', async () => {
    mocks.post.mockResolvedValue(rowEnvelope({ id: "ann_1", title: "ع" }));
    mocks.patch.mockResolvedValue(rowEnvelope({ id: "ann_1", title: "ع", isActive: false }));
    mocks.delete.mockResolvedValue(rowEnvelope({ deleted: true }));

    const created = await siteContentService.createAnnouncement({
      title: 'ع',
      content: 'م',
      targetAudience: 'all',
      priority: 'normal',
      isActive: true,
    });
    expect(created.id).toBe('ann_1');
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/site/announcements', expect.objectContaining({ targetAudience: 'all' }));

    await siteContentService.setAnnouncementActive('ann 1', false);
    expect(mocks.patch).toHaveBeenCalledWith('/api/v1/site/announcements/ann%201', { isActive: false });

    await siteContentService.deleteAnnouncement('ann_1');
    expect(mocks.delete).toHaveBeenCalledWith('/api/v1/site/announcements/ann_1');
  });

  it('patches a job application status and deletes it by identifier', async () => {
    mocks.patch.mockResolvedValue(rowEnvelope({ id: "job_1", status: "approved" }));
    mocks.delete.mockResolvedValue(rowEnvelope({ deleted: true }));

    const updated = await siteContentService.setJobApplicationStatus('job/1', 'approved');
    expect(updated.status).toBe('approved');
    expect(mocks.patch).toHaveBeenCalledWith('/api/v1/site/job-applications/job%2F1', { status: 'approved' });

    await siteContentService.deleteJobApplication('job_1');
    expect(mocks.delete).toHaveBeenCalledWith('/api/v1/site/job-applications/job_1');
  });

  it('never falls back to a direct database read when the API fails', async () => {
    mocks.get.mockRejectedValue(new Error('API_DOWN'));
    await expect(siteContentService.listTickets()).rejects.toThrow('API_DOWN');
  });
});
