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

export interface CustomerWriteInput {
  customerId?: string | undefined;
  accountId?: string | null | undefined;
  isActive?: boolean | undefined;
  joinBy?: string | null | undefined;
  referrerId?: string | null | undefined;
  fullName?: string | null | undefined;
  nameAr?: string | null | undefined;
  nameEn?: string | null | undefined;
  customerLevel?: string | null | undefined;
  acquisitionSource?: string | null | undefined;
  preferredCategories?: unknown;
  location?: unknown;
  address?: string | null | undefined;
  onboardingCompleted?: boolean | null | undefined;
}

export interface CustomerRepository {
  list(query: CustomerListQuery): Promise<{ items: CustomerDto[]; total: number }>;
  findById(customerId: string): Promise<CustomerDto | null>;
  create(input: CustomerWriteInput, actorUserId: string): Promise<CustomerDto>;
  update(customerId: string, input: CustomerWriteInput, actorUserId: string): Promise<CustomerDto | null>;
  archive(customerId: string, actorUserId: string): Promise<CustomerDto | null>;
}
