import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_ITEM_CATEGORIES, ItemCategory } from '../services/itemCategoryService';

export function useItemCategories() {
  const [categories, setCategories] = useState<ItemCategory[]>(DEFAULT_ITEM_CATEGORIES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCategories(DEFAULT_ITEM_CATEGORIES);
    setLoading(false);
  }, []);

  const activeCategories = useMemo(() => categories.filter((category) => category.isActive), [categories]);

  const addCategory = async (payload: Omit<ItemCategory, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newCategory: ItemCategory = { ...payload, id, createdAt: Date.now(), updatedAt: Date.now() };
    setCategories(prev => [...prev, newCategory]);
  };

  const updateCategory = async (id: string, payload: Partial<ItemCategory>) => {
    setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...payload, updatedAt: Date.now() } : cat));
  };

  const deleteCategory = async (id: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== id));
  };

  const toggleCategoryStatus = async (category: ItemCategory) => {
    await updateCategory(category.id, { isActive: !category.isActive });
  };

  return { categories, activeCategories, loading, addCategory, updateCategory, deleteCategory, toggleCategoryStatus };
}
