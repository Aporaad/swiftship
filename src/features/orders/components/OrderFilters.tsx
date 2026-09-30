import { Search } from 'lucide-react';

interface OrderStatusOption {
  id: string | number;
  nameAr?: string;
  nameEn?: string;
}

interface CourierOption {
  id: string;
  fullName?: string;
}

export interface OrderFiltersProps {
  isAr: boolean;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  courierFilter: string;
  onCourierFilterChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  orderStatuses: OrderStatusOption[];
  couriers: CourierOption[];
}

/** Presentation-only controls for filtering and sorting the orders list. */
export function OrderFilters({
  isAr,
  searchText,
  onSearchTextChange,
  statusFilter,
  onStatusFilterChange,
  courierFilter,
  onCourierFilterChange,
  sortBy,
  onSortByChange,
  orderStatuses,
  couriers,
}: OrderFiltersProps) {
  return (
    <div className="p-4 border-b border-slate-800 flex flex-wrap gap-3 bg-slate-950/20">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
        <input
          type="text"
          placeholder={isAr ? 'البحث بالاسم، الموحد أو الجوال...' : 'Find by code, Name, Track ID...'}
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          className="w-full pr-9 pl-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-bold text-start"
        />
      </div>

      <select
        value={statusFilter}
        onChange={(event) => onStatusFilterChange(event.target.value)}
        className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <option value="all">{isAr ? 'جميع الحالات الكلية' : 'All States'}</option>
        {orderStatuses.map((status) => (
          <option key={status.id} value={String(status.id)}>
            {isAr ? status.nameAr : status.nameEn}
          </option>
        ))}
      </select>

      <select
        value={courierFilter}
        onChange={(event) => onCourierFilterChange(event.target.value)}
        className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <option value="all">{isAr ? 'جميع الكوادر والمناديب' : 'All Couriers'}</option>
        {couriers.map((courier) => (
          <option key={courier.id} value={courier.id}>{courier.fullName}</option>
        ))}
      </select>

      <select
        value={sortBy}
        onChange={(event) => onSortByChange(event.target.value)}
        className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <option value="date-desc">{isAr ? 'التاريخ (الأحدث)' : 'Newest'}</option>
        <option value="date-asc">{isAr ? 'التاريخ (الأقدم)' : 'Oldest'}</option>
        <option value="amount-desc">{isAr ? 'القيمة (الأعلى)' : 'Highest Amount'}</option>
      </select>
    </div>
  );
}
