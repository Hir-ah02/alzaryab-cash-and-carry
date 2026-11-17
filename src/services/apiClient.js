/**
 * The one place that talks to the Django API.
 *
 * - Sends the access token and, on a 401, refreshes it once and retries.
 * - If the session can't be refreshed, clears it and calls the
 *   session-expired handler (AuthContext sends the user to /login).
 * - Turns every failure into an ApiError with a message that is safe to
 *   show; server internals are never passed through.
 */
import { readSession, updateSession, clearSession } from './session.js';

export const API_BASE = (import.meta.env?.VITE_API_URL || '/api').replace(/\/+$/, '');

export const MESSAGES = {
  network: "Can't reach the server. Check your connection and try again.",
  server: 'Something went wrong on our side. Please try again.',
  expired: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have permission to do that.",
  notFound: 'Not found.',
  invalid: 'Please check the highlighted fields.',
  conflict: 'This change conflicts with existing data. Please refresh and try again.',
  tooLarge: 'The file is too large to upload.',
  throttled: 'Too many attempts. Please wait a minute and try again.',
};

export class ApiError extends Error {
  /**
   * @param {string} message  safe to show to the user
   * @param {{ status?: number, code?: string, fields?: Record<string, string> }} details
   *   status 0 means the server could not be reached; fields holds per-field validation messages.
   */
  constructor(message, { status = 0, code = '', fields = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let onSessionExpired = () => {};

/** AuthContext registers this to sign the user out when the session can't be renewed. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler ?? (() => {});
}

function expireSession() {
  clearSession();
  onSessionExpired();
  return new ApiError(MESSAGES.expired, { status: 401, code: 'session_expired' });
}

async function send(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { Accept: 'application/json' };
  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(MESSAGES.network, { code: 'network' });
  }
}

async function readJson(res) {
  const text = res.status === 204 ? '' : await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** First message in a DRF error value: "x", ["x"], {"a": ["x"]} → "x" */
function firstMessage(value) {
  if (Array.isArray(value)) return firstMessage(value[0]);
  if (value && typeof value === 'object') return firstMessage(Object.values(value)[0]);
  return value == null ? '' : String(value);
}

export function toApiError(status, data) {
  const detail = typeof data?.detail === 'string' ? data.detail : '';
  const code = typeof data?.code === 'string' ? data.code : '';

  if (status === 400) {
    const fields = {};
    let message = '';
    Object.entries(data && typeof data === 'object' ? data : {}).forEach(([key, value]) => {
      if (key === 'detail' || key === 'non_field_errors') message = firstMessage(value);
      else if (key !== 'code') fields[key] = firstMessage(value);
    });
    return new ApiError(message || MESSAGES.invalid, { status, code: 'invalid', fields });
  }
  if (status === 401) return new ApiError(detail || MESSAGES.expired, { status, code });
  if (status === 403) return new ApiError(detail || MESSAGES.forbidden, { status, code });
  if (status === 404) return new ApiError(MESSAGES.notFound, { status, code: 'not_found' });
  if (status === 409) return new ApiError(detail || MESSAGES.conflict, { status, code });
  if (status === 413) return new ApiError(MESSAGES.tooLarge, { status, code: 'too_large' });
  if (status === 429) return new ApiError(MESSAGES.throttled, { status, code: 'throttled' });
  return new ApiError(MESSAGES.server, { status, code: 'server' });
}

let refreshing = null;

/**
 * Exchanges the refresh token for new tokens. Resolves to the new access
 * token, or null if the session is over. Concurrent callers share one request.
 * Network and server failures reject instead, so a blip doesn't sign anyone out.
 */
function refreshAccessToken(usedRefresh) {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await send('/auth/refresh/', { method: 'POST', body: { refresh: usedRefresh } });
      if (res.ok) {
        const tokens = await readJson(res);
        updateSession({ access: tokens.access, refresh: tokens.refresh ?? usedRefresh });
        return tokens.access;
      }
      if (res.status === 400 || res.status === 401) {
        // Another tab may have rotated the token a moment earlier.
        const current = readSession();
        return current && current.refresh !== usedRefresh ? current.access : null;
      }
      throw toApiError(res.status, await readJson(res));
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * @param {string} path  e.g. '/products/?page=2'
 * @param {{ method?: string, body?: object|FormData, auth?: boolean, signal?: AbortSignal }} options
 * @returns {Promise<any>} parsed JSON, or null for empty responses
 */
export async function apiRequest(path, { method = 'GET', body, auth = true, signal } = {}) {
  const session = auth ? readSession() : null;
  if (auth && !session) throw expireSession();

  let res = await send(path, { method, body, token: session?.access, signal });

  if (auth && res.status === 401) {
    const access = await refreshAccessToken(session.refresh);
    if (!access) throw expireSession();
    res = await send(path, { method, body, token: access, signal });
    if (res.status === 401) throw expireSession();
  }

  const data = await readJson(res);
  if (!res.ok) throw toApiError(res.status, data);
  return data;
}
