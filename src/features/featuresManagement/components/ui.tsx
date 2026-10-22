import React from "react";

/**
 * ui.tsx — عناصر عرض صغيرة مشتركة لتبويبات قسم إدارة الميزات (P10).
 * Small shared presentation primitives for the features-management tabs (P10).
 * منطق الأعمال غير موجود هنا: هذه التغليف البصري فقط (نظافة الكود ومبدأ DRY).
 * No business logic lives here: purely presentational wrappers (clean code + DRY).
 */

export const inputClass =
  "bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white w-full";
export const primaryButtonClass =
  "px-4 py-2 bg-gradient-to-r from-[#d4af37] to-amber-600 text-black font-black text-xs rounded-xl hover:from-amber-400 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed";
export const ghostButtonClass =
  "px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border bg-black/30 text-slate-300 border-white/10 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed";

export function LabeledField(props: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1 block ${props.className ?? ""}`}>
      <span className="text-[11px] font-bold text-slate-400">
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

export function StatusBadge(props: { label: string; tone: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${props.tone}`}
    >
      {props.label}
    </span>
  );
}

export function EmptyState(props: { text: string }) {
  return (
    <div className="text-center text-xs text-slate-500 py-8 bg-black/20 border border-white/[0.04] rounded-2xl">
      {props.text}
    </div>
  );
}

export function LoadingState(props: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d4af37]/30 border-t-[#d4af37]"></span>
      {props.text}
    </div>
  );
}
