import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import toast from 'react-hot-toast';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationParams {
  title: string;
  message: string;
  type: NotificationType;
  orderId?: string;
  userId?: string; // Target specific user
  isPublic?: boolean;
  category?: 'order' | 'finance' | 'system';
}

export const notificationService = {
  async notify({ title, message, type, orderId, userId, isPublic = true, category }: NotificationParams) {
    try {
      // 1. Show local toast
      switch (type) {
        case 'success':
          toast.success(message);
          break;
        case 'error':
          toast.error(message);
          break;
        default:
          toast(message, { icon: type === 'warning' ? '⚠️' : 'ℹ️' });
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

      // 2. Save to Firestore for persistence
      await addDoc(collection(db, 'notifications'), {
        title,
        message,
        type,
        orderId: orderId || null,
        userId: userId || 'global',
        isPublic,
        read: false,
        category: inferredCategory,
        createdAt: Date.now(),
        creatorId: auth.currentUser?.uid || 'system',
        creatorName: auth.currentUser?.displayName || 'System'
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }
};
