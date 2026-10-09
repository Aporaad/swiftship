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
  | 'add_portal_user'
  | 'edit_portal_user'
  | 'delete_portal_user'
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
  | 'export_pdf'
  | 'add_payment'
  | 'add_shipping_company'
  | 'edit_shipping_company'
  | 'delete_shipping_company'
  | 'force_logout'
  | 'temp_ban'
  | 'add_employee'
  | 'edit_employee'
  | 'delete_employee'
  // Financial Account Actions
  | 'create_financial_account'
  | 'financial_transaction'
  | 'account_debit'
  | 'account_credit'
  | 'account_adjustment'
  | 'account_custody_charge'
  | 'account_custody_settle'
  | 'account_order_charge'
  | 'account_payment_received'
  | 'manage_financial_accounts';

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
      if (import.meta.env.DEV) {
        console.log(`[ActivityLog] ${action} -> ${target}`, details);
      }
    } catch (error) {
      console.warn('[ActivityLog] Failed to record activity:', error);
    }
  }
}

export const activityLogService = new ActivityLogService();
