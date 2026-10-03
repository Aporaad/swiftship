import type { Response } from 'express';

export interface ApiErrorDetails {
  code: string;
  message: string;
  details: ReadonlyArray<{ field?: string; message: string }>;
  requestId: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorDetails;
}

export function sendSuccess<T>(
  response: Response,
  data: T,
  requestId: string,
  meta?: Record<string, unknown>,
): Response<ApiSuccess<T>> {
  const body: ApiSuccess<T> = meta === undefined
    ? { success: true, data, requestId }
    : { success: true, data, meta, requestId };
  return response.json(body);
}

export function sendFailure(
  response: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
): Response<ApiFailure> {
  return response.status(status).json({
    success: false,
    error: { code, message, details: [], requestId },
  });
}
