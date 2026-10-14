import { appApiClient } from '../data/http/app-api-client';

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

// عقد الـ API يقبل قيماً فردية فقط (لا كرات JSON ولا مصفوفات) — the API accepts scalar fields only,
// so non-scalar values are rendered to readable text here instead of being rejected by the server.
const toDetailValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'string') return value.slice(0, 300);
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ').slice(0, 300);
  try {
    return JSON.stringify(value).slice(0, 300);
  } catch {
    return String(value).slice(0, 300);
  }
};

const toFlatDetails = (
  details?: Record<string, unknown>,
): Record<string, string | number | boolean | null> | undefined => {
  if (!details) return undefined;
  const entries = Object.entries(details)
    .filter(([key]) => /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(key))
    .map(([key, value]) => [key, toDetailValue(value)] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const categoryOf = (action: string): string => {
  if (action.includes('user') || action.includes('role') || action.includes('session') || action.includes('password')) return 'users';
  if (action.includes('order') || action.includes('product') || action.includes('customer')) return 'operations';
  if (action.includes('account') || action.includes('expense') || action.includes('payment') || action.includes('custody') || action.includes('exchange') || action.includes('currency') || action.includes('salary') || action.includes('financial')) return 'finance';
  if (action.includes('settings') || action.includes('backup') || action.includes('cache') || action.includes('whatsapp') || action.includes('notification')) return 'settings';
  return 'system';
};

/**
 * سجل النشاط صار خادمياً بالكامل: كل واقعة تُكتب في أعمدة activity_logs المسطّحة.
 * Activity logging is fully server-backed now: every event writes flat activity_logs columns,
 * and identity (user name/role) is resolved from the token, never from this client.
 */
class ActivityLogService {
  async log(action: ActivityAction, target: string, details?: Record<string, unknown>): Promise<void> {
    const flatDetails = toFlatDetails(details);
    try {
      await appApiClient.post('/api/v1/activity-logs', {
        action,
        category: categoryOf(action),
        target: target.slice(0, 300),
        ...(flatDetails ? { details: flatDetails } : {}),
      });
    } catch (error) {
      // الفشل في تسجيل النشاط لا يجب أن يُفشل عملية المستخدم — لكن يُظهر بوضوح في التطوير.
      // A failed audit write must not break the user's operation, but is surfaced loudly in dev.
      if (import.meta.env.DEV) {
        console.warn('[ActivityLog] Failed to record activity via API:', action, target, error);
      }
    }
  }
}

export const activityLogService = new ActivityLogService();
