import React from 'react';
import { X, Search, UserPlus, CreditCard, DollarSign, AlertCircle, Package, Trash2, Calendar, Calculator, ChevronRight, ChevronLeft, User, ShoppingCart, Truck, CheckCircle2, ShieldCheck, FileText, Wallet, Building, ArrowRightLeft, Boxes } from 'lucide-react';

export default function CreateOrderStep3(props: any) {
  const {
    isAr, formData, addShippingEnabled, shippings, addShippingRow, removeShippingRow,
    updateShippingRow, role, hasPermission, setActiveAddShippingIndex,
    setIsAddShippingCompanyOpen, shippingCompanies, shippingCategoryOptions, orderCurrency,
    packagingFeeEnabled, setPackagingFeeEnabled, packagingFeeRate, setPackagingFeeRate,
    canEditOrderDefaultsCreation, homeDeliveryEnabled, setHomeDeliveryEnabled,
    viaShippingAgent, setViaShippingAgent, couriers, setFormData, calcs, settings,
  } = props;
  return (
            <div className="space-y-6 animate-fade-in">
              {/* Shipping Tracks List */}
              {formData.orderSourceType !== 'SHEIN' && (formData.orderSourceType !== 'App' || addShippingEnabled) && (
                <div className="space-y-4 bg-slate-950/30 border border-slate-850 p-5 rounded-3xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
                    <div className="text-start">
                      <span className="text-xs font-black text-white block flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-[#d4af37]" />
                        {isAr ? 'تفاصيل شحنات المسار اللوجيستي' : 'Shipping Manifest Tracks'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold mt-0.5">
                        {isAr ? 'أدخل مسارات الشحن المعتمدة والتكاليف والشركات الناقلة' : 'Define transport companies and costs for delivery tracks'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addShippingRow}
                      className="bg-emerald-600/10 hover:bg-emerald-650/20 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                    >
                      ➕ {isAr ? 'إضافة مسار شحن جديد' : 'Add Shipping Track'}
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {shippings && shippings.map((sh, idx) => (
                      <div key={sh.id || idx} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-850 space-y-3 relative">
                        <div className="flex justify-between items-center border-b border-slate-850/60 pb-2">
                          <span className="text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2.5 py-0.5 rounded-lg">
                            {isAr ? `مسار الشحن #${idx + 1}` : `Shipping Track #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeShippingRow(idx)}
                            className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/20 transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isAr ? 'إلغاء المسار' : 'Delete Segment'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-start font-bold">
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'نوع الشحن' : 'Mode'}</label>
                            <select
                              value={sh.shippingType || 'بري'}
                              onChange={(e) => updateShippingRow(idx, 'shippingType', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold cursor-pointer"
                            >
                              <option className="bg-slate-900 text-white" value="بري">{isAr ? 'Overland بري' : 'Land - Overland'}</option>
                              <option className="bg-slate-900 text-white" value="جوي">{isAr ? 'Air Freight جوي' : 'Air - Air Freight'}</option>
                              <option className="bg-slate-900 text-white" value="بحري">{isAr ? 'Ocean Cargo بحري' : 'Sea - Ocean Cargo'}</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-slate-400">{isAr ? 'شركة الشحن' : 'Carrier'}</label>
                              {(role === 'Admin' || hasPermission('add_sources')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveAddShippingIndex(idx);
                                    setIsAddShippingCompanyOpen(true);
                                  }}
                                  className="text-[10px] font-black text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  ➕ {isAr ? 'شركة جديدة' : 'New Carrier'}
                                </button>
                              )}
                            </div>
                            <select
                              value={sh.shippingCompany || ''}
                              onChange={(e) => updateShippingRow(idx, 'shippingCompany', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold cursor-pointer"
                            >
                              <option className="bg-slate-900 text-white" value="">{isAr ? '-- اختر شركة شحن --' : '-- Choose carrier --'}</option>
                              {shippingCompanies.map((c) => (
                                <option className="bg-slate-900 text-white" key={c.id} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'فئة سرعة الشحن (order_option)' : 'Shipping Category'}</label>
                            <select
                              value={sh.shippingCategoryId || ''}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                const foundOpt = shippingCategoryOptions?.find((o: any) => o.id === selectedId);
                                updateShippingRow(idx, {
                                  shippingCategoryId: selectedId,
                                  shippingCategoryName: foundOpt ? (isAr ? foundOpt.nameAr : foundOpt.nameEn) : '',
                                  shippingCategoryPrice: foundOpt ? (parseFloat(foundOpt.price) || 0) : 0,
                                  shippingDuration: foundOpt?.duration !== undefined ? String(foundOpt.duration) : sh.shippingDuration
                                });
                              }}
                              className="w-full bg-slate-955 border border-slate-800 text-cyan-300 font-bold rounded-xl p-2.5 outline-none cursor-pointer focus:border-[#d4af37]"
                            >
                              <option className="bg-slate-900 text-white" value="">{isAr ? '-- عادي (اعتيادي) --' : '-- Standard --'}</option>
                              {(shippingCategoryOptions || []).map((cat: any) => (
                                <option className="bg-slate-900 text-white" key={cat.id} value={cat.id}>
                                  {isAr ? cat.nameAr : cat.nameEn} {cat.duration ? `(${cat.duration} ${isAr ? 'أيام' : 'd'})` : ''} {cat.price > 0 ? `(+${cat.price} ${orderCurrency})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'رقم التتبع للشحنة' : 'Tracking Number'}</label>
                            <input
                              type="text"
                              value={sh.trackingNumber || ''}
                              onChange={(e) => updateShippingRow(idx, 'trackingNumber', e.target.value)}
                              placeholder={isAr ? "رقم التتبع المخصص للشحنة" : "Cargo tracking ID"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'أجرة وتكاليف النقل (SAR)' : 'Shipping Cost (SAR)'}</label>
                            <input
                              type="number"
                              required
                              value={sh.shippingCost || 0}
                              onChange={(e) => updateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-955 border border-slate-800 text-[#d4af37] rounded-xl p-2.5 outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'مكان التصدير' : 'Source'}</label>
                            <input
                              type="text"
                              required
                              value={sh.shippingSource || ''}
                              onChange={(e) => updateShippingRow(idx, 'shippingSource', e.target.value)}
                              placeholder={isAr ? "مثال: الصين، دبي" : "Source country"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'مكان الاستلام' : 'Destination'}</label>
                            <input
                              type="text"
                              required
                              value={sh.shippingDestination || ''}
                              onChange={(e) => updateShippingRow(idx, 'shippingDestination', e.target.value)}
                              placeholder={isAr ? "مثال: مستودع صنعاء" : "Destination depot"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'تاريخ الانطلاق' : 'Dispatch Date'}</label>
                            <input
                              type="date"
                              value={sh.shippingDate || ''}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                let expected = sh.expectedArrival || '';
                                if (newDate && sh.shippingDuration) {
                                  const days = parseInt(sh.shippingDuration);
                                  if (!isNaN(days)) {
                                    const dateObj = new Date(newDate);
                                    dateObj.setDate(dateObj.getDate() + days);
                                    expected = dateObj.toISOString().split('T')[0];
                                  }
                                }
                                updateShippingRow(idx, { shippingDate: newDate, expectedArrival: expected });
                              }}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'موعد الوصول المتوقع' : 'Expected Arrival'}</label>
                            <input
                              type="date"
                              value={sh.expectedArrival || ''}
                              onChange={(e) => updateShippingRow(idx, 'expectedArrival', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans"
                            />
                          </div>

                          {/* <div className="md:col-span-4 border-t border-cyan-500/15 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                            <div className="lg:col-span-2">
                              <label className="block text-cyan-300 mb-1 font-black">{isAr ? 'فئة محتوى الشحنة' : 'Shipment content category'}</label>
                              <select
                                value={sh.contentCategoryId || ''}
                                onChange={(e) => updateShipmentContentCategory(idx, e.target.value)}
                                className="w-full bg-slate-950 border border-cyan-500/25 text-white rounded-xl p-2.5 outline-none font-bold cursor-pointer focus:border-cyan-400"
                              >
                                <option className="bg-slate-900 text-white" value="">{isAr ? '-- بدون فئة --' : '-- No category --'}</option>
                                {itemCategories.map((category: any) => <option className="bg-slate-900 text-white" key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-500 mb-1">{isAr ? 'عدد الكراتين' : 'Cartons'}</label>
                              <input
                                type="number"
                                min="0"
                                value={sh.cartonCount ?? 0}
                                onChange={(e) => updateShipmentContentCategory(idx, sh.contentCategoryId || '', Math.max(0, parseInt(e.target.value, 10) || 0))}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono text-center"
                              />
                            </div> 
                            <ShipmentFeeCell label={isAr ? 'جمارك' : 'Customs'} value={sh.customsFee} currency={sh.categoryFeeCurrency} />
                            <ShipmentFeeCell label={isAr ? 'ضريبة' : 'Tax'} value={sh.taxFee} currency={sh.categoryFeeCurrency} />
                            <ShipmentFeeCell label={isAr ? 'رسوم أخرى' : 'Other fees'} value={sh.otherCategoryFee} currency={sh.categoryFeeCurrency} />
                            <ShipmentFeeCell label={isAr ? 'إجمالي رسوم الفئة' : 'Category fees total'} value={sh.categoryFeesTotal} currency={sh.categoryFeeCurrency} emphasized />
                            <p className="lg:col-span-7 text-[9px] text-slate-500">{isAr ? 'تسجل هذه الرسوم مع الشحنة فقط، ولا تُضاف إلى إجمالي الطلب أو الدفعة المطلوبة.' : 'These fees are stored with the shipment only and are not added to the order total or payment due.'}</p>
                          </div> */}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850 text-start">
                    <input
                      type="checkbox"
                      id="packaging-fee-check"
                      checked={packagingFeeEnabled}
                      onChange={(e) => setPackagingFeeEnabled(e.target.checked)}
                      className="rounded bg-slate-955 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="packaging-fee-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">
                      {isAr ? 'إضافة رسوم تغليف شركة الشحن (ريال ثابت)' : 'Add carrier packaging fee (fixed SAR)'}
                    </label>
                    {packagingFeeEnabled && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={packagingFeeRate}
                          onChange={(e) => canEditOrderDefaultsCreation && setPackagingFeeRate(parseFloat(e.target.value) || 0)}
                          disabled={!canEditOrderDefaultsCreation}
                          className="w-24 bg-slate-955 border border-slate-800 text-white rounded-xl p-1.5 text-center font-mono font-bold text-[11px] disabled:opacity-50"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-slate-500 font-bold">SAR</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Field Logistics & Couriers Section - قسم المناديب واللوجستيات الميدانية */}
              <div className="space-y-4 bg-slate-955/20 border border-slate-800 p-5 rounded-3xl">
                <span className="block text-xs font-black text-white text-start mb-1 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#d4af37]" />
                  {isAr ? 'المناديب واللوجستيات الميدانية' : 'Field Logistics & Delivery Drivers'}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* ====== Checkbox 1: توصيل للمنزل | Home Delivery Toggle ====== */}
                  {/* عند التفعيل: يظهر حقلا مندوب التوصيل اليمني + رسوم التوصيل */}
                  {/* When enabled: Yemen delivery courier & fee fields become visible */}
                  <div className={`flex items-center gap-3 border p-3 rounded-2xl transition-all ${homeDeliveryEnabled ? 'bg-emerald-950/20 border-emerald-700/50' : 'bg-slate-900/50 border-slate-800'}`}>
                    <input
                      type="checkbox"
                      id="home-delivery-check"
                      checked={homeDeliveryEnabled}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setHomeDeliveryEnabled(isChecked);
                        // عند إلغاء التوصيل للمنزل: مسح بيانات المندوب والرسوم تلقائياً
                        // When unchecked: clear delivery courier & fee automatically
                        if (!isChecked) {
                          setFormData({
                            ...formData,
                            deliveryCourierId: '',
                            deliveryCourierFee: 0,
                          });
                        }
                      }}
                      className="rounded bg-slate-955 border-slate-700 w-4 h-4 cursor-pointer accent-emerald-500"
                    />
                    <label htmlFor="home-delivery-check" className="text-[11px] font-bold text-slate-200 cursor-pointer flex items-center gap-2">
                      🏠 {isAr ? 'توصيل للمنزل' : 'Home Delivery'}
                    </label>
                    {homeDeliveryEnabled && (
                      <span className="ms-auto text-[10px] font-black text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-lg">
                        ✅ {isAr ? 'مفعل' : 'Active'}
                      </span>
                    )}
                  </div>

                  {/* ====== Checkbox 2: عبر مندوب شحن | Via Shipping Agent Toggle ====== */}
                  {/* عند اختياره: يتم إظهار حقل اختيار مندوب الشحن "موظف التعبئة والتجميع (سعودي)" وحقل "نسبة/رسوم مندوب الشحن" */}
                  {/* عند تركه فارغاً: يتم إخفاء الحقول وتصفير العمولة وإخفاء خصم التكاليف في قسم الدفع */}
                  <div className={`flex items-center gap-3 border p-3 rounded-2xl transition-all ${viaShippingAgent ? 'bg-amber-950/20 border-amber-700/50' : 'bg-slate-900/50 border-slate-800'}`}>
                    <input
                      type="checkbox"
                      id="via-shipping-agent-check"
                      checked={viaShippingAgent}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setViaShippingAgent(isChecked);
                        // عند إلغاء مندوب الشحن: مسح بيانات المندوب ونسبة العمولة وخصم التكاليف تلقائياً
                        // When unchecked: clear shipping courier, commission rate & deduct sourcing cost automatically
                        if (!isChecked) {
                          setFormData({
                            ...formData,
                            shippingCourierId: '',
                            shippingCourierFeeRate: 0,
                            deductSourcingCostFromCourier: false,
                          });
                        }
                      }}
                      className="rounded bg-slate-955 border-slate-700 w-4 h-4 cursor-pointer accent-[#d4af37]"
                    />
                    <label htmlFor="via-shipping-agent-check" className="text-[11px] font-bold text-slate-200 cursor-pointer flex items-center gap-2">
                      📦 {isAr ? 'عبر مندوب شحن' : 'Via Shipping Agent'}
                    </label>
                    {viaShippingAgent && (
                      <span className="ms-auto text-[10px] font-black text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded-lg">
                        ✅ {isAr ? 'مفعل' : 'Active'}
                      </span>
                    )}
                  </div>
                </div>

                {/* الحقول الشرطية بناءً على الأزرار المحددة أعلاه */}
                {/* Conditional Fields Grid based on active checkboxes */}
                {(viaShippingAgent || homeDeliveryEnabled) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-start font-bold pt-2 border-t border-slate-850">
                    {/* 1. موظف التعبئة والتجميع (سعودي) — يظهر فقط عند تفعيل "عبر مندوب شحن" */}
                    {/* Saudi Aggregator Field — shown only when viaShippingAgent is true */}
                    {viaShippingAgent && (
                      <div>
                        <label className="block text-amber-400 mb-1 font-black">
                          📦 {isAr ? 'موظف التعبئة والتجميع (سعودي)' : 'Saudi Partner Aggregator'}
                        </label>
                        <select
                          value={formData.shippingCourierId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const selectedC = couriers.find(c => c.id === selectedId);
                            const rate = (selectedC && selectedC.commissionRate !== undefined) ? parseFloat(selectedC.commissionRate) : (settings.defaultCourierCommissionRate ?? 30);
                            setFormData({
                              ...formData,
                              shippingCourierId: selectedId,
                              shippingCourierFeeRate: rate
                            });
                          }}
                          className="w-full bg-slate-955 border border-amber-700/50 text-white rounded-xl p-3 outline-none text-[11px] font-bold cursor-pointer focus:border-amber-400"
                        >
                          <option className="bg-slate-900 text-white" value="">{isAr ? '-- اختر موظف التجميع --' : '-- Choose Aggregator --'}</option>
                          {couriers.filter(c => c.courierType === 'sourcing' || !c.courierType).map(c => (
                            <option className="bg-slate-900 text-white" key={c.id} value={c.id}>
                              {c.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {/* 2. نسبة/رسوم مندوب الشحن — تظهر فقط عند تفعيل "عبر مندوب شحن" */}
                    {/* Shipping Agent Fee Rate Field — shown only when viaShippingAgent is true */}
                    {viaShippingAgent && (
                      <div>
                        <label className="block text-amber-400 mb-1 font-black">
                          💰 {isAr ? 'نسبة مندوب الشحن (%)' : 'Shipping Agent Fee Rate (%)'}
                        </label>{/* 
                          <span className="w-full bg-slate-955 border border-amber-700/50 text-amber-300 rounded-xl p-3 outline-none font-mono text-xs text-center disabled:opacity-50 focus:border-amber-400">
                            {formData.shippingCourierFeeRate}% ≈ {(Math.ceil(calcs.profitSaudiSAR) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {orderCurrency}
                          </span>*/}
                        <input
                          type="number"
                          value={formData.shippingCourierFeeRate !== undefined ? formData.shippingCourierFeeRate : settings.defaultCourierCommissionRate}
                          onChange={(e) => setFormData({ ...formData, shippingCourierFeeRate: parseFloat(e.target.value) || 0 })}
                          disabled={!canEditOrderDefaultsCreation}
                          readOnly={true}
                          className="w-full bg-slate-955 border border-amber-700/50 text-amber-300 rounded-xl p-3 outline-none font-mono text-xs text-center disabled:opacity-50 focus:border-amber-400"
                          placeholder="30"
                        />
                        <span className="font-mono text-amber-200 font-bold">
                          {isAr ? 'تعادل ' : 'equal:'} {(Math.ceil(calcs.profitSaudiSAR) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {orderCurrency}
                        </span>

                      </div>
                    )}
                    {/* 3. مندوب التوصيل اليمني — يظهر فقط عند تفعيل "توصيل للمنزل" */}
                    {/* Yemen Delivery Driver — shown only when homeDeliveryEnabled is true */}
                    {homeDeliveryEnabled && (
                      <div>
                        <label className="block text-emerald-400 mb-1 font-black">
                          🛵 {isAr ? 'مندوب التوزيع النهائي (اليمن)' : 'Yemen Delivery Driver'}
                        </label>
                        <select
                          value={formData.deliveryCourierId}
                          onChange={(e) => setFormData({ ...formData, deliveryCourierId: e.target.value })}
                          className="w-full bg-slate-955 border border-emerald-700/50 text-white rounded-xl p-3 outline-none text-[11px] font-bold cursor-pointer focus:border-emerald-400"
                        >
                          <option className="bg-slate-900 text-white" value="">{isAr ? '-- اختر مندوب التوصيل --' : '-- Choose Yemen Driver --'}</option>
                          {couriers.filter(c => c.courierType === 'local' || !c.courierType).map(c => (
                            <option className="bg-slate-900 text-white" key={c.id} value={c.id}>
                              {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {/* 4. رسوم التوصيل لليمن — تظهر فقط عند تفعيل "توصيل للمنزل" */}
                    {/* Yemen Delivery Fee — shown only when homeDeliveryEnabled is true */}
                    {homeDeliveryEnabled && (
                      <div>
                        <label className="text-emerald-400 mb-1 font-black">
                          💸 {isAr ? `رسوم التوصيل لليمن (${formData.deliveryCourierFeeCurrency || settings.currency || 'YER'})` : `Delivery Courier Fee (${formData.deliveryCourierFeeCurrency || settings.currency || 'YER'})`}
                        </label>
                        <input
                          type="number"
                          value={formData.deliveryCourierFee}
                          onChange={(e) => setFormData({ ...formData, deliveryCourierFee: parseFloat(e.target.value) || 0 })}
                          disabled={!canEditOrderDefaultsCreation}
                          className="w-full bg-slate-955 border border-emerald-700/50 text-emerald-300 rounded-xl p-3 outline-none font-mono text-xs text-center disabled:opacity-50 focus:border-emerald-400"
                        />
                        <span className="font-mono text-amber-200 font-bold">
                          {isAr ? 'تعادل ' : 'equal:'}{calcs.deliveryCourierFeeOrderCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}  {orderCurrency}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
  );
}
