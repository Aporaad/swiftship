import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { portalUserService } from '../../../services/portalUserService';
import { siteContentService, type AnnouncementRow, type JobApplicationRow, type PortalOrderRow, type SupportTicketRow } from '../../../services/siteContentService';
import { asyncState, runQuery, type AsyncState } from '../../../shared/contracts/ui.contracts';

type WebsiteManagementQueryResult = {
  enrichedUsers: any[];
  portalOrders: PortalOrderRow[];
  tickets: SupportTicketRow[];
  announcements: AnnouncementRow[];
  jobApplications: JobApplicationRow[];
};

/**
 * بيانات صفحة إدارة الموقع — كل مصدر يقرأ من alx_api فقط، وترتيب الأحدث أولًا صار خادميًا.
 * Website management data: every source reads through alx_api, and the newest-first ordering is done server-side.
 */
export function useWebsiteManagementData(isAr: boolean) {
  const [queryState, setQueryState] = useState<AsyncState<WebsiteManagementQueryResult>>(asyncState.loading());
  const loading = queryState.status === 'loading';
  const setLoading = (value: boolean) => setQueryState(value ? asyncState.loading() : asyncState.idle());
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [portalOrders, setPortalOrders] = useState<PortalOrderRow[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [jobApplications, setJobApplications] = useState<JobApplicationRow[]>([]);

  const loadAllData = useCallback(async () => {
    const result = await runQuery(async () => {
      const [enrichedUsers, orders, tick, ann, jobs] = await Promise.all([
        portalUserService.getPortalUsers(),
        siteContentService.listPortalOrders(),
        siteContentService.listTickets(),
        siteContentService.listAnnouncements(),
        siteContentService.listJobApplications(),
      ]);
      return { enrichedUsers, portalOrders: orders, tickets: tick, announcements: ann, jobApplications: jobs };
    }, setQueryState, () => false);

    if (result.status === 'success') {
      setPortalUsers(result.data.enrichedUsers);
      setPortalOrders(result.data.portalOrders);
      setTickets(result.data.tickets);
      setAnnouncements(result.data.announcements);
      setJobApplications(result.data.jobApplications);
    } else if (result.status === 'error') {
      console.error('[WebsiteManagement] Error loading portal data:', result.error);
      toast.error(isAr ? 'حدث خطأ أثناء تحميل بيانات الموقع' : 'Error loading portal data');
    }
  }, [isAr]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return { loading, setLoading, portalUsers, setPortalUsers, portalOrders, tickets, announcements, jobApplications, loadAllData };
}

export default useWebsiteManagementData;
