import { ApplicationError } from '../../shared/contracts/error.contracts';
import type { GatewayFailure } from '../contracts/common.gateway';

export class DataGatewayError extends ApplicationError {
  constructor(failure: GatewayFailure) {
    super(failure, failure.cause);
    this.name = 'DataGatewayError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function mapSupabaseError(error: unknown): DataGatewayError {
  const value = asRecord(error);
  const code = typeof value?.code === 'string' && value.code.length > 0
    ? value.code
    : 'DATA_GATEWAY_ERROR';

  return new DataGatewayError({
    code,
    message: 'Data gateway request failed.',
    details: [],
    cause: error,
  });
}

export function mapRow<T>(row: unknown, mapper: (value: Record<string, unknown>) => T): T {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new DataGatewayError({
      code: 'INVALID_DATA_ROW',
      message: 'The data gateway received an invalid row.',
      details: [],
      cause: row,
    });
  }
  return mapper(row as Record<string, unknown>);
}
