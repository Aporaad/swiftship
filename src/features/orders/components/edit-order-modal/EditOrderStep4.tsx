import { ArrowRightLeft, Building, Calculator, CreditCard, FileText, Wallet } from 'lucide-react';
import { amountInWords } from '../../../../lib/numberToWords';

export default function EditOrderStep4(props: any) {
  const { isAr, formData, settings, setFormData, orderCurrency, paymentCurrency, productsSum, shippingsCostSum, itemsPackagingSum, shippingsCategorySum, totalOrderSAR, totalOrderYER, currencyTotals, activeCurrencies, getCurrencyRate, cashAccountsList, bankAccountsList, setIsCalcOpen, remainingYER } = props;

  return (
            <div className="space-y-5 animate-fade-in">
              {/* Top inputs row: fees */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/40 border border-slate-800 p-4 rounded-2xl text-xs font-bold">
                <div>
                  <label className="block text-slate-500 mb-1">{isAr ? `رسوم التغليف العامة (${orderCurrency})` : `Packaging Fee (${orderCurrency})`}</label>
                  <input
                    type="number"
                    value={formData.packagingFee || ''}
                    onChange={(e) => setFormData({ ...formData, packagingFee: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-955 border border-slate-800 text-white font-mono rounded-xl p-2.5 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">{isAr ? `أجرة التوصيل (${formData.deliveryCourierFeeCurrency || settings?.currency || 'YER'})` : `Delivery Fee (${formData.deliveryCourierFeeCurrency || settings?.currency || 'YER'})`}</label>
                  <input
                    type="number"
                    value={formData.deliveryCourierFee || ''}
                    onChange={(e) => setFormData({ ...formData, deliveryCourierFee: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-955 border border-slate-800 text-white font-mono rounded-xl p-2.5 outline-none"
                  />
                  <p className="mt-1 text-[10px] font-mono text-amber-300/80">≈ {currencyTotals.deliveryFeeOrderCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })} {orderCurrency}</p>
                </div>

                {formData.orderSourceType === 'SHEIN' && (
                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? `سعر شي إن الأحمر (${orderCurrency})` : `SHEIN Red Price (${orderCurrency})`}</label>
                    <input
                      type="number"
                      value={formData.sheinRedPrice || ''}
                      onChange={(e) => setFormData({ ...formData, sheinRedPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-955 border border-slate-800 text-white font-mono rounded-xl p-2.5 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              {/* ── Two-Column: Financial Breakdown (left) vs Payment (right) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* ═══ LEFT: Financial Breakdown ═══ */}
                <div className="p-4 bg-slate-955 rounded-2xl border border-slate-800 shadow-xl space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800">
                    <Calculator className="w-4 h-4 text-[#d4af37]" />
                    <span className="text-[11px] text-slate-300 font-extrabold uppercase tracking-widest">
                      {isAr ? 'الكشف المالي التفصيلي' : 'Financial Breakdown'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">{isAr ? '🛍 قيمة المنتجات:' : '🛍 Products Value:'}</span>
                    <span className="font-mono text-white font-bold">{(productsSum || 0).toLocaleString()} {orderCurrency}</span>
                  </div>

                  {shippingsCostSum > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🚚 تكاليف الشحن:' : '🚚 Shipping Cost:'}</span>
                      <span className="font-mono text-blue-300 font-bold">{shippingsCostSum.toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {itemsPackagingSum > 0 && (
                    <div className="flex justify-between items-center text-amber-300">
                      <span className="font-bold">{isAr ? '📦 رسوم تغليف المنتجات المخصصة:' : '📦 Packaging Options Fee:'}</span>
                      <span className="font-mono font-bold">+{itemsPackagingSum.toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {shippingsCategorySum > 0 && (
                    <div className="flex justify-between items-center text-cyan-300">
                      <span className="font-bold">{isAr ? '⚡️ رسوم فئات الشحن السريع:' : '⚡️ Shipping Category Speed Fees:'}</span>
                      <span className="font-mono font-bold">+{shippingsCategorySum.toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {(formData.packagingFee || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '📦 رسوم تغليف وشحن محلي:' : '📦 Local Freight & Wrapping:'}</span>
                      <span className="font-mono text-purple-200 font-bold">{(formData.packagingFee || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {(formData.deliveryCourierFee || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🛵 أجرة توصيل المندوب:' : '🛵 Delivery Fee:'}</span>
                      <span className="font-mono text-amber-200 font-bold">
                        {(formData.deliveryCourierFee || 0).toLocaleString()} {formData.deliveryCourierFeeCurrency || settings?.currency || 'YER'}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-800 pt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-300 text-xs">{isAr ? '📊 الإجمالي بعملة الطلب:' : '📊 Total in Order Currency:'}</span>
                      <span className="font-black font-mono text-slate-200 text-sm bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                        {Math.ceil(totalOrderSAR).toLocaleString()} {orderCurrency}
                      </span>
                    </div>

                    <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-3.5 py-2.5">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-emerald-300 text-xs">{isAr ? `💰 الإجمالي بعملة الدفع (${paymentCurrency}):` : `💰 Total in ${paymentCurrency}:`}</span>
                        <span className="font-black font-mono text-emerald-300 text-base">
                          {Math.ceil(totalOrderYER).toLocaleString()} {paymentCurrency}
                        </span>
                      </div>
                      {totalOrderYER > 0 && (
                        <p className="text-[10px] text-emerald-400/80 font-bold mt-1 italic">
                          {amountInWords(totalOrderYER, paymentCurrency, isAr ? 'ar' : 'en')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══ RIGHT: Payment Details (مطابق لنموذج سند القبض) ═══ */}
                <div className="p-4 bg-slate-955 rounded-2xl border border-[#d4af37]/20 shadow-xl space-y-3.5 text-xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#d4af37]" />
                      <span className="text-[11px] text-slate-300 font-extrabold uppercase tracking-widest">
                        {isAr ? 'وسائل وحسابات التحصيل' : 'Payment Methods & Receipt Accounts'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsCalcOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 hover:bg-[#d4af37]/25 px-2.5 py-1 text-xs font-bold text-[#f4d870] transition active:scale-95 cursor-pointer"
                      title={isAr ? 'فتح الآلة الحاسبة والمصارفة' : 'Calculator & Currency Exchange'}
                    >
                      <Calculator className="h-4 w-4 text-[#f4d870]" />
                      <span>{isAr ? 'حاسبة ومصارفة' : 'Calc & Rates'}</span>
                    </button>
                  </div>

                  {/* Payment Type Buttons */}
                  <div className="space-y-1.5">
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
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border font-bold text-[10px] transition-all cursor-pointer ${isSelected
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

                  {/* Currency Picker & Rate */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
                      <span className="text-[9px] font-black uppercase text-[#d4af37] block mb-1">{isAr ? 'عملة الدفع' : 'Payment Currency'}</span>
                      <select
                        value={paymentCurrency}
                        onChange={(e) => {
                          const newCurrency = e.target.value;
                          const rateOrder = getCurrencyRate(orderCurrency);
                          const ratePayment = getCurrencyRate(newCurrency);
                          setFormData({ ...formData, currency: newCurrency, exchangeRate: rateOrder / ratePayment });
                        }}
                        className="w-full bg-slate-955 text-white font-bold text-xs p-1.5 rounded-lg border border-slate-800 outline-none cursor-pointer"
                      >
                        {activeCurrencies.map((c: any) => (
                          <option className="bg-slate-900 text-white" key={c.code} value={c.code}>
                            {isAr ? (c.main_nameAR || c.sup_nameAR || c.code) : (c.main_nameEn || c.sup_nameEn || c.code)} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                        {isAr ? `سعر الصرف (${orderCurrency}/${paymentCurrency})` : `Rate (${orderCurrency}/${paymentCurrency})`}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={(getCurrencyRate(orderCurrency) / getCurrencyRate(paymentCurrency)).toFixed(4)}
                        readOnly
                        className="w-full bg-slate-955 border border-slate-800 text-white font-mono font-bold text-xs p-1.5 rounded-lg text-center outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Cash Box Account Selector */}
                  {((formData.paymentMethod || 'Cash') === 'Cash' || (formData.paymentMethod || 'Cash') === 'Mixed') && (
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                      <label className="text-[10px] font-black text-amber-400 flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{isAr ? 'حساب الصندوق القابض (الصناديق)' : 'Cash Box Receiving Account'}</span>
                      </label>
                      <select
                        value={formData.cashAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, cashAccountId: e.target.value })}
                        className="w-full bg-slate-955 text-white font-bold text-xs p-2 rounded-lg border border-slate-800 outline-none cursor-pointer focus:border-[#d4af37]"
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

                  {/* Bank Account Selector & Reference */}
                  {((formData.paymentMethod || 'Cash') === 'Bank' || (formData.paymentMethod || 'Cash') === 'Mixed') && (
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl space-y-2">
                      <label className="text-[10px] font-black text-cyan-400 flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        <span>{isAr ? 'حساب البنك القابض (البنوك)' : 'Bank Receiving Account'}</span>
                      </label>
                      <select
                        value={formData.bankAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                        className="w-full bg-slate-955 text-white font-bold text-xs p-2 rounded-lg border border-slate-800 outline-none cursor-pointer focus:border-cyan-400"
                      >
                        <option value="">{isAr ? '-- اختر حساب البنك --' : '-- Select Bank Account --'}</option>
                        {bankAccountsList.map((acc: any) => (
                          <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                            {acc.name || acc.accNameAr || acc.id} ({acc.id})
                          </option>
                        ))}
                      </select>

                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-1">
                          {isAr ? 'رقم المرجع / الحوالة البنكية' : 'Bank Reference #'}
                        </label>
                        <input
                          type="text"
                          value={formData.bankReference || ''}
                          onChange={(e) => setFormData({ ...formData, bankReference: e.target.value })}
                          placeholder={isAr ? 'رقم الإشعار أو الحوالة...' : 'Transfer Ref / Voucher #'}
                          className="w-full bg-slate-955 border border-slate-800 text-white font-mono font-bold text-xs p-2 rounded-lg outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Deferred Notice */}
                  {(formData.paymentMethod || 'Cash') === 'Deferred' && (
                    <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-[10px] text-amber-300 font-bold leading-relaxed">
                      {isAr
                        ? '📌 الدفع الآجل: سيتم ترحيل كامل قيمة الفاتورة كمديونية على حساب العميل دون تحصيل مبالغ نقدية حالاً.'
                        : '📌 On Credit: Full invoice value will be registered as outstanding debt on customer balance.'}
                    </div>
                  )}

                  {/* Mixed Payment Split Amounts */}
                  {(formData.paymentMethod || 'Cash') === 'Mixed' && (
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
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
                              amountPaid: val + bVal,
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
                              amountPaid: cVal + val,
                            });
                          }}
                          placeholder="0.00"
                          className="w-full bg-slate-955 border border-slate-800 text-cyan-300 font-mono font-bold text-xs p-2 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Cash / Advance Payment Amount Input with Presets */}
                  {(formData.paymentMethod || 'Cash') !== 'Deferred' && (formData.paymentMethod || 'Cash') !== 'Mixed' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-bold flex justify-between items-center">
                        <span className="text-[#d4af37]">{isAr ? `الدفعة المقدمة / المحصلة (${paymentCurrency})` : `Amount Paid (${paymentCurrency})`}</span>
                        <div className="flex gap-1.5 text-[9px]">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, amountPaid: 0 })}
                            className="bg-slate-900 text-slate-400 hover:text-white px-1.5 py-0.5 rounded font-bold cursor-pointer"
                          >
                            0%
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, amountPaid: Math.ceil(totalOrderYER / 2) })}
                            className="bg-slate-900 text-slate-400 hover:text-white px-1.5 py-0.5 rounded font-bold cursor-pointer"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, amountPaid: Math.ceil(totalOrderYER) })}
                            className="bg-slate-900 text-slate-400 hover:text-white px-1.5 py-0.5 rounded font-bold cursor-pointer"
                          >
                            100%
                          </button>
                        </div>
                      </label>
                      <input
                        type="number"
                        value={formData.amountPaid ?? ''}
                        onChange={(e) => setFormData({ ...formData, amountPaid: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-955 border border-slate-800 text-emerald-400 font-mono font-black text-sm p-2.5 rounded-xl outline-none focus:border-emerald-500"
                        placeholder="0.00"
                      />
                    </div>
                  )}

                  {/* Remaining Balance Summary */}
                  <div className="flex justify-between items-center bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-bold text-[11px]">{isAr ? 'المتبقي ذمة:' : 'Remaining Balance:'}</span>
                    <span className={`font-mono font-black text-sm ${remainingYER > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {Math.ceil(remainingYER).toLocaleString()} {paymentCurrency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
  );
}
