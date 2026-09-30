import React from 'react';
import { X, Search, UserPlus, CreditCard, DollarSign, AlertCircle, Package, Trash2, Calendar, Calculator, ChevronRight, ChevronLeft, User, ShoppingCart, Truck, CheckCircle2, ShieldCheck, FileText, Wallet, Building, ArrowRightLeft, Boxes } from 'lucide-react';
import { numberToWordsAr, numberToWordsEn, currencyNameAr, currencyNameEn } from '../../../../lib/numberToWords';

export default function CreateOrderStep5(props: any) {
  const {
    isAr, formData, setFormData, directApprove, setDirectApprove, sources, items,
    orderCurrency, calcs, shippings, packagingFeeEnabled, packagingFeeRate,
    viaShippingAgent, couriers, getCurrencyRate, homeDeliveryEnabled,
    bankCommissionEnabled, bankCommissionRate, bankCommissionType,
    couponEnabled, couponRate, amountInWords,
  } = props;
  return (
            <div className="space-y-5 animate-fade-in text-start">
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-emerald-300">
                    {isAr ? 'تم مراجعة واكتمال كافة الخطوات بنجاح' : 'Order details verified & ready for save'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {isAr ? 'يرجى مراجعة ملخص بيانات الطلب أدناه وتأكيد حفظ وترحيل الفاتورة' : 'Review the order summary below before final submission'}
                  </p>
                </div>
              </div>

              {/* ====== Checkbox: الحفظ والاعتماد مباشرة | Direct Approve Toggle ====== */}
              {/* عند التفعيل: يُحفظ الطلب مباشرة بحالة المرحلة الثالثة (المعتمد) */}
              {/* When enabled: order is saved directly at status stage 3 (Approved) */}
              <div className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${directApprove ? 'bg-violet-950/25 border-violet-600/50' : 'bg-slate-900/50 border-slate-800'}`}>
                <input
                  type="checkbox"
                  id="direct-approve-check"
                  checked={directApprove}
                  onChange={(e) => setDirectApprove(e.target.checked)}
                  className="rounded bg-slate-955 border-slate-700 w-4 h-4 cursor-pointer accent-violet-500"
                />
                <label htmlFor="direct-approve-check" className="flex-1 text-[11px] font-bold text-slate-200 cursor-pointer">
                  🚀 {isAr
                    ? 'الحفظ والاعتماد مباشرة — تجاوز مرحلة المراجعة وترحيل الطلب كمعتمد فوراً (المرحلة 3)'
                    : 'Save & Approve Immediately — Skip review stage and post order as Approved (Stage 3)'}
                </label>
                {directApprove && (
                  <span className="text-[10px] font-black text-violet-400 bg-violet-950/30 border border-violet-800/40 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                    ✅ {isAr ? 'سيتم الاعتماد فوراً' : 'Auto-Approved'}
                  </span>
                )}
              </div>

              {/* Summary Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* 1. Customer & Order Source */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <User className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="text-xs font-black text-white">{isAr ? 'بيانات العميل والمصدر' : 'Customer & Source Details'}</h4>
                  </div>
                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'اسم العميل:' : 'Customer Name:'}</span>
                      <span className="text-white">{formData.customerName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'رقم الهاتف:' : 'Phone:'}</span>
                      <span className="text-slate-300 font-mono">{formData.customerPhone || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'العنوان:' : 'Address:'}</span>
                      <span className="text-slate-300 text-end max-w-[200px]">{formData.customerAddress || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'مصدر الطلب:' : 'Order Source:'}</span>
                      <span className="text-[#d4af37]">
                        {sources.find(s => s.id === formData.orderSourceId)?.name || formData.orderSourceId || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'رقم الفاتورة الأصلي:' : 'Store Invoice ID:'}</span>
                      <span className="text-slate-300 font-mono">{formData.externalOrderNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'رقم التتبع الدولي:' : 'Global Tracking:'}</span>
                      <span className="text-slate-300 font-mono">{formData.trackingNumber || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Products Summary */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <ShoppingCart className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="text-xs font-black text-white">{isAr ? 'ملخص أصناف المنتجات' : 'Products & Items Summary'}</h4>
                  </div>
                  <div className="space-y-2 text-xs font-bold max-h-40 overflow-y-auto custom-scrollbar">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-850 text-[11px] space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-white truncate max-w-[160px] font-black">{idx + 1}. {item.productName || '—'}</span>
                          <span className="font-mono text-emerald-400">{item.quantity} × {(item.productPrice || 0).toLocaleString()} {orderCurrency}</span>
                        </div>
                        {(item.weight || item.cbm) && (
                          <div className="flex gap-3 text-[10px] text-slate-500">
                            {item.weight && <span>⚖️ {item.weight} kg</span>}
                            {item.cbm && <span>📐 {item.cbm} m³</span>}
                          </div>
                        )}
                        {item.trackingNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">🔍 {item.trackingNumber}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 space-y-1">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-slate-400">{isAr ? 'إجمالي المنتجات:' : 'Products Subtotal:'}</span>
                      <span className="font-mono text-amber-400">{(calcs.productsSum || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">{isAr ? 'إجمالي الوحدات:' : 'Total Units:'}</span>
                      <span className="font-mono text-slate-300">{items.reduce((s: number, i: any) => s + (parseInt(i.quantity) || 0), 0)} {isAr ? 'قطعة' : 'pcs'}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Logistics & Couriers Summary */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <Truck className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="text-xs font-black text-white">{isAr ? 'ملخص الشحن والمناديب' : 'Logistics & Couriers Summary'}</h4>
                  </div>
                  <div className="space-y-2.5 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'عدد مسارات الشحن:' : 'Shipping Tracks:'}</span>
                      <span className="text-slate-200">{shippings?.length || 0} {isAr ? 'مسارات' : 'tracks'}</span>
                    </div>
                    {shippings && shippings.length > 0 && shippings.map((sh: any, idx: number) => (
                      <div key={idx} className="bg-slate-900/50 rounded-xl p-2.5 border border-slate-850 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-[#d4af37] font-black">{isAr ? `مسار #${idx + 1}:` : `Track #${idx + 1}:`} {sh.shippingCompany || '—'}</span>
                          <span className="text-blue-300 font-mono">{(parseFloat(sh.shippingCost) || 0).toLocaleString()} {orderCurrency}</span>
                        </div>
                        {sh.shippingType && <div className="text-slate-500">{isAr ? 'النوع:' : 'Mode:'} {sh.shippingType}</div>}
                        {sh.shippingSource && sh.shippingDestination && (
                          <div className="text-slate-500">{sh.shippingSource} → {sh.shippingDestination}</div>
                        )}
                        {sh.trackingNumber && <div className="font-mono text-slate-400">🔍 {sh.trackingNumber}</div>}
                        {/* Shipping packaging fee per route */}
                        {(parseFloat(sh.packagingFee) || 0) > 0 && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500">{isAr ? '📦 رسوم تغليف المسار:' : '📦 Track Packaging:'}</span>
                            <span className="text-purple-300 font-mono">{(parseFloat(sh.packagingFee) || 0).toLocaleString()} {orderCurrency}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* General company packaging fee */}
                    {packagingFeeEnabled && packagingFeeRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📦 رسوم تغليف شركة الشحن:' : '📦 Carrier Packaging Fee:'}</span>
                        <span className="text-purple-300 font-mono">{packagingFeeRate.toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {/* Local wrapping fee */}
                    {(formData.packagingFee || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📦 رسوم تغليف وشحن محلي:' : '📦 KSA Wrapping & Local Freight:'}</span>
                        <span className="text-purple-200 font-mono">{(formData.packagingFee || 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {items && items.reduce((sum: number, it: any) => sum + ((parseFloat(it.packagingOptionPrice) || 0) * (parseFloat(it.quantity) || 1)), 0) > 0 && (
                      <div className="flex justify-between text-amber-300">
                        <span>{isAr ? '📦 تغليف المنتجات المخصص:' : '📦 Custom Packaging Option:'}</span>
                        <span className="font-mono">+{items.reduce((sum: number, it: any) => sum + ((parseFloat(it.packagingOptionPrice) || 0) * (parseFloat(it.quantity) || 1)), 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {items && items.reduce((sum: number, it: any) => sum + (it.isInsured ? (parseFloat(it.insuranceFee) || 0) : 0), 0) > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {isAr ? '🛡️ رسوم تأمين المنتجات:' : '🛡️ Products Insurance Fee:'}
                        </span>
                        <span className="font-mono">+{items.reduce((sum: number, it: any) => sum + (it.isInsured ? (parseFloat(it.insuranceFee) || 0) : 0), 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {shippings && shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCategoryPrice) || 0), 0) > 0 && (
                      <div className="flex justify-between text-cyan-300">
                        <span>{isAr ? '⚡️ فئات الشحن المسرّعة:' : '⚡️ Shipping Speed Categories:'}</span>
                        <span className="font-mono">+{shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCategoryPrice) || 0), 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}

                    <div className="border-t border-slate-800/60 pt-2 space-y-1.5">
                      {/* مندوب التجميع السعودي والعمولة — يظهر فقط عند تفعيل "عبر مندوب شحن" */}
                      {viaShippingAgent ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{isAr ? 'مندوب التجميع (سعودي):' : 'Saudi Aggregator:'}</span>
                            <span className="text-amber-300 font-bold">
                              {couriers.find(c => c.id === formData.shippingCourierId)?.fullName || (isAr ? 'غير محدد' : 'N/A')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{isAr ? '👤 عمولة مندوب الشحن:' : '👤 Shipping Agent Comm.:'}</span>
                            <span className="text-yellow-300 font-mono">
                              {formData.shippingCourierFeeRate !== undefined ? formData.shippingCourierFeeRate : 30}% ≈ {Math.ceil(calcs.profitSaudiSAR || 0).toLocaleString()} {orderCurrency}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-slate-500 italic text-[10px]">
                          <span>{isAr ? 'مندوب الشحن:' : 'Shipping Agent:'}</span>
                          <span>{isAr ? 'غير مفعل (بدون مندوب شحن)' : 'Disabled (No Shipping Agent)'}</span>
                        </div>
                      )}

                      {/* مندوب التوصيل النهائي اليمني والرسوم — يظهر فقط عند تفعيل "توصيل للمنزل" */}
                      {homeDeliveryEnabled ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{isAr ? 'مندوب التوصيل (اليمن):' : 'Yemen Courier:'}</span>
                            <span className="text-emerald-300 font-bold">
                              {couriers.find(c => c.id === formData.deliveryCourierId)?.fullName || (isAr ? 'غير محدد' : 'N/A')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{isAr ? 'أجرة التوصيل:' : 'Delivery Fee:'}</span>
                            <span className="text-emerald-300 font-mono">{(formData.deliveryCourierFee || 0).toLocaleString()} YER</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-slate-500 italic text-[10px]">
                          <span>{isAr ? 'توصيل للمنزل:' : 'Home Delivery:'}</span>
                          <span>{isAr ? 'غير مفعل (بدون توصيل)' : 'Disabled (No Home Delivery)'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Full Financial Audit Summary */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <FileText className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="text-xs font-black text-white">{isAr ? 'الكشف المالي التفصيلي' : 'Full Financial Breakdown'}</h4>
                  </div>
                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? '🛍 قيمة المنتجات:' : '🛍 Products Value:'}</span>
                      <span className="font-mono text-white">{(calcs.productsSum || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                    {shippings && shippings.length > 0 && shippings.reduce((s: number, sh: any) => s + (parseFloat(sh.shippingCost) || 0), 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '🚚 تكاليف الشحن:' : '🚚 Shipping Cost:'}</span>
                        <span className="font-mono text-blue-300">
                          {shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCost) || 0), 0).toLocaleString()} {orderCurrency}
                        </span>
                      </div>
                    )}
                    {/* Carrier packaging */}
                    {packagingFeeEnabled && packagingFeeRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📦 رسوم تغليف شركة الشحن:' : '📦 Carrier Packaging Fee:'}</span>
                        <span className="font-mono text-purple-300">{packagingFeeRate.toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {/* Local wrapping */}
                    {(formData.packagingFee || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📦 رسوم تغليف وشحن محلي:' : '📦 KSA Wrapping & Local Freight:'}</span>
                        <span className="font-mono text-purple-200">{(formData.packagingFee || 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {bankCommissionEnabled && bankCommissionRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '🏦 عمولة البنك:' : '🏦 Bank Commission:'}</span>
                        <span className="font-mono text-orange-300">
                          {bankCommissionType === 'percentage'
                            ? `${bankCommissionRate}% ≈ ${Math.ceil((calcs.productsSum || 0) * bankCommissionRate / 100).toLocaleString()} ${orderCurrency}`
                            : `${bankCommissionRate.toLocaleString()} ${orderCurrency}`}
                        </span>
                      </div>
                    )}
                    {couponEnabled && couponRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '🎟 خصم الكوبون:' : '🎟 Coupon Discount:'}</span>
                        <span className="font-mono text-emerald-300">-{couponRate.toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {(calcs?.profitCompanySAR || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📌 رسوم أخرى:' : '📌 Other Fees:'}</span>
                        <span className="font-mono text-cyan-300">{Math.ceil(calcs.profitCompanySAR || 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {/* Courier commission in summary */}
                    {(() => {
                      const sc = couriers.find(c => c.id === formData.shippingCourierId);
                      const commRate = sc?.commissionRate || 0;
                      const commValue = commRate > 0 ? Math.ceil(calcs.profitSaudiSAR) : 0;
                      return commRate > 0 ? (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? '👤 عمولة مندوب الشحن:' : '👤 Shipping Agent Comm.:'}</span>
                          <span className="font-mono text-yellow-300">{commValue.toLocaleString()} {orderCurrency}</span>
                        </div>
                      ) : null;
                    })()}
                    {(formData.deliveryCourierFee || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '🛵 أجرة توصيل المندوب:' : '🛵 Delivery Agent Fee:'}</span>
                        <span className="font-mono text-amber-200">{(formData.deliveryCourierFee || 0).toLocaleString()} YER</span>
                      </div>
                    )}

                    {/* Currency info */}
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">{isAr ? `سعر الصرف (${orderCurrency}/${formData.currency}):` : `Rate (${orderCurrency}/${formData.currency}):`}</span>
                      <span className="font-mono text-slate-300">{(getCurrencyRate(orderCurrency) / getCurrencyRate(formData.currency || 'YER')).toFixed(2)}</span>
                    </div>

                    <div className="border-t border-slate-700 pt-2 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-black">{isAr ? '📊 الإجمالي بعملة الطلب:' : '📊 Total in Order Currency:'}</span>
                        <span className="font-mono text-slate-200 font-black">{Math.ceil(calcs.totalOrderSAR).toLocaleString()} {orderCurrency}</span>
                      </div>

                      {/* Total in payment currency — word form */}
                      <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-3 py-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-emerald-300">{isAr ? `💰 الإجمالي بعملة الدفع (${formData.currency}):` : `💰 Total in ${formData.currency}:`}</span>
                          <span className="font-mono text-emerald-300 font-black text-sm">{Math.ceil(calcs.totalOrderYER).toLocaleString()} {formData.currency}</span>
                        </div>
                        <p className="text-[10px] text-emerald-400/80 font-bold mt-1 italic">
                          {amountInWords(calcs.totalOrderYER, formData.currency, isAr ? 'ar' : 'en')}
                        </p>
                      </div>

                      {/* Paid — word form */}
                      <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl px-3 py-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-blue-300">{isAr ? '✅ المبلغ المدفوع (كاش):' : '✅ Amount Paid (Cash):'}</span>
                          <span className="font-mono text-blue-300 font-black">{Math.ceil(formData.amountPaid || 0).toLocaleString()} {formData.currency}</span>
                        </div>
                        {(formData.amountPaid || 0) > 0 && (
                          <p className="text-[10px] text-blue-400/80 font-bold mt-1 italic">
                            {isAr
                              ? `✍️ استلمت مبلغ: ${numberToWordsAr(Math.ceil(formData.amountPaid))} ${currencyNameAr(formData.currency)} نقداً`
                              : `✍️ Received: ${numberToWordsEn(Math.ceil(formData.amountPaid))} ${currencyNameEn(formData.currency)} cash`
                            }
                          </p>
                        )}
                      </div>

                      {/* Remaining debt */}
                      <div className="flex justify-between items-center p-2.5 bg-rose-500/5 rounded-xl border border-rose-500/10">
                        <span className="text-rose-400 font-black">{isAr ? '⚠️ المديونية المتبقية:' : '⚠️ Remaining Debt:'}</span>
                        <span className="font-mono text-rose-400 font-black">{Math.ceil(calcs.remainingYER).toLocaleString()} {formData.currency}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Notes/Remarks field */}
              <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  📝 {isAr ? 'ملاحظات إضافية على الطلب' : 'Additional Order Notes'}
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={isAr ? 'أضف أي ملاحظات أو تعليمات إضافية على هذا الطلب...' : 'Add any additional notes or special instructions...'}
                  rows={3}
                  className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-bold text-xs resize-none focus:border-[#d4af37]/60"
                />
              </div>
            </div>
  );
}
