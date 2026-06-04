import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

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
      const user = auth.currentUser;
      if (!user) return;

      // Dynamic path log
      await addDoc(collection(db, 'activity_logs'), {
        userId: user.uid,
        userEmail: user.email || 'unknown',
        action,
        category,
        details,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to write activity log:', error);
    }
  }
};
