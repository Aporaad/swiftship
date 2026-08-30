/**
 * EntryDeleteConfirmModal — نافذة تأكيد حذف القيد/السند
 * Entry Delete Confirmation Modal
 *
 * تستبدل window.confirm ببطاقة تأكيد أنيقة تُظهر:
 * - رقم القيد ونوعه
 * - تحذير لحالة القيد المرحّل
 * - زر تأكيد وزر إلغاء
 *
 * Replaces window.confirm with an elegant card showing:
 * - Entry number and type
 * - Warning for posted entries
 * - Confirm and Cancel buttons
 */

import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { FinanceEntryRow } from './EntryWorkspaceTab';

interface Props {
  entry: FinanceEntryRow;
  isPosted: boolean;  // هل القيد مرحّل؟ — Is entry posted?
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function EntryDeleteConfirmModal({ entry, isPosted, onConfirm, onCancel, loading = false }: Props) {
  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      dir="rtl"
    >
      {/* خلفية شفافة — Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onCancel} />

      {/* بطاقة التأكيد — Confirm Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-950 shadow-2xl overflow-hidden ring-1 ring-rose-500/10">

        {/* رأس البطاقة — Card Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-rose-950/30 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400">
              <Trash2 className="h-4 w-4" />
            </div>
            <h3 className="font-black text-white text-sm">تأكيد الحذف</h3>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* محتوى البطاقة — Card Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            أنت بصدد حذف القيد رقم{' '}
            <span className="font-mono font-black text-rose-300">{entry.entryNumber}</span>
            {entry.description ? (
              <>
                {' — '}
                <span className="text-slate-400">{entry.description}</span>
              </>
            ) : null}
          </p>

          {/* تحذير للقيود المرحّلة — Warning for Posted Entries */}
          {isPosted && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-black text-amber-300">تحذير: قيد مرحّل!</p>
                <p className="mt-0.5 text-[11px] text-amber-200/70 leading-relaxed">
                  هذا القيد مرحّل وقد أثّر في أرصدة الحسابات. حذفه سيُعيد عكس جميع تأثيراته المحاسبية.
                  هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </div>
          )}

          {!isPosted && (
            <p className="text-xs text-slate-500">
              هذا الإجراء نهائي ولا يمكن التراجع عنه. سيتم حذف القيد وجميع أسطره المحاسبية بشكل دائم.
            </p>
          )}
        </div>

        {/* أزرار التأكيد — Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 bg-slate-900/60 px-5 py-3.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-2 text-xs font-black text-white shadow-lg transition disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {loading ? 'جاري الحذف…' : 'تأكيد الحذف'}
          </button>
        </div>
      </div>
    </div>
  );
}
