import OrderPartyPicker from '../../../../components/orders/OrderPartyPicker';

export default function EditOrderStep1(props: any) {
  const { isAr, orderParties, selectedOrderParty, formData, setFormData, setIsStaffOrder, selectOrderParty, clearOrderParty, sources } = props;

  return (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <span className="text-blue-400 uppercase text-[10px] block font-black">{isAr ? 'العميل والحساب' : 'Customer Account'}</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-slate-500 mb-2">{isAr ? 'تحديد طرف الطلب والحساب المالي' : 'Order party and financial account'}</label>
                    <OrderPartyPicker
                      isAr={isAr}
                      parties={orderParties}
                      selectedParty={selectedOrderParty}
                      staffOnly={Boolean(formData.isStaffOrder)}
                      onStaffOnlyChange={setIsStaffOrder}
                      onSelect={selectOrderParty}
                      onClear={clearOrderParty}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'اسم العميل' : 'Customer Name'}</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'رقم الهاتف' : 'Phone'}</label>
                    <input
                      type="text"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <span className="text-blue-400 uppercase text-[10px] block font-black">{isAr ? 'المصدر والتتبع' : 'Source & Tracking'}</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'مصدر الطلب' : 'Order Source'}</label>
                    <select
                      value={formData.orderSourceId}
                      onChange={(e) => {
                        const s = sources.find((src) => src.id === e.target.value);
                        setFormData({
                          ...formData,
                          orderSourceId: e.target.value,
                          orderSourceName: s ? s.name || s.source_name : '',
                          orderSourceType: s ? s.type || 'App' : 'App',
                        });
                      }}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none cursor-pointer"
                    >
                      <option value="">{isAr ? '-- اختر المصدر --' : '-- Choose Source --'}</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name || s.source_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'رقم الفاتورة الأصلي (سلة/متجر)' : 'External Reference'}</label>
                    <input
                      type="text"
                      value={formData.externalOrderNumber}
                      onChange={(e) => setFormData({ ...formData, externalOrderNumber: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'رقم التتبع الموحد' : 'Tracking Number'}</label>
                    <input
                      type="text"
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
  );
}
