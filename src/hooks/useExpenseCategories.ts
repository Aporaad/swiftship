import { useState, useEffect } from 'react';

export interface ExpenseCategory {
  id: string;
  labelAr: string;
  labelEn: string;
  icon?: string;
  accountId?: string; // Linked account from chart of accounts
  accountCode?: string;
  isSystem?: boolean; // Can't be deleted if system
}

// Fallback initial categories to seed
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'wages', labelAr: 'أجور التوصيل', labelEn: 'Delivery Wages', icon: '🚚', isSystem: true, accountId: 'sys_delivery_cost', accountCode: '5000-2788' },
  { id: 'marketing', labelAr: 'تسويق وإعلانات', labelEn: 'Marketing', icon: '📈' },
  { id: 'office', labelAr: 'مستلزمات مكتبية', labelEn: 'Office Supplies', icon: '📎' },
  { id: 'maintenance', labelAr: 'صيانة وإصلاح', labelEn: 'Maintenance', icon: '🔧' },
  { id: 'fuel', labelAr: 'وقود ومحروقات', labelEn: 'Fuel', icon: '⛽' },
  { id: 'rent', labelAr: 'إيجارات', labelEn: 'Rent', icon: '🏢' },
  { id: 'salary', labelAr: 'رواتب موظفين', labelEn: 'Salaries', icon: '👨‍💼', isSystem: true },
  { id: 'custody', labelAr: 'عهدة مناديب', labelEn: 'Custody / Receivables', icon: '💳', isSystem: true },
  { id: 'factory', labelAr: 'دفعات المصانع', labelEn: 'Factory Payouts', icon: '🏭', isSystem: true },
  { id: 'other', labelAr: 'أخرى', labelEn: 'Other', icon: '📄', isSystem: true }
];

export function useExpenseCategories() {
  const [categories, setCategories] = useState<ExpenseCategory[]>(DEFAULT_EXPENSE_CATEGORIES);

  useEffect(() => {
    setCategories(DEFAULT_EXPENSE_CATEGORIES);
  }, []);

  return categories;
}
