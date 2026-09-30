import React from 'react';

export const FieldLabel = ({ children, locked = false }: { children: React.ReactNode; locked?: boolean }) => (
  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
    <span>{children}</span>
    {locked && <span className="text-[10px] text-amber-500 font-bold font-mono">🔒 [مقفول]</span>}
  </label>
);

export const FieldInput = ({ disabled = false, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    disabled={disabled}
    className={`w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3.5 text-xs font-bold outline-none focus:border-[#d4af37]/60 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  />
);

export const FieldTextarea = ({ disabled = false, className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    disabled={disabled}
    className={`w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3.5 text-xs font-bold outline-none focus:border-[#d4af37]/60 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  />
);

export const SectionCard = ({ title, icon: Icon, children, className = '', badge }: { title: string; icon: any; children: React.ReactNode; className?: string; badge?: string }) => (
  <div className={`bg-black/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-4 shadow-xl ${className}`}>
    <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
      <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {title}
      </h3>
      {badge && (
        <span className="text-[10px] font-bold bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-2.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
    {children}
  </div>
);

export const inputClass = 'w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3.5 text-xs font-bold outline-none focus:border-[#d4af37]/60 disabled:opacity-50 disabled:cursor-not-allowed';
