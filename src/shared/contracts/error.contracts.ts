export interface ErrorDetails {
  code: string;
  message: string;
  details?: unknown[];
  requestId?: string;
}

export interface ErrorEnvelope {
  success: false;
  error: ErrorDetails;
}

/** A safe, transport-neutral application error suitable for Gateway and HTTP boundaries. */
export class ApplicationError extends Error {
  readonly code: string;
  readonly details?: unknown[];
  readonly requestId?: string;
  readonly causeValue?: unknown;

  constructor(details: ErrorDetails, cause?: unknown) {
    super(details.message);
    this.name = 'ApplicationError';
    this.code = details.code;
    this.details = details.details;
    this.requestId = details.requestId;
    this.causeValue = cause;
  }

  toEnvelope(): ErrorEnvelope {
    const error: ErrorDetails = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    if (this.requestId !== undefined) error.requestId = this.requestId;
    return { success: false, error };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrorDetails(value: unknown): ErrorDetails | null {
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string') return null;
  const result: ErrorDetails = { code: value.code, message: value.message };
  if (Array.isArray(value.details)) result.details = value.details;
  if (typeof value.requestId === 'string') result.requestId = value.requestId;
  return result;
}

export function errorDetailsFromUnknown(error: unknown, fallbackCode = 'UNKNOWN_ERROR'): ErrorDetails {
  if (error instanceof ApplicationError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
      ...(error.requestId !== undefined ? { requestId: error.requestId } : {}),
    };
  }

  if (isRecord(error)) {
    const envelopeDetails = toErrorDetails(error.error);
    if (error.success === false && envelopeDetails) return envelopeDetails;

    const directDetails = toErrorDetails(error);
    if (directDetails) return directDetails;
  }

  if (error instanceof Error) return { code: fallbackCode, message: error.message };
  if (typeof error === 'string') return { code: fallbackCode, message: error };
  return { code: fallbackCode, message: 'An unexpected error occurred.' };
}

/**
 * وصف قابل للتشخيص لخطأ الـAPI: يضمّن مشاكل التحقق الحقليّة داخل نص الرسالة.
 * Turns an API failure into a readable string that names the offending fields, so a 400/422
 * explains itself in the UI instead of surfacing a generic blocker.
 */
export function describeError(error: unknown, fallback = 'Unknown error'): string {
  const details = errorDetailsFromUnknown(error, 'UNKNOWN_ERROR');
  const issues = Array.isArray(details.details)
    ? details.details
        .filter(isRecord)
        .filter((issue) => typeof issue.message === 'string')
        .map((issue) => `${typeof issue.field === 'string' && issue.field.length > 0 ? issue.field : 'request'}: ${String(issue.message)}`)
        .slice(0, 5)
    : [];
  const genericMessage = 'An unexpected error occurred.';
  const message = !details.message || details.message === genericMessage ? fallback : details.message;
  return issues.length > 0 ? `${message} (${issues.join('; ')})` : message;
}
