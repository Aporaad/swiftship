import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { portalUserService } from '../../../services/portalUserService';
import { siteManagementGateway, extractSiteManagementRows } from '../services/siteManagementGateway';

export function useWebsiteManagementData(isAr: boolean) {
  const [loading, setLoading] = useState(true);
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [portalOrders, setPortalOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [jobApplications, setJobApplications] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
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

      setPortalUsers(enrichedUsers);
      setPortalOrders(orders.filter(o => o.customerUid || o.portalUid || o.orderSourceType === 'App'));
      setTickets(tick);
      setAnnouncements(ann);
      setJobApplications(jobs);
      setCouriers(cour);
    } catch (err) {
      console.error('[WebsiteManagement] Error loading portal data:', err);
      toast.error(isAr ? 'حدث خطأ أثناء تحميل بيانات الموقع' : 'Error loading portal data');
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return { loading, setLoading, portalUsers, setPortalUsers, portalOrders, setPortalOrders, tickets, setTickets, announcements, setAnnouncements, jobApplications, setJobApplications, couriers, setCouriers, loadAllData };
}

export default useWebsiteManagementData;
