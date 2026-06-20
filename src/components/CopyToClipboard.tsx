import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyToClipboardProps {
  text: string;
  className?: string;
  iconSize?: number;
  label?: string;
  labelCopied?: string;
  showIconOnly?: boolean;
}

export default function CopyToClipboard({
  text,
  className = '',
  iconSize = 13,
  label,
  labelCopied,
  showIconOnly = true,
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback if clipboard API is not available (e.g., iframe permissions)
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  if (showIconOnly) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={`p-1 rounded-md transition-all duration-200 active:scale-90 flex items-center justify-center cursor-pointer shrink-0 ${
          copied 
            ? 'bg-amber-500/10 text-[#d4af37] border border-[#d4af37]/30 shadow-[0_0_8px_rgba(212,175,55,0.25)]' 
            : 'bg-slate-800/40 text-slate-400 hover:text-white border border-slate-705 hover:bg-slate-800/80'
        } ${className}`}
        title={copied ? "Copied! / تم النسخ" : "Copy / نسخ"}
      >
        {copied ? (
          <Check size={iconSize} className="animate-pulse text-[#d4af37]" />
        ) : (
          <Copy size={iconSize} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-1.5 font-bold font-sans cursor-pointer text-[10px] shrink-0 ${
        copied
          ? 'bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 shadow-[0_0_10px_rgba(212,175,55,0.1)]'
          : 'bg-slate-800/60 text-slate-350 hover:text-white border border-slate-705 hover:bg-slate-750'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check size={iconSize} className="text-[#d4af37] animate-pulse" />
          <span>{labelCopied || (document.documentElement.lang === 'ar' || true ? 'تم النسخ!' : 'Copied!')}</span>
        </>
      ) : (
        <>
          <Copy size={iconSize} />
          <span>{label || (document.documentElement.lang === 'ar' || true ? 'نسخ' : 'Copy')}</span>
        </>
      )}
    </button>
  );
}
