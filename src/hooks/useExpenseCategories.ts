/**
 * useExpenseCategories.ts
 * مزود فئات المصروفات — يقرأ من إعدادات النظام عبر alx_api فقط.
 * Expense-category provider — reads the settings document through alx_api only.
 */
import { useEffect, useState } from 'react';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  expenseCategoriesService,
  type ExpenseCategory,
} from '../services/expenseCategoriesService';

export type { ExpenseCategory };
export { DEFAULT_EXPENSE_CATEGORIES };

export function useExpenseCategories(): ExpenseCategory[] {
  // تُعرض الافتراضية فورًا حتى لا تنتظر الواجهة الشبكة، ثم تُستبدل بالمخزّن على الخادم.
  const [categories, setCategories] = useState<ExpenseCategory[]>(DEFAULT_EXPENSE_CATEGORIES);

  useEffect(() => {
    let cancelled = false;
    expenseCategoriesService
      .list()
      .then((stored) => {
        if (!cancelled) setCategories(stored);
      })
      .catch((error) => {
        console.warn('[useExpenseCategories] تعذر تحميل فئات المصروفات من الخادم:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return categories;
}
