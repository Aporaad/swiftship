import type { GatewayFailure } from '../contracts/common.gateway';

export class DataGatewayError extends Error {
  readonly code: string;
  readonly causeValue: unknown;

  constructor(failure: GatewayFailure) {
    super(failure.message);
    this.name = 'DataGatewayError';
    this.code = failure.code;
    this.causeValue = failure.cause;
  }
}

export function mapSupabaseError(error: unknown): DataGatewayError {
  const value = error as { code?: string; message?: string } | null;
  return new DataGatewayError({
    code: value?.code ?? 'DATA_GATEWAY_ERROR',
    message: value?.message ?? 'Data gateway request failed',
    cause: error,
  });
}

export function mapRow<T>(row: unknown, mapper: (value: Record<string, unknown>) => T): T {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new DataGatewayError({
      code: 'INVALID_DATA_ROW',
      message: 'The data gateway received an invalid row',
      cause: row,
    });
  }
  return mapper(row as Record<string, unknown>);
}
