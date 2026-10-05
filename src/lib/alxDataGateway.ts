/**
 * alxDataGateway.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * بوابة بيانات موحدة لنقل الاعتماد تدريجيًا إلى alx_api.
 * Unified data gateway for progressive dependency migration to alx_api.
 *
 * المبدأ:
 *  - كل دالة تقرأ أو تكتب تعتمد على alx_api إذا كان متاحًا.
 *  - يمكن استخدام هذه الدوال كبدائل مباشرة لدوال supabase-adapter.ts.
 *  - لا يعرف UI تفاصيل قاعدة البيانات.
 */

import { alxRequest } from './alxApiClient';

// ── أنواع مشتركة ──────────────────────────────────────────────────────────────

export interface PageParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserRecord {
  userId: string;
  username: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
  disabled: boolean;
  isRoot: boolean;
  phone?: string | null;
  address?: string | null;
  linkedType?: string | null;
  linkedEntity?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * جلب قائمة المستخدمين مع دعم البحث والصفحات.
 * List users with search and pagination support.
 */
export async function listUsers(params: PageParams = {}): Promise<PagedResult<UserRecord>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.search) query.set('search', params.search);

  const result = await alxRequest<UserRecord[]>(`/api/v1/users?${query}`);
  if (!result.success) throw new Error(result.error.message);

  return {
    items: result.data,
    total: (result.meta?.['total'] as number | undefined) ?? result.data.length,
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  };
}

/**
 * جلب مستخدم واحد بمعرفه.
 * Get a single user by ID.
 */
export async function getUser(userId: string): Promise<UserRecord | null> {
  const result = await alxRequest<UserRecord>(`/api/v1/users/${userId}`);
  if (!result.success) {
    if (result.error.code === 'ENTITY_NOT_FOUND') return null;
    throw new Error(result.error.message);
  }
  return result.data;
}

/**
 * إنشاء مستخدم جديد.
 * Create a new user.
 */
export async function createUser(input: {
  username: string;
  email?: string;
  fullName?: string;
  role?: string;
  phone?: string;
  address?: string;
}): Promise<UserRecord> {
  const result = await alxRequest<UserRecord>('/api/v1/users', {
    method: 'POST',
    body: input,
  });
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

/**
 * تعديل بيانات مستخدم.
 * Update a user's data.
 */
export async function updateUser(
  userId: string,
  input: Partial<{
    username: string;
    email: string;
    fullName: string;
    role: string;
    disabled: boolean;
    phone: string;
    address: string;
  }>,
): Promise<UserRecord | null> {
  const result = await alxRequest<UserRecord>(`/api/v1/users/${userId}`, {
    method: 'PATCH',
    body: input,
  });
  if (!result.success) {
    if (result.error.code === 'ENTITY_NOT_FOUND') return null;
    throw new Error(result.error.message);
  }
  return result.data;
}

/**
 * تعطيل مستخدم (Soft Delete — لا يُحذف فعلياً لحفظ سجل التدقيق).
 * Disable a user (Soft Delete — not physically removed, to preserve audit trail).
 */
export async function disableUser(userId: string): Promise<boolean> {
  const result = await alxRequest(`/api/v1/users/${userId}`, { method: 'DELETE' });
  return result.success;
}

/**
 * إدارة أدوار المستخدم.
 * Manage user roles.
 */
export async function setUserRoles(userId: string, roles: string[]): Promise<string[]> {
  const result = await alxRequest<{ roles: string[] }>(`/api/v1/users/${userId}/roles`, {
    method: 'POST',
    body: { roles },
  });
  if (!result.success) throw new Error(result.error.message);
  return result.data.roles;
}

// ── Couriers (المندوبون) ──────────────────────────────────────────────────────

export interface CourierRecord {
  courierId: string;
  name: string;
  phone?: string | null;
  status?: string | null;
  assignedOrders?: number;
  createdAt?: string;
}

/**
 * جلب قائمة المندوبين.
 * List couriers.
 */
export async function listCouriers(params: PageParams = {}): Promise<PagedResult<CourierRecord>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.search) query.set('search', params.search);

  const result = await alxRequest<CourierRecord[]>(`/api/v1/reporting/couriers?${query}`);
  if (!result.success) throw new Error(result.error.message);

  return {
    items: result.data,
    total: (result.meta?.['total'] as number | undefined) ?? result.data.length,
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  };
}

/**
 * إنشاء مندوب جديد.
 * Create a new courier.
 */
export async function createCourier(input: {
  name: string;
  phone?: string;
  status?: string;
}): Promise<CourierRecord> {
  const result = await alxRequest<CourierRecord>('/api/v1/operations/couriers', {
    method: 'POST',
    body: input,
  });
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

/**
 * تعديل بيانات مندوب.
 * Update a courier's data.
 */
export async function updateCourier(
  courierId: string,
  input: Partial<{ name: string; phone: string; status: string }>,
): Promise<CourierRecord | null> {
  const result = await alxRequest<CourierRecord>(`/api/v1/operations/couriers/${courierId}`, {
    method: 'PATCH',
    body: input,
  });
  if (!result.success) {
    if (result.error.code === 'ENTITY_NOT_FOUND') return null;
    throw new Error(result.error.message);
  }
  return result.data;
}

/**
 * حذف مندوب.
 * Delete a courier.
 */
export async function deleteCourier(courierId: string): Promise<boolean> {
  const result = await alxRequest(`/api/v1/operations/couriers/${courierId}`, { method: 'DELETE' });
  return result.success;
}

// ── Employees (الموظفون) ───────────────────────────────────────────────────────

export interface EmployeeRecord {
  employeeId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  position?: string | null;
  createdAt?: string;
}

/**
 * جلب قائمة الموظفين.
 * List employees.
 */
export async function listEmployees(params: PageParams = {}): Promise<PagedResult<EmployeeRecord>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.search) query.set('search', params.search);

  const result = await alxRequest<EmployeeRecord[]>(`/api/v1/reporting/employees?${query}`);
  if (!result.success) throw new Error(result.error.message);

  return {
    items: result.data,
    total: (result.meta?.['total'] as number | undefined) ?? result.data.length,
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  };
}

/**
 * إنشاء موظف جديد.
 * Create a new employee.
 */
export async function createEmployee(input: {
  name: string;
  phone?: string;
  email?: string;
  position?: string;
}): Promise<EmployeeRecord> {
  const result = await alxRequest<EmployeeRecord>('/api/v1/operations/employees', {
    method: 'POST',
    body: input,
  });
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

/**
 * تعديل بيانات موظف.
 * Update an employee's data.
 */
export async function updateEmployee(
  employeeId: string,
  input: Partial<{ name: string; phone: string; email: string; position: string }>,
): Promise<EmployeeRecord | null> {
  const result = await alxRequest<EmployeeRecord>(`/api/v1/operations/employees/${employeeId}`, {
    method: 'PATCH',
    body: input,
  });
  if (!result.success) {
    if (result.error.code === 'ENTITY_NOT_FOUND') return null;
    throw new Error(result.error.message);
  }
  return result.data;
}

/**
 * حذف موظف.
 * Delete an employee.
 */
export async function deleteEmployee(employeeId: string): Promise<boolean> {
  const result = await alxRequest(`/api/v1/operations/employees/${employeeId}`, { method: 'DELETE' });
  return result.success;
}

// ── Customers (العملاء) ───────────────────────────────────────────────────────

export interface CustomerRecord {
  customerId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

/**
 * جلب قائمة العملاء.
 * List customers.
 */
export async function listCustomers(params: PageParams & { isActive?: boolean } = {}): Promise<PagedResult<CustomerRecord>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.search) query.set('search', params.search);
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive));

  const result = await alxRequest<CustomerRecord[]>(`/api/v1/customers?${query}`);
  if (!result.success) throw new Error(result.error.message);

  return {
    items: result.data,
    total: (result.meta?.['total'] as number | undefined) ?? result.data.length,
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  };
}

// ── Orders (الطلبات) ──────────────────────────────────────────────────────────

export interface OrderRecord {
  orderId: string;
  orderNumber?: string;
  status?: string;
  customerId?: string;
  courierId?: string;
  totalAmount?: number;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * جلب قائمة الطلبات.
 * List orders.
 */
export async function listOrders(params: PageParams = {}): Promise<PagedResult<OrderRecord>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.search) query.set('search', params.search);

  const result = await alxRequest<OrderRecord[]>(`/api/v1/orders?${query}`);
  if (!result.success) throw new Error(result.error.message);

  return {
    items: result.data,
    total: (result.meta?.['total'] as number | undefined) ?? result.data.length,
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  };
}

/**
 * جلب طلب واحد بمعرفه.
 * Get a single order by ID.
 */
export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  const result = await alxRequest<OrderRecord>(`/api/v1/orders/${orderId}`);
  if (!result.success) {
    if (result.error.code === 'ENTITY_NOT_FOUND') return null;
    throw new Error(result.error.message);
  }
  return result.data;
}

// ── Finance (المالية) ─────────────────────────────────────────────────────────

export interface FinancialEntryRecord {
  entryId: string;
  status?: string;
  totalDebit?: number;
  totalCredit?: number;
  notes?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * جلب قائمة القيود المالية.
 * List financial entries.
 */
export async function listFinancialEntries(params: PageParams = {}): Promise<PagedResult<FinancialEntryRecord>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  const result = await alxRequest<FinancialEntryRecord[]>(`/api/v1/finance/entries?${query}`);
  if (!result.success) throw new Error(result.error.message);

  return {
    items: result.data,
    total: (result.meta?.['total'] as number | undefined) ?? result.data.length,
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  };
}
