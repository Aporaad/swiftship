import React from 'react';
import { CurrencySelect } from '../../../../components/common/CurrencySelect';
import { X, Search, UserPlus, CreditCard, DollarSign, AlertCircle, Package, Trash2, Calendar, Calculator, ChevronRight, ChevronLeft, User, ShoppingCart, Truck, CheckCircle2, ShieldCheck, FileText, Wallet, Building, ArrowRightLeft, Boxes } from 'lucide-react';
import { amountInWords, paidAmountInWords, currencyNameAr, currencyNameEn, numberToWordsAr, numberToWordsEn } from '../../../../lib/numberToWords';

export default function CreateOrderStep4(props: any) {
  const {
    isAr, formData, setFormData, orderCurrency, payLater, setPayLater,
    canEditOrderDefaultsCreation, profitPerKgRate, setProfitPerKgRate,
    cbmShippingRateValue, setCbmShippingRateValue, viaShippingAgent,
    packagingFeeEnabled, packagingFeeRate, items, shippings, bankCommissionEnabled,
    bankCommissionRate, bankCommissionType, couponEnabled, couponRate, calcs, couriers,
    cashAccountsList, bankAccountsList, activeCurrencies, getCurrencyRate,
  } = props;
  return (
            <div className="space-y-5 animate-fade-in">

              {/* ====== Checkbox: الدفع لاحقاً | Pay Later Toggle ====== */}
              {/* عند التفعيل: تُخفى حقول الدفع ويُحفظ الطلب دون دفع بحالة الطلب الأولى */}
              {/* When enabled: payment fields are hidden, order saved with status #1 as Unpaid */}
              <div className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${payLater ? 'bg-amber-950/20 border-amber-700/50' : 'bg-slate-900/50 border-slate-800'}`}>
                <input
                  type="checkbox"
                  id="pay-later-check"
                  checked={payLater}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setPayLater(isChecked);
                    // عند تفعيل الدفع لاحقاً: يتم تصفير المبلغ المدفوع تلقائياً
                    // When pay later is enabled: reset amountPaid to 0 automatically
                    if (isChecked) {
                      setFormData({ ...formData, amountPaid: 0, paymentMethod: 'Deferred' });
                    }
                  }}
                  className="rounded bg-slate-955 border-slate-700 w-4 h-4 cursor-pointer accent-amber-500"
                />
                <label htmlFor="pay-later-check" className="flex-1 text-[11px] font-bold text-slate-200 cursor-pointer">
                  ⏳ {isAr
                    ? 'الدفع لاحقاً — تخطي قسم الدفع وحفظ الطلب كمعلق بدون دفع'
                    : 'Pay Later — Skip payment, save order as pending without payment'} {formData.order_status_id || '0'}
                </label>
                {payLater && (
                  <span className="text-[10px] font-black text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                    ⏳ {isAr ? 'لم يتم الدفع' : 'Payment Deferred'}
                  </span>
                )}
              </div>

              {/* Top inputs row: order-specific rates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 border border-slate-800 p-5 rounded-3xl text-[11px] font-bold text-slate-400 text-start">
                {formData.orderSourceType === 'SHEIN' && (
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">
                      {isAr ? 'سعر شي إن الأحمر (' + orderCurrency + ')' : 'SHEIN Red Price (' + orderCurrency + ')'}
                    </label>
                    <input
                      type="number"
                      value={formData.sheinRedPrice || ''}
                      onChange={(e) => setFormData({ ...formData, sheinRedPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-955 border border-slate-805 text-white rounded-xl p-3 outline-none font-mono text-xs"
                      placeholder="0.00"
                    />
                  </div>
                )}
                {formData.orderSourceType === 'Factory' && (
                  <>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">
                        {isAr ? 'نسبة الربح للكيلو (' + orderCurrency + '/كجم)' : 'Profit Rate per KG (' + orderCurrency + '/kg)'}
                      </label>
                      <input type="number" step="any" value={profitPerKgRate}
                        onChange={(e) => setProfitPerKgRate(parseFloat(e.target.value) || 0)}
                        disabled={!canEditOrderDefaultsCreation}
                        className="w-full bg-slate-955 border border-slate-805 text-white rounded-xl p-3 outline-none font-mono text-xs disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5 font-bold">
                        {isAr ? 'سعر شحن الـ CBM (دولار USD/m³)' : 'CBM Shipping Rate (USD/m³)'}
                      </label>
                      <input type="number" step="any" value={cbmShippingRateValue}
                        onChange={(e) => setCbmShippingRateValue(parseFloat(e.target.value) || 0)}
                        disabled={!canEditOrderDefaultsCreation}
                        className="w-full bg-slate-955 border border-slate-805 text-white rounded-xl p-3 outline-none font-mono text-xs disabled:opacity-50" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">
                    {isAr ? 'رسوم تغليف وشحن محلي (' + orderCurrency + ')' : 'KSA Wrapping Fee & Local Freight (' + orderCurrency + ')'}
                  </label>
                  <input type="number" value={formData.packagingFee || ''}
                    onChange={(e) => setFormData({ ...formData, packagingFee: parseFloat(e.target.value) || 0 })}
                    disabled={!canEditOrderDefaultsCreation}
                    className="w-full bg-slate-955 border border-slate-805 text-white rounded-xl p-3 outline-none font-mono text-xs disabled:opacity-50"
                    placeholder="0.00" />
                </div>
                {/* خصم تكاليف شراء المنتجات من حساب مندوب التجميع — يظهر فقط عند تفعيل "عبر مندوب شحن" */}
                {/* Deduct products cost from courier account field — shown only when viaShippingAgent is true */}
                {viaShippingAgent && (
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2.5 cursor-pointer bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 hover:bg-slate-900 transition">
                      <input type="checkbox" checked={formData.deductSourcingCostFromCourier || false}
                        onChange={(e) => setFormData({ ...formData, deductSourcingCostFromCourier: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-955 text-[#d4af37] focus:ring-0 cursor-pointer accent-[#d4af37]" />
                      <span className="text-[11px] font-bold text-slate-300">
                        {isAr ? 'خصم تكاليف شراء المنتجات من حساب مندوب التجميع حالاً' : 'Deduct Original Products Cost from Courier Account'}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* ── Two-Column: Financial Breakdown (left) vs Payment (right) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* ═══ LEFT: Full Financial Breakdown ═══ */}
                <div className="p-5 bg-slate-955 rounded-2xl border border-slate-800 shadow-xl space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
                    <Calculator className="w-4 h-4 text-[#d4af37]" />
                    <span className="text-[11px] text-slate-300 font-extrabold uppercase tracking-widest">
                      {isAr ? 'الكشف المالي التفصيلي' : 'Financial Breakdown'}
                    </span>
                  </div>

                  {/* Products */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">{isAr ? '🛍 قيمة المنتجات:' : '🛍 Products Value:'}</span>
                    <span className="font-mono text-white font-bold">{(calcs.productsSum || 0).toLocaleString()} {orderCurrency}</span>
                  </div>

                  {/* Shipping cost — only if shippings exist AND cost > 0 */}
                  {shippings && shippings.length > 0 && shippings.reduce((s: number, sh: any) => s + (parseFloat(sh.shippingCost) || 0), 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🚚 تكاليف الشحن:' : '🚚 Shipping Cost:'}</span>
                      <span className="font-mono text-blue-300 font-bold">
                        {shippings.reduce((s: number, sh: any) => s + (parseFloat(sh.shippingCost) || 0), 0).toLocaleString()} {orderCurrency}
                      </span>
                    </div>
                  )}

                  {/* Packaging fee — carrier packaging (packagingFeeEnabled) */}
                  {packagingFeeEnabled && packagingFeeRate > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '📦 رسوم تغليف شركة الشحن:' : '📦 Carrier Packaging Fee:'}</span>
                      <span className="font-mono text-purple-300 font-bold">{packagingFeeRate.toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {/* Packaging options fees from order_option */}
                  {items && items.reduce((sum: number, it: any) => sum + ((parseFloat(it.packagingOptionPrice) || 0) * (parseFloat(it.quantity) || 1)), 0) > 0 && (
                    <div className="flex justify-between items-center text-amber-300">
                      <span className="font-bold">{isAr ? '📦 رسوم تغليف المنتجات المخصصة:' : '📦 Products Packaging Options Fee:'}</span>
                      <span className="font-mono font-bold">
                        +{items.reduce((sum: number, it: any) => sum + ((parseFloat(it.packagingOptionPrice) || 0) * (parseFloat(it.quantity) || 1)), 0).toLocaleString()} {orderCurrency}
                      </span>
                    </div>
                  )}

                  {/* Product Insurance Fee */}
                  {items && items.reduce((sum: number, it: any) => sum + (it.isInsured ? (parseFloat(it.insuranceFee) || 0) : 0), 0) > 0 && (
                    <div className="flex justify-between items-center text-amber-400">
                      <span className="font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {isAr ? '🛡️ رسوم تأمين المنتجات:' : '🛡️ Products Insurance Fee:'}
                      </span>
                      <span className="font-mono font-bold">
                        +{items.reduce((sum: number, it: any) => sum + (it.isInsured ? (parseFloat(it.insuranceFee) || 0) : 0), 0).toLocaleString()} {orderCurrency}
                      </span>
                    </div>
                  )}

                  {/* Shipping category speed fees from order_option */}
                  {shippings && shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCategoryPrice) || 0), 0) > 0 && (
                    <div className="flex justify-between items-center text-cyan-300">
                      <span className="font-bold">{isAr ? '⚡️ رسوم فئات الشحن السريع:' : '⚡️ Shipping Category Speed Fees:'}</span>
                      <span className="font-mono font-bold">
                        +{shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCategoryPrice) || 0), 0).toLocaleString()} {orderCurrency}
                      </span>
                    </div>
                  )}

                  {/* Packaging fee — general local wrapping (formData.packagingFee) */}
                  {(formData.packagingFee || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '📦 رسوم تغليف وشحن محلي:' : '📦 KSA Wrapping & Local Freight:'}</span>
                      <span className="font-mono text-purple-200 font-bold">{(formData.packagingFee || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {/* Bank commission */}
                  {bankCommissionEnabled && bankCommissionRate > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🏦 عمولة البنك:' : '🏦 Bank Commission:'}</span>
                      <span className="font-mono text-orange-300 font-bold">
                        {bankCommissionType === 'percentage'
                          ? `${bankCommissionRate}% ≈ ${Math.ceil((calcs.productsSum || 0) * bankCommissionRate / 100).toLocaleString()} ${orderCurrency}`
                          : `${bankCommissionRate.toLocaleString()} ${orderCurrency}`
                        }
                      </span>
                    </div>
                  )}

                  {/* Coupon discount */}
                  {couponEnabled && couponRate > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🎟 خصم الكوبون:' : '🎟 Coupon Discount:'}</span>
                      <span className="font-mono text-emerald-300 font-bold">-{couponRate.toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {/* Other fees (previously "Company Margin") */}
                  {(calcs?.profitCompanySAR || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '📌 رسوم أخرى:' : '📌 Other Fees:'}</span>
                      <span className="font-mono text-cyan-300 font-bold">{Math.ceil(calcs.profitCompanySAR || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {/* Courier commission — rate + value */}
                  {(() => {
                    const courier = couriers.find(c => c.id === formData.shippingCourierId);
                    const commRate = courier?.commissionRate || 0;
                    const commValue = commRate > 0 ? Math.ceil(calcs.profitSaudiSAR) : 0;
                    return commRate > 0 ? (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">{isAr ? '👤 عمولة مندوب الشحن:' : '👤 Shipping Agent Commission:'}</span>
                        <span className="font-mono text-yellow-300 font-bold">
                          {commRate}% ≈ {commValue.toLocaleString()} {orderCurrency}
                        </span>
                      </div>
                    ) : null;
                  })()}

                  {/* Delivery fee */}
                  {(formData.deliveryCourierFee || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🛵 أجرة توصيل المندوب:' : '🛵 Delivery Agent Fee:'}</span>
                      <span className="font-mono text-amber-200 font-bold">
                        {(formData.deliveryCourierFee || 0).toLocaleString()} {calcs.deliveryCourierFeeCurrency}  {isAr ? 'تعادل ' : 'equal:'}{calcs.deliveryCourierFeeOrderCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}  {orderCurrency}
                      </span>
                    </div>
                  )}

                  {/* Divider — Net total in order currency */}
                  <div className="border-t border-slate-700 pt-2.5 mt-1 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-300 text-xs">{isAr ? '📊 الإجمالي بعملة الطلب:' : '📊 Total in Order Currency:'}</span>
                      <span className="font-black font-mono text-slate-200 text-sm bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700">
                        {Math.ceil(calcs.totalOrderSAR).toLocaleString()} {orderCurrency}
                      </span>
                    </div>

                    {/* Total in payment currency — with word form */}
                    <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-3">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-emerald-300 text-xs">{isAr ? `💰 الإجمالي بعملة الدفع (${formData.currency}):` : `💰 Total in ${formData.currency}:`}</span>
                        <span className="font-black font-mono text-emerald-300 text-base">
                          {Math.ceil(calcs.totalOrderYER).toLocaleString()} {formData.currency}
                        </span>
                      </div>
                      {calcs.totalOrderYER > 0 && (
                        <p className="text-[10px] text-emerald-400/80 font-bold mt-1.5 italic">
                          {amountInWords(calcs.totalOrderYER, formData.currency, isAr ? 'ar' : 'en')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══ RIGHT: Payment Section (مطابق لسند القبض) ═══ */}
                {/* إذا كان الدفع لاحقاً مفعلاً: يُعرض فقط ملخص "لم يتم الدفع" بدلاً من حقول الدفع */}
                {/* If payLater is active: show only Deferred summary instead of payment fields */}
                {payLater ? (
                  <div className="p-5 bg-amber-950/20 rounded-2xl border border-amber-700/40 shadow-xl text-xs flex flex-col items-center justify-center gap-4 min-h-[200px]">
                    <div className="text-4xl">⏳</div>
                    <div className="text-center">
                      <h4 className="text-sm font-black text-amber-300 mb-1">
                        {isAr ? 'الدفع لاحقاً — مؤجل' : 'Payment Deferred'}{formData.order_status_id}
                      </h4>
                      <p className="text-[11px] text-amber-400/80 font-bold leading-relaxed">
                        {isAr
                          ? 'سيتم حفظ الطلب بحالة المرحلة الأولى وحالة الدفع "لم يتم الدفع". يمكن إتمام الدفع لاحقاً من نافذة سداد الطلب.'
                          : 'Order will be saved at status stage 1 with payment status "Unpaid". Payment can be completed later from the order payment window.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-900/40 rounded-xl px-4 py-2">
                      <span className="text-[11px] font-black text-amber-300">
                        {isAr ? 'الإجمالي المطلوب:' : 'Total Due:'}
                      </span>
                      <span className="font-mono font-black text-amber-200 text-sm">
                        {Math.ceil(calcs.totalOrderYER).toLocaleString()} {formData.currency}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-slate-955 rounded-2xl border border-[#d4af37]/20 shadow-xl space-y-4 text-xs">
                    {/* Header with Calculator & Exchange Button */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#d4af37]" />
                        <span className="text-[11px] text-slate-300 font-extrabold uppercase tracking-widest">
                          {isAr ? 'تفاصيل وسائل وحسابات التحصيل' : 'Payment Methods & Receipt Accounts'}
                        </span>
                      </div>


                    </div>

                    {/* Payment Type Selection (نقد / بنك / آجل / متعدد) */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 block">
                        {isAr ? 'نوع وسيلة الدفع' : 'Payment Type'}
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'Cash', labelAr: 'نقد (صندوق)', labelEn: 'Cash Box', icon: Wallet },
                          { id: 'Bank', labelAr: 'بنك (تحويل)', labelEn: 'Bank Transfer', icon: Building },
                          { id: 'Deferred', labelAr: 'آجل (من حساب اخر)', labelEn: 'On Credit', icon: FileText },//مهم : يتم تطوير حاله من حساب اخر بحيث يمكن اختيار حساب مالي اخر غير حساب العميل ليتم تقييد الفاتوره من هذا الحساب 
                          { id: 'Mixed', labelAr: 'متعدد (مختلط)', labelEn: 'Multi / Split', icon: ArrowRightLeft },
                        ].map((type) => {
                          const Icon = type.icon;
                          const isSelected = (formData.paymentMethod || 'Cash') === type.id;
                          return (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => {
                                const newMethod = type.id;
                                const updates: any = { paymentMethod: newMethod };
                                if (newMethod === 'Cash' && !formData.cashAccountId && cashAccountsList[0]) {
                                  updates.cashAccountId = cashAccountsList[0].id;
                                }
                                if (newMethod === 'Bank' && !formData.bankAccountId && bankAccountsList[0]) {
                                  updates.bankAccountId = bankAccountsList[0].id;
                                }
                                if (newMethod === 'Mixed') {
                                  if (!formData.cashAccountId && cashAccountsList[0]) updates.cashAccountId = cashAccountsList[0].id;
                                  if (!formData.bankAccountId && bankAccountsList[0]) updates.bankAccountId = bankAccountsList[0].id;
                                }
                                if (newMethod === 'Deferred') {
                                  updates.amountPaid = 0;
                                }
                                setFormData({ ...formData, ...updates });
                              }}
                              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border font-bold text-[10px] transition-all cursor-pointer ${isSelected
                                ? 'bg-[#d4af37]/15 border-[#d4af37] text-[#d4af37] shadow-md ring-1 ring-[#d4af37]/30'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                                }`}
                            >
                              <Icon className="w-4 h-4 mb-1" />
                              <span>{isAr ? type.labelAr : type.labelEn}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Currency & Exchange Rate */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                        <span className="text-[9px] font-black uppercase text-[#d4af37] block mb-1">{isAr ? 'عملة الدفع' : 'Payment Currency'}</span>
                        <CurrencySelect
                        isAr={isAr}
                        currencies={activeCurrencies.map(c => ({ id: c.code, code: c.code, nameAr: c.main_nameAR || c.sup_nameAR, nameEn: c.main_nameEn || c.sup_nameEn }))}
                        value={formData.currency}
                        onChange={newCurrency => {
                          const rateOrder = getCurrencyRate(orderCurrency);
                          const ratePayment = getCurrencyRate(newCurrency);
                          setFormData({ ...formData, currency: newCurrency, exchangeRate: rateOrder / ratePayment });
                        }}
                        className="w-full bg-slate-955 text-white font-bold text-xs p-2 rounded-lg border border-slate-800 outline-none cursor-pointer"
                      />
                      </div>
                      <div className="bg-slate-900 border border-slate-600 p-2.5 rounded-xl">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                          {isAr ? `سعر الصرف (${orderCurrency}/${formData.currency})` : `Rate (${orderCurrency}/${formData.currency})`}
                        </span>
                        <input type="number" step="any"
                          value={getCurrencyRate(orderCurrency) / getCurrencyRate(formData.currency || 'YER')}
                          readOnly
                          className="w-full bg-slate-955 border border-slate-800 text-white font-mono font-bold text-xs p-2 rounded-lg text-center outline-none disabled:opacity-50" />
                      </div>
                    </div>

                    {/* Receiving Accounts Dropdowns based on Payment Method */}
                    {((formData.paymentMethod || 'Cash') === 'Cash' || (formData.paymentMethod || 'Cash') === 'Mixed') && (
                      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-2">
                        <label className="text-[10px] font-black text-amber-400 flex items-center gap-1">
                          <Wallet className="w-3.5 h-3.5" />
                          <span>{isAr ? 'حساب الصندوق القابض (الصناديق)' : 'Cash Box Receiving Account'}</span>
                        </label>
                        <select
                          value={formData.cashAccountId || ''}
                          onChange={(e) => setFormData({ ...formData, cashAccountId: e.target.value })}
                          className="w-full bg-slate-955 text-white font-bold text-xs p-2.5 rounded-lg border border-slate-800 outline-none cursor-pointer focus:border-[#d4af37]"
                        >
                          <option value="">{isAr ? '-- اختر حساب الصندوق --' : '-- Select Cash Account --'}</option>
                          {cashAccountsList.map((acc: any) => (
                            <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                              {acc.name || acc.accNameAr || acc.id} ({acc.id})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {((formData.paymentMethod || 'Cash') === 'Bank' || (formData.paymentMethod || 'Cash') === 'Mixed') && (
                      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-2.5">
                        <label className="text-[10px] font-black text-cyan-400 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5" />
                          <span>{isAr ? 'حساب البنك القابض (البنوك)' : 'Bank Receiving Account'}</span>
                        </label>
                        <select
                          value={formData.bankAccountId || ''}
                          onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                          className="w-full bg-slate-955 text-white font-bold text-xs p-2.5 rounded-lg border border-slate-800 outline-none cursor-pointer focus:border-cyan-400"
                        >
                          <option value="">{isAr ? '-- اختر حساب البنك --' : '-- Select Bank Account --'}</option>
                          {bankAccountsList.map((acc: any) => (
                            <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                              {acc.name || acc.accNameAr || acc.id} ({acc.id})
                            </option>
                          ))}
                        </select>

                        {/* Bank Reference Input */}
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 block mb-1">
                            {isAr ? 'رقم المرجع / الحوالة البنكية' : 'Bank Transfer Reference #'}
                          </label>
                          <input
                            type="text"
                            value={formData.bankReference || ''}
                            onChange={(e) => setFormData({ ...formData, bankReference: e.target.value })}
                            placeholder={isAr ? "رقم الإشعار أو الحوالة..." : "Transfer Ref / Voucher #"}
                            className="w-full bg-slate-955 border border-slate-800 text-white font-mono font-bold text-xs p-2 rounded-lg outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>
                    )}

                    {(formData.paymentMethod || 'Cash') === 'Deferred' && (
                      <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-[10px] text-amber-300 font-bold leading-relaxed">
                        {isAr
                          ? '📌 الدفع الآجل: سيتم ترحيل كامل قيمة الفاتورة كمديونية على حساب العميل دون تحصيل مبالغ نقدية حالاً.'
                          : '📌 On Credit: Full invoice value will be registered as outstanding debt on customer balance.'}
                      </div>
                    )}

                    {/* Multi / Mixed Payment Split Amounts */}
                    {(formData.paymentMethod || 'Cash') === 'Mixed' && (
                      <div className="grid grid-cols-2 gap-2 bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                        <div>
                          <label className="text-[9px] font-bold text-amber-400 block mb-1">
                            {isAr ? 'مبلغ الصندوق' : 'Cash Split Amount'}
                          </label>
                          <input
                            type="number"
                            value={formData.cashAmount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const bVal = parseFloat(formData.bankAmount || '0') || 0;
                              setFormData({
                                ...formData,
                                cashAmount: val,
                                amountPaid: val + bVal
                              });
                            }}
                            placeholder="0.00"
                            className="w-full bg-slate-955 border border-slate-800 text-amber-300 font-mono font-bold text-xs p-2 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-cyan-400 block mb-1">
                            {isAr ? 'مبلغ البنك' : 'Bank Split Amount'}
                          </label>
                          <input
                            type="number"
                            value={formData.bankAmount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const cVal = parseFloat(formData.cashAmount || '0') || 0;
                              setFormData({
                                ...formData,
                                bankAmount: val,
                                amountPaid: cVal + val
                              });
                            }}
                            placeholder="0.00"
                            className="w-full bg-slate-955 border border-slate-800 text-cyan-300 font-mono font-bold text-xs p-2 rounded-lg outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Total in order currency — info only */}
                    <div className="flex justify-between items-center bg-slate-900/60 px-3 py-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-black text-[11px]">{isAr ? `المبلغ المطلوب بعملة الطلب (${orderCurrency}):` : `Amount Due in ${orderCurrency}:`}</span>
                      <span className="font-mono font-black text-amber-400 text-sm">{Math.ceil(calcs.totalOrderSAR).toLocaleString()} {orderCurrency}</span>
                    </div>

                    {/* Cash / Advance Payment */}
                    {(formData.paymentMethod || 'Cash') !== 'Deferred' && (formData.paymentMethod || 'Cash') !== 'Mixed' && (
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-bold flex justify-between items-center">
                          <span className="text-[#d4af37]">{isAr ? 'الدفعة المقدمة / المحصلة (' + formData.currency + ')' : 'Cash / Advance Payment (' + formData.currency + ')'}</span>
                          <div className="flex gap-1.5 text-[9px]">
                            <button type="button" onClick={() => setFormData({ ...formData, amountPaid: 0 })}
                              className="px-2.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer">0</button>
                            <button type="button" onClick={() => setFormData({ ...formData, amountPaid: Math.ceil(calcs.totalOrderYER) })}
                              className="px-2.5 py-0.5 rounded border border-emerald-800/40 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 transition cursor-pointer">
                              {isAr ? 'سداد الكل' : 'Pay All'}
                            </button>
                          </div>
                        </label>
                        <input
                          type="number"
                          value={formData.amountPaid || ''}
                          onChange={(e) => setFormData({ ...formData, amountPaid: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-955 border border-slate-700 focus:border-emerald-500/50 text-emerald-400 font-black rounded-xl py-3 px-4 outline-none font-mono text-sm"
                          placeholder={'0.00 ' + formData.currency}
                        />
                        {/* Written word-form for paid amount */}
                        {(formData.amountPaid || 0) > 0 && (
                          <p className="text-[10px] text-blue-400/80 font-bold bg-blue-950/20 border border-blue-900/30 rounded-lg px-3 py-1.5 italic">
                            {isAr
                              ? `✍️ المبلغ المدفوع: ${numberToWordsAr(Math.ceil(formData.amountPaid))} ${currencyNameAr(formData.currency)}`
                              : `✍️ Paid: ${numberToWordsEn(Math.ceil(formData.amountPaid))} ${currencyNameEn(formData.currency)}`
                            }
                          </p>
                        )}
                      </div>
                    )}

                    {/* Outstanding Debt */}
                    <div className="flex justify-between items-center p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                      <span className="font-extrabold text-[#d4af37] text-[11px]">{isAr ? 'المديونية المتبقية للدفع:' : 'Outstanding Debt:'}</span>
                      <span className="font-mono text-sm font-black text-rose-400">{Math.ceil(calcs.remainingYER).toLocaleString()} {formData.currency}</span>
                    </div>
                  </div>
                )}



              </div>
            </div>
  );
}
