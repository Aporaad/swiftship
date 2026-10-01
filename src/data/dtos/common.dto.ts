export type IsoUtcString = string & { readonly __brand: 'IsoUtcString' };
export type NumericValue = number | string;
export type JsonObject = Record<string, unknown>;

export interface PaginationInput {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface PaginationDto<T> {
  items: T[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface MoneyDto {
  amount: number;
  currency: string | null;
  exchangeRate?: number | null;
  precision: number;
  isOriginalAmount: boolean;
}

export interface AuditDto {
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export type FieldRule = 'string' | 'nonEmptyString' | 'number' | 'boolean' | 'stringArray' | 'object';

export interface Schema<T> {
  parse(input: unknown): T;
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: Error };
}

function matchesRule(value: unknown, rule: FieldRule): boolean {
  switch (rule) {
    case 'string':
      return typeof value === 'string';
    case 'nonEmptyString':
      return typeof value === 'string' && value.trim().length > 0;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'stringArray':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}

export function makeObjectSchema<T>(
  requiredKeys: readonly string[],
  fieldRules: Readonly<Record<string, FieldRule>> = {},
): Schema<T> {
  const parse = (input: unknown): T => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Expected an object input');
    }

    const value = input as Record<string, unknown>;
    for (const key of requiredKeys) {
      if (value[key] === undefined || value[key] === null || value[key] === '') {
        throw new Error(`Missing required field: ${key}`);
      }
    }

    for (const [key, rule] of Object.entries(fieldRules)) {
      if (value[key] !== undefined && !matchesRule(value[key], rule)) {
        throw new Error(`Invalid field: ${key}`);
      }
    }

    return value as T;
  };

  return {
    parse,
    safeParse(input) {
      try {
        return { success: true, data: parse(input) };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
      }
    },
  };
}

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asIsoUtc(value: string): IsoUtcString {
  const timestamp = Date.parse(value);
  if (!value || Number.isNaN(timestamp)) {
    throw new Error('Expected an ISO timestamp');
  }
  return new Date(timestamp).toISOString() as IsoUtcString;
}

export function isoOrNull(value?: string | null): IsoUtcString | null {
  return value ? asIsoUtc(value) : null;
}

export function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function numberOrNull(value: NumericValue | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function booleanOrDefault(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export {
  amountOrNull,
  approvalStatusOrNull,
  currencyCodeOrNull,
  isoDateOrNull,
  statusCodeOrNull,
} from '../../shared/contracts/value-primitives';
export type {
  Amount,
  ApprovalStatus,
  CurrencyCode,
  IsoDateString,
  StatusCode,
} from '../../shared/contracts/value-primitives';
