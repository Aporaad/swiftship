import { useEffect, useMemo, useState } from 'react';
import { Boxes, ExternalLink, Search, X, CheckCircle2 } from 'lucide-react';
import { collection, db, onSnapshot } from '../../lib/supabase';

/**
 * واجهة نموذج منتج مسجل في كتالوج النظام
 * Product Record Interface from system catalog
 */
export interface SystemProductRecord {
  id: string;
  orderId?: string;
  trackingNumber?: string;
  productName?: string;
  name?: string;
  sku?: string;
  description?: string;
  quantity?: number;
  price?: number;
  productPrice?: number;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  cbm?: number;
  image_url?: string;
  productUrl?: string;
  packagingOptionId?: string;
  packagingOptionName?: string;
  packagingOptionPrice?: number;
  itemCategoryId?: string;
  itemCategoryName?: string;
  notes?: string;
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
 * نافذة اختيار منتج من القائمة المسجلة سابقاً
 * Popup Modal component to select a product from catalog with full details
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

  // جلب كافة المنتجات المسجلة في جدول المنتجات بصورة حية
  // Real-time listener for products collection in Supabase/Firestore
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot: any) => {
        const fetchedProducts: SystemProductRecord[] = snapshot.docs.map((entry: any) => ({
          id: entry.id,
          ...entry.data(),
        }));
        setProducts(fetchedProducts);
        setLoading(false);
      },
      (error: any) => {
        console.warn('[ProductPickerModal] Error fetching products:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, [isOpen]);

  // تصفية المنتجات بحسب البحث النصي في الاسم والرمز والفئة والوصف
  // Filter products by search query across name, sku, category, description
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      const name = String(product.productName || product.name || '').toLowerCase();
      const sku = String(product.sku || '').toLowerCase();
      const category = String(product.itemCategoryName || '').toLowerCase();
      const desc = String(product.description || product.notes || '').toLowerCase();

      return name.includes(query) || sku.includes(query) || category.includes(query) || desc.includes(query);
    });
  }, [products, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-[#121215] border border-[#d4af37]/30 rounded-3xl w-full max-w-4xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* ترويسة النافذة المنبثقة - Header */}
        <header className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#121215] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37]">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="text-start">
              <h3 className="text-white font-black text-base">
                {isAr ? 'اختيار منتج من القائمة المسجلة' : 'Select Product from Catalog'}
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                {isAr
                  ? 'انقر على أي منتج من القائمة لاسترجاع كامل تفاصيله إلى جدول المنتجات.'
                  : 'Click on any product to retrieve its full specifications into your order table.'}
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
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'ابحث باسم المنتج أو SKU أو الفئة…' : 'Search by product name, SKU, or category…'}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pr-10 pl-4 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60 text-start"
            />
          </div>
        </div>

        {/* جدول/قائمة المنتجات - Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-bold text-xs">
              {isAr ? 'جاري تحميل قائمة المنتجات…' : 'Loading product catalog…'}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xs">
              {isAr ? 'لا توجد منتجات مسجلة مطابقة للبحث' : 'No matching products found'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const price = Number(product.productPrice ?? product.unitPrice ?? 0);
                const name = product.productName || product.name || 'منتج';

                return (
                  <div
                    key={product.id}
                    className="p-4 bg-slate-900/60 border border-slate-850 hover:border-[#d4af37]/50 rounded-2xl transition flex flex-col justify-between gap-3 text-start group"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-black text-white text-sm group-hover:text-[#d4af37] transition">
                            {name}
                          </h4>
                          {product.sku && (
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                              SKU: {product.sku}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[#d4af37] font-black text-xs bg-[#d4af37]/10 px-2.5 py-1 rounded-xl border border-[#d4af37]/20 shrink-0">
                          {price.toLocaleString()} {product.currency || orderCurrency}
                        </span>
                      </div>

                      {/* التفاصيل الإضافية للمنتج (الوزن، الفئة، التغليف) */}
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] text-slate-400 border-t border-slate-850/60 pt-2 font-bold">
                        <div>
                          {isAr ? 'الفئة:' : 'Category:'}{' '}
                          <span className="text-cyan-300">{product.itemCategoryName || '—'}</span>
                        </div>
                        <div>
                          {isAr ? 'الوزن:' : 'Weight:'}{' '}
                          <span className="text-slate-200 font-mono">{product.weight || 0} kg</span>
                        </div>
                        {product.packagingOptionName && (
                          <div className="col-span-2 text-amber-400">
                            📦 {product.packagingOptionName} ({product.packagingOptionPrice || 0} {orderCurrency})
                          </div>
                        )}
                        {product.productUrl && (
                          <div className="col-span-2">
                            <a
                              href={product.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {isAr ? 'رابط المنتج' : 'Product Link'}
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
            {isAr ? `إجمالي المنتجات: ${filteredProducts.length}` : `Total products: ${filteredProducts.length}`}
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
