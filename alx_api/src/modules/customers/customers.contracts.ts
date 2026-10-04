export interface CustomerDto {
  customerId: string;
  accountId: string | null;
  isActive: boolean;
  joinBy: string | null;
  referrerId: string | null;
  fullName: string | null;
  nameAr: string | null;
  nameEn: string | null;
  customerLevel: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  acquisitionSource: string | null;
  preferredCategories: unknown;
  location: unknown;
  address: string | null;
  onboardingCompleted: boolean | null;
}
export interface CustomerListQuery {
  limit: number;
  offset: number;
  search?: string | undefined;
  isActive?: boolean | undefined;
}
export interface CustomerRepository {
  list(query: CustomerListQuery): Promise<{ items: CustomerDto[]; total: number }>;
  findById(customerId: string): Promise<CustomerDto | null>;
}
