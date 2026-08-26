export interface ItemCategory {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description: string;
  hsCodeHint?: string;
  customsPerCarton: number;
  taxPerCarton: number;
  otherFeesPerCarton: number;
  customsRate: number;
  taxRate: number;
  feeCurrency: string;
  requiresReview: boolean;
  isActive: boolean;
  details?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

export interface ShipmentCategoryFees {
  cartonCount: number;
  customsFee: number;
  taxFee: number;
  otherCategoryFee: number;
  total: number;
  currency: string;
}

type SeedCategoryRow = [string, string, string, string, string, string | undefined, boolean];

const SEED_CATEGORY_ROWS: SeedCategoryRow[] = [
  ['cat_clothing', 'CLOTHING', 'ملابس وأقمشة', 'Clothing & Textiles', 'ملابس جاهزة ومنسوجات وأقمشة.', 'Ch. 61-63', false],
  ['cat_footwear_bags', 'FOOTWEAR_BAGS', 'أحذية وحقائب', 'Footwear & Bags', 'أحذية وحقائب وإكسسوارات سفر.', 'Ch. 42, 64', false],
  ['cat_perfumes', 'PERFUMES', 'عطور وبخور', 'Perfumes & Fragrances', 'عطور وبخور ومنتجات عطرية.', 'Ch. 33', true],
  ['cat_cosmetics', 'COSMETICS', 'تجميل وعناية شخصية', 'Cosmetics & Personal Care', 'مستحضرات تجميل وعناية شخصية.', 'Ch. 33', true],
  ['cat_electronics', 'ELECTRONICS', 'إلكترونيات وملحقات', 'Electronics & Accessories', 'أجهزة إلكترونية وملحقاتها.', 'Ch. 85', false],
  ['cat_mobile_accessories', 'MOBILE_ACCESSORIES', 'إكسسوارات جوال', 'Mobile Accessories', 'أغطية وشواحن وكابلات وملحقات الهاتف.', 'Ch. 85', false],
  ['cat_home_supplies', 'HOME_SUPPLIES', 'مستلزمات منزلية', 'Household Supplies', 'أدوات منزلية واستخدام يومي.', 'Ch. 39, 69, 73', false],
  ['cat_hardware', 'HARDWARE', 'خردوات وأدوات', 'Hardware & Tools', 'خردوات وأدوات ومستلزمات صيانة.', 'Ch. 73, 82', false],
  ['cat_kitchenware', 'KITCHENWARE', 'أدوات مطبخ', 'Kitchenware', 'أوانٍ وأدوات ومستلزمات المطبخ.', 'Ch. 39, 69, 73', false],
  ['cat_baby_toys', 'BABY_TOYS', 'أطفال وألعاب', 'Baby & Toys', 'ألعاب ومستلزمات أطفال.', 'Ch. 95', true],
  ['cat_sports', 'SPORTS', 'رياضة ولياقة', 'Sports & Fitness', 'ملابس وأدوات رياضية ولياقة.', 'Ch. 61, 95', false],
  ['cat_stationery_books', 'STATIONERY_BOOKS', 'قرطاسية وكتب', 'Stationery & Books', 'قرطاسية وكتب ومواد مكتبية.', 'Ch. 48, 49, 96', false],
  ['cat_auto_parts', 'AUTO_PARTS', 'قطع غيار سيارات', 'Auto Parts', 'قطع غيار ومستلزمات سيارات.', 'Ch. 87', false],
  ['cat_furniture', 'FURNITURE', 'أثاث ومفروشات', 'Furniture & Furnishings', 'أثاث ومفروشات ومنتجات كبيرة الحجم.', 'Ch. 94', false],
  ['cat_food', 'FOOD', 'أغذية ومستلزمات غذائية', 'Food & Groceries', 'أغذية ومشروبات ومستلزمات غذائية.', 'Ch. 16-22', true],
  ['cat_medical', 'MEDICAL', 'طبية وصحية', 'Medical & Health', 'منتجات طبية وصحية.', 'Ch. 30, 90', true],
  ['cat_jewelry', 'JEWELRY', 'مجوهرات وإكسسوارات', 'Jewelry & Accessories', 'إكسسوارات ومجوهرات.', 'Ch. 71', true],
  ['cat_other', 'OTHER', 'أصناف أخرى', 'Other Items', 'فئة عامة مؤقتة.', undefined, true],
];

export const DEFAULT_ITEM_CATEGORIES: Array<Omit<ItemCategory, 'createdAt' | 'updatedAt'>> = SEED_CATEGORY_ROWS.map(([id, code, nameAr, nameEn, description, hsCodeHint, requiresReview]) => ({
  id, code, nameAr, nameEn, description, hsCodeHint,
  customsPerCarton: 0, taxPerCarton: 0, otherFeesPerCarton: 0,
  customsRate: 0, taxRate: 0, feeCurrency: 'SAR', requiresReview, isActive: true,
}));

const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;

export function calculateShipmentCategoryFees(category: Partial<ItemCategory> | undefined, cartonCount: unknown): ShipmentCategoryFees {
  const cartons = Math.max(0, money(cartonCount));
  const customsFee = money(cartons * money(category?.customsPerCarton));
  const taxFee = money(cartons * money(category?.taxPerCarton));
  const otherCategoryFee = money(cartons * money(category?.otherFeesPerCarton));
  return {
    cartonCount: cartons,
    customsFee,
    taxFee,
    otherCategoryFee,
    total: money(customsFee + taxFee + otherCategoryFee),
    currency: category?.feeCurrency || 'SAR',
  };
}
