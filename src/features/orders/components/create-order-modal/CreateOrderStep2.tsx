import React from 'react';
import { X, Search, UserPlus, CreditCard, DollarSign, AlertCircle, Package, Trash2, Calendar, Calculator, ChevronRight, ChevronLeft, User, ShoppingCart, Truck, CheckCircle2, ShieldCheck, FileText, Wallet, Building, ArrowRightLeft, Boxes } from 'lucide-react';

import type { Dispatch, SetStateAction } from 'react';
import type { ItemRow, OrderFormData } from '../../types';
type NumericValue = number | string | null | undefined;
type SelectOption = { id: string; nameAr?: string | null; nameEn?: string | null; price?: number | string | null };
const toNumber = (value: NumericValue): number => typeof value === 'number' ? value : Number.parseFloat(value ?? '') || 0;

type OrderSettings = { defaultProductInsuranceFee: number; defaultProductInsuranceType: string };
type CreateOrderStep2Props = {
  isAr: boolean;
  items: ItemRow[];
  cartShareCode: string;
  setCartShareCode: (value: string) => void;
  setIsProductPickerOpen: (value: boolean) => void;
  addItemRow: () => void;
  updateItemRow: (index: number, field: keyof ItemRow | 'itemCategoryName' | 'packagingOptionName', value: ItemRow[keyof ItemRow] | string | null | undefined) => void;
  removeItemRow: (index: number) => void;
  settings: OrderSettings;
  itemCategories: SelectOption[];
  packagingOptions?: SelectOption[];
  orderCurrency: string;
  bankCommissionEnabled: boolean;
  setBankCommissionEnabled: (value: boolean) => void;
  bankCommissionType: 'percentage' | 'fixed';
  setBankCommissionType: (value: 'percentage' | 'fixed') => void;
  bankCommissionRate: number;
  setBankCommissionRate: (value: number) => void;
  couponEnabled: boolean;
  setCouponEnabled: (value: boolean) => void;
  couponRate: number;
  setCouponRate: (value: number) => void;
  formData: OrderFormData;
  addShippingEnabled: boolean;
  setAddShippingEnabled: (value: boolean) => void;
};

export default function CreateOrderStep2(props: CreateOrderStep2Props) {
  const {
    isAr, items, cartShareCode, setCartShareCode, setIsProductPickerOpen, addItemRow,
    updateItemRow, removeItemRow, settings, itemCategories, packagingOptions, orderCurrency,
    bankCommissionEnabled, setBankCommissionEnabled, bankCommissionType, setBankCommissionType,
    bankCommissionRate, setBankCommissionRate, couponEnabled, setCouponEnabled, couponRate,
    setCouponRate, formData, addShippingEnabled, setAddShippingEnabled,
  } = props;
  return (
            <div className="space-y-5 animate-fade-in">
              {/* Cart Share Code Bar */}
              <div className="bg-slate-955/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="text-start">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {isAr ? 'كود السلة الموحد (Cart Share Code)' : 'Cart Share Code'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {isAr ? 'إدخال كود السلة للتفعيل والمشاركة السريعة' : 'Enter cart share token for quick web view'}
                  </span>
                </div>
                <div className="flex gap-2 max-w-xs w-full">
                  <input
                    type="text"
                    value={cartShareCode}
                    onChange={(e) => setCartShareCode(e.target.value)}
                    placeholder={isAr ? "كود السلة" : "Cart Code"}
                    className="flex-1 bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-bold text-xs font-mono"
                  />
                  {cartShareCode && (
                    <button
                      type="button"
                      onClick={() => window.open(`https://cart.shop/share/${cartShareCode}`, '_blank')}
                      className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-3 rounded-xl text-xs flex items-center justify-center transition cursor-pointer"
                      title={isAr ? 'فتح رابط السلة' : 'Open cart URL'}
                    >
                      <Package className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Detailed Products Table */}
              <div className="space-y-3 bg-slate-955/20 border border-slate-850 p-5 rounded-3xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="text-start">
                    <span className="text-xs font-black text-white block flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-[#d4af37]" />
                      {isAr ? 'محتويات الشحنة والمنتجات التفصيلية' : 'Freight Cargo Products'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {isAr ? 'أدخل أصناف المنتج وأسعارها والكميات بالتفصيل' : 'Define detailed products lists for pricing & weight'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsProductPickerOpen(true)}
                      className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 px-3.5 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      {isAr ? 'اختيار منتج من القائمة' : 'Select Product from Catalog'}
                    </button>
                    <button
                      type="button"
                      onClick={addItemRow}
                      className="bg-cyan-600/10 hover:bg-cyan-650/20 text-cyan-400 border border-cyan-500/20 px-3.5 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                    >
                      ➕ {isAr ? 'إدراج بند منتج جديد' : 'Add Product Item'}
                    </button>
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-black text-slate-500 uppercase tracking-wider pb-1 px-2.5">
                  <div className="col-span-3 text-start">{isAr ? 'اسم المنتج' : 'Item Name'}</div>
                  <div className="col-span-2 text-center">{isAr ? 'السعر (SAR)' : 'Price (SAR)'}</div>
                  <div className="col-span-1 text-center">{isAr ? 'الكمية' : 'Qty'}</div>
                  {formData.orderSourceType === 'Factory' ? (
                    <>
                      <div className="col-span-1 text-center">{isAr ? 'وزن (KG)' : 'Weight'}</div>
                      <div className="col-span-1 text-center">CBM</div>
                      <div className="col-span-1 text-center">{isAr ? 'طول' : 'L'}</div>
                      <div className="col-span-1 text-center">{isAr ? 'عرض' : 'W'}</div>
                      <div className="col-span-1 text-center">{isAr ? 'ارتفاع' : 'H'}</div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-2 text-center">{isAr ? 'رابط المنتج' : 'URL Link'}</div>
                      <div className="col-span-3 text-center">{isAr ? 'رقم التتبع للمنتج' : 'Product Tracking'}</div>
                    </>
                  )}
                  <div className="col-span-1 text-center">{isAr ? 'حذف' : 'Del'}</div>
                </div>

                <div className="space-y-2.5">
                  {items.map((item: ItemRow, idx: number) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-3 bg-slate-900/50 border border-slate-850/60 rounded-2xl hover:border-slate-800 transition">
                      <div className="col-span-3">
                        <input
                          required
                          type="text"
                          value={item.productName || ''}
                          onChange={(e) => updateItemRow(idx, 'productName', e.target.value)}
                          placeholder={isAr ? "اسم المنتج..." : "Product Name"}
                          className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] text-start focus:border-[#d4af37]"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          required
                          type="number"
                          value={item.productPrice || 0}
                          onChange={(e) => {
                            const newPrice = toNumber(e.target.value) || 0;
                            updateItemRow(idx, 'productPrice', newPrice);
                            if (item.isInsured) {
                              const qty = Number(item.quantity || 1);
                              const feeRate = settings.defaultProductInsuranceFee || 0;
                              const isPercent = settings.defaultProductInsuranceType === 'percentage';
                              const computedFee = isPercent ? (newPrice * qty * (feeRate / 100)) : (feeRate * qty);
                              updateItemRow(idx, 'insuranceFee', computedFee);
                            }
                          }}
                          className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center focus:border-[#d4af37]"
                        />
                      </div>

                      <div className="col-span-1">
                        <input
                          required
                          type="number"
                          value={item.quantity || 1}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 0;
                            updateItemRow(idx, 'quantity', newQty);
                            if (item.isInsured) {
                              const price = Number(item.productPrice || 0);
                              const feeRate = settings.defaultProductInsuranceFee || 0;
                              const isPercent = settings.defaultProductInsuranceType === 'percentage';
                              const computedFee = isPercent ? (price * newQty * (feeRate / 100)) : (feeRate * newQty);
                              updateItemRow(idx, 'insuranceFee', computedFee);
                            }
                          }}
                          className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center focus:border-[#d4af37]"
                        />
                      </div>

                      {formData.orderSourceType === 'Factory' ? (
                        <>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.weight ?? ''}
                              onChange={(e) => updateItemRow(idx, 'weight', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.cbm ?? ''}
                              onChange={(e) => updateItemRow(idx, 'cbm', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.length ?? ''}
                              onChange={(e) => {
                                const newL = e.target.value;
                                const w = toNumber(item.width || 0);
                                const h = toNumber(item.height || 0);
                                updateItemRow(idx, 'length', newL);
                                updateItemRow(idx, 'cbm', toNumber(((toNumber(newL || '0') * w * h) / 1000000).toFixed(6)));
                              }}
                              placeholder="L"
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.width ?? ''}
                              onChange={(e) => {
                                const newW = e.target.value;
                                const l = toNumber(item.length || 0);
                                const h = toNumber(item.height || 0);
                                updateItemRow(idx, 'width', newW);
                                updateItemRow(idx, 'cbm', toNumber(((l * toNumber(newW || '0') * h) / 1000000).toFixed(6)));
                              }}
                              placeholder="W"
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.height ?? ''}
                              onChange={(e) => {
                                const newH = e.target.value;
                                const l = toNumber(item.length || 0);
                                const w = toNumber(item.width || 0);
                                updateItemRow(idx, 'height', newH);
                                updateItemRow(idx, 'cbm', toNumber(((l * w * toNumber(newH || '0')) / 1000000).toFixed(6)));
                              }}
                              placeholder="H"
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.productUrl || ''}
                              onChange={(e) => updateItemRow(idx, 'productUrl', e.target.value)}
                              placeholder={isAr ? "رابط المنتج..." : "Product Link"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] text-start"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={item.trackingNumber || ''}
                              onChange={(e) => updateItemRow(idx, 'trackingNumber', e.target.value)}
                              placeholder={isAr ? "كود تتبع الطرد للمنتج" : "Item Tracking Number"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] text-start font-mono"
                            />
                          </div>
                        </>
                      )}

                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length === 1}
                          className="text-rose-500 hover:text-white hover:bg-rose-600/20 p-2 rounded-xl transition disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Sub-row: Category, Packaging & Insurance */}
                      <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/40 text-[10px] text-start">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-cyan-400">{isAr ? 'فئة الصنف:' : 'Item category:'}</span>
                          <select
                            value={item.itemCategoryId || ''}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const category = itemCategories.find((entry: SelectOption) => entry.id === selectedId);
                              updateItemRow(idx, 'itemCategoryId', selectedId);
                              updateItemRow(idx, 'itemCategoryName', category ? (isAr ? category.nameAr : category.nameEn) : '');
                            }}
                            className="bg-slate-950 border border-slate-800 text-white font-bold rounded-xl px-3 py-1.5 text-[11px] outline-none cursor-pointer focus:border-cyan-400"
                          >
                            <option value="">{isAr ? '-- بدون فئة --' : '-- No category --'}</option>
                            {itemCategories.map((category: SelectOption) => <option key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-amber-400 flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {isAr ? 'نوع التغليف الخاص بالمنتج:' : 'Product Packaging Type:'}
                          </span>
                          <select
                            value={item.packagingOptionId || ''}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const foundOpt = packagingOptions?.find((o: SelectOption) => o.id === selectedId);
                              updateItemRow(idx, 'packagingOptionId', selectedId);
                              updateItemRow(idx, 'packagingOptionName', foundOpt ? (isAr ? foundOpt.nameAr : foundOpt.nameEn) : '');
                              updateItemRow(idx, 'packagingOptionPrice', foundOpt ? (toNumber(foundOpt.price) || 0) : 0);
                            }}
                            className="bg-slate-950 border border-slate-800 text-white font-bold rounded-xl px-3 py-1.5 text-[11px] outline-none cursor-pointer focus:border-[#d4af37]"
                          >
                            <option value="">{isAr ? '-- بدون تغليف خاص (0) --' : '-- Standard (0) --'}</option>
                            {(packagingOptions || []).map((pkg: SelectOption) => (
                              <option key={pkg.id} value={pkg.id}>
                                {isAr ? pkg.nameAr : pkg.nameEn} {toNumber(pkg.price) > 0 ? `(+${pkg.price} ${orderCurrency})` : '(مجاني)'}
                              </option>
                            ))}
                          </select>
                        </div>
                        {(item.packagingOptionPrice || 0) > 0 && (
                          <span className="text-emerald-400 font-mono font-bold bg-emerald-950/20 border border-emerald-900/40 px-2 py-0.5 rounded-lg">
                            +{((toNumber(item.packagingOptionPrice) || 0) * (toNumber(item.quantity) || 1)).toLocaleString()} {orderCurrency}
                          </span>
                        )}

                        {/* خيار تأمين المنتج وحساب الرسوم تلقائياً */}
                        {/* Product Insurance Checkbox & Auto Fee Display */}
                        <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 px-3 rounded-xl border border-slate-800">
                          <input
                            type="checkbox"
                            id={`create-insured-check-${idx}`}
                            checked={Boolean(item.isInsured)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const qty = Number(item.quantity || 1);
                              const price = Number(item.productPrice || 0);
                              const feeRate = settings.defaultProductInsuranceFee || 0;
                              const isPercent = settings.defaultProductInsuranceType === 'percentage';
                              const computedFee = checked
                                ? (isPercent ? (price * qty * (feeRate / 100)) : (feeRate * qty))
                                : 0;

                              updateItemRow(idx, 'isInsured', checked);
                              updateItemRow(idx, 'insuranceFee', computedFee);
                            }}
                            className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer accent-[#d4af37]"
                          />
                          <label htmlFor={`create-insured-check-${idx}`} className="text-[10px] font-bold text-slate-300 cursor-pointer flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            {isAr ? 'تأمين المنتج' : 'Insure Product'}
                          </label>
                          {item.isInsured && (
                            <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded-lg ms-1">
                              🛡️ {(item.insuranceFee || 0).toLocaleString()} {orderCurrency}
                              {settings.defaultProductInsuranceType === 'percentage' && ` (${settings.defaultProductInsuranceFee}%)`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bank Commission & Coupon Adjustments */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-850/65">
                  <div className="flex flex-col gap-2 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="bank-comm-check"
                        checked={bankCommissionEnabled}
                        onChange={(e) => setBankCommissionEnabled(e.target.checked)}
                        className="rounded bg-slate-955 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="bank-comm-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">
                        {isAr ? 'عمولة البنك' : 'Bank Commission'}
                      </label>
                    </div>
                    {bankCommissionEnabled && (
                      <div className="flex items-center gap-2 bg-[#d4af37]/5">
                        <select
                          value={bankCommissionType}
                          onChange={(e) => setBankCommissionType(e.target.value as 'percentage' | 'fixed')}
                          className="bg-slate-955  border border-slate-800 text-slate-300 rounded-xl p-1.5 text-[10px]"
                        >
                          <option className='bg-slate-900 text-white' value="percentage">{isAr ? 'نسبة (%)' : 'Percentage (%)'}</option>
                          <option className='bg-slate-900 text-white' value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                        </select>
                        <input
                          type="number"
                          value={bankCommissionRate}
                          onChange={(e) => setBankCommissionRate(toNumber(e.target.value) || 0)}
                          className="w-20 bg-slate-955 border border-slate-800 text-white rounded-xl p-1.5 text-center font-mono font-bold text-[10px]"
                          placeholder={bankCommissionType === 'percentage' ? '%' : 'SAR'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850">
                    <input
                      type="checkbox"
                      id="coupon-check"
                      checked={couponEnabled}
                      onChange={(e) => setCouponEnabled(e.target.checked)}
                      className="rounded bg-slate-955 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="coupon-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">
                      {isAr ? 'كوبون خصم (مبلغ)' : 'Coupon Discount (Amount)'}
                    </label>
                    {couponEnabled && (
                      <input
                        type="number"
                        value={couponRate}
                        onChange={(e) => setCouponRate(toNumber(e.target.value) || 0)}
                        className="w-20 bg-slate-955 border border-slate-800 text-white rounded-xl p-1.5 text-center font-mono font-bold text-[10px]"
                        placeholder="0.00"
                      />
                    )}
                  </div>

                  {formData.orderSourceType === 'App' && (
                    <div className="flex items-center gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850">
                      <input
                        type="checkbox"
                        id="add-shipping-check"
                        checked={addShippingEnabled}
                        onChange={(e) => setAddShippingEnabled(e.target.checked)}
                        className="rounded bg-slate-955 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="add-shipping-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">
                        {isAr ? 'إضافة تفاصيل الشحن للطلب' : 'Add Shipping Tracks'}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
  );
}
