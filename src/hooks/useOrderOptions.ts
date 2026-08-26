import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, setDoc, doc, deleteDoc, updateDoc, db } from '../lib/supabase';
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

export function useOrderOptions() {
  const [options, setOptions] = useState<OrderOptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Seed defaults if collection is empty
    const seedOptions = async () => {
      try {
        const snap = await getDocs(collection(db, 'order_option'));
        if (snap.empty) {
          for (const opt of DEFAULT_ORDER_OPTIONS) {
            await setDoc(doc(db, 'order_option', opt.id), {
              ...opt,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        }
      } catch (err) {
        console.error('[useOrderOptions] Seeding exception:', err);
      }
    };

    seedOptions();

    // 2. Real-time listener for order_option collection
    const unsub = onSnapshot(collection(db, 'order_option'), (snap) => {
      const list: OrderOptionItem[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: (data.type === 'shipping_category' ? 'shipping_category' : 'packaging') as OrderOptionType,
          nameAr: data.nameAr || data.name_ar || '',
          nameEn: data.nameEn || data.name_en || '',
          price: parseFloat(data.price) || 0,
          details: data.details || data.description || '',
          duration: data.duration !== undefined ? parseInt(data.duration, 10) : undefined,
          isActive: data.isActive !== undefined ? !!data.isActive : (data.is_active !== undefined ? !!data.is_active : true),
          code: data.code || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      });

      if (list.length > 0) {
        setOptions(list);
      } else {
        setOptions(DEFAULT_ORDER_OPTIONS);
      }
      setLoading(false);
    }, (err) => {
      console.warn('[useOrderOptions] Realtime error, falling back to defaults:', err);
      setOptions(DEFAULT_ORDER_OPTIONS);
      setLoading(false);
    });

    return () => unsub();
  }, []);

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

  // CRUD Helper Methods
  const addOption = async (newOption: Omit<OrderOptionItem, 'id'>) => {
    try {
      const newId = 'opt_' + Math.random().toString(36).substring(2, 11);
      const payload: OrderOptionItem = {
        ...newOption,
        id: newId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'order_option', newId), payload);
      return newId;
    } catch (err: any) {
      console.error('[useOrderOptions] addOption error:', err);
      throw err;
    }
  };

  const updateOption = async (id: string, updatedData: Partial<OrderOptionItem>) => {
    try {
      const payload = {
        ...updatedData,
        updatedAt: Date.now()
      };
      await updateDoc(doc(db, 'order_option', id), payload);
    } catch (err: any) {
      console.error('[useOrderOptions] updateOption error:', err);
      throw err;
    }
  };

  const deleteOption = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'order_option', id));
    } catch (err: any) {
      console.error('[useOrderOptions] deleteOption error:', err);
      throw err;
    }
  };

  const toggleOptionStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'order_option', id), {
        isActive: !currentStatus,
        updatedAt: Date.now()
      });
    } catch (err: any) {
      console.error('[useOrderOptions] toggleOptionStatus error:', err);
      throw err;
    }
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
