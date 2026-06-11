export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  gps_location?: string;
  notes?: string;
  financialBalance?: number;
  financialCurrency?: string;
  financialAccountCode?: string;
  financialAccountId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Courier {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  gpsLocation?: string;
  disabled?: boolean;
  courierCustomId?: string;
  commissionRate?: number;
  notes?: string;
  courierType?: 'sourcing' | 'local';
  financialBalance?: number;
  financialCurrency?: string;
  financialAccountCode?: string;
  financialAccountId?: string;
  createdAt?: number;
  updatedAt?: number;
}
