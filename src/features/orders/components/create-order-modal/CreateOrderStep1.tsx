import React from 'react';
import { X, Search, UserPlus, CreditCard, DollarSign, AlertCircle, Package, Trash2, Calendar, Calculator, ChevronRight, ChevronLeft, User, ShoppingCart, Truck, CheckCircle2, ShieldCheck, FileText, Wallet, Building, ArrowRightLeft, Boxes } from 'lucide-react';
import OrderPartyPicker from '../../../../components/orders/OrderPartyPicker';

export default function CreateOrderStep1(props: any) {
  const {
    isAr, role, hasPermission, customerProfileStats, orderParties, selectedOrderParty,
    isStaffOrder, setIsStaffOrder, selectOrderParty, clearSelectedCustomer, formData,
    customerSearchQuery, setCustomerSearchQuery, filteredCustomers, selectCustomer,
    setCustomerFormData, setIsAddCustomerOpen, setFormData, setIsAddSourceOpen, sources,
  } = props;
  return (
            <div className="space-y-6 animate-fade-in">
              {/* Debt Alert Warning Banner if Customer has Outstanding Debt */}
              {customerProfileStats && customerProfileStats.totalOutstandingDebt > 0 && (
                <div className="p-4 bg-red-950/30 border border-red-900 text-red-400 rounded-2xl flex items-center gap-3 animate-pulse">
                  <AlertCircle className="w-6 h-6 shrink-0 text-red-500" />
                  <span className="font-black text-xs leading-relaxed">
                    {isAr
                      ? `⚠️ تنبيه ديون معلقة: يوجد للعميل الحالي ديون غير محصلة ومستحقة بذمته بقيمة: [ ${customerProfileStats.totalOutstandingDebt.toLocaleString()} ريال يمني ].`
                      : `⚠️ Outstanding Balances Warning: This client has outstanding pending balances of [ YER ${customerProfileStats.totalOutstandingDebt.toLocaleString()} ].`}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Customer Selection */}
                <div className="space-y-4 bg-slate-950/40 border border-slate-800 p-5 rounded-3xl relative">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-[#d4af37] flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {isAr ? (isStaffOrder ? 'اختيار طرف الطلب' : 'اختيار وتحديد العميل المستلم') : (isStaffOrder ? 'Choose order party' : 'Receiver Customer')} *
                    </label>
                    {(role === 'Admin' || hasPermission('add_customers')) && (
                      <button
                        type="button"
                        onClick={() => setIsAddCustomerOpen(true)}
                        className="text-xs font-black text-[#d4af37] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {isAr ? 'إضافة عميل جديد ➕' : 'Quick add customer'}
                      </button>
                    )}
                  </div>

                  <OrderPartyPicker
                    isAr={isAr}
                    parties={orderParties}
                    selectedParty={selectedOrderParty}
                    staffOnly={isStaffOrder}
                    onStaffOnlyChange={setIsStaffOrder}
                    onSelect={selectOrderParty}
                    onClear={clearSelectedCustomer}
                  />

                  {!formData.customerId && !isStaffOrder ? (
                    <div className="relative">
                      <Search className="absolute right-3 top-3 text-slate-500 w-4 h-4" />
                      <input
                        type="text"
                        placeholder={isAr ? "ابحث عن عميل بالاسم أو رقم الجوال..." : "Search customer by name or phone..."}
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl py-3 pr-9 pl-4 outline-none font-bold text-xs focus:border-[#d4af37]/60"
                      />

                      {customerSearchQuery.trim() !== '' && (
                        <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-800">
                          {filteredCustomers.length > 0 ? (
                            filteredCustomers.map((c) => (
                              <button
                                type="button"
                                key={c.id}
                                onClick={() => selectCustomer(c)}
                                className="w-full text-start p-3 text-xs hover:bg-slate-800 text-white font-bold flex justify-between items-center cursor-pointer"
                              >
                                <span>{c.fullName}</span>
                                <span className="font-mono text-slate-500">{c.phone}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-xs text-slate-500 font-bold flex justify-between items-center">
                              <span>{isAr ? '🟢 عميل جديد' : '🟢 New Customer'}</span>
                              {(role === 'Admin' || hasPermission('add_customers')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomerFormData((prev: any) => ({
                                      ...prev,
                                      fullName: customerSearchQuery,
                                    }));
                                    setIsAddCustomerOpen(true);
                                  }}
                                  className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-3 py-1 rounded-lg text-[10px]"
                                >
                                  {isAr ? 'إضافة الآن' : 'Create Now'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : !isStaffOrder ? (
                    <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[#d4af37]/5 rounded-full -mr-8 -mt-8"></div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-white">{formData.customerName}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formData.customerPhone}</p>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          {customerProfileStats?.tier === 'VIP' && (
                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-2 py-0.5 rounded text-[8px] font-black uppercase">VIP Client</span>
                          )}
                          {customerProfileStats?.tier === 'Debt' && (
                            <span className="bg-red-500/10 text-red-500 border border-red-500/25 px-2 py-0.5 rounded text-[8px] font-black uppercase">Has Debt</span>
                          )}
                          {customerProfileStats?.tier === 'Regular' && (
                            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Regular</span>
                          )}
                          <button
                            type="button"
                            onClick={clearSelectedCustomer}
                            className="bg-slate-800 text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-850/50">
                        <div>{isAr ? 'إجمالي الطلبات:' : 'Total orders:'} <span className="text-slate-300 font-mono">{customerProfileStats?.totalOrdersCount || 0}</span></div>
                        <div>{isAr ? 'آخر طلب:' : 'Last order:'} <span className="text-slate-300 font-mono">{customerProfileStats?.lastOrderDate ? new Date(customerProfileStats.lastOrderDate).toLocaleDateString() : '—'}</span></div>
                        <div className="col-span-2">{isAr ? 'العنوان الأساسي:' : 'Address:'} <span className="text-slate-300">{formData.customerAddress || '—'}</span></div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* 2. Order Source & References */}
                <div className="space-y-4 bg-slate-950/40 border border-slate-800 p-5 rounded-3xl">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider text-start">
                        {isAr ? 'مصدر الشراء والطلب' : 'Order Source'} *
                      </label>
                      {(role === 'Admin' || hasPermission('add_sources')) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddSourceOpen(true);
                          }}
                          className="text-[10px] font-black text-[#d4af37] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          ➕ {isAr ? 'مصدر جديد' : 'New Source'}
                        </button>
                      )}
                    </div>
                    <select
                      required
                      value={formData.orderSourceId}
                      onChange={(e) => setFormData({ ...formData, orderSourceId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs cursor-pointer focus:border-[#d4af37]"
                    >
                      <option value="">{isAr ? '-- اختر مصدر الشراء --' : '-- Choose Source --'}</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>{s.name || s.source_name} {s.type ? `(${s.type})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                      {isAr ? 'رقم الفاتورة الأصلي (سلة / المتجر)' : 'Orig. Store Reference'}
                    </label>
                    <input
                      type="text"
                      value={formData.externalOrderNumber}
                      onChange={(e) => setFormData({ ...formData, externalOrderNumber: e.target.value })}
                      placeholder={isAr ? "رقم الفاتورة في سلة أو المتجر الأصلي" : "Original Invoice ID"}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                      {isAr ? 'رقم التتبع الدولي (Global Tracking)' : 'Global Tracking Code'}
                    </label>
                    <input
                      type="text"
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      placeholder={isAr ? "رقم التتبع الدولي (DHL...)" : "Global Tracking ID"}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
  );
}
