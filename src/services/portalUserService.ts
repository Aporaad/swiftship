/**
 * خدمة إدارة مستخدمين الموقع وتفاصيل العملاء الإضافية (portal_users & cust_details)
 * Portal Users & Customer Details Management Service
 * 
 * تلتزم هذه الخدمة بمعايير الكود النظيف، فصل الـ Business Logic عن الـ UI،
 * وتجنب التكرار (DRY) والأمان العالي.
 */

import { SELECT_FIELDS } from '../data/contracts/select-fields';
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
} from '../data/legacy/legacy-compat.ts';
import { notificationService } from './notificationService';
import { activityLogService } from './activityLogService';

type PortalDbRow = Record<string, unknown>;
type PortalPayload = Record<string, unknown>;
type SavedDetailsResult = { id: string; [key: string]: unknown };
type CreatedPortalUserResult = { id: string; portal_user_id: string; username: string; email: string; portal_role: string; disabled: boolean; approval_status: string; linked_customer_id: string | null; account_id: string | null; full_name: string; is_disabled: boolean; created_at: string; data: PortalPayload };
type PortalUserResult = { id: string; username: string; email: string; portal_role: string; disabled: boolean; approval_status: string; linkedCustomerId: string; accountId: string; fullName: string; nameAr: string; nameEn: string; createdAt: string | number; customerDetails: PortalPayload; customerEntity: PortalPayload };
const asPortalRecord = (value: unknown): PortalPayload => value !== null && typeof value === 'object' ? value as PortalPayload : {};
const portalString = (row: PortalDbRow, key: string): string | undefined => typeof row[key] === 'string' ? row[key] as string : undefined;
const portalValue = (row: PortalDbRow, key: string): unknown => row[key];
const portalPayload = (row: PortalDbRow): PortalPayload => typeof row.data === 'string' ? asPortalRecord(JSON.parse(row.data)) : asPortalRecord(row.data);

export interface PortalUserPayload {
  id?: string;
  username: string;
  email: string;
  password?: string;
  portal_role?: string;
  approval_status?: 'approved' | 'pending_approval' | 'rejected';
  disabled?: boolean;
  linkedCustomerId?: string;
  accountId?: string;
  fullName?: string;
  phone?: string;
  customerId?: string;
}

export interface CustomerDetailsPayload {
  id?: string;
  user_uid?: string;
  customer_id?: string;
  address?: string;
  gpsLocation?: string;
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
  async getPortalUsers(): Promise<PortalUserResult[]> {
    try {
      const [pRes, dRes, cRes] = await Promise.all([
        supabase.from('portal_users').select(SELECT_FIELDS.portalUser),
        supabase.from('cust_details').select('cust_detail_id,user_uid,customer_id,data,created_at,updated_at'),
        supabase.from('customers').select('customer_id,customer_name,phone,email,data,created_at,updated_at')
      ]);

      const portalList = ((pRes.data || []) as PortalDbRow[]).map((row: PortalDbRow): Omit<PortalUserResult, 'customerDetails' | 'customerEntity'> & { customerId?: string } => {
        const payload = portalPayload(row);
        return {
          id: portalString(row, 'portal_user_id') || portalString(row, 'id') || '',
          username: portalString(row, 'username') || portalString(payload, 'username') || '',
          email: portalString(row, 'email') || portalString(payload, 'email') || '',
          portal_role: portalString(row, 'portal_role') || portalString(payload, 'portalRole') || 'client',
          disabled: Boolean(portalValue(row, 'is_disabled') ?? portalValue(row, 'disabled') ?? portalValue(payload, 'disabled') ?? false),
          approval_status: portalString(row, 'approval_status') || portalString(payload, 'approvalStatus') || 'approved',
          linkedCustomerId: portalString(row, 'linked_customer_id') || portalString(payload, 'customerId') || '',
          accountId: portalString(row, 'account_id') || '',
          fullName: portalString(row, 'full_name') || portalString(payload, 'fullName') || '',
          nameAr: portalString(row, 'name_ar') || '',
          nameEn: portalString(row, 'name_en') || '',
          createdAt: portalString(row, 'created_at') || portalString(payload, 'createdAt') || Date.now(),
          customerId: portalString(payload, 'customerId'),
          ...payload
        };
      });

      const detailsMap = new Map<string, PortalPayload>();
      ((dRes.data || []) as PortalDbRow[]).forEach((row: PortalDbRow) => {
        const payload = portalPayload(row);
        const uid = portalString(row, 'user_uid') || portalString(row, 'customer_id');
        if (uid) detailsMap.set(uid, { id: portalString(row, 'cust_detail_id') || portalString(row, 'id') || '', user_uid: portalString(row, 'user_uid'), customer_id: portalString(row, 'customer_id'), ...payload });
      });

      const customersMap = new Map<string, PortalPayload>();
      ((cRes.data || []) as PortalDbRow[]).forEach((row: PortalDbRow) => {
        const payload = portalPayload(row);
        const custId = portalString(row, 'customer_id') || portalString(row, 'id');
        if (custId) customersMap.set(custId, { id: custId, ...payload });
      });

      return portalList.map((u): PortalUserResult => {
        const custId = u.customerId || u.linkedCustomerId;
        const details = detailsMap.get(u.id) || detailsMap.get(custId) || {};
        const customer = customersMap.get(custId) || {};
        return { ...u, customerDetails: details, customerEntity: customer };
      });
    } catch (error: unknown) {
      console.error('[PortalUserService] getPortalUsers error:', error);
      return [];
    }
  }

  /**
   * حفظ تفاصيل العميل الإضافية دائماً في جدول cust_details
   * Save customer additional details in cust_details table
   */
  async saveCustomerDetails(customerId: string, userUid: string, details: CustomerDetailsPayload): Promise<SavedDetailsResult> {
    try {
      const detailsId = `cust_dtl_${customerId.replace(/[^a-zA-Z0-9]/g, '')}`;
      const now = new Date().toISOString();
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
          gpsLocation: details.gpsLocation || details.gps_location || '',
          gps_location: details.gpsLocation || details.gps_location || '',
          city: details.city || '',
          country: details.country || 'اليمن',
          company_name: details.company_name || '',
          id_number: details.id_number || '',
          max_debt: Number(details.max_debt) || 0,
          notes: details.notes || ''
        }
      };

      await supabase.from('cust_details').upsert(payload, { onConflict: 'cust_detail_id' });
      return payload;
    } catch (error: unknown) {
      console.error('[PortalUserService] saveCustomerDetails error:', error);
      throw error;
    }
  }

  /**
   * إنشاء مستخدم موقع جديد بجدول portal_users وربطه بالعميل و cust_details
   * Create a new website portal user in portal_users and bind to cust_details
   */
  async createPortalUser(userPayload: PortalUserPayload, detailsPayload?: CustomerDetailsPayload): Promise<CreatedPortalUserResult> {
    try {
      const puserId = `puser_${Math.random().toString(36).substring(2, 11)}`;
      const nowIso = new Date().toISOString();

      const userRecord = {
        portal_user_id: puserId,
        username: userPayload.username.trim(),
        email: userPayload.email.trim(),
        portal_role: userPayload.portal_role || 'client',
        disabled: userPayload.disabled || false,
        approval_status: userPayload.approval_status || 'approved',
        linked_customer_id: userPayload.linkedCustomerId || userPayload.customerId || null,
        account_id: userPayload.accountId || null,
        full_name: userPayload.fullName || userPayload.username,
        is_disabled: userPayload.disabled || false,
        created_at: nowIso,
        data: {
          password: userPayload.password || '',
          fullName: userPayload.fullName || userPayload.username,
          phone: userPayload.phone || '',
          customerId: userPayload.customerId || userPayload.linkedCustomerId || '',
          createdAt: nowIso
        }
      };

      await supabase.from('portal_users').insert(userRecord);

      if (detailsPayload && (userPayload.customerId || userPayload.linkedCustomerId)) {
        const custId = userPayload.customerId || userPayload.linkedCustomerId || '';
        await this.saveCustomerDetails(custId, puserId, detailsPayload);
      }

      await activityLogService.log('add_portal_user', userPayload.username, { puserId });

      notificationService.notify({
        title: 'تم إنشاء مستخدم الموقع',
        message: `تم إنشاء حساب الموقع الإلكتروني للمستخدم ${userPayload.username} بنجاح`,
        type: 'success'
      });

      return { id: puserId, ...userRecord };
    } catch (error: unknown) {
      console.error('[PortalUserService] createPortalUser error:', error);
      notificationService.notify({
        title: 'خطأ في إنشاء مستخدم الموقع',
        message: (error instanceof Error ? error.message : undefined) || 'تعذر إنشاء حساب مستخدم الموقع',
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
      const now = new Date().toISOString();

      // Fetch existing row first
      const { data: existingData } = await supabase.from('portal_users').select(SELECT_FIELDS.portalUser).eq('portal_user_id', puserId).single();
      const prevData = existingData?.data ? (typeof existingData.data === 'string' ? JSON.parse(existingData.data) : existingData.data) : {};

      const updatedPayload = {
        ...prevData,
        fullName: userPayload.fullName ?? prevData.fullName,
        phone: userPayload.phone ?? prevData.phone,
        password: userPayload.password ? userPayload.password : prevData.password,
        updatedAt: now
      };

      const updateRow: Record<string, unknown> = {
        data: updatedPayload
      };
      if (userPayload.fullName) updateRow.full_name = userPayload.fullName;
      if (userPayload.customerId || userPayload.linkedCustomerId) {
        updateRow.linked_customer_id = userPayload.customerId || userPayload.linkedCustomerId;
      }
      if (userPayload.accountId) updateRow.account_id = userPayload.accountId;
      if (userPayload.disabled !== undefined) updateRow.is_disabled = userPayload.disabled;
      if (userPayload.username) updateRow.username = userPayload.username.trim();
      if (userPayload.email) updateRow.email = userPayload.email.trim();
      if (userPayload.portal_role) updateRow.portal_role = userPayload.portal_role;
      if (userPayload.approval_status) updateRow.approval_status = userPayload.approval_status;
      if (userPayload.disabled !== undefined) updateRow.disabled = userPayload.disabled;

      await supabase.from('portal_users').update(updateRow).eq('portal_user_id', puserId);

      if (detailsPayload && (userPayload.customerId || prevData.customerId || existingData?.linked_customer_id)) {
        const custId = userPayload.customerId || prevData.customerId || existingData?.linked_customer_id;
        await this.saveCustomerDetails(custId, puserId, detailsPayload as CustomerDetailsPayload);
      }

      await activityLogService.log('edit_portal_user', userPayload.username || puserId, { puserId });

      notificationService.notify({
        title: 'تم تحديث بيانات مستخدم الموقع',
        message: 'تم حفظ التحديثات بنجاح',
        type: 'info'
      });
    } catch (error: unknown) {
      console.error('[PortalUserService] updatePortalUser error:', error);
      notificationService.notify({
        title: 'خطأ في التحديث',
        message: (error instanceof Error ? error.message : undefined) || 'تعذر تحديث البيانات',
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
      await supabase.from('portal_users').update({ disabled: newStatus }).eq('portal_user_id', puserId);

      notificationService.notify({
        title: 'تغيير حالة مستخدم الموقع',
        message: newStatus ? 'تم تعطيل حساب مستخدم الموقع' : 'تم تفعيل حساب مستخدم الموقع بنجاح',
        type: newStatus ? 'warning' : 'success'
      });

      return newStatus;
    } catch (error: unknown) {
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
      await supabase.from('portal_users').delete().eq('portal_user_id', puserId);
      await supabase.from('cust_details').delete().eq('user_uid', puserId);

      notificationService.notify({
        title: 'حذف مستخدم الموقع',
        message: 'تم حذف حساب مستخدم الموقع بنجاح',
        type: 'success'
      });
    } catch (error: unknown) {
      console.error('[PortalUserService] deletePortalUser error:', error);
      throw error;
    }
  }
}

export const portalUserService = new PortalUserService();
