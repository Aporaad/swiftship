import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'add_user'
  | 'edit_user'
  | 'disable_user'
  | 'enable_user'
  | 'delete_user'
  | 'reset_password'
  | 'edit_role'
  | 'add_role'
  | 'delete_role'
  | 'delete_order'
  | 'edit_delivered_order'
  | 'change_exchange_rate'
  | 'add_expense'
  | 'delete_expense'
  | 'edit_order'
  | 'add_order'
  | 'add_customer'
  | 'edit_customer'
  | 'delete_customer'
  | 'terminate_session'
  | 'add_source'
  | 'edit_source'
  | 'delete_source'
  | 'add_courier'
  | 'edit_courier'
  | 'delete_courier'
  | 'settle_custody'
  | 'save_settings'
  | 'backup_export'
  | 'backup_import'
  | 'clear_cache'
  | 'fetch_exchange_rates'
  | 'save_whatsapp_settings'
  | 'send_test_whatsapp'
  | 'mark_all_read'
  | 'export_orders_pdf'
  | 'export_orders_csv'
  | 'add_payment'
  | 'add_shipping_company'
  | 'edit_shipping_company'
  | 'delete_shipping_company'
  | 'force_logout'
  | 'temp_ban';

export interface ActivityLog {
  userId: string;
  userName: string;
  userRole: string;
  action: ActivityAction;
  target: string;
  details?: Record<string, any>;
  timestamp: any;
}

class ActivityLogService {
  async log(
    action: ActivityAction,
    target: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get user profile from Firestore to get name/role
      const { doc, getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      const logEntry: ActivityLog = {
        userId: user.uid,
        userName: userData.fullName || user.email || 'Unknown',
        userRole: userData.role || 'Unknown',
        action,
        target,
        details: details || {},
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'activity_logs'), logEntry);
    } catch (error) {
      // Silently fail — logging should never break the main flow
      console.warn('[ActivityLog] Failed to record activity:', error);
    }
  }
}

export const activityLogService = new ActivityLogService();
