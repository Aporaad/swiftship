import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type SharedProps = {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  settings: any;
};

export function ModalShell({
  children,
  title,
  onClose,
  maxWidth = 'max-w-4xl lg:max-w-5xl',
  headerExtra
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  maxWidth?: string;
  headerExtra?: React.ReactNode;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[1000000] isolate flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className={`flex w-full ${maxWidth} max-h-[94vh] flex-col overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-slate-900 shadow-2xl transition-all`}>
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 text-xs font-black text-white">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-[#d4af37]">{title}</span>
            {headerExtra}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-800/80 p-2 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-400" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const inputClass = 'w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-bold text-white outline-none transition focus:border-[#d4af37]/60';

export function FormField({ label, children, required = false, icon }: { label: string; children: React.ReactNode; required?: boolean; icon?: React.ReactNode }) {
  return <div><label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">{icon}{label}{required ? ' *' : ''}</label>{children}</div>;
}

export function ModalActions({ isAr, submitting, onClose }: { isAr: boolean; submitting: boolean; onClose: () => void }) {
  return <div className="flex justify-end gap-3 border-t border-slate-800 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-800">{isAr ? 'إلغاء' : 'Cancel'}</button><button type="submit" disabled={submitting} className="rounded-xl bg-gradient-to-r from-[#d4af37] to-yellow-600 px-5 py-2.5 text-xs font-black text-black transition disabled:opacity-50">{submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تأمين وحفظ البيانات' : 'Save')}</button></div>;
}
