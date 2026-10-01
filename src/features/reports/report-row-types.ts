export interface ReportOrder {
  id: string;
  orderNumber?: string;
  orderStatus?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  shippingCourierId?: string;
  deliveryCourierId?: string;
  courierId?: string;
  shippingCompany?: string;
  shippingCompanyId?: string;
  trackingNumber?: string;
  destinationCity?: string;
  destinationCountry?: string;
  updatedAt?: string | number | Date | null;
  totalPrice?: string | number;
  totalCostSAR?: string | number;
  totalCostYER?: string | number;
  amountPaid?: string | number;
  amountRemaining?: string | number;
  shippingCostSAR?: string | number;
  packagingFee?: string | number;
  currency?: string;
  createdAt?: string | number | Date | null;
  [key: string]: string | number | Date | null | undefined;
}

export interface ReportCourier {
  id: string;
  fullName?: string;
  phone?: string;
  address?: string;
  courierType?: string;
  outstandingCustody?: number;
  financialBalance?: number;
  financialCurrency?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportCustomer {
  id: string;
  fullName?: string;
  displayName?: string;
  phone?: string;
  address?: string;
  financialBalance?: number;
  financialCurrency?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportShippingCompany {
  id: string;
  name?: string;
  type?: string;
  phone?: string;
  dueAmount?: number | string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportUser {
  id: string;
  fullName?: string;
  displayName?: string;
  email?: string;
  role?: string;
  accountId?: string;
  monthlySalary?: number;
  baseSalary?: number;
  financialBalance?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportAccount {
  id: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  name?: string;
  accountCode?: string;
  currency?: string;
  balance?: string | number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportTransaction {
  id: string;
  accountId?: string;
  entityId?: string;
  refNumber?: string;
  description?: string;
  type?: string;
  amount?: number;
  runningBalance?: string | number | null;
  currency?: string;
  currencyOriginal?: string | null;
  createdAt?: string | number | Date | null;
  [key: string]: string | number | Date | null | undefined;
}

export interface ReportExpense {
  id: string;
  expenseNumber?: string;
  recipientEntityId?: string;
  recipientName?: string;
  notes?: string;
  type?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  [key: string]: string | number | boolean | null | undefined;
}
