import { Boxes, Package, ShieldCheck, Trash2 } from 'lucide-react';

export default function EditOrderStep2(props: any) {
  const { isAr, items, addItemRow, updateItemRow, removeItemRow, setIsProductPickerOpen, itemCategories, packagingOptions, orderCurrency, settings } = props;

  return (
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-blue-400 uppercase text-[10px] font-black">{isAr ? 'الأصناف والمنتجات' : 'Products & Items'}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductPickerOpen(true)}
                    className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                    {isAr ? 'اختيار منتج من القائمة' : 'Select Product from Catalog'}
                  </button>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
                  >
                    ➕ {isAr ? 'إضافة منتج' : 'Add Item'}
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                    <div className="col-span-4">
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'اسم المنتج' : 'Item Name'}</label>
                      <input
                        type="text"
                        value={item.productName || ''}
                        onChange={(e) => updateItemRow(idx, 'productName', e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2 text-[11px]"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'رابط المنتج' : 'Product URL'}</label>
                      <input
                        type="text"
                        value={item.productUrl || ''}
                        onChange={(e) => updateItemRow(idx, 'productUrl', e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2 text-[11px]"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'السعر (SAR)' : 'Price'}</label>
                      <input
                        type="number"
                        value={item.productPrice || 0}
                        onChange={(e) => updateItemRow(idx, 'productPrice', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2 text-[11px] font-mono text-center"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'الكمية' : 'Qty'}</label>
                      <input
                        type="number"
                        value={item.quantity || 1}
                        onChange={(e) => updateItemRow(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2 text-[11px] font-mono text-center"
                      />
                    </div>

                    <div className="col-span-1 flex justify-center pt-3">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                        className="text-rose-500 hover:text-rose-400 p-1.5 rounded-lg disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Packaging Type Sub-Row & Insurance */}
                    <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-850 text-[10px] text-start">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-cyan-400">{isAr ? 'فئة الصنف:' : 'Item category:'}</span>
                        <select
                          value={item.itemCategoryId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const category = itemCategories.find((entry: any) => entry.id === selectedId);
                            updateItemRow(idx, 'itemCategoryId', selectedId);
                            updateItemRow(idx, 'itemCategoryName', category ? (isAr ? category.nameAr : category.nameEn) : '');
                          }}
                          className="bg-slate-950 border border-slate-800 text-white font-bold rounded-xl px-2.5 py-1 text-[11px] outline-none cursor-pointer focus:border-cyan-400"
                        >
                          <option value="">{isAr ? '-- بدون فئة --' : '-- No category --'}</option>
                          {itemCategories.map((category: any) => <option key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-400 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {isAr ? 'نوع التغليف (order_option):' : 'Packaging Type:'}
                        </span>
                        <select
                          value={item.packagingOptionId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const foundOpt = packagingOptions?.find((o: any) => o.id === selectedId);
                            updateItemRow(idx, 'packagingOptionId', selectedId);
                            updateItemRow(idx, 'packagingOptionName', foundOpt ? (isAr ? foundOpt.nameAr : foundOpt.nameEn) : '');
                            updateItemRow(idx, 'packagingOptionPrice', foundOpt ? (parseFloat(foundOpt.price) || 0) : 0);
                          }}
                          className="bg-slate-950 border border-slate-800 text-white font-bold rounded-xl px-2.5 py-1 text-[11px] outline-none cursor-pointer focus:border-[#d4af37]"
                        >
                          <option value="">{isAr ? '-- بدون تغليف خاص (0) --' : '-- Standard (0) --'}</option>
                          {(packagingOptions || []).map((pkg: any) => (
                            <option key={pkg.id} value={pkg.id}>
                              {isAr ? pkg.nameAr : pkg.nameEn} {pkg.price > 0 ? `(+${pkg.price} SAR)` : '(مجاني)'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-bold">
                          <input
                            type="checkbox"
                            checked={Boolean(item.isInsured)}
                            onChange={(e) => updateItemRow(idx, 'isInsured', e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-400 cursor-pointer"
                          />
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{isAr ? 'تأمين المنتج' : 'Insure Product'}</span>
                        </label>
                        {item.isInsured && (
                          <span className="text-indigo-300 font-mono font-bold text-[10px] bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-lg">
                            +{(parseFloat(item.insuranceFee) || 0).toLocaleString()} {orderCurrency}
                          </span>
                        )}
                      </div>
                      {item.packagingOptionPrice > 0 && (
                        <span className="text-emerald-400 font-mono font-bold">
                          +{((parseFloat(item.packagingOptionPrice) || 0) * (parseFloat(item.quantity) || 1)).toLocaleString()} SAR
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
  );
}
