import React from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export const getStatusColor = (status?: string) => {
  switch (status) {
    case 'مكتمل': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    case 'مقبول': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
    case 'مرفوض': return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
    case 'معلق':
    default: return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
  }
};

export const getTypeColor = (type?: string) => {
  switch (type) {
    case 'استبدال': return 'bg-blue-500/10 text-blue-400';
    case 'استرداد': return 'bg-purple-500/10 text-purple-400';
    case 'إصلاح': return 'bg-orange-500/10 text-orange-400';
    default: return 'bg-slate-800 text-slate-400';
  }
};

export const StatusIcon = ({ status }: { status?: string }) => {
  switch (status) {
    case 'مكتمل':
    case 'مقبول': return <CheckCircle2 className="w-3 h-3" />;
    case 'مرفوض': return <XCircle className="w-3 h-3" />;
    case 'معلق':
    default: return <AlertCircle className="w-3 h-3" />;
  }
};

export const FieldLabel = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-1">
    <span className="block text-[10px] text-slate-500 font-black">{label}</span>
    {children}
  </label>
);
