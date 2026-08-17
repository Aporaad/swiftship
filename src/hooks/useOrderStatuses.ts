import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, setDoc, doc, db } from '../lib/supabase';

export interface OrderStatusItem {
  id: number;            // رقم المرحلة (1, 2, 3...)
  nameAr: string;        // الاسم بالعربي
  nameEn: string;        // الاسم بالإنجليزي
  isFirst: boolean;      // هل هي المرحلة الأولى
  isLast: boolean;       // هل هي المرحلة الأخيرة
  sortOrder?: number;
  color?: string;        // badge style / hex
  code?: string;
  description?: string;
  createdAt?: number;
}

export const DEFAULT_ORDER_STATUSES: OrderStatusItem[] = [
  { id: 1, nameAr: 'معلق', nameEn: 'Pending', isFirst: true, isLast: false, color: 'amber', code: 'pending', description: 'طلب جديد بانتظار الاعتماد' },
  { id: 2, nameAr: 'تم تسجيل الطلب', nameEn: 'Order Registered', isFirst: false, isLast: false, color: 'blue', code: 'registered', description: 'تم تسجيل واكتشاف الطلب في النظام' },
  { id: 3, nameAr: 'وصل مستودع السعودية', nameEn: 'Arrived KSA Warehouse', isFirst: false, isLast: false, color: 'indigo', code: 'ksa_warehouse', description: 'استلام المنتجات بمكتب/مستودع المملكة' },
  { id: 4, nameAr: 'جاري الشحن لليمن', nameEn: 'Shipping to Yemen', isFirst: false, isLast: false, color: 'purple', code: 'shipping_yemen', description: 'انطلاق شاحنات الشحن إلى الجمهورية اليمنية' },
  { id: 5, nameAr: 'في التخليص الجمركي', nameEn: 'Customs Clearance', isFirst: false, isLast: false, color: 'orange', code: 'customs', description: 'إجراءات التخليص والمعاينة الجمركية' },
  { id: 6, nameAr: 'وصل مركز التوزيع في اليمن', nameEn: 'Arrived Yemen Hub', isFirst: false, isLast: false, color: 'cyan', code: 'yemen_hub', description: 'وصول الشحنة لمستودع التوزيع الرئيسي' },
  { id: 7, nameAr: 'مع المندوب للتوصيل', nameEn: 'Out for Delivery', isFirst: false, isLast: false, color: 'sky', code: 'out_for_delivery', description: 'تسليم الشحنة لمندوب التوصيل النهائي' },
  { id: 8, nameAr: 'تم التسليم', nameEn: 'Delivered', isFirst: false, isLast: true, color: 'emerald', code: 'delivered', description: 'تسليم الطلب بنجاح للعميل' },
  { id: 9, nameAr: 'ملغي', nameEn: 'Cancelled', isFirst: false, isLast: false, color: 'rose', code: 'cancelled', description: 'طلب ملغي' }
];

export function useOrderStatuses() {
  const [statuses, setStatuses] = useState<OrderStatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Seed defaults if collection is empty
    const seedStatuses = async () => {
      try {
        const snap = await getDocs(collection(db, 'order_status'));
        if (snap.empty) {
          for (const st of DEFAULT_ORDER_STATUSES) {
            await setDoc(doc(db, 'order_status', String(st.id)), {
              ...st,
              sortOrder: st.id,
              createdAt: Date.now()
            });
          }
        }
      } catch (err) {
        console.error('[useOrderStatuses] Seeding exception:', err);
      }
    };

    seedStatuses();

    // 2. Real-time subscription to order_status table
    const unsub = onSnapshot(collection(db, 'order_status'), (snap) => {
      const list: OrderStatusItem[] = snap.docs.map(d => {
        const data = d.data();
        const numericId = typeof data.id === 'number' ? data.id : parseInt(d.id, 10) || 0;
        return {
          id: numericId,
          nameAr: data.nameAr || data.name_ar || '',
          nameEn: data.nameEn || data.name_en || '',
          isFirst: !!(data.isFirst ?? data.is_first),
          isLast: !!(data.isLast ?? data.is_last),
          sortOrder: data.sortOrder ?? numericId,
          color: data.color || 'blue',
          code: data.code || '',
          description: data.description || '',
          createdAt: data.createdAt
        };
      });

      // Sort by id ascending (stage number sequence)
      list.sort((a, b) => a.id - b.id);

      if (list.length > 0) {
        setStatuses(list);
      } else {
        setStatuses(DEFAULT_ORDER_STATUSES);
      }
      setLoading(false);
    }, (err) => {
      console.warn('[useOrderStatuses] Realtime listener error, fallback to defaults:', err);
      setStatuses(DEFAULT_ORDER_STATUSES);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Helper functions
  const getStatusById = (id: number | string | undefined | null): OrderStatusItem | undefined => {
    if (id === undefined || id === null || id === '') return undefined;
    const numId = typeof id === 'number' ? id : parseInt(String(id), 10);
    if (!isNaN(numId)) {
      const found = statuses.find(s => s.id === numId);
      if (found) return found;
    }
    return statuses.find(s => String(s.id) === String(id));
  };

  const getStatusByName = (name: string): OrderStatusItem | undefined => {
    if (!name) return undefined;
    const clean = name.trim().toLowerCase();
    return statuses.find(s => s.nameAr.toLowerCase() === clean || s.nameEn.toLowerCase() === clean || s.code?.toLowerCase() === clean);
  };

  const getStatusByAny = (val: number | string | undefined | null): OrderStatusItem | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    return getStatusById(val) || getStatusByName(String(val));
  };

  const getFirstStatus = (): OrderStatusItem => {
    return statuses.find(s => s.isFirst) || statuses[0] || DEFAULT_ORDER_STATUSES[0];
  };

  const getLastStatus = (): OrderStatusItem => {
    return statuses.find(s => s.isLast) || statuses[statuses.length - 1] || DEFAULT_ORDER_STATUSES[7];
  };

  const getNextStatus = (currentStatusIdOrName: number | string): OrderStatusItem | undefined => {
    let currentItem: OrderStatusItem | undefined = getStatusByAny(currentStatusIdOrName);
    if (!currentItem) return undefined;
    const currentIndex = statuses.findIndex(s => s.id === currentItem!.id);
    if (currentIndex >= 0 && currentIndex < statuses.length - 1) {
      return statuses[currentIndex + 1];
    }
    return undefined;
  };

  return {
    statuses,
    loading,
    getStatusById,
    getStatusByName,
    getStatusByAny,
    getFirstStatus,
    getLastStatus,
    getNextStatus
  };
}
