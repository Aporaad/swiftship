import { ShieldCheck } from 'lucide-react';
import type { OrderFormData } from '../../types';

type EditOrderStep5Props = {
  isAr: boolean;
  formData: OrderFormData;
  totalOrderSAR: number;
  totalOrderYER: number;
  remainingYER: number;
  orderCurrency: string;
  paymentCurrency: string;
};

export default function EditOrderStep5(props: EditOrderStep5Props) {
  const { isAr, formData, totalOrderSAR, totalOrderYER, remainingYER, orderCurrency, paymentCurrency } = props;

  return (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 bg-blue-950/20 border border-blue-900/30 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-blue-300">
                    {isAr ? 'مراجعة التعديلات النهائية قبل الحفظ' : 'Review changes before saving'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {isAr ? 'تأكد من مطابقة كافة البيانات المعدلة للطلب' : 'Verify order modifications below'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 block border-b border-slate-800 pb-1">{isAr ? 'العميل:' : 'Customer:'}</span>
                  <p className="text-white">{formData.customerName}</p>
                  <p className="text-slate-400 font-mono">{formData.customerPhone}</p>
                </div>

                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 block border-b border-slate-800 pb-1">{isAr ? 'المالية:' : 'Financials:'}</span>
                  <p className="text-amber-300 font-mono">إجمالي الطلب: {Math.ceil(totalOrderSAR).toLocaleString()} {orderCurrency}</p>
                  <p className="text-emerald-400 font-mono">إجمالي الدفع: {Math.ceil(totalOrderYER).toLocaleString()} {paymentCurrency}</p>
                  <p className="text-rose-400 font-mono">المتبقي: {Math.ceil(remainingYER).toLocaleString()} {paymentCurrency}</p>
                </div>
              </div>
            </div>
  );
}
