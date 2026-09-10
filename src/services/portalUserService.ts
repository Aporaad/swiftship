/**
 * خدمة إدارة مستخدمين الموقع وتفاصيل العملاء الإضافية (portal_users & cust_details)
 * Portal Users & Customer Details Management Service
 * 
 * تلتزم هذه الخدمة بمعايير الكود النظيف، فصل الـ Business Logic عن الـ UI،
 * وتجنب التكرار (DRY) والأمان العالي.
 */

import {
  supabase,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  db
} from '../lib/supabase-firebase-adapter';
import { notificationService } from './notificationService';
import { activityLogService } from './activityLogService';

export interface PortalUserPayload {
  id?: string;
  username: string;
  email: string;
  password?: string;
  portal_role?: string;
  approval_status?: 'approved' | 'pending_approval' | 'rejected';
  disabled?: boolean;
  linkedAccId?: string;
  fullName?: string;
  phone?: string;
  customerId?: string;
}

export interface CustomerDetailsPayload {
  id?: string;
  user_uid?: string;
  customer_id?: string;
  address?: string;
  gps_location?: string;
  city?: string;
  country?: string;
  company_name?: string;
  id_number?: string;
  max_debt?: number;
  notes?: string;
  join_by?: string;
  referrer_id?: string;
  onboarding_completed?: boolean;
}

export class PortalUserService {
  /**
   * جلب كافة مستخدمي الموقع وإثرائهم بتفاصيل العملاء من cust_details
   * Fetch all portal users enriched with cust_details and customer information
   */
  async getPortalUsers(): Promise<any[]> {
    try {
      const [pRes, dRes, cRes] = await Promise.all([
        supabase.from('portal_users').select('*'),
        supabase.from('cust_details').select('*'),
        supabase.from('customers').select('*')
      ]);

      const portalList = (pRes.data || []).map(row => {
        const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
        return {
          id: row.id,
          username: row.username || payload.username || '',
          email: row.email || payload.email || '',
          portal_role: row.portal_role || payload.portalRole || 'client',
          disabled: Boolean(row.disabled ?? payload.disabled ?? false),
          approval_status: row.approval_status || payload.approvalStatus || 'approved',
          linkedAccId: row.linkedAccId || payload.linkedAccId || '',
          createdAt: row.created_at || payload.createdAt || Date.now(),
          ...payload
        };
      });

      const detailsMap = new Map<string, any>();
      (dRes.data || []).forEach(row => {
        const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
        const uid = row.user_uid || row.customer_id;
        if (uid) detailsMap.set(uid, { id: row.id, user_uid: row.user_uid, customer_id: row.customer_id, ...payload });
      });

      const customersMap = new Map<string, any>();
      (cRes.data || []).forEach(row => {
        const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
        customersMap.set(row.id, { id: row.id, ...payload });
      });

      return portalList.map(u => {
        const custId = u.customerId || u.linkedAccId;
        const details = detailsMap.get(u.id) || detailsMap.get(custId) || {};
        const customer = customersMap.get(custId) || {};
        return {
          ...u,
          customerDetails: details,
          customerEntity: customer,
        };
      });
    } catch (error: any) {
      console.error('[PortalUserService] getPortalUsers error:', error);
      return [];
    }
  }

  /**
   * حفظ تفاصيل العميل الإضافية دائماً في جدول cust_details
   * Save customer additional details in cust_details table
   */
  async saveCustomerDetails(customerId: string, userUid: string, details: CustomerDetailsPayload): Promise<any> {
    try {
      const detailsId = `cust_dtl_${customerId.replace(/[^a-zA-Z0-9]/g, '')}`;
      const now = Date.now();
      const payload = {
        id: detailsId,
        user_uid: userUid || '',
        customer_id: customerId,
        join_by: details.join_by || 'system_admin',
        referrer_id: details.referrer_id || '',
        onboarding_completed: details.onboarding_completed ?? true,
        created_at: now,
        updated_at: now,
        data: {
          address: details.address || '',
          gps_location: details.gps_location || '',
          city: details.city || '',
          country: details.country || 'اليمن',
          company_name: details.company_name || '',
          id_number: details.id_number || '',
          max_debt: Number(details.max_debt) || 0,
          notes: details.notes || ''
        }
      };

      await supabase.from('cust_details').upsert(payload, { onConflict: 'id' });
      return payload;
    } catch (error: any) {
      console.error('[PortalUserService] saveCustomerDetails error:', error);
      throw error;
    }
  }

  /**
   * إنشاء مستخدم موقع جديد بجدول portal_users وربطه بالعميل و cust_details
   * Create a new website portal user in portal_users and bind to cust_details
   */
  async createPortalUser(userPayload: PortalUserPayload, detailsPayload?: CustomerDetailsPayload): Promise<any> {
    try {
      const puserId = `puser_${Math.random().toString(36).substring(2, 11)}`;
      const now = Date.now();
      const nowIso = new Date().toISOString();

      const userRecord = {
        id: puserId,
        username: userPayload.username.trim(),
        email: userPayload.email.trim(),
        portal_role: userPayload.portal_role || 'client',
        disabled: userPayload.disabled || false,
        approval_status: userPayload.approval_status || 'approved',
        linkedAccId: userPayload.linkedAccId || userPayload.customerId || '',
        created_at: nowIso,
        data: {
          password: userPayload.password || '',
          fullName: userPayload.fullName || userPayload.username,
          phone: userPayload.phone || '',
          customerId: userPayload.customerId || userPayload.linkedAccId || '',
          createdAt: now
        }
      };

      await supabase.from('portal_users').insert(userRecord);

      if (detailsPayload && (userPayload.customerId || userPayload.linkedAccId)) {
        const custId = userPayload.customerId || userPayload.linkedAccId || '';
        await this.saveCustomerDetails(custId, puserId, detailsPayload);
      }

      await activityLogService.log('add_portal_user', userPayload.username, { puserId });

      notificationService.notify({
        title: 'تم إنشاء مستخدم الموقع',
        message: `تم إنشاء حساب الموقع الإلكتروني للمستخدم ${userPayload.username} بنجاح`,
        type: 'success'
      });

      return userRecord;
    } catch (error: any) {
      console.error('[PortalUserService] createPortalUser error:', error);
      notificationService.notify({
        title: 'خطأ في إنشاء مستخدم الموقع',
        message: error?.message || 'تعذر إنشاء حساب مستخدم الموقع',
        type: 'error'
      });
      throw error;
    }
  }

  /**
   * تعديل بيانات مستخدم الموقع والتفاصيل الإضافية
   * Update website portal user and associated customer details
   */
  async updatePortalUser(puserId: string, userPayload: Partial<PortalUserPayload>, detailsPayload?: Partial<CustomerDetailsPayload>): Promise<void> {
    try {
      const now = Date.now();

      // Fetch existing row first
      const { data: existingData } = await supabase.from('portal_users').select('*').eq('id', puserId).single();
      const prevData = existingData?.data ? (typeof existingData.data === 'string' ? JSON.parse(existingData.data) : existingData.data) : {};

      const updatedPayload = {
        ...prevData,
        fullName: userPayload.fullName ?? prevData.fullName,
        phone: userPayload.phone ?? prevData.phone,
        password: userPayload.password ? userPayload.password : prevData.password,
        updatedAt: now
      };

      const updateRow: any = {
        data: updatedPayload
      };
      if (userPayload.username) updateRow.username = userPayload.username.trim();
      if (userPayload.email) updateRow.email = userPayload.email.trim();
      if (userPayload.portal_role) updateRow.portal_role = userPayload.portal_role;
      if (userPayload.approval_status) updateRow.approval_status = userPayload.approval_status;
      if (userPayload.disabled !== undefined) updateRow.disabled = userPayload.disabled;

      await supabase.from('portal_users').update(updateRow).eq('id', puserId);

      if (detailsPayload && (userPayload.customerId || prevData.customerId || existingData?.linkedAccId)) {
        const custId = userPayload.customerId || prevData.customerId || existingData?.linkedAccId;
        await this.saveCustomerDetails(custId, puserId, detailsPayload as CustomerDetailsPayload);
      }

      await activityLogService.log('edit_portal_user', userPayload.username || puserId, { puserId });

      notificationService.notify({
        title: 'تم تحديث بيانات مستخدم الموقع',
        message: 'تم حفظ التحديثات بنجاح',
        type: 'info'
      });
    } catch (error: any) {
      console.error('[PortalUserService] updatePortalUser error:', error);
      notificationService.notify({
        title: 'خطأ في التحديث',
        message: error?.message || 'تعذر تحديث البيانات',
        type: 'error'
      });
      throw error;
    }
  }

  /**
   * تعطيل أو تفعيل حساب مستخدم الموقع
   * Toggle disabled status for portal user
   */
  async togglePortalUserDisabled(puserId: string, currentDisabled: boolean): Promise<boolean> {
    try {
      const newStatus = !currentDisabled;
      await supabase.from('portal_users').update({ disabled: newStatus }).eq('id', puserId);

      notificationService.notify({
        title: 'تغيير حالة مستخدم الموقع',
        message: newStatus ? 'تم تعطيل حساب مستخدم الموقع' : 'تم تفعيل حساب مستخدم الموقع بنجاح',
        type: newStatus ? 'warning' : 'success'
      });

      return newStatus;
    } catch (error: any) {
      console.error('[PortalUserService] togglePortalUserDisabled error:', error);
      throw error;
    }
  }

  /**
   * حذف مستخدم موقع نهائياً
   * Delete website portal user
   */
  async deletePortalUser(puserId: string): Promise<void> {
    try {
      await supabase.from('portal_users').delete().eq('id', puserId);
      await supabase.from('cust_details').delete().eq('user_uid', puserId);

      notificationService.notify({
        title: 'حذف مستخدم الموقع',
        message: 'تم حذف حساب مستخدم الموقع بنجاح',
        type: 'success'
      });
    } catch (error: any) {
      console.error('[PortalUserService] deletePortalUser error:', error);
      throw error;
    }
  }
}

export const portalUserService = new PortalUserService();
