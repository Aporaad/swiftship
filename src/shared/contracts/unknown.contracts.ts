export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

export function readErrorMessage(value: unknown, fallback = 'Unexpected error'): string {
  if (value instanceof Error && value.message) return value.message;
  if (isRecord(value) && typeof value.message === 'string' && value.message.length > 0) {
    return value.message;
  }
  return fallback;
}

export function readErrorCode(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.code === 'string' ? value.code : undefined;
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
