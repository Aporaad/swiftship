import { ListFilter, Search, UserRound, UsersRound, Truck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { filterOrderParties, getOrderPartyLabel, type OrderParty } from '../../services/orderPartyService';

type Props = {
  isAr: boolean;
  parties: OrderParty[];
  selectedParty: OrderParty | null;
  staffOnly: boolean;
  onStaffOnlyChange: (value: boolean) => void;
  onSelect: (party: OrderParty) => void;
  onClear: () => void;
};

const PartyIcon = ({ type }: { type: OrderParty['type'] }) => {
  if (type === 'courier') return <Truck className="h-4 w-4 text-cyan-300" />;
  if (type === 'employee') return <UsersRound className="h-4 w-4 text-violet-300" />;
  return <UserRound className="h-4 w-4 text-amber-300" />;
};

export default function OrderPartyPicker({
  isAr,
  parties,
  selectedParty,
  staffOnly,
  onStaffOnlyChange,
  onSelect,
  onClear,
}: Props) {
  const [isListOpen, setIsListOpen] = useState(false);
  const [listQuery, setListQuery] = useState('');
  const availableParties = useMemo(
    () => filterOrderParties(parties, listQuery, staffOnly),
    [parties, listQuery, staffOnly],
  );

  const setStaffMode = (value: boolean) => {
    onStaffOnlyChange(value);
    setListQuery('');
  };

  const closeList = () => {
    setIsListOpen(false);
    setListQuery('');
  };

  const choose = (party: OrderParty) => {
    onSelect(party);
    closeList();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-black text-slate-300">
          <input
            type="checkbox"
            checked={staffOnly}
            onChange={(event) => {
              setStaffMode(event.target.checked);
              if (event.target.checked) setIsListOpen(true);
            }}
            className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-[#d4af37]"
          />
          {isAr ? 'الطلب لموظف/مندوب' : 'Order for employee/courier'}
        </label>
        <button
          type="button"
          onClick={() => setIsListOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-black text-cyan-200 transition hover:bg-cyan-500/20"
        >
          <ListFilter className="h-3.5 w-3.5" />
          {isAr ? 'الاختيار من القائمة' : 'Choose from list'}
        </button>
      </div>

      {selectedParty ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <PartyIcon type={selectedParty.type} />
            <div className="min-w-0">
              <span className="block truncate text-xs font-black text-white">{selectedParty.name}</span>
              <span className="block text-[9px] font-bold text-slate-500">
                {getOrderPartyLabel(selectedParty.type, isAr)}{selectedParty.financialAccountCode ? ` · ${selectedParty.financialAccountCode}` : ''}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClear} className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-white" aria-label={isAr ? 'إزالة الاختيار' : 'Clear selection'}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 px-3 py-2 text-[10px] font-bold text-slate-500">
          {staffOnly ? (isAr ? 'اختر موظفًا أو مندوبًا من القائمة المنبثقة.' : 'Choose an employee or courier from the popup list.') : (isAr ? 'اختر عميلًا من القائمة المنبثقة أو استخدم بحث العميل المباشر أدناه.' : 'Choose a customer from the popup list or use the direct customer search below.')}
        </p>
      )}

      {isListOpen && createPortal(
        <div
          className="fixed inset-0 z-[999999] isolate flex items-center justify-center bg-slate-950 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-party-picker-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={isAr ? 'إغلاق نافذة اختيار طرف الطلب' : 'Close order party selector'}
            onClick={closeList}
          />
          <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="border-b border-slate-800 px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="order-party-picker-title" className="text-sm font-black text-white">{isAr ? 'اختيار طرف الطلب' : 'Choose order party'}</h3>
                  <p className="mt-1 text-[10px] font-medium text-slate-500">
                    {staffOnly
                      ? (isAr ? 'تظهر الموظفون والمناديب فقط.' : 'Employees and couriers only are shown.')
                      : (isAr ? 'تظهر العملاء فقط؛ فعّل الخيار أدناه لعرض الموظفين والمناديب.' : 'Customers only are shown. Enable the option below for employees and couriers.')}
                  </p>
                </div>
                <button type="button" onClick={closeList} className="rounded-xl bg-slate-900 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label={isAr ? 'إغلاق' : 'Close'}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] font-black text-slate-200">
                <input
                  type="checkbox"
                  checked={staffOnly}
                  onChange={(event) => setStaffMode(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-[#d4af37]"
                />
                {isAr ? 'الطلب لموظف/مندوب' : 'Order for employee/courier'}
              </label>

              <div className="relative mt-3">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  autoFocus
                  value={listQuery}
                  onChange={(event) => setListQuery(event.target.value)}
                  placeholder={isAr ? 'ابحث بالاسم أو الجوال أو رمز الحساب...' : 'Search by name, phone, or account code...'}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-3 pr-9 text-xs font-bold text-white outline-none transition focus:border-[#d4af37]/70"
                />
              </div>
            </div>

            <div className="max-h-[min(56vh,28rem)] divide-y divide-slate-850 overflow-y-auto">
              {availableParties.length ? availableParties.map((party) => (
                <button key={`${party.type}-${party.id}`} type="button" onClick={() => choose(party)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-start transition hover:bg-slate-900">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="rounded-xl border border-slate-800 bg-slate-900 p-2"><PartyIcon type={party.type} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black text-white">{party.name}</span>
                      <span className="block truncate text-[10px] text-slate-500">{party.phone || party.email || party.id}</span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] font-black text-slate-300">{getOrderPartyLabel(party.type, isAr)}</span>
                </button>
              )) : (
                <div className="p-8 text-center text-[11px] font-bold text-slate-500">{isAr ? 'لا توجد نتائج مطابقة.' : 'No matching parties.'}</div>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
