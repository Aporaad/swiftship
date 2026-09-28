import type { EmployeesCreateInput, EmployeesUpdateInput } from '../../../data/dtos/employees.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const employeeRules = { fullName: 'nonEmptyString', nameAr: 'string', nameEn: 'string', accountId: 'string', monthlySalary: 'number', currency: 'string', jobType: 'string', commissionRate: 'number' } as const;
export const employeesCreateSchema = makeObjectSchema<EmployeesCreateInput>(['fullName'], employeeRules);
export const employeesUpdateSchema = makeObjectSchema<EmployeesUpdateInput>([], employeeRules);
