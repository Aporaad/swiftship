import { useState, useEffect } from 'react';

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
  createdAt?: string;
}

export const DEFAULT_ORDER_STATUSES: OrderStatusItem[] = [
  { id: 1, nameAr: 'معلق', nameEn: 'Pending', isFirst: true, isLast: false, color: 'amber', code: 'pending', description: 'طلب جديد بانتظار الاعتماد' },
  { id: 2, nameAr: "تم الدفع ولم يتسجل", nameEn: "payment and not Registered", isFirst: false, isLast: false, sortOrder: 2, color: "cyan", code: "payment_not_Registered", description: "العميل دفع قسط ولم يعتمد طلبه" },
  { id: 3, nameAr: 'تم تسجيل الطلب', nameEn: 'Order Registered', isFirst: false, isLast: false, color: 'blue', code: 'registered', description: 'تم تسجيل واكتشاف الطلب في النظام' },
  { id: 4, nameAr: 'وصل مستودع السعودية', nameEn: 'Arrived KSA Warehouse', isFirst: false, isLast: false, color: 'indigo', code: 'ksa_warehouse', description: 'استلام المنتجات بمكتب/مستودع المملكة' },
  { id: 5, nameAr: 'جاري الشحن لليمن', nameEn: 'Shipping to Yemen', isFirst: false, isLast: false, color: 'purple', code: 'shipping_yemen', description: 'انطلاق شاحنات الشحن إلى الجمهورية اليمنية' },
  { id: 6, nameAr: 'في التخليص الجمركي', nameEn: 'Customs Clearance', isFirst: false, isLast: false, color: 'orange', code: 'customs', description: 'إجراءات التخليص والمعاينة الجمركية' },
  { id: 7, nameAr: 'وصل مركز التوزيع في اليمن', nameEn: 'Arrived Yemen Hub', isFirst: false, isLast: false, color: 'cyan', code: 'yemen_hub', description: 'وصول الشحنة لمستودع التوزيع الرئيسي' },
  { id: 8, nameAr: 'مع المندوب للتوصيل', nameEn: 'Out for Delivery', isFirst: false, isLast: false, color: 'sky', code: 'out_for_delivery', description: 'تسليم الشحنة لمندوب التوصيل النهائي' },
  { id: 9, nameAr: 'تم التسليم', nameEn: 'Delivered', isFirst: false, isLast: true, color: 'emerald', code: 'delivered', description: 'تسليم الطلب بنجاح للعميل' },
  { id: 10, nameAr: 'ملغي', nameEn: 'Cancelled', isFirst: false, isLast: false, color: 'rose', code: 'cancelled', description: 'طلب ملغي' }
];

export function useOrderStatuses() {
  const [statuses, setStatuses] = useState<OrderStatusItem[]>(DEFAULT_ORDER_STATUSES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Order statuses are standard workflow stages provided by default.
    setStatuses(DEFAULT_ORDER_STATUSES);
    setLoading(false);
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
