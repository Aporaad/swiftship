import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { portalUserService } from '../../../services/portalUserService';
import { siteManagementGateway, extractSiteManagementRows } from '../services/siteManagementGateway';
import { asyncState, runQuery, type AsyncState } from '../../../shared/contracts/ui.contracts';

type WebsiteManagementQueryResult = {
  enrichedUsers: any[];
  orders: any[];
  tick: any[];
  ann: any[];
  jobs: any[];
  cour: any[];
};

export function useWebsiteManagementData(isAr: boolean) {
  const [queryState, setQueryState] = useState<AsyncState<WebsiteManagementQueryResult>>(asyncState.loading());
  const loading = queryState.status === 'loading';
  const setLoading = (value: boolean) => setQueryState(value ? asyncState.loading() : asyncState.idle());
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [portalOrders, setPortalOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [jobApplications, setJobApplications] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);

  const loadAllData = useCallback(async () => {
    const result = await runQuery(async () => {
      const [enrichedUsers, oRes, tRes, aRes, jRes, cRes] = await Promise.all([
        portalUserService.getPortalUsers(),
        siteManagementGateway.selectCollection('orders'),
        siteManagementGateway.selectCollection('portal_tickets'),
        siteManagementGateway.selectCollection('announcements'),
        siteManagementGateway.selectCollection('jobs_req'),
        siteManagementGateway.selectCollection('couriers'),
      ]);

      const orders = extractSiteManagementRows(oRes.data || []);
      const tick = extractSiteManagementRows(tRes.data || []);
      const ann = extractSiteManagementRows(aRes.data || []);
      const jobs = extractSiteManagementRows(jRes.data || []);
      const cour = extractSiteManagementRows(cRes.data || []);

      orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      tick.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      ann.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      jobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return { enrichedUsers, orders, tick, ann, jobs, cour };
    }, setQueryState, () => false);
    if (result.status === 'success') {
      const { enrichedUsers, orders, tick, ann, jobs, cour } = result.data;
      setPortalUsers(enrichedUsers);
      setPortalOrders(orders.filter(o => o.customerUid || o.portalUid || o.orderSourceType === 'App'));
      setTickets(tick);
      setAnnouncements(ann);
      setJobApplications(jobs);
      setCouriers(cour);
    } else if (result.status === 'error') {
      const err = result.error;
      console.error('[WebsiteManagement] Error loading portal data:', err);
      toast.error(isAr ? 'حدث خطأ أثناء تحميل بيانات الموقع' : 'Error loading portal data');
    }
  }, [isAr]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return { loading, setLoading, portalUsers, setPortalUsers, portalOrders, setPortalOrders, tickets, setTickets, announcements, setAnnouncements, jobApplications, setJobApplications, couriers, setCouriers, loadAllData };
}

export default useWebsiteManagementData;
