import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { alxRequest } from '../../lib/alxApiClient';

interface PaymentReviewItem {
  id: string;
  amount: number;
  currency: 'YER' | 'USD' | 'SAR';
  paymentMethod: string;
  reference?: string;
  notes?: string;
  status: 'pending_verification' | 'settled' | 'rejected';
  /** القيد غير المرحّل المُنشأ تلقائياً مع الطلب — التسوية تُرحّله والرفض يلغيه. */
  /** The draft entry auto-created with the request — settling posts it, rejecting voids it. */
  financeEntryId?: string;
  customerName: string;
  customerEmail: string;
  financialAccountId: string;
  createdAt: number;
}

interface PortalPaymentReviewTabProps {
  isAr: boolean;
  canReview: boolean;
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString('en-GB');
}

export default function PortalPaymentReviewTab({ isAr, canReview }: PortalPaymentReviewTabProps) {
  const [items, setItems] = useState<PaymentReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [financeEntryIds, setFinanceEntryIds] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!canReview) return;
    setLoading(true);
    setMessage('');
    const result = await alxRequest<PaymentReviewItem[]>('/api/v1/finance/portal-payment-requests');
    if (result.success) setItems(result.data);
    else setMessage(result.error.message);
    setLoading(false);
  }, [canReview]);

  useEffect(() => { void load(); }, [load]);

  async function settle(item: PaymentReviewItem): Promise<void> {
    // الطلبات الحديثة تحمل قيداً مرتبطاً مسبقاً؛ الطلبات القديمة فقط تحتاج إدخال معرف القيد مرحّل يدوياً.
    // Newer requests carry a pre-linked entry; only legacy rows need a manually-entered posted entry id.
    const financeEntryId = item.financeEntryId?.trim() || financeEntryIds[item.id]?.trim();
    if (!financeEntryId) {
      setMessage(isAr ? 'هذا الطلب غير مرتبط بقيد مالي — أدخل معرف القيد المرحّل قبل التسوية.' : 'This request has no linked entry — enter the posted finance entry ID before settling.');
      return;
    }
    const result = await alxRequest(`/api/v1/finance/portal-payment-requests/${item.id}/settle`, {
      method: 'POST', body: { financeEntryId },
    });
    if (!result.success) setMessage(result.error.message);
    else await load();
  }

  async function reject(item: PaymentReviewItem): Promise<void> {
    const reviewNote = reviewNotes[item.id]?.trim();
    if (!reviewNote) {
      setMessage(isAr ? 'أدخل سبب الرفض.' : 'Enter a rejection reason.');
      return;
    }
    const result = await alxRequest(`/api/v1/finance/portal-payment-requests/${item.id}/reject`, {
      method: 'POST', body: { reviewNote },
    });
    if (!result.success) setMessage(result.error.message);
    else await load();
  }

  if (!canReview) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-[#d4af37]/20 bg-black/30 p-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">{isAr ? 'مراجعة طلبات سداد البوابة' : 'Portal Payment Review'}</h2>
          <p className="mt-1 text-xs text-slate-400">{isAr ? 'كل طلب يُنشئ قيداً غير مرحّل في القيود — الاعتماد يُرحّله، والرفض يلغيه.' : 'Each request creates a draft entry — settling posts it, rejecting voids it.'}</p>
        </div>
        <button className="btn btn-outline" onClick={() => void load()} disabled={loading} aria-label={isAr ? 'تحديث' : 'Refresh'}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {message && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</p>}
      {items.length === 0 && !loading && <p className="py-8 text-center text-sm text-slate-500">{isAr ? 'لا توجد طلبات معلقة.' : 'No pending requests.'}</p>}
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black text-white">{item.customerName} · {item.amount.toLocaleString()} {item.currency}</p>
                <p className="mt-1 text-xs text-slate-400">{item.customerEmail} · {item.paymentMethod} · {formatDate(item.createdAt)}</p>
                {item.financeEntryId && (
                  <p className="mt-1 text-xs text-[#d4af37]">{isAr ? 'القيد المرتبط (غير مرحّل):' : 'Linked draft entry:'} <span className="font-mono">{item.financeEntryId}</span></p>
                )}
                {item.reference && <p className="mt-1 text-xs text-slate-500">{isAr ? 'المرجع:' : 'Reference:'} {item.reference}</p>}
                {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
              </div>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">{isAr ? 'بانتظار التحقق' : 'Pending verification'}</span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
              {!item.financeEntryId && (
                <input className="input" value={financeEntryIds[item.id] ?? ''} onChange={(event) => setFinanceEntryIds((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={isAr ? 'معرف القيد المرحّل (طلبات قديمة)' : 'Posted finance entry ID (legacy)'} />
              )}
              <input className="input" value={reviewNotes[item.id] ?? ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={isAr ? 'سبب الرفض عند الحاجة' : 'Rejection reason if needed'} />
              <button className="btn btn-gold" onClick={() => void settle(item)}><CheckCircle size={15} />{isAr ? 'تسوية' : 'Settle'}</button>
              <button className="btn btn-outline" onClick={() => void reject(item)}><XCircle size={15} />{isAr ? 'رفض' : 'Reject'}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
