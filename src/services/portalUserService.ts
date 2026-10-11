import { notificationService } from './notificationService';
import { portalAdminApiDataGateway } from '../features/siteManagement/services/portalAdminApiDataGateway';

export interface PortalUserPayload {
  id?: string; username: string; email: string; password?: string;
  portal_role?: string; approval_status?: 'approved' | 'pending_approval' | 'rejected';
  disabled?: boolean; linkedCustomerId?: string; accountId?: string;
  fullName?: string; phone?: string; customerId?: string;
}
export interface CustomerDetailsPayload {
  id?: string; user_uid?: string; customer_id?: string; address?: string;
  gpsLocation?: string; gps_location?: string; city?: string; country?: string;
  company_name?: string; id_number?: string; max_debt?: number; notes?: string;
  join_by?: string; referrer_id?: string; onboarding_completed?: boolean;
}
export class PortalUserService {
  async getPortalUsers(): Promise<any[]> { return portalAdminApiDataGateway.listUsers(); }
  async saveCustomerDetails(customerId: string, userUid: string, details: CustomerDetailsPayload): Promise<any> {
    return portalAdminApiDataGateway.saveCustomerDetails(customerId, details as Record<string, unknown>, userUid);
  }
  async createPortalUser(userPayload: PortalUserPayload, detailsPayload?: CustomerDetailsPayload): Promise<any> {
    try {
      const result = await portalAdminApiDataGateway.createUser({
        username: userPayload.username.trim(), email: userPayload.email.trim(), password: userPayload.password ?? '',
        fullName: userPayload.fullName ?? userPayload.username, phone: userPayload.phone ?? '',
        role: userPayload.portal_role === 'client' ? 'customer' : userPayload.portal_role ?? 'customer',
        approvalStatus: userPayload.approval_status ?? 'approved',
        ...(userPayload.customerId || userPayload.linkedCustomerId ? { linkedCustomerId: userPayload.customerId ?? userPayload.linkedCustomerId } : {}),
        ...(detailsPayload ? { details: detailsPayload as Record<string, unknown> } : {}),
      });
      notificationService.notify({ title: 'تم إنشاء مستخدم الموقع', message: 'تم إنشاء الحساب عبر API بنجاح', type: 'success' });
      return result;
    } catch (error) {
      notificationService.notify({ title: 'خطأ في إنشاء مستخدم الموقع', message: error instanceof Error ? error.message : 'تعذر إنشاء الحساب', type: 'error' });
      throw error;
    }
  }
  async updatePortalUser(id: string, userPayload: Partial<PortalUserPayload>, detailsPayload?: Partial<CustomerDetailsPayload>): Promise<any> {
    const result = await portalAdminApiDataGateway.updateUser(id, {
      ...userPayload,
      ...(userPayload.username !== undefined ? { username: userPayload.username.trim() } : {}),
      role: userPayload.portal_role === 'client' ? 'customer' : userPayload.portal_role,
      approvalStatus: userPayload.approval_status,
      ...(detailsPayload ? { details: detailsPayload } : {}),
    });
    notificationService.notify({ title: 'تم تحديث بيانات مستخدم الموقع', message: 'تم حفظ التحديثات عبر API', type: 'info' });
    return result;
  }
  async togglePortalUserDisabled(id: string, currentDisabled: boolean): Promise<boolean> {
    const result = await portalAdminApiDataGateway.setDisabled(id, !currentDisabled);
    return Boolean(result.disabled);
  }
  async setPortalUserApproval(id: string, approvalStatus: 'approved' | 'pending_approval' | 'rejected'): Promise<any> {
    return portalAdminApiDataGateway.setApproval(id, approvalStatus);
  }
  async deletePortalUser(id: string): Promise<void> { await portalAdminApiDataGateway.deleteUser(id); }
}
export const portalUserService = new PortalUserService();
