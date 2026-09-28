import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';

export interface EmployeesDatabaseRow {
  employee_id: string;
  account_id: string | null;
  monthly_salary: NumericValue | null;
  currency: string | null;
  created_at: string | null;
  created_by: string | null;
  full_name: string | null;
  name_ar: string | null;
  name_en: string | null;
  job_type: string | null;
  commission_rate: NumericValue | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface EmployeesApiDto {
  employeeId: string;
  accountId: string | null;
  monthlySalary: number | null;
  currency: string | null;
  fullName: string | null;
  nameAr: string | null;
  nameEn: string | null;
  jobType: string | null;
  commissionRate: number | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface EmployeesCreateInput {
  fullName: string;
  nameAr?: string | null;
  nameEn?: string | null;
  accountId?: string | null;
  monthlySalary?: number | null;
  currency?: string | null;
  jobType?: string | null;
  commissionRate?: number | null;
}
export type EmployeesUpdateInput = Partial<EmployeesCreateInput>;
export type EmployeesViewModel = Partial<EmployeesApiDto> & { id: string };
export type EmployeesAudit = AuditDto;
