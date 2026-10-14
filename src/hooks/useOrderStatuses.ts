import { useCallback, useEffect, useState } from 'react';
import { ApiClient } from '../data/http/api-client';

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

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

type StatusRow = Record<string, unknown>;

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function toStatusItem(row: StatusRow): OrderStatusItem | null {
  const id = Number(row.statusId ?? row.orderStatusId ?? row.id);
  const nameAr = readText(row.nameAr ?? row.name_ar);
  if (!Number.isFinite(id) || id <= 0 || !nameAr) return null;
  return {
    id,
    nameAr,
    nameEn: readText(row.nameEn ?? row.name_en) ?? nameAr,
    isFirst: row.isFirst === true || row.is_first === true,
    isLast: row.isLast === true || row.is_last === true,
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : typeof row.sort_order === 'number' ? row.sort_order : undefined,
    color: readText(row.color),
    code: readText(row.code),
    description: readText(row.description),
    createdAt: readText(row.createdAt),
  };
}

export async function fetchOrderStatuses(): Promise<OrderStatusItem[]> {
  const response = await client.get<{ success: true; data: StatusRow[] }>('/api/v1/operations/order-statuses');
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map(toStatusItem).filter((item): item is OrderStatusItem => item !== null);
}

export async function saveOrderStatus(input: OrderStatusItem): Promise<void> {
  await client.post('/api/v1/operations/order-statuses', {
    statusId: input.id,
    nameAr: input.nameAr,
    nameEn: input.nameEn || input.nameAr,
    isFirst: input.isFirst,
    isLast: input.isLast,
    sortOrder: input.sortOrder ?? input.id,
    color: input.color,
    code: input.code,
    description: input.description,
  });
}

export async function removeOrderStatus(id: number): Promise<void> {
  await client.delete(`/api/v1/operations/order-statuses/${encodeURIComponent(String(id))}`);
}

export function useOrderStatuses() {
  const [statuses, setStatuses] = useState<OrderStatusItem[]>(DEFAULT_ORDER_STATUSES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchOrderStatuses();
      setStatuses(rows.length > 0 ? rows : DEFAULT_ORDER_STATUSES);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'order-statuses request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    error,
    refresh,
    getStatusById,
    getStatusByName,
    getStatusByAny,
    getFirstStatus,
    getLastStatus,
    getNextStatus
  };
}
