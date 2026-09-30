import { Trash2 } from 'lucide-react';

function FeeSummary({ label, value, currency, emphasized = false }: { label: string; value: number | string | undefined; currency?: string; emphasized?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${emphasized ? 'border-cyan-400/35 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/70'}`}>
      <span className="block text-[8px] uppercase font-black text-slate-500 truncate">{label}</span>
      <span className={`block mt-0.5 text-[11px] font-mono font-black ${emphasized ? 'text-cyan-300' : 'text-slate-200'}`}>
        {(Number(value) || 0).toLocaleString()} {currency || 'SAR'}
      </span>
    </div>
  );
}

export default function EditOrderStep3(props: any) {
  const { isAr, shippings, addShippingRow, updateShippingRow, removeShippingRow, shippingCompanies, shippingCategoryOptions, itemCategories } = props;

  return (
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-blue-400 uppercase text-[10px] font-black">{isAr ? 'مسارات الشحن' : 'Shipping Tracks'}</span>
                <button
                  type="button"
                  onClick={addShippingRow}
                  className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
                >
                  ➕ {isAr ? 'إضافة مسار شحن' : 'Add Track'}
                </button>
              </div>

              <div className="space-y-3">
                {shippings.map((sh, idx) => (
                  <div key={sh.id || idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                    <div>
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'شركة الشحن' : 'Carrier'}</label>
                      <select
                        value={sh.shippingCompany || ''}
                        onChange={(e) => updateShippingRow(idx, 'shippingCompany', e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2.5 text-[11px] cursor-pointer"
                      >
                        {shippingCompanies.map((sc) => (
                          <option key={sc.id} value={sc.name}>
                            {sc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'فئة الشحن (order_option)' : 'Shipping Category'}</label>
                      <select
                        value={sh.shippingCategoryId || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const foundOpt = shippingCategoryOptions?.find((o: any) => o.id === selectedId);
                          updateShippingRow(idx, 'shippingCategoryId', selectedId);
                          updateShippingRow(idx, 'shippingCategoryName', foundOpt ? (isAr ? foundOpt.nameAr : foundOpt.nameEn) : '');
                          updateShippingRow(idx, 'shippingCategoryPrice', foundOpt ? (parseFloat(foundOpt.price) || 0) : 0);
                          if (foundOpt?.duration !== undefined) {
                            updateShippingRow(idx, 'shippingDuration', String(foundOpt.duration));
                          }
                        }}
                        className="w-full bg-slate-955 border border-slate-800 text-cyan-300 font-bold rounded-lg p-2.5 text-[11px] cursor-pointer"
                      >
                        <option value="">{isAr ? '-- عادي --' : '-- Standard --'}</option>
                        {(shippingCategoryOptions || []).map((cat: any) => (
                          <option key={cat.id} value={cat.id}>
                            {isAr ? cat.nameAr : cat.nameEn} {cat.duration ? `(${cat.duration}d)` : ''} {cat.price > 0 ? `(+${cat.price} SAR)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'تكلفة الشحن (SAR)' : 'Cost (SAR)'}</label>
                      <input
                        type="number"
                        value={sh.shippingCost || 0}
                        onChange={(e) => updateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-955 border border-slate-800 text-[#d4af37] rounded-lg p-2.5 text-[11px] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'مكان التصدير' : 'Source'}</label>
                      <input
                        type="text"
                        value={sh.shippingSource || ''}
                        onChange={(e) => updateShippingRow(idx, 'shippingSource', e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2.5 text-[11px]"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'الوجهة' : 'Destination'}</label>
                        <input
                          type="text"
                          value={sh.shippingDestination || ''}
                          onChange={(e) => updateShippingRow(idx, 'shippingDestination', e.target.value)}
                          className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2.5 text-[11px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeShippingRow(idx)}
                        className="text-rose-500 hover:text-rose-400 p-1.5 rounded-lg pt-4 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="md:col-span-4 grid grid-cols-1 lg:grid-cols-7 gap-2.5 border-t border-cyan-500/15 pt-3">
                      <div className="lg:col-span-2">
                        <label className="block text-[9px] text-cyan-300 mb-0.5 font-black">{isAr ? 'فئة محتوى الشحنة' : 'Shipment content category'}</label>
                        <select
                          value={sh.contentCategoryId || ''}
                          onChange={(e) => updateShippingRow(idx, 'contentCategoryId', e.target.value)}
                          className="w-full bg-slate-950 border border-cyan-500/25 text-white rounded-lg p-2.5 text-[11px] cursor-pointer focus:border-cyan-400 outline-none"
                        >
                          <option value="">{isAr ? '-- بدون فئة --' : '-- No category --'}</option>
                          {itemCategories.map((category: any) => (
                            <option key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'عدد الكراتين' : 'Cartons'}</label>
                        <input
                          type="number"
                          min="0"
                          value={sh.cartonCount ?? 0}
                          onChange={(e) => updateShippingRow(idx, 'cartonCount', Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 text-[11px] font-mono text-center"
                        />
                      </div>
                      <FeeSummary label={isAr ? 'جمارك' : 'Customs'} value={sh.customsFee} currency={sh.categoryFeeCurrency} />
                      <FeeSummary label={isAr ? 'ضريبة' : 'Tax'} value={sh.taxFee} currency={sh.categoryFeeCurrency} />
                      <FeeSummary label={isAr ? 'رسوم أخرى' : 'Other fees'} value={sh.otherCategoryFee} currency={sh.categoryFeeCurrency} />
                      <FeeSummary label={isAr ? 'إجمالي رسوم الفئة' : 'Category fees total'} value={sh.categoryFeesTotal} currency={sh.categoryFeeCurrency} emphasized />
                      <p className="lg:col-span-7 text-[9px] text-slate-500">
                        {isAr ? 'تُحفظ هذه الرسوم مع الشحنة فقط ولا تدخل في إجمالي الطلب أو مدفوعاته.' : 'These fees are stored with this shipment only and are excluded from the order total and payments.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
  );
}
