import type { OrderProblem } from './types';

export type ApiErrorCode =
  | 'network'
  | 'timeout'
  | 'not_configured'
  | 'invalid'
  | 'unauthorized'
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'throttled'
  | 'server'
  | string;

/** Messages shown to customers. Server internals are never passed through. */
export const MESSAGES = {
  network: "Can't reach Al Zaryab. Check your internet connection and try again.",
  timeout: 'The server is taking too long to respond. Please try again.',
  notConfigured: 'The app is not connected to a server yet.',
  server: 'Something went wrong on our side. Please try again.',
  invalid: 'Please check the highlighted details.',
  expired: 'Your session has ended. Please sign in again.',
  forbidden: "You don't have access to this.",
  notFound: "We couldn't find that.",
  throttled: 'Too many attempts. Please wait a minute and try again.',
} as const;

export class ApiError extends Error {
  readonly status: number; // 0 when the server couldn't be reached
  readonly code: ApiErrorCode;
  /** Per-field validation messages, e.g. { email: 'An account with this email already exists.' } */
  readonly fields: Record<string, string>;
  /** Order problems from POST /customer/orders/ (out of stock, unavailable…) */
  readonly items: OrderProblem[];

  constructor(
    message: string,
    { status = 0, code = 'server', fields = {}, items = [] }: { status?: number; code?: ApiErrorCode; fields?: Record<string, string>; items?: OrderProblem[] } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.items = items;
  }

  get isNetworkError() {
    return this.code === 'network' || this.code === 'timeout';
  }
}

/** First message in a DRF error value: "x", ["x"], {"a": ["x"]} → "x" */
function firstMessage(value: unknown): string {
  if (Array.isArray(value)) return firstMessage(value[0]);
  if (value && typeof value === 'object') return firstMessage(Object.values(value)[0]);
  return value == null ? '' : String(value);
}

function isOrderProblems(value: unknown): value is OrderProblem[] {
  return Array.isArray(value) && value.every((v) => v && typeof v === 'object' && 'productId' in v && 'message' in v);
}

/** Turns an HTTP error response body into an ApiError with a safe message. */
export function toApiError(status: number, data: unknown): ApiError {
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const detail = typeof body.detail === 'string' ? body.detail : '';
  const code = typeof body.code === 'string' ? body.code : '';

  if (status === 400) {
    const fields: Record<string, string> = {};
    let items: OrderProblem[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (key === 'detail' || key === 'code' || key === 'non_field_errors') continue;
      if (key === 'items' && isOrderProblems(value)) items = value;
      else fields[key] = firstMessage(value);
    }
    const message = detail || firstMessage(body.non_field_errors) || MESSAGES.invalid;
    return new ApiError(message, { status, code: code || 'invalid', fields, items });
  }
  if (status === 401) return new ApiError(detail || MESSAGES.expired, { status, code: code || 'unauthorized' });
  if (status === 403) return new ApiError(detail || MESSAGES.forbidden, { status, code: code || 'forbidden' });
  if (status === 404) return new ApiError(MESSAGES.notFound, { status, code: 'not_found' });
  if (status === 429) return new ApiError(MESSAGES.throttled, { status, code: 'throttled' });
  if (status >= 400 && status < 500 && detail) return new ApiError(detail, { status, code: code || 'client_error' });
  return new ApiError(MESSAGES.server, { status, code: 'server' });
}
