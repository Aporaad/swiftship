import type { PageQuery, PageResult } from '../operations/operations.contracts';

export interface UsersRepository {
  listUsers(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getUser(userId: string): Promise<Record<string, unknown> | null>;
  createUser(input: CreateUserInput): Promise<Record<string, unknown>>;
  updateUser(input: UpdateUserInput): Promise<Record<string, unknown> | null>;
  /** حذف ناعم للمستخدم: تعطيل الحساب (disabled=true) بدلاً من الحذف الفعلي لحفظ سجل التدقيق */
  deleteUser(userId: string, actorId?: string): Promise<boolean>;
  listUserRoles(userId: string): Promise<readonly string[]>;
  setUserRoles(userId: string, roleCodes: readonly string[], actorId?: string): Promise<readonly string[]>;
}

export interface CreateUserInput {
  userId?: string | undefined;
  username: string;
  email?: string | undefined;
  fullName?: string | undefined;
  role?: string | undefined;
  disabled?: boolean | undefined;
  phone?: string | undefined;
  address?: string | undefined;
  linkedType?: string | undefined;
  linkedEntity?: string | undefined;
  actorId?: string | undefined;
}

export interface UpdateUserInput {
  userId: string;
  username?: string | undefined;
  email?: string | undefined;
  fullName?: string | undefined;
  role?: string | undefined;
  disabled?: boolean | undefined;
  phone?: string | undefined;
  address?: string | undefined;
  linkedType?: string | undefined;
  linkedEntity?: string | undefined;
  actorId?: string | undefined;
}
