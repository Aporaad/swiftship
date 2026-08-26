import { useEffect, useMemo, useState } from 'react';
import { collection, db, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from '../lib/supabase';
import { DEFAULT_ITEM_CATEGORIES, ItemCategory } from '../services/itemCategoryService';

const normalize = (id: string, raw: any): ItemCategory => ({
  id,
  code: raw.code || '',
  nameAr: raw.nameAr || raw.name_ar || '',
  nameEn: raw.nameEn || raw.name_en || raw.nameAr || '',
  description: raw.description || '',
  hsCodeHint: raw.hsCodeHint || raw.hs_code_hint || '',
  customsPerCarton: Number(raw.customsPerCarton ?? raw.customs_per_carton) || 0,
  taxPerCarton: Number(raw.taxPerCarton ?? raw.tax_per_carton) || 0,
  otherFeesPerCarton: Number(raw.otherFeesPerCarton ?? raw.other_fees_per_carton) || 0,
  customsRate: Number(raw.customsRate ?? raw.customs_rate) || 0,
  taxRate: Number(raw.taxRate ?? raw.tax_rate) || 0,
  feeCurrency: raw.feeCurrency || raw.fee_currency || 'SAR',
  requiresReview: Boolean(raw.requiresReview ?? raw.requires_review),
  isActive: raw.isActive ?? raw.is_active ?? true,
  details: raw.details || {},
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
});

export function useItemCategories() {
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'items_category'), async (snapshot) => {
      const records = snapshot.docs.map((row: any) => normalize(row.id, row.data()));
      if (records.length === 0) {
        await Promise.all(DEFAULT_ITEM_CATEGORIES.map((category) => setDoc(doc(db, 'items_category', category.id), {
          ...category, createdAt: Date.now(), updatedAt: Date.now(),
        })));
      } else {
        setCategories(records.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')));
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsubscribe;
  }, []);

  const activeCategories = useMemo(() => categories.filter((category) => category.isActive), [categories]);

  const addCategory = async (payload: Omit<ItemCategory, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await setDoc(doc(db, 'items_category', id), { ...payload, id, createdAt: Date.now(), updatedAt: Date.now() });
  };
  const updateCategory = async (id: string, payload: Partial<ItemCategory>) => {
    await updateDoc(doc(db, 'items_category', id), { ...payload, updatedAt: Date.now() });
  };
  const deleteCategory = async (id: string) => {
    const [productsSnapshot, shipmentsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('itemCategoryId', '==', id))),
      getDocs(query(collection(db, 'shipments'), where('contentCategoryId', '==', id))),
    ]);
    if (!productsSnapshot.empty || !shipmentsSnapshot.empty) {
      throw new Error('ITEM_CATEGORY_IN_USE');
    }
    await deleteDoc(doc(db, 'items_category', id));
  };
  const toggleCategoryStatus = async (category: ItemCategory) => updateCategory(category.id, { isActive: !category.isActive });

  return { categories, activeCategories, loading, addCategory, updateCategory, deleteCategory, toggleCategoryStatus };
}
