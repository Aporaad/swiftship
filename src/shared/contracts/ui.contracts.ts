import { errorDetailsFromUnknown } from './error.contracts';
import type { ErrorDetails } from './error.contracts';

export { ApplicationError, errorDetailsFromUnknown } from './error.contracts';
export type { ErrorDetails, ErrorEnvelope } from './error.contracts';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginationState extends PaginationMeta {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; error: ErrorDetails }
  | { status: 'submitting' }
  | { status: 'success-after-mutation'; data?: T };

export const asyncState = {
  idle<T>(): AsyncState<T> {
    return { status: 'idle' };
  },
  loading<T>(): AsyncState<T> {
    return { status: 'loading' };
  },
  success<T>(data: T): AsyncState<T> {
    return { status: 'success', data };
  },
  empty<T>(): AsyncState<T> {
    return { status: 'empty' };
  },
  error<T>(error: unknown, fallbackCode = 'UNKNOWN_ERROR'): AsyncState<T> {
    return { status: 'error', error: errorDetailsFromUnknown(error, fallbackCode) };
  },
  submitting<T>(): AsyncState<T> {
    return { status: 'submitting' };
  },
  mutationSucceeded<T>(data?: T): AsyncState<T> {
    return data === undefined ? { status: 'success-after-mutation' } : { status: 'success-after-mutation', data };
  },
};

export async function runQuery<T>(
  load: () => Promise<T>,
  onState: (state: AsyncState<T>) => void,
  isEmpty: (data: T) => boolean = (data) => Array.isArray(data) && data.length === 0,
): Promise<AsyncState<T>> {
  onState(asyncState.loading());
  try {
    const data = await load();
    const state = isEmpty(data) ? asyncState.empty<T>() : asyncState.success(data);
    onState(state);
    return state;
  } catch (error) {
    const state = asyncState.error<T>(error);
    onState(state);
    return state;
  }
}

export async function runMutation<T>(
  mutate: () => Promise<T>,
  onState: (state: AsyncState<T>) => void,
): Promise<AsyncState<T>> {
  onState(asyncState.submitting());
  try {
    const result = await mutate();
    const state = asyncState.mutationSucceeded(result);
    onState(state);
    return state;
  } catch (error) {
    const state = asyncState.error<T>(error);
    onState(state);
    return state;
  }
}

export function createPaginationMeta(page: number, pageSize: number, totalItems: number): PaginationMeta {
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 1;
  const safeTotalItems = Number.isInteger(totalItems) && totalItems >= 0 ? totalItems : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePageSize));
  return {
    page: Math.min(Math.max(1, Math.trunc(page)), totalPages),
    pageSize: safePageSize,
    totalItems: safeTotalItems,
    totalPages,
  };
}
