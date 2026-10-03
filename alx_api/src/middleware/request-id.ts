import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

export function resolveRequestId(candidate: string | undefined): string {
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  const requestId = resolveRequestId(request.header('x-request-id'));
  response.locals.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
};
