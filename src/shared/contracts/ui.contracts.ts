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

export interface ErrorDetails {
  code: string;
  message: string;
  details?: unknown[];
  requestId?: string;
}

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; error: ErrorDetails }
  | { status: 'submitting' }
  | { status: 'success-after-mutation'; data?: T };

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

export function errorDetailsFromUnknown(error: unknown, fallbackCode = 'UNKNOWN_ERROR'): ErrorDetails {
  if (error instanceof Error) return { code: fallbackCode, message: error.message };
  if (typeof error === 'string') return { code: fallbackCode, message: error };
  return { code: fallbackCode, message: 'An unexpected error occurred.' };
}
