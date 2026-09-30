import React from 'react';
import type { LucideIcon } from 'lucide-react';

export const FieldLabel = ({
  children,
  locked = false,
}: {
  children: React.ReactNode;
  locked?: boolean;
}) => (
  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">
    {children}{locked && <span className="ml-1 text-rose-400">🔒</span>}
  </label>
);

export const FieldInput = ({
  disabled = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    disabled={disabled}
    className={`w-full bg-black/50 border border-slate-800 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-700'} ${props.className || ''}`}
  />
);

export const FieldTextarea = ({
  disabled = false,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    disabled={disabled}
    className={`w-full bg-black/50 border border-slate-800 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-700'} ${props.className || ''}`}
  />
);

export const SectionCard = ({
  title,
  icon: Icon,
  children,
  className = '',
  badge,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  badge?: string;
}) => (
  <section className={`bg-[#121215] border border-slate-850 p-6 rounded-3xl shadow-lg relative overflow-hidden group ${className}`}>
    <div className="absolute top-0 right-0 w-24 h-24 bg-[#d4af37]/3 rounded-full -mr-12 -mt-12 opacity-30 group-hover:scale-110 transition-transform duration-500"></div>
    <h2 className="text-sm font-black text-white mb-5 flex items-center gap-2 border-b border-slate-800/50 pb-4 relative z-10 uppercase tracking-wider">
      <Icon className="w-4 h-4 text-[#d4af37]" />
      {title}
      {badge && <span className="mr-auto text-[9px] font-black bg-[#d4af37]/20 text-[#d4af37] px-2 py-0.5 rounded-full">{badge}</span>}
    </h2>
    <div className="relative z-10">{children}</div>
  </section>
);

export const ToggleSwitch = ({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
  locked = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  icon?: LucideIcon;
  locked?: boolean;
}) => (
  <div className="flex items-center p-4 bg-black/40 rounded-2xl border border-slate-800 gap-4">
    {Icon && (
      <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37] p-2.5 rounded-xl shrink-0">
        <Icon className="w-5 h-5" />
      </div>
    )}
    <div className="flex-1 text-start">
      <h4 className="text-xs font-black text-white uppercase tracking-wider">
        {label}{locked && <span className="ml-1 text-rose-400">🔒</span>}
      </h4>
      {description && <p className="text-[10px] text-slate-500 font-bold mt-0.5">{description}</p>}
    </div>
    <label className={`relative inline-flex items-center ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => !locked && onChange(event.target.checked)}
        className="sr-only peer"
        disabled={locked}
      />
      <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-800 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
    </label>
  </div>
);

export const inputClass = 'w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3.5 text-xs font-bold outline-none focus:border-[#d4af37]/60 disabled:opacity-50 disabled:cursor-not-allowed';
