/**
 * SavePresetModal.tsx
 * مودال حفظ الفلتر الحالي كقالب مخصص
 * Save current report filter preset modal
 */

import React from 'react';

interface SavePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  newPresetName: string;
  setNewPresetName: (val: string) => void;
  handleSaveFilterTemplate: () => void;
}

export const SavePresetModal: React.FC<SavePresetModalProps> = ({
  isOpen,
  onClose,
  isAr,
  newPresetName,
  setNewPresetName,
  handleSaveFilterTemplate
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in no-print">
      <div className="bg-[#111114] border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-4">
        <h3 className="text-sm font-black text-white">{isAr ? 'حفظ الفلتر الحالي كقالب مخصص' : 'Save Filter Preset'}</h3>
        <input
          type="text"
          placeholder={isAr ? 'ادخل اسم القالب المخصص (مثال: تقارير مبيعات صنعاء)' : 'Preset Name...'}
          value={newPresetName}
          onChange={e => setNewPresetName(e.target.value)}
          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-[#d4af37]"
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-xs font-bold"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handleSaveFilterTemplate}
            className="px-4 py-2 bg-[#d4af37] text-black rounded-xl text-xs font-black"
          >
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePresetModal;
