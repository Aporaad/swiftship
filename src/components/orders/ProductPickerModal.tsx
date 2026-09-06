import { useEffect, useMemo, useState } from 'react';
import { Boxes, ExternalLink, Search, X, CheckCircle2 } from 'lucide-react';
import { collection, db, onSnapshot } from '../../lib/supabase';
import { Product } from '../../services/productService';

/**
 * واجهة نموذج منتج مسجل في كتالوج النظام الرئيسي (products)
 * Master Product Catalog Record Interface aligned with productService.ts
 */
export interface SystemProductRecord extends Partial<Product> {
  id: string;
  product_id?: string;
  product_name_ar?: string;
  product_name_en?: string;
  product_url?: string;
  unit_price?: number;
  is_allowed?: boolean;
  isAllowed?: boolean;
  cbm?: number;
  width?: number;
  height?: number;
  length?: number;
  weight?: number;
  trackingNumber?: string;
  // مرادفات للتوافق العكسي مع الواجهات المستهلكة - Aliases for backwards compatibility
  productName?: string;
  name?: string;
  sku?: string;
  description?: string;
  notes?: string;
  quantity?: number;
  price?: number;
  productPrice?: number;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  image_url?: string;
  productUrl?: string;
  packagingOptionId?: string;
  packagingOptionName?: string;
  packagingOptionPrice?: number;
  itemCategoryId?: string;
  itemCategoryName?: string;
  isInsured?: boolean;
  insuranceFee?: number;
  createdAt?: number | string;
  updatedAt?: number | string;
}

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: SystemProductRecord) => void;
  isAr: boolean;
  orderCurrency?: string;
}

/**
 * نافذة اختيار منتج من القائمة المسجلة سابقاً في الكتالوج الرئيسي (products)
 * Popup Modal component to select an allowed master product from products catalog
 */
export default function ProductPickerModal({
  isOpen,
  onClose,
  onSelectProduct,
  isAr,
  orderCurrency = 'SAR',
}: ProductPickerModalProps) {
  const [products, setProducts] = useState<SystemProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // جلب كافة المنتجات المسجلة في جدول المنتجات الرئيسي بصورة حية
  // Real-time listener for products master collection in Supabase
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot: any) => {
        const fetchedProducts: SystemProductRecord[] = snapshot.docs.map((entry: any) => {
          const data = entry.data() || {};
          const pId = data.product_id || entry.id;
          const price = Number(data.unit_price ?? data.unitPrice ?? data.productPrice ?? data.product_price ?? 0);
          const nameAr = data.product_name_ar || data.productName || data.name || 'منتج';
          const nameEn = data.product_name_en || '';

          return {
            id: pId,
            product_id: pId,
            product_name_ar: nameAr,
            product_name_en: nameEn,
            productName: nameAr,
            name: nameAr,
            unit_price: price,
            unitPrice: price,
            productPrice: price,
            product_url: data.product_url || data.productUrl || '',
            productUrl: data.product_url || data.productUrl || '',
            item_category_id: data.item_category_id || data.itemCategoryId || '',
            itemCategoryId: data.item_category_id || data.itemCategoryId || '',
            is_allowed: data.is_allowed !== false && data.isAllowed !== false,
            isAllowed: data.is_allowed !== false && data.isAllowed !== false,
            cbm: Number(data.cbm || 0),
            width: Number(data.width || 0),
            height: Number(data.height || 0),
            length: Number(data.length || 0),
            weight: Number(data.weight || 0),
            sku: data.sku || '',
            description: data.description || data.notes || '',
            createdAt: data.created_at || data.createdAt,
            updatedAt: data.updated_at || data.updatedAt,
            ...data,
          };
        });

        setProducts(fetchedProducts);
        setLoading(false);
      },
      (error: any) => {
        console.warn('[ProductPickerModal] Error fetching master products catalog:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, [isOpen]);

  // تصفية المنتجات بحسب السماحية (is_allowed = true) والبحث النصي في الاسم والرمز والفئة والوصف
  // Filter products by is_allowed status and search query across name, sku, category, description
  const filteredProducts = useMemo(() => {
    const allowedOnly = products.filter(
      (p) => p.is_allowed !== false && p.isAllowed !== false
    );
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allowedOnly;

    return allowedOnly.filter((product) => {
      const name = String(
        product.product_name_ar || product.product_name_en || product.productName || product.name || ''
      ).toLowerCase();
      const sku = String(product.sku || '').toLowerCase();
      const category = String(product.itemCategoryName || product.item_category_id || '').toLowerCase();
      const desc = String(product.description || product.notes || '').toLowerCase();

      return (
        name.includes(query) ||
        sku.includes(query) ||
        category.includes(query) ||
        desc.includes(query)
      );
    });
  }, [products, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-955/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-[#121215] border border-[#d4af37]/30 rounded-3xl w-full max-w-4xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col">

        {/* ترويسة النافذة المنبثقة - Header */}
        <header className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#121215] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37]">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="text-start">
              <h3 className="text-white font-black text-base">
                {isAr ? 'اختيار منتج من الكتالوج الرئيسي (products)' : 'Select Product from Master Catalog'}
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                {isAr
                  ? 'انقر على أي منتج مسموح به لاسترجاع كامل تفاصيله ومواصفاته إلى جدول المنتجات.'
                  : 'Click on any allowed product to retrieve its specifications into your order line items.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* شريط البحث عن المنتجات - Search bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-955/40 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'ابحث باسم المنتج أو الفئة…' : 'Search by product name or category…'}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60 text-start"
            />
          </div>
        </div>

        {/* جدول/قائمة المنتجات - Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-bold text-xs">
              {isAr ? 'جاري تحميل الكتالوج الرئيسي للمنتجات…' : 'Loading master products catalog…'}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xs">
              {isAr ? 'لا توجد منتجات مسموح بها مطابقة للبحث' : 'No matching allowed products found'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const price = Number(product.unit_price ?? product.unitPrice ?? product.productPrice ?? 0);
                const name = product.product_name_ar || product.productName || product.name || 'منتج';

                return (
                  <div
                    key={product.id || product.product_id}
                    className="p-4 bg-slate-900/60 border border-slate-850 hover:border-[#d4af37]/50 rounded-2xl transition flex flex-col justify-between gap-3 text-start group"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-black text-white text-sm group-hover:text-[#d4af37] transition">
                            {name}
                          </h4>
                          {product.product_name_en && (
                            <span className="text-[10px] text-slate-500 block font-medium">
                              {product.product_name_en}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[#d4af37] font-black text-xs bg-[#d4af37]/10 px-2.5 py-1 rounded-xl border border-[#d4af37]/20 shrink-0">
                          {price.toLocaleString()} {orderCurrency}
                        </span>
                      </div>

                      {/* المواصفات الأساسية للمنتج (الوزن، CBM، الأبعاد، الرابط) */}
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] text-slate-400 border-t border-slate-850/60 pt-2 font-bold">
                        <div>
                          {isAr ? 'الوزن:' : 'Weight:'}{' '}
                          <span className="text-slate-200 font-mono">{product.weight || 0} kg</span>
                        </div>
                        <div>
                          {isAr ? 'الحجم CBM:' : 'CBM:'}{' '}
                          <span className="text-cyan-300 font-mono">{product.cbm || 0} m³</span>
                        </div>
                        {(product.length || product.width || product.height) ? (
                          <div className="col-span-2 text-slate-400 font-mono text-[9px]">
                            📏 {isAr ? 'الأبعاد:' : 'Dimensions:'} {product.length || 0} x {product.width || 0} x {product.height || 0} cm
                          </div>
                        ) : null}
                        {(product.product_url || product.productUrl) && (
                          <div className="col-span-2">
                            <a
                              href={product.product_url || product.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {isAr ? 'رابط المنتج الأصلي' : 'Original Product Link'}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* زر اختيار المنتج - Select product button */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProduct(product);
                        onClose();
                      }}
                      className="w-full mt-2 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isAr ? 'اختيار هذا المنتج' : 'Select Product'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* أسفل النافذة المنبثقة - Footer */}
        <footer className="p-4 border-t border-slate-800 bg-slate-955 flex justify-between items-center text-xs shrink-0">
          <span className="text-slate-500 font-bold font-mono">
            {isAr ? `إجمالي المنتجات المسموحة: ${filteredProducts.length}` : `Total allowed products: ${filteredProducts.length}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white font-black border border-slate-800 transition cursor-pointer"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </footer>
      </div>
    </div>
  );
}
