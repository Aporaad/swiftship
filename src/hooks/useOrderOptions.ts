import { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';

export type OrderOptionType = 'packaging' | 'shipping_category';

export interface OrderOptionItem {
  id: string;
  type: OrderOptionType;
  nameAr: string;
  nameEn: string;
  price: number;
  details?: string;
  duration?: number; // Duration in days (primarily for shipping_category)
  isActive: boolean;
  code?: string;
  createdAt?: number;
  updatedAt?: number;
}

export const DEFAULT_ORDER_OPTIONS: OrderOptionItem[] = [
  // أنواع التغليف الافتراضية
  {
    id: 'opt_pkg_std',
    type: 'packaging',
    nameAr: 'تغليف كرتون فاخر',
    nameEn: 'Standard Premium Box',
    price: 0,
    details: 'كرتون فاخر مزدوج للحماية العادية',
    isActive: true,
    code: 'PKG_STD'
  },
  {
    id: 'opt_pkg_bubble',
    type: 'packaging',
    nameAr: 'تغليف فقاقيع ممتص صدمات',
    nameEn: 'Bubble Wrap Protection',
    price: 5,
    details: 'طبقات فقاقيع هوائية لحماية المواد الحساسة',
    isActive: true,
    code: 'PKG_BUBBLE'
  },
  {
    id: 'opt_pkg_wood',
    type: 'packaging',
    nameAr: 'تغليف خشبي مقوى',
    nameEn: 'Reinforced Wooden Crate',
    price: 25,
    details: 'صندوق خشبي مصفح للبضائع الثقيلة والقابلة للكسر',
    isActive: true,
    code: 'PKG_WOOD'
  },
  {
    id: 'opt_pkg_gift',
    type: 'packaging',
    nameAr: 'تغليف هدايا ملكي',
    nameEn: 'Royal Gift Packaging',
    price: 15,
    details: 'تغليف هدايا فاخر مع أشرطة وبطاقات خاصة',
    isActive: true,
    code: 'PKG_GIFT'
  },

  // فئات الشحن الافتراضية
  {
    id: 'opt_shp_normal',
    type: 'shipping_category',
    nameAr: 'عادي',
    nameEn: 'Standard Courier',
    price: 0,
    duration: 15,
    details: 'شحن اقتصادي قياسي حسب الجدول المعتاد',
    isActive: true,
    code: 'SHP_NORMAL'
  },
  {
    id: 'opt_shp_express',
    type: 'shipping_category',
    nameAr: 'مستعجل',
    nameEn: 'Express Direct',
    price: 20,
    duration: 7,
    details: 'شحن سريع ومباشر بأولوية نقل عالي',
    isActive: true,
    code: 'SHP_EXPRESS'
  },
  {
    id: 'opt_shp_urgent',
    type: 'shipping_category',
    nameAr: 'طارئ',
    nameEn: 'Urgent VIP Freight',
    price: 50,
    duration: 3,
    details: 'شحن جوي طارئ فائق السرعة مع متابعة لحظية',
    isActive: true,
    code: 'SHP_URGENT'
  }
];

type OptionDocument = { id: string; data: () => Record<string, unknown> };

const readOptionText = (data: Record<string, unknown>, key: string, legacyKey?: string): string => {
  const value = data[key] ?? (legacyKey ? data[legacyKey] : undefined);
  return typeof value === 'string' ? value : value == null ? '' : String(value);
};

const readOptionNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const readOptionInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

export function useOrderOptions() {
  const [options, setOptions] = useState<OrderOptionItem[]>(DEFAULT_ORDER_OPTIONS);
  const [loading, setLoading] = useState(false);

  // Filtered helpers
  const packagingOptions = options.filter(o => o.type === 'packaging');
  const shippingCategoryOptions = options.filter(o => o.type === 'shipping_category');

  const getOptionById = (id: string | undefined | null): OrderOptionItem | undefined => {
    if (!id) return undefined;
    return options.find(o => o.id === id || o.code === id);
  };

  const getOptionByName = (name: string, type?: OrderOptionType): OrderOptionItem | undefined => {
    if (!name) return undefined;
    const clean = name.trim().toLowerCase();
    return options.find(o =>
      (!type || o.type === type) &&
      (o.nameAr.toLowerCase() === clean || o.nameEn.toLowerCase() === clean || o.code?.toLowerCase() === clean)
    );
  };

  // CRUD Helper Methods (Pure local state updates)
  const addOption = async (newOption: Omit<OrderOptionItem, 'id'>) => {
    const newId = 'opt_' + Math.random().toString(36).substring(2, 11);
    const payload: OrderOptionItem = {
      ...newOption,
      id: newId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setOptions(prev => [...prev, payload]);
    return newId;
  };

  const updateOption = async (id: string, updatedData: Partial<OrderOptionItem>) => {
    setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, ...updatedData, updatedAt: Date.now() } : opt));
  };

  const deleteOption = async (id: string) => {
    setOptions(prev => prev.filter(opt => opt.id !== id));
  };

  const toggleOptionStatus = async (id: string, currentStatus: boolean) => {
    setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, isActive: !currentStatus, updatedAt: Date.now() } : opt));
  };

  return {
    options,
    packagingOptions,
    shippingCategoryOptions,
    loading,
    getOptionById,
    getOptionByName,
    addOption,
    updateOption,
    deleteOption,
    toggleOptionStatus
  };
}

export default useOrderOptions;
