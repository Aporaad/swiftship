export type ActivityCategory = 'USERS' | 'ROLES' | 'ORDERS' | 'FINANCE' | 'CUSTOMERS' | 'SYSTEM' | 'COURIERS' | 'SOURCES';

export interface ActivityLog {
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  category: ActivityCategory;
  details: string;
  timestamp: number;
}

export const activityService = {
  async log({ action, category, details }: { action: string; category: ActivityCategory; details: string }) {
    try {
      // Activity logging pure service interface
      if (import.meta.env.DEV) {
        console.log(`[Activity] [${category}] ${action}: ${details}`);
      }
    } catch (error) {
      console.error('Failed to write activity log:', error);
    }
  }
};
