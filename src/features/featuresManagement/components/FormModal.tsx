import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * FormModal.tsx — نافذة منبثقة مستقلة لنماذج الإنشاء/التعديل في قسم إدارة الميزات.
 * Standalone popup dialog for create/edit forms in the features-management section.
 *
 * نمط التغليف مطابق لنوافذ النظام الأخرى (fixed inset-0 z-50 + خلفية معتمة) — DRY واتساق بصري.
 * Mirrors the existing system modal pattern (fixed inset-0 z-50 + dimmed backdrop) for DRY + visual consistency.
 * لا يحتوي أي منطق أعمال: حاوية عرض فقط تُغلق بـ Escape أو النقر خارج البطاقة.
 * Contains no business logic: a presentational container closing on Escape or outside click.
 */

interface FormModalProps {
  /** هل النافذة مفتوحة — عند إغلاقها لا يُعرض شيء (توفير DOM). */
  open: boolean;
  /** عنوان النافذة الظاهر في شريطها العلوي. */
  title: string;
  /** يُستدعى عند الطلب (X / Escape / خارج البطاقة). */
  onClose: () => void;
  children: React.ReactNode;
}

export const FormModal: React.FC<FormModalProps> = ({
  open,
  title,
  onClose,
  children,
}) => {
  // إغلاق بمفتاح Escape — سلوك النوافذ المنبثقة القياسي (Accessibility).
  // Close on Escape key — standard popup accessibility behavior.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // النقر على الخلفية فقط (وليس داخل البطاقة) يغلق النافذة.
    // Backdrop click (target must be the overlay itself) closes the modal.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-[#0a0a0c] border border-[#d4af37]/30 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-[0_25px_60px_rgba(0,0,0,0.7)] animate-fade-in"
      >
        <div className="flex items-center justify-between gap-4 sticky -top-5 pt-5 pb-1 bg-[#0a0a0c] z-10">
          <h4 className="text-sm font-black text-white">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default FormModal;
