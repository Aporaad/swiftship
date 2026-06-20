import { collection, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
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

      let inferredCategory = category || 'system';
      if (!category) {
        const lowerTitle = title.toLowerCase();
        const lowerMessage = message.toLowerCase();
        
        const financeKeywords = [
          'مالي', 'سند', 'الخزينة', 'سداد', 'العهد', 'الدفعة', 'دفع', 'مصروف', 'المحاسبة', 'التصفية', 'التسوية',
          'financial', 'payment', 'expenses', 'custody', 'voucher', 'reconciliation', 'settle', 'paid', 'collect'
        ];
        
        const orderKeywords = [
          'طلب', 'شحن', 'مسار', 'تتبع', 'اللوجستية', 'فاتورة', 'طرد', 'المستودع', 'توصيل',
          'order', 'shipping', 'track', 'logistic', 'invoice', 'parcel', 'warehouse', 'delivery'
        ];

        const isFinance = financeKeywords.some(kw => lowerTitle.includes(kw) || lowerMessage.includes(kw));
        const isOrder = orderKeywords.some(kw => lowerTitle.includes(kw) || lowerMessage.includes(kw));

        if (isFinance) {
          inferredCategory = 'finance';
        } else if (orderId || isOrder) {
          inferredCategory = 'order';
        }
      }

      // 3. Save to Firestore for persistence only if the operator is authenticated
      if (auth.currentUser) {
        await addDoc(collection(db, 'notifications'), {
          title,
          message,
          type,
          orderId: orderId || null,
          userId: userId || 'global',
          associatedUserIds: associatedUserIds || [],
          isPublic,
          read: false,
          category: inferredCategory,
          createdAt: Date.now(),
          creatorId: auth.currentUser?.uid || 'system',
          creatorName: auth.currentUser?.displayName || 'System'
        });
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
  }
};
