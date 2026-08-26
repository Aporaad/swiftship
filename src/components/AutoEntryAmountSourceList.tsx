import { AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS, type AutoEntryAmountSource } from '../services/autoEntryRules';

export function AutoEntryAmountSourceList({
  isAr,
  selectedSources,
  onToggle,
}: {
  isAr: boolean;
  selectedSources: string[];
  onToggle: (source: AutoEntryAmountSource, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1" data-testid="auto-entry-amount-sources">
      {AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS.map(option => {
        const selected = selectedSources.includes(option.id);
        return (
          <label key={option.id} className={`flex items-start gap-2 rounded-xl border p-2.5 cursor-pointer transition ${selected ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-white' : 'bg-black/20 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onToggle(option.id, event.target.checked)}
              className="mt-0.5 rounded border-slate-700 accent-[#d4af37]"
            />
            <span className="text-[10px] font-bold leading-relaxed">{isAr ? option.labelAr : option.labelEn}</span>
          </label>
        );
      })}
    </div>
  );
}
