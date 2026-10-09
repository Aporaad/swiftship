import toast from 'react-hot-toast';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationParams {
  title: string;
  message: string;
  type: NotificationType;
  orderId?: string;
  userId?: string; // Target specific user
  associatedUserIds?: string[]; // Users associated with this notification
  isPublic?: boolean;
  category?: 'order' | 'finance' | 'system';
}

// ─── Electron API bridge helper ────────────────────────────────────────────
const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI)
  ? (window as any).electronAPI
  : null;

export const notificationService = {
  async notify({ title, message, type, orderId, userId, associatedUserIds, isPublic = true, category }: NotificationParams) {
    try {
      // 1. Show local toast (always)
      switch (type) {
        case 'success':
          toast.success(message, { duration: 4000 });
          break;
        case 'error':
          toast.error(message, { duration: 5000 });
          break;
        default:
          toast(message, { icon: type === 'warning' ? '⚠️' : 'ℹ️', duration: 4000 });
      }

      // 2. Show native OS notification when running inside Electron
      if (electronAPI?.showNotification) {
        try {
          await electronAPI.showNotification({ title, body: message, type });
        } catch (nativeErr) {
          console.warn('[notificationService] native notification failed:', nativeErr);
        }
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }
};
